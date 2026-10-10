'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Check, Mail, Star } from 'lucide-react';

/**
 * Як працює продукт - як ІСТОРІЯ одного запису, а не три окремі «фічі».
 *
 * Неділя, 21:40 - людина обирає барбера за відгуками. 21:43 - записується,
 * хоча салон уже зачинений. Вівторок, 14:00 - приходить лист, що завтра
 * візит. Час тут - каркас секції: він замінює номери 01/02/03 і мітки
 * над заголовками й сам несе зміст (запис о будь-якій порі, лист за добу).
 *
 * Три предмети стоять на ОДНІЙ сцені, і рух один, зрежисований: спершу
 * наповнюється рейтинг, потім курсор обирає 14:00, потім на телефон
 * приходить лист. Смужки під текстом заповнюються в такт - видно, який
 * текст про що. Попередні варіанти (три однакові картки з анімацією
 * появи кожної) виглядали шаблонно.
 *
 * ПЛАВНІСТЬ. Анімуються лише transform і opacity. Без filter: blur і
 * backdrop-filter (у Safari саме вони гальмували). Історія стоїть на
 * паузі, коли секції не видно або вкладка у фоні; лічильник відгуків
 * пише число прямо в елемент, без перемальовування React.
 *
 * На телефоні - вертикальна стрічка часу: кожен крок зі своїм предметом,
 * і кожен оживає, коли до нього догортають.
 *
 * Тексти збережено дослівно.
 */

