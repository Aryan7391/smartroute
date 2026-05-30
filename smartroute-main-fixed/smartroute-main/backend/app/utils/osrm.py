import httpx
from app.db.client import supabase

OSRM_BASE = "https://router.project-osrm.org/route/v1/driving"

def fetch_geometry(lat1: float, lng1: float, lat2: float, lng2: float) -> dict | None:
    """Call OSRM and return GeoJSON geometry for a road segment."""
    try:
        url = f"{OSRM_BASE}/{lng1},{lat1};{lng2},{lat2}?overview=full&geometries=geojson"
        r = httpx.get(url, timeout=10)
        data = r.json()
        if data.get("routes"):
            return data["routes"][0]["geometry"]
    except Exception as e:
        print(f"OSRM error: {e}")
    return None

def save_segments(vehicle_id: str, points: list[dict], start_sequence: int = 0):
    """
    Save route segments to DB.
    points: list of {lat, lng} in order (vehicle position first, then stops)
    start_sequence: sequence number to start from (for injection)
    """
    rows = []
    for i in range(len(points) - 1):
        geometry = fetch_geometry(
            points[i]["lat"], points[i]["lng"],
            points[i+1]["lat"], points[i+1]["lng"]
        )
        if geometry:
            rows.append({
                "vehicle_id":     vehicle_id,
                "from_sequence":  start_sequence + i,
                "to_sequence":    start_sequence + i + 1,
                "geometry":       geometry,
                "is_done":        False,
            })

    if rows:
        supabase.table("route_segments").insert(rows).execute()

def mark_segment_done(vehicle_id: str, to_sequence: int):
    """Mark a segment as done when driver completes a stop."""
    supabase.table("route_segments").update({"is_done": True}) \
        .eq("vehicle_id", vehicle_id) \
        .eq("to_sequence", to_sequence).execute()

def clear_segments(vehicle_id: str):
    """Delete all segments for a vehicle when route is complete."""
    supabase.table("route_segments").delete().eq("vehicle_id", vehicle_id).execute()

def get_segments(vehicle_id: str) -> list:
    """Get all segments for a vehicle."""
    result = supabase.table("route_segments").select("*") \
        .eq("vehicle_id", vehicle_id) \
        .order("from_sequence").execute()
    return result.data