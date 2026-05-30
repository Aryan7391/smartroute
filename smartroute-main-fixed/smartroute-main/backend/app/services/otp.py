from app.db.client import supabase
from app.utils.otp import generate_otp
from fastapi import HTTPException

def verify_pickup_otp(order_id: str, otp_entered: str) -> dict:
    result = supabase.table("orders").select("*").eq("id", order_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Order not found")

    order = result.data
    if order["status"] != "pending":
        raise HTTPException(status_code=400, detail="Order is not in a pickable state")
    if order["pickup_otp"] != otp_entered:
        raise HTTPException(status_code=400, detail="Incorrect OTP")

    # Generate delivery OTP now that pickup is confirmed
    delivery_otp = generate_otp()

    supabase.table("orders").update({
        "status":       "picked_up",
        "delivery_otp": delivery_otp,
        "picked_up_at": "now()",
    }).eq("id", order_id).execute()

    # Add to vehicle inventory
    supabase.table("vehicle_inventory").insert({
        "vehicle_id": order["assigned_vehicle_id"],
        "order_id":   order_id,
    }).execute()

    # Mark pickup stop as done
    supabase.table("stops").update({
        "is_done":      True,
        "completed_at": "now()",
    }).eq("order_id", order_id).eq("type", "pickup").execute()

    return {"message": "Pickup confirmed", "delivery_otp": delivery_otp}


def verify_delivery_otp(order_id: str, otp_entered: str) -> dict:
    result = supabase.table("orders").select("*").eq("id", order_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Order not found")

    order = result.data
    if order["status"] != "picked_up":
        raise HTTPException(status_code=400, detail="Order is not out for delivery")
    if not order.get("delivery_otp"):
        raise HTTPException(status_code=400, detail="Delivery OTP not yet generated — pickup not confirmed")
    if order["delivery_otp"] != otp_entered:
        raise HTTPException(status_code=400, detail="Incorrect OTP")

    supabase.table("orders").update({
        "status":       "delivered",
        "delivered_at": "now()",
        "current_vehicle_id": None,
    }).eq("id", order_id).execute()

    # Remove from vehicle inventory
    supabase.table("vehicle_inventory").update({
        "unloaded_at": "now()"
    }).eq("order_id", order_id).is_("unloaded_at", "null").execute()

    # Mark delivery stop as done
    supabase.table("stops").update({
        "is_done":      True,
        "completed_at": "now()",
    }).eq("order_id", order_id).eq("type", "delivery").execute()

    return {"message": "Delivery confirmed"}
