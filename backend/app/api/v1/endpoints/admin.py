from fastapi import APIRouter, Depends, HTTPException
from app.core.dependencies import require_admin, require_admin_manager
from app.db.client import supabase
from pydantic import BaseModel
from app.schemas.auth import RegisterRequest
from app.services.auth import register_user
from app.services.routing import assign_and_build_routes
from typing import Optional

router = APIRouter()

class UpdateUserRequest(BaseModel):
    is_active: Optional[bool] = None
    name:      Optional[str]  = None


# ── Day controls ──────────────────────────────────────────────

@router.post("/day/start", summary="Start the day — dispatch all pending orders (admin/manager)")
def start_day(user=Depends(require_admin_manager)):
    pending = supabase.table("orders").select("id").eq("status", "pending").is_("assigned_vehicle_id", "null").execute()
    if not pending.data:
        raise HTTPException(status_code=400, detail="No unassigned pending orders to dispatch")

    order_ids = [o["id"] for o in pending.data]
    result = assign_and_build_routes(order_ids)

    # Make sure accepting_orders is true at day start
    supabase.table("system_config").update({"value": "true"}).eq("key", "accepting_orders").execute()

    return {**result, "accepting_orders": True}


@router.post("/day/stop", summary="Stop accepting new orders — live injection disabled (admin/manager)")
def stop_day(user=Depends(require_admin_manager)):
    supabase.table("system_config").update({"value": "false"}).eq("key", "accepting_orders").execute()
    return {"message": "Order acceptance stopped. New orders will be queued for tomorrow."}


@router.post("/day/resume", summary="Resume accepting orders (admin/manager)")
def resume_day(user=Depends(require_admin_manager)):
    supabase.table("system_config").update({"value": "true"}).eq("key", "accepting_orders").execute()
    return {"message": "Order acceptance resumed."}


@router.get("/day/status", summary="Get current accepting_orders status")
def day_status(user=Depends(require_admin_manager)):
    res = supabase.table("system_config").select("value").eq("key", "accepting_orders").single().execute()
    accepting = res.data["value"] == "true" if res.data else True
    return {"accepting_orders": accepting}


# ── Fleet overview ────────────────────────────────────────────

@router.get("/fleet", summary="Live fleet overview — all vehicles and their status")
def fleet(user=Depends(require_admin_manager)):
    vehicles = supabase.table("vehicles").select("*, users!vehicles_driver_id_fkey(name, phone)").execute()
    return vehicles.data


@router.get("/orders", summary="All orders with status")
def all_orders(user=Depends(require_admin_manager)):
    result = supabase.table("orders").select("*, queue(reason, created_at)").order("created_at", desc=True).execute()
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


@router.get("/orders/escalated", summary="All escalated orders needing attention")
def escalated_orders(user=Depends(require_admin_manager)):
    result = supabase.table("orders").select("*, queue(reason, created_at)").eq("status", "escalated").order("created_at", desc=True).execute()
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


@router.get("/queue", summary="Current queue")
def view_queue(user=Depends(require_admin_manager)):
    result = supabase.table("queue_detail").select("*").order("queued_at", desc=True).execute()
    return result.data


# ── User management (admin only) ──────────────────────────────

@router.get("/users", summary="All users (admin/manager)")
def all_users(user=Depends(require_admin_manager)):
    result = supabase.table("users").select("id, name, phone, email, role, is_active, last_seen, created_at").order("created_at", desc=True).execute()
    return result.data


@router.patch("/users/{user_id}", summary="Update a user — activate/deactivate (admin/manager)")
def update_user(user_id: str, data: UpdateUserRequest, user=Depends(require_admin_manager)):
    updates = {k: v for k, v in data.dict().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")

    supabase.table("users").update(updates).eq("id", user_id).execute()
    return {"message": "User updated"}


@router.get("/sessions", summary="All active sessions (admin/manager)")
def sessions(user=Depends(require_admin_manager)):
    result = supabase.table("active_sessions").select("*").execute()
    return result.data


@router.delete("/sessions/{session_id}", summary="Kick a session (admin/manager)")
def kick_session(session_id: str, user=Depends(require_admin_manager)):
    supabase.table("sessions").update({"is_active": False}).eq("id", session_id).execute()
    return {"message": "Session terminated"}


@router.delete("/sessions/user/{user_id}", summary="Kick all sessions for a user (admin/manager)")
def kick_user_sessions(user_id: str, user=Depends(require_admin_manager)):
    supabase.table("sessions").update({"is_active": False}).eq("user_id", user_id).eq("is_active", True).execute()
    return {"message": "All sessions terminated for user"}


# ── Escalation handling ───────────────────────────────────────

@router.post("/orders/{order_id}/reschedule", summary="Reschedule a failed/escalated delivery")
def reschedule(order_id: str, user=Depends(require_admin_manager)):
    result = supabase.table("orders").select("*").eq("id", order_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Order not found")

    supabase.table("orders").update({
        "status": "pending",
        "attempt_count": result.data["attempt_count"]
    }).eq("id", order_id).execute()

    return {"message": "Order rescheduled for delivery"}


@router.post("/orders/{order_id}/charge-extra", summary="Apply extra charge to receiver (stub)")
def charge_extra(order_id: str, user=Depends(require_admin_manager)):
    return {"message": f"Extra charge flagged for order {order_id} — payment module pending"}


@router.post("/users/create", summary="Create admin/manager/driver account (admin/manager)")
def create_user(data: RegisterRequest, user=Depends(require_admin_manager)):
    return register_user(data)