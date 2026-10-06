'use client';

import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import TileCarousel from '@/components/ui/TileCarousel';

/**
 * «Що ще всередині»: горизонтальна стрічка великих плиток, як у Apple. Кожна плитка про одне:
 * заголовок (темним) і продовження (сірим), знизу невеликий макет. Усе тут є в кабінеті; цифри в прикладах умовні.
 */
const spring = { type: 'spring' as const, stiffness: 160, damping: 20 };
function ClientsArt() {
  return (
    <div className="a-client">
      <div className="a-ava">МВ</div>
      <b>Марія В.</b><small>7 візитів</small>
      <div className="a-chips"><span>Формула 7.1</span><span>Instagram</span><span>День народження</span><span className="warn">Алергія на аміак</span></div>
    </div>
  );
}
function MoneyArt() {
  const v = [34, 48, 40, 62, 74, 92, 70];
  return (
    <div className="a-money">
      <small>Умовний приклад</small>
      <div className="a-bars">{v.map((h, i) => <motion.i key={i} initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }} transition={{ ...spring, delay: i * 0.06 }} style={{ height: `${h}%`, originY: 1 }} className={i === 5 ? 'now' : ''} />)}</div>
      <div className="a-sum"><span>Дохід</span><span>Витрати</span><b>Прибуток</b></div>
    </div>
  );
}
function TeamArt() {
  const rows = [['Власник', 'бачить усе'], ['Адміністратор', 'усе, крім видалення адмінів'], ['Майстер', 'лише свій розклад і клієнти']];
  return <ul className="a-team">{rows.map(([r, t]) => <li key={r}><b>{r}</b><span>{t}</span></li>)}</ul>;
}
function LogArt() {
  const rows = [['Адміністратор', 'змінила ціну «Стрижка»: 500 → 650 ₴'], ['Майстер', 'списала «Лак»: залишок 10 → 7'], ['Власник', 'запросив нового майстра']];
  return <ul className="a-log">{rows.map(([w, t]) => <li key={t}><b>{w}</b> {t}</li>)}</ul>;
}
function MailArt() {
  return (
    <div className="a-mail">
      <div className="a-logo">Book<span>Era</span></div>
      <h4>Ми скучили за вами</h4>
      <p>На цьому тижні в нас є вільні вікна.</p>
      <div className="a-btn">Записатися онлайн</div>
      <small>Більше не хочете листів? <u>Відписатися</u></small>
    </div>
  );
}

const TILES: { h: string; s: string; art: ReactNode }[] = [
  { h: 'Клієнти.', s: 'Усе про людину в одній картці: історія, формули, нотатки й день народження.', art: <ClientsArt /> },
  { h: 'Дохід.', s: 'Дохід із завершених візитів мінус витрати. Видно прибуток, а не лише записи.', art: <MoneyArt /> },
  { h: 'Команда.', s: 'Кожен бачить лише своє. Клієнтська база лишається у вашому кабінеті.', art: <TeamArt /> },
  { h: 'Журнал дій.', s: 'Хто, що й коли змінив: ціни, послуги, склад, команду.', art: <LogArt /> },
  { h: 'Розсилки.', s: 'Постійним чи тим, хто давно не був. З відпискою в кожному листі, без спаму.', art: <MailArt /> },
];

export default function Highlights() {
  const items = TILES.map(t => ({
    key: t.h,
    node: <><h3><b>{t.h}</b> <span>{t.s}</span></h3><div className="tile-art">{t.art}</div></>,
  }));
  return (
    <>
      <TileCarousel title="Що ще всередині." items={items} label="Можливості кабінету" />
      <style jsx global>{`
                .a-client { background: #fff; border-radius: 20px; padding: 1.4rem; box-shadow: 0 14px 34px rgba(0,0,0,.07); }
                .a-ava { width: 46px; height: 46px; border-radius: 50%; background: #E3EFE5; color: #3F6B49; font-weight: 800; display: flex; align-items: center; justify-content: center; margin-bottom: .7rem; }
                .a-client b { display: block; font-size: 1.15rem; } .a-client small { color: #6E6E73; }
                .a-chips { display: flex; flex-wrap: wrap; gap: .45rem; margin-top: 1rem; }
                .a-chips span { background: #F5F5F7; border-radius: 999px; padding: .35rem .8rem; font-size: .84rem; font-weight: 600; color: #1D1D1F; }
                .a-chips .warn { background: #FCE6D5; color: #8a4b1c; }
      
                .a-money { background: #fff; border-radius: 20px; padding: 1.4rem; box-shadow: 0 14px 34px rgba(0,0,0,.07); }
                .a-money small { color: #6E6E73; font-size: .78rem; }
                .a-bars { height: 140px; display: flex; align-items: flex-end; gap: 8px; margin: .8rem 0 1rem; }
                .a-bars i { flex: 1; border-radius: 7px; background: #E3EFE5; } .a-bars i.now { background: #6F9273; }
                .a-sum { display: flex; justify-content: space-between; font-size: .85rem; color: #6E6E73; } .a-sum b { color: #2F5A39; }
      
                .a-team, .a-log { list-style: none; margin: 0; padding: 0; display: grid; gap: .6rem; }
                .a-team li { background: #fff; border-radius: 16px; padding: .9rem 1.1rem; box-shadow: 0 8px 22px rgba(0,0,0,.05); }
                .a-team b { display: block; font-size: 1rem; } .a-team span { color: #6E6E73; font-size: .9rem; }
                .a-log li { background: #fff; border-radius: 16px; padding: .9rem 1.1rem; box-shadow: 0 8px 22px rgba(0,0,0,.05); font-size: .93rem; line-height: 1.45; color: #424245; } .a-log b { color: #1D1D1F; }
      
                .a-mail { background: #fff; border-radius: 16px 16px 0 0; padding: 1.4rem 1.5rem 1.6rem; box-shadow: 0 14px 34px rgba(0,0,0,.07); margin-bottom: -1.6rem; }
                .a-logo { font-weight: 900; letter-spacing: -.04em; font-size: 1.15rem; margin-bottom: .8rem; } .a-logo span { color: #8fae92; }
                .a-mail h4 { margin: 0 0 .35rem; font-size: 1.3rem; font-weight: 800; letter-spacing: -.03em; } .a-mail p { margin: 0 0 .9rem; color: #6E6E73; }
                .a-btn { background: #1D1D1F; color: #fff; text-align: center; font-weight: 700; padding: .7rem; border-radius: 12px; margin-bottom: .9rem; }
                .a-mail small { color: #6E6E73; font-size: .78rem; } .a-mail u { color: #1D1D1F; text-decoration-color: #8fae92; text-decoration-thickness: 2px; text-underline-offset: 3px; }
                @media (max-width: 700px) { .tile { height: 520px; } }
              `}</style>
    </>
  );
}
