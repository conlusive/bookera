'use client';

import { useEffect, useState } from 'react';
import FormModal, { FormSection } from '@/components/ui/FormModal';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';
import { actionError } from '@/lib/feedback';

/**
 * Дублі клієнтів - картки з тим самим номером чи поштою. Для кожної групи:
 * основна картка (за замовчуванням - де найбільше візитів) і «Обʼєднати».
 * Записи, сімейні звʼязки й бали дублів переходять в основну.
 */
type Group = Awaited<ReturnType<typeof api.getClientDuplicates>>[number];

export default function ClientDuplicatesModal({ open, onClose, businessId, onChanged }: {
  open: boolean; onClose: () => void; businessId: number; onChanged: () => void;
}) {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [keep, setKeep] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setGroups(null);
    void getAuthToken().then(t => api.getClientDuplicates(t, businessId)).then(g => {
      setGroups(g);
      setKeep(Object.fromEntries(g.map((grp, i) => [i, grp[0].id])));
    }).catch(() => setGroups([]));
  }, [open, businessId]);

  const merge = async (i: number) => {
    const grp = groups?.[i]; if (!grp) return;
    const main = keep[i] ?? grp[0].id;
    setBusy(i);
    try {
      await api.mergeClients(await getAuthToken(), main, grp.filter(c => c.id !== main).map(c => c.id));
      setGroups(g => (g || []).filter((_, k) => k !== i));
      setKeep(k => Object.fromEntries(Object.entries(k).filter(([key]) => Number(key) !== i).map(([key, v]) => [Number(key) > i ? Number(key) - 1 : Number(key), v])));
      onChanged();
    } catch (e: any) {
      actionError(e?.message || 'Не вдалося обʼєднати');
    } finally {
      setBusy(null);
    }
  };

  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

  return (
    <FormModal open={open} onClose={onClose} title="Дублі клієнтів" width={600}
      subtitle="Картки з тим самим номером чи поштою. Обʼєднайте — і візити зберуться в одній."
      primary={{ label: 'Готово', onClick: onClose }}>
      <FormSection>
        {groups === null ? (
          <div className="cd-empty">Шукаємо дублі…</div>
        ) : groups.length === 0 ? (
          <div className="cd-empty ok"><b>Дублів немає</b><span>Кожен клієнт — в одній картці.</span></div>
        ) : groups.map((grp, i) => (
          <div key={grp.map(c => c.id).join('-')} className="cd-group">
            <div className="cd-cap">Залишити основною:</div>
            {grp.map(c => (
              <label key={c.id} className={`cd-card ${keep[i] === c.id ? 'on' : ''}`}>
                <input type="radio" name={`keep-${i}`} checked={keep[i] === c.id} onChange={() => setKeep(k => ({ ...k, [i]: c.id }))} />
                <span className="cd-main">
                  <b>{c.name}</b>
                  <small>{[c.phone, c.email].filter(Boolean).join(' · ') || 'без контактів'}</small>
                </span>
                <span className="cd-stat">
                  <b>{c.visits_count} {c.visits_count === 1 ? 'візит' : c.visits_count >= 2 && c.visits_count <= 4 ? 'візити' : 'візитів'}</b>
                  <small>{c.created_at ? `з ${fmt(c.created_at)}` : ''}</small>
                </span>
              </label>
            ))}
            <div className="cd-foot">
              <span>Решта {grp.length - 1 === 1 ? 'картка зникне' : 'картки зникнуть'}, а її записи, звʼязки й депозит перейдуть в основну.</span>
              <button type="button" disabled={busy !== null} onClick={() => void merge(i)}>{busy === i ? 'Обʼєднуємо…' : 'Обʼєднати'}</button>
            </div>
          </div>
        ))}
      </FormSection>
      <style jsx>{`
        .cd-empty { text-align: center; padding: 1.5rem 0; color: #64748b; font-size: 0.9rem; display: flex; flex-direction: column; gap: 0.3rem; }
        .cd-empty.ok b { color: #059669; font-size: 1.05rem; }
        .cd-group { border: 1px solid #e2e8f0; border-radius: 14px; padding: 0.9rem; display: flex; flex-direction: column; gap: 0.45rem; }
        .cd-cap { font-size: 0.7rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
        .cd-card { display: grid; grid-template-columns: 18px 1fr auto; gap: 0.7rem; align-items: center; padding: 0.65rem 0.8rem; border-radius: 10px; border: 1.5px solid #e2e8f0; cursor: pointer; transition: all .15s; }
        .cd-card.on { border-color: #0f172a; background: #f8fafc; }
        .cd-card input { accent-color: #0f172a; margin: 0; }
        .cd-main b, .cd-stat b { display: block; font-size: 0.9rem; color: #0f172a; font-weight: 600; }
        .cd-main small, .cd-stat small { display: block; font-size: 0.75rem; color: #64748b; }
        .cd-stat { text-align: right; }
        .cd-foot { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-top: 0.2rem; }
        .cd-foot span { font-size: 0.78rem; color: #64748b; line-height: 1.4; }
        .cd-foot button { height: 36px; padding: 0 1rem; border-radius: 10px; border: none; background: #0f172a; color: #fff; font-family: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
        .cd-foot button:disabled { opacity: .5; cursor: default; }
      `}</style>
    </FormModal>
  );
}
