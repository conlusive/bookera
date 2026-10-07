'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import HintCard from '@/components/ui/HintCard';
import { getAuthToken } from '@/lib/auth-token-client';
import { notify } from '@/lib/feedback';
import FormModal, { Field, FormSection } from '@/components/ui/FormModal';
import HelpTip from '@/components/ui/HelpTip';

/**
 * Склад і витрати - у стилі «Клієнтів» і «Послуг»: панель, пігулки,
 * таблиця ліворуч, бічна колонка праворуч, вікна на шаблоні FormModal.
 *
 * Звʼязки:
 *   - товар, привʼязаний до послуги («Послуги» -> «Матеріали зі складу»),
 *     списується сам, коли візит завершено - будь-яким шляхом
 *   - «Прихід» додає кількість і записує витрату «Матеріали» на суму
 *     закупівлі - гроші за товар видно у витратах
 *   - виплата майстрові («Команда» -> «Зарплата») сама стає витратою
 *     «Зарплата» - тут її не треба вносити вручну
 *
 * Прибрано: «прогноз зарплат», що вигадував майбутні виплати лише з
 * фіксованої ставки (майстри на відсотку мали 0) і плутав із
 * справжніми виплатами.
 */

const CATEGORIES = ['Матеріали', 'Оренда', 'Комунальні', 'Зарплата', 'Маркетинг', 'Податки', 'Інше'];
const CAT_COLOR: Record<string, string> = {
  Матеріали: '#8b5cf6', Оренда: '#0ea5e9', Комунальні: '#14b8a6', Зарплата: '#f59e0b',
  Маркетинг: '#ec4899', Податки: '#64748b', Інше: '#94a3b8',
};
const UNITS = ['шт', 'мл', 'г', 'уп'];
const MONTHS = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];

const money = (n: number) => `${Math.round(n).toLocaleString('uk-UA')} ₴`;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const num = (v: any) => Number(v) || 0;
const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''));

type Mode = 'expenses' | 'stock';
type Period = 'month' | 'year';

