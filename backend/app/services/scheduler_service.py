import logging
from typing import Optional
from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from ..database import SessionLocal
from ..models import Booking, WaitingList, Profile
from ..models.enums import BookingStatus, WaitlistStatus
from ..core.audit import audit
from ..core.notify import notify
from .state_machine import BookingStateMachine
from .booking_service import BookingService

logger = logging.getLogger("campusshare.scheduler")

scheduler: Optional[BackgroundScheduler] = None

def run_scheduler_tasks():
    """
    Executes in-process background maintenance tasks across bookings and waiting lists.
    """
    db = SessionLocal()
    now = datetime.now(timezone.utc)

    try:
        # -------------------------------------------------------------
        # 1. Expire Waiting List Offers & Re-distribute to Next in Queue
        # -------------------------------------------------------------
        expired_offers = db.query(WaitingList).filter(
            WaitingList.status == WaitlistStatus.OFFERED,
            WaitingList.offer_expires_at <= now,
        ).all()

        for exp in expired_offers:
            exp.status = WaitlistStatus.EXPIRED
            audit(
                db=db,
                actor_id=None,
                actor_role="SYSTEM",
                action="WAITLIST_OFFER_EXPIRED",
                entity_type="WaitingList",
                entity_id=str(exp.id),
                resource_id=exp.resource_id,
            )
            # Notify student that offer expired
            notify(
                db=db,
                user_id=exp.student_id,
                type="WAITLIST_OFFER_EXPIRED",
                title="Slot Offer Expired",
                body=f"Your priority reservation offer for {exp.resource.name} has expired.",
                link=f"/waitlist/{exp.id}",
            )
            db.flush()

            # Offer to next student in queue
            BookingService.redistribute_freed_slot(
                db=db,
                resource_id=exp.resource_id,
                freed_start_ts=exp.desired_start_ts,
                freed_end_ts=exp.desired_end_ts,
            )

        # -------------------------------------------------------------
        # 2. Detect No-Shows (Approved bookings uncollected after 30 min)
        # -------------------------------------------------------------
        no_show_cutoff = now - timedelta(minutes=30)
        uncollected_bookings = db.query(Booking).filter(
            Booking.status == BookingStatus.APPROVED,
            Booking.start_ts <= no_show_cutoff,
            Booking.collected_at == None,
        ).all()

        for b in uncollected_bookings:
            # Transition to CANCELLED via state machine
            BookingStateMachine.transition(b, BookingStatus.CANCELLED)
            b.cancellation_reason = "System recorded No-Show: Resource uncollected 30 minutes after booking start."

            # Increment student's no-show penalty count
            student = db.query(Profile).filter_by(id=b.student_id).first()
            if student:
                student.no_show_count = (student.no_show_count or 0) + 1

            audit(
                db=db,
                actor_id=None,
                actor_role="SYSTEM",
                action="NO_SHOW_DETECTED",
                entity_type="Booking",
                entity_id=str(b.id),
                resource_id=b.resource_id,
                booking_id=b.id,
                metadata={"new_no_show_count": student.no_show_count if student else None},
            )

            notify(
                db=db,
                user_id=b.student_id,
                type="NO_SHOW_RECORDED",
                title="No-Show Recorded",
                body=f"Booking {b.booking_code} was marked as No-Show. A penalty has been recorded on your account.",
                link=f"/bookings/{b.id}",
            )

            # Trigger waitlist redistribution for freed slot
            BookingService.redistribute_freed_slot(
                db=db,
                resource_id=b.resource_id,
                freed_start_ts=b.start_ts,
                freed_end_ts=b.end_ts,
            )

        # -------------------------------------------------------------
        # 3. Detect Overdue Checkouts (Checked-out past end_ts)
        # -------------------------------------------------------------
        overdue_bookings = db.query(Booking).filter(
            Booking.status == BookingStatus.CHECKED_OUT,
            Booking.end_ts < now,
        ).all()

        for ob in overdue_bookings:
            BookingStateMachine.transition(ob, BookingStatus.OVERDUE)

            audit(
                db=db,
                actor_id=None,
                actor_role="SYSTEM",
                action="BOOKING_OVERDUE",
                entity_type="Booking",
                entity_id=str(ob.id),
                resource_id=ob.resource_id,
                booking_id=ob.id,
            )

            notify(
                db=db,
                user_id=ob.student_id,
                type="OVERDUE_ALERT",
                title="URGENT: Resource Return Overdue",
                body=f"Your booking for '{ob.resource.name}' is overdue! Please return immediately to the lab.",
                link=f"/bookings/{ob.id}",
            )

            if ob.resource and ob.resource.owner_id:
                notify(
                    db=db,
                    user_id=ob.resource.owner_id,
                    type="RESOURCE_OVERDUE",
                    title="Resource Return Overdue",
                    body=f"{ob.student.full_name} is overdue returning '{ob.resource.name}'. Pass: {ob.booking_code}.",
                    link=f"/bookings/{ob.id}",
                )

        # Commit all scheduler batch updates
        db.commit()

    except Exception as e:
        db.rollback()
        logger.error(f"Error during scheduler job run: {e}", exc_info=True)
    finally:
        db.close()


def start_scheduler():
    """
    Initializes and starts the APScheduler background worker.
    """
    global scheduler
    if scheduler is None:
        scheduler = BackgroundScheduler(daemon=True)
        scheduler.add_job(
            run_scheduler_tasks,
            trigger=IntervalTrigger(seconds=60),
            id="campusshare_maintenance_job",
            name="CampusShare In-Process Maintenance Worker",
            replace_existing=True,
        )
        scheduler.start()
        logger.info("✓ In-process APScheduler background engine started (interval: 60s).")


def shutdown_scheduler():
    global scheduler
    if scheduler and scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("✓ In-process APScheduler stopped.")
