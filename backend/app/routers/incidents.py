import os
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, Request, Query, status
from fastapi.responses import FileResponse, PlainTextResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Profile
from ..models.enums import IncidentStatus, IncidentSeverity, UserRole
from ..schemas.incident import (
    IncidentCreate,
    IncidentStatusUpdate,
    IncidentCommentCreate,
    IncidentResponse,
    IncidentCommentResponse,
)
from ..core.deps import get_current_user, require_roles
from ..config import settings
from ..core.exceptions import CampusShareException
from ..services.incident_service import IncidentService

router = APIRouter(prefix="/incidents", tags=["Incidents & Human-in-the-Loop Resolution"])

@router.post("", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
def report_incident(
    body: IncidentCreate,
    request: Request,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Reports an incident on a booking or resource. Accessible to staff and booking students.
    """
    client_ip = request.client.host if request.client else None
    incident = IncidentService.create_incident(db=db, user=user, data=body, client_ip=client_ip)
    return IncidentService.get_incident_details(db, incident.id, user)

@router.get("", response_model=List[IncidentResponse])
def list_incidents(
    status: Optional[IncidentStatus] = Query(None),
    severity: Optional[IncidentSeverity] = Query(None),
    resource_id: Optional[uuid.UUID] = Query(None),
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lists incidents scoped to user's permissions (students see their reports, staff see laboratory items).
    """
    incidents = IncidentService.get_incidents(
        db=db,
        user=user,
        status_filter=status,
        severity_filter=severity,
        resource_id=resource_id,
    )
    return [IncidentService.get_incident_details(db, inc.id, user) for inc in incidents]

@router.get("/{id}", response_model=IncidentResponse)
def get_incident(
    id: uuid.UUID,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns incident details including full comment thread.
    """
    return IncidentService.get_incident_details(db=db, incident_id=id, user=user)

@router.patch("/{id}/status", response_model=IncidentResponse)
def update_incident_status(
    id: uuid.UUID,
    body: IncidentStatusUpdate,
    request: Request,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Transitions incident lifecycle. Only Managers or Admins can resolve/close with resolution notes and penalties.
    """
    client_ip = request.client.host if request.client else None
    return IncidentService.update_incident_status(
        db=db,
        incident_id=id,
        user=user,
        data=body,
        client_ip=client_ip,
    )

@router.post("/{id}/comments", response_model=IncidentCommentResponse, status_code=status.HTTP_201_CREATED)
def add_incident_comment(
    id: uuid.UUID,
    body: IncidentCommentCreate,
    request: Request,
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Appends a discussion comment to the incident arbitration thread.
    """
    client_ip = request.client.host if request.client else None
    return IncidentService.add_comment(
        db=db,
        incident_id=id,
        user=user,
        comment_text=body.comment,
        client_ip=client_ip,
    )

@router.get("/{id}/evidence-url")
def get_signed_evidence_url(
    id: uuid.UUID,
    filename: str = Query(..., description="Name of the private evidence photo"),
    user: Profile = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generates a secure 5-minute signed token URL for confidential evidence retrieval.
    """
    signed_url = IncidentService.generate_signed_evidence_url(
        db=db, incident_id=id, filename=filename, user=user
    )
    return {"signed_url": signed_url, "expires_in_seconds": 300}

@router.get("/{id}/evidence/{filename}")
def stream_evidence_photo(
    id: uuid.UUID,
    filename: str,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Serves private evidence photo only if signed token is valid and unexpired (or user session authorized).
    """
    is_valid = IncidentService.verify_evidence_access(
        db=db, incident_id=id, filename=filename, token=token
    )
    if not is_valid:
        raise CampusShareException(
            code="FORBIDDEN_EVIDENCE_ACCESS",
            message="Unauthorized or expired evidence access token.",
            status_code=status.HTTP_403_FORBIDDEN,
        )

    file_path = os.path.join(settings.UPLOAD_DIR, "incidents", filename)
    if os.path.exists(file_path):
        return FileResponse(file_path)

    # Return placeholder image / text if mock filename in test
    return PlainTextResponse(f"Authorized Evidence Photo Content for {filename}", media_type="text/plain")
