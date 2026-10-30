import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from sqlalchemy.exc import IntegrityError, DBAPIError
from app.database import SessionLocal
from app.models import (
    Profile,
    Department,
    ResourceCategory,
    Resource,
    ResourceUnit,
    Booking,
    AuditLog,
    UserRole,
    ResourceType,
    ResourceStatus,
    UnitCondition,
    BookingStatus,
)

@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.rollback()
    session.close()

@pytest.fixture(scope="module")
def setup_test_data():
    session = SessionLocal()
    try:
        dept = Department(
            name=f"Test Dept {uuid.uuid4().hex[:6]}",
            code=f"TD-{uuid.uuid4().hex[:4]}",
            description="Test Department for Exclusion Constraints",
        )
        session.add(dept)
        session.flush()

        user = Profile(
            email=f"tester-{uuid.uuid4().hex[:6]}@campus.edu",
            password_hash="testpasshash",
            full_name="Constraint Tester",
            role=UserRole.STUDENT,
            department_id=dept.id,
        )
        session.add(user)

        owner = Profile(
            email=f"owner-{uuid.uuid4().hex[:6]}@campus.edu",
            password_hash="testpasshash",
            full_name="Lab Owner",
            role=UserRole.OWNER,
            department_id=dept.id,
        )
        session.add(owner)
        session.flush()

        cat = session.query(ResourceCategory).first()
        if not cat:
            cat = ResourceCategory(name="Test Category", icon_key="computing", sort_order=1)
            session.add(cat)
            session.flush()

        res = Resource(
            name="Exclusion Test Equipment",
            category_id=cat.id,
            department_id=dept.id,
            owner_id=owner.id,
            location="Lab Bench 1",
            resource_type=ResourceType.EQUIPMENT,
            quantity=1,
            status=ResourceStatus.AVAILABLE,
        )
        session.add(res)
        session.flush()

        unit = ResourceUnit(
            resource_id=res.id,
            unit_code=f"UNIT-{uuid.uuid4().hex[:4]}",
            condition=UnitCondition.EXCELLENT,
            is_active=True,
        )
        session.add(unit)
        session.commit()

        return {
            "user_id": user.id,
            "owner_id": owner.id,
            "resource_id": res.id,
            "unit_id": unit.id,
        }
    finally:
        session.close()


def test_exclusion_constraint_blocks_overlapping_approved_bookings(db, setup_test_data):
    """
    CRITICAL DB RULE:
    Proves that PostgreSQL GIST exclusion constraint `exclude_overlapping_unit_bookings`
    strictly blocks overlapping bookings on the same physical unit when status is APPROVED.
    """
    unit_id = setup_test_data["unit_id"]
    res_id = setup_test_data["resource_id"]
    user_id = setup_test_data["user_id"]

    now = datetime.now(timezone.utc)
    slot1_start = now + timedelta(days=20, hours=10)
    slot1_end = slot1_start + timedelta(hours=2)

    # 1. Insert first approved booking
    b1 = Booking(
        booking_code=f"TEST-EXCL-1-{uuid.uuid4().hex[:4]}",
        student_id=user_id,
        resource_id=res_id,
        unit_id=unit_id,
        start_ts=slot1_start,
        end_ts=slot1_end,
        attendees=1,
        purpose="Robotics Experiment Slot 1",
        status=BookingStatus.APPROVED,
    )
    db.add(b1)
    db.commit()
    assert b1.id is not None

    # 2. Attempt to insert overlapping approved booking on the same unit
    slot2_start = slot1_start + timedelta(hours=1)
    slot2_end = slot2_start + timedelta(hours=2)

    b2 = Booking(
        booking_code=f"TEST-EXCL-2-{uuid.uuid4().hex[:4]}",
        student_id=user_id,
        resource_id=res_id,
        unit_id=unit_id,
        start_ts=slot2_start,
        end_ts=slot2_end,
        attendees=1,
        purpose="Overlapping Request",
        status=BookingStatus.APPROVED,
    )
    db.add(b2)

    with pytest.raises(IntegrityError) as exc_info:
        db.commit()

    db.rollback()

    error_msg = str(exc_info.value)
    assert "exclude_overlapping_unit_bookings" in error_msg or "conflicting key value violates exclusion constraint" in error_msg


