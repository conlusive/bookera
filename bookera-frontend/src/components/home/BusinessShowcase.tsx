'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

/**
 * Блок для бізнесу - вікно продукту, яке оживає.
 *
 * Раніше тут була темна секція на всю ширину: важка пляма посеред
 * світлої сторінки, яка тягнула погляд сильніше за все інше.
 *
 * Тепер світле вікно кабінету. Власник закладу не читає про
 * «екосистему» - він бачить свій майбутній день: записи
 * зʼявляються в розкладі, дохід рахується, приходить новий клієнт.
 *
 * Плашку «+40% клієнтів» прибрано: число без джерела, адресоване
 * саме тим людям, які прийдуть і порахують.
 */

function useInView<T extends HTMLElement>(threshold = 0.3) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInView(true);
      return;
    }
    const o = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setInView(true); o.disconnect(); }
    }, { threshold });
    o.observe(el);
    return () => o.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/** Записи в розкладі: майстер, початок і тривалість у годинах від 9:00. */
const BOOKINGS = [
  { master: 0, start: 0.5, len: 1, title: 'Стрижка', client: 'Андрій' },
  { master: 1, start: 1, len: 1.5, title: 'Манікюр', client: 'Олена' },
  { master: 0, start: 2, len: 1.5, title: 'Стрижка + борода', client: 'Максим' },
  { master: 2, start: 0.25, len: 2, title: 'Фарбування', client: 'Ірина' },
  { master: 1, start: 3, len: 1, title: 'Педикюр', client: 'Софія' },
  { master: 2, start: 3, len: 1, title: 'Укладка', client: 'Катерина' },
];

const MASTERS = ['Макс', 'Олена', 'Ірина'];
// Чотири позначки на чотири колонки: шкала 9:00-13:00. Пʼята
// переносилась би на новий рядок і ламала сітку.
const HOURS = ['9:00', '10:00', '11:00', '12:00'];

