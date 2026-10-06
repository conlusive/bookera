'use client';

import { useRef } from 'react';
import { motion, MotionConfig, useScroll, useTransform } from 'motion/react';

/**
 * Велика фото-смуга на всю ширину: «Оберіть. Запишіться. Приходьте.» Фото повільно зміщується при гортанні.
 */
const IMG = 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=2000&q=80';

export default function PhotoBanner({ onFind }: { onFind: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['-9%', '9%']);
  return (
    <MotionConfig reducedMotion="user">
      <section ref={ref} className="pb">
        <motion.img src={IMG} alt="" loading="lazy" className="pb-img" style={{ y }} draggable={false} />
        <div className="pb-shade" />
        <div className="container pb-in">
          <motion.h2 initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ type: 'spring', stiffness: 120, damping: 18 }}>
            Оберіть. Запишіться. Приходьте.
          </motion.h2>
          <button type="button" onClick={onFind}>Знайти заклад</button>
        </div>
        <style jsx global>{`
          .pb { position: relative; height: clamp(440px, 62vw, 680px); overflow: hidden; background: #1D1D1F; }
          .pb-img { position: absolute; left: 0; top: -10%; width: 100%; height: 120%; object-fit: cover; user-select: none; }
          .pb-shade { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(0,0,0,.62) 0%, rgba(0,0,0,.18) 70%); }
          .pb-in { position: relative; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; gap: 2rem; }
          .pb-in h2 { margin: 0; max-width: 9em; color: #fff; font-size: clamp(2.6rem, 6.6vw, 5.4rem); font-weight: 700; letter-spacing: -0.045em; line-height: 1.02; }
          .pb-in button { background: #fff; color: #1D1D1F; border: none; font: inherit; font-weight: 700; font-size: 1.05rem; padding: 1rem 2.3rem; border-radius: 999px; cursor: pointer; transition: transform .25s ease; }
          .pb-in button:hover { transform: scale(1.05); } .pb-in button:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }
        `}</style>
      </section>
    </MotionConfig>
  );
}
