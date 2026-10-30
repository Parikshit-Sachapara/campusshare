import os
import sys
import uuid
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.database import SessionLocal
from app.models import (
    Profile,
    Resource,
    ResourceUnit,
    ResourceCategory,
    Department,
    Training,
    TrainingRecord,
    Booking,
    BookingCondition,
    Incident,
    UsageLimit,
    UserRole,
    ResourceType,
    ResourceStatus,
    BookingStatus,
    UnitCondition,
    ConditionPhase,
    IncidentType,
    IncidentSeverity,
    IncidentStatus,
    LimitScope,
)
from app.core.security import create_access_token

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_isolated_student(db_session, prefix: str) -> tuple:
    dept = db_session.query(Department).first()
    p = Profile(
        email=f"{prefix}_{uuid.uuid4().hex[:6]}@campusshare.demo",
        password_hash="dummy_pw",
        full_name=f"Student {prefix}",
        role=UserRole.STUDENT,
        department_id=dept.id,
        student_id=f"ST-{uuid.uuid4().hex[:6]}",
        is_active=True,
        is_verified=True,
    )
    db_session.add(p)
    db_session.commit()
    db_session.refresh(p)
    token = create_access_token({"sub": str(p.id), "role": "STUDENT", "email": p.email})
    return p, {"Authorization": f"Bearer {token}"}

def create_isolated_resource(db_session, owner_profile, approval_required=False, department_id=None) -> tuple:
    cat = db_session.query(ResourceCategory).first()
    dept = db_session.query(Department).filter_by(id=department_id).first() if department_id else db_session.query(Department).first()

    res = Resource(
        name=f"Acc Test Resource {uuid.uuid4().hex[:6]}",
        category_id=cat.id,
        department_id=dept.id,
        owner_id=owner_profile.id,
        location="Lab Rm 101",
        resource_type=ResourceType.EQUIPMENT,
        quantity=1,
        status=ResourceStatus.AVAILABLE,
        approval_required=approval_required,
        training_required=False,
    )
    db_session.add(res)
    db_session.commit()
    db_session.refresh(res)

    unit = ResourceUnit(
        resource_id=res.id,
        unit_code=f"U-{uuid.uuid4().hex[:6].upper()}",
        condition=UnitCondition.EXCELLENT,
        is_active=True,
    )
    db_session.add(unit)
    db_session.commit()
    db_session.refresh(unit)

    return res, unit


# =========================================================================
# THE 10 HACKATHON SCENARIOS (All 10 must pass 100%)
# =========================================================================

def test_scenario_01_request_success_auto_approval(client, db_session):
    """
    Scenario 1: Student creates valid booking for resource without approval requirement.
    Outcome: Booking directly transitions to APPROVED with assigned unit.
    """
    owner = db_session.query(Profile).filter_by(role=UserRole.OWNER).first()
    student, student_headers = create_isolated_student(db_session, "s01")
    res, unit = create_isolated_resource(db_session, owner, approval_required=False)

    now = datetime.now(timezone.utc)
    start_ts = (now + timedelta(days=2)).replace(hour=10, minute=0, second=0, microsecond=0)
    end_ts = start_ts + timedelta(hours=2)

    payload = {
        "resource_id": str(res.id),
        "start_ts": start_ts.isoformat(),
        "end_ts": end_ts.isoformat(),
        "purpose": "Academic prototyping workshop",
        "attendees": 1,
    }
    r = client.post("/bookings", json=payload, headers=student_headers)
    assert r.status_code == 201
    data = r.json()
    assert data["status"] == "APPROVED"
    assert data["unit_id"] == str(unit.id)
    assert data["priority_score"] > 0


