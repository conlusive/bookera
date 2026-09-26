'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';

/**
 * Прийняття запрошення в команду.
 *
 * Раніше сторінка стукала на захардкоджену адресу 127.0.0.1:8000, на
 * неіснуючий шлях /invites/accept і без входу - запрошення не працювало
 * від початку до кінця.
 *
 * Тепер:
 *   1. Показує, КУДИ кличуть - назву закладу й роль - ще до входу
 *   2. Хто вже увійшов - одна кнопка «Прийняти»
 *   3. Хто ні - входить або створює акаунт прямо тут, без переходів,
 *      і запрошення приймається одразу після цього
 */
type Info = { business_name: string | null; business_logo: string | null; role: string; email: string; status: string };

const ROLE: Record<string, string> = { master: 'майстер', admin: 'адміністратор' };

function InviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const supabase = useMemo(() => createClient(), []);

  const [info, setInfo] = useState<Info | null>(null);
  const [loadError, setLoadError] = useState('');
  const [sessionEmail, setSessionEmail] = useState<string | null | undefined>(undefined);

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const data: Info = await api.getInviteInfo(token);
        setInfo(data);
        setEmail(data.email || '');
      } catch (err: any) {
        setLoadError(err?.message || 'Запрошення не знайдено');
      }
      const { data: { session } } = await supabase.auth.getSession();
      setSessionEmail(session?.user?.email ?? null);
    })();
  }, [token, supabase]);

  const accept = async (accessToken: string) => {
    await api.acceptStaffInvite(accessToken, token!);
    try { localStorage.setItem('userRole', info?.role || 'master'); } catch { /* */ }
    setDone(true);
    setTimeout(() => router.push('/cabinet'), 1600);
  };

  const acceptAsCurrent = async () => {
    setBusy(true); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Увійдіть, щоб прийняти запрошення');
      await accept(session.access_token);
    } catch (err: any) {
      setError(err?.message || 'Не вдалося прийняти запрошення');
    } finally {
      setBusy(false);
    }
  };

  const authAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      if (mode === 'signin') {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) throw new Error(err.message === 'Invalid login credentials' ? 'Невірна пошта або пароль' : err.message);
        await accept(data.session!.access_token);
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
            // Після підтвердження пошти людина повертається сюди ж -
            // і приймає запрошення одним натисканням.
            emailRedirectTo: typeof window !== 'undefined' ? window.location.href : undefined,
          },
        });
        if (err) throw new Error(err.message);
        if (!data.session) {
          // Supabase вимагає підтвердити пошту - сесії ще немає.
          setNeedsConfirm(true);
          return;
        }
        await accept(data.session.access_token);
      }
    } catch (err: any) {
      setError(err?.message || 'Щось пішло не так');
    } finally {
      setBusy(false);
    }
  };

  const card = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', background: '#F5F5F7', fontFamily: 'inherit' }}>
      <div style={{ width: '100%', maxWidth: '420px', background: '#fff', borderRadius: '24px', padding: '2rem', boxShadow: '0 30px 60px -30px rgba(0,0,0,.2)' }}>
        {children}
      </div>
    </div>
  );

  const field: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', height: '46px', padding: '0 0.9rem', borderRadius: '12px',
    border: '1px solid #E5E5EA', fontFamily: 'inherit', fontSize: '0.95rem', outline: 'none', marginBottom: '0.6rem',
  };
  const primary: React.CSSProperties = {
    width: '100%', height: '48px', borderRadius: '12px', border: 'none', background: '#1D1D1F', color: '#fff',
    fontFamily: 'inherit', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.5 : 1,
  };

  if (!token) return card(<p style={{ color: '#86868B', margin: 0 }}>Посилання неповне - попросіть власника надіслати його ще раз.</p>);
  if (loadError) return card(<><h1 style={{ fontSize: '1.3rem', margin: '0 0 0.5rem' }}>Запрошення не знайдено</h1><p style={{ color: '#86868B', margin: 0 }}>Можливо, його скасували. Попросіть власника закладу надіслати нове.</p></>);
  if (!info || sessionEmail === undefined) return card(<p style={{ color: '#86868B', margin: 0 }}>Завантаження…</p>);

  if (info.status === 'expired') return card(<><h1 style={{ fontSize: '1.3rem', margin: '0 0 0.5rem' }}>Термін запрошення минув</h1><p style={{ color: '#86868B', margin: 0 }}>Попросіть {info.business_name || 'власника'} надіслати нове - воно діятиме ще 7 днів.</p></>);
  if (info.status !== 'pending' && !done) return card(<><h1 style={{ fontSize: '1.3rem', margin: '0 0 0.5rem' }}>Запрошення вже використано</h1><p style={{ color: '#86868B', margin: '0 0 1.2rem' }}>Якщо це були ви - відкрийте кабінет.</p><button style={primary} onClick={() => router.push('/cabinet')}>Відкрити кабінет</button></>);

  if (done) return card(<><h1 style={{ fontSize: '1.3rem', margin: '0 0 0.5rem' }}>Ласкаво просимо в команду</h1><p style={{ color: '#86868B', margin: 0 }}>Відкриваємо кабінет {info.business_name}…</p></>);

  if (needsConfirm) return card(<><h1 style={{ fontSize: '1.3rem', margin: '0 0 0.5rem' }}>Підтвердіть пошту</h1><p style={{ color: '#3A3A3C', lineHeight: 1.55, margin: 0 }}>Ми надіслали лист на <b>{email}</b>. Натисніть посилання в ньому - ви повернетесь сюди й приймете запрошення одним натисканням.</p></>);

  return card(
    <>
      <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#EEF1F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.2rem', marginBottom: '1.1rem' }}>
        {(info.business_name || 'B').slice(0, 1).toUpperCase()}
      </div>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 0.4rem', color: '#1D1D1F' }}>
        {info.business_name} запрошує вас у команду
      </h1>
      <p style={{ color: '#86868B', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
        Роль - {ROLE[info.role] || 'член команди'}. Ви бачитимете свій розклад і записи клієнтів.
      </p>

      {sessionEmail ? (
        <>
          <p style={{ fontSize: '0.875rem', color: '#6E6E73', margin: '0 0 0.9rem' }}>Ви увійшли як <b>{sessionEmail}</b></p>
          <button style={primary} disabled={busy} onClick={() => void acceptAsCurrent()}>
            {busy ? 'Приймаємо…' : 'Прийняти запрошення'}
          </button>
          <button
            onClick={async () => { await supabase.auth.signOut(); setSessionEmail(null); }}
            style={{ width: '100%', marginTop: '0.6rem', height: '40px', border: 'none', background: 'none', color: '#6E6E73', fontFamily: 'inherit', fontSize: '0.875rem', cursor: 'pointer' }}
          >
            Це не мій акаунт
          </button>
        </>
      ) : (
        <form onSubmit={authAndAccept}>
          <div style={{ display: 'flex', background: '#F5F5F7', borderRadius: '10px', padding: '3px', marginBottom: '1rem' }}>
            {(['signin', 'signup'] as const).map(m => (
              <button key={m} type="button" onClick={() => { setMode(m); setError(''); }}
                style={{ flex: 1, height: '34px', border: 'none', borderRadius: '8px', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                  background: mode === m ? '#fff' : 'transparent', color: mode === m ? '#1D1D1F' : '#86868B',
                  boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,.08)' : 'none' }}>
                {m === 'signin' ? 'Увійти' : 'Створити акаунт'}
              </button>
            ))}
          </div>
          {mode === 'signup' && (
            <input style={field} value={name} onChange={e => setName(e.target.value)} placeholder="Ваше імʼя" required />
          )}
          <input style={field} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Пошта" required />
          <input style={field} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'signup' ? 'Пароль (від 6 символів)' : 'Пароль'} minLength={6} required />
          {error && <p style={{ color: '#B42318', fontSize: '0.85rem', margin: '0.2rem 0 0.8rem' }}>{error}</p>}
          <button style={primary} type="submit" disabled={busy}>
            {busy ? 'Хвилинку…' : mode === 'signin' ? 'Увійти й прийняти' : 'Створити й прийняти'}
          </button>
        </form>
      )}
      {error && sessionEmail && <p style={{ color: '#B42318', fontSize: '0.85rem', margin: '0.8rem 0 0' }}>{error}</p>}
    </>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={null}>
      <InviteContent />
    </Suspense>
  );
}
