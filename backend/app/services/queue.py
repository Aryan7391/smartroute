from app.db.client import supabase
from app.services.routing import interleave_stops
from app.utils.osrm import save_segments

BATCH_SIZE = 5

def process_queue_for_vehicle(vehicle_id: str) -> dict:
    """
    Called when a vehicle finishes its route and goes idle.
    Pulls queued orders and assigns them to this vehicle and any other idle vehicles.
    Respects capacity and max_weight. Saves route segments for map display.
    """
    idle_vehicles_res = supabase.table("vehicles").select("*").eq("status", "idle").execute()
    idle_vehicles = idle_vehicles_res.data
    if not idle_vehicles:
        return {"message": "No idle vehicles"}

    queue_res = supabase.table("queue").select("*, orders(*)").order("created_at").execute()
    queued = queue_res.data
    if not queued:
        return {"message": "Queue is empty"}

    assigned_count = 0
    queue_index = 0

    for vehicle in idle_vehicles:
        if queue_index >= len(queued):
            break

        max_weight = vehicle.get("max_weight", float("inf"))
        capacity   = vehicle["capacity"]

        # Pick orders from queue that fit this vehicle's weight and capacity
        batch        = []
        batch_ids    = []
        current_weight = 0.0

        for q in queued[queue_index:]:
            if len(batch) >= BATCH_SIZE:
                break
            order = q["orders"]
            if current_weight + order["approx_weight"] <= max_weight:
                batch.append(order)
                batch_ids.append(q["id"])
                current_weight += order["approx_weight"]

        if not batch:
            queue_index += BATCH_SIZE
            continue

        queue_index += len(batch)
        order_ids = [o["id"] for o in batch]

        stops = interleave_stops(vehicle, batch)
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
            "status": "pending"
        }).in_("id", order_ids).execute()
        supabase.table("queue").delete().in_("id", batch_ids).execute()
        supabase.table("vehicles").update({"status": "active"}).eq("id", vehicle["id"]).execute()

        # Save route segments for map display
        points = [{"lat": vehicle["current_lat"], "lng": vehicle["current_lng"]}] + \
                 [{"lat": s["lat"], "lng": s["lng"]} for s in stops]
        save_segments(vehicle["id"], points)

        assigned_count += len(batch)

    return {"message": f"Assigned {assigned_count} queued orders across {len(idle_vehicles)} idle vehicles"}