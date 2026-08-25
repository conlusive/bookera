'use client';

import { useEffect } from 'react';

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  useEffect(() => {
    console.error('Помилка в кабінеті:', error);
  }, [error]);

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafafa', fontFamily: 'system-ui, sans-serif', padding: '2rem', textAlign: 'center' }}>
      <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: '800', marginBottom: '1.5rem' }}>
        !
      </div>
      <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.5rem' }}>Щось пішло не так</h2>
      <p style={{ color: '#64748b', fontSize: '0.95rem', maxWidth: '400px', marginBottom: '2rem', lineHeight: '1.5' }}>
        Сталася непередбачувана помилка під час завантаження даних цього розділу.
      </p>
      <button
        onClick={() => reset()}
        style={{ padding: '0.85rem 2rem', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer', transition: '0.2s', boxShadow: '0 4px 12px rgba(15,23,42,0.15)' }}
      >
        Спробувати знову
      </button>
    </div>
  );
}