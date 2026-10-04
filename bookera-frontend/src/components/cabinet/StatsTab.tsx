'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, Analytics } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';
import { notify } from '@/lib/feedback';
import FormModal from '@/components/ui/FormModal';
import HelpTip from '@/components/ui/HelpTip';

/**
 * Аналітика - у стилі решти кабінету: панель (розділи, період, експорт),
 * сторінка ліворуч, бічна колонка праворуч.
 *
 * ВСІ цифри рахує сервер (app/services/analytics.py), тут лише показ.
 * Раніше вкладка рахувала в браузері й помилялась: дохід - за каталожною
 * ціною послуги, «нові клієнти» - лише за візитами періоду, а «джерела
 * залучення» вигадувались (55% / 30% / 15%), якщо нічого не розпізнано.
 * Прибрано також «прогноз зарплат» у прибутку й ціль, що скидалась.
 *
 * Розділи: Огляд · Клієнти · Послуги й команда.
 *
 * «Гроші» окремим розділом прибрано: список витрат уже є у «Склад і Витрати»,
 * дублювати його тут нема сенсу. Тут - те, чого там немає: фінансовий результат
 * і його динаміка по місяцях (дохід, витрати, прибуток), з переходом у витрати.
 * Кожне число порівнюється з попереднім періодом ТІЄЇ Ж ДОВЖИНИ.
 */

type View = 'overview' | 'clients' | 'team';
type PeriodType = 'week' | 'month' | 'year' | 'custom';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const WEEKDAYS_FULL = ['понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота', 'неділя'];
const CAT_COLOR: Record<string, string> = {
  Матеріали: '#8b5cf6', Оренда: '#0ea5e9', Комунальні: '#14b8a6', Зарплата: '#f59e0b',
  Маркетинг: '#ec4899', Податки: '#64748b', Інше: '#94a3b8',
};

const money = (n: number) => `${Math.round(n).toLocaleString('uk-UA')} ₴`;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const short = (d: Date) => d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
const plural = (n: number, one: string, few: string, many: string) =>
  n % 10 === 1 && n % 100 !== 11 ? one : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? few : many;

function rangeOf(type: PeriodType, anchor: Date, custom: { from: string; to: string }): { from: Date; to: Date } {
  if (type === 'custom') return { from: parse(custom.from), to: parse(custom.to) };
  const a = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  if (type === 'week') {
    const shift = (a.getDay() + 6) % 7; // понеділок - початок
    const from = new Date(a); from.setDate(a.getDate() - shift);
    const to = new Date(from); to.setDate(from.getDate() + 6);
    return { from, to };
  }
  if (type === 'month') return { from: new Date(a.getFullYear(), a.getMonth(), 1), to: new Date(a.getFullYear(), a.getMonth() + 1, 0) };
  return { from: new Date(a.getFullYear(), 0, 1), to: new Date(a.getFullYear(), 11, 31) };
}

/** З чим порівнювати: тиждень - минулий тиждень, місяць - минулий календарний місяць, рік - минулий рік. */
function compareOf(type: PeriodType, from: Date, to: Date): { from: Date; to: Date } {
  if (type === 'week') { const f = new Date(from); f.setDate(f.getDate() - 7); const t = new Date(to); t.setDate(t.getDate() - 7); return { from: f, to: t }; }
  if (type === 'month') return { from: new Date(from.getFullYear(), from.getMonth() - 1, 1), to: new Date(from.getFullYear(), from.getMonth(), 0) };
  if (type === 'year') return { from: new Date(from.getFullYear() - 1, 0, 1), to: new Date(from.getFullYear() - 1, 11, 31) };
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  const t = new Date(from); t.setDate(t.getDate() - 1);
  const f = new Date(t); f.setDate(f.getDate() - (days - 1));
  return { from: f, to: t };
}

/** Зміна відносно минулого періоду. invert - коли менше означає краще (скасування). */
function Delta({ cur, prev, invert = false, unit = '%' }: { cur: number; prev: number; invert?: boolean; unit?: string }) {
  if (!prev && !cur) return <span className="st-delta flat">без змін</span>;
  if (!prev) return <span className="st-delta up">нове</span>;
  const diff = unit === '%' ? ((cur - prev) / prev) * 100 : cur - prev;
  if (Math.abs(diff) < 0.5) return <span className="st-delta flat">без змін</span>;
  const good = invert ? diff < 0 : diff > 0;
  return (
    <span className={`st-delta ${good ? 'up' : 'down'}`}>
      {diff > 0 ? '↑' : '↓'} {Math.abs(Math.round(diff))}{unit === '%' ? '%' : ' п.п.'}
    </span>
  );
}

