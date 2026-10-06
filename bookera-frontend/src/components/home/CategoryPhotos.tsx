'use client';

import { motion, MotionConfig } from 'motion/react';

/**
 * «Знайдіть свого майстра»: ряд високих фото-панелей. Наведіть (чи торкніться) - панель розкривається,
 * клік відкриває каталог цієї категорії. На телефоні це горизонтальна стрічка.
 */
const ph = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=80`;
const CATS = [
  { slug: 'hair', t: 'Волосся', img: ph('1560066984-138dadb4c035') },
  { slug: 'barber', t: 'Барбершоп', img: ph('1503951914875-452162b0f3f1') },
  { slug: 'nails', t: 'Манікюр', img: ph('1604654894610-df63bc536371') },
  { slug: 'brows', t: 'Брови та вії', img: ph('1522337360788-8b13dee7a37e') },
  { slug: 'skincare', t: 'Догляд за шкірою', img: ph('1570172619644-dfd03ed5d881') },
  { slug: 'makeup', t: 'Макіяж', img: ph('1487412720507-e7ab37603c6f') },
  { slug: 'massage', t: 'Масаж і SPA', img: ph('1544161515-4ab6ce6db874') },
];

export default function CategoryPhotos({ onPick }: { onPick: (slug: string) => void }) {
  return (
    <MotionConfig reducedMotion="user">
      <section className="cp">
        <div className="container">
          <h2 className="cp-h">Знайдіть свого майстра.</h2>
          <p className="cp-s">Оберіть напрям і подивіться заклади поруч.</p>
        </div>
        <motion.div className="cp-row container" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ type: 'spring', stiffness: 140, damping: 20 }}>
          {CATS.map(c => (
            <button key={c.slug} type="button" className="cp-item" onClick={() => onPick(c.slug)} aria-label={`${c.t}: дивитись заклади`}>
              <img src={c.img} alt="" loading="lazy" draggable={false} />
              <span className="cp-shade" />
              <span className="cp-cap"><b>{c.t}</b><small>Дивитись заклади</small></span>
            </button>
          ))}
        </motion.div>
        <style jsx global>{`
          .cp { padding: 7rem 0 4rem; background: #fff; }
          .cp-h { font-size: clamp(2.2rem, 5vw, 4rem); font-weight: 700; letter-spacing: -0.04em; line-height: 1.05; color: #1D1D1F; margin: 0 0 .8rem; }
          .cp-s { font-size: clamp(1.05rem, 1.8vw, 1.3rem); color: #6E6E73; margin: 0 0 2.5rem; }
          .cp-row { display: flex; gap: 12px; height: clamp(420px, 56vw, 580px); }
          .cp-item { position: relative; flex: 1 1 0; min-width: 0; border: none; padding: 0; border-radius: 28px; overflow: hidden; cursor: pointer; background: #e9e9ee; transition: flex-grow .7s cubic-bezier(.16,1,.3,1); text-align: left; font: inherit; }
          .cp-item:hover, .cp-item:focus-visible { flex-grow: 3.6; }
          .cp-item:focus-visible { outline: 3px solid #1D1D1F; outline-offset: 3px; }
          .cp-item img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform .9s cubic-bezier(.16,1,.3,1); user-select: none; }
          .cp-item:hover img { transform: scale(1.06); }
          .cp-shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,.62) 100%); }
          .cp-cap { position: absolute; left: 1.4rem; right: 1rem; bottom: 1.4rem; color: #fff; display: grid; gap: .25rem; }
          .cp-cap b { font-size: 1.3rem; font-weight: 700; letter-spacing: -.02em; line-height: 1.15; white-space: nowrap; writing-mode: vertical-rl; transform: rotate(180deg); align-self: end; transition: transform .5s ease; }
          .cp-item:hover .cp-cap b, .cp-item:focus-visible .cp-cap b { writing-mode: horizontal-tb; transform: none; }
          .cp-cap { align-items: end; }
          .cp-cap small { font-size: .9rem; opacity: 0; transform: translateY(6px); transition: opacity .4s ease .1s, transform .4s ease .1s; color: rgba(255,255,255,.85); }
          .cp-item:hover .cp-cap small, .cp-item:focus-visible .cp-cap small { opacity: 1; transform: none; }
          @media (hover: none), (max-width: 760px) {
            .cp-row { overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; height: 440px; }
            .cp-row::-webkit-scrollbar { display: none; }
            .cp-item { flex: 0 0 72%; scroll-snap-align: start; }
            .cp-item:hover { flex-grow: 0; } .cp-cap small { opacity: 1; transform: none; }
            .cp-cap b { writing-mode: horizontal-tb; transform: none; }
          }
        `}</style>
      </section>
    </MotionConfig>
  );
}
