'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastContextType {
  showToast: (msg: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toast, setToast] = useState<{
    show: boolean;
    msg: string;
    type: ToastType;
    isExiting: boolean;
  }>({
    show: false,
    msg: '',
    type: 'success',
    isExiting: false,
  });

  const showToast = useCallback((msg: string, type: ToastType = 'success') => {
    setToast({ show: true, msg, type, isExiting: false });

    // Запуск запливання через 2.7с
    setTimeout(() => {
      setToast(prev => ({ ...prev, isExiting: true }));
      // Повне видалення з DOM через 300мс після завершення анімації
      setTimeout(() => {
        setToast({ show: false, msg: '', type: 'success', isExiting: false });
      }, 300);
    }, 2700);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* 🟢 Стилі анімації випливання та запливання з TeamTab */}
      <style>{`
        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes toastSlideOut {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
        }
        .toast-in {
          animation: toastSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .toast-out {
          animation: toastSlideOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* 🟢 Фірмова плашка Toast із TeamTab */}
      {toast.show && (
        <div
          className={toast.isExiting ? 'toast-out' : 'toast-in'}
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            background: toast.type === 'error' ? '#fff1f2' : (toast.type === 'info' ? '#eff6ff' : '#f0fdf4'),
            border: `1.5px solid ${toast.type === 'error' ? '#fecdd3' : (toast.type === 'info' ? '#bfdbfe' : '#86efac')}`,
            color: toast.type === 'error' ? '#991b1b' : (toast.type === 'info' ? '#1e40af' : '#166534'),
            padding: '0.75rem 1.25rem',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            boxShadow: toast.type === 'error'
              ? '0 12px 30px rgba(239, 68, 68, 0.12), 0 4px 12px rgba(0, 0, 0, 0.04)'
              : '0 12px 30px rgba(16, 185, 129, 0.12), 0 4px 12px rgba(0, 0, 0, 0.04)',
            zIndex: 9999,
            fontWeight: '700',
            fontSize: '0.9rem',
            pointerEvents: 'none',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: toast.type === 'error' ? '#fee2e2' : (toast.type === 'info' ? '#dbeafe' : '#dcfce7'),
            color: toast.type === 'error' ? '#dc2626' : (toast.type === 'info' ? '#2563eb' : '#16a34a'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {toast.type === 'error' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
          <span style={{ letterSpacing: '-0.2px' }}>{toast.msg}</span>
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