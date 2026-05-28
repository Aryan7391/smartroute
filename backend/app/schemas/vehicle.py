from pydantic import BaseModel
from typing import Optional

class CreateVehicleRequest(BaseModel):
    driver_id: str
    capacity:  int

class UpdateLocationRequest(BaseModel):
    lat: float
    lng: float

class VehicleOut(BaseModel):
    id:          str
    driver_id:   str
    capacity:    int
    current_lat: Optional[float]
    current_lng: Optional[float]
    status:      str
    created_at:  str
