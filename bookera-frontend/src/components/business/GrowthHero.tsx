'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Caveat } from 'next/font/google';

/**
 * «Можливості для росту» - за композицією референсу: великий заголовок
 * по центру на крапчастому тлі, по кутах - плаваючі картки-теки, кожна
 * про одну можливість.
 *
 * Картки - про те, що система справді робить:
 *   нотатка (ліворуч угорі)   - суть одним реченням, від руки
 *   вітрина (праворуч угорі)  - запис на час через сторінку закладу
 *   аналітика (ліворуч унизу) - дохід і нові клієнти
 *   розсилки (праворуч унизу) - лист, промокод, клієнти
 *
 * Кольори - ваші: матча замість синього, #EEF1F6 для аватарок.
 */

// Рукописний шрифт лише для нотатки - вантажиться окремо й тільки
// потрібні знаки, решта сторінки від нього не залежить.
const hand = Caveat({ subsets: ['latin', 'cyrillic'], weight: ['500'], display: 'swap' });

function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setInView(true); return; }
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); o.disconnect(); } }, { threshold: 0.25 });
    o.observe(el);
    return () => o.disconnect();
  }, []);
  return { ref, inView };
}

const Icon = {
  mail: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>,
  percent: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 5 5 19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></svg>,
  users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.7.7 2.9 2.4 3.5 5.2" /></svg>,
  clock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M10 2h4" /></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
};

/**
 * onStart - та сама дія, що й головна кнопка лендінгу: гостя - на
 * реєстрацію, власника з закладом - у кабінет. Раніше тут було пряме
 * посилання на реєстрацію, і власник, що вже має заклад, потрапляв
 * на форму створення нового.
 */
