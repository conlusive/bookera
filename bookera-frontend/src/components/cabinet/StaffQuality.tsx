'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';

/**
 * «Якість» - вкладка в картці майстра («Команда»).
 *
 * Оцінка 0-100 з трьох речей, які клієнт показує поведінкою:
 * рейтинг відгуків (50%), повернення клієнтів (35%), частка візитів із
 * чайовими (15%). Поруч - порівняння з рештою команди й відгуки з
 * можливістю відповісти. Палітра - як у «Команді».
 */

const C = { text: '#0f172a', sub: '#64748b', border: '#e2e8f0', soft: '#f8fafc' };
const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const pct = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const money = (n: number) => `${Math.round(n).toLocaleString('uk-UA')} ₴`;
const dateOf = (iso?: string | null) => { if (!iso) return ''; const d = new Date(iso); return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`; };

function tone(score: number | null) {
  if (score == null) return { color: '#94a3b8', bg: '#f1f5f9', label: 'Мало даних' };
  if (score >= 80) return { color: '#059669', bg: '#ecfdf5', label: 'Відмінно' };
  if (score >= 60) return { color: '#d97706', bg: '#fffbeb', label: 'Добре' };
  return { color: '#dc2626', bg: '#fef2f2', label: 'Є над чим працювати' };
}

function Compare({ mine, team, fmt }: { mine: number | null; team?: number | null; fmt: (v: number) => string }) {
  if (team == null || mine == null) return null;
  const diff = mine - team;
  const same = Math.abs(diff) < 0.005 * (Math.abs(team) || 1);
  return (
    <span className="sq-cmp" style={{ color: same ? C.sub : diff > 0 ? '#059669' : '#dc2626' }}>
      {same ? 'як у команді' : `${diff > 0 ? '↑' : '↓'} команда ${fmt(team)}`}
    </span>
  );
}

export default function StaffQuality({ businessId, staffId, canReply = true }: { businessId: number; staffId: string; canReply?: boolean }) {
  const [days, setDays] = useState(90);
  const [q, setQ] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'low' | 'comment' | 'noreply'>('all');
  const [replying, setReplying] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setQ(null);
    const t = await getAuthToken();
    setQ(await api.getStaffQuality(t, businessId, staffId, days).catch(() => ({ error: true })));
  }, [businessId, staffId, days]);
  useEffect(() => { void load(); }, [load]);

  const reviews = useMemo(() => (q?.reviews || []).filter((r: any) => {
    if (filter === 'low') return r.rating <= 3;
    if (filter === 'comment') return !!(r.comment || '').trim();
    if (filter === 'noreply') return !r.reply && !!(r.comment || '').trim();
    return true;
  }), [q, filter]);

  const sendReply = async (id: number) => {
    if (!replyText.trim()) return;
    setBusy(true);
    try {
      const t = await getAuthToken();
      await api.replyToReview(t, id, replyText.trim());
      setQ((prev: any) => ({ ...prev, reviews: prev.reviews.map((r: any) => (r.id === id ? { ...r, reply: replyText.trim() } : r)) }));
      setReplying(null); setReplyText('');
    } finally {
      setBusy(false);
    }
  };

  if (!q) return <div className="sq-empty">Рахуємо показники…</div>;
  if (q.error) return <div className="sq-empty">Не вдалося завантажити показники.</div>;

  const t = tone(q.score);
  const dist = q.rating.distribution || {};
  const maxDist = Math.max(1, ...Object.values(dist).map(Number));
  const lowCount = (q.reviews || []).filter((r: any) => r.rating <= 3).length;
  const noReply = (q.reviews || []).filter((r: any) => !r.reply && (r.comment || '').trim()).length;

  return (
    <div className="sq">
      {/* Оцінка */}
      <div className="sq-head">
        <div className="sq-ring" style={{ ['--p' as string]: `${q.score ?? 0}`, ['--c' as string]: t.color }}>
          <span>{q.score ?? '—'}</span>
        </div>
        <div className="sq-head-text">
          <div className="sq-label" style={{ background: t.bg, color: t.color }}>{t.label}</div>
          <h3>Якість роботи</h3>
          <p>
            {q.enough_data
              ? <>За {days} днів · {q.visits} завершених візитів{q.rank ? <> · <b>{q.rank}-е місце</b> із {q.ranked_of} у команді</> : null}</>
              : <>Оцінка зʼявиться після {q.min_visits} завершених візитів за період — зараз {q.visits}.</>}
          </p>
        </div>
        <div className="sq-period">
          {[30, 90, 180].map(d => (
            <button key={d} type="button" className={days === d ? 'on' : ''} onClick={() => setDays(d)}>{d} днів</button>
          ))}
        </div>
      </div>

      {/* Три складові */}
      <div className="sq-cards">
        <div className="sq-card">
          <div className="sq-card-l">Рейтинг відгуків <em>50%</em></div>
          <div className="sq-card-v">{q.rating.avg != null ? <>{q.rating.avg.toFixed(1)} <small>★</small></> : '—'}</div>
          <div className="sq-card-s">{q.rating.count ? `${q.rating.count} відгуків` : 'відгуків ще немає'} <Compare mine={q.rating.avg} team={q.team?.rating} fmt={v => v.toFixed(1)} /></div>
          {q.rating.count > 0 && (
            <div className="sq-dist">
              {[5, 4, 3, 2, 1].map(s => (
                <div key={s} className="sq-dist-row">
                  <span>{s}</span>
                  <i><b style={{ width: `${(Number(dist[s] || 0) / maxDist) * 100}%`, background: s >= 4 ? '#10b981' : s === 3 ? '#f59e0b' : '#ef4444' }} /></i>
                  <span className="n">{dist[s] || 0}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="sq-card">
          <div className="sq-card-l">Повертаються <em>35%</em></div>
          <div className="sq-card-v">{pct(q.retention.rate)}</div>
          <div className="sq-card-s">
            {q.retention.eligible
              ? `${q.retention.returned} з ${q.retention.eligible} клієнтів прийшли знову протягом ${q.retention.window_days} днів`
              : `Мало даних: рахуємо клієнтів, у яких минуло ${q.retention.window_days} днів після візиту`}
            {' '}<Compare mine={q.retention.rate} team={q.team?.retention} fmt={v => pct(v)} />
          </div>
          <div className="sq-bar"><b style={{ width: `${Math.round((q.retention.rate || 0) * 100)}%` }} /></div>
        </div>

        <div className="sq-card">
          <div className="sq-card-l">Чайові <em>15%</em></div>
          <div className="sq-card-v">{pct(q.tips.share)}</div>
          <div className="sq-card-s">
            {q.tips.count ? `${q.tips.count} візитів із чайовими · разом ${money(q.tips.total)} · в середньому ${money(q.tips.avg)}` : 'Чайових за період не записано'}
            {' '}<Compare mine={q.tips.share} team={q.team?.tips_share} fmt={v => pct(v)} />
          </div>
          <div className="sq-bar"><b style={{ width: `${Math.round((q.tips.share || 0) * 100)}%`, background: '#8b5cf6' }} /></div>
        </div>
      </div>

      <div className="sq-extra">
        <span>Не прийшли: <b>{pct(q.no_show_rate)}</b></span>
        <span>Скасовані: <b>{pct(q.cancel_rate)}</b></span>
        <span className="sq-hint">Чайові записуються в картці завершеного візиту в календарі.</span>
      </div>

      {/* Відгуки */}
      <div className="sq-rev-head">
        <h4>Відгуки клієнтів</h4>
        <div className="sq-chips">
          {([
            ['all', `Усі ${q.reviews?.length || 0}`],
            ['low', `Низькі ${lowCount}`],
            ['comment', 'З коментарем'],
            ['noreply', `Без відповіді ${noReply}`],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="sq-reviews">
        {reviews.length === 0 ? (
          <div className="sq-empty" style={{ padding: '1.5rem 0' }}>{q.reviews?.length ? 'Нічого за цим фільтром.' : 'Відгуків ще немає.'}</div>
        ) : reviews.map((r: any) => (
          <div key={r.id} className={`sq-rev ${r.rating <= 3 ? 'low' : ''}`}>
            <div className="sq-rev-top">
              <span className="sq-stars">{'★★★★★'.slice(0, r.rating)}<i>{'★★★★★'.slice(r.rating)}</i></span>
              <b>{r.author || 'Клієнт'}</b>
              <span className="sq-rev-meta">{[r.service, dateOf(r.created_at)].filter(Boolean).join(' · ')}</span>
            </div>
            {r.comment && <p className="sq-rev-text">{r.comment}</p>}
            {r.reply ? (
              <div className="sq-reply"><span>Відповідь закладу</span>{r.reply}</div>
            ) : canReply && (r.comment || '').trim() && (
              replying === r.id ? (
                <div className="sq-reply-form">
                  <textarea value={replyText} onChange={e => setReplyText(e.target.value.slice(0, 500))} placeholder="Подякуйте або поясніть, що зміните" autoFocus />
                  <div>
                    <button type="button" className="ghost" onClick={() => { setReplying(null); setReplyText(''); }}>Скасувати</button>
                    <button type="button" disabled={busy || !replyText.trim()} onClick={() => void sendReply(r.id)}>{busy ? 'Надсилаємо…' : 'Відповісти'}</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="sq-link" onClick={() => { setReplying(r.id); setReplyText(''); }}>Відповісти</button>
              )
            )}
          </div>
        ))}
      </div>

      <style jsx>{`
        .sq { color: ${C.text}; }
        .sq-empty { padding: 2.5rem 0; text-align: center; color: ${C.sub}; font-size: 0.9rem; }
        .sq-head { display: flex; align-items: center; gap: 1.25rem; padding: 1.25rem 1.4rem; border: 1px solid ${C.border}; border-radius: 16px; background: #fff; flex-wrap: wrap; }
        .sq-ring { width: 78px; height: 78px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
          background: radial-gradient(closest-side, #fff 78%, transparent 80% 100%), conic-gradient(var(--c) calc(var(--p) * 1%), #f1f5f9 0); }
        .sq-ring span { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
        .sq-head-text { flex: 1; min-width: 220px; }
        .sq-label { display: inline-block; font-size: 0.72rem; font-weight: 700; padding: 2px 9px; border-radius: 999px; }
        .sq-head-text h3 { font-size: 1.1rem; font-weight: 800; margin: 0.35rem 0 0.15rem; }
        .sq-head-text p { font-size: 0.85rem; color: ${C.sub}; margin: 0; }
        .sq-head-text p b { color: ${C.text}; }
        .sq-period { display: flex; background: #f1f5f9; border-radius: 10px; padding: 3px; }
        .sq-period button { border: none; background: transparent; padding: 6px 11px; border-radius: 8px; font-family: inherit; font-size: 0.8rem; cursor: pointer; color: ${C.text}; }
        .sq-period button.on { background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.1); font-weight: 600; }

        .sq-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.9rem; margin-top: 0.9rem; }
        .sq-card { border: 1px solid ${C.border}; border-radius: 16px; padding: 1rem 1.1rem; background: #fff; display: flex; flex-direction: column; gap: 0.3rem; }
        .sq-card-l { font-size: 0.8rem; color: ${C.sub}; font-weight: 600; }
        .sq-card-l em { font-style: normal; font-weight: 500; color: #94a3b8; margin-left: 0.3rem; }
        .sq-card-v { font-size: 1.7rem; font-weight: 800; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
        .sq-card-v small { font-size: 1.1rem; color: #f59e0b; }
        .sq-card-s { font-size: 0.8rem; color: ${C.sub}; line-height: 1.45; }
        .sq-cmp { font-weight: 600; white-space: nowrap; }
        .sq-bar { height: 6px; border-radius: 3px; background: #f1f5f9; overflow: hidden; margin-top: auto; }
        .sq-bar b { display: block; height: 100%; background: #10b981; border-radius: 3px; }
        .sq-dist { display: flex; flex-direction: column; gap: 3px; margin-top: 0.3rem; }
        .sq-dist-row { display: grid; grid-template-columns: 10px 1fr 18px; gap: 6px; align-items: center; font-size: 0.72rem; color: ${C.sub}; }
        .sq-dist-row i { height: 5px; border-radius: 3px; background: #f1f5f9; overflow: hidden; }
        .sq-dist-row i b { display: block; height: 100%; border-radius: 3px; }
        .sq-dist-row .n { text-align: right; font-variant-numeric: tabular-nums; }

        .sq-extra { display: flex; gap: 1.25rem; flex-wrap: wrap; font-size: 0.82rem; color: ${C.sub}; padding: 0.8rem 0.2rem 0; }
        .sq-extra b { color: ${C.text}; }
        .sq-hint { margin-left: auto; font-style: italic; }

        .sq-rev-head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin: 1.5rem 0 0.7rem; flex-wrap: wrap; }
        .sq-rev-head h4 { font-size: 1.05rem; font-weight: 800; margin: 0; }
        .sq-chips { display: flex; gap: 0.35rem; flex-wrap: wrap; }
        .sq-chips button { height: 30px; padding: 0 0.8rem; border-radius: 999px; border: 1px solid ${C.border}; background: #fff; font-family: inherit; font-size: 0.8rem; cursor: pointer; color: ${C.text}; }
        .sq-chips button.on { background: ${C.text}; border-color: ${C.text}; color: #fff; }
        .sq-reviews { border: 1px solid ${C.border}; border-radius: 16px; background: #fff; padding: 0 1.1rem; }
        .sq-rev { padding: 0.95rem 0; border-top: 1px solid #f1f5f9; }
        .sq-rev:first-child { border-top: none; }
        .sq-rev.low { box-shadow: inset 3px 0 0 #fca5a5; padding-left: 0.8rem; margin-left: -0.8rem; }
        .sq-rev-top { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; font-size: 0.875rem; }
        .sq-stars { color: #f59e0b; letter-spacing: 1px; }
        .sq-stars i { font-style: normal; color: #e2e8f0; }
        .sq-rev-meta { font-size: 0.78rem; color: ${C.sub}; margin-left: auto; }
        .sq-rev-text { font-size: 0.9rem; line-height: 1.5; margin: 0.45rem 0 0; color: #334155; }
        .sq-reply { margin-top: 0.6rem; padding: 0.6rem 0.8rem; border-radius: 10px; background: ${C.soft}; font-size: 0.85rem; color: #334155; }
        .sq-reply span { display: block; font-size: 0.72rem; font-weight: 700; color: ${C.sub}; margin-bottom: 2px; }
        .sq-link { margin-top: 0.4rem; border: none; background: none; padding: 0; font-family: inherit; font-size: 0.82rem; font-weight: 600; color: #436b49; cursor: pointer; }
        .sq-reply-form { margin-top: 0.6rem; }
        .sq-reply-form textarea { width: 100%; box-sizing: border-box; height: 72px; resize: none; padding: 0.6rem 0.75rem; border-radius: 10px; border: 1px solid ${C.border}; font-family: inherit; font-size: 0.875rem; outline: none; }
        .sq-reply-form textarea:focus { border-color: ${C.text}; }
        .sq-reply-form div { display: flex; justify-content: flex-end; gap: 0.4rem; margin-top: 0.4rem; }
        .sq-reply-form button { height: 32px; padding: 0 0.9rem; border-radius: 9px; border: none; background: ${C.text}; color: #fff; font-family: inherit; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
        .sq-reply-form button.ghost { background: #fff; color: ${C.text}; border: 1px solid ${C.border}; }
        .sq-reply-form button:disabled { opacity: .45; }
        @media (max-width: 900px) { .sq-cards { grid-template-columns: 1fr; } .sq-hint { margin-left: 0; } }
      `}</style>
    </div>
  );
}
