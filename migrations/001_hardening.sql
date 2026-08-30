-- 001_hardening.sql
-- Ідемпотентно (можна запускати повторно без шкоди). Виконати в Supabase SQL Editor.
BEGIN;

-- 1. Потрібно для exclusion constraint нижче (діапазони часу + рівність в одному GiST-індексі)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Колонка, якої не вистачало для фічі "додаткові послуги" (upsell) -
--    Pydantic-схема її вже очікувала, а в БД її не було -> 500 помилка при створенні послуги
ALTER TABLE services ADD COLUMN IF NOT EXISTS addon_service_ids JSON DEFAULT '[]'::json;

-- 3. Допоміжна колонка: стабільний "ключ ресурсу" для перевірки перетинів.
--    Якщо майстер призначений - ключ = master_id. Якщо ні (сам заклад = ресурс) - ключ = business_id.
--    Це відображає ту саму логіку, яка вже є в Python-коді розрахунку слотів.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS booking_key text
  GENERATED ALWAYS AS (COALESCE(master_id, 'BIZ-' || business_id::text)) STORED;

-- 4. ГОЛОВНИЙ ФІКС подвійного бронювання: реальна гарантія на рівні бази.
--    Жодні два записи зі статусом 'confirmed' або активним 'blocked' не можуть
--    перетинатись у часі для одного й того ж booking_key. Це працює навіть
--    при одночасних запитах - те, що логіка "перевір-потім-встав" у коді гарантувати не може.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'no_overlapping_bookings'
  ) THEN
    ALTER TABLE appointments
      ADD CONSTRAINT no_overlapping_bookings
      EXCLUDE USING gist (
        booking_key WITH =,
        tsrange(start_time, end_time, '[)') WITH &&
      )
      WHERE (status IN ('confirmed', 'blocked'));
  END IF;
END $$;

-- 5. Індекси під реальні патерни запитів API (available-slots/booked/CRM)
CREATE INDEX IF NOT EXISTS ix_appointments_business_start ON appointments (business_id, start_time);
CREATE INDEX IF NOT EXISTS ix_appointments_master_start ON appointments (master_id, start_time);
CREATE INDEX IF NOT EXISTS ix_appointments_status_expires ON appointments (status, expires_at);

COMMIT;