export default function GrowthHero({ onStart, startLabel = 'Спробувати безкоштовно' }: { onStart?: () => void; startLabel?: string }) {
  const { ref, inView } = useInView<HTMLElement>();

  return (
    <section className="gh-section">
      <div className="container">
        <div ref={ref as any} className={`gh ${inView ? 'in' : ''}`}>

          {/* Нотатка від руки */}
          <div className="gh-float gh-note" style={{ ['--d' as string]: '.15s', ['--r' as string]: '-3deg' }}>
            <span className="gh-pin" />
            <p className={hand.className}>Залучайте клієнтів, повертайте тих, хто зник, і бачте, що працює.</p>
            <span className="gh-check">{Icon.check}</span>
          </div>

          {/* Вітрина - запис на час */}
          <div className="gh-float gh-tr" style={{ ['--d' as string]: '.25s', ['--r' as string]: '4deg' }}>
            <span className="gh-timer">{Icon.clock}</span>
            <div className="gh-folder">
              <div className="gh-folder-title">Онлайн-вітрина</div>
              <div className="gh-sheet">
                <div className="gh-sheet-t">Top Barber</div>
                <div className="gh-sheet-s">Стрижка + борода</div>
                <div className="gh-time">{Icon.clock}13:00 - 14:00</div>
              </div>
            </div>
          </div>

          {/* Аналітика */}
          <div className="gh-float gh-bl" style={{ ['--d' as string]: '.35s', ['--r' as string]: '-4deg' }}>
            <div className="gh-folder">
              <div className="gh-folder-title">Аналітика</div>
              {[
                { n: 'Дохід', v: '84 500 ₴', p: 76, c: '#6F9273', badge: '+12%' },
                { n: 'Нові клієнти', v: '38', p: 58, c: '#8FAE93', badge: '+9' },
              ].map(r => (
                <div key={r.n} className="gh-sheet gh-row">
                  <div className="gh-row-top"><b>{r.n}</b><span>{r.badge}</span></div>
                  <div className="gh-row-v">{r.v}</div>
                  <div className="gh-track"><span style={{ width: inView ? `${r.p}%` : 0, background: r.c }} /></div>
                </div>
              ))}
            </div>
          </div>

          {/* Розсилки */}
          <div className="gh-float gh-br" style={{ ['--d' as string]: '.45s', ['--r' as string]: '3deg' }}>
            <div className="gh-folder">
              <div className="gh-folder-title">Розсилки</div>
              <div className="gh-tiles">
                <span>{Icon.mail}</span>
                <span>{Icon.percent}</span>
                <span>{Icon.users}</span>
              </div>
            </div>
          </div>

          {/* Центр */}
          <div className="gh-center">
            <div className="gh-mark">B</div>
            <h2>
              Можливості
              <br />
              <span>для росту.</span>
            </h2>
            <p>Аналітика, розсилки та власна онлайн-вітрина. Усе для того, щоб ви заробляли більше.</p>
            {onStart ? (
              <button type="button" onClick={onStart} className="gh-cta" style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>{startLabel}</button>
            ) : (
              <Link href="/business/register" className="gh-cta">{startLabel}</Link>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .gh-section { padding: 2rem 0 5rem; }

        .gh {
          position: relative;
          min-height: clamp(620px, 62vw, 760px);
          border-radius: 36px;
          border: 1px solid #EDEDF0;
          overflow: hidden;
          /* Крапчаста сітка, як на референсі: тихий ритм, на якому
             плаваючі картки читаються як покладені на стіл. */
          background:
            radial-gradient(circle, #D9DDD9 1px, transparent 1.2px) 0 0 / 22px 22px,
            radial-gradient(70% 60% at 50% 50%, #FFFFFF 0%, #FAFBFA 100%);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* --- Центр --- */
        .gh-center {
          position: relative; z-index: 5; text-align: center; max-width: 640px; padding: 0 1.5rem;
          opacity: 0; transform: translateY(18px);
          transition: opacity .9s ease, transform 1s cubic-bezier(.16,1,.3,1);
        }
        .gh.in .gh-center { opacity: 1; transform: none; }
        .gh-mark {
          width: 88px; height: 88px; margin: 0 auto 2rem; border-radius: 22px; background: #fff;
          box-shadow: 0 14px 34px -14px rgba(46,58,48,.28), 0 0 0 1px rgba(0,0,0,.04);
          display: flex; align-items: center; justify-content: center;
          font-size: 2.6rem; font-weight: 800; color: #6F9273; letter-spacing: -0.05em;
        }
        .gh h2 {
          font-size: clamp(2.6rem, 6.2vw, 5rem); font-weight: 700; line-height: 1.02;
          letter-spacing: -0.045em; color: #1D1D1F; margin: 0 0 1.25rem;
        }
        .gh h2 span { color: #86868B; }
        .gh-center p { font-size: clamp(1rem, 1.5vw, 1.2rem); line-height: 1.55; color: #86868B; margin: 0 auto 2rem; max-width: 520px; }
        .gh-cta {
          display: inline-flex; align-items: center; height: 52px; padding: 0 1.9rem; border-radius: 14px;
          background: #1D1D1F; color: #fff; font-size: 1rem; font-weight: 600; text-decoration: none;
          box-shadow: 0 14px 30px -12px rgba(29,29,31,.45); transition: transform .2s ease, background-color .2s ease;
        }
        .gh-cta:hover { background: #000; transform: translateY(-1px); }

        /* --- Плаваючі картки --- */
        .gh-float {
          position: absolute; z-index: 3;
          opacity: 0; transform: translateY(24px) rotate(var(--r)) scale(.96);
          transition: opacity .9s ease var(--d), transform 1.1s cubic-bezier(.16,1,.3,1) var(--d);
        }
        .gh.in .gh-float { opacity: 1; transform: rotate(var(--r)); animation: ghFloat 8s ease-in-out calc(var(--d) + 1.2s) infinite; }
        @keyframes ghFloat {
          0%, 100% { translate: 0 0; }
          50% { translate: 0 -7px; }
        }

        /* Тека: вкладка зверху ліворуч - саме вона робить картку текою,
           а не ще одним прямокутником. */
        .gh-folder {
          position: relative; width: 300px; padding: 2.4rem 1.1rem 1.1rem; border-radius: 26px;
          background: rgba(243,245,243,.86); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,.9); box-shadow: 0 30px 60px -34px rgba(46,58,48,.3);
        }
        .gh-folder::before {
          content: ''; position: absolute; top: -18px; left: 0; width: 46%; height: 36px;
          border-radius: 22px 26px 0 0; background: inherit; border: inherit; border-bottom: 0;
          clip-path: polygon(0 0, 82% 0, 100% 100%, 0 100%);
        }
        .gh-folder-title { position: absolute; top: .85rem; left: 1.1rem; font-size: 1.05rem; font-weight: 600; color: #1D1D1F; letter-spacing: -0.01em; }
        .gh-sheet { background: #fff; border-radius: 14px; padding: .85rem .95rem; box-shadow: 0 6px 16px -10px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.03); }
        .gh-sheet-t { font-size: .95rem; font-weight: 600; color: #1D1D1F; }
        .gh-sheet-s { font-size: .75rem; color: #86868B; margin: 2px 0 .7rem; }
        .gh-time { display: inline-flex; align-items: center; gap: .35rem; padding: .3rem .6rem; border-radius: 8px; background: #F4FAF5; color: #5C7A61; font-size: .75rem; font-weight: 600; }
        .gh-time svg { width: 13px; height: 13px; }

        /* Нотатка */
        .gh-note {
          top: 64px; left: 3%; width: 250px; padding: 1.6rem 1.4rem 1.4rem; border-radius: 6px;
          background: linear-gradient(170deg, #F4FAF5 0%, #E4EEE3 100%);
          box-shadow: 0 24px 44px -26px rgba(46,58,48,.4);
        }
        .gh-note p { margin: 0; font-size: 1.55rem; line-height: 1.15; color: #2E3A30; }
        .gh-pin { position: absolute; top: 10px; left: 50%; width: 14px; height: 14px; margin-left: -7px; border-radius: 50%; background: #6F9273; box-shadow: 0 2px 4px rgba(0,0,0,.25); }
        .gh-check {
          position: absolute; left: -18px; bottom: -22px; width: 58px; height: 58px; border-radius: 16px; background: #fff;
          box-shadow: 0 14px 26px -14px rgba(0,0,0,.3); display: flex; align-items: center; justify-content: center;
        }
        .gh-check svg { width: 30px; height: 30px; padding: 6px; border-radius: 9px; background: #6F9273; color: #fff; }

        .gh-tr { top: 70px; right: 3%; display: flex; align-items: flex-start; gap: .7rem; }
        .gh-timer { width: 54px; height: 54px; border-radius: 16px; background: #fff; box-shadow: 0 10px 22px -12px rgba(0,0,0,.25); display: flex; align-items: center; justify-content: center; color: #1D1D1F; margin-top: 8px; }
        .gh-timer svg { width: 24px; height: 24px; }

        .gh-bl { bottom: 40px; left: 3%; }
        .gh-row + .gh-row { margin-top: .6rem; }
        .gh-row-top { display: flex; justify-content: space-between; font-size: .78rem; color: #1D1D1F; }
        .gh-row-top span { font-weight: 600; color: #5C7A61; }
        .gh-row-v { font-size: 1.05rem; font-weight: 700; letter-spacing: -0.02em; margin: 1px 0 .45rem; color: #1D1D1F; }
        .gh-track { height: 5px; border-radius: 3px; background: #F0F0F2; overflow: hidden; }
        .gh-track span { display: block; height: 100%; border-radius: 3px; transition: width 1.2s cubic-bezier(.16,1,.3,1) .9s; }

        .gh-br { bottom: 48px; right: 4%; }
        .gh-tiles { display: flex; gap: .7rem; padding: .3rem 0 .2rem; }
        .gh-tiles span { width: 62px; height: 62px; border-radius: 16px; background: #fff; box-shadow: 0 8px 18px -10px rgba(0,0,0,.2), 0 0 0 1px rgba(0,0,0,.03); display: flex; align-items: center; justify-content: center; color: #6F9273; }
        .gh-tiles svg { width: 26px; height: 26px; }

        /* Середні екрани: картки менші, щоб не лягали на заголовок. */
        @media (max-width: 1180px) {
          .gh-float { scale: .82; }
          .gh-note { transform-origin: top left; }
        }
        /* Вузькі: плаваючі картки ховаються, лишається центр - поруч
           із заголовком їм немає місця, а на ньому вони заважали б. */
        @media (max-width: 860px) {
          .gh-float { display: none; }
          .gh { min-height: 520px; padding: 4rem 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .gh-center, .gh-float { transition: none; animation: none !important; }
          .gh-track span { transition: none; }
        }
      `}</style>
    </section>
  );
}
