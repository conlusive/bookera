'use client';

import { createContext, ReactNode, useCallback, useContext } from 'react';
import { notify } from '@/lib/feedback';

/**
 * Колись - спливаючі сповіщення в кутку екрана. Тепер - відгук на місці
 * (lib/feedback.ts), без жодного спливаючого вікна:
 *   помилка заповнення -> поле червоне з текстом під ним
 *   невдала дія        -> текст під кнопкою, яку натиснули
 *   успіх              -> тиша (результат видно на екрані),
 *                         «скопійовано» - маленька ✓ біля кнопки
 * API лишився той самий - showToast(текст, тип, { field }) - тож сотні
 * наявних викликів працюють без переписування.
 */
export type ToastType = 'success' | 'error' | 'info';
type Ctx = { showToast: (msg: string, type?: ToastType, opts?: { field?: string }) => void };

const ToastContext = createContext<Ctx | undefined>(undefined);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const showToast = useCallback((msg: string, type: ToastType = 'success', opts?: { field?: string }) => notify(msg, type, opts), []);
  return <ToastContext.Provider value={{ showToast }}>{children}</ToastContext.Provider>;
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};
