'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback, useRef } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastContextType {
  showToast: (msg: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

/**
 * Сповіщення лише про те, чого людина не бачить сама.
 *
 * Раніше плашка вискакувала на КОЖНЕ збереження — і при звичайній роботі
 * в CRM це перетворювалось на постійне миготіння в кутку. Тепер:
 *
 *   - успішні збереження підтверджує сама кнопка (див. ui/SaveButton),
 *     бо підтвердження має бути там, куди людина дивиться;
 *   - сюди потрапляють лише помилки й фонові події — те, що сталось
 *     не під курсором і що можна пропустити.
 *
 * Виклики showToast(..., 'success') свідомо не показуються: щоб не
 * переписувати одразу сотні місць у восьми вкладках, вони просто тихо
 * ігноруються, а кнопки поступово переводяться на SaveButton.
 */
export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toast, setToast] = useState<{ msg: string; type: ToastType; exiting: boolean } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const dismiss = useCallback(() => {
    clearTimers();
    setToast(prev => (prev ? { ...prev, exiting: true } : null));
    timers.current.push(setTimeout(() => setToast(null), 200));
  }, []);

  const showToast = useCallback((msg: string, type: ToastType = 'success') => {
    // Успіх показує кнопка — тут він лише зайвий шум.
    if (type === 'success') return;

    clearTimers();
    setToast({ msg, type, exiting: false });

    // Помилку тримаємо довше: її треба встигнути прочитати.
    const life = type === 'error' ? 6000 : 3500;
    timers.current.push(setTimeout(() => {
      setToast(prev => (prev ? { ...prev, exiting: true } : null));
      timers.current.push(setTimeout(() => setToast(null), 200));
    }, life));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {toast && (
        <div
          role={toast.type === 'error' ? 'alert' : 'status'}
          className={toast.exiting ? 'bk-toast-out' : 'bk-toast'}
          onClick={dismiss}
          style={{
            position: 'fixed',
            bottom: '1.75rem',
            left: '50%',
            // transform лишається за анімацією (translate(-50%, …)) - якщо
            // задати його тут, він перезапише анімацію і плашка стрибне.
            maxWidth: 'min(400px, calc(100vw - 3rem))',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            // Матове скло: напівпрозорий фон + розмиття того, що під ним.
            // Плашка лишається легкою, не перекриває контент повністю і
            // не читається як ще один суцільний блок інтерфейсу.
            background: toast.type === 'error'
              ? 'rgba(254, 245, 245, 0.82)'
              : 'rgba(244, 250, 245, 0.82)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            // Волосяна лінія замість помітної рамки - вона лише окреслює
            // край на світлому тлі, а не малює навколо плашки контур.
            border: toast.type === 'error'
              ? '0.5px solid rgba(180, 65, 60, 0.18)'
              : '0.5px solid rgba(94, 122, 97, 0.16)',
            color: toast.type === 'error' ? '#8C2F2B' : '#2E3A30',
            padding: '0.7rem 1.05rem',
            borderRadius: '14px',
            // Мʼяка розсіяна тінь замість різкої: створює відчуття
            // легкого підняття над сторінкою, а не наліпленого блоку.
            boxShadow: '0 6px 24px rgba(31, 36, 31, 0.10), 0 1px 3px rgba(31, 36, 31, 0.05)',
            zIndex: 9999,
            fontSize: '0.875rem',
            fontWeight: 450,
            letterSpacing: '-0.01em',
            lineHeight: 1.45,
            cursor: 'pointer',
          }}
        >
          <span
            aria-hidden
            style={{
              flexShrink: 0,
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: toast.type === 'error' ? '#C2605B' : '#8FAE93',
            }}
          />
          <span>{toast.msg}</span>
        </div>
      )}

    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
