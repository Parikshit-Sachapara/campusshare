import uuid
import jwt
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc
from fastapi import status

from ..models import (
    Incident,
    IncidentComment,
    Booking,
    Resource,
    Profile,
)
from ..models.enums import (
    IncidentStatus,
    IncidentType,
    IncidentSeverity,
    UserRole,
)
from ..schemas.incident import (
    IncidentCreate,
    IncidentStatusUpdate,
    IncidentCommentCreate,
    IncidentResponse,
    IncidentCommentResponse,
)
from ..config import settings
from ..core.exceptions import CampusShareException
from ..core.audit import audit
from ..core.notify import notify
from .incident_state_machine import IncidentStateMachine

class IncidentService:
    """
    CampusShare Human-in-the-Loop Incident Arbitration & Accountability Engine.
    Handles lifecycle tracking, comment threads, admin penalties, and private signed evidence access.
    """

    @classmethod
    def check_incident_authorization(cls, incident: Incident, user: Profile) -> bool:
        if user.role in [UserRole.MANAGER, UserRole.ADMIN]:
            return True
        if incident.reporter_id == user.id:
            return True
        if incident.resource and incident.resource.owner_id == user.id:
            return True
        if incident.booking and incident.booking.student_id == user.id:
            return True
        return False

    @classmethod
    def create_incident(
        cls,
        db: Session,
        user: Profile,
        data: IncidentCreate,
        client_ip: Optional[str] = None,
    ) -> Incident:
        resource = db.query(Resource).filter_by(id=data.resource_id).first()
        if not resource:
            raise CampusShareException(code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404)

        # If booking is linked, verify student is involved or user is staff
        booking = None
        if data.booking_id:
            booking = db.query(Booking).filter_by(id=data.booking_id).first()
            if booking and user.role == UserRole.STUDENT and booking.student_id != user.id:
                raise CampusShareException(code="FORBIDDEN_REPORT", message="Cannot report incidents on another user's booking.", status_code=403)

        incident = Incident(
            booking_id=data.booking_id,
            resource_id=data.resource_id,
            reporter_id=user.id,
            type=data.type,
            severity=data.severity,
            description=data.description.strip(),
            evidence_urls=data.evidence_urls,
            status=IncidentStatus.REPORTED,
        )
        db.add(incident)
        db.flush()

        audit(
            db=db,
            actor_id=user.id,
            actor_role=str(user.role.value if hasattr(user.role, "value") else user.role),
            action="INCIDENT_REPORTED",
            entity_type="Incident",
            entity_id=str(incident.id),
            resource_id=data.resource_id,
            booking_id=data.booking_id,
            metadata={
                "type": data.type.value,
                "severity": data.severity.value,
                "reporter": user.full_name,
            },
            ip=client_ip,
        )

        # Notify Managers and Admins
        supervisors = db.query(Profile).filter(Profile.role.in_([UserRole.MANAGER, UserRole.ADMIN])).all()
        for sup in supervisors:
            notify(
                db=db,
                user_id=sup.id,
                type="INCIDENT_REPORTED",
                title=f"Incident Reported: {data.type.value}",
                body=f"Severity: {data.severity.value} on '{resource.name}'. Reported by {user.full_name}.",
                link=f"/incidents/{incident.id}",
            )

        db.commit()
        db.refresh(incident)
        return incident

    @classmethod
    def get_incidents(
        cls,
        db: Session,
        user: Profile,
        status_filter: Optional[IncidentStatus] = None,
        severity_filter: Optional[IncidentSeverity] = None,
        resource_id: Optional[uuid.UUID] = None,
    ) -> List[Incident]:
        query = db.query(Incident)

        if user.role == UserRole.STUDENT:
            # Student sees incidents they reported OR linked to their booking
            student_bookings = db.query(Booking.id).filter_by(student_id=user.id).subquery()
            query = query.filter(
                or_(
                    Incident.reporter_id == user.id,
                    Incident.booking_id.in_(student_bookings)
                )
            )
        elif user.role == UserRole.OWNER:
            # Owner sees incidents on their owned resources
            owner_res = db.query(Resource.id).filter_by(owner_id=user.id).subquery()
            query = query.filter(
                or_(
                    Incident.reporter_id == user.id,
                    Incident.resource_id.in_(owner_res)
                )
            )
        elif user.role == UserRole.MANAGER:
            # Manager sees department + all
            pass
        elif user.role == UserRole.ADMIN:
            pass

        if status_filter:
            query = query.filter(Incident.status == status_filter)
        if severity_filter:
            query = query.filter(Incident.severity == severity_filter)
        if resource_id:
            query = query.filter(Incident.resource_id == resource_id)

        return query.order_by(desc(Incident.created_at)).all()

    @classmethod
    def get_incident_details(cls, db: Session, incident_id: uuid.UUID, user: Profile) -> IncidentResponse:
        incident = db.query(Incident).filter_by(id=incident_id).first()
        if not incident:
            raise CampusShareException(code="INCIDENT_NOT_FOUND", message="Incident not found.", status_code=404)

        if not cls.check_incident_authorization(incident, user):
            raise CampusShareException(code="FORBIDDEN_ACCESS", message="Unauthorized to view this incident.", status_code=403)

        comments = [
            IncidentCommentResponse(
                id=c.id,
                incident_id=c.incident_id,
                author_id=c.author_id,
                author_name=c.author.full_name if c.author else None,
                author_role=c.author.role.value if c.author else None,
                comment=c.comment,
                created_at=c.created_at,
            )
            for c in incident.comments
        ]

        return IncidentResponse(
            id=incident.id,
            booking_id=incident.booking_id,
            resource_id=incident.resource_id,
            resource_name=incident.resource.name if incident.resource else None,
            reporter_id=incident.reporter_id,
            reporter_name=incident.reporter.full_name if incident.reporter else None,
            type=incident.type,
            severity=incident.severity,
            description=incident.description,
            evidence_urls=incident.evidence_urls,
            status=incident.status,
            reviewer_id=incident.reviewer_id,
            reviewer_name=incident.reviewer.full_name if incident.reviewer else None,
            resolution=incident.resolution,
            resolved_at=incident.resolved_at,
            created_at=incident.created_at,
            updated_at=incident.updated_at,
            comments=comments,
        )

    @classmethod
    def update_incident_status(
        cls,
        db: Session,
        incident_id: uuid.UUID,
        user: Profile,
        data: IncidentStatusUpdate,
        client_ip: Optional[str] = None,
    ) -> IncidentResponse:
        incident = db.query(Incident).filter_by(id=incident_id).with_for_update().first()
        if not incident:
            raise CampusShareException(code="INCIDENT_NOT_FOUND", message="Incident not found.", status_code=404)

        # Validate state machine transitions and permissions
        IncidentStateMachine.validate_transition(
            current=incident.status,
            target=data.status,
            actor_role=user.role,
            resolution=data.resolution,
        )

        now = datetime.now(timezone.utc)
        incident.status = data.status
        incident.reviewer_id = user.id

        if data.status in [IncidentStatus.RESOLVED, IncidentStatus.CLOSED]:
            incident.resolution = data.resolution.strip() if data.resolution else None
            incident.resolved_at = now

            # If Manager/Admin applied penalty/restriction
            if data.penalty_apply_suspension and incident.booking and incident.booking.student_id:
                student = db.query(Profile).filter_by(id=incident.booking.student_id).first()
                if student:
                    student.is_active = False
                    student.suspended_reason = data.penalty_suspension_reason or f"Account suspended following resolution of Incident {incident.id}: {data.resolution}"

                    audit(
                        db=db,
                        actor_id=user.id,
                        actor_role=str(user.role.value if hasattr(user.role, "value") else user.role),
                        action="STUDENT_ACCOUNT_RESTRICTED",
                        entity_type="Profile",
                        entity_id=str(student.id),
                        metadata={"incident_id": str(incident.id), "reason": student.suspended_reason},
                        ip=client_ip,
                    )

                    notify(
                        db=db,
                        user_id=student.id,
                        type="ACCOUNT_RESTRICTED",
                        title="Account Access Suspended",
                        body=f"Your borrowing privileges have been restricted: {student.suspended_reason}",
                    )

        audit(
            db=db,
            actor_id=user.id,
            actor_role=str(user.role.value if hasattr(user.role, "value") else user.role),
            action=f"INCIDENT_{data.status.value}",
            entity_type="Incident",
            entity_id=str(incident.id),
            resource_id=incident.resource_id,
            booking_id=incident.booking_id,
            metadata={"new_status": data.status.value, "resolution": incident.resolution},
            ip=client_ip,
        )

        notify(
            db=db,
            user_id=incident.reporter_id,
            type=f"INCIDENT_{data.status.value}",
            title=f"Incident Status: {data.status.value}",
            body=f"Incident regarding '{incident.resource.name}' moved to {data.status.value}.",
            link=f"/incidents/{incident.id}",
        )

        db.commit()
        db.refresh(incident)
        return cls.get_incident_details(db, incident.id, user)

    @classmethod
    def add_comment(
        cls,
        db: Session,
        incident_id: uuid.UUID,
        user: Profile,
        comment_text: str,
        client_ip: Optional[str] = None,
    ) -> IncidentCommentResponse:
        incident = db.query(Incident).filter_by(id=incident_id).first()
        if not incident:
            raise CampusShareException(code="INCIDENT_NOT_FOUND", message="Incident not found.", status_code=404)

        if not cls.check_incident_authorization(incident, user):
            raise CampusShareException(code="FORBIDDEN_ACTION", message="Unauthorized to comment on this incident.", status_code=403)

        comment = IncidentComment(
            incident_id=incident.id,
            author_id=user.id,
            comment=comment_text.strip(),
        )
        db.add(comment)
        db.flush()

        audit(
            db=db,
            actor_id=user.id,
            actor_role=str(user.role.value if hasattr(user.role, "value") else user.role),
            action="INCIDENT_COMMENT_ADDED",
            entity_type="IncidentComment",
            entity_id=str(comment.id),
            metadata={"incident_id": str(incident.id)},
            ip=client_ip,
        )

        db.commit()
        db.refresh(comment)

        return IncidentCommentResponse(
            id=comment.id,
            incident_id=comment.incident_id,
            author_id=comment.author_id,
            author_name=user.full_name,
            author_role=user.role.value,
            comment=comment.comment,
            created_at=comment.created_at,
        )

    @classmethod
    def generate_signed_evidence_url(
        cls,
        db: Session,
        incident_id: uuid.UUID,
        filename: str,
        user: Profile,
    ) -> str:
        incident = db.query(Incident).filter_by(id=incident_id).first()
        if not incident:
            raise CampusShareException(code="INCIDENT_NOT_FOUND", message="Incident not found.", status_code=404)

        if not cls.check_incident_authorization(incident, user):
            raise CampusShareException(code="FORBIDDEN_EVIDENCE", message="Unauthorized to view confidential evidence photos.", status_code=403)

        # 5-minute expiring token
        payload = {
            "sub": str(user.id),
            "incident_id": str(incident_id),
            "filename": filename,
            "type": "evidence_access",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return f"/incidents/{incident_id}/evidence/{filename}?token={token}"

    @classmethod
    def verify_evidence_access(
        cls,
        db: Session,
        incident_id: uuid.UUID,
        filename: str,
        token: Optional[str],
        user: Optional[Profile] = None,
    ) -> bool:
        """
        Validates 5-minute signed token OR authenticated session against privacy policy.
        """
        # 1. Token validation
        if token:
            try:
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
                if payload.get("type") == "evidence_access" and payload.get("incident_id") == str(incident_id):
                    return True
            except jwt.PyJWTError:
                pass

        # 2. Authenticated user validation
        if user:
            incident = db.query(Incident).filter_by(id=incident_id).first()
            if incident and cls.check_incident_authorization(incident, user):
                return True

        return False
