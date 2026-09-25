'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

/**
 * «Бонуси та картки» - одна вкладка профілю.
 *
 * Бонуси BookEra: 3% від кожного завершеного візиту, у будь-якому
 * закладі. Поки лише видно баланс - витрачати на записи буде можна
 * пізніше, і вкладка каже про це прямо, а не обіцяє більше, ніж є.
 *
 * Картки: куплені вами й подаровані вам. Код видно лише в оплаченої
 * картки - до оплати ним можна було б розрахуватись, не заплативши.
 */

type Wallet = Awaited<ReturnType<typeof api.getWallet>>;

const REASON: Record<string, string> = {
  visit_completed: 'За візит',
  visit_reversed: 'Повернення: візит не відбувся',
};

const money = (n: number) => `${Math.round(n).toLocaleString('uk-UA')} ₴`;
const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

export default function WalletTab({ getToken }: { getToken: () => Promise<string | null> }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('no token');
        const data = await api.getWallet(token);
        if (!cancelled) setWallet(data);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [getToken]);

  const copy = async (id: number, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(id);
      setTimeout(() => setCopied(c => (c === id ? null : c)), 1600);
    } catch { /* буфер недоступний - код і так видно */ }
  };

  if (error) {
    return <div className="wt-empty">Не вдалося завантажити гаманець. Спробуйте оновити сторінку.</div>;
  }
  if (!wallet) {
    return <div className="wt-empty">Завантаження…</div>;
  }

  const activeCards = wallet.gift_cards.filter(c => c.status === 'active');
  const otherCards = wallet.gift_cards.filter(c => c.status !== 'active');

  return (
    <div className="wt">
      {/* --- Бонуси --- */}
      <section className="wt-balance">
        <div className="wt-label">Бонуси BookEra</div>
        <div className="wt-big">{wallet.bonus_balance.toLocaleString('uk-UA')}</div>
        <div className="wt-sub">
          3% від кожного завершеного візиту - у будь-якому закладі. Витрачати на записи можна буде незабаром.
        </div>
      </section>

      {wallet.bonus_history.length > 0 ? (
        <section className="wt-block">
          <div className="wt-title">Історія</div>
          {wallet.bonus_history.map((h, i) => (
            <div key={i} className="wt-row">
              <div>
                <div className="wt-row-t">{REASON[h.reason] || 'Бонуси'}{h.business_name ? ` · ${h.business_name}` : ''}</div>
                <div className="wt-row-s">{date(h.created_at)}</div>
              </div>
              <div className={`wt-amount ${h.amount < 0 ? 'neg' : ''}`}>{h.amount > 0 ? '+' : ''}{h.amount}</div>
            </div>
          ))}
        </section>
      ) : (
        <div className="wt-hint">Бонуси зʼявляться після першого завершеного візиту.</div>
      )}

      {/* --- Картки --- */}
      <section className="wt-block">
        <div className="wt-title">Подарункові картки</div>

        {wallet.gift_cards.length === 0 && (
          <div className="wt-hint" style={{ marginTop: 0 }}>
            Подарувати картку можна на сторінці будь-якого закладу - кнопка «Подарувати картку».
          </div>
        )}

        <div className="wt-cards">
          {[...activeCards, ...otherCards].map(card => (
            <div key={card.id} className={`wt-card ${card.status !== 'active' ? 'dim' : ''}`}>
              <div className="wt-card-top">
                <span>{card.direction === 'received' ? 'Подарунок вам' : card.recipient_name ? `Для: ${card.recipient_name}` : 'Куплена вами'}</span>
                <span className="wt-status">
                  {card.status === 'active' ? 'Активна' : card.status === 'pending' ? 'Очікує оплати' : card.status === 'redeemed' ? 'Використана' : 'Недійсна'}
                </span>
              </div>
              <div className="wt-card-amount">{money(card.remaining_amount)}</div>
              {card.remaining_amount !== card.initial_amount && (
                <div className="wt-card-of">з {money(card.initial_amount)}</div>
              )}
              {card.business_slug ? (
                <Link href={`/${card.business_slug}`} className="wt-card-biz">{card.business_name}</Link>
              ) : (
                <div className="wt-card-biz">{card.business_name}</div>
              )}
              {card.message && <div className="wt-card-msg">«{card.message}»</div>}
              {card.code && (
                <button type="button" className="wt-code" onClick={() => void copy(card.id, card.code)}>
                  <span>{card.code}</span>
                  <small>{copied === card.id ? 'Скопійовано' : 'Копіювати'}</small>
                </button>
              )}
              {card.expires_at && card.status === 'active' && (
                <div className="wt-card-exp">Дійсна до {date(card.expires_at)}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      <style jsx>{`
        .wt { display: flex; flex-direction: column; gap: 1.5rem; }
        .wt-empty { padding: 3rem 1rem; text-align: center; color: #86868B; font-size: 0.95rem; }
        .wt-balance { padding: 1.6rem 1.75rem; border-radius: 22px; background: linear-gradient(160deg, #EAF1E9 0%, #DCE8DB 100%); }
        .wt-label { font-size: 0.8125rem; font-weight: 600; color: #5C7A61; }
        .wt-big { font-size: 3rem; font-weight: 700; letter-spacing: -0.04em; color: #1D1D1F; line-height: 1.1; margin: 0.3rem 0 0.4rem; font-variant-numeric: tabular-nums; }
        .wt-sub { font-size: 0.9rem; line-height: 1.5; color: #4A5A4D; max-width: 460px; }
        .wt-block { border: 1px solid #EDEDF0; border-radius: 20px; padding: 1.25rem 1.4rem; }
        .wt-title { font-size: 1rem; font-weight: 700; color: #1D1D1F; margin-bottom: 0.6rem; }
        .wt-row { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 0.7rem 0; border-top: 1px solid #F5F5F7; }
        .wt-row:first-of-type { border-top: none; }
        .wt-row-t { font-size: 0.9rem; font-weight: 500; color: #1D1D1F; }
        .wt-row-s { font-size: 0.78rem; color: #86868B; margin-top: 1px; }
        .wt-amount { font-size: 0.975rem; font-weight: 600; color: #5C7A61; font-variant-numeric: tabular-nums; }
        .wt-amount.neg { color: #86868B; }
        .wt-hint { font-size: 0.9rem; color: #86868B; line-height: 1.5; }
        .wt-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.9rem; }
        .wt-card { border-radius: 18px; padding: 1.1rem 1.2rem; background: #1D1D1F; color: #fff; display: flex; flex-direction: column; gap: 0.25rem; }
        .wt-card.dim { background: #F5F5F7; color: #1D1D1F; }
        .wt-card-top { display: flex; justify-content: space-between; gap: 0.5rem; font-size: 0.75rem; opacity: 0.75; }
        .wt-status { font-weight: 600; }
        .wt-card-amount { font-size: 1.75rem; font-weight: 700; letter-spacing: -0.03em; margin-top: 0.4rem; font-variant-numeric: tabular-nums; }
        .wt-card-of { font-size: 0.78rem; opacity: 0.65; }
        .wt-card-biz { font-size: 0.9rem; font-weight: 500; color: inherit; text-decoration: none; margin-top: 0.2rem; }
        .wt-card-msg { font-size: 0.82rem; opacity: 0.75; font-style: italic; }
        .wt-code {
          margin-top: 0.7rem; display: flex; justify-content: space-between; align-items: center;
          padding: 0.55rem 0.75rem; border-radius: 10px; border: 1px dashed rgba(255,255,255,0.35);
          background: rgba(255,255,255,0.06); color: #fff; font-family: inherit; cursor: pointer;
        }
        .wt-card.dim .wt-code { border-color: #C7C7CC; background: #fff; color: #1D1D1F; }
        .wt-code span { font-size: 1rem; font-weight: 700; letter-spacing: 0.12em; }
        .wt-code small { font-size: 0.72rem; opacity: 0.7; }
        .wt-card-exp { font-size: 0.72rem; opacity: 0.6; margin-top: 0.35rem; }
      `}</style>
    </div>
  );
}
