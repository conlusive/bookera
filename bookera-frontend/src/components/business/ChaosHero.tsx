'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Caveat } from 'next/font/google';

/**
 * Перший екран: «Хаос → порядок». Лівий край - заголовок про те, що справді коїться в майстра
 * (записи в Direct, нотатки, блокнот), праворуч - сцена: розкидані клопоти злітаються в один календар.
 * Це єдина самостійна анімація сторінки; повторити її можна кнопкою.
 *
 * Кольоровий хаос і спокійний матчевий календар: колір тут несе зміст.
 */
const hand = Caveat({ subsets: ['latin', 'cyrillic'], weight: ['500'], display: 'swap' });

type Frag = { id: string; chaos: { l: number; t: number; r: number }; order: { l: number; t: number }; node: ReactNode; cls: string };

const FRAGS: Frag[] = [
  { id: 'dm', cls: 'f-dm', chaos: { l: -1, t: 3, r: -6 }, order: { l: 22, t: 31 },
    node: <><span className="f-meta">Direct, нове повідомлення</span><span className="f-text">Запишете мене на пʼятницю?</span></> },
  { id: 'paper', cls: 'f-paper', chaos: { l: 60, t: 0, r: 5 }, order: { l: 22, t: 43 },
    node: <span className={`f-hand ${hand.className}`}>Олена 14:00?? перенесла на 15</span> },
  { id: 'note', cls: 'f-note', chaos: { l: 62, t: 70, r: -4 }, order: { l: 22, t: 55 },
    node: <><span className="f-meta">Нотатки</span><span className="f-text">Марія: формула 7.1, алергія на аміак</span></> },
  { id: 'sticky', cls: 'f-sticky', chaos: { l: 4, t: 76, r: 4 }, order: { l: 22, t: 67 },
    node: <span className={`f-hand ${hand.className}`}>не забути нагадати Ірині про візит!</span> },
];

const SLOTS = [
  { t: '10:00', n: 'Стрижка · Макс', c: '#6F9273', bg: '#E3EFE5' },
  { t: '14:00', n: 'Манікюр · Олена', c: '#F28BB0', bg: '#FBE2EA' },
  { t: '16:00', n: 'Фарбування · Марія', c: '#AFC0F5', bg: '#E1E8FB' },
  { t: '17:30', n: 'Консультація · Ірина', c: '#F2A168', bg: '#FCE6D5' },
];

