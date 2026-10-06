'use client';

import { useState } from 'react';
import type { PlatformTerms } from '@/lib/api';

/**
 * Ціна у вигляді чека: що саме людина платить за старт і скільки лишається їй з візиту.
 * Форма несе зміст: чек з рядками «назва ..... сума». Числа з бекенду (PlatformTerms),
 * приклад комісії людина рахує сама повзунком.
 */
const money = (n: number) => `${Math.round(n).toLocaleString('uk-UA')} ₴`;

export default function PricingBlock({ terms, onStart }: { terms: PlatformTerms; onStart: () => void }) {
  const [visit, setVisit] = useState(1000);
  const rate = terms.marketplace_commission_percent;
  const fee = (visit * rate) / 100;
  const periodLabel = terms.period_days === 30 ? 'місяць' : `${terms.period_days} днів`;

  return (
    <section id="pricing" className="pr" style={{ scrollMarginTop: '80px' }}>
      <div className="container pr-grid">
        <div className="pr-text">
          <h2>Один тариф на все. Без сюрпризів.</h2>
          <p>Перші {terms.trial_days} днів безкоштовно: спробуйте все в роботі й тільки потім вирішуйте. Окремо платите лише за необовʼязкове просування «Радар».</p>
          <button type="button" className="pr-btn" onClick={onStart}>Почати безкоштовний період</button>
        </div>

        <div className="rc-wrap">
          <div className="rc" role="group" aria-label="Приклад розрахунку">
            <div className="rc-head">Book<span>Era</span><small>рахунок за старт</small></div>
            <div className="rc-line"><span>Пробний період, {terms.trial_days} днів</span><i /><b>0 ₴</b></div>
            <div className="rc-line"><span>Підписка на {periodLabel}, увесь кабінет</span><i /><b>{money(terms.price_uah)}</b></div>

            <div className="rc-sep" />
            <div className="rc-q">
              <label htmlFor="visit">Клієнт заплатив за візит</label>
              <output htmlFor="visit">{money(visit)}</output>
            </div>
            <input id="visit" type="range" min={300} max={3000} step={100} value={visit} onChange={e => setVisit(Number(e.target.value))} aria-label="Вартість візиту" />

            <div className="rc-line"><span>Ваш клієнт <em>посилання, QR, розсилка</em></span><i /><b>вам {money(visit)}</b></div>
            <div className="rc-note">комісія {terms.own_clients_commission_percent}%</div>
            <div className="rc-line"><span>Клієнт із вітрини BookEra</span><i /><b>вам {money(visit - fee)}</b></div>
            <div className="rc-note">комісія {Math.round(rate)}% ({money(fee)}), тільки із завершеного візиту</div>
          </div>
        </div>
      </div>
      <style jsx>{`
        .pr { padding: 6rem 0 5rem; background: #fff; }
        .pr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5rem; align-items: center; }
        .pr-text h2 { font-size: clamp(2rem, 4.4vw, 3.25rem); font-weight: 700; letter-spacing: -0.035em; line-height: 1.08; color: #1E2124; margin: 0 0 1.4rem; max-width: 11em; }
        .pr-text p { font-size: 1.12rem; line-height: 1.65; color: #475569; max-width: 30em; margin: 0 0 2rem; }
        .pr-btn { background: #1E2124; color: #fff; font-weight: 700; font-size: 1.02rem; padding: 1.05rem 2.2rem; border-radius: 999px; border: none; cursor: pointer; transition: transform .25s ease, box-shadow .25s ease; }
        .pr-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(30,33,36,.18); }
        .pr-btn:focus-visible, input:focus-visible { outline: 3px solid #1E2124; outline-offset: 3px; }

        .rc-wrap { display: flex; justify-content: center; }
        .rc { position: relative; width: 100%; max-width: 440px; background: #FFFEFB; padding: 2rem 2rem 2.6rem; transform: rotate(1.4deg); box-shadow: 0 22px 44px rgba(46,58,48,.12); border-radius: 4px 4px 0 0; }
        .rc::after { content: ''; position: absolute; left: 0; right: 0; bottom: -12px; height: 12px; background: linear-gradient(-45deg, transparent 8px, #FFFEFB 0), linear-gradient(45deg, transparent 8px, #FFFEFB 0); background-size: 16px 16px; background-position: left bottom; filter: drop-shadow(0 6px 4px rgba(46,58,48,.06)); }
        .rc-head { font-weight: 900; font-size: 1.5rem; letter-spacing: -0.04em; color: #1E2124; margin-bottom: 1.4rem; } .rc-head span { color: #8fae92; } .rc-head small { display: block; font-weight: 500; font-size: 0.85rem; letter-spacing: 0; color: #64748b; margin-top: 0.15rem; }
        .rc-line { display: flex; align-items: baseline; gap: 0.5rem; padding: 0.35rem 0; color: #1E2124; font-size: 0.98rem; }
        .rc-line span { flex: 0 1 auto; } .rc-line em { font-style: normal; color: #64748b; font-size: 0.85rem; margin-left: 0.3rem; }
        .rc-line i { flex: 1; border-bottom: 2px dotted #cbd3cc; transform: translateY(-4px); min-width: 12px; }
        .rc-line b { font-variant-numeric: tabular-nums; white-space: nowrap; }
        .rc-note { font-size: 0.83rem; color: #64748b; margin: -0.1rem 0 0.7rem; }
        .rc-sep { border-top: 2px dashed #d5dcd6; margin: 1.1rem 0; }
        .rc-q { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.5rem; font-weight: 600; } .rc-q output { font-size: 1.4rem; font-weight: 800; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
        input[type=range] { width: 100%; accent-color: #4C7A55; margin: 0 0 1.1rem; cursor: pointer; }
        @media (max-width: 960px) { .pr-grid { grid-template-columns: 1fr; gap: 3.5rem; } .rc { transform: none; } }
        @media (prefers-reduced-motion: reduce) { .pr-btn { transition: none; } }
      `}</style>
    </section>
  );
}
