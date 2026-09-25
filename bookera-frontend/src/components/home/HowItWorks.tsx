'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Як працює продукт - три тези, і кожна ПОКАЗАНА, а не описана.
 *
 * Раніше тут була сітка з текстом. Інформація правильна, але її
 * читають по діагоналі: три абзаци про «зручно й швидко» звучать
 * так само, як на будь-якому іншому сайті.
 *
 * Тепер поруч із кожним текстом - жива мініатюра, яка відтворює саму
 * дію: слоти й підтвердження, сповіщення-нагадування, рейтинг, що
 * наповнюється. Людина бачить, як це працює, за дві секунди - і це
 * запамʼятовується краще за будь-яке формулювання.
 *
 * Тексти збережено дослівно.
 */

/**
 * Поява при прокручуванні - одноразова.
 * Анімація, що повторюється при кожному проході вгору-вниз, дратує.
 */
function useInView<T extends HTMLElement>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Людям із вимкненим рухом показуємо кінцевий стан одразу.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}

/* ------------------------------------------------------------------ */
/* Мініатюра 1: вибір часу → підтвердження                             */
/* ------------------------------------------------------------------ */

function BookingDemo({ play }: { play: boolean }) {
  /**
   * Мініатюра запису - жива.
   *
   * Сама відтворює сценарій (обрано 14:00 → підтверджено), але людина
   * може перехопити: за курсором ковзає підсвітка від години до години,
   * а клік справді обирає годину - і підтвердження показує саме її.
   * Так мініатюра не лише розповідає, як це працює, а дає спробувати.
   */
  const slots = ['10:00', '11:30', '14:00', '15:30', '17:00', '18:30'];
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  // Поки години зʼявляються по черзі, у них затримки переходів. Після
  // появи затримки прибираємо - інакше підсвітка при наведенні
  // відставала б на ті самі 60-300 мс.
  const [entered, setEntered] = useState(false);
  const [glide, setGlide] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  // Для таймерів автосценарію: чи людина вже обрала сама.
  const touchedRef = useRef(false);
  useEffect(() => { touchedRef.current = touched; }, [touched]);

  useEffect(() => {
    if (!play) return;
    const t0 = setTimeout(() => setEntered(true), 700);
    // Автосценарій - лише поки людина нічого не чіпала.
    const t1 = setTimeout(() => { if (!touchedRef.current) { setPicked(2); setStep(1); } }, 900);
    const t2 = setTimeout(() => { if (!touchedRef.current) setStep(2); }, 2100);
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); };
  }, [play]);

  // Підсвітка їде до години під курсором.
  useEffect(() => {
    const el = hover !== null ? refs.current[hover] : null;
    if (!el) { setGlide(null); return; }
    setGlide({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
  }, [hover]);

  const choose = (i: number) => {
    setTouched(true);
    setPicked(i);
    setStep(2);
  };

  return (
    <div className="demo-card">
      <div className="demo-label">Сьогодні, 24 вересня</div>

      <div className="slots" onMouseLeave={() => setHover(null)}>
        <span
          className={`slot-glide ${glide ? 'on' : ''}`}
          style={glide ? { transform: `translate(${glide.x}px, ${glide.y}px)`, width: glide.w, height: glide.h } : undefined}
          aria-hidden
        />
        {slots.map((time, i) => (
          <button
            key={time}
            type="button"
            ref={el => { refs.current[i] = el; }}
            className={`slot ${picked === i ? 'picked' : ''} ${hover === i ? 'hovered' : ''}`}
            style={{ transitionDelay: play && !entered ? `${i * 60}ms` : '0ms', opacity: play ? 1 : 0 }}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            onClick={() => choose(i)}
            aria-pressed={picked === i}
          >
            {time}
          </button>
        ))}
      </div>

      {/* key - при новому виборі підтвердження зʼявляється знову */}
      <div key={picked ?? -1} className={`confirm ${step === 2 && picked !== null ? 'shown' : ''}`}>
        <span className="check">✓</span>
        <div>
          <div className="confirm-title">Запис підтверджено</div>
          <div className="confirm-sub">Стрижка · {picked !== null ? slots[picked] : '14:00'}</div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Мініатюра 2: сповіщення-нагадування                                  */
/* ------------------------------------------------------------------ */

function ReminderDemo({ play }: { play: boolean }) {
  return (
    <div className="device">
      {/* Корпус і екран - два шари, як у справжнього пристрою.
          Раніше рамку малювала внутрішня тінь: плоска чорна смуга,
          яка виглядала намальованою, а не зробленою. */}
      <div className="screen">
        <div className="island" />

        <div className="lock-date">Середа, 24 вересня</div>
        <div className="lock-time">9:41</div>

        <div className="stack">
          <div className={`notif ${play ? 'in' : ''}`} style={{ transitionDelay: '0.35s' }}>
            <div className="app-icon">B</div>
            <div className="notif-content">
              <div className="notif-row">
                <span className="notif-title">Завтра о 14:00</span>
                <span className="notif-when">зараз</span>
              </div>
              <div className="notif-body">Стрижка в Top Barber. Чекаємо на вас!</div>
            </div>
          </div>

          <div className={`notif ${play ? 'in' : ''}`} style={{ transitionDelay: '1.15s' }}>
            <div className="app-icon">B</div>
            <div className="notif-content">
              <div className="notif-row">
                <span className="notif-title">Щось змінилося?</span>
                <span className="notif-when">1 хв</span>
              </div>
              <div className="notif-body">Перенесіть запис в один дотик</div>
            </div>
          </div>
        </div>

        <div className="home-bar" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Мініатюра 3: рейтинг і відгук                                       */
/* ------------------------------------------------------------------ */

function ReviewsDemo({ play }: { play: boolean }) {
  // Лічильник біжить від нуля: число, що росте на очах, помітніше
  // за готове, і воно краще передає «реальні відгуки від людей».
  const [count, setCount] = useState(0);
  const target = 128;

  useEffect(() => {
    if (!play) return;
    let raf = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - started) / 1400);
      // Сповільнення наприкінці: рівномірний лічильник виглядає
      // механічно.
      setCount(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [play]);

  const bars = [
    { stars: 5, share: 0.82 },
    { stars: 4, share: 0.13 },
    { stars: 3, share: 0.04 },
    { stars: 2, share: 0.01 },
    { stars: 1, share: 0 },
  ];

  return (
    <div className="demo-card">
      <div className="rating-head">
        <div className="rating-big">4.9</div>
        <div>
          <div className="stars">★★★★★</div>
          <div className="demo-label" style={{ margin: 0 }}>{count} відгуків</div>
        </div>
      </div>

      <div className="bars">
        {bars.map((b, i) => (
          <div key={b.stars} className="bar-row">
            <span>{b.stars}</span>
            <div className="bar">
              <div
                className="bar-fill"
                style={{
                  transform: `scaleX(${play ? b.share : 0})`,
                  transitionDelay: `${0.2 + i * 0.08}s`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className={`quote ${play ? 'in' : ''}`}>
        «Найкраща стрижка за останні роки. Записалась за хвилину»
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const ROWS = [
  {
    eyebrow: 'Запис',
    title: ['Зручно бронюйте', 'візити онлайн'],
    paragraphs: [
      'Хочете записатися до перукаря, барбера, на манікюр чи в масажний салон у вашому районі? Шукаєте місце, де найкращі спеціалісти подбають про вашу красу?',
      'BookEra — це сервіс миттєвого бронювання, де можна легко й швидко знаходити вільні дати та записуватися. Більше жодних телефонних дзвінків.',
    ],
    Demo: BookingDemo,
  },
  {
    eyebrow: 'Нагадування',
    title: ['Щось змінилося?', 'Ми нагадаємо'],
    paragraphs: [
      'Керуйте своїми візитами звідусіль. Переносьте записи або скасовуйте бронювання без незручних телефонних дзвінків та пояснень.',
      'Ми знаємо, що у вас щодня безліч справ! Тому BookEra надсилатиме вам автоматичні нагадування про майбутні візити, аби ви нічого не пропустили.',
    ],
    Demo: ReminderDemo,
  },
  {
    eyebrow: 'Відгуки',
    title: ['Бронюйте в найкращих', 'спеціалістів'],
    paragraphs: [
      "У BookEra ви знайдете найкращі заклади для здоров'я та салони краси у вашому регіоні.",
      'Дізнайтеся більше про них — переглядайте профілі, читайте реальні відгуки інших клієнтів та ознайомлюйтеся з їхніми роботами перед тим, як записатись.',
    ],
    Demo: ReviewsDemo,
  },
];

function Row({ row, index }: { row: typeof ROWS[number]; index: number }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  // Рядки чергуються: текст ліворуч, потім праворуч. Три однакові
  // рядки поспіль читаються як таблиця, чергування дає ритм.
  const reversed = index % 2 === 1;
  const { Demo } = row;

  return (
    <div ref={ref} className={`row ${reversed ? 'reversed' : ''} ${inView ? 'in' : ''}`}>
      <div className="text">
        <div className="eyebrow">{row.eyebrow}</div>
        <h3>
          {row.title[0]}
          <br />
          <span className="soft">{row.title[1]}</span>
        </h3>
        {row.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      </div>

      <div className="visual">
        <Demo play={inView} />
      </div>
    </div>
  );
}

export default function HowItWorks() {
  return (
    <section className="how">
      <div className="container">
        {ROWS.map((row, i) => <Row key={i} row={row} index={i} />)}
      </div>

      <style jsx global>{`
        .how { padding: 3rem 0 6rem; }

        .how .row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: clamp(2.5rem, 6vw, 6rem);
          align-items: center;
          padding: clamp(3rem, 6vw, 5rem) 0;
        }
        .how .row.reversed .text { order: 2; }
        .how .row.reversed .visual { order: 1; }

        /* Текст виринає разом зі своїм рядком - по черзі з мініатюрою. */
        .how .text {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.8s ease, transform 0.9s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .how .row.in .text { opacity: 1; transform: none; }

        .how .eyebrow {
          font-size: 0.8125rem;
          font-weight: 600;
          color: #6F9273;
          margin-bottom: 0.9rem;
        }
        .how h3 {
          font-size: clamp(1.9rem, 3.6vw, 2.75rem);
          font-weight: 700;
          line-height: 1.08;
          letter-spacing: -0.03em;
          color: #1D1D1F;
          margin: 0 0 1.4rem;
        }
        .how h3 .soft { color: #86868B; }
        .how p {
          font-size: 1.0625rem;
          line-height: 1.6;
          color: #6E6E73;
          margin: 0 0 1rem;
          max-width: 480px;
        }

        /* Сцена під кожною мініатюрою.
           Без неї картка, телефон і рейтинг висіли б на білому кожен
           сам по собі - три різні обʼєкти. Однакове мʼяке тло робить
           із них одну систему, а тінт матчі привʼязує до бренду. */
        .how .visual {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: clamp(2rem, 4vw, 3.5rem) clamp(1.25rem, 3vw, 2.5rem);
          border-radius: 32px;
          background:
            radial-gradient(80% 60% at 50% 0%, #F4FAF5 0%, transparent 70%),
            linear-gradient(180deg, #F7F9F6 0%, #EEF3ED 100%);
          min-height: 420px;
        }

        /* --- Спільна картка мініатюри --- */
        .how .demo-card {
          width: 100%;
          max-width: 400px;
          background: #fff;
          border-radius: 22px;
          padding: 1.75rem;
          box-shadow: 0 24px 60px -24px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04);
          opacity: 0;
          transform: translateY(30px) scale(0.98);
          transition: opacity 0.9s ease 0.15s, transform 1s cubic-bezier(0.16, 1, 0.3, 1) 0.15s;
        }
        .how .row.in .demo-card { opacity: 1; transform: none; }
        .how .demo-label { font-size: 0.8125rem; color: #86868B; margin-bottom: 1rem; }

        /* --- Слоти --- */
        .how .slots { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; position: relative; }

        /* Підсвітка, що ковзає за курсором між годинами. Одна на всю
           сітку: вона не спалахує на кожній годині окремо, а переїжджає -
           так рух читається як «я веду курсором», а не як мерехтіння. */
        .how .slot-glide {
          position: absolute; left: 0; top: 0; z-index: 0;
          border-radius: 11px; background: #F4FAF5;
          box-shadow: inset 0 0 0 1px #C2D8C4;
          opacity: 0; pointer-events: none;
          transition: transform .38s cubic-bezier(.16,1,.3,1), width .38s cubic-bezier(.16,1,.3,1), height .38s cubic-bezier(.16,1,.3,1), opacity .2s ease;
        }
        .how .slot-glide.on { opacity: 1; }
        .how .slot {
          position: relative; z-index: 1;
          height: 44px;
          border-radius: 11px;
          border: 1px solid #E8E8ED;
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: inherit;
          font-size: 0.9375rem;
          font-weight: 500;
          color: #1D1D1F;
          font-variant-numeric: tabular-nums;
          cursor: pointer;
          transition: opacity 0.5s ease, background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease, transform 0.3s cubic-bezier(.16,1,.3,1);
        }
        /* Під курсором - ледь піднімається, рамка ховається в підсвітку. */
        .how .slot.hovered:not(.picked) { border-color: transparent; color: #2E3A30; transform: translateY(-1px); }
        /* Натискання - коротке «втискання», як у фізичної кнопки. */
        .how .slot:active { transform: scale(0.96); }
        .how .slot:focus-visible { outline: 2px solid #6F9273; outline-offset: 2px; }
        .how .slot.picked {
          background: #1D1D1F;
          border-color: #1D1D1F;
          color: #fff;
          transform: scale(1.04);
        }
        .how .confirm {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          margin-top: 1.1rem;
          padding: 0.9rem 1rem;
          border-radius: 14px;
          background: #F4FAF5;
          opacity: 0;
          transform: translateY(10px);
          transition: opacity 0.5s ease, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .how .confirm.shown { opacity: 1; transform: none; }
        .how .check {
          width: 30px; height: 30px; border-radius: 50%;
          background: #6F9273; color: #fff;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.9rem; flex-shrink: 0;
        }
        .how .confirm-title { font-size: 0.9375rem; font-weight: 600; color: #1D1D1F; }
        .how .confirm-sub { font-size: 0.8125rem; color: #5C6B5E; }

        /* --- Телефон --- */

        /* Корпус: тонкий обідок із ледь помітним градієнтом, як
           у металевої рамки. Чисто чорний читається як заглушка. */
        .how .device {
          /* Екран позиціонується абсолютно всередині корпусу.
             Раніше він мав height: 100%, а висоту корпусу задавав
             aspect-ratio - і Safari не вважає таку висоту визначеною:
             100% у нього ставало «скільки треба вмісту», і екран
             вилазив за рамку. Chrome рахує це правильно, тому помилку
             видно лише в Safari. */
          position: relative;
          box-sizing: border-box;
          width: 100%;
          max-width: 300px;
          aspect-ratio: 9 / 19;
          /* min-height: 0 не дає вмісту розтягнути корпус понад
             пропорцію - без нього aspect-ratio поступається вмісту. */
          min-height: 0;
          border-radius: 52px;
          background: linear-gradient(145deg, #3A3A3C 0%, #1C1C1E 45%, #2C2C2E 100%);
          box-shadow:
            0 40px 80px -30px rgba(46, 58, 48, 0.45),
            0 0 0 1px rgba(255,255,255,0.06) inset,
            0 0 0 1.5px #0A0A0A;
          opacity: 0;
          transform: translateY(34px) rotate(-1.5deg);
          transition: opacity 0.9s ease 0.15s, transform 1.1s cubic-bezier(0.16, 1, 0.3, 1) 0.15s;
        }
        /* Легкий нахил, що випрямляється при появі: пристрій ніби
           кладуть на стіл перед людиною. */
        .how .row.in .device { opacity: 1; transform: rotate(0deg); }

        /* Шпалери - у фірмових кольорах матчі. Беж був випадковим
           і не мав стосунку до продукту. */
        .how .screen {
          /* Відступ 11px від корпусу - це товщина рамки. */
          position: absolute;
          inset: 11px;
          box-sizing: border-box;
          border-radius: 42px;
          overflow: hidden;
          padding: 3.4rem 0.75rem 0.75rem;
          display: flex;
          flex-direction: column;
          background:
            radial-gradient(120% 70% at 20% 0%, #E4EEE3 0%, transparent 60%),
            radial-gradient(90% 60% at 100% 100%, #8FAE93 0%, transparent 65%),
            linear-gradient(170deg, #C2D8C4 0%, #A9C4AC 55%, #7E9E83 100%);
        }

        .how .island {
          position: absolute;
          top: 11px;
          left: 50%;
          transform: translateX(-50%);
          width: 92px;
          height: 27px;
          border-radius: 20px;
          background: #0A0A0A;
        }

        .how .lock-date {
          text-align: center;
          font-size: 0.8125rem;
          font-weight: 500;
          color: rgba(24, 38, 26, 0.72);
        }
        /* Тонкий і великий, як справжній годинник екрана блокування.
           Напівжирний час читається як заголовок сайту, а не як екран. */
        .how .lock-time {
          text-align: center;
          font-size: 4.25rem;
          font-weight: 300;
          line-height: 1;
          letter-spacing: -0.04em;
          color: rgba(24, 38, 26, 0.85);
          margin: 0.15rem 0 auto;
          font-variant-numeric: tabular-nums;
        }

        .how .stack { display: flex; flex-direction: column; gap: 0.45rem; margin-bottom: 1.1rem; }

        .how .notif {
          display: flex;
          gap: 0.6rem;
          align-items: flex-start;
          padding: 0.7rem 0.75rem;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.62);
          backdrop-filter: blur(20px) saturate(1.4);
          -webkit-backdrop-filter: blur(20px) saturate(1.4);
          box-shadow: 0 1px 0 rgba(255,255,255,0.5) inset;
          opacity: 0;
          transform: translateY(-14px) scale(0.96);
          transition: opacity 0.6s ease, transform 0.75s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .how .notif.in { opacity: 1; transform: none; }

        /* Іконка застосунку - фірмова: без неї сповіщення безіменне,
           і незрозуміло, від кого воно. */
        .how .app-icon {
          flex-shrink: 0;
          width: 34px;
          height: 34px;
          border-radius: 9px;
          background: linear-gradient(145deg, #2E3A30 0%, #1D1D1F 100%);
          color: #C2D8C4;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.05rem;
          font-weight: 800;
          letter-spacing: -0.04em;
        }
        .how .notif-content { flex: 1; min-width: 0; }
        .how .notif-row { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
        .how .notif-title { font-size: 0.8125rem; font-weight: 600; color: #1D1D1F; }
        .how .notif-when { font-size: 0.6875rem; color: rgba(29,29,31,0.5); flex-shrink: 0; }
        .how .notif-body { font-size: 0.78rem; color: rgba(29,29,31,0.78); line-height: 1.35; margin-top: 1px; }

        .how .home-bar {
          width: 118px;
          height: 5px;
          border-radius: 3px;
          background: rgba(24, 38, 26, 0.55);
          margin: 0 auto;
        }

        /* --- Рейтинг --- */
        .how .rating-head { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem; }
        .how .rating-big {
          font-size: 3.25rem; font-weight: 700; letter-spacing: -0.04em;
          color: #1D1D1F; line-height: 1;
        }
        .how .stars { color: #F5A623; letter-spacing: 2px; font-size: 1rem; margin-bottom: 0.2rem; }
        .how .bars { display: flex; flex-direction: column; gap: 0.45rem; }
        .how .bar-row { display: flex; align-items: center; gap: 0.6rem; font-size: 0.75rem; color: #86868B; }
        .how .bar-row span { width: 8px; }
        .how .bar { flex: 1; height: 6px; border-radius: 3px; background: #F2F2F5; overflow: hidden; }
        .how .bar-fill {
          height: 100%;
          background: #6F9273;
          transform-origin: left;
          transition: transform 1s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .how .quote {
          margin-top: 1.25rem;
          padding-top: 1.1rem;
          border-top: 1px solid #F2F2F5;
          font-family: Georgia, 'Times New Roman', serif;
          font-style: italic;
          font-size: 1rem;
          line-height: 1.5;
          color: #3A3A3C;
          opacity: 0;
          transition: opacity 0.8s ease 0.9s;
        }
        .how .quote.in { opacity: 1; }

        @media (max-width: 860px) {
          .how .row { grid-template-columns: 1fr; gap: 2.5rem; }
          /* На телефоні текст завжди першим: чергування на одній
             колонці лише плутає порядок читання. */
          .how .row.reversed .text { order: 1; }
          .how .row.reversed .visual { order: 2; }
        }

        @media (prefers-reduced-motion: reduce) {
          .how .text, .how .demo-card, .how .device, .how .notif,
          .how .confirm, .how .quote, .how .slot, .how .slot-glide, .how .bar-fill {
            transition: none !important;
          }
        }
      `}</style>
    </section>
  );
}
