'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';

/**
 * «Моя робота» - робочий простір майстра за зразком Календаря Apple.
 *
 *   - Тижнева стрічка: день перемикається одним дотиком; місяць - за
 *     потреби, з кнопки.
 *   - День як часова шкала: запис стоїть на своєму часі й займає
 *     стільки місця, скільки триває. Години поза зміною притінені,
 *     червона лінія - «зараз». Клік по вільному часу - закрити його.
 *   - Живий підсумок дня людською мовою замість сухих цифр.
 *   - Праворуч - наступний клієнт, місяць, графік від салону, заробіток.
 *
 * Світлий, без темних блоків: мʼякі тіні замість жорстких рамок,
 * пастельні записи, акценти матчі. Перемикачі графіка - ті самі, що в
 * «Команді».
 */

const MONTHS = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'];
const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const WD_LONG = ['понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота', 'неділя'];

const HOUR = 72; // px на годину в шкалі дня

const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k: string) => new Date(`${k}T12:00:00`);
const mondayOf = (d: Date) => { const x = new Date(d); x.setDate(d.getDate() - ((d.getDay() + 6) % 7)); x.setHours(12, 0, 0, 0); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(d.getDate() + n); return x; };
const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0); };
const minOfIso = (iso: string) => toMin(iso.slice(11, 16));
const fmt = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const money = (n: number) => `${Math.round(n).toLocaleString('uk-UA')} ₴`;
const dur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} год${m % 60 ? ` ${m % 60} хв` : ''}` : `${m} хв`);
const plural = (n: number, one: string, few: string, many: string) =>
  n % 10 === 1 && n % 100 !== 11 ? one : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? few : many;

// Пастельні записи за статусом: фон, лінія зліва, текст
const TONE: Record<string, { bg: string; bar: string; fg: string; label: string }> = {
  confirmed: { bg: '#EEF5EE', bar: '#6F9273', fg: '#24422B', label: 'Підтверджено' },
  pending_approval: { bg: '#FBF3E4', bar: '#D9A441', fg: '#6B4E16', label: 'Чекає підтвердження' },
  completed: { bg: '#F3F3F5', bar: '#AEAEB2', fg: '#3A3A3C', label: 'Завершено' },
  'no-show': { bg: '#FCEDEC', bar: '#E0645C', fg: '#8E2A24', label: 'Не прийшов' },
};

export default function MasterWorkspace({ businessId, userName }: { businessId: number; userName?: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  const todayKey = keyOf(now);

  const [selected, setSelected] = useState(todayKey);
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [monthOpen, setMonthOpen] = useState(false);
  const [monthView, setMonthView] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const [work, setWork] = useState<any>(null);
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [agenda, setAgenda] = useState<any[] | null>(null);
  const [shifts, setShifts] = useState<any[] | null>(null);
  const [shiftSource, setShiftSource] = useState<'master' | 'salon'>('salon');

  const [quick, setQuick] = useState<{ from: string; to: string; note: string } | null>(null);
  const [quickBusy, setQuickBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const flash = (text: string, ok = true) => { setToast({ text, ok }); setTimeout(() => setToast(t => (t?.text === text ? null : t)), 2600); };

  const call = useCallback(async <T,>(fn: (t: string) => Promise<T>) => fn(await getAuthToken()), []);

  useEffect(() => {
    void call(t => api.getMyWork(t, businessId)).then(setWork).catch(() => setWork({}));
    void call(t => api.getMyShifts(t, businessId)).then(r => { setShifts(r.shifts); setShiftSource(r.source); }).catch(() => setShifts([]));
  }, [businessId, call]);

  // Крапки - за місяці, яких торкаються тиждень і місячна сітка
  useEffect(() => {
    const months = new Set([
      `${weekStart.getFullYear()}-${pad(weekStart.getMonth() + 1)}`,
      `${addDays(weekStart, 6).getFullYear()}-${pad(addDays(weekStart, 6).getMonth() + 1)}`,
      `${monthView.getFullYear()}-${pad(monthView.getMonth() + 1)}`,
    ]);
    months.forEach(m => void call(t => api.getMyCalendar(t, businessId, m)).then(r => setMarks(prev => ({ ...prev, ...r }))).catch(() => {}));
  }, [businessId, weekStart, monthView, call]);

  const loadAgenda = useCallback(() => {
    setAgenda(null);
    void call(t => api.getMyAgenda(t, businessId, selected)).then(setAgenda).catch(() => setAgenda([]));
  }, [businessId, selected, call]);
  useEffect(() => { loadAgenda(); setQuick(null); }, [loadAgenda]);

  const pick = (k: string) => {
    setSelected(k);
    setWeekStart(mondayOf(fromKey(k)));
    setMonthOpen(false);
  };

  // --- День ---
  const selDate = fromKey(selected);
  const weekday = (selDate.getDay() + 6) % 7;
  const shift = shifts?.[weekday];
  const items = agenda || [];
  const clients = items.filter(a => a.status !== 'time_off');
  const dayRevenue = clients.filter(a => a.status !== 'no-show').reduce((s, a) => s + (a.price || 0), 0);

  const range = useMemo(() => {
    let s = shift?.active ? toMin(shift.start) : 9 * 60;
    let e = shift?.active ? toMin(shift.end) : 20 * 60;
    for (const a of items) {
      s = Math.min(s, minOfIso(a.start_time));
      e = Math.max(e, a.end_time ? minOfIso(a.end_time) : minOfIso(a.start_time) + 60);
    }
    return { start: Math.floor(s / 60) * 60, end: Math.min(24 * 60, Math.ceil(e / 60) * 60) };
  }, [shift, items]);

  // Вільні вікна за зміною - щонайменше година
  const freeWindows = useMemo(() => {
    if (!shift?.active || agenda === null) return [];
    const busy = items.map(a => [minOfIso(a.start_time), a.end_time ? minOfIso(a.end_time) : minOfIso(a.start_time) + 60]).sort((x, y) => x[0] - y[0]);
    let cursor = Math.max(toMin(shift.start), selected === todayKey ? now.getHours() * 60 + now.getMinutes() : 0);
    const out: [number, number][] = [];
    for (const [s, e] of busy) {
      if (s - cursor >= 60) out.push([cursor, s]);
      cursor = Math.max(cursor, e);
    }
    if (toMin(shift.end) - cursor >= 60) out.push([cursor, toMin(shift.end)]);
    return out;
  }, [shift, items, agenda, selected, todayKey, now]);

  const summary = useMemo(() => {
    if (agenda === null) return 'Завантаження…';
    if (shift && !shift.active && !clients.length) return 'Вихідний за графіком.';
    const first = clients[0], last = clients[clients.length - 1];
    const parts: string[] = [];
    if (clients.length) {
      parts.push(`${clients.length} ${plural(clients.length, 'клієнт', 'клієнти', 'клієнтів')}, з ${first.start_time.slice(11, 16)} до ${(last.end_time || last.start_time).slice(11, 16)}`);
    } else {
      parts.push('Записів поки немає');
    }
    if (freeWindows.length) {
      const [s, e] = freeWindows.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a));
      parts.push(`вільно з ${fmt(s)} до ${fmt(e)}`);
    }
    return parts.join(' · ') + '.';
  }, [agenda, shift, clients, freeWindows]);

  // Клік по вільному часу - одразу закрити його
  const timelineRef = useRef<HTMLDivElement>(null);
  const onTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.mw-ev')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mins = range.start + Math.round(((e.clientY - rect.top) / HOUR) * 60 / 30) * 30;
    const from = Math.max(range.start, Math.min(mins, range.end - 30));
    setQuick({ from: fmt(from), to: fmt(Math.min(from + 60, range.end)), note: '' });
  };

  const saveQuick = async () => {
    if (!quick) return;
    setQuickBusy(true);
    try {
      await call(t => api.addTimeOff(t, { business_id: businessId, start_time: `${selected}T${quick.from}:00`, end_time: `${selected}T${quick.to}:00`, note: quick.note.trim() || undefined }));
      setQuick(null);
      loadAgenda();
      flash('Час закрито для записів');
    } catch (err: any) {
      flash(err?.message || 'Не вдалося зберегти', false);
    } finally {
      setQuickBusy(false);
    }
  };

  const removeOff = async (id: number) => {
    try {
      await call(t => api.removeTimeOff(t, id));
      loadAgenda();
      flash('Час знову відкритий');
    } catch (err: any) {
      flash(err?.message || 'Не вдалося', false);
    }
  };

  // Прокрутка шкали до «зараз» чи першого запису
  useEffect(() => {
    const el = timelineRef.current?.parentElement;
    if (!el || agenda === null) return;
    const target = selected === todayKey ? now.getHours() * 60 + now.getMinutes() - 60 : clients[0] ? minOfIso(clients[0].start_time) - 30 : range.start;
    el.scrollTo({ top: Math.max(0, ((target - range.start) / 60) * HOUR), behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agenda]);

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Доброго ранку' : hour < 18 ? 'Добрий день' : 'Добрий вечір';
  const firstName = (userName || '').split(' ')[0];
  const s30 = work?.stats_30d || {};
  const daily: { date: string; visits: number }[] = work?.daily || [];
  const maxDaily = Math.max(1, ...daily.map(d => d.visits));
  const unpaid = (work?.unpaid || []).reduce((s: number, u: any) => s + (u.amount || 0), 0);
  const next = work?.next;
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const monthCells = useMemo(() => {
    const first = new Date(monthView.getFullYear(), monthView.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7;
    const days = new Date(monthView.getFullYear(), monthView.getMonth() + 1, 0).getDate();
    const out: (Date | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= days; d++) out.push(new Date(monthView.getFullYear(), monthView.getMonth(), d, 12));
    while (out.length % 7) out.push(null);
    return out;
  }, [monthView]);

  return (
    <div className="mw">
      {/* ---------- Шапка ---------- */}
      <header className="mw-hero">
        <div className="mw-hello">
          <div className="mw-date">{WD_LONG[(now.getDay() + 6) % 7]}, {now.getDate()} {MONTHS_GEN[now.getMonth()]}</div>
          <h1>{greeting}{firstName ? `, ${firstName}` : ''}</h1>
          <p>{selected === todayKey ? 'Сьогодні' : `${WD_LONG[weekday][0].toUpperCase()}${WD_LONG[weekday].slice(1)}, ${selDate.getDate()} ${MONTHS_GEN[selDate.getMonth()]}`}: {summary}</p>
        </div>

        {next && (
          <div className="mw-next">
            <div className="mw-next-ava">{(next.client_name || 'К').slice(0, 1).toUpperCase()}</div>
            <div>
              <div className="mw-next-label">Наступний клієнт</div>
              <div className="mw-next-time">
                {next.start_time.slice(0, 10) === todayKey ? '' : `${fromKey(next.start_time.slice(0, 10)).getDate()} ${MONTHS_GEN[fromKey(next.start_time.slice(0, 10)).getMonth()]}, `}
                {next.start_time.slice(11, 16)}
              </div>
              <div className="mw-next-who">{next.client_name || 'Клієнт'}{next.service_name ? ` · ${next.service_name}` : ''}</div>
            </div>
          </div>
        )}
      </header>

      {/* ---------- Тиждень ---------- */}
      <div className="mw-week-bar">
        <button type="button" className="mw-round" aria-label="Попередній тиждень" onClick={() => setWeekStart(w => addDays(w, -7))}>‹</button>
        <div className="mw-week">
          {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d, i) => {
            const k = keyOf(d);
            const n = marks[k] || 0;
            const off = shifts?.[i] && !shifts[i].active;
            return (
              <button key={k} type="button" onClick={() => pick(k)}
                className={`mw-wday ${k === selected ? 'sel' : ''} ${k === todayKey ? 'today' : ''} ${off ? 'off' : ''}`}>
                <span className="mw-wd">{WD[i]}</span>
                <span className="mw-dn">{d.getDate()}</span>
                <span className="mw-dots">{Array.from({ length: Math.min(n, 4) }, (_, j) => <i key={j} />)}</span>
              </button>
            );
          })}
        </div>
        <button type="button" className="mw-round" aria-label="Наступний тиждень" onClick={() => setWeekStart(w => addDays(w, 7))}>›</button>
        <div className="mw-week-actions">
          {selected !== todayKey && <button type="button" className="mw-pill" onClick={() => pick(todayKey)}>Сьогодні</button>}
          <div className="mw-month-wrap">
            <button type="button" className={`mw-pill ${monthOpen ? 'on' : ''}`} onClick={() => { setMonthView(new Date(selDate.getFullYear(), selDate.getMonth(), 1)); setMonthOpen(o => !o); }}>
              {MONTHS[selDate.getMonth()]} {selDate.getFullYear()}
            </button>
            {monthOpen && (
              <div className="mw-month">
                <div className="mw-month-head">
                  <button type="button" onClick={() => setMonthView(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>‹</button>
                  <span>{MONTHS[monthView.getMonth()]} {monthView.getFullYear()}</span>
                  <button type="button" onClick={() => setMonthView(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>›</button>
                </div>
                <div className="mw-month-grid">
                  {WD.map(w => <span key={w} className="mw-mwd">{w}</span>)}
                  {monthCells.map((d, i) => d ? (
                    <button key={i} type="button" onClick={() => pick(keyOf(d))}
                      className={`mw-mday ${keyOf(d) === selected ? 'sel' : ''} ${keyOf(d) === todayKey ? 'today' : ''}`}>
                      {d.getDate()}{marks[keyOf(d)] ? <i /> : null}
                    </button>
                  ) : <span key={i} />)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mw-grid">
        {/* ---------- День ---------- */}
        <section className="mw-card mw-daycard">
          <div className="mw-day-top">
            <div>
              <div className="mw-h2">{selected === todayKey ? 'Сьогодні' : `${WD_LONG[weekday][0].toUpperCase()}${WD_LONG[weekday].slice(1)}, ${selDate.getDate()} ${MONTHS_GEN[selDate.getMonth()]}`}</div>
              <div className="mw-sub">
                {shift?.active ? `Зміна ${shift.start} – ${shift.end}` : 'Вихідний за графіком'}
                {clients.length > 0 && ` · ${money(dayRevenue)}`}
              </div>
            </div>
            <button type="button" className="mw-pill" onClick={() => setQuick(q => q ? null : { from: shift?.active ? shift.start : '13:00', to: shift?.active ? fmt(toMin(shift.start) + 60) : '14:00', note: '' })}>
              {quick ? 'Скасувати' : 'Закрити час'}
            </button>
          </div>

          {quick && (
            <div className="mw-quick">
              <div className="mw-quick-row">
                <label>З<input type="time" value={quick.from} onChange={e => setQuick(q => q && { ...q, from: e.target.value })} /></label>
                <label>До<input type="time" value={quick.to} onChange={e => setQuick(q => q && { ...q, to: e.target.value })} /></label>
                <input className="mw-quick-note" value={quick.note} onChange={e => setQuick(q => q && { ...q, note: e.target.value.slice(0, 120) })} placeholder="Обід, лікар, справи…" autoFocus />
                <button type="button" className="mw-save" onClick={() => void saveQuick()} disabled={quickBusy || quick.to <= quick.from}>
                  {quickBusy ? 'Зберігаємо…' : 'Закрити'}
                </button>
              </div>
              <div className="mw-quick-hint">Клієнти не зможуть записатись на цей час. Порада: натисніть на вільне місце в розкладі - час підставиться сам.</div>
            </div>
          )}

          <div className="mw-scroll">
            <div className="mw-timeline" ref={timelineRef} style={{ height: ((range.end - range.start) / 60) * HOUR }} onClick={onTimelineClick}>
              {/* Години поза зміною - притінені */}
              {shift && !shift.active && <div className="mw-offshift" style={{ top: 0, height: '100%' }} />}
              {shift?.active && toMin(shift.start) > range.start && (
                <div className="mw-offshift" style={{ top: 0, height: ((toMin(shift.start) - range.start) / 60) * HOUR }} />
              )}
              {shift?.active && toMin(shift.end) < range.end && (
                <div className="mw-offshift" style={{ top: ((toMin(shift.end) - range.start) / 60) * HOUR, bottom: 0 }} />
              )}

              {Array.from({ length: (range.end - range.start) / 60 + 1 }, (_, i) => (
                <div key={i} className="mw-hour" style={{ top: i * HOUR }}>
                  <span>{pad(range.start / 60 + i)}:00</span>
                </div>
              ))}

              {selected === todayKey && nowMin >= range.start && nowMin <= range.end && (
                <div className="mw-now" style={{ top: ((nowMin - range.start) / 60) * HOUR }}><i /></div>
              )}

              {agenda === null && <div className="mw-loading">Завантаження…</div>}

              {items.map(a => {
                const s = minOfIso(a.start_time);
                const e = a.end_time ? minOfIso(a.end_time) : s + 60;
                const top = ((s - range.start) / 60) * HOUR;
                const height = Math.max(40, ((e - s) / 60) * HOUR - 4);
                if (a.status === 'time_off') {
                  return (
                    <div key={a.id} className="mw-ev off" style={{ top, height }}>
                      <div className="mw-ev-line">
                        <b>{a.client_name || 'Особистий час'}</b>
                        <span>{fmt(s)} – {fmt(e)}</span>
                      </div>
                      <button type="button" className="mw-ev-x" aria-label="Відкрити цей час" onClick={() => void removeOff(a.id)}>×</button>
                    </div>
                  );
                }
                const t = TONE[a.status] || TONE.confirmed;
                const compact = height < 64;
                return (
                  <div key={a.id} className="mw-ev" style={{ top, height, background: t.bg, color: t.fg, ['--bar' as string]: t.bar }}>
                    <div className={compact ? 'mw-ev-line' : 'mw-ev-body'}>
                      <b>{a.service_name || 'Візит'}</b>
                      <span>{fmt(s)} – {fmt(e)} · {a.client_name || 'Клієнт'}</span>
                      {!compact && (
                        <span className="mw-ev-meta">
                          {a.price != null && <em>{money(a.price)}</em>}
                          {a.client_phone && <a href={`tel:${a.client_phone}`} onClick={ev => ev.stopPropagation()}>{a.client_phone}</a>}
                          <em className="mw-ev-status">{t.label}</em>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ---------- Праворуч ---------- */}
        <aside className="mw-side">
          <section className="mw-card">
            <div className="mw-label">Останні 30 днів</div>
            <div className="mw-big">{work ? money(s30.revenue ?? 0) : '—'}</div>
            <div className="mw-kv">
              <span><b>{s30.visits ?? '—'}</b> {plural(Number(s30.visits || 0), 'візит', 'візити', 'візитів')}</span>
              <span><b>{s30.avg_check ? money(s30.avg_check) : '—'}</b> середній чек</span>
            </div>
            {daily.length > 0 && (
              <div className="mw-bars" aria-label="Візити за два тижні">
                {daily.map(d => (
                  <span key={d.date} title={`${d.date}: ${d.visits}`} style={{ height: `${Math.max(6, (d.visits / maxDaily) * 100)}%` }}
                    className={d.date === todayKey ? 'now' : ''} />
                ))}
              </div>
            )}
            <div className="mw-rating">
              <span className="mw-stars">{'★★★★★'.split('').map((s, i) => <i key={i} className={work?.rating && i < Math.round(work.rating) ? 'on' : ''}>{s}</i>)}</span>
              <span>{work?.rating ? `${work.rating} · ${work.reviews} ${plural(work.reviews, 'відгук', 'відгуки', 'відгуків')}` : 'Відгуків ще немає'}</span>
            </div>
          </section>

          <section className="mw-card">
            <div className="mw-h3">Мій графік</div>
            <div className="mw-sub" style={{ marginBottom: '0.6rem' }}>
              {shiftSource === 'salon' ? 'Години закладу. Графік виставляє салон у «Команді».' : 'Виставив салон у «Команді».'}
            </div>
            {(shifts || []).map((s, i) => (
              <div key={i} className={`mw-shift ${s.active ? '' : 'off'} ${i === weekday ? 'sel' : ''}`}>
                <span className={`mw-switch ${s.active ? 'on' : ''}`} aria-hidden><i /></span>
                <span className="mw-shift-day">{s.day}</span>
                <span className="mw-shift-time">{s.active ? `${s.start} – ${s.end}` : 'Вихідний'}</span>
              </div>
            ))}
          </section>

          <section className="mw-card mw-earn">
            <div className="mw-label">Заробіток</div>
            {work?.unpaid?.length ? (
              <>
                <div className="mw-big">{money(unpaid)}</div>
                <div className="mw-sub">до виплати{work.unpaid[0]?.since ? ` з ${fromKey(work.unpaid[0].since.slice(0, 10)).getDate()} ${MONTHS_GEN[fromKey(work.unpaid[0].since.slice(0, 10)).getMonth()]}` : ''}</div>
              </>
            ) : (
              <div className="mw-sub" style={{ marginTop: '0.4rem' }}>{work ? 'Зʼявиться, щойно салон налаштує вашу оплату.' : 'Завантаження…'}</div>
            )}
            {(work?.payouts || []).slice(0, 3).map((p: any, i: number) => (
              <div key={i} className="mw-pay">
                <span>{p.paid_at ? `${fromKey(p.paid_at.slice(0, 10)).getDate()} ${MONTHS_GEN[fromKey(p.paid_at.slice(0, 10)).getMonth()]}` : '—'}</span>
                <b>{money(p.amount || 0)}</b>
              </div>
            ))}
          </section>
        </aside>
      </div>

      {toast && <div className={`mw-toast ${toast.ok ? '' : 'err'}`} role="status">{toast.text}</div>}

      <style jsx>{`
        .mw { width: 100%; box-sizing: border-box; min-height: 100%; padding: 2rem clamp(1.25rem, 3vw, 3rem) 3rem; color: #1D1D1F;
          background: radial-gradient(70% 45% at 0% 0%, #EEF5EE 0%, rgba(238,245,238,0) 70%), #FAFAF9; }

        /* Шапка */
        .mw-hero { display: flex; justify-content: space-between; align-items: flex-end; gap: 2rem; flex-wrap: wrap; margin-bottom: 1.75rem; }
        .mw-date { font-size: 0.875rem; font-weight: 600; color: #6F9273; text-transform: capitalize; }
        .mw-hello h1 { font-size: clamp(2rem, 3.4vw, 2.75rem); font-weight: 700; letter-spacing: -0.04em; line-height: 1.05; margin: 0.35rem 0 0.6rem; }
        .mw-hello p { margin: 0; font-size: 1.05rem; color: #6E6E73; max-width: 640px; line-height: 1.5; }
        .mw-next { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.3rem 1rem 1rem; border-radius: 24px;
          background: linear-gradient(135deg, #FFFFFF 0%, #F2F8F2 100%); box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 18px 40px -26px rgba(46,58,48,.4); }
        .mw-next-ava { width: 52px; height: 52px; border-radius: 16px; background: #DCE8DB; color: #2E4A33; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; font-weight: 700; }
        .mw-next-label { font-size: 0.75rem; font-weight: 600; color: #6F9273; }
        .mw-next-time { font-size: 1.4rem; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
        .mw-next-who { font-size: 0.85rem; color: #6E6E73; }

        /* Тиждень */
        .mw-week-bar { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
        .mw-week { display: grid; grid-template-columns: repeat(7, minmax(56px, 1fr)); gap: 0.4rem; flex: 1; min-width: 0; }
        .mw-wday { border: none; background: #fff; border-radius: 18px; padding: 0.6rem 0 0.55rem; cursor: pointer; font-family: inherit;
          display: flex; flex-direction: column; align-items: center; gap: 0.15rem; box-shadow: 0 1px 2px rgba(0,0,0,.04);
          transition: background-color .2s, box-shadow .2s, transform .2s; }
        .mw-wday:hover { transform: translateY(-1px); box-shadow: 0 10px 22px -16px rgba(46,58,48,.45); }
        .mw-wd { font-size: 0.72rem; font-weight: 600; color: #86868B; text-transform: uppercase; letter-spacing: 0.04em; }
        .mw-dn { font-size: 1.3rem; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
        .mw-dots { display: flex; gap: 3px; height: 5px; }
        .mw-dots i { width: 5px; height: 5px; border-radius: 50%; background: #8FAE93; }
        .mw-wday.off { background: #F6F6F4; }
        .mw-wday.off .mw-dn { color: #AEAEB2; }
        .mw-wday.today .mw-dn { color: #5C7A61; }
        .mw-wday.sel { background: #6F9273; box-shadow: 0 12px 26px -14px rgba(111,146,115,.8); }
        .mw-wday.sel .mw-wd, .mw-wday.sel .mw-dn { color: #fff; }
        .mw-wday.sel .mw-dots i { background: rgba(255,255,255,.85); }
        .mw-round { width: 38px; height: 38px; border-radius: 50%; border: none; background: #fff; color: #5C7A61; font-size: 1.3rem; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,.05); }
        .mw-round:hover { background: #F2F8F2; }
        .mw-week-actions { display: flex; gap: 0.5rem; align-items: center; }
        .mw-pill { height: 38px; padding: 0 1rem; border-radius: 999px; border: none; background: #fff; color: #1D1D1F; font-family: inherit;
          font-size: 0.875rem; font-weight: 600; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,.05); text-transform: none; white-space: nowrap; }
        .mw-pill:hover, .mw-pill.on { background: #F2F8F2; color: #2E4A33; }
        .mw-month-wrap { position: relative; }
        .mw-month { position: absolute; right: 0; top: calc(100% + 8px); z-index: 30; width: 300px; padding: 1rem; border-radius: 22px; background: #fff;
          box-shadow: 0 24px 60px -20px rgba(0,0,0,.25), 0 0 0 1px rgba(0,0,0,.04); }
        .mw-month-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; font-weight: 600; text-transform: capitalize; }
        .mw-month-head button { border: none; background: none; font-size: 1.2rem; color: #6F9273; cursor: pointer; width: 30px; height: 30px; border-radius: 50%; }
        .mw-month-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
        .mw-mwd { text-align: center; font-size: 0.68rem; font-weight: 600; color: #AEAEB2; padding-bottom: 0.3rem; }
        .mw-mday { position: relative; height: 34px; border: none; background: none; border-radius: 50%; font-family: inherit; font-size: 0.85rem; cursor: pointer; color: #1D1D1F; }
        .mw-mday:hover { background: #F5F5F7; }
        .mw-mday.today { color: #5C7A61; font-weight: 700; }
        .mw-mday.sel { background: #6F9273; color: #fff; font-weight: 600; }
        .mw-mday i { position: absolute; left: 50%; bottom: 3px; width: 4px; height: 4px; margin-left: -2px; border-radius: 50%; background: #8FAE93; }

        /* Сітка */
        .mw-grid { display: grid; grid-template-columns: 1fr minmax(300px, 360px); gap: 1.25rem; align-items: start; }
        .mw-card { background: #fff; border-radius: 28px; padding: 1.5rem; box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 20px 44px -30px rgba(46,58,48,.35); }
        .mw-h2 { font-size: 1.35rem; font-weight: 700; letter-spacing: -0.025em; }
        .mw-h3 { font-size: 1.05rem; font-weight: 700; }
        .mw-sub { font-size: 0.875rem; color: #86868B; line-height: 1.5; }
        .mw-label { font-size: 0.8rem; font-weight: 600; color: #86868B; }
        .mw-big { font-size: 2.1rem; font-weight: 700; letter-spacing: -0.04em; margin: 0.2rem 0 0.35rem; font-variant-numeric: tabular-nums; }

        /* День */
        .mw-daycard { padding-bottom: 0.75rem; }
        .mw-day-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1rem; }
        .mw-day-top .mw-pill { background: #F2F8F2; color: #2E4A33; box-shadow: none; }
        .mw-quick { padding: 1rem 1.1rem; border-radius: 20px; background: #F6F9F5; margin-bottom: 1rem; }
        .mw-quick-row { display: flex; gap: 0.6rem; align-items: flex-end; flex-wrap: wrap; }
        .mw-quick-row label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.72rem; font-weight: 600; color: #86868B; }
        .mw-quick input { height: 40px; padding: 0 0.7rem; border-radius: 12px; border: 1px solid #E3E8E2; background: #fff; font-family: inherit; font-size: 0.9rem; color: #1D1D1F; outline: none; }
        .mw-quick input:focus { border-color: #8FAE93; box-shadow: 0 0 0 4px rgba(143,174,147,.18); }
        .mw-quick-note { flex: 1; min-width: 180px; }
        .mw-save { height: 40px; padding: 0 1.2rem; border-radius: 12px; border: none; background: #6F9273; color: #fff; font-family: inherit; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
        .mw-save:disabled { opacity: .45; cursor: default; }
        .mw-quick-hint { font-size: 0.78rem; color: #86868B; margin-top: 0.6rem; }

        .mw-scroll { max-height: 640px; overflow-y: auto; margin: 0 -0.5rem; padding: 0.5rem 0.5rem 0.5rem 0; scrollbar-width: thin; }
        .mw-timeline { position: relative; margin-left: 58px; cursor: copy; }
        .mw-hour { position: absolute; left: 0; right: 0; height: 0; border-top: 1px solid #F0F0EE; }
        .mw-hour span { position: absolute; left: -58px; top: -9px; width: 48px; text-align: right; font-size: 0.75rem; color: #AEAEB2; font-variant-numeric: tabular-nums; }
        .mw-offshift { position: absolute; left: 0; right: 0; background: repeating-linear-gradient(135deg, rgba(0,0,0,0) 0 10px, rgba(0,0,0,.025) 10px 20px), #FAFAF8; border-radius: 12px; }
        .mw-now { position: absolute; left: -6px; right: 0; height: 2px; background: #FF3B30; z-index: 4; pointer-events: none; }
        .mw-now i { position: absolute; left: -4px; top: -4px; width: 10px; height: 10px; border-radius: 50%; background: #FF3B30; }
        .mw-loading { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #AEAEB2; font-size: 0.9rem; }

        .mw-ev { position: absolute; left: 6px; right: 6px; z-index: 2; border-radius: 14px; padding: 0.55rem 0.8rem 0.55rem 1rem; overflow: hidden; cursor: default;
          box-shadow: 0 1px 2px rgba(0,0,0,.04); transition: box-shadow .2s, transform .2s; }
        .mw-ev::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--bar); }
        .mw-ev:hover { box-shadow: 0 12px 26px -16px rgba(46,58,48,.5); transform: translateY(-1px); z-index: 3; }
        .mw-ev b { font-size: 0.925rem; font-weight: 700; letter-spacing: -0.01em; }
        .mw-ev span { font-size: 0.8rem; opacity: .85; font-variant-numeric: tabular-nums; }
        .mw-ev-line { display: flex; align-items: baseline; gap: 0.6rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mw-ev-body { display: flex; flex-direction: column; gap: 0.15rem; }
        .mw-ev-meta { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.2rem; }
        .mw-ev-meta em { font-style: normal; font-weight: 600; }
        .mw-ev-meta a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
        .mw-ev-status { opacity: .75; font-weight: 500 !important; }
        .mw-ev.off { background: repeating-linear-gradient(135deg, #F7F7F5 0 8px, #EFEFEC 8px 16px); color: #6E6E73; --bar: #C7C7CC; }
        .mw-ev-x { position: absolute; top: 6px; right: 8px; width: 26px; height: 26px; border-radius: 50%; border: none; background: rgba(255,255,255,.9); color: #86868B; font-size: 1rem; cursor: pointer; }
        .mw-ev-x:hover { color: #E0645C; }

        /* Праворуч */
        .mw-side { display: flex; flex-direction: column; gap: 1.25rem; }
        .mw-kv { display: flex; gap: 1.25rem; font-size: 0.875rem; color: #86868B; }
        .mw-kv b { color: #1D1D1F; font-weight: 700; }
        .mw-bars { display: flex; align-items: flex-end; gap: 4px; height: 64px; margin: 1.1rem 0 1rem; }
        .mw-bars span { flex: 1; border-radius: 4px 4px 2px 2px; background: #DCE8DB; transition: background-color .2s; }
        .mw-bars span:hover { background: #B8CFB9; }
        .mw-bars span.now { background: #6F9273; }
        .mw-rating { display: flex; align-items: center; gap: 0.6rem; padding-top: 0.9rem; border-top: 1px solid #F2F2F0; font-size: 0.85rem; color: #6E6E73; }
        .mw-stars i { font-style: normal; color: #E5E5EA; font-size: 1rem; }
        .mw-stars i.on { color: #F5A623; }

        .mw-shift { display: grid; grid-template-columns: 40px 1fr auto; align-items: center; gap: 0.7rem; padding: 0.5rem 0.55rem; border-radius: 12px; }
        .mw-shift.sel { background: #F2F8F2; }
        .mw-shift-day { font-size: 0.9rem; font-weight: 600; }
        .mw-shift.off .mw-shift-day { color: #64748b; }
        .mw-shift-time { font-size: 0.875rem; font-variant-numeric: tabular-nums; }
        .mw-shift.off .mw-shift-time { color: #AEAEB2; }
        /* Той самий перемикач, що в «Команді» */
        .mw-switch { width: 40px; height: 22px; border-radius: 12px; background: #e2e8f0; position: relative; display: inline-block; }
        .mw-switch i { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.18); }
        .mw-switch.on { background: #10b981; }
        .mw-switch.on i { left: 20px; }

        .mw-earn { background: linear-gradient(160deg, #FFFFFF 0%, #F2F8F2 100%); }
        .mw-earn .mw-big { color: #2E4A33; }
        .mw-pay { display: flex; justify-content: space-between; padding: 0.55rem 0; border-top: 1px solid rgba(0,0,0,.05); font-size: 0.875rem; color: #6E6E73; }
        .mw-pay b { color: #1D1D1F; font-variant-numeric: tabular-nums; }

        .mw-toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); z-index: 50; padding: 0.75rem 1.2rem; border-radius: 16px;
          background: #fff; color: #2E4A33; font-size: 0.9rem; font-weight: 600; box-shadow: 0 18px 44px -14px rgba(0,0,0,.28), 0 0 0 1px rgba(0,0,0,.04);
          animation: mwIn .35s cubic-bezier(.16,1,.3,1); }
        .mw-toast.err { color: #B42318; }
        @keyframes mwIn { from { opacity: 0; transform: translate(-50%, 8px); } }

        @media (max-width: 1180px) { .mw-grid { grid-template-columns: 1fr; } }
        @media (max-width: 720px) {
          .mw-week { grid-template-columns: repeat(7, 1fr); gap: 0.25rem; }
          .mw-dn { font-size: 1.05rem; }
          .mw-round { display: none; }
        }
      `}</style>
    </div>
  );
}
