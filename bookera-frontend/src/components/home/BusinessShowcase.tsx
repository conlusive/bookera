'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

/**
 * Блок для бізнесу - на весь екран, із відео-тлом і текстом,
 * що виринає рядками.
 *
 * Зроблено за готовим промтом, але з трьома змінами, бо це блок
 * ПОСЕРЕД сторінки, а не окрема сторінка:
 *
 *   - без навбару й мобільного меню: у сайту вже є хедер, і другий
 *     посеред сторінки ламав би навігацію
 *   - без глобального `* { margin: 0 }`: воно скинуло б відступи
 *     в усьому сайті
 *   - анімація стартує, коли блок потрапляє в поле зору, а не при
 *     завантаженні сторінки. Інакше текст «зʼїхав» би, поки людина
 *     ще нагорі, і вона побачила б уже готовий блок
 */

/** Сповіщення про онлайн-записи. */
const NOTIFS = [
  { who: 'Дарина', what: 'Манікюр · завтра о 11:00' },
  { who: 'Андрій', what: 'Стрижка · сьогодні о 17:30' },
];

/** Розклад дня - записи виїжджають по черзі. */
const DAY = [
  { time: '09:30', what: 'Стрижка', who: 'Максим' },
  { time: '11:00', what: 'Фарбування', who: 'Ірина' },
  { time: '13:00', what: 'Манікюр', who: 'Олена' },
  { time: '15:30', what: 'Борода', who: 'Андрій' },
];

/** Завантаженість тижня, у відсотках. */
const WEEK = [42, 58, 50, 72, 86, 100, 64];
const WEEK_DAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'];

