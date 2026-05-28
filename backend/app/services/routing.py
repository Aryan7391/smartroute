from app.db.client import supabase
from app.utils.geo import haversine_km
from fastapi import HTTPException

def interleave_stops(vehicle: dict, orders: list) -> list:
    """
    Build an interleaved stop sequence for a vehicle given a list of orders.
    At each step: go to nearest pickup (if capacity allows) or nearest delivery.
    Returns a list of stops in sequence order.
    """
    stops = []
    pos = {"lat": vehicle["current_lat"], "lng": vehicle["current_lng"]}
    load = 0
    capacity = vehicle["capacity"]
    unassigned = list(orders)
    in_vehicle = []
    sequence = 1

    while unassigned or in_vehicle:
        candidates = []

        if load < capacity:
            for o in unassigned:
                candidates.append({
                    "type":    "pickup",
                    "order":   o,
                    "lat":     o["pickup_lat"],
                    "lng":     o["pickup_lng"],
                    "dist":    haversine_km(pos["lat"], pos["lng"], o["pickup_lat"], o["pickup_lng"])
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
            in_vehicle.append(next_stop["order"])
            unassigned.remove(next_stop["order"])
        else:
            load -= 1
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


def assign_and_build_routes(order_ids: list) -> dict:
    """
    Assign a batch of orders to vehicles and build their routes.
    Called before dispatch.
    """
    # Fetch all orders
    orders_result = supabase.table("orders").select("*").in_("id", order_ids).execute()
    orders = orders_result.data
    if not orders:
        raise HTTPException(status_code=404, detail="No orders found")

    # Fetch all idle vehicles with their drivers
    vehicles_result = supabase.table("vehicles").select("*").eq("status", "idle").execute()
    vehicles = vehicles_result.data
    if not vehicles:
        raise HTTPException(status_code=400, detail="No idle vehicles available")

    # Assign each order to nearest vehicle
    assignment = {v["id"]: [] for v in vehicles}
    for order in orders:
        nearest = min(vehicles, key=lambda v: haversine_km(
            v["current_lat"], v["current_lng"],
            order["pickup_lat"], order["pickup_lng"]
        ))
        assignment[nearest["id"]].append(order)
        supabase.table("orders").update({
            "assigned_vehicle_id": nearest["id"],
            "status": "pending"
        }).eq("id", order["id"]).execute()

    # Build routes and save stops for each vehicle
    for vehicle in vehicles:
        assigned_orders = assignment[vehicle["id"]]
        if not assigned_orders:
            continue

        stops = interleave_stops(vehicle, assigned_orders)

        # Save stops to DB
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

        # Set vehicle to active
        supabase.table("vehicles").update({"status": "active"}).eq("id", vehicle["id"]).execute()

    return {"message": f"Routes built for {len(vehicles)} vehicles"}
