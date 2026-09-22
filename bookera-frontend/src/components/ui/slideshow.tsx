'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

/**
 * Журнальний розворот: фото ліворуч, заголовок праворуч.
 *
 * Раніше кадр ішов на всю ширину екрана, і блоки вище починали
 * виглядати «в коробці»: сторінка тримає один контейнер, а цей
 * виривався з нього. Розворот живе в тих самих межах, що й решта,
 * і все одно відчувається окремим - за рахунок композиції, а не
 * розміру.
 *
 * Друга половина - спокійне тепле тло з великим заголовком. Перший
 * рядок жирним, другий - тонким курсивним антиквенним шрифтом: так
 * верстають модні журнали, і саме цей контраст робить блок
 * впізнаваним, а не ще однією каруселлю.
 */

export interface Slide {
  img: string;
  /** Два рядки: перший жирним, другий курсивом. */
  text: string[];
  caption?: string;
  onClick?: () => void;
}

interface SlideshowProps {
  slides: Slide[];
  autoplayMs?: number;
}

export default function Slideshow({ slides, autoplayMs = 6000 }: SlideshowProps) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  // Лічильник для перезапуску смужки прогресу: змінюється з кожним
  // кадром, і React перемальовує смужку з нуля.
  const [cycle, setCycle] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const total = slides.length;

  const go = useCallback((dir: 1 | -1) => {
    setCurrent(i => (i + dir + total) % total);
    setCycle(c => c + 1);
  }, [total]);

  useEffect(() => {
    if (!autoplayMs || isPaused || total < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setTimeout(() => go(1), autoplayMs);
    return () => clearTimeout(timer);
  }, [autoplayMs, isPaused, total, go, cycle]);

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
    touchStartX.current = null;
  };

  if (total === 0) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const slide = slides[current];

  return (
    <div
      className="spread"
      role="region"
      aria-roledescription="слайд-шоу"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Фото: усі кадри лежать один на одному, видно активний. */}
      <div className="photo">
        {slides.map((s, i) => (
          <div
            key={i}
            className={`frame ${i === current ? 'active' : ''}`}
            style={{ backgroundImage: `url(${s.img})`, cursor: s.onClick ? 'pointer' : 'default' }}
            onClick={s.onClick}
            aria-hidden={i !== current}
          />
        ))}
      </div>

      <div className="panel">
        <div className="counter">
          <span className="now">{pad(current + 1)}</span>
          <span className="rule" />
          <span>{pad(total)}</span>
        </div>

        {/* key={current} - заголовок перемальовується з кожним кадром,
            і анімація появи відпрацьовує знову. */}
        <h3 key={current} className="headline">
          {slide.caption && <small>{slide.caption}</small>}
          <span className="line-strong">{slide.text[0]}</span>
          {slide.text[1] && <span className="line-soft">{slide.text[1]}</span>}
        </h3>

        {total > 1 && (
          <div className="controls">
            {/* Смужка прогресу: показує, коли зміниться кадр. Без неї
                автоперемикання застає зненацька посеред читання. */}
            <div className="progress">
              <span
                key={cycle}
                style={{
                  animationDuration: `${autoplayMs}ms`,
                  animationPlayState: isPaused ? 'paused' : 'running',
                }}
              />
            </div>
            <div className="arrows">
              <button onClick={() => go(-1)} aria-label="Попередній кадр"><ArrowLeft size={18} strokeWidth={1.6} /></button>
              <button onClick={() => go(1)} aria-label="Наступний кадр"><ArrowRight size={18} strokeWidth={1.6} /></button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .spread {
          display: grid;
          grid-template-columns: 1.35fr 1fr;
          min-height: clamp(460px, 42vw, 600px);
          border-radius: 24px;
          overflow: hidden;
          /* Тепле тло, а не біле: біле злилось би зі сторінкою, і
             розворот читався б як фото з підписом, а не як сторінка
             журналу. */
          background: #F4F1EC;
          outline: none;
          user-select: none;
        }

        .photo { position: relative; overflow: hidden; background: #E8E3DC; }
        .frame {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          opacity: 0;
          transform: scale(1.05);
          transition: opacity 1s ease, transform 8s ease-out;
        }
        .frame.active { opacity: 1; transform: scale(1); }

        .panel {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: clamp(2rem, 4vw, 3.5rem);
        }

        .counter {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.8125rem;
          letter-spacing: 0.08em;
          color: #8A847C;
          font-variant-numeric: tabular-nums;
        }
        .counter .now { color: #1D1D1F; font-weight: 600; }
        .counter .rule { width: 32px; height: 1px; background: #CFC8BE; }

        .headline {
          margin: 0;
          display: flex;
          flex-direction: column;
          color: #1D1D1F;
        }
        .headline small {
          font-size: 0.75rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #8A847C;
          margin-bottom: 1rem;
        }
        .line-strong {
          font-size: clamp(2.25rem, 4.6vw, 4rem);
          font-weight: 700;
          line-height: 1;
          letter-spacing: -0.035em;
          animation: rise 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        /* Другий рядок - антиквою й курсивом. Системний шрифт, без
           завантаження: Georgia є на кожній машині. */
        .line-soft {
          font-family: Georgia, 'Times New Roman', serif;
          font-style: italic;
          font-weight: 400;
          font-size: clamp(2.25rem, 4.6vw, 4rem);
          line-height: 1.05;
          letter-spacing: -0.02em;
          color: #5C5650;
          animation: rise 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
        }
        @keyframes rise {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .controls { display: flex; align-items: center; gap: 1.5rem; }
        .progress {
          flex: 1;
          height: 2px;
          background: #DDD6CC;
          border-radius: 2px;
          overflow: hidden;
        }
        .progress span {
          display: block;
          height: 100%;
          background: #1D1D1F;
          transform-origin: left;
          animation-name: fill;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }
        @keyframes fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }

        .arrows { display: flex; gap: 0.5rem; }
        .arrows button {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 1px solid #CFC8BE;
          background: transparent;
          color: #1D1D1F;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background-color 0.2s ease, border-color 0.2s ease;
        }
        .arrows button:hover { background: #1D1D1F; border-color: #1D1D1F; color: #fff; }

        /* На телефоні - фото зверху, текст під ним. Поруч на вузькому
           екрані обидві половини стали б надто тісними. */
        @media (max-width: 760px) {
          .spread { grid-template-columns: 1fr; }
          .photo { aspect-ratio: 4 / 5; }
          .arrows { display: none; }
        }

        @media (prefers-reduced-motion: reduce) {
          .frame { transition: opacity 0.3s ease; transform: none !important; }
          .line-strong, .line-soft { animation: none; }
          .progress { display: none; }
        }
      `}</style>
    </div>
  );
}
