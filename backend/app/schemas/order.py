from pydantic import BaseModel
from typing import Optional
from enum import Enum

class OrderStatus(str, Enum):
    pending          = "pending"
    picked_up        = "picked_up"
    delivered        = "delivered"
    failed_pickup    = "failed_pickup"
    failed_delivery  = "failed_delivery"
    escalated        = "escalated"
    return_to_sender = "return_to_sender"
    returned         = "returned"
    queued           = "queued"

class CreateOrderRequest(BaseModel):
    pickup_address:   str
    pickup_lat:       float
    pickup_lng:       float
    delivery_address: str
    delivery_lat:     float
    delivery_lng:     float
    receiver_phone:   str
    receiver_name: str
    item_count:       int
    approx_weight:    float
    item_description: str
    idempotency_key:  Optional[str] = None

class OrderOut(BaseModel):
    id:                  str
    sender_id:           str
    pickup_address:      str
    pickup_lat:          float
    pickup_lng:          float
    delivery_address:    str
    delivery_lat:        float
    delivery_lng:        float
    pickup_otp:          str
    delivery_otp:        Optional[str]
    status:              str
    attempt_count:       int
    is_live_injection:   bool
    is_return_to_sender: bool
    assigned_vehicle_id: Optional[str]
    current_vehicle_id:  Optional[str]
    created_at:          str
    picked_up_at:        Optional[str]
    delivered_at:        Optional[str]
    receiver_phone: Optional[str]
    item_count:       int
    approx_weight:    float
    item_description: str
