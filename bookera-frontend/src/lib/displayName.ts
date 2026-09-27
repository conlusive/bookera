/**
 * Імʼя людини для показу - ОДНЕ правило на весь сайт.
 *
 * Раніше кожна сторінка вирішувала сама: головна брала імʼя лише з
 * токена входу (імʼя, змінене в профілі, там не зʼявлялось), бізнес-
 * сторінка - спершу з сервера, сторінка салону мала запасне «Гість»,
 * кабінет показував пошту. Тепер порядок скрізь однаковий:
 *
 *   1. імʼя на сервері (users.full_name) - те, що людина бачить і
 *      змінює в профілі
 *   2. імʼя з реєстрації (user_metadata.full_name / name)
 *   3. частина пошти до «@» - краще за повну адресу на місці імені
 *   4. «Користувач»
 *
 * Рядок, схожий на пошту, імʼям не вважається.
 */
type Person = {
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  user_metadata?: { full_name?: string | null; name?: string | null } | null;
} | null | undefined;

const clean = (v?: string | null) => {
  const s = (v || '').trim();
  return s && !s.includes('@') ? s : '';
};

export function resolveDisplayName(server?: Person, auth?: Person): string {
  return (
    clean(server?.full_name) || clean(server?.name) ||
    clean(auth?.full_name) || clean(auth?.user_metadata?.full_name) || clean(auth?.user_metadata?.name) ||
    clean(server?.user_metadata?.full_name) ||
    (server?.email || auth?.email || '').split('@')[0] ||
    'Користувач'
  );
}
