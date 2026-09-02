'use client';

import React, { useEffect, useRef, useState } from 'react';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface SaveButtonProps {
  onSave: () => Promise<void>;
  children?: React.ReactNode;
  savedLabel?: string;
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  disabled?: boolean;
  fullWidth?: boolean;
  title?: string;
}

/**
 * Кнопка, яка сама показує результат дії — замість спливаючого
 * повідомлення в кутку екрана.
 *
 * Чому так: підтвердження має з'являтись там, куди людина дивиться в
 * момент кліку. Тост у кутку змушує переводити погляд, з'являється при
 * кожному дрібному збереженні й швидко починає дратувати. Тут кнопка
 * коротко стає «Збережено» і повертається у звичайний стан.
 *
 * Спливаючі повідомлення лишаються тільки для помилок і подій, які
 * сталися не там, де людина зараз дивиться.
 */
export default function SaveButton({
  onSave,
  children = 'Зберегти',
  savedLabel = 'Збережено',
  variant = 'primary',
  size = 'md',
  disabled = false,
  fullWidth = false,
  title,
}: SaveButtonProps) {
  const [state, setState] = useState<SaveState>('idle');
  const [errorText, setErrorText] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = async () => {
    if (state === 'saving' || disabled) return;
    setState('saving');
    setErrorText('');
    try {
      await onSave();
      if (!mountedRef.current) return;
      setState('saved');
      timerRef.current = setTimeout(() => {
        if (mountedRef.current) setState('idle');
      }, 1800);
    } catch (err: any) {
      if (!mountedRef.current) return;
      // Помилку тримаємо довше: її треба встигнути прочитати,
      // на відміну від успіху, який зрозумілий з першого погляду.
      setErrorText(err?.message || 'Не вдалося зберегти');
      setState('error');
      timerRef.current = setTimeout(() => {
        if (mountedRef.current) setState('idle');
      }, 5000);
    }
  };

  const label =
    state === 'saving' ? 'Зберігаємо…' :
    state === 'saved' ? savedLabel :
    state === 'error' ? (errorText.length > 40 ? 'Не вдалося зберегти' : errorText) :
    children;

  const className = [
    'bk-btn',
    `bk-btn--${variant}`,
    size === 'sm' ? 'bk-btn--sm' : '',
    fullWidth ? 'bk-btn--block' : '',
    state === 'saved' ? 'is-saved' : '',
    state === 'error' ? 'is-error' : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || state === 'saving'}
      className={className}
      title={state === 'error' ? errorText : title}
      aria-live="polite"
    >
      {state === 'saved' && (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {state === 'saving' && <span className="bk-spinner" aria-hidden="true" />}
      {label}
    </button>
  );
}
