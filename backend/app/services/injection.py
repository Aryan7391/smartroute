from app.db.client import supabase
from app.utils.geo import haversine_km
from app.services.routing import interleave_stops
from fastapi import HTTPException

PROXIMITY_KM = 3.0      # idle vehicle accepts if pickup within 3km
DETOUR_THRESHOLD = 0.40 # active vehicle accepts if detour <= 40% of remaining route

def route_distance(points: list) -> float:
    total = 0.0
    for i in range(1, len(points)):
        total += haversine_km(points[i-1]["lat"], points[i-1]["lng"], points[i]["lat"], points[i]["lng"])
    return total

def inject_order(order_id: str) -> dict:
    # Fetch the order
    order_res = supabase.table("orders").select("*").eq("id", order_id).single().execute()
    if not order_res.data:
        raise HTTPException(status_code=404, detail="Order not found")
    order = order_res.data

    # Fetch all vehicles sorted by distance to pickup
    vehicles_res = supabase.table("vehicles").select("*").execute()
    vehicles = vehicles_res.data
    if not vehicles:
        return _queue_order(order_id, "no vehicles in fleet")

    vehicles.sort(key=lambda v: haversine_km(
        v["current_lat"], v["current_lng"],
        order["pickup_lat"], order["pickup_lng"]
    ))

    all_idle = all(v["status"] == "idle" for v in vehicles)

    for vehicle in vehicles:
        dist_to_pickup = haversine_km(
            vehicle["current_lat"], vehicle["current_lng"],
            order["pickup_lat"], order["pickup_lng"]
        )

        # ── Idle vehicle ──────────────────────────────────────
        if vehicle["status"] == "idle":
            if all_idle or dist_to_pickup <= PROXIMITY_KM:
                return _assign_to_idle(vehicle, order)
            continue

        # ── Active vehicle ────────────────────────────────────
        if vehicle["status"] == "active":
            # Capacity check
            inventory_res = supabase.table("vehicle_inventory") \
                .select("id").eq("vehicle_id", vehicle["id"]).is_("unloaded_at", "null").execute()
            current_load = len(inventory_res.data)
            if current_load >= vehicle["capacity"]:
                continue

            # Fetch remaining stops
            stops_res = supabase.table("stops").select("*") \
                .eq("vehicle_id", vehicle["id"]) \
                .eq("is_done", "False") \
                .order("sequence").execute()
            remaining = stops_res.data
            if not remaining:
                continue

            # Corridor check — pickup or delivery near any remaining stop
            near_pickup   = any(haversine_km(s["lat"], s["lng"], order["pickup_lat"],   order["pickup_lng"])   <= PROXIMITY_KM for s in remaining)
            near_delivery = any(haversine_km(s["lat"], s["lng"], order["delivery_lat"], order["delivery_lng"]) <= PROXIMITY_KM for s in remaining)
            if not near_pickup and not near_delivery:
                continue

            # Detour check — find best insertion point
            before_dist = route_distance([{"lat": vehicle["current_lat"], "lng": vehicle["current_lng"]}] +
                                         [{"lat": s["lat"], "lng": s["lng"]} for s in remaining])

            best_insert = 0
            best_extra  = float("inf")
            for i in range(len(remaining) + 1):
                prev = {"lat": vehicle["current_lat"], "lng": vehicle["current_lng"]} if i == 0 else {"lat": remaining[i-1]["lat"], "lng": remaining[i-1]["lng"]}
                nxt  = {"lat": remaining[i]["lat"], "lng": remaining[i]["lng"]} if i < len(remaining) else None
                added = (haversine_km(prev["lat"], prev["lng"], order["pickup_lat"], order["pickup_lng"]) +
                         haversine_km(order["pickup_lat"], order["pickup_lng"], order["delivery_lat"], order["delivery_lng"]) +
                         (haversine_km(order["delivery_lat"], order["delivery_lng"], nxt["lat"], nxt["lng"]) if nxt else 0) -
                         (haversine_km(prev["lat"], prev["lng"], nxt["lat"], nxt["lng"]) if nxt else 0))
                if added < best_extra:
                    best_extra  = added
                    best_insert = i

            pct = best_extra / before_dist if before_dist > 0 else 1
            if pct > DETOUR_THRESHOLD:
                continue

            return _insert_into_route(vehicle, order, remaining, best_insert)

    # No vehicle accepted — queue it
    return _queue_order(order_id, "no vehicle matched")


def _assign_to_idle(vehicle: dict, order: dict) -> dict:
    stops = interleave_stops(vehicle, [order])
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
    supabase.table("orders").update({
        "assigned_vehicle_id": vehicle["id"],
        "status": "pending",
        "is_live_injection": True
    }).eq("id", order["id"]).execute()
    supabase.table("vehicles").update({"status": "active"}).eq("id", vehicle["id"]).execute()

    return {"message": f"Order assigned to idle vehicle {vehicle['id']}", "vehicle_id": vehicle["id"]}


def _insert_into_route(vehicle: dict, order: dict, remaining: list, insert_at: int) -> dict:
    # Get current max sequence for this vehicle
    max_seq = remaining[-1]["sequence"] if remaining else 0

    # Shift sequences after insert point
    for stop in remaining[insert_at:]:
        supabase.table("stops").update({"sequence": stop["sequence"] + 2}).eq("id", stop["id"]).execute()

    pickup_seq   = (remaining[insert_at - 1]["sequence"] + 1) if insert_at > 0 else 1
    delivery_seq = pickup_seq + 1

    supabase.table("stops").insert([
        {"vehicle_id": vehicle["id"], "order_id": order["id"], "type": "pickup",
         "sequence": pickup_seq, "lat": order["pickup_lat"], "lng": order["pickup_lng"], "is_done": False},
        {"vehicle_id": vehicle["id"], "order_id": order["id"], "type": "delivery",
         "sequence": delivery_seq, "lat": order["delivery_lat"], "lng": order["delivery_lng"], "is_done": False},
    ]).execute()

    supabase.table("orders").update({
        "assigned_vehicle_id": vehicle["id"],
        "status": "pending",
        "is_live_injection": True
    }).eq("id", order["id"]).execute()

    return {"message": f"Order injected into active vehicle {vehicle['id']}", "vehicle_id": vehicle["id"]}


def _queue_order(order_id: str, reason: str) -> dict:
    supabase.table("orders").update({"status": "queued"}).eq("id", order_id).execute()
    supabase.table("queue").insert({"order_id": order_id, "reason": reason}).execute()
    return {"message": "Order queued", "reason": reason}
