'use client';

import TileCarousel from '@/components/ui/TileCarousel';
import { STYLE_TIPS } from './styleTips';

/** «Поради стилю»: те саме безкінечне гортання, що й у решти плиток; кожна порада з фото, міткою й текстом. */
export default function TipsCarousel() {
  const items = STYLE_TIPS.map(t => ({
    key: t.title,
    photo: true,
    node: (
      <>
        <div className="tip-img"><img src={t.img.replace('w=1800', 'w=900')} alt="" loading="lazy" draggable={false} /></div>
        <div className="tip-body">
          <small>{t.tag}</small>
          <h3>{t.title}</h3>
          <p>{t.text}</p>
        </div>
      </>
    ),
  }));
  return (
    <>
      <TileCarousel title="Поради стилю." items={items} label="Поради стилю" />
      <style jsx global>{`
        .tile.photo { background: #fff; border: 1px solid #ececf0; height: auto; align-self: flex-start; }
        .tip-img { height: 240px; overflow: hidden; flex: 0 0 auto; }
        .tip-img img { width: 100%; height: 100%; object-fit: cover; display: block; user-select: none; }
        .tip-body { padding: 1.4rem 1.6rem 1.8rem; }
        .tip-body small { color: #3F6B49; font-weight: 700; font-size: .85rem; }
        .tile .tip-body h3 { margin: .35rem 0 .6rem; font-size: 1.3rem; line-height: 1.25; letter-spacing: -.02em; color: #1D1D1F; font-weight: 700; }
        .tip-body p { margin: 0; color: #6E6E73; font-size: .98rem; line-height: 1.55; }
      `}</style>
    </>
  );
}
