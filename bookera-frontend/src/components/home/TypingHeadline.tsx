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

/**
 * Фрази навмисно короткі - до 30 символів.
 *
 * Довша не вміщається в рядок на середньому екрані й переноситься,
 * а перенесення посеред друку читається як збій: текст раптом
 * стрибає вниз, і око губить місце.
 *
 * Написані так, як сказала б людина, а не як пишуть на лендінгах.
 * «Оптимізуйте свій б'юті-досвід» ніхто вголос не каже.
 */
const PHRASES = [
  'Догляд за собою в один клік',
  'Знайшли, обрали, записались',
  'Без дзвінків і очікування',
  'Ваш майстер — за хвилину',
  'Запис, поки п’єте каву',
  'Красиво. Швидко. Поруч',
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
        fontSize: 'clamp(1.6rem, 4.2vw, 3.2rem)',
        fontWeight: 800,
        color: '#ffffff',
        maxWidth: '820px',
        margin: '0 auto 1rem auto',
        lineHeight: 1.12,
        letterSpacing: '-0.03em',
        // Один рядок, без переносу.
        //
        // Раніше довга фраза переносилась посеред друку - текст раптом
        // стрибав униз, і око губило місце. Фрази тепер короткі, але
        // nowrap страхує: якщо колись додасться довша, вона стиснеться
        // кеглем, а не поїде на другий рядок.
        whiteSpace: 'nowrap',
        minHeight: '1.3em',
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
