from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserOut
from app.services.auth import register_user, login_user, logout_user, get_active_sessions, kick_session, kick_all_sessions
from app.core.dependencies import get_current_user, require_admin

router = APIRouter()
bearer = HTTPBearer()

# ── Public ──────────────────────────────────────────────────

@router.post("/register", response_model=UserOut, summary="Register a new user")
def register(data: RegisterRequest):
    return register_user(data)


@router.post("/login", response_model=TokenResponse, summary="Login and get token")
def login(data: LoginRequest):
    return login_user(data)


# ── Authenticated ────────────────────────────────────────────

@router.post("/logout", summary="Logout current session")
def logout(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    user=Depends(get_current_user)
):
    logout_user(credentials.credentials)
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserOut, summary="Get current user info")
def me(user=Depends(get_current_user)):
    from app.db.client import supabase
    result = supabase.table("users").select("*").eq("id", user["id"]).single().execute()
    return result.data


# ── Admin only ───────────────────────────────────────────────

@router.get("/sessions", summary="Get all active sessions (admin only)")
def active_sessions(user=Depends(require_admin)):
    return get_active_sessions()


@router.delete("/sessions/{session_id}", summary="Kick a specific session (admin only)")
def kick_one(session_id: str, user=Depends(require_admin)):
    kick_session(session_id)
    return {"message": "Session terminated"}


@router.delete("/sessions/user/{user_id}", summary="Kick all sessions for a user (admin only)")
def kick_all(user_id: str, user=Depends(require_admin)):
    kick_all_sessions(user_id)
    return {"message": "All sessions for user terminated"}
