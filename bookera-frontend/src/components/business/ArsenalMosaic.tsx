'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * «Базовий арсенал майстра» - мозаїка з пʼяти карток.
 *
 * Композиція, розміри й хореографія появи - за промтом. Кольори й
 * вміст - ваші:
 *   Календар    (головна, по центру) - два вікна з розкладом
 *   Нагадування - лист клієнту за добу до візиту
 *   Клієнти     - поля картки клієнта: формула, день народження, Instagram
 *   Фінанси     - дохід за днями тижня
 *   Пошук       - пошук клієнта за імʼям чи телефоном
 *
 * Усе це є в системі - нічого не обіцяє зайвого.
 *
 * Розміри з промту - у «дизайн-одиницях» сцени 1374 x 666. Промт
 * рахував їх від вікна браузера, бо там сцена займала весь екран.
 * Тут це блок посеред сторінки, тож одиниця - ширина контейнера / 1374
 * (container query): мозаїка масштабується разом із колонкою сайту.
 *
 * Поява - коли блок доходить до екрана, а не при завантаженні:
 * інакше анімація програлася б, поки людина ще нагорі сторінки.
 */

const anim = (name: string, dur: number, delay: number, ease = 'cubic-bezier(.16,1,.3,1)') =>
  ({ animation: `${name} ${dur}s ${ease} ${delay}s backwards` });

const TYPE = 'cubic-bezier(.22,1,.36,1)';

const Mail = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
);

const CHART = [
  { d: 'ПН', v: '6', h: 43 }, { d: 'ВТ', v: '9', h: 81 }, { d: 'СР', v: '11', h: 132 },
  { d: 'ЧТ', v: '14', h: 166 }, { d: 'ПТ', v: '17', h: 203 }, { d: 'СБ', v: '21', h: 235 },
  { d: 'НД', v: '24', h: 265 },
];

