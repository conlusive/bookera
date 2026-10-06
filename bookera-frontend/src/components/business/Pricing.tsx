'use client';

import { useEffect, useState } from 'react';
import { motion, MotionConfig, useInView, animate } from 'motion/react';
import { useRef } from 'react';
import type { PlatformTerms } from '@/lib/api';

/**
 * Ціна: три великі числа без рамок (пробний період, тариф, комісія) і живий приклад «скільки лишається вам».
 * Усі числа з бекенду (PlatformTerms): ні ціни, ні комісії тут не вигадано й не продубльовано.
 */
const spring = { type: 'spring' as const, stiffness: 140, damping: 18 };
const money = (n: number) => `${Math.round(n).toLocaleString('uk-UA')} ₴`;

function Count({ to, suffix = '' }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(to); return; }
    const c = animate(0, to, { duration: 1.2, ease: [0.16, 1, 0.3, 1], onUpdate: v => setN(Math.round(v)) });
    return () => c.stop();
  }, [inView, to]);
  return <span ref={ref}>{n.toLocaleString('uk-UA')}{suffix}</span>;
}

export default function Pricing({ terms, onStart }: { terms: PlatformTerms; onStart: () => void }) {
  const [visit, setVisit] = useState(1000);
  const rate = terms.marketplace_commission_percent;
  const fee = (visit * rate) / 100;
  const periodLabel = terms.period_days === 30 ? 'місяць' : `${terms.period_days} днів`;
  const facts = [
    { big: <Count to={terms.trial_days} />, unit: 'днів', cap: 'безкоштовно, щоб усе спробувати' },
    { big: <Count to={terms.price_uah} suffix=" ₴" />, unit: `/ ${periodLabel}`, cap: 'єдиний тариф: увесь кабінет' },
    { big: <><Count to={terms.own_clients_commission_percent} suffix="%" /></>, unit: 'комісії', cap: 'з ваших клієнтів і з повторних візитів' },
  ];
  return (
    <MotionConfig reducedMotion="user">
      <section id="pricing" className="pz" style={{ scrollMarginTop: '80px' }}>
        <div className="container">
          <h2 className="pz-h">Один тариф. Без сюрпризів.</h2>
          <p className="pz-s">Окремо платите лише за необовʼязкове просування «Радар».</p>

          <div className="pz-facts">
            {facts.map((f, i) => (
              <motion.div key={f.cap} initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ ...spring, delay: i * 0.1 }}>
                <div className="pz-big">{f.big}<small>{f.unit}</small></div>
                <p>{f.cap}</p>
              </motion.div>
            ))}
          </div>

          <motion.div className="pz-calc" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={spring}>
            <div className="pz-q">
              <div><h3>А з вітрини BookEra?</h3><p>Комісія {Math.round(rate)}% береться лише з першого завершеного візиту нового клієнта. Усі наступні візити — ваші, без комісії.</p></div>
              <div className="pz-visit"><label htmlFor="pz-visit">Візит коштує</label><output htmlFor="pz-visit">{money(visit)}</output></div>
            </div>
            <input id="pz-visit" type="range" min={300} max={3000} step={100} value={visit} onChange={e => setVisit(Number(e.target.value))} aria-label="Вартість візиту" />
            <div className="pz-rows">
              <div><span>Ваш клієнт <em>посилання, QR, розсилка</em></span><b>вам {money(visit)}</b></div>
              <div className="pz-bar"><i style={{ transform: 'scaleX(1)' }} /></div>
              <div><span>Новий клієнт із вітрини BookEra <em>перший візит: комісія {money(fee)}</em></span><b>вам {money(visit - fee)}</b></div>
              <div className="pz-bar"><i style={{ transform: `scaleX(${(visit - fee) / visit})` }} /></div>
            </div>
          </motion.div>

          <div className="pz-cta"><button type="button" onClick={onStart}>Почати безкоштовний період</button></div>
        </div>
        <style jsx global>{`
          .pz { padding: 5rem 0 6rem; background: #fff; }
          .pz-h { text-align: center; font-size: clamp(2.2rem, 5vw, 4rem); font-weight: 700; letter-spacing: -0.04em; line-height: 1.05; color: #1D1D1F; margin: 0 0 1rem; }
          .pz-s { text-align: center; color: #6E6E73; font-size: clamp(1.05rem, 1.8vw, 1.25rem); margin: 0 0 4rem; }
          .pz-facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; text-align: center; margin-bottom: 4.5rem; }
          .pz-big { font-size: clamp(3.4rem, 8vw, 6rem); font-weight: 800; letter-spacing: -0.05em; line-height: 1; color: #1D1D1F; font-variant-numeric: tabular-nums; }
          .pz-big small { font-size: clamp(1.1rem, 2vw, 1.5rem); font-weight: 600; letter-spacing: 0; color: #6E6E73; margin-left: .5rem; }
          .pz-facts p { margin: .8rem auto 0; max-width: 15em; color: #6E6E73; font-size: 1.05rem; line-height: 1.45; }
          .pz-calc { background: #F5F5F7; border-radius: 32px; padding: clamp(1.5rem, 4vw, 3rem); max-width: 860px; margin: 0 auto; }
          .pz-q { display: flex; justify-content: space-between; gap: 2rem; align-items: flex-end; margin-bottom: 1.2rem; flex-wrap: wrap; }
          .pz-q h3 { margin: 0 0 .4rem; font-size: 1.6rem; font-weight: 700; letter-spacing: -.025em; } .pz-q p { margin: 0; color: #6E6E73; max-width: 28em; line-height: 1.5; }
          .pz-visit { text-align: right; } .pz-visit label { display: block; color: #6E6E73; font-size: .9rem; } .pz-visit output { font-size: 2rem; font-weight: 800; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
          .pz-calc input[type=range] { width: 100%; accent-color: #1D1D1F; margin: 0 0 1.6rem; cursor: pointer; }
          .pz-calc input[type=range]:focus-visible { outline: 3px solid #1D1D1F; outline-offset: 4px; }
          .pz-rows > div:not(.pz-bar) { display: flex; justify-content: space-between; gap: 1rem; font-weight: 600; margin-bottom: .55rem; } .pz-rows em { font-style: normal; font-weight: 500; color: #6E6E73; margin-left: .4rem; font-size: .9rem; }
          .pz-rows b { font-variant-numeric: tabular-nums; }
          .pz-bar { height: 10px; border-radius: 6px; background: #dcdce2; overflow: hidden; margin-bottom: 1.3rem; }
          .pz-bar i { display: block; height: 100%; background: #1D1D1F; border-radius: 6px; transform-origin: left; transition: transform .5s cubic-bezier(.16,1,.3,1); }
          .pz-cta { text-align: center; margin-top: 3rem; }
          .pz-cta button { background: #1D1D1F; color: #fff; border: none; font-weight: 700; font-size: 1.05rem; padding: 1.1rem 2.6rem; border-radius: 999px; cursor: pointer; transition: transform .25s ease; }
          .pz-cta button:hover { transform: scale(1.03); } .pz-cta button:focus-visible { outline: 3px solid #1D1D1F; outline-offset: 3px; }
          @media (max-width: 800px) { .pz-facts { grid-template-columns: 1fr; gap: 2.5rem; } .pz-visit { text-align: left; } }
        `}</style>
      </section>
    </MotionConfig>
  );
}