function Bars({ series, color = '#436b49' }: { series: { label: string; value: number; sub: string }[]; color?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...series.map(s => s.value), 1);
  const shown = hover != null ? series[hover] : null;
  return (
    <div>
      <div className="st-bars-head">{shown ? <><b>{shown.label}</b> · {shown.sub}</> : <span>Наведіть на стовпчик, щоб побачити день</span>}</div>
      <div className="st-bars" onMouseLeave={() => setHover(null)}>
        {series.map((s, i) => (
          <div key={i} className="st-bar-col" onMouseEnter={() => setHover(i)}>
            <i style={{ height: `${Math.max(s.value / max * 100, s.value > 0 ? 3 : 0)}%`, background: hover === i ? '#0f172a' : color }} />
          </div>
        ))}
      </div>
      <div className="st-bars-axis"><span>{series[0]?.label}</span><span>{series[series.length - 1]?.label}</span></div>
    </div>
  );
}

function ShareList({ rows, color }: { rows: { label: string; value: string; share: number; color?: string }[]; color?: string }) {
  return (
    <div className="st-share">
      {rows.map((r, i) => (
        <div key={i} className="st-share-row">
          <div className="st-share-top"><span>{r.label}</span><b>{r.value}</b></div>
          <i><em style={{ width: `${Math.max(r.share, 2)}%`, background: r.color || color || '#94a3b8' }} /></i>
        </div>
      ))}
    </div>
  );
}

