import uuid
from datetime import datetime
from typing import List, Optional
from sqlalchemy import (
    Column,
    String,
    Text,
    Integer,
    Boolean,
    Numeric,
    DateTime,
    Date,
    Time,
    ForeignKey,
    Enum as SQLEnum,
    CheckConstraint,
    Index,
    BigInteger,
    JSON,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from ..database import Base
from .enums import (
    UserRole,
    ResourceType,
    ResourceStatus,
    UnitCondition,
    BookingStatus,
    ConditionPhase,
    WaitlistStatus,
    IncidentType,
    IncidentSeverity,
    IncidentStatus,
    LimitScope,
)

# -------------------------------------------------------------
# 1. DEPARTMENTS
# -------------------------------------------------------------
class Department(Base):
    __tablename__ = "departments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(120), unique=True, nullable=False, index=True)
    code = Column(String(20), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    profiles = relationship("Profile", back_populates="department")
    resources = relationship("Resource", back_populates="department")


# -------------------------------------------------------------
# 2. PROFILES
# -------------------------------------------------------------
class Profile(Base):
    __tablename__ = "profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=False)
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.STUDENT, index=True)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    student_id = Column(String(50), unique=True, nullable=True, index=True)
    avatar_url = Column(String(500), nullable=True)
    phone = Column(String(30), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=True, nullable=False)
    suspended_reason = Column(Text, nullable=True)
    no_show_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    department = relationship("Department", back_populates="profiles")
    owned_resources = relationship("Resource", back_populates="owner")
    training_records = relationship("TrainingRecord", foreign_keys="TrainingRecord.user_id", back_populates="user")
    bookings = relationship("Booking", foreign_keys="Booking.student_id", back_populates="student")
    incidents_reported = relationship("Incident", foreign_keys="Incident.reporter_id", back_populates="reporter")
    notifications = relationship("Notification", back_populates="user")
    reviews = relationship("ResourceReview", back_populates="user")


# -------------------------------------------------------------
# 3. RESOURCE CATEGORIES
# -------------------------------------------------------------
class ResourceCategory(Base):
    __tablename__ = "resource_categories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(80), unique=True, nullable=False)
    icon_key = Column(String(50), nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    resources = relationship("Resource", back_populates="category")


# -------------------------------------------------------------
# 4. RESOURCES
# -------------------------------------------------------------
class Resource(Base):
    __tablename__ = "resources"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("resource_categories.id", ondelete="RESTRICT"), nullable=False, index=True)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="RESTRICT"), nullable=False, index=True)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="RESTRICT"), nullable=False)
    location = Column(String(200), nullable=False)
    resource_type = Column(SQLEnum(ResourceType), nullable=False, default=ResourceType.EQUIPMENT)
    quantity = Column(Integer, default=1, nullable=False)
    capacity = Column(Integer, nullable=True) # For facilities
    status = Column(SQLEnum(ResourceStatus), nullable=False, default=ResourceStatus.AVAILABLE, index=True)
    condition_note = Column(Text, nullable=True)
    specifications = Column(JSONB, default=dict, nullable=False)
    deposit_amount = Column(Numeric(10, 2), default=0.00, nullable=False)
    approval_required = Column(Boolean, default=False, nullable=False)
    training_required = Column(Boolean, default=False, nullable=False)
    is_restricted = Column(Boolean, default=False, nullable=False)
    min_booking_minutes = Column(Integer, default=30, nullable=False)
    max_booking_minutes = Column(Integer, default=240, nullable=False)
    slot_minutes = Column(Integer, default=30, nullable=False)
    advance_booking_days = Column(Integer, default=14, nullable=False)
    popularity_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint("quantity >= 1", name="check_resource_quantity_positive"),
        Index("idx_resources_category_dept", "category_id", "department_id"),
    )

    category = relationship("ResourceCategory", back_populates="resources")
    department = relationship("Department", back_populates="resources")
    owner = relationship("Profile", back_populates="owned_resources")
    units = relationship("ResourceUnit", back_populates="resource", cascade="all, delete-orphan")
    images = relationship("ResourceImage", back_populates="resource", cascade="all, delete-orphan", order_by="ResourceImage.sort_order")
    rule = relationship("ResourceRule", back_populates="resource", uselist=False, cascade="all, delete-orphan")
    availabilities = relationship("ResourceAvailability", back_populates="resource", cascade="all, delete-orphan")
    blackouts = relationship("ResourceBlackout", back_populates="resource", cascade="all, delete-orphan")
    bookings = relationship("Booking", back_populates="resource")
    reviews = relationship("ResourceReview", back_populates="resource")

    @property
    def primary_image_url(self) -> Optional[str]:
        if self.images:
            for img in self.images:
                if getattr(img, 'is_primary', False) and img.url:
                    return img.url
            if self.images[0] and getattr(self.images[0], 'url', None):
                return self.images[0].url
        return None


