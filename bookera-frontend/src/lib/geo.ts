/**
 * Чисті правила для місця людини (без браузерних API - щоб їх можна було перевірити тестами).
 */
export type GeoPoint = { lat: number; lng: number };

/** Відстань між двома точками по прямій, метри. */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLng = r(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(x));
}

/** Менше за це - людина «стоїть на місці»: різницю дає похибка GPS, а не рух. */
export const MIN_MOVE_METERS = 150;
/** Дуже неточний сигнал (IP, вишки) не повинен перебивати вже відоме місце. */
export const MAX_ACCEPTED_ACCURACY_METERS = 2000;
/** Скільки зберігали точку можна показати як «поточну» ще до свіжого визначення. */
export const STORED_POINT_FRESH_MS = 3 * 60 * 60 * 1000;

/**
 * Чи варто замінити поточне місце новим вимірюванням.
 * Так, якщо місця ще немає, або людина зрушила помітно більше за похибку.
 */
export function shouldAcceptFix(current: GeoPoint | null, next: GeoPoint, accuracyMeters?: number): boolean {
  if (!current) return true;
  const acc = typeof accuracyMeters === 'number' && Number.isFinite(accuracyMeters) ? accuracyMeters : 0;
  if (acc > MAX_ACCEPTED_ACCURACY_METERS) return false;
  // Рух має перевищити і поріг, і половину похибки самого вимірювання
  return distanceMeters(current, next) > Math.max(MIN_MOVE_METERS, acc / 2);
}

/** Чи збережена точка ще годиться показувати одразу (інакше чекаємо свіжого визначення). */
export function isStoredPointFresh(savedAt: number, now: number = Date.now(), ttl: number = STORED_POINT_FRESH_MS): boolean {
  return Number.isFinite(savedAt) && savedAt > 0 && now - savedAt >= 0 && now - savedAt < ttl;
}
