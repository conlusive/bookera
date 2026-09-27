'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';

/**
 * «Запити» майстра до салону: змінити графік чи відпустка/лікарняний.
 * Майстер просить - власник погоджує в «Команді», і зміна застосовується
 * сама. Мова оформлення - як у «Аналітиці» й «Заробітку».
 */

const C = { text: '#1d1d1f', sub: '#86868b', border: '#e5e5ea', green: '#10b981' };
const DAYS = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця', 'Субота', 'Неділя'];
const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const REASONS = [{ id: 'vacation', label: 'Відпустка' }, { id: 'sick', label: 'Лікарняний' }, { id: 'other', label: 'Особисті справи' }];
const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  pending: { label: 'Очікує рішення', bg: '#FBF3E4', fg: '#8A6516' },
  approved: { label: 'Погоджено', bg: '#E8F7EF', fg: '#0F7A4B' },
  declined: { label: 'Відхилено', bg: '#FCEDEC', fg: '#B42318' },
  cancelled: { label: 'Відкликано', bg: '#F5F5F7', fg: '#86868b' },
};

const d = (iso: string) => { const x = new Date(`${iso.slice(0, 10)}T12:00:00`); return `${x.getDate()} ${MONTHS_GEN[x.getMonth()]}`; };
const pad = (n: number) => String(n).padStart(2, '0');
const todayIso = () => { const t = new Date(); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };

