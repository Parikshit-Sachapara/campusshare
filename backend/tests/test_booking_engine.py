import os
import sys
import uuid
import pytest
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.database import SessionLocal
from app.models import (
    Profile,
    Resource,
    ResourceCategory,
    Department,
    ResourceUnit,
    Booking,
    WaitingList,
    Notification,
    UsageLimit,
    UserRole,
    ResourceStatus,
    BookingStatus,
    WaitlistStatus,
    LimitScope,
)
from app.core.security import create_access_token
from app.services.state_machine import BookingStateMachine
from app.core.exceptions import CampusShareException

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="module")
def db_session():
    session = SessionLocal()
    yield session
    session.close()

def get_auth_headers(email: str, role: str = "STUDENT", user_id: uuid.UUID = None) -> dict:
    session = SessionLocal()
    user = session.query(Profile).filter_by(email=email).first()
    session.close()
    uid = user.id if user else (user_id or uuid.uuid4())
    token = create_access_token({"sub": str(uid), "role": role, "email": email})
    return {"Authorization": f"Bearer {token}"}

def create_fresh_student(db_session, prefix: str = "std") -> tuple:
    """
    Creates an isolated test student with 0 active bookings and fresh limits.
    """
    unique_email = f"{prefix}_{uuid.uuid4().hex[:6]}@campusshare.demo"
    dept = db_session.query(Department).first()
    p = Profile(
        email=unique_email,
        password_hash="dummy_hashed_pw",
        full_name=f"Test Student {prefix}",
        role=UserRole.STUDENT,
        department_id=dept.id,
        student_id=f"STU-{uuid.uuid4().hex[:6].upper()}",
        is_active=True,
        is_verified=True,
    )
    db_session.add(p)
    db_session.commit()
    db_session.refresh(p)
    token = create_access_token({"sub": str(p.id), "role": "STUDENT", "email": p.email})
    return p, {"Authorization": f"Bearer {token}"}

def create_isolated_resource(
    db_session,
    approval_required: bool = False,
    is_restricted: bool = False,
    training_required: bool = False,
) -> Resource:
    """
    Creates an isolated equipment resource with a fresh physical unit
    to eliminate schedule collisions across test runs.
    """
    owner = db_session.query(Profile).filter_by(email="owner@campusshare.demo").first()
    cat = db_session.query(ResourceCategory).first()
    dept = db_session.query(Department).first()

    res = Resource(
        name=f"Iso Test Res {uuid.uuid4().hex[:6]}",
        category_id=cat.id,
        department_id=dept.id,
        owner_id=owner.id,
        location="Lab 101",
        approval_required=approval_required,
        is_restricted=is_restricted,
        training_required=training_required,
        quantity=1,
    )
    db_session.add(res)
    db_session.flush()

    unit = ResourceUnit(
        resource_id=res.id,
        unit_code=f"ISO-{uuid.uuid4().hex[:4].upper()}",
    )
    db_session.add(unit)
    db_session.commit()
    db_session.refresh(res)
    return res


# -------------------------------------------------------------------
# 1. SUCCESSFUL REQUEST & AUTO-APPROVAL
# -------------------------------------------------------------------
def test_successful_booking_request_auto_approval(client, db_session):
    """
    When approval_required=False and is_restricted=False,
    booking must be auto-APPROVED, unit assigned, and priority calculated.
    """
    resource = create_isolated_resource(db_session, approval_required=False, is_restricted=False)
    _, headers = create_fresh_student(db_session, "success_std")

    now = datetime.now(timezone.utc)
    target_date = (now + timedelta(days=3)).date()
    start_ts = datetime(target_date.year, target_date.month, target_date.day, 10, 0, tzinfo=timezone.utc)
    end_ts = start_ts + timedelta(minutes=60)

    res = client.post("/bookings", json={
        "resource_id": str(resource.id),
        "start_ts": start_ts.isoformat(),
        "end_ts": end_ts.isoformat(),
        "attendees": 1,
        "purpose": "Hardware sensor testing for senior capstone research project",
        "project_name": "IoT Campus Sensing",
    }, headers=headers)

    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "APPROVED"
    assert data["booking_code"].startswith("CS-")
    assert data["priority_score"] is not None
    assert data["priority_breakdown"] is not None
    assert "N" in data["priority_breakdown"]
    assert "D" in data["priority_breakdown"]


