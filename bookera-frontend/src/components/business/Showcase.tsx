'use client';

import { motion, MotionConfig } from 'motion/react';

/**
 * «Увесь день на одному екрані»: велике вікно календаря на світлій панелі, записи зʼявляються по черзі,
 * потім приходить новий онлайн-запис. Під ним три короткі переваги без рамок.
 * Імена й послуги в календарі умовні (ілюстрація).
 */
const MASTERS = ['Макс', 'Олена', 'Ірина'];
const HOURS = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
// col - майстер, from/len - у годинах від 10:00
const SLOTS = [
  { col: 0, from: 0, len: 1, t: 'Стрижка', c: '#6F9273', bg: '#E3EFE5' },
  { col: 0, from: 2.5, len: 1.5, t: 'Борода й догляд', c: '#AFC0F5', bg: '#E1E8FB' },
  { col: 0, from: 5, len: 1, t: 'Стрижка', c: '#6F9273', bg: '#E3EFE5' },
  { col: 1, from: 1, len: 2, t: 'Манікюр', c: '#F28BB0', bg: '#FBE2EA' },
  { col: 1, from: 4, len: 1.5, t: 'Педикюр', c: '#F28BB0', bg: '#FBE2EA' },
  { col: 2, from: 0.5, len: 1.5, t: 'Фарбування', c: '#F2A168', bg: '#FCE6D5' },
  { col: 2, from: 3, len: 2.5, t: 'Консультація й укладка', c: '#F2A168', bg: '#FCE6D5' },
];

const spring = { type: 'spring' as const, stiffness: 140, damping: 18 };

const BENEFITS = [
  { t: 'Клієнти записуються самі', d: 'За вашим посиланням чи QR-кодом, будь-якої години. Ви отримуєте сповіщення.' },
  { t: 'Нагадування йдуть самі', d: 'Лист клієнту за добу до візиту. Менше неявок без жодного дзвінка.' },
  { t: 'Уся команда в одному розкладі', d: 'Кожен майстер бачить свій день, а власник бачить усіх.' },
];

export default function Showcase() {
  return (
    <MotionConfig reducedMotion="user">
      <section id="features" className="sc" style={{ scrollMarginTop: '80px' }}>
        <div className="container">
          <h2 className="sc-h">Увесь день. На одному екрані.</h2>
          <p className="sc-s">Записи всієї команди з телефону чи компʼютера, без накладок і блокнотів.</p>

          <motion.div className="sc-panel" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ ...spring, delay: 0.05 }}>
            <div className="cal">
              <div className="cal-bar"><i /><i /><i /><b>Сьогодні</b></div>
              <div className="cal-head">
                <span />
                {MASTERS.map(m => <span key={m}>{m}</span>)}
              </div>
              <div className="cal-body">
                <div className="cal-hours">{HOURS.map(h => <span key={h}>{h}</span>)}</div>
                <div className="cal-cols">
                  {MASTERS.map((m, ci) => (
                    <div key={m} className="cal-col">
                      {SLOTS.filter(s => s.col === ci).map((s, i) => (
                        <motion.div key={i} className="cal-slot"
                          style={{ top: `${(s.from / 7) * 100}%`, height: `${(s.len / 7) * 100}%`, background: s.bg, borderColor: s.c }}
                          initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }}
                          viewport={{ once: true, margin: '-60px' }} transition={{ ...spring, delay: 0.3 + (ci * 3 + i) * 0.09 }}>
                          {s.t}
                        </motion.div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <motion.div className="cal-toast" initial={{ opacity: 0, y: -14, scale: 0.94 }} whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: '-60px' }} transition={{ ...spring, delay: 1.7 }}>
                <span className="cal-tick"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
                <span><b>Новий запис онлайн</b><small>Манікюр · Олена, завтра</small></span>
              </motion.div>
            </div>
          </motion.div>

          <div className="sc-ben">
            {BENEFITS.map((b, i) => (
              <motion.div key={b.t} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ ...spring, delay: i * 0.1 }}>
                <h3>{b.t}</h3>
                <p>{b.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
        <style jsx global>{`
          .sc { padding: 3rem 0 6rem; background: #fff; }
          .sc-h { text-align: center; font-size: clamp(2.2rem, 5vw, 4rem); font-weight: 700; letter-spacing: -0.04em; line-height: 1.05; color: #1D1D1F; margin: 0 0 1rem; }
          .sc-s { text-align: center; font-size: clamp(1.05rem, 1.8vw, 1.3rem); color: #6E6E73; max-width: 34em; margin: 0 auto 3.5rem; line-height: 1.5; }
          .sc-panel { background: #F5F5F7; border-radius: 36px; padding: clamp(1.2rem, 4vw, 3.5rem); }
          .cal { position: relative; max-width: 940px; margin: 0 auto; background: #fff; border-radius: 20px; box-shadow: 0 30px 70px rgba(0,0,0,.10); overflow: hidden; }
          .cal-bar { display: flex; align-items: center; gap: 7px; height: 42px; padding: 0 18px; border-bottom: 1px solid #efeff2; }
          .cal-bar i { width: 11px; height: 11px; border-radius: 50%; background: #e1e1e6; }
          .cal-bar b { margin-left: auto; font-size: 0.85rem; color: #1D1D1F; }
          .cal-head { display: grid; grid-template-columns: 56px repeat(3, 1fr); padding: 0.8rem 0.6rem 0.4rem 0; font-size: 0.85rem; font-weight: 700; color: #1D1D1F; text-align: center; }
          .cal-body { display: grid; grid-template-columns: 56px 1fr; padding: 0 0.6rem 1.2rem 0; height: clamp(300px, 42vw, 440px); }
          .cal-hours { display: flex; flex-direction: column; justify-content: space-between; padding: 0 0.6rem 0 0; font-size: 0.72rem; font-weight: 600; color: #9a9aa3; text-align: right; }
          .cal-cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; background-image: linear-gradient(#f0f0f3 1px, transparent 1px); background-size: 100% calc(100% / 7); }
          .cal-col { position: relative; }
          .cal-slot { position: absolute; left: 3px; right: 3px; border-left: 4px solid; border-radius: 10px; padding: 0.4rem 0.6rem; font-size: clamp(0.66rem, 1.3vw, 0.86rem); font-weight: 700; color: #1D1D1F; overflow: hidden; }
          .cal-toast { position: absolute; right: 18px; top: 52px; display: flex; align-items: center; gap: 10px; background: #1D1D1F; color: #fff; border-radius: 14px; padding: 0.65rem 1rem 0.65rem 0.7rem; box-shadow: 0 14px 30px rgba(0,0,0,.25); }
          .cal-toast b { display: block; font-size: 0.85rem; } .cal-toast small { color: rgba(255,255,255,.7); font-size: 0.75rem; }
          .cal-tick { width: 24px; height: 24px; border-radius: 50%; background: #5E9A6A; display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; }
          .cal-tick svg { width: 13px; height: 13px; }
          .sc-ben { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3rem; margin-top: 4rem; }
          .sc-ben h3 { font-size: 1.3rem; font-weight: 700; letter-spacing: -0.02em; color: #1D1D1F; margin: 0 0 0.5rem; }
          .sc-ben p { color: #6E6E73; font-size: 1.02rem; line-height: 1.55; margin: 0; }
          @media (max-width: 800px) { .sc-ben { grid-template-columns: 1fr; gap: 2rem; } .cal-toast { display: none; } .cal-head { grid-template-columns: 44px repeat(3, 1fr); } .cal-body { grid-template-columns: 44px 1fr; } }
        `}</style>
      </section>
    </MotionConfig>
  );
}
