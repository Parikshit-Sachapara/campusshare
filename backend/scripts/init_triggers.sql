-- ====================================================================
-- CampusShare Database Triggers, Extensions, and Exclusion Constraints
-- ====================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Exclusion Constraint: Overlap Prevention on Assigned Physical Units
-- Only blocks overlapping slots if the booking status is one of the active/reserved states
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'exclude_overlapping_unit_bookings'
    ) THEN
        ALTER TABLE bookings
        ADD CONSTRAINT exclude_overlapping_unit_bookings
        EXCLUDE USING gist (
            unit_id WITH =,
            tstzrange(start_ts, end_ts, '[)') WITH &&
        )
        WHERE (
            status IN ('APPROVED', 'CHECKED_OUT', 'RETURN_PENDING', 'OVERDUE', 'INCIDENT_REPORTED')
            AND unit_id IS NOT NULL
        );
    END IF;
END $$;

-- 3. Append-Only Trigger on audit_logs
CREATE OR REPLACE FUNCTION audit_logs_immutable_check()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'SECURITY VIOLATION: audit_logs is append-only. UPDATE and DELETE operations are strictly forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_audit_logs_append_only ON audit_logs;
CREATE TRIGGER trigger_audit_logs_append_only
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable_check();

-- 4. Status Transition State Machine Guard Trigger on bookings
CREATE OR REPLACE FUNCTION booking_status_transition_guard()
RETURNS TRIGGER AS $$
BEGIN
    -- If status hasn't changed, allow update
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Strict allowable status transitions
    IF OLD.status = 'PENDING' AND NEW.status IN ('APPROVED', 'REJECTED', 'WAITLISTED', 'CANCELLED') THEN
        RETURN NEW;
    ELSIF OLD.status = 'WAITLISTED' AND NEW.status IN ('PENDING', 'APPROVED', 'CANCELLED') THEN
        RETURN NEW;
    ELSIF OLD.status = 'APPROVED' AND NEW.status IN ('CHECKED_OUT', 'CANCELLED') THEN
        RETURN NEW;
    ELSIF OLD.status = 'CHECKED_OUT' AND NEW.status IN ('RETURN_PENDING', 'OVERDUE', 'INCIDENT_REPORTED') THEN
        RETURN NEW;
    ELSIF OLD.status = 'OVERDUE' AND NEW.status IN ('RETURN_PENDING', 'INCIDENT_REPORTED') THEN
        RETURN NEW;
    ELSIF OLD.status = 'RETURN_PENDING' AND NEW.status IN ('COMPLETED', 'INCIDENT_REPORTED') THEN
        RETURN NEW;
    ELSIF OLD.status = 'INCIDENT_REPORTED' AND NEW.status = 'COMPLETED' THEN
        RETURN NEW;
    ELSE
        RAISE EXCEPTION 'ILLEGAL STATUS TRANSITION: Cannot transition booking % from % to %',
            OLD.id, OLD.status, NEW.status;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_booking_status_guard ON bookings;
CREATE TRIGGER trigger_booking_status_guard
BEFORE UPDATE OF status ON bookings
FOR EACH ROW EXECUTE FUNCTION booking_status_transition_guard();

-- 5. Trigram GIN Search Index on Resources
CREATE INDEX IF NOT EXISTS idx_resources_name_desc_trgm 
ON resources USING gin ((name || ' ' || coalesce(description, '')) gin_trgm_ops);

-- 6. Facility Capacity Validation Stored Function
CREATE OR REPLACE FUNCTION check_facility_capacity(
    p_resource_id UUID,
    p_start_ts TIMESTAMPTZ,
    p_end_ts TIMESTAMPTZ,
    p_attendees INT
) RETURNS BOOLEAN AS $$
DECLARE
    v_capacity INT;
    v_current_attendees INT;
    v_res_type VARCHAR(50);
BEGIN
    -- Lock resource row for update to prevent concurrent race conditions
    SELECT resource_type, capacity INTO v_res_type, v_capacity
    FROM resources
    WHERE id = p_resource_id
    FOR UPDATE;

    IF v_res_type != 'FACILITY' THEN
        RETURN TRUE;
    END IF;

    IF v_capacity IS NULL OR v_capacity <= 0 THEN
        RETURN TRUE;
    END IF;

    -- Sum attendees of overlapping approved/active bookings
    SELECT COALESCE(SUM(attendees), 0) INTO v_current_attendees
    FROM bookings
    WHERE resource_id = p_resource_id
      AND status IN ('APPROVED', 'CHECKED_OUT', 'RETURN_PENDING')
      AND tstzrange(start_ts, end_ts, '[)') && tstzrange(p_start_ts, p_end_ts, '[)');

    IF (v_current_attendees + p_attendees) > v_capacity THEN
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
