'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

/**
 * Блок для бізнесу - три живі моменти замість одного кабінету.
 *
 * Попередні спроби:
 *   - світла панель зливалась зі сторінкою
 *   - повна копія кабінету на весь екран була гігантською й видавала
 *     себе за скріншот
 *
 * Тут жодного вдаваного екрана. Три маленькі плитки, кожна відтворює
 * одну дію: запис приходить сам, день заповнюється, тиждень росте.
 * Це ілюстрації ідей, а не інтерфейсу - тому й не розходяться з
 * продуктом, хоч би як він змінився.
 *
 * Помітність дає колір, а не розмір: мʼяке тло матчі відрізняє блок
 * від білої сторінки, лишаючись у тому самому контейнері.
 */

function useInView<T extends HTMLElement>(threshold = 0.3) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setInView(true); return; }
    const o = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setInView(true); o.disconnect(); }
    }, { threshold });
    o.observe(el);
    return () => o.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* Плитка 1: записи приходять самі */
function ClientsMoment({ play }: { play: boolean }) {
  const items = [
    { who: 'Дарина', what: 'Манікюр · завтра 11:00' },
    { who: 'Андрій', what: 'Стрижка · сьогодні 17:30' },
    { who: 'Олена', what: 'Фарбування · пт 10:00' },
  ];
  return (
    <div className="m-stack">
      {items.map((it, i) => (
        <div key={it.who} className={`m-notif ${play ? 'in' : ''}`} style={{ transitionDelay: `${0.4 + i * 0.45}s` }}>
          <span className="m-dot" />
          <div>
            {/* Нейтрально за родом: «записалась» для Андрія було б помилкою. */}
            <div className="m-n-t">Новий запис · {it.who}</div>
            <div className="m-n-s">{it.what}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* Плитка 2: день заповнюється */
function ScheduleMoment({ play }: { play: boolean }) {
  // Відсотки висоти колонки: початок і тривалість.
  const blocks = [
    { top: 4, h: 20, label: '09:30 Стрижка' },
    { top: 28, h: 26, label: '11:00 Борода + стрижка' },
    { top: 60, h: 16, label: '13:00 Укладка' },
    { top: 80, h: 16, label: '14:30 Стрижка' },
  ];
  return (
    <div className="m-day">
      {blocks.map((b, i) => (
        <div
          key={i}
          className={`m-block ${play ? 'in' : ''}`}
          style={{ top: `${b.top}%`, height: `${b.h}%`, transitionDelay: `${0.4 + i * 0.25}s` }}
        >
          {b.label}
        </div>
      ))}
    </div>
  );
}

/* Плитка 3: тиждень росте */
function StatsMoment({ play }: { play: boolean }) {
  const bars = [38, 52, 44, 68, 80, 96, 60];
  const days = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'];
  return (
    <div className="m-chart">
      {bars.map((v, i) => (
        <div key={i} className="m-col">
          <div className="m-bar-wrap">
            <div
              className={`m-bar ${i === 5 ? 'peak' : ''}`}
              style={{ transform: `scaleY(${play ? v / 100 : 0})`, transitionDelay: `${0.4 + i * 0.08}s` }}
            />
          </div>
          <span>{days[i]}</span>
        </div>
      ))}
    </div>
  );
}

const TILES = [
  { title: 'Нові клієнти', text: 'Записи приходять онлайн, поки ви працюєте.', Moment: ClientsMoment },
  { title: 'Розклад', text: 'Увесь день і вся команда в одному календарі.', Moment: ScheduleMoment },
  { title: 'Аналітика', text: 'Видно, які дні завантажені, а які ні.', Moment: StatsMoment },
];

export default function BusinessShowcase() {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <section className="bz">
      <div className="container">
        <div ref={ref} className={`bz-panel ${inView ? 'in' : ''}`}>
          {/* Заголовок ліворуч, текст і дії праворуч - горизонтально,
              щоб блок не ріс у висоту. */}
          <div className="bz-head">
            <div>
              <div className="bz-eyebrow">Для бізнесу</div>
              <h2>
                Сучасне рішення
                <br />
                <span>для вашого бізнесу</span>
              </h2>
            </div>
            <div className="bz-side">
              <p>
                BookEra Business — це повноцінна екосистема для власників салонів та приватних майстрів.
                Залучайте нових клієнтів, керуйте розкладом та ведіть фінансову аналітику в одній програмі.
              </p>
              <div className="bz-ctas">
                <Link href="/business" className="bz-primary">Створити профіль</Link>
                <Link href="/business#pricing" className="bz-link">Тарифи ›</Link>
              </div>
            </div>
          </div>

          <div className="bz-tiles">
            {TILES.map(({ title, text, Moment }, i) => (
              <div key={title} className="bz-tile" style={{ transitionDelay: `${0.15 + i * 0.1}s` }}>
                <div className="bz-stage"><Moment play={inView} /></div>
                <div className="bz-t">{title}</div>
                <div className="bz-x">{text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .bz { padding: 2rem 0 5.5rem; }

        .bz-panel {
          border-radius: 32px;
          padding: clamp(2rem, 5vw, 3.5rem);
          /* Мʼяке тло матчі: відрізняє блок від білої сторінки кольором,
             а не розміром чи темрявою. */
          background: linear-gradient(160deg, #EAF1E9 0%, #DCE8DB 100%);
        }

        .bz-head {
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          gap: clamp(1.5rem, 4vw, 3.5rem);
          align-items: end;
          margin-bottom: clamp(2rem, 4vw, 2.75rem);
          opacity: 0;
          transform: translateY(18px);
          transition: opacity 0.8s ease, transform 0.9s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .bz-panel.in .bz-head { opacity: 1; transform: none; }

        .bz-eyebrow { font-size: 0.8125rem; font-weight: 600; color: #5C7A61; margin-bottom: 0.75rem; }
        .bz h2 {
          font-size: clamp(2rem, 4vw, 3rem);
          font-weight: 700;
          line-height: 1.04;
          letter-spacing: -0.035em;
          color: #1D1D1F;
          margin: 0;
        }
        .bz h2 span { color: #5C7A61; }
        .bz-side p { font-size: 1rem; line-height: 1.6; color: #4A5A4D; margin: 0 0 1.25rem; }
        .bz-ctas { display: flex; align-items: center; gap: 1.25rem; }
        .bz-primary {
          display: inline-flex; align-items: center; height: 44px; padding: 0 1.4rem;
          border-radius: 999px; background: #1D1D1F; color: #fff;
          font-size: 0.9375rem; font-weight: 500; text-decoration: none;
          transition: transform 0.2s ease, background-color 0.2s ease;
        }
        .bz-primary:hover { background: #000; transform: translateY(-1px); }
        .bz-link { color: #2E3A30; font-size: 0.9375rem; font-weight: 500; text-decoration: none; }
        .bz-link:hover { text-decoration: underline; }

        .bz-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
        .bz-tile {
          background: #fff;
          border-radius: 22px;
          padding: 1.25rem 1.25rem 1.4rem;
          opacity: 0;
          transform: translateY(22px);
          transition: opacity 0.8s ease, transform 0.9s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .bz-panel.in .bz-tile { opacity: 1; transform: none; }
        .bz-stage {
          height: 180px;
          border-radius: 14px;
          background: #F7F9F6;
          margin-bottom: 1.1rem;
          position: relative;
          overflow: hidden;
        }
        .bz-t { font-size: 1.0625rem; font-weight: 600; color: #1D1D1F; margin-bottom: 0.3rem; }
        .bz-x { font-size: 0.9375rem; line-height: 1.5; color: #6E6E73; }

        /* --- Момент 1: сповіщення --- */
        .m-stack { position: absolute; inset: 0.9rem; display: flex; flex-direction: column; gap: 0.45rem; justify-content: center; }
        .m-notif {
          display: flex; align-items: center; gap: 0.6rem;
          padding: 0.55rem 0.7rem; border-radius: 12px; background: #fff;
          box-shadow: 0 6px 16px -8px rgba(46,58,48,0.25), 0 0 0 1px rgba(0,0,0,0.04);
          opacity: 0; transform: translateY(-10px) scale(0.97);
          transition: opacity 0.5s ease, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .m-notif.in { opacity: 1; transform: none; }
        .m-dot { width: 8px; height: 8px; border-radius: 50%; background: #6F9273; flex-shrink: 0; box-shadow: 0 0 0 3px rgba(111,146,115,0.18); }
        .m-n-t { font-size: 0.75rem; font-weight: 600; color: #1D1D1F; }
        .m-n-s { font-size: 0.68rem; color: #86868B; }

        /* --- Момент 2: день --- */
        .m-day {
          position: absolute; inset: 0.9rem 1.2rem;
          background: repeating-linear-gradient(to bottom, transparent 0, transparent calc(20% - 1px), #E8EDE7 calc(20% - 1px), #E8EDE7 20%);
        }
        .m-block {
          position: absolute; left: 0; right: 0;
          border-radius: 8px; background: #E4EEE3; border-left: 3px solid #6F9273;
          padding: 0.25rem 0.5rem; font-size: 0.66rem; font-weight: 500; color: #2E3A30;
          overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
          opacity: 0; transform: translateX(-12px);
          transition: opacity 0.5s ease, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .m-block.in { opacity: 1; transform: none; }

        /* --- Момент 3: тиждень --- */
        .m-chart { position: absolute; inset: 1rem 1.1rem 0.7rem; display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.45rem; }
        .m-col { display: flex; flex-direction: column; align-items: center; gap: 0.35rem; }
        .m-col span { font-size: 0.62rem; color: #AEAEB2; }
        .m-bar-wrap { flex: 1; width: 100%; display: flex; align-items: flex-end; }
        .m-bar {
          width: 100%; height: 100%; border-radius: 6px; background: #C2D8C4;
          transform-origin: bottom;
          transition: transform 0.9s cubic-bezier(0.16, 1, 0.3, 1);
        }
        /* Найзавантаженіший день виділено - саме таку відповідь людина
           й шукає в аналітиці. */
        .m-bar.peak { background: #6F9273; }

        @media (max-width: 860px) {
          .bz-head { grid-template-columns: 1fr; align-items: start; }
          .bz-tiles { grid-template-columns: 1fr; }
        }

        @media (prefers-reduced-motion: reduce) {
          .bz-head, .bz-tile, .m-notif, .m-block, .m-bar { transition: none !important; }
        }
      `}</style>
    </section>
  );
}
