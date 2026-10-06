'use client';

import { CATEGORIES } from '@/lib/categories';
import { useReveal } from './useReveal';

/** «Для тих, хто працює за записом»: хмара справжніх категорій платформи (той самий список, що в реєстрації). */
export default function ForWhom() {
  const [ref, shown] = useReveal<HTMLDivElement>(0.2);
  return (
    <section className="fw">
      <div className="container">
        <h2 className="fw-title">Для тих, хто<br />працює за записом.</h2>
        <div ref={ref} className={`fw-cloud ${shown ? 'on' : ''}`}>
          {CATEGORIES.filter(c => c.slug !== 'other').map((c, i) => (
            <span key={c.slug} className="fw-chip" style={{ ['--i' as string]: i, ['--r' as string]: `${((i * 7) % 5) - 2}deg` }}>{c.title}</span>
          ))}
          <span className="fw-chip more" style={{ ['--i' as string]: 14 }}>і не тільки</span>
        </div>
      </div>
      <style jsx>{`
        .fw { padding: 6rem 0 2rem; background: #fff; }
        .fw-title { font-size: clamp(2rem, 4.4vw, 3.25rem); font-weight: 700; letter-spacing: -0.035em; line-height: 1.08; color: #1D1D1F; margin: 0 0 2.5rem; }
        .fw-cloud { display: flex; flex-wrap: wrap; gap: 0.8rem; max-width: 980px; }
        .fw-chip { background: #F3F8F4; border: 1px solid #dfe8e0; color: #1f2937; font-weight: 600; font-size: 1.02rem; padding: 0.7rem 1.25rem; border-radius: 999px; opacity: 0; transform: translateY(14px) rotate(var(--r)); transition: opacity .6s ease, transform .7s cubic-bezier(.16,1,.3,1); transition-delay: calc(var(--i) * 45ms); }
        .fw-cloud.on .fw-chip { opacity: 1; transform: rotate(var(--r)); }
        .fw-chip.more { background: #111827; border-color: #111827; color: #fff; }
        @media (prefers-reduced-motion: reduce) { .fw-chip { transition: none; opacity: 1; transform: none !important; } }
      `}</style>
    </section>
  );
}
