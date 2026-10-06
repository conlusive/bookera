'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { motion, MotionConfig } from 'motion/react';

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
  const rail = useRef<HTMLDivElement>(null);
  const idle = useRef<number>(0);
  const N = TILES.length;

  // Безкінечна стрічка: тричі той самий набір плиток, ми живемо в середньому. Коли прокрутка зупинилась
  // біля краю, непомітно переставляємось на таку саму позицію в середньому наборі (плитки однакові, шва не видно).
  const normalize = () => {
    const el = rail.current; if (!el) return;
    const t = el.querySelectorAll<HTMLElement>('.tile');
    if (t.length < N * 3) return;
    const set = t[N].offsetLeft - t[0].offsetLeft;
    let p = el.scrollLeft;
    if (p < set * 0.5) p += set; else if (p >= set * 1.5) p -= set; else return;
    el.style.scrollSnapType = 'none';
    el.scrollLeft = p;
    requestAnimationFrame(() => { el.style.scrollSnapType = ''; });
  };

  useEffect(() => {
    const el = rail.current; if (!el) return;
    const t = el.querySelectorAll<HTMLElement>('.tile');
    if (t.length >= N * 3) { el.style.scrollSnapType = 'none'; el.scrollLeft = t[N].offsetLeft - t[0].offsetLeft; requestAnimationFrame(() => { el.style.scrollSnapType = ''; }); }
    return () => window.clearTimeout(idle.current);
  }, [N]);

  const onScroll = () => { window.clearTimeout(idle.current); idle.current = window.setTimeout(normalize, 140); };
  const scrollBy = (dir: 1 | -1) => {
    const el = rail.current; if (!el) return;
    const t = el.querySelectorAll<HTMLElement>('.tile');
    const step = t.length > 1 ? t[1].offsetLeft - t[0].offsetLeft : 460;
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };
  const tiles = [...TILES, ...TILES, ...TILES];

  return (
    <MotionConfig reducedMotion="user">
      <section className="hl">
        <div className="container hl-top">
          <h2>Що ще всередині.</h2>
          <div className="hl-nav">
            <button type="button" onClick={() => scrollBy(-1)} aria-label="Назад"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg></button>
            <button type="button" onClick={() => scrollBy(1)} aria-label="Далі"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg></button>
          </div>
        </div>
        <motion.div className="hl-rail" ref={rail} onScroll={onScroll} tabIndex={0} aria-label="Можливості кабінету"
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={spring}>
          <div className="hl-pad" />
          {tiles.map((t, i) => (
            <motion.article key={`${t.h}-${i}`} className="tile" aria-hidden={i < N || i >= N * 2 ? true : undefined} whileHover={{ y: -6 }} transition={spring}>
              <h3><b>{t.h}</b> <span>{t.s}</span></h3>
              <div className="tile-art">{t.art}</div>
            </motion.article>
          ))}
          <div className="hl-pad" />
        </motion.div>
        <style jsx global>{`
          .hl { padding: 5rem 0 6rem; background: #fff; }
          .hl-top { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 2rem; }
          .hl-top h2 { font-size: clamp(2rem, 4.6vw, 3.4rem); font-weight: 700; letter-spacing: -0.035em; line-height: 1.05; color: #1D1D1F; margin: 0; }
          .hl-nav { display: flex; gap: 0.6rem; }
          .hl-nav button { width: 44px; height: 44px; border-radius: 50%; border: none; background: #E8E8ED; color: #1D1D1F; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: background .2s ease, opacity .2s ease; }
          .hl-nav button:hover { background: #d9d9df; }
          .hl-nav button:focus-visible, .hl-rail:focus-visible { outline: 3px solid #1D1D1F; outline-offset: 3px; }
          .hl-rail { display: flex; gap: 1.25rem; overflow-x: auto; scroll-snap-type: x mandatory; padding: 0.5rem 0 1.5rem; scrollbar-width: none; }
          .hl-rail::-webkit-scrollbar { display: none; }
          .hl-pad { flex: 0 0 max(1.5rem, calc((100vw - 1340px) / 2 + 4rem)); }
          .tile { flex: 0 0 min(430px, 82vw); height: 540px; background: #F5F5F7; border-radius: 30px; padding: 2.2rem 2rem 0; display: flex; flex-direction: column; scroll-snap-align: start; overflow: hidden; }
          .tile h3 { margin: 0 0 1.4rem; font-size: 1.5rem; line-height: 1.25; letter-spacing: -0.02em; font-weight: 600; color: #6E6E73; }
          .tile h3 b { color: #1D1D1F; font-weight: 700; }
          .tile-art { margin-top: auto; padding-bottom: 1.6rem; }

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
      </section>
    </MotionConfig>
  );
}
