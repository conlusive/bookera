/**
 * Токен «прямого посилання» закладу (?dl=...), що робить клієнта власним: комісії за нього немає.
 *
 * Зберігаємо ПО ЗАКЛАДАХ. Раніше був один спільний ключ: клієнт, який відкрив прямі посилання двох
 * закладів, залишав токен лише останнього, і запис до першого ставав «з вітрини» - заклад
 * платив комісію за власного клієнта. Сервер усе одно звіряє токен із конкретним закладом,
 * тож чужий токен нічого не дає.
 */
const KEY = 'direct_link_tokens';

function readAll(): Record<string, string> {
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
    localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [String(businessId)]: token }));
  } catch { /* сховище недоступне - запис піде як із вітрини */ }
}

export function getDirectLinkToken(businessId: number | string): string | undefined {
  return readAll()[String(businessId)] || undefined;
}
