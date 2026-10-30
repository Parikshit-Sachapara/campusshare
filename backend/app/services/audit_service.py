import io
import csv
import uuid
from typing import Optional, List, Tuple, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, and_

from ..models import AuditLog, Booking, Resource, Profile
from ..models.enums import UserRole
from ..schemas.audit import AuditLogResponse, TimelineNarrativeItem
from ..core.exceptions import CampusShareException

class AuditService:
    """
    CampusShare Immutable Audit & Human-Narrative Timeline Engine.
    Provides streaming CSV exports, human-readable prose generation, and resource operational histories.
    """

    @classmethod
    def generate_narrative(cls, log: AuditLog, actor_name: str) -> str:
        meta = log.audit_metadata or {}
        action = log.action

        if action == "BOOKING_REQUESTED":
            return f"{actor_name} requested the booking"
        elif action == "ELIGIBILITY_VERIFIED":
            passed = meta.get("checks_passed", 14)
            return f"System verified eligibility requirements ({passed}/14 requirements passed)"
        elif action == "BOOKING_APPROVED":
            return f"{actor_name} approved the request"
        elif action == "BOOKING_CHECKED_OUT":
            cond = meta.get("initial_condition", "EXCELLENT")
            return f"{actor_name} handed over the resource (Condition: {cond})"
        elif action == "PICKUP_CONFIRMED":
            return f"{actor_name} confirmed physical collection of the resource"
        elif action == "FACILITY_OCCUPANCY_RECORDED":
            hc = meta.get("headcount", 1)
            return f"{actor_name} recorded arrival and headcount ({hc} attendees)"
        elif action == "RETURN_SUBMITTED":
            return f"{actor_name} submitted the return with physical condition inspection photos"
        elif action == "RETURN_VERIFIED":
            cond = meta.get("final_condition", "EXCELLENT")
            return f"{actor_name} verified the return condition as {cond}"
        elif action == "RETURN_FLAGGED_DAMAGE":
            return f"{actor_name} flagged damage or discrepancies during return inspection"
        elif action == "BOOKING_COMPLETED":
            return "Booking marked as COMPLETED"
        elif action == "BOOKING_CANCELLED":
            reason = meta.get("reason", "No reason provided")
            return f"{actor_name} cancelled the booking ({reason})"
        elif action == "PRIORITY_OVERRIDDEN":
            score = meta.get("new_score", "")
            reason = meta.get("reason", "")
            return f"{actor_name} adjusted priority score to {score}: {reason}"
        elif action == "INCIDENT_REPORTED":
            t = meta.get("type", "General")
            return f"{actor_name} reported an incident ({t})"
        elif action == "INCIDENT_RESOLVED":
            res = meta.get("resolution", "Resolved by staff")
            return f"{actor_name} resolved the incident: {res}"
        elif action == "WAITLIST_JOINED":
            return f"{actor_name} joined the priority waitlist"
        elif action == "WAITLIST_SLOT_OFFERED":
            return "System offered an opened slot to the highest-priority waiting student"
        elif action == "LOGIN_SUCCESS":
            return f"{actor_name} successfully authenticated"

        return f"{actor_name} performed {action}"

    @classmethod
    def get_booking_timeline(
        cls,
        db: Session,
        booking_id: uuid.UUID,
        user: Profile,
    ) -> List[TimelineNarrativeItem]:
        booking = db.query(Booking).filter_by(id=booking_id).first()
        if not booking:
            raise CampusShareException(code="BOOKING_NOT_FOUND", message="Booking not found.", status_code=404)

        # Authorization: Student of booking, resource owner, manager, admin
        is_student = (booking.student_id == user.id)
        is_owner = (booking.resource.owner_id == user.id) if booking.resource else False
        is_privileged = user.role in [UserRole.MANAGER, UserRole.ADMIN]
        if not is_student and not is_owner and not is_privileged:
            raise CampusShareException(code="FORBIDDEN_TIMELINE", message="Unauthorized to view this booking timeline.", status_code=403)

        logs = db.query(AuditLog).filter(
            or_(
                AuditLog.booking_id == booking.id,
                and_(AuditLog.entity_type == "Booking", AuditLog.entity_id == str(booking.id))
            )
        ).order_by(AuditLog.created_at.asc(), AuditLog.id.asc()).all()

        timeline: List[TimelineNarrativeItem] = []
        for l in logs:
            actor = db.query(Profile).filter_by(id=l.actor_id).first() if l.actor_id else None
            actor_name = actor.full_name if actor else (l.actor_role or "System")
            narrative = cls.generate_narrative(l, actor_name)

            timeline.append(TimelineNarrativeItem(
                id=l.id,
                action=l.action,
                narrative=narrative,
                actor_name=actor_name,
                actor_role=l.actor_role,
                created_at=l.created_at,
                metadata=l.audit_metadata,
            ))

        return timeline

    @classmethod
    def get_resource_history(
        cls,
        db: Session,
        resource_id: uuid.UUID,
        user: Profile,
    ) -> List[TimelineNarrativeItem]:
        resource = db.query(Resource).filter_by(id=resource_id).first()
        if not resource:
            raise CampusShareException(code="RESOURCE_NOT_FOUND", message="Resource not found.", status_code=404)

        logs = db.query(AuditLog).filter(
            or_(
                AuditLog.resource_id == resource.id,
                and_(AuditLog.entity_type == "Resource", AuditLog.entity_id == str(resource.id))
            )
        ).order_by(desc(AuditLog.created_at)).all()

        history: List[TimelineNarrativeItem] = []
        for l in logs:
            actor = db.query(Profile).filter_by(id=l.actor_id).first() if l.actor_id else None
            actor_name = actor.full_name if actor else (l.actor_role or "System")
            narrative = cls.generate_narrative(l, actor_name)

            history.append(TimelineNarrativeItem(
                id=l.id,
                action=l.action,
                narrative=narrative,
                actor_name=actor_name,
                actor_role=l.actor_role,
                created_at=l.created_at,
                metadata=l.audit_metadata,
            ))

        return history

    @classmethod
    def get_admin_audit_logs(
        cls,
        db: Session,
        actor_id: Optional[uuid.UUID] = None,
        actor_role: Optional[str] = None,
        action: Optional[str] = None,
        entity_type: Optional[str] = None,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[AuditLogResponse], int]:
        query = db.query(AuditLog)

        if actor_id:
            query = query.filter(AuditLog.actor_id == actor_id)
        if actor_role:
            query = query.filter(AuditLog.actor_role.ilike(actor_role))
        if action:
            query = query.filter(AuditLog.action.ilike(f"%{action}%"))
        if entity_type:
            query = query.filter(AuditLog.entity_type.ilike(entity_type))
        if from_date:
            query = query.filter(AuditLog.created_at >= from_date)
        if to_date:
            query = query.filter(AuditLog.created_at <= to_date)

        total = query.count()
        offset = (page - 1) * page_size
        items = query.order_by(desc(AuditLog.created_at)).offset(offset).limit(page_size).all()

        responses: List[AuditLogResponse] = []
        for l in items:
            actor = db.query(Profile).filter_by(id=l.actor_id).first() if l.actor_id else None
            actor_name = actor.full_name if actor else (l.actor_role or "System")
            responses.append(AuditLogResponse(
                id=l.id,
                actor_id=l.actor_id,
                actor_name=actor_name,
                actor_role=l.actor_role,
                action=l.action,
                entity_type=l.entity_type,
                entity_id=l.entity_id,
                resource_id=l.resource_id,
                booking_id=l.booking_id,
                audit_metadata=l.audit_metadata,
                ip=l.ip,
                created_at=l.created_at,
                narrative=cls.generate_narrative(l, actor_name),
            ))

        return responses, total

    @classmethod
    def export_csv(cls, logs: List[AuditLogResponse]) -> str:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "ID", "Timestamp (UTC)", "Actor Role", "Actor Name", "Action", "Entity Type", "Entity ID", "Narrative", "IP"
        ])
        for l in logs:
            writer.writerow([
                l.id,
                l.created_at.isoformat(),
                l.actor_role or "System",
                l.actor_name or "",
                l.action,
                l.entity_type,
                l.entity_id or "",
                l.narrative,
                l.ip or "",
            ])
        return output.getvalue()

