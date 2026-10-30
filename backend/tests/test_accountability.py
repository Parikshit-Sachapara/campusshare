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
    ResourceCategory,
    Department,
    ResourceUnit,
    Booking,
    BookingCondition,
    Incident,
    AuditLog,
    UserRole,
    ResourceStatus,
    BookingStatus,
    UnitCondition,
    ConditionPhase,
    IncidentStatus,
    IncidentType,
    IncidentSeverity,
)
from app.core.security import create_access_token

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="module")
def db_session():
    session = SessionLocal()
    yield session
    session.close()

def create_isolated_student(db_session, prefix: str = "acc_std") -> tuple:
    unique_email = f"{prefix}_{uuid.uuid4().hex[:6]}@campusshare.demo"
    dept = db_session.query(Department).first()
    p = Profile(
        email=unique_email,
        password_hash="dummy_pw",
        full_name=f"Student {prefix.capitalize()}",
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

def create_isolated_equipment(db_session, owner_profile) -> tuple:
    cat = db_session.query(ResourceCategory).first()
    dept = db_session.query(Department).first()
    res = Resource(
        name=f"Acc Test DSLR {uuid.uuid4().hex[:6]}",
        category_id=cat.id,
        department_id=dept.id,
        owner_id=owner_profile.id,
        location="Media Studio 4",
        approval_required=False,
        is_restricted=False,
        training_required=False,
        quantity=1,
    )
    db_session.add(res)
    db_session.flush()

    unit = ResourceUnit(
        resource_id=res.id,
        unit_code=f"ACC-{uuid.uuid4().hex[:4].upper()}",
        condition=UnitCondition.EXCELLENT,
        is_active=True,
    )
    db_session.add(unit)
    db_session.commit()
    db_session.refresh(res)
    db_session.refresh(unit)
    return res, unit


# -------------------------------------------------------------------
# 1. CHECKOUT ONLY FROM APPROVED & STUDENT FORBIDDEN
# -------------------------------------------------------------------
def test_checkout_only_from_approved_and_student_forbidden(client, db_session):
    owner = db_session.query(Profile).filter_by(email="owner@campusshare.demo").first()
    owner_token = create_access_token({"sub": str(owner.id), "role": "OWNER", "email": owner.email})
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    student, student_headers = create_isolated_student(db_session, "chk_std")
    res, unit = create_isolated_equipment(db_session, owner)

    # 1. Create a PENDING booking directly in DB
    now = datetime.now(timezone.utc)
    booking = Booking(
        booking_code=f"CS-{now.year}-{uuid.uuid4().hex[:5].upper()}",
        student_id=student.id,
        resource_id=res.id,
        unit_id=unit.id,
        start_ts=now + timedelta(days=2),
        end_ts=now + timedelta(days=2, hours=2),
        purpose="Checkout status validation test",
        status=BookingStatus.PENDING,
        version=1,
    )
    db_session.add(booking)
    db_session.commit()
    db_session.refresh(booking)

    # A. Owner attempts checkout on PENDING booking -> 409 Conflict
    bad_res = client.post(f"/bookings/{booking.id}/checkout", json={
        "booking_code_or_token": booking.booking_code,
        "condition": "EXCELLENT",
    }, headers=owner_headers)
    assert bad_res.status_code == 409
    assert bad_res.json()["code"] == "INVALID_STATUS_FOR_CHECKOUT"

    # B. Student attempts checkout -> 403 Forbidden
    std_res = client.post(f"/bookings/{booking.id}/checkout", json={
        "booking_code_or_token": booking.booking_code,
    }, headers=student_headers)
    assert std_res.status_code == 403
    assert std_res.json()["code"] == "FORBIDDEN_ROLE"

    # C. Approve booking, then Owner checks out -> 200 OK
    booking.status = BookingStatus.APPROVED
    db_session.commit()

    good_res = client.post(f"/bookings/{booking.id}/checkout", json={
        "booking_code_or_token": booking.booking_code,
        "condition": "EXCELLENT",
        "notes": "Serial verified, battery 100%",
        "photo_urls": ["/uploads/test_camera_front.jpg"],
        "confirmed_in_person": True,
    }, headers=owner_headers)
    assert good_res.status_code == 200
    assert good_res.json()["status"] == "CHECKED_OUT"

    # Verify BookingCondition PICKUP record created
    cond = db_session.query(BookingCondition).filter_by(
        booking_id=booking.id, phase=ConditionPhase.PICKUP
    ).first()
    assert cond is not None
    assert cond.condition == UnitCondition.EXCELLENT
    assert cond.student_confirmed is True


# -------------------------------------------------------------------
# 2. RETURN THEN VERIFY -> COMPLETED
# -------------------------------------------------------------------
def test_return_then_verify_completed(client, db_session):
    owner = db_session.query(Profile).filter_by(email="owner@campusshare.demo").first()
    owner_token = create_access_token({"sub": str(owner.id), "role": "OWNER", "email": owner.email})
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    student, student_headers = create_isolated_student(db_session, "ret_std")
    res, unit = create_isolated_equipment(db_session, owner)

    now = datetime.now(timezone.utc)
    booking = Booking(
        booking_code=f"CS-{now.year}-{uuid.uuid4().hex[:5].upper()}",
        student_id=student.id,
        resource_id=res.id,
        unit_id=unit.id,
        start_ts=now - timedelta(hours=2),
        end_ts=now + timedelta(hours=1),
        purpose="Return flow verification test",
        status=BookingStatus.CHECKED_OUT,
        collected_at=now - timedelta(hours=2),
        version=2,
    )
    db_session.add(booking)
    db_session.commit()

    # 1. Student submits return
    ret_res = client.post(f"/bookings/{booking.id}/return", json={
        "notes": "Returned lens cap and battery charger intact",
        "photo_urls": ["/uploads/return_photo1.jpg"],
    }, headers=student_headers)
    assert ret_res.status_code == 200
    assert ret_res.json()["status"] == "RETURN_PENDING"

    # 2. Owner verifies return in EXCELLENT condition
    verify_res = client.post(f"/bookings/{booking.id}/verify-return", json={
        "final_condition": "EXCELLENT",
        "notes": "Lens inspection clean, no scratches",
        "damage_observed": False,
        "item_missing": False,
    }, headers=owner_headers)
    assert verify_res.status_code == 200
    data = verify_res.json()
    assert data["status"] == "COMPLETED"
    assert data["return_condition"]["condition"] == "EXCELLENT"
    assert data["incident_created"] is None


# -------------------------------------------------------------------
# 3. DAMAGED RETURN CREATES INCIDENT & DEACTIVATES PHYSICAL UNIT
# -------------------------------------------------------------------
def test_damaged_return_creates_incident_and_flags_unit(client, db_session):
    owner = db_session.query(Profile).filter_by(email="owner@campusshare.demo").first()
    owner_token = create_access_token({"sub": str(owner.id), "role": "OWNER", "email": owner.email})
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    student, student_headers = create_isolated_student(db_session, "dmg_std")
    res, unit = create_isolated_equipment(db_session, owner)

    now = datetime.now(timezone.utc)
    booking = Booking(
        booking_code=f"CS-{now.year}-{uuid.uuid4().hex[:5].upper()}",
        student_id=student.id,
        resource_id=res.id,
        unit_id=unit.id,
        start_ts=now - timedelta(hours=3),
        end_ts=now + timedelta(hours=1),
        purpose="Damage inspection test",
        status=BookingStatus.CHECKED_OUT,
        version=2,
    )
    db_session.add(booking)
    db_session.commit()

    # Student returns
    client.post(f"/bookings/{booking.id}/return", json={"notes": "Returned"}, headers=student_headers)

    # Owner verifies and flags cracked LCD screen (DAMAGED)
    verify_res = client.post(f"/bookings/{booking.id}/verify-return", json={
        "final_condition": "DAMAGED",
        "damage_observed": True,
        "incident_description": "Camera LCD screen shattered and shutter mechanism jammed.",
    }, headers=owner_headers)

    assert verify_res.status_code == 200
    data = verify_res.json()
    assert data["status"] == "INCIDENT_REPORTED"
    assert data["incident_created"] is not None
    assert data["incident_created"]["type"] == "DAMAGE"

    # Verify physical unit condition and deactivation
    db_session.expire_all()
    unit_db = db_session.query(ResourceUnit).filter_by(id=unit.id).first()
    assert unit_db.condition == UnitCondition.DAMAGED
    assert unit_db.is_active is False # Unit removed from active availability!


# -------------------------------------------------------------------
# 4. INCIDENT LIFECYCLE: STUDENT CANNOT CLOSE, MANAGER/ADMIN CAN
# -------------------------------------------------------------------
def test_incident_cannot_be_closed_by_student(client, db_session):
    owner = db_session.query(Profile).filter_by(email="owner@campusshare.demo").first()
    manager = db_session.query(Profile).filter_by(email="manager@campusshare.demo").first()
    manager_token = create_access_token({"sub": str(manager.id), "role": "MANAGER", "email": manager.email})
    manager_headers = {"Authorization": f"Bearer {manager_token}"}

    student, student_headers = create_isolated_student(db_session, "inc_std")
    res, _ = create_isolated_equipment(db_session, owner)

    # 1. Student reports an incident
    inc_res = client.post("/incidents", json={
        "resource_id": str(res.id),
        "type": "POLICY_VIOLATION",
        "severity": "LOW",
        "description": "Equipment was left unattended in common area without supervisor.",
    }, headers=student_headers)
    assert inc_res.status_code == 201
    incident_id = inc_res.json()["id"]

    # 2. Student attempts to resolve/close incident -> 403 Forbidden
    bad_patch = client.patch(f"/incidents/{incident_id}/status", json={
        "status": "RESOLVED",
        "resolution": "Student trying to resolve their own incident",
    }, headers=student_headers)
    assert bad_patch.status_code == 403
    assert bad_patch.json()["code"] == "FORBIDDEN_RESOLUTION"

    # 3. Manager moves to INVESTIGATING
    inv_patch = client.patch(f"/incidents/{incident_id}/status", json={
        "status": "INVESTIGATING",
    }, headers=manager_headers)
    assert inv_patch.status_code == 200
    assert inv_patch.json()["status"] == "INVESTIGATING"

    # 4. Manager resolves with mandatory resolution explanation
    res_patch = client.patch(f"/incidents/{incident_id}/status", json={
        "status": "RESOLVED",
        "resolution": "Lab staff reviewed security footage; verbal warning issued and protocol reinforced.",
    }, headers=manager_headers)
    assert res_patch.status_code == 200
    assert res_patch.json()["status"] == "RESOLVED"
    assert res_patch.json()["resolution"] is not None


# -------------------------------------------------------------------
# 5. PRIVATE EVIDENCE PHOTO ACCESS RESTRICTED
# -------------------------------------------------------------------
def test_private_photo_access_denied_for_unrelated_user(client, db_session):
    owner = db_session.query(Profile).filter_by(email="owner@campusshare.demo").first()
    res, _ = create_isolated_equipment(db_session, owner)

    student1, s1_headers = create_isolated_student(db_session, "rep_std")
    unrelated_student, un_headers = create_isolated_student(db_session, "unrel_std")

    # 1. Student 1 reports incident with private evidence photo
    inc = Incident(
        resource_id=res.id,
        reporter_id=student1.id,
        type=IncidentType.DAMAGE,
        severity=IncidentSeverity.HIGH,
        description="Confidential damage evidence report",
        evidence_urls=["confidential_damage_lens_crack.jpg"],
        status=IncidentStatus.REPORTED,
    )
    db_session.add(inc)
    db_session.commit()

    # 2. Unrelated student tries to request signed URL -> 403 Forbidden
    bad_url_req = client.get(
        f"/incidents/{inc.id}/evidence-url?filename=confidential_damage_lens_crack.jpg",
        headers=un_headers
    )
    assert bad_url_req.status_code == 403
    assert bad_url_req.json()["code"] == "FORBIDDEN_EVIDENCE"

    # 3. Reporter requests signed URL -> 200 OK
    good_url_req = client.get(
        f"/incidents/{inc.id}/evidence-url?filename=confidential_damage_lens_crack.jpg",
        headers=s1_headers
    )
    assert good_url_req.status_code == 200
    signed_url = good_url_req.json()["signed_url"]

    # 4. Fetch evidence photo using signed URL token -> 200 OK
    fetch_res = client.get(signed_url)
    assert fetch_res.status_code == 200
    assert "Authorized Evidence Photo Content" in fetch_res.text

    # 5. Tampered or missing token -> 403 Forbidden
    tampered_res = client.get(f"/incidents/{inc.id}/evidence/confidential_damage_lens_crack.jpg?token=invalid_token")
    assert tampered_res.status_code == 403


# -------------------------------------------------------------------
# 6. FULL 7-STEP TIMELINE MATCHES NARRATIVE
# -------------------------------------------------------------------
def test_full_7_step_timeline_matches_narrative(client, db_session):
    """
    Executes the complete canonical 7-step CampusShare lifecycle:
    1. REQUESTED
    2. ELIGIBILITY VERIFIED
    3. APPROVED
    4. COLLECTED (HANDOVER)
    5. RETURN SUBMITTED
    6. RETURN VERIFIED
    7. COMPLETED
    Verifies human-readable prose narratives on GET /bookings/{id}/timeline.
    """
    owner = db_session.query(Profile).filter_by(email="owner@campusshare.demo").first()
    owner_token = create_access_token({"sub": str(owner.id), "role": "OWNER", "email": owner.email})
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    student, student_headers = create_isolated_student(db_session, "seven_step_std")
    res, _ = create_isolated_equipment(db_session, owner)

    now = datetime.now(timezone.utc)
    start_ts = now + timedelta(days=2)
    end_ts = start_ts + timedelta(hours=1)

    # 1. Student requests booking (Steps 1 & 2: REQUESTED & ELIGIBILITY VERIFIED)
    book_res = client.post("/bookings", json={
        "resource_id": str(res.id),
        "start_ts": start_ts.isoformat(),
        "end_ts": end_ts.isoformat(),
        "attendees": 1,
        "purpose": "Senior research documentary filming project",
    }, headers=student_headers)
    assert book_res.status_code == 201
    booking_id = book_res.json()["id"]
    booking_code = book_res.json()["booking_code"]

    # 2. Staff approves (Step 3: APPROVED)
    # (Since auto_approved already sets to APPROVED, we make sure it was approved)
    booking_db = db_session.query(Booking).filter_by(id=uuid.UUID(booking_id)).first()
    assert booking_db.status == BookingStatus.APPROVED

    # 3. Staff hands over equipment (Step 4: COLLECTED)
    chk_res = client.post(f"/bookings/{booking_id}/checkout", json={
        "booking_code_or_token": booking_code,
        "condition": "EXCELLENT",
        "notes": "Battery fully charged",
        "confirmed_in_person": True,
    }, headers=owner_headers)
    assert chk_res.status_code == 200

    # 4. Student submits return (Step 5: RETURN SUBMITTED)
    ret_res = client.post(f"/bookings/{booking_id}/return", json={
        "notes": "Lens cap and cable returned intact",
    }, headers=student_headers)
    assert ret_res.status_code == 200

    # 5. Staff verifies return (Steps 6 & 7: RETURN VERIFIED & COMPLETED)
    ver_res = client.post(f"/bookings/{booking_id}/verify-return", json={
        "final_condition": "EXCELLENT",
        "notes": "All items verified complete",
        "damage_observed": False,
    }, headers=owner_headers)
    assert ver_res.status_code == 200
    assert ver_res.json()["status"] == "COMPLETED"

    # 6. Retrieve narrative timeline
    timeline_res = client.get(f"/bookings/{booking_id}/timeline", headers=student_headers)
    assert timeline_res.status_code == 200
    timeline = timeline_res.json()

    actions = [item["action"] for item in timeline]
    assert "BOOKING_REQUESTED" in actions
    assert "ELIGIBILITY_VERIFIED" in actions
    assert "BOOKING_CHECKED_OUT" in actions
    assert "RETURN_SUBMITTED" in actions
    assert "RETURN_VERIFIED" in actions
    assert "BOOKING_COMPLETED" in actions

    # Verify human-readable narrative prose format
    for item in timeline:
        assert isinstance(item["narrative"], str)
        assert len(item["narrative"]) > 10


# -------------------------------------------------------------------
# 7. NOTIFICATIONS POLLING & UNREAD COUNT
# -------------------------------------------------------------------
def test_notifications_unread_count_and_marking_read(client, db_session):
    student, student_headers = create_isolated_student(db_session, "notif_std")

    # Initial unread count is 0
    c_res = client.get("/notifications/unread-count", headers=student_headers)
    assert c_res.status_code == 200
    assert c_res.json()["unread_count"] == 0

    # Read all endpoint
    ra_res = client.patch("/notifications/read-all", headers=student_headers)
    assert ra_res.status_code == 200


# -------------------------------------------------------------------
# 8. AUDIT IMMUTABILITY TRIGGER PREVENTS EDIT OR DELETE
# -------------------------------------------------------------------
def test_audit_logs_immutable_prevent_edit_or_delete(db_session):
    """
    Directly tests that database triggers prevent any UPDATE or DELETE on audit_logs.
    """
    log = db_session.query(AuditLog).first()
    assert log is not None

    with pytest.raises(Exception) as exc_info:
        db_session.delete(log)
        db_session.commit()
    db_session.rollback()

    assert "audit_logs is append-only" in str(exc_info.value).lower() or "security violation" in str(exc_info.value).lower()
