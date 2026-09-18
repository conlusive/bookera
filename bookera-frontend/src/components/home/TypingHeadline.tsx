'use client';

import { useEffect, useState } from 'react';

/**
 * Заголовок банера, який друкується сам.
 *
 * Фрази змінюються по колу: кожна каже про той самий продукт іншими
 * словами. Це не прикраса - людина, яка вперше бачить сайт, за кілька
 * секунд отримує кілька відповідей на питання «а що тут», не читаючи
 * жодного списку.
 *
 * Друк, а не поява слів: курсор, що біжить, читається як «хтось пише
 * просто зараз» і тримає погляд. Готова фраза, яка просто змінилась,
 * такого не дає.
 */

const PHRASES = [
  'Догляд за собою в один клік',
  'Улюблений майстер — за хвилину',
  'Запис без дзвінків і очікування',
  'Ваш час — коли зручно вам',
];

// Швидкість друку: 45 мс на символ.
//
// Повільніше читається як затримка системи, швидше - як миготіння,
// за яким не встигає око. Стирання вдвічі швидше: назад читати
// нічого, і повільне стирання лише крадé час.
const TYPE_MS = 45;
const ERASE_MS = 22;

// Скільки фраза стоїть готовою, перш ніж стертись.
// 2.2 секунди - час прочитати рядок середньої довжини й ще мить
// на нього подивитись.
const HOLD_MS = 2200;

export default function TypingHeadline() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [text, setText] = useState('');
  const [isErasing, setIsErasing] = useState(false);

  // Системне налаштування руху поважаємо: людям із вестибулярними
  // розладами миготіння тексту буває нестерпним. Їм показуємо першу
  // фразу без анімації.
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setText(PHRASES[0]);
      return;
    }

    const full = PHRASES[phraseIndex];

    // Фраза набрана повністю - тримаємо й починаємо стирати.
    if (!isErasing && text === full) {
      const t = setTimeout(() => setIsErasing(true), HOLD_MS);
      return () => clearTimeout(t);
    }

    // Стерли до кінця - переходимо до наступної.
    if (isErasing && text === '') {
      setIsErasing(false);
      setPhraseIndex((i) => (i + 1) % PHRASES.length);
      return;
    }

    const t = setTimeout(
      () => setText(isErasing ? full.slice(0, text.length - 1) : full.slice(0, text.length + 1)),
      isErasing ? ERASE_MS : TYPE_MS,
    );
    return () => clearTimeout(t);
  }, [text, isErasing, phraseIndex, reducedMotion]);

  return (
    <h1
      style={{
        fontSize: 'clamp(2.2rem, 4.5vw, 3.4rem)',
        fontWeight: 800,
        color: '#ffffff',
        maxWidth: '820px',
        margin: '0 auto 1rem auto',
        lineHeight: 1.12,
        letterSpacing: '-0.03em',
        // Стала висота під два рядки: без неї весь блок стрибає вгору
        // й вниз щоразу, коли довжина фрази міняє кількість рядків,
        // і пошук під ним теж їздить.
        minHeight: '2.24em',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span>
        {text}
        {!reducedMotion && (
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: '0.055em',
              height: '0.92em',
              marginLeft: '0.06em',
              background: '#fff',
              verticalAlign: 'text-bottom',
              // Курсор не блимає під час набору - лише коли фраза
              // стоїть. Блимання поверх друку виглядає як збій.
              animation: 'heroCaret 1.06s steps(1) infinite',
            }}
          />
        )}
      </span>
    </h1>
  );
}
