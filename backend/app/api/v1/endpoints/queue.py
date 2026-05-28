from fastapi import APIRouter, Depends, HTTPException
from app.core.dependencies import require_admin_manager
from app.db.client import supabase
from app.services.injection import inject_order

router = APIRouter()

@router.get("/", summary="View all queued orders")
def view_queue(user=Depends(require_admin_manager)):
    result = supabase.table("queue_detail").select("*").execute()
    return result.data


@router.post("/{order_id}/retry", summary="Retry injecting a queued order into active routes")
def retry_injection(order_id: str, user=Depends(require_admin_manager)):
    # Check it's actually in the queue
    in_queue = supabase.table("queue").select("id").eq("order_id", order_id).execute()
    if not in_queue.data:
        raise HTTPException(status_code=404, detail="Order not in queue")

    # Remove from queue first
    supabase.table("queue").delete().eq("order_id", order_id).execute()
    supabase.table("orders").update({"status": "pending"}).eq("id", order_id).execute()

    # Try injection again
    return inject_order(order_id)


@router.delete("/{order_id}", summary="Remove an order from the queue and cancel it")
def cancel_queued(order_id: str, user=Depends(require_admin_manager)):
    in_queue = supabase.table("queue").select("id").eq("order_id", order_id).execute()
    if not in_queue.data:
        raise HTTPException(status_code=404, detail="Order not in queue")

    supabase.table("queue").delete().eq("order_id", order_id).execute()
    supabase.table("orders").update({"status": "failed_pickup"}).eq("id", order_id).execute()

    return {"message": "Order removed from queue and cancelled"}