# -------------------------------------------------------------
# 5. RESOURCE UNITS (Physical serial units / single space unit)
# -------------------------------------------------------------
class ResourceUnit(Base):
    __tablename__ = "resource_units"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resource_id = Column(UUID(as_uuid=True), ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, index=True)
    unit_code = Column(String(50), nullable=False) # e.g. CAM-001
    condition = Column(SQLEnum(UnitCondition), default=UnitCondition.EXCELLENT, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("idx_resource_unit_code", "resource_id", "unit_code", unique=True),
    )

    resource = relationship("Resource", back_populates="units")
    bookings = relationship("Booking", back_populates="unit")


# -------------------------------------------------------------
# 6. RESOURCE IMAGES
# -------------------------------------------------------------
class ResourceImage(Base):
    __tablename__ = "resource_images"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resource_id = Column(UUID(as_uuid=True), ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, index=True)
    url = Column(String(500), nullable=False)
    is_primary = Column(Boolean, default=False, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    resource = relationship("Resource", back_populates="images")


# -------------------------------------------------------------
# 7. RESOURCE RULES
# -------------------------------------------------------------
class ResourceRule(Base):
    __tablename__ = "resource_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resource_id = Column(UUID(as_uuid=True), ForeignKey("resources.id", ondelete="CASCADE"), unique=True, nullable=False)
    allowed_department_ids = Column(ARRAY(UUID(as_uuid=True)), default=list, nullable=False)
    allowed_roles = Column(ARRAY(String), default=list, nullable=False)
    required_training_id = Column(UUID(as_uuid=True), ForeignKey("trainings.id", ondelete="SET NULL"), nullable=True)
    requires_faculty_approval = Column(Boolean, default=False, nullable=False)
    usage_instructions = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    resource = relationship("Resource", back_populates="rule")
    required_training = relationship("Training")


# -------------------------------------------------------------
# 8. RESOURCE AVAILABILITY & BLACKOUTS
# -------------------------------------------------------------
class ResourceAvailability(Base):
    __tablename__ = "resource_availability"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resource_id = Column(UUID(as_uuid=True), ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, index=True)
    day_of_week = Column(Integer, nullable=False) # 0 = Monday, 6 = Sunday
    open_time = Column(Time, nullable=False)
    close_time = Column(Time, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint("day_of_week >= 0 AND day_of_week <= 6", name="check_day_of_week_range"),
    )

    resource = relationship("Resource", back_populates="availabilities")


class ResourceBlackout(Base):
    __tablename__ = "resource_blackouts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resource_id = Column(UUID(as_uuid=True), ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, index=True)
    start_ts = Column(DateTime(timezone=True), nullable=False)
    end_ts = Column(DateTime(timezone=True), nullable=False)
    reason = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint("end_ts > start_ts", name="check_blackout_time_window"),
    )

    resource = relationship("Resource", back_populates="blackouts")


# -------------------------------------------------------------
# 9. TRAININGS & TRAINING RECORDS
# -------------------------------------------------------------
class Training(Base):
    __tablename__ = "trainings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(150), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    records = relationship("TrainingRecord", back_populates="training")


class TrainingRecord(Base):
    __tablename__ = "training_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    training_id = Column(UUID(as_uuid=True), ForeignKey("trainings.id", ondelete="CASCADE"), nullable=False, index=True)
    completed_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    verified_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("idx_user_training_unique", "user_id", "training_id", unique=True),
    )

    user = relationship("Profile", foreign_keys=[user_id], back_populates="training_records")
    training = relationship("Training", back_populates="records")
    verifier = relationship("Profile", foreign_keys=[verified_by])


