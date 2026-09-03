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
 * Показуються всі типи. Раніше 'success' тихо ігнорувався - і це було
 * помилкою: людина натискала «Зберегти» і не отримувала ЖОДНОГО
 * підтвердження, бо SaveButton стоїть далеко не скрізь. Краще коротке
 * повідомлення, ніж тиша у відповідь на дію.
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
    timers.current.push(setTimeout(() => setToast(null), 300));
  }, []);

  const showToast = useCallback((msg: string, type: ToastType = 'success') => {
    clearTimers();
    setToast({ msg, type, exiting: false });

    // Помилку тримаємо довше: її треба встигнути прочитати.
    const life = type === 'error' ? 6000 : 3500;
    timers.current.push(setTimeout(() => {
      setToast(prev => (prev ? { ...prev, exiting: true } : null));
      timers.current.push(setTimeout(() => setToast(null), 300));
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
            bottom: '1.5rem',
            // Справа внизу: там плашка не перекриває основний робочий
            // простір і не тягне погляд від того, з чим людина працює.
            right: '1.5rem',
            maxWidth: 'min(400px, calc(100vw - 3rem))',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            // Матове скло: напівпрозорий фон + розмиття того, що під ним.
            // Плашка лишається легкою, не перекриває контент повністю і
            // не читається як ще один суцільний блок інтерфейсу.
            background: toast.type === 'error'
              ? 'rgba(253, 240, 239, 0.96)'
              : 'rgba(238, 247, 239, 0.96)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            // Волосяна лінія замість помітної рамки - вона лише окреслює
            // край на світлому тлі, а не малює навколо плашки контур.
            border: toast.type === 'error'
              ? '1px solid rgba(168, 57, 52, 0.28)'
              : '1px solid rgba(94, 122, 97, 0.30)',
            color: toast.type === 'error' ? '#8C2F2B' : '#22301F',
            padding: '0.7rem 1.05rem',
            borderRadius: '14px',
            // Мʼяка розсіяна тінь замість різкої: створює відчуття
            // легкого підняття над сторінкою, а не наліпленого блоку.
            boxShadow: '0 10px 32px rgba(31, 36, 31, 0.16), 0 2px 6px rgba(31, 36, 31, 0.08)',
            zIndex: 9999,
            // Ті самі параметри тексту, що в кнопках (.bk-btn) - щоб
            // повідомлення читалось як частина інтерфейсу, а не сторонній блок.
            fontSize: '0.9rem',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            lineHeight: 1.45,
            cursor: 'pointer',
          }}
        >
          <span
            aria-hidden
            style={{
              flexShrink: 0,
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: toast.type === 'error' ? '#A83934' : '#6F9273',
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
