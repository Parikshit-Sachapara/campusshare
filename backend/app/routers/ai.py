import uuid
from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..core.deps import get_current_user
from ..models import Profile
from ..services.ai_service import AiService

router = APIRouter(prefix="/ai", tags=["AI Recommendation Assistant"])

class ProjectRecommendRequest(BaseModel):
    query: str = Field(..., min_length=3, description="Project description or query (e.g. 'I am developing a line-following robot')")
    timeframe_days: Optional[int] = Field(7, ge=1, le=30, description="Booking timeframe window in days")

@router.post("/recommend")
def get_ai_recommendations(
    payload: ProjectRecommendRequest,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    """
    CAMPUSSHARE PROJECT BUDDY:
    Extracts structured project requirements, matches real DB resources,
    evaluates user eligibility, verifies real 7-day slot availability,
    and returns recommendations with one-line contextual reasons.
    """
    return AiService.recommend_for_project(
        db=db,
        user=current_user,
        query=payload.query,
        timeframe_days=payload.timeframe_days or 7,
    )

@router.get("/recommended-for-you")
def get_user_recommendations(
    limit: int = Query(4, ge=1, le=10),
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    """
    Returns personalized resources for the student's dashboard based on department
    and platform activity.
    """
    return AiService.get_recommended_for_you(db=db, user=current_user, limit=limit)

@router.get("/similar/{resource_id}")
def get_similar_resources(
    resource_id: uuid.UUID,
    limit: int = Query(4, ge=1, le=10),
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    """
    Returns similar resources in the same category or department for resource detail exploration.
    """
    return AiService.get_similar_resources(db=db, resource_id=resource_id, limit=limit)
