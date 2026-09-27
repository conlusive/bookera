'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';

/**
 * «Мої клієнти» - ті, хто ходить саме до цього майстра, а не всі
 * клієнти салону. Візити, коли був востаннє й коли наступний запис,
 * нотатки й формули з картки. Підказки, що повертають клієнтів:
 * скоро день народження, давно не приходив.
 */

const C = { text: '#0f172a', sub: '#64748b', border: '#e2e8f0' };
const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const d = (iso?: string | null) => { if (!iso) return '—'; const x = new Date(iso); return `${x.getDate()} ${MONTHS_GEN[x.getMonth()]}`; };
const money = (n: number) => `${Math.round(n).toLocaleString('uk-UA')} ₴`;
const plural = (n: number, a: string, b: string, c: string) =>
  n % 10 === 1 && n % 100 !== 11 ? a : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? b : c;
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase() || 'К';

export default function MasterClients({ businessId }: { businessId: number }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'birthday' | 'lapsed' | 'upcoming'>('all');
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const t = await getAuthToken();
      setRows(await api.listMyClients(t, businessId).catch(() => []));
    })();
  }, [businessId]);

  const counts = useMemo(() => ({
    birthday: (rows || []).filter(r => r.birthday_in != null && r.birthday_in <= 14).length,
    lapsed: (rows || []).filter(r => r.lapsed).length,
    upcoming: (rows || []).filter(r => r.next_visit).length,
  }), [rows]);

  const shown = useMemo(() => (rows || []).filter(r => {
    if (filter === 'birthday' && !(r.birthday_in != null && r.birthday_in <= 14)) return false;
    if (filter === 'lapsed' && !r.lapsed) return false;
    if (filter === 'upcoming' && !r.next_visit) return false;
    const s = q.trim().toLowerCase();
    return !s || `${r.name} ${r.phone || ''}`.toLowerCase().includes(s);
  }), [rows, q, filter]);

  const chips = [
    { id: 'all', label: 'Усі', n: rows?.length ?? 0 },
    { id: 'upcoming', label: 'Мають запис', n: counts.upcoming },
    { id: 'birthday', label: 'День народження скоро', n: counts.birthday },
    { id: 'lapsed', label: 'Давно не були', n: counts.lapsed },
  ] as const;

  return (
    <div className="mc">
      <div className="mc-header">
        <h2>Мої клієнти</h2>
        <div className="mc-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M16.5 16.5 21 21" /></svg>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Імʼя чи телефон" />
        </div>
      </div>

      <div className="mc-chips">
        {chips.map(c => (
          <button key={c.id} type="button" className={filter === c.id ? 'on' : ''} onClick={() => setFilter(c.id)}>
            {c.label}<span>{c.n}</span>
          </button>
        ))}
      </div>

      {filter === 'lapsed' && counts.lapsed > 0 && (
        <div className="mc-hint">Не приходили понад 45 днів і не мають запису. Коротке повідомлення часто повертає клієнта.</div>
      )}
      {filter === 'birthday' && counts.birthday > 0 && (
        <div className="mc-hint">День народження в найближчі два тижні — гарний привід привітати.</div>
      )}

      <section className="mc-card">
        {rows === null ? <div className="mc-empty">Завантаження…</div> : shown.length === 0 ? (
          <div className="mc-empty">{rows.length === 0 ? 'Клієнти зʼявляться після перших записів до вас.' : 'Нікого не знайдено.'}</div>
        ) : (
          <>
            <div className="mc-th"><span>Клієнт</span><span>Візити</span><span>Востаннє</span><span>Наступний</span><span style={{ textAlign: 'right' }}>Витратили</span></div>
            {shown.map(r => {
              const key = `${r.name}-${r.phone || r.email || ''}`;
              const isOpen = open === key;
              return (
                <div key={key} className={`mc-item ${isOpen ? 'open' : ''}`}>
                  <button type="button" className="mc-tr" onClick={() => setOpen(isOpen ? null : key)}>
                    <span className="mc-who">
                      <span className="mc-ava">{initials(r.name)}</span>
                      <span>
                        <b>{r.name}</b>
                        <small>
                          {r.phone || r.email || ''}
                          {r.birthday_in != null && r.birthday_in <= 14 && <em className="mc-tag bd">{r.birthday_in === 0 ? 'сьогодні ДН' : `ДН через ${r.birthday_in} дн.`}</em>}
                          {r.lapsed && <em className="mc-tag">{r.days_since} дн. без візиту</em>}
                        </small>
                      </span>
                    </span>
                    <span>{r.visits}</span>
                    <span className="mc-sub">{d(r.last_visit)}</span>
                    <span className="mc-sub">{r.next_visit ? d(r.next_visit) : '—'}</span>
                    <b style={{ textAlign: 'right' }}>{money(r.spent)}</b>
                  </button>
                  {isOpen && (
                    <div className="mc-detail">
                      <div className="mc-actions">
                        {r.phone && <a href={`tel:${r.phone}`}>Подзвонити</a>}
                        {r.phone && <a href={`sms:${r.phone}`}>Написати SMS</a>}
                        {r.instagram && <a href={`https://instagram.com/${r.instagram.replace('@', '')}`} target="_blank" rel="noreferrer">Instagram</a>}
                      </div>
                      <div className="mc-facts">
                        <div><small>Остання послуга</small><span>{r.last_service || '—'}</span></div>
                        <div><small>Візитів</small><span>{r.visits} {plural(r.visits, 'візит', 'візити', 'візитів')}</span></div>
                        <div><small>День народження</small><span>{r.birthday ? d(r.birthday) : '—'}</span></div>
                        {r.formulas && <div className="wide"><small>Формула</small><span>{r.formulas}</span></div>}
                        {r.notes && <div className="wide"><small>Нотатки</small><span>{r.notes}</span></div>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </section>

      <style jsx>{`
        .mc { padding: 1.5rem 3rem; background: #fff; min-height: 100vh; width: 100%; box-sizing: border-box; color: ${C.text}; }
        .mc-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin: 0.5rem 0 1.25rem; flex-wrap: wrap; }
        .mc-header h2 { font-size: 1.6rem; font-weight: 800; margin: 0; letter-spacing: -0.5px; }
        .mc-search { display: flex; align-items: center; gap: 0.5rem; height: 38px; padding: 0 0.8rem; border: 1px solid ${C.border}; border-radius: 10px; min-width: 260px; }
        .mc-search input { border: none; outline: none; font-family: inherit; font-size: 0.875rem; flex: 1; color: ${C.text}; }
        .mc-chips { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
        .mc-chips button { display: inline-flex; align-items: center; gap: 0.45rem; height: 34px; padding: 0 0.85rem; border-radius: 999px; border: 1px solid ${C.border}; background: #fff; font-family: inherit; font-size: 0.85rem; color: ${C.text}; cursor: pointer; }
        .mc-chips button span { font-size: 0.75rem; color: ${C.sub}; font-variant-numeric: tabular-nums; }
        .mc-chips button.on { background: ${C.text}; border-color: ${C.text}; color: #fff; }
        .mc-chips button.on span { color: rgba(255,255,255,.7); }
        .mc-hint { font-size: 0.875rem; color: ${C.sub}; margin: -0.2rem 0 1rem; }
        .mc-card { border: 1px solid ${C.border}; border-radius: 16px; padding: 0.4rem 1.2rem 0.6rem; }
        .mc-th, .mc-tr { display: grid; grid-template-columns: minmax(0, 2.4fr) 0.6fr 1fr 1fr 1fr; gap: 0.75rem; align-items: center; }
        .mc-th { font-size: 0.78rem; color: ${C.sub}; font-weight: 600; padding: 0.8rem 0 0.6rem; border-bottom: 2px solid ${C.border}; }
        .mc-item { border-bottom: 1px solid #f1f5f9; }
        .mc-item:last-child { border-bottom: none; }
        .mc-tr { width: 100%; padding: 0.75rem 0; border: none; background: none; font-family: inherit; font-size: 0.9rem; color: ${C.text}; text-align: left; cursor: pointer; }
        .mc-tr:hover { background: #f8fafc; }
        .mc-who { display: flex; align-items: center; gap: 0.75rem; min-width: 0; }
        .mc-who b { display: block; font-weight: 600; }
        .mc-who small { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; font-size: 0.8rem; color: ${C.sub}; margin-top: 1px; }
        .mc-ava { width: 36px; height: 36px; border-radius: 50%; background: #EEF1F6; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; flex-shrink: 0; }
        .mc-tag { font-style: normal; font-size: 0.7rem; font-weight: 600; padding: 1px 7px; border-radius: 999px; background: #F5F5F7; color: ${C.sub}; }
        .mc-tag.bd { background: #FBF3E4; color: #8A6516; }
        .mc-sub { color: ${C.sub}; font-variant-numeric: tabular-nums; }
        .mc-detail { padding: 0.2rem 0 1rem 48px; }
        .mc-actions { display: flex; gap: 0.5rem; margin-bottom: 0.9rem; flex-wrap: wrap; }
        .mc-actions a { height: 32px; padding: 0 0.85rem; display: inline-flex; align-items: center; border-radius: 9px; border: 1px solid ${C.border}; font-size: 0.82rem; font-weight: 500; color: ${C.text}; text-decoration: none; }
        .mc-actions a:hover { background: #f8fafc; }
        .mc-facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.8rem 1.5rem; }
        .mc-facts .wide { grid-column: 1 / -1; }
        .mc-facts small { display: block; font-size: 0.75rem; color: ${C.sub}; }
        .mc-facts span { font-size: 0.9rem; white-space: pre-wrap; }
        .mc-empty { padding: 2.5rem 0; text-align: center; color: ${C.sub}; font-size: 0.9rem; }
        @media (max-width: 900px) {
          .mc { padding: 1.25rem 1rem; }
          .mc-th { display: none; }
          .mc-tr { grid-template-columns: 1fr auto; }
          .mc-tr > span:nth-child(2), .mc-tr > span:nth-child(3), .mc-tr > span:nth-child(4) { display: none; }
          .mc-facts { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
    </div>
  );
}
