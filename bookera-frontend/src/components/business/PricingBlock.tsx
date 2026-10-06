'use client';

import { useEffect, useRef, useState } from 'react';
import type { PlatformTerms } from '@/lib/api';
import { useReveal } from './useReveal';

/**
 * «Один тариф»: ціна, пробний період і комісія з інтерактивним прикладом.
 * Число умов - з бекенду (PlatformTerms). Приклад не вигадує цифр: людина сама рухає суму візиту,
 * а ми лише рахуємо за правилом платформи.
 */
const money = (n: number) => `${Math.round(n).toLocaleString('uk-UA')} ₴`;

export default function PricingBlock({ terms, onStart }: { terms: PlatformTerms; onStart: () => void }) {
  const [ref, shown] = useReveal<HTMLDivElement>(0.15);
  const [visit, setVisit] = useState(1000);
  const [shownPrice, setShownPrice] = useState(0);
  const raf = useRef(0);

  // Ціна «набігає» від нуля, коли блок зʼявляється у вікні
  useEffect(() => {
    if (!shown) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShownPrice(terms.price_uah); return; }
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 1100);
      setShownPrice(Math.round(terms.price_uah * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [shown, terms.price_uah]);

  const rate = terms.marketplace_commission_percent;
  const fee = (visit * rate) / 100;
  const keep = visit - fee;
  const periodLabel = terms.period_days === 30 ? 'місяць' : `${terms.period_days} днів`;

  return (
    <section id="pricing" className="pr" style={{ scrollMarginTop: '80px' }}>
      <div className="container">
        <div ref={ref} className={`pr-grid ${shown ? 'on' : ''}`}>
          <div className="pr-left">
            <h2 className="pr-title">Один тариф.<br />Без сюрпризів.</h2>
            <div className="pr-price">
              <span className="pr-num">{shownPrice.toLocaleString('uk-UA')}</span>
              <span className="pr-cur">₴</span>
              <span className="pr-per">/ {periodLabel}</span>
            </div>
            <p className="pr-trial">Перші <mark>{terms.trial_days} днів безкоштовно</mark>, потім підписка. Увесь кабінет входить у тариф. Окремо лише необовʼязкове просування «Радар».</p>
            <button type="button" className="pr-btn" onClick={onStart}>Почати безкоштовний період</button>
          </div>

          <div className="pr-right">
            <div className="pr-kicker">Як рахується комісія</div>
            <div className="pr-slider">
              <label htmlFor="visit">Вартість візиту</label>
              <output>{money(visit)}</output>
            </div>
            <input id="visit" type="range" min={300} max={3000} step={100} value={visit} onChange={e => setVisit(Number(e.target.value))} aria-label="Вартість візиту" />

            <div className="pr-row">
              <div className="pr-row-h"><span>Ваш клієнт <i>посилання, QR, розсилка</i></span><b>{money(visit)}</b></div>
              <div className="pr-bar"><span style={{ transform: 'scaleX(1)' }} /></div>
              <div className="pr-note">Комісія {terms.own_clients_commission_percent}%: вам усе</div>
            </div>
            <div className="pr-row">
              <div className="pr-row-h"><span>Клієнт із вітрини BookEra</span><b>{money(keep)}</b></div>
              <div className="pr-bar split"><span style={{ transform: `scaleX(${keep / visit})` }} /></div>
              <div className="pr-note">Комісія {Math.round(rate)}% ({money(fee)}) лише із завершеного візиту</div>
            </div>
          </div>
        </div>
      </div>
      <style jsx>{`
        .pr { padding: 7rem 0 5rem; background: #fff; }
        .pr-grid { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 5rem; align-items: start; }
        .pr-grid > div { opacity: 0; transform: translateY(24px); transition: opacity .8s ease, transform .9s cubic-bezier(.16,1,.3,1); }
        .pr-grid.on > div { opacity: 1; transform: none; }
        .pr-grid.on > .pr-right { transition-delay: .15s; }
        .pr-title { font-size: clamp(2rem, 4.4vw, 3.25rem); font-weight: 700; letter-spacing: -0.035em; line-height: 1.08; color: #1D1D1F; margin: 0 0 2rem; }
        .pr-price { display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 1rem; }
        .pr-num { font-size: clamp(4.2rem, 9.5vw, 7rem); font-weight: 900; letter-spacing: -0.05em; line-height: 1; color: #111827; font-variant-numeric: tabular-nums; min-width: 2.75ch; }
        .pr-cur { font-size: clamp(1.8rem, 3.5vw, 2.6rem); font-weight: 800; color: #111827; }
        .pr-per { font-size: 1.15rem; color: #475569; font-weight: 600; margin-left: 0.25rem; }
        .pr-trial { font-size: 1.12rem; color: #374151; line-height: 1.6; max-width: 470px; margin: 0 0 2rem; }
        .pr-trial mark { background: none; color: #111827; font-weight: 700; text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 4px; }
        .pr-btn { background: #111827; color: #fff; font-weight: 700; font-size: 1.02rem; padding: 1.05rem 2.2rem; border-radius: 999px; border: none; cursor: pointer; transition: transform .25s ease, box-shadow .25s ease; }
        .pr-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 24px rgba(17,24,39,.18); }
        .pr-btn:focus-visible, input:focus-visible { outline: 3px solid #111827; outline-offset: 3px; }
        .pr-right { background: #F5F5F7; border-radius: 32px; padding: 2.5rem; margin-top: 1rem; }
        .pr-kicker { font-size: 0.78rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #475569; margin-bottom: 1.4rem; }
        .pr-slider { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.6rem; }
        .pr-slider label { font-weight: 600; color: #374151; }
        .pr-slider output { font-size: 1.6rem; font-weight: 800; letter-spacing: -0.02em; color: #111827; font-variant-numeric: tabular-nums; }
        input[type=range] { width: 100%; accent-color: #111827; margin: 0 0 1.8rem; cursor: pointer; }
        .pr-row { padding: 1.2rem 0; border-top: 1px solid #e3e3e8; }
        .pr-row-h { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; font-weight: 700; color: #111827; margin-bottom: 0.7rem; }
        .pr-row-h i { font-style: normal; font-weight: 500; color: #64748b; font-size: 0.88rem; margin-left: 0.4rem; }
        .pr-row-h b { font-size: 1.25rem; font-variant-numeric: tabular-nums; }
        .pr-bar { height: 10px; border-radius: 6px; background: #d9d9de; overflow: hidden; }
        .pr-bar span { display: block; height: 100%; width: 100%; border-radius: 6px; background: #111827; transform-origin: left; transition: transform .5s cubic-bezier(.16,1,.3,1); }
        .pr-note { margin-top: 0.55rem; font-size: 0.9rem; color: #475569; }
        @media (max-width: 960px) { .pr-grid { grid-template-columns: 1fr; gap: 3rem; } .pr-right { margin-top: 0; padding: 1.75rem; } }
        @media (prefers-reduced-motion: reduce) { .pr-grid > div, .pr-bar span { transition: none; opacity: 1; transform: none; } }
      `}</style>
    </section>
  );
}