export default function ArsenalMosaic() {
  const ref = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setRun(true); return; }
    const o = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setRun(true); o.disconnect(); }
    }, { threshold: 0.2 });
    o.observe(el);
    return () => o.disconnect();
  }, []);

  const a = (name: string, dur: number, delay: number, ease?: string) => (run ? anim(name, dur, delay, ease) : undefined);

  return (
    <div className="am-wrap">
      <div ref={ref} className={`am ${run ? 'run' : ''}`} aria-label="Можливості кабінету">

        {/* 1. Нагадування */}
        <div className="am-card am-notif">
          <div className="am-toast-wrap am-anim" style={a('amRise', .62, .38)}>
            <div className="am-toast-ledge" />
            <div className="am-toast">
              <div className="am-toast-ico"><Mail /></div>
              <div>
                <div className="am-toast-title">Нагадування надіслано</div>
                <div className="am-toast-sub">Лист клієнту за добу до візиту</div>
              </div>
              <div className="am-toast-time">14:34</div>
            </div>
          </div>
        </div>

        {/* 2. Клієнти */}
        <div className="am-card am-clients">
          <h3 className="am-h2 am-anim" style={a('amType', .64, .54, TYPE)}>База<br />клієнтів.</h3>
          <div className="am-sub am-anim" style={a('amRise', .48, .73)}>Усе про клієнта в одній картці</div>
          <div className="am-chips">
            <div className="am-row r1 am-anim" style={a('amRise', .62, .86)}>
              <span className="am-chip"><span className="am-ava" style={{ width: 'calc(22 * var(--u))', height: 'calc(22 * var(--u))' }}>МВ</span>Марія В. · 7 візитів</span>
            </div>
            <div className="am-row r2 am-anim" style={a('amRise', .62, .91)}>
              <span className="am-chip">Формула 7.1</span>
              <span className="am-chip">Instagram</span>
            </div>
            <div className="am-row r3 am-anim" style={a('amRise', .62, .96)}>
              <span className="am-chip">День народження</span>
              <span className="am-chip">Нотатки</span>
            </div>
          </div>
          <span className="am-chip am-chip-float am-anim" style={a('amSettle', .58, 1.02)}>Постійний клієнт</span>
        </div>

        {/* 3. Календар - головна */}
        <div className="am-card am-calendar">
          <div className="am-copy">
            <h3 className="am-hero am-anim" style={a('amType', .78, .2, TYPE)}>
              <span className="g">Календар</span> без блокнота.<br />Увесь день на одному екрані.
            </h3>
            <div className="am-sub am-anim" style={a('amRise', .54, .48)}>Записи всієї команди - з телефону чи компʼютера.</div>
          </div>

          <div className="am-illo">
            <div className="am-win am-win-back am-anim" style={a('amSettle', .84, .42)}>
              <div className="am-win-bar"><i /><i /><i /></div>
              <div className="am-win-body"><div className="am-strip" /></div>
            </div>

            <div className="am-win am-win-front am-anim" style={a('amSettle', .94, .5)}>
              <div className="am-win-bar"><i /><i /><i /></div>
              <div className="am-win-body">
                <div className="am-strip" />
                <div className="am-slots">
                  <div className="am-slot" style={{ top: 'calc(10 * var(--u))', height: 'calc(36 * var(--u))' }}>10:00 Стрижка · Макс</div>
                  <div className="am-slot" style={{ top: 'calc(52 * var(--u))', height: 'calc(50 * var(--u))' }}>11:00 Фарбування · Ірина</div>
                  <div className="am-slot" style={{ top: 'calc(108 * var(--u))', height: 'calc(36 * var(--u))' }}>13:00 Манікюр · Олена</div>
                </div>
              </div>
            </div>

            <div className="am-card-mini am-anim" style={a('amSettle', .6, .72)}>
              <div className="am-ava">ОК</div>
              <div><div className="am-mini-t">Олена К.</div><div className="am-mini-s">Завтра о 14:00</div></div>
            </div>

            <div className="am-pill am-anim" style={a('amSettle', .58, .78)}>
              <span className="am-tick">
                <svg viewBox="0 0 24 24" fill="none" stroke="#161616" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              </span>
              Запис підтверджено
            </div>

            <svg className="am-cursor am-anim" style={a('amSettle', .54, .96)} viewBox="0 0 24 28">
              <path d="M3 2 L3 22 L8.2 17.2 L11.6 25 L15 23.5 L11.7 15.9 L18.6 15.9 Z" fill="#fff" stroke="#2b2b2b" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* 4. Фінанси */}
        <div className="am-card am-finance">
          <div className="am-tag am-anim" style={a('amRise', .46, .44)}>Фінанси</div>
          <div className="am-big am-anim" style={a('amType', .62, .56, TYPE)}>84 500 ₴</div>
          <div className="am-big-sub am-anim" style={a('amRise', .44, .75)}>дохід цього тижня</div>
          <div className="am-chart am-anim" style={a('amChart', .86, .72)} role="img" aria-label="Записи за днями тижня">
            {CHART.map((c, i) => (
              <div key={c.d} className="am-col">
                <div className={`am-bar ${i === CHART.length - 1 ? 'now' : ''}`} style={{ height: `calc(${c.h} * var(--u))` }}>{c.v}</div>
                <div className="am-day">{c.d}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 5. Пошук */}
        <div className="am-card am-search">
          <h3 className="am-h2 am-anim" style={a('amType', .56, .72, TYPE)}>Знайдіть клієнта<br />за секунду</h3>
          <div className="am-bar-search am-anim" style={{ ...a('amSearch', .7, .88), transformOrigin: 'right center' }}>
            <span className="am-mag">
              <svg viewBox="0 0 24 24" fill="none" stroke="#121212" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7.1" /><path d="M16.3 16.3 L21 21" /></svg>
            </span>
            <span className="am-ph">Імʼя, телефон або послуга...</span>
          </div>
        </div>
      </div>

      <style jsx global>{`
.am-wrap { container-type: inline-size; }
.am {
  --u: calc(100cqw / 1374);
  display: grid;
  grid-template-columns: 339fr 627fr 388fr;
  grid-template-rows: calc(149 * var(--u)) calc(343 * var(--u)) calc(156 * var(--u));
  column-gap: calc(10 * var(--u)); row-gap: calc(9 * var(--u));
  color: #1D1D1F;
}
.am-card {
  position: relative; overflow: hidden;
  border-radius: calc(22 * var(--u));
  border: calc(1.6 * var(--u)) solid rgba(255,255,255,.92);
  box-shadow: 0 calc(2 * var(--u)) calc(16 * var(--u)) rgba(24,30,45,.045);
}
.am-notif    { grid-column: 1; grid-row: 1; }
.am-clients  { grid-column: 1; grid-row: 2 / span 2; }
.am-calendar { grid-column: 2; grid-row: 1 / span 2; }
.am-finance  { grid-column: 3; grid-row: 1 / span 2; }
.am-search   { grid-column: 2 / span 2; grid-row: 3; }

/* ---------- 1. Нагадування ---------- */
.am-notif {
  padding: calc(37 * var(--u)) calc(12 * var(--u)) 0 calc(11 * var(--u));
  background:
    radial-gradient(120% 140% at 92% 100%, rgba(244,250,245,.95) 0%, rgba(244,250,245,0) 62%),
    linear-gradient(135deg, #DCE8DB 0%, #E4EEE3 55%, #EDF4EC 100%);
}
.am-toast-wrap { position: relative; height: calc(70 * var(--u)); }
.am-toast-ledge {
  position: absolute; left: calc(24 * var(--u)); right: calc(20 * var(--u)); top: calc(55 * var(--u)); height: calc(23 * var(--u)); border-radius: calc(14 * var(--u));
  background: linear-gradient(100deg, #e9ece8 0%, #e2e9df 60%, #d6e2d4 100%);
  box-shadow: 0 calc(3 * var(--u)) calc(9 * var(--u)) rgba(46,58,48,.08);
}
.am-toast {
  position: absolute; inset: 0; border-radius: calc(16 * var(--u));
  background: linear-gradient(105deg, #ffffff 34%, #f4faf5 78%, #eaf3e9 100%);
  box-shadow: 0 calc(3 * var(--u)) calc(10 * var(--u)) rgba(46,58,48,.10);
  display: flex; align-items: center; gap: calc(11 * var(--u)); padding: 0 calc(12 * var(--u)) 0 calc(13 * var(--u));
}
.am-toast-ico { width: calc(27 * var(--u)); height: calc(27 * var(--u)); flex-shrink: 0; border-radius: 50%; background: #1D1D1F; color: #C2D8C4; display: flex; align-items: center; justify-content: center; }
.am-toast-ico svg { width: calc(15 * var(--u)); height: calc(15 * var(--u)); }
.am-toast-title { font-size: calc(11.2 * var(--u)); font-weight: 800; letter-spacing: -0.012em; line-height: 1.1; color: #0d0d0d; }
.am-toast-sub { font-size: calc(10 * var(--u)); line-height: 1.28; color: #2b2b2b; margin-top: calc(3.6 * var(--u)); max-width: calc(150 * var(--u)); }
.am-toast-time { font-size: calc(7.4 * var(--u)); font-weight: 500; color: #86868B; align-self: flex-start; margin-top: calc(12 * var(--u)); margin-left: auto; white-space: nowrap; }

/* ---------- 2. Клієнти ---------- */
.am-clients {
  padding: calc(32 * var(--u)) 0 0 calc(20 * var(--u));
  background: linear-gradient(180deg, #fcfdfd 0%, #f5f7f6 30%, #e6ece8 66%, #d5e1d8 100%);
}
.am-h2 { font-size: calc(28 * var(--u)); font-weight: 800; line-height: 1.1; letter-spacing: -0.028em; color: #0c0c0c; margin: 0; }
.am-sub { margin-top: calc(14 * var(--u)); font-size: calc(17 * var(--u)); line-height: 1.3; letter-spacing: -0.013em; color: #1c1c1c; }
.am-chips { position: absolute; left: calc(11 * var(--u)); right: calc(16 * var(--u)); bottom: calc(13 * var(--u)); display: flex; flex-direction: column; gap: calc(8 * var(--u)); z-index: 2; }
.am-row { display: flex; gap: calc(14 * var(--u)); }
.am-row.r2 { padding-left: calc(10 * var(--u)); }
.am-chip {
  height: calc(42 * var(--u)); display: inline-flex; align-items: center; gap: calc(10 * var(--u)); padding: 0 calc(17 * var(--u)); border-radius: 999px;
  background: linear-gradient(180deg, rgba(255,255,255,.97) 0%, rgba(247,250,248,.93) 100%);
  box-shadow: 0 0 0 calc(3 * var(--u)) rgba(0,0,0,.047);
  backdrop-filter: blur(calc(7 * var(--u))); -webkit-backdrop-filter: blur(calc(7 * var(--u)));
  font-size: calc(16 * var(--u)); font-weight: 500; letter-spacing: -0.018em; color: #131313; white-space: nowrap;
}
.am-chip svg { width: calc(19 * var(--u)); height: calc(19 * var(--u)); flex-shrink: 0; color: #6F9273; }
.am-chip-float { position: absolute; right: calc(6 * var(--u)); bottom: calc(124 * var(--u)); transform: rotate(-12deg); z-index: 3; box-shadow: 0 0 0 calc(3.2 * var(--u)) rgba(0,0,0,.052); }

/* ---------- 3. Календар - головна картка ---------- */
.am-calendar {
  background:
    radial-gradient(90% 70% at 6% 0%, rgba(228,238,227,.95) 0%, rgba(228,238,227,0) 70%),
    linear-gradient(168deg, #E4EEE3 0%, #DCE8DB 48%, #CFE0CE 78%, #C2D8C4 100%);
}
.am-copy { position: relative; z-index: 3; padding: calc(37 * var(--u)) 0 0 calc(45 * var(--u)); }
.am-hero { font-size: calc(35 * var(--u)); font-weight: 800; line-height: 1.3; letter-spacing: -0.03em; color: #15201a; margin: 0; }
.am-hero .g { color: #5C7A61; }
.am-illo { position: absolute; inset: 0; z-index: 2; }
.am-win { position: absolute; border-radius: calc(11 * var(--u)); border: calc(3 * var(--u)) solid #fff; overflow: hidden; box-shadow: 0 calc(12 * var(--u)) calc(28 * var(--u)) rgba(46,58,48,.16); }
.am-win-bar { height: calc(13.4 * var(--u)); background: #242424; display: flex; align-items: center; gap: calc(4.6 * var(--u)); padding-left: calc(4.9 * var(--u)); }
.am-win-bar i { width: calc(6 * var(--u)); height: calc(6 * var(--u)); border-radius: 50%; background: linear-gradient(150deg, #fff 0%, #f6f6f6 50%, #dcdcdc 100%); }
.am-win-body { position: relative; height: calc(100% - calc(13.4 * var(--u))); display: flex; }
.am-win-back { left: calc(121 * var(--u)); top: calc(245 * var(--u)); width: calc(324 * var(--u)); height: calc(250 * var(--u)); transform: rotate(-7deg); }
.am-win-back .am-win-body { background: #eef3ec; }
.am-win-back .am-strip { width: 23.7%; background: #d3e2d0; }
.am-win-front { left: calc(180 * var(--u)); top: calc(283 * var(--u)); width: calc(322 * var(--u)); height: calc(250 * var(--u)); transform: rotate(4.2deg); border-bottom: 0; border-bottom-left-radius: 0; border-bottom-right-radius: 0; box-shadow: 0 calc(14 * var(--u)) calc(32 * var(--u)) rgba(46,58,48,.2); }
.am-win-front .am-win-body { background: #fff; }
.am-win-front .am-strip { width: 16%; background: #F4FAF5; }
/* Записи в передньому вікні - як у календарі кабінету */
.am-slots { flex: 1; position: relative; padding: calc(10 * var(--u)) calc(10 * var(--u)) 0; }
.am-slot { position: absolute; left: calc(10 * var(--u)); right: calc(10 * var(--u)); border-radius: calc(6 * var(--u)); background: #E4EEE3; border-left: calc(3 * var(--u)) solid #6F9273; padding: calc(3 * var(--u)) calc(6 * var(--u)); font-size: calc(8.5 * var(--u)); font-weight: 600; color: #2E3A30; white-space: nowrap; overflow: hidden; }
.am-pill {
  position: absolute; left: calc(380 * var(--u)); top: calc(349 * var(--u)); height: calc(30 * var(--u)); display: flex; align-items: center; gap: calc(7 * var(--u));
  padding: 0 calc(14 * var(--u)) 0 calc(6 * var(--u)); border-radius: 999px; background: #fff; box-shadow: 0 0 0 calc(2.8 * var(--u)) rgba(0,0,0,.045);
  transform: rotate(-1.2deg); font-size: calc(11.5 * var(--u)); font-weight: 600; letter-spacing: -0.014em; color: #151515; white-space: nowrap;
}
.am-tick { width: calc(20 * var(--u)); height: calc(20 * var(--u)); border-radius: 50%; background: linear-gradient(145deg, #e6f3df 0%, #cfe0bd 47%, #b9cfa5 100%); display: flex; align-items: center; justify-content: center; }
.am-tick svg { width: calc(11 * var(--u)); height: calc(11 * var(--u)); }
.am-card-mini {
  position: absolute; left: calc(60 * var(--u)); top: calc(404 * var(--u)); width: calc(160 * var(--u)); height: calc(52 * var(--u)); border-radius: calc(10 * var(--u)); background: #fff;
  box-shadow: 0 0 0 calc(2.8 * var(--u)) rgba(0,0,0,.045); transform: rotate(-1deg);
  display: flex; align-items: center; gap: calc(9 * var(--u)); padding: 0 calc(12 * var(--u));
}
.am-ava { width: calc(28 * var(--u)); height: calc(28 * var(--u)); border-radius: 50%; background: #EEF1F6; display: flex; align-items: center; justify-content: center; font-size: calc(9 * var(--u)); font-weight: 700; color: #222; flex-shrink: 0; }
.am-mini-t { font-size: calc(10 * var(--u)); font-weight: 700; color: #151515; }
.am-mini-s { font-size: calc(8.5 * var(--u)); color: #86868B; margin-top: calc(1 * var(--u)); }
.am-cursor { position: absolute; left: calc(490 * var(--u)); top: calc(454 * var(--u)); width: calc(30 * var(--u)); height: calc(35 * var(--u)); }

/* ---------- 4. Фінанси ---------- */
.am-finance {
  padding: calc(29 * var(--u)) calc(25 * var(--u)) calc(23 * var(--u)) calc(21 * var(--u)); display: flex; flex-direction: column;
  background:
    radial-gradient(115% 70% at 22% 0%, #FAF8F5 0%, rgba(250,248,245,0) 68%),
    linear-gradient(180deg, #F4F1EC 0%, #F1EDE6 100%);
}
.am-tag {
  align-self: flex-start; height: calc(31 * var(--u)); display: inline-flex; align-items: center; padding: 0 calc(17 * var(--u)); border-radius: 999px; margin-left: calc(4 * var(--u));
  background: linear-gradient(100deg, #ffffff 18%, #F4FAF5 100%); border: calc(1.2 * var(--u)) solid rgba(255,255,255,.9);
  box-shadow: 0 calc(3 * var(--u)) calc(9 * var(--u)) rgba(46,58,48,.08); font-size: calc(12 * var(--u)); font-weight: 700; letter-spacing: -0.01em; color: #111;
}
.am-big { margin-top: calc(22 * var(--u)); font-size: calc(37 * var(--u)); font-weight: 800; letter-spacing: -0.035em; line-height: 1; color: #0b0b0b; }
.am-big-sub { margin-top: calc(12 * var(--u)); font-size: calc(14.5 * var(--u)); letter-spacing: -0.012em; color: #1d1d1d; }
.am-chart { margin-top: auto; height: calc(294 * var(--u)); display: flex; align-items: flex-end; gap: calc(13 * var(--u)); }
.am-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; }
.am-bar { width: 100%; border-radius: calc(7 * var(--u)); background: #E6E1D8; padding-top: calc(9 * var(--u)); display: flex; justify-content: center; font-size: calc(11 * var(--u)); font-weight: 500; color: #A1978A; }
.am-bar.now { background: linear-gradient(180deg, #C2D8C4 0%, #8FAE93 45%, #6F9273 100%); color: #fff; font-weight: 600; box-shadow: 0 calc(4 * var(--u)) calc(12 * var(--u)) rgba(46,58,48,.2); }
.am-day { margin-top: calc(10 * var(--u)); font-size: calc(10.4 * var(--u)); font-weight: 500; letter-spacing: 0.05em; color: #A79C8E; }

/* ---------- 5. Пошук ---------- */
.am-search {
  display: flex; align-items: center; padding: 0 calc(25 * var(--u)) 0 calc(46 * var(--u));
  background: linear-gradient(103deg, #EEF1F6 0%, #E6EAF1 40%, #DDE2EC 100%);
}
.am-search .am-h2 { font-size: calc(23 * var(--u)); line-height: 1.39; }
.am-bar-search {
  margin-left: auto; width: calc(612 * var(--u)); height: calc(64 * var(--u)); border-radius: 999px; background: #fff;
  box-shadow: 0 calc(4 * var(--u)) calc(14 * var(--u)) rgba(60,70,100,.10); display: flex; align-items: center; gap: calc(16 * var(--u)); padding: 0 calc(22 * var(--u)) 0 calc(10 * var(--u));
}
.am-mag { width: calc(44 * var(--u)); height: calc(44 * var(--u)); border-radius: 50%; background: #F1F2F5; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.am-mag svg { width: calc(18 * var(--u)); height: calc(18 * var(--u)); }
.am-ph { font-size: calc(16.5 * var(--u)); letter-spacing: -0.015em; color: #8C8C99; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* ---------- Поява: при прокрутці, один раз ---------- */
.am-anim { opacity: 0; }
.am.run .am-anim { opacity: 1; animation-fill-mode: backwards; }
.am.run .am-card { animation: amPanel .74s cubic-bezier(.16,1,.3,1) backwards; }
.am.run .am-calendar { animation-duration: .82s; animation-delay: .04s; }
.am.run .am-notif    { animation-duration: .66s; animation-delay: .10s; }
.am.run .am-finance  { animation-delay: .14s; }
.am.run .am-clients  { animation-delay: .20s; }
.am.run .am-search   { animation-duration: .68s; animation-delay: .28s; }
.am .am-card { opacity: 0; }
.am.run .am-card { opacity: 1; }
@keyframes amPanel { 0% { opacity: 0; transform: translateY(calc(12 * var(--u))) scale(.988); clip-path: inset(3% round calc(22 * var(--u))); } 62% { opacity: 1; } 100% { opacity: 1; transform: none; clip-path: inset(0 round calc(22 * var(--u))); } }
@keyframes amType { from { opacity: 0; transform: translateY(calc(16 * var(--u))); clip-path: inset(0 0 96% 0); } to { opacity: 1; transform: none; clip-path: inset(0); } }
@keyframes amRise { from { opacity: 0; transform: translateY(calc(9 * var(--u))); } to { opacity: 1; transform: none; } }
@keyframes amSettle { from { opacity: 0; transform: translateY(calc(16 * var(--u))) scale(.975); } }
@keyframes amChart { from { opacity: 0; transform: translateY(calc(10 * var(--u))); clip-path: inset(100% 0 0 0); } to { opacity: 1; transform: none; clip-path: inset(0); } }
@keyframes amSearch { from { opacity: 0; transform: translateX(calc(12 * var(--u))) scale(.975, 1); } to { opacity: 1; transform: none; } }

@media (max-width: 700px) {
  .am { --u: calc(100cqw / 375); grid-template-columns: 1fr; grid-template-rows: none; row-gap: calc(13 * var(--u)); }
  .am-notif, .am-clients, .am-calendar, .am-finance, .am-search { grid-column: 1; grid-row: auto; }
  .am-notif { height: calc(149 * var(--u)); }
  .am-clients { height: calc(508 * var(--u)); }
  .am-finance { height: calc(500 * var(--u)); }
  .am-calendar { height: calc(330 * var(--u)); }
  .am-hero { font-size: calc(26 * var(--u)); }
  .am-illo { transform: scale(.5981); transform-origin: 0 0; top: calc(110 * var(--u)); }
  .am-search { flex-direction: column; align-items: stretch; padding: calc(24 * var(--u)) calc(18 * var(--u)); gap: calc(16 * var(--u)); }
  .am-bar-search { width: 100%; height: calc(58 * var(--u)); margin-left: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .am .am-card, .am .am-anim { opacity: 1 !important; animation: none !important; }
}
`}</style>
    </div>
  );
}