export default function ChaosHero({ ctaLabel, onStart, onMore, trialLine }: { ctaLabel: string; onStart: () => void; onMore: () => void; trialLine?: string }) {
  const [phase, setPhase] = useState<'chaos' | 'order'>('chaos');
  const timers = useRef<number[]>([]);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const play = useCallback((delay = 1700) => {
    clear();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setPhase('order'); return; }
    setPhase('chaos');
    timers.current.push(window.setTimeout(() => setPhase('order'), delay));
  }, []);

  useEffect(() => { play(1700); return clear; }, [play]);

  const replay = () => { clear(); setPhase('chaos'); timers.current.push(window.setTimeout(() => play(900), 100)); };

  return (
    <section className="ch">
      <div className="container ch-grid">
        <div className="ch-text">
          <h1>Записи в Direct, нотатки в телефоні, блокнот на столі.</h1>
          <p className="ch-lead">BookEra збирає все в один календар: клієнти записуються самі, нагадування йдуть самі, а ви працюєте.</p>
          <div className="ch-cta">
            <button type="button" className="btn-primary" onClick={onStart}>{ctaLabel}</button>
            <button type="button" className="btn-secondary" onClick={onMore}>Які клопоти знімаємо</button>
          </div>
          {trialLine && <p className="ch-trial">{trialLine}</p>}
        </div>

        <div className="ch-stage-wrap">
          <div className={`ch-stage ${phase}`} aria-label="Розкидані записи збираються в один календар">
            <div className="cw">
              <div className="cw-bar"><i /><i /><i /><span>Сьогодні</span></div>
              {SLOTS.map((s, i) => (
                <div key={s.t} className="slot" style={{ ['--i' as string]: i, top: `${22 + i * 18}%`, background: s.bg, borderColor: s.c }}>
                  <b>{s.t}</b><span>{s.n}</span>
                </div>
              ))}
            </div>
            {FRAGS.map((f, i) => (
              <div key={f.id} className={`fr ${f.cls}`} style={{
                ['--i' as string]: i,
                left: `${phase === 'chaos' ? f.chaos.l : f.order.l}%`,
                top: `${phase === 'chaos' ? f.chaos.t : f.order.t}%`,
                ['--r' as string]: `${f.chaos.r}deg`,
              }}>
                <div className="fr-in">{f.node}</div>
              </div>
            ))}
            <div className="done"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>Усе в одному місці</div>
          </div>
          <button type="button" className="ch-replay" onClick={replay}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" /></svg>
            Показати ще раз
          </button>
        </div>
      </div>

      <style jsx>{`
        .ch { padding: 150px 0 4rem; background: #fff; }
        .ch-grid { display: grid; grid-template-columns: 1.02fr 0.98fr; gap: 3rem; align-items: center; }
        .ch-text h1 { font-size: clamp(2.3rem, 4.6vw, 4rem); font-weight: 800; letter-spacing: -0.035em; line-height: 1.06; color: #1E2124; margin: 0 0 1.5rem; max-width: 14.5em; }
        .ch-lead { font-size: clamp(1.05rem, 1.7vw, 1.22rem); line-height: 1.6; color: #475569; max-width: 30em; margin: 0 0 2.25rem; }
        .ch-cta { display: flex; gap: 0.9rem; flex-wrap: wrap; }
        .ch-trial { margin: 1.4rem 0 0; font-size: 0.95rem; color: #475569; }

        .ch-stage-wrap { display: flex; flex-direction: column; align-items: center; gap: 0.9rem; }
        .ch-stage { position: relative; width: 100%; max-width: 560px; aspect-ratio: 1 / 0.96; --ease: cubic-bezier(.65, 0, .35, 1); }

        .cw { position: absolute; left: 12%; top: 14%; width: 76%; height: 70%; border-radius: 22px; background: #F3F8F4; border: 1px solid #dfe8e0; box-shadow: 0 22px 46px rgba(46,58,48,.09); overflow: hidden; }
        .cw-bar { height: 12%; display: flex; align-items: center; gap: 6px; padding: 0 5%; background: #fff; border-bottom: 1px solid #e6ede7; }
        .cw-bar i { width: 9px; height: 9px; border-radius: 50%; background: #d6ddd7; }
        .cw-bar span { margin-left: auto; font-size: 0.78rem; font-weight: 700; color: #475569; }
        .slot { position: absolute; left: 7%; right: 7%; height: 14.5%; border-left: 4px solid; border-radius: 10px; padding: 0 5%; display: flex; align-items: center; gap: 0.7rem; font-size: clamp(0.72rem, 1.5vw, 0.9rem); color: #1E2124; opacity: 0; transform: translateY(6px); transition: opacity .5s ease, transform .6s var(--ease); }
        .slot b { font-weight: 800; }
        .slot span { font-weight: 600; }
        .order .slot { opacity: 1; transform: none; transition-delay: calc(.75s + var(--i) * .16s); }

        .fr { position: absolute; transition: left 1s var(--ease), top 1s var(--ease), transform 1s var(--ease), opacity .35s ease .7s; transform: rotate(var(--r)); z-index: 3; }
        .fr-in { display: flex; flex-direction: column; gap: 0.25rem; animation: drift 5s ease-in-out infinite; animation-delay: calc(var(--i) * -1.1s); box-shadow: 0 8px 20px rgba(17,24,39,.12); }
        .order .fr { transform: rotate(0deg) scale(.45); opacity: 0; }
        .order .fr-in { animation: none; }
        @keyframes drift { 0%, 100% { translate: 0 0; } 50% { translate: 0 -5px; } }
        .f-meta { font-size: 0.68rem; font-weight: 700; color: #64748b; }
        .f-text { font-size: 0.9rem; font-weight: 600; color: #1E2124; line-height: 1.3; }
        .f-hand { font-size: 1.25rem; line-height: 1.15; color: #2a2a2a; }
        .f-dm .fr-in { background: #FDE3EC; border-radius: 18px 18px 18px 4px; padding: 0.7rem 0.95rem; width: 11.6rem; }
        .f-paper .fr-in { background: #FFFDF6 repeating-linear-gradient(transparent 0 1.38rem, #dfe6f3 1.38rem 1.45rem); border-radius: 4px; padding: 0.55rem 0.9rem 0.65rem; width: 11rem; }
        .f-note .fr-in { background: #fff; border: 1px solid #e3e6ea; border-radius: 14px; padding: 0.7rem 0.95rem; width: 11.4rem; }
        .f-sticky .fr-in { background: #F7B98C; border-radius: 3px 3px 14px 3px; padding: 0.8rem 0.95rem; width: 9.6rem; }

        .done { position: absolute; left: 50%; bottom: 3%; translate: -50% 8px; display: inline-flex; align-items: center; gap: 0.5rem; background: #3F6B49; color: #fff; font-weight: 700; font-size: 0.88rem; border-radius: 999px; padding: 0.5rem 1.1rem 0.5rem 0.55rem; opacity: 0; transition: opacity .5s ease, translate .6s var(--ease); white-space: nowrap; }
        .done svg { width: 18px; height: 18px; background: rgba(255,255,255,.18); border-radius: 50%; padding: 3px; }
        .order .done { opacity: 1; translate: -50% 0; transition-delay: 1.9s; }

        .ch-replay { display: inline-flex; align-items: center; gap: 0.45rem; background: none; border: none; color: #475569; font-weight: 600; font-size: 0.9rem; cursor: pointer; padding: 0.4rem 0.6rem; border-radius: 8px; }
        .ch-replay:hover { color: #1E2124; background: #f3f5f3; }
        .ch-replay:focus-visible { outline: 3px solid #1E2124; outline-offset: 2px; }

        @media (max-width: 960px) {
          .ch { padding-top: 120px; }
          .ch-grid { grid-template-columns: 1fr; gap: 2.5rem; }
          .ch-stage { max-width: 480px; }
        }
        @media (max-width: 480px) { .f-dm .fr-in { width: 8.6rem; } .f-paper .fr-in { width: 8.4rem; } .f-note .fr-in { width: 8.6rem; } .f-sticky .fr-in { width: 7.4rem; } .f-hand { font-size: 1.1rem; } }
        @media (prefers-reduced-motion: reduce) {
          .fr, .slot, .done { transition: none; }
          .fr-in { animation: none; }
        }
      `}</style>
    </section>
  );
}