# -------------------------------------------------------------------
# 2. ELIGIBILITY BLOCK: MISSING TRAINING PREREQUISITE
# -------------------------------------------------------------------
def test_booking_rejected_due_to_missing_training(client, db_session):
    """
    Student 2 is untrained for the DSLR camera kit.
    Request MUST fail with 409 ELIGIBILITY_FAILED and a clear explanation.
    """
    dslr = db_session.query(Resource).filter_by(name="Canon EOS DSLR Camera Kit").first()
    assert dslr is not None
    assert dslr.training_required is True

    headers = get_auth_headers("student2@campusshare.demo", "STUDENT")

    now = datetime.now(timezone.utc)
    target_date = (now + timedelta(days=4)).date()
    start_ts = datetime(target_date.year, target_date.month, target_date.day, 11, 0, tzinfo=timezone.utc)
    end_ts = start_ts + timedelta(minutes=60)

    res = client.post("/bookings", json={
        "resource_id": str(dslr.id),
        "start_ts": start_ts.isoformat(),
        "end_ts": end_ts.isoformat(),
        "attendees": 1,
        "purpose": "Filming campus documentary",
    }, headers=headers)

    assert res.status_code == 409
    data = res.json()
    assert data["code"] == "ELIGIBILITY_FAILED"
    assert "Mandatory" in data["message"] or "Safety" in data["message"]
    # Check details includes suggested slots and checks
    assert "suggested_slots" in data["details"]


# -------------------------------------------------------------------
# 3. CONCURRENT REQUESTS FOR SAME UNIT (RACE CONDITION PREVENTION)
# -------------------------------------------------------------------
def test_two_concurrent_requests_for_same_unit(client, db_session):
    """
    Uses ThreadPoolExecutor to simulate 2 users simultaneously booking
    the exact same unit slot. Exactly ONE must succeed (201) and the other
    must fail with 409 slot conflict.
    """
    # Create an isolated single-unit equipment resource for this race test
    owner = db_session.query(Profile).filter_by(email="owner@campusshare.demo").first()
    cat = db_session.query(ResourceCategory).first()
    dept = db_session.query(Department).first()

    unique_res = Resource(
        name=f"Race Test Oscilloscope {uuid.uuid4().hex[:6]}",
        category_id=cat.id,
        department_id=dept.id,
        owner_id=owner.id,
        location="Lab Bench 7",
        approval_required=False,
        is_restricted=False,
        training_required=False,
        quantity=1,
    )
    db_session.add(unique_res)
    db_session.flush()

    single_unit = ResourceUnit(
        resource_id=unique_res.id,
        unit_code=f"RACE-{uuid.uuid4().hex[:4].upper()}",
    )
    db_session.add(single_unit)
    db_session.commit()

    _, headers1 = create_fresh_student(db_session, "race1")
    _, headers3 = create_fresh_student(db_session, "race2")

    now = datetime.now(timezone.utc)
    target_date = (now + timedelta(days=5)).date()
    start_ts = datetime(target_date.year, target_date.month, target_date.day, 14, 0, tzinfo=timezone.utc)
    end_ts = start_ts + timedelta(minutes=60)

    payload = {
        "resource_id": str(unique_res.id),
        "start_ts": start_ts.isoformat(),
        "end_ts": end_ts.isoformat(),
        "attendees": 1,
        "purpose": "Concurrent contention test run",
    }

    def attempt_booking(headers):
        # Dedicated client instance for thread isolation
        with TestClient(app) as c:
            return c.post("/bookings", json=payload, headers=headers)

    with ThreadPoolExecutor(max_workers=2) as executor:
        future1 = executor.submit(attempt_booking, headers1)
        future2 = executor.submit(attempt_booking, headers3)

        res1 = future1.result()
        res2 = future2.result()

    status_codes = [res1.status_code, res2.status_code]
    assert 201 in status_codes, f"Expected at least one success, got {status_codes}"
    assert 409 in status_codes, f"Expected one 409 conflict, got {status_codes}"


