'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getAuthTokenOrNull } from '@/lib/auth-token-client';

/**
 * Купівля подарункової картки закладу.
 *
 * Суми-пресети покривають більшість випадків одним дотиком; власна
 * сума - для решти. Межі 100-20 000 ₴ ті самі, що й на сервері.
 *
 * Після оплати людина потрапляє у «Бонуси та картки», де бачить код.
 * З тестовою оплатою це відбувається одразу; зі справжньою - спершу
 * сторінка оплати WayForPay.
 */
const PRESETS = [500, 1000, 2000];

export default function GiftCardModal({
  businessId,
  businessName,
  onClose,
  onNeedLogin,
  showToast,
}: {
  businessId: number;
  businessName: string;
  onClose: () => void;
  onNeedLogin: () => void;
  showToast: (msg: string, type?: any) => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState<number>(1000);
  const [custom, setCustom] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const value = custom ? Number(custom) : amount;
  const valid = Number.isFinite(value) && value >= 100 && value <= 20000;

  const submit = async () => {
    if (!valid || busy) return;
    const token = await getAuthTokenOrNull();
    if (!token) { onNeedLogin(); return; }

    setBusy(true);
    try {
      const res = await api.buyGiftCard(token, {
        business_id: businessId,
        amount: Math.round(value),
        recipient_name: recipientName.trim() || undefined,
        recipient_email: recipientEmail.trim() || undefined,
        message: message.trim() || undefined,
      });
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
        return;
      }
      showToast('Картку оплачено - код у «Бонуси та картки»', 'success');
      onClose();
      router.push('/account/profile?tab=wallet');
    } catch (err: any) {
      showToast(err?.message || 'Не вдалося оформити картку', 'error');
    } finally {
      setBusy(false);
    }
  };

  const field: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', height: '44px', padding: '0 0.85rem', borderRadius: '12px',
    border: '1px solid #E5E5EA', fontFamily: 'inherit', fontSize: '0.9rem', outline: 'none', background: '#fff',
  };

  return (
    <div onClick={() => !busy && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem' }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Подарункова картка"
        style={{ width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: '22px', padding: '1.75rem', boxShadow: '0 30px 60px -20px rgba(0,0,0,.35)' }}>
        <div style={{ fontSize: '1.3rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#1D1D1F' }}>Подарункова картка</div>
        <div style={{ fontSize: '0.9rem', color: '#86868B', marginTop: '0.25rem' }}>{businessName} · дійсна рік</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', margin: '1.4rem 0 0.6rem' }}>
          {PRESETS.map(p => {
            const on = !custom && amount === p;
            return (
              <button key={p} type="button" onClick={() => { setAmount(p); setCustom(''); }}
                style={{ height: '52px', borderRadius: '12px', border: on ? '2px solid #1D1D1F' : '1px solid #E5E5EA', background: on ? '#F5F5F7' : '#fff', fontFamily: 'inherit', fontSize: '1rem', fontWeight: 600, color: '#1D1D1F', cursor: 'pointer' }}>
                {p.toLocaleString('uk-UA')} ₴
              </button>
            );
          })}
        </div>
        <input value={custom} onChange={e => setCustom(e.target.value.replace(/\D/g, '').slice(0, 5))}
          inputMode="numeric" placeholder="Інша сума, ₴ (від 100 до 20 000)" style={field} />
        {custom && !valid && (
          <div style={{ fontSize: '0.78rem', color: '#B42318', marginTop: '0.35rem' }}>Сума від 100 до 20 000 ₴</div>
        )}

        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1D1D1F', margin: '1.2rem 0 0.5rem' }}>Кому (необовʼязково)</div>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <input value={recipientName} onChange={e => setRecipientName(e.target.value.slice(0, 80))} placeholder="Імʼя отримувача" style={field} />
          <input value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} type="email" placeholder="Пошта - картка зʼявиться в його профілі" style={field} />
          <textarea value={message} onChange={e => setMessage(e.target.value.slice(0, 300))} placeholder="Побажання" rows={2}
            style={{ ...field, height: 'auto', padding: '0.7rem 0.85rem', resize: 'vertical' }} />
        </div>

        <button type="button" onClick={() => void submit()} disabled={!valid || busy}
          style={{ width: '100%', height: '50px', marginTop: '1.4rem', borderRadius: '14px', border: 'none', background: '#1D1D1F', color: '#fff', fontFamily: 'inherit', fontSize: '1rem', fontWeight: 600, cursor: valid && !busy ? 'pointer' : 'default', opacity: valid && !busy ? 1 : 0.4 }}>
          {busy ? 'Оформлюємо…' : `Оплатити ${valid ? Math.round(value).toLocaleString('uk-UA') + ' ₴' : ''}`}
        </button>
      </div>
    </div>
  );
}