export default function InventoryTab({ business }: any) {
  const [mode, setMode] = useState<Mode>('expenses');
  const [expenses, setExpenses] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Період витрат: місяць чи рік, стрілками назад / вперед
  const [period, setPeriod] = useState<Period>('month');
  const [anchor, setAnchor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'low' | 'out'>('all');
  const [stockSort, setStockSort] = useState<{ key: 'name' | 'qty' | 'price' | 'value'; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });

  // Вікна
  const [expModal, setExpModal] = useState<any | null>(null);     // {} - нова, {...} - зміна
  const [itemModal, setItemModal] = useState<any | null>(null);
  const [restock, setRestock] = useState<any | null>(null);
  const [history, setHistory] = useState<{ item: any; rows: any[] | null } | null>(null);
  const [saving, setSaving] = useState(false);

  const bid = Number(business?.id);

  const load = useCallback(async () => {
    if (!bid) return;
    setLoading(true);
    try {
      const t = await getAuthToken();
      const [e, i] = await Promise.all([api.listExpenses(t, bid), api.listInventory(t, bid)]);
      setExpenses(e); setItems(i);
    } catch (err: any) {
      notify(err?.message || 'Не вдалося завантажити дані', 'error');
    } finally {
      setLoading(false);
    }
  }, [bid]);
  useEffect(() => { void load(); }, [load]);

  // ------------------------------------------------------------ витрати
  const range = useMemo(() => {
    const from = new Date(anchor);
    const to = period === 'month' ? new Date(from.getFullYear(), from.getMonth() + 1, 1) : new Date(from.getFullYear() + 1, 0, 1);
    const pFrom = period === 'month' ? new Date(from.getFullYear(), from.getMonth() - 1, 1) : new Date(from.getFullYear() - 1, 0, 1);
    return { from: ymd(from), to: ymd(to), pFrom: ymd(pFrom) };
  }, [anchor, period]);
  const periodLabel = period === 'month' ? `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}` : `${anchor.getFullYear()} рік`;
  const prevLabel = period === 'month' ? MONTHS[(anchor.getMonth() + 11) % 12].toLowerCase() : `${anchor.getFullYear() - 1} рік`;
  const shift = (dir: number) => setAnchor(a => (period === 'month' ? new Date(a.getFullYear(), a.getMonth() + dir, 1) : new Date(a.getFullYear() + dir, 0, 1)));
  const today = ymd(new Date());

  const inPeriod = useMemo(() => expenses.filter(e => e.expense_date >= range.from && e.expense_date < range.to), [expenses, range]);
  const prevTotal = useMemo(() => expenses.filter(e => e.expense_date >= range.pFrom && e.expense_date < range.from).reduce((s, e) => s + num(e.amount), 0), [expenses, range]);
  const total = inPeriod.reduce((s, e) => s + num(e.amount), 0);
  const paid = inPeriod.filter(e => e.expense_date <= today).reduce((s, e) => s + num(e.amount), 0);
  const byCat = useMemo(() => {
    const m: Record<string, number> = {};
    inPeriod.forEach(e => { const k = e.category || 'Інше'; m[k] = (m[k] || 0) + num(e.amount); });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [inPeriod]);
  const shownExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inPeriod
      .filter(e => !catFilter || (e.category || 'Інше') === catFilter)
      .filter(e => !q || `${e.category} ${e.description || ''}`.toLowerCase().includes(q))
      .sort((a, b) => (a.expense_date < b.expense_date ? 1 : a.expense_date > b.expense_date ? -1 : b.id - a.id));
  }, [inPeriod, catFilter, search]);
  const recurring = useMemo(() => {
    // Найближче майбутнє входження кожної серії
    const next: Record<string, any> = {};
    expenses.filter(e => e.recurrence_group_id && e.expense_date >= today).forEach(e => {
      const g = e.recurrence_group_id;
      if (!next[g] || e.expense_date < next[g].expense_date) next[g] = e;
    });
    return Object.values(next).sort((a: any, b: any) => (a.expense_date < b.expense_date ? -1 : 1)).slice(0, 5);
  }, [expenses, today]);

  const saveExpense = async (f: any) => {
    const amount = num(String(f.amount).replace(',', '.'));
    if (!(amount > 0)) return notify('Вкажіть суму більше нуля', 'error', { field: 'exp-amount' });
    if (!f.expense_date) return notify('Вкажіть дату', 'error', { field: 'exp-date' });
    setSaving(true);
    try {
      const t = await getAuthToken();
      const payload = { category: f.category, description: (f.description || '').trim() || undefined, amount, expense_date: f.expense_date };
      if (f.id) await api.updateExpense(t, f.id, { ...payload, apply_to_future: !!f.apply_to_future } as any);
      else await api.createExpense(t, { business_id: bid, ...payload, recurrence: f.recurrence || 'none' });
      setExpModal(null);
      await load();
    } catch (err: any) {
      notify(err?.message || 'Не вдалося зберегти витрату', 'error');
    } finally {
      setSaving(false);
    }
  };
  const deleteExpense = async (f: any, future: boolean) => {
    try {
      await api.deleteExpense(await getAuthToken(), f.id, future);
      setExpModal(null);
      await load();
    } catch (err: any) {
      notify(err?.message || 'Не вдалося видалити', 'error');
    }
  };

  // ------------------------------------------------------------ склад
  const isLow = (i: any) => num(i.quantity) > 0 && i.low_stock_threshold != null && num(i.quantity) <= num(i.low_stock_threshold);
  const isOut = (i: any) => num(i.quantity) <= 0;
  const stockValue = items.reduce((s, i) => s + Math.max(0, num(i.quantity)) * num(i.cost_per_unit), 0);
  const toOrder = items.filter(i => isOut(i) || isLow(i)).sort((a, b) => num(a.quantity) - num(b.quantity));
  const sortStock = (key: 'name' | 'qty' | 'price' | 'value') =>
    setStockSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' });
  const stockOf = (i: any, key: string) => key === 'qty' ? num(i.quantity)
    : key === 'price' ? num(i.cost_per_unit)
    : Math.max(0, num(i.quantity)) * num(i.cost_per_unit);
  const shownItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sign = stockSort.dir === 'asc' ? 1 : -1;
    return items
      .filter(i => stockFilter === 'all' || (stockFilter === 'in' ? !isOut(i) && !isLow(i) : stockFilter === 'out' ? isOut(i) : isLow(i)))
      .filter(i => !q || String(i.name).toLowerCase().includes(q))
      .sort((a, b) => stockSort.key === 'name'
        ? sign * String(a.name).localeCompare(String(b.name), 'uk')
        : sign * (stockOf(a, stockSort.key) - stockOf(b, stockSort.key)) || String(a.name).localeCompare(String(b.name), 'uk'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, stockFilter, search, stockSort]);
  const SortIcon = ({ k }: { k: string }) => stockSort.key !== k
    ? <span style={{ opacity: 0.3, marginLeft: '4px' }}>↕</span>
    : <span style={{ color: '#0f172a', marginLeft: '4px', fontWeight: 'bold' }}>{stockSort.dir === 'asc' ? '↑' : '↓'}</span>;

  const saveItem = async (f: any) => {
    if (!String(f.name || '').trim()) return notify('Вкажіть назву товару', 'error', { field: 'inv-name' });
    const negative = [['inv-qty', f.quantity], ['inv-cost', f.cost_per_unit], ['inv-min', f.low_stock_threshold]]
      .find(([, v]) => num(String(v ?? '').replace(',', '.')) < 0);
    if (negative) return notify('Значення не може бути від’ємним', 'error', { field: negative[0] as string });
    setSaving(true);
    try {
      const t = await getAuthToken();
      const data: any = {
        name: f.name.trim(), unit: f.unit,
        cost_per_unit: num(String(f.cost_per_unit).replace(',', '.')),
        low_stock_threshold: f.low_stock_threshold === '' || f.low_stock_threshold == null ? null : num(String(f.low_stock_threshold).replace(',', '.')),
      };
      // Кількість при створенні - початковий залишок; при зміні - фактичний залишок (інвентаризація)
      data.quantity = num(String(f.quantity).replace(',', '.'));
      if (f.id) await api.updateInventoryItem(t, f.id, data);
      else await api.createInventoryItem(t, { business_id: bid, ...data });
      setItemModal(null);
      await load();
    } catch (err: any) {
      notify(err?.message || 'Не вдалося зберегти товар', 'error');
    } finally {
      setSaving(false);
    }
  };
  const deleteItem = async (f: any) => {
    try {
      await api.deleteInventoryItem(await getAuthToken(), f.id);
      setItemModal(null);
      await load();
    } catch (err: any) {
      notify(err?.message || 'Не вдалося видалити', 'error');
    }
  };
  const saveRestock = async (f: any) => {
    const qty = num(String(f.quantity).replace(',', '.'));
    if (!(qty > 0)) return notify('Вкажіть, скільки прийшло', 'error', { field: 'rs-qty' });
    setSaving(true);
    try {
      await api.restockInventoryItem(await getAuthToken(), f.item.id, {
        quantity: qty, cost_per_unit: f.cost_per_unit === '' ? undefined : num(String(f.cost_per_unit).replace(',', '.')), add_expense: f.add_expense,
      });
      setRestock(null);
      await load();
    } catch (err: any) {
      notify(err?.message || 'Не вдалося записати прихід', 'error');
    } finally {
      setSaving(false);
    }
  };
  const openHistory = async (item: any) => {
    setHistory({ item, rows: null });
    try { setHistory({ item, rows: await api.getInventoryMovements(await getAuthToken(), item.id) }); }
    catch { setHistory({ item, rows: [] }); }
  };

  // ------------------------------------------------------------ розмітка
  const hint = mode === 'expenses'
    ? (total === 0
      ? { t: 'Витрат за період немає', x: 'Оренду й комунальні зручно внести один раз як щомісячні — вони самі зʼявлятимуться щомісяця.' }
      : { t: 'Зарплати — автоматично', x: 'Виплата майстрові в «Команда → Зарплата» сама стає витратою «Зарплата». Вносити її тут не потрібно.' })
    : (items.length === 0
      ? { t: 'Склад порожній', x: 'Додайте матеріали, а потім привʼяжіть їх до послуг — вони списуватимуться самі, коли візит завершено.' }
      : toOrder.length
        ? { t: `${toOrder.length} ${toOrder.length === 1 ? 'позицію' : 'позиції'} пора замовити`, x: 'Коли прийде товар — натисніть «Прихід»: кількість додасться, а закупівля потрапить у витрати.' }
        : { t: 'Списання — автоматичне', x: 'Матеріали, привʼязані до послуг, списуються самі, коли візит завершено. Історія кожного товару — в його картці.' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%', background: '#fff' }}>
      {/* --- ПАНЕЛЬ --- */}
      <div className="iv-toolbar">
        <div className="iv-left">
          <div className="iv-seg" role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'expenses'} className={mode === 'expenses' ? 'on' : ''} onClick={() => { setMode('expenses'); setSearch(''); }}>Витрати</button>
            <button type="button" role="tab" aria-selected={mode === 'stock'} className={mode === 'stock' ? 'on' : ''} onClick={() => { setMode('stock'); setSearch(''); }}>
              Склад{toOrder.length > 0 && <span className="iv-dot" title="Є що замовити" />}
            </button>
          </div>
          <div className="iv-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input className="clean-input" value={search} onChange={e => setSearch(e.target.value)} placeholder={mode === 'expenses' ? 'Опис чи категорія…' : 'Назва товару…'} />
          </div>
        </div>
        <div className="iv-right">
          {mode === 'expenses' && (
            <div className="iv-period">
              <button type="button" aria-label="Назад" onClick={() => shift(-1)}>‹</button>
              <span>{periodLabel}</span>
              <button type="button" aria-label="Вперед" onClick={() => shift(1)}>›</button>
              <div className="iv-seg small">
                <button type="button" className={period === 'month' ? 'on' : ''} onClick={() => { setPeriod('month'); }}>Місяць</button>
                <button type="button" className={period === 'year' ? 'on' : ''} onClick={() => { setPeriod('year'); setAnchor(a => new Date(a.getFullYear(), 0, 1)); }}>Рік</button>
              </div>
            </div>
          )}
          <button type="button" className="clean-btn iv-add" onClick={() => (mode === 'expenses'
            ? setExpModal({ category: 'Оренда', amount: '', description: '', expense_date: today, recurrence: 'none' })
            : setItemModal({ name: '', unit: 'шт', quantity: '', cost_per_unit: '', low_stock_threshold: '' }))}>
            + {mode === 'expenses' ? 'Витрата' : 'Товар'}
          </button>
        </div>
      </div>

      {/* --- ПІГУЛКИ --- */}
      <div className="hide-scrollbar iv-pills">
        {mode === 'expenses' ? (
          <>
            <button type="button" className={`category-pill ${!catFilter ? 'active' : ''}`} onClick={() => setCatFilter(null)}>Усі <span className="iv-c">{money(total)}</span></button>
            {byCat.map(([cat, sum]) => (
              <button key={cat} type="button" className={`category-pill ${catFilter === cat ? 'active' : ''}`} onClick={() => setCatFilter(cat)}>
                <i className="iv-sw" style={{ background: CAT_COLOR[cat] || '#94a3b8' }} />{cat} <span className="iv-c">{money(sum)}</span>
              </button>
            ))}
          </>
        ) : (
          ([['all', 'Усі', items.length], ['in', 'В наявності', items.filter(i => !isOut(i) && !isLow(i)).length], ['low', 'Закінчуються', items.filter(isLow).length], ['out', 'Немає', items.filter(isOut).length]] as const).map(([id, label, n]) => (
            <button key={id} type="button" className={`category-pill ${stockFilter === id ? 'active' : ''}`} onClick={() => setStockFilter(id)}>
              {label} <span className="iv-c">{n}</span>
            </button>
          ))
        )}
      </div>

      {/* --- ТАБЛИЦЯ + БІЧНА КОЛОНКА --- */}
      <div className="iv-grid">
        <div className="custom-scroll iv-main">
          <div className="iv-main-inner">
            {loading ? <div className="iv-empty">Завантаження…</div> : mode === 'expenses' ? (
              shownExpenses.length === 0 ? (
                <div className="iv-empty"><b>{inPeriod.length ? 'Нічого не знайдено' : `Витрат за ${period === 'month' ? MONTHS[anchor.getMonth()].toLowerCase() : 'рік'} немає`}</b><span>Додайте оренду, закупівлі чи інші витрати — побачите, куди йдуть гроші.</span></div>
              ) : (
                <table className="service-table">
                  <thead><tr><th>Дата</th><th>Категорія</th><th>Опис</th><th style={{ textAlign: 'right' }}>Сума</th></tr></thead>
                  <tbody>
                    {shownExpenses.map(e => {
                      const planned = e.expense_date > today;
                      return (
                        <tr key={e.id} className="service-row" onClick={() => setExpModal({ ...e, amount: String(num(e.amount)), apply_to_future: false })} style={{ opacity: planned ? 0.6 : 1 }}>
                          <td className="iv-date">
                            {new Date(`${e.expense_date}T12:00:00`).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}
                            {planned && <small>заплановано</small>}
                          </td>
                          <td><span className="iv-cat"><i style={{ background: CAT_COLOR[e.category] || '#94a3b8' }} />{e.category || 'Інше'}</span></td>
                          <td className="iv-desc">
                            {e.description || <span className="iv-muted">—</span>}
                            {e.recurrence_group_id && <small className="iv-rec">{e.recurrence === 'weekly' ? 'щотижня' : 'щомісяця'}</small>}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(num(e.amount))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            ) : (
              shownItems.length === 0 ? (
                <div className="iv-empty"><b>{items.length ? 'Нічого не знайдено' : 'Склад порожній'}</b><span>{items.length ? 'Змініть запит чи фільтр.' : 'Додайте матеріали — і привʼяжіть їх до послуг, щоб списувались самі.'}</span></div>
              ) : (
                <table className="service-table iv-stock">
                  <thead><tr>
                    <th className="sortable" onClick={() => sortStock('name')}>Товар <SortIcon k="name" /></th>
                    <th className="sortable" onClick={() => sortStock('qty')} style={{ textAlign: 'right' }}>Залишок <SortIcon k="qty" /></th>
                    <th style={{ textAlign: 'right' }}>Мін. запас <HelpTip>Коли залишок опуститься до цього числа, товар зʼявиться в «Потрібно замовити».</HelpTip></th>
                    <th className="iv-col-price sortable" onClick={() => sortStock('price')} style={{ textAlign: 'right' }}>Ціна за од. <SortIcon k="price" /></th>
                    <th className="sortable" onClick={() => sortStock('value')} style={{ textAlign: 'right' }}>Вартість <SortIcon k="value" /></th>
                    <th aria-label="Дії" style={{ width: 1 }} />
                  </tr></thead>
                  <tbody>
                    {shownItems.map(i => (
                      <tr key={i.id} className="service-row" onClick={() => void openHistory(i)}>
                        <td><b className="iv-name" title={i.name}>{i.name}</b></td>
                        <td style={{ textAlign: 'right' }}>
                          <span className={`iv-qty ${isOut(i) ? 'out' : isLow(i) ? 'low' : ''}`}>{fmtQty(num(i.quantity))} {i.unit}</span>
                        </td>
                        <td style={{ textAlign: 'right', color: '#64748b' }}>{i.low_stock_threshold != null ? `${fmtQty(num(i.low_stock_threshold))} ${i.unit}` : '—'}</td>
                        <td className="iv-col-price" style={{ textAlign: 'right', color: '#64748b' }}>{num(i.cost_per_unit) ? money(num(i.cost_per_unit)) : '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(Math.max(0, num(i.quantity)) * num(i.cost_per_unit))}</td>
                        <td className="iv-acts" onClick={ev => ev.stopPropagation()}>
                          <button type="button" className="iv-rowbtn" onClick={() => setRestock({ item: i, quantity: '', cost_per_unit: num(i.cost_per_unit) ? String(num(i.cost_per_unit)) : '', add_expense: true })}>+ Прихід</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>
        </div>

        {/* --- БІЧНА КОЛОНКА --- */}
        <aside className="iv-side">
          <div className="custom-scroll iv-side-scroll">
          {mode === 'expenses' ? (
            <>
              <div className="widget-card">
                <div className="widget-title">{periodLabel}</div>
                <div className="iv-row"><span>Разом</span><b>{money(total)}</b></div>
                {total !== paid && <div className="iv-row"><span>Уже сплачено</span><b>{money(paid)}</b></div>}
                <div className="iv-row"><span>{prevLabel[0].toUpperCase() + prevLabel.slice(1)}</span><b style={{ color: '#64748b' }}>{money(prevTotal)}</b></div>
                {prevTotal > 0 && total !== prevTotal && (
                  <div className={`iv-delta ${total > prevTotal ? 'up' : 'down'}`}>
                    {total > prevTotal ? '↑' : '↓'} {money(Math.abs(total - prevTotal))} ({Math.round(Math.abs(total - prevTotal) / prevTotal * 100)}%) до попереднього
                  </div>
                )}
              </div>
              {byCat.length > 0 && (
                <div className="widget-card">
                  <div className="widget-title">На що йдуть гроші</div>
                  {byCat.map(([cat, sum]) => (
                    <button key={cat} type="button" className={`iv-bar ${catFilter === cat ? 'on' : ''}`} onClick={() => setCatFilter(catFilter === cat ? null : cat)}>
                      <span className="iv-bar-top"><span>{cat}</span><b>{Math.round(sum / total * 100)}%</b></span>
                      <i><em style={{ width: `${Math.max(3, sum / total * 100)}%`, background: CAT_COLOR[cat] || '#94a3b8' }} /></i>
                    </button>
                  ))}
                </div>
              )}
              {recurring.length > 0 && (
                <div className="widget-card">
                  <div className="widget-title">Повторювані</div>
                  {recurring.map((e: any) => (
                    <div key={e.recurrence_group_id} className="iv-row">
                      <span>{e.description || e.category}<small>{e.recurrence === 'weekly' ? 'щотижня' : 'щомісяця'} · {new Date(`${e.expense_date}T12:00:00`).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}</small></span>
                      <b>{money(num(e.amount))}</b>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="widget-card">
                <div className="widget-title">Склад</div>
                <div className="iv-row"><span>Позицій</span><b>{items.length}</b></div>
                <div className="iv-row"><span>Вартість залишків</span><b>{money(stockValue)}</b></div>
              </div>
              {toOrder.length > 0 && (
                <div className="widget-card">
                  <div className="widget-title">Потрібно замовити</div>
                  {toOrder.slice(0, 8).map(i => (
                    <div key={i.id} className="iv-row">
                      <span>{i.name}<small className={isOut(i) ? 'out' : 'low'}>{isOut(i) ? 'немає' : `лишилось ${fmtQty(num(i.quantity))} ${i.unit}`}</small></span>
                      <button type="button" className="iv-link" onClick={() => setRestock({ item: i, quantity: '', cost_per_unit: num(i.cost_per_unit) ? String(num(i.cost_per_unit)) : '', add_expense: true })}>Прихід</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          <HintCard title={hint.t}>{hint.x}</HintCard>
          </div>
        </aside>
      </div>

      {/* --- ВИТРАТА --- */}
      {expModal && (
        <FormModal open onClose={() => setExpModal(null)} title={expModal.id ? 'Витрата' : 'Нова витрата'} width={520}
          subtitle={expModal.recurrence_group_id ? `Повторюється ${expModal.recurrence === 'weekly' ? 'щотижня' : 'щомісяця'}` : undefined}
          primary={{ label: expModal.id ? 'Зберегти' : 'Додати', onClick: () => void saveExpense(expModal), loading: saving }}
          danger={expModal.id ? { label: 'Видалити', confirmLabel: expModal.recurrence_group_id ? 'Видалити цю витрату?' : 'Видалити витрату?', onClick: () => void deleteExpense(expModal, false) } : undefined}>
          <FormSection>
            <div className="fm-row">
              <Field label="Сума" required>
                <span className="fm-affix"><input className="fm-input" data-field="exp-amount" inputMode="decimal" autoFocus placeholder="0" value={expModal.amount}
                  onChange={e => setExpModal({ ...expModal, amount: e.target.value.replace(/[^\d.,]/g, '').slice(0, 10) })} /><span>₴</span></span>
              </Field>
              <Field label="Дата" required>
                <input className="fm-input" data-field="exp-date" type="date" value={expModal.expense_date} onChange={e => setExpModal({ ...expModal, expense_date: e.target.value })} />
              </Field>
            </div>
            <Field label="Категорія">
              <div className="fm-chips">
                {CATEGORIES.map(c => <button key={c} type="button" className={`fm-chip ${expModal.category === c ? 'on' : ''}`} onClick={() => setExpModal({ ...expModal, category: c })}>{c}</button>)}
              </div>
            </Field>
            <Field label="Опис">
              <input className="fm-input" maxLength={200} placeholder={expModal.category === 'Оренда' ? 'Оренда приміщення' : 'Що саме'} value={expModal.description || ''}
                onChange={e => setExpModal({ ...expModal, description: e.target.value })} />
            </Field>
            {!expModal.id ? (
              <Field label="Повторювати" hint={expModal.recurrence !== 'none' ? 'Наступні витрати зʼявляться самі на рік уперед — змінити чи видалити можна всю серію.' : undefined}>
                <span className="iv-seg wide">
                  {([['none', 'Одноразово'], ['weekly', 'Щотижня'], ['monthly', 'Щомісяця']] as const).map(([v, l]) => (
                    <button key={v} type="button" className={expModal.recurrence === v ? 'on' : ''} onClick={() => setExpModal({ ...expModal, recurrence: v })}>{l}</button>
                  ))}
                </span>
              </Field>
            ) : expModal.recurrence_group_id ? (
              <>
                <label className="iv-check">
                  <input type="checkbox" className="fm-check" checked={!!expModal.apply_to_future} onChange={e => setExpModal({ ...expModal, apply_to_future: e.target.checked })} />
                  <span>Змінити й усі наступні в цій серії</span>
                </label>
                <button type="button" className="iv-link danger" onClick={() => void deleteExpense(expModal, true)}>Видалити цю й усі наступні</button>
              </>
            ) : null}
          </FormSection>
        </FormModal>
      )}

      {/* --- ТОВАР --- */}
      {itemModal && (
        <FormModal open onClose={() => setItemModal(null)} title={itemModal.id ? 'Товар' : 'Новий товар'} width={520}
          primary={{ label: itemModal.id ? 'Зберегти' : 'Додати', onClick: () => void saveItem(itemModal), loading: saving }}
          danger={itemModal.id ? { label: 'Видалити', confirmLabel: 'Видалити товар і його історію?', onClick: () => void deleteItem(itemModal) } : undefined}>
          <FormSection>
            <Field label="Назва" required>
              <input className="fm-input" data-field="inv-name" autoFocus maxLength={120} placeholder="Гель-лак, рукавички, олія…" value={itemModal.name}
                onChange={e => setItemModal({ ...itemModal, name: e.target.value })} />
            </Field>
            <Field label="Одиниця">
              <div className="fm-chips">{UNITS.map(u => <button key={u} type="button" className={`fm-chip ${itemModal.unit === u ? 'on' : ''}`} onClick={() => setItemModal({ ...itemModal, unit: u })}>{u}</button>)}</div>
            </Field>
            <div className="fm-row">
              <Field label={itemModal.id ? 'Фактичний залишок' : 'Скільки є зараз'} hint={itemModal.id ? 'Змінюйте лише після перерахунку — у історії буде «Інвентаризація».' : undefined}>
                <span className="fm-affix"><input className="fm-input" data-field="inv-qty" inputMode="decimal" placeholder="0" value={itemModal.quantity}
                  onChange={e => setItemModal({ ...itemModal, quantity: e.target.value.replace(/[^\d.,-]/g, '').slice(0, 10) })} /><span>{itemModal.unit}</span></span>
              </Field>
              <Field label="Ціна за одиницю">
                <span className="fm-affix"><input className="fm-input" data-field="inv-cost" inputMode="decimal" placeholder="0" value={itemModal.cost_per_unit}
                  onChange={e => setItemModal({ ...itemModal, cost_per_unit: e.target.value.replace(/[^\d.,]/g, '').slice(0, 10) })} /><span>₴</span></span>
              </Field>
            </div>
            <Field label="Мінімальний запас" hint="Коли залишиться стільки чи менше — товар зʼявиться в «Потрібно замовити». Порожньо — не стежити.">
              <span className="fm-affix"><input className="fm-input" data-field="inv-min" inputMode="decimal" placeholder="напр., 5" value={itemModal.low_stock_threshold ?? ''}
                onChange={e => setItemModal({ ...itemModal, low_stock_threshold: e.target.value.replace(/[^\d.,]/g, '').slice(0, 10) })} /><span>{itemModal.unit}</span></span>
            </Field>
          </FormSection>
        </FormModal>
      )}

      {/* --- ПРИХІД --- */}
      {restock && (
        <FormModal open onClose={() => setRestock(null)} title="Прихід товару" subtitle={`${restock.item.name} · зараз ${fmtQty(num(restock.item.quantity))} ${restock.item.unit}`} width={480}
          primary={{ label: 'Записати прихід', onClick: () => void saveRestock(restock), loading: saving }}>
          <FormSection>
            <p className="iv-rs-note">Купили або отримали товар? Вкажіть, скільки прийшло, — кількість додасться до залишку. Ціну можна оновити, якщо вона змінилась.</p>
            <div className="fm-row">
              <Field label="Скільки прийшло" required>
                <span className="fm-affix"><input className="fm-input" data-field="rs-qty" inputMode="decimal" autoFocus placeholder="0" value={restock.quantity}
                  onChange={e => setRestock({ ...restock, quantity: e.target.value.replace(/[^\d.,]/g, '').slice(0, 10) })} /><span>{restock.item.unit}</span></span>
              </Field>
              <Field label={`Ціна за 1 ${restock.item.unit}`}>
                <span className="fm-affix"><input className="fm-input" inputMode="decimal" placeholder="0" value={restock.cost_per_unit}
                  onChange={e => setRestock({ ...restock, cost_per_unit: e.target.value.replace(/[^\d.,]/g, '').slice(0, 10) })} /><span>₴</span></span>
              </Field>
            </div>
            {(() => {
              const qty = num(String(restock.quantity).replace(',', '.'));
              const sum = qty * num(String(restock.cost_per_unit).replace(',', '.'));
              const now = num(restock.item.quantity);
              return (
                <>
                {qty > 0 && (
                  <div className="iv-rs-result">
                    Залишок: <b>{fmtQty(now)}</b> → <b>{fmtQty(now + qty)} {restock.item.unit}</b>
                  </div>
                )}
                <label className="iv-check">
                  <input type="checkbox" className="fm-check" checked={restock.add_expense} onChange={e => setRestock({ ...restock, add_expense: e.target.checked })} />
                  <span>Записати у витрати «Матеріали»{sum > 0 ? ` — ${money(sum)}` : ''}</span>
                </label>
                <p className="iv-rs-note small">{restock.add_expense ? 'Гроші за закупівлю з’являться у вкладці «Витрати».' : 'У витрати нічого не запишеться — зміниться лише кількість на складі.'}</p>
                </>
              );
            })()}
          </FormSection>
        </FormModal>
      )}

      {/* --- КАРТКА ТОВАРУ: ІСТОРІЯ --- */}
      {history && (
        <FormModal open onClose={() => setHistory(null)} title={history.item.name} width={560}
          subtitle={`Залишок ${fmtQty(num(history.item.quantity))} ${history.item.unit}${num(history.item.cost_per_unit) ? ` · ${money(num(history.item.cost_per_unit))} за ${history.item.unit}` : ''}`}
          primary={{ label: '+ Прихід', onClick: () => { const i = history.item; setHistory(null); setRestock({ item: i, quantity: '', cost_per_unit: num(i.cost_per_unit) ? String(num(i.cost_per_unit)) : '', add_expense: true }); } }}
          secondary={{ label: 'Змінити', onClick: () => { const i = history.item; setHistory(null); setItemModal({ ...i, quantity: String(num(i.quantity)), cost_per_unit: num(i.cost_per_unit) ? String(num(i.cost_per_unit)) : '', low_stock_threshold: i.low_stock_threshold != null ? String(num(i.low_stock_threshold)) : '' }); } }}>
          <FormSection title="Історія руху" hint="Куди пішов товар: прихід, списання за послугами, інвентаризація.">
            {history.rows === null ? <div className="iv-empty small">Завантаження…</div> : history.rows.length === 0 ? <div className="iv-empty small">Руху ще не було.</div> : (
              <div className="iv-moves">
                {history.rows.map(m => (
                  <div key={m.id} className="iv-move">
                    <span className={`iv-mv-d ${m.quantity_delta > 0 ? 'in' : 'out'}`}>{m.quantity_delta > 0 ? '+' : ''}{fmtQty(m.quantity_delta)} {history.item.unit}</span>
                    <span className="iv-mv-main">
                      <b>{m.label}</b>
                      <small>{[m.service, m.client].filter(Boolean).join(' · ') || ''}{m.service || m.client ? ' · ' : ''}{new Date(m.created_at).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' })}</small>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </FormSection>
        </FormModal>
      )}

      <style>{`
        .iv-toolbar { padding: 0.8rem 2rem 0; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
        .iv-left, .iv-right { display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; }
        .iv-seg { display: inline-flex; background: #f1f5f9; border-radius: 10px; padding: 3px; }
        .iv-seg button { position: relative; height: 32px; padding: 0 0.95rem; border: none; background: transparent; border-radius: 8px; font-size: 0.8rem; font-weight: 600; color: #64748b; cursor: pointer; transition: 0.2s; }
        .iv-seg button:hover { color: #0f172a; }
        .iv-seg button.on { background: #fff; color: #0f172a; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
        .iv-seg.small button { height: 28px; padding: 0 0.7rem; font-size: 0.8rem; }
        .iv-seg.wide { display: flex; width: 100%; }
        .iv-seg.wide button { flex: 1; height: 36px; }
        .iv-dot { position: absolute; top: 5px; right: 4px; width: 6px; height: 6px; border-radius: 50%; background: #f59e0b; }
        .iv-search { position: relative; width: 280px; max-width: 100%; }
        .iv-search svg { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; }
        .iv-search .clean-input { padding-left: 2.2rem; }
        .iv-period { display: flex; align-items: center; gap: 0.35rem; }
        .iv-period > button { width: 30px; height: 30px; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff; cursor: pointer; font-size: 1rem; color: #475569; }
        .iv-period > button:hover { background: #f8fafc; color: #0f172a; }
        .iv-period > span { min-width: 124px; text-align: center; font-size: 0.875rem; font-weight: 600; color: #0f172a; }
        .iv-pills { display: flex; gap: 8px; overflow-x: auto; padding: 1rem 2rem; border-bottom: 1px solid #f1f5f9; }
        .iv-c { margin-left: 0.35rem; font-size: 0.72rem; opacity: .6; font-variant-numeric: tabular-nums; }
        .iv-sw { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 0.4rem; vertical-align: 1px; }

        .clean-input { width: 100%; padding: 0.5rem 0.8rem; border-radius: 8px; border: 1px solid #e2e8f0; background: #fafafa; font-size: 0.85rem; color: #0f172a; outline: none; transition: all 0.2s; }
        .clean-input:focus { border-color: #436b49; background: #fff; }
        .clean-btn { background: #0f172a; color: #fff; border: none; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; }
        .clean-btn:hover { background: #1e293b; }
        .clean-btn-ghost { background: transparent; color: #64748b; border: 1px solid #e2e8f0; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; }
        .clean-btn-ghost:hover { background: #f8fafc; color: #0f172a; }
        .category-pill { padding: 0.4rem 1.2rem; border-radius: 999px; background: #fff; border: 1px solid #e2e8f0; color: #64748b; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: 0.2s; white-space: nowrap; flex-shrink: 0; }
        .category-pill:hover { background: #f8fafc; color: #0f172a; }
        .category-pill.active { background: #0f172a; color: #fff; border-color: #0f172a; }

        .iv-grid { display: grid; grid-template-columns: 1fr 300px; flex: 1; min-height: 0; overflow: hidden; }
        .iv-main { overflow-y: auto; border-right: 1px solid #f1f5f9; display: flex; justify-content: center; }
        .iv-main-inner { width: 100%; max-width: 1200px; padding: 0 1.25rem 1rem; box-sizing: border-box; }
        .iv-side { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
        .iv-side-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 1.2rem 1.2rem 0.4rem; }
        .iv-side .iv-hint { flex: none; margin: 0.4rem 1.2rem 1.2rem; }
        /* Телефон: у верхньому рядку вкладки «Витрати / Склад» і кнопка додавання, нижче пошук і період */
        @media (max-width: 860px) {
          .iv-toolbar { padding: 0.75rem 1rem 0; row-gap: 0.6rem; }
          .iv-left, .iv-right { display: contents; }
          .iv-seg { order: 1; }
          .iv-add { order: 2; margin-left: auto; }
          .iv-search { order: 3; flex: 1 1 100% !important; width: 100% !important; max-width: none !important; }
          .iv-search .clean-input { font-size: 16px; }
          .iv-period { order: 4; flex: 1 1 100% !important; justify-content: space-between; }
        }
        @media (max-width: 1100px) { .iv-grid { grid-template-columns: 1fr; } .iv-side { display: none; } .iv-main { border-right: none; } }

        .service-table { 
          width: 100%; 
          border-collapse: separate; 
          border-spacing: 0 4px; 
          text-align: left; 
        }
        .service-table th { 
          padding: 0.75rem 1rem; 
          color: #94a3b8; 
          font-size: 0.7rem; 
          font-weight: 700; 
          text-transform: uppercase; 
          letter-spacing: 0.05em; 
          border-bottom: 1px solid #f1f5f9; 
          position: sticky; 
          top: 0; 
          background: #fff; 
          z-index: 10; 
          transition: color 0.2s; 
        }
        .service-table th.sortable:hover { color: #0f172a; cursor: pointer; }
        
        .service-table td { 
          padding: 0.95rem 1rem; 
          border-bottom: 1px solid #f8fafc; 
          border-top: 1px solid transparent;
          vertical-align: middle; 
          transition: background 0.15s ease; 
        }
        .service-table tr { cursor: pointer; transition: 0.15s; }
        .service-table tr.service-row:hover td { background: #f8fafc; }

        /* Плавні заокруглення лівого та правого краю рядка */
        .service-table tr.service-row td:first-child {
          border-top-left-radius: 12px;
          border-bottom-left-radius: 12px;
          padding-left: 1.25rem;
        }
        .service-table tr.service-row td:last-child {
          border-top-right-radius: 12px;
          border-bottom-right-radius: 12px;
          padding-right: 1.25rem;
        }
        .service-table td { color: #0f172a; }
        .service-table th { color: #64748b; }
        .iv-date { white-space: nowrap; }
        .iv-date small, .iv-desc small { display: block; font-size: 0.72rem; color: #94a3b8; margin-top: 1px; }
        .iv-rec { color: #6366f1 !important; font-weight: 600; }
        .iv-cat { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; font-weight: 600; color: #334155; }
        .iv-cat i { width: 8px; height: 8px; border-radius: 50%; }
        .iv-muted { color: #cbd5e1; }
        .iv-name { font-weight: 600; }
        .iv-stock th, .iv-stock td { white-space: nowrap; padding-left: 0.6rem; padding-right: 0.6rem; }
        .iv-stock th:first-child, .iv-stock td:first-child { white-space: normal; min-width: 130px; padding-left: 1rem; overflow-wrap: anywhere; }
        .iv-stock .iv-acts { padding-right: 0.8rem; }
        @media (max-width: 1350px) { .iv-stock .iv-col-price { display: none; } }
        .iv-qty { font-weight: 700; font-variant-numeric: tabular-nums; }
        .iv-qty.low { color: #d97706; }
        .iv-qty.out { color: #dc2626; }
        .iv-rowbtn { height: 32px; padding: 0 0.8rem; border-radius: 9px; border: 1px solid #e2e8f0; background: #fff; color: #0f172a; font-family: inherit; font-size: 0.8rem; font-weight: 600; cursor: pointer; white-space: nowrap; transition: all .15s; }
        .iv-rowbtn:hover { background: #f8fafc; border-color: #cbd5e1; }
        .iv-acts { white-space: nowrap; padding-left: 0 !important; }
        .iv-empty { text-align: center; padding: 5rem 2rem; color: #64748b; display: flex; flex-direction: column; gap: 0.4rem; }
        .iv-empty.small { padding: 1.5rem 0; }
        .iv-empty b { color: #0f172a; font-size: 1.05rem; }
        .iv-empty span { font-size: 0.9rem; }

        .widget-card { background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; padding: 1.2rem; margin-bottom: 0.8rem; }
        .widget-title { font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.6rem; }
        .iv-row { display: flex; justify-content: space-between; align-items: center; gap: 0.6rem; padding: 0.35rem 0; }
        .iv-row > span { color: #475569; font-size: 0.8rem; min-width: 0; }
        .iv-row small { display: block; font-size: 0.72rem; color: #94a3b8; }
        .iv-row small.low { color: #d97706; } .iv-row small.out { color: #dc2626; }
        .iv-row b { font-weight: 700; color: #0f172a; font-size: 0.85rem; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .iv-delta { font-size: 0.75rem; font-weight: 600; margin-top: 0.3rem; }
        .iv-delta.up { color: #dc2626; } .iv-delta.down { color: #059669; }
        .iv-bar { display: block; width: 100%; padding: 0.35rem 0; border: none; background: none; font-family: inherit; text-align: left; cursor: pointer; border-radius: 6px; }
        .iv-bar.on .iv-bar-top span { color: #0f172a; font-weight: 700; }
        .iv-bar-top { display: flex; justify-content: space-between; font-size: 0.8rem; color: #475569; }
        .iv-bar-top b { color: #0f172a; font-variant-numeric: tabular-nums; }
        .iv-bar i { display: block; height: 5px; border-radius: 3px; background: #e2e8f0; margin-top: 4px; overflow: hidden; }
        .iv-bar em { display: block; height: 100%; border-radius: 3px; transition: width .5s ease; }
        .iv-link { border: none; background: none; padding: 0; font-family: inherit; font-size: 0.8rem; font-weight: 600; color: #436b49; cursor: pointer; white-space: nowrap; }
        .iv-link.danger { color: #dc2626; align-self: flex-start; }
        .iv-rs-note { margin: 0 0 0.9rem; font-size: 0.82rem; line-height: 1.45; color: #64748b; }
        .iv-rs-note.small { margin: 0.35rem 0 0 1.7rem; font-size: 0.75rem; }
        .iv-rs-result { margin: 0.2rem 0 0.8rem; padding: 0.55rem 0.8rem; border-radius: 10px; background: #f0fdf4; color: #166534; font-size: 0.85rem; }
        .iv-hint { background: #f5f3ff; border: 1px dashed #c4b5fd; border-radius: 12px; padding: 1rem; }
        .iv-hint-t { font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: #7c3aed; margin-bottom: 0.6rem; }
        .iv-hint b { display: block; font-weight: 700; color: #5b21b6; font-size: 0.85rem; margin-bottom: 0.3rem; }
        .iv-hint p { font-size: 0.75rem; color: #6d28d9; line-height: 1.45; margin: 0; }

        .iv-check { display: flex; align-items: center; gap: 0.6rem; font-size: 0.875rem; color: #334155; cursor: pointer; }
        .iv-moves { display: flex; flex-direction: column; }
        .iv-move { display: grid; grid-template-columns: 96px 1fr; gap: 0.8rem; align-items: center; padding: 0.6rem 0; border-top: 1px solid #f1f5f9; }
        .iv-move:first-child { border-top: none; }
        .iv-mv-d { font-weight: 700; font-variant-numeric: tabular-nums; font-size: 0.9rem; }
        .iv-mv-d.in { color: #059669; } .iv-mv-d.out { color: #dc2626; }
        .iv-mv-main b { display: block; font-size: 0.875rem; color: #0f172a; font-weight: 600; }
        .iv-mv-main small { display: block; font-size: 0.75rem; color: #64748b; }
      `}</style>
    </div>
  );
}
