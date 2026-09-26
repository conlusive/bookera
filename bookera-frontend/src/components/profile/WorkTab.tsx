'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

/**
 * «Моя робота» - кабінет майстра в особистому профілі.
 *
 * Майстер у кількох салонах раніше заходив у кабінет кожного окремо,
 * щоб зрозуміти свій день. Тут усе разом:
 *   - наступний клієнт і розклад на сьогодні з усіх салонів
 *   - місяць у цифрах: візити, виручка, середній чек, рейтинг
 *   - візити за два тижні - маленький графік
 *   - гроші: скільки нараховано до виплати й останні виплати
 *   - салони з переходом у кабінет потрібного одним натисканням
 */
type Work = any;

const money = (n: number) => `${Math.round(n || 0).toLocaleString('uk-UA')} ₴`;
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Сьогодні';
  if (d.toDateString() === tomorrow.toDateString()) return 'Завтра';
  return d.toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'short' });
};

export default function WorkTab({ getToken }: { getToken: () => Promise<string | null> }) {
  const router = useRouter();
  const [work, setWork] = useState<Work | null>(null);
  const [error, setError] = useState(false);
  const [opening, setOpening] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error();
        const data = await api.getMyWork(token);
        if (!cancelled) setWork(data);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [getToken]);

  // Перехід у кабінет салону: спершу зробити його поточним, потім відкрити.
  const openCabinet = async (businessId: number) => {
    setOpening(businessId);
    try {
      const token = await getToken();
      if (!token) return;
      await api.switchWorkplace(token, businessId);
      try { localStorage.setItem('bookera_active_biz_id', String(businessId)); } catch { /* */ }
      router.push('/cabinet');
    } catch {
      setOpening(null);
    }
  };

  if (error) return <div className="wk-empty">Не вдалося завантажити дані роботи. Оновіть сторінку.</div>;
  if (!work) return <div className="wk-empty">Завантаження…</div>;

  const maxDay = Math.max(1, ...work.daily.map((d: any) => d.visits));
  const unpaidTotal = work.unpaid.reduce((s: number, u: any) => s + u.amount, 0);
  const upcomingToday = work.today.filter((t: any) => new Date(t.start_time) >= new Date());

  return (
    <div className="wk">
      {/* --- Наступний клієнт --- */}
      <section className="wk-next">
        {work.next ? (
          <>
            <div className="wk-label">Наступний клієнт</div>
            <div className="wk-next-time">{dayLabel(work.next.start_time)}, {hhmm(work.next.start_time)}</div>
            <div className="wk-next-what">
              {[work.next.client_name, work.next.service_name].filter(Boolean).join(' · ')}
            </div>
            <div className="wk-next-where">{work.next.business_name}</div>
          </>
        ) : (
          <>
            <div className="wk-label">Наступний клієнт</div>
            <div className="wk-next-time" style={{ fontSize: '1.4rem' }}>Записів поки немає</div>
            <div className="wk-next-where">Найближчі два тижні вільні</div>
          </>
        )}
      </section>

      {/* --- Місяць у цифрах --- */}
      <section className="wk-stats">
        <div><small>Візитів за 30 днів</small><b>{work.stats_30d.visits}</b></div>
        <div><small>Виручка</small><b>{money(work.stats_30d.revenue)}</b></div>
        <div><small>Середній чек</small><b>{money(work.stats_30d.avg_check)}</b></div>
        <div>
          <small>Рейтинг</small>
          <b>{work.rating != null ? <>★ {work.rating}</> : '—'}</b>
          <em>{work.reviews > 0 ? `${work.reviews} відгуків` : 'ще немає відгуків'}</em>
        </div>
      </section>

      {/* --- Графік за два тижні --- */}
      <section className="wk-block">
        <div className="wk-title">Візити за два тижні</div>
        <div className="wk-chart" role="img" aria-label="Кількість завершених візитів по днях за два тижні">
          {work.daily.map((d: any) => {
            const isToday = d.date === new Date().toISOString().slice(0, 10);
            return (
              <div key={d.date} className="wk-col" title={`${new Date(d.date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}: ${d.visits}`}>
                <div className="wk-bar-wrap">
                  <div className={`wk-bar ${isToday ? 'now' : ''}`} style={{ height: `${Math.max(4, (d.visits / maxDay) * 100)}%`, opacity: d.visits ? 1 : 0.35 }} />
                </div>
                <span>{new Date(d.date).getDate()}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* --- Сьогодні --- */}
      <section className="wk-block">
        <div className="wk-title">
          Сьогодні
          <span className="wk-count">{work.today.length ? `${upcomingToday.length} з ${work.today.length} попереду` : ''}</span>
        </div>
        {work.today.length === 0 ? (
          <div className="wk-hint">На сьогодні записів немає.</div>
        ) : work.today.map((t: any) => {
          const past = new Date(t.end_time || t.start_time) < new Date();
          return (
            <div key={t.id} className={`wk-row ${past ? 'past' : ''}`}>
              <div className="wk-time">{hhmm(t.start_time)}</div>
              <div className="wk-row-main">
                <div className="wk-row-t">{[t.client_name, t.service_name].filter(Boolean).join(' · ') || 'Запис'}</div>
                <div className="wk-row-s">{t.business_name}</div>
              </div>
            </div>
          );
        })}
      </section>

      {/* --- Гроші --- */}
      {(work.unpaid.length > 0 || work.payouts.length > 0) && (
        <section className="wk-block">
          <div className="wk-title">Заробіток</div>
          {work.unpaid.length > 0 && (
            <div className="wk-unpaid">
              <small>Нараховано до виплати</small>
              <b>{money(unpaidTotal)}</b>
              {work.unpaid.length > 1 && (
                <div className="wk-unpaid-list">
                  {work.unpaid.map((u: any) => <span key={u.business_id}>{u.business_name}: {money(u.amount)}</span>)}
                </div>
              )}
            </div>
          )}
          {work.payouts.map((p: any, i: number) => (
            <div key={i} className="wk-row">
              <div className="wk-row-main">
                <div className="wk-row-t">{p.business_name}</div>
                <div className="wk-row-s">
                  {p.paid_at ? new Date(p.paid_at).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' }) : ''}
                  {p.appointments ? ` · ${p.appointments} візитів` : ''}
                </div>
              </div>
              <div className="wk-amount">{money(p.amount)}</div>
            </div>
          ))}
        </section>
      )}

      {/* --- Салони --- */}
      <section className="wk-block">
        <div className="wk-title">Мої салони</div>
        <div className="wk-places">
          {work.workplaces.map((w: any) => (
            <div key={w.business_id} className={`wk-place ${w.is_current ? 'current' : ''}`}>
              <div className="wk-place-top">
                <div className="wk-logo">{(w.name || 'B').slice(0, 1).toUpperCase()}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="wk-place-name">{w.name}</div>
                  <div className="wk-row-s">{w.role_label}{w.city ? ` · ${w.city}` : ''}</div>
                </div>
              </div>
              <div className="wk-place-stats">
                <span><b>{w.today}</b> сьогодні</span>
                <span><b>{w.visits_30d}</b> за місяць</span>
              </div>
              <button type="button" className="wk-open" disabled={opening !== null} onClick={() => void openCabinet(w.business_id)}>
                {opening === w.business_id ? 'Відкриваємо…' : 'Відкрити кабінет'}
              </button>
            </div>
          ))}
        </div>
      </section>

      <style jsx>{`
        .wk { display: flex; flex-direction: column; gap: 1.25rem; }
        .wk-empty { padding: 3rem 1rem; text-align: center; color: #86868B; }
        .wk-next { padding: 1.6rem 1.75rem; border-radius: 22px; background: #1D1D1F; color: #fff; }
        .wk-label { font-size: 0.8125rem; font-weight: 600; color: #C2D8C4; }
        .wk-next-time { font-size: 2rem; font-weight: 700; letter-spacing: -0.035em; margin: 0.35rem 0 0.2rem; }
        .wk-next-what { font-size: 1rem; color: rgba(255,255,255,.9); }
        .wk-next-where { font-size: 0.875rem; color: rgba(255,255,255,.6); margin-top: 0.15rem; }
        .wk-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; }
        .wk-stats > div { padding: 1rem 1.1rem; border-radius: 16px; background: #F5F5F7; display: flex; flex-direction: column; }
        .wk-stats small { font-size: 0.75rem; color: #86868B; }
        .wk-stats b { font-size: 1.35rem; font-weight: 700; letter-spacing: -0.02em; color: #1D1D1F; margin-top: 0.2rem; font-variant-numeric: tabular-nums; }
        .wk-stats em { font-style: normal; font-size: 0.72rem; color: #86868B; margin-top: 0.1rem; }
        .wk-block { border: 1px solid #EDEDF0; border-radius: 20px; padding: 1.25rem 1.4rem; }
        .wk-title { font-size: 1rem; font-weight: 700; color: #1D1D1F; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: baseline; }
        .wk-count { font-size: 0.8125rem; font-weight: 500; color: #86868B; }
        .wk-hint { font-size: 0.9rem; color: #86868B; }
        .wk-chart { display: grid; grid-template-columns: repeat(14, 1fr); gap: 0.35rem; height: 110px; }
        .wk-col { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; }
        .wk-col span { font-size: 0.65rem; color: #AEAEB2; font-variant-numeric: tabular-nums; }
        .wk-bar-wrap { flex: 1; width: 100%; display: flex; align-items: flex-end; }
        .wk-bar { width: 100%; border-radius: 5px 5px 2px 2px; background: #C2D8C4; transition: height .6s cubic-bezier(.16,1,.3,1); }
        .wk-bar.now { background: #6F9273; }
        .wk-row { display: flex; align-items: center; gap: 1rem; padding: 0.65rem 0; border-top: 1px solid #F5F5F7; }
        .wk-row:first-of-type { border-top: none; }
        .wk-row.past { opacity: 0.45; }
        .wk-time { width: 3.2rem; font-size: 0.975rem; font-weight: 600; color: #1D1D1F; font-variant-numeric: tabular-nums; }
        .wk-row-main { flex: 1; min-width: 0; }
        .wk-row-t { font-size: 0.925rem; font-weight: 500; color: #1D1D1F; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .wk-row-s { font-size: 0.8rem; color: #86868B; }
        .wk-amount { font-size: 0.975rem; font-weight: 600; color: #1D1D1F; font-variant-numeric: tabular-nums; }
        .wk-unpaid { padding: 1rem 1.1rem; border-radius: 14px; background: #F4FAF5; margin-bottom: 0.5rem; display: flex; flex-direction: column; }
        .wk-unpaid small { font-size: 0.78rem; color: #5C7A61; font-weight: 600; }
        .wk-unpaid b { font-size: 1.6rem; font-weight: 700; color: #2E3A30; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
        .wk-unpaid-list { display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.8rem; color: #4A5A4D; margin-top: 0.3rem; }
        .wk-places { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 0.75rem; }
        .wk-place { border-radius: 16px; background: #F5F5F7; padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
        .wk-place.current { box-shadow: inset 0 0 0 2px #C2D8C4; }
        .wk-place-top { display: flex; align-items: center; gap: 0.7rem; }
        .wk-logo { width: 38px; height: 38px; border-radius: 11px; background: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #1D1D1F; flex-shrink: 0; }
        .wk-place-name { font-size: 0.95rem; font-weight: 600; color: #1D1D1F; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .wk-place-stats { display: flex; gap: 1rem; font-size: 0.8rem; color: #6E6E73; }
        .wk-place-stats b { color: #1D1D1F; }
        .wk-open { height: 36px; border-radius: 10px; border: none; background: #1D1D1F; color: #fff; font-family: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
        .wk-open:disabled { opacity: 0.5; cursor: default; }
        @media (max-width: 720px) { .wk-stats { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
    </div>
  );
}