const MOBILE_QUERY = '(max-width: 899px)';
const subscribeMobile = (cb: () => void) => {
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ */
/* Предмет 1: рейтинг і відгук                                         */
/* ------------------------------------------------------------------ */

function ReviewsDemo({ show }: { show: boolean }) {
  // Лічильник біжить від нуля - пишемо число прямо в елемент:
  // перемальовувати всю картку 60 разів на секунду заради нього нема сенсу.
  const countRef = useRef<HTMLSpanElement>(null);
  const target = 128;

  useEffect(() => {
    const el = countRef.current;
    if (!el) return;
    if (!show) { el.textContent = '0'; return; }
    if (reducedMotion()) { el.textContent = String(target); return; }
    let raf = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - started) / 1400);
      // Сповільнення наприкінці: рівномірний лічильник виглядає механічно.
      el.textContent = String(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [show]);

  const bars = [0.82, 0.13, 0.04, 0.01, 0];

  return (
    <div className="demo-card reviews">
      <div className="venue" aria-hidden>
        <span className="venue-logo">TB</span>
        <div className="venue-name">
          <div>Top Barber</div>
          <span>Барбершоп на Городоцькій</span>
        </div>
      </div>

      <div className="rating-head">
        <div className="rating-big">4,9</div>
        <div>
          <Stars size={15} />
          <div className="rating-count"><span ref={countRef}>0</span> відгуків</div>
        </div>
      </div>

      <div className="bars" aria-hidden>
        {bars.map((share, i) => (
          <div key={i} className="bar-row">
            <span>{5 - i}</span>
            <div className="bar">
              <div
                className="bar-fill"
                style={{ transform: `scaleX(${show ? share : 0})`, transitionDelay: show ? `${0.15 + i * 0.08}s` : '0s' }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Відгук від людини: імʼя, послуга, коли. */}
      <div className={`quote ${show ? 'in' : ''}`}>
        <div className="review-who">
          <span className="ava">МК</span>
          <div>
            <div className="who-name">Марія К.</div>
            <div className="who-sub">Стрижка, 2 дні тому</div>
          </div>
        </div>
        <p>Найкраща стрижка за останні роки. Записалась за хвилину</p>
      </div>
    </div>
  );
}

/** Зірки - векторні: символ ★ залежить від шрифту й на різних системах різний. */
function Stars({ size }: { size: number }) {
  return (
    <span className="stars" aria-hidden>
      {[0, 1, 2, 3, 4].map(i => <Star key={i} size={size} fill="currentColor" strokeWidth={0} />)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Предмет 2: вибір часу → підтвердження                               */
/* ------------------------------------------------------------------ */

function BookingDemo({ play, onDone }: { play: boolean; onDone: () => void }) {
  /**
   * Міні-ролик, у якому курсор сам обирає годину. Одне коло на кожне
   * play=true; після кола запис лишається підтвердженим - наступний
   * крок історії (лист) говорить саме про нього. Новий цикл історії
   * монтує компонент заново (key), тож скидати стан не потрібно.
   *
   * СИНХРОННІСТЬ. Курсор рухається покадрово, і на КОЖНОМУ кадрі
   * перевіряється, над якою годиною кінчик стрілки: підсвітка
   * зʼявляється рівно тоді, коли кінчик входить у годину. Позиція
   * курсора пишеться прямо в елемент, без React.
   *
   * Обирається завжди 14:00 (середа, 24 вересня) - про цей візит
   * нагадує лист на телефоні. Змінюється лише година, біля якої
   * курсор «вагається».
   */
  const slots = ['10:00', '11:30', '14:00', '15:30', '17:00', '18:30'];
  const TARGET = 2;
  const days = [['Пн', 22], ['Вт', 23], ['Ср', 24], ['Чт', 25], ['Пт', 26]] as const;

  const [picked, setPicked] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [cursorOn, setCursorOn] = useState(false);
  const [ripple, setRipple] = useState<{ x: number; y: number; key: number } | null>(null);
  const [glide, setGlide] = useState<{ x: number; y: number } | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<SVGSVGElement>(null);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const pos = useRef({ x: 0, y: 0, scale: 1 });
  const hoverRef = useRef<number | null>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  // Кінчик стрілки - у точці (3, 2) всередині SVG.
  const TIP_X = 3, TIP_Y = 2;

  const paint = () => {
    const el = cursorRef.current;
    if (el) el.style.transform = `translate3d(${pos.current.x - TIP_X}px, ${pos.current.y - TIP_Y}px, 0) scale(${pos.current.scale})`;
  };

  const slotUnder = (x: number, y: number): number | null => {
    for (let i = 0; i < refs.current.length; i++) {
      const el = refs.current[i];
      if (el && x >= el.offsetLeft && x <= el.offsetLeft + el.offsetWidth && y >= el.offsetTop && y <= el.offsetTop + el.offsetHeight) return i;
    }
    return null;
  };
  const pointAt = (i: number) => {
    const el = refs.current[i];
    return el ? { x: el.offsetLeft + el.offsetWidth * 0.52, y: el.offsetTop + el.offsetHeight * 0.55 } : { x: 0, y: 0 };
  };
  const offstage = () => {
    const g = gridRef.current;
    return { x: (g?.offsetWidth ?? 300) + 36, y: (g?.offsetHeight ?? 100) + 76 };
  };

  // Підсвітка лише переїжджає (transform): години однакового розміру.
  useEffect(() => {
    const el = hover !== null ? refs.current[hover] : null;
    setGlide(el ? { x: el.offsetLeft, y: el.offsetTop } : null);
  }, [hover]);

  useEffect(() => {
    if (!play) return;

    let alive = true;
    let raf = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const sleep = (ms: number) => new Promise<void>(res => timers.push(setTimeout(res, ms)));
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    const moveTo = (to: { x: number; y: number }, ms: number) => new Promise<void>(resolve => {
      const from = { ...pos.current };
      const t0 = performance.now();
      const frame = (now: number) => {
        if (!alive) return resolve();
        const k = Math.min(1, (now - t0) / ms);
        const e = ease(k);
        pos.current.x = from.x + (to.x - from.x) * e;
        pos.current.y = from.y + (to.y - from.y) * e;
        paint();
        const under = slotUnder(pos.current.x, pos.current.y);
        if (under !== hoverRef.current) { hoverRef.current = under; setHover(under); }
        if (k < 1) raf = requestAnimationFrame(frame);
        else resolve();
      };
      raf = requestAnimationFrame(frame);
    });

    void (async () => {
      await sleep(0);
      if (reducedMotion()) { setPicked(TARGET); onDoneRef.current(); return; }

      const decoy = [1, 4, 5, 0][Math.floor(Math.random() * 4)];
      Object.assign(pos.current, offstage(), { scale: 1 });
      paint();
      setCursorOn(true);
      await sleep(200);
      await moveTo(pointAt(decoy), 700);   // до сусідньої - «вагається»
      await sleep(320);
      await moveTo(pointAt(TARGET), 520);  // на потрібну
      await sleep(200);
      pos.current.scale = 0.86; paint();   // клік
      setRipple({ ...pointAt(TARGET), key: performance.now() });
      await sleep(110);
      pos.current.scale = 1; paint();
      if (!alive) return;
      setPicked(TARGET);
      await sleep(900);
      await moveTo(offstage(), 650);       // іде - наведення зникає саме
      setCursorOn(false);
      if (alive) onDoneRef.current();
    })();

    return () => { alive = false; cancelAnimationFrame(raf); timers.forEach(clearTimeout); };
  }, [play]);

  const confirmed = picked !== null;

  return (
    <div className="demo-card booking">
      <div className="venue" aria-hidden>
        <span className="venue-logo">TB</span>
        <div className="venue-name">
          <div>Стрижка</div>
          <span>45 хв, майстер Олена</span>
        </div>
        <span className="venue-price">450 ₴</span>
      </div>

      <div className="days" aria-hidden>
        {days.map(([d, n]) => (
          <div key={n} className={`day ${n === 24 ? 'on' : ''}`}><span>{d}</span>{n}</div>
        ))}
      </div>

      <div className="slots" ref={gridRef} aria-hidden>
        <span
          className={`slot-glide ${glide ? 'on' : ''}`}
          style={glide ? { transform: `translate3d(${glide.x}px, ${glide.y}px, 0)` } : undefined}
        />
        {slots.map((time, i) => (
          <div
            key={time}
            ref={el => { refs.current[i] = el; }}
            className={`slot ${picked === i ? 'picked' : ''} ${hover === i ? 'hovered' : ''}`}
          >
            {time}
          </div>
        ))}

        {ripple && <span key={ripple.key} className="demo-ripple" style={{ left: ripple.x, top: ripple.y }} />}

        <svg ref={cursorRef} className={`demo-cursor ${cursorOn ? 'on' : ''}`} width="22" height="26" viewBox="0 0 24 28">
          <path d="M3 2 L3 22 L8.2 17.2 L11.6 25 L15 23.5 L11.7 15.9 L18.6 15.9 Z" fill="#fff" stroke="#16211A" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      </div>

      <div className={`confirm ${confirmed ? 'shown' : ''}`}>
        <span className="check"><Check size={15} strokeWidth={3} /></span>
        <div>
          <div className="confirm-title">Запис підтверджено</div>
          <div className="confirm-sub">Середа, 24 вересня, 14:00</div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Предмет 3: лист-нагадування на екрані блокування                    */
/* ------------------------------------------------------------------ */

function ReminderDemo({ show }: { show: boolean }) {
  // Нагадування приходять листом (застосунку з push у BookEra немає),
  // тому на екрані - сповіщення пошти від BookEra. Вівторок, 14:00 -
  // рівно за добу до візиту, який щойно обрали в картці запису.
  return (
    <div className="device">
      <div className="screen">
        <div className="island" />
        <div className="lock-date">Вівторок, 23 вересня</div>
        <div className="lock-time">14:00</div>

        <div className={`notif ${show ? 'in' : ''}`}>
          <div className="app-icon"><Mail size={17} strokeWidth={2.2} /></div>
          <div className="notif-content">
            <div className="notif-row">
              <span className="notif-title">BookEra</span>
              <span className="notif-when">зараз</span>
            </div>
            <div className="notif-subject">Завтра о 14:00, Top Barber</div>
            <div className="notif-body">Чекаємо на вас! Щось змінилося? Перенесіть запис в один дотик</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const STEPS = [
  {
    day: 'Неділя',
    time: '21:40',
    note: 'Обираєте за оцінками інших клієнтів',
    title: 'Бронюйте в найкращих спеціалістів',
    paragraphs: [
      "У BookEra ви знайдете найкращі заклади для здоров'я та салони краси у вашому регіоні.",
      'Дізнайтеся більше про них — переглядайте профілі, читайте реальні відгуки інших клієнтів та ознайомлюйтеся з їхніми роботами перед тим, як записатись.',
    ],
  },
  {
    day: 'Неділя',
    time: '21:43',
    note: 'Три хвилини, хоча салон уже зачинений',
    title: 'Зручно бронюйте візити онлайн',
    paragraphs: [
      'Хочете записатися до перукаря, барбера, на манікюр чи в масажний салон у вашому районі? Шукаєте місце, де найкращі спеціалісти подбають про вашу красу?',
      'BookEra — це сервіс миттєвого бронювання, де можна легко й швидко знаходити вільні дати та записуватися. Більше жодних телефонних дзвінків.',
    ],
  },
  {
    day: 'Вівторок',
    time: '14:00',
    note: 'Лист за добу до візиту',
    title: 'Щось змінилося? Ми нагадаємо',
    paragraphs: [
      'Керуйте своїми візитами звідусіль. Переносьте записи або скасовуйте бронювання без незручних телефонних дзвінків та пояснень.',
      'Ми знаємо, що у вас щодня безліч справ! Тому BookEra надсилатиме вам автоматичні нагадування про майбутні візити, аби ви нічого не пропустили.',
    ],
  },
];

// Скільки триває кожен крок історії - під це заповнюються смужки.
const STEP_MS = [3200, 3600, 3800];

export default function HowItWorks() {
  const mobile = useSyncExternalStore(subscribeMobile, () => window.matchMedia(MOBILE_QUERY).matches, () => false);

  // step: -1 - історія ще не почалась, 0..2 - поточний крок.
  const [step, setStep] = useState(-1);
  const [bookingPlay, setBookingPlay] = useState(false);
  const [cycle, setCycle] = useState(0);
  // На телефоні кожен предмет оживає, коли до нього догорнули.
  const [seen, setSeen] = useState([false, false, false]);

  const storyRef = useRef<HTMLDivElement>(null);
  const objRefs = useRef<(HTMLDivElement | null)[]>([]);
  const visible = useRef<boolean[]>([false, false, false, false]); // 0..2 - предмети, 3 - уся сцена
  const doneRef = useRef<(() => void) | null>(null);
  const onBookingDone = useCallback(() => { doneRef.current?.(); doneRef.current = null; }, []);

  // Видимість - постійно, не одноразово: від неї залежить пауза.
  useEffect(() => {
    const els: [Element, number][] = [];
    objRefs.current.forEach((el, i) => { if (el) els.push([el, i]); });
    if (storyRef.current) els.push([storyRef.current, 3]);
    const o = new IntersectionObserver(entries => {
      for (const e of entries) {
        const i = els.find(([el]) => el === e.target)?.[1];
        if (i === undefined) continue;
        visible.current[i] = e.isIntersecting;
        if (i < 3 && e.isIntersecting) setSeen(s => (s[i] ? s : s.map((v, j) => (j === i ? true : v))));
      }
    }, { threshold: 0.3 });
    els.forEach(([el]) => o.observe(el));
    return () => o.disconnect();
  }, [mobile]);

  useEffect(() => {
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const sleep = (ms: number) => new Promise<void>(res => timers.push(setTimeout(res, ms)));
    const waitVisible = async (i: number) => {
      while (alive && (!visible.current[i] || document.hidden)) await sleep(300);
    };
    const bookingDone = () => new Promise<void>(res => { doneRef.current = res; });

    void (async () => {
      await sleep(0);
      if (reducedMotion()) {
        // Без руху - одразу кінець історії.
        setStep(2);
        setBookingPlay(true);
        return;
      }

      if (mobile) {
        // Телефон: рейтинг і лист - коли догорнули, запис - коло за колом, поки його видно.
        while (alive) {
          await waitVisible(1);
          if (!alive) break;
          setBookingPlay(true);
          await bookingDone();
          await sleep(2600);
          setBookingPlay(false);
          setCycle(c => c + 1);
          await sleep(300);
        }
        return;
      }

      // Десктоп: одна історія на сцені, по колу.
      while (alive) {
        await waitVisible(3);
        if (!alive) break;
        setStep(0);
        await sleep(STEP_MS[0]);
        if (!alive) break;
        setStep(1);
        setBookingPlay(true);
        await bookingDone();
        await sleep(400);
        if (!alive) break;
        setStep(2);
        await sleep(STEP_MS[2]);
        await waitVisible(3);
        if (!alive) break;
        setStep(-1);
        setBookingPlay(false);
        setCycle(c => c + 1);
        await sleep(900);
      }
    })();

    return () => { alive = false; timers.forEach(clearTimeout); doneRef.current = null; };
  }, [mobile]);

  const reviewsOn = mobile ? seen[0] : step >= 0;
  const reminderOn = mobile ? seen[2] : step >= 2;

  const objects = [
    <ReviewsDemo key="r" show={reviewsOn} />,
    <BookingDemo key={`b${cycle}`} play={bookingPlay} onDone={onBookingDone} />,
    <ReminderDemo key="m" show={reminderOn} />,
  ];

  const stepText = (s: typeof STEPS[number]) => (
    <>
      <div className="when">
        <span className="when-time">{s.time}</span>
        <span className="when-day">{s.day}</span>
      </div>
      <div className="when-note">{s.note}</div>
      <h3>{s.title}</h3>
      {s.paragraphs.map((p, j) => <p key={j}>{p}</p>)}
    </>
  );

  return (
    <section className="how" aria-labelledby="how-title">
      <div className="container">
        <h2 id="how-title" className="how-title">Від вибору майстра до візиту</h2>

        {mobile ? (
          <ol className="tl">
            {STEPS.map((s, i) => (
              <li key={i} className="tl-step">
                {stepText(s)}
                <div ref={el => { objRefs.current[i] = el; }} className={`plate tone-${i + 1} plate-${i + 1}`}>
                  {objects[i]}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div ref={storyRef} className="story">
            <div className="stage">
              {STEPS.map((_, i) => (
                <div key={i} ref={el => { objRefs.current[i] = el; }} className={`obj obj-${i + 1} ${step === i ? 'active' : ''}`}>
                  {objects[i]}
                </div>
              ))}
            </div>

            <ol className="steps">
              {STEPS.map((s, i) => (
                <li key={i} className={`step ${step === i ? 'active' : ''} ${step > i ? 'past' : ''}`}>
                  {/* Смужка кроку заповнюється, поки триває його частина історії. */}
                  <span className="seg" aria-hidden>
                    <i style={{ transform: `scaleX(${step >= i ? 1 : 0})`, transitionDuration: step === i ? `${STEP_MS[i]}ms` : '0.45s' }} />
                  </span>
                  {stepText(s)}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <style jsx global>{`
        .how {
          --ink: #16211A;
          --sage: #6F9273;
          --muted: #5B6A5F;
          --line: #DCE3DC;
          --stage: #E8EEE8;
          --ease: cubic-bezier(0.22, 1, 0.36, 1);
          padding: clamp(3.5rem, 7vw, 6rem) 0 clamp(4rem, 8vw, 7rem);
        }
        .how-title {
          margin: 0 0 clamp(1.75rem, 3.5vw, 2.75rem);
          max-width: 14ch;
          font-size: clamp(2.1rem, 4.6vw, 3.6rem);
          font-weight: 700;
          line-height: 1.02;
          letter-spacing: -0.04em;
          color: var(--ink);
        }

        /* --- Десктоп: одна сцена, під нею кроки в тих самих колонках --- */
        .how .story { --cols: minmax(0, 1fr) minmax(0, 1.18fr) minmax(0, 1fr); --gap: clamp(1.25rem, 2.5vw, 2.5rem); }
        .how .stage {
          position: relative;
          display: grid;
          grid-template-columns: var(--cols);
          column-gap: var(--gap);
          align-items: center;
          min-height: 540px;
          padding: 3.5rem clamp(1.5rem, 3vw, 3rem) 0;
          border-radius: 28px;
          background: var(--stage);
          overflow: hidden;
          contain: layout paint;
        }
        .how .obj { display: flex; justify-content: center; }
        /* Відгук трохи нижче й під кутом - предмети лежать, а не стоять у шеренгу. */
        .how .obj-1 { transform: translateY(14px) rotate(-1.5deg); }
        .how .obj-2 { position: relative; z-index: 1; align-self: center; margin-bottom: 3.5rem; }
        /* Телефон виходить за нижній край сцени, як у блоці для бізнесу. */
        .how .obj-3 { align-self: end; margin-bottom: -150px; }

        .how .steps {
          list-style: none;
          margin: 2.25rem 0 0;
          padding: 0 clamp(1.5rem, 3vw, 3rem);
          display: grid;
          grid-template-columns: var(--cols);
          column-gap: var(--gap);
        }
        .how .seg { display: block; height: 2px; border-radius: 2px; background: var(--line); overflow: hidden; margin-bottom: 1.4rem; }
        .how .seg i {
          display: block; height: 100%; background: var(--ink);
          transform-origin: left; transition-property: transform; transition-timing-function: linear;
        }

        .how .when { display: flex; align-items: baseline; gap: 0.6rem; }
        /* Час - головний шрифтовий елемент секції: тонкий, великий, табличні цифри. */
        .how .when-time {
          font-size: clamp(2.2rem, 3.4vw, 3rem);
          font-weight: 300;
          line-height: 1;
          letter-spacing: -0.04em;
          font-variant-numeric: tabular-nums;
          color: #9AA59C;
          transition: color 0.4s ease;
        }
        .how .step.active .when-time, .how .step.past .when-time, .how .tl .when-time { color: var(--ink); }
        .how .when-day { font-size: 0.95rem; font-weight: 600; color: var(--ink); }
        .how .when-note { margin: 0.45rem 0 1.25rem; font-size: 0.875rem; color: var(--sage); font-weight: 500; }
        .how h3 {
          margin: 0 0 0.75rem;
          font-size: 1.3rem;
          font-weight: 700;
          line-height: 1.2;
          letter-spacing: -0.02em;
          color: var(--ink);
        }
        .how .step p, .how .tl p {
          margin: 0 0 0.75rem;
          font-size: 0.95rem;
          line-height: 1.65;
          color: var(--muted);
          max-width: 46ch;
        }

        /* --- Спільна картка-предмет --- */
        .how .demo-card {
          position: relative;
          width: 100%;
          background: #fff;
          border-radius: 20px;
          padding: 1.35rem;
          box-shadow:
            0 0 0 1px rgba(22, 33, 26, 0.05),
            0 2px 4px rgba(22, 33, 26, 0.04),
            0 24px 48px -24px rgba(22, 33, 26, 0.3);
        }
        .how .demo-card.reviews { max-width: 320px; }
        .how .demo-card.booking { max-width: 390px; border-radius: 22px; padding: 1.5rem; box-shadow: 0 0 0 1px rgba(22, 33, 26, 0.05), 0 2px 4px rgba(22, 33, 26, 0.05), 0 40px 70px -30px rgba(22, 33, 26, 0.4); }

        .how .venue { display: flex; align-items: center; gap: 0.7rem; padding-bottom: 1rem; margin-bottom: 1rem; border-bottom: 1px solid #EEF0EE; }
        .how .venue-logo {
          width: 38px; height: 38px; border-radius: 11px; flex-shrink: 0;
          background: var(--ink); color: #C2D8C4;
          font-size: 0.75rem; font-weight: 800; letter-spacing: -0.02em;
          display: inline-flex; align-items: center; justify-content: center;
        }
        .how .venue-name div { font-size: 0.92rem; font-weight: 600; color: var(--ink); }
        .how .venue-name span { font-size: 0.76rem; color: #86868B; }
        .how .venue-price { margin-left: auto; font-size: 0.95rem; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }

        /* --- Рейтинг --- */
        .how .rating-head { display: flex; align-items: center; gap: 0.9rem; margin-bottom: 1rem; }
        .how .rating-big { font-size: 2.9rem; font-weight: 700; letter-spacing: -0.045em; color: var(--ink); line-height: 1; }
        .how .rating-count { font-size: 0.78rem; color: #86868B; margin-top: 0.25rem; font-variant-numeric: tabular-nums; }
        .how .stars { display: inline-flex; gap: 2px; color: #F5A623; }
        .how .bars { display: flex; flex-direction: column; gap: 0.4rem; }
        .how .bar-row { display: flex; align-items: center; gap: 0.55rem; font-size: 0.7rem; color: #86868B; font-variant-numeric: tabular-nums; }
        .how .bar-row span { width: 7px; }
        .how .bar { flex: 1; height: 5px; border-radius: 3px; background: #F0F1F0; overflow: hidden; }
        .how .bar-fill { height: 100%; background: var(--sage); transform-origin: left; transition: transform 1.1s var(--ease); }
        .how .quote { margin-top: 1.1rem; padding-top: 1rem; border-top: 1px solid #EEF0EE; opacity: 0; transition: opacity 0.6s ease; }
        .how .quote.in { opacity: 1; transition-delay: 0.7s; }
        .how .review-who { display: flex; align-items: center; gap: 0.55rem; }
        .how .ava {
          width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 0.66rem; font-weight: 700; background: #DEDDF5; color: #2D2A5C;
        }
        .how .who-name { font-size: 0.82rem; font-weight: 600; color: var(--ink); }
        .how .who-sub { font-size: 0.7rem; color: #86868B; }
        .how .quote p { margin: 0.6rem 0 0; font-size: 0.86rem; line-height: 1.5; color: #3A3A3C; }

        /* --- Запис --- */
        .how .days { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.35rem; margin-bottom: 1rem; }
        .how .day {
          display: flex; flex-direction: column; align-items: center; gap: 1px;
          padding: 0.42rem 0; border-radius: 11px;
          font-size: 0.92rem; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums;
        }
        .how .day span { font-size: 0.66rem; font-weight: 500; color: #86868B; }
        .how .day.on { background: var(--ink); color: #fff; }
        .how .day.on span { color: rgba(255, 255, 255, 0.6); }

        .how .slots { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.45rem; position: relative; }
        .how .slot-glide {
          position: absolute; left: 0; top: 0; z-index: 0;
          width: calc((100% - 0.9rem) / 3); height: 42px;
          border-radius: 10px; background: #F2F7F2; box-shadow: inset 0 0 0 1px #C2D8C4;
          opacity: 0; pointer-events: none;
          transition: transform 0.24s var(--ease), opacity 0.15s ease;
        }
        .how .slot-glide.on { opacity: 1; }
        .how .demo-cursor {
          position: absolute; left: 0; top: 0; z-index: 3;
          pointer-events: none; opacity: 0;
          filter: drop-shadow(0 2px 3px rgba(0,0,0,.22));
          transform-origin: 3px 2px; will-change: transform;
          transition: opacity .3s ease;
        }
        .how .demo-cursor.on { opacity: 1; }
        .how .demo-ripple {
          position: absolute; z-index: 2; width: 42px; height: 42px; margin: -21px 0 0 -21px;
          border-radius: 50%; border: 2px solid var(--sage); pointer-events: none;
          animation: demoRipple .6s ease-out forwards;
        }
        @keyframes demoRipple { from { transform: scale(.3); opacity: .9; } to { transform: scale(1.4); opacity: 0; } }
        .how .slot {
          position: relative; z-index: 1; height: 42px; border-radius: 10px;
          border: 1px solid #E6E8E6;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.92rem; font-weight: 500; color: var(--ink); font-variant-numeric: tabular-nums;
          transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.24s var(--ease);
        }
        .how .slot.hovered:not(.picked) { border-color: transparent; }
        .how .slot.picked { background: var(--ink); border-color: var(--ink); color: #fff; transform: scale(1.03); }
        .how .confirm {
          display: flex; align-items: center; gap: 0.75rem;
          margin-top: 1rem; padding: 0.85rem 0.95rem; border-radius: 13px; background: #F2F7F2;
          opacity: 0; transform: translate3d(0, 8px, 0);
          transition: opacity 0.45s ease, transform 0.6s var(--ease);
        }
        .how .confirm.shown { opacity: 1; transform: none; }
        .how .check { width: 28px; height: 28px; border-radius: 50%; background: var(--sage); color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .how .confirm-title { font-size: 0.9rem; font-weight: 600; color: var(--ink); }
        .how .confirm-sub { font-size: 0.78rem; color: #5C6B5E; }

        /* --- Телефон --- */
        .how .device {
          /* Екран - абсолютно всередині корпусу: Safari не вважає висоту
             з aspect-ratio визначеною, і height: 100% вилазив за рамку. */
          position: relative; box-sizing: border-box;
          width: 100%; max-width: 250px; aspect-ratio: 9 / 19; min-height: 0;
          border-radius: 46px;
          background: linear-gradient(145deg, #3A3A3C 0%, #1C1C1E 45%, #2C2C2E 100%);
          box-shadow: 0 0 0 1.5px #0A0A0A, 0 0 0 1px rgba(255,255,255,0.06) inset, 0 40px 70px -30px rgba(22, 33, 26, 0.45);
        }
        .how .screen {
          position: absolute; inset: 9px; box-sizing: border-box;
          border-radius: 38px; overflow: hidden;
          padding: 3.1rem 0.65rem 0.65rem;
          display: flex; flex-direction: column;
          /* Темні шпалери: світлий екран зливався зі світлою сценою. */
          background: linear-gradient(170deg, #3B5A42 0%, #24382A 60%, #16211A 100%);
        }
        .how .island { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); width: 80px; height: 24px; border-radius: 20px; background: #050705; }
        .how .lock-date { text-align: center; font-size: 0.75rem; font-weight: 500; color: rgba(255, 255, 255, 0.72); }
        .how .lock-time {
          text-align: center; font-size: 3.6rem; font-weight: 300; line-height: 1;
          letter-spacing: -0.04em; color: rgba(255, 255, 255, 0.92);
          margin: 0.15rem 0 1.4rem; font-variant-numeric: tabular-nums;
        }
        /* Без розмиття фону: на рівних шпалерах різниці не видно, а в Safari воно найдорожче. */
        .how .notif {
          display: flex; gap: 0.55rem; align-items: flex-start;
          padding: 0.65rem 0.7rem; border-radius: 18px;
          background: rgba(245, 248, 245, 0.92);
          box-shadow: 0 10px 24px -12px rgba(0, 0, 0, 0.5);
          opacity: 0; transform: translate3d(0, -14px, 0) scale(0.96);
          transition: opacity 0.5s ease, transform 0.7s var(--ease);
        }
        .how .notif.in { opacity: 1; transform: none; transition-delay: 0.25s; }
        .how .app-icon { flex-shrink: 0; width: 32px; height: 32px; border-radius: 9px; background: var(--sage); color: #fff; display: flex; align-items: center; justify-content: center; }
        .how .notif-content { flex: 1; min-width: 0; }
        .how .notif-row { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
        .how .notif-title { font-size: 0.78rem; font-weight: 600; color: #1D1D1F; }
        .how .notif-when { font-size: 0.66rem; color: rgba(29,29,31,0.5); flex-shrink: 0; }
        .how .notif-subject { font-size: 0.75rem; font-weight: 600; color: rgba(29,29,31,0.88); margin-top: 1px; }
        .how .notif-body { font-size: 0.72rem; color: rgba(29,29,31,0.72); line-height: 1.35; }

        /* --- Телефон (екран сайту): вертикальна стрічка часу --- */
        .how .tl { list-style: none; margin: 0; padding: 0; }
        .how .tl-step { position: relative; padding: 0 0 2.75rem 1.6rem; border-left: 1px solid var(--line); margin-left: 5px; }
        .how .tl-step:last-child { padding-bottom: 0; }
        .how .tl-step::before {
          content: ''; position: absolute; left: -6px; top: 0.85rem;
          width: 11px; height: 11px; border-radius: 50%;
          background: #fff; box-shadow: inset 0 0 0 2px var(--ink);
        }
        .how .tl .when-time { font-size: 2.2rem; }
        .how .tl p:nth-of-type(n+2) { display: none; }
        .how .plate {
          display: flex; justify-content: center;
          margin-top: 1.1rem; padding: 1.75rem 1rem;
          border-radius: 22px; background: var(--stage);
          overflow: hidden; contain: layout paint;
        }
        .how .plate-3 { padding-bottom: 0; }
        .how .plate-3 .device { max-width: 220px; margin-bottom: -130px; }
        .how .plate .demo-card.reviews { max-width: 300px; }

        @media (prefers-reduced-motion: reduce) {
          .how .seg i, .how .when-time, .how .bar-fill, .how .quote, .how .notif,
          .how .confirm, .how .slot, .how .slot-glide, .how .demo-cursor {
            transition: none !important;
          }
        }
      `}</style>
    </section>
  );
}
