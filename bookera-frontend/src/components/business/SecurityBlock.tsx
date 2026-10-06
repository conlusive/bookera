'use client';

import { useReveal } from './useReveal';

/** «Дані ваших клієнтів у безпеці»: лише те, що справді зроблено в системі. */
const ICONS = {
  mail: <path pathLength={1} d="M3 6.5A2.5 2.5 0 015.5 4h13A2.5 2.5 0 0121 6.5v11a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 17.5v-11zm2 .3l7 5.2 7-5.2" />,
  eye: <path pathLength={1} d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12zm10 3a3 3 0 100-6 3 3 0 000 6z" />,
  user: <path pathLength={1} d="M12 12a4 4 0 100-8 4 4 0 000 8zm-8 8c0-3.3 3.6-6 8-6s8 2.7 8 6" />,
  send: <path pathLength={1} d="M21 3L3 10.5l6.5 2.5L12 20l9-17zM9.5 13L21 3" />,
  list: <path pathLength={1} d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  lock: <path pathLength={1} d="M6 11V8a6 6 0 1112 0v3m-13 0h14v9H5v-9z" />,
};
const FACTS: { icon: keyof typeof ICONS; t: string; d: string }[] = [
  { icon: 'mail', t: 'Пошта підтверджується', d: 'Кожен акаунт підтверджується листом: на чужу адресу зареєструватись не вийде.' },
  { icon: 'eye', t: 'Кожен бачить своє', d: 'Майстер бачить лише власний розклад і клієнтів. Гроші й налаштування лише для власника й адміністратора.' },
  { icon: 'user', t: 'Команда за запрошенням', d: 'Запрошення працює тільки для тієї пошти, яку ви вказали.' },
  { icon: 'send', t: 'Розсилки без спаму', d: 'У кожному листі є відписка, клієнт дає згоду, а кількість листів на добу обмежена.' },
  { icon: 'list', t: 'Журнал дій', d: 'Видно, хто, що й коли змінив у закладі: послуги, ціни, команду, розсилки.' },
  { icon: 'lock', t: 'База закрита ззовні', d: 'Дані віддає лише захищений сервер. Прямого доступу до бази з браузера немає.' },
];

export default function SecurityBlock() {
  const [ref, shown] = useReveal<HTMLDivElement>(0.12);
  return (
    <section className="sb">
      <div className="container">
        <div ref={ref} className={`sb-grid ${shown ? 'on' : ''}`}>
          <div className="sb-head">
            <h2 className="sb-title">Дані ваших клієнтів у безпеці.</h2>
            <p className="sb-lead">Клієнтська база це основа бізнесу, тож ми бережемо її як свою.</p>
          </div>
          <div className="sb-list">
            {FACTS.map((f, i) => (
              <div key={f.t} className="sb-item" style={{ ['--i' as string]: i }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#3F6B49" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="sb-ic">{ICONS[f.icon]}</svg>
                <div>
                  <h3>{f.t}</h3>
                  <p>{f.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style jsx>{`
        .sb { padding: 5rem 0 6rem; background: #fff; }
        .sb-grid { display: grid; grid-template-columns: 0.8fr 1.2fr; gap: 5rem; align-items: start; }
        .sb-head { position: sticky; top: 110px; }
        .sb-title { font-size: clamp(2rem, 4.4vw, 3.25rem); font-weight: 700; letter-spacing: -0.035em; line-height: 1.08; color: #1D1D1F; margin: 0 0 1.25rem; }
        .sb-lead { color: #475569; font-size: 1.1rem; line-height: 1.6; max-width: 360px; margin: 0; }
        .sb-list { display: grid; grid-template-columns: 1fr 1fr; gap: 0 3rem; }
        .sb-item { display: flex; gap: 1rem; padding: 1.6rem 0; border-top: 1px solid #e8ece8; opacity: 0; transform: translateY(18px); transition: opacity .7s ease, transform .8s cubic-bezier(.16,1,.3,1); transition-delay: calc(var(--i) * 90ms); }
        .sb-grid.on .sb-item { opacity: 1; transform: none; }
        .sb-item svg { flex: 0 0 auto; margin-top: 2px; }
        .sb-item :global(.sb-ic path) { stroke-dasharray: 1; stroke-dashoffset: 1; }
        .sb-grid.on .sb-item :global(.sb-ic path) { animation: draw 1.1s ease-out forwards; animation-delay: calc(var(--i) * 90ms + .25s); }
        @keyframes draw { to { stroke-dashoffset: 0; } }
        .sb-item h3 { font-size: 1.08rem; font-weight: 700; color: #111827; margin: 0 0 0.35rem; letter-spacing: -0.01em; }
        .sb-item p { color: #475569; font-size: 0.97rem; line-height: 1.55; margin: 0; }
        @media (max-width: 960px) { .sb-grid { grid-template-columns: 1fr; gap: 2.5rem; } .sb-head { position: static; } }
        @media (max-width: 620px) { .sb-list { grid-template-columns: 1fr; } }
        @media (prefers-reduced-motion: reduce) { .sb-item { transition: none; opacity: 1; transform: none; } .sb-item :global(.sb-ic path) { animation: none !important; stroke-dashoffset: 0; } }
      `}</style>
    </section>
  );
}