# -------------------------------------------------------------------
# 4. APPROVAL WORKFLOW: STATUS UPDATE & NOTIFICATION
# -------------------------------------------------------------------
def test_approval_updates_status_and_notifies_student(client, db_session):
    """
    Submits a booking requiring approval (PENDING).
    Owner calls POST /bookings/{id}/approve.
    Assert status transitions to APPROVED, unit assigned, student notified.
    """
    owner = db_session.query(Profile).filter_by(email="owner@campusshare.demo").first()
    resource = db_session.query(Resource).filter_by(owner_id=owner.id, approval_required=True, training_required=False).first()

    student, student_headers = create_fresh_student(db_session, "appr_std")
    owner_headers = get_auth_headers("owner@campusshare.demo", "OWNER")

    now = datetime.now(timezone.utc)
    target_date = (now + timedelta(days=6)).date()
    start_ts = datetime(target_date.year, target_date.month, target_date.day, 15, 0, tzinfo=timezone.utc)
    end_ts = start_ts + timedelta(minutes=60)

    # 1. Create Pending Booking
    create_res = client.post("/bookings", json={
        "resource_id": str(resource.id),
        "start_ts": start_ts.isoformat(),
        "end_ts": end_ts.isoformat(),
        "attendees": 1,
        "purpose": "Requires faculty approval for advanced lab work",
    }, headers=student_headers)
    assert create_res.status_code == 201
    booking_id = create_res.json()["id"]
    assert create_res.json()["status"] == "PENDING"

    # 2. Owner Approves Booking
    approve_res = client.post(f"/bookings/{booking_id}/approve", headers=owner_headers)
    assert approve_res.status_code == 200
    approved_data = approve_res.json()
    assert approved_data["status"] == "APPROVED"
    assert approved_data["approved_at"] is not None

    # 3. Verify Notification dispatched to student
    notif = db_session.query(Notification).filter_by(
        user_id=student.id,
        type="BOOKING_APPROVED"
    ).order_by(Notification.created_at.desc()).first()
    assert notif is not None
    assert "approved" in notif.body.lower()


# -------------------------------------------------------------------
# 5. USAGE LIMITS EXCEEDED
# -------------------------------------------------------------------
def test_usage_limit_exceeded_blocks_booking(client, db_session):
    """
    Configures an ultra-strict limit (max_active_bookings=0)
    and verifies that booking is blocked with institutional limit explanation.
    """
    student = db_session.query(Profile).filter_by(email="student1@campusshare.demo").first()
    resource = db_session.query(Resource).filter_by(training_required=False).first()

    # Create temporary strict resource-level limit
    strict_limit = UsageLimit(
        scope=LimitScope.RESOURCE,
        scope_id=resource.id,
        max_active_bookings=0, # Immediately blocks!
        max_bookings_per_week=1,
        max_hours_per_week=1,
    )
    db_session.add(strict_limit)
    db_session.commit()

    try:
        headers = get_auth_headers("student1@campusshare.demo", "STUDENT")
        now = datetime.now(timezone.utc)
        target_date = (now + timedelta(days=2)).date()
        start_ts = datetime(target_date.year, target_date.month, target_date.day, 12, 0, tzinfo=timezone.utc)
        end_ts = start_ts + timedelta(minutes=60)

        res = client.post("/bookings", json={
            "resource_id": str(resource.id),
            "start_ts": start_ts.isoformat(),
            "end_ts": end_ts.isoformat(),
            "attendees": 1,
            "purpose": "Testing usage limit constraint enforcement",
        }, headers=headers)

        assert res.status_code == 409
        data = res.json()
        assert data["code"] == "ELIGIBILITY_FAILED"
        assert "maximum allowed active bookings" in data["message"].lower()

    finally:
        db_session.delete(strict_limit)
        db_session.commit()