export default function BusinessShowcase() {
  const ref = useRef<HTMLElement>(null);
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
    }, { threshold: 0.35 });
    o.observe(el);
    return () => o.disconnect();
  }, []);

  return (
    <section ref={ref} className={`bh ${inView ? 'in' : ''}`}>
      {/* Статична композиція замість відео: заклад у центрі світіння,
          клієнти на орбітах навколо. Жодного фото, яке могло б не
          підійти до теми, - лише форма й колір бренду. */}
      <div className="bh-art" aria-hidden>
        <div className="bh-grain" />
      </div>

      {/* Скляні картки праворуч - три живі моменти роботи закладу.
          Кожна пливе у власному ритмі: однакові коливання виглядали
          б як один рухомий шар, а не як три окремі речі. */}
      <div className="bh-cards" aria-hidden>
        <div className="glass g-notif">
          {NOTIFS.map((n, i) => (
            <div key={n.who} className="gn-row" style={{ animationDelay: `${1.1 + i * 0.5}s` }}>
              {/* Пульсуюче коло: хвиля розходиться від точки, як
                  сигнал, що щойно прийшов. */}
              <span className="pulse"><span /></span>
              <div>
                <div className="gn-t">Новий запис · {n.who}</div>
                <div className="gn-s">{n.what}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="glass g-day">
          <div className="g-head">
            <span>Сьогодні</span>
            <span className="g-count">{DAY.length} записи</span>
          </div>
          {DAY.map((d, i) => (
            <div key={d.time} className="gd-row" style={{ animationDelay: `${1.3 + i * 0.18}s` }}>
              <span className="gd-time">{d.time}</span>
              <span className="gd-bar" />
              <span className="gd-what">{d.what}</span>
              <span className="gd-who">{d.who}</span>
            </div>
          ))}
        </div>

        <div className="glass g-week">
          <div className="g-head"><span>Тиждень</span></div>
          <div className="gw-bars">
            {WEEK.map((v, i) => (
              <div key={i} className="gw-col">
                <div className="gw-track">
                  <div
                    className={`gw-bar ${i === 5 ? 'peak' : ''}`}
                    style={{ ['--h' as string]: v / 100, animationDelay: `${1.5 + i * 0.07}s` }}
                  />
                </div>
                <span>{WEEK_DAYS[i]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bh-content">
        <div className="bh-top">
          <div className="bh-badge anim" style={{ animationDelay: '0.2s' }}>
            BookEra Business
          </div>
          <h2 className="bh-title anim" style={{ animationDelay: '0.4s' }}>
            Сучасне рішення
            <br />
            для вашого
            <br />
            бізнесу.
          </h2>
        </div>

        <div className="bh-bottom">
          <p className="bh-text anim" style={{ animationDelay: '0.7s' }}>
            BookEra Business — це повноцінна екосистема для власників салонів та приватних майстрів.
            Залучайте нових клієнтів, керуйте розкладом та ведіть фінансову аналітику в одній програмі.
          </p>
          <div className="bh-ctas anim" style={{ animationDelay: '0.9s' }}>
            <Link href="/business" className="bh-cta">
              Створити профіль
              <ArrowRight size={16} />
            </Link>
            <Link href="/business#features" className="bh-link">Усі можливості</Link>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .bh {
          position: relative;
          /* svh на телефонах: 100vh там включає смугу браузера, і
             нижній текст ховався б під нею. */
          height: 100vh;
          height: 100svh;
          min-height: 600px;
          width: 100%;
          overflow: hidden;
          background: #000;
          color: #fff;
        }

        /* Тло: глибокий зелено-чорний і мʼяке світіння матчі
           праворуч, звідки розходяться орбіти. Ліворуч - темніше,
           там стоїть текст. */
        .bh-art {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(55% 70% at 74% 50%, rgba(111, 146, 115, 0.55) 0%, rgba(111, 146, 115, 0) 70%),
            radial-gradient(30% 40% at 80% 38%, rgba(194, 216, 196, 0.35) 0%, rgba(194, 216, 196, 0) 70%),
            radial-gradient(60% 80% at 10% 100%, rgba(30, 44, 34, 0.9) 0%, rgba(30, 44, 34, 0) 70%),
            #0B0F0C;
        }

        /* Зерно: прибирає смуги на градієнтах (на великих екранах
           плавний перехід розпадається на сходинки) і дає тлу фактуру
           друкованого матеріалу. */
        .bh-grain {
          position: absolute;
          inset: 0;
          opacity: 0.09;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }

        .bh-content {
          position: relative;
          z-index: 10;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 3rem 1.5rem 2.5rem;
        }
        @media (min-width: 640px) { .bh-content { padding: 4rem 1.5rem 3rem; } }
        @media (min-width: 768px) { .bh-content { padding: 5rem 3rem 4rem; } }
        @media (min-width: 1024px) { .bh-content { padding: 5rem 4rem 4rem; } }

        .bh-top { max-width: 48rem; }

        .bh-badge {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.9);
          margin-bottom: 1rem;
        }
        @media (min-width: 640px) { .bh-badge { font-size: 0.875rem; margin-bottom: 1.5rem; } }

        .bh-title {
          font-size: 1.875rem;
          font-weight: 500;
          line-height: 1.1;
          letter-spacing: -0.025em;
          color: #fff;
          margin: 0;
        }
        @media (min-width: 640px) { .bh-title { font-size: 3rem; } }
        @media (min-width: 768px) { .bh-title { font-size: 3.75rem; } }
        @media (min-width: 1024px) { .bh-title { font-size: 4.5rem; } }

        .bh-text {
          font-size: 0.875rem;
          line-height: 1.625;
          color: rgba(255,255,255,0.6);
          max-width: 24rem;
          margin: 0 0 1.25rem;
        }
        @media (min-width: 640px) { .bh-text { font-size: 1rem; max-width: 32rem; margin-bottom: 1.5rem; } }
        @media (min-width: 768px) { .bh-text { font-size: 1.125rem; } }

        .bh-ctas { display: flex; align-items: center; gap: 1.5rem; }
        .bh-cta {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          border-radius: 0.5rem;
          background: #fff;
          color: #000;
          padding: 0.625rem 1.25rem;
          font-size: 0.875rem;
          font-weight: 500;
          text-decoration: none;
          transition: transform 0.2s ease;
        }
        .bh-cta:hover { transform: scale(1.05); }
        @media (min-width: 640px) { .bh-cta { padding: 0.75rem 1.5rem; } }
        .bh-link { font-size: 0.875rem; color: rgba(255,255,255,0.8); text-decoration: none; transition: color 0.2s; }
        .bh-link:hover { color: #fff; }

        /* --- Скляні картки --- */
        .bh-cards {
          position: absolute;
          z-index: 5;
          top: 50%;
          right: clamp(1.5rem, 6vw, 6rem);
          transform: translateY(-50%);
          /* Ширина росте з екраном і займає вільне місце по центру.
             Раніше картки були фіксовані 420px, і на широких екранах між
             ними й текстом лишалась порожнеча.

             94vw - 700px: від правого краю до кінця заголовка (~658px)
             мінус 40px проміжку. Перевірено розрахунком на 1100-1920px -
             на жодній ширині картки не лягають на заголовок. */
          width: min(680px, calc(94vw - 700px));
          height: min(620px, 78vh);
          /* Вміст карток у em від цього розміру: картки ростуть - росте
             й текст у них. Без цього на широкому екрані дрібний текст
             плавав би у великих порожніх картках. */
          font-size: clamp(14px, 1.3vw, 20px);
        }

        /* Скло на темному градієнті: напівпрозоре тло, розмиття того,
           що під ним, і тонкий світлий край - саме край робить
           скло склом, без нього це просто сірий прямокутник. */
        .glass {
          position: absolute;
          border-radius: 1.3em;
          padding: 1.15em 1.25em;
          background: linear-gradient(160deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.14) 100%);
          backdrop-filter: blur(22px) saturate(1.3);
          -webkit-backdrop-filter: blur(22px) saturate(1.3);
          border: 1px solid rgba(255,255,255,0.3);
          box-shadow: 0 30px 60px -30px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.28);
          color: #fff;
          opacity: 0;
        }
        .bh.in .glass {
          animation:
            bhCardIn 1s cubic-bezier(0.16, 1, 0.3, 1) both,
            bhFloat 7s ease-in-out infinite;
        }
        /* Картки стоять уступами й трохи накладаються: композиція, а не
           стовпчик. */
        .g-notif { top: 0; left: 8%; width: 76%; }
        .g-day   { top: 30%; left: 0; width: 72%; }
        .g-week  { top: 58%; right: 0; width: 56%; }
        .bh.in .g-notif { animation-delay: 0.5s, 1.5s; }
        .bh.in .g-day   { animation-delay: 0.7s, 2.6s; animation-duration: 1s, 8s; }
        .bh.in .g-week  { animation-delay: 0.9s, 3.4s; animation-duration: 1s, 9s; }

        @keyframes bhCardIn {
          from { opacity: 0; transform: translateY(40px) scale(0.96); }
          to { opacity: 1; transform: none; }
        }
        /* Повільне коливання: 6 пікселів за 7-9 секунд. Помітне, лише
           якщо придивитись, - але сцена перестає бути картинкою. */
        @keyframes bhFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }

        .g-head {
          display: flex;
          justify-content: space-between;
          font-size: 0.75em;
          font-weight: 600;
          color: rgba(255,255,255,0.85);
          margin-bottom: 0.7em;
        }
        .g-count { color: #C2D8C4; font-weight: 500; }

        /* Сповіщення */
        .gn-row {
          display: flex;
          align-items: center;
          gap: 0.7em;
          padding: 0.35em 0;
          opacity: 0;
        }
        .gn-row + .gn-row { border-top: 1px solid rgba(255,255,255,0.16); margin-top: 0.35em; padding-top: 0.7em; }
        .bh.in .gn-row { animation: bhFadeSlideUp 0.6s ease both; }
        .gn-t { font-size: 0.8125em; font-weight: 600; }
        .gn-s { font-size: 0.72em; color: rgba(255,255,255,0.72); }

        .pulse {
          position: relative;
          width: 0.62em;
          height: 0.62em;
          flex-shrink: 0;
          border-radius: 50%;
          background: #C2D8C4;
        }
        .pulse span {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 1.5px solid #C2D8C4;
          animation: bhPulse 2.4s ease-out infinite;
        }
        @keyframes bhPulse {
          from { transform: scale(1); opacity: 0.8; }
          to { transform: scale(3.2); opacity: 0; }
        }

        /* Розклад */
        .gd-row {
          display: grid;
          grid-template-columns: 2.6em 3px 1fr auto;
          gap: 0.6em;
          align-items: center;
          padding: 0.4em 0;
          font-size: 0.75em;
          opacity: 0;
        }
        .bh.in .gd-row { animation: bhSlideIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
        @keyframes bhSlideIn {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: none; }
        }
        .gd-time { color: rgba(255,255,255,0.7); font-variant-numeric: tabular-nums; }
        .gd-bar { height: 1.15em; border-radius: 2px; background: #8FAE93; }
        .gd-what { font-weight: 500; }
        .gd-who { color: rgba(255,255,255,0.7); }

        /* Тиждень */
        .gw-bars { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.4em; height: 6em; }
        .gw-col { display: flex; flex-direction: column; align-items: center; gap: 0.35em; }
        .gw-col span { font-size: 0.62em; color: rgba(255,255,255,0.68); }
        .gw-track { flex: 1; width: 100%; display: flex; align-items: flex-end; }
        .gw-bar {
          width: 100%;
          height: 100%;
          border-radius: 5px;
          background: rgba(194, 216, 196, 0.45);
          transform-origin: bottom;
          transform: scaleY(0);
        }
        /* Найзавантаженіший день яскравіший: саме цю відповідь людина
           й шукає, дивлячись на тиждень. */
        .gw-bar.peak { background: #C2D8C4; }
        .bh.in .gw-bar { animation: bhGrow 1s cubic-bezier(0.16, 1, 0.3, 1) both; }
        @keyframes bhGrow {
          from { transform: scaleY(0); }
          to { transform: scaleY(var(--h)); }
        }

        /* До 1100px - одна картка сповіщень посередині, між заголовком
           угорі й текстом унизу, де якраз порожньо. Три картки поруч
           із великим заголовком на 1024px на нього наклалися б -
           перевірено розрахунком ширини рядка. */
        @media (max-width: 1100px) {
          .bh-cards {
            right: 50%;
            transform: translate(50%, -50%);
            width: min(340px, 86vw);
            height: auto;
            font-size: 15px;
          }
          .g-notif { position: relative; left: 0; width: 100%; }
          .g-day, .g-week { display: none; }
        }

        /* Рядки чекають, поки блок зʼявиться в полі зору. */
        .bh .anim { opacity: 0; }
        .bh.in .anim { animation: bhFadeSlideUp 0.8s ease both; }

        @keyframes bhFadeSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .bh .anim, .bh.in .anim { opacity: 1; animation: none; }
          .glass, .gn-row, .gd-row { opacity: 1 !important; animation: none !important; }
          .gw-bar { animation: none !important; transform: scaleY(var(--h)); }
          .pulse span { animation: none; }
        }
      `}</style>
    </section>
  );
}
