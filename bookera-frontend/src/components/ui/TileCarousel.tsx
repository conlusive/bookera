'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { motion, MotionConfig } from 'motion/react';

/**
 * Безкінечна горизонтальна стрічка великих плиток (як у Apple): стрілки завжди активні, свайп і колесо теж
 * ідуть по колу. Плитки продубльовані тричі, і коли прокрутка зупиняється біля краю, стрічка непомітно
 * переставляється в середній набір (плитки однакові, шва не видно). Вміст плитки задає той, хто викликає.
 */
const spring = { type: 'spring' as const, stiffness: 160, damping: 20 };

export type TileItem = { key: string; node: ReactNode; photo?: boolean };

export default function TileCarousel({ title, items, label }: { title: string; items: TileItem[]; label: string }) {
  const rail = useRef<HTMLDivElement>(null);
  const idle = useRef<number>(0);
  const N = items.length;

  const normalize = () => {
    const el = rail.current; if (!el) return;
    const t = el.querySelectorAll<HTMLElement>('.tile');
    if (t.length < N * 3) return;
    const set = t[N].offsetLeft - t[0].offsetLeft;
    let p = el.scrollLeft;
    if (p < set * 0.5) p += set; else if (p >= set * 1.5) p -= set; else return;
    el.style.scrollSnapType = 'none';
    el.scrollLeft = p;
    requestAnimationFrame(() => { el.style.scrollSnapType = ''; });
  };

  useEffect(() => {
    const el = rail.current; if (!el) return;
    const t = el.querySelectorAll<HTMLElement>('.tile');
    if (t.length >= N * 3) { el.style.scrollSnapType = 'none'; el.scrollLeft = t[N].offsetLeft - t[0].offsetLeft; requestAnimationFrame(() => { el.style.scrollSnapType = ''; }); }
    return () => window.clearTimeout(idle.current);
  }, [N]);

  const onScroll = () => { window.clearTimeout(idle.current); idle.current = window.setTimeout(normalize, 140); };
  const scrollBy = (dir: 1 | -1) => {
    const el = rail.current; if (!el) return;
    const t = el.querySelectorAll<HTMLElement>('.tile');
    const step = t.length > 1 ? t[1].offsetLeft - t[0].offsetLeft : 460;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };
  const tiles = [...items, ...items, ...items];

  return (
    <MotionConfig reducedMotion="user">
      <section className="hl">
        <div className="container hl-top">
          <h2>{title}</h2>
          <div className="hl-nav">
            <button type="button" onClick={() => scrollBy(-1)} aria-label="Назад"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg></button>
            <button type="button" onClick={() => scrollBy(1)} aria-label="Далі"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg></button>
          </div>
        </div>
        <motion.div className="hl-rail" ref={rail} onScroll={onScroll} tabIndex={0} aria-label={label}
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={spring}>
          <div className="hl-pad" />
          {tiles.map((t, i) => (
            <motion.article key={`${t.key}-${i}`} className={`tile ${t.photo ? 'photo' : ''}`} aria-hidden={i < N || i >= N * 2 ? true : undefined} whileHover={{ y: -6 }} transition={spring}>
              {t.node}
            </motion.article>
          ))}
          <div className="hl-pad" />
        </motion.div>
        <style jsx global>{`
          .hl { padding: 5rem 0 6rem; background: #fff; }
          .hl-top { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 2rem; }
          .hl-top h2 { font-size: clamp(2rem, 4.6vw, 3.4rem); font-weight: 700; letter-spacing: -0.035em; line-height: 1.05; color: #1D1D1F; margin: 0; }
          .hl-nav { display: flex; gap: 0.6rem; }
          .hl-nav button { width: 44px; height: 44px; border-radius: 50%; border: none; background: #E8E8ED; color: #1D1D1F; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: background .2s ease, opacity .2s ease; }
          .hl-nav button:hover { background: #d9d9df; }
          .hl-nav button:focus-visible, .hl-rail:focus-visible { outline: 3px solid #1D1D1F; outline-offset: 3px; }
          .hl-rail { display: flex; gap: 1.25rem; overflow-x: auto; scroll-snap-type: x mandatory; padding: 0.5rem 0 1.5rem; scrollbar-width: none; }
          .hl-rail::-webkit-scrollbar { display: none; }
          .hl-pad { flex: 0 0 max(1.5rem, calc((100vw - 1340px) / 2 + 4rem)); }
          .tile { flex: 0 0 min(430px, 82vw); height: 540px; background: #F5F5F7; border-radius: 30px; padding: 2.2rem 2rem 0; display: flex; flex-direction: column; scroll-snap-align: start; overflow: hidden; }
          .tile.photo { padding: 0; }
          .tile h3 { margin: 0 0 1.4rem; font-size: 1.5rem; line-height: 1.25; letter-spacing: -0.02em; font-weight: 600; color: #6E6E73; }
          .tile h3 b { color: #1D1D1F; font-weight: 700; }
          .tile-art { margin-top: auto; padding-bottom: 1.6rem; }

          @media (max-width: 700px) { .tile { height: 520px; } }
        `}</style>
      </section>
    </MotionConfig>
  );
}
