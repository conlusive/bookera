'use client';

import { useMemo, useState } from 'react';
import { plural } from '@/lib/plural';

/**
 * «Ваш рік у візитах»: замість сітки з дрібних клітинок по днях, яку ніхто не міг прочитати.
 * Зверху три прості цифри (скільки разів були, як часто ходите, де найчастіше), нижче стовпчики по місяцях
 * з підписаними числами. Рахуємо лише завершені візити за останні 12 місяців: скасовані ритм спотворюють.
 */
const MONTH = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];
const MONTH_FULL = ['січні', 'лютому', 'березні', 'квітні', 'травні', 'червні', 'липні', 'серпні', 'вересні', 'жовтні', 'листопаді', 'грудні'];

function every(days: number): string {
  if (days < 10) return `раз на ${Math.max(1, Math.round(days))} ${plural(Math.round(days), 'день', 'дні', 'днів')}`;
  if (days < 45) { const w = Math.max(1, Math.round(days / 7)); return `раз на ${w} ${plural(w, 'тиждень', 'тижні', 'тижнів')}`; }
  const m = Math.max(1, Math.round(days / 30));
  return `раз на ${m} ${plural(m, 'місяць', 'місяці', 'місяців')}`;
}

type Visit = { status?: string | null; start_time?: string | null; business_name?: string | null; service_name?: string | null };

export default function VisitsYear({ appointments }: { appointments: Visit[] }) {
  const [active, setActive] = useState<number | null>(null);

  const data = useMemo(() => {
    const now = new Date();
    // 12 місяців: від (поточний - 11) до поточного
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      return { y: d.getFullYear(), m: d.getMonth(), count: 0 };
    });
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const done = appointments
      .filter((a): a is Visit & { start_time: string } => a.status === 'completed' && !!a.start_time)
      .map(a => ({ ...a, t: new Date(a.start_time) }))
      .filter(a => a.t >= start && a.t <= now)
      .sort((x, y) => x.t.getTime() - y.t.getTime());
    for (const a of done) {
      const slot = months.find(mm => mm.y === a.t.getFullYear() && mm.m === a.t.getMonth());
      if (slot) slot.count++;
    }
    // Звичний інтервал між візитами (потрібно щонайменше два візити)
    let gap: number | null = null;
    if (done.length >= 2) {
      const span = (done[done.length - 1].t.getTime() - done[0].t.getTime()) / 86400000;
      gap = span / (done.length - 1);
    }
    // Де найчастіше
    const byPlace = new Map<string, number>();
    for (const a of done) if (a.business_name) byPlace.set(a.business_name, (byPlace.get(a.business_name) || 0) + 1);
    // Один заклад - «найчастіше тут» нічого не каже, тоді показуємо улюблену послугу
    const byService = new Map<string, number>();
    for (const a of done) if (a.service_name) byService.set(a.service_name, (byService.get(a.service_name) || 0) + 1);
    const pick = byPlace.size > 1 ? { map: byPlace, label: 'найчастіше' } : { map: byService, label: 'улюблена послуга' };
    const topEntry = [...pick.map.entries()].sort((x, y) => y[1] - x[1])[0] || null;
    const top = topEntry ? { name: topEntry[0], count: topEntry[1], label: pick.label } : null;
    const max = Math.max(...months.map(m => m.count), 1);
    const busiest = months.reduce((b, m) => (m.count > b.count ? m : b), months[0]);
    return { months, total: done.length, gap, top, max, busiest, current: months.length - 1 };
  }, [appointments]);

  // Без візитів за рік блок не показуємо: порожні стовпчики виглядали б як поломка, а не як «ви ще не ходили»
  if (data.total === 0) return null;

  const shown = active ?? null;
  const caption = shown !== null
    ? `${data.months[shown].count === 0 ? 'Без візитів' : `${data.months[shown].count} ${plural(data.months[shown].count, 'візит', 'візити', 'візитів')}`} у ${MONTH_FULL[data.months[shown].m]}`
    : data.busiest.count > 1
      ? `Найбільше візитів було в ${MONTH_FULL[data.busiest.m]}: ${data.busiest.count}`
      : 'Наведіть на стовпчик, щоб побачити місяць';

  return (
    <section style={{ marginTop: '2.5rem' }} aria-label="Ваш рік у візитах">
      <div style={{ padding: '0 0.25rem', marginBottom: '0.9rem' }}>
        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.01em' }}>Ваш рік у візитах</div>
        <div style={{ fontSize: '0.85rem', color: '#86868B', marginTop: '0.2rem' }}>Завершені візити за останні 12 місяців</div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #EDEDF0', borderRadius: '18px', padding: '1.5rem 1.75rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem 2.5rem', marginBottom: '1.6rem' }}>
          <div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#1D1D1F', lineHeight: 1.1 }}>{data.total}</div>
            <div style={{ fontSize: '0.82rem', color: '#86868B' }}>{plural(data.total, 'візит', 'візити', 'візитів')} за рік</div>
          </div>
          {data.gap !== null && (
            <div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1D1D1F', lineHeight: 1.5 }}>Зазвичай {every(data.gap)}</div>
              <div style={{ fontSize: '0.82rem', color: '#86868B' }}>ваш ритм</div>
            </div>
          )}
          {data.top && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1D1D1F', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{data.top.name}</div>
              <div style={{ fontSize: '0.82rem', color: '#86868B' }}>{data.top.label} · {data.top.count} {plural(data.top.count, 'візит', 'візити', 'візитів')}</div>
            </div>
          )}
        </div>

        <div role="group" aria-label="Візити за місяцями" style={{ display: 'flex', alignItems: 'flex-end', gap: 'clamp(4px, 1.4vw, 12px)', height: '130px' }}>
          {data.months.map((m, i) => {
            const h = m.count === 0 ? 4 : 16 + (m.count / data.max) * 84;
            const isNow = i === data.current;
            return (
              <button
                key={`${m.y}-${m.m}`} type="button"
                onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}
                aria-label={`${MONTH[m.m]} ${m.y}: ${m.count} ${plural(m.count, 'візит', 'візити', 'візитів')}`}
                style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: '6px', background: 'none', border: 'none', padding: 0, cursor: 'default', font: 'inherit' }}
              >
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: m.count ? '#1D1D1F' : 'transparent', lineHeight: 1 }}>{m.count || '0'}</span>
                <span style={{
                  width: '100%', height: `${h}%`, borderRadius: '8px',
                  background: m.count === 0 ? '#ECECEF' : i === shown ? '#4C7A55' : isNow ? '#6F9273' : '#B9D2BC',
                  transition: 'background .2s ease, height .5s cubic-bezier(.16,1,.3,1)',
                }} />
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 'clamp(4px, 1.4vw, 12px)', marginTop: '8px' }}>
          {data.months.map((m, i) => (
            <span key={`l${m.y}-${m.m}`} style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: '0.72rem', color: i === data.current ? '#1D1D1F' : '#8E8E93', fontWeight: i === data.current ? 700 : 500 }}>
              {MONTH[m.m]}
            </span>
          ))}
        </div>
        <div aria-live="polite" style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#6E6E73', minHeight: '1.2em' }}>{caption}</div>
      </div>
    </section>
  );
}
