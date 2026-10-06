'use client';

import type { PlatformTerms } from '@/lib/api';
import { useReveal } from './useReveal';

/**
 * «Скільки це коштує»: один тариф і зрозуміла комісія. Усі числа - з бекенду (PlatformTerms),
 * без вигаданих тарифів і таблиць порівняння.
 */
const INCLUDED = [
  'Сторінка закладу й онлайн-запис',
  'Календар для всієї команди',
  'База клієнтів з історією візитів',
  'Розсилки з відпискою та згодою клієнтів',
  'Аналітика доходу й витрат',
  'Склад, подарункові сертифікати, ролі команди',
];

export default function PricingBlock({ terms, onStart }: { terms: PlatformTerms; onStart: () => void }) {
  const [ref, shown] = useReveal<HTMLDivElement>(0.15);
  const price = terms.price_uah.toLocaleString('uk-UA');
  const periodLabel = terms.period_days === 30 ? 'місяць' : `${terms.period_days} днів`;

  return (
    <section id="pricing" className="pr" style={{ scrollMarginTop: '80px' }}>
      <div className="container">
        <div ref={ref} className={`pr-grid ${shown ? 'on' : ''}`}>
          <div className="pr-left">
            <h2 className="pr-title">Один тариф.<br />Без сюрпризів.</h2>
            <div className="pr-price"><span className="pr-num">{price}</span><span className="pr-cur">₴</span><span className="pr-per">/ {periodLabel}</span></div>
            <p className="pr-trial">Перші <b>{terms.trial_days} днів безкоштовно</b>: ви спокійно пробуєте все й тільки потім вирішуєте.</p>
            <ul className="pr-list">
              {INCLUDED.map((t, i) => (
                <li key={t} style={{ ['--i' as string]: i }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="9" fill="#E3EFE5" /><path d="M5.2 9.2l2.4 2.4 5.2-5.4" stroke="#3F6B49" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <button type="button" className="pr-btn" onClick={onStart}>Спробувати {terms.trial_days} днів безкоштовно</button>
          </div>

          <div className="pr-right">
            <div className="pr-kicker">Комісія платформи</div>
            <h3 className="pr-sub">Платите лише за клієнтів, яких привела вітрина</h3>
            <div className="pr-row">
              <div className="pr-pct own">{terms.own_clients_commission_percent}%</div>
              <div>
                <div className="pr-row-t">Ваші клієнти</div>
                <div className="pr-row-d">Прийшли за вашим посиланням, QR, розсилкою або вже є у вашій базі</div>
              </div>
            </div>
            <div className="pr-row">
              <div className="pr-pct">{Math.round(terms.marketplace_commission_percent)}%</div>
              <div>
                <div className="pr-row-t">Клієнти з вітрини BookEra</div>
                <div className="pr-row-d">Береться із завершеного візиту. Якщо клієнт не прийшов, комісії немає</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        .pr { padding: 7rem 0 5rem; background: #fff; }
        .pr-grid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 5rem; align-items: start; }
        .pr-grid > div { opacity: 0; transform: translateY(24px); transition: opacity .8s ease, transform .9s cubic-bezier(.16,1,.3,1); }
        .pr-grid.on > div { opacity: 1; transform: none; }
        .pr-grid.on > .pr-right { transition-delay: .15s; }
        .pr-title { font-size: clamp(2rem, 4.4vw, 3.25rem); font-weight: 700; letter-spacing: -0.035em; line-height: 1.08; color: #1D1D1F; margin: 0 0 2rem; }
        .pr-price { display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 0.75rem; }
        .pr-num { font-size: clamp(4rem, 9vw, 6.5rem); font-weight: 900; letter-spacing: -0.05em; line-height: 1; color: #111827; font-variant-numeric: tabular-nums; }
        .pr-cur { font-size: clamp(1.8rem, 3.5vw, 2.6rem); font-weight: 800; color: #111827; }
        .pr-per { font-size: 1.15rem; color: #475569; font-weight: 600; margin-left: 0.25rem; }
        .pr-trial { font-size: 1.1rem; color: #374151; line-height: 1.55; max-width: 460px; margin: 0 0 2rem; }
        .pr-trial b { color: #111827; }
        .pr-list { list-style: none; padding: 0; margin: 0 0 2.25rem; display: grid; gap: 0.85rem; }
        .pr-list li { display: flex; align-items: center; gap: 0.75rem; font-size: 1.02rem; color: #1f2937; }
        .pr-btn { background: #111827; color: #fff; font-weight: 700; font-size: 1.02rem; padding: 1.05rem 2.2rem; border-radius: 999px; border: none; cursor: pointer; transition: transform .25s ease, box-shadow .25s ease; }
        .pr-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(17,24,39,.18); }
        .pr-btn:focus-visible { outline: 3px solid #8fae92; outline-offset: 3px; }
        .pr-right { background: #F3F8F4; border-radius: 32px; padding: 2.75rem; margin-top: 1.5rem; }
        .pr-kicker { font-size: 0.78rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #3F6B49; margin-bottom: 0.75rem; }
        .pr-sub { font-size: 1.55rem; font-weight: 700; letter-spacing: -0.025em; line-height: 1.25; color: #111827; margin: 0 0 2rem; }
        .pr-row { display: flex; gap: 1.25rem; align-items: center; padding: 1.4rem 0; border-top: 1px solid rgba(63,107,73,.16); }
        .pr-pct { flex: 0 0 auto; min-width: 88px; font-size: 2.6rem; font-weight: 900; letter-spacing: -0.04em; color: #111827; }
        .pr-pct.own { color: #3F6B49; }
        .pr-row-t { font-weight: 700; color: #111827; font-size: 1.05rem; margin-bottom: 0.2rem; }
        .pr-row-d { color: #475569; font-size: 0.95rem; line-height: 1.5; }
        @media (max-width: 960px) { .pr-grid { grid-template-columns: 1fr; gap: 3rem; } .pr-right { margin-top: 0; padding: 2rem; } }
        @media (prefers-reduced-motion: reduce) { .pr-grid > div { transition: none; opacity: 1; transform: none; } }
      `}</style>
    </section>
  );
}
