'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';

/**
 * Роль і доступи людини - у картці майстра, вкладка «Доступ та Безпека».
 *
 * Змінює лише власник. Адміністратор бачить, але не змінює: інакше він
 * міг би підвищити когось, зокрема себе, до власних прав. Стиль - як у
 * решті «Команди»: сіро-синя палітра, перемикачі #10b981.
 */

const C = { text: '#0f172a', sub: '#64748b', border: '#e2e8f0', blue: '#436b49', green: '#10b981' };
const SECTIONS = [
  { id: 'services', title: 'Послуги й ціни', text: 'Додавати й змінювати послуги, ціни, матеріали' },
  { id: 'clients', title: 'Всі клієнти салону', text: 'Бачити всю базу, а не лише своїх клієнтів' },
  { id: 'inventory', title: 'Склад і витрати', text: 'Залишки матеріалів, витрати закладу' },
  { id: 'analytics', title: 'Аналітика й маркетинг', text: 'Звіти, розсилки, промо, сертифікати' },
];

export default function StaffAccessPanel({ businessId, staffId, onChanged }: { businessId: number; staffId: string; onChanged?: (role: string) => void }) {
  const [data, setData] = useState<{ role: string; sections: Record<string, boolean>; editable: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    void (async () => {
      const t = await getAuthToken();
      const r = await api.getStaffAccess(t, businessId, staffId).catch(() => null);
      if (alive) setData(r);
    })();
    return () => { alive = false; };
  }, [businessId, staffId]);

  const save = async (key: string, payload: { role?: 'master' | 'admin'; sections?: Record<string, boolean> }) => {
    if (!data?.editable) return;
    setBusy(key); setError('');
    try {
      const t = await getAuthToken();
      const r = await api.setStaffAccess(t, businessId, staffId, payload);
      setData(d => d && { ...d, role: r.role, sections: r.sections });
      if (payload.role) onChanged?.(r.role);
    } catch (e: any) {
      setError(e?.message || 'Не вдалося зберегти');
    } finally {
      setBusy(null);
    }
  };

  if (!data) return <div style={{ color: C.sub, fontSize: '0.9rem' }}>Завантаження доступів…</div>;
  if (data.role === 'owner') return null;

  return (
    <div className="sa">
      <div className="sa-head">
        <h3>Роль</h3>
        <p>{data.editable ? 'Визначає типові доступи. Нижче їх можна змінити окремо.' : 'Роль і доступи змінює власник закладу.'}</p>
      </div>
      <div className="sa-roles">
        {([
          { id: 'master', title: 'Майстер', text: 'Свій календар, свої клієнти, заробіток і запити.' },
          { id: 'admin', title: 'Адміністратор', text: 'Команда, запити майстрів і розділи закладу.' },
        ] as const).map(r => (
          <button key={r.id} type="button" disabled={!data.editable || busy !== null}
            className={`sa-role ${data.role === r.id ? 'on' : ''}`}
            onClick={() => data.role !== r.id && void save('role', { role: r.id })}>
            <span className="sa-radio" />
            <span><b>{r.title}</b><small>{r.text}</small></span>
          </button>
        ))}
      </div>

      <div className="sa-head" style={{ marginTop: '1rem' }}>
        <h3>Доступ до розділів</h3>
      </div>
      <div className="sa-list">
        {SECTIONS.map(s => {
          const on = !!data.sections[s.id];
          return (
            <div key={s.id} className="sa-row">
              <div><b>{s.title}</b><small>{s.text}</small></div>
              <button type="button" role="switch" aria-checked={on} aria-label={s.title}
                disabled={!data.editable || busy !== null}
                className={`sa-switch ${on ? 'on' : ''}`}
                onClick={() => void save(s.id, { sections: { [s.id]: !on } })}><i /></button>
            </div>
          );
        })}
      </div>
      {error && <div className="sa-err">{error}</div>}

      <style jsx>{`
        .sa { color: ${C.text}; }
        .sa-head h3 { font-size: 1.1rem; font-weight: 700; margin: 0 0 0.2rem; }
        .sa-head p { font-size: 0.88rem; color: ${C.sub}; margin: 0 0 0.65rem; }
        .sa-roles { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
        .sa-role { display: flex; gap: 0.65rem; align-items: flex-start; text-align: left; padding: 0.8rem 1rem; border-radius: 12px; border: 1.5px solid ${C.border}; background: #fff; cursor: pointer; font-family: inherit; }
        .sa-role:disabled { cursor: default; }
        .sa-role.on { border-color: ${C.blue}; background: #f2f7f3; }
        .sa-radio { width: 18px; height: 18px; border-radius: 50%; border: 2px solid #cbd5e1; flex-shrink: 0; margin-top: 2px; position: relative; }
        .sa-role.on .sa-radio { border-color: ${C.blue}; }
        .sa-role.on .sa-radio::after { content: ''; position: absolute; inset: 3px; border-radius: 50%; background: ${C.blue}; }
        .sa-role b { display: block; font-size: 0.95rem; }
        .sa-role small { display: block; font-size: 0.82rem; color: ${C.sub}; margin-top: 3px; line-height: 1.4; }
        .sa-list { border: 1px solid ${C.border}; border-radius: 12px; background: #fff; }
        .sa-row { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 0.7rem 1rem; border-top: 1px solid #f1f5f9; }
        .sa-row:first-child { border-top: none; }
        .sa-row b { display: block; font-size: 0.925rem; }
        .sa-row small { display: block; font-size: 0.82rem; color: ${C.sub}; margin-top: 2px; }
        .sa-switch { width: 40px; height: 22px; border-radius: 12px; border: none; background: #e2e8f0; position: relative; cursor: pointer; padding: 0; flex-shrink: 0; transition: background-color .2s; }
        .sa-switch:disabled { cursor: default; opacity: .7; }
        .sa-switch i { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.18); transition: left .2s; }
        .sa-switch.on { background: ${C.green}; }
        .sa-switch.on i { left: 20px; }
        .sa-err { color: #dc2626; font-size: 0.85rem; margin-top: 0.6rem; }
        @media (max-width: 640px) { .sa-roles { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
