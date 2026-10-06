'use client';

import { useReveal } from './useReveal';

/**
 * «Старт за три кроки»: діагональ із зʼєднувальною лінією, що малюється при появі, і живі макети:
 * друкується назва, зростають рядки послуг, кнопка «Копіювати» стає «Скопійовано». Лише transform/opacity/clip.
 */
const COLORS = ['#F2A168', '#F28BB0', '#AFC0F5']; // палітра карток-віяла

function MockProfile() {
  return (
    <div className="m">
      <div className="m-label">Назва закладу</div>
      <div className="m-input"><span className="m-type">Ваш заклад</span><i className="m-caret" /></div>
      <div className="m-chips"><span>Категорія</span><span>Адреса</span><span>Години</span></div>
    </div>
  );
}
function MockServices() {
  return (
    <div className="m">
      {['Послуга', 'Послуга', 'Майстер'].map((t, i) => (
        <div key={i} className="m-line" style={{ ['--k' as string]: i }}>
          <span className="m-dot" /><span className="m-bar"><i style={{ width: `${88 - i * 18}%` }} /></span><span className="m-tag">{t}</span>
        </div>
      ))}
    </div>
  );
}
function MockLink() {
  return (
    <div className="m">
      <div className="m-pill">
        <span className="m-pill-t">Ваше посилання</span>
        <span className="m-copy"><b>Копіювати</b><b>Скопійовано ✓</b></span>
      </div>
      <div className="m-chips"><span>Instagram</span><span>QR-код</span><span>Візитка</span></div>
    </div>
  );
}

const STEPS = [
  { n: '01', t: 'Створіть профіль', d: 'Назва, категорія, адреса й години роботи. Майстер реєстрації веде крок за кроком.', m: <MockProfile /> },
  { n: '02', t: 'Додайте послуги й команду', d: 'Ціни, тривалість, майстри та їхній графік. Можна імпортувати клієнтів з Excel.', m: <MockServices /> },
  { n: '03', t: 'Діліться посиланням', d: 'В Instagram, на візитці чи через QR-код. Клієнти записуються самі, а ви отримуєте сповіщення.', m: <MockLink /> },
];

