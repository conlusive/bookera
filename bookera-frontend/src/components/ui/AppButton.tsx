'use client';

import React from 'react';

/**
 * ЄДИНА КНОПКА ДЛЯ ВСІЄЇ СИСТЕМИ.
 *
 * Чому стилі тут, а не в CSS-класах: у проєкті кілька шарів стилів
 * (Tailwind preflight, shadcn, власні класи в globals.css), і кнопки
 * раз у раз ставали невидимими — то фон не застосовувався, то колір
 * тексту перебивався чужим правилом. Інлайновий стиль має найвищий
 * пріоритет і не залежить від порядку підключення файлів, тому цей
 * клас проблем зникає повністю.
 *
 * Щоб змінити вигляд кнопок у всій системі — правити цей файл.
 *
 * Палітра: Dusty Coal #222222 і Matcha Mist #C2D8C4.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const PALETTE = {
  ink: '#222222',
  inkHover: '#3A3A3A',
  matcha: '#C2D8C4',
  matchaHover: '#B0CCB3',
  surface: '#F6F9F6',
  line: 'rgba(34, 34, 34, 0.22)',
  lineStrong: 'rgba(34, 34, 34, 0.45)',
  muted: '#5C6B5E',
  danger: '#A83934',
  dangerBg: '#FBF0EF',
  dangerBgHover: '#F5DEDC',
  dangerLine: 'rgba(168, 57, 52, 0.22)',
  dangerLineStrong: 'rgba(168, 57, 52, 0.45)',
};

const VARIANTS: Record<ButtonVariant, { base: React.CSSProperties; hover: React.CSSProperties }> = {
  // Основна дія. Одна на екран: якщо основних дві, жодна не головна.
  primary: {
    base: { background: PALETTE.ink, color: '#FFFFFF', borderColor: 'transparent' },
    hover: { background: PALETTE.inkHover },
  },
  // Друга за важливістю. Матча в повну силу — світла, але помітна.
  secondary: {
    base: { background: PALETTE.matcha, color: PALETTE.ink, borderColor: 'transparent' },
    hover: { background: PALETTE.matchaHover },
  },
  // Нейтральна. Саме межа робить її кнопкою на білій картці —
  // без неї біле на білому не читається.
  outline: {
    base: { background: '#FFFFFF', color: PALETTE.ink, borderColor: PALETTE.line },
    hover: { background: PALETTE.surface, borderColor: PALETTE.lineStrong },
  },
  // Спокійна: лише для кнопок усередині зрозумілого контейнера
  // (рядок таблиці, панель), де вони й не мають бути помітними.
  ghost: {
    base: { background: 'transparent', color: PALETTE.muted, borderColor: 'transparent' },
    hover: { background: PALETTE.surface, color: PALETTE.ink },
  },
  // Небезпечна: видима, але приглушена — не притягує погляд
  // і не провокує випадковий клік.
  danger: {
    base: { background: PALETTE.dangerBg, color: PALETTE.danger, borderColor: PALETTE.dangerLine },
    hover: { background: PALETTE.dangerBgHover, borderColor: PALETTE.dangerLineStrong },
  },
};

const SIZES: Record<ButtonSize, React.CSSProperties> = {
  sm: { height: 34, padding: '0 0.75rem', fontSize: '0.8125rem', borderRadius: 9 },
  md: { height: 40, padding: '0 1rem', fontSize: '0.875rem', borderRadius: 10 },
  lg: { height: 46, padding: '0 1.35rem', fontSize: '0.9375rem', borderRadius: 12 },
};

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  /** Додаткові стилі — для відступів у конкретному місці, не для вигляду. */
  style?: React.CSSProperties;
}

export default function AppButton({
  variant = 'primary',
  size = 'md',
  block = false,
  disabled,
  style,
  children,
  ...rest
}: ButtonProps) {
  const [hovered, setHovered] = React.useState(false);
  const v = VARIANTS[variant];

  return (
    <button
      {...rest}
      disabled={disabled}
      onMouseEnter={e => { setHovered(true); rest.onMouseEnter?.(e); }}
      onMouseLeave={e => { setHovered(false); rest.onMouseLeave?.(e); }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.45rem',
        border: '1px solid transparent',
        fontFamily: 'inherit',
        fontWeight: 600,
        letterSpacing: '-0.01em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
        width: block ? '100%' : undefined,
        ...SIZES[size],
        ...v.base,
        // Наведення не застосовуємо до вимкненої кнопки: вона не реагує
        // на клік, тому й вигляд не має змінюватись.
        ...(hovered && !disabled ? v.hover : null),
        ...style,
      }}
    >
      {children}
    </button>
  );
}