# -------------------------------------------------------------
# 10. BOOKINGS (With Optimistic Lock Version & GIST exclusion)
# -------------------------------------------------------------
class Booking(Base):
    __tablename__ = "bookings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_code = Column(String(40), unique=True, nullable=False, index=True) # e.g. CS-2026-00042
    student_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="RESTRICT"), nullable=False, index=True)
    resource_id = Column(UUID(as_uuid=True), ForeignKey("resources.id", ondelete="RESTRICT"), nullable=False, index=True)
    unit_id = Column(UUID(as_uuid=True), ForeignKey("resource_units.id", ondelete="SET NULL"), nullable=True, index=True)
    start_ts = Column(DateTime(timezone=True), nullable=False)
    end_ts = Column(DateTime(timezone=True), nullable=False)
    attendees = Column(Integer, default=1, nullable=False)
    purpose = Column(Text, nullable=False)
    project_name = Column(String(150), nullable=True)
    status = Column(SQLEnum(BookingStatus), nullable=False, default=BookingStatus.PENDING, index=True)

    approver_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    alternative_start_ts = Column(DateTime(timezone=True), nullable=True)
    alternative_end_ts = Column(DateTime(timezone=True), nullable=True)
    collected_at = Column(DateTime(timezone=True), nullable=True)
    return_submitted_at = Column(DateTime(timezone=True), nullable=True)
    returned_at = Column(DateTime(timezone=True), nullable=True)
    cancellation_reason = Column(Text, nullable=True)

    priority_score = Column(Numeric(5, 2), nullable=True)
    priority_breakdown = Column(JSONB, nullable=True)
    override_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    override_reason = Column(Text, nullable=True)
    version = Column(Integer, default=1, nullable=False) # Optimistic locking counter

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint("end_ts > start_ts", name="check_booking_time_order"),
        Index("idx_bookings_resource_start", "resource_id", "start_ts"),
        Index("idx_bookings_student_status", "student_id", "status"),
    )

    student = relationship("Profile", foreign_keys=[student_id], back_populates="bookings")
    approver = relationship("Profile", foreign_keys=[approver_id])
    override_user = relationship("Profile", foreign_keys=[override_by])
    resource = relationship("Resource", back_populates="bookings")
    unit = relationship("ResourceUnit", back_populates="bookings")
    conditions = relationship("BookingCondition", back_populates="booking", cascade="all, delete-orphan")
    review = relationship("ResourceReview", back_populates="booking", uselist=False)


# -------------------------------------------------------------
# 11. BOOKING CONDITIONS (Pickup / Return condition inspections)
# -------------------------------------------------------------
class BookingCondition(Base):
    __tablename__ = "booking_conditions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    phase = Column(SQLEnum(ConditionPhase), nullable=False)
    condition = Column(SQLEnum(UnitCondition), nullable=False)
    notes = Column(Text, nullable=True)
    photo_urls = Column(ARRAY(String), default=list, nullable=False)
    recorded_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="RESTRICT"), nullable=False)
    student_confirmed = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    booking = relationship("Booking", back_populates="conditions")
    inspector = relationship("Profile", foreign_keys=[recorded_by])


# -------------------------------------------------------------
# 12. WAITING LIST
# -------------------------------------------------------------
class WaitingList(Base):
    __tablename__ = "waiting_list"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resource_id = Column(UUID(as_uuid=True), ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    desired_start_ts = Column(DateTime(timezone=True), nullable=False)
    desired_end_ts = Column(DateTime(timezone=True), nullable=False)
    priority_score = Column(Numeric(5, 2), default=0.00, nullable=False)
    priority_breakdown = Column(JSONB, default=dict, nullable=False)
    status = Column(SQLEnum(WaitlistStatus), default=WaitlistStatus.WAITING, nullable=False, index=True)
    offered_at = Column(DateTime(timezone=True), nullable=True)
    offer_expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint("desired_end_ts > desired_start_ts", name="check_waitlist_time_order"),
    )

    resource = relationship("Resource")
    student = relationship("Profile")


