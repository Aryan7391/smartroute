from fastapi import APIRouter, Depends
from app.schemas.order import CreateOrderRequest, OrderOut
from app.core.dependencies import get_current_user, require_admin_manager, require_sender
from app.db.client import supabase
from app.utils.otp import generate_otp
from app.services.injection import inject_order
from app.services.routing import assign_and_build_routes
from fastapi import HTTPException

router = APIRouter()

@router.post("/", response_model=OrderOut, summary="Create a new order")
def create_order(data: CreateOrderRequest, user=Depends(get_current_user)):
    if user["role"] not in ["sender", "admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only senders can place orders")

    pickup_otp = generate_otp()

    result = supabase.table("orders").insert({
    "sender_id":          user["id"],
    "pickup_address":     data.pickup_address,
    "pickup_lat":         data.pickup_lat,
    "pickup_lng":         data.pickup_lng,
    "delivery_address":   data.delivery_address,
    "delivery_lat":       data.delivery_lat,
    "delivery_lng":       data.delivery_lng,
    "pickup_otp":         pickup_otp,
    "receiver_phone":     data.receiver_phone,
    "receiver_name":      data.receiver_name,
    "status":             "pending",
    "attempt_count":      0,
    "is_live_injection":  False,
    "is_return_to_sender": False,
    "item_count":       data.item_count,
    "approx_weight":    data.approx_weight,
    "item_description": data.item_description,
    }).execute()

    return result.data[0]


@router.get("/my", summary="Get all orders for current sender")
def my_orders(user=Depends(get_current_user)):
    result = supabase.table("orders").select("*").eq("sender_id", user["id"]).order("created_at", desc=True).execute()
    return result.data


@router.get("/{order_id}", summary="Get a single order by ID")
def get_order(order_id: str, user=Depends(get_current_user)):
    result = supabase.table("orders").select("*").eq("id", order_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Order not found")

    order = result.data
    if user["role"] == "sender" and order["sender_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    return order


@router.post("/dispatch", summary="Assign all pending orders to vehicles and build routes (admin/manager)")
def dispatch(user=Depends(require_admin_manager)):
    pending = supabase.table("orders").select("id").eq("status", "pending").is_("assigned_vehicle_id", "null").execute()
    if not pending.data:
        raise HTTPException(status_code=400, detail="No unassigned pending orders")

    order_ids = [o["id"] for o in pending.data]
    return assign_and_build_routes(order_ids)


@router.post("/{order_id}/inject", summary="Inject a live order into active routes (admin/manager)")
def inject(order_id: str, user=Depends(require_admin_manager)):
    return inject_order(order_id)


@router.patch("/{order_id}/fail-pickup", summary="Mark pickup as failed — sender not present")
def fail_pickup(order_id: str, user=Depends(get_current_user)):
    if user["role"] not in ["driver", "admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not allowed")

    result = supabase.table("orders").select("*").eq("id", order_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Order not found")

    supabase.table("orders").update({"status": "failed_pickup"}).eq("id", order_id).execute()

    # Notify sender
    from app.services.notification import notify_sender_order_failed
    sender = supabase.table("users").select("phone").eq("id", result.data["sender_id"]).single().execute()
    notify_sender_order_failed(sender.data["phone"], order_id)

    return {"message": "Pickup marked as failed"}


@router.patch("/{order_id}/fail-delivery", summary="Mark delivery attempt as failed — receiver not present")
def fail_delivery(order_id: str, user=Depends(get_current_user)):
    if user["role"] not in ["driver", "admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not allowed")

    result = supabase.table("orders").select("*").eq("id", order_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Order not found")

    order = result.data
    attempt = order["attempt_count"] + 1

    if attempt >= 2:
        # Escalate
        supabase.table("orders").update({
            "status": "escalated",
            "attempt_count": attempt
        }).eq("id", order_id).execute()

        from app.services.notification import notify_admin_escalation
        notify_admin_escalation(order_id, f"Delivery failed {attempt} times")
        return {"message": "Order escalated to admin after 2 failed attempts"}

    supabase.table("orders").update({
        "status": "failed_delivery",
        "attempt_count": attempt
    }).eq("id", order_id).execute()

    return {"message": f"Delivery attempt {attempt} marked as failed"}


@router.patch("/{order_id}/return-to-sender", summary="Mark order for return to sender")
def return_to_sender(order_id: str, user=Depends(require_admin_manager)):
    result = supabase.table("orders").select("*").eq("id", order_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Order not found")

    supabase.table("orders").update({
        "status": "return_to_sender",
        "is_return_to_sender": True
    }).eq("id", order_id).execute()

    from app.services.notification import notify_sender_return
    sender = supabase.table("users").select("phone").eq("id", result.data["sender_id"]).single().execute()
    notify_sender_return(sender.data["phone"], order_id)

    return {"message": "Order marked for return to sender"}
