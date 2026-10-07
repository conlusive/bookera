'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';

/**
 * Блок для бізнесу на головній: світлий, зі справжнім кабінетом у кадрі.
 *
 * Замість темного блоку зі скляними картками - знімки самого продукту: календар майстрів на комп'ютері
 * й той самий день списком на телефоні. Людина бачить, що саме отримає, а не абстракцію.
 * Знімки зроблено на демонстраційних даних (вигадані заклад, майстри й клієнти), жодних справжніх людей.
 *
 * Поява - один раз, коли блок потрапляє в поле зору; без руху, якщо людина вимкнула анімації.
 */

const POINTS = [
  'Календар майстрів із вільними вікнами й онлайн-записом',
  'Клієнти, групи й нагадування тим, хто давно не був',
  'Акції, розсилки та аналітика доходу в одному місці',
];

export default function BusinessShowcase() {
  const ref = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setInView(true); return; }
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); o.disconnect(); } }, { threshold: 0.2 });
    o.observe(el);
    return () => o.disconnect();
  }, []);

  return (
    <section ref={ref} className={`bz ${inView ? 'in' : ''}`} aria-labelledby="bz-title">
      <div className="bz-card">
        <div className="bz-copy">
          <span className="bz-badge bz-a" style={{ ['--d' as string]: '0.05s' }}>BookEra Business</span>
          <h2 id="bz-title" className="bz-title bz-a" style={{ ['--d' as string]: '0.12s' }}>
            Увесь ваш салон<br />в одному кабінеті
          </h2>
          <p className="bz-text bz-a" style={{ ['--d' as string]: '0.2s' }}>
            Приймайте записи онлайн, ведіть розклад майстрів і базу клієнтів, запускайте акції — з комп&apos;ютера чи телефона.
          </p>
          <ul className="bz-points">
            {POINTS.map((p, i) => (
              <li key={p} className="bz-a" style={{ ['--d' as string]: `${0.28 + i * 0.07}s` }}>
                <span><Check size={13} strokeWidth={3} /></span>{p}
              </li>
            ))}
          </ul>
          <div className="bz-ctas bz-a" style={{ ['--d' as string]: '0.5s' }}>
            <Link href="/business" className="bz-cta">Створити профіль<ArrowRight size={16} /></Link>
            <Link href="/business#features" className="bz-link">Усі можливості</Link>
          </div>
        </div>

        <div className="bz-stage" aria-hidden>
          <div className="bz-browser bz-a" style={{ ['--d' as string]: '0.15s' }}>
            <div className="bz-bar"><i /><i /><i /><span>bookera.app/cabinet</span></div>
            <Image src="/home/cabinet-calendar-v1.jpg" alt="" width={2350} height={1650} sizes="(max-width: 1100px) 90vw, 640px" className="bz-shot" />
          </div>
          <div className="bz-phone bz-a" style={{ ['--d' as string]: '0.35s' }}>
            <div className="bz-screen">
              <Image src="/home/cabinet-mobile-v1.jpg" alt="" width={1170} height={2532} sizes="200px" className="bz-shot" />
            </div>
          </div>
          <div className="bz-toast bz-a" style={{ ['--d' as string]: '0.7s' }}>
            <span className="bz-dot"><span /></span>
            <div><b>Новий запис</b><small>Дарина · манікюр, завтра 11:00</small></div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .bz { padding: 0 1.25rem; margin: 3.5rem 0; }
        @media (min-width: 768px) { .bz { padding: 0 2rem; margin: 5rem 0; } }
        .bz-card {
          position: relative; max-width: 1200px; margin: 0 auto; overflow: hidden; border-radius: 32px;
          display: grid; grid-template-columns: minmax(0, 1fr); gap: 2.5rem; align-items: center;
          padding: 2.25rem 1.5rem 0;
          background:
            radial-gradient(70% 90% at 85% 15%, rgba(194, 216, 196, 0.75) 0%, rgba(194, 216, 196, 0) 70%),
            linear-gradient(160deg, #F6F9F6 0%, #E9F1EA 100%);
          border: 1px solid #E3ECE4;
        }
        @media (min-width: 1000px) {
          .bz-card { grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr); gap: 2rem; padding: 3.5rem 0 0 3.5rem; align-items: stretch; }
          .bz-copy { align-self: center; padding-bottom: 3.5rem; }
        }

        .bz-badge { display: inline-block; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.04em; color: #4F6E53; background: rgba(255,255,255,0.75); border: 1px solid #D5E3D7; border-radius: 999px; padding: 0.3rem 0.8rem; margin-bottom: 1.1rem; }
        .bz-title { margin: 0 0 1rem; font-size: clamp(1.9rem, 4.4vw, 3rem); line-height: 1.08; font-weight: 700; letter-spacing: -0.03em; color: #16211A; }
        .bz-text { margin: 0 0 1.4rem; max-width: 30rem; font-size: 1.02rem; line-height: 1.6; color: #55655A; }
        .bz-points { list-style: none; margin: 0 0 1.9rem; padding: 0; display: flex; flex-direction: column; gap: 0.7rem; }
        .bz-points li { display: flex; align-items: flex-start; gap: 0.65rem; font-size: 0.95rem; line-height: 1.4; color: #2B3A30; }
        .bz-points li span { flex-shrink: 0; width: 20px; height: 20px; margin-top: 1px; border-radius: 50%; background: #16211A; color: #fff; display: inline-flex; align-items: center; justify-content: center; }
        .bz-ctas { display: flex; align-items: center; flex-wrap: wrap; gap: 1.4rem; }
        .bz-cta { display: inline-flex; align-items: center; gap: 0.5rem; border-radius: 12px; background: #16211A; color: #fff; padding: 0.8rem 1.4rem; font-size: 0.95rem; font-weight: 600; text-decoration: none; transition: transform 0.2s ease, background 0.2s ease; }
        .bz-cta:hover { transform: translateY(-1px); background: #0d150f; }
        .bz-link { font-size: 0.95rem; font-weight: 600; color: #2B3A30; text-decoration: underline; text-underline-offset: 4px; text-decoration-color: rgba(43,58,48,0.3); }
        .bz-link:hover { text-decoration-color: #2B3A30; }

        /* Сцена: вікно браузера з календарем і телефон поверх нього */
        .bz-stage { position: relative; min-height: 400px; display: flex; align-items: flex-end; }
        .bz-browser {
          position: relative; width: 100%; background: #fff; border-radius: 16px 0 0 0; overflow: hidden;
          box-shadow: 0 40px 80px -30px rgba(22, 33, 26, 0.35), 0 0 0 1px rgba(22, 33, 26, 0.08);
        }
        .bz-bar { display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 14px; background: #F4F6F4; border-bottom: 1px solid #E6EBE6; }
        .bz-bar i { width: 10px; height: 10px; border-radius: 50%; background: #D8DDD8; }
        .bz-bar span { margin: 0 auto; transform: translateX(-16px); font-size: 0.72rem; color: #8A978D; background: #fff; border-radius: 6px; padding: 3px 28px; }
        .bz-shot { display: block; width: 100%; height: auto; }
        .bz-phone {
          position: absolute; left: -1.5rem; bottom: -3rem; width: clamp(140px, 15vw, 185px);
          padding: 7px; border-radius: 34px; background: #16211A;
          box-shadow: 0 30px 60px -18px rgba(22, 33, 26, 0.55), inset 0 0 0 1.5px rgba(255,255,255,0.12);
        }
        .bz-screen { position: relative; overflow: hidden; border-radius: 28px; aspect-ratio: 9 / 18.5; background: #fff; }
        .bz-screen .bz-shot { width: 100%; height: auto; }
        .bz-toast {
          position: absolute; top: 0.2rem; right: 2rem; display: flex; align-items: center; gap: 0.7rem; padding: 0.7rem 0.95rem 0.7rem 0.8rem;
          background: rgba(255,255,255,0.92); backdrop-filter: blur(10px); border: 1px solid rgba(22,33,26,0.08); border-radius: 14px;
          box-shadow: 0 18px 36px -14px rgba(22,33,26,0.35);
        }
        .bz-toast b { display: block; font-size: 0.82rem; color: #16211A; }
        .bz-toast small { display: block; font-size: 0.72rem; color: #66756A; margin-top: 1px; }
        .bz-dot { position: relative; width: 9px; height: 9px; border-radius: 50%; background: #5E7A61; flex-shrink: 0; }
        .bz-dot span { position: absolute; inset: 0; border-radius: 50%; border: 1.5px solid #5E7A61; animation: bzPulse 2.4s ease-out infinite; }
        @keyframes bzPulse { from { transform: scale(1); opacity: 0.8; } to { transform: scale(3); opacity: 0; } }

        /* Телефон: лише телефон по центру, без вікна браузера, щоб кадр лишався читабельним */
        @media (max-width: 999px) {
          .bz-stage { min-height: 0; display: flex; justify-content: center; padding-bottom: 0; }
          .bz-browser { display: none; }
          .bz-toast { display: none; }
          .bz-phone { position: relative; left: 0; bottom: -3rem; width: min(240px, 62vw); margin-top: 0.5rem; }
          .bz-card { padding-bottom: 0; overflow: hidden; }
        }

        /* Поява одним рухом, коли блок у полі зору */
        .bz .bz-a { opacity: 0; transform: translateY(18px); }
        .bz.in .bz-a { animation: bzUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: var(--d, 0s); }
        @keyframes bzUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) {
          .bz .bz-a, .bz.in .bz-a { opacity: 1; transform: none; animation: none; }
          .bz-dot span { animation: none; }
        }
      `}</style>
    </section>
  );
}