# -------------------------------------------------------------------
# 6. INVALID STATE TRANSITION: REJECTED -> CHECKED_OUT
# -------------------------------------------------------------------
def test_invalid_status_transition_rejected_to_checked_out(db_session):
    """
    Directly tests BookingStateMachine: transitioning from REJECTED to CHECKED_OUT
    must raise CampusShareException with 409.
    """
    booking = Booking(
        booking_code="CS-TEST-STATE",
        student_id=uuid.uuid4(),
        resource_id=uuid.uuid4(),
        start_ts=datetime.now(timezone.utc),
        end_ts=datetime.now(timezone.utc) + timedelta(hours=1),
        purpose="State machine test",
        status=BookingStatus.REJECTED,
        version=1,
    )

    with pytest.raises(CampusShareException) as exc_info:
        BookingStateMachine.transition(booking, BookingStatus.CHECKED_OUT)

    assert exc_info.value.status_code == 409
    assert exc_info.value.code == "INVALID_STATUS_TRANSITION"
    assert "Illegal state transition" in exc_info.value.message


# -------------------------------------------------------------------
# 7. CANCELLATION TRIGGERS WAITING LIST REDISTRIBUTION OFFER
# -------------------------------------------------------------------
def test_cancellation_triggers_waitlist_offer(client, db_session):
    """
    1. Student 1 books a slot.
    2. Student 3 joins the waitlist for that exact slot.
    3. Student 1 cancels the booking.
    4. Assert waitlist entry for Student 3 moves to OFFERED with expiry.
    """
    resource = create_isolated_resource(db_session, approval_required=False, is_restricted=False)

    _, s1_headers = create_fresh_student(db_session, "cancel1")
    s3_student, s3_headers = create_fresh_student(db_session, "cancel2")

    now = datetime.now(timezone.utc)
    target_date = (now + timedelta(days=3)).date()
    start_ts = datetime(target_date.year, target_date.month, target_date.day, 13, 0, tzinfo=timezone.utc)
    end_ts = start_ts + timedelta(minutes=60)

    # 1. Student 1 creates booking
    b_res = client.post("/bookings", json={
        "resource_id": str(resource.id),
        "start_ts": start_ts.isoformat(),
        "end_ts": end_ts.isoformat(),
        "attendees": 1,
        "purpose": "Initial slot reservation before cancellation test",
    }, headers=s1_headers)
    assert b_res.status_code == 201
    booking_id = b_res.json()["id"]

    # 2. Student 3 joins waitlist
    w_res = client.post("/waitlist", json={
        "resource_id": str(resource.id),
        "desired_start_ts": start_ts.isoformat(),
        "desired_end_ts": end_ts.isoformat(),
    }, headers=s3_headers)
    assert w_res.status_code == 201
    waitlist_id = w_res.json()["id"]

    # 3. Student 1 cancels booking
    cancel_res = client.post(f"/bookings/{booking_id}/cancel", json={
        "reason": "Change of schedule",
    }, headers=s1_headers)
    assert cancel_res.status_code == 200

    # 4. Verify waitlist entry was offered to Student 3
    db_session.expire_all()
    w_entry = db_session.query(WaitingList).filter_by(id=uuid.UUID(waitlist_id)).first()
    assert w_entry.status == WaitlistStatus.OFFERED
    assert w_entry.offer_expires_at is not None
    assert w_entry.offered_at is not None


