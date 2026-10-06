'use client';

import { useReveal } from './useReveal';

/**
 * «Старт за 3 кроки»: кроки зміщені діагоналлю (вільна композиція, не рівна сітка).
 * Малюнки - прості макети інтерфейсу з нейтральними підписами, без вигаданих клієнтів і цифр.
 */
function MockProfile() {
  return (
    <div className="m">
      <div className="m-label">Назва закладу</div>
      <div className="m-input" />
      <div className="m-chips"><span>Категорія</span><span>Адреса</span><span>Години</span></div>
    </div>
  );
}
function MockServices() {
  return (
    <div className="m">
      {['Послуга', 'Послуга', 'Майстер'].map((t, i) => (
        <div key={i} className="m-line"><span className="m-dot" /><span className="m-bar" style={{ width: `${70 - i * 12}%` }} /><span className="m-tag">{t}</span></div>
      ))}
    </div>
  );
}
function MockLink() {
  return (
    <div className="m">
      <div className="m-pill"><span className="m-pill-t">Ваше посилання</span><span className="m-copy">Копіювати</span></div>
      <div className="m-chips"><span>Instagram</span><span>QR-код</span><span>Візитка</span></div>
    </div>
  );
}

const STEPS = [
  { n: '01', t: 'Створіть профіль', d: 'Назва, категорія, адреса й години роботи. Майстер реєстрації веде крок за кроком.', m: <MockProfile /> },
  { n: '02', t: 'Додайте послуги й команду', d: 'Ціни, тривалість, майстри та їхній графік. Кожен бачить лише своє.', m: <MockServices /> },
  { n: '03', t: 'Діліться посиланням', d: 'В Instagram, на візитці чи через QR-код: клієнти записуються самі, ви отримуєте сповіщення.', m: <MockLink /> },
];

export default function StartSteps() {
  const [ref, shown] = useReveal<HTMLDivElement>(0.15);
  return (
    <section className="ss">
      <div className="container">
        <h2 className="ss-title">Старт за три кроки.</h2>
        <div ref={ref} className={`ss-grid ${shown ? 'on' : ''}`}>
          {STEPS.map((s, i) => (
            <div key={s.n} className="ss-step" style={{ ['--i' as string]: i }}>
              <div className="ss-n">{s.n}</div>
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
        .ss-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.5rem; align-items: start; }
        .ss-step { opacity: 0; transform: translateY(26px); transition: opacity .8s ease, transform .9s cubic-bezier(.16,1,.3,1); transition-delay: calc(var(--i) * .14s); }
        .ss-grid.on .ss-step { opacity: 1; transform: translateY(calc(var(--i) * 44px)); }
        .ss-n { font-size: 0.95rem; font-weight: 800; letter-spacing: 0.08em; color: #3F6B49; margin-bottom: 1rem; }
        .ss-mock { height: 168px; border-radius: 24px; background: #F3F8F4; padding: 1.4rem; margin-bottom: 1.5rem; display: flex; align-items: center; }
        .ss-step h3 { font-size: 1.35rem; font-weight: 700; letter-spacing: -0.02em; color: #111827; margin: 0 0 0.5rem; }
        .ss-step p { color: #475569; font-size: 1rem; line-height: 1.6; margin: 0; max-width: 340px; }
        :global(.m) { width: 100%; display: grid; gap: 0.7rem; }
        :global(.m-label) { font-size: 0.72rem; font-weight: 700; color: #64748b; letter-spacing: 0.04em; text-transform: uppercase; }
        :global(.m-input) { height: 38px; border-radius: 12px; background: #fff; border: 1px solid #dfe8e0; }
        :global(.m-chips) { display: flex; gap: 0.45rem; flex-wrap: wrap; }
        :global(.m-chips span) { background: #fff; border: 1px solid #dfe8e0; border-radius: 999px; padding: 0.3rem 0.75rem; font-size: 0.78rem; font-weight: 600; color: #374151; }
        :global(.m-line) { display: flex; align-items: center; gap: 0.6rem; background: #fff; border: 1px solid #dfe8e0; border-radius: 12px; padding: 0.55rem 0.8rem; }
        :global(.m-dot) { width: 10px; height: 10px; border-radius: 50%; background: #8fae92; flex: 0 0 auto; }
        :global(.m-bar) { height: 7px; border-radius: 4px; background: #e5ece6; }
        :global(.m-tag) { margin-left: auto; font-size: 0.72rem; font-weight: 700; color: #3F6B49; }
        :global(.m-pill) { display: flex; align-items: center; justify-content: space-between; background: #fff; border: 1px solid #dfe8e0; border-radius: 999px; padding: 0.55rem 0.6rem 0.55rem 1rem; }
        :global(.m-pill-t) { font-size: 0.85rem; font-weight: 600; color: #374151; }
        :global(.m-copy) { background: #111827; color: #fff; font-size: 0.74rem; font-weight: 700; padding: 0.4rem 0.8rem; border-radius: 999px; }
        @media (max-width: 900px) { .ss-grid { grid-template-columns: 1fr; gap: 2.5rem; } .ss-grid.on .ss-step { transform: none; } }
        @media (prefers-reduced-motion: reduce) { .ss-step { transition: none; opacity: 1; transform: none !important; } }
      `}</style>
    </section>
  );
}
