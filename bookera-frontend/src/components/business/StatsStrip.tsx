'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Три цифри під головним екраном лендінгу: рахуються від нуля, коли з'являються
 * у вікні (ease-out, ~1.4 с), підписи плавно виїжджають знизу. Для «зменшити рух» -
 * одразу готові значення.
 */
type Stat = { prefix?: string; to: number; suffix?: string; tail?: string; label: string };

const STATS: Stat[] = [
  { to: 24, tail: '/7', label: 'Онлайн-запис без вас' },
  { prefix: '-', to: 40, suffix: '%', label: 'Зменшення неявок' },
  { prefix: '+', to: 25, suffix: '%', label: 'Зростання прибутку' },
];

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export default function StatsStrip() {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(0); // 0..1 - прогрес анімації
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setT(1); setStarted(true); return; }
    let raf = 0;
    const o = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      o.disconnect();
      setStarted(true);
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / 1400);
        setT(ease(p));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    o.observe(el);
    return () => { o.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, []);

  return (
    <div ref={ref} className={`ss ${started ? 'on' : ''}`}>
      {STATS.map((s, i) => (
        <div key={s.label} className="ss-item" style={{ ['--i' as string]: i }}>
          <div className="ss-num">
            {s.prefix}{Math.round(s.to * t)}{s.suffix}
            {s.tail && <span className="ss-tail" style={{ opacity: t > 0.85 ? 1 : 0, transform: t > 0.85 ? 'none' : 'translateY(6px)' }}>{s.tail}</span>}
          </div>
          <div className="ss-label">{s.label}</div>
        </div>
      ))}
      <style jsx>{`
        .ss { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; text-align: center; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; padding: 2.5rem 0; }
        .ss-num { font-size: 3rem; font-weight: 900; color: #111827; margin-bottom: 0.2rem; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; }
        .ss-tail { display: inline-block; transition: opacity .35s ease, transform .45s cubic-bezier(.34,1.56,.64,1); }
        .ss-label { color: #64748b; font-weight: 500; font-size: 0.95rem; opacity: 0; transform: translateY(10px); transition: opacity .7s ease, transform .8s cubic-bezier(.16,1,.3,1); transition-delay: calc(var(--i) * .12s + .25s); }
        .ss.on .ss-label { opacity: 1; transform: none; }
        @media (prefers-reduced-motion: reduce) { .ss-label { transition: none; opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}
