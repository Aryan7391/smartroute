from fastapi import APIRouter, Depends, HTTPException
from app.schemas.vehicle import CreateVehicleRequest, UpdateLocationRequest, VehicleOut
from app.core.dependencies import get_current_user, require_admin_manager
from app.db.client import supabase

router = APIRouter()

@router.post("/", response_model=VehicleOut, summary="Register a new vehicle (admin/manager)")
def create_vehicle(data: CreateVehicleRequest, user=Depends(require_admin_manager)):
    # Verify driver exists and has driver role
    driver = supabase.table("users").select("id, role").eq("id", data.driver_id).single().execute()
    if not driver.data or driver.data["role"] != "driver":
        raise HTTPException(status_code=400, detail="User is not a driver")

    result = supabase.table("vehicles").insert({
        "driver_id": data.driver_id,
        "capacity":  data.capacity,
        "status":    "idle",
    }).execute()

    return result.data[0]


@router.get("/", summary="Get all vehicles (admin/manager)")
def all_vehicles(user=Depends(require_admin_manager)):
    result = supabase.table("vehicles").select("*, users(name, phone)").execute()
    return result.data

@router.get("/active", summary="Get all active vehicles with location")
def active_vehicles(user=Depends(get_current_user)):
    result = supabase.table("vehicles").select("*, users!vehicles_driver_id_fkey(name, phone)") \
        .eq("status", "active").execute()
    return result.data

@router.get("/{vehicle_id}", summary="Get a single vehicle")
def get_vehicle(vehicle_id: str, user=Depends(get_current_user)):
    result = supabase.table("vehicles").select("*").eq("id", vehicle_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return result.data


@router.get("/{vehicle_id}/stops", summary="Get remaining stops for a vehicle")
def vehicle_stops(vehicle_id: str, user=Depends(get_current_user)):
    result = supabase.table("stops").select("*, orders(pickup_address, delivery_address)") \
        .eq("vehicle_id", vehicle_id) \
        .eq("is_done", "False") \
        .order("sequence").execute()
    return result.data


@router.get("/{vehicle_id}/inventory", summary="Get current inventory of a vehicle")
def vehicle_inventory(vehicle_id: str, user=Depends(get_current_user)):
    result = supabase.table("active_inventory").select("*").eq("vehicle_id", vehicle_id).execute()
    return result.data


@router.patch("/{vehicle_id}/location", summary="Update vehicle GPS location (driver)")
def update_location(vehicle_id: str, data: UpdateLocationRequest, user=Depends(get_current_user)):
    if user["role"] not in ["driver", "admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not allowed")

    supabase.table("vehicles").update({
        "current_lat": data.lat,
        "current_lng": data.lng,
    }).eq("id", vehicle_id).execute()

    return {"message": "Location updated"}
