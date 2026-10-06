'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { authErrorText, passwordProblem } from '@/lib/auth-errors';
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
        if (err) throw new Error(authErrorText(err.message));
        await accept(data.session!.access_token);
      } else {
        const pwProblem = passwordProblem(password);
        if (pwProblem) throw new Error(pwProblem);
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
        if (err) throw new Error(authErrorText(err.message));
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

  // Людину запросили на конкретну пошту - підставляємо її одразу.
  useEffect(() => {
    if (info?.email && !email) setEmail(info.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info?.email]);

  // ---------- Оформлення ----------
  // У стилі сайту: шапка з логотипом, мʼяке тло матчі. Ліворуч - КУДИ
  // кличуть і що людина отримає, праворуч - вхід. Раніше це була гола
  // біла картка зі стандартними полями, не схожа на решту системи.
  const shell = (children: React.ReactNode, wide = false) => (
    <div className="inv-page">
      <header className="inv-header">
        <a href="/" className="inv-logo">Book<span>Era</span></a>
      </header>
      <main className={`inv-main ${wide ? 'wide' : ''}`}>{children}</main>
      <style>{`
        .inv-page { min-height: 100vh; font-family: inherit; color: #1D1D1F;
          background: radial-gradient(90% 60% at 15% 0%, #EAF1E9 0%, rgba(234,241,233,0) 60%), #FAFAFA; }
        .inv-header { height: 64px; display: flex; align-items: center; padding: 0 clamp(1.25rem, 4vw, 2.5rem); }
        .inv-logo { font-size: 1.3rem; font-weight: 800; letter-spacing: -0.03em; color: #1D1D1F; text-decoration: none; }
        .inv-logo span { color: #6F9273; }
        .inv-main { max-width: 440px; margin: 0 auto; padding: 3rem 1.25rem 4rem; }
        .inv-main.wide { max-width: 960px; display: grid; grid-template-columns: 1.05fr 1fr; gap: clamp(2rem, 5vw, 4.5rem); align-items: center; padding-top: clamp(1.5rem, 6vh, 4.5rem); }
        .inv-card { background: #fff; border-radius: 24px; padding: 2rem; box-shadow: 0 30px 70px -40px rgba(46,58,48,.35), 0 0 0 1px rgba(0,0,0,.04); }
        .inv-state { text-align: center; }
        .inv-state .inv-ico { width: 64px; height: 64px; margin: 0 auto 1.25rem; border-radius: 20px; display: flex; align-items: center; justify-content: center; }
        .inv-state h1 { font-size: 1.4rem; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 0.5rem; }
        .inv-state p { color: #6E6E73; line-height: 1.55; margin: 0 0 1.5rem; }
        .inv-logo-big { width: 72px; height: 72px; border-radius: 22px; background: #fff; box-shadow: 0 12px 30px -14px rgba(46,58,48,.35), 0 0 0 1px rgba(0,0,0,.04);
          display: flex; align-items: center; justify-content: center; font-size: 1.8rem; font-weight: 800; color: #6F9273; overflow: hidden; margin-bottom: 1.5rem; }
        .inv-logo-big img { width: 100%; height: 100%; object-fit: cover; }
        .inv-eyebrow { font-size: 0.875rem; font-weight: 600; color: #5C7A61; margin-bottom: 0.5rem; }
        .inv-hero h1 { font-size: clamp(2rem, 4vw, 2.75rem); font-weight: 700; letter-spacing: -0.035em; line-height: 1.08; margin: 0 0 1rem; }
        .inv-role { display: inline-flex; align-items: center; gap: 0.4rem; height: 30px; padding: 0 0.8rem; border-radius: 999px; background: #F4FAF5; color: #2E3A30; font-size: 0.85rem; font-weight: 600; margin-bottom: 1.75rem; }
        .inv-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.9rem; }
        .inv-list li { display: flex; gap: 0.75rem; align-items: flex-start; font-size: 0.975rem; line-height: 1.45; color: #3A3A3C; }
        .inv-list svg { flex-shrink: 0; margin-top: 2px; }
        .inv-seg { display: flex; background: #F5F5F7; border-radius: 12px; padding: 4px; margin-bottom: 1.5rem; }
        .inv-seg button { flex: 1; height: 36px; border: none; border-radius: 9px; background: transparent; color: #86868B; font-family: inherit; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: background-color .2s, color .2s, box-shadow .2s; }
        .inv-seg button.on { background: #fff; color: #1D1D1F; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
        .inv-label { display: block; font-size: 0.8125rem; font-weight: 600; color: #3A3A3C; margin: 0 0 0.4rem; }
        .inv-input { width: 100%; box-sizing: border-box; height: 48px; padding: 0 0.95rem; border-radius: 12px; border: 1px solid #E5E5EA; background: #fff;
          font-family: inherit; font-size: 0.975rem; color: #1D1D1F; outline: none; margin-bottom: 1rem; transition: border-color .2s, box-shadow .2s; }
        .inv-input:focus { border-color: #8FAE93; box-shadow: 0 0 0 4px rgba(143,174,147,.18); }
        .inv-btn { width: 100%; height: 50px; border-radius: 14px; border: none; background: #1D1D1F; color: #fff; font-family: inherit; font-size: 1rem; font-weight: 600; cursor: pointer; transition: background-color .2s, transform .15s; }
        .inv-btn:hover:not(:disabled) { background: #000; }
        .inv-btn:active:not(:disabled) { transform: scale(.99); }
        .inv-btn:disabled { opacity: .45; cursor: default; }
        .inv-btn.ghost { background: transparent; color: #6E6E73; height: 42px; font-size: 0.9rem; font-weight: 500; margin-top: 0.4rem; }
        .inv-btn.ghost:hover { background: #F5F5F7; }
        .inv-err { color: #B42318; font-size: 0.875rem; line-height: 1.45; margin: -0.25rem 0 1rem; }
        .inv-who { display: flex; align-items: center; gap: 0.75rem; padding: 0.9rem 1rem; border-radius: 14px; background: #F5F5F7; margin-bottom: 1.25rem; font-size: 0.9rem; color: #3A3A3C; }
        .inv-who b { color: #1D1D1F; word-break: break-all; }
        @media (max-width: 820px) {
          .inv-main.wide { grid-template-columns: 1fr; gap: 2rem; }
        }
      `}</style>
    </div>
  );

  const stateCard = (icon: 'wait' | 'ok' | 'mail' | 'warn', title: string, text: React.ReactNode, action?: React.ReactNode) => shell(
    <div className="inv-card inv-state">
      <div className="inv-ico" style={{ background: icon === 'ok' ? '#E4EEE3' : icon === 'warn' ? '#FBF6EC' : '#F5F5F7' }}>
        {icon === 'ok' && <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5C7A61" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
        {icon === 'mail' && <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1D1D1F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>}
        {icon === 'warn' && <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8A6516" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.01" /></svg>}
        {icon === 'wait' && <span style={{ width: 22, height: 22, borderRadius: '50%', border: '2.5px solid #D1D1D6', borderTopColor: '#1D1D1F', animation: 'invspin .7s linear infinite' }} />}
      </div>
      <h1>{title}</h1>
      <p>{text}</p>
      {action}
      <style>{`@keyframes invspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const home = <a href="/" className="inv-btn" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>На головну</a>;

  if (!token) return stateCard('warn', 'Посилання неповне', 'Попросіть власника закладу надіслати запрошення ще раз.', home);
  if (loadError) return stateCard('warn', 'Запрошення не знайдено', loadError, home);
  if (!info || sessionEmail === undefined) return stateCard('wait', 'Завантажуємо запрошення', 'Хвилинку…');

  if (info.status === 'expired') return stateCard('warn', 'Термін запрошення минув', 'Попросіть власника закладу надіслати нове - це займе хвилину.', home);
  if (info.status !== 'pending' && !done) return stateCard('warn', 'Запрошення вже використано', 'Якщо це були ви - просто увійдіть у кабінет.',
    <a href="/cabinet" className="inv-btn" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>Відкрити кабінет</a>);

  if (done) return stateCard('ok', `Ласкаво просимо в ${info.business_name || 'команду'}`, 'Відкриваємо ваш кабінет…');

  if (needsConfirm) return stateCard('mail', 'Підтвердіть пошту',
    <>Ми надіслали лист на <b>{email}</b>. Відкрийте посилання з нього - і повернетесь сюди, щоб прийняти запрошення.</>);

  const Check = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6F9273" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
  );

  return shell(
    <>
      {/* Куди кличуть - ще до входу */}
      <section className="inv-hero">
        <div className="inv-logo-big">
          {info.business_logo
            ? <img src={info.business_logo} alt="" />
            : (info.business_name || 'B').slice(0, 1).toUpperCase()}
        </div>
        <div className="inv-eyebrow">Запрошення в команду</div>
        <h1>{info.business_name || 'Заклад'} чекає на вас</h1>
        <div className="inv-role">Роль: {ROLE[info.role] || 'член команди'}</div>
        <ul className="inv-list">
          <li><Check /> Свій розклад і записи клієнтів - у календарі</li>
          <li><Check /> Скільки візитів, заробіток і рейтинг - у «Моїй роботі»</li>
          {info.role === 'admin'
            ? <li><Check /> Керування записами, клієнтами й послугами закладу</li>
            : <li><Check /> Нагадування про клієнтів - листом, без дзвінків</li>}
        </ul>
      </section>

      {/* Вхід */}
      <section className="inv-card">
        {sessionEmail ? (
          <>
            <div className="inv-who">
              <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#EEF1F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                {sessionEmail.slice(0, 1).toUpperCase()}
              </span>
              <span>Ви увійшли як <b>{sessionEmail}</b></span>
            </div>
            {error && <p className="inv-err">{error}</p>}
            <button className="inv-btn" disabled={busy} onClick={() => void acceptAsCurrent()}>
              {busy ? 'Приймаємо…' : 'Прийняти запрошення'}
            </button>
            <button className="inv-btn ghost" onClick={async () => { await supabase.auth.signOut(); setSessionEmail(null); }}>
              Це не мій акаунт
            </button>
          </>
        ) : (
          <form onSubmit={authAndAccept}>
            <div className="inv-seg" role="tablist">
              {(['signin', 'signup'] as const).map(m => (
                <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? 'on' : ''}
                  onClick={() => { setMode(m); setError(''); }}>
                  {m === 'signin' ? 'Увійти' : 'Створити акаунт'}
                </button>
              ))}
            </div>

            {mode === 'signup' && (
              <>
                <label className="inv-label" htmlFor="inv-name">Імʼя та прізвище</label>
                <input id="inv-name" className="inv-input" value={name} onChange={e => setName(e.target.value)} placeholder="Олена Коваль" autoComplete="name" required />
              </>
            )}
            <label className="inv-label" htmlFor="inv-email">Пошта</label>
            <input id="inv-email" className="inv-input" type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder={info.email || 'you@example.com'} autoComplete="email" required />
            <label className="inv-label" htmlFor="inv-pass">Пароль</label>
            <input id="inv-pass" className="inv-input" type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'Щонайменше 6 символів' : '••••••••'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required />

            {error && <p className="inv-err">{error}</p>}
            <button className="inv-btn" type="submit" disabled={busy}>
              {busy ? 'Хвилинку…' : mode === 'signin' ? 'Увійти й прийняти' : 'Створити акаунт і прийняти'}
            </button>
          </form>
        )}
      </section>
    </>,
    true,
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={null}>
      <InviteContent />
    </Suspense>
  );
}
