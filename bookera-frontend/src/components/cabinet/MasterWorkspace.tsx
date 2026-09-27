'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';

/**
 * «Моя робота» в кабінеті майстра - робочий простір, а не звіт.
 *
 * Три речі, потрібні майстрові щодня:
 *   1. Записи на будь-який день - календарик із крапками там, де є
 *      клієнти, і розклад обраного дня.
 *   2. Свій час - тижневий графік і особистий час (перерва, лікар).
 *      Клієнти бачать вільні години лише в межах цього.
 *   3. Як іде місяць - візити, виручка, середній чек, рейтинг, заробіток.
 *
 * Стиль - світлий, без темних блоків: білі картки з тонкою рамкою,
 * акценти матчі. Раніше вкладка була набором сухих цифр.
 */

const MONTHS = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'];
const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const WEEKDAYS_LONG = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця', 'Субота'];

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = (iso: string) => iso.slice(11, 16);
const money = (n: number) => `${Math.round(n).toLocaleString('uk-UA')} ₴`;
const minutesBetween = (a: string, b: string | null) => (b ? Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000) : 0);
const duration = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} год${m % 60 ? ` ${m % 60} хв` : ''}` : `${m} хв`);

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  confirmed: { label: 'Підтверджено', bg: '#F4FAF5', fg: '#3F6B46' },
  pending_approval: { label: 'Чекає підтвердження', bg: '#FBF6EC', fg: '#8A6516' },
  completed: { label: 'Завершено', bg: '#F5F5F7', fg: '#6E6E73' },
  'no-show': { label: 'Не прийшов', bg: '#FDF1F0', fg: '#B42318' },
};

export default function MasterWorkspace({ businessId, userName }: { businessId: number; userName?: string }) {
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(() => dayKey(today));

  const [work, setWork] = useState<any>(null);
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [agenda, setAgenda] = useState<any[] | null>(null);
  const [shifts, setShifts] = useState<any[] | null>(null);
  const [savedShifts, setSavedShifts] = useState<string>('');
  const [savingShifts, setSavingShifts] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);

  const [offOpen, setOffOpen] = useState(false);
  const [off, setOff] = useState({ from: '13:00', to: '14:00', note: '' });
  const [offBusy, setOffBusy] = useState(false);

  const flash = (text: string, ok = true) => {
    setNotice({ text, ok });
    setTimeout(() => setNotice(n => (n?.text === text ? null : n)), 2600);
  };

  const withToken = useCallback(async <T,>(fn: (t: string) => Promise<T>) => {
    const t = await getAuthToken();
    return fn(t);
  }, []);

  // Місяць і цифри - один раз
  useEffect(() => {
    void withToken(t => api.getMyWork(t, businessId)).then(setWork).catch(() => setWork({}));
    void withToken(t => api.getMyShifts(t)).then(r => { setShifts(r.shifts); setSavedShifts(JSON.stringify(r.shifts)); }).catch(() => setShifts([]));
  }, [businessId, withToken]);

  // Крапки календаря - за місяць
  useEffect(() => {
    const m = `${month.getFullYear()}-${pad(month.getMonth() + 1)}`;
    void withToken(t => api.getMyCalendar(t, businessId, m)).then(setMarks).catch(() => setMarks({}));
  }, [businessId, month, withToken]);

  // Записи обраного дня
  const loadAgenda = useCallback(() => {
    setAgenda(null);
    void withToken(t => api.getMyAgenda(t, businessId, selected)).then(setAgenda).catch(() => setAgenda([]));
  }, [businessId, selected, withToken]);
  useEffect(() => { loadAgenda(); }, [loadAgenda]);

  // --- Календарик ---
  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7; // понеділок - перший
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const out: (Date | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= days; d++) out.push(new Date(month.getFullYear(), month.getMonth(), d));
    while (out.length % 7) out.push(null);
    return out;
  }, [month]);

  const selDate = useMemo(() => new Date(`${selected}T12:00:00`), [selected]);
  const isToday = selected === dayKey(today);
  const clients = (agenda || []).filter(a => a.status !== 'time_off');
  const dayRevenue = clients.filter(a => a.status !== 'no-show').reduce((s, a) => s + (a.price || 0), 0);

  // --- Особистий час ---
  const addOff = async () => {
    setOffBusy(true);
    try {
      await withToken(t => api.addTimeOff(t, {
        business_id: businessId,
        start_time: `${selected}T${off.from}:00`,
        end_time: `${selected}T${off.to}:00`,
        note: off.note.trim() || undefined,
      }));
      setOffOpen(false);
      setOff({ from: '13:00', to: '14:00', note: '' });
      loadAgenda();
      flash('Час закрито для записів');
    } catch (e: any) {
      flash(e?.message || 'Не вдалося зберегти', false);
    } finally {
      setOffBusy(false);
    }
  };

  const removeOff = async (id: number) => {
    try {
      await withToken(t => api.removeTimeOff(t, id));
      loadAgenda();
      flash('Час знову відкритий для записів');
    } catch (e: any) {
      flash(e?.message || 'Не вдалося прибрати', false);
    }
  };

  // --- Графік ---
  const shiftsChanged = shifts !== null && JSON.stringify(shifts) !== savedShifts;
  const setShift = (i: number, patch: any) => setShifts(prev => prev ? prev.map((s, k) => (k === i ? { ...s, ...patch } : s)) : prev);
  const saveShifts = async () => {
    if (!shifts) return;
    setSavingShifts(true);
    try {
      const r = await withToken(t => api.setMyShifts(t, shifts));
      setShifts(r.shifts);
      setSavedShifts(JSON.stringify(r.shifts));
      flash('Графік збережено');
    } catch (e: any) {
      flash(e?.message || 'Не вдалося зберегти графік', false);
    } finally {
      setSavingShifts(false);
    }
  };

  const hour = today.getHours();
  const greeting = hour < 12 ? 'Доброго ранку' : hour < 18 ? 'Добрий день' : 'Добрий вечір';
  const s30 = work?.stats_30d || {};
  const unpaid = (work?.unpaid || []).reduce((s: number, u: any) => s + (u.amount || 0), 0);

  return (
    <div className="mw">
      {/* Шапка */}
      <header className="mw-head">
        <div>
          <h1>Моя робота</h1>
          <p>{greeting}{userName ? `, ${userName.split(' ')[0]}` : ''} · {WEEKDAYS_LONG[today.getDay()].toLowerCase()}, {today.getDate()} {MONTHS_GEN[today.getMonth()]}</p>
        </div>
      </header>

      {/* Місяць у цифрах */}
      <section className="mw-stats">
        {[
          { label: 'Візити за 30 днів', value: work ? String(s30.visits ?? 0) : '—' },
          { label: 'Виручка', value: work ? money(s30.revenue ?? 0) : '—' },
          { label: 'Середній чек', value: work ? money(s30.avg_check ?? 0) : '—' },
          { label: 'Рейтинг', value: work?.rating ? `★ ${work.rating}` : '—', sub: work?.reviews ? `${work.reviews} відгуків` : 'ще немає відгуків' },
        ].map(s => (
          <div key={s.label} className="mw-stat">
            <div className="mw-stat-label">{s.label}</div>
            <div className="mw-stat-value">{s.value}</div>
            {s.sub && <div className="mw-stat-sub">{s.sub}</div>}
          </div>
        ))}
      </section>

      <div className="mw-grid">
        {/* Ліва колонка: календар, графік */}
        <div className="mw-col">
          <section className="mw-card">
            <div className="mw-cal-head">
              <button type="button" aria-label="Попередній місяць" onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>‹</button>
              <span>{MONTHS[month.getMonth()]} {month.getFullYear()}</span>
              <button type="button" aria-label="Наступний місяць" onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>›</button>
            </div>
            <div className="mw-cal">
              {WEEKDAYS.map(w => <div key={w} className="mw-wd">{w}</div>)}
              {cells.map((d, i) => {
                if (!d) return <div key={i} />;
                const k = dayKey(d);
                const count = marks[k] || 0;
                return (
                  <button
                    key={k}
                    type="button"
                    className={`mw-day ${k === selected ? 'sel' : ''} ${k === dayKey(today) ? 'today' : ''}`}
                    onClick={() => setSelected(k)}
                    aria-label={`${d.getDate()} ${MONTHS_GEN[d.getMonth()]}${count ? `, записів: ${count}` : ''}`}
                  >
                    <span>{d.getDate()}</span>
                    {count > 0 && <i />}
                  </button>
                );
              })}
            </div>
            {!isToday && (
              <button type="button" className="mw-link" onClick={() => { setSelected(dayKey(today)); setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); }}>
                Сьогодні
              </button>
            )}
          </section>

          <section className="mw-card">
            <div className="mw-card-title">Мій графік</div>
            <div className="mw-card-sub">Клієнти бачать вільні години лише в межах ваших змін.</div>
            {shifts === null ? (
              <div className="mw-muted">Завантаження…</div>
            ) : (
              <div className="mw-shifts">
                {shifts.map((s, i) => (
                  <div key={i} className={`mw-shift ${s.active ? '' : 'off'}`}>
                    <span className="mw-shift-day">{WEEKDAYS[i]}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!!s.active}
                      aria-label={`${WEEKDAYS[i]}: ${s.active ? 'працюю' : 'вихідний'}`}
                      className={`mw-switch ${s.active ? 'on' : ''}`}
                      onClick={() => setShift(i, { active: !s.active })}
                    ><i /></button>
                    {s.active ? (
                      <span className="mw-times">
                        <input type="time" value={s.start} onChange={e => setShift(i, { start: e.target.value })} aria-label="Початок" />
                        <em>–</em>
                        <input type="time" value={s.end} onChange={e => setShift(i, { end: e.target.value })} aria-label="Кінець" />
                      </span>
                    ) : (
                      <span className="mw-muted">Вихідний</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {shiftsChanged && (
              <button type="button" className="mw-btn" onClick={() => void saveShifts()} disabled={savingShifts}>
                {savingShifts ? 'Зберігаємо…' : 'Зберегти графік'}
              </button>
            )}
          </section>
        </div>

        {/* Права колонка: день, заробіток */}
        <div className="mw-col">
          <section className="mw-card mw-day-card">
            <div className="mw-day-head">
              <div>
                <div className="mw-card-title">{isToday ? 'Сьогодні' : `${WEEKDAYS_LONG[selDate.getDay()]}`}, {selDate.getDate()} {MONTHS_GEN[selDate.getMonth()]}</div>
                <div className="mw-card-sub" style={{ marginBottom: 0 }}>
                  {agenda === null ? 'Завантаження…' : clients.length
                    ? `${clients.length} ${clients.length === 1 ? 'запис' : clients.length < 5 ? 'записи' : 'записів'} · ${money(dayRevenue)}`
                    : 'Записів немає'}
                </div>
              </div>
              <button type="button" className="mw-ghost" onClick={() => setOffOpen(o => !o)}>
                {offOpen ? 'Скасувати' : '+ Особистий час'}
              </button>
            </div>

            {offOpen && (
              <div className="mw-off-form">
                <div className="mw-card-sub" style={{ marginBottom: '0.6rem' }}>Закрити час для записів: перерва, справи, лікар.</div>
                <div className="mw-off-row">
                  <input type="time" value={off.from} onChange={e => setOff(o => ({ ...o, from: e.target.value }))} aria-label="З" />
                  <em>–</em>
                  <input type="time" value={off.to} onChange={e => setOff(o => ({ ...o, to: e.target.value }))} aria-label="До" />
                  <input className="mw-note" value={off.note} onChange={e => setOff(o => ({ ...o, note: e.target.value.slice(0, 120) }))} placeholder="Причина (необовʼязково)" />
                </div>
                <button type="button" className="mw-btn" onClick={() => void addOff()} disabled={offBusy || off.to <= off.from}>
                  {offBusy ? 'Зберігаємо…' : 'Закрити цей час'}
                </button>
              </div>
            )}

            <div className="mw-agenda">
              {agenda !== null && agenda.length === 0 && (
                <div className="mw-empty">
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#8FAE93" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4.5" width="18" height="16" rx="3" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></svg>
                  <div>Вільний день</div>
                </div>
              )}
              {(agenda || []).map(a => {
                const mins = minutesBetween(a.start_time, a.end_time);
                if (a.status === 'time_off') {
                  return (
                    <div key={a.id} className="mw-item off">
                      <div className="mw-time">{hhmm(a.start_time)}<small>{a.end_time ? hhmm(a.end_time) : ''}</small></div>
                      <div className="mw-body">
                        <div className="mw-title">{a.client_name || 'Особистий час'}</div>
                        <div className="mw-sub">Закрито для записів · {duration(mins)}</div>
                      </div>
                      <button type="button" className="mw-x" aria-label="Відкрити цей час" onClick={() => void removeOff(a.id)}>×</button>
                    </div>
                  );
                }
                const st = STATUS[a.status] || STATUS.confirmed;
                return (
                  <div key={a.id} className="mw-item">
                    <div className="mw-time">{hhmm(a.start_time)}<small>{duration(mins)}</small></div>
                    <div className="mw-body">
                      <div className="mw-title">{a.service_name || 'Візит'}</div>
                      <div className="mw-sub">
                        {a.client_name || 'Клієнт'}
                        {a.client_phone && <> · <a href={`tel:${a.client_phone}`}>{a.client_phone}</a></>}
                      </div>
                    </div>
                    <div className="mw-right">
                      {a.price != null && <div className="mw-price">{money(a.price)}</div>}
                      <span className="mw-chip" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mw-card">
            <div className="mw-card-title">Заробіток</div>
            {work?.unpaid?.length ? (
              <>
                <div className="mw-earn">{money(unpaid)}</div>
                <div className="mw-card-sub">до виплати{work.unpaid[0]?.since ? ` з ${new Date(work.unpaid[0].since).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}` : ''}</div>
              </>
            ) : (
              <div className="mw-card-sub">
                {work ? 'Зʼявиться, щойно власник налаштує вашу оплату й будуть завершені візити.' : 'Завантаження…'}
              </div>
            )}
            {(work?.payouts || []).slice(0, 4).map((p: any, i: number) => (
              <div key={i} className="mw-pay">
                <span>{p.paid_at ? new Date(p.paid_at).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' }) : '—'}</span>
                <span className="mw-muted">{p.appointments} віз.</span>
                <b>{money(p.amount || 0)}</b>
              </div>
            ))}
          </section>
        </div>
      </div>

      {notice && <div className={`mw-toast ${notice.ok ? '' : 'err'}`} role="status">{notice.text}</div>}

      <style jsx>{`
        .mw { max-width: 1120px; margin: 0 auto; padding: 2rem 1.5rem 4rem; color: #1D1D1F; }
        .mw-head h1 { font-size: 2rem; font-weight: 700; letter-spacing: -0.035em; margin: 0; }
        .mw-head p { margin: 0.3rem 0 0; color: #86868B; font-size: 0.975rem; }

        .mw-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.9rem; margin: 1.75rem 0 1.5rem; }
        .mw-stat { background: #fff; border: 1px solid #EDEDF0; border-radius: 20px; padding: 1.1rem 1.25rem; }
        .mw-stat-label { font-size: 0.8125rem; color: #86868B; }
        .mw-stat-value { font-size: 1.65rem; font-weight: 700; letter-spacing: -0.03em; margin-top: 0.25rem; font-variant-numeric: tabular-nums; }
        .mw-stat-sub { font-size: 0.78rem; color: #AEAEB2; margin-top: 0.1rem; }

        .mw-grid { display: grid; grid-template-columns: 360px 1fr; gap: 1.25rem; align-items: start; }
        .mw-col { display: flex; flex-direction: column; gap: 1.25rem; min-width: 0; }
        .mw-card { background: #fff; border: 1px solid #EDEDF0; border-radius: 22px; padding: 1.25rem 1.35rem; }
        .mw-card-title { font-size: 1.05rem; font-weight: 700; letter-spacing: -0.015em; }
        .mw-card-sub { font-size: 0.85rem; color: #86868B; line-height: 1.5; margin: 0.25rem 0 1rem; }
        .mw-muted { color: #AEAEB2; font-size: 0.85rem; }

        /* Календарик */
        .mw-cal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
        .mw-cal-head span { font-size: 1rem; font-weight: 600; text-transform: capitalize; }
        .mw-cal-head button { width: 32px; height: 32px; border-radius: 50%; border: none; background: transparent; font-size: 1.3rem; color: #6F9273; cursor: pointer; line-height: 1; }
        .mw-cal-head button:hover { background: #F4FAF5; }
        .mw-cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
        .mw-wd { text-align: center; font-size: 0.72rem; font-weight: 600; color: #AEAEB2; padding-bottom: 0.4rem; }
        .mw-day { position: relative; height: 40px; border: none; background: transparent; border-radius: 12px; cursor: pointer; font-family: inherit;
          display: flex; flex-direction: column; align-items: center; justify-content: center; transition: background-color .15s; }
        .mw-day span { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; color: #1D1D1F; font-variant-numeric: tabular-nums; transition: background-color .2s, color .2s; }
        .mw-day:hover span { background: #F5F5F7; }
        .mw-day.today span { color: #5C7A61; font-weight: 700; box-shadow: inset 0 0 0 1.5px #8FAE93; }
        .mw-day.sel span { background: #6F9273; color: #fff; font-weight: 600; box-shadow: none; }
        .mw-day i { position: absolute; bottom: 2px; width: 4px; height: 4px; border-radius: 50%; background: #8FAE93; }
        .mw-day.sel i { background: #6F9273; }
        .mw-link { margin-top: 0.6rem; border: none; background: none; color: #5C7A61; font-weight: 600; font-family: inherit; font-size: 0.85rem; cursor: pointer; padding: 0.3rem 0; }

        /* Графік */
        .mw-shifts { display: flex; flex-direction: column; }
        .mw-shift { display: grid; grid-template-columns: 32px 44px 1fr; align-items: center; gap: 0.6rem; padding: 0.45rem 0; border-top: 1px solid #F5F5F7; }
        .mw-shift:first-child { border-top: none; }
        .mw-shift-day { font-size: 0.875rem; font-weight: 600; }
        .mw-shift.off .mw-shift-day { color: #AEAEB2; }
        .mw-switch { width: 40px; height: 24px; border-radius: 999px; border: none; background: #E5E5EA; position: relative; cursor: pointer; transition: background-color .2s; padding: 0; }
        .mw-switch i { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.2); transition: transform .22s cubic-bezier(.16,1,.3,1); }
        .mw-switch.on { background: #8FAE93; }
        .mw-switch.on i { transform: translateX(16px); }
        .mw-times { display: flex; align-items: center; gap: 0.35rem; }
        .mw-times em, .mw-off-row em { font-style: normal; color: #AEAEB2; }
        input[type='time'] { height: 34px; padding: 0 0.5rem; border-radius: 9px; border: 1px solid #E5E5EA; background: #FAFAFA; font-family: inherit; font-size: 0.875rem; color: #1D1D1F; outline: none; }
        input[type='time']:focus, .mw-note:focus { border-color: #8FAE93; box-shadow: 0 0 0 3px rgba(143,174,147,.18); background: #fff; }

        .mw-btn { width: 100%; height: 42px; margin-top: 0.9rem; border-radius: 12px; border: none; background: #6F9273; color: #fff; font-family: inherit; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: background-color .2s; }
        .mw-btn:hover:not(:disabled) { background: #5C7A61; }
        .mw-btn:disabled { opacity: .45; cursor: default; }
        .mw-ghost { height: 34px; padding: 0 0.85rem; border-radius: 10px; border: 1px solid #E5E5EA; background: #fff; color: #1D1D1F; font-family: inherit; font-size: 0.85rem; font-weight: 500; cursor: pointer; white-space: nowrap; }
        .mw-ghost:hover { background: #F5F5F7; }

        /* День */
        .mw-day-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1rem; }
        .mw-off-form { padding: 1rem; border-radius: 16px; background: #F7F9F6; margin-bottom: 1rem; }
        .mw-off-row { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
        .mw-note { flex: 1; min-width: 160px; height: 34px; padding: 0 0.7rem; border-radius: 9px; border: 1px solid #E5E5EA; background: #fff; font-family: inherit; font-size: 0.875rem; outline: none; }
        .mw-agenda { display: flex; flex-direction: column; gap: 0.5rem; }
        .mw-item { display: grid; grid-template-columns: 64px 1fr auto; gap: 0.9rem; align-items: center; padding: 0.85rem 1rem; border-radius: 16px; background: #FAFAFA; border: 1px solid #F0F0F2; }
        .mw-item.off { background: repeating-linear-gradient(135deg, #FAFAFA 0 8px, #F4F4F6 8px 16px); }
        .mw-time { font-size: 1rem; font-weight: 600; font-variant-numeric: tabular-nums; }
        .mw-time small { display: block; font-size: 0.75rem; font-weight: 400; color: #AEAEB2; margin-top: 1px; }
        .mw-title { font-size: 0.95rem; font-weight: 600; }
        .mw-sub { font-size: 0.82rem; color: #86868B; margin-top: 2px; }
        .mw-sub a { color: #5C7A61; text-decoration: none; }
        .mw-right { display: flex; flex-direction: column; align-items: flex-end; gap: 0.3rem; }
        .mw-price { font-size: 0.9rem; font-weight: 600; font-variant-numeric: tabular-nums; }
        .mw-chip { font-size: 0.7rem; font-weight: 600; padding: 0.2rem 0.55rem; border-radius: 999px; white-space: nowrap; }
        .mw-x { width: 30px; height: 30px; border-radius: 50%; border: none; background: #fff; color: #86868B; font-size: 1.1rem; cursor: pointer; box-shadow: 0 0 0 1px #EDEDF0; }
        .mw-x:hover { color: #B42318; }
        .mw-empty { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 2.25rem 0 1.5rem; color: #86868B; font-size: 0.925rem; }

        /* Заробіток */
        .mw-earn { font-size: 2rem; font-weight: 700; letter-spacing: -0.035em; margin-top: 0.5rem; color: #3F6B46; font-variant-numeric: tabular-nums; }
        .mw-pay { display: grid; grid-template-columns: 1fr auto auto; gap: 0.9rem; padding: 0.55rem 0; border-top: 1px solid #F5F5F7; font-size: 0.875rem; }
        .mw-pay b { font-weight: 600; font-variant-numeric: tabular-nums; }

        .mw-toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); z-index: 50; padding: 0.7rem 1.1rem; border-radius: 14px;
          background: #fff; color: #3F6B46; font-size: 0.9rem; font-weight: 500; box-shadow: 0 16px 40px -14px rgba(0,0,0,.25), 0 0 0 1px rgba(0,0,0,.05);
          animation: mwIn .35s cubic-bezier(.16,1,.3,1); }
        .mw-toast.err { color: #B42318; }
        @keyframes mwIn { from { opacity: 0; transform: translate(-50%, 8px); } }

        @media (max-width: 960px) {
          .mw-grid { grid-template-columns: 1fr; }
          .mw-stats { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  );
}
