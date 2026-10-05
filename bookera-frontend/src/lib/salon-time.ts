/**
 * Час і графік закладу для сторінки салону - одне місце.
 *
 * Усі заклади живуть за київським часом (бекенд теж: business_tz), тому
 * «сьогодні», «зараз» і години відгуків рахуємо в Europe/Kyiv, а не в поясі
 * браузера. Інакше відвідувач з іншого пояса бачив би «минулий» день
 * доступним, а відгук - з часом, зсунутим на кілька годин.
 */
export const SALON_TZ = 'Europe/Kyiv';

const WEEKDAYS = ['понеділок', 'вівторок', 'середа', 'четвер', "п'ятниця", 'субота', 'неділя'];
const WEEKDAYS_ACC = ['понеділок', 'вівторок', 'середу', 'четвер', "п'ятницю", 'суботу', 'неділю'];
export const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
export const weekdayName = (i: number) => WEEKDAYS[i] ?? '';

function parts(d: Date): Record<string, string> {
  const out: Record<string, string> = {};
  new Intl.DateTimeFormat('en-CA', {
    timeZone: SALON_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d).forEach(p => { out[p.type] = p.value; });
  return out;
}

/** Поточна хвилина в Києві: дата-ключ, хвилини від півночі, день тижня (0 = понеділок). */
export function kyivNow(now: Date = new Date()) {
  const p = parts(now);
  const key = `${p.year}-${p.month}-${p.day}`;
  const probe = new Date(`${key}T12:00:00`);
  return { key, minutes: Number(p.hour) * 60 + Number(p.minute), weekday: (probe.getDay() + 6) % 7 };
}

/** Сьогоднішня дата в Києві як локальна північ (зручно порівнювати з клітинками календаря). */
export function kyivToday(): Date {
  const [y, m, d] = kyivNow().key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Час із бази (UTC без пояса) -> «28.09.2026 о 22:44» за київським часом. */
export function formatUtcAsKyiv(value?: string | null): string {
  if (!value) return '';
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return value;
  const date = d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: SALON_TZ });
  const time = d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', timeZone: SALON_TZ });
  return `${date} о ${time}`;
}

export function formatUtcDateKyiv(value?: string | null): string {
  if (!value) return '';
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: SALON_TZ });
}

export interface HoursRow { weekday: number; is_open: boolean; open_time?: string; close_time?: string }

const hhmm = (t?: string) => (t || '').slice(0, 5);
const toMin = (t?: string) => { const [h, m] = hhmm(t).split(':').map(Number); return (h || 0) * 60 + (m || 0); };

export type OpenStatus = { open: boolean; text: string } | null;

/**
 * «Відчинено до 20:00» / «Зачинено · відкриється завтра о 09:00».
 * null - графік не налаштований (нічого не вигадуємо).
 */
export function openStatus(hours: HoursRow[] | undefined | null, now: Date = new Date()): OpenStatus {
  if (!Array.isArray(hours) || hours.length === 0) return null;
  const { minutes, weekday } = kyivNow(now);
  const today = hours.find(h => Number(h.weekday) === weekday);
  if (today?.is_open && minutes >= toMin(today.open_time) && minutes < toMin(today.close_time)) {
    return { open: true, text: `Відчинено до ${hhmm(today.close_time)}` };
  }
  if (today?.is_open && minutes < toMin(today.open_time)) {
    return { open: false, text: `Зачинено · відкриється о ${hhmm(today.open_time)}` };
  }
  for (let i = 1; i <= 7; i++) {
    const wd = (weekday + i) % 7;
    const next = hours.find(h => Number(h.weekday) === wd);
    if (next?.is_open) {
      const when = i === 1 ? 'завтра' : `у ${WEEKDAYS_ACC[wd]}`;
      return { open: false, text: `Зачинено · відкриється ${when} о ${hhmm(next.open_time)}` };
    }
  }
  return { open: false, text: 'Зачинено' };
}

interface SalonRules {
  working_hours?: HoursRow[];
  booking_settings?: { closed_periods?: { start: string; end: string; reason?: string }[]; max_advance_days?: number } | null;
}

/** Чому день не можна обрати для запису (або null, якщо можна). */
export function dayBlockedReason(date: Date, salon: SalonRules | null | undefined): string | null {
  const today = kyivToday();
  if (date < today) return 'past';
  const rules = salon?.booking_settings || {};
  const max = Number(rules.max_advance_days);
  if (max > 0) {
    const last = new Date(today);
    last.setDate(today.getDate() + max);
    if (date > last) return 'too_far';
  }
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  for (const p of rules.closed_periods || []) {
    if (p?.start && p?.end && p.start <= key && key <= p.end) return 'closed_period';
  }
  const hours = salon?.working_hours;
  if (Array.isArray(hours) && hours.length > 0) {
    const day = hours.find(h => Number(h.weekday) === (date.getDay() + 6) % 7);
    if (day && !day.is_open) return 'day_off';
  }
  return null;
}
