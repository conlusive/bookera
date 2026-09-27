'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';

/**
 * «Моя робота» - тією самою мовою, що й решта кабінету.
 *
 * Попередні версії малювались окремо від кабінету: власний фон, власні
 * заголовки й кольори - і виглядали вставкою з іншого сайту. Тепер
 * еталон - вкладка «Аналітика»: заголовок 1.75rem, навігатор дати в
 * тонкій рамці, білі картки з рамкою #e5e5ea і радіусом 16px, палітра
 * #1d1d1f / #86868b.
 *
 * Гроші - в окремій вкладці «Заробіток»: розклад відкривають кілька
 * разів на день, заробіток - раз на тиждень.
 *
 * Розклад - списком, як у Booksy: час, кольорова смужка статусу,
 * послуга й клієнт, ціна. Вільні вікна між записами - окремими рядками,
 * які можна закрити одним натиском.
 */

const C = {
  text: '#1d1d1f',
  sub: '#86868b',
  border: '#e5e5ea',
  soft: '#f5f5f7',
  accent: '#1d1d1f',
  green: '#6F9273',
};

const MONTHS = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'];
const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const WD_LONG = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця', 'Субота', 'Неділя'];

const STATUS: Record<string, { bar: string; label: string }> = {
  confirmed: { bar: '#6F9273', label: 'Підтверджено' },
  pending_approval: { bar: '#E0A63A', label: 'Чекає підтвердження' },
  completed: { bar: '#C7C7CC', label: 'Завершено' },
  'no-show': { bar: '#E0645C', label: 'Не прийшов' },
};

const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k: string) => new Date(`${k}T12:00:00`);
const mondayOf = (d: Date) => { const x = new Date(d); x.setDate(d.getDate() - ((d.getDay() + 6) % 7)); x.setHours(12, 0, 0, 0); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(d.getDate() + n); return x; };
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
const minOf = (iso: string) => toMin(iso.slice(11, 16));
const fmt = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const money = (n: number) => `${Math.round(n).toLocaleString('uk-UA')} ₴`;
const plural = (n: number, a: string, b: string, c: string) =>
  n % 10 === 1 && n % 100 !== 11 ? a : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? b : c;

type Row =
  | { kind: 'visit'; a: any; s: number; e: number }
  | { kind: 'off'; a: any; s: number; e: number }
  | { kind: 'free'; s: number; e: number }
  | { kind: 'now'; s: number };

