'use client';

import { useEffect, useRef, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarCheck, CalendarClock, CalendarX2, Check, Clock3, Images, Mail, MessageSquareText, PhoneOff, Star } from 'lucide-react';

/**
 * Як працює продукт - три тези, і кожна ПОКАЗАНА, а не описана.
 *
 * Поруч із кожним текстом - жива мініатюра, яка відтворює саму дію:
 * вибір часу й підтвердження, лист-нагадування, рейтинг, що
 * наповнюється. Людина бачить, як це працює, за дві секунди.
 *
 * Подача стримана: один предмет на сцені, без плашок і наліпок
 * навколо. Кожна додаткова вставка відбирає увагу в головного.
 *
 * ПЛАВНІСТЬ. Анімуються лише transform і opacity - їх малює відеокарта,
 * не перераховуючи сторінку. Розмитих плям (filter: blur) і скла
 * (backdrop-filter) тут немає: у Safari саме вони гальмували прокрутку.
 * Ролик запису стоїть на паузі, коли його не видно, а лічильник
 * відгуків пише число прямо в елемент, без перемальовування React.
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
   * Мініатюра запису - міні-ролик, у якому курсор сам обирає годину.
   *
   * СИНХРОННІСТЬ. Курсор рухається покадрово (requestAnimationFrame),
   * і на КОЖНОМУ кадрі перевіряється, над якою годиною зараз кінчик
   * стрілки. Підсвітка зʼявляється рівно тоді, коли кінчик входить
   * у годину, і зникає, коли виходить.
   *
   * Позиція курсора пишеться прямо в елемент, без React: 60 кадрів на
   * секунду без жодного перемальовування. React оновлюється лише коли
   * змінюється година під курсором - кілька разів за коло.
   *
   * ПАУЗА. Раніше ролик крутився вічно, навіть коли секцію давно
   * прокрутили: покадровий рух і оновлення React забирали час у
   * прокрутки решти сторінки. Тепер нове коло починається, лише коли
   * картку видно і вкладка активна.
   */
  const slots = ['10:00', '11:30', '14:00', '15:30', '17:00', '18:30'];
  const SCENES = [{ decoy: 1, target: 2 }, { decoy: 3, target: 4 }, { decoy: 0, target: 1 }];
  // Смуга днів: вибрана середа - дата запису, а не підпис над сіткою.
  const days = [['Пн', 22], ['Вт', 23], ['Ср', 24], ['Чт', 25], ['Пт', 26]] as const;

  const [picked, setPicked] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [cursorOn, setCursorOn] = useState(false);
  const [ripple, setRipple] = useState<{ x: number; y: number; key: number } | null>(null);
  const [glide, setGlide] = useState<{ x: number; y: number } | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<SVGSVGElement>(null);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const pos = useRef({ x: 0, y: 0, scale: 1 });
  const hoverRef = useRef<number | null>(null);
  const visibleRef = useRef(false);

  // Кінчик стрілки - у точці (3, 2) всередині SVG.
  const TIP_X = 3, TIP_Y = 2;

  const paint = () => {
    const el = cursorRef.current;
    if (el) el.style.transform = `translate3d(${pos.current.x - TIP_X}px, ${pos.current.y - TIP_Y}px, 0) scale(${pos.current.scale})`;
  };

  // Над якою годиною кінчик стрілки - чесна перевірка межами години.
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

  // Чи видно картку зараз - не одноразово, а весь час: від цього залежить пауза.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const o = new IntersectionObserver(([e]) => { visibleRef.current = e.isIntersecting; }, { threshold: 0.1 });
    o.observe(el);
    return () => o.disconnect();
  }, []);

  // Підсвітка - під годиною, над якою кінчик. Години однакового розміру,
  // тож вона лише переїжджає (transform), не змінюючи ширини й висоти.
  useEffect(() => {
    const el = hover !== null ? refs.current[hover] : null;
    setGlide(el ? { x: el.offsetLeft, y: el.offsetTop } : null);
  }, [hover]);

  useEffect(() => {
    if (!play) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPicked(2);
      setConfirmed(true);
      return;
    }

    let alive = true;
    let raf = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const sleep = (ms: number) => new Promise<void>(res => timers.push(setTimeout(res, ms)));
    // Розгін і гальмування, як у руки: рівномірний рух виглядає механічно.
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
        // Наведення - за фактичним положенням кінчика на ЦЬОМУ кадрі.
        const under = slotUnder(pos.current.x, pos.current.y);
        if (under !== hoverRef.current) { hoverRef.current = under; setHover(under); }
        if (k < 1) raf = requestAnimationFrame(frame);
        else resolve();
      };
      raf = requestAnimationFrame(frame);
    });

    const press = async (i: number) => {
      pos.current.scale = 0.86; paint();
      setRipple({ ...pointAt(i), key: performance.now() });
      await sleep(110);
      pos.current.scale = 1; paint();
    };

    const scene = async (n: number) => {
      const { decoy, target } = SCENES[n % SCENES.length];
      Object.assign(pos.current, offstage(), { scale: 1 });
      paint();
      setCursorOn(true);
      await sleep(250);
      await moveTo(pointAt(decoy), 720);   // до сусідньої - «вагається»
      await sleep(380);
      await moveTo(pointAt(target), 520);  // на потрібну
      await sleep(220);
      await press(target);                 // клік
      setPicked(target);
      setConfirmed(true);
      await sleep(1600);
      await moveTo(offstage(), 700);       // іде - наведення зникає саме
      setCursorOn(false);
      await sleep(1700);
      setPicked(null);
      setConfirmed(false);
      setRipple(null);
      await sleep(500);
    };

    void (async () => {
      await sleep(500);
      for (let n = 0; alive; n++) {
        // Пауза, поки картки не видно або вкладка у фоні.
        while (alive && (!visibleRef.current || document.hidden)) await sleep(300);
        if (alive) await scene(n);
      }
    })();

    return () => { alive = false; cancelAnimationFrame(raf); timers.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  return (
    <div className="demo-card" ref={cardRef}>
      <div className="venue" aria-hidden>
        <span className="venue-logo">TB</span>
        <div className="venue-name">
          <div>Top Barber</div>
          <span>Стрижка · 45 хв</span>
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
            style={{ opacity: play ? 1 : 0, transitionDelay: play && !cursorOn && picked === null ? `${i * 60}ms` : '0ms' }}
          >
            {time}
          </div>
        ))}

        {ripple && <span key={ripple.key} className="demo-ripple" style={{ left: ripple.x, top: ripple.y }} />}

        <svg ref={cursorRef} className={`demo-cursor ${cursorOn ? 'on' : ''}`} width="22" height="26" viewBox="0 0 24 28">
          <path d="M3 2 L3 22 L8.2 17.2 L11.6 25 L15 23.5 L11.7 15.9 L18.6 15.9 Z" fill="#fff" stroke="#1D1D1F" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      </div>

      <div key={picked ?? -1} className={`confirm ${confirmed && picked !== null ? 'shown' : ''}`}>
        <span className="check"><Check size={15} strokeWidth={3} /></span>
        <div>
          <div className="confirm-title">Запис підтверджено</div>
          <div className="confirm-sub">Ср, 24 вересня · {picked !== null ? slots[picked] : '14:00'}</div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Мініатюра 2: лист-нагадування на екрані блокування                  */
