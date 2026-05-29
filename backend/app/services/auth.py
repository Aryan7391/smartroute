from app.db.client import supabase
from app.core.security import hash_password, verify_password, create_access_token
from app.schemas.auth import RegisterRequest, LoginRequest
from fastapi import HTTPException, status

def register_user(data: RegisterRequest) -> dict:
    existing = supabase.table("users").select("id").eq("phone", data.phone).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Phone number already registered")

    # Drivers start inactive — need admin approval
    is_active = data.role.value != "driver"

    user = supabase.table("users").insert({
        "name":          data.name,
        "phone":         data.phone,
        "email":         data.email,
        "password_hash": hash_password(data.password),
        "role":          data.role.value,
        "is_active":     is_active,
    }).execute()

    return user.data[0]
    # Check phone not already taken
    existing = supabase.table("users").select("id").eq("phone", data.phone).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Phone number already registered")

    user = supabase.table("users").insert({
        "name":          data.name,
        "phone":         data.phone,
        "email":         data.email,
        "password_hash": hash_password(data.password),
        "role":          data.role.value,
        "is_active":     True,
    }).execute()

    return user.data[0]


def login_user(data: LoginRequest) -> dict:
    result = supabase.table("users").select("*").eq("phone", data.phone).execute()

    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid phone or password")

    user = result.data[0]

    if not user["is_active"]:
      if user["role"] == "driver":
        raise HTTPException(status_code=403, detail="Account pending admin approval")
      raise HTTPException(status_code=403, detail="Account is deactivated")

    if not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid phone or password")

    token = create_access_token(user["id"], user["role"])

    # Save session
    supabase.table("sessions").insert({
        "user_id":   user["id"],
        "token":     token,
        "is_active": True,
    }).execute()

    # Update last_seen
    supabase.table("users").update({"last_seen": "now()"}).eq("id", user["id"]).execute()

    return {
        "access_token": token,
        "token_type":   "bearer",
        "user_id":      user["id"],
        "role":         user["role"],
        "name":         user["name"],
    }


def logout_user(token: str) -> None:
    supabase.table("sessions").update({"is_active": False}).eq("token", token).execute()


def get_active_sessions() -> list:
    result = supabase.table("active_sessions").select("*").execute()
    return result.data


def kick_session(session_id: str) -> None:
    result = supabase.table("sessions").select("id").eq("id", session_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Session not found")
    supabase.table("sessions").update({"is_active": False}).eq("id", session_id).execute()


def kick_all_sessions(user_id: str) -> None:
    result = supabase.table("users").select("id").eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    supabase.table("sessions").update({"is_active": False}).eq("user_id", user_id).eq("is_active", True).execute()