export default function StatsTab({ business, onNavigate }: { business: any; services?: any; team?: any; onNavigate?: (tab: string) => void }) {
  const bid = Number(business?.id);
  const [view, setView] = useState<View>('overview');
  const [type, setType] = useState<PeriodType>('month');
  const [anchor, setAnchor] = useState(() => new Date());
  const [custom, setCustom] = useState(() => { const t = ymd(new Date()); return { from: t, to: t }; });
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [goalModal, setGoalModal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { from, to } = useMemo(() => rangeOf(type, anchor, custom), [type, anchor, custom]);
  const fromKey = ymd(from), toKey = ymd(to);
  const cmp = useMemo(() => compareOf(type, from, to), [type, from, to]);
  const cmpFrom = ymd(cmp.from), cmpTo = ymd(cmp.to);

  const load = useCallback(async () => {
    if (!bid) return;
    setLoading(true);
    try {
      setData(await api.getAnalytics(await getAuthToken(), bid, fromKey, toKey, { from: cmpFrom, to: cmpTo }));
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Не вдалося завантажити аналітику');
    } finally {
      setLoading(false);
    }
  }, [bid, fromKey, toKey, cmpFrom, cmpTo]);

  useEffect(() => { void load(); }, [load]);

  const label = useMemo(() => {
    if (type === 'month') return anchor.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase());
    if (type === 'year') return String(anchor.getFullYear());
    return `${short(from)} – ${short(to)} ${to.getFullYear()}`;
  }, [type, anchor, from, to]);

  const shift = (dir: -1 | 1) => {
    if (type === 'custom') {
      const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
      const f = new Date(from); f.setDate(f.getDate() + dir * days);
      const t = new Date(to); t.setDate(t.getDate() + dir * days);
      setCustom({ from: ymd(f), to: ymd(t) });
      return;
    }
    const a = new Date(anchor);
    if (type === 'week') a.setDate(a.getDate() + 7 * dir);
    if (type === 'month') a.setMonth(a.getMonth() + dir, 1);
    if (type === 'year') a.setFullYear(a.getFullYear() + dir);
    setAnchor(a);
  };

  const cur = data?.current, prev = data?.previous;
  const empty = !!data && data.current.completed === 0 && data.current.cancelled === 0 && data.current.no_show === 0;

  // Для довгих періодів стовпчики по тижнях / місяцях: 365 тонких стовпчиків нічого не скажуть
  const chart = useMemo(() => {
    if (!data) return [];
    const s = data.series;
    const group = s.length <= 35 ? 1 : s.length <= 120 ? 7 : 30;
    const out: { label: string; value: number; sub: string }[] = [];
    for (let i = 0; i < s.length; i += group) {
      const part = s.slice(i, i + group);
      const rev = part.reduce((a, x) => a + x.revenue, 0), n = part.reduce((a, x) => a + x.completed, 0);
      const first = parse(part[0].date), last = parse(part[part.length - 1].date);
      out.push({
        label: group === 1 ? first.toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'short' }) : `${short(first)} – ${short(last)}`,
        value: rev, sub: `${money(rev)} · ${n} ${plural(n, 'візит', 'візити', 'візитів')}`,
      });
    }
    return out;
  }, [data]);

  const saveGoal = async () => {
    if (goalModal == null) return;
    const raw = goalModal.replace(/\s/g, '').replace(',', '.');
    const amount = raw === '' ? null : Number(raw);
    if (amount !== null && (!(amount >= 0) || Number.isNaN(amount))) return notify('Вкажіть суму числом', 'error', { field: 'st-goal' });
    setSaving(true);
    try {
      const goal = await api.setMonthlyGoal(await getAuthToken(), bid, amount && amount > 0 ? amount : null);
      setData(d => (d ? { ...d, goal } : d));
      setGoalModal(null);
    } catch (err: any) {
      notify(err?.message || 'Не вдалося зберегти ціль', 'error');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    if (!data) return;
    const q = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows: any[][] = [
      [`Аналітика ${business?.name || ''}`, `${fromKey} — ${toKey}`], [],
      ['Показник', 'Цей період', 'Попередній'],
      ['Дохід, ₴', data.current.revenue, data.previous.revenue],
      ['Завершено візитів', data.current.completed, data.previous.completed],
      ['Середній чек, ₴', data.current.avg_check, data.previous.avg_check],
      ['Скасування й неявки, %', data.current.cancel_rate, data.previous.cancel_rate],
      ['Нових клієнтів', data.current.new_clients, data.previous.new_clients],
      ['Витрати, ₴', data.money.expenses, ''], ['Прибуток, ₴', data.money.profit, ''], [],
      ['Послуга', 'Візитів', 'Дохід, ₴', 'Середня ціна, ₴'],
      ...data.services.map(s => [s.name, s.count, s.revenue, s.avg_price]), [],
      ['Майстер', 'Візитів', 'Дохід, ₴', 'Середній чек, ₴', 'Скасування, %'],
      ...data.staff.map(s => [s.name, s.completed, s.revenue, s.avg_check, s.cancel_rate]), [],
      ['Витрати за категоріями', 'Сума, ₴'], ...data.money.expenses_by_category.map(e => [e.category, e.amount]), [],
      ['Дата', 'Дохід, ₴', 'Візитів'], ...data.series.map(s => [s.date, s.revenue, s.completed]),
    ];
    const csv = '﻿' + rows.map(r => r.map(q).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `analytics_${fromKey}_${toKey}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const goal = data?.goal;
  const hint = view === 'overview'
    ? { t: 'Порівняння з минулим періодом', x: data
        ? `Кожна стрілка — зміна відносно ${short(parse(data.previous_period.start))} – ${short(parse(data.previous_period.end))}${data.previous_period.elapsed_days ? ` (стільки ж днів, скільки вже минуло: ${data.previous_period.elapsed_days})` : ''}`
        : 'Кожна стрілка — зміна відносно попереднього періоду.' }
    : view === 'clients'
        ? { t: 'Ті самі правила, що в «Клієнтах»', x: 'Новий — перший завершений візит припав на цей період. «Давно не були» — понад 60 днів без візиту й без запису наперед.' }
        : { t: 'Дохід — за фактичною ціною візиту', x: 'Знижки й доповнення вже враховані: береться сума, що записана у візиті, а не ціна з каталогу.' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%', background: '#fff' }}>
      {/* --- ПАНЕЛЬ --- */}
      <div className="st-toolbar">
        <div className="st-seg" role="tablist">
          {([['overview', 'Огляд'], ['clients', 'Клієнти'], ['team', 'Послуги й команда']] as [View, string][]).map(([id, l]) => (
            <button key={id} type="button" role="tab" aria-selected={view === id} className={view === id ? 'on' : ''} onClick={() => setView(id)}>{l}</button>
          ))}
        </div>
        <div className="st-period">
          <button type="button" aria-label="Назад" onClick={() => shift(-1)}>‹</button>
          <span>{label}</span>
          <button type="button" aria-label="Вперед" onClick={() => shift(1)}>›</button>
          <div className="st-seg small">
            {([['week', 'Тиждень'], ['month', 'Місяць'], ['year', 'Рік'], ['custom', 'Свій']] as [PeriodType, string][]).map(([id, l]) => (
              <button key={id} type="button" className={type === id ? 'on' : ''} onClick={() => { setType(id); if (id === 'custom') setCustom({ from: fromKey, to: toKey }); else setAnchor(to); }}>{l}</button>
            ))}
          </div>
          {type === 'custom' && (
            <span className="st-range">
              <input type="date" className="clean-input" value={custom.from} max={custom.to} onChange={e => e.target.value && setCustom(c => ({ ...c, from: e.target.value }))} />
              <span>–</span>
              <input type="date" className="clean-input" value={custom.to} min={custom.from} onChange={e => e.target.value && setCustom(c => ({ ...c, to: e.target.value }))} />
            </span>
          )}
          <button type="button" className="clean-btn-ghost" disabled={!data} onClick={exportCsv}>Експорт</button>
        </div>
      </div>

      <div className="st-grid">
        <div className="custom-scroll st-main">
          <div className="st-main-inner" style={{ opacity: loading && data ? 0.55 : 1, transition: 'opacity .15s' }}>
            {error ? <div className="st-empty"><b>Аналітика недоступна</b><span>{error}</span></div>
            : !data || !cur || !prev ? <div className="st-empty"><span>Завантаження…</span></div>
            : (
              <>
                {/* ================= ОГЛЯД ================= */}
                {view === 'overview' && (
                  <>
                    <div className="st-kpis six">
                      <div className="st-kpi"><small>Дохід</small><strong>{money(cur.revenue)}</strong><Delta cur={cur.revenue} prev={prev.revenue} /></div>
                      <div className="st-kpi"><small>Витрати <HelpTip>Усе, що вже сплачено за період, разом із виплатами зарплат. Майбутні платежі не рахуються.</HelpTip></small><strong>{money(data.money.expenses)}</strong>
                        <span className="st-delta flat">{data.money.expenses_through ? `до ${short(parse(data.money.expenses_through))}` : 'ще немає'}</span></div>
                      <div className={`st-kpi ${data.money.profit < 0 ? 'neg' : ''}`}><small>Прибуток <HelpTip>Дохід мінус уже зроблені витрати.</HelpTip></small><strong>{money(data.money.profit)}</strong>
                        <span className="st-delta flat">{data.money.revenue > 0 ? `${Math.round(data.money.profit / data.money.revenue * 100)}% від доходу` : '—'}</span></div>
                      <div className="st-kpi"><small>Візитів</small><strong>{cur.completed}</strong><Delta cur={cur.completed} prev={prev.completed} /></div>
                      <div className="st-kpi"><small>Середній чек <HelpTip>Дохід, поділений на кількість завершених візитів.</HelpTip></small><strong>{money(cur.avg_check)}</strong><Delta cur={cur.avg_check} prev={prev.avg_check} /></div>
                      <div className="st-kpi"><small>Скасування <HelpTip>Скасовані й неявки відносно всіх записів, що мали відбутись (завершені + скасовані + неявки).</HelpTip></small><strong>{cur.cancel_rate}%</strong><Delta cur={cur.cancel_rate} prev={prev.cancel_rate} invert unit="pp" /></div>
                    </div>

                    {data.previous_period.elapsed_days != null && (
                      <p className="st-asof">
                        Дані станом на <b>{new Date().toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}</b> — те, що вже є.
                        Порівняння з {short(parse(data.previous_period.start))} – {short(parse(data.previous_period.end))}
                      </p>
                    )}

                    {empty ? (
                      <div className="st-empty"><b>У цьому періоді ще немає візитів</b><span>Оберіть інший період або завершіть візити в календарі — вони з’являться тут.</span></div>
                    ) : (
                      <>
                        <div className="st-split">
                          <div>
                            <h3 className="st-h">Дохід по днях</h3>
                            <div className="st-card"><Bars series={chart} /></div>
                          </div>
                          <div>
                            <h3 className="st-h">Дохід і витрати по місяцях
                              <button type="button" className="st-link right" onClick={() => onNavigate?.('Inventory')}>Усі витрати →</button>
                            </h3>
                            <div className="st-card"><Monthly rows={data.monthly} /></div>
                          </div>
                        </div>

                        <h3 className="st-h">Коли до вас записуються <HelpTip>Усі записи за період (завершені й майбутні): скільки їх припадає на кожен день тижня й на кожну годину початку.</HelpTip></h3>
                        <div className="st-card"><LoadCharts heat={data.load.heatmap} /></div>
                      </>
                    )}
                  </>
                )}

                {/* ================= КЛІЄНТИ ================= */}
                {view === 'clients' && (
                  <>
                    <div className="st-kpis">
                      <div className="st-kpi"><small>Були в періоді</small><strong>{data.clients.active}</strong><Delta cur={cur.clients} prev={prev.clients} /></div>
                      <div className="st-kpi"><small>Нові <HelpTip>Перший завершений візит у цьому закладі припав на обраний період.</HelpTip></small><strong>{data.clients.new}</strong><Delta cur={cur.new_clients} prev={prev.new_clients} /></div>
                      <div className="st-kpi"><small>Повернулись <HelpTip>Були в періоді й мали завершений візит раніше.</HelpTip></small><strong>{data.clients.returning}</strong><span className="st-delta flat">{data.clients.active ? `${data.clients.returning_share}% від усіх` : '—'}</span></div>
                      <div className="st-kpi"><small>Дохід з клієнта <HelpTip>Середня сума, яку клієнт приніс за весь час, а не за обраний період.</HelpTip></small><strong>{money(data.clients.avg_lifetime_value)}</strong><span className="st-delta flat">за весь час</span></div>
                    </div>

                    <h3 className="st-h">Стан бази</h3>
                    <div className="st-card st-two">
                      <div><small>Постійні</small><strong>{data.clients.regular}</strong><p>3 і більше візитів</p></div>
                      <div><small>Давно не були</small><strong>{data.clients.lapsed}</strong><p>понад 60 днів без візиту</p></div>
                      <div><small>Заходять раз на</small><strong>{data.clients.avg_gap_days != null ? `${Math.round(data.clients.avg_gap_days)} дн.` : '—'}</strong><p>типовий інтервал між візитами</p></div>
                    </div>

                    <div className="st-cols">
                      <div>
                        <h3 className="st-h">Найцінніші клієнти періоду</h3>
                        <div className="st-card">
                          {data.clients.top.length === 0 ? <p className="st-note" style={{ margin: 0 }}>Завершених візитів ще немає.</p> : (
                            data.clients.top.map((c, i) => (
                              <div key={i} className="st-row"><span>{c.name}<small>{c.visits} {plural(c.visits, 'візит', 'візити', 'візитів')}</small></span><b>{money(c.spent)}</b></div>
                            ))
                          )}
                        </div>
                      </div>
                      <div>
                        <h3 className="st-h">Звідки записи <HelpTip>За фактичним джерелом запису: вітрина BookEra, пряме посилання, внесено вручну тощо.</HelpTip></h3>
                        <div className="st-card">
                          {data.sources.length === 0 ? <p className="st-note" style={{ margin: 0 }}>Записів за період ще немає.</p>
                            : <ShareList color="#436b49" rows={data.sources.map(s => ({ label: s.label, value: `${s.count} · ${Math.round(s.share)}%`, share: s.share }))} />}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* ================= ПОСЛУГИ Й КОМАНДА ================= */}
                {view === 'team' && (
                  <>
                    <h3 className="st-h" style={{ marginTop: 0 }}>Послуги</h3>
                    {data.services.length === 0 ? <div className="st-card"><p className="st-note" style={{ margin: 0 }}>За цей період завершених візитів ще немає.</p></div> : (
                      <table className="service-table">
                        <thead><tr><th>Послуга</th><th style={{ textAlign: 'right' }}>Візитів</th><th style={{ textAlign: 'right' }}>Дохід</th><th style={{ textAlign: 'right' }}>Сер. ціна</th><th style={{ width: '24%' }}>Частка доходу</th></tr></thead>
                        <tbody>
                          {data.services.map(s => (
                            <tr key={s.service_id}>
                              <td><b>{s.name}</b></td><td style={{ textAlign: 'right' }}>{s.count}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(s.revenue)}</td><td style={{ textAlign: 'right', color: '#64748b' }}>{money(s.avg_price)}</td>
                              <td><div className="st-mini"><i><em style={{ width: `${Math.max(s.share, 2)}%` }} /></i><span>{Math.round(s.share)}%</span></div></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    <h3 className="st-h">Команда</h3>
                    {data.staff.length === 0 ? <div className="st-card"><p className="st-note" style={{ margin: 0 }}>За цей період візитів у команди ще немає.</p></div> : (
                      <table className="service-table">
                        <thead><tr><th>Майстер</th><th style={{ textAlign: 'right' }}>Візитів</th><th style={{ textAlign: 'right' }}>Дохід</th><th style={{ textAlign: 'right' }}>Сер. чек</th><th style={{ textAlign: 'right' }}>Скасування</th><th style={{ width: '20%' }}>Частка</th></tr></thead>
                        <tbody>
                          {data.staff.map(s => (
                            <tr key={s.staff_id ?? 'none'}>
                              <td><b>{s.name}</b></td><td style={{ textAlign: 'right' }}>{s.completed}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(s.revenue)}</td><td style={{ textAlign: 'right', color: '#64748b' }}>{money(s.avg_check)}</td>
                              <td style={{ textAlign: 'right', color: s.cancel_rate > 25 ? '#dc2626' : '#64748b' }}>{s.cancel_rate}%</td>
                              <td><div className="st-mini"><i><em style={{ width: `${Math.max(s.share, 2)}%` }} /></i><span>{Math.round(s.share)}%</span></div></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* --- БІЧНА КОЛОНКА --- */}
        <aside className="st-side">
          <div className="custom-scroll st-side-scroll">
            <div className="widget-card">
              <div className="widget-title">Ціль · {goal ? parse(goal.month_start).toLocaleDateString('uk-UA', { month: 'long' }) : 'місяця'}</div>
              {goal?.goal ? (
                <>
                  <div className="st-goal-top"><b>{money(goal.month_revenue)}</b><span>із {money(goal.goal)}</span></div>
                  <div className="st-goal-bar"><i style={{ width: `${Math.min(goal.percent || 0, 100)}%`, background: (goal.percent || 0) >= 100 ? '#059669' : '#436b49' }} /></div>
                  <p className="st-note">
                    {(goal.percent || 0) >= 100
                      ? 'Ціль виконано 🎉'
                      : <>Виконано {Math.round(goal.percent || 0)}% · лишилось {goal.days_left} {plural(goal.days_left, 'день', 'дні', 'днів')} · ще <b>{money(goal.goal - goal.month_revenue)}</b></>}
                  </p>
                  <button type="button" className="st-link" onClick={() => setGoalModal(String(goal.goal))}>Змінити ціль</button>
                </>
              ) : (
                <>
                  <p className="st-note" style={{ marginTop: 0 }}>Задайте, скільки хочете заробити цього місяця — тут з’явиться прогрес.</p>
                  <button type="button" className="clean-btn-ghost" onClick={() => setGoalModal('')}>Поставити ціль</button>
                </>
              )}
            </div>
            {data && cur && (
              <div className="widget-card">
                <div className="widget-title">За період</div>
                <div className="st-row"><span>Завершено</span><b>{cur.completed}</b></div>
                <div className="st-row"><span>Скасовано</span><b>{cur.cancelled}</b></div>
                <div className="st-row"><span>Неявки</span><b>{cur.no_show}</b></div>
                <div className="st-row"><span>Заплановано далі</span><b>{cur.upcoming}</b></div>
              </div>
            )}
          </div>
          <div className="st-hint">
            <div className="st-hint-t">✦ Підказка</div>
            <b>{hint.t}</b>
            <p>{hint.x}</p>
          </div>
        </aside>
      </div>

      {goalModal != null && (
        <FormModal open onClose={() => setGoalModal(null)} width={420} title="Ціль доходу на місяць" subtitle="Рахується за завершеними візитами поточного місяця"
          primary={{ label: 'Зберегти', onClick: () => void saveGoal(), loading: saving }}>
          <div className="fm-row" style={{ display: 'block' }}>
            <span className="fm-affix">
              <input className="fm-input" data-field="st-goal" inputMode="decimal" autoFocus placeholder="напр., 50000" value={goalModal}
                onChange={e => setGoalModal(e.target.value.replace(/[^\d.,\s]/g, '').slice(0, 12))} />
              <span>₴</span>
            </span>
            <p className="st-note">Порожнє поле прибирає ціль.</p>
          </div>
        </FormModal>
      )}

      <style>{`
        .st-toolbar { padding: 0.8rem 2rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; border-bottom: 1px solid #f1f5f9; }
        .st-seg { display: inline-flex; background: #f1f5f9; border-radius: 10px; padding: 3px; }
        .st-seg button { height: 32px; padding: 0 1rem; border: none; background: transparent; border-radius: 8px; font-size: 0.8rem; font-weight: 600; color: #64748b; cursor: pointer; transition: 0.2s; white-space: nowrap; }
        .st-seg button:hover { color: #0f172a; }
        .st-seg button.on { background: #fff; color: #0f172a; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
        .st-seg.small button { height: 28px; padding: 0 0.7rem; }
        .st-period { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
        .st-period > button:not(.clean-btn-ghost) { width: 30px; height: 30px; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff; cursor: pointer; font-size: 1rem; color: #475569; }
        .st-period > button:not(.clean-btn-ghost):hover { background: #f8fafc; color: #0f172a; }
        .st-period > span:not(.st-range) { min-width: 128px; text-align: center; font-size: 0.875rem; font-weight: 600; color: #0f172a; }
        .st-range { display: inline-flex; align-items: center; gap: 0.35rem; color: #94a3b8; }
        .st-range .clean-input { width: 140px; padding: 0.35rem 0.5rem; }

        .st-grid { display: grid; grid-template-columns: 1fr 300px; flex: 1; min-height: 0; overflow: hidden; }
        .st-main { overflow-y: auto; border-right: 1px solid #f1f5f9; }
        .st-main-inner { width: 100%; padding: 1.4rem 2rem 2rem; box-sizing: border-box; }
        .st-side { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
        .st-side-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 1.2rem 1.2rem 0.4rem; }
        @media (max-width: 1100px) { .st-grid { grid-template-columns: 1fr; } .st-side { display: none; } .st-main { border-right: none; } .st-toolbar { padding: 0.8rem 1rem; } }

        .clean-input { padding: 0.5rem 0.8rem; border-radius: 8px; border: 1px solid #e2e8f0; background: #fafafa; font-size: 0.85rem; color: #0f172a; outline: none; transition: all 0.2s; font-family: inherit; box-sizing: border-box; }
        .clean-input:focus { border-color: #436b49; background: #fff; }
        .clean-btn-ghost { background: transparent; color: #64748b; border: 1px solid #e2e8f0; padding: 0.55rem 1.1rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: 0.2s; white-space: nowrap; }
        .clean-btn-ghost:hover:not(:disabled) { background: #f8fafc; color: #0f172a; }
        .clean-btn-ghost:disabled { opacity: .5; cursor: not-allowed; }
        .service-table { width: 100%; border-collapse: separate; border-spacing: 0 4px; text-align: left; }
        .service-table th { padding: 0.75rem 1rem; color: #64748b; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #f1f5f9; background: #fff; }
        .service-table td { padding: 0.95rem 1rem; border-bottom: 1px solid #f8fafc; border-top: 1px solid transparent; vertical-align: middle; color: #0f172a; font-size: 0.9rem; }
        .widget-card { background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; padding: 1.2rem; margin-bottom: 0.8rem; }
        .widget-title { font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.6rem; }

        .st-h { margin: 1.7rem 0 0.8rem; font-size: 0.8rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; }
        .st-empty { text-align: center; padding: 4rem 2rem; color: #64748b; display: flex; flex-direction: column; gap: 0.4rem; }
        .st-empty b { color: #0f172a; font-size: 1.05rem; }
        .st-split > div { display: flex; flex-direction: column; } .st-split .st-card { flex: 1; }
        .st-asof { margin: 0.8rem 0 0; font-size: 0.78rem; color: #94a3b8; } .st-asof b { color: #64748b; font-weight: 600; }
        .st-card { border: 1px solid #f1f5f9; border-radius: 14px; padding: 1.1rem 1.2rem; background: #fff; }
        .st-note { margin: 0.8rem 0 0; font-size: 0.8rem; line-height: 1.5; color: #64748b; }
        .st-note b { color: #0f172a; }

        .st-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.9rem; }
        .st-kpis.six { grid-template-columns: repeat(6, minmax(0, 1fr)); }
        @media (max-width: 1500px) { .st-kpis.six { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        .st-split { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.2rem; }
        @media (max-width: 1250px) { .st-split { grid-template-columns: 1fr; } }
        @media (max-width: 760px) { .st-kpis, .st-kpis.six { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        .st-kpi { border: 1px solid #f1f5f9; border-radius: 14px; padding: 1rem 1.1rem; background: #f8fafc; display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
        .st-kpi small { font-size: 0.72rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; display: flex; align-items: center; }
        .st-kpi strong { font-size: 1.55rem; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .st-kpi.neg strong { color: #dc2626; }
        .st-delta { font-size: 0.75rem; font-weight: 700; }
        .st-delta.up { color: #059669; } .st-delta.down { color: #dc2626; } .st-delta.flat { color: #94a3b8; font-weight: 600; }

        .st-bars-head { font-size: 0.8rem; color: #64748b; min-height: 1.2rem; margin-bottom: 0.6rem; } .st-bars-head b { color: #0f172a; }
        .st-bars { display: flex; align-items: flex-end; gap: 2px; height: 150px; }
        .st-bar-col { flex: 1 1 0; height: 100%; display: flex; align-items: flex-end; justify-content: center; cursor: default; min-width: 0; }
        .st-bar-col i { display: block; width: 100%; max-width: 44px; border-radius: 3px 3px 0 0; transition: background .1s; }
        .st-bars-axis { display: flex; justify-content: space-between; margin-top: 0.4rem; font-size: 0.72rem; color: #94a3b8; }

        .st-share { display: flex; flex-direction: column; gap: 0.85rem; }
        .st-share-top { display: flex; justify-content: space-between; font-size: 0.85rem; color: #475569; margin-bottom: 0.3rem; }
        .st-share-top b { color: #0f172a; font-variant-numeric: tabular-nums; }
        .st-share i { display: block; height: 6px; border-radius: 3px; background: #e2e8f0; overflow: hidden; }
        .st-share em { display: block; height: 100%; border-radius: 3px; }

        .st-two { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
        @media (max-width: 760px) { .st-two { grid-template-columns: 1fr; } }
        .st-two small { font-size: 0.72rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; }
        .st-two strong { display: block; font-size: 1.5rem; font-weight: 800; color: #0f172a; margin: 0.15rem 0; }
        .st-two p { margin: 0; font-size: 0.78rem; color: #94a3b8; }
        .st-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem; }
        @media (max-width: 860px) { .st-cols { grid-template-columns: 1fr; } }
        .st-row { display: flex; justify-content: space-between; align-items: center; gap: 0.6rem; padding: 0.4rem 0; font-size: 0.85rem; color: #475569; }
        .st-row small { display: block; font-size: 0.72rem; color: #94a3b8; }
        .st-row b { color: #0f172a; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .st-mini { display: flex; align-items: center; gap: 0.5rem; } .st-mini i { flex: 1; height: 6px; border-radius: 3px; background: #e2e8f0; overflow: hidden; display: block; } .st-mini em { display: block; height: 100%; background: #436b49; border-radius: 3px; } .st-mini span { font-size: 0.78rem; color: #64748b; width: 2.4rem; text-align: right; }


        .st-goal-top { display: flex; justify-content: space-between; align-items: baseline; font-size: 0.8rem; color: #64748b; } .st-goal-top b { font-size: 1.2rem; color: #0f172a; font-weight: 800; }
        .st-goal-bar { height: 8px; border-radius: 4px; background: #e2e8f0; margin-top: 0.5rem; overflow: hidden; } .st-goal-bar i { display: block; height: 100%; border-radius: 4px; transition: width .4s; }
        .st-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
        .st-months { display: flex; gap: 0.6rem; align-items: stretch; }
        .st-month { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 0.25rem; border-radius: 8px; padding: 0.3rem 0; }
        .st-month.on { background: #f8fafc; }
        .st-month-bars { height: 130px; width: 100%; display: flex; align-items: flex-end; justify-content: center; gap: 4px; }
        .st-month-bars i { display: block; width: 36%; max-width: 22px; border-radius: 3px 3px 0 0; }
        .st-month-name { font-size: 0.72rem; color: #94a3b8; text-transform: capitalize; }
        .st-month b { font-size: 0.75rem; font-variant-numeric: tabular-nums; }
        .st-insight { margin: 0 0 1.1rem; font-size: 0.9rem; line-height: 1.5; color: #475569; } .st-insight b { color: #0f172a; }
        .st-load { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); gap: 2rem; }
        @media (max-width: 1000px) { .st-load { grid-template-columns: 1fr; } }
        .st-sub { display: block; font-size: 0.72rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.7rem; }
        .st-day { display: grid; grid-template-columns: 1.8rem 1fr 2.2rem; align-items: center; gap: 0.6rem; padding: 0.22rem 0; font-size: 0.8rem; color: #64748b; }
        .st-day i { height: 10px; border-radius: 5px; background: #f1f5f9; overflow: hidden; display: block; } .st-day em { display: block; height: 100%; border-radius: 5px; }
        .st-day b { text-align: right; color: #0f172a; font-variant-numeric: tabular-nums; }
        .st-hours { display: flex; align-items: flex-end; gap: 4px; height: 170px; }
        .st-hours > div { flex: 1 1 0; min-width: 0; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 0.3rem; max-width: 40px; }
        .st-hours em { display: block; width: 100%; border-radius: 3px 3px 0 0; }
        .st-hours span { font-size: 0.72rem; color: #94a3b8; }
        .st-link.right { margin: 0 0 0 auto; }
        .st-link { border: none; background: none; padding: 0; margin-top: 0.4rem; font-size: 0.78rem; font-weight: 600; color: #436b49; cursor: pointer; }

        .st-hint { flex: none; margin: 0.4rem 1.2rem 1.2rem; background: #f5f3ff; border: 1px dashed #c4b5fd; border-radius: 12px; padding: 1rem; }
        .st-hint-t { font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: #7c3aed; margin-bottom: 0.6rem; }
        .st-hint b { display: block; font-weight: 700; color: #5b21b6; font-size: 0.85rem; margin-bottom: 0.3rem; }
        .st-hint p { font-size: 0.75rem; color: #6d28d9; line-height: 1.45; margin: 0; }
      `}</style>
    </div>
  );
}

/** Дохід і витрати по місяцях: дві смужки на місяць, під ними - прибуток. */
function Monthly({ rows }: { rows: Analytics['monthly'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...rows.flatMap(r => [r.revenue, r.expenses]), 1);
  const name = (m: string, long = false) => { const [y, mm] = m.split('-').map(Number); const d = new Date(y, mm - 1, 1); return d.toLocaleDateString('uk-UA', long ? { month: 'long', year: 'numeric' } : { month: 'short' }); };
  const h = hover != null ? rows[hover] : null;
  return (
    <div>
      <div className="st-bars-head">
        {h ? <><b>{name(h.month, true)}</b> · дохід {money(h.revenue)} · витрати {money(h.expenses)} · <b style={{ color: h.profit < 0 ? '#dc2626' : '#059669' }}>прибуток {money(h.profit)}</b></>
          : <span><i className="st-dot" style={{ background: '#436b49' }} /> дохід <i className="st-dot" style={{ background: '#f59e0b', marginLeft: 12 }} /> витрати</span>}
      </div>
      <div className="st-months" onMouseLeave={() => setHover(null)}>
        {rows.map((r, i) => (
          <div key={r.month} className={`st-month ${hover === i ? 'on' : ''}`} onMouseEnter={() => setHover(i)}>
            <div className="st-month-bars">
              <i style={{ height: `${Math.max(r.revenue / max * 100, r.revenue > 0 ? 3 : 0)}%`, background: '#436b49' }} />
              <i style={{ height: `${Math.max(r.expenses / max * 100, r.expenses > 0 ? 3 : 0)}%`, background: '#f59e0b' }} />
            </div>
            <span className="st-month-name">{name(r.month)}</span>
            <b style={{ color: r.profit < 0 ? '#dc2626' : r.profit > 0 ? '#059669' : '#94a3b8' }}>{r.profit > 0 ? '+' : ''}{Math.round(r.profit / 100) / 10}к</b>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Коли записуються: дні тижня (смужки зі числами) і години (стовпчики). Без матриці - її важко читати. */
function LoadCharts({ heat }: { heat: number[][] }) {
  const byDay = heat.map(r => r.reduce((a, b) => a + b, 0));
  const byHour = Array.from({ length: 24 }, (_, h) => heat.reduce((a, r) => a + r[h], 0));
  const total = byDay.reduce((a, b) => a + b, 0);
  if (total === 0) return <p className="st-note" style={{ margin: 0 }}>Записів за період ще немає.</p>;
  const used = byHour.map((v, h) => (v > 0 ? h : -1)).filter(h => h >= 0);
  const hours = Array.from({ length: Math.max(...used) - Math.min(...used) + 1 }, (_, i) => Math.min(...used) + i);
  const maxDay = Math.max(...byDay), maxHour = Math.max(...byHour);
  const busyDay = byDay.indexOf(maxDay), quietDay = byDay.indexOf(Math.min(...byDay));
  const peakHour = byHour.indexOf(maxHour);
  return (
    <>
      <p className="st-insight">
        Найбільше записів — <b>{WEEKDAYS_FULL[busyDay]}</b> і близько <b>{peakHour}:00</b>.
        {busyDay !== quietDay && <> Найтихіше — <b>{WEEKDAYS_FULL[quietDay]}</b>: хороший день для акції чи розсилки.</>}
      </p>
      <div className="st-load">
        <div>
          <small className="st-sub">За днями тижня</small>
          {byDay.map((v, d) => (
            <div key={d} className="st-day">
              <span>{WEEKDAYS[d]}</span>
              <i><em style={{ width: `${v / maxDay * 100}%`, background: d === busyDay ? '#436b49' : '#a9bfab' }} /></i>
              <b>{v}</b>
            </div>
          ))}
        </div>
        <div>
          <small className="st-sub">За годинами початку</small>
          <div className="st-hours">
            {hours.map(h => (
              <div key={h} title={`${h}:00 — ${byHour[h]} ${plural(byHour[h], 'запис', 'записи', 'записів')}`}>
                <em style={{ height: `${byHour[h] / maxHour * 100}%`, background: h === peakHour ? '#436b49' : '#a9bfab' }} />
                <span>{h}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
