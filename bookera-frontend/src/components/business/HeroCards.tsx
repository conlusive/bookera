'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Віяло кольорових карток під головним заголовком бізнес-лендінгу.
 *
 * Картки «стирчать» із лінії внизу (як книги на полиці в референсі), а коли
 * сторінку гортають вниз - падають за цю лінію: кожна зі своєю швидкістю й
 * поворотом, тож виглядає як осипання, а не як один зсув. Спершу, при
 * завантаженні, вони по черзі вискакують знизу.
 *
 * Анімація - лише transform від одного числа --p (0..1), яке оновлюється на
 * скролі через requestAnimationFrame. Без prefers-reduced-motion: картки
 * стоять на місці.
 */
type Card = {
  name: string;
  hint: string;
  bg: string;
  fg: string;
  r: number;      // нахил, градуси
  y: number;      // зміщення вниз від верху сцени, px
  fall: number;   // наскільки опускається при скролі, px
  spin: number;   // на скільки доповертається при скролі, градуси
  art: ReactNode;
};

const bars = (c: string) => (
  <div className="hc-bars">{[38, 64, 48, 82, 58, 94].map((h, i) => <i key={i} style={{ height: `${h}%`, background: c }} />)}</div>
);

const CARDS: Card[] = [
  { name: 'Радар', hint: 'Вище в рекомендаціях', bg: '#F28B54', fg: '#fff', r: -17, y: 120, fall: 360, spin: -10,
    art: <div className="hc-radar"><i /><i /><i /><b /></div> },
  { name: 'Розсилки', hint: 'Клієнти повертаються', bg: '#F4A6BE', fg: '#3B1B27', r: -12, y: 66, fall: 300, spin: -7,
    art: <div className="hc-pct">−20%<small>промокод</small></div> },
  { name: 'Клієнти', hint: 'Історія й нотатки', bg: '#FFFFFF', fg: '#1D1D1F', r: -5, y: 28, fall: 420, spin: -5,
    art: <div className="hc-people">{['#C2D8C4', '#F6D44A', '#B7C6F2'].map((c, i) => <p key={i}><i style={{ background: c }} /><span /></p>)}</div> },
  { name: 'Календар', hint: 'Без накладок', bg: '#1D1D1F', fg: '#fff', r: 2, y: 8, fall: 340, spin: 6,
    art: <div className="hc-cal">{['10:00', '12:30', '15:00'].map((t, i) => <p key={t}><b>{t}</b><span style={{ width: `${70 - i * 14}%` }} /></p>)}</div> },
  { name: 'Онлайн-запис', hint: 'Клієнти бронюють самі', bg: '#F6D44A', fg: '#2B2508', r: 8, y: 34, fall: 400, spin: 8,
    art: <div className="hc-chips">{['13:00', '13:30', '14:00', '15:30'].map(t => <span key={t}>{t}</span>)}</div> },
  { name: 'Аналітика', hint: 'Дохід і нові клієнти', bg: '#9DC3A0', fg: '#12301A', r: 13, y: 74, fall: 330, spin: 9,
    art: bars('#12301A') },
  { name: 'Склад', hint: 'Залишки й списання', bg: '#A9B9F2', fg: '#17224D', r: 18, y: 124, fall: 380, spin: 11,
    art: <div className="hc-grid">{Array.from({ length: 6 }, (_, i) => <i key={i} />)}</div> },
];

