'use client';

import { motion, MotionConfig } from 'motion/react';
import { STYLE_TIPS } from './styleTips';

/** «Поради майстрів»: чотири поради як великі статті, фото й текст по черзі ліворуч і праворуч. */
const spring = { type: 'spring' as const, stiffness: 120, damping: 20 };

export default function TipsEditorial() {
  // Починаємо з другої поради: перша має те саме фото, що фото-смуга вище
  const tips = STYLE_TIPS.slice(1, 5);
  return (
    <MotionConfig reducedMotion="user">
      <section className="te">
        <div className="container">
          <h2 className="te-h">Поради майстрів.</h2>
          {tips.map((t, i) => (
            <motion.article key={t.title} className={`te-row ${i % 2 ? 'flip' : ''}`} initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={spring}>
              <div className="te-photo"><img src={t.img.replace('w=1800', 'w=1200')} alt="" loading="lazy" draggable={false} /></div>
              <div className="te-text">
                <small>{t.tag}</small>
                <h3>{t.title}</h3>
                <p>{t.text}</p>
              </div>
            </motion.article>
          ))}
        </div>
        <style jsx global>{`
          .te { padding: 7rem 0 3rem; background: #fff; }
          .te-h { font-size: clamp(2.2rem, 5vw, 4rem); font-weight: 700; letter-spacing: -0.04em; line-height: 1.05; color: #1D1D1F; margin: 0 0 3.5rem; }
          .te-row { display: grid; grid-template-columns: 1.25fr 1fr; gap: clamp(2rem, 6vw, 5rem); align-items: center; margin-bottom: clamp(3.5rem, 8vw, 6.5rem); }
          .te-row.flip { grid-template-columns: 1fr 1.25fr; } .te-row.flip .te-photo { order: 2; }
          .te-photo { aspect-ratio: 4 / 3; border-radius: 32px; overflow: hidden; background: #e9e9ee; }
          .te-photo img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 1.1s cubic-bezier(.16,1,.3,1); user-select: none; }
          .te-row:hover .te-photo img { transform: scale(1.04); }
          .te-text small { color: #3F6B49; font-weight: 700; font-size: .95rem; }
          .te-text h3 { margin: .5rem 0 1rem; font-size: clamp(1.7rem, 3.2vw, 2.6rem); font-weight: 700; letter-spacing: -.03em; line-height: 1.12; color: #1D1D1F; }
          .te-text p { margin: 0; color: #6E6E73; font-size: 1.12rem; line-height: 1.65; max-width: 30em; }
          @media (max-width: 820px) { .te-row, .te-row.flip { grid-template-columns: 1fr; gap: 1.4rem; } .te-row.flip .te-photo { order: 0; } }
        `}</style>
      </section>
    </MotionConfig>
  );
}