export default function StartSteps() {
  const [ref, shown] = useReveal<HTMLDivElement>(0.15);
  return (
    <section className="ss">
      <div className="container">
        <h2 className="ss-title">Старт за три кроки.</h2>
        <div ref={ref} className={`ss-grid ${shown ? 'on' : ''}`}>
          <svg className="ss-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M 4 8 C 30 8, 30 36, 50 36 S 70 66, 96 66" pathLength="1" />
          </svg>
          {STEPS.map((s, i) => (
            <div key={s.n} className="ss-step" style={{ ['--i' as string]: i, ['--c' as string]: COLORS[i] }}>
              <div className="ss-n"><span>{s.n}</span></div>
              <div className="ss-mock" aria-hidden="true">{s.m}</div>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
      </div>
      <style jsx>{`
        .ss { padding: 5rem 0 6.5rem; background: #fff; }
        .ss-title { font-size: clamp(2rem, 4.4vw, 3.25rem); font-weight: 700; letter-spacing: -0.035em; line-height: 1.08; color: #1D1D1F; margin: 0 0 3rem; }
        .ss-grid { position: relative; display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.5rem; align-items: start; }
        .ss-line { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; overflow: visible; }
        .ss-line path { fill: none; stroke: #cfd3d8; stroke-width: 1.5; stroke-dasharray: 0.012 0.012; vector-effect: non-scaling-stroke; opacity: 0; }
        .ss-grid.on .ss-line path { opacity: 1; animation: lineIn 1.6s ease-out .2s both; }
        @keyframes lineIn { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
        .ss-step { position: relative; z-index: 1; opacity: 0; transform: translateY(26px); transition: opacity .8s ease, transform .9s cubic-bezier(.16,1,.3,1); transition-delay: calc(var(--i) * .16s); }
        .ss-grid.on .ss-step { opacity: 1; transform: translateY(calc(var(--i) * 44px)); }
        .ss-n { margin-bottom: 1rem; }
        .ss-n span { display: inline-block; font-size: 0.9rem; font-weight: 800; letter-spacing: 0.06em; color: #111827; background: var(--c); border-radius: 999px; padding: 0.25rem 0.8rem; }
        .ss-mock { height: 168px; border-radius: 24px; background: #F5F5F7; padding: 1.4rem; margin-bottom: 1.5rem; display: flex; align-items: center; }
        .ss-step h3 { font-size: 1.35rem; font-weight: 700; letter-spacing: -0.02em; color: #111827; margin: 0 0 0.5rem; }
        .ss-step p { color: #475569; font-size: 1rem; line-height: 1.6; margin: 0; max-width: 340px; }
        :global(.m) { width: 100%; display: grid; gap: 0.7rem; }
        :global(.m-label) { font-size: 0.72rem; font-weight: 700; color: #64748b; letter-spacing: 0.04em; text-transform: uppercase; }
        :global(.m-input) { height: 38px; border-radius: 12px; background: #fff; border: 1px solid #e3e3e8; display: flex; align-items: center; padding: 0 0.85rem; font-size: 0.9rem; font-weight: 600; color: #111827; }
        :global(.m-type) { display: inline-block; overflow: hidden; white-space: nowrap; width: 0; }
        :global(.m-caret) { width: 2px; height: 18px; background: #111827; margin-left: 2px; animation: caret 1s steps(1) infinite; }
        :global(.ss-grid.on .m-type) { animation: typing 1.6s steps(11) .9s forwards; }
        @keyframes typing { to { width: 6.2em; } }
        @keyframes caret { 50% { opacity: 0; } }
        :global(.m-chips) { display: flex; gap: 0.45rem; flex-wrap: wrap; }
        :global(.m-chips span) { background: #fff; border: 1px solid #e3e3e8; border-radius: 999px; padding: 0.3rem 0.75rem; font-size: 0.78rem; font-weight: 600; color: #374151; }
        :global(.m-line) { display: flex; align-items: center; gap: 0.6rem; background: #fff; border: 1px solid #e3e3e8; border-radius: 12px; padding: 0.55rem 0.8rem; }
        :global(.m-dot) { width: 10px; height: 10px; border-radius: 50%; background: #111827; flex: 0 0 auto; }
        :global(.m-bar) { flex: 1; height: 7px; border-radius: 4px; background: #ececf0; overflow: hidden; }
        :global(.m-bar i) { display: block; height: 100%; background: #111827; border-radius: 4px; transform: scaleX(0); transform-origin: left; }
        :global(.ss-grid.on .m-bar i) { animation: grow .9s cubic-bezier(.16,1,.3,1) calc(1s + var(--k) * .25s) forwards; }
        @keyframes grow { to { transform: scaleX(1); } }
        :global(.m-tag) { font-size: 0.72rem; font-weight: 700; color: #475569; }
        :global(.m-pill) { display: flex; align-items: center; justify-content: space-between; background: #fff; border: 1px solid #e3e3e8; border-radius: 999px; padding: 0.55rem 0.6rem 0.55rem 1rem; }
        :global(.m-pill-t) { font-size: 0.85rem; font-weight: 600; color: #374151; }
        :global(.m-copy) { position: relative; display: inline-grid; background: #111827; color: #fff; font-size: 0.74rem; padding: 0.4rem 0.8rem; border-radius: 999px; }
        :global(.m-copy b) { grid-area: 1 / 1; font-weight: 700; text-align: center; }
        :global(.m-copy b:last-child) { opacity: 0; }
        :global(.ss-grid.on .m-copy b:first-child) { animation: swapA 4s ease-in-out 1.4s infinite; }
        :global(.ss-grid.on .m-copy b:last-child) { animation: swapB 4s ease-in-out 1.4s infinite; }
        @keyframes swapA { 0%, 40% { opacity: 1; } 50%, 90% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes swapB { 0%, 40% { opacity: 0; } 50%, 90% { opacity: 1; } 100% { opacity: 0; } }
        @media (max-width: 900px) { .ss-grid { grid-template-columns: 1fr; gap: 2.5rem; } .ss-grid.on .ss-step { transform: none; } .ss-line { display: none; } }
        @media (prefers-reduced-motion: reduce) {
          .ss-step { transition: none; opacity: 1; transform: none !important; }
          .ss-line path { animation: none !important; opacity: 1; }
          :global(.m-type) { width: 6.2em; animation: none !important; }
          :global(.m-bar i) { transform: none; animation: none !important; }
          :global(.m-caret), :global(.m-copy b) { animation: none !important; }
        }
      `}</style>
    </section>
  );
}
