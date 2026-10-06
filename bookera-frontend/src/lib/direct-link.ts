/**
 * Токен «прямого посилання» закладу (?dl=...), що робить клієнта власним: комісії за нього немає.
 *
 * Зберігаємо ПО ЗАКЛАДАХ і з датою переходу. Раніше був один спільний ключ: клієнт, який відкрив
 * прямі посилання двох закладів, залишав токен лише останнього, і запис до першого ставав «з вітрини» -
 * заклад платив комісію за власного клієнта. Сервер усе одно звіряє токен із конкретним закладом,
 * тож чужий токен нічого не дає.
 *
 * Термін дії - DIRECT_LINK_DAYS від останнього переходу: хто відкрив посилання сьогодні й записався
 * за місяць - клієнт закладу, а хто повернувся через пів року сам через вітрину - уже ні.
 * Те саме число віддає бекенд у GET /businesses/platform-terms (direct_link_days).
 */
const KEY = 'direct_link_tokens';
export const DIRECT_LINK_DAYS = 30;

type Entry = { token: string; at: number };

function readAll(): Record<string, Entry> {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveDirectLinkToken(businessId: number | string, token: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [String(businessId)]: { token, at: Date.now() } }));
  } catch { /* сховище недоступне - запис піде як із вітрини */ }
}

export function getDirectLinkToken(businessId: number | string): string | undefined {
  const entry = readAll()[String(businessId)];
  if (!entry || typeof entry.token !== 'string' || typeof entry.at !== 'number') return undefined;
  const ageDays = (Date.now() - entry.at) / 86400000;
  return ageDays <= DIRECT_LINK_DAYS ? entry.token : undefined;
}
