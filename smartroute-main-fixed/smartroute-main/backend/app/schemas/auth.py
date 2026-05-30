from pydantic import BaseModel, EmailStr
from typing import Optional
from enum import Enum

class UserRole(str, Enum):
    admin   = "admin"
    manager = "manager"
    sender  = "sender"
    driver  = "driver"

class RegisterRequest(BaseModel):
    name:     str
    phone:    str
    email:    Optional[EmailStr] = None
    password: str
    role:     UserRole

class LoginRequest(BaseModel):
    phone:    str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user_id:      str
    role:         str
    name:         str

class UserOut(BaseModel):
    id:         str
    name:       str
    phone:      str
    email:      Optional[str]
    role:       str
    is_active:  bool
    last_seen:  Optional[str]
