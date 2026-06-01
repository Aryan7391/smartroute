from app.db.client import supabase
from app.utils.geo import haversine_km
from fastapi import HTTPException, BackgroundTasks
from app.utils.osrm import save_segments


def interleave_stops(vehicle: dict, orders: list) -> list:
    """
    Build an interleaved stop sequence for a vehicle given a list of orders.
    At each step: go to nearest pickup (if weight + capacity allows) or nearest delivery.
    Ensures cumulative weight never exceeds vehicle max_weight at any pickup.
    Returns a list of stops in sequence order.
    """
    stops = []
    pos = {"lat": vehicle["current_lat"], "lng": vehicle["current_lng"]}
    load = 0
    current_weight = 0.0
    capacity = vehicle["capacity"]
    max_weight = vehicle.get("max_weight", float("inf"))
    unassigned = list(orders)
    in_vehicle = []
    sequence = 1

    while unassigned or in_vehicle:
        candidates = []

        if load < capacity:
            for o in unassigned:
                # Only consider pickup if weight allows
                if current_weight + o["approx_weight"] <= max_weight:
                    candidates.append({
                        "type":  "pickup",
                        "order": o,
                        "lat":   o["pickup_lat"],
                        "lng":   o["pickup_lng"],
                        "dist":  haversine_km(pos["lat"], pos["lng"], o["pickup_lat"], o["pickup_lng"])
                    })

        for o in in_vehicle:
            candidates.append({
                "type":  "delivery",
                "order": o,
                "lat":   o["delivery_lat"],
                "lng":   o["delivery_lng"],
                "dist":  haversine_km(pos["lat"], pos["lng"], o["delivery_lat"], o["delivery_lng"])
            })

        if not candidates:
            break

        candidates.sort(key=lambda c: c["dist"])
        next_stop = candidates[0]

        if next_stop["type"] == "pickup":
            load += 1
            current_weight += next_stop["order"]["approx_weight"]
            in_vehicle.append(next_stop["order"])
            unassigned.remove(next_stop["order"])
        else:
            load -= 1
            current_weight -= next_stop["order"]["approx_weight"]
            in_vehicle.remove(next_stop["order"])

        stops.append({
            "order_id": next_stop["order"]["id"],
            "type":     next_stop["type"],
            "lat":      next_stop["lat"],
            "lng":      next_stop["lng"],
            "sequence": sequence,
        })
        sequence += 1
        pos = {"lat": next_stop["lat"], "lng": next_stop["lng"]}

    return stops


from app.services.notification import notify_sender_assigned

def assign_and_build_routes(order_ids: list, background_tasks: BackgroundTasks = None) -> dict:
    """
    Assign a batch of orders to vehicles and build their routes.
    Called before dispatch.
    """
    orders_result = supabase.table("orders").select("*").in_("id", order_ids).execute()
    orders = orders_result.data
    if not orders:
        raise HTTPException(status_code=404, detail="No orders found")

    sender_ids = list({o["sender_id"] for o in orders})
    senders_result = supabase.table("users").select("id, phone").in_("id", sender_ids).execute()
    sender_phones = {s["id"]: s["phone"] for s in senders_result.data} if senders_result.data else {}

    vehicles_result = supabase.table("vehicles").select("*").eq("status", "idle").execute()
    vehicles = vehicles_result.data
    if not vehicles:
        raise HTTPException(status_code=400, detail="No idle vehicles available")

    # Assign each order to nearest idle vehicle that has weight + capacity headroom
    assignment = {v["id"]: [] for v in vehicles}
    queued_orders = []

    for order in orders:
        # Sort vehicles by distance to this order's pickup
        sorted_vehicles = sorted(vehicles, key=lambda v: haversine_km(
            v["current_lat"], v["current_lng"],
            order["pickup_lat"], order["pickup_lng"]
        ))

        assigned = False
        for vehicle in sorted_vehicles:
            already_assigned = assignment[vehicle["id"]]
            current_weight = sum(o["approx_weight"] for o in already_assigned)
            current_count  = len(already_assigned)

            if current_count >= vehicle["capacity"]:
                continue
            if current_weight + order["approx_weight"] > vehicle.get("max_weight", float("inf")):
                continue

            assignment[vehicle["id"]].append(order)
            supabase.table("orders").update({
                "assigned_vehicle_id": vehicle["id"],
                "status": "pending"
            }).eq("id", order["id"]).execute()
            
            phone = sender_phones.get(order["sender_id"])
            if phone:
                notify_sender_assigned(phone, order["id"], vehicle["id"])
                
            assigned = True
            break

        if not assigned:
            queued_orders.append(order["id"])
            supabase.table("orders").update({"status": "queued"}).eq("id", order["id"]).execute()
            supabase.table("queue").insert({
                "order_id": order["id"],
                "reason": "no vehicle with sufficient capacity or weight headroom"
            }).execute()

    vehicles_activated = 0
    total_stops = 0

    for vehicle in vehicles:
        assigned_orders = assignment[vehicle["id"]]
        if not assigned_orders:
            continue

        stops = interleave_stops(vehicle, assigned_orders)

        stop_rows = [{
            "vehicle_id": vehicle["id"],
            "order_id":   s["order_id"],
            "type":       s["type"],
            "sequence":   s["sequence"],
            "lat":        s["lat"],
            "lng":        s["lng"],
            "is_done":    False,
        } for s in stops]

        supabase.table("stops").insert(stop_rows).execute()
        supabase.table("vehicles").update({"status": "active"}).eq("id", vehicle["id"]).execute()

        points = [{"lat": vehicle["current_lat"], "lng": vehicle["current_lng"]}] + \
                 [{"lat": s["lat"], "lng": s["lng"]} for s in stops]
        if background_tasks:
            background_tasks.add_task(save_segments, vehicle["id"], points)
        else:
            save_segments(vehicle["id"], points)

        vehicles_activated += 1
        total_stops += len(stops)

    return {
        "message": "Routes built",
        "vehicles_activated": vehicles_activated,
        "total_stops": total_stops,
        "queued_orders": len(queued_orders),
    }