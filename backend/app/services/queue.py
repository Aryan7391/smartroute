from app.db.client import supabase
from app.services.routing import interleave_stops

BATCH_SIZE = 5

def process_queue_for_vehicle(vehicle_id: str) -> dict:
    """
    Called when a vehicle finishes its route and goes idle.
    Pulls queued orders and assigns them to this vehicle and any other idle vehicles.
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

        batch = queued[queue_index: queue_index + BATCH_SIZE]
        queue_index += BATCH_SIZE

        orders = [q["orders"] for q in batch]
        queue_ids = [q["id"] for q in batch]
        order_ids = [o["id"] for o in orders]

        stops = interleave_stops(vehicle, orders)
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
        supabase.table("queue").delete().in_("id", queue_ids).execute()
        supabase.table("vehicles").update({"status": "active"}).eq("id", vehicle["id"]).execute()

        assigned_count += len(orders)

    return {"message": f"Assigned {assigned_count} queued orders across {len(idle_vehicles)} vehicles"}
