from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from app.schemas.order import CreateOrderRequest, OrderOut
from app.core.dependencies import get_current_user, require_admin_manager, require_sender
from app.db.client import supabase
from app.utils.otp import generate_otp
from app.utils.system import is_accepting_orders
from app.services.injection import inject_order
from app.services.routing import assign_and_build_routes
from app.core.limiter import limiter

router = APIRouter()

@router.post("/", response_model=OrderOut, summary="Create a new order")
@limiter.limit("5/minute")
def create_order(request: Request, data: CreateOrderRequest, user=Depends(get_current_user)):
    if user["role"] not in ["sender", "admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only senders can place orders")

    if data.idempotency_key:
        existing = supabase.table("orders").select("*").eq("idempotency_key", data.idempotency_key).execute()
        if existing.data:
            return existing.data[0]

    pickup_otp = generate_otp()
    accepting  = is_accepting_orders()

    # If not accepting, go straight to queued status
    status = "pending" if accepting else "queued"

    result = supabase.table("orders").insert({
        "sender_id":           user["id"],
        "idempotency_key":     data.idempotency_key,
        "pickup_address":      data.pickup_address,
        "pickup_lat":          data.pickup_lat,
        "pickup_lng":          data.pickup_lng,
        "delivery_address":    data.delivery_address,
        "delivery_lat":        data.delivery_lat,
        "delivery_lng":        data.delivery_lng,
        "pickup_otp":          pickup_otp,
        "receiver_phone":      data.receiver_phone,
        "receiver_name":       data.receiver_name,
        "status":              status,
        "attempt_count":       0,
        "is_live_injection":   False,
        "is_return_to_sender": False,
        "item_count":          data.item_count,
        "approx_weight":       data.approx_weight,
        "item_description":    data.item_description,
    }).execute()

    order = result.data[0]

    # If not accepting, add to queue immediately
    if not accepting:
        supabase.table("queue").insert({
            "order_id": order["id"],
            "reason":   "order placed after cutoff — queued for next day"
        }).execute()

    return order


@router.get("/my", summary="Get all orders for current sender")
def my_orders(user=Depends(get_current_user)):
    result = supabase.table("orders").select("*, queue(reason, created_at)").eq("sender_id", user["id"]).order("created_at", desc=True).execute()
    
    orders = result.data
    for order in orders:
        if order.get("queue"):
            if isinstance(order["queue"], list):
                order["queue"].sort(key=lambda x: x["created_at"], reverse=True)
                order["escalation_reason"] = order["queue"][0]["reason"] if len(order["queue"]) > 0 else None
            else:
                order["escalation_reason"] = order["queue"].get("reason")
        else:
            order["escalation_reason"] = None
        order.pop("queue", None)
        
    return orders


@router.get("/{order_id}", summary="Get a single order by ID")
def get_order(order_id: str, user=Depends(get_current_user)):
    result = supabase.table("orders").select("*, queue(reason, created_at)").eq("id", order_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Order not found")

    order = result.data
    if user["role"] == "sender" and order["sender_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    if order.get("queue"):
        if isinstance(order["queue"], list):
            order["queue"].sort(key=lambda x: x["created_at"], reverse=True)
            order["escalation_reason"] = order["queue"][0]["reason"] if len(order["queue"]) > 0 else None
        else:
            order["escalation_reason"] = order["queue"].get("reason")
    else:
        order["escalation_reason"] = None
    order.pop("queue", None)

    return order


@router.post("/dispatch", summary="Assign all pending orders to vehicles and build routes (admin/manager)")
def dispatch(background_tasks: BackgroundTasks, user=Depends(require_admin_manager)):
    pending = supabase.table("orders").select("id").eq("status", "pending").is_("assigned_vehicle_id", "null").execute()
    if not pending.data:
        raise HTTPException(status_code=400, detail="No unassigned pending orders")

    order_ids = [o["id"] for o in pending.data]
    return assign_and_build_routes(order_ids, background_tasks)


@router.post("/{order_id}/inject", summary="Inject a live order into active routes (admin/manager)")
def inject(order_id: str, background_tasks: BackgroundTasks, user=Depends(require_admin_manager)):
    return inject_order(order_id, background_tasks)


@router.patch("/{order_id}/fail-pickup", summary="Mark pickup as failed — sender not present")
def fail_pickup(order_id: str, user=Depends(get_current_user)):
    if user["role"] not in ["driver", "admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not allowed")

    result = supabase.table("orders").select("*").eq("id", order_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Order not found")

    # Escalate, clear assignment, and put in queue
    supabase.table("orders").update({
        "status": "escalated",
        "assigned_vehicle_id": None
    }).eq("id", order_id).execute()

    supabase.table("queue").insert({
        "order_id": order_id,
        "reason": "pickup failed — sender not present, escalated and re-queued"
    }).execute()
    
    # Clear stops from driver's route
    supabase.table("stops").update({"is_done": True}).eq("order_id", order_id).eq("type", "pickup").execute()
    supabase.table("stops").delete().eq("order_id", order_id).eq("type", "delivery").execute()

    from app.services.notification import notify_sender_order_failed, notify_admin_escalation
    sender = supabase.table("users").select("phone").eq("id", result.data["sender_id"]).single().execute()
    notify_sender_order_failed(sender.data["phone"], order_id)
    notify_admin_escalation(order_id, "Pickup failed (sender not present)")

    return {"message": "Pickup marked as failed, escalated and re-queued"}


@router.patch("/{order_id}/fail-delivery", summary="Mark delivery attempt as failed — receiver not present")
def fail_delivery(order_id: str, user=Depends(get_current_user)):
    if user["role"] not in ["driver", "admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not allowed")

    result = supabase.table("orders").select("*").eq("id", order_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Order not found")

    order = result.data
    attempt = order["attempt_count"] + 1
    
    # Mark delivery stop as done so it disappears from driver's screen
    supabase.table("stops").update({"is_done": True}).eq("order_id", order_id).eq("type", "delivery").execute()

    if attempt >= 2:
        supabase.table("orders").update({
            "status": "escalated",
            "attempt_count": attempt,
            "assigned_vehicle_id": None
        }).eq("id", order_id).execute()

        supabase.table("queue").insert({
            "order_id": order_id,
            "reason": f"delivery failed {attempt} times — escalated and re-queued"
        }).execute()

        from app.services.notification import notify_admin_escalation
        notify_admin_escalation(order_id, f"Delivery failed {attempt} times")
        return {"message": "Order escalated and re-queued after 2 failed attempts"}

    supabase.table("orders").update({
        "status": "queued",
        "attempt_count": attempt,
        "assigned_vehicle_id": None
    }).eq("id", order_id).execute()

    supabase.table("queue").insert({
        "order_id": order_id,
        "reason": f"delivery failed attempt {attempt} — re-queued for next routing"
    }).execute()

    return {"message": f"Delivery attempt {attempt} marked as failed and re-queued"}


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
    notify_sender_return(sender.data["phone"], result.data["id"])

    return {"message": "Order marked for return to sender"}