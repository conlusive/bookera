'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { Playfair_Display } from 'next/font/google';
import SmartImage from '@/components/ui/SmartImage';

/* Акцентний шрифт заголовків: елегантний курсивний із кирилицею (дві-три літери на заголовок) */
const accent = Playfair_Display({ subsets: ['latin', 'cyrillic'], style: ['italic'], weight: ['500'], display: 'swap' });

const ph = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=600&q=80`;
const PHOTO = {
  nails: ph('1604654894610-df63bc536371'),
  hair: ph('1560066984-138dadb4c035'),
  barber: ph('1503951914875-452162b0f3f1'),
  brows: ph('1522337360788-8b13dee7a37e'),
  spa: ph('1544161515-4ab6ce6db874'),
  massage: ph('1519823551278-64ac92734fb1'),
};

function Photo({ src, className }: { src: string; className?: string }) {
  return <div className={`ph ${className ?? ''}`}><SmartImage src={src} alt="" fill sizes="260px" style={{ objectFit: 'cover' }} /></div>;
}

/**
 * Блок після каталогу: вільна композиція замість сітки.
 *
 * Посередині - заголовок із закликом, довкола «розкидані» предмети BookEra:
 * слоти часу, кругла карта, сповіщення, монета бонусів, зірки, кольорові
 * категорії. Кожен під своїм кутом і різного розміру, частина перекриває сусідів.
 *
 * Далі йдуть ще чотири блоки з різною подачею (кроки сходинками, хмара категорій,
 * редакційний список принципів, темна панель для бізнесу) і фінальний заклик.
 *
 * Анімація легка: коли блок потрапляє в екран, предмети злітаються на місце
 * по черзі, далі ледь погойдуються (кожен зі своїм ритмом), а на пристроях із
 * мишкою ще й трохи зсуваються за курсором на різну глибину. Усе - transform.
 */
type Item = { cls: string; style: CSSProperties; depth: number; node: ReactNode };

const STARS = [0, 1, 2, 3, 4];

const ITEMS: Item[] = [
  { cls: 'phA', depth: 16, style: { left: '16%', top: '57%', ['--r' as string]: '-6deg' }, node: <Photo src={PHOTO.nails} className="p-a" /> },
  { cls: 'phB', depth: 24, style: { right: '19%', top: '3%', ['--r' as string]: '6deg' }, node: <Photo src={PHOTO.barber} className="p-b" /> },
  { cls: 'phC', depth: 12, style: { right: '2%', bottom: '2%', ['--r' as string]: '5deg' }, node: <Photo src={PHOTO.spa} className="p-c" /> },
  {
    cls: 'slots', depth: 14, style: { left: '2%', top: '4%', ['--r' as string]: '-7deg' },
    node: (
      <div className="card c-slots">
        <b>Сьогодні</b>
        <div>{['10:00', '12:30', '13:00', '17:30'].map((t, i) => <span key={t} className={i === 3 ? 'pick' : ''}>{t}</span>)}</div>
      </div>
    ),
  },
  {
    cls: 'map', depth: 22, style: { right: '3%', top: '0%', ['--r' as string]: '0deg' },
    node: (
      <div className="c-map"><i className="me" /><u style={{ left: '24%', top: '30%' }} /><u style={{ left: '74%', top: '26%' }} /><u style={{ left: '70%', top: '74%' }} /><u style={{ left: '28%', top: '70%' }} /></div>
    ),
  },
  {
    cls: 'push', depth: 30, style: { left: '-1%', top: '50%', ['--r' as string]: '4deg' },
    node: <div className="c-push"><i /><p><b>Завтра о 11:00</b><small>Манікюр · нагадування</small></p></div>,
  },
  {
    cls: 'coin', depth: 18, style: { right: '7%', top: '47%', ['--r' as string]: '-8deg' },
    node: <div className="c-coin"><b>+120</b><small>бонусів</small></div>,
  },
  {
    cls: 'stars', depth: 26, style: { left: '17%', bottom: '3%', ['--r' as string]: '-5deg' },
    node: (
      <div className="c-stars">
        {STARS.map(i => <svg key={i} viewBox="0 0 24 24" style={{ ['--i' as string]: i }}><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" /></svg>)}
        <small>лише після візиту</small>
      </div>
    ),
  },
  { cls: 'tag1', depth: 34, style: { right: '24%', bottom: '6%', ['--r' as string]: '7deg' }, node: <div className="tag" style={{ background: '#F4A6BE', color: '#3B1B27' }}>Манікюр</div> },
  { cls: 'tag2', depth: 12, style: { right: '15%', bottom: '24%', ['--r' as string]: '-6deg' }, node: <div className="tag" style={{ background: '#F6D44A', color: '#2B2508' }}>Стрижка</div> },
  { cls: 'tag3', depth: 38, style: { left: '33%', top: '1%', ['--r' as string]: '5deg' }, node: <div className="tag" style={{ background: '#A9B9F2', color: '#17224D' }}>Масаж</div> },
  { cls: 'tag4', depth: 10, style: { left: '3%', bottom: '20%', ['--r' as string]: '-10deg' }, node: <div className="tag" style={{ background: '#9DC3A0', color: '#12301A' }}>Брови</div> },
];

const STEPS = [
  { n: '01', t: 'Знайдіть', d: 'Майстра чи салон поруч - за послугою, ціною, рейтингом і відстанню.', img: PHOTO.hair },
  { n: '02', t: 'Оберіть час', d: 'Вільні вікна видно одразу. Натисніть зручне - і запис ваш.', img: PHOTO.brows },
  { n: '03', t: 'Приходьте', d: 'Нагадаємо за добу. Після візиту - відгук і бонуси на наступний запис.', img: PHOTO.massage },
];

const CLOUD: { t: string; bg: string; fg: string; size: number; r: number; img?: string }[] = [
  { t: 'Манікюр', bg: '#F4A6BE', fg: '#3B1B27', size: 2.3, r: -4, img: PHOTO.nails },
  { t: 'Стрижка', bg: '#F6D44A', fg: '#2B2508', size: 1.6, r: 3, img: PHOTO.hair },
  { t: 'Барбер', bg: '#111', fg: '#fff', size: 2.0, r: -2, img: PHOTO.barber },
  { t: 'Брови та вії', bg: '#F5F5F7', fg: '#111', size: 1.5, r: 4, img: PHOTO.brows },
  { t: 'Масаж', bg: '#A9B9F2', fg: '#17224D', size: 2.4, r: 2, img: PHOTO.massage },
  { t: 'Педикюр', bg: '#9DC3A0', fg: '#12301A', size: 1.5, r: -5 },
  { t: 'Косметологія', bg: '#F28B54', fg: '#fff', size: 1.9, r: 3 },
  { t: 'Спа', bg: '#F5F5F7', fg: '#111', size: 2.2, r: -3, img: PHOTO.spa },
  { t: 'Макіяж', bg: '#F4A6BE', fg: '#3B1B27', size: 1.5, r: 5 },
  { t: 'Фарбування', bg: '#F6D44A', fg: '#2B2508', size: 1.7, r: -3 },
];

const RULES = [
  { n: '01', t: 'Вільне - справді вільне', d: 'Слоти рахує сервер, а база не дозволяє двох записів на один час.' },
  { n: '02', t: 'Реклама лише підказує', d: 'Радар трохи підіймає заклад, але слабкий не обжене явно кращого. Позначка «Реклама» завжди на місці.' },
  { n: '03', t: 'Відгук - після візиту', d: 'Залишити відгук можна лише після завершеного запису, тож рейтинг чесний.' },
  { n: '04', t: 'Найближче - першим', d: 'Каталог іде від найближчих до вас; ціна й рекомендації працюють у вашому районі.' },
];

const TOOLS: { t: string; bg: string; fg: string; style: CSSProperties }[] = [
  { t: 'Календар без накладок', bg: '#F6D44A', fg: '#2B2508', style: { left: '4%', top: '8%', ['--r' as string]: '-6deg' } },
  { t: 'Клієнти й історія', bg: '#fff', fg: '#111', style: { right: '6%', top: '14%', ['--r' as string]: '5deg' } },
  { t: 'Склад і списання', bg: '#A9B9F2', fg: '#17224D', style: { left: '22%', top: '40%', ['--r' as string]: '3deg' } },
  { t: 'Аналітика', bg: '#9DC3A0', fg: '#12301A', style: { right: '14%', top: '47%', ['--r' as string]: '-5deg' } },
  { t: 'Розсилки', bg: '#F4A6BE', fg: '#3B1B27', style: { left: '2%', top: '72%', ['--r' as string]: '5deg' } },
  { t: 'Радар', bg: '#F28B54', fg: '#fff', style: { right: '30%', top: '80%', ['--r' as string]: '-4deg' } },
];

export default function HomeLanding() {
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.querySelectorAll('[data-rv]').forEach(n => n.classList.add('in')); return; }

    // Кожен блок «вмикається» окремо, коли потрапляє в екран
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }, { threshold: 0.18 });
    el.querySelectorAll('[data-rv]').forEach(n => io.observe(n));

    // Зсув за курсором - лише там, де є мишка
    let raf = 0;
    let cleanup = () => {};
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      const move = (ev: PointerEvent) => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const r = el.getBoundingClientRect();
          el.style.setProperty('--mx', (((ev.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
          el.style.setProperty('--my', (((ev.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
        });
      };
      el.addEventListener('pointermove', move);
      cleanup = () => { el.removeEventListener('pointermove', move); if (raf) cancelAnimationFrame(raf); };
    }
    return () => { io.disconnect(); cleanup(); };
  }, []);

  return (
    <section ref={root} className="hs" style={{ ['--accent' as string]: accent.style.fontFamily }}>
      <div className="hs-stage" data-rv>
        <div className="hs-center">
          <span className="hs-pill">BookEra</span>
          <h2>Усе для запису<br /><em>в одному місці</em></h2>
          <p>Вільний час, майстри поруч, нагадування й бонуси. Лишилось обрати, куди йти.</p>
          <div className="hs-btns">
            <a href="#salons-section" className="b1">Знайти майстра</a>
            <Link href="/business" className="b2">Для бізнесу</Link>
          </div>
        </div>

        {ITEMS.map((it, i) => (
          <div key={it.cls} className={`si si-${it.cls}`} aria-hidden style={{ ...it.style, ['--k' as string]: it.depth, ['--n' as string]: i }}>
            <div className="sp"><div className="sf">{it.node}</div></div>
          </div>
        ))}
      </div>

      {/* КРОКИ - сходинками по діагоналі, з пунктирною лінією між ними */}
      <div className="hs-block" data-rv>
        <div className="container">
          <div className="hs-h"><span className="hs-pill">Як це працює</span><h2>Три кроки - <em>і ви на місці</em></h2></div>
          <div className="steps">
            <svg className="steps-line" viewBox="0 0 1000 340" preserveAspectRatio="none" aria-hidden><path d="M120 60 C 330 20, 330 200, 500 190 S 760 170, 880 300" /></svg>
            {STEPS.map((st, i) => (
              <div key={st.n} className="step" style={{ ['--i' as string]: i }}>
                <div className="cover"><Photo src={st.img} /><b className="num">{st.n}</b></div>
                <h3>{st.t}</h3>
                <p>{st.d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ХМАРА КАТЕГОРІЙ */}
      <div className="hs-block" data-rv>
        <div className="container">
          <div className="hs-h"><span className="hs-pill">Категорії</span><h2>Що шукаєте? <em>Є майстер</em></h2><p>Оберіть послугу в каталозі вище - покажемо найближчих.</p></div>
          <div className="cloud">
            {CLOUD.map((c, i) => (
              <a key={c.t} href="#salons-section" className="chip" style={{ background: c.bg, color: c.fg, fontSize: `${c.size}rem`, ['--r' as string]: `${c.r}deg`, ['--i' as string]: i }}>{c.img && <Photo src={c.img} className="cp" />}{c.t}</a>
            ))}
          </div>
        </div>
      </div>

      {/* ПРИНЦИПИ - редакційний список */}
      <div className="hs-block" data-rv>
        <div className="container">
          <div className="hs-h"><span className="hs-pill">Наші правила</span><h2>Що ми <em>обіцяємо</em></h2></div>
          <div className="rules">
            {RULES.map((r, i) => (
              <div key={r.n} className="rule" style={{ ['--i' as string]: i }}>
                <span className="rn">{r.n}</span>
                <h3>{r.t}</h3>
                <p>{r.d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ДЛЯ БІЗНЕСУ - темна панель із предметами, що пливуть */}
      <div className="hs-block" data-rv>
        <div className="container">
          <div className="biz">
            <div className="biz-text">
              <span className="hs-pill dark">Для майстрів і власників</span>
              <h2>Ваш бізнес - <em>без паперів і хаосу</em></h2>
              <p>Календар, клієнти, склад, виплати й аналітика в одному кабінеті. Нові клієнти приходять із каталогу.</p>
              <Link href="/business" className="biz-btn">Підключити бізнес</Link>
            </div>
            <div className="biz-art" aria-hidden>
              <div className="tool-ph" style={{ ['--r' as string]: '6deg' }}><Photo src={PHOTO.barber} /></div>
              {TOOLS.map((t, i) => (
                <div key={t.t} className="tool" style={{ ...t.style, background: t.bg, color: t.fg, ['--n' as string]: i }}><span>{t.t}</span></div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ФІНАЛ - заклик, а знизу визирає ряд карток категорій */}
      <div className="hs-block hs-final" data-rv>
        <div className="container">
          <div className="hs-h"><h2>Ваш наступний візит - <em>за хвилину</em></h2></div>
          <div className="hs-btns"><a href="#salons-section" className="b1">Знайти майстра</a><Link href="/business" className="b2">Для бізнесу</Link></div>
        </div>
        <div className="fan" aria-hidden>
          {([['Манікюр', PHOTO.nails, -9], ['Стрижка', PHOTO.hair, -4], ['Брови', PHOTO.brows, 0], ['Масаж', PHOTO.massage, 4], ['Спа', PHOTO.spa, 9]] as [string, string, number][]).map(([n, img, r], i) => (
            <div key={n} className="fc" style={{ ['--r' as string]: `${r}deg`, ['--i' as string]: i }}><Photo src={img} /><span>{n}</span></div>
          ))}
        </div>
      </div>

      <style jsx global>{`
        .hs-block { padding: 5.5rem 0 1rem; }
        .hs-h { text-align: center; margin-bottom: 2.6rem; }
        .hs-h h2 { margin: 1rem 0 .6rem; font-size: clamp(1.9rem, 3.8vw, 3rem); font-weight: 800; letter-spacing: -.04em; line-height: 1.05; color: #111; }
        .hs-h em { font-family: var(--accent), Georgia, serif; font-style: italic; font-weight: 500; letter-spacing: -.01em; }
        .hs-h p { margin: 0 auto; max-width: 420px; color: #6E6E73; font-size: .98rem; }
        .hs-block .hs-h, .hs-block .step, .hs-block .chip, .hs-block .rule, .hs-block .biz, .hs-block .hs-btns { opacity: 0; transform: translateY(24px); transition: opacity .7s ease, transform .8s cubic-bezier(.2,.8,.2,1); }
        .hs-block.in .hs-h, .hs-block.in .hs-btns, .hs-block.in .biz { opacity: 1; transform: none; }

        /* кроки */
        .steps { position: relative; display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.4rem; align-items: start; max-width: 1020px; margin: 0 auto; padding-bottom: 5.5rem; }
        .steps-line { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; }
        .steps-line path { fill: none; stroke: #D2D2D7; stroke-width: 2; stroke-dasharray: 7 9; vector-effect: non-scaling-stroke; }
        .step { position: relative; z-index: 1; background: #fff; border: 1px solid #E8E8ED; border-radius: 28px; padding: 0 0 1.5rem; overflow: visible; box-shadow: 0 24px 44px -30px rgba(0,0,0,.35); transition-delay: calc(var(--i) * .14s); }
        .step:nth-of-type(2) { margin-top: 3.2rem; } .step:nth-of-type(3) { margin-top: 6.4rem; }
        .hs-block.in .step { opacity: 1; transform: none; }
        .step .num { position: absolute; left: 1.1rem; bottom: .5rem; font-family: var(--accent), Georgia, serif; font-style: italic; font-weight: 500; font-size: 3.6rem; line-height: 1; color: #fff; text-shadow: 0 2px 14px rgba(0,0,0,.35); }
        .step .cover { position: relative; height: 150px; border-radius: 28px 28px 0 0; overflow: hidden; }
        .step .cover .ph { position: absolute; inset: 0; border: none; border-radius: 0; box-shadow: none; }
        .step h3 { margin: 1.1rem 1.5rem .4rem; font-size: 1.25rem; font-weight: 800; letter-spacing: -.02em; color: #111; }
        .step p { margin: 0 1.5rem; font-size: .9rem; line-height: 1.55; color: #6E6E73; }

        /* хмара */
        .cloud { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: .9rem .8rem; max-width: 900px; margin: 0 auto; }
        .chip { display: inline-flex; align-items: center; gap: .45em; padding: .4em 1.05em .4em .4em; border-radius: 999px; font-weight: 800; letter-spacing: -.03em; text-decoration: none; box-shadow: 0 16px 26px -20px rgba(0,0,0,.5);
          transform: translateY(30px) scale(.8); transition: opacity .6s ease calc(var(--i) * .06s), transform .8s cubic-bezier(.2,1.3,.4,1) calc(var(--i) * .06s); }
        .hs-block.in .chip { opacity: 1; transform: rotate(var(--r)); }
        .hs-block.in .chip:hover { transform: rotate(0deg) scale(1.08); transition-delay: 0s; transition-duration: .25s; }

        .chip .cp { width: 1.9em; height: 1.9em; flex: none; border: none; border-radius: 50%; box-shadow: none; }
        .chip:not(:has(.cp)) { padding-left: 1.05em; }

        /* правила */
        .rules { max-width: 940px; margin: 0 auto; border-bottom: 1px solid #E8E8ED; }
        .rule { display: grid; grid-template-columns: 70px 1.1fr 1.4fr; align-items: baseline; gap: 1.4rem; padding: 1.9rem .6rem; border-top: 1px solid #E8E8ED; transition: background .3s ease, padding .3s ease, opacity .7s ease, transform .8s cubic-bezier(.2,.8,.2,1); transition-delay: 0s, 0s, calc(var(--i) * .1s), calc(var(--i) * .1s); }
        .hs-block.in .rule { opacity: 1; transform: none; }
        .rule:hover { background: #F7F7F9; padding-left: 1.3rem; transition-delay: 0s; }
        .rule .rn { font-family: var(--accent), Georgia, serif; font-style: italic; font-size: 1.15rem; color: #86868B; }
        .rule h3 { margin: 0; font-size: clamp(1.25rem, 2.2vw, 1.75rem); font-weight: 800; letter-spacing: -.03em; line-height: 1.15; color: #111; }
        .rule p { margin: 0; font-size: .95rem; line-height: 1.55; color: #6E6E73; }

        /* бізнес */
        .biz { position: relative; display: grid; grid-template-columns: 1fr 1fr; min-height: 440px; border-radius: 34px; background: #111; color: #fff; overflow: hidden; max-width: 1040px; margin: 0 auto; }
        .biz-text { padding: 3.2rem 2.6rem; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; position: relative; z-index: 2; }
        .hs-pill.dark { background: rgba(255,255,255,.1); border-color: rgba(255,255,255,.2); color: rgba(255,255,255,.8); }
        .biz h2 { margin: 1rem 0 .8rem; font-size: clamp(1.8rem, 3.2vw, 2.6rem); font-weight: 800; letter-spacing: -.04em; line-height: 1.06; }
        .biz em { font-family: var(--accent), Georgia, serif; font-style: italic; font-weight: 500; }
        .biz p { margin: 0 0 1.6rem; color: rgba(255,255,255,.62); line-height: 1.55; max-width: 380px; }
        .biz-btn { display: inline-flex; align-items: center; height: 46px; padding: 0 1.5rem; border-radius: 999px; background: #fff; color: #111; font-weight: 700; font-size: .92rem; text-decoration: none; transition: transform .2s ease; }
        .biz-btn:hover { transform: translateY(-2px); }
        .biz-art { position: relative; }
        .tool { position: absolute; padding: .7rem 1.2rem; border-radius: 999px; font-weight: 800; font-size: .95rem; letter-spacing: -.01em; white-space: nowrap; transform: rotate(var(--r)); box-shadow: 0 16px 28px -16px rgba(0,0,0,.6); }
        .tool-ph { position: absolute; right: 5%; bottom: 6%; width: 150px; height: 190px; transform: rotate(var(--r)); }
        .tool-ph .ph { position: absolute; inset: 0; border-color: #1b1b1d; }
        .tool span { display: block; animation: hsBob 6s ease-in-out infinite; animation-delay: calc(var(--n) * -1.1s); }

        /* фінал */
        .hs-final { padding-bottom: 0; overflow: hidden; text-align: center; }
        .hs-final .hs-h { margin-bottom: 1.6rem; }
        .fan { display: flex; justify-content: center; gap: .7rem; margin-top: 3rem; height: 150px; }
        .fc { position: relative; width: 170px; height: 210px; flex: none; border-radius: 24px 24px 0 0; overflow: hidden; color: #fff; font-weight: 800; font-size: 1.1rem; letter-spacing: -.02em; text-align: left; transform-origin: 50% 100%; box-shadow: 0 20px 36px -22px rgba(0,0,0,.5);
          transform: translateY(160px) rotate(var(--r)); transition: transform .9s cubic-bezier(.2,.9,.3,1.1) calc(.3s + var(--i) * .09s); }
        .fc .ph { position: absolute; inset: 0; border: none; border-radius: 0; box-shadow: none; }
        .fc::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.35), transparent 45%); }
        .fc span { position: absolute; left: 1rem; top: .9rem; z-index: 2; }
        .hs-final.in .fc { transform: translateY(14px) rotate(var(--r)); }
        .hs-final.in .fc:hover { transform: translateY(-14px) rotate(0deg); transition-delay: 0s; transition-duration: .3s; }

        @media (max-width: 900px) {
          .steps { grid-template-columns: 1fr; padding-bottom: 1rem; gap: 2.2rem; } .step:nth-of-type(n) { margin-top: 0; } .steps-line { display: none; }
          .rule { grid-template-columns: 44px 1fr; } .rule p { grid-column: 2; }
          .biz { grid-template-columns: 1fr; } .biz-text { padding: 2.2rem 1.5rem 1rem; } .biz-art { height: 280px; } .tool { font-size: .82rem; padding: .55rem .95rem; }
          .fc { width: 96px; height: 130px; font-size: .8rem; } .fan { height: 100px; gap: .35rem; } .hs-final.in .fc { transform: translateY(8px) rotate(var(--r)); }
        }
        @media (prefers-reduced-motion: reduce) { .hs-block *, .fc { transition: none !important; } .tool span { animation: none; } }
      `}</style>

      <style jsx global>{`
        .hs { --mx: 0; --my: 0; background: #fff; padding: 5rem 0 0; overflow: hidden; }
        .hs-stage { position: relative; max-width: 1120px; height: 640px; margin: 0 auto; }

        .hs-center { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(520px, 90%); text-align: center; z-index: 5;
          opacity: 0; translate: 0 18px; transition: opacity .8s ease, translate .8s cubic-bezier(.2,.8,.2,1); }
        .in .hs-center { opacity: 1; translate: 0 0; }
        .hs-pill { display: inline-block; padding: .3rem .85rem; border-radius: 999px; background: #F5F5F7; border: 1px solid #E8E8ED; font-size: .74rem; font-weight: 600; color: #55555B; }
        .hs-center h2 { margin: 1rem 0 .8rem; font-size: clamp(2rem, 4.4vw, 3.4rem); font-weight: 800; letter-spacing: -.04em; line-height: 1.04; color: #111; }
        .hs-center em { font-family: var(--accent), Georgia, serif; font-style: italic; font-weight: 500; letter-spacing: -.01em; }
        .hs-center p { margin: 0 auto 1.6rem; max-width: 400px; color: #6E6E73; font-size: 1rem; line-height: 1.5; }
        .hs-btns { display: flex; justify-content: center; gap: .7rem; flex-wrap: wrap; }
        .hs-btns a { display: inline-flex; align-items: center; height: 46px; padding: 0 1.5rem; border-radius: 999px; font-weight: 700; font-size: .92rem; text-decoration: none; transition: transform .2s ease; }
        .hs-btns a:hover { transform: translateY(-2px); }
        .hs-btns .b1 { background: #111; color: #fff; } .hs-btns .b2 { background: #fff; color: #111; border: 1px solid #D8D8DC; }

        /* Предмет: .si - місце й політ на місце, .sp - зсув за курсором, .sf - погойдування */
        .si { position: absolute; z-index: 2; opacity: 0; transform: translateY(60px) scale(.5) rotate(0deg);
          transition: opacity .6s ease calc(var(--n) * .09s), transform .9s cubic-bezier(.2,1.2,.35,1) calc(var(--n) * .09s); }
        .in .si { opacity: 1; transform: rotate(var(--r)); }
        .sp { transform: translate(calc(var(--mx) * var(--k) * -1px), calc(var(--my) * var(--k) * -1px)); transition: transform .35s ease-out; }
        .sf { animation: hsBob 6s ease-in-out infinite; animation-delay: calc(var(--n) * -.9s); }
        .si-map .sf, .si-coin .sf { animation-duration: 7.5s; } .si-push .sf, .si-stars .sf { animation-duration: 5s; }
        @keyframes hsBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }

        .card { background: #fff; border-radius: 22px; padding: 1rem 1.1rem; box-shadow: 0 22px 40px -26px rgba(0,0,0,.45); }
        .c-slots { width: 236px; display: flex; flex-direction: column; gap: .7rem; }
        .c-slots b { font-size: 1rem; color: #111; }
        .c-slots div { display: grid; grid-template-columns: 1fr 1fr; gap: .4rem; }
        .c-slots span { padding: .6rem 0; text-align: center; border-radius: 11px; background: #F3F4F6; font-size: .84rem; font-weight: 700; font-variant-numeric: tabular-nums; color: #111; }
        .c-slots .pick { background: #111; color: #F6D44A; }

        .c-map { position: relative; width: 210px; height: 210px; border-radius: 50%; border: 8px solid #fff; box-shadow: 0 22px 40px -24px rgba(0,0,0,.45); overflow: hidden; background:
          linear-gradient(90deg, rgba(255,255,255,.75) 2px, transparent 2px) 0 0 / 34px 34px,
          linear-gradient(0deg, rgba(255,255,255,.75) 2px, transparent 2px) 0 0 / 34px 34px, #DCE6F3; }
        .c-map .me { position: absolute; left: 50%; top: 50%; width: 14px; height: 14px; margin: -7px; border-radius: 50%; background: #2F6BFF; box-shadow: 0 0 0 4px #fff; }
        .c-map .me::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; border: 2px solid rgba(47,107,255,.5); animation: hsWave 2.6s ease-out infinite; }
        @keyframes hsWave { 0% { transform: scale(.6); opacity: .9; } 100% { transform: scale(7); opacity: 0; } }
        .c-map u { position: absolute; width: 14px; height: 14px; margin: -7px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); background: #F28B54; box-shadow: 0 0 0 3px #fff; }
        .c-map u:nth-of-type(2n) { background: #111; }

        .c-push { display: flex; gap: .65rem; align-items: center; padding: .7rem 1rem .7rem .75rem; border-radius: 20px; background: #111; color: #fff; box-shadow: 0 22px 40px -24px rgba(0,0,0,.6); }
        .c-push i { width: 32px; height: 32px; border-radius: 10px; background: #9DC3A0; flex: none; } .c-push p { margin: 0; display: flex; flex-direction: column; }
        .c-push b { font-size: .88rem; } .c-push small { font-size: .74rem; opacity: .65; }

        .c-coin { width: 140px; height: 140px; border-radius: 50%; background: radial-gradient(circle at 30% 28%, #FFB37F, #F28B54 62%, #E5703A); color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 22px 40px -22px rgba(229,112,58,.8), inset 0 0 0 7px rgba(255,255,255,.28); }
        .c-coin b { font-size: 2.2rem; font-weight: 800; letter-spacing: -.05em; line-height: 1; } .c-coin small { font-size: .74rem; font-weight: 600; opacity: .9; margin-top: .2rem; }

        .c-stars { display: flex; align-items: center; gap: .25rem; padding: .7rem 1rem; border-radius: 999px; background: #F4A6BE; box-shadow: 0 20px 36px -24px rgba(0,0,0,.45); }
        .c-stars svg { width: 22px; height: 22px; fill: #fff; opacity: .55; }
        .in .c-stars svg { animation: hsStar 3.4s ease-in-out infinite; animation-delay: calc(.8s + var(--i) * .16s); }
        @keyframes hsStar { 0%, 55%, 100% { opacity: .55; transform: scale(1); } 12%, 40% { opacity: 1; transform: scale(1.18); } }
        .c-stars small { margin-left: .5rem; font-size: .76rem; font-weight: 700; color: #3B1B27; }

        .ph { position: relative; overflow: hidden; border-radius: 22px; border: 6px solid #fff; box-shadow: 0 24px 40px -24px rgba(0,0,0,.5); background: #EEE; }
        .p-a { width: 150px; height: 190px; } .p-b { width: 150px; height: 190px; } .p-c { width: 150px; height: 170px; }
        .tag { padding: .6rem 1.2rem; border-radius: 999px; font-weight: 800; font-size: .95rem; letter-spacing: -.01em; box-shadow: 0 16px 28px -18px rgba(0,0,0,.45); }

        @media (max-width: 900px) {
          .hs { padding: 3.5rem 0 4rem; }
          .hs-stage { height: auto; display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 1rem .8rem; padding: 0 1rem; }
          .hs-center { position: static; transform: none; width: 100%; order: -1; margin-bottom: 1rem; }
          .si { position: static !important; transform: none; } .in .si { transform: rotate(calc(var(--r) * .5)); }
          .sp { transform: none !important; }
          .c-map { width: 150px; height: 150px; } .c-slots { width: 200px; } .c-coin { width: 110px; height: 110px; } .c-coin b { font-size: 1.7rem; }
        }
        @media (prefers-reduced-motion: reduce) { .si, .sp, .hs-center { transition: none; } .sf, .c-map .me::after { animation: none; } }
      `}</style>
    </section>
  );
}
