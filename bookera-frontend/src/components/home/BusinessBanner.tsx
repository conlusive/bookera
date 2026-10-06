'use client';

import Link from 'next/link';
import { motion, MotionConfig } from 'motion/react';

/**
 * «Ви майстер чи власник салону?»: світла панель-перехід на бізнес-сторінку з живим календарем.
 * Записи зʼявляються по черзі. Ті самі посилання, що були: /business і /business#features.
 */
const spring = { type: 'spring' as const, stiffness: 140, damping: 18 };
const SLOTS = [
  { t: '10:00', n: 'Стрижка', c: '#6F9273', bg: '#E3EFE5' },
  { t: '12:30', n: 'Манікюр', c: '#F28BB0', bg: '#FBE2EA' },
  { t: '15:00', n: 'Фарбування', c: '#F2A168', bg: '#FCE6D5' },
];

export default function BusinessBanner() {
  return (
    <MotionConfig reducedMotion="user">
      <section className="bb">
        <div className="container">
          <motion.div className="bb-panel" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={spring}>
            <div className="bb-text">
              <h2>Ви майстер чи власник салону?</h2>
              <p>Онлайн-запис, календар команди, клієнти, нагадування й розсилки в одному кабінеті.</p>
              <div className="bb-cta">
                <Link href="/business" className="bb-btn">Створити профіль</Link>
                <Link href="/business#features" className="bb-link">Усі можливості</Link>
              </div>
            </div>
            <div className="bb-cal" aria-hidden="true">
              <div className="bb-bar"><i /><i /><i /></div>
              {SLOTS.map((s, i) => (
                <motion.div key={s.t} className="bb-slot" style={{ background: s.bg, borderColor: s.c }}
                  initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ ...spring, delay: 0.3 + i * 0.15 }}>
                  <b>{s.t}</b><span>{s.n}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
        <style jsx global>{`
          .bb { padding: 3rem 0 6rem; background: #fff; }
          .bb-panel { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 3rem; align-items: center; background: #F5F5F7; border-radius: 36px; padding: clamp(2rem, 5vw, 4.5rem); }
          .bb-text h2 { font-size: clamp(2rem, 4.2vw, 3.2rem); font-weight: 700; letter-spacing: -0.035em; line-height: 1.08; color: #1D1D1F; margin: 0 0 1rem; max-width: 11em; }
          .bb-text p { color: #6E6E73; font-size: 1.15rem; line-height: 1.55; margin: 0 0 2rem; max-width: 28em; }
          .bb-cta { display: flex; align-items: center; gap: 1.6rem; flex-wrap: wrap; }
          .bb-btn { background: #1D1D1F; color: #fff; font-weight: 700; padding: 1rem 2.2rem; border-radius: 999px; text-decoration: none; transition: transform .25s ease; }
          .bb-btn:hover { transform: scale(1.04); } .bb-btn:focus-visible, .bb-link:focus-visible { outline: 3px solid #1D1D1F; outline-offset: 3px; }
          .bb-link { color: #1D1D1F; font-weight: 600; text-decoration: underline; text-decoration-color: #8fae92; text-decoration-thickness: 2px; text-underline-offset: 5px; }
          .bb-cal { background: #fff; border-radius: 22px; padding: 0 1.2rem 1.4rem; box-shadow: 0 30px 70px rgba(0,0,0,.10); display: grid; gap: .6rem; }
          .bb-bar { display: flex; gap: 6px; height: 38px; align-items: center; margin-bottom: .3rem; } .bb-bar i { width: 10px; height: 10px; border-radius: 50%; background: #e1e1e6; }
          .bb-slot { display: flex; gap: .8rem; align-items: center; border-left: 4px solid; border-radius: 12px; padding: .9rem 1rem; font-size: .98rem; color: #1D1D1F; } .bb-slot span { font-weight: 600; }
          @media (max-width: 860px) { .bb-panel { grid-template-columns: 1fr; gap: 2rem; } }
        `}</style>
      </section>
    </MotionConfig>
  );
}
