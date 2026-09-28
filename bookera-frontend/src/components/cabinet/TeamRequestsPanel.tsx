'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';

/**
 * Запити команди - вгорі «Команди», лише коли є що розглянути.
 *
 * Погоджене застосовується одразу: графік стає графіком майстра,
 * відпустка закриває дні для запису. Записи клієнтів, що потрапили у
 * відпустку, показуємо ДО рішення - щоб власник знав, кого переносити.
 */

const C = { text: '#0f172a', sub: '#64748b', border: '#e2e8f0' };
const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const REASON: Record<string, string> = { vacation: 'Відпустка', sick: 'Лікарняний', other: 'Особисті справи' };
const d = (iso: string) => { const x = new Date(`${iso.slice(0, 10)}T12:00:00`); return `${x.getDate()} ${MONTHS_GEN[x.getMonth()]}`; };
const dt = (iso: string) => { const x = new Date(iso); return `${d(iso)}, ${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`; };

const SECTION_LABEL: Record<string, string> = {
  services: 'Послуги й ціни', clients: 'Всі клієнти салону', inventory: 'Склад і витрати', analytics: 'Аналітика й маркетинг',
};

const describe = (r: any) => {
  if (r.kind === 'schedule') {
    return `Зміна графіка: ${(r.payload.shifts || []).filter((s: any) => s.active).map((s: any) => `${s.day.slice(0, 2)} ${s.start}–${s.end}`).join(', ') || 'усі дні вихідні'}`;
  }
  if (r.kind === 'access') {
    const parts = (r.payload.sections || []).map((s: string) => SECTION_LABEL[s] || s);
    if (r.payload.role === 'admin') parts.unshift('підвищення до адміністратора');
    return `Доступ: ${parts.join(', ')}`;
  }
  return `${REASON[r.payload.reason] || 'Відпустка'}: ${r.payload.date_from === r.payload.date_to ? d(r.payload.date_from) : `${d(r.payload.date_from)} – ${d(r.payload.date_to)}`}`;
};

