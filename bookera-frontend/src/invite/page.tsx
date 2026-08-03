'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, Suspense } from 'react';

function InviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleAccept = async () => {
    if (!token) return;
    setStatus('loading');

    try {
      const res = await fetch('http://127.0.0.1:8000/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setMessage(data.message);
        setTimeout(() => router.push('/cabinet'), 3000);
      } else {
        setStatus('error');
        setMessage(data.detail || 'Помилка прийняття запрошення');
      }
    } catch (err) {
      setStatus('error');
      setMessage('Помилка з\'єднання з сервером');
    }
  };

  if (!token) {
    return <div className="p-10 text-center text-red-500">Помилка: Токен не знайдено</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="p-8 bg-white rounded-xl shadow-md max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4">Запрошення в команду</h1>
        <p className="text-gray-600 mb-8">
          Ви отримали запрошення приєднатися до салону краси.
        </p>

        {status === 'idle' && (
          <button 
            onClick={handleAccept}
            className="w-full py-3 px-4 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition"
          >
            Прийняти запрошення
          </button>
        )}

        {status === 'loading' && <p className="text-blue-500 font-medium">Обробка...</p>}
        
        {status === 'success' && (
          <div className="text-green-600 font-medium">
            <p>✅ {message}</p>
            <p className="text-sm text-gray-500 mt-2">Перенаправляємо в кабінет...</p>
          </div>
        )}
        
        {status === 'error' && <p className="text-red-500 font-medium">❌ {message}</p>}
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Завантаження...</div>}>
      <InviteContent />
    </Suspense>
  );
}