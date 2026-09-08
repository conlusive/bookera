'use client';

import { useState } from 'react';
import { api, type SubscriptionState } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';
import { useToast } from '@/context/ToastContext';

/**
 * Екран для закладу без чинної підписки.
 *
 * Замість порожнього кабінету з незрозумілими помилками — пряма
 * відповідь: доступ завершився, ось кнопка оплати.
 *
 * Свідомо НЕ показуємо тут переваги тарифу й маркетингові тексти:
 * людина вже користувалась продуктом і знає, за що платить.
 * Переконувати її вдруге — марнувати її час у момент, коли вона
 * прийшла працювати.
 */
export default function SubscriptionExpired({
  businessId,
  businessName,
  subscription,
}: {
  businessId: number;
  businessName?: string;
  subscription: SubscriptionState | null;
}) {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const wasTrial = subscription?.is_trial || subscription?.status === 'trial';

  const handlePay = async () => {
    setIsLoading(true);
    try {
      const token = await getAuthToken();
      const checkout = await api.createSubscriptionCheckout(token, businessId);

      if (checkout.payment_url) {
        window.location.href = checkout.payment_url;
        return;
      }

      // Без ключів платіжного провайдера переходити нікуди. Кажемо про
      // це прямо, а не лишаємо людину дивитись на кнопку, яка нічого
      // не робить.
      showToast('Оплата ще не налаштована. Зверніться до підтримки.', 'error');
    } catch (err: any) {
      showToast(err?.message || 'Не вдалося створити платіж', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F2F4F2', padding: '2rem 1.5rem',
    }}>
      <div style={{
        width: '100%', maxWidth: '440px', background: '#fff',
        borderRadius: '18px', padding: '2.25rem 2rem', textAlign: 'center',
      }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px', background: '#F4FAF5',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '1.25rem', fontSize: '20px',
        }}>
          🔒
        </div>

        <h1 style={{
          fontSize: '1.35rem', fontWeight: 700, color: '#222222',
          margin: '0 0 0.6rem', letterSpacing: '-0.02em',
        }}>
          {wasTrial ? 'Пробний період завершився' : 'Підписка завершилась'}
        </h1>

        <p style={{ fontSize: '0.925rem', lineHeight: 1.55, color: '#5C6B5E', margin: '0 0 1.75rem' }}>
          {wasTrial
            ? 'Щоб продовжити роботу з кабінетом, оформіть підписку.'
            : 'Продовжіть підписку, щоб знову користуватись кабінетом.'}
          {' '}Дані закладу{businessName ? ` «${businessName}»` : ''} збережені.
        </p>

        <button
          onClick={handlePay}
          disabled={isLoading}
          style={{
            width: '100%', height: '46px', borderRadius: '12px', border: 'none',
            background: '#222222', color: '#fff', fontSize: '0.9375rem', fontWeight: 600,
            fontFamily: 'inherit', cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1, letterSpacing: '-0.01em',
          }}
        >
          {isLoading ? 'Готуємо оплату…' : 'Оформити підписку'}
        </button>

        {/* Онлайн-запис теж зупинено - про це треба сказати прямо.
            Власник має розуміти, що клієнти зараз не можуть записатись,
            і що це виправляється оплатою, а не зникне саме. */}
        <p style={{ fontSize: '0.8rem', lineHeight: 1.5, color: '#A5AEA3', margin: '1.25rem 0 0' }}>
          Поки підписка неактивна, клієнти не можуть записатись онлайн.
        </p>
      </div>
    </div>
  );
}