export default function TeamRequestsPanel({ businessId, isOwner = false, onDecided }: { businessId: number; isOwner?: boolean; onDecided?: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [result, setResult] = useState<{ text: string; conflicts: any[] } | null>(null);

  const load = useCallback(async () => {
    const t = await getAuthToken();
    setItems(await api.listStaffRequests(t, businessId).catch(() => []));
  }, [businessId]);
  useEffect(() => { void load(); }, [load]);

  const escalate = async (r: any) => {
    setBusy(r.id);
    try {
      const t = await getAuthToken();
      await api.escalateStaffRequest(t, businessId, r.id, notes[r.id]?.trim() || undefined);
      setResult({ text: `${r.staff_name}: передано власнику.`, conflicts: [] });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const decide = async (r: any, approve: boolean) => {
    setBusy(r.id);
    try {
      const t = await getAuthToken();
      const res = await api.decideStaffRequest(t, businessId, r.id, approve, notes[r.id]?.trim() || undefined);
      setResult({
        text: `${r.staff_name}: ${approve ? 'погоджено' : 'відхилено'}. Майстер отримає лист.`,
        conflicts: approve ? res.conflicts || [] : [],
      });
      await load();
      onDecided?.();
    } finally {
      setBusy(null);
    }
  };

  if (!items.length && !result) return null;

  return (
    <section className="tr">
      {items.length > 0 && (
        <>
          <div className="tr-title">Запити команди <span>{items.length}</span></div>
          {items.map(r => (
            <div key={r.id} className="tr-item">
              <div className="tr-main">
                <b>{r.staff_name}</b>
                <span className="tr-what">{describe(r)}</span>
                {/* Власникові - що запит передав адміністратор і чому */}
                {isOwner && r.stage === 'owner' && typeof r.escalation_note === 'string' && (
                  <span className="tr-esc">Передав адміністратор{r.escalation_note ? `: «${r.escalation_note}»` : ''}</span>
                )}
                {r.comment && <span className="tr-quote">«{r.comment}»</span>}
                {r.conflicts?.length > 0 && (
                  <span className="tr-warn">
                    На ці дні вже {r.conflicts.length === 1 ? 'є запис' : `є ${r.conflicts.length} записи`}: {r.conflicts.slice(0, 3).map((c: any) => `${c.client_name || 'клієнт'} (${dt(c.start_time)})`).join(', ')}
                    {r.conflicts.length > 3 ? '…' : ''}. Після погодження їх треба буде перенести.
                  </span>
                )}
                <input className="tr-note" value={notes[r.id] || ''} onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value.slice(0, 500) }))} placeholder={isOwner ? "Коментар (необовʼязково)" : "Коментар майстрові чи власнику (необовʼязково)"} />
              </div>
              <div className="tr-actions">
                {/* Адміністратор може передати власнику те, що йому не вирішити */}
                {!isOwner && r.stage === 'admin' && (
                  <button type="button" className="tr-btn ghost" disabled={busy === r.id} onClick={() => void escalate(r)}>Передати власнику</button>
                )}
                <button type="button" className="tr-btn ghost" disabled={busy === r.id} onClick={() => void decide(r, false)}>Відхилити</button>
                <button type="button" className="tr-btn" disabled={busy === r.id} onClick={() => void decide(r, true)}>Погодити</button>
              </div>
            </div>
          ))}
        </>
      )}
      {result && (
        <div className="tr-result">
          <span>{result.text}</span>
          {result.conflicts.length > 0 && (
            <span className="tr-warn">Перенесіть у календарі: {result.conflicts.map((c: any) => `${c.client_name || 'клієнт'} (${dt(c.start_time)})`).join(', ')}.</span>
          )}
          <button type="button" className="tr-link" onClick={() => setResult(null)}>Зрозуміло</button>
        </div>
      )}

      <style jsx>{`
        .tr { border: 1px solid ${C.border}; border-radius: 16px; padding: 1.1rem 1.3rem; margin-bottom: 1.5rem; background: #fff; color: ${C.text}; }
        .tr-title { font-size: 1.05rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; }
        .tr-title span { font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: #FBF3E4; color: #8A6516; }
        .tr-item { display: flex; justify-content: space-between; gap: 1.25rem; padding: 0.9rem 0; border-top: 1px solid #f1f5f9; }
        .tr-title + .tr-item { border-top: none; }
        .tr-main { display: flex; flex-direction: column; gap: 0.3rem; min-width: 0; flex: 1; }
        .tr-main b { font-size: 0.95rem; }
        .tr-what { font-size: 0.875rem; color: ${C.text}; }
        .tr-esc { font-size: 0.82rem; color: #3730a3; background: #eef2ff; border-radius: 8px; padding: 0.4rem 0.6rem; }
        .tr-quote { font-size: 0.85rem; color: ${C.sub}; font-style: italic; }
        .tr-warn { font-size: 0.82rem; color: #8A6516; background: #FBF7EE; border-radius: 8px; padding: 0.45rem 0.6rem; line-height: 1.45; }
        .tr-note { margin-top: 0.3rem; height: 34px; padding: 0 0.7rem; border-radius: 9px; border: 1px solid ${C.border}; font-family: inherit; font-size: 0.85rem; outline: none; max-width: 420px; }
        .tr-note:focus { border-color: ${C.text}; }
        .tr-actions { display: flex; gap: 0.5rem; align-items: flex-start; flex-shrink: 0; }
        .tr-btn { height: 36px; padding: 0 1rem; border-radius: 10px; border: none; background: ${C.text}; color: #fff; font-family: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
        .tr-btn.ghost { background: #fff; color: ${C.text}; border: 1px solid ${C.border}; }
        .tr-btn:disabled { opacity: .45; }
        .tr-result { display: flex; flex-direction: column; gap: 0.4rem; padding-top: 0.6rem; font-size: 0.9rem; }
        .tr-link { align-self: flex-start; border: none; background: none; padding: 0; color: ${C.sub}; font-family: inherit; font-weight: 600; font-size: 0.85rem; cursor: pointer; }
        @media (max-width: 760px) { .tr-item { flex-direction: column; } }
      `}</style>
    </section>
  );
}