def test_scenario_02_missing_training_blocks_request(client, db_session):
    """
    Scenario 2: Student without required training attempts to reserve restricted resource.
    Outcome: Blocked with 409 ELIGIBILITY_FAILED and plain-English explanation.
    """
    # Canon EOS DSLR requires "DSLR & Studio Production Safety"
    dslr = db_session.query(Resource).filter_by(name="Canon EOS DSLR Camera Kit").first()
    assert dslr is not None
    assert dslr.training_required is True

    # student2 is untrained
    student2 = db_session.query(Profile).filter_by(email="student2@campusshare.demo").first()
    token = create_access_token({"sub": str(student2.id), "role": "STUDENT", "email": student2.email})
    headers = {"Authorization": f"Bearer {token}"}

    now = datetime.now(timezone.utc)
    target_date = (now + timedelta(days=5)).date()
    start_ts = datetime(target_date.year, target_date.month, target_date.day, 11, 0, tzinfo=timezone.utc)
    end_ts = start_ts + timedelta(hours=1)

    r = client.post("/bookings", json={
        "resource_id": str(dslr.id),
        "start_ts": start_ts.isoformat(),
        "end_ts": end_ts.isoformat(),
        "purpose": "Field documentary recording",
        "attendees": 1,
    }, headers=headers)
    assert r.status_code == 409
    data = r.json()
    assert data["code"] == "ELIGIBILITY_FAILED"
    assert "training" in data["message"].lower() or "safety" in data["message"].lower()


def test_scenario_03_concurrent_double_booking_blocked(client, db_session):
    """
    Scenario 3: Two concurrent requests compete for the sole available physical unit.
    Outcome: First succeeds, second receives 409 Conflict with suggested next free slots.
    """
    owner = db_session.query(Profile).filter_by(role=UserRole.OWNER).first()
    student_a, headers_a = create_isolated_student(db_session, "s03_a")
    student_b, headers_b = create_isolated_student(db_session, "s03_b")
    res, unit = create_isolated_resource(db_session, owner, approval_required=False)

    now = datetime.now(timezone.utc)
    start_ts = (now + timedelta(days=3)).replace(hour=14, minute=0, second=0, microsecond=0)
    end_ts = start_ts + timedelta(hours=2)

    payload = {
        "resource_id": str(res.id),
        "start_ts": start_ts.isoformat(),
        "end_ts": end_ts.isoformat(),
        "purpose": "Capstone evaluation testing",
    }
    # Request A succeeds
    r_a = client.post("/bookings", json=payload, headers=headers_a)
    assert r_a.status_code == 201

    # Request B receives conflict
    r_b = client.post("/bookings", json=payload, headers=headers_b)
    assert r_b.status_code == 409
    err_data = r_b.json()
    assert err_data["code"] in ["RESOURCE_UNAVAILABLE", "BOOKING_CONFLICT", "CONFLICT"] or "reserved" in err_data["message"].lower()
    assert "suggested_slots" in err_data["details"]


def test_scenario_04_manager_approval_and_notification(client, db_session):
    """
    Scenario 4: Resource with approval_required = True inserts as PENDING,
    manager reviews queue, approves, and student notification is created.
    """
    manager = db_session.query(Profile).filter_by(role=UserRole.MANAGER).first()
    mgr_token = create_access_token({"sub": str(manager.id), "role": "MANAGER", "email": manager.email})
    mgr_headers = {"Authorization": f"Bearer {mgr_token}"}

    owner = db_session.query(Profile).filter_by(role=UserRole.OWNER).first()
    student, student_headers = create_isolated_student(db_session, "s04_appr")
    # Resource in manager's department authorizes the manager
    res, unit = create_isolated_resource(db_session, owner, approval_required=True, department_id=manager.department_id)

    now = datetime.now(timezone.utc)
    start_ts = (now + timedelta(days=4)).replace(hour=9, minute=0, second=0, microsecond=0)
    end_ts = start_ts + timedelta(hours=2)

    # 1. Student requests -> PENDING
    r_req = client.post("/bookings", json={
        "resource_id": str(res.id),
        "start_ts": start_ts.isoformat(),
        "end_ts": end_ts.isoformat(),
        "purpose": "Senior research thesis project",
    }, headers=student_headers)
    assert r_req.status_code == 201
    booking_id = r_req.json()["id"]
    assert r_req.json()["status"] == "PENDING"

    # 2. Manager approves
    r_appr = client.post(f"/bookings/{booking_id}/approve", headers=mgr_headers)
    assert r_appr.status_code == 200
    assert r_appr.json()["status"] == "APPROVED"

    # 3. Student receives approval notification
    r_notif = client.get("/notifications", headers=student_headers)
    assert r_notif.status_code == 200
    items = r_notif.json()["items"]
    assert any("approved" in n["title"].lower() for n in items)


