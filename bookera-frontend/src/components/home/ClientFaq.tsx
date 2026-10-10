'use client';

import { useId, useState } from 'react';

/**
 * Питання клієнтів перед першим записом - на головній, під історією запису.
 *
 * Кожна відповідь звірена з тим, як працює код, а не з тим, як «мало б
 * бути»: запис лише після входу (POST /appointments вимагає токен),
 * нагадування - лише листом приблизно за добу (reminders.py, вікно 20-28 год),
 * відгук - лише після завершеного візиту (review_rules.py), бонуси - 3%
 * і поки що лише нараховуються (bonuses.py, WalletTab). Змінилось правило -
 * змініть і відповідь тут.
 *
 * Футер давно веде на /#faq - цей блок і є тим якорем.
 * Розгортання - кнопка + регіон (а не <details>): так висоту можна плавно
 * анімувати, а стан читається скрінрідером через aria-expanded.
 */

const QA: { q: string; a: string[] }[] = [
  {
    q: 'Чи платно записуватися через BookEra?',
    a: [
      'Ні. Для клієнтів BookEra безкоштовна: ви платите лише за саму послугу за цінами закладу.',
      'Деякі заклади беруть передоплату — це правило закладу, а не плата BookEra.',
    ],
  },
  {
    q: 'Чи потрібно реєструватися?',
    a: [
      'Так, записатися можна після входу: потрібні лише пошта й пароль. Зате всі ваші записи зберігаються в особистому кабінеті, а підтвердження й нагадування приходять листом.',
    ],
  },
  {
    q: 'Запис підтверджується одразу?',
    a: [
      'Зазвичай так — ви одразу бачите «Запис підтверджено». Деякі заклади підтверджують записи вручну: тоді час за вами зарезервовано, а відповідь закладу прийде листом.',
    ],
  },
  {
    q: 'Як перенести або скасувати запис?',
    a: [
      'В особистому кабінеті: біля майбутнього візиту є кнопки «Перенести» і «Скасувати». Скасувати можна й за посиланням з листа.',
      'Заклад може обмежити скасування онлайн, наприклад не пізніше ніж за 24\u00a0години до візиту. Тоді зверніться до закладу напряму.',
    ],
  },
  {
    q: 'Коли прийде нагадування?',
    a: [
      'Листом на пошту, приблизно за добу до візиту. У листі є посилання, за яким можна переглянути або скасувати запис. Якщо листа немає, перевірте папку «Спам».',
    ],
  },
  {
    q: 'Хто пише відгуки і чи можна їм вірити?',
    a: [
      'Відгук можна залишити лише після візиту, який справді відбувся за записом через BookEra. Власники й працівники не можуть оцінювати власний заклад.',
      'Після візиту ми надішлемо листа з проханням оцінити його, а залишити відгук можна й в особистому кабінеті.',
    ],
  },
  {
    q: 'Що таке бонуси?',
    a: [
      'За кожен завершений візит ми нараховуємо 3% від його вартості бонусами: 1 бонус — 1 гривня. Баланс видно в гаманці в особистому кабінеті, а витрачати бонуси можна буде згодом.',
    ],
  },
  {
    q: 'Як зберегти заклад, щоб повернутися до нього?',
    a: [
      'Увійдіть і натисніть сердечко на картці або сторінці закладу — він збережеться в обраному.',
    ],
  },
];

// Розмітка FAQPage для пошуковиків: питання можуть показуватись прямо у видачі.
const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: QA.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a.join(' ') },
  })),
};

export default function ClientFaq() {
  // Перше питання відкрите: видно, що це розгортається, і найчастіша відповідь - одразу.
  const [open, setOpen] = useState<number | null>(0);
  const uid = useId();

  return (
    <section id="faq" className="faq" aria-labelledby={`${uid}-title`}>
      <div className="container faq-grid">
        <div className="faq-side">
          <h2 id={`${uid}-title`}>Питання перед першим записом</h2>
          <p>Коротко про те, як працюють запис, нагадування, відгуки й бонуси.</p>
        </div>

        <div className="faq-list">
          {QA.map(({ q, a }, i) => {
            const on = open === i;
            return (
              <div key={q} className={`faq-item ${on ? 'on' : ''}`}>
                <h3>
                  <button
                    type="button"
                    id={`${uid}-q${i}`}
                    aria-expanded={on}
                    aria-controls={`${uid}-a${i}`}
                    onClick={() => setOpen(on ? null : i)}
                  >
                    <span>{q}</span>
                    <i aria-hidden />
                  </button>
                </h3>
                <div id={`${uid}-a${i}`} role="region" aria-labelledby={`${uid}-q${i}`} className="faq-a" inert={!on}>
                  <div>
                    {a.map((t, j) => <p key={j}>{t}</p>)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      <style jsx global>{`
        .faq {
          --ink: #16211A;
          --muted: #5B6A5F;
          --line: #DCE3DC;
          padding: clamp(3rem, 6vw, 5.5rem) 0 clamp(3.5rem, 7vw, 6rem);
          scroll-margin-top: 90px;
        }
        .faq-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
          gap: clamp(2rem, 6vw, 6rem);
          align-items: start;
        }
        /* Заголовок лишається поруч, поки гортаєш питання. */
        .faq-side { position: sticky; top: 110px; }
        .faq-side h2 {
          margin: 0 0 1rem;
          max-width: 12ch;
          font-size: clamp(2rem, 4vw, 3rem);
          font-weight: 700;
          line-height: 1.04;
          letter-spacing: -0.04em;
          color: var(--ink);
        }
        .faq-side p { margin: 0; max-width: 34ch; font-size: 1rem; line-height: 1.6; color: var(--muted); }

        .faq-list { border-top: 1px solid var(--line); }
        .faq-item { border-bottom: 1px solid var(--line); }
        .faq-item h3 { margin: 0; }
        .faq-item button {
          display: flex; align-items: center; justify-content: space-between; gap: 1.5rem;
          width: 100%; padding: 1.35rem 0;
          background: none; border: 0; cursor: pointer; text-align: left;
          font: inherit; font-size: 1.08rem; font-weight: 600; letter-spacing: -0.01em; color: var(--ink);
        }
        .faq-item button:focus-visible { outline: 2px solid var(--ink); outline-offset: 4px; border-radius: 6px; }
        /* Плюс, що стає мінусом: вертикальна риска повертається й лягає на горизонтальну. */
        .faq-item i { position: relative; flex-shrink: 0; width: 14px; height: 14px; }
        .faq-item i::before, .faq-item i::after {
          content: ''; position: absolute; left: 0; top: 6px; width: 14px; height: 2px; border-radius: 2px; background: var(--ink);
          transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .faq-item i::after { transform: rotate(90deg); }
        .faq-item.on i::after { transform: rotate(0deg); }

        .faq-a { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.35s cubic-bezier(0.22, 1, 0.36, 1); }
        .faq-item.on .faq-a { grid-template-rows: 1fr; }
        .faq-a > div { overflow: hidden; }
        .faq-a p { margin: 0 0 0.8rem; max-width: 62ch; font-size: 0.98rem; line-height: 1.65; color: var(--muted); }
        .faq-a p:last-child { margin-bottom: 1.4rem; }

        @media (max-width: 860px) {
          .faq-grid { grid-template-columns: minmax(0, 1fr); gap: 1.75rem; }
          .faq-side { position: static; }
          .faq-side h2 { max-width: none; }
          .faq-item button { font-size: 1rem; padding: 1.15rem 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .faq-a, .faq-item i::before, .faq-item i::after { transition: none; }
        }
      `}</style>
    </section>
  );
}
