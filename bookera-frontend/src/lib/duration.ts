/**
 * Тривалість людською мовою - одне правило на весь сайт.
 *   45 -> «45 хв», 60 -> «1 год», 90 -> «1 год 30 хв», 120 -> «2 год»
 * Раніше скрізь було «120 хв» - доводилось рахувати в голові.
 */
export function formatDuration(minutes: number | null | undefined): string {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  if (m < 60) return `${m} хв`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} год ${r} хв` : `${h} год`;
}