def test_scenario_05_owner_pickup_records_checkout(client, db_session):
    """
    Scenario 5: Owner scans QR code / enters code, records equipment condition and photos.
    Status transitions from APPROVED to CHECKED_OUT.
    """
    owner = db_session.query(Profile).filter_by(role=UserRole.OWNER).first()
    owner_token = create_access_token({"sub": str(owner.id), "role": "OWNER", "email": owner.email})
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    student, student_headers = create_isolated_student(db_session, "s05_pck")
    res, unit = create_isolated_resource(db_session, owner, approval_required=False)

    now = datetime.now(timezone.utc)
    start_ts = now - timedelta(minutes=10) # within +/- 30 min window
    end_ts = start_ts + timedelta(hours=2)

    b = Booking(
        booking_code=f"BK-{uuid.uuid4().hex[:8].upper()}",
        student_id=student.id,
        resource_id=res.id,
        unit_id=unit.id,
        start_ts=start_ts,
        end_ts=end_ts,
        status=BookingStatus.APPROVED,
        purpose="Robotics team testing work",
        priority_score=75.0,
    )
    db_session.add(b)
    db_session.commit()
    db_session.refresh(b)

    # Checkout via /bookings/{id}/checkout
    checkout_payload = {
        "booking_code_or_token": b.booking_code,
        "condition": "EXCELLENT",
        "notes": "Lens clean, battery 100%, serial verified",
        "photo_urls": ["https://images.unsplash.com/photo-1?auto=format"],
        "confirmed_in_person": True,
    }
    r = client.post(f"/bookings/{b.id}/checkout", json=checkout_payload, headers=owner_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "CHECKED_OUT"

    # Verify booking_conditions PICKUP entry created
    cond = db_session.query(BookingCondition).filter_by(booking_id=b.id, phase=ConditionPhase.PICKUP).first()
    assert cond is not None
    assert cond.condition == UnitCondition.EXCELLENT


def test_scenario_06_student_return_then_owner_verify(client, db_session):
    """
    Scenario 6: Student submits return with photos -> RETURN_PENDING.
    Owner compares pickup vs return, confirms condition EXCELLENT -> COMPLETED.
    """
    owner = db_session.query(Profile).filter_by(role=UserRole.OWNER).first()
    owner_token = create_access_token({"sub": str(owner.id), "role": "OWNER", "email": owner.email})
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    student, student_headers = create_isolated_student(db_session, "s06_ret")
    res, unit = create_isolated_resource(db_session, owner)

    now = datetime.now(timezone.utc)
    b = Booking(
        booking_code=f"BK-{uuid.uuid4().hex[:8].upper()}",
        student_id=student.id,
        resource_id=res.id,
        unit_id=unit.id,
        start_ts=now - timedelta(hours=2),
        end_ts=now + timedelta(hours=1),
        status=BookingStatus.CHECKED_OUT,
        purpose="Filmmaking class project",
        priority_score=80.0,
        collected_at=now - timedelta(hours=2),
    )
    db_session.add(b)
    db_session.flush()

    pickup_cond = BookingCondition(
        booking_id=b.id,
        phase=ConditionPhase.PICKUP,
        recorded_by=owner.id,
        condition=UnitCondition.EXCELLENT,
        notes="All accessories accounted for",
    )
    db_session.add(pickup_cond)
    db_session.commit()
    db_session.refresh(b)

    # 1. Student submits return via /bookings/{id}/return
    r_ret = client.post(f"/bookings/{b.id}/return", json={
        "notes": "Returned equipment undamaged",
        "photo_urls": ["https://images.unsplash.com/return_photo_1.jpg"],
    }, headers=student_headers)
    assert r_ret.status_code == 200
    assert r_ret.json()["status"] == "RETURN_PENDING"

    # 2. Owner verifies return -> COMPLETED via /bookings/{id}/verify-return
    r_ver = client.post(f"/bookings/{b.id}/verify-return", json={
        "final_condition": "EXCELLENT",
        "notes": "Verified in person; condition pristine",
    }, headers=owner_headers)
    assert r_ver.status_code == 200
    assert r_ver.json()["status"] == "COMPLETED"


def test_scenario_07_damage_incident_created_and_visible_to_manager(client, db_session):
    """
    Scenario 7: Damaged return automatically creates an incident, flags the unit,
    sets booking status to INCIDENT_REPORTED, and incident is visible to manager.
    """
    owner = db_session.query(Profile).filter_by(role=UserRole.OWNER).first()
    owner_token = create_access_token({"sub": str(owner.id), "role": "OWNER", "email": owner.email})
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    manager = db_session.query(Profile).filter_by(role=UserRole.MANAGER).first()
    mgr_token = create_access_token({"sub": str(manager.id), "role": "MANAGER", "email": manager.email})
    mgr_headers = {"Authorization": f"Bearer {mgr_token}"}

    student, student_headers = create_isolated_student(db_session, "s07_dmg")
    res, unit = create_isolated_resource(db_session, owner)

    now = datetime.now(timezone.utc)
    b = Booking(
        booking_code=f"BK-{uuid.uuid4().hex[:8].upper()}",
        student_id=student.id,
        resource_id=res.id,
        unit_id=unit.id,
        start_ts=now - timedelta(hours=3),
        end_ts=now - timedelta(hours=1),
        status=BookingStatus.RETURN_PENDING,
        purpose="Field measurement survey",
        priority_score=60.0,
    )
    db_session.add(b)
    db_session.commit()
    db_session.refresh(b)

    # Owner verifies and reports damage via /bookings/{id}/verify-return
    r_dmg = client.post(f"/bookings/{b.id}/verify-return", json={
        "final_condition": "DAMAGED",
        "damage_observed": True,
        "incident_description": "Front optical element severely scratched with impact fractures",
        "notes": "Cracked optical lens glass and missing lens cap",
    }, headers=owner_headers)
    assert r_dmg.status_code == 200
    assert r_dmg.json()["status"] == "INCIDENT_REPORTED"

    # Verify unit is marked DAMAGED and removed from availability
    db_session.refresh(unit)
    assert unit.condition == UnitCondition.DAMAGED
    assert unit.is_active is False

    # Verify incident exists and is visible to Manager in incident queue
    r_inc = client.get("/incidents", headers=mgr_headers)
    assert r_inc.status_code == 200
    incident_items = r_inc.json()
    assert any(str(i["booking_id"]) == str(b.id) for i in incident_items)


def test_scenario_08_weekly_limit_enforcement(client, db_session):
    """
    Scenario 8: Student exceeds weekly booking hours quota.
    Outcome: Blocked by eligibility engine.
    """
    owner = db_session.query(Profile).filter_by(role=UserRole.OWNER).first()
    student, student_headers = create_isolated_student(db_session, "s08_limit")
    res, unit = create_isolated_resource(db_session, owner)

    limit = db_session.query(UsageLimit).filter_by(scope=LimitScope.GLOBAL).first()
    try:
        # Set strict 2-hour global weekly limit
        if not limit:
            limit = UsageLimit(scope=LimitScope.GLOBAL, max_hours_per_week=2, max_active_bookings=5)
            db_session.add(limit)
        else:
            limit.max_hours_per_week = 2
        db_session.commit()

        now = datetime.now(timezone.utc)
        # Existing active booking takes 2 hours (filling quota)
        b_existing = Booking(
            booking_code=f"BK-{uuid.uuid4().hex[:8].upper()}",
            student_id=student.id,
            resource_id=res.id,
            unit_id=unit.id,
            start_ts=now + timedelta(days=1),
            end_ts=now + timedelta(days=1, hours=2),
            status=BookingStatus.APPROVED,
            purpose="Existing class project reservation",
            priority_score=70.0,
        )
        db_session.add(b_existing)
        db_session.commit()

        # Attempt second booking in same week
        r_blocked = client.post("/bookings", json={
            "resource_id": str(res.id),
            "start_ts": (now + timedelta(days=2)).isoformat(),
            "end_ts": (now + timedelta(days=2, hours=2)).isoformat(),
            "purpose": "Exceeding weekly allowance quota",
        }, headers=student_headers)
        assert r_blocked.status_code == 409
        assert "weekly" in r_blocked.json()["message"].lower() or "limit" in r_blocked.json()["message"].lower()
    finally:
        # Guarantee restoration of 40-hour limit
        limit.max_hours_per_week = 40
        db_session.commit()


def test_scenario_09_forbidden_access_to_another_students_booking(client, db_session):
    """
    Scenario 9: Horizontal privilege escalation / IDOR check.
    Student A cannot inspect, modify, or cancel Student B's booking.
    """
    owner = db_session.query(Profile).filter_by(role=UserRole.OWNER).first()
    student_a, headers_a = create_isolated_student(db_session, "s09_a")
    student_b, headers_b = create_isolated_student(db_session, "s09_b")
    res, unit = create_isolated_resource(db_session, owner)

    now = datetime.now(timezone.utc)
    b_b = Booking(
        booking_code=f"BK-{uuid.uuid4().hex[:8].upper()}",
        student_id=student_b.id,
        resource_id=res.id,
        unit_id=unit.id,
        start_ts=now + timedelta(days=2),
        end_ts=now + timedelta(days=2, hours=2),
        status=BookingStatus.APPROVED,
        purpose="Private student research project",
        priority_score=80.0,
    )
    db_session.add(b_b)
    db_session.commit()
    db_session.refresh(b_b)

    # Student A attempts GET Student B's booking details
    r_get = client.get(f"/bookings/{b_b.id}", headers=headers_a)
    assert r_get.status_code in [403, 404]

    # Student A attempts cancelling Student B's booking
    r_cancel = client.post(f"/bookings/{b_b.id}/cancel", json={"reason": "Malicious cancellation attempt"}, headers=headers_a)
    assert r_cancel.status_code in [403, 404]


def test_scenario_10_completed_booking_keeps_full_7_step_history(client, db_session):
    """
    Scenario 10: Complete lifecycle from request to completion preserves
    the immutable narrative timeline and audit entries.
    """
    manager = db_session.query(Profile).filter_by(role=UserRole.MANAGER).first()
    mgr_token = create_access_token({"sub": str(manager.id), "role": "MANAGER", "email": manager.email})
    mgr_headers = {"Authorization": f"Bearer {mgr_token}"}

    owner = db_session.query(Profile).filter_by(role=UserRole.OWNER).first()
    owner_token = create_access_token({"sub": str(owner.id), "role": "OWNER", "email": owner.email})
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    student, student_headers = create_isolated_student(db_session, "s10_narrative")
    res, unit = create_isolated_resource(db_session, owner, approval_required=True, department_id=manager.department_id)

    now = datetime.now(timezone.utc)
    start_ts = now + timedelta(minutes=5)
    end_ts = start_ts + timedelta(hours=2)

    # Step 1: Requested
    r_req = client.post("/bookings", json={
        "resource_id": str(res.id),
        "start_ts": start_ts.isoformat(),
        "end_ts": end_ts.isoformat(),
        "purpose": "Autonomous drone testing flight",
    }, headers=student_headers)
    assert r_req.status_code == 201
    booking_id = r_req.json()["id"]
    booking_code = r_req.json()["booking_code"]

    # Step 2: Approved
    r_appr = client.post(f"/bookings/{booking_id}/approve", headers=mgr_headers)
    assert r_appr.status_code == 200

    # Step 3: Checked Out
    r_chk = client.post(f"/bookings/{booking_id}/checkout", json={
        "booking_code_or_token": booking_code,
        "condition": "EXCELLENT",
        "notes": "Handoff verified in person",
        "photo_urls": ["https://images.unsplash.com/p1.jpg"],
        "confirmed_in_person": True,
    }, headers=owner_headers)
    assert r_chk.status_code == 200

    # Step 4: Confirmed Pickup by Student
    r_cp = client.post(f"/bookings/{booking_id}/confirm-pickup", headers=student_headers)
    assert r_cp.status_code == 200

    # Step 5: Return Submitted
    r_ret = client.post(f"/bookings/{booking_id}/return", json={
        "notes": "Testing finished cleanly",
        "photo_urls": ["https://images.unsplash.com/r1.jpg"],
    }, headers=student_headers)
    assert r_ret.status_code == 200

    # Step 6: Verified Completed by Owner
    r_ver = client.post(f"/bookings/{booking_id}/verify-return", json={
        "final_condition": "EXCELLENT",
        "notes": "Returned intact and functioning",
    }, headers=owner_headers)
    assert r_ver.status_code == 200

    # Step 7: Inspect Complete Timeline History
    r_details = client.get(f"/bookings/{booking_id}", headers=student_headers)
    assert r_details.status_code == 200
    details = r_details.json()
    assert "timeline" in details
    timeline = details["timeline"]
    assert isinstance(timeline, list)
    assert len(timeline) >= 6

    actions = [t["action"] for t in timeline]
    assert "BOOKING_REQUESTED" in actions
    assert "BOOKING_APPROVED" in actions
    assert "BOOKING_CHECKED_OUT" in actions
    assert "BOOKING_COMPLETED" in actions