/* ------------------------------------------------------------------ */

function ReminderDemo({ play }: { play: boolean }) {
  // Нагадування приходять листом (застосунку з push у BookEra немає),
  // тому на екрані - сповіщення пошти від BookEra: відправник, тема,
  // початок листа.
  const notes = [
    { when: 'зараз', subject: 'Завтра о 14:00', body: 'Стрижка в Top Barber. Чекаємо на вас!', delay: '0.35s' },
    { when: '1 хв', subject: 'Щось змінилося?', body: 'Перенесіть запис в один дотик', delay: '1.05s' },
  ];

  return (
    <div className="device">
      {/* Корпус і екран - два шари, як у справжнього пристрою. */}
      <div className="screen">
        <div className="island" />

        <div className="lock-date">Середа, 24 вересня</div>
        <div className="lock-time">9:41</div>

        <div className="stack">
          {notes.map(n => (
            <div key={n.subject} className={`notif ${play ? 'in' : ''}`} style={{ transitionDelay: n.delay }}>
              <div className="app-icon"><Mail size={17} strokeWidth={2.2} /></div>
              <div className="notif-content">
                <div className="notif-row">
                  <span className="notif-title">BookEra</span>
                  <span className="notif-when">{n.when}</span>
                </div>
                <div className="notif-subject">{n.subject}</div>
                <div className="notif-body">{n.body}</div>
              </div>
            </div>
          ))}
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
  // за готове. Пишемо його прямо в елемент - перемальовувати всю
  // картку 60 разів на секунду заради одного числа нема сенсу.
  const countRef = useRef<HTMLSpanElement>(null);
  const target = 128;

  useEffect(() => {
    if (!play) return;
    let raf = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - started) / 1400);
      // Сповільнення наприкінці: рівномірний лічильник виглядає механічно.
      if (countRef.current) countRef.current.textContent = String(Math.round(target * (1 - Math.pow(1 - k, 3))));
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
          <Stars size={16} />
          <div className="rating-count"><span ref={countRef}>0</span> відгуків</div>
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

      {/* Відгук від людини: імʼя, послуга, коли. Анонімна цитата
          курсивом виглядала вигаданою. */}
      <div className={`quote ${play ? 'in' : ''}`}>
        <div className="review-who">
          <span className="ava">МК</span>
          <div>
            <div className="who-name">Марія К.</div>
            <div className="who-sub">Стрижка · 2 дні тому</div>
          </div>
          <Stars size={11} />
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

type Fact = { Icon: ComponentType<{ size?: number; strokeWidth?: number }>; text: string };
type Row = {
  eyebrow: string;
  title: [string, string];
  paragraphs: string[];
  /** Три короткі факти під текстом - те, що око вихоплює, коли абзаци пропускає. */
  facts: Fact[];
  /** Дія наприкінці рядка: href - перехід, без href - до списку закладів на цій сторінці. */
  cta: { label: string; href?: string };
  Demo: ComponentType<{ play: boolean }>;
};

const ROWS: Row[] = [
  {
    eyebrow: 'Запис',
    title: ['Зручно бронюйте', 'візити онлайн'],
    paragraphs: [
      'Хочете записатися до перукаря, барбера, на манікюр чи в масажний салон у вашому районі? Шукаєте місце, де найкращі спеціалісти подбають про вашу красу?',
      'BookEra — це сервіс миттєвого бронювання, де можна легко й швидко знаходити вільні дати та записуватися. Більше жодних телефонних дзвінків.',
    ],
    facts: [
      { Icon: Clock3, text: 'Вільний час наживо' },
      { Icon: CalendarCheck, text: 'Запис цілодобово' },
      { Icon: PhoneOff, text: 'Без дзвінків' },
    ],
    cta: { label: 'Знайти вільний час' },
    Demo: BookingDemo,
  },
  {
    eyebrow: 'Нагадування',
    title: ['Щось змінилося?', 'Ми нагадаємо'],
    paragraphs: [
      'Керуйте своїми візитами звідусіль. Переносьте записи або скасовуйте бронювання без незручних телефонних дзвінків та пояснень.',
      'Ми знаємо, що у вас щодня безліч справ! Тому BookEra надсилатиме вам автоматичні нагадування про майбутні візити, аби ви нічого не пропустили.',
    ],
    facts: [
      { Icon: Mail, text: 'Нагадування на пошту' },
      { Icon: CalendarClock, text: 'Перенесення онлайн' },
      { Icon: CalendarX2, text: 'Скасування без дзвінка' },
    ],
    cta: { label: 'Мої записи', href: '/account/profile' },
    Demo: ReminderDemo,
  },
  {
    eyebrow: 'Відгуки',
    title: ['Бронюйте в найкращих', 'спеціалістів'],
    paragraphs: [
      "У BookEra ви знайдете найкращі заклади для здоров'я та салони краси у вашому регіоні.",
      'Дізнайтеся більше про них — переглядайте профілі, читайте реальні відгуки інших клієнтів та ознайомлюйтеся з їхніми роботами перед тим, як записатись.',
    ],
    facts: [
      { Icon: Star, text: 'Рейтинг закладів' },
      { Icon: MessageSquareText, text: 'Відгуки клієнтів' },
      { Icon: Images, text: 'Фото робіт' },
    ],
    cta: { label: 'Переглянути заклади' },
    Demo: ReviewsDemo,
  },
];

/**
 * До списку закладів на цій же сторінці. Блок «поруч» буває прихованим
 * (немає закладів) - тоді нагору, до пошуку в шапці.
 */
function scrollToSalons(e: React.MouseEvent) {
  e.preventDefault();
  const el = document.getElementById('salons-section');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  else window.scrollTo({ top: 0, behavior: 'smooth' });
}

function Row({ row, index }: { row: Row; index: number }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  // Рядки чергуються: текст ліворуч, потім праворуч. Три однакові
  // рядки поспіль читаються як таблиця, чергування дає ритм.
  const reversed = index % 2 === 1;
  const { Demo } = row;

  return (
    <div ref={ref} className={`row ${reversed ? 'reversed' : ''} ${inView ? 'in' : ''}`}>
      <div className="text">
        <div className="eyebrow"><span className="num">{String(index + 1).padStart(2, '0')}</span>{row.eyebrow}</div>
        <h3>
          {row.title[0]}
          <br />
          <span className="soft">{row.title[1]}</span>
        </h3>
        {row.paragraphs.map((p, i) => <p key={i}>{p}</p>)}

        <ul className="facts">
          {row.facts.map(({ Icon, text }) => (
            <li key={text}><span><Icon size={13} strokeWidth={2.4} /></span>{text}</li>
          ))}
        </ul>

        {row.cta.href
          ? <Link href={row.cta.href} className="cta">{row.cta.label}<ArrowRight size={16} /></Link>
          : <a href="#salons-section" onClick={scrollToSalons} className="cta">{row.cta.label}<ArrowRight size={16} /></a>}
      </div>

      {/* Сцена - рівна пастельна плашка без градієнтів, як у Booksy чи
          Fresha: увага на предметі, а не на тлі. У кожного рядка свій
          приглушений колір - кольори майстрів із календаря. */}
      <div className={`visual tone-${index + 1}`}>
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
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: clamp(3rem, 6vw, 6rem);
          align-items: center;
          padding: clamp(3rem, 6vw, 5rem) 0;
        }
        .how .row.reversed .text { order: 2; }
        .how .row.reversed .visual { order: 1; }

        /* Одна крива на всю секцію: швидкий старт, довге м'яке гальмування. */
        .how { --ease: cubic-bezier(0.22, 1, 0.36, 1); }

        /* Текст виринає разом зі своїм рядком - по черзі з мініатюрою. */
        .how .text {
          opacity: 0;
          transform: translate3d(0, 20px, 0);
          transition: opacity 0.7s ease, transform 0.9s var(--ease);
        }
        .how .row.in .text { opacity: 1; transform: none; }

        /* Номер кроку - три рядки читаються як одна історія. */
        .how .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          font-size: 0.8125rem;
          font-weight: 600;
          color: #4F7A55;
          margin-bottom: 1.1rem;
        }
        .how .eyebrow .num {
          padding: 0.2rem 0.5rem;
          border-radius: 999px;
          background: #E7F0E8;
          color: #3E6444;
          font-size: 0.72rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .how h3 {
          font-size: clamp(2rem, 3.6vw, 2.75rem);
          font-weight: 700;
          line-height: 1.06;
          letter-spacing: -0.035em;
          color: #16211A;
          margin: 0 0 1.5rem;
        }
        .how h3 .soft { color: #8A978D; }
        .how .text p {
          font-size: 1.0625rem;
          line-height: 1.65;
          color: #55655A;
          margin: 0 0 1rem;
          max-width: 470px;
        }

        .how .facts { list-style: none; display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 1.5rem 0 1.75rem; padding: 0; }
        .how .facts li {
          display: inline-flex; align-items: center; gap: 0.45rem;
          padding: 0.38rem 0.8rem 0.38rem 0.4rem;
          border-radius: 999px; background: #fff; border: 1px solid #E3ECE4;
          font-size: 0.85rem; font-weight: 500; color: #2B3A30;
        }
        .how .facts li span {
          width: 22px; height: 22px; border-radius: 50%;
          background: #EEF5EF; color: #3E6444;
          display: inline-flex; align-items: center; justify-content: center;
        }

        .how .cta {
          display: inline-flex; align-items: center; gap: 0.45rem;
          font-size: 0.95rem; font-weight: 600; color: #16211A;
          text-decoration: underline; text-underline-offset: 4px; text-decoration-color: rgba(22, 33, 26, 0.3);
          transition: text-decoration-color 0.2s ease;
        }
        .how .cta svg { transition: transform 0.25s var(--ease); }
        .how .cta:hover { text-decoration-color: #16211A; }
        .how .cta:hover svg { transform: translateX(3px); }

        /* --- Сцена --- */
        .how .visual {
          position: relative;
          overflow: hidden;
          /* Перемальовування всередині не виходить за межі сцени. */
          contain: layout paint;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: clamp(3rem, 5vw, 4.5rem) clamp(1.5rem, 4vw, 3.5rem);
          border-radius: 32px;
          min-height: 500px;
          background: var(--tone);
        }
        .how .tone-1 { --tone: #E9F0EA; }
        .how .tone-2 { --tone: #F4EEE4; }
        .how .tone-3 { --tone: #EEEDF6; }

        /* --- Спільна картка мініатюри --- */
        .how .demo-card {
          position: relative;
          width: 100%;
          max-width: 400px;
          background: #fff;
          border-radius: 24px;
          padding: 1.5rem;
          /* Тінь шарами: близька чітка + далека м'яка - так лежить справжній предмет. */
          box-shadow:
            0 0 0 1px rgba(22, 33, 26, 0.05),
            0 1px 2px rgba(22, 33, 26, 0.04),
            0 10px 24px -10px rgba(22, 33, 26, 0.12),
            0 36px 70px -28px rgba(22, 33, 26, 0.28);
          opacity: 0;
          transform: translate3d(0, 28px, 0) scale(0.985);
          transition: opacity 0.8s ease 0.12s, transform 1s var(--ease) 0.12s;
          will-change: transform, opacity;
        }
        .how .row.in .demo-card { opacity: 1; transform: none; }

        /* --- Запис: заклад, дні, години --- */
        .how .venue {
          display: flex; align-items: center; gap: 0.75rem;
          padding-bottom: 1.1rem; margin-bottom: 1.1rem;
          border-bottom: 1px solid #F0F2F0;
        }
        .how .venue-logo {
          width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
          background: linear-gradient(145deg, #2E3A30 0%, #16211A 100%);
          color: #C2D8C4; font-size: 0.78rem; font-weight: 800; letter-spacing: -0.02em;
          display: inline-flex; align-items: center; justify-content: center;
        }
        .how .venue-name div { font-size: 0.95rem; font-weight: 600; color: #16211A; }
        .how .venue-name span { font-size: 0.78rem; color: #86868B; }
        .how .venue-price { margin-left: auto; font-size: 0.95rem; font-weight: 600; color: #16211A; font-variant-numeric: tabular-nums; }

        .how .days { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.4rem; margin-bottom: 1.1rem; }
        .how .day {
          display: flex; flex-direction: column; align-items: center; gap: 1px;
          padding: 0.45rem 0; border-radius: 12px;
          font-size: 0.95rem; font-weight: 600; color: #1D1D1F; font-variant-numeric: tabular-nums;
        }
        .how .day span { font-size: 0.68rem; font-weight: 500; color: #86868B; }
        .how .day.on { background: #16211A; color: #fff; }
        .how .day.on span { color: rgba(255, 255, 255, 0.6); }

        /* --- Слоти --- */
        .how .slots { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; position: relative; }

        /* Підсвітка, що переїжджає за курсором між годинами. Розмір
           задано один раз (рівно як у години), рухається лише transform. */
        .how .slot-glide {
          position: absolute; left: 0; top: 0; z-index: 0;
          width: calc((100% - 1rem) / 3); height: 44px;
          border-radius: 11px; background: #F4FAF5;
          box-shadow: inset 0 0 0 1px #C2D8C4;
          opacity: 0; pointer-events: none;
          transition: transform 0.24s var(--ease), opacity 0.15s ease;
        }
        .how .slot-glide.on { opacity: 1; }

        /* Курсор рухає JS покадрово - CSS-переходу трансформації тут
           немає, інакше він накладався б на покадровий рух. */
        .how .demo-cursor {
          position: absolute; left: 0; top: 0; z-index: 3;
          pointer-events: none; opacity: 0;
          filter: drop-shadow(0 2px 3px rgba(0,0,0,.22));
          transform-origin: 3px 2px;
          will-change: transform;
          transition: opacity .3s ease;
        }
        .how .demo-cursor.on { opacity: 1; }

        /* Коло від точки натискання - підтверджує, що клік відбувся. */
        .how .demo-ripple {
          position: absolute; z-index: 2; width: 44px; height: 44px; margin: -22px 0 0 -22px;
          border-radius: 50%; border: 2px solid #6F9273; pointer-events: none;
          animation: demoRipple .6s ease-out forwards;
        }
        @keyframes demoRipple {
          from { transform: scale(.3); opacity: .9; }
          to { transform: scale(1.4); opacity: 0; }
        }
        .how .slot {
          position: relative; z-index: 1;
          height: 44px;
          border-radius: 11px;
          border: 1px solid #E8E8ED;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9375rem;
          font-weight: 500;
          color: #1D1D1F;
          font-variant-numeric: tabular-nums;
          transition: opacity 0.5s ease, background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.24s var(--ease);
        }
        .how .slot.hovered:not(.picked) { border-color: transparent; color: #2E3A30; }
        .how .slot.picked { background: #16211A; border-color: #16211A; color: #fff; transform: scale(1.03); }
        .how .confirm {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          margin-top: 1.1rem;
          padding: 0.9rem 1rem;
          border-radius: 14px;
          background: #F4FAF5;
          opacity: 0;
          transform: translate3d(0, 8px, 0);
          transition: opacity 0.45s ease, transform 0.6s var(--ease);
        }
        .how .confirm.shown { opacity: 1; transform: none; }
        .how .check {
          width: 30px; height: 30px; border-radius: 50%;
          background: #6F9273; color: #fff;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .how .confirm-title { font-size: 0.9375rem; font-weight: 600; color: #16211A; }
        .how .confirm-sub { font-size: 0.8125rem; color: #5C6B5E; }

        /* --- Телефон --- */

        /* Корпус: тонкий обідок із ледь помітним градієнтом, як
           у металевої рамки. Чисто чорний читається як заглушка. */
        .how .device {
          /* Екран позиціонується абсолютно всередині корпусу: Safari не
             вважає висоту з aspect-ratio визначеною, і height: 100%
             у нього вилазив за рамку. */
          position: relative;
          box-sizing: border-box;
          width: 100%;
          max-width: 290px;
          aspect-ratio: 9 / 19;
          min-height: 0;
          border-radius: 50px;
          background: linear-gradient(145deg, #3A3A3C 0%, #1C1C1E 45%, #2C2C2E 100%);
          box-shadow:
            0 0 0 1.5px #0A0A0A,
            0 0 0 1px rgba(255,255,255,0.06) inset,
            0 12px 28px -12px rgba(22, 33, 26, 0.3),
            0 44px 80px -30px rgba(22, 33, 26, 0.45);
          opacity: 0;
          transform: translate3d(0, 32px, 0);
          transition: opacity 0.8s ease 0.12s, transform 1.05s var(--ease) 0.12s;
          will-change: transform, opacity;
        }
        .how .row.in .device { opacity: 1; transform: none; }

        /* Шпалери - у фірмових кольорах матчі. */
        .how .screen {
          position: absolute;
          inset: 10px;
          box-sizing: border-box;
          border-radius: 41px;
          overflow: hidden;
          padding: 3.3rem 0.7rem 0.7rem;
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
          width: 90px;
          height: 26px;
          border-radius: 20px;
          background: #0A0A0A;
        }

        .how .lock-date {
          text-align: center;
          font-size: 0.8125rem;
          font-weight: 500;
          color: rgba(24, 38, 26, 0.72);
        }
        /* Тонкий і великий, як справжній годинник екрана блокування. */
        .how .lock-time {
          text-align: center;
          font-size: 4.1rem;
          font-weight: 300;
          line-height: 1;
          letter-spacing: -0.04em;
          color: rgba(24, 38, 26, 0.85);
          margin: 0.15rem 0 auto;
          font-variant-numeric: tabular-nums;
        }

        .how .stack { display: flex; flex-direction: column; gap: 0.45rem; margin-bottom: 1.1rem; }

        /* Сповіщення - напівпрозоре біле без розмиття фону: на рівних
           шпалерах різниці не видно, а розмиття - найдорожче, що є в Safari. */
        .how .notif {
          display: flex;
          gap: 0.6rem;
          align-items: flex-start;
          padding: 0.7rem 0.75rem;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.7);
          box-shadow: 0 1px 0 rgba(255,255,255,0.5) inset, 0 6px 16px -10px rgba(22, 33, 26, 0.35);
          opacity: 0;
          transform: translate3d(0, -12px, 0) scale(0.97);
          transition: opacity 0.55s ease, transform 0.75s var(--ease);
        }
        .how .notif.in { opacity: 1; transform: none; }

        /* Іконка пошти у фірмових кольорах: видно і що це лист, і від кого. */
        .how .app-icon {
          flex-shrink: 0;
          width: 34px;
          height: 34px;
          border-radius: 9px;
          background: linear-gradient(145deg, #2E3A30 0%, #16211A 100%);
          color: #C2D8C4;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .how .notif-content { flex: 1; min-width: 0; }
        .how .notif-row { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
        .how .notif-title { font-size: 0.8125rem; font-weight: 600; color: #1D1D1F; }
        .how .notif-when { font-size: 0.6875rem; color: rgba(29,29,31,0.5); flex-shrink: 0; }
        .how .notif-subject { font-size: 0.78rem; font-weight: 600; color: rgba(29,29,31,0.88); margin-top: 1px; }
        .how .notif-body { font-size: 0.76rem; color: rgba(29,29,31,0.72); line-height: 1.35; }

        .how .home-bar {
          width: 116px;
          height: 5px;
          border-radius: 3px;
          background: rgba(24, 38, 26, 0.55);
          margin: 0 auto;
        }

        /* --- Рейтинг --- */
        .how .rating-head { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.4rem; }
        .how .rating-big {
          font-size: 3.4rem; font-weight: 700; letter-spacing: -0.045em;
          color: #16211A; line-height: 1;
        }
        .how .rating-count { font-size: 0.8125rem; color: #86868B; margin-top: 0.3rem; font-variant-numeric: tabular-nums; }
        .how .stars { display: inline-flex; gap: 2px; color: #F5A623; }
        .how .bars { display: flex; flex-direction: column; gap: 0.5rem; }
        .how .bar-row { display: flex; align-items: center; gap: 0.6rem; font-size: 0.75rem; color: #86868B; font-variant-numeric: tabular-nums; }
        .how .bar-row span { width: 8px; }
        .how .bar { flex: 1; height: 6px; border-radius: 3px; background: #F2F2F5; overflow: hidden; }
        .how .bar-fill {
          height: 100%;
          background: #6F9273;
          transform-origin: left;
          transition: transform 1.1s var(--ease);
        }
        .how .quote {
          margin-top: 1.4rem;
          padding-top: 1.2rem;
          border-top: 1px solid #F2F2F5;
          opacity: 0;
          transition: opacity 0.7s ease 0.8s;
        }
        .how .quote.in { opacity: 1; }
        .how .review-who { display: flex; align-items: center; gap: 0.6rem; }
        .how .review-who .stars { margin-left: auto; }
        .how .ava {
          width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 0.72rem; font-weight: 700;
          background: linear-gradient(145deg, #E8E7FB, #B9B6EC); color: #2D2A5C;
        }
        .how .who-name { font-size: 0.875rem; font-weight: 600; color: #16211A; }
        .how .who-sub { font-size: 0.75rem; color: #86868B; }
        .how .quote p { margin: 0.75rem 0 0; font-size: 0.95rem; line-height: 1.55; color: #3A3A3C; }

        @media (max-width: 860px) {
          .how .row { grid-template-columns: minmax(0, 1fr); gap: 2.5rem; }
          /* На телефоні текст завжди першим: чергування на одній
             колонці лише плутає порядок читання. */
          .how .row.reversed .text { order: 1; }
          .how .row.reversed .visual { order: 2; }
        }

        /* Телефон: один абзац замість двох і менше повітря між блоками. */
        @media (max-width: 640px) {
          .how { padding: 1rem 0 2rem; }
          .how .row { gap: 1.4rem; padding: 2rem 0; }
          .how .text p:nth-of-type(n+2) { display: none; }
          .how h3 { margin-bottom: 0.9rem; }
          .how .facts { margin: 1rem 0 1.1rem; gap: 0.4rem; }
          .how .facts li { font-size: 0.8rem; }
          .how .visual { min-height: 0; padding: 2.25rem 1.1rem; border-radius: 24px; }
          .how .demo-card { padding: 1.25rem; }
          .how .device { max-width: 240px; border-radius: 44px; }
          .how .screen { border-radius: 35px; }
          .how .lock-time { font-size: 3.4rem; }
        }

        @media (prefers-reduced-motion: reduce) {
          .how .text, .how .demo-card, .how .device, .how .notif,
          .how .confirm, .how .quote, .how .slot, .how .slot-glide, .how .demo-cursor, .how .bar-fill, .how .cta svg {
            transition: none !important;
          }
        }
      `}</style>
    </section>
  );
}
