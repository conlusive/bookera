'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { api, type FinanceOverview } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';
import { notify } from '@/lib/feedback';

/**
 * «Фінанси та виплати».
 *
 * Завдатки клієнтів проходять через платформу: вона тримає їх до візиту, а потім виплачує закладу, ВИРАХУВАВШИ
 * комісію за нових клієнтів з вітрини. Окремо платити комісію не треба: тут видно, скільки саме вирахується.
 * Усі числа рахує сервер (app/services/deposits.py), тут нічого не виводиться з клієнтських обчислень.
 */
const uah = (n: number) => `${(Math.round(n * 100) / 100).toLocaleString('uk-UA')} ₴`;
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

export default function FinancePanel({ businessId }: { businessId: number }) {
  const [data, setData] = useState<FinanceOverview | null>(null);
  const [error, setError] = useState('');
  const [method, setMethod] = useState<'card' | 'iban'>('card');
  const [value, setValue] = useState('');
  const [holder, setHolder] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.getFinance(await getAuthToken(), businessId);
      setData(res);
      setError('');
      if (res.payout_details?.method) setMethod(res.payout_details.method);
      if (res.payout_details?.holder) setHolder(res.payout_details.holder);
    } catch (err: any) {
      setError(err?.message || 'Не вдалося завантажити фінанси');
    }
  }, [businessId]);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api.setPayoutDetails(await getAuthToken(), businessId, { method, value, holder });
      setValue('');
      setEditing(false);
      notify('Реквізити збережено', 'info');
      await load();
    } catch (err: any) {
      notify(err?.message || 'Не вдалося зберегти реквізити', 'error');
    } finally {
      setSaving(false);
    }
  };

  const box: React.CSSProperties = { background: '#fff', border: '1px solid #e5e5ea', borderRadius: 16, padding: '1.25rem 1.5rem' };
  const label: React.CSSProperties = { fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#86868b' };
  const big: React.CSSProperties = { fontSize: '1.6rem', fontWeight: 800, color: '#1d1d1f', letterSpacing: '-0.5px', marginTop: 4 };
  const btn: React.CSSProperties = { height: 38, padding: '0 1rem', borderRadius: 10, border: 'none', background: '#1d1d1f', color: '#fff', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' };
  const btnGhost: React.CSSProperties = { ...btn, background: '#f5f5f7', color: '#1d1d1f' };
  const note: React.CSSProperties = { fontSize: '0.8rem', color: '#6e6e73', marginTop: 4, lineHeight: 1.45 };

  if (error) return <div style={box}><b>Фінанси</b><p style={{ color: '#86868b' }}>{error}</p></div>;
  if (!data) return <div style={{ ...box, color: '#86868b' }}>Завантаження…</div>;

  const details = data.payout_details;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 850 }}>
      <p style={{ margin: 0, color: '#6e6e73', fontSize: '0.9rem', lineHeight: 1.5 }}>
        Завдатки клієнтів приходять на платформу й тримаються до візиту. Після візиту платформа виплачує їх вам,
        автоматично вирахувавши комісію за нових клієнтів з вітрини — окремо платити її не треба.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem' }}>
        <div style={box}><div style={label}>Тримається до візиту</div><div style={big}>{uah(data.on_hold)}</div><div style={note}>Завдатки за майбутні візити</div></div>
        <div style={box}><div style={label}>Готово до виплати</div><div style={big}>{uah(data.ready_gross)}</div><div style={note}>За візити, що відбулися</div></div>
        <div style={box}>
          <div style={label}>Комісія вирахується</div><div style={big}>{uah(data.will_deduct)}</div>
          <div style={note}>{data.commission_owed > 0 ? `Накопичено ${uah(data.commission_owed)}${data.commission_owed > data.will_deduct ? '; решта вирахується з наступних виплат або з оплати підписки' : ''}` : 'Боргу немає'}</div>
        </div>
        <div style={{ ...box, borderColor: '#436b49' }}><div style={label}>Найближча виплата</div><div style={{ ...big, color: '#436b49' }}>{uah(data.next_payout)}</div><div style={note}>Виплати формуються щопонеділка від {uah(data.min_payout)}</div></div>
      </div>

      <div style={box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <b style={{ color: '#1d1d1f' }}>Реквізити для виплат</b>
            <div style={note}>
              {details?.masked ? <>{details.method === 'card' ? 'Картка' : 'IBAN'} <b>{details.masked}</b>{details.holder ? `, ${details.holder}` : ''}</> : 'Без реквізитів виплати не формуються: гроші чекатимуть, поки ви їх додасте.'}
            </div>
          </div>
          {!editing && <button type="button" style={btnGhost} onClick={() => setEditing(true)}>{details ? 'Змінити' : 'Додати реквізити'}</button>}
        </div>
        {editing && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
            <select className="setting-input" value={method} onChange={e => setMethod(e.target.value as 'card' | 'iban')}>
              <option value="card">Банківська картка</option>
              <option value="iban">IBAN</option>
            </select>
            <input className="setting-input" inputMode={method === 'card' ? 'numeric' : 'text'} placeholder={method === 'card' ? '0000 0000 0000 0000' : 'UA00 0000 0000 0000 0000 0000 0000 0'} value={value} onChange={e => setValue(e.target.value)} />
            <input className="setting-input" placeholder="Імʼя власника" value={holder} onChange={e => setHolder(e.target.value)} />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" style={{ ...btn, opacity: saving || !value.trim() ? 0.5 : 1 }} disabled={saving || !value.trim()} onClick={() => void save()}>{saving ? 'Зберігаємо…' : 'Зберегти'}</button>
              <button type="button" style={btnGhost} onClick={() => { setEditing(false); setValue(''); }}>Скасувати</button>
            </div>
          </div>
        )}
      </div>

      <div style={box}>
        <b style={{ color: '#1d1d1f' }}>Історія виплат</b>
        {data.payouts.length === 0 ? (
          <div style={note}>Виплат ще не було.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.75rem', fontSize: '0.85rem' }}>
            <thead><tr style={{ textAlign: 'left', color: '#86868b' }}><th style={{ padding: '0.4rem 0' }}>Дата</th><th>Завдатки</th><th>Комісія</th><th style={{ textAlign: 'right' }}>До виплати</th><th style={{ textAlign: 'right' }}>Статус</th></tr></thead>
            <tbody style={{ color: '#1d1d1f' }}>
              {data.payouts.map(p => (
                <tr key={p.id} style={{ borderTop: '1px solid #f1f1f4' }}>
                  <td style={{ padding: '0.6rem 0' }}>{date(p.created_at)}</td>
                  <td>{uah(p.gross)}</td>
                  <td>{p.commission_offset > 0 ? `−${uah(p.commission_offset)}` : '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{uah(p.amount)}</td>
                  <td style={{ textAlign: 'right', color: p.status === 'paid' ? '#34c759' : '#ff9500', fontWeight: 600 }}>{p.status === 'paid' ? 'Виплачено' : 'Готується'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
