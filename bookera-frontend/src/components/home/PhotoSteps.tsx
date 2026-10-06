'use client';

import { motion, MotionConfig } from 'motion/react';

/** «Як це працює»: три кроки, кожен з фото. Це справді послідовність, тож кроки пронумеровані. */
const ph = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`;
const STEPS = [
  { n: '1', t: 'Знайдіть', d: 'Пошук за послугою, містом і датою. Спершу найближчі до вас заклади.', img: ph('1570172619644-dfd03ed5d881') },
  { n: '2', t: 'Запишіться', d: 'Бачите вільні години й записуєтесь самі, без дзвінків і переписки.', img: ph('1604654894610-df63bc536371') },
  { n: '3', t: 'Приходьте', d: 'Нагадаємо за добу, а за завершений візит повернемо 3% бонусами.', img: ph('1544161515-4ab6ce6db874') },
];
const spring = { type: 'spring' as const, stiffness: 130, damping: 20 };

export default function PhotoSteps() {
  return (
    <MotionConfig reducedMotion="user">
      <section className="ps">
        <div className="container">
          <h2 className="ps-h">Як це працює.</h2>
          <div className="ps-grid">
            {STEPS.map((s, i) => (
              <motion.div key={s.n} className="ps-step" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ ...spring, delay: i * 0.12 }}>
                <div className="ps-photo"><img src={s.img} alt="" loading="lazy" draggable={false} /><i>{s.n}</i></div>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
        <style jsx global>{`
          .ps { padding: 7rem 0 4rem; background: #fff; }
          .ps-h { font-size: clamp(2.2rem, 5vw, 4rem); font-weight: 700; letter-spacing: -0.04em; line-height: 1.05; color: #1D1D1F; margin: 0 0 3rem; }
          .ps-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.6rem; }
          .ps-photo { position: relative; aspect-ratio: 4 / 5; border-radius: 28px; overflow: hidden; background: #e9e9ee; margin-bottom: 1.3rem; }
          .ps-photo img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 1s cubic-bezier(.16,1,.3,1); user-select: none; }
          .ps-step:hover .ps-photo img { transform: scale(1.05); }
          .ps-photo i { position: absolute; left: 1.1rem; top: 1.1rem; width: 38px; height: 38px; border-radius: 50%; background: #fff; color: #1D1D1F; font-style: normal; font-weight: 800; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 18px rgba(0,0,0,.18); }
          .ps-step h3 { margin: 0 0 .4rem; font-size: 1.5rem; font-weight: 700; letter-spacing: -.025em; color: #1D1D1F; }
          .ps-step p { margin: 0; color: #6E6E73; font-size: 1.05rem; line-height: 1.55; max-width: 24em; }
          @media (max-width: 820px) { .ps-grid { grid-template-columns: 1fr; gap: 2.4rem; } .ps-photo { aspect-ratio: 16 / 11; } }
        `}</style>
      </section>
    </MotionConfig>
  );
}
