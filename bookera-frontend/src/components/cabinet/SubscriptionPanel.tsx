'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, SubscriptionOverview } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';
import { goToCheckout } from '@/lib/checkout';
import { notify } from '@/lib/feedback';

const Check = ({ color = '#436b49' }: { color?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);

/**
 * Підписка в «Налаштуваннях» - справжні дані з сервера.
 *
 * Раніше тут була вигадана сторінка: форма «Номер картки / CVV», що нічого не
 * зберігала («Картку оновлено!»), картка VISA •••• 4242 за замовчуванням, ціни
 * в доларах, «Premium ???» і кнопки-заглушки. Дані картки ми не збираємо взагалі:
 * вони вводяться лише на сторінці платіжної системи.
 *
 * Бачить лише власник (сервер відповідає 403 іншим).
 */

const MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const utc = (s?: string | null) => (s ? new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`) : null);
const dateLabel = (s?: string | null) => { const d = utc(s); return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '—'; };
const money = (n: number) => `${Math.round(n).toLocaleString('uk-UA')} ₴`;
const plural = (n: number, one: string, few: string, many: string) =>
  n % 10 === 1 && n % 100 !== 11 ? one : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? few : many;

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: 'Сплачено', color: '#166534', bg: '#ecfdf5' },
  pending: { label: 'Очікує оплати', color: '#92400e', bg: '#fffbeb' },
  failed: { label: 'Не вдалась', color: '#991b1b', bg: '#fef2f2' },
};

export default function SubscriptionPanel({ businessId, showPlans, onShowPlans }: { businessId: number; showPlans: boolean; onShowPlans: (v: boolean) => void }) {
  const [data, setData] = useState<SubscriptionOverview | null>(null);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api.getSubscriptionOverview(await getAuthToken(), businessId));
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Не вдалося завантажити підписку');
    }
  }, [businessId]);
  useEffect(() => { void load(); }, [load]);

  const pay = async () => {
    setPaying(true);
    try {
      const res = await api.createSubscriptionCheckout(await getAuthToken(), businessId);
      if (goToCheckout(res)) return;       // перехід на сторінку оплати
      await load();                         // тестова оплата: дні нараховано одразу
    } catch (err: any) {
      notify(err?.message || 'Не вдалося почати оплату', 'error');
    } finally {
      setPaying(false);
    }
  };

  const box: React.CSSProperties = { background: '#ffffff', border: '1px solid #e5e5ea', borderRadius: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.02)', padding: '1.5rem 2rem' };
  if (error) return <div style={{ ...box, maxWidth: 850 }}><b style={{ color: '#1d1d1f' }}>Підписка</b><p style={{ color: '#86868b', margin: '0.4rem 0 0' }}>{error}</p></div>;
  if (!data) return <div style={{ ...box, maxWidth: 850, color: '#86868b' }}>Завантаження…</div>;

  const unlimited = data.status === 'active' && !data.until;
  const label = data.status === 'active' ? { t: 'Активний тариф', c: '#34c759' } : data.status === 'trial' ? { t: 'Пробний період', c: '#ff9500' } : { t: 'Доступ завершився', c: '#ff3b30' };
  const planName = unlimited ? 'Безстроковий доступ' : data.has_access ? `Ще ${data.days_left} ${plural(data.days_left || 0, 'день', 'дні', 'днів')}` : 'Потрібна оплата';
  const th: React.CSSProperties = { paddingBottom: '0.8rem', borderBottom: '1px solid #e5e5ea', fontSize: '0.7rem', textTransform: 'uppercase', color: '#86868b', fontWeight: 600 };
  const td: React.CSSProperties = { padding: '1rem 0', borderBottom: '1px solid #f5f5f7', fontSize: '0.85rem', color: '#1d1d1f' };

  if (showPlans) {
    const item = (t: string, c = '#1d1d1f', ic = '#436b49') => (
      <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, color: c, fontSize: '0.85rem', fontWeight: 500 }}><Check color={ic} /> {t}</li>
    );
    return (
      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 850, animation: 'fadeIn 0.2s ease-out' }}>
        <p style={{ color: '#86868b', fontSize: '0.95rem', margin: '0 0 2rem', textAlign: 'center' }}>Один тариф — усі можливості BookEra.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          <div style={{ background: '#fff', border: '2px solid #436b49', borderRadius: 16, padding: '1.5rem', boxShadow: '0 8px 24px rgba(67, 107, 73, 0.1)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: '#436b49', color: '#fff', padding: '0.2rem 0.8rem', borderRadius: 12, fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ваш тариф</div>
            <h4 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1d1d1f', margin: '0.5rem 0 0.3rem' }}>BookEra Pro</h4>
            <p style={{ color: '#86868b', margin: '0 0 1rem', fontSize: '0.85rem' }}>Повний доступ до всіх функцій.</p>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#1d1d1f', letterSpacing: '-1px', marginBottom: '1.5rem' }}>
              {money(data.price_uah)} <span style={{ fontSize: '0.85rem', color: '#86868b', fontWeight: 500, letterSpacing: 0 }}>/ {data.period_days} днів</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', flex: 1 }}>
              {['Онлайн-бронювання', 'Необмежені майстри', 'Листи-нагадування клієнтам', 'Аналітика, склад і витрати', 'Маркетинг і Радар'].map(t => item(t))}
            </ul>
            <button type="button" onClick={() => void pay()} disabled={paying}
              style={{ width: '100%', padding: '0.8rem', background: '#436b49', color: '#fff', border: 'none', borderRadius: 10, fontSize: '0.9rem', fontWeight: 700, cursor: paying ? 'wait' : 'pointer', opacity: paying ? 0.7 : 1 }}>
              {paying ? 'Зачекайте…' : data.has_access ? 'Продовжити на 30 днів' : 'Оплатити'}
            </button>
          </div>
          <div style={{ background: '#f5f5f7', border: '1px solid #e5e5ea', borderRadius: 16, padding: '1.5rem', display: 'flex', flexDirection: 'column', opacity: 0.7 }}>
            <h4 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1d1d1f', margin: '0.5rem 0 0.3rem' }}>Для мереж</h4>
            <p style={{ color: '#86868b', margin: '0 0 1rem', fontSize: '0.85rem' }}>Кілька закладів в одному кабінеті.</p>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#86868b', letterSpacing: '-1px', marginBottom: '1.5rem' }}>Скоро</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', flex: 1 }}>
              {['Єдина аналітика мережі', 'Персональний менеджер'].map(t => item(t, '#86868b', '#86868b'))}
            </ul>
            <button type="button" disabled style={{ width: '100%', padding: '0.8rem', background: '#e5e5ea', color: '#86868b', border: 'none', borderRadius: 10, fontSize: '0.9rem', fontWeight: 700, cursor: 'not-allowed' }}>Скоро</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 850, animation: 'fadeIn 0.2s ease-out' }}>
      <div style={{ ...box, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: label.c, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{label.t}</div>
          <h3 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 0.3rem', letterSpacing: '-0.5px', color: '#1d1d1f' }}>{planName}</h3>
          <p style={{ color: '#86868b', margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>
            {unlimited ? (data.manual_note ? `Видано вручну: ${data.manual_note}` : 'Доступ видано без обмеження за часом.')
              : data.has_access ? <>{data.is_trial ? 'Безкоштовно до:' : 'Діє до:'} <b style={{ color: '#1d1d1f', fontWeight: 600 }}>{dateLabel(data.until)}</b></>
              : <>Доступ закінчився <b style={{ color: '#1d1d1f', fontWeight: 600 }}>{dateLabel(data.until)}</b></>}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1d1d1f', letterSpacing: '-0.5px' }}>
            {money(data.price_uah)} <span style={{ fontSize: '0.9rem', color: '#86868b', fontWeight: 500 }}>/ {data.period_days} днів</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => onShowPlans(true)}
              style={{ padding: '0.6rem 1.2rem', background: '#f5f5f7', color: '#1d1d1f', border: 'none', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
              Переглянути план
            </button>
            <button type="button" onClick={() => void pay()} disabled={paying}
              style={{ padding: '0.6rem 1.2rem', background: '#436b49', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, cursor: paying ? 'wait' : 'pointer', opacity: paying ? 0.7 : 1 }}>
              {paying ? 'Зачекайте…' : data.has_access ? 'Продовжити на 30 днів' : 'Оплатити'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ ...box, display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
        <div style={{ width: 50, height: 34, background: '#f5f5f7', border: '1px solid #e5e5ea', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d1d1f', flex: 'none' }}>
          <span style={{ fontWeight: 800, fontStyle: 'italic', fontSize: '0.7rem' }}>CARD</span>
        </div>
        <div>
          <p style={{ margin: '0 0 0.1rem', fontWeight: 600, color: '#1d1d1f', fontSize: '0.95rem' }}>{data.live_payments ? 'Оплата карткою через WayForPay' : 'Тестова оплата'}</p>
          <p style={{ margin: 0, color: '#86868b', fontSize: '0.8rem', fontWeight: 500, lineHeight: 1.45 }}>
            {data.live_payments ? 'Картку вводять на захищеній сторінці платіжної системи — BookEra її не бачить і не зберігає.' : 'Гроші не списуються, дні нараховуються одразу. Нові дні додаються до залишку.'}
          </p>
        </div>
      </div>

      <div style={box}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1d1d1f', margin: '0 0 1.5rem' }}>Історія оплат</h3>
        {data.payments.length > 0 ? (
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead><tr><th style={th}>Дата</th><th style={th}>Сума</th><th style={th}>Статус</th></tr></thead>
              <tbody>
                {data.payments.map(p => {
                  const st = STATUS[p.status] || { label: p.status, color: '#475569', bg: '#f1f5f9' };
                  return (
                    <tr key={p.id}>
                      <td style={{ ...td, fontWeight: 500 }}>{dateLabel(p.date)}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{money(p.amount)}</td>
                      <td style={td}><span style={{ color: st.color, fontSize: '0.75rem', fontWeight: 600 }}>{st.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', background: '#fcfcfd', borderRadius: 12, border: '1px dashed #e5e5ea' }}>
            <p style={{ color: '#1d1d1f', fontWeight: 600, fontSize: '0.9rem', margin: '0 0 0.3rem' }}>Оплат ще не було</p>
            <p style={{ color: '#86868b', fontSize: '0.8rem', margin: 0 }}>Перший платіж з’явиться тут одразу після оплати.</p>
          </div>
        )}
      </div>
    </div>
  );
}
