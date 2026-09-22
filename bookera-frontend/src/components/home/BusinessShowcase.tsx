'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

/**
 * Блок для бізнесу - на весь екран, темний, з кабінетом, що виринає.
 *
 * Попередня версія зливалась зі сторінкою: світла панель на світлому
 * тлі, і власник закладу гортав повз, не помітивши, що це про нього.
 * Тут інша аудиторія й інше питання, і блок має це показати різкою
 * зміною сцени - як Apple відокремлює сторінки Pro.
 *
 * Кабінет - ТОЧНА копія справжнього, а не узагальнений малюнок:
 * те саме меню, міні-календар із червоними вихідними, «Справи на
 * сьогодні», перемикач «День / Тиждень / Місяць». Людина, яка
 * зареєструється, має впізнати екран, а не побачити інший продукт.
 */

function useInView<T extends HTMLElement>(threshold = 0.2) {
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

const MENU = ['Календар', 'Клієнти', 'Послуги', 'Команда', 'Онлайн-вітрина', 'Склад і Витрати', 'Маркетинг', 'Аналітика', 'Налаштування'];
const HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00'];

/** Записи дня: початок у годинах від 9:00, тривалість, колонка майстра. */
const BOOKINGS = [
  { col: 0, start: 0.5, len: 1, title: 'Стрижка', who: 'Андрій К.' },
  { col: 1, start: 0, len: 1.5, title: 'Манікюр гель', who: 'Олена М.' },
  { col: 0, start: 2, len: 1.5, title: 'Стрижка + борода', who: 'Максим Т.' },
  { col: 1, start: 2.5, len: 1, title: 'Педикюр', who: 'Софія Л.' },
  { col: 2, start: 1, len: 2, title: 'Фарбування', who: 'Ірина В.' },
  { col: 2, start: 3.5, len: 1, title: 'Укладка', who: 'Катерина Д.' },
];

function MiniMonth() {
  // Вересень 2026 починається з вівторка. Вихідні - червоним, як
  // у справжньому кабінеті.
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  const offset = 1;
  return (
    <div className="mm">
      <div className="mm-title">Вересень 2026 р.</div>
      <div className="mm-grid">
        {['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'].map((d, i) => (
          <div key={d} className={`mm-h ${i >= 5 ? 'we' : ''}`}>{d}</div>
        ))}
        {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} />)}
        {days.map(d => {
          const wd = (d + offset - 1) % 7;
          return (
            <div key={d} className={`mm-d ${wd >= 5 ? 'we' : ''} ${d === 15 ? 'sel' : ''}`}>{d}</div>
          );
        })}
      </div>
      <div className="todo-title">Справи на сьогодні</div>
      <div className="todo-empty">Немає завдань на сьогодні</div>
    </div>
  );
}

