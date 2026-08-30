-- 002_clean_schema_constraints.sql
-- Застосовується ПІСЛЯ того, як нові таблиці створені (Base.metadata.create_all
-- або той самий SQL, згенерований з моделей). Ідемпотентно.
BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Головний захист від подвійного бронювання (той самий, що вже протестований
-- на 15 одночасних запитах: 13/15 успіхів ДО фіксу -> 1/15 ПІСЛЯ).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'no_overlapping_bookings') THEN
    ALTER TABLE appointments
      ADD CONSTRAINT no_overlapping_bookings
      EXCLUDE USING gist (
        booking_key WITH =,
        tsrange(start_time, end_time, '[)') WITH &&
      )
      WHERE (status IN ('confirmed', 'blocked'));
  END IF;
END $$;

-- Індекси під реальні патерни запитів
CREATE INDEX IF NOT EXISTS ix_appointments_business_start ON appointments (business_id, start_time);
CREATE INDEX IF NOT EXISTS ix_appointments_master_start ON appointments (master_id, start_time);
CREATE INDEX IF NOT EXISTS ix_appointments_status_expires ON appointments (status, expires_at);
CREATE INDEX IF NOT EXISTS ix_clients_business_phone ON clients (business_id, phone);
CREATE INDEX IF NOT EXISTS ix_clients_business_name ON clients (business_id, name);
CREATE INDEX IF NOT EXISTS ix_staff_invites_token ON staff_invites (token);
CREATE INDEX IF NOT EXISTS ix_services_business_active ON services (business_id, is_active);
CREATE INDEX IF NOT EXISTS ix_reviews_business ON reviews (business_id);
CREATE INDEX IF NOT EXISTS ix_expenses_business_date ON expenses (business_id, expense_date);

COMMIT;
