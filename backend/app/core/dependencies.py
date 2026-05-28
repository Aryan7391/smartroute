from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.security import decode_token
from app.db.client import supabase

bearer = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    # Check session is still active
    session = supabase.table("sessions").select("is_active").eq("token", token).single().execute()
    if not session.data or not session.data["is_active"]:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session ended")

    # Update last_active on session
    supabase.table("sessions").update({"last_active": "now()"}).eq("token", token).execute()

    return {"id": payload["sub"], "role": payload["role"]}

def require_roles(*roles):
    def checker(user=Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        return user
    return checker

# Shorthand role guards
require_admin        = require_roles("admin")
require_admin_manager = require_roles("admin", "manager")
require_driver       = require_roles("driver")
require_sender       = require_roles("sender")
