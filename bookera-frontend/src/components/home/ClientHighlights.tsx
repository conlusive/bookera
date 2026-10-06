'use client';

import TileCarousel from '@/components/ui/TileCarousel';

/**
 * «Усе, що вам знадобиться»: плитки про те, що клієнт справді отримує. Усе тут є в BookEra;
 * цифри й імена в макетах умовні.
 */
function ReminderArt() {
  return (
    <div className="c-notif">
      <div><i>B</i><span><b>Завтра о 14:00</b><small>Манікюр · Олена</small></span></div>
      <div><i>B</i><span><b>Щось змінилось?</b><small>Перенесіть або скасуйте за посиланням</small></span></div>
    </div>
  );
}
function ReviewArt() {
  return (
    <div className="c-rate">
      <div className="c-stars">4,9 <span>★★★★★</span></div>
      <small>Умовний приклад</small>
      {[92, 70, 38, 14, 6].map((w, i) => <div key={i} className="c-line"><em>{5 - i}</em><i><u style={{ width: `${w}%` }} /></i></div>)}
    </div>
  );
}
function NearArt() {
  const rows = [['Заклад А', '0,8 км'], ['Заклад Б', '1,4 км'], ['Заклад В', '2,1 км']];
  return <ul className="c-near">{rows.map(([n, d]) => <li key={n}><span>{n}</span><b>{d}</b></li>)}</ul>;
}
function GiftArt() {
  return (
    <div className="c-gift">
      <small>Подарунковий сертифікат</small>
      <b>Візит у подарунок</b>
      <code>BOOK-••••-••••</code>
    </div>
  );
}
function BonusArt() {
  return (
    <div className="c-bonus">
      <small>Бонуси BookEra</small>
      <b>+ 3%</b>
      <span>від кожного завершеного візиту</span>
    </div>
  );
}

const TILES = [
  { h: 'Нагадування.', s: 'Лист за добу до візиту й посилання, щоб перенести чи скасувати без дзвінка.', art: <ReminderArt /> },
  { h: 'Відгуки.', s: 'Оцінки й відгуки після візиту допомагають обрати майстра.', art: <ReviewArt /> },
  { h: 'Поруч із вами.', s: 'Каталог рахує відстань від вас і показує спершу найближчі заклади.', art: <NearArt /> },
  { h: 'Подарунки.', s: 'Подаруйте візит: сертифікат вводиться під час запису в закладі.', art: <GiftArt /> },
  { h: 'Бонуси.', s: '3% від кожного завершеного візиту повертаються бонусами на ваш рахунок.', art: <BonusArt /> },
];

export default function ClientHighlights() {
  const items = TILES.map(t => ({ key: t.h, node: <><h3><b>{t.h}</b> <span>{t.s}</span></h3><div className="tile-art">{t.art}</div></> }));
  return (
    <>
      <TileCarousel title="Усе, що вам знадобиться." items={items} label="Можливості для клієнтів" />
      <style jsx global>{`
        .c-notif { display: grid; gap: .6rem; }
        .c-notif > div { display: flex; gap: .8rem; align-items: center; background: rgba(255,255,255,.95); border-radius: 18px; padding: .85rem 1rem; box-shadow: 0 10px 26px rgba(0,0,0,.07); }
        .c-notif i { width: 34px; height: 34px; border-radius: 9px; background: #1D1D1F; color: #fff; font-style: normal; font-weight: 900; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
        .c-notif b { display: block; font-size: .95rem; } .c-notif small { color: #6E6E73; font-size: .8rem; }
        .c-rate { background: #fff; border-radius: 20px; padding: 1.3rem; box-shadow: 0 14px 34px rgba(0,0,0,.07); }
        .c-stars { font-size: 2.2rem; font-weight: 800; letter-spacing: -.03em; } .c-stars span { font-size: 1rem; color: #E6A93B; letter-spacing: .1em; margin-left: .4rem; }
        .c-rate small { display: block; color: #86868B; font-size: .78rem; margin: .1rem 0 .8rem; }
        .c-line { display: flex; align-items: center; gap: .6rem; margin-bottom: .4rem; } .c-line em { font-style: normal; font-size: .78rem; color: #6E6E73; width: .8rem; }
        .c-line i { flex: 1; height: 6px; background: #ececf0; border-radius: 4px; overflow: hidden; } .c-line u { display: block; height: 100%; background: #6F9273; border-radius: 4px; }
        .c-near { list-style: none; margin: 0; padding: 0; display: grid; gap: .6rem; }
        .c-near li { display: flex; justify-content: space-between; align-items: center; background: #fff; border-radius: 16px; padding: 1rem 1.2rem; box-shadow: 0 8px 22px rgba(0,0,0,.05); font-weight: 600; }
        .c-near b { color: #2F5A39; font-variant-numeric: tabular-nums; }
        .c-gift { background: linear-gradient(135deg, #1D1D1F, #34343a); color: #fff; border-radius: 20px; padding: 1.5rem; transform: rotate(-3deg); box-shadow: 0 18px 40px rgba(0,0,0,.2); }
        .c-gift small { color: rgba(255,255,255,.65); } .c-gift b { display: block; font-size: 1.5rem; letter-spacing: -.02em; margin: .4rem 0 1.2rem; }
        .c-gift code { background: rgba(255,255,255,.12); padding: .4rem .7rem; border-radius: 8px; font-size: .9rem; letter-spacing: .08em; }
        .c-bonus { background: #fff; border-radius: 20px; padding: 1.6rem; box-shadow: 0 14px 34px rgba(0,0,0,.07); }
        .c-bonus small { color: #6E6E73; } .c-bonus b { display: block; font-size: 3.4rem; font-weight: 800; letter-spacing: -.05em; color: #2F5A39; margin: .2rem 0; } .c-bonus span { color: #424245; }
      `}</style>
    </>
  );
}
