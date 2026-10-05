'use client';

import { kyivNow, WEEKDAY_SHORT, type HoursRow } from '@/lib/salon-time';

/**
 * Графік роботи закладу - один вигляд для сторінки салону й редактора вітрини.
 *
 * Дні з однаковими годинами йдуть поспіль в один рядок («Пн – Пт  09:00 – 20:00»):
 * так графік читається з одного погляду, а не як сім майже однакових рядків.
 * Рядок із сьогоднішнім днем виділено (лише в браузері: на сервері «сьогодні»
 * інше - розмітка не збіглась би при гідратації, тому now передаємо зверху).
 */
type Group = { from: number; to: number; open: boolean; label: string };

function group(rows: HoursRow[]): Group[] {
  const text = (wd: number) => {
    const r = rows.find(h => Number(h.weekday) === wd);
    return r?.is_open ? `${String(r.open_time).slice(0, 5)} – ${String(r.close_time).slice(0, 5)}` : '';
  };
  const out: Group[] = [];
  for (let wd = 0; wd < 7; wd++) {
    const t = text(wd);
    const last = out[out.length - 1];
    if (last && last.label === t && last.to === wd - 1) last.to = wd;
    else out.push({ from: wd, to: wd, open: t !== '', label: t });
  }
  return out;
}

export default function WorkingHours({ rows, now }: { rows: HoursRow[]; now?: Date | null }) {
  const today = now ? kyivNow(now).weekday : -1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', maxWidth: '460px' }}>
      {group(rows).map(g => {
        const isToday = today >= g.from && today <= g.to;
        const days = g.from === g.to ? WEEKDAY_SHORT[g.from] : `${WEEKDAY_SHORT[g.from]} – ${WEEKDAY_SHORT[g.to]}`;
        return (
          <div key={g.from} style={{ display: 'flex', justifyContent: 'space-between', gap: '1.5rem', fontSize: '1rem', fontWeight: isToday ? 700 : 500, color: isToday ? '#1D1D1F' : '#64748b' }}>
            <span>{days}</span>
            <span style={{ color: g.open ? (isToday ? '#1D1D1F' : '#475569') : '#a1a1a6' }}>{g.open ? g.label : 'Вихідний'}</span>
          </div>
        );
      })}
    </div>
  );
}
