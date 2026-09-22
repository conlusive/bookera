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

const VIDEO =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_204221_5339e40b-e73d-4ab0-9c65-79c18c66fd50.mp4';

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
      <video
        className="bh-video"
        src={VIDEO}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden
      />

      {/* Затемнення: без нього білий текст губиться на світлих кадрах.
          Сильніше зліва й знизу - там, де стоїть текст, - і майже
          прозоре праворуч, щоб відео лишалось видимим. */}
      <div className="bh-shade" aria-hidden />

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

        .bh-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: 70% center;
        }

        .bh-shade {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(to right, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0) 75%),
            linear-gradient(to top, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 40%);
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
