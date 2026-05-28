from fastapi import APIRouter, Depends, HTTPException
from app.core.dependencies import require_admin, require_admin_manager
from app.db.client import supabase
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

class UpdateUserRequest(BaseModel):
    is_active: Optional[bool] = None
    name:      Optional[str]  = None

# ── Fleet overview ────────────────────────────────────────────

@router.get("/fleet", summary="Live fleet overview — all vehicles and their status")
def fleet(user=Depends(require_admin_manager)):
    vehicles = supabase.table("vehicles").select("*, users!vehicles_driver_id_fkey(name, phone)").execute()
    return vehicles.data


@router.get("/orders", summary="All orders with status")
def all_orders(user=Depends(require_admin_manager)):
    result = supabase.table("orders").select("*").order("created_at", desc=True).execute()
    return result.data


@router.get("/orders/escalated", summary="All escalated orders needing attention")
def escalated_orders(user=Depends(require_admin_manager)):
    result = supabase.table("orders").select("*").eq("status", "escalated").execute()
    return result.data


@router.get("/queue", summary="Current queue")
def view_queue(user=Depends(require_admin_manager)):
    result = supabase.table("queue_detail").select("*").execute()
    return result.data


# ── User management (admin only) ──────────────────────────────

@router.get("/users", summary="All users (admin only)")
def all_users(user=Depends(require_admin)):
    result = supabase.table("users").select("id, name, phone, email, role, is_active, last_seen, created_at").execute()
    return result.data


@router.patch("/users/{user_id}", summary="Update a user — activate/deactivate (admin only)")
def update_user(user_id: str, data: UpdateUserRequest, user=Depends(require_admin)):
    updates = {k: v for k, v in data.dict().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")

    supabase.table("users").update(updates).eq("id", user_id).execute()
    return {"message": "User updated"}


@router.get("/sessions", summary="All active sessions (admin only)")
def sessions(user=Depends(require_admin)):
    result = supabase.table("active_sessions").select("*").execute()
    return result.data


@router.delete("/sessions/{session_id}", summary="Kick a session (admin only)")
def kick_session(session_id: str, user=Depends(require_admin)):
    supabase.table("sessions").update({"is_active": False}).eq("id", session_id).execute()
    return {"message": "Session terminated"}


@router.delete("/sessions/user/{user_id}", summary="Kick all sessions for a user (admin only)")
def kick_user_sessions(user_id: str, user=Depends(require_admin)):
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
    # Plug into payment module when ready
    return {"message": f"Extra charge flagged for order {order_id} — payment module pending"}
