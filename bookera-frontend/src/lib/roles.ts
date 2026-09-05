/**
 * Історично роль власника записувалась трьома різними рядками в різних
 * місцях коду: 'vendor' (стара версія), 'owner' (майстер реєстрації) і
 * 'business_owner' (те, що реально повертає бекенд). Через цей різнобій
 * інтерфейс не впізнавав власника й показував йому кнопку "Відкрити бізнес"
 * замість "Перейти в кабінет".
 *
 * Єдине джерело правди - роль з бекенду ('business_owner'), але функція
 * приймає і старі варіанти, щоб уже збережені в браузері значення не
 * ламали вхід існуючим користувачам.
 */
export const OWNER_ROLE = 'business_owner';

export function isBusinessRole(role?: string | null): boolean {
  if (!role) return false;
  return ['business_owner', 'vendor', 'owner', 'admin', 'master', 'staff'].includes(role);
}

/** Лише власник (не персонал) - для дій на кшталт передачі прав. */
export function isOwnerRole(role?: string | null): boolean {
  if (!role) return false;
  return ['business_owner', 'vendor', 'owner'].includes(role);
}

/**
 * Людська назва ролі для інтерфейсу.
 *
 * Раніше підпис рахувався як `role === 'vendor' ? 'Власник' : 'Майстер'`,
 * тому власник із роллю 'business_owner' підписувався «Майстер» - у двох
 * місцях бічної панелі одночасно.
 */
export function roleLabel(role?: string | null): string {
  if (isOwnerRole(role)) return 'Власник';
  if (role === 'admin') return 'Адміністратор';
  if (role === 'master') return 'Майстер';
  return 'Співробітник';
}
