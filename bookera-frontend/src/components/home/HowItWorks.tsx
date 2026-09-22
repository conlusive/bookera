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
  // Кроки сценарію: 0 - слоти, 1 - обрано, 2 - підтверджено.
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!play) return;
    const t1 = setTimeout(() => setStep(1), 900);
    const t2 = setTimeout(() => setStep(2), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [play]);

  const slots = ['10:00', '11:30', '14:00', '15:30', '17:00', '18:30'];

  return (
    <div className="demo-card">
      <div className="demo-label">Сьогодні, 24 вересня</div>

      <div className="slots">
        {slots.map((time, i) => (
          <div
            key={time}
            className={`slot ${step >= 1 && i === 2 ? 'picked' : ''}`}
            style={{ transitionDelay: play ? `${i * 60}ms` : '0ms', opacity: play ? 1 : 0 }}
          >
            {time}
          </div>
        ))}
      </div>

      <div className={`confirm ${step === 2 ? 'shown' : ''}`}>
        <span className="check">✓</span>
        <div>
          <div className="confirm-title">Запис підтверджено</div>
          <div className="confirm-sub">Стрижка · 14:00</div>
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
    <div className="demo-phone">
      <div className="phone-time">9:41</div>

      {/* Два сповіщення з'являються одне за одним, як на справжньому
          екрані блокування: спершу нагадування, потім пропозиція
          перенести - саме в такому порядку людина їх і отримує. */}
      <div className={`notif ${play ? 'in' : ''}`} style={{ transitionDelay: '0.3s' }}>
        <div className="notif-app">BookEra · зараз</div>
        <div className="notif-title">Завтра о 14:00</div>
        <div className="notif-body">Стрижка в Top Barber. Чекаємо на вас!</div>
      </div>

      <div className={`notif ${play ? 'in' : ''}`} style={{ transitionDelay: '1.1s' }}>
        <div className="notif-app">BookEra · 1 хв тому</div>
        <div className="notif-title">Щось змінилося?</div>
        <div className="notif-body">Перенесіть запис в один дотик</div>
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

        .how .visual { display: flex; justify-content: center; }

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
        .how .slots { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
        .how .slot {
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
          transition: opacity 0.5s ease, background-color 0.35s ease, color 0.35s ease, border-color 0.35s ease, transform 0.35s ease;
        }
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

        /* --- Телефон зі сповіщеннями --- */
        .how .demo-phone {
          width: 100%;
          max-width: 330px;
          aspect-ratio: 9 / 13;
          border-radius: 38px;
          padding: 2.5rem 1rem 1rem;
          /* Тепле тло, як шпалери екрана блокування: сповіщення на
             білому губились би. */
          background: linear-gradient(160deg, #E9E4DC 0%, #D6CFC4 100%);
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          box-shadow: 0 24px 60px -24px rgba(0,0,0,0.25), inset 0 0 0 8px #1D1D1F;
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 0.9s ease 0.15s, transform 1s cubic-bezier(0.16, 1, 0.3, 1) 0.15s;
        }
        .how .row.in .demo-phone { opacity: 1; transform: none; }
        .how .phone-time {
          text-align: center;
          font-size: 3rem;
          font-weight: 600;
          color: rgba(29,29,31,0.8);
          letter-spacing: -0.03em;
          margin-bottom: 1rem;
        }
        .how .notif {
          background: rgba(255,255,255,0.78);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border-radius: 18px;
          padding: 0.8rem 0.95rem;
          opacity: 0;
          transform: translateY(-14px) scale(0.97);
          transition: opacity 0.6s ease, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .how .notif.in { opacity: 1; transform: none; }
        .how .notif-app { font-size: 0.7rem; color: #86868B; margin-bottom: 0.2rem; }
        .how .notif-title { font-size: 0.875rem; font-weight: 600; color: #1D1D1F; }
        .how .notif-body { font-size: 0.8125rem; color: #3A3A3C; }

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
          background: #1D1D1F;
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
          .how .text, .how .demo-card, .how .demo-phone, .how .notif,
          .how .confirm, .how .quote, .how .slot, .how .bar-fill {
            transition: none !important;
          }
        }
      `}</style>
    </section>
  );
}
