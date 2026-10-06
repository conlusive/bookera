'use client';

import { useEffect, useRef, useState } from 'react';
import type { PlatformTerms } from '@/lib/api';

/**
 * Три числа під головним екраном - ЛИШЕ правдиві умови платформи (приходять із бекенду,
 * не дублюються в коді): 0% з власних клієнтів, комісія з вітрини, пробний період.
 * Рахуються від нуля, коли зʼявляються у вікні; для «зменшити рух» - одразу готові.
 */
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export default function FactsStrip({ terms }: { terms: PlatformTerms }) {
  const items = [
    { to: terms.own_clients_commission_percent, suffix: '%', label: 'комісії з клієнтів, яких привели ви самі: за посиланням, QR чи розсилкою' },
    { to: Math.round(terms.marketplace_commission_percent), suffix: '%', label: 'лише з візитів із вітрини BookEra, і тільки із завершеного візиту' },
    { to: terms.trial_days, suffix: ' днів', label: 'безкоштовно, щоб спокійно спробувати все' },
  ];
  const ref = useRef<HTMLDivElement>(null);
  const nums = useRef<(HTMLSpanElement | null)[]>([]);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const paint = (t: number) => items.forEach((s, i) => {
      const n = nums.current[i];
      if (n) n.textContent = `${Math.round(s.to * t)}${s.suffix}`;
    });
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { paint(1); setStarted(true); return; }
    paint(0);
    let raf = 0;
    const o = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      o.disconnect();
      setStarted(true);
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / 1200);
        paint(ease(p));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    o.observe(el);
    return () => { o.disconnect(); if (raf) cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terms.own_clients_commission_percent, terms.marketplace_commission_percent, terms.trial_days]);

  return (
    <div ref={ref} className={`fs ${started ? 'on' : ''}`}>
      {items.map((s, i) => (
        <div key={s.label} className="fs-item" style={{ ['--i' as string]: i }}>
          <div className="fs-num"><span ref={n => { nums.current[i] = n; }}>{s.to}{s.suffix}</span></div>
          <div className="fs-label">{s.label}</div>
        </div>
      ))}
      <style jsx>{`
        .fs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.5rem; border-top: 1px solid #eef1ee; border-bottom: 1px solid #eef1ee; padding: 2.75rem 0; }
        .fs-item { text-align: center; }
        .fs-num { font-size: clamp(2.4rem, 5vw, 3.4rem); font-weight: 900; color: #111827; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; margin-bottom: 0.5rem; }
        .fs-label { color: #475569; font-weight: 500; font-size: 0.98rem; line-height: 1.5; max-width: 270px; margin: 0 auto; opacity: 0; transform: translateY(10px); transition: opacity .7s ease, transform .8s cubic-bezier(.16,1,.3,1); transition-delay: calc(var(--i) * .12s + .2s); }
        .fs.on .fs-label { opacity: 1; transform: none; }
        @media (max-width: 820px) { .fs { grid-template-columns: 1fr; gap: 2rem; } }
        @media (prefers-reduced-motion: reduce) { .fs-label { transition: none; opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}