function Dashboard({ play }: { play: boolean }) {
  const [revenue, setRevenue] = useState(0);
  const [toast, setToast] = useState(false);
  const target = 18450;

  useEffect(() => {
    if (!play) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 1800);
      setRevenue(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    // Лічильник стартує, коли записи вже зʼявились: спершу людина
    // бачить роботу, потім - що вона принесла.
    const delay = setTimeout(() => { raf = requestAnimationFrame(tick); }, 700);
    const t = setTimeout(() => setToast(true), 2300);
    return () => { clearTimeout(delay); clearTimeout(t); cancelAnimationFrame(raf); };
  }, [play]);

  return (
    <div className={`window ${play ? 'in' : ''}`}>
      {/* Рядок вікна: три крапки, як у браузера. Вони кажуть «це
          справжній продукт», а не малюнок. */}
      <div className="chrome">
        <span /><span /><span />
        <div className="address">bookera.com.ua/cabinet</div>
      </div>

      <div className="body">
        <aside className="side">
          <div className="brand">B</div>
          {[0, 1, 2, 3, 4].map(i => <div key={i} className={`nav ${i === 0 ? 'active' : ''}`} />)}
        </aside>

        <div className="main">
          <div className="topline">
            <div>
              <div className="muted">Середа, 24 вересня</div>
              <div className="day-title">Розклад на сьогодні</div>
            </div>
            <div className="kpi">
              <div className="muted">Дохід за тиждень</div>
              <div className="kpi-value">{revenue.toLocaleString('uk-UA')} ₴</div>
            </div>
          </div>

          <div className="grid">
            <div className="masters">
              <div />
              {MASTERS.map(m => <div key={m} className="master">{m}</div>)}
            </div>

            <div className="timeline">
              <div className="hours">
                {HOURS.map(h => <div key={h}>{h}</div>)}
              </div>
              <div className="lanes">
                {MASTERS.map((_, lane) => <div key={lane} className="lane" />)}
                {BOOKINGS.map((b, i) => (
                  <div
                    key={i}
                    className="booking"
                    style={{
                      // Позиція в сітці: колонка - майстер, рядок - час.
                      left: `calc(${(b.start / 4) * 100}% + 2px)`,
                      width: `calc(${(b.len / 4) * 100}% - 4px)`,
                      top: `calc(${(b.master / 3) * 100}% + 4px)`,
                      height: `calc(${100 / 3}% - 8px)`,
                      transitionDelay: `${0.35 + i * 0.12}s`,
                    }}
                  >
                    <div className="b-title">{b.title}</div>
                    <div className="b-client">{b.client}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Сповіщення про онлайн-запис - головна обіцянка продукту:
          клієнти приходять самі, поки власник працює. */}
      <div className={`toast ${toast ? 'in' : ''}`}>
        <div className="toast-dot" />
        <div>
          <div className="toast-title">Новий запис онлайн</div>
          <div className="toast-sub">Дарина · завтра о 11:00</div>
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  { title: 'Нові клієнти', text: 'Заклад у каталозі поруч із людьми, які шукають саме вашу послугу.' },
  { title: 'Розклад', text: 'Записи, майстри й перерви в одному календарі, без зошита й дзвінків.' },
  { title: 'Аналітика', text: 'Дохід, завантаженість і постійні клієнти - видно, що працює.' },
];

export default function BusinessShowcase() {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <section className="biz">
      <div className="container">
        <div ref={ref} className={`panel ${inView ? 'in' : ''}`}>
          <div className="head">
            <div className="eyebrow">Для бізнесу</div>
            <h2>
              Сучасне рішення
              <br />
              <span className="soft">для вашого бізнесу</span>
            </h2>
            <p>
              BookEra Business — це повноцінна екосистема для власників салонів та приватних майстрів.
              Залучайте нових клієнтів, керуйте розкладом та ведіть фінансову аналітику в одній програмі.
            </p>
            <Link href="/business" className="cta">Створити профіль</Link>
          </div>

          <Dashboard play={inView} />

          <div className="features">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="feature" style={{ transitionDelay: `${0.9 + i * 0.1}s` }}>
                <div className="f-title">{f.title}</div>
                <div className="f-text">{f.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .biz { padding: 2rem 0 6rem; }

        /* Панель, а не секція на всю ширину: вона живе в тому самому
           контейнері, що й решта сторінки. Тло - ледь тепле, щоб блок
           відрізнявся від клієнтської частини, але не кричав. */
        .biz .panel {
          border-radius: 36px;
          padding: clamp(2.5rem, 6vw, 5rem) clamp(1.25rem, 5vw, 4.5rem) clamp(2.5rem, 5vw, 4rem);
          background:
            radial-gradient(70% 55% at 50% 0%, #EEF4ED 0%, transparent 70%),
            #F7F7F5;
          overflow: hidden;
        }

        .biz .head {
          text-align: center;
          max-width: 640px;
          margin: 0 auto clamp(2.5rem, 5vw, 3.75rem);
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.8s ease, transform 0.9s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .biz .panel.in .head { opacity: 1; transform: none; }

        .biz .eyebrow { font-size: 0.8125rem; font-weight: 600; color: #6F9273; margin-bottom: 0.9rem; }
        .biz h2 {
          font-size: clamp(2rem, 4.4vw, 3.25rem);
          font-weight: 700;
          line-height: 1.06;
          letter-spacing: -0.035em;
          color: #1D1D1F;
          margin: 0 0 1.25rem;
        }
        .biz h2 .soft { color: #86868B; }
        .biz .head p {
          font-size: 1.0625rem;
          line-height: 1.6;
          color: #6E6E73;
          margin: 0 0 1.75rem;
        }
        .biz .cta {
          display: inline-flex;
          align-items: center;
          height: 46px;
          padding: 0 1.6rem;
          border-radius: 999px;
          background: #1D1D1F;
          color: #fff;
          font-size: 0.9375rem;
          font-weight: 500;
          text-decoration: none;
          transition: transform 0.2s ease, background-color 0.2s ease;
        }
        .biz .cta:hover { background: #000; transform: translateY(-1px); }

        /* --- Вікно кабінету --- */
        .biz .window {
          position: relative;
          max-width: 920px;
          margin: 0 auto;
          border-radius: 18px;
          background: #fff;
          box-shadow: 0 40px 90px -40px rgba(46, 58, 48, 0.35), 0 0 0 1px rgba(0,0,0,0.05);
          opacity: 0;
          transform: translateY(40px) scale(0.985);
          transition: opacity 1s ease 0.15s, transform 1.1s cubic-bezier(0.16, 1, 0.3, 1) 0.15s;
        }
        .biz .window.in { opacity: 1; transform: none; }

        .biz .chrome {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid #F2F2F5;
        }
        .biz .chrome > span { width: 10px; height: 10px; border-radius: 50%; background: #E5E5EA; }
        .biz .address {
          margin: 0 auto;
          padding: 0.2rem 1rem;
          border-radius: 7px;
          background: #F5F5F7;
          font-size: 0.72rem;
          color: #86868B;
        }

        .biz .body { display: flex; min-height: 340px; }
        .biz .side {
          width: 56px;
          flex-shrink: 0;
          border-right: 1px solid #F2F2F5;
          padding: 1rem 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.7rem;
        }
        .biz .brand {
          width: 30px; height: 30px; border-radius: 9px;
          background: #1D1D1F; color: #C2D8C4;
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 0.9rem; margin-bottom: 0.4rem;
        }
        .biz .nav { width: 22px; height: 6px; border-radius: 3px; background: #EDEDF0; }
        .biz .nav.active { background: #C2D8C4; }

        .biz .main { flex: 1; min-width: 0; padding: 1.25rem 1.4rem; }
        .biz .topline { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1.1rem; }
        .biz .muted { font-size: 0.72rem; color: #86868B; }
        .biz .day-title { font-size: 1.05rem; font-weight: 600; color: #1D1D1F; letter-spacing: -0.01em; }
        .biz .kpi { text-align: right; }
        .biz .kpi-value {
          font-size: 1.5rem; font-weight: 700; color: #1D1D1F;
          letter-spacing: -0.03em; font-variant-numeric: tabular-nums;
        }

        .biz .grid { display: flex; gap: 0.6rem; }
        .biz .masters {
          display: grid;
          grid-template-rows: 20px repeat(3, 1fr);
          width: 58px;
          flex-shrink: 0;
        }
        .biz .master { display: flex; align-items: center; font-size: 0.75rem; font-weight: 500; color: #3A3A3C; }

        .biz .timeline { flex: 1; min-width: 0; display: grid; grid-template-rows: 20px 1fr; }
        .biz .hours { display: grid; grid-template-columns: repeat(4, 1fr); font-size: 0.66rem; color: #AEAEB2; }
        .biz .lanes { position: relative; display: grid; grid-template-rows: repeat(3, 1fr); height: 210px; }
        .biz .lane { border-top: 1px dashed #EDEDF0; }
        .biz .lane:last-of-type { border-bottom: 1px dashed #EDEDF0; }

        /* Записи виїжджають зліва по черзі - як день, що заповнюється. */
        .biz .booking {
          position: absolute;
          border-radius: 10px;
          padding: 0.4rem 0.55rem;
          background: #F4FAF5;
          border-left: 3px solid #8FAE93;
          overflow: hidden;
          opacity: 0;
          transform: translateX(-12px);
          transition: opacity 0.5s ease, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .biz .window.in .booking { opacity: 1; transform: none; }
        .biz .b-title { font-size: 0.72rem; font-weight: 600; color: #2E3A30; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .biz .b-client { font-size: 0.66rem; color: #5C6B5E; white-space: nowrap; }

        /* Сповіщення - поза вікном, трохи виступає за край: так воно
           читається як подія, що сталася щойно, а не як частина
           інтерфейсу. */
        .biz .toast {
          position: absolute;
          right: clamp(-0.5rem, -2vw, -1.5rem);
          bottom: clamp(1rem, 4vw, 2.5rem);
          display: flex;
          align-items: center;
          gap: 0.7rem;
          padding: 0.8rem 1.1rem 0.8rem 0.9rem;
          border-radius: 16px;
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 18px 40px -16px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05);
          opacity: 0;
          transform: translateY(12px) scale(0.96);
          transition: opacity 0.6s ease, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .biz .toast.in { opacity: 1; transform: none; }
        .biz .toast-dot {
          width: 10px; height: 10px; border-radius: 50%;
          background: #6F9273;
          box-shadow: 0 0 0 4px rgba(111, 146, 115, 0.18);
        }
        .biz .toast-title { font-size: 0.8125rem; font-weight: 600; color: #1D1D1F; }
        .biz .toast-sub { font-size: 0.75rem; color: #86868B; }

        /* --- Три можливості --- */
        .biz .features {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: clamp(1.25rem, 3vw, 2.5rem);
          max-width: 920px;
          margin: clamp(2.5rem, 5vw, 3.5rem) auto 0;
        }
        .biz .feature {
          opacity: 0;
          transform: translateY(14px);
          transition: opacity 0.7s ease, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .biz .panel.in .feature { opacity: 1; transform: none; }
        .biz .f-title { font-size: 1rem; font-weight: 600; color: #1D1D1F; margin-bottom: 0.35rem; }
        .biz .f-text { font-size: 0.9375rem; line-height: 1.5; color: #6E6E73; }

        @media (max-width: 760px) {
          .biz .side { display: none; }
          .biz .features { grid-template-columns: 1fr; }
          .biz .toast { right: 0.75rem; }
          .biz .kpi-value { font-size: 1.2rem; }
        }

        @media (prefers-reduced-motion: reduce) {
          .biz .head, .biz .window, .biz .booking, .biz .toast, .biz .feature {
            transition: none !important;
          }
        }
      `}</style>
    </section>
  );
}
