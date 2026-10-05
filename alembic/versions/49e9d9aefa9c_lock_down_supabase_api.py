"""Закриваємо пряме API Supabase (PostgREST) і сховище від анонімів.

Було: 15 таблиць без RLS, а ролі anon/authenticated мали повні права (навіть TRUNCATE) на всі
таблиці public. Публічний ключ anon лежить у фронтенді, тож будь-хто міг напряму читати й міняти
платежі, виплати, членство, журнал дій. Бекенд ходить у базу напряму як власник таблиць (обходить
RLS), тож закрити прямий доступ безпечно.

Сховище: анонімне завантаження в business_media (файлообмінник за ваш рахунок), будь-який
залогінений міг оновлювати/видаляти ЧУЖІ аватарки, бакет documents (медичні згоди) був публічним.

Усі кроки умовні (ролі anon/authenticated і схема storage існують лише в Supabase), тож міграція
безпечна й для звичайного Postgres.

Revision ID: 49e9d9aefa9c
Revises: b7c8d9e0f1a2
"""
from typing import Sequence, Union

from alembic import op

revision: str = '49e9d9aefa9c'
down_revision: Union[str, Sequence[str], None] = 'b7c8d9e0f1a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES_RLS = """
DO $$
DECLARE t record;
BEGIN
  -- RLS без політик = прямий доступ через Data API закритий; власник таблиць (бекенд) RLS обходить
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
"""

REVOKE_API_ROLES = """
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      -- нові таблиці теж не повинні одразу відкриватись цим ролям
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
    END IF;
  END LOOP;

  -- Єдина функція, яку викликає фронтенд: людина видаляє СВІЙ акаунт (усередині auth.uid()).
  IF to_regprocedure('public.delete_user()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.delete_user() FROM PUBLIC;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      REVOKE EXECUTE ON FUNCTION public.delete_user() FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      GRANT EXECUTE ON FUNCTION public.delete_user() TO authenticated;
    END IF;
  END IF;
END $$;
"""

STORAGE = """
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN

    -- business_media: завантажувати можуть лише залогінені (було: будь-хто без входу)
    DROP POLICY IF EXISTS "Public Upload Access" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated upload business_media" ON storage.objects;
    CREATE POLICY "Authenticated upload business_media" ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (bucket_id = 'business_media');

    -- avatars: лише у власну папку <uid>/..., міняти й видаляти - лише свої (було: чужі теж)
    DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update their avatars" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete their avatars" ON storage.objects;
    DROP POLICY IF EXISTS "Own avatars insert" ON storage.objects;
    DROP POLICY IF EXISTS "Own avatars update" ON storage.objects;
    DROP POLICY IF EXISTS "Own avatars delete" ON storage.objects;
    CREATE POLICY "Own avatars insert" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
    CREATE POLICY "Own avatars update" ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
    CREATE POLICY "Own avatars delete" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

    -- Типи й розмір файлів: лише зображення, до 10 МБ (інакше сховище - безкоштовний файлообмінник)
    UPDATE storage.buckets
       SET file_size_limit = 10485760,
           allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif','image/heic','image/heif']
     WHERE id IN ('business_media', 'avatars');

    -- Медичні згоди клієнтів - не для публічного доступу за посиланням
    UPDATE storage.buckets SET public = false WHERE id = 'documents';
  END IF;
END $$;
"""


def upgrade() -> None:
    op.execute(TABLES_RLS)
    op.execute(REVOKE_API_ROLES)
    op.execute(STORAGE)


def downgrade() -> None:
    # Свідомо порожньо: відкривати базу назад - це знову дірка. Потрібне - дозволяйте точково політиками.
    pass
