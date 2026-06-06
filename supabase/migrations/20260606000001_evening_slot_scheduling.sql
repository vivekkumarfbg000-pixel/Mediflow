-- Migration: Add appointment_time, end_time columns + 'scheduled' status to appointments
-- Part of same-day evening slot scheduling feature

-- Add new columns if they don't already exist
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS appointment_time timestamp with time zone,
  ADD COLUMN IF NOT EXISTS end_time timestamp with time zone;

-- Widen the status check constraint to include 'scheduled'
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('pending_payment', 'ready_for_consult', 'completed', 'scheduled'));

-- Index for efficient patient + date queries (used by getAppointmentByPatient)
CREATE INDEX IF NOT EXISTS idx_appointments_patient_time
  ON appointments (patient_id, appointment_time);

-- Comment for documentation
COMMENT ON COLUMN appointments.appointment_time IS 'ISO timestamp for same-day evening follow-up slot start (17:00–20:00 window)';
COMMENT ON COLUMN appointments.end_time IS 'ISO timestamp for same-day evening follow-up slot end (30 min after appointment_time)';