# -------------------------------------------------------------------
# 8. UNAUTHORIZED ACCESS PREVENTED
# -------------------------------------------------------------------
def test_unauthorized_access_prevented(client, db_session):
    """
    1. Student role cannot access /approvals/queue -> 403 Forbidden.
    2. Student cannot approve a booking -> 403 Forbidden.
    3. Student cannot cancel another student's booking -> 403 Forbidden.
    """
    s1_headers = get_auth_headers("student1@campusshare.demo", "STUDENT")
    s2_headers = get_auth_headers("student2@campusshare.demo", "STUDENT")

    # 1. Student accessing queue
    queue_res = client.get("/approvals/queue", headers=s1_headers)
    assert queue_res.status_code == 403
    assert queue_res.json()["code"] == "FORBIDDEN_ROLE"

    # 2. Student attempting to approve
    random_id = uuid.uuid4()
    appr_res = client.post(f"/bookings/{random_id}/approve", headers=s1_headers)
    assert appr_res.status_code == 403
    assert appr_res.json()["code"] == "FORBIDDEN_ROLE"

    # 3. Student 2 attempting to cancel Student 1's booking
    s1 = db_session.query(Profile).filter_by(email="student1@campusshare.demo").first()
    b = db_session.query(Booking).filter_by(student_id=s1.id).first()
    if b:
        cancel_res = client.post(f"/bookings/{b.id}/cancel", headers=s2_headers)
        assert cancel_res.status_code == 403
        assert cancel_res.json()["code"] == "FORBIDDEN_CANCEL"


# -------------------------------------------------------------------
# 9. DRY RUN VALIDATION ENDPOINT
# -------------------------------------------------------------------
def test_dry_run_validation_endpoint(client, db_session):
    """
    POST /bookings/validate must return structured eligibility and priority preview
    without writing any booking record to the database.
    """
    resource = db_session.query(Resource).filter_by(training_required=False).first()
    headers = get_auth_headers("student1@campusshare.demo", "STUDENT")

    now = datetime.now(timezone.utc)
    target_date = (now + timedelta(days=2)).date()
    start_ts = datetime(target_date.year, target_date.month, target_date.day, 9, 0, tzinfo=timezone.utc)
    end_ts = start_ts + timedelta(minutes=60)

    initial_count = db_session.query(Booking).count()

    res = client.post("/bookings/validate", json={
        "resource_id": str(resource.id),
        "start_ts": start_ts.isoformat(),
        "end_ts": end_ts.isoformat(),
        "attendees": 1,
        "purpose": "Validation dry run test preview",
    }, headers=headers)

    assert res.status_code == 200
    data = res.json()
    assert "eligible" in data
    assert "checks" in data
    assert len(data["checks"]) == 14
    assert "priority_preview" in data

    # Verify no record written
    db_session.expire_all()
    assert db_session.query(Booking).count() == initial_count


# -------------------------------------------------------------------
# 10. FAIRNESS PROFILE & ADMIN WEIGHTS MANAGEMENT
# -------------------------------------------------------------------
def test_fairness_profile_and_admin_weights(client, db_session):
    """
    GET /fairness/me returns user metrics and formula explanation.
    Admin updates priority weights with validation (must sum to 100).
    """
    student_headers = get_auth_headers("student1@campusshare.demo", "STUDENT")
    admin_headers = get_auth_headers("admin@campusshare.demo", "ADMIN")

    # 1. Student fairness profile
    f_res = client.get("/fairness/me", headers=student_headers)
    assert f_res.status_code == 200
    f_data = f_res.json()
    assert "standing_score" in f_data
    assert "current_weights" in f_data
    assert "formula_explanation" in f_data

    # 2. Admin invalid weights (sum != 100)
    bad_res = client.put("/admin/fairness/weights", json={
        "wN": 50.0,
        "wD": 50.0,
        "wE": 50.0,
        "wA": 50.0,
    }, headers=admin_headers)
    assert bad_res.status_code == 422
    assert bad_res.json()["code"] == "INVALID_WEIGHTS_SUM"

    # 3. Admin valid weights (sum == 100)
    good_res = client.put("/admin/fairness/weights", json={
        "wN": 35.0,
        "wD": 35.0,
        "wE": 20.0,
        "wA": 10.0,
    }, headers=admin_headers)
    assert good_res.status_code == 200
    assert good_res.json()["wN"] == 35.0
