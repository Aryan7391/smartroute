from fastapi import APIRouter, Depends, HTTPException
from app.core.dependencies import get_current_user
from app.db.client import supabase
from app.services.otp import verify_pickup_otp, verify_delivery_otp
from app.services.queue import process_queue_for_vehicle
from app.services.notification import notify_sender_driver_coming, notify_receiver_driver_coming
from pydantic import BaseModel

router = APIRouter()

class OTPRequest(BaseModel):
    otp: str

class ArrivalRequest(BaseModel):
    stop_id: str

def get_driver_vehicle(user_id: str) -> dict:
    result = supabase.table("vehicles").select("*").eq("driver_id", user_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="No vehicle assigned to this driver")
    return result.data


@router.get("/my-route", summary="Get driver's current route (remaining stops)")
def my_route(user=Depends(get_current_user)):
    if user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Drivers only")

    vehicle = get_driver_vehicle(user["id"])
    stops = supabase.table("stops").select("*, orders(pickup_address, delivery_address, sender_id)") \
        .eq("vehicle_id", vehicle["id"]) \
        .eq("is_done", "False") \
        .order("sequence").execute()

    return {"vehicle": vehicle, "stops": stops.data}


@router.get("/my-inventory", summary="Get items currently in driver's vehicle")
def my_inventory(user=Depends(get_current_user)):
    if user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Drivers only")

    vehicle = get_driver_vehicle(user["id"])
    result = supabase.table("active_inventory").select("*").eq("vehicle_id", vehicle["id"]).execute()
    return result.data


@router.post("/arrived/{stop_id}", summary="Driver arrived at a stop — triggers notification to sender/receiver")
def arrived_at_stop(stop_id: str, user=Depends(get_current_user)):
    if user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Drivers only")

    stop = supabase.table("stops").select("*, orders(*, users!orders_sender_id_fkey(phone))") \
        .eq("id", stop_id).single().execute()
    if not stop.data:
        raise HTTPException(status_code=404, detail="Stop not found")

    s = stop.data
    order = s["orders"]

    # Mark arrived_at
    supabase.table("stops").update({"arrived_at": "now()"}).eq("id", stop_id).execute()

    # Notify sender or receiver
    if s["type"] == "pickup":
      notify_sender_driver_coming(order["users"]["phone"], order["id"])
    elif s["type"] == "delivery":
      notify_receiver_driver_coming(order["receiver_phone"], order["id"])

    return {"message": "Arrival recorded", "stop_type": s["type"], "order_id": order["id"]}


@router.post("/confirm-pickup/{order_id}", summary="Driver confirms pickup via OTP")
def confirm_pickup(order_id: str, body: OTPRequest, user=Depends(get_current_user)):
    if user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Drivers only")

    result = verify_pickup_otp(order_id, body.otp)

    # Notify receiver via WhatsApp (stub)
    order = supabase.table("orders").select("*, users!orders_sender_id_fkey(phone)") \
        .eq("id", order_id).single().execute()
    if order.data:
        from app.services.notification import notify_receiver_whatsapp
        tracking_url = f"https://smartroute.app/track/{order_id}"
        notify_receiver_whatsapp(
            order.data["receiver_phone"],  # will come from order once receiver phone is added
            order_id,
            order.data["delivery_otp"],
            tracking_url
        )

    return result


@router.post("/confirm-delivery/{order_id}", summary="Driver confirms delivery via OTP")
def confirm_delivery(order_id: str, body: OTPRequest, user=Depends(get_current_user)):
    if user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Drivers only")

    result = verify_delivery_otp(order_id, body.otp)

    # Notify sender
    order = supabase.table("orders").select("*, users!orders_sender_id_fkey(phone)") \
        .eq("id", order_id).single().execute()
    if order.data:
        from app.services.notification import notify_sender_delivered
        notify_sender_delivered(order.data["users"]["phone"], order_id)

    return result


@router.post("/route-complete", summary="Driver marks route as complete — triggers queue processing")
def route_complete(user=Depends(get_current_user)):
    if user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Drivers only")

    vehicle = get_driver_vehicle(user["id"])

    # Check all stops are done
    remaining = supabase.table("stops").select("id") \
        .eq("vehicle_id", vehicle["id"]) \
        .eq("is_done", "False").execute()

    if remaining.data:
        raise HTTPException(status_code=400, detail=f"{len(remaining.data)} stops still pending")

    # Set vehicle idle
    supabase.table("vehicles").update({"status": "idle"}).eq("id", vehicle["id"]).execute()

    # Process queue
    return process_queue_for_vehicle(vehicle["id"])
