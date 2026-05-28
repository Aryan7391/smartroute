from fastapi import APIRouter
from app.api.v1.endpoints import auth, orders, vehicles, driver, admin, queue

router = APIRouter()

router.include_router(auth.router,     prefix="/auth",     tags=["Auth"])
router.include_router(orders.router,   prefix="/orders",   tags=["Orders"])
router.include_router(vehicles.router, prefix="/vehicles", tags=["Vehicles"])
router.include_router(driver.router,   prefix="/driver",   tags=["Driver"])
router.include_router(admin.router,    prefix="/admin",    tags=["Admin"])
router.include_router(queue.router,    prefix="/queue",    tags=["Queue"])
