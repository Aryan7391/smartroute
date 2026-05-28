from pydantic import BaseModel
from typing import Optional

class StopOut(BaseModel):
    id:           str
    vehicle_id:   str
    order_id:     str
    type:         str
    sequence:     int
    lat:          float
    lng:          float
    is_done:      bool
    arrived_at:   Optional[str]
    completed_at: Optional[str]
