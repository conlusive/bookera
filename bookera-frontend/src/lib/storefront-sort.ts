/**
 * Порядок закладів на головній - ОДНЕ місце й чиста функція (без React).
 *
 * Принцип один для всіх режимів: «найближче до мене». Відстань кожного закладу
 * (за маршрутом) відома браузеру; Радар (платне просування) зменшує її на
 * `radar_bonus_km`. Усі числа - з /businesses/ranking-rules, власних копій тут немає.
 *
 * Режими:
 *   distance     «Найближчі»      від найближчого. Заклади без відстані - в кінці.
 *   price        «Дешевші»        за найдешевшою послугою закладу.
 *   recommended  «Рекомендовані»  за позицією: якість + Радар (rank_score з сервера)
 *                                 + «поруч» + «є вільні вікна сьогодні».
 *
 * Для price й recommended діє перемикач охоплення (scope):
 *   near  (типово) - спершу заклади в радіусі `nearby_radius_km`, далі решта; у кожному
 *                    блоці - за правилом режиму («дешеві, але поруч»)
 *   all            - по всьому місту: чиста ціна чи позиція, без розподілу на «поруч / далі»
 *
 * Розподіл на «поруч / далі» потребує місця людини; без нього (немає геолокації)
 * список просто впорядковано за правилом режиму, а інтерфейс пропонує визначити місце.
 *
 * Порядок завжди однозначний: усі нічиї розв'язуються так само, а в кінці - за id,
 * тож картки не «стрибають» між оновленнями.
 */
export type SortMode = 'distance' | 'recommended' | 'price';
export type SortScope = 'near' | 'all';
export type Zone = 'near' | 'far' | 'all';

export interface SortRules {
  weights: { quality_max: number; proximity_max: number; free_slots: number; radar: number };
  proximity_radius_km: number;
  nearby_radius_km?: number;
  radar_bonus_km: number;
}

export interface SortBusiness {
  id: number;
  rank_score?: number | null;
  is_radar_active?: boolean;
  radar_bonus_km?: number | null;
  rating?: number | string | null;
  reviews_count?: number | string | null;
  services?: { price?: number | string | null }[];
}

export interface SortContext {
  mode: SortMode;
  scope: SortScope;
  rules: SortRules | null;
  /** Відстань до закладу в км (за маршрутом), якщо відома. */
  distanceKm: (id: number) => number | undefined;
  /** Чи є в закладі вільні вікна сьогодні (відомо лише для тих, чиї слоти завантажено). */
  hasFreeSlots: (id: number) => boolean;
  /** Чи відоме місце людини (геолокація / місто). */
  hasLocation: boolean;
}

export interface Ranked<T> {
  business: T;
  zone: Zone;
}

export interface RankResult<T> {
  items: Ranked<T>[];
  /** Чи розподілено на блоки «поруч / далі» (інакше всі зони - 'all'). */
  tiered: boolean;
  nearCount: number;
  farCount: number;
}

/** Найдешевша послуга закладу; Infinity, якщо цін немає (такі - в кінці). */
export function minPrice(b: SortBusiness): number {
  const prices = (b.services || [])
    .map(s => parseFloat(String(s.price)))
    .filter(n => !isNaN(n) && n > 0);
  return prices.length ? Math.min(...prices) : Infinity;
}

/** Відстань із поправкою на Радар. Infinity - невідома. */
export function effectiveKm<T extends SortBusiness>(b: T, ctx: SortContext): number {
  const d = ctx.distanceKm(b.id);
  if (d === undefined || !Number.isFinite(d)) return Infinity;
  const bonus = b.is_radar_active ? (b.radar_bonus_km ?? ctx.rules?.radar_bonus_km ?? 0) : 0;
  return Math.max(0, d - bonus);
}

/** Позиція в «Рекомендованих»: те, що знає сервер, плюс відстань і вільні вікна. */
export function recommendedScore<T extends SortBusiness>(b: T, ctx: SortContext): number {
  const rules = ctx.rules;
  const base = b.rank_score ?? 0;
  if (!rules) return base;
  const d = ctx.distanceKm(b.id);
  const near = d !== undefined && Number.isFinite(d)
    ? rules.weights.proximity_max * Math.max(0, 1 - d / rules.proximity_radius_km)
    : 0;
  return base + near + (ctx.hasFreeSlots(b.id) ? rules.weights.free_slots : 0);
}

/** Сходинки за кількістю відгуків: рейтинг без відгуків нічого не вартий. */
function reviewTier(b: SortBusiness): number {
  const n = parseInt(String(b.reviews_count)) || 0;
  return n >= 50 ? 3 : n >= 10 ? 2 : n >= 1 ? 1 : 0;
}

function num(a: number, b: number): number {
  // Infinity - Infinity = NaN; порівнювач має повертати число
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function comparator<T extends SortBusiness>(ctx: SortContext): (a: T, b: T) => number {
  const eff = (x: T) => effectiveKm(x, ctx);
  const radar = (x: T) => (x.is_radar_active ? 0 : 1);
  const byId = (a: T, b: T) => a.id - b.id;
  const hasScore = (x: T) => ctx.rules !== null && x.rank_score != null;
  const score = (x: T) => recommendedScore(x, ctx);

  // Позиція: якщо правил із сервера немає - стара послідовність (вікна, відгуки, рейтинг)
  const byQuality = (a: T, b: T) => {
    if (hasScore(a) && hasScore(b)) {
      const d = score(b) - score(a);
      return Math.abs(d) > 0.001 ? (d < 0 ? -1 : 1) : 0;
    }
    return (
      num(ctx.hasFreeSlots(b.id) ? 1 : 0, ctx.hasFreeSlots(a.id) ? 1 : 0) ||
      num(reviewTier(b), reviewTier(a)) ||
      num(parseFloat(String(b.rating)) || 0, parseFloat(String(a.rating)) || 0)
    );
  };

  switch (ctx.mode) {
    case 'distance':
      return (a, b) => num(eff(a), eff(b)) || byQuality(a, b) || byId(a, b);
    case 'price':
      // Нічия за ціною: спершу той, що просувається, потім ближчий, потім кращий
      return (a, b) => num(minPrice(a), minPrice(b)) || num(radar(a), radar(b)) || num(eff(a), eff(b)) || byQuality(a, b) || byId(a, b);
    case 'recommended':
    default:
      return (a, b) => byQuality(a, b) || num(eff(a), eff(b)) || byId(a, b);
  }
}

export function rankBusinesses<T extends SortBusiness>(list: T[], ctx: SortContext): RankResult<T> {
  const cmp = comparator<T>(ctx);
  const radius = ctx.rules?.nearby_radius_km;
  const wantsTiers =
    ctx.mode !== 'distance' && ctx.scope === 'near' && ctx.hasLocation && typeof radius === 'number' && radius > 0;

  if (!wantsTiers) {
    return {
      items: [...list].sort(cmp).map(business => ({ business, zone: 'all' as Zone })),
      tiered: false,
      nearCount: 0,
      farCount: 0,
    };
  }

  const near: T[] = [];
  const far: T[] = [];
  for (const b of list) (effectiveKm(b, ctx) <= (radius as number) ? near : far).push(b);
  near.sort(cmp);
  far.sort(cmp);
  return {
    items: [
      ...near.map(business => ({ business, zone: 'near' as Zone })),
      ...far.map(business => ({ business, zone: 'far' as Zone })),
    ],
    tiered: true,
    nearCount: near.length,
    farCount: far.length,
  };
}