export default function HeroCards() {
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let last = -1;
    const update = () => {
      raf = 0;
      // Падіння прискорюється (p²): спершу ледь помітно, далі швидше - як справжня вага
      const p = Math.min(1, Math.max(0, window.scrollY / 560));
      const v = Math.round(p * p * 1000) / 1000;
      if (v === last) return;          // нічого не змінилось - не чіпаємо стилі
      last = v;
      el.style.setProperty('--p', String(v));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  return (
    <div className="hc-stage" ref={stage} aria-hidden>
      <div className="hc-fan">
        {CARDS.map((c, i) => {
          const d = i - 3;
          return (
            <div
              key={c.name}
              className="hc-card"
              style={{
                ['--x' as string]: `${d * 128}px`,
                ['--y' as string]: `${c.y}px`,
                ['--r' as string]: `${c.r}deg`,
                ['--fall' as string]: `${c.fall}px`,
                ['--spin' as string]: `${c.spin}deg`,
                ['--d' as string]: `${0.1 + Math.abs(d) * 0.09}s`,
                // Кожна наступна лягає поверх попередньої, як карти в руці: ліва частина (з назвою) завжди видна
                zIndex: i + 1,
              }}
            >
              <div className="hc-rise">
                <div className="hc-face" style={{ background: c.bg, color: c.fg }}>
                  <div className="hc-name">{c.name}</div>
                  <div className="hc-hint">{c.hint}</div>
                  <div className="hc-art">{c.art}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hc-fade" />

      <style jsx global>{`
        /* Сцена НЕ міняє розмір при скролі (це перераховувало б розмітку кожен кадр) - лише transform карток.
           Знизу - накладка-градієнт замість mask-image: маска змушує браузер (особливо Safari) заново
           композитити всю сцену кожного кадру. */
        .hc-stage { --p: 0; --s: 1; position: relative; height: calc(340px * var(--s)); margin: 3.5rem 0 0; overflow: hidden; pointer-events: none;
          width: 100vw; margin-left: calc(50% - 50vw); contain: layout paint; }
        .hc-fade { position: absolute; left: 0; right: 0; bottom: 0; height: 46%; z-index: 30; pointer-events: none;
          background: linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,.88) 70%, #fff 100%); }
        .hc-fan { position: absolute; left: 50%; top: 0; width: 0; height: 340px; transform: scale(var(--s)); transform-origin: top center; }
        .hc-card {
          position: absolute; top: 0; left: -112px; width: 224px; height: 330px;
          transform: translate(calc(var(--x)), calc(var(--y) + var(--p) * var(--fall))) rotate(calc(var(--r) + var(--p) * var(--spin)));
          transform-origin: 50% 100%;
          will-change: transform;
          backface-visibility: hidden;
        }
        .hc-rise { width: 100%; height: 100%; animation: hcRise 1.1s cubic-bezier(.16,1,.3,1) var(--d) both; }
        @keyframes hcRise { from { transform: translateY(380px) rotate(0deg); opacity: 0; } 30% { opacity: 1; } to { transform: none; opacity: 1; } }
        .hc-face {
          width: 100%; height: 100%; border-radius: 24px; padding: 1.2rem 1.15rem; box-sizing: border-box; overflow: hidden;
          box-shadow: 0 14px 28px -16px rgba(17, 24, 39, .4), 0 0 0 1px rgba(0,0,0,.04);
          display: flex; flex-direction: column; text-align: left; align-items: flex-start;
        }
        .hc-name { font-size: 1.35rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1.1; }
        .hc-hint { font-size: .78rem; opacity: .7; margin-top: .3rem; font-weight: 500; }
        .hc-art { margin-top: auto; padding-top: 1rem; width: 100%; }

        .hc-bars { display: flex; align-items: flex-end; gap: 7px; height: 120px; }
        .hc-bars i { flex: 1; border-radius: 6px 6px 2px 2px; opacity: .85; }
        .hc-cal p { margin: 0 0 .65rem; display: flex; align-items: center; gap: .6rem; font-size: .78rem; }
        .hc-cal b { font-weight: 600; opacity: .9; font-variant-numeric: tabular-nums; }
        .hc-cal span { height: 22px; border-radius: 7px; background: #C2D8C4; }
        .hc-chips { display: flex; flex-wrap: wrap; gap: .45rem; }
        .hc-chips span { padding: .4rem .7rem; border-radius: 10px; background: rgba(43,37,8,.12); font-size: .78rem; font-weight: 700; }
        .hc-people p { margin: 0 0 .6rem; display: flex; align-items: center; gap: .6rem; }
        .hc-people i { width: 28px; height: 28px; border-radius: 50%; flex: none; }
        .hc-people span { height: 9px; border-radius: 5px; background: #E5E5EA; flex: 1; }
        .hc-pct { font-size: 2.6rem; font-weight: 800; letter-spacing: -0.05em; line-height: 1; }
        .hc-pct small { display: block; font-size: .78rem; font-weight: 600; letter-spacing: 0; opacity: .65; margin-top: .3rem; }
        .hc-radar { position: relative; width: 130px; height: 130px; margin-left: auto; }
        .hc-radar i { position: absolute; inset: 0; border: 2px solid rgba(255,255,255,.65); border-radius: 50%; }
        .hc-radar i:nth-child(2) { inset: 20px; }
        .hc-radar i:nth-child(3) { inset: 40px; }
        .hc-radar b { position: absolute; left: 61px; top: 61px; width: 12px; height: 12px; border-radius: 50%; background: #fff; }
        .hc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem; }
        .hc-grid i { aspect-ratio: 1; border-radius: 10px; background: rgba(23,34,77,.16); }
        .hc-grid i:nth-child(2), .hc-grid i:nth-child(5) { background: rgba(23,34,77,.32); }

        @media (max-width: 1100px) { .hc-stage { --s: .82; } }
        @media (max-width: 860px)  { .hc-stage { --s: .62; } }
        @media (max-width: 560px)  { .hc-stage { --s: .46; } }
        @media (prefers-reduced-motion: reduce) { .hc-rise { animation: none; } }
      `}</style>
    </div>
  );
}
