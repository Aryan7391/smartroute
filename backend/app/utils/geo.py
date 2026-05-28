import math

def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Straight-line distance between two coordinates in kilometres."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.asin(math.sqrt(a))

def nearest(origin: dict, candidates: list[dict], lat_key="lat", lng_key="lng") -> dict:
    """Return the candidate closest to origin."""
    return min(candidates, key=lambda c: haversine_km(
        origin["lat"], origin["lng"], c[lat_key], c[lng_key]
    ))
