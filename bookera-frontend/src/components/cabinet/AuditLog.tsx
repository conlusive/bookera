'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, AuditEvent, AuditSummary } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';
import HelpTip from '@/components/ui/HelpTip';
import HintCard from '@/components/ui/HintCard';

/**
 * «Журнал дій» - хто, що й коли змінив у закладі.
 *
 * Власник бачить усе, адміністратор - без дій власника (вирішує сервер,
 * тож лічильники й пошук теж їх не покажуть).
 *
 * Чому сторінка не «нескінченна»:
 *   - за замовчуванням - останні 7 днів, а не вся історія;
 *   - фільтри: період, розділ, людина, пошук по тексту - усе на сервері;
 *   - вікно має власну прокрутку, підвантаження - за курсором (id події),
 *     тож нові події не зсувають сторінки й нічого не дублюється;
 *   - збоку - зведення за період: куди й хто діяв (натиск = фільтр).
 */

const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const CATS: { id: string; label: string; color: string }[] = [
  { id: 'bookings', label: 'Записи', color: '#6F9273' },
  { id: 'clients', label: 'Клієнти', color: '#0ea5e9' },
  { id: 'services', label: 'Послуги', color: '#3b82f6' },
  { id: 'team', label: 'Команда', color: '#8b5cf6' },
  { id: 'requests', label: 'Запити', color: '#f59e0b' },
  { id: 'money', label: 'Гроші', color: '#10b981' },
  { id: 'inventory', label: 'Склад', color: '#64748b' },
  { id: 'marketing', label: 'Маркетинг', color: '#ec4899' },
  { id: 'settings', label: 'Налаштування', color: '#0f172a' },
];
const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));
const ROLE: Record<string, { label: string; bg: string; fg: string }> = {
  owner: { label: 'Власник', bg: '#0f172a', fg: '#fff' },
  admin: { label: 'Адміністратор', bg: '#eef2ff', fg: '#3730a3' },
  master: { label: 'Майстер', bg: '#f1f5f9', fg: '#475569' },
  client: { label: 'Клієнт', bg: '#fef3c7', fg: '#92400e' },
};
const PERIODS = [
  { id: 'today', label: 'Сьогодні', days: 0 },
  { id: '7', label: '7 днів', days: 6 },
  { id: '30', label: '30 днів', days: 29 },
  { id: 'all', label: 'Усе', days: -1 },
] as const;
type PeriodId = (typeof PERIODS)[number]['id'];

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayKey = (d: Date) => ymd(d);
const dayLabel = (d: Date) => {
  const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Сьогодні';
  if (d.toDateString() === y.toDateString()) return 'Вчора';
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}${d.getFullYear() !== today.getFullYear() ? ` ${d.getFullYear()}` : ''}`;
};
const initials = (n?: string | null) => (n || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
const plural = (n: number, one: string, few: string, many: string) =>
  n % 10 === 1 && n % 100 !== 11 ? one : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? few : many;

/** Вибір людини: аватар, імʼя, роль і кількість дій за період. Клавіша Esc і клік поза списком закривають його. */
function PersonPicker({ value, people, total, onChange }: {
  value: string; people: { id: string; name: string; role: string | null; count: number }[]; total?: number; onChange: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', esc); };
  }, [isOpen]);
  const current = people.find(p => p.id === value);
  const pick = (id: string) => { onChange(id); setIsOpen(false); };
  return (
    <div className="pp" ref={ref}>
      <button type="button" className={`pp-btn ${value ? 'on' : ''}`} onClick={() => setIsOpen(o => !o)} aria-haspopup="listbox" aria-expanded={isOpen} aria-label="Людина">
        {current ? <><span className="pp-ava">{initials(current.name)}</span><span className="pp-name">{current.name}</span></> : <span className="pp-name">Усі люди</span>}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {isOpen && (
        <div className="pp-menu" role="listbox">
          <button type="button" role="option" aria-selected={!value} className={`pp-opt ${!value ? 'sel' : ''}`} onClick={() => pick('')}>
            <span className="pp-ava all">∗</span><span className="pp-text"><b>Усі люди</b></span>{total != null && <em>{total}</em>}
          </button>
          {people.map(p => (
            <button key={p.id} type="button" role="option" aria-selected={value === p.id} className={`pp-opt ${value === p.id ? 'sel' : ''}`} onClick={() => pick(p.id)}>
              <span className="pp-ava">{initials(p.name)}</span>
              <span className="pp-text"><b>{p.name}</b><small>{ROLE[p.role || '']?.label}</small></span>
              <em>{p.count}</em>
            </button>
          ))}
          {people.length === 0 && <div className="pp-empty">Дій ще немає</div>}
        </div>
      )}
    </div>
  );
}

export default function AuditLog({ businessId }: { businessId: number }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<AuditSummary | null>(null);

  const [period, setPeriod] = useState<PeriodId>('7');
  const [category, setCategory] = useState('');
  const [actor, setActor] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  // Усі, кого колись бачили у зведенні: обрана людина не зникає зі списку, коли в новому періоді в неї подій нема
  const [known, setKnown] = useState<Record<string, { name: string | null; role: string | null }>>({});

  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  // Пошук - із затримкою: сервер не питаємо на кожну літеру
  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(t); }, [search]);

  const range = useMemo(() => {
    const p = PERIODS.find(x => x.id === period)!;
    if (p.days < 0) return { date_from: undefined, date_to: undefined };
    const to = new Date(); const from = new Date(); from.setDate(to.getDate() - p.days);
    return { date_from: ymd(from), date_to: ymd(to) };
  }, [period]);

  const fetchPage = useCallback(async (before?: number) => {
    const token = await getAuthToken();
    return api.getAuditLog(token, businessId, { ...range, category, actor_id: actor, q, before_id: before, limit: 50 });
  }, [businessId, range, category, actor, q]);

  // Перша сторінка - при кожній зміні фільтрів; відповіді, що запізнились, ігноруємо
  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const page = await fetchPage();
      if (id !== requestId.current) return;
      setEvents(page.items); setHasMore(page.has_more); setCursor(page.next_before_id); setError('');
      scrollRef.current?.scrollTo({ top: 0 });
    } catch (err: any) {
      if (id === requestId.current) setError(err?.message || 'Не вдалося завантажити журнал');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => { void reload(); }, [reload]);

  // Лічильники - за періодом і пошуком, але НЕ за розділом чи людиною: інакше
  // пігулки зникали б, щойно людина обрала один розділ.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const s = await api.getAuditSummary(await getAuthToken(), businessId, { ...range, q });
        if (cancelled) return;
        setSummary(s);
        setKnown(prev => {
          const next = { ...prev };
          s.by_actor.forEach(p => { if (p.actor_id) next[p.actor_id] = { name: p.name, role: p.role }; });
          return next;
        });
      } catch { /* без лічильників журнал усе одно працює */ }
    })();
    return () => { cancelled = true; };
  }, [businessId, range, q]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || cursor == null) return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const page = await fetchPage(cursor);
      if (id !== requestId.current) return;
      setEvents(prev => [...prev, ...page.items]); setHasMore(page.has_more); setCursor(page.next_before_id);
    } catch { /* кнопка «Показати ще» лишається */ } finally { setLoadingMore(false); }
  }, [hasMore, loadingMore, cursor, fetchPage]);

  // Дійшли до кінця списку - підвантажуємо наступну сторінку
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !scrollRef.current) return;
    const io = new IntersectionObserver(entries => { if (entries[0].isIntersecting) void loadMore(); }, { root: scrollRef.current, rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  // Групуємо за днем незалежно від порядку: події одного дня завжди в одній групі
  // (сторінки йдуть за id, а день береться з часу - на межі доби вони можуть розійтись).
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; items: AuditEvent[] }>();
    events.forEach(e => {
      const d = new Date(e.created_at);
      const key = dayKey(d);
      if (!map.has(key)) map.set(key, { key, label: dayLabel(d), items: [] });
      map.get(key)!.items.push(e);
    });
    const out = Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
    out.forEach(g => g.items.sort((x, y) => (x.created_at < y.created_at ? 1 : x.created_at > y.created_at ? -1 : y.id - x.id)));
    return out;
  }, [events]);

  const people = useMemo(() => {
    const counts = new Map((summary?.by_actor || []).filter(p => p.actor_id).map(p => [p.actor_id!, p.count]));
    const ids = new Set<string>([...counts.keys(), ...(actor ? [actor] : [])]);
    return Array.from(ids)
      .map(id => ({ id, name: known[id]?.name || summary?.by_actor.find(p => p.actor_id === id)?.name || 'Без імені', role: known[id]?.role ?? null, count: counts.get(id) ?? 0 }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'uk'));
  }, [summary, known, actor]);

  const filtered = !!(category || actor || q);
  const reset = () => { setCategory(''); setActor(''); setSearch(''); setQ(''); };
  const total = summary?.total;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%', background: '#fff' }}>
      {/* --- ПАНЕЛЬ --- */}
      <div className="al-toolbar">
        <div className="al-left">
          <div className="al-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input className="clean-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Пошук: ім’я, послуга, сума…" aria-label="Пошук у журналі" />
          </div>
          <PersonPicker value={actor} people={people} total={total} onChange={setActor} />
        </div>
        <div className="al-seg" role="tablist">
          {PERIODS.map(p => <button key={p.id} type="button" role="tab" aria-selected={period === p.id} className={period === p.id ? 'on' : ''} onClick={() => setPeriod(p.id)}>{p.label}</button>)}
        </div>
      </div>

      <div className="al-pills">
        <button type="button" className={`category-pill ${!category ? 'active' : ''}`} onClick={() => setCategory('')}>
          Усе {total != null && <span className="al-c">{total}</span>}
        </button>
        {CATS.map(c => (
          <button key={c.id} type="button" className={`category-pill ${category === c.id ? 'active' : ''}`} onClick={() => setCategory(category === c.id ? '' : c.id)}>
            <i style={{ background: c.color }} />{c.label} {summary && <span className="al-c">{summary.by_category[c.id] ?? 0}</span>}
          </button>
        ))}
      </div>

      <div className="al-grid">
        <div className="custom-scroll al-main" ref={scrollRef}>
          <div className="al-main-inner">
            {error ? (
              <div className="al-empty"><b>Журнал недоступний</b><span>{error}</span></div>
            ) : loading && events.length === 0 ? (
              <div className="al-empty"><span>Завантаження…</span></div>
            ) : events.length === 0 ? (
              filtered
                ? <div className="al-empty"><b>Нічого не знайдено</b><span>Спробуйте інше слово, період чи розділ.</span><button type="button" className="clean-btn-ghost" onClick={reset}>Скинути фільтри</button></div>
                : <div className="al-empty"><b>За цей період дій не було</b><span>Зміни команди з’являтимуться тут у міру роботи. Спробуйте довший період.</span></div>
            ) : (
              <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity .15s' }}>
                {groups.map(g => (
                  <section key={g.key} className="al-group">
                    <div className="al-day">{g.label}<span>{g.items.length}</span></div>
                    {g.items.map(e => {
                      const r = ROLE[e.actor_role || ''] || ROLE.master;
                      const t = new Date(e.created_at);
                      const cat = CAT[e.category];
                      const changes = e.meta?.changes;
                      const expandable = !!changes?.length;
                      return (
                        <div key={e.id} className={`al-row ${expandable ? 'x' : ''} ${open === e.id ? 'open' : ''}`}
                          onClick={() => expandable && setOpen(open === e.id ? null : e.id)}>
                          <span className="al-time">{String(t.getHours()).padStart(2, '0')}:{String(t.getMinutes()).padStart(2, '0')}</span>
                          <span className="al-ava">{e.actor_role === 'client' ? 'К' : initials(e.actor_name)}</span>
                          <div className="al-body">
                            <div className="al-who">
                              <b>{e.actor_role === 'client' ? 'Клієнт' : e.actor_name || 'Без імені'}</b>
                              <span className="al-role" style={{ background: r.bg, color: r.fg }}>{r.label}</span>
                              <span className="al-cat"><i style={{ background: cat?.color || '#94a3b8' }} />{cat?.label || e.category}</span>
                            </div>
                            <div className="al-sum">{e.summary}</div>
                            {expandable && open === e.id && (
                              <ul className="al-changes">
                                {changes!.map((c, i) => (
                                  <li key={i}><span>{c.label}</span>{c.from !== undefined ? <><s>{c.from}</s><em>→</em><b>{c.to}</b></> : <i>змінено</i>}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                          {expandable && (
                            <svg className="al-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
                              style={{ transform: open === e.id ? 'rotate(180deg)' : undefined }}><polyline points="6 9 12 15 18 9" /></svg>
                          )}
                        </div>
                      );
                    })}
                  </section>
                ))}
                <div ref={sentinelRef} className="al-end">
                  {hasMore
                    ? <button type="button" className="clean-btn-ghost" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? 'Завантажуємо…' : 'Показати ще'}</button>
                    : <span>Це все{total != null ? ` — ${events.length} ${plural(events.length, 'подія', 'події', 'подій')}` : ''}. {period !== 'all' && 'Довша історія — у «Усе».'}</span>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* --- БІЧНА КОЛОНКА --- */}
        <aside className="al-side">
          <div className="custom-scroll al-side-scroll">
            <div className="widget-card">
              <div className="widget-title">За період</div>
              <div className="al-total"><b>{total ?? '—'}</b><span>{total != null ? plural(total, 'подія', 'події', 'подій') : ''}</span></div>
              {summary && total! > 0 && summary.by_actor.slice(0, 1).map(p => <p className="al-note" key="top">Найактивніший — <b>{p.name || 'Без імені'}</b> ({p.count}).</p>)}
            </div>
            {summary && total! > 0 && (
              <div className="widget-card">
                <div className="widget-title">Куди йшли дії</div>
                {CATS.filter(c => (summary.by_category[c.id] || 0) > 0).sort((a, b) => summary.by_category[b.id] - summary.by_category[a.id]).map(c => (
                  <button key={c.id} type="button" className={`al-bar ${category === c.id ? 'on' : ''}`} onClick={() => setCategory(category === c.id ? '' : c.id)}>
                    <span className="al-bar-top"><span>{c.label}</span><b>{summary.by_category[c.id]}</b></span>
                    <i><em style={{ width: `${Math.max(summary.by_category[c.id] / total! * 100, 3)}%`, background: c.color }} /></i>
                  </button>
                ))}
              </div>
            )}
            {summary && summary.by_actor.filter(p => p.actor_id).length > 1 && (
              <div className="widget-card">
                <div className="widget-title">Хто діяв</div>
                {summary.by_actor.filter(p => p.actor_id).slice(0, 6).map(p => (
                  <button key={p.actor_id!} type="button" className={`al-person ${actor === p.actor_id ? 'on' : ''}`} onClick={() => setActor(actor === p.actor_id ? '' : p.actor_id!)}>
                    <span>{p.name || 'Без імені'}<small>{ROLE[p.role || '']?.label}</small></span><b>{p.count}</b>
                  </button>
                ))}
              </div>
            )}
          <HintCard title="Хто бачить журнал">Власник бачить усе, адміністратор — без дій власника. Приватні поля (нотатки, алергії) в журнал не потрапляють: лише «змінено». Натисніть на запис зі стрілкою, щоб побачити, що саме змінилось: «було → стало».</HintCard>
          </div>
        </aside>
      </div>

      <style>{`
        .al-toolbar { padding: 0.8rem 2rem 0; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
        .al-left { display: flex; align-items: center; gap: 0.7rem; flex-wrap: wrap; }
        .al-search { position: relative; width: 300px; max-width: 100%; }
        .al-search svg { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; }
        .al-search .clean-input { padding-left: 2.2rem; }
        .pp { position: relative; }
        .pp-btn { height: 36px; min-width: 190px; max-width: 260px; padding: 0 0.7rem; display: inline-flex; align-items: center; gap: 0.5rem; border-radius: 8px; border: 1px solid #e2e8f0; background: #fafafa; font-family: inherit; font-size: 0.85rem; color: #0f172a; cursor: pointer; transition: 0.2s; }
        .pp-btn:hover { background: #fff; border-color: #cbd5e1; } .pp-btn.on { background: #fff; border-color: #0f172a; }
        .pp-btn svg { margin-left: auto; color: #94a3b8; flex: none; }
        .pp-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pp-ava { width: 22px; height: 22px; border-radius: 50%; background: #eef1f6; color: #475569; display: inline-flex; align-items: center; justify-content: center; font-size: 0.62rem; font-weight: 700; flex: none; }
        .pp-ava.all { background: #f1f5f9; color: #94a3b8; font-size: 0.9rem; }
        .pp-menu { position: absolute; top: calc(100% + 6px); left: 0; z-index: 30; min-width: 280px; max-height: 340px; overflow-y: auto; padding: 0.35rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 12px 32px rgba(15,23,42,.12); }
        .pp-opt { display: flex; align-items: center; gap: 0.6rem; width: 100%; padding: 0.5rem 0.6rem; border: none; background: none; border-radius: 8px; font-family: inherit; text-align: left; cursor: pointer; }
        .pp-opt:hover { background: #f8fafc; } .pp-opt.sel { background: #f1f5f9; }
        .pp-opt .pp-ava { width: 28px; height: 28px; font-size: 0.7rem; }
        .pp-text { flex: 1; min-width: 0; } .pp-text b { display: block; font-size: 0.85rem; font-weight: 600; color: #0f172a; } .pp-text small { display: block; font-size: 0.72rem; color: #94a3b8; }
        .pp-opt em { font-style: normal; font-size: 0.78rem; color: #94a3b8; font-variant-numeric: tabular-nums; }
        .pp-empty { padding: 0.8rem; text-align: center; font-size: 0.8rem; color: #94a3b8; }
        .al-seg { display: inline-flex; background: #f1f5f9; border-radius: 10px; padding: 3px; }
        .al-seg button { height: 30px; padding: 0 0.9rem; border: none; background: transparent; border-radius: 8px; font-size: 0.8rem; font-weight: 600; color: #64748b; cursor: pointer; transition: 0.2s; }
        .al-seg button:hover { color: #0f172a; }
        .al-seg button.on { background: #fff; color: #0f172a; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
        .al-pills { display: flex; gap: 8px; overflow-x: auto; padding: 0.9rem 2rem; border-bottom: 1px solid #f1f5f9; scrollbar-width: none; }
        .al-pills::-webkit-scrollbar { display: none; }
        .al-pills .category-pill i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 0.4rem; vertical-align: 1px; }
        .al-c { margin-left: 0.35rem; font-size: 0.72rem; opacity: .6; font-variant-numeric: tabular-nums; }

        .clean-input { width: 100%; padding: 0.5rem 0.8rem; border-radius: 8px; border: 1px solid #e2e8f0; background: #fafafa; font-size: 0.85rem; color: #0f172a; outline: none; transition: all 0.2s; box-sizing: border-box; font-family: inherit; }
        .clean-input:focus { border-color: #436b49; background: #fff; }
        .clean-input::placeholder { color: #94a3b8; }
        .clean-btn-ghost { background: transparent; color: #64748b; border: 1px solid #e2e8f0; padding: 0.55rem 1.1rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: 0.2s; white-space: nowrap; }
        .clean-btn-ghost:hover:not(:disabled) { background: #f8fafc; color: #0f172a; }
        .category-pill { padding: 0.4rem 1.2rem; border-radius: 999px; background: #fff; border: 1px solid #e2e8f0; color: #64748b; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: 0.2s; white-space: nowrap; flex-shrink: 0; }
        .category-pill:hover { background: #f8fafc; color: #0f172a; }
        .category-pill.active { background: #0f172a; color: #fff; border-color: #0f172a; }
        .widget-card { background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; padding: 1.2rem; margin-bottom: 0.8rem; }
        .widget-title { font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.6rem; }

        .al-grid { display: grid; grid-template-columns: 1fr 300px; flex: 1; min-height: 0; overflow: hidden; }
        .al-main { overflow-y: auto; border-right: 1px solid #f1f5f9; }
        .al-main-inner { width: 100%; padding: 0 2rem 2rem; box-sizing: border-box; }
        .al-side { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
        .al-side-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 1.2rem 1.2rem 0.4rem; }
        @media (max-width: 1100px) { .al-grid { grid-template-columns: 1fr; } .al-side { display: none; } .al-main { border-right: none; } .al-toolbar, .al-pills { padding-left: 1rem; padding-right: 1rem; } .al-main-inner { padding: 0 1rem 2rem; } }

        .al-group { margin-top: 0.4rem; }
        .al-day { position: sticky; top: 0; z-index: 2; background: rgba(255,255,255,.96); backdrop-filter: blur(6px); padding: 1rem 0 0.5rem; font-size: 0.78rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.5rem; border-bottom: 1px solid #f1f5f9; }
        .al-day span { font-size: 0.72rem; font-weight: 600; color: #94a3b8; background: #f1f5f9; border-radius: 999px; padding: 0.05rem 0.5rem; letter-spacing: 0; }
        .al-row { display: grid; grid-template-columns: 46px 34px minmax(0, 1fr) 18px; gap: 0.8rem; align-items: start; padding: 0.8rem 0.6rem; margin: 0 -0.6rem; border-bottom: 1px solid #f8fafc; border-radius: 10px; }
        .al-row.x { cursor: pointer; } .al-row.x:hover { background: #f8fafc; } .al-row.open { background: #f8fafc; }
        .al-time { font-size: 0.8rem; color: #94a3b8; font-variant-numeric: tabular-nums; padding-top: 0.45rem; }
        .al-ava { width: 34px; height: 34px; border-radius: 50%; background: #eef1f6; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; color: #475569; }
        .al-who { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
        .al-who b { font-size: 0.875rem; font-weight: 600; color: #0f172a; }
        .al-role { font-size: 0.68rem; font-weight: 600; padding: 1px 7px; border-radius: 999px; }
        .al-cat { margin-left: auto; font-size: 0.72rem; color: #94a3b8; display: inline-flex; align-items: center; gap: 0.35rem; }
        .al-cat i { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
        .al-sum { font-size: 0.875rem; color: #334155; margin-top: 3px; line-height: 1.5; overflow-wrap: anywhere; }
        .al-chev { color: #94a3b8; margin-top: 0.4rem; transition: transform .15s; }
        .al-changes { list-style: none; margin: 0.6rem 0 0; padding: 0.6rem 0.8rem; background: #fff; border: 1px solid #f1f5f9; border-radius: 10px; display: flex; flex-direction: column; gap: 0.35rem; }
        .al-changes li { display: flex; align-items: baseline; gap: 0.5rem; font-size: 0.8rem; color: #64748b; flex-wrap: wrap; }
        .al-changes li > span { min-width: 140px; }
        .al-changes s { color: #94a3b8; } .al-changes em { color: #cbd5e1; font-style: normal; } .al-changes b { color: #0f172a; } .al-changes i { color: #94a3b8; }
        .al-end { padding: 1.5rem 0 0.5rem; text-align: center; font-size: 0.8rem; color: #94a3b8; }
        .al-empty { text-align: center; padding: 5rem 2rem; color: #64748b; display: flex; flex-direction: column; gap: 0.5rem; align-items: center; }
        .al-empty b { color: #0f172a; font-size: 1.05rem; }

        .al-total { display: flex; align-items: baseline; gap: 0.5rem; } .al-total b { font-size: 1.8rem; font-weight: 800; color: #0f172a; } .al-total span { color: #64748b; font-size: 0.85rem; }
        .al-note { margin: 0.5rem 0 0; font-size: 0.78rem; color: #64748b; } .al-note b { color: #0f172a; }
        .al-bar { display: block; width: 100%; padding: 0.35rem 0.4rem; margin: 0 -0.4rem; width: calc(100% + 0.8rem); border: none; background: none; font-family: inherit; text-align: left; cursor: pointer; border-radius: 8px; }
        .al-bar:hover, .al-bar.on { background: #fff; }
        .al-bar-top { display: flex; justify-content: space-between; font-size: 0.8rem; color: #475569; } .al-bar-top b { color: #0f172a; font-variant-numeric: tabular-nums; }
        .al-bar i { display: block; height: 5px; border-radius: 3px; background: #e2e8f0; margin-top: 4px; overflow: hidden; } .al-bar em { display: block; height: 100%; border-radius: 3px; }
        .al-person { display: flex; justify-content: space-between; align-items: center; width: calc(100% + 0.8rem); margin: 0 -0.4rem; padding: 0.4rem; border: none; background: none; font-family: inherit; font-size: 0.8rem; color: #0f172a; cursor: pointer; border-radius: 8px; text-align: left; }
        .al-person:hover, .al-person.on { background: #fff; } .al-person small { display: block; font-size: 0.7rem; color: #94a3b8; } .al-person b { font-variant-numeric: tabular-nums; }
        .al-hint { flex: none; margin: 0.4rem 1.2rem 1.2rem; background: #f5f3ff; border: 1px dashed #c4b5fd; border-radius: 12px; padding: 1rem; }
        .al-hint-t { font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: #7c3aed; margin-bottom: 0.6rem; }
        .al-hint b { display: block; font-weight: 700; color: #5b21b6; font-size: 0.85rem; margin-bottom: 0.3rem; }
        .al-hint p { font-size: 0.75rem; color: #6d28d9; line-height: 1.45; margin: 0; }
      `}</style>
    </div>
  );
}
