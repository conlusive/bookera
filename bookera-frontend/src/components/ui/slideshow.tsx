'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

/**
 * Слайд-шоу на всю ширину: один кадр за раз, текст великими рядками.
 *
 * Взято за основу готовий компонент, але з доробками, без яких він
 * не працював би в продукті:
 *
 *   - у оригіналі НЕ БУЛО СТИЛІВ: класи .slide, .active тощо ніде
 *     не визначені, і всі кадри просто стояли б стовпчиком
 *   - дані приходять пропсами, а не зашиті всередину: той самий
 *     компонент можна поставити де завгодно
 *   - лічильник рахувався як `0{n}` - на десятому кадрі виходило
 *     «010». Тепер padStart
 *   - кадр клікабельний: колекція має вести до закладів, а не бути
 *     картинкою
 *   - гортання свайпом на телефоні й стрілками на клавіатурі
 *   - автоперемикання, яке зупиняється, коли людина дивиться
 */

export interface Slide {
  img: string;
  /** Рядки заголовка - кожен з нового рядка, великими літерами. */
  text: string[];
  /** Дрібний надпис над заголовком: «8 закладів». */
  caption?: string;
  onClick?: () => void;
}

interface SlideshowProps {
  slides: Slide[];
  /** Мілісекунд між кадрами. 0 - без автоперемикання. */
  autoplayMs?: number;
  /** Висота. За замовчуванням - пропорційно ширині, з межами. */
  height?: string;
}

export default function Slideshow({
  slides,
  autoplayMs = 6000,
  height = 'clamp(420px, 62vw, 720px)',
}: SlideshowProps) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const total = slides.length;

  const next = useCallback(() => setCurrent(i => (i + 1) % total), [total]);
  const prev = useCallback(() => setCurrent(i => (i - 1 + total) % total), [total]);

  // Автоперемикання.
  //
  // Пауза, поки людина тримає курсор над кадром: вона читає або
  // збирається клікнути, і кадр, що зникає з-під курсора, дратує.
  //
  // Також поважаємо системне налаштування руху - людям із
  // вестибулярними розладами постійна зміна кадрів буває нестерпною.
  useEffect(() => {
    if (!autoplayMs || isPaused || total < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const timer = setInterval(next, autoplayMs);
    return () => clearInterval(timer);
  }, [autoplayMs, isPaused, total, next]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
  };

  // Свайп: поріг 40 пікселів, щоб випадковий дотик при прокрутці
  // сторінки не перемикав кадр.
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) (dx < 0 ? next : prev)();
    touchStartX.current = null;
  };

  if (total === 0) return null;

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div
      className="slideshow"
      style={{ height }}
      role="region"
      aria-roledescription="слайд-шоу"
      aria-label="Кураторські колекції"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {slides.map((slide, i) => (
        <div
          key={i}
          className={`slide ${i === current ? 'active' : ''}`}
          onClick={slide.onClick}
          role={slide.onClick ? 'button' : undefined}
          // Курсор-«рука» лише для клікабельних кадрів: над фото, яке
          // нікуди не веде, він обіцяв би перехід, якого немає.
          style={{ backgroundImage: `url(${slide.img})`, cursor: slide.onClick ? 'pointer' : 'default' }}
          aria-hidden={i !== current}
        >
          <div className="slide-text">
            {slide.caption && <small>{slide.caption}</small>}
            {slide.text.map((t, j) => (
              <span key={j} style={{ transitionDelay: `${0.25 + j * 0.1}s` }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      ))}

      {/* З одним кадром гортати нікуди: стрілки й лічильник «01 / 01»
          лише обіцяли б більше, ніж є. */}
      {total > 1 && (
        <>
          <button className="nav left" onClick={prev} aria-label="Попередня колекція">
            <ArrowLeft size={20} strokeWidth={1.75} />
          </button>
          <button className="nav right" onClick={next} aria-label="Наступна колекція">
            <ArrowRight size={20} strokeWidth={1.75} />
          </button>

          <div className="counter" aria-live="polite">
            {pad(current + 1)} / {pad(total)}
          </div>
        </>
      )}

      <style jsx>{`
        .slideshow {
          position: relative;
          width: 100%;
          overflow: hidden;
          background: #111;
          outline: none;
          user-select: none;
        }

        /* Кадри лежать один на одному; видно активний.
           Перехрещення прозорістю, а не зсув: зсув на весь екран
           читається як перегортання сторінки й відволікає від
           самого кадру. */
        .slide {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          opacity: 0;
          transform: scale(1.06);
          transition: opacity 1.1s ease, transform 7s ease-out;
        }
        .slide.active {
          opacity: 1;
          /* Повільний наїзд, поки кадр на екрані: статичне фото на всю
             ширину виглядає як шпалери, ледь помітний рух - як кадр. */
          transform: scale(1);
          z-index: 1;
        }

        /* Затемнення знизу - під текст. Без нього білі літери губляться
           на світлих ділянках фото. */
        .slide::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.15) 45%, rgba(0,0,0,0) 70%);
        }

        .slide-text {
          position: absolute;
          left: clamp(1.5rem, 5vw, 4.5rem);
          bottom: clamp(2rem, 6vw, 5rem);
          z-index: 2;
          display: flex;
          flex-direction: column;
          color: #fff;
        }
        .slide-text small {
          font-size: 0.8125rem;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          opacity: 0.8;
          margin-bottom: 0.9rem;
        }
        .slide-text span {
          font-size: clamp(2rem, 6.5vw, 5.25rem);
          font-weight: 700;
          line-height: 0.98;
          letter-spacing: -0.035em;
          text-transform: uppercase;
          /* Рядки виринають знизу по черзі, коли кадр стає активним. */
          opacity: 0;
          transform: translateY(22px);
          transition: opacity 0.7s ease, transform 0.9s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .slide.active .slide-text span {
          opacity: 1;
          transform: translateY(0);
        }

        .nav {
          position: absolute;
          bottom: clamp(2rem, 6vw, 5rem);
          z-index: 3;
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.35);
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background-color 0.2s ease, border-color 0.2s ease;
        }
        .nav:hover {
          background: rgba(255,255,255,0.2);
          border-color: rgba(255,255,255,0.6);
        }
        /* Обидві стрілки праворуч, поруч: розкидані по краях вони
           змагаються з текстом ліворуч. */
        .nav.left { right: calc(clamp(1.5rem, 5vw, 4.5rem) + 58px); }
        .nav.right { right: clamp(1.5rem, 5vw, 4.5rem); }

        .counter {
          position: absolute;
          top: clamp(1.25rem, 3vw, 2rem);
          right: clamp(1.5rem, 5vw, 4.5rem);
          z-index: 3;
          color: #fff;
          font-size: 0.8125rem;
          font-weight: 500;
          letter-spacing: 0.08em;
          font-variant-numeric: tabular-nums;
          opacity: 0.85;
        }

        @media (max-width: 640px) {
          /* На телефоні стрілки ховаємо - там гортають свайпом, а дві
             кнопки на вузькому екрані накривали б заголовок. */
          .nav { display: none; }
        }

        @media (prefers-reduced-motion: reduce) {
          .slide, .slide-text span {
            transition: opacity 0.3s ease;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}
