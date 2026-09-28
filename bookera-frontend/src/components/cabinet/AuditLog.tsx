'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';

/**
 * «Журнал дій» - хто, що й коли змінив у закладі.
 * Власник бачить усе, адміністратор - без дій власника (це вирішує сервер).
 * Стиль - як у «Клієнтах» і «Команді».
 */

const C = { text: '#0f172a', sub: '#64748b', border: '#e2e8f0' };
const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const CATS = [
  { id: '', label: 'Усе' },
  { id: 'bookings', label: 'Записи' },
  { id: 'services', label: 'Послуги' },
  { id: 'team', label: 'Команда' },
  { id: 'requests', label: 'Запити' },
  { id: 'money', label: 'Гроші' },
  { id: 'inventory', label: 'Склад' },
  { id: 'settings', label: 'Налаштування' },
];
const ROLE: Record<string, { label: string; bg: string; fg: string }> = {
  owner: { label: 'Власник', bg: '#0f172a', fg: '#fff' },
  admin: { label: 'Адміністратор', bg: '#eef2ff', fg: '#3730a3' },
  master: { label: 'Майстер', bg: '#f1f5f9', fg: '#475569' },
  client: { label: 'Клієнт', bg: '#fef3c7', fg: '#92400e' },
};
const CAT_DOT: Record<string, string> = {
  bookings: '#6F9273', services: '#3b82f6', team: '#8b5cf6', requests: '#f59e0b',
  money: '#10b981', inventory: '#64748b', settings: '#0f172a',
};