# -------------------------------------------------------------
# 13. INCIDENTS (Human-in-the-loop accountability)
# -------------------------------------------------------------
class Incident(Base):
    __tablename__ = "incidents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True, index=True)
    resource_id = Column(UUID(as_uuid=True), ForeignKey("resources.id", ondelete="RESTRICT"), nullable=False, index=True)
    reporter_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="RESTRICT"), nullable=False)
    type = Column(SQLEnum(IncidentType), nullable=False)
    severity = Column(SQLEnum(IncidentSeverity), default=IncidentSeverity.MEDIUM, nullable=False)
    description = Column(Text, nullable=False)
    evidence_urls = Column(ARRAY(String), default=list, nullable=False)
    status = Column(SQLEnum(IncidentStatus), default=IncidentStatus.REPORTED, nullable=False, index=True)
    reviewer_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    resolution = Column(Text, nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    booking = relationship("Booking")
    resource = relationship("Resource")
    reporter = relationship("Profile", foreign_keys=[reporter_id], back_populates="incidents_reported")
    reviewer = relationship("Profile", foreign_keys=[reviewer_id])
    comments = relationship("IncidentComment", back_populates="incident", cascade="all, delete-orphan", order_by="IncidentComment.created_at.asc()")


# -------------------------------------------------------------
# 13B. INCIDENT COMMENTS
# -------------------------------------------------------------
class IncidentComment(Base):
    __tablename__ = "incident_comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    comment = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    incident = relationship("Incident", back_populates="comments")
    author = relationship("Profile")


# -------------------------------------------------------------
# 14. NOTIFICATIONS (15s client polling)
# -------------------------------------------------------------
class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(50), nullable=False) # e.g. 'BOOKING_APPROVED', 'OVERDUE_ALERT'
    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=False)
    link = Column(String(300), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("idx_notifications_user_unread", "user_id", "is_read"),
    )

    user = relationship("Profile", back_populates="notifications")


# -------------------------------------------------------------
# 15. AUDIT LOGS (Strictly append-only table, bigserial PK)
# -------------------------------------------------------------
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    actor_role = Column(String(40), nullable=True)
    action = Column(String(100), nullable=False) # e.g. 'BOOKING_APPROVED', 'QR_HANDOVER_SCAN'
    entity_type = Column(String(50), nullable=False) # e.g. 'Booking', 'Incident'
    entity_id = Column(String(100), nullable=True)
    resource_id = Column(UUID(as_uuid=True), ForeignKey("resources.id", ondelete="SET NULL"), nullable=True)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True)
    audit_metadata = Column("metadata", JSONB, nullable=True)
    ip = Column(String(45), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("idx_audit_logs_entity", "entity_type", "entity_id"),
        Index("idx_audit_logs_created_at", "created_at"),
    )

    actor = relationship("Profile", foreign_keys=[actor_id])


# -------------------------------------------------------------
# 16. USAGE LIMITS
# -------------------------------------------------------------
class UsageLimit(Base):
    __tablename__ = "usage_limits"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scope = Column(SQLEnum(LimitScope), default=LimitScope.GLOBAL, nullable=False)
    scope_id = Column(UUID(as_uuid=True), nullable=True) # None for global, category_id or resource_id
    max_active_bookings = Column(Integer, default=3, nullable=False)
    max_bookings_per_week = Column(Integer, default=5, nullable=False)
    max_hours_per_week = Column(Integer, default=20, nullable=False)
    no_show_threshold = Column(Integer, default=2, nullable=False)
    no_show_cooldown_days = Column(Integer, default=7, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


# -------------------------------------------------------------
# 17. PLATFORM SETTINGS
# -------------------------------------------------------------
class PlatformSetting(Base):
    __tablename__ = "platform_settings"

    key = Column(String(80), primary_key=True)
    value = Column(JSONB, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


# -------------------------------------------------------------
# 18. RESOURCE REVIEWS
# -------------------------------------------------------------
class ResourceReview(Base):
    __tablename__ = "resource_reviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resource_id = Column(UUID(as_uuid=True), ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id", ondelete="CASCADE"), unique=True, nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="check_review_rating_range"),
    )

    resource = relationship("Resource", back_populates="reviews")
    user = relationship("Profile", back_populates="reviews")
    booking = relationship("Booking", back_populates="review")