export default function MasterRequests({ businessId }: { businessId: number }) {
  const [list, setList] = useState<any[] | null>(null);
  const [mode, setMode] = useState<null | 'schedule' | 'time_off'>(null);
  const [shifts, setShifts] = useState<any[] | null>(null);
  const [off, setOff] = useState({ from: todayIso(), to: todayIso(), reason: 'vacation' });
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const t = await getAuthToken();
    setList(await api.listMyRequests(t, businessId).catch(() => []));
  }, [businessId]);
  useEffect(() => { void load(); }, [load]);

  const open = async (m: 'schedule' | 'time_off') => {
    setError(''); setComment('');
    if (mode === m) { setMode(null); return; }
    setMode(m);
    if (m === 'schedule' && !shifts) {
      const t = await getAuthToken();
      const r = await api.getMyShifts(t, businessId).catch(() => null);
      setShifts(r?.shifts || DAYS.map((day, i) => ({ day, active: i < 6, start: '09:00', end: '20:00' })));
    }
  };

  const send = async () => {
    setBusy(true); setError('');
    try {
      const t = await getAuthToken();
      await api.createStaffRequest(t, mode === 'schedule'
        ? { business_id: businessId, kind: 'schedule', shifts, comment: comment.trim() || undefined }
        : { business_id: businessId, kind: 'time_off', date_from: off.from, date_to: off.to, reason: off.reason, comment: comment.trim() || undefined });
      setMode(null);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Не вдалося надіслати');
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (id: number) => {
    const t = await getAuthToken();
    await api.cancelStaffRequest(t, id).catch(() => null);
    await load();
  };

  const pending = (list || []).filter(r => r.status === 'pending').length;

  return (
    <div className="rq">
      <div className="rq-header">
        <h2>Запити</h2>
        {pending > 0 && <div className="rq-pill">{pending} очікує рішення</div>}
      </div>
      <p className="rq-lead">Попросіть салон змінити графік чи дати вільні дні. Щойно власник погодить — зміни застосуються самі, а ви отримаєте лист.</p>

      <div className="rq-actions">
        {([
          { id: 'schedule', title: 'Змінити графік', text: 'Інші дні чи години роботи', icon: 'M8 2.5v4M16 2.5v4M3 9.5h18M5 4.5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2z' },
          { id: 'time_off', title: 'Відпустка чи лікарняний', text: 'Закрити дні для запису', icon: 'M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z' },
        ] as const).map(a => (
          <button key={a.id} type="button" className={`rq-action ${mode === a.id ? 'on' : ''}`} onClick={() => void open(a.id)}>
            <span className="rq-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={a.icon} /></svg></span>
            <span><b>{a.title}</b><small>{a.text}</small></span>
          </button>
        ))}
      </div>

      {mode && (
        <section className="rq-card rq-form">
          {mode === 'schedule' ? (
            <>
              <div className="rq-card-title">Бажаний графік</div>
              <div className="rq-sub">Змініть дні й години — салон побачить саме цей тиждень.</div>
              {(shifts || []).map((s, i) => (
                <div key={i} className="rq-shift">
                  <button type="button" role="switch" aria-checked={s.active} className={`rq-switch ${s.active ? 'on' : ''}`}
                    onClick={() => setShifts(p => p!.map((x, k) => k === i ? { ...x, active: !x.active } : x))}><i /></button>
                  <span className="rq-day" style={{ color: s.active ? C.text : C.sub }}>{DAYS[i]}</span>
                  {s.active ? (
                    <span className="rq-times">
                      <input type="time" value={s.start} onChange={e => setShifts(p => p!.map((x, k) => k === i ? { ...x, start: e.target.value } : x))} />
                      <em>–</em>
                      <input type="time" value={s.end} onChange={e => setShifts(p => p!.map((x, k) => k === i ? { ...x, end: e.target.value } : x))} />
                    </span>
                  ) : <span className="rq-sub" style={{ margin: 0 }}>Вихідний</span>}
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="rq-card-title">Вільні дні</div>
              <div className="rq-seg">
                {REASONS.map(r => (
                  <button key={r.id} type="button" className={off.reason === r.id ? 'on' : ''} onClick={() => setOff(o => ({ ...o, reason: r.id }))}>{r.label}</button>
                ))}
              </div>
              <div className="rq-dates">
                <label>З<input type="date" value={off.from} min={todayIso()} onChange={e => setOff(o => ({ ...o, from: e.target.value, to: o.to < e.target.value ? e.target.value : o.to }))} /></label>
                <label>По<input type="date" value={off.to} min={off.from} onChange={e => setOff(o => ({ ...o, to: e.target.value }))} /></label>
              </div>
            </>
          )}
          <textarea className="rq-note" rows={2} value={comment} onChange={e => setComment(e.target.value.slice(0, 500))} placeholder="Коментар для власника (необовʼязково)" />
          {error && <div className="rq-err">{error}</div>}
          <div className="rq-form-actions">
            <button type="button" className="rq-btn ghost" onClick={() => setMode(null)}>Скасувати</button>
            <button type="button" className="rq-btn" disabled={busy} onClick={() => void send()}>{busy ? 'Надсилаємо…' : 'Надіслати запит'}</button>
          </div>
        </section>
      )}

      <section className="rq-card">
        <div className="rq-card-title">Мої запити</div>
        {list === null ? <div className="rq-sub">Завантаження…</div> : list.length === 0 ? (
          <div className="rq-sub">Запитів ще не було.</div>
        ) : list.map(r => {
          const st = STATUS[r.status] || STATUS.pending;
          const title = r.kind === 'schedule' ? 'Зміна графіка' : (REASONS.find(x => x.id === r.payload?.reason)?.label || 'Відпустка');
          const detail = r.kind === 'time_off'
            ? (r.payload.date_from === r.payload.date_to ? d(r.payload.date_from) : `${d(r.payload.date_from)} – ${d(r.payload.date_to)}`)
            : (r.payload.shifts || []).filter((s: any) => s.active).map((s: any) => `${s.day.slice(0, 2)} ${s.start}–${s.end}`).join(', ') || 'Усі дні вихідні';
          return (
            <div key={r.id} className="rq-row">
              <div className="rq-row-main">
                <b>{title}</b>
                <span>{detail}</span>
                {r.comment && <span className="rq-quote">Ви: «{r.comment}»</span>}
                {r.response_note && <span className="rq-quote">Салон: «{r.response_note}»</span>}
              </div>
              <div className="rq-row-side">
                <span className="rq-chip" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                <span className="rq-date">{d(r.created_at)}</span>
                {r.status === 'pending' && <button type="button" className="rq-link" onClick={() => void withdraw(r.id)}>Відкликати</button>}
              </div>
            </div>
          );
        })}
      </section>

      <style jsx>{`
        .rq { padding: 1.5rem 3rem; background: #fff; min-height: 100vh; width: 100%; box-sizing: border-box; color: ${C.text}; }
        .rq-header { display: flex; align-items: center; gap: 1rem; margin: 0.5rem 0 0.5rem; }
        .rq-header h2 { font-size: 1.75rem; font-weight: 700; margin: 0; letter-spacing: -0.3px; }
        .rq-pill { font-size: 0.8rem; font-weight: 600; padding: 4px 10px; border-radius: 999px; background: #FBF3E4; color: #8A6516; }
        .rq-lead { color: ${C.sub}; font-size: 0.95rem; margin: 0 0 1.5rem; max-width: 640px; line-height: 1.5; }
        .rq-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 360px)); gap: 1rem; margin-bottom: 1.25rem; }
        .rq-action { display: flex; align-items: center; gap: 0.9rem; text-align: left; padding: 1.1rem 1.2rem; border-radius: 16px; border: 1px solid ${C.border}; background: #fff; cursor: pointer; font-family: inherit; transition: border-color .15s, background-color .15s; }
        .rq-action:hover { background: #fafafa; }
        .rq-action.on { border-color: ${C.text}; }
        .rq-ico { width: 42px; height: 42px; border-radius: 12px; background: #f5f5f7; display: flex; align-items: center; justify-content: center; color: ${C.text}; flex-shrink: 0; }
        .rq-action b { display: block; font-size: 0.975rem; font-weight: 600; color: ${C.text}; }
        .rq-action small { display: block; font-size: 0.82rem; color: ${C.sub}; margin-top: 2px; }
        .rq-card { background: #fff; border: 1px solid ${C.border}; border-radius: 16px; padding: 1.25rem 1.4rem; margin-bottom: 1.25rem; max-width: 760px; }
        .rq-card-title { font-size: 1.05rem; font-weight: 700; }
        .rq-sub { font-size: 0.85rem; color: ${C.sub}; margin: 0.2rem 0 0.9rem; }
        .rq-shift { display: grid; grid-template-columns: 40px 130px 1fr; align-items: center; gap: 0.75rem; padding: 0.45rem 0; border-top: 1px solid #f2f2f4; }
        .rq-shift:first-of-type { border-top: none; }
        .rq-day { font-size: 0.9rem; font-weight: 500; }
        .rq-switch { width: 40px; height: 22px; border-radius: 12px; border: none; background: #e2e8f0; position: relative; cursor: pointer; padding: 0; transition: background-color .2s; }
        .rq-switch i { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.18); transition: left .2s; }
        .rq-switch.on { background: ${C.green}; }
        .rq-switch.on i { left: 20px; }
        .rq-times { display: flex; align-items: center; gap: 0.4rem; }
        .rq-times em { font-style: normal; color: ${C.sub}; }
        input[type='time'], input[type='date'] { height: 36px; padding: 0 0.6rem; border-radius: 9px; border: 1px solid ${C.border}; font-family: inherit; font-size: 0.875rem; color: ${C.text}; background: #fff; outline: none; }
        input:focus, textarea:focus { border-color: ${C.text}; }
        .rq-seg { display: inline-flex; background: #f2f2f7; border-radius: 9px; padding: 2px; margin: 0.8rem 0 1rem; }
        .rq-seg button { border: none; background: transparent; padding: 6px 14px; border-radius: 7px; font-family: inherit; font-size: 0.85rem; color: ${C.text}; cursor: pointer; }
        .rq-seg button.on { background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.1); font-weight: 600; }
        .rq-dates { display: flex; gap: 1rem; flex-wrap: wrap; }
        .rq-dates label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.78rem; font-weight: 600; color: ${C.sub}; }
        .rq-note { width: 100%; box-sizing: border-box; margin-top: 1rem; padding: 0.7rem 0.8rem; border-radius: 10px; border: 1px solid ${C.border}; font-family: inherit; font-size: 0.9rem; resize: vertical; outline: none; }
        .rq-err { color: #d70015; font-size: 0.85rem; margin-top: 0.6rem; }
        .rq-form-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
        .rq-btn { height: 38px; padding: 0 1.1rem; border-radius: 10px; border: none; background: ${C.text}; color: #fff; font-family: inherit; font-size: 0.875rem; font-weight: 600; cursor: pointer; }
        .rq-btn:disabled { opacity: .45; }
        .rq-btn.ghost { background: #fff; color: ${C.text}; border: 1px solid ${C.border}; }
        .rq-row { display: flex; justify-content: space-between; gap: 1rem; padding: 0.9rem 0; border-top: 1px solid #f2f2f4; }
        .rq-card-title + .rq-row { margin-top: 0.6rem; border-top: none; }
        .rq-row-main { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
        .rq-row-main b { font-size: 0.95rem; font-weight: 600; }
        .rq-row-main span { font-size: 0.85rem; color: ${C.sub}; }
        .rq-quote { font-style: italic; }
        .rq-row-side { display: flex; flex-direction: column; align-items: flex-end; gap: 0.3rem; flex-shrink: 0; }
        .rq-chip { font-size: 0.75rem; font-weight: 600; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
        .rq-date { font-size: 0.75rem; color: ${C.sub}; }
        .rq-link { border: none; background: none; color: ${C.sub}; font-family: inherit; font-size: 0.8rem; font-weight: 600; cursor: pointer; padding: 0; }
        .rq-link:hover { color: #d70015; }
        @media (max-width: 760px) { .rq { padding: 1.25rem 1rem; } .rq-actions { grid-template-columns: 1fr; } .rq-shift { grid-template-columns: 40px 1fr; } .rq-times { grid-column: 2; } }
      `}</style>
    </div>
  );
}
