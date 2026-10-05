'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { kyivNow } from '@/lib/salon-time';

/**
 * «Моя робота» - швидкий вхід у кабінети.
 *
 * Календар, клієнти, виручка й виплати вже є в кабінеті майстра, тому тут
 * лише те, що потрібно, щоб одним натисканням потрапити в потрібний салон:
 * список закладів, у яких ви працюєте, із короткою довідкою (сьогодні, наступний
 * клієнт, за 30 днів, що до виплати). Увесь рядок - кнопка входу.
 */
const money = (n: number) => `${Math.round(n || 0).toLocaleString('uk-UA')} ₴`;
const hhmm = (iso: string) => iso.slice(11, 16);
const plural = (n: number, one: string, few: string, many: string) =>
  n % 10 === 1 && n % 100 !== 11 ? one : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? few : many;

export default function WorkDashboard({ getToken, firstName }: { getToken: () => Promise<string | null>; firstName?: string }) {
  const router = useRouter();
  const [work, setWork] = useState<any | null>(null);
  const [error, setError] = useState(false);
  const [opening, setOpening] = useState<number | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

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

  const openCabinet = async (id: number) => {
    if (opening !== null) return;
    setOpening(id);
    try {
      const token = await getToken();
      if (!token) return;
      await api.switchWorkplace(token, id);
      try { localStorage.setItem('bookera_active_biz_id', String(id)); } catch { /* */ }
      router.push('/cabinet');
    } catch {
      setOpening(null);
    }
  };

  if (error) return <div className="wk-empty">Не вдалося завантажити. Оновіть сторінку.</div>;
  if (!work) return <div className="wk-empty">Завантаження…</div>;
  const places: any[] = work.workplaces || [];
  if (places.length === 0) return <div className="wk-empty">Ви ще не працюєте в жодному закладі.</div>;

  // Найближчий запис кожного салону: сьогодні після «зараз», інакше з найближчих днів
  const nowStamp = (() => {
    if (!now) return '';
    const k = kyivNow(now);
    return `${k.key}T${String(Math.floor(k.minutes / 60)).padStart(2, '0')}:${String(k.minutes % 60).padStart(2, '0')}`;
  })();
  const todayKey = nowStamp.slice(0, 10);
  const nextOf = (id: number) =>
    nowStamp ? [...(work.today || []), ...(work.later || [])].find((a: any) => a.business_id === id && a.start_time.slice(0, 16) >= nowStamp) : null;
  const dueOf = (id: number) => (work.unpaid || []).filter((u: any) => u.business_id === id).reduce((s: number, u: any) => s + u.amount, 0);

  return (
    <div className="wk">
      <header>
        <h1>Моя робота</h1>
        <p>{firstName ? `${firstName}, оберіть` : 'Оберіть'}, у який кабінет перейти</p>
      </header>

      <ul className="wk-list">
        {places.map(p => {
          const next = nextOf(p.business_id);
          const due = dueOf(p.business_id);
          return (
            <li key={p.business_id} className="wk-card">
              <div className="wk-top">
                <span className="wk-logo">{p.logo ? <img src={p.logo} alt="" /> : (p.name || 'B').slice(0, 1).toUpperCase()}</span>
                <span className="wk-main">
                  <span className="wk-name">{p.name}{p.is_current && <em>поточний</em>}</span>
                  <span className="wk-sub">{[p.role_label, p.city].filter(Boolean).join(' · ')}</span>
                </span>
                <button type="button" className="wk-go" disabled={opening !== null} onClick={() => void openCabinet(p.business_id)}>
                  {opening === p.business_id ? 'Відкриваємо…' : 'Відкрити кабінет'}
                </button>
              </div>
              <div className="wk-facts">
                <div><small>Сьогодні</small><b>{p.today} {plural(p.today, 'запис', 'записи', 'записів')}</b></div>
                <div>
                  <small>Наступний</small>
                  <b>{next ? `${next.start_time.slice(0, 10) === todayKey ? '' : `${Number(next.start_time.slice(8, 10))}.${next.start_time.slice(5, 7)} `}${hhmm(next.start_time)}${next.client_name ? ` · ${next.client_name}` : ''}` : '—'}</b>
                </div>
                <div><small>За 30 днів</small><b>{p.visits_30d} {plural(p.visits_30d, 'візит', 'візити', 'візитів')}{p.revenue_30d ? ` · ${money(p.revenue_30d)}` : ''}</b></div>
                {due > 0 && <div><small>До виплати</small><b>{money(due)}</b></div>}
              </div>
            </li>
          );
        })}
      </ul>

      <style jsx>{`
        .wk { font-family: inherit; color: #111827; }
        .wk-empty { padding: 4rem 1rem; text-align: center; color: #94a3b8; }
        header { margin-bottom: 1.6rem; }
        h1 { margin: 0; font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; color: #0f172a; }
        header p { margin: 0.35rem 0 0; font-size: 0.92rem; color: #64748b; }
        .wk-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1rem; }
        .wk-card { background: #fff; border: 1px solid #eef0f3; border-radius: 24px; padding: 1.4rem 1.5rem 1.5rem; box-shadow: 0 2px 14px rgba(15, 23, 42, 0.03); }
        .wk-top { display: flex; align-items: center; gap: 1rem; }
        .wk-logo { width: 52px; height: 52px; border-radius: 16px; background: #f1f5f9; color: #0f172a; display: flex; align-items: center; justify-content: center; font-size: 1.15rem; font-weight: 800; flex: none; overflow: hidden; }
        .wk-logo img { width: 100%; height: 100%; object-fit: cover; }
        .wk-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.15rem; }
        .wk-name { font-size: 1.1rem; font-weight: 700; letter-spacing: -0.015em; color: #0f172a; display: flex; align-items: center; gap: 0.55rem; }
        .wk-name em { font-style: normal; font-size: 0.7rem; font-weight: 700; color: #4b6b50; background: #edf4ee; padding: 2px 9px; border-radius: 999px; }
        .wk-sub { font-size: 0.85rem; color: #94a3b8; }
        .wk-go { flex: none; height: 40px; padding: 0 1.3rem; border: none; border-radius: 999px; background: #c2d8c4; color: #1d2b1f; font-family: inherit; font-size: 0.875rem; font-weight: 700; cursor: pointer; transition: background .15s ease; }
        .wk-go:hover:not(:disabled) { background: #b3cdb6; }
        .wk-go:disabled { opacity: 0.6; cursor: default; }
        .wk-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.6rem; margin-top: 1.2rem; }
        .wk-facts > div { background: #f8fafb; border-radius: 14px; padding: 0.75rem 0.95rem; display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
        .wk-facts small { font-size: 0.72rem; font-weight: 600; color: #94a3b8; }
        .wk-facts b { font-size: 0.92rem; font-weight: 700; color: #0f172a; font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        @media (max-width: 640px) {
          .wk-top { flex-wrap: wrap; }
          .wk-go { width: 100%; }
        }
      `}</style>
    </div>
  );
}