export default function MasterWorkspace({ businessId }: { businessId: number; userName?: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  const todayKey = keyOf(now);

  const [selected, setSelected] = useState(todayKey);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [monthView, setMonthView] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));

  const [work, setWork] = useState<any>(null);
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [agenda, setAgenda] = useState<any[] | null>(null);
  const [shifts, setShifts] = useState<any[] | null>(null);
  const [shiftSource, setShiftSource] = useState<'master' | 'salon'>('salon');

  const [form, setForm] = useState<{ from: string; to: string; note: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const flash = (text: string, ok = true) => { setToast({ text, ok }); setTimeout(() => setToast(t => (t?.text === text ? null : t)), 2500); };

  const call = useCallback(async <T,>(fn: (t: string) => Promise<T>) => fn(await getAuthToken()), []);

  useEffect(() => {
    void call(t => api.getMyWork(t, businessId)).then(setWork).catch(() => setWork({}));
    void call(t => api.getMyShifts(t, businessId)).then(r => { setShifts(r.shifts); setShiftSource(r.source); }).catch(() => setShifts([]));
  }, [businessId, call]);

  const sel = fromKey(selected);
  const weekStart = mondayOf(sel);

  useEffect(() => {
    const months = new Set([keyOf(weekStart).slice(0, 7), keyOf(addDays(weekStart, 6)).slice(0, 7), `${monthView.getFullYear()}-${pad(monthView.getMonth() + 1)}`]);
    months.forEach(m => void call(t => api.getMyCalendar(t, businessId, m)).then(r => setMarks(p => ({ ...p, ...r }))).catch(() => {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, keyOf(weekStart), monthView, call]);

  const loadAgenda = useCallback(() => {
    setAgenda(null);
    void call(t => api.getMyAgenda(t, businessId, selected)).then(setAgenda).catch(() => setAgenda([]));
  }, [businessId, selected, call]);
  useEffect(() => { loadAgenda(); setForm(null); }, [loadAgenda]);

  const go = (k: string) => { setSelected(k); setPickerOpen(false); };

  // --- День ---
  const weekday = (sel.getDay() + 6) % 7;
  const shift = shifts?.[weekday];
  const visits = (agenda || []).filter(a => a.status !== 'time_off');
  const expected = visits.filter(a => a.status !== 'no-show').reduce((s, a) => s + (a.price || 0), 0);
  const isToday = selected === todayKey;
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // Рядки розкладу: записи, особистий час, вільні вікна (від години) і «зараз»
  const rows: Row[] = useMemo(() => {
    if (!agenda) return [];
    const items = agenda.map(a => ({ a, s: minOf(a.start_time), e: a.end_time ? minOf(a.end_time) : minOf(a.start_time) + 60 }))
      .sort((x, y) => x.s - y.s);
    const out: Row[] = [];
    let cursor = shift?.active ? toMin(shift.start) : (items[0]?.s ?? 0);
    const dayEnd = shift?.active ? toMin(shift.end) : (items.length ? items[items.length - 1].e : 0);
    if (isToday) cursor = Math.max(cursor, Math.ceil(nowMin / 30) * 30);
    for (const it of items) {
      if (shift?.active && it.s - cursor >= 60) out.push({ kind: 'free', s: cursor, e: it.s });
      out.push({ kind: it.a.status === 'time_off' ? 'off' : 'visit', a: it.a, s: it.s, e: it.e });
      cursor = Math.max(cursor, it.e);
    }
    if (shift?.active && dayEnd - cursor >= 60) out.push({ kind: 'free', s: cursor, e: dayEnd });
    if (isToday) {
      const i = out.findIndex(r => r.s > nowMin);
      const marker: Row = { kind: 'now', s: nowMin };
      if (i === -1) out.push(marker); else out.splice(i, 0, marker);
    }
    return out;
  }, [agenda, shift, isToday, nowMin]);

  const save = async () => {
    if (!form) return;
    setBusy(true);
    try {
      await call(t => api.addTimeOff(t, { business_id: businessId, start_time: `${selected}T${form.from}:00`, end_time: `${selected}T${form.to}:00`, note: form.note.trim() || undefined }));
      setForm(null);
      loadAgenda();
      flash('Час закрито для записів');
    } catch (e: any) {
      flash(e?.message || 'Не вдалося зберегти', false);
    } finally {
      setBusy(false);
    }
  };

  const reopen = async (id: number) => {
    try { await call(t => api.removeTimeOff(t, id)); loadAgenda(); flash('Час знову відкритий'); }
    catch (e: any) { flash(e?.message || 'Не вдалося', false); }
  };

  const s30 = work?.stats_30d || {};

  const monthCells = useMemo(() => {
    const first = new Date(monthView.getFullYear(), monthView.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7;
    const days = new Date(monthView.getFullYear(), monthView.getMonth() + 1, 0).getDate();
    const out: (Date | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= days; d++) out.push(new Date(monthView.getFullYear(), monthView.getMonth(), d, 12));
    while (out.length % 7) out.push(null);
    return out;
  }, [monthView]);

  const dateLabel = isToday ? `Сьогодні, ${sel.getDate()} ${MONTHS_GEN[sel.getMonth()]}` : `${WD_LONG[weekday]}, ${sel.getDate()} ${MONTHS_GEN[sel.getMonth()]}`;

  return (
    <div className="mw">
      {/* Шапка - як в «Аналітиці» */}
      <div className="mw-header">
        <h2>Моя робота</h2>
        <div className="mw-nav-wrap">
          {!isToday && <button type="button" className="mw-today" onClick={() => go(todayKey)}>Сьогодні</button>}
          <div className="mw-nav">
            <button type="button" aria-label="Попередній день" onClick={() => go(keyOf(addDays(sel, -1)))}>‹</button>
            <div className="mw-nav-label" onClick={() => { setMonthView(new Date(sel.getFullYear(), sel.getMonth(), 1)); setPickerOpen(o => !o); }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" strokeLinecap="round"><rect x="3" y="4.5" width="18" height="16" rx="3" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></svg>
              <span>{dateLabel}</span>
            </div>
            <button type="button" aria-label="Наступний день" onClick={() => go(keyOf(addDays(sel, 1)))}>›</button>
          </div>
          {pickerOpen && (
            <div className="mw-picker">
              <div className="mw-picker-head">
                <button type="button" onClick={() => setMonthView(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>‹</button>
                <span>{MONTHS[monthView.getMonth()]} {monthView.getFullYear()}</span>
                <button type="button" onClick={() => setMonthView(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>›</button>
              </div>
              <div className="mw-picker-grid">
                {WD.map(w => <span key={w} className="mw-picker-wd">{w}</span>)}
                {monthCells.map((d, i) => d ? (
                  <button key={i} type="button" onClick={() => go(keyOf(d))}
                    className={`mw-picker-day ${keyOf(d) === selected ? 'sel' : ''} ${keyOf(d) === todayKey ? 'today' : ''}`}>
                    {d.getDate()}{marks[keyOf(d)] ? <i /> : null}
                  </button>
                ) : <span key={i} />)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Тиждень */}
      <div className="mw-week">
        {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d, i) => {
          const k = keyOf(d);
          const off = shifts?.[i] && !shifts[i].active;
          return (
            <button key={k} type="button" onClick={() => go(k)} className={`mw-wday ${k === selected ? 'sel' : ''} ${k === todayKey ? 'today' : ''} ${off ? 'off' : ''}`}>
              <span className="mw-wd">{WD[i]}</span>
              <span className="mw-dn">{d.getDate()}</span>
              <span className="mw-cnt">{marks[k] ? `${marks[k]} ${plural(marks[k], 'запис', 'записи', 'записів')}` : off ? 'вихідний' : ' '}</span>
            </button>
          );
        })}
      </div>

      {/* Показники */}
      <div className="mw-kpis">
        <div className="mw-kpi"><div className="mw-kpi-l">Записів у цей день</div><div className="mw-kpi-v">{agenda ? visits.length : '—'}</div></div>
        <div className="mw-kpi"><div className="mw-kpi-l">Очікувана виручка</div><div className="mw-kpi-v">{agenda ? money(expected) : '—'}</div></div>
        <div className="mw-kpi"><div className="mw-kpi-l">Візитів за 30 днів</div><div className="mw-kpi-v">{work ? s30.visits ?? 0 : '—'}</div><div className="mw-kpi-s">{work && s30.avg_check ? `середній чек ${money(s30.avg_check)}` : ' '}</div></div>
        <div className="mw-kpi"><div className="mw-kpi-l">Рейтинг</div><div className="mw-kpi-v">{work?.rating ? `${work.rating} ★` : '—'}</div><div className="mw-kpi-s">{work?.reviews ? `${work.reviews} ${plural(work.reviews, 'відгук', 'відгуки', 'відгуків')}` : 'поки без відгуків'}</div></div>
      </div>

      <div className="mw-grid">
        {/* Розклад */}
        <section className="mw-card">
          <div className="mw-card-head">
            <div>
              <div className="mw-card-title">Розклад</div>
              <div className="mw-card-sub">{shift ? (shift.active ? `Зміна ${shift.start} – ${shift.end}` : 'Вихідний за графіком') : ' '}</div>
            </div>
            <button type="button" className="mw-btn-outline" onClick={() => setForm(f => f ? null : { from: shift?.active ? shift.start : '13:00', to: shift?.active ? fmt(toMin(shift.start) + 60) : '14:00', note: '' })}>
              {form ? 'Скасувати' : 'Закрити час'}
            </button>
          </div>

          {form && (
            <div className="mw-form">
              <input type="time" value={form.from} onChange={e => setForm(f => f && { ...f, from: e.target.value })} aria-label="З" />
              <span className="mw-dash">–</span>
              <input type="time" value={form.to} onChange={e => setForm(f => f && { ...f, to: e.target.value })} aria-label="До" />
              <input className="mw-form-note" value={form.note} onChange={e => setForm(f => f && { ...f, note: e.target.value.slice(0, 120) })} placeholder="Причина: обід, лікар…" />
              <button type="button" className="mw-btn" onClick={() => void save()} disabled={busy || form.to <= form.from}>{busy ? '…' : 'Закрити'}</button>
            </div>
          )}

          <div className="mw-list">
            {agenda === null && <div className="mw-empty">Завантаження…</div>}
            {agenda !== null && rows.filter(r => r.kind !== 'now').length === 0 && (
              <div className="mw-empty">{shift && !shift.active ? 'Вихідний день' : 'Записів немає'}</div>
            )}
            {rows.map((r, i) => {
              if (r.kind === 'now') return (
                <div key={`now-${i}`} className="mw-now"><span>{fmt(r.s)}</span><i /></div>
              );
              if (r.kind === 'free') return (
                <button key={`free-${r.s}`} type="button" className="mw-row mw-free" onClick={() => setForm({ from: fmt(r.s), to: fmt(Math.min(r.s + 60, r.e)), note: '' })}>
                  <div className="mw-time"><b>{fmt(r.s)}</b><span>{fmt(r.e)}</span></div>
                  <span className="mw-bar" style={{ background: 'transparent', borderLeft: `2px dashed ${C.border}` }} />
                  <div className="mw-main"><div className="mw-title" style={{ color: C.sub, fontWeight: 500 }}>Вільно</div></div>
                  <div className="mw-side-txt">Закрити</div>
                </button>
              );
              if (r.kind === 'off') return (
                <div key={r.a.id} className="mw-row mw-off">
                  <div className="mw-time"><b>{fmt(r.s)}</b><span>{fmt(r.e)}</span></div>
                  <span className="mw-bar" style={{ background: '#d1d1d6' }} />
                  <div className="mw-main">
                    <div className="mw-title">{r.a.client_name || 'Особистий час'}</div>
                    <div className="mw-sub">Закрито для записів</div>
                  </div>
                  <button type="button" className="mw-x" aria-label="Відкрити цей час" onClick={() => void reopen(r.a.id)}>Відкрити</button>
                </div>
              );
              const st = STATUS[r.a.status] || STATUS.confirmed;
              return (
                <div key={r.a.id} className="mw-row">
                  <div className="mw-time"><b>{fmt(r.s)}</b><span>{fmt(r.e)}</span></div>
                  <span className="mw-bar" style={{ background: st.bar }} />
                  <div className="mw-main">
                    <div className="mw-title">{r.a.service_name || 'Візит'}</div>
                    <div className="mw-sub">
                      {r.a.client_name || 'Клієнт'}
                      {r.a.client_phone && <> · <a href={`tel:${r.a.client_phone}`}>{r.a.client_phone}</a></>}
                    </div>
                  </div>
                  <div className="mw-right">
                    {r.a.price != null && <div className="mw-price">{money(r.a.price)}</div>}
                    <div className="mw-status">{st.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="mw-aside">
          <section className="mw-card">
            <div className="mw-card-title">Графік</div>
            <div className="mw-card-sub" style={{ marginBottom: '0.75rem' }}>
              {shiftSource === 'salon' ? 'Години закладу. Змінює салон у «Команді».' : 'Виставив салон у «Команді».'}
            </div>
            {(shifts || []).map((s, i) => (
              <div key={i} className={`mw-shift ${i === weekday ? 'sel' : ''}`}>
                <span className={`mw-switch ${s.active ? 'on' : ''}`} aria-hidden><i /></span>
                <span className="mw-shift-day" style={{ color: s.active ? C.text : C.sub }}>{WD_LONG[i]}</span>
                <span className="mw-shift-time" style={{ color: s.active ? C.text : C.sub }}>{s.active ? `${s.start} – ${s.end}` : 'Вихідний'}</span>
              </div>
            ))}
          </section>

        </aside>
      </div>

      {toast && <div className={`mw-toast ${toast.ok ? '' : 'err'}`} role="status">{toast.text}</div>}

      <style jsx>{`
        .mw { font-family: inherit; padding: 1.5rem 3rem; flex-grow: 1; background: #fff; min-height: 100vh; width: 100%; box-sizing: border-box; color: ${C.text}; }

        .mw-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; margin-top: 0.5rem; gap: 1rem; flex-wrap: wrap; }
        .mw-header h2 { font-size: 1.75rem; font-weight: 700; margin: 0; letter-spacing: -0.3px; }
        .mw-nav-wrap { position: relative; display: flex; align-items: center; gap: 0.6rem; }
        .mw-today { border: none; background: none; color: ${C.green}; font-family: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; padding: 0.4rem 0.2rem; }
        .mw-nav { display: flex; align-items: center; background: #fff; border: 1px solid ${C.border}; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
        .mw-nav button { padding: 8px 12px; border: none; background: transparent; cursor: pointer; font-size: 1rem; color: ${C.sub}; }
        .mw-nav button:first-child { border-right: 1px solid ${C.border}; }
        .mw-nav button:last-child { border-left: 1px solid ${C.border}; }
        .mw-nav button:hover { color: ${C.text}; }
        .mw-nav-label { padding: 8px 16px; font-size: 0.85rem; font-weight: 500; min-width: 200px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; }
        .mw-picker { position: absolute; top: 100%; right: 0; margin-top: 8px; z-index: 40; width: 290px; background: #fff; border: 1px solid ${C.border}; border-radius: 14px; padding: 1rem; box-shadow: 0 12px 32px rgba(0,0,0,0.12); }
        .mw-picker-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; font-weight: 600; font-size: 0.9rem; text-transform: capitalize; }
        .mw-picker-head button { border: none; background: none; cursor: pointer; font-size: 1.1rem; color: ${C.sub}; width: 28px; height: 28px; border-radius: 8px; }
        .mw-picker-head button:hover { background: ${C.soft}; color: ${C.text}; }
        .mw-picker-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
        .mw-picker-wd { text-align: center; font-size: 0.7rem; color: ${C.sub}; padding-bottom: 0.3rem; }
        .mw-picker-day { position: relative; height: 34px; border: none; background: none; border-radius: 8px; font-family: inherit; font-size: 0.85rem; cursor: pointer; color: ${C.text}; }
        .mw-picker-day:hover { background: ${C.soft}; }
        .mw-picker-day.today { color: ${C.green}; font-weight: 700; }
        .mw-picker-day.sel { background: ${C.accent}; color: #fff; font-weight: 600; }
        .mw-picker-day i { position: absolute; left: 50%; bottom: 4px; width: 4px; height: 4px; margin-left: -2px; border-radius: 50%; background: ${C.green}; }
        .mw-picker-day.sel i { background: #fff; }

        .mw-week { display: grid; grid-template-columns: repeat(7, 1fr); border: 1px solid ${C.border}; border-radius: 16px; overflow: hidden; background: #fff; margin-bottom: 1.25rem; }
        .mw-wday { border: none; border-right: 1px solid ${C.border}; background: #fff; padding: 0.75rem 0.4rem 0.7rem; cursor: pointer; font-family: inherit; display: flex; flex-direction: column; align-items: center; gap: 0.15rem; transition: background-color .15s; }
        .mw-wday:last-child { border-right: none; }
        .mw-wday:hover { background: #fafafa; }
        .mw-wd { font-size: 0.72rem; font-weight: 600; color: ${C.sub}; }
        .mw-dn { font-size: 1.15rem; font-weight: 700; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .mw-cnt { font-size: 0.7rem; color: ${C.sub}; min-height: 1em; white-space: nowrap; }
        .mw-wday.today .mw-dn { color: ${C.green}; }
        .mw-wday.sel { background: #fafafa; }
        .mw-wday.sel .mw-dn { background: ${C.accent}; color: #fff; }
        .mw-wday.off .mw-dn { color: #c7c7cc; }

        .mw-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.25rem; }
        .mw-kpi { background: #fff; border: 1px solid ${C.border}; border-radius: 16px; padding: 1.1rem 1.25rem; }
        .mw-kpi-l { font-size: 0.8rem; color: ${C.sub}; font-weight: 500; }
        .mw-kpi-v { font-size: 1.6rem; font-weight: 700; letter-spacing: -0.5px; margin-top: 0.35rem; font-variant-numeric: tabular-nums; }
        .mw-kpi-s { font-size: 0.75rem; color: ${C.sub}; margin-top: 0.15rem; min-height: 1em; }

        .mw-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr); gap: 1.25rem; align-items: start; }
        .mw-aside { display: flex; flex-direction: column; gap: 1.25rem; }
        .mw-card { background: #fff; border: 1px solid ${C.border}; border-radius: 16px; padding: 1.25rem 1.4rem; }
        .mw-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.9rem; }
        .mw-card-title { font-size: 1.05rem; font-weight: 700; }
        .mw-card-sub { font-size: 0.85rem; color: ${C.sub}; margin-top: 0.15rem; line-height: 1.45; min-height: 1em; }

        .mw-btn-outline { height: 34px; padding: 0 0.9rem; border-radius: 10px; border: 1px solid ${C.border}; background: #fff; color: ${C.text}; font-family: inherit; font-size: 0.85rem; font-weight: 500; cursor: pointer; }
        .mw-btn-outline:hover { background: #fafafa; }
        .mw-btn { height: 36px; padding: 0 1rem; border-radius: 10px; border: none; background: ${C.accent}; color: #fff; font-family: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
        .mw-btn:disabled { opacity: .4; cursor: default; }

        .mw-form { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; padding: 0.85rem; border-radius: 12px; background: #fafafa; border: 1px solid ${C.border}; margin-bottom: 0.9rem; }
        .mw-form input { height: 36px; padding: 0 0.6rem; border-radius: 9px; border: 1px solid ${C.border}; background: #fff; font-family: inherit; font-size: 0.875rem; color: ${C.text}; outline: none; }
        .mw-form input:focus { border-color: ${C.text}; }
        .mw-form-note { flex: 1; min-width: 160px; }
        .mw-dash { color: ${C.sub}; }

        .mw-list { display: flex; flex-direction: column; }
        .mw-row { display: grid; grid-template-columns: 56px 4px 1fr auto; gap: 0.9rem; align-items: center; padding: 0.85rem 0.25rem; border-top: 1px solid #f2f2f4; text-align: left; font-family: inherit; }
        .mw-list > :first-child { border-top: none; }
        .mw-time b { display: block; font-size: 0.95rem; font-weight: 600; font-variant-numeric: tabular-nums; }
        .mw-time span { display: block; font-size: 0.75rem; color: ${C.sub}; font-variant-numeric: tabular-nums; margin-top: 1px; }
        .mw-bar { width: 4px; align-self: stretch; border-radius: 2px; min-height: 36px; }
        .mw-title { font-size: 0.95rem; font-weight: 600; }
        .mw-sub { font-size: 0.82rem; color: ${C.sub}; margin-top: 2px; }
        .mw-sub a { color: ${C.sub}; text-decoration: underline; text-underline-offset: 2px; }
        .mw-right { text-align: right; }
        .mw-price { font-size: 0.95rem; font-weight: 600; font-variant-numeric: tabular-nums; }
        .mw-status { font-size: 0.75rem; color: ${C.sub}; margin-top: 2px; white-space: nowrap; }
        .mw-free { width: 100%; background: none; border-left: none; border-right: none; border-bottom: none; cursor: pointer; }
        .mw-free:hover { background: #fafafa; }
        .mw-free .mw-time b { color: ${C.sub}; font-weight: 500; }
        .mw-side-txt { font-size: 0.8rem; font-weight: 600; color: ${C.green}; opacity: 0; transition: opacity .15s; }
        .mw-free:hover .mw-side-txt { opacity: 1; }
        .mw-off .mw-title { color: ${C.sub}; }
        .mw-x { border: none; background: none; color: ${C.sub}; font-family: inherit; font-size: 0.8rem; font-weight: 600; cursor: pointer; padding: 0.3rem 0.4rem; border-radius: 8px; }
        .mw-x:hover { color: ${C.text}; background: ${C.soft}; }
        .mw-now { display: flex; align-items: center; gap: 0.5rem; padding: 0.15rem 0; }
        .mw-now span { font-size: 0.72rem; font-weight: 700; color: #ff3b30; width: 56px; font-variant-numeric: tabular-nums; }
        .mw-now i { flex: 1; height: 2px; background: #ff3b30; border-radius: 1px; position: relative; }
        .mw-now i::before { content: ''; position: absolute; left: -4px; top: -3px; width: 8px; height: 8px; border-radius: 50%; background: #ff3b30; }
        .mw-empty { padding: 2.5rem 0; text-align: center; color: ${C.sub}; font-size: 0.9rem; }

        .mw-shift { display: grid; grid-template-columns: 40px 1fr auto; align-items: center; gap: 0.75rem; padding: 0.5rem 0.5rem; border-radius: 10px; }
        .mw-shift.sel { background: #fafafa; }
        .mw-shift-day { font-size: 0.9rem; font-weight: 500; }
        .mw-shift-time { font-size: 0.875rem; font-variant-numeric: tabular-nums; }
        /* Той самий перемикач, що в «Команді» */
        .mw-switch { width: 40px; height: 22px; border-radius: 12px; background: #e2e8f0; position: relative; display: inline-block; }
        .mw-switch i { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.18); }
        .mw-switch.on { background: #10b981; }
        .mw-switch.on i { left: 20px; }

        .mw-earn { font-size: 1.6rem; font-weight: 700; letter-spacing: -0.5px; margin-top: 0.4rem; font-variant-numeric: tabular-nums; }
        .mw-line { display: flex; justify-content: space-between; padding: 0.6rem 0 0; margin-top: 0.6rem; border-top: 1px solid #f2f2f4; font-size: 0.875rem; color: ${C.sub}; }
        .mw-line b { color: ${C.text}; font-weight: 600; font-variant-numeric: tabular-nums; }

        .mw-toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); z-index: 60; padding: 0.7rem 1.1rem; border-radius: 12px; background: #fff; color: ${C.text};
          font-size: 0.875rem; font-weight: 500; border: 1px solid ${C.border}; box-shadow: 0 12px 32px rgba(0,0,0,0.12); }
        .mw-toast.err { color: #d70015; }

        @media (max-width: 1100px) {
          .mw-grid { grid-template-columns: 1fr; }
          .mw-kpis { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 640px) {
          .mw { padding: 1.25rem 1rem; }
          .mw-cnt { display: none; }
          .mw-nav-label { min-width: 0; }
        }
      `}</style>
    </div>
  );
}
