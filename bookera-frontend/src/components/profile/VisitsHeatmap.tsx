'use client';

import { useMemo } from 'react';

/**
 * Теплова карта візитів за рік.
 *
 * Показує ритм: коли людина ходила частіше, коли робила паузи.
 * Це не статистика для аналізу, а відчуття власної історії -
 * тому без чисел на осях і без підказок із відсотками.
 *
 * Помаранчева шкала, а не зелена як у GitHub: зелений у продукті
 * зайнятий фірмовим кольором, і ще одна зелена сітка поруч читалася б
 * як частина інтерфейсу, а не як окремий об'єкт.
 */
export default function VisitsHeatmap({ appointments }: { appointments: any[] }) {
  const { weeks, monthLabels, total } = useMemo(() => {
    // Рахуємо лише відвідані візити: скасовані не показують ритм,
    // а спотворюють його.
    const counts = new Map<string, number>();
    let total = 0;

    for (const a of appointments) {
      if (a.status !== 'completed') continue;
      if (!a.start_time) continue;
      const d = new Date(a.start_time);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      counts.set(key, (counts.get(key) || 0) + 1);
      total++;
    }

    // Рік до сьогодні, вирівняний по понеділках: інакше стовпці
    // не збігаються з тижнями й сітка читається як випадкова.
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - 364);
    while (start.getDay() !== 1) start.setDate(start.getDate() - 1);

    const weeks: { date: Date; count: number; future: boolean }[][] = [];
    const monthLabels: { index: number; label: string }[] = [];
    let cursor = new Date(start);
    let lastMonth = -1;

    while (cursor <= end) {
      const week: { date: Date; count: number; future: boolean }[] = [];
      for (let i = 0; i < 7; i++) {
        const day = new Date(cursor);
        const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
        week.push({
          date: day,
          count: counts.get(key) || 0,
          future: day > end,
        });
        cursor.setDate(cursor.getDate() + 1);
      }

      // Підпис місяця ставимо на тижні, де місяць змінився.
      const firstOfWeek = week[0].date;
      if (firstOfWeek.getMonth() !== lastMonth) {
        lastMonth = firstOfWeek.getMonth();
        monthLabels.push({
          index: weeks.length,
          label: firstOfWeek.toLocaleDateString('uk-UA', { month: 'short' }).replace('.', ''),
        });
      }

      weeks.push(week);
    }

    return { weeks, monthLabels, total };
  }, [appointments]);

  // Без візитів карта показує порожню сітку - це виглядає як
  // поломка, а не як «ви ще не ходили».
  if (total === 0) return null;

  const shade = (count: number, future: boolean) => {
    if (future) return 'transparent';
    if (count === 0) return '#F5F5F7';
    if (count === 1) return '#FFE0C2';
    if (count === 2) return '#FFC085';
    return '#F59E42';
  };

  const CELL = 11;
  const GAP = 3;

  return (
    <div style={{ marginTop: '2.5rem' }}>
      <div style={{
        fontSize: '0.8125rem', fontWeight: 600, color: '#86868B',
        textTransform: 'uppercase', letterSpacing: '0.05em',
        marginBottom: '0.9rem', paddingLeft: '0.25rem',
      }}>
        Рік візитів
      </div>

      <div style={{
        background: '#fff', border: '1px solid #EDEDF0', borderRadius: '18px',
        padding: '1.5rem 1.75rem',
      }}>
        {/* Горизонтальна прокрутка: 53 тижні не вміщаються на вузькому
            екрані, а стискати клітинки означає зробити їх нечитабельними. */}
        <div style={{ overflowX: 'auto', paddingBottom: '0.25rem' }}>
          <div style={{ display: 'inline-block', minWidth: 'min-content' }}>
            <div style={{ display: 'flex', gap: `${GAP}px`, marginBottom: '6px', paddingLeft: '2px' }}>
              {weeks.map((_, i) => {
                const label = monthLabels.find(m => m.index === i);
                return (
                  <div key={i} style={{
                    width: CELL, fontSize: '0.625rem', color: '#AEAEB2',
                    whiteSpace: 'nowrap', textAlign: 'left',
                  }}>
                    {label?.label || ''}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: `${GAP}px` }}>
              {weeks.map((week, wi) => (
                <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: `${GAP}px` }}>
                  {week.map((day, di) => (
                    <div
                      key={di}
                      title={day.future ? '' : `${day.date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })} — ${day.count === 0 ? 'без візитів' : `${day.count} візит${day.count >= 5 ? 'ів' : day.count > 1 ? 'и' : ''}`}`}
                      style={{
                        width: CELL, height: CELL, borderRadius: '2px',
                        background: shade(day.count, day.future),
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          marginTop: '1rem', fontSize: '0.75rem', color: '#AEAEB2',
        }}>
          <span>Менше</span>
          {['#F5F5F7', '#FFE0C2', '#FFC085', '#F59E42'].map(c => (
            <span key={c} style={{ width: CELL, height: CELL, borderRadius: '2px', background: c }} />
          ))}
          <span>Більше</span>
          <span style={{ marginLeft: 'auto' }}>{total} візит{total >= 5 ? 'ів' : total > 1 ? 'и' : ''} за рік</span>
        </div>
      </div>
    </div>
  );
}
