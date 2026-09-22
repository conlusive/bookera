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

/**
 * Точки на орбітах - клієнти навколо закладу.
 *
 * Кут у градусах і номер орбіти. Розкидані нерівно навмисно: рівні
 * інтервали читаються як креслення, нерівні - як живе середовище.
 */
const ORBIT_DOTS = [
  { ring: 1, angle: 200, size: 7 },
  { ring: 1, angle: 320, size: 5 },
  { ring: 2, angle: 150, size: 6 },
  { ring: 2, angle: 255, size: 8 },
  { ring: 2, angle: 20, size: 5 },
  { ring: 3, angle: 185, size: 5 },
  { ring: 3, angle: 230, size: 7 },
  { ring: 3, angle: 300, size: 4 },
];
const RINGS = [180, 290, 410, 540];

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
        <svg className="bh-orbits" viewBox="-600 -600 1200 1200">
          {RINGS.map((r, i) => (
            <circle
              key={r}
              r={r}
              fill="none"
              stroke="rgba(194, 216, 196, 1)"
              // Зовнішні кола тонші й прозоріші: так вони розчиняються
              // в темряві, а не обриваються різко.
              strokeOpacity={0.16 - i * 0.03}
              strokeWidth={1}
            />
          ))}
          {ORBIT_DOTS.map((d, i) => {
            const r = RINGS[d.ring];
            const a = (d.angle * Math.PI) / 180;
            return (
              <circle
                key={i}
                cx={Math.cos(a) * r}
                cy={Math.sin(a) * r}
                r={d.size}
                fill="#C2D8C4"
                fillOpacity={0.55 + (i % 3) * 0.15}
              />
            );
          })}
          {/* Центр - сам заклад. */}
          <circle r={34} fill="#C2D8C4" fillOpacity={0.9} />
          <circle r={34} fill="none" stroke="#C2D8C4" strokeOpacity={0.25} strokeWidth={14} />
        </svg>
        <div className="bh-grain" />
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
            <Link href="/business#pricing" className="bh-link">Тарифи</Link>
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

        /* Орбіти: квадрат, прив'язаний до правої частини, щоб центр
           завжди стояв у світінні незалежно від ширини екрана. */
        .bh-orbits {
          position: absolute;
          top: 50%;
          left: 74%;
          width: min(1200px, 130vh);
          height: min(1200px, 130vh);
          transform: translate(-50%, -50%);
          overflow: visible;
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

        /* На телефоні орбіти відсуваються нижче й праворуч, щоб не
           лягати під заголовок. */
        @media (max-width: 760px) {
          .bh-orbits { left: 85%; top: 72%; width: 130vw; height: 130vw; }
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

        /* Рядки чекають, поки блок зʼявиться в полі зору. */
        .bh .anim { opacity: 0; }
        .bh.in .anim { animation: bhFadeSlideUp 0.8s ease both; }

        @keyframes bhFadeSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .bh .anim, .bh.in .anim { opacity: 1; animation: none; }
        }
      `}</style>
    </section>
  );
}
