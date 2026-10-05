'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

type Info = { business_name: string; email: string; unsubscribed: boolean };

/**
 * Відписка від розсилок закладу.
 *
 * На неї веде посилання «Відписатися» з кожного листа розсилки. Без входу:
 * доступ за підписаним токеном. Відписка - одним натисканням, з можливістю
 * одразу скасувати, якщо людина натиснула помилково.
 */
function UnsubscribeContent() {
  const token = useSearchParams()?.get('token') || '';
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setError('Посилання неповне. Скористайтесь тим, що в листі.'); setLoading(false); return; }
    void (async () => {
      try { setInfo(await api.getUnsubscribe(token)); }
      catch { setError('Посилання недійсне або застаріло.'); }
      finally { setLoading(false); }
    })();
  }, [token]);

  const toggle = async () => {
    setBusy(true);
    setError('');
    try { setInfo(await (info?.unsubscribed ? api.resubscribe(token) : api.unsubscribe(token))); }
    catch (err: any) { setError(err?.message || 'Не вдалося виконати дію. Спробуйте ще раз.'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.25rem' }}>
      <div style={{ width: '100%', maxWidth: 440, border: '1px solid #E8ECE8', borderRadius: 18, overflow: 'hidden' }}>
        <div style={{ height: 4, background: '#C2D8C4' }} />
        <div style={{ padding: '1.75rem' }}>
          {loading ? (
            <p style={{ color: '#6b7280' }}>Завантаження…</p>
          ) : !info ? (
            <>
              <h1 style={{ fontSize: '1.25rem', margin: '0 0 .5rem' }}>Не вдалося відкрити</h1>
              <p style={{ color: '#6b7280', margin: 0 }}>{error}</p>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: '1.25rem', margin: '0 0 .5rem' }}>
                {info.unsubscribed ? 'Ви відписались' : 'Відписатися від розсилок?'}
              </h1>
              <p style={{ color: '#6b7280', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
                {info.unsubscribed
                  ? <>Адреса <b>{info.email}</b> більше не отримуватиме розсилок від «{info.business_name}». Нагадування про ваші записи надходитимуть, як і раніше.</>
                  : <>Адреса <b>{info.email}</b> перестане отримувати розсилки від «{info.business_name}». Листи про ваші записи залишаться.</>}
              </p>
              <button
                type="button" onClick={toggle} disabled={busy}
                style={{
                  width: '100%', padding: '.8rem', borderRadius: 12, border: info.unsubscribed ? '1px solid #d1d5db' : 'none',
                  background: info.unsubscribed ? '#fff' : '#1a1a1a', color: info.unsubscribed ? '#1a1a1a' : '#fff',
                  fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? .6 : 1,
                }}
              >
                {busy ? '…' : info.unsubscribed ? 'Це помилка — підписатися знову' : 'Відписатися'}
              </button>
              {error && <p role="alert" style={{ color: '#b91c1c', margin: '.75rem 0 0', fontSize: '.9rem' }}>{error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return <Suspense fallback={null}><UnsubscribeContent /></Suspense>;
}
