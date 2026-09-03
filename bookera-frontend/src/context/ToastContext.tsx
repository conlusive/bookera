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
            // transform задає анімація (translate(-50%, …)) - тут його немає,
            // інакше він перезаписав би керування анімації й плашка стрибала б.
            maxWidth: 'min(420px, calc(100vw - 3rem))',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            // Суцільна темна плашка замість кольорової з рамкою: вона не
            // конкурує з контентом за увагу і однаково читається на будь-якому
            // тлі - а рамка + світлий фон виглядали як ще один блок інтерфейсу.
            background: toast.type === 'error' ? '#7f1d1d' : '#1F241F',
            color: '#fff',
            padding: '0.7rem 1.1rem',
            borderRadius: '12px',
            boxShadow: '0 8px 28px rgba(0, 0, 0, 0.18)',
            zIndex: 9999,
            fontSize: '0.875rem',
            fontWeight: 500,
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
              background: toast.type === 'error' ? '#fca5a5' : '#C2D8C4',
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