function Cabinet({ play }: { play: boolean }) {
  return (
    <div className="cab">
      <aside className="cab-side">
        <div className="cab-biz">
          <div className="cab-logo">T</div>
          <span>Top Barber</span>
        </div>
        <div className="cab-label">РОБОЧЕ СЕРЕДОВИЩЕ</div>
        {MENU.map((m, i) => (
          <div key={m} className={`cab-item ${i === 0 ? 'on' : ''}`}>
            <span className="cab-ico" />{m}
          </div>
        ))}
        <div className="cab-user">
          <div className="cab-ava">МБ</div>
          <div><div className="cab-name">Макс Бар</div><div className="cab-role">Власник</div></div>
        </div>
      </aside>

      <MiniMonth />

      <div className="cab-main">
        <div className="cab-bar">
          <span className="chip">Сьогодні</span>
          <span className="arrows">‹ ›</span>
          <span className="date">Вівторок, 15 вересня</span>
          <div className="seg"><span className="on">День</span><span>Тиждень</span><span>Місяць</span></div>
        </div>

        <div className="day">
          <div className="hours">{HOURS.map(h => <div key={h}>{h}</div>)}</div>
          <div className="cols">
            {[0, 1, 2].map(c => <div key={c} className="col" />)}
            {BOOKINGS.map((b, i) => (
              <div
                key={i}
                className={`bk ${play ? 'in' : ''}`}
                style={{
                  left: `calc(${(b.col / 3) * 100}% + 4px)`,
                  width: `calc(${100 / 3}% - 8px)`,
                  top: `calc(${(b.start / 6) * 100}% + 2px)`,
                  height: `calc(${(b.len / 6) * 100}% - 4px)`,
                  transitionDelay: `${0.7 + i * 0.13}s`,
                }}
              >
                <div className="bk-t">{b.title}</div>
                <div className="bk-w">{b.who}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  { title: 'Нові клієнти', text: 'Ваш заклад у каталозі поруч із людьми, які шукають саме вашу послугу.' },
  { title: 'Розклад', text: 'Записи, майстри й перерви в одному календарі - без зошита й дзвінків.' },
  { title: 'Аналітика', text: 'Дохід, завантаженість і постійні клієнти - видно, що працює.' },
];

export default function BusinessShowcase() {
  const { ref, inView } = useInView<HTMLElement>();

  return (
    <section ref={ref} className={`bx ${inView ? 'in' : ''}`}>
      <div className="bx-glow" aria-hidden />

      <div className="bx-head">
        <div className="bx-eyebrow">BookEra Business</div>
        <h2>
          Сучасне рішення
          <br />
          <span className="bx-accent">для вашого бізнесу</span>
        </h2>
        <p>
          BookEra Business — це повноцінна екосистема для власників салонів та приватних майстрів.
          Залучайте нових клієнтів, керуйте розкладом та ведіть фінансову аналітику в одній програмі.
        </p>
        <div className="bx-ctas">
          <Link href="/business" className="bx-primary">Створити профіль</Link>
          <Link href="/business#pricing" className="bx-link">Переглянути тарифи ›</Link>
        </div>
      </div>

      {/* Кабінет виринає з нахилом, що вирівнюється, - як продукт,
          який ставлять перед людиною. */}
      <div className="bx-stage">
        <div className="bx-window">
          <div className="bx-chrome"><i /><i /><i /><span>bookera.com.ua/cabinet</span></div>
          <Cabinet play={inView} />
        </div>
      </div>

      <div className="bx-features">
        {FEATURES.map((f, i) => (
          <div key={f.title} className="bx-f" style={{ transitionDelay: `${1.2 + i * 0.1}s` }}>
            <div className="bx-f-t">{f.title}</div>
            <div className="bx-f-x">{f.text}</div>
          </div>
        ))}
      </div>

      <style jsx global>{`
        /* --- Сцена на весь екран --- */
        .bx {
          position: relative;
          overflow: hidden;
          min-height: 100vh;
          padding: clamp(5rem, 11vw, 9rem) clamp(1.25rem, 5vw, 4rem) clamp(4rem, 8vw, 7rem);
          /* Глибокий зелено-чорний, а не чисто чорний: на ньому матча
             світиться, і сцена лишається своєю, фірмовою. */
          background: #0C100E;
          color: #F5F5F7;
        }
        .bx-glow {
          position: absolute;
          left: 50%;
          top: 38%;
          width: min(1200px, 120vw);
          height: 700px;
          transform: translateX(-50%);
          background: radial-gradient(closest-side, rgba(143, 174, 147, 0.28), rgba(143, 174, 147, 0) 70%);
          filter: blur(20px);
          pointer-events: none;
          opacity: 0;
          transition: opacity 1.6s ease 0.3s;
        }
        .bx.in .bx-glow { opacity: 1; }

        .bx-head {
          position: relative;
          text-align: center;
          max-width: 760px;
          margin: 0 auto clamp(3rem, 6vw, 4.5rem);
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.9s ease, transform 1s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .bx.in .bx-head { opacity: 1; transform: none; }

        .bx-eyebrow { font-size: 0.9375rem; font-weight: 600; color: #8FAE93; margin-bottom: 1rem; }
        .bx h2 {
          font-size: clamp(2.6rem, 6.2vw, 4.75rem);
          font-weight: 700;
          line-height: 1.02;
          letter-spacing: -0.045em;
          margin: 0 0 1.5rem;
          color: #F5F5F7;
        }
        /* Другий рядок градієнтом фірмової матчі - єдиний кольоровий
           акцент на сцені, тому він і читається. */
        .bx-accent {
          background: linear-gradient(90deg, #C2D8C4 0%, #8FAE93 50%, #C2D8C4 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .bx-head p {
          font-size: clamp(1.0625rem, 1.5vw, 1.25rem);
          line-height: 1.55;
          color: #A1A1A6;
          margin: 0 auto 2rem;
          max-width: 640px;
        }
        .bx-ctas { display: flex; gap: 1.5rem; align-items: center; justify-content: center; flex-wrap: wrap; }
        .bx-primary {
          display: inline-flex; align-items: center;
          height: 50px; padding: 0 1.75rem; border-radius: 999px;
          background: #F5F5F7; color: #0C100E;
          font-size: 1rem; font-weight: 600; text-decoration: none;
          transition: transform 0.2s ease, background-color 0.2s ease;
        }
        .bx-primary:hover { background: #fff; transform: translateY(-1px); }
        .bx-link { color: #C2D8C4; font-size: 1rem; font-weight: 500; text-decoration: none; }
        .bx-link:hover { text-decoration: underline; }

        /* --- Вікно кабінету --- */
        .bx-stage { position: relative; perspective: 1800px; max-width: 1180px; margin: 0 auto; }
        .bx-window {
          border-radius: 18px;
          overflow: hidden;
          background: #fff;
          box-shadow: 0 60px 140px -40px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08);
          transform-origin: 50% 0%;
          opacity: 0;
          transform: rotateX(22deg) translateY(60px) scale(0.94);
          transition: opacity 1.1s ease 0.2s, transform 1.4s cubic-bezier(0.16, 1, 0.3, 1) 0.2s;
        }
        .bx.in .bx-window { opacity: 1; transform: none; }

        .bx-chrome {
          display: flex; align-items: center; gap: 6px;
          padding: 0.7rem 1rem; background: #F5F5F7; border-bottom: 1px solid #E8E8ED;
        }
        .bx-chrome i { width: 11px; height: 11px; border-radius: 50%; background: #D1D1D6; }
        .bx-chrome span {
          margin: 0 auto; padding: 0.2rem 1.2rem; border-radius: 7px;
          background: #fff; font-size: 0.72rem; color: #86868B;
        }

        /* --- Копія справжнього кабінету --- */
        .cab { display: flex; height: clamp(420px, 44vw, 560px); color: #1D1D1F; font-size: 0.8rem; }

        .cab-side {
          width: 196px; flex-shrink: 0; border-right: 1px solid #F0F0F2;
          padding: 1rem 0.75rem; display: flex; flex-direction: column; gap: 2px;
        }
        .cab-biz { display: flex; align-items: center; gap: 0.55rem; font-weight: 600; font-size: 0.875rem; margin-bottom: 1.1rem; }
        .cab-logo {
          width: 26px; height: 26px; border-radius: 7px; background: #6F9273; color: #fff;
          display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700;
        }
        .cab-label { font-size: 0.6rem; font-weight: 600; letter-spacing: 0.08em; color: #AEAEB2; margin: 0 0 0.45rem 0.4rem; }
        .cab-item {
          display: flex; align-items: center; gap: 0.6rem;
          padding: 0.42rem 0.5rem; border-radius: 8px; color: #3A3A3C; white-space: nowrap;
        }
        .cab-item.on { background: #F2F2F5; font-weight: 600; color: #1D1D1F; }
        .cab-ico { width: 13px; height: 13px; border-radius: 4px; border: 1.5px solid #AEAEB2; flex-shrink: 0; }
        .cab-item.on .cab-ico { border-color: #1D1D1F; }
        .cab-user { margin-top: auto; display: flex; align-items: center; gap: 0.55rem; padding: 0.5rem 0.4rem 0; border-top: 1px solid #F0F0F2; }
        .cab-ava {
          width: 28px; height: 28px; border-radius: 50%; background: #EEF1F6;
          display: flex; align-items: center; justify-content: center; font-size: 0.66rem; font-weight: 700;
        }
        .cab-name { font-size: 0.75rem; font-weight: 600; }
        .cab-role { font-size: 0.66rem; color: #86868B; }

        .mm { width: 218px; flex-shrink: 0; border-right: 1px solid #F0F0F2; padding: 1rem 0.9rem; }
        .mm-title { font-weight: 700; font-size: 0.9rem; margin-bottom: 0.7rem; }
        .mm-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px 0; text-align: center; }
        .mm-h { font-size: 0.6rem; color: #AEAEB2; padding-bottom: 3px; }
        .mm-d { font-size: 0.7rem; height: 22px; display: flex; align-items: center; justify-content: center; border-radius: 50%; margin: 0 auto; width: 22px; }
        .mm-h.we, .mm-d.we { color: #d92d20; }
        .mm-d.sel { background: #1D1D1F; color: #fff; font-weight: 600; }
        .todo-title { font-weight: 700; font-size: 0.85rem; margin: 1.2rem 0 0.5rem; }
        .todo-empty { font-size: 0.7rem; color: #AEAEB2; padding: 0.9rem; border: 1px dashed #E5E5EA; border-radius: 10px; text-align: center; }

        .cab-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .cab-bar { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-bottom: 1px solid #F0F0F2; }
        .chip { padding: 0.3rem 0.7rem; border-radius: 8px; background: #F2F2F5; font-weight: 600; font-size: 0.72rem; }
        .arrows { color: #AEAEB2; letter-spacing: 0.3em; }
        .date { font-weight: 700; font-size: 0.85rem; }
        .seg { margin-left: auto; display: flex; background: #F2F2F5; border-radius: 8px; padding: 2px; }
        .seg span { padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 0.7rem; color: #6E6E73; }
        .seg span.on { background: #fff; color: #1D1D1F; font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,0.08); }

        .day { flex: 1; display: flex; padding: 0.6rem 1rem 1rem; min-height: 0; }
        .hours { width: 46px; flex-shrink: 0; display: grid; grid-template-rows: repeat(6, 1fr); font-size: 0.66rem; color: #AEAEB2; }
        .cols { position: relative; flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); }
        .col { border-left: 1px solid #F2F2F5; background: repeating-linear-gradient(to bottom, transparent 0, transparent calc(100% / 6 - 1px), #F2F2F5 calc(100% / 6 - 1px), #F2F2F5 calc(100% / 6)); }

        .bk {
          position: absolute; border-radius: 9px; padding: 0.4rem 0.55rem;
          background: #F4FAF5; border-left: 3px solid #6F9273; overflow: hidden;
          opacity: 0; transform: translateY(8px);
          transition: opacity 0.5s ease, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .bk.in { opacity: 1; transform: none; }
        .bk-t { font-size: 0.72rem; font-weight: 600; color: #2E3A30; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .bk-w { font-size: 0.66rem; color: #5C6B5E; white-space: nowrap; }

        /* --- Можливості --- */
        .bx-features {
          position: relative;
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: clamp(1.5rem, 4vw, 3rem);
          max-width: 1000px; margin: clamp(3.5rem, 7vw, 5.5rem) auto 0;
        }
        .bx-f { opacity: 0; transform: translateY(16px); transition: opacity 0.8s ease, transform 0.9s cubic-bezier(0.16, 1, 0.3, 1); }
        .bx.in .bx-f { opacity: 1; transform: none; }
        .bx-f-t { font-size: 1.125rem; font-weight: 600; color: #F5F5F7; margin-bottom: 0.45rem; }
        .bx-f-x { font-size: 1rem; line-height: 1.55; color: #A1A1A6; }

        /* На вузьких екранах лишаємо лише розклад: бічне меню й
           міні-календар у стиснутому вигляді перетворились би на кашу. */
        @media (max-width: 1000px) { .mm { display: none; } }
        @media (max-width: 760px) {
          .cab-side { display: none; }
          .bx-features { grid-template-columns: 1fr; }
          .seg { display: none; }
        }

        @media (prefers-reduced-motion: reduce) {
          .bx-head, .bx-window, .bk, .bx-f, .bx-glow { transition: none !important; }
        }
      `}</style>
    </section>
  );
}