def test_cancelled_booking_does_not_block_slot(db, setup_test_data):
    """
    Verifies that non-active statuses (CANCELLED, REJECTED) do NOT prevent another
    user from reserving the exact same unit and time window.
    """
    unit_id = setup_test_data["unit_id"]
    res_id = setup_test_data["resource_id"]
    user_id = setup_test_data["user_id"]

    now = datetime.now(timezone.utc)
    slot_start = now + timedelta(days=30, hours=9)
    slot_end = slot_start + timedelta(hours=2)

    # Insert a CANCELLED booking
    b_cancelled = Booking(
        booking_code=f"TEST-CANC-{uuid.uuid4().hex[:4]}",
        student_id=user_id,
        resource_id=res_id,
        unit_id=unit_id,
        start_ts=slot_start,
        end_ts=slot_end,
        purpose="Cancelled session",
        status=BookingStatus.CANCELLED,
    )
    db.add(b_cancelled)
    db.commit()

    # Now insert an APPROVED booking for the EXACT same slot on the same unit
    b_approved = Booking(
        booking_code=f"TEST-APPR-{uuid.uuid4().hex[:4]}",
        student_id=user_id,
        resource_id=res_id,
        unit_id=unit_id,
        start_ts=slot_start,
        end_ts=slot_end,
        purpose="Valid re-booking of cancelled slot",
        status=BookingStatus.APPROVED,
    )
    db.add(b_approved)
    db.commit()

    assert b_approved.id is not None


def test_audit_logs_append_only_trigger(db, setup_test_data):
    """
    RULE 3: Every important action writes to an append-only audit_logs table
    (no UPDATE/DELETE allowed, enforced by DB trigger).
    """
    user_id = setup_test_data["user_id"]
    log = AuditLog(
        actor_id=user_id,
        actor_role="STUDENT",
        action="TEST_ACTION",
        entity_type="TestEntity",
        entity_id="123",
        audit_metadata={"info": "immutable log verification"},
    )
    db.add(log)
    db.commit()
    log_id = log.id

    # Try to UPDATE the log
    log.action = "TAMPERED_ACTION"
    with pytest.raises(DBAPIError) as exc_info:
        db.commit()
    db.rollback()
    assert "audit_logs is append-only" in str(exc_info.value)

    # Try to DELETE the log
    log_to_delete = db.query(AuditLog).filter_by(id=log_id).first()
    db.delete(log_to_delete)
    with pytest.raises(DBAPIError) as exc_info_del:
        db.commit()
    db.rollback()
    assert "audit_logs is append-only" in str(exc_info_del.value)


def test_status_transition_guard_trigger(db, setup_test_data):
    """
    Verifies that the DB-level status transition trigger blocks illegal jumps,
    e.g. jumping directly from PENDING to COMPLETED (bypassing approval & handover).
    """
    unit_id = setup_test_data["unit_id"]
    res_id = setup_test_data["resource_id"]
    user_id = setup_test_data["user_id"]

    now = datetime.now(timezone.utc)
    slot_start = now + timedelta(days=40, hours=10)
    slot_end = slot_start + timedelta(hours=2)

    b = Booking(
        booking_code=f"TEST-GUARD-{uuid.uuid4().hex[:4]}",
        student_id=user_id,
        resource_id=res_id,
        unit_id=unit_id,
        start_ts=slot_start,
        end_ts=slot_end,
        purpose="State Machine Test",
        status=BookingStatus.PENDING,
    )
    db.add(b)
    db.commit()

    # Attempt illegal transition: PENDING -> COMPLETED directly
    b.status = BookingStatus.COMPLETED
    with pytest.raises(DBAPIError) as exc_info:
        db.commit()
    db.rollback()

    assert "ILLEGAL STATUS TRANSITION" in str(exc_info.value)
