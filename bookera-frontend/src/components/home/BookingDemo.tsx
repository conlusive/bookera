'use client';

import { useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';

/**
 * «Запис без дзвінків»: жива міні-версія запису. Оберіть послугу, день і час, натисніть «Записатися»:
 * з'являється підтвердження з нагадуванням. Це приклад (імена, дні й час умовні), справжній запис робиться на сторінці закладу.
 */
const spring = { type: 'spring' as const, stiffness: 160, damping: 20 };
const SERVICES = ['Стрижка', 'Манікюр', 'Брови'];
const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const TIMES = ['10:00', '11:30', '13:00', '14:30', '16:00', '17:30'];
const BUSY: Record<string, string[]> = { Пн: ['11:30', '16:00'], Вт: ['10:00', '13:00', '17:30'], Ср: ['14:30'], Чт: ['10:00', '11:30'], Пт: ['13:00', '16:00'], Сб: ['10:00', '14:30', '17:30'] };

export default function BookingDemo() {
  const [service, setService] = useState('Стрижка');
  const [day, setDay] = useState('Ср');
  const [time, setTime] = useState<string | null>('13:00');
  const [done, setDone] = useState(false);

  const pickDay = (d: string) => { setDay(d); setDone(false); if (time && BUSY[d].includes(time)) setTime(null); };
  const pickTime = (t: string) => { setTime(t); setDone(false); };

  return (
    <MotionConfig reducedMotion="user">
      <section className="bk">
        <div className="container">
          <h2 className="bk-h">Запис без дзвінків.</h2>
          <p className="bk-s">Бачите вільні години й записуєтесь самі, без дзвінків і переписки. Спробуйте.</p>

          <motion.div className="bk-panel" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={spring}>
            <div className="bk-card">
              <div className="bk-row" role="group" aria-label="Послуга">
                {SERVICES.map(s => <button key={s} type="button" aria-pressed={service === s} className={service === s ? 'on' : ''} onClick={() => { setService(s); setDone(false); }}>{s}</button>)}
              </div>
              <div className="bk-days" role="group" aria-label="День">
                {DAYS.map(d => <button key={d} type="button" aria-pressed={day === d} className={day === d ? 'on' : ''} onClick={() => pickDay(d)}>{d}</button>)}
              </div>
              <div className="bk-times" role="group" aria-label="Час">
                {TIMES.map(t => {
                  const busy = BUSY[day].includes(t);
                  return <button key={t} type="button" disabled={busy} aria-pressed={time === t} className={time === t ? 'on' : ''} onClick={() => pickTime(t)}>{t}</button>;
                })}
              </div>
              <button type="button" className="bk-go" disabled={!time} onClick={() => setDone(true)}>Записатися</button>

              <AnimatePresence>
                {done && time && (
                  <motion.div className="bk-done" initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={spring} role="status">
                    <span className="bk-tick"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
                    <span><b>Запис підтверджено</b><small>{service} · {day}, {time}. Нагадаємо за добу.</small></span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
          <p className="bk-note">Приклад: імена, дні й час умовні. Справжній запис робиться на сторінці закладу.</p>
        </div>
        <style jsx global>{`
          .bk { padding: 7rem 0 4rem; background: #fff; }
          .bk-h { text-align: center; font-size: clamp(2.2rem, 5vw, 4rem); font-weight: 700; letter-spacing: -0.04em; line-height: 1.05; color: #1D1D1F; margin: 0 0 1rem; }
          .bk-s { text-align: center; font-size: clamp(1.05rem, 1.8vw, 1.3rem); color: #6E6E73; max-width: 32em; margin: 0 auto 3rem; line-height: 1.5; }
          .bk-panel { background: #F5F5F7; border-radius: 36px; padding: clamp(1.2rem, 4vw, 3.5rem); display: flex; justify-content: center; }
          .bk-card { position: relative; width: 100%; max-width: 560px; background: #fff; border-radius: 26px; padding: 1.8rem; box-shadow: 0 30px 70px rgba(0,0,0,.10); display: grid; gap: 1.1rem; }
          .bk-row, .bk-days, .bk-times { display: flex; flex-wrap: wrap; gap: .5rem; }
          .bk-row button, .bk-days button, .bk-times button { border: 1px solid #e3e3e8; background: #fff; color: #1D1D1F; font: inherit; font-weight: 600; font-size: .95rem; padding: .6rem 1.1rem; border-radius: 999px; cursor: pointer; transition: background .2s ease, color .2s ease, border-color .2s ease, transform .2s ease; }
          .bk-days button { flex: 1; padding: .6rem 0; border-radius: 14px; }
          .bk-times button { flex: 1 1 calc(33% - .5rem); border-radius: 14px; font-variant-numeric: tabular-nums; }
          .bk-row button:hover:not(.on), .bk-days button:hover:not(.on), .bk-times button:hover:not(:disabled):not(.on) { border-color: #1D1D1F; }
          .bk-row button.on, .bk-days button.on, .bk-times button.on { background: #1D1D1F; color: #fff; border-color: #1D1D1F; }
          .bk-times button:disabled { color: #b4b4bb; background: #f6f6f8; text-decoration: line-through; cursor: not-allowed; }
          .bk-row button:focus-visible, .bk-days button:focus-visible, .bk-times button:focus-visible, .bk-go:focus-visible { outline: 3px solid #1D1D1F; outline-offset: 2px; }
          .bk-go { margin-top: .3rem; background: #8fae92; color: #1D1D1F; font: inherit; font-weight: 700; font-size: 1.02rem; padding: 1rem; border: none; border-radius: 14px; cursor: pointer; transition: transform .2s ease, opacity .2s ease; }
          .bk-go:hover:not(:disabled) { transform: translateY(-2px); } .bk-go:disabled { opacity: .45; cursor: not-allowed; }
          .bk-done { display: flex; align-items: center; gap: .8rem; background: #1D1D1F; color: #fff; border-radius: 16px; padding: .9rem 1.1rem; }
          .bk-done b { display: block; font-size: .95rem; } .bk-done small { color: rgba(255,255,255,.72); font-size: .82rem; }
          .bk-tick { width: 28px; height: 28px; border-radius: 50%; background: #5E9A6A; display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; } .bk-tick svg { width: 15px; height: 15px; }
          .bk-note { text-align: center; color: #86868B; font-size: .85rem; margin: 1.2rem 0 0; }
          @media (max-width: 560px) { .bk-card { padding: 1.2rem; } .bk-times button { flex-basis: calc(50% - .5rem); } }
        `}</style>
      </section>
    </MotionConfig>
  );
}
