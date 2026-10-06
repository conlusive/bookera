'use client';

import { useEffect, useState } from 'react';
import { useReveal } from './useReveal';

/**
 * «Базовий арсенал майстра» - вільний колаж без карток: макети лежать прямо на білому тлі з підписами,
 * тонкі пунктирні лінії зʼєднують їх. Колір - системна матча й кілька малих акцентів (палітра віяла).
 *
 *   Календар (велике вікно)  - розклад команди, запис підтверджено
 *   Нагадування              - лист клієнту за добу до візиту
 *   Фінанси                  - дохід за днями тижня, сума набігає
 *   База клієнтів            - плашки з даних картки клієнта
 *   Пошук                    - друкується імʼя й зʼявляється знайдений клієнт
 * Усе це є в системі: нічого не обіцяє зайвого.
 */
const BARS = [
  { d: 'ПН', h: 22 }, { d: 'ВТ', h: 34 }, { d: 'СР', h: 48 }, { d: 'ЧТ', h: 60 },
  { d: 'ПТ', h: 74 }, { d: 'СБ', h: 88 }, { d: 'НД', h: 100 },
];

export default function ArsenalCollage() {
  const [ref, run] = useReveal<HTMLDivElement>(0.18);
  const [amount, setAmount] = useState(84500);

  // Сума «набігає» від нуля, коли блок зʼявляється (не для «зменшити рух»)
  useEffect(() => {
    if (!run || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const t0 = performance.now() + 900;
    const tick = (now: number) => {
      const p = Math.max(0, Math.min(1, (now - t0) / 1300));
      setAmount(Math.round(84500 * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setAmount(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run]);

  return (
    <div ref={ref} className={`ac ${run ? 'run' : ''}`} aria-label="Можливості кабінету">
      {/* лінії-зʼєднання (декор) */}
      <svg className="ac-lines" viewBox="0 0 1200 760" preserveAspectRatio="none" aria-hidden="true">
        <path d="M 640 150 C 760 150, 760 110, 880 110" pathLength="1" />
        <path d="M 300 560 C 300 640, 420 660, 520 660" pathLength="1" />
      </svg>

      {/* Календар */}
      <div className="ac-cal">
        <h3 className="ac-h1"><span>Календар</span> без блокнота.<br />Увесь день на одному екрані.</h3>
        <p className="ac-sub">Записи всієї команди: з телефону чи компʼютера.</p>
        <div className="ac-win">
          <div className="ac-bar"><i /><i /><i /></div>
          <div className="ac-body">
            <div className="ac-times"><span>10:00</span><span>11:00</span><span>12:00</span><span>13:00</span></div>
            <div className="ac-grid">
              <div className="ac-slot s1">Стрижка · Макс</div>
              <div className="ac-slot s2">Фарбування · Ірина</div>
              <div className="ac-slot s3">Манікюр · Олена</div>
            </div>
          </div>
          <div className="ac-pill"><span className="ac-tick"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>Запис підтверджено</div>
        </div>
      </div>

      {/* Нагадування */}
      <div className="ac-note">
        <div className="ac-toast">
          <span className="ac-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg></span>
          <div><b>Нагадування надіслано</b><span>Лист клієнту за добу до візиту</span></div>
        </div>
        <h3 className="ac-h3">Клієнти не забувають про візит</h3>
      </div>

      {/* Фінанси */}
      <div className="ac-fin">
        <div className="ac-amount">{amount.toLocaleString('uk-UA')} ₴</div>
        <div className="ac-amount-s">дохід цього тижня</div>
        <div className="ac-chart" role="img" aria-label="Дохід за днями тижня">
          {BARS.map((b, i) => (
            <div key={b.d} className="ac-col">
              <div className={`ac-b ${i === BARS.length - 1 ? 'now' : ''}`} style={{ height: `${b.h}%`, ['--i' as string]: i }} />
              <span>{b.d}</span>
            </div>
          ))}
        </div>
        <h3 className="ac-h3">Фінанси без таблиць</h3>
      </div>

      {/* База клієнтів */}
      <div className="ac-cli">
        <h3 className="ac-h3 big">База клієнтів.<br />Усе про клієнта в одній картці.</h3>
        <div className="ac-chips">
          <span className="ch c1"><i className="av">МВ</i>Марія В. · 7 візитів</span>
          <span className="ch c2">Формула 7.1</span>
          <span className="ch c3">Instagram</span>
          <span className="ch c4">День народження</span>
          <span className="ch c5">Нотатки</span>
          <span className="ch tag">Постійний клієнт</span>
        </div>
      </div>

      {/* Пошук */}
      <div className="ac-search">
        <h3 className="ac-h3">Знайдіть клієнта за секунду</h3>
        <div className="ac-sbar">
          <span className="mag"><svg viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7.1" /><path d="M16.3 16.3 L21 21" /></svg></span>
          <span className="field">
            <span className="ph">Імʼя, телефон або послуга...</span>
            <span className="typed"><span className="typed-t">Марія В.</span><i /></span>
          </span>
        </div>
        <div className="ac-result"><i className="av">МВ</i><div><b>Марія В.</b><span>7 візитів · постійний клієнт</span></div></div>
      </div>

      <style jsx>{`
        .ac { position: relative; display: grid; grid-template-columns: repeat(12, 1fr); grid-template-rows: auto auto auto; gap: 2.5rem 1.5rem; color: #1D1D1F; }
        .ac-lines { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; overflow: visible; }
        .ac-lines path { fill: none; stroke: #c9d6cb; stroke-width: 1.5; stroke-dasharray: 0.02 0.02; vector-effect: non-scaling-stroke; opacity: 0; }
        .ac.run .ac-lines path { opacity: 1; animation: acLine 1.6s ease-out 1.1s both; }
        @keyframes acLine { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
        .ac > div { position: relative; z-index: 1; }

        .ac-cal { grid-column: 1 / 8; grid-row: 1 / 3; }
        .ac-note { grid-column: 9 / 13; grid-row: 1; align-self: start; padding-top: 2.5rem; }
        .ac-fin { grid-column: 8 / 13; grid-row: 2; align-self: end; padding-left: 1.5rem; }
        .ac-cli { grid-column: 1 / 6; grid-row: 3; margin-top: 1rem; }
        .ac-search { grid-column: 6 / 13; grid-row: 3; align-self: center; padding-left: 2rem; }

        .ac-h1 { font-size: clamp(1.7rem, 3vw, 2.4rem); font-weight: 800; line-height: 1.25; letter-spacing: -0.03em; margin: 0 0 0.9rem; }
        .ac-h1 span { color: #4C7A55; }
        .ac-sub { color: #475569; font-size: 1.05rem; margin: 0 0 1.75rem; }
        .ac-h3 { font-size: 1.15rem; font-weight: 700; letter-spacing: -0.02em; color: #111827; margin: 1.1rem 0 0; }
        .ac-h3.big { font-size: 1.5rem; line-height: 1.3; margin: 0 0 1.4rem; }

        /* календар */
        .ac-win { position: relative; border-radius: 20px; background: #F3F8F4; border: 1px solid #dfe8e0; overflow: hidden; transform: rotate(-1.2deg); box-shadow: 0 18px 40px rgba(46,58,48,.08); }
        .ac-bar { height: 30px; background: #fff; border-bottom: 1px solid #e6ede7; display: flex; align-items: center; gap: 6px; padding-left: 14px; }
        .ac-bar i { width: 9px; height: 9px; border-radius: 50%; background: #d6ddd7; }
        .ac-body { display: flex; height: 250px; padding: 14px 16px 0 12px; gap: 12px; }
        .ac-times { display: flex; flex-direction: column; justify-content: space-between; padding: 4px 0 18px; font-size: 0.72rem; font-weight: 600; color: #8a948c; }
        .ac-grid { position: relative; flex: 1; background-image: linear-gradient(#e3eae4 1px, transparent 1px); background-size: 100% 25%; }
        .ac-slot { position: absolute; left: 0; right: 4%; border-radius: 10px; padding: 8px 12px; font-size: 0.82rem; font-weight: 700; color: #1f2937; border-left: 4px solid; opacity: 0; transform: translateX(-14px); }
        .ac-slot.s1 { top: 4%; height: 22%; background: #E3EFE5; border-color: #6F9273; }
        .ac-slot.s2 { top: 31%; height: 30%; background: #FBE2EA; border-color: #F28BB0; right: 18%; }
        .ac-slot.s3 { top: 66%; height: 22%; background: #DDE5FB; border-color: #AFC0F5; }
        .ac.run .ac-slot { animation: acSlot .7s cubic-bezier(.16,1,.3,1) forwards; }
        .ac.run .s1 { animation-delay: .5s; } .ac.run .s2 { animation-delay: .75s; } .ac.run .s3 { animation-delay: 1s; }
        @keyframes acSlot { to { opacity: 1; transform: none; } }
        .ac-pill { position: absolute; right: 7%; top: 47%; display: flex; align-items: center; gap: 8px; background: #fff; border-radius: 999px; padding: 7px 14px 7px 8px; font-size: 0.82rem; font-weight: 600; box-shadow: 0 6px 18px rgba(46,58,48,.14); opacity: 0; transform: scale(.9); }
        .ac.run .ac-pill { animation: acPop .55s cubic-bezier(.34,1.56,.64,1) 1.5s forwards; }
        .ac-tick { width: 20px; height: 20px; border-radius: 50%; background: #4C7A55; display: inline-flex; align-items: center; justify-content: center; }
        .ac-tick svg { width: 11px; height: 11px; }
        @keyframes acPop { to { opacity: 1; transform: none; } }

        /* нагадування */
        .ac-toast { display: flex; align-items: center; gap: 12px; background: #fff; border: 1px solid #e8ece8; border-radius: 16px; padding: 14px 16px; box-shadow: 0 10px 28px rgba(17,24,39,.08); transform: rotate(1.2deg); opacity: 0; translate: 0 14px; }
        .ac.run .ac-toast { animation: acRise .8s cubic-bezier(.16,1,.3,1) .3s forwards; }
        .ac-ico { flex: 0 0 auto; width: 32px; height: 32px; border-radius: 50%; background: #E3EFE5; color: #3F6B49; display: inline-flex; align-items: center; justify-content: center; }
        .ac-ico svg { width: 16px; height: 16px; }
        .ac-toast b { display: block; font-size: 0.92rem; color: #111827; }
        .ac-toast div span { font-size: 0.8rem; color: #64748b; }
        @keyframes acRise { to { opacity: 1; translate: 0 0; } }

        /* фінанси */
        .ac-amount { font-size: clamp(2.1rem, 3.4vw, 2.8rem); font-weight: 900; letter-spacing: -0.04em; color: #111827; font-variant-numeric: tabular-nums; }
        .ac-amount-s { color: #64748b; margin: 0.2rem 0 1.1rem; font-size: 0.95rem; }
        .ac-chart { height: 170px; display: flex; align-items: flex-end; gap: 10px; }
        .ac-col { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 8px; }
        .ac-col span { font-size: 0.68rem; font-weight: 600; letter-spacing: 0.05em; color: #9aa39b; }
        .ac-b { width: 100%; border-radius: 8px; background: #E3EFE5; transform: scaleY(0); transform-origin: bottom; }
        .ac-b.now { background: #8fae92; }
        .ac.run .ac-b { animation: acGrow .8s cubic-bezier(.16,1,.3,1) calc(.5s + var(--i) * .08s) forwards; }
        @keyframes acGrow { to { transform: scaleY(1); } }

        /* клієнти */
        .ac-chips { position: relative; height: 150px; }
        .ch { position: absolute; display: inline-flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #dfe8e0; border-radius: 999px; padding: 9px 16px; font-size: 0.92rem; font-weight: 600; color: #1f2937; box-shadow: 0 4px 12px rgba(46,58,48,.06); white-space: nowrap; opacity: 0; transform: translateY(12px); }
        .ac.run .ch { animation: acChip .7s cubic-bezier(.16,1,.3,1) forwards, acFloat 4.5s ease-in-out infinite; }
        .c1 { left: 0; top: 0; } .c2 { left: 6%; top: 52px; } .c3 { left: 42%; top: 52px; } .c4 { left: 0; top: 104px; } .c5 { left: 52%; top: 104px; }
        .tag { right: 0; top: 14px; background: #FDE6D3; border-color: #f6cfae; transform: rotate(-8deg); }
        .ac.run .c1 { animation-delay: .6s, 1.5s; } .ac.run .c2 { animation-delay: .7s, 2s; } .ac.run .c3 { animation-delay: .8s, 2.5s; }
        .ac.run .c4 { animation-delay: .9s, 3s; } .ac.run .c5 { animation-delay: 1s, 3.5s; } .ac.run .tag { animation-delay: 1.1s, 4s; }
        @keyframes acChip { to { opacity: 1; transform: none; } }
        @keyframes acFloat { 0%, 100% { translate: 0 0; } 50% { translate: 0 -4px; } }
        .av { font-style: normal; width: 24px; height: 24px; border-radius: 50%; background: #E3EFE5; color: #3F6B49; font-size: 0.62rem; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; }

        /* пошук */
        .ac-sbar { display: flex; align-items: center; gap: 14px; background: #fff; border: 1px solid #dfe8e0; border-radius: 999px; height: 62px; padding: 0 22px 0 10px; box-shadow: 0 8px 22px rgba(46,58,48,.07); margin-top: 1rem; opacity: 0; translate: 14px 0; }
        .ac.run .ac-sbar { animation: acSlide .7s cubic-bezier(.16,1,.3,1) .7s forwards; }
        @keyframes acSlide { to { opacity: 1; translate: 0 0; } }
        .mag { width: 42px; height: 42px; border-radius: 50%; background: #F3F8F4; display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; }
        .mag svg { width: 18px; height: 18px; }
        .field { position: relative; flex: 1; min-width: 0; height: 100%; display: flex; align-items: center; }
        .ph { color: #8a948c; font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ac.run .ph { animation: acPh .3s ease 2.4s forwards; }
        @keyframes acPh { to { opacity: 0; } }
        .typed { position: absolute; left: 0; display: inline-flex; align-items: center; font-weight: 600; font-size: 1.05rem; color: #111827; }
        .typed-t { display: inline-block; overflow: hidden; white-space: nowrap; width: 0; }
        .typed i { width: 2px; height: 22px; background: #111827; margin-left: 2px; opacity: 0; }
        .ac.run .typed-t { animation: acType 1s steps(8) 2.6s forwards; }
        .ac.run .typed i { animation: acCaret 1s steps(1) 2.5s 4; }
        @keyframes acType { to { width: 5em; } }
        @keyframes acCaret { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .ac-result { display: flex; align-items: center; gap: 12px; margin: 0.7rem 0 0 54px; background: #fff; border: 1px solid #e6ede7; border-radius: 16px; padding: 10px 14px; width: fit-content; box-shadow: 0 8px 20px rgba(46,58,48,.07); opacity: 0; translate: 0 -8px; }
        .ac.run .ac-result { animation: acRise .6s cubic-bezier(.16,1,.3,1) 3.7s forwards; }
        .ac-result .av { width: 32px; height: 32px; font-size: 0.72rem; }
        .ac-result b { display: block; font-size: 0.92rem; }
        .ac-result div span { font-size: 0.78rem; color: #64748b; }

        @media (max-width: 960px) {
          .ac { display: flex; flex-direction: column; gap: 3rem; }
          .ac-lines { display: none; }
          .ac-note, .ac-fin, .ac-search { padding-left: 0; padding-top: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ac-slot, .ac-pill, .ac-toast, .ac-b, .ch, .ac-sbar, .ac-result { opacity: 1 !important; transform: none !important; translate: none !important; animation: none !important; }
          .ac-b { transform: scaleY(1) !important; }
          .ac-lines path { animation: none !important; opacity: 1; }
          .typed { display: none; }
        }
      `}</style>
    </div>
  );
}
