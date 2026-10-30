from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..database import get_db

router = APIRouter(tags=["System Health & Diagnostics"])

@router.get("/health", status_code=status.HTTP_200_OK)
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1;"))
        db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    return {
        "status": "online" if db_status == "healthy" else "degraded",
        "service": "CampusShare API",
        "database": db_status,
        "version": "1.0.0",
        "engine": "FastAPI + PostgreSQL + btree_gist",
    }
