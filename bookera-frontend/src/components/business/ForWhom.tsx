'use client';

import { CATEGORIES } from '@/lib/categories';
import { useReveal } from './useReveal';

/**
 * «Для тих, хто працює за записом»: справжні категорії платформи (той самий список, що в реєстрації).
 * Плашки спокійно «дихають» різними темпами, поки блок у вікні, а при наведенні підстрибують
 * і підсвічуються кольором картки-віяла. Лише transform/opacity.
 */
const TINTS = ['#F2A168', '#F28BB0', '#9ED6A8', '#AFC0F5', '#C9B8F0'];

export default function ForWhom() {
  const [ref, shown] = useReveal<HTMLDivElement>(0.2);
  const list = CATEGORIES.filter(c => c.slug !== 'other');
  return (
    <section className="fw">
      <div className="container">
        <h2 className="fw-title">Для тих, хто<br />працює за записом.</h2>
        <div ref={ref} className={`fw-cloud ${shown ? 'on' : ''}`}>
          {list.map((c, i) => (
            <span key={c.slug} className="fw-slot" style={{ ['--i' as string]: i }}>
              <span className="fw-chip" style={{ ['--t' as string]: TINTS[i % TINTS.length], ['--d' as string]: `${3.2 + (i % 5) * 0.55}s` }}>{c.title}</span>
            </span>
          ))}
          <span className="fw-slot" style={{ ['--i' as string]: list.length }}><span className="fw-chip more" style={{ ['--d' as string]: '4s' }}>і не тільки</span></span>
        </div>
      </div>
      <style jsx>{`
        .fw { padding: 6rem 0 2rem; background: #fff; }
        .fw-title { font-size: clamp(2rem, 4.4vw, 3.25rem); font-weight: 700; letter-spacing: -0.035em; line-height: 1.08; color: #1D1D1F; margin: 0 0 2.5rem; }
        .fw-cloud { display: flex; flex-wrap: wrap; gap: 0.8rem; max-width: 980px; }
        .fw-slot { display: inline-block; opacity: 0; transform: translateY(16px); transition: opacity .6s ease, transform .7s cubic-bezier(.16,1,.3,1); transition-delay: calc(var(--i) * 50ms); }
        .fw-cloud.on .fw-slot { opacity: 1; transform: none; }
        .fw-chip { display: inline-block; background: #F5F5F7; border: 1px solid #e8e8ec; color: #1f2937; font-weight: 600; font-size: 1.02rem; padding: 0.7rem 1.25rem; border-radius: 999px; cursor: default; transition: background .25s ease, transform .3s cubic-bezier(.34,1.56,.64,1), border-color .25s ease; }
        .fw-cloud.on .fw-chip { animation: breathe var(--d) ease-in-out infinite; }
        .fw-chip:hover { background: var(--t, #111827); border-color: transparent; transform: scale(1.07) rotate(-1.5deg); animation: none; }
        .fw-chip.more { background: #111827; border-color: #111827; color: #fff; }
        .fw-chip.more:hover { background: #111827; }
        @keyframes breathe { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @media (prefers-reduced-motion: reduce) { .fw-slot { transition: none; opacity: 1; transform: none; } .fw-cloud.on .fw-chip { animation: none; } }
      `}</style>
    </section>
  );
}
