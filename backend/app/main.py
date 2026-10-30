import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError

from .config import settings
from .core.exceptions import (
    CampusShareException,
    campusshare_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from .routers import (
    auth,
    resources,
    departments_categories,
    health,
    bookings,
    approvals,
    waitlist,
    fairness,
    handover,
    incidents,
    notifications,
    audit,
    analytics,
    ai,
    admin,
)
from .services.scheduler_service import start_scheduler, shutdown_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Launch in-process APScheduler maintenance engine
    start_scheduler()
    yield
    # Shutdown: Stop scheduler
    shutdown_scheduler()

app = FastAPI(
    title="CampusShare API",
    description="Intelligent campus resource sharing platform. Every Resource Deserves Utilization. Every User Deserves Fair Access.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Configuration: allow localhost, local network IPs, and cloud preview domains
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount local uploads directory for dev file serving
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Global Exception Handlers
app.add_exception_handler(CampusShareException, campusshare_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)

# Mount Routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(resources.router)
app.include_router(departments_categories.router)
app.include_router(bookings.router)
app.include_router(approvals.router)
app.include_router(waitlist.router)
app.include_router(fairness.router)
app.include_router(handover.router)
app.include_router(incidents.router)
app.include_router(notifications.router)
app.include_router(audit.router)
app.include_router(analytics.router)
app.include_router(ai.router)
app.include_router(admin.router)

@app.get("/", tags=["Root"])
def root():
    return {
        "message": "CampusShare API is running.",
        "documentation": "/docs",
        "tagline": "Every Resource Deserves Utilization. Every User Deserves Fair Access.",
    }
