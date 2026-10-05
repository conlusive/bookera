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
  const nums = useRef<(HTMLSpanElement | null)[]>([]);
  const tails = useRef<(HTMLSpanElement | null)[]>([]);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Числа пишемо прямо в DOM, а не через стан React: 80 перемальовувань компонента за 1.4 с
    // були зайвими. Рендер лише двічі: старт і фініш.
    const paint = (t: number) => {
      STATS.forEach((s, i) => {
        const n = nums.current[i];
        if (n) n.textContent = `${s.prefix ?? ''}${Math.round(s.to * t)}${s.suffix ?? ''}`;
        const tail = tails.current[i];
        if (tail) tail.classList.toggle('show', t > 0.85);
      });
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { paint(1); setStarted(true); return; }
    paint(0);
    let raf = 0;
    const o = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      o.disconnect();
      setStarted(true);
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / 1400);
        paint(ease(p));
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
            <span ref={n => { nums.current[i] = n; }}>{s.prefix}{s.to}{s.suffix}</span>
            {s.tail && <span className="ss-tail" ref={n => { tails.current[i] = n; }}>{s.tail}</span>}
          </div>
          <div className="ss-label">{s.label}</div>
        </div>
      ))}
      <style jsx>{`
        .ss { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; text-align: center; border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; padding: 2.5rem 0; }
        .ss-num { font-size: 3rem; font-weight: 900; color: #111827; margin-bottom: 0.2rem; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; }
        .ss-tail { display: inline-block; opacity: 0; transform: translateY(6px); transition: opacity .35s ease, transform .45s cubic-bezier(.34,1.56,.64,1); }
        .ss-tail.show { opacity: 1; transform: none; }
        @media (prefers-reduced-motion: reduce) { .ss-tail { opacity: 1; transform: none; transition: none; } }
        .ss-label { color: #64748b; font-weight: 500; font-size: 0.95rem; opacity: 0; transform: translateY(10px); transition: opacity .7s ease, transform .8s cubic-bezier(.16,1,.3,1); transition-delay: calc(var(--i) * .12s + .25s); }
        .ss.on .ss-label { opacity: 1; transform: none; }
        @media (prefers-reduced-motion: reduce) { .ss-label { transition: none; opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}
