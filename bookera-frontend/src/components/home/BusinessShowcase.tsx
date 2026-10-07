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
            <div className="bz-bar"><i /><i /><i /></div>
            <Image src="/home/cabinet-calendar-v3.jpg" alt="" width={2950} height={1906} sizes="(max-width: 1100px) 90vw, 640px" className="bz-shot" />
          </div>
          <div className="bz-phone bz-a" style={{ ['--d' as string]: '0.35s' }}>
            <div className="bz-screen">
              <Image src="/home/cabinet-mobile-v3.jpg" alt="" width={1170} height={2442} sizes="200px" className="bz-shot" />
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        /* Секція на всю ширину екрана: фон від краю до краю, вміст у центрі, знімок виходить за правий і нижній край */
        .bz {
          position: relative; width: 100%; margin: 3.5rem 0 0; overflow: hidden;
          background:
            radial-gradient(60% 80% at 82% 18%, rgba(194, 216, 196, 0.8) 0%, rgba(194, 216, 196, 0) 70%),
            linear-gradient(165deg, #F6F9F6 0%, #E6EFE7 100%);
          border-top: 1px solid #E3ECE4;
        }
        .bz-card { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2.5rem; align-items: center; padding: 3rem 1.25rem 0; }
        @media (min-width: 1000px) {
          .bz { margin-top: 5rem; }
          .bz-card {
            grid-template-columns: minmax(0, 0.78fr) minmax(0, 1.22fr); gap: 2.5rem; align-items: stretch;
            padding: 5rem 0 0 max(2rem, calc((100% - 1200px) / 2));
          }
          .bz-copy { align-self: center; padding-bottom: 5rem; }
        }

        .bz-badge { display: inline-block; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.04em; color: #4F6E53; background: rgba(255,255,255,0.75); border: 1px solid #D5E3D7; border-radius: 999px; padding: 0.3rem 0.8rem; margin-bottom: 1.1rem; }
        .bz-title { margin: 0 0 1rem; font-size: clamp(1.9rem, 4.4vw, 3.1rem); line-height: 1.08; font-weight: 700; letter-spacing: -0.03em; color: #16211A; }
        .bz-text { margin: 0 0 1.4rem; max-width: 30rem; font-size: 1.02rem; line-height: 1.6; color: #55655A; }
        .bz-points { list-style: none; margin: 0 0 1.9rem; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
        .bz-points li { display: grid; grid-template-columns: 20px minmax(0, 1fr); align-items: start; column-gap: 0.7rem; font-size: 0.95rem; line-height: 20px; color: #2B3A30; }
        .bz-points li span { width: 20px; height: 20px; border-radius: 50%; background: #16211A; color: #fff; display: inline-flex; align-items: center; justify-content: center; }
        .bz-ctas { display: flex; align-items: center; flex-wrap: wrap; gap: 1.4rem; }
        .bz-cta { display: inline-flex; align-items: center; gap: 0.5rem; border-radius: 12px; background: #16211A; color: #fff; padding: 0.8rem 1.4rem; font-size: 0.95rem; font-weight: 600; text-decoration: none; transition: transform 0.2s ease, background 0.2s ease; }
        .bz-cta:hover { transform: translateY(-1px); background: #0d150f; }
        .bz-link { font-size: 0.95rem; font-weight: 600; color: #2B3A30; text-decoration: underline; text-underline-offset: 4px; text-decoration-color: rgba(43,58,48,0.3); }
        .bz-link:hover { text-decoration-color: #2B3A30; }

        /* Сцена: вікно браузера з календарем і телефон поверх нього */
        .bz-stage { position: relative; min-height: 420px; display: flex; align-items: flex-end; }
        .bz-browser {
          position: relative; width: 100%; background: #fff; border-radius: 16px 0 0 0; overflow: hidden;
          box-shadow: 0 40px 80px -30px rgba(22, 33, 26, 0.35), 0 0 0 1px rgba(22, 33, 26, 0.08);
        }
        .bz-bar { display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 14px; background: #F4F6F4; border-bottom: 1px solid #E6EBE6; }
        .bz-bar i { width: 10px; height: 10px; border-radius: 50%; background: #D8DDD8; }
        .bz-shot { display: block; width: 100%; height: auto; }
        /* Телефон: знімок заповнює екран повністю, низ рамки ховається за краєм секції */
        .bz-phone {
          position: absolute; left: -1.5rem; bottom: -4rem; width: clamp(150px, 16vw, 200px);
          padding: 7px; border-radius: 36px; background: #16211A;
          box-shadow: 0 30px 60px -18px rgba(22, 33, 26, 0.55), inset 0 0 0 1.5px rgba(255,255,255,0.12);
        }
        .bz-screen { position: relative; overflow: hidden; border-radius: 29px; aspect-ratio: 9 / 18.5; background: #fff; }
        .bz-screen .bz-shot { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: top center; }

        /* Телефон: лише телефон по центру під текстом, низ рамки за краєм секції */
        @media (max-width: 999px) {
          .bz-stage { min-height: 0; justify-content: center; padding-top: 0.5rem; }
          .bz-browser { display: none; }
          .bz-phone { position: relative; left: 0; bottom: 0; margin: 0.5rem 0 -4.5rem; width: min(250px, 66vw); }
        }

        /* Поява одним рухом, коли блок у полі зору */
        .bz .bz-a { opacity: 0; transform: translateY(18px); }
        .bz.in .bz-a { animation: bzUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: var(--d, 0s); }
        @keyframes bzUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) {
          .bz .bz-a, .bz.in .bz-a { opacity: 1; transform: none; animation: none; }
        }
      `}</style>
    </section>
  );
}