const dayLabel = (d: Date) => {
  const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Сьогодні';
  if (d.toDateString() === y.toDateString()) return 'Вчора';
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}${d.getFullYear() !== today.getFullYear() ? ` ${d.getFullYear()}` : ''}`;
};
const initials = (n?: string | null) => (n || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();

export default function AuditLog({ businessId }: { businessId: number }) {
  const [events, setEvents] = useState<any[] | null>(null);
  const [category, setCategory] = useState('');
  const [actor, setActor] = useState('');
  const [more, setMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);

  const load = useCallback(async (before?: string) => {
    const t = await getAuthToken();
    const rows = await api.getAuditLog(t, businessId, { category, actor_id: actor, before }).catch(() => []);
    setMore(rows.length >= 50);
    setEvents(prev => (before ? [...(prev || []), ...rows] : rows));
    // Список людей для фільтра - з того, що вже бачили
    setPeople(prev => {
      const map = new Map(prev.map(p => [p.id, p.name]));
      rows.forEach((e: any) => { if (e.actor_id && !map.has(e.actor_id)) map.set(e.actor_id, e.actor_name || 'Без імені'); });
      return Array.from(map, ([id, name]) => ({ id, name }));
    });
  }, [businessId, category, actor]);

  useEffect(() => { setEvents(null); void load(); }, [load]);

  const groups = useMemo(() => {
    const out: { label: string; items: any[] }[] = [];
    (events || []).forEach(e => {
      const d = new Date(e.created_at);
      const label = dayLabel(d);
      if (!out.length || out[out.length - 1].label !== label) out.push({ label, items: [] });
      out[out.length - 1].items.push(e);
    });
    return out;
  }, [events]);

  const loadMore = async () => {
    if (!events?.length) return;
    setLoadingMore(true);
    await load(events[events.length - 1].created_at);
    setLoadingMore(false);
  };

  return (
    <div className="al">
      <div className="al-header">
        <div>
          <h2>Журнал дій</h2>
          <p>Хто, що й коли змінив у закладі.</p>
        </div>
        <select value={actor} onChange={e => setActor(e.target.value)} aria-label="Людина">
          <option value="">Уся команда</option>
          {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="al-chips">
        {CATS.map(c => (
          <button key={c.id} type="button" className={category === c.id ? 'on' : ''} onClick={() => setCategory(c.id)}>{c.label}</button>
        ))}
      </div>

      <section className="al-card">
        {events === null ? <div className="al-empty">Завантаження…</div> : events.length === 0 ? (
          <div className="al-empty">Тут поки порожньо. Дії команди зʼявлятимуться в міру роботи.</div>
        ) : groups.map(g => (
          <div key={g.label} className="al-group">
            <div className="al-day">{g.label}</div>
            {g.items.map(e => {
              const r = ROLE[e.actor_role] || ROLE.master;
              const t = new Date(e.created_at);
              return (
                <div key={e.id} className="al-row">
                  <span className="al-time">{String(t.getHours()).padStart(2, '0')}:{String(t.getMinutes()).padStart(2, '0')}</span>
                  <span className="al-dot" style={{ background: CAT_DOT[e.category] || C.sub }} />
                  <span className="al-ava">{e.actor_role === 'client' ? 'К' : initials(e.actor_name)}</span>
                  <div className="al-main">
                    <div className="al-who">
                      <b>{e.actor_role === 'client' ? 'Клієнт' : e.actor_name || 'Без імені'}</b>
                      <span className="al-role" style={{ background: r.bg, color: r.fg }}>{r.label}</span>
                    </div>
                    <div className="al-sum">{e.summary}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {events && events.length > 0 && more && (
          <button type="button" className="al-more" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? 'Завантажуємо…' : 'Показати старіші'}
          </button>
        )}
      </section>

      <style jsx>{`
        .al { padding: 1.5rem 3rem; background: #fff; min-height: 100vh; width: 100%; box-sizing: border-box; color: ${C.text}; }
        .al-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 1rem; margin: 0.5rem 0 1.25rem; flex-wrap: wrap; }
        .al-header h2 { font-size: 1.6rem; font-weight: 800; margin: 0; letter-spacing: -0.5px; }
        .al-header p { margin: 0.35rem 0 0; color: ${C.sub}; font-size: 0.95rem; }
        .al-header select { height: 38px; padding: 0 0.8rem; border-radius: 10px; border: 1px solid ${C.border}; background: #fff; font-family: inherit; font-size: 0.875rem; color: ${C.text}; min-width: 200px; }
        .al-chips { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 1rem; }
        .al-chips button { height: 32px; padding: 0 0.85rem; border-radius: 999px; border: 1px solid ${C.border}; background: #fff; font-family: inherit; font-size: 0.85rem; color: ${C.text}; cursor: pointer; }
        .al-chips button.on { background: ${C.text}; border-color: ${C.text}; color: #fff; }
        .al-card { border: 1px solid ${C.border}; border-radius: 16px; padding: 0.5rem 1.25rem 1rem; max-width: 920px; }
        .al-day { font-size: 0.78rem; font-weight: 700; color: ${C.sub}; text-transform: uppercase; letter-spacing: 0.04em; padding: 1rem 0 0.4rem; }
        .al-row { display: grid; grid-template-columns: 44px 8px 32px 1fr; gap: 0.75rem; align-items: center; padding: 0.65rem 0; border-top: 1px solid #f1f5f9; }
        .al-day + .al-row { border-top: none; }
        .al-time { font-size: 0.8rem; color: ${C.sub}; font-variant-numeric: tabular-nums; }
        .al-dot { width: 8px; height: 8px; border-radius: 50%; }
        .al-ava { width: 32px; height: 32px; border-radius: 50%; background: #EEF1F6; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; }
        .al-who { display: flex; align-items: center; gap: 0.5rem; }
        .al-who b { font-size: 0.875rem; font-weight: 600; }
        .al-role { font-size: 0.68rem; font-weight: 600; padding: 1px 7px; border-radius: 999px; }
        .al-sum { font-size: 0.875rem; color: #334155; margin-top: 2px; line-height: 1.45; }
        .al-empty { padding: 2.5rem 0; text-align: center; color: ${C.sub}; }
        .al-more { display: block; margin: 1rem auto 0; height: 36px; padding: 0 1.1rem; border-radius: 10px; border: 1px solid ${C.border}; background: #fff; font-family: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; color: ${C.text}; }
        @media (max-width: 700px) { .al { padding: 1.25rem 1rem; } .al-row { grid-template-columns: 40px 8px 1fr; } .al-ava { display: none; } }
      `}</style>
    </div>
  );
}
