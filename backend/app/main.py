from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.router import router

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.limiter import limiter

app = FastAPI(
    title="SmartRoute API",
    version="1.0.0",
    description="Smart routing and delivery management system"
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}"},
        headers={"Access-Control-Allow-Origin": "*"}
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten before production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")

@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "service": "SmartRoute API"}

@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
