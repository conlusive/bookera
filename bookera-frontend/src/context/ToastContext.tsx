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

      <style>{`
        @keyframes bkToastIn  { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes bkToastOut { from { opacity: 1; } to { opacity: 0; } }
        .bk-toast     { animation: bkToastIn 0.2s ease-out both; }
        .bk-toast-out { animation: bkToastOut 0.2s ease-in both; }
        @media (prefers-reduced-motion: reduce) {
          .bk-toast, .bk-toast-out { animation: none; }
        }
      `}</style>

      {toast && (
        <div
          role={toast.type === 'error' ? 'alert' : 'status'}
          className={toast.exiting ? 'bk-toast-out' : 'bk-toast'}
          onClick={dismiss}
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: 'min(440px, calc(100vw - 3rem))',
            background: '#fff',
            border: `1px solid ${toast.type === 'error' ? 'var(--bk-danger, #B4413C)' : 'var(--bk-line, #DEE6DC)'}`,
            borderLeft: `3px solid ${toast.type === 'error' ? 'var(--bk-danger, #B4413C)' : 'var(--bk-ink-soft, #5C6B5E)'}`,
            color: toast.type === 'error' ? 'var(--bk-danger, #B4413C)' : 'var(--bk-ink, #222)',
            padding: '0.7rem 1rem',
            borderRadius: '10px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
            zIndex: 9999,
            fontSize: '0.875rem',
            fontWeight: 500,
            lineHeight: 1.4,
            cursor: 'pointer',
          }}
        >
          {toast.msg}
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
