from app.db.client import supabase
from app.utils.geo import haversine_km
from app.services.routing import interleave_stops
from fastapi import HTTPException
from app.utils.osrm import save_segments

PROXIMITY_KM = 3.0
DETOUR_THRESHOLD = 0.40


def route_distance(points: list) -> float:
    total = 0.0
    for i in range(1, len(points)):
        total += haversine_km(points[i-1]["lat"], points[i-1]["lng"], points[i]["lat"], points[i]["lng"])
    return total


def _is_accepting_orders() -> bool:
    res = supabase.table("system_config").select("value").eq("key", "accepting_orders").single().execute()
    if not res.data:
        return True  # default to accepting if config missing
    return res.data["value"] == "true"


def _simulate_weight_check(vehicle: dict, remaining: list, new_order: dict, insert_at: int) -> bool:
    max_weight = vehicle.get("max_weight", float("inf"))

    order_ids = list({s["order_id"] for s in remaining})
    if not order_ids:
        return True

    orders_res = supabase.table("orders").select("id, approx_weight").in_("id", order_ids).execute()
    weight_map = {o["id"]: o["approx_weight"] for o in orders_res.data}
    weight_map[new_order["id"]] = new_order["approx_weight"]

    new_pickup   = {"order_id": new_order["id"], "type": "pickup",   "sequence": insert_at}
    new_delivery = {"order_id": new_order["id"], "type": "delivery", "sequence": insert_at + 1}
    simulated = remaining[:insert_at] + [new_pickup, new_delivery] + remaining[insert_at:]

    current_weight = 0.0
    for stop in simulated:
        if stop["type"] == "pickup":
            current_weight += weight_map.get(stop["order_id"], 0)
            if current_weight > max_weight:
                return False
        elif stop["type"] == "delivery":
            current_weight -= weight_map.get(stop["order_id"], 0)

    return True


def inject_order(order_id: str) -> dict:
    # Check if system is accepting orders
    if not _is_accepting_orders():
        return _queue_order(order_id, "order acceptance stopped for the day")

    order_res = supabase.table("orders").select("*").eq("id", order_id).single().execute()
    if not order_res.data:
        raise HTTPException(status_code=404, detail="Order not found")
    order = order_res.data

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
                if order["approx_weight"] <= vehicle.get("max_weight", float("inf")):
                    return _assign_to_idle(vehicle, order)
            continue

        # ── Active vehicle ────────────────────────────────────
        if vehicle["status"] == "active":
            inventory_res = supabase.table("vehicle_inventory") \
                .select("id").eq("vehicle_id", vehicle["id"]).is_("unloaded_at", "null").execute()
            current_load = len(inventory_res.data)
            if current_load >= vehicle["capacity"]:
                continue

            stops_res = supabase.table("stops").select("*") \
                .eq("vehicle_id", vehicle["id"]) \
                .eq("is_done", "False") \
                .order("sequence").execute()
            remaining = stops_res.data
            if not remaining:
                continue

            near_pickup   = any(haversine_km(s["lat"], s["lng"], order["pickup_lat"],   order["pickup_lng"])   <= PROXIMITY_KM for s in remaining)
            near_delivery = any(haversine_km(s["lat"], s["lng"], order["delivery_lat"], order["delivery_lng"]) <= PROXIMITY_KM for s in remaining)
            if not near_pickup and not near_delivery:
                continue

            before_dist = route_distance(
                [{"lat": vehicle["current_lat"], "lng": vehicle["current_lng"]}] +
                [{"lat": s["lat"], "lng": s["lng"]} for s in remaining]
            )

            best_insert = 0
            best_extra  = float("inf")
            for i in range(len(remaining) + 1):
                prev = {"lat": vehicle["current_lat"], "lng": vehicle["current_lng"]} if i == 0 \
                       else {"lat": remaining[i-1]["lat"], "lng": remaining[i-1]["lng"]}
                nxt  = {"lat": remaining[i]["lat"], "lng": remaining[i]["lng"]} if i < len(remaining) else None
                added = (
                    haversine_km(prev["lat"], prev["lng"], order["pickup_lat"], order["pickup_lng"]) +
                    haversine_km(order["pickup_lat"], order["pickup_lng"], order["delivery_lat"], order["delivery_lng"]) +
                    (haversine_km(order["delivery_lat"], order["delivery_lng"], nxt["lat"], nxt["lng"]) if nxt else 0) -
                    (haversine_km(prev["lat"], prev["lng"], nxt["lat"], nxt["lng"]) if nxt else 0)
                )
                if added < best_extra:
                    best_extra  = added
                    best_insert = i

            pct = best_extra / before_dist if before_dist > 0 else 1
            if pct > DETOUR_THRESHOLD:
                continue

            if not _simulate_weight_check(vehicle, remaining, order, best_insert):
                continue

            return _insert_into_route(vehicle, order, remaining, best_insert)

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

    points = [{"lat": vehicle["current_lat"], "lng": vehicle["current_lng"]}] + \
             [{"lat": s["lat"], "lng": s["lng"]} for s in stops]
    save_segments(vehicle["id"], points)

    return {"message": f"Order assigned to idle vehicle {vehicle['id']}", "vehicle_id": vehicle["id"]}


def _insert_into_route(vehicle: dict, order: dict, remaining: list, insert_at: int) -> dict:
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

    prev_point = {"lat": vehicle["current_lat"], "lng": vehicle["current_lng"]} \
        if insert_at == 0 else {"lat": remaining[insert_at - 1]["lat"], "lng": remaining[insert_at - 1]["lng"]}
    next_point = {"lat": remaining[insert_at]["lat"], "lng": remaining[insert_at]["lng"]} \
        if insert_at < len(remaining) else None

    new_points = [prev_point,
                  {"lat": order["pickup_lat"], "lng": order["pickup_lng"]},
                  {"lat": order["delivery_lat"], "lng": order["delivery_lng"]}]
    if next_point:
        new_points.append(next_point)

    save_segments(vehicle["id"], new_points, start_sequence=pickup_seq - 1)

    return {"message": f"Order injected into active vehicle {vehicle['id']}", "vehicle_id": vehicle["id"]}


def _queue_order(order_id: str, reason: str) -> dict:
    supabase.table("orders").update({"status": "queued"}).eq("id", order_id).execute()
    supabase.table("queue").insert({"order_id": order_id, "reason": reason}).execute()
    return {"message": "Order queued", "reason": reason}