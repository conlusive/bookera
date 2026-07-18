'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

const categoriesData = [
  { name: 'Волосся', slug: 'hair-salon' },
  { name: 'Барбер', slug: 'barber-shop' },
  { name: 'Нігті', slug: 'nail-salon' },
  { name: 'Догляд за шкірою', slug: 'skin-care' },
  { name: 'Брови та вії', slug: 'brows-lashes' },
  { name: 'Масаж', slug: 'massage' },
  { name: 'Макіяж', slug: 'makeup' },
  { name: 'Wellness & Spa', slug: 'wellness-day-spa' }
];

const topCities = [
  'Київ', 'Львів', 'Одеса', 'Дніпро',
  'Харків', 'Івано-Франківськ', 'Вінниця', 'Тернопіль',
  'Ужгород', 'Хмельницький', 'Чернівці', 'Рівне',
  'Полтава', 'Черкаси', 'Луцьк', 'Житомир'
];

export default function BusinessLandingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [scrolled, setScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLoginView, setIsLoginView] = useState(true);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');

  const [userName, setUserName] = useState<string | null>(null);
  const [initials, setInitials] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('client');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const storedName = localStorage.getItem('userName');
      const storedRole = localStorage.getItem('userRole') || 'client';
      if (storedName) {
        setIsLoggedIn(true);
        setUserName(storedName);
        setUserRole(storedRole);
        const nameParts = storedName.split(' ');
        const init = nameParts.length > 1 ? nameParts[0][0] + nameParts[1][0] : nameParts[0][0];
        setInitials(init.toUpperCase());
      }
    }

    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    }, { threshold: 0.15 });

    setTimeout(() => {
      document.querySelectorAll('.reveal-on-scroll').forEach(el => observer.observe(el));
    }, 100);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setIsProfileOpen(false);
    };
    const handleScrollClose = () => {
      if (isProfileOpen) setIsProfileOpen(false);
    };

    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScrollClose, { passive: true });
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollClose);
    };
  }, [isProfileOpen]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');
    setIsLoggedIn(false);
    setIsProfileOpen(false);
    setUserName(null);
    setUserRole('client');
    router.refresh();
  };

  const handleModalAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLoginView) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password: loginPassword,
        });

        if (error) {
          alert(`Помилка входу: ${error.message}`);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', data.user.id)
          .single();

        const finalName = profile?.full_name || data.user.email || 'Користувач';
        const finalRole = profile?.role || 'client';

        localStorage.setItem('userName', finalName);
        localStorage.setItem('userRole', finalRole);
        localStorage.setItem('userId', data.user.id);

        setUserName(finalName);
        setUserRole(finalRole);
        const nameParts = finalName.split(' ');
        const init = nameParts.length > 1 ? nameParts[0][0] + nameParts[1][0] : nameParts[0][0];
        setInitials(init.toUpperCase());

        setIsLoggedIn(true);
        setIsAuthModalOpen(false);

        if (finalRole === 'vendor') {
          router.push('/cabinet');
        } else {
          router.push('/business/register');
        }
      } else {
        const targetEmail = loginEmail.trim().toLowerCase();
        const targetFullName = `${regFirstName} ${regLastName}`.trim();

        // ВИПРАВЛЕНО: Реєстрація працює без зовнішнього файлу actions.ts
        const { data, error } = await supabase.auth.signUp({
          email: targetEmail,
          password: loginPassword,
          options: {
            data: {
              full_name: targetFullName
            }
          }
        });

        if (error) {
          alert(`Помилка реєстрації: ${error.message}`);
          return;
        }

        localStorage.setItem('userName', targetFullName);
        localStorage.setItem('userRole', 'client');
        if (data?.session?.user) {
          localStorage.setItem('userId', data.session.user.id);
        }

        setUserName(targetFullName);
        setUserRole('client');
        setInitials((regFirstName[0] + (regLastName[0] || '')).toUpperCase());

        setIsLoggedIn(true);
        setIsAuthModalOpen(false);
        router.push('/business/register');
      }
    } catch (error) {
      alert("Відбулася непередбачувана помилка при з'єднанні з сервером.");
    }
  };

  const handleStartBusinessClick = () => {
    if (userRole === 'vendor') {
      router.push('/cabinet');
    } else if (isLoggedIn) {
      router.push('/business/register');
    } else {
      setIsLoginView(false);
      setIsAuthModalOpen(true);
    }
  };

  if (!mounted) return null;

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#222222', overflowX: 'hidden' }}>

      <style>{`
        .container { max-width: 1340px; margin: 0 auto; padding: 0 4rem; width: 100%; box-sizing: border-box; }
        .anim { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); }
        
        .btn-theme { background-color: #C2D8C4 !important; color: #222222 !important; font-weight: 750; border: none; cursor: pointer; }
        .btn-theme:hover { background-color: #AECAB0 !important; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(194, 216, 196, 0.4); }
        .btn-dark { background-color: #222222 !important; color: #ffffff !important; font-weight: 750; border: none; cursor: pointer; }
        .btn-dark:hover { background-color: #0f172a !important; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2); }
        
        .footer-link { color: #94a3b8; text-decoration: none; font-size: 0.9rem; transition: 0.2s; }
        .footer-link:hover { color: #ffffff; }

        .modal-input { width: 100%; padding: 0.85rem 1rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem; box-sizing: border-box; margin-bottom: 1rem; transition: 0.2s; }
        .modal-input:focus { outline: none; border-color: #222222; box-shadow: 0 0 0 3px rgba(34, 34, 34, 0.1); }
        .social-btn { display: flex; align-items: center; justify-content: center; gap: 0.75rem; width: 100%; padding: 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; font-weight: 600; color: #222222; cursor: pointer; margin-bottom: 0.75rem; transition: 0.2s; }
        .social-btn:hover { background: #f8fafc; }

        .profile-menu-container { position: absolute; top: 150%; right: 0; width: 230px; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(16px); border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); padding: 0.5rem; z-index: 1001; border: 1px solid rgba(0, 0, 0, 0.05); }
        .profile-menu-item { display: block; width: 100%; text-align: left; padding: 0.75rem 1rem; border-radius: 8px; color: #334155; text-decoration: none; font-size: 0.9rem; font-weight: 500; transition: all 0.2s ease; background: transparent; border: none; cursor: pointer; }
        .profile-menu-item:hover { background-color: rgba(34, 34, 34, 0.05); color: #222222; }
        .profile-menu-logout { color: #ef4444; border-top: 1px solid rgba(0,0,0,0.05); border-radius: 0 0 8px 8px; margin-top: 4px; padding-top: 0.85rem; }
        .profile-menu-logout:hover { background-color: rgba(239, 68, 68, 0.08); color: #dc2626; }
        .profile-trigger { cursor: pointer; display: flex; align-items: center; gap: 0.6rem; user-select: none; padding: 0.3rem; border-radius: 20px; transition: 0.2s; }

        .reveal-on-scroll { opacity: 0; transform: translateY(40px); transition: opacity 0.8s ease-out, transform 0.8s cubic-bezier(0.25, 0.8, 0.25, 1); }
        .reveal-on-scroll.slide-left { transform: translateX(50px); }
        .reveal-on-scroll.slide-right { transform: translateX(-50px); }
        .reveal-on-scroll.is-visible { opacity: 1; transform: translate(0, 0); }
        
        .delay-100 { transition-delay: 100ms; }
        .delay-200 { transition-delay: 200ms; }

        .info-section { padding: 8rem 0; overflow: hidden; position: relative; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: center; position: relative; z-index: 10; }
        
        .info-title { font-size: 3.5rem; font-weight: 900; color: #222222; line-height: 1.1; margin-bottom: 1.5rem; letter-spacing: -0.03em; }
        .info-title-highlight { color: #8fae92; }
        .info-desc { color: #64748b; font-size: 1.15rem; line-height: 1.6; margin-bottom: 2rem; font-weight: 400; max-width: 480px; }
        .feature-check { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.2rem; color: #334155; font-weight: 600; font-size: 1.1rem; }

        @keyframes morphBlob {
          0% { border-radius: 40% 60% 30% 70% / 50% 50% 50% 50%; }
          100% { border-radius: 50% 50% 60% 40% / 40% 60% 40% 60%; }
        }
        @keyframes float1 { 0% { transform: translate(0, 0) rotate(0deg); } 50% { transform: translate(15px, -15px) rotate(5deg); } 100% { transform: translate(0, 0) rotate(0deg); } }
        @keyframes float2 { 0% { transform: translate(0, 0) rotate(0deg); } 50% { transform: translate(-10px, 20px) rotate(-5deg); } 100% { transform: translate(0, 0) rotate(0deg); } }
        @keyframes floatItem { 0% { transform: translateY(0px); } 50% { transform: translateY(-15px); } 100% { transform: translateY(0px); } }
        @keyframes float-widget { 0% { transform: translateY(0px); } 50% { transform: translateY(-12px); } 100% { transform: translateY(0px); } }

        .hero-blob-light { position: absolute; left: -5%; top: 5%; width: 50%; height: 90%; background: #C2D8C4; border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; opacity: 0.3; z-index: 0; animation: morphBlob 20s ease-in-out infinite alternate-reverse; }
        .hero-blob-dark { position: absolute; right: -5%; top: 5%; width: 48%; height: 90%; background: #222222; border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%; z-index: 1; animation: morphBlob 15s ease-in-out infinite alternate; }

        .geo-shape-1 { position: absolute; width: 320px; height: 320px; background: #C2D8C4; border-radius: 50% 50% 50% 0; z-index: 1; opacity: 0.7; animation: float1 8s ease-in-out infinite; }
        .geo-shape-2 { position: absolute; width: 220px; height: 220px; background: #fef08a; border-radius: 50%; z-index: 2; opacity: 0.8; animation: float2 10s ease-in-out infinite alternate; }
        .geo-shape-3 { position: absolute; width: 280px; height: 400px; background: #222222; border-radius: 140px; z-index: 1; animation: float1 12s ease-in-out infinite reverse; }
        
        .geo-circle-img { position: absolute; z-index: 5; border-radius: 50%; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.15); animation: floatItem 8s ease-in-out infinite; border: 8px solid #ffffff; }

        .floating-widget { 
          position: absolute; z-index: 10; 
          background: rgba(255, 255, 255, 0.95); 
          backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
          padding: 1rem 1.5rem; 
          border-radius: 100px; 
          box-shadow: 0 15px 35px rgba(0,0,0,0.08); 
          display: flex; align-items: center; gap: 1rem; 
          border: 1px solid rgba(255, 255, 255, 1); 
          animation: float-widget 6s ease-in-out infinite;
        }
        .floating-widget.dark { background: rgba(34, 34, 34, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); color: #fff; }
      `}</style>

      {/* МОДАЛКА ЛОГІНУ/РЕЄСТРАЦІЇ */}
      {isAuthModalOpen && (
        <div onClick={() => setIsAuthModalOpen(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div onClick={(e) => e.stopPropagation()} className="anim" style={{ backgroundColor: '#ffffff', width: '100%', maxWidth: '440px', borderRadius: '16px', padding: '2.5rem', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <button onClick={() => { setIsAuthModalOpen(false); setIsLoginView(true); }} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', fontSize: '1.5rem', color: '#64748b', cursor: 'pointer' }}>×</button>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', textAlign: 'center', marginBottom: '0.5rem', color: '#222222' }}>{isLoginView ? 'Почати' : 'Створити акаунт'}</h2>
            <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.95rem', marginBottom: '2rem' }}>{isLoginView ? 'Увійдіть або створіть акаунт для керування візитами.' : 'Заповніть дані для реєстрації на платформі.'}</p>
            <form onSubmit={handleModalAuth}>
              {!isLoginView && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <input type="text" placeholder="Ім'я" value={regFirstName} onChange={(e) => setRegFirstName(e.target.value)} className="modal-input" style={{ marginBottom: 0 }} required />
                  <input type="text" placeholder="Прізвище" value={regLastName} onChange={(e) => setRegLastName(e.target.value)} className="modal-input" style={{ marginBottom: 0 }} required />
                </div>
              )}
              <input type="email" placeholder="Email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="modal-input" required />
              <input type="password" placeholder="Пароль" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="modal-input" required />
              <button type="submit" style={{ width: '100%', padding: '1rem', backgroundColor: '#222222', color: '#fff', borderRadius: '8px', fontWeight: '700', border: 'none', cursor: 'pointer', marginBottom: '1.5rem', fontSize: '1rem', transition: '0.2s' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='#1a1a1a'} onMouseOut={e=>e.currentTarget.style.backgroundColor='#222222'}>{isLoginView ? 'Продовжити' : 'Зареєструватись'}</button>
            </form>
            <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0', color: '#94a3b8', fontSize: '0.85rem' }}><div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }}></div><span style={{ padding: '0 1rem' }}>АБО</span><div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }}></div></div>
            <button className="social-btn" onClick={() => alert('Ця функція з\'явиться пізніше')}>Продовжити з Google</button>
            <button className="social-btn" onClick={() => alert('Ця функція з\'явиться пізніше')}>Продовжити з Apple</button>
            <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#64748b', marginTop: '1.5rem' }}>{isLoginView ? (<>Немає акаунту? <span onClick={() => setIsLoginView(false)} style={{ color: '#222222', fontWeight: '700', cursor: 'pointer' }}>Зареєструватись</span></>) : (<>Вже маєте акаунт? <span onClick={() => setIsLoginView(true)} style={{ color: '#222222', fontWeight: '700', cursor: 'pointer' }}>Увійти</span></>)}</p>
          </div>
        </div>
      )}

      {/* 1. БІЗНЕС ХЕДЕР */}
      <header className="anim" style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '72px',
        backgroundColor: scrolled ? 'rgba(255, 255, 255, 0.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(10px)' : 'none',
        borderBottom: scrolled ? '1px solid #f1f5f9' : 'none',
        zIndex: 1000,
        boxShadow: scrolled ? '0 10px 30px rgba(0,0,0,0.05)' : 'none'
      }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '100%' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '3rem' }}>
            <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '1.6rem', fontWeight: '900', color: '#222222', letterSpacing: '-0.04em', lineHeight: 1 }}>
                Book<span style={{ color: '#8fae92' }}>Era</span>
              </span>
              <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '700', lineHeight: 1 }}>Business</span>
            </Link>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}>
            <Link href="/" className="anim" style={{
              color: '#222222',
              textDecoration: 'none',
              transition: 'color 0.3s ease',
              fontWeight: '600',
              fontSize: '0.95rem'
            }}>Для клієнтів</Link>

            {isLoggedIn ? (
              <div style={{ position: 'relative' }} ref={profileRef}>
                <div onClick={() => setIsProfileOpen(!isProfileOpen)} className="profile-trigger">
                  <span style={{
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    color: '#222222',
                    transition: 'color 0.3s ease'
                  }}>{userName}</span>
                  <div style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: '#C2D8C4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#222222', fontWeight: '800', fontSize: '0.85rem' }}>
                    {initials}
                  </div>
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: isProfileOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease, stroke 0.3s ease' }}>
                    <path d="M1 1L5 5L9 1" stroke="#222222" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>

                {isProfileOpen && (
                  <div className="anim profile-menu-container">
                    <div style={{ padding: '0.5rem 1rem 0.75rem 1rem', borderBottom: '1px solid rgba(0,0,0,0.05)', marginBottom: '0.5rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Акаунт</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#222222', marginTop: '2px' }}>{userName}</div>
                    </div>
                    <Link href="/profile" className="profile-menu-item" onClick={() => setIsProfileOpen(false)}>Мій профіль</Link>
                    {userRole === 'vendor' && (
                      <Link href="/cabinet" className="profile-menu-item" onClick={() => setIsProfileOpen(false)}>Бізнес-кабінет</Link>
                    )}
                    <Link href="/settings" className="profile-menu-item" onClick={() => setIsProfileOpen(false)}>Налаштування</Link>
                    <button onClick={handleLogout} className="profile-menu-item profile-menu-logout">Вийти з акаунту</button>
                  </div>
                )}
              </div>
            ) : (
              <span onClick={() => { setIsLoginView(true); setIsAuthModalOpen(true); }} className="anim" style={{
                cursor: 'pointer',
                color: scrolled ? '#222222' : '#8fae92',
                fontWeight: '600',
                fontSize: '0.95rem',
                transition: 'color 0.3s ease'
              }}>Увійти / Зареєструватись</span>
            )}
          </div>

        </div>
      </header>

      {/* ОБ'ЄДНАНИЙ КОНТЕЙНЕР ДЛЯ ФІГУР ТА СТАТИСТИКИ */}
      <div style={{ position: 'relative', overflow: 'hidden', backgroundColor: '#f8fafc' }}>

        <div className="hero-blob-light"></div>
        <div className="hero-blob-dark"></div>

        {/* HERO SECTION */}
        <section style={{ position: 'relative', width: '100%', minHeight: '85vh', display: 'flex', alignItems: 'center' }}>
          <div className="container" style={{ position: 'relative', zIndex: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center', paddingTop: '80px' }}>

            <div className="reveal-on-scroll">
              <div style={{ display: 'inline-block', border: '1px solid #cbd5e1', color: '#64748b', padding: '0.4rem 1.2rem', borderRadius: '30px', fontSize: '0.75rem', fontWeight: '800', letterSpacing: '0.08em', marginBottom: '1.5rem', textTransform: 'uppercase', backgroundColor: '#ffffff' }}>
                Платформа для бізнесу
              </div>

              <h1 style={{ fontSize: '4rem', fontWeight: '900', color: '#222222', lineHeight: '1.1', marginBottom: '1.5rem', letterSpacing: '-0.03em' }}>
                Сучасне рішення <br/>для <span style={{ color: '#8fae92' }}>вашого</span> бізнесу
              </h1>

              <p style={{ color: '#64748b', fontSize: '1.15rem', lineHeight: '1.6', marginBottom: '2.5rem', fontWeight: '400', maxWidth: '500px' }}>
                BookEra Business — це екосистема для власників салонів та приватних майстрів. Залучайте нових клієнтів, керуйте розкладом та ведіть фінансову аналітику.
              </p>

              <button onClick={handleStartBusinessClick} className="btn-dark anim" style={{ padding: '1.2rem 3rem', borderRadius: '12px', fontSize: '1.05rem', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)' }}>
                {userRole === 'vendor' ? 'Перейти в панель керування' : isLoggedIn ? 'Відкрити свій бізнес' : 'Створити профіль'}
              </button>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '1.25rem', fontWeight: '500' }}>
                Не потрібна кредитна картка. 14 днів безкоштовного тестування.
              </p>
            </div>

            <div className="reveal-on-scroll delay-200" style={{ position: 'relative', height: '550px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

              <div className="geo-circle-img" style={{ width: '280px', height: '280px', right: '15%', top: '5%', animationDelay: '0s' }}>
                <img src="https://images.unsplash.com/photo-1580618672591-eb180b1a973f?q=80&w=600&auto=format&fit=crop" alt="Barber" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>

              <div className="geo-circle-img" style={{ width: '220px', height: '220px', left: '10%', bottom: '15%', animationDelay: '1s' }}>
                <img src="https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=600&auto=format&fit=crop" alt="Manicure" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>

              <div className="geo-circle-img" style={{ width: '150px', height: '150px', right: '5%', bottom: '30%', animationDelay: '2s' }}>
                <img src="https://images.unsplash.com/photo-1544161515-4ab6ce6db874?q=80&w=400&auto=format&fit=crop" alt="Spa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>

              <div className="floating-widget dark" style={{ top: '25%', left: '0%', animationDelay: '0.5s' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                  <img src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200&auto=format&fit=crop" alt="User" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#fff', lineHeight: '1.2' }}>Аліна, Beauty Studio</span>
                  <span style={{ fontSize: '0.75rem', color: '#C2D8C4' }}>Новий запис 💅</span>
                </div>
              </div>

              <div className="floating-widget" style={{ bottom: '10%', right: '25%', padding: '0.8rem 1.5rem', animationDelay: '1.5s' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#222' }}>+40%</span>
                <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#64748b' }}>клієнтів</span>
              </div>

              <div className="floating-widget" style={{ top: '10%', right: '0%', padding: '0.6rem 1.2rem', animationDelay: '2.5s' }}>
                <span style={{ color: '#facc15', fontSize: '1rem', letterSpacing: '2px' }}>★★★★★</span>
                <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#222' }}>5.0</span>
              </div>

            </div>
          </div>
        </section>

        <section className="reveal-on-scroll delay-100" style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #f1f5f9', padding: '4rem 0', position: 'relative', zIndex: 20 }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', textAlign: 'center' }}>
              <div><div style={{ fontSize: '3rem', fontWeight: '900', color: '#222222', marginBottom: '0.2rem', letterSpacing: '-0.03em' }}>24/7</div><div style={{ color: '#64748b', fontWeight: '600', fontSize: '0.95rem' }}>Доступність для запису клієнтів</div></div>
              <div><div style={{ fontSize: '3rem', fontWeight: '900', color: '#222222', marginBottom: '0.2rem', letterSpacing: '-0.03em' }}>-40%</div><div style={{ color: '#64748b', fontWeight: '600', fontSize: '0.95rem' }}>Зменшення неявок (No-shows)</div></div>
              <div><div style={{ fontSize: '3rem', fontWeight: '900', color: '#222222', marginBottom: '0.2rem', letterSpacing: '-0.03em' }}>+25%</div><div style={{ color: '#64748b', fontWeight: '600', fontSize: '0.95rem' }}>Зростання кількості нових клієнтів</div></div>
            </div>
          </div>
        </section>

      </div>

      {/* 4. ОРГАНІЧНІ БЛОКИ */}
      <section style={{ overflow: 'hidden' }}>
        <div className="container">

          <div className="info-grid" style={{ padding: '8rem 0' }}>
            <div className="reveal-on-scroll slide-right" style={{ position: 'relative', height: '450px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

              <div className="geo-shape-1" style={{ background: '#C2D8C4', width: '350px', height: '350px', right: '10%' }}></div>
              <div style={{ position: 'absolute', width: '180px', height: '180px', background: '#222222', borderRadius: '50%', left: '15%', bottom: '15%', zIndex: 2, animation: 'floatItem 6s ease-in-out infinite' }}></div>

              <div className="floating-widget" style={{ bottom: '20%', left: '5%', zIndex: 10, animationDelay: '0.5s' }}>
                <span style={{ fontSize: '1.5rem' }}>📅</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: '800', color: '#222' }}>Синхронізація</span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Google Calendar</span>
                </div>
              </div>

              <div className="floating-widget" style={{ top: '15%', right: '5%', padding: '0.8rem 1.2rem', animationDelay: '1.5s', zIndex: 10 }}>
                <div style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '50%', boxShadow: '0 0 8px rgba(16,185,129,0.5)' }}></div>
                <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#222' }}>Вільне вікно на 14:30</span>
              </div>

            </div>

            <div className="reveal-on-scroll delay-100">
              <h2 className="info-title">Заповнений календар <br/>без зайвих дзвінків</h2>
              <p className="info-desc">Ваш бізнес працює навіть коли ви спите. Дозвольте клієнтам бачити ваш вільний час та записуватись самостійно 24 години на добу, 7 днів на тиждень.</p>

              <div style={{ marginTop: '2rem' }}>
                <div className="feature-check"><span style={{ color: '#C2D8C4', fontSize: '1.5rem', fontWeight: '900' }}>✓</span> Професійна сторінка запису</div>
                <div className="feature-check"><span style={{ color: '#C2D8C4', fontSize: '1.5rem', fontWeight: '900' }}>✓</span> Інтеграція з Instagram та Google</div>
                <div className="feature-check"><span style={{ color: '#C2D8C4', fontSize: '1.5rem', fontWeight: '900' }}>✓</span> Автоматичні нагадування клієнтам</div>
              </div>
            </div>
          </div>

          <div className="info-grid" style={{ borderTop: '1px solid #f1f5f9', padding: '8rem 0' }}>
            <div className="reveal-on-scroll">
              <h2 className="info-title">Захистіть свій час <br/>та дохід від неявок</h2>
              <p className="info-desc">Клієнти забувають про візит? Налаштуйте правила скасування та беріть передоплату. BookEra бере на себе всю неприємну роботу з гарантії вашого доходу.</p>

              <div style={{ marginTop: '2rem' }}>
                <div className="feature-check"><span style={{ color: '#C2D8C4', fontSize: '1.5rem', fontWeight: '900' }}>✓</span> Правила скасування бронювань</div>
                <div className="feature-check"><span style={{ color: '#C2D8C4', fontSize: '1.5rem', fontWeight: '900' }}>✓</span> Безпечні онлайн-платежі</div>
                <div className="feature-check"><span style={{ color: '#C2D8C4', fontSize: '1.5rem', fontWeight: '900' }}>✓</span> Чорний список проблемних клієнтів</div>
              </div>
            </div>

            <div className="reveal-on-scroll slide-left delay-100" style={{ position: 'relative', height: '450px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

              <div className="geo-shape-3" style={{ background: '#222222', width: '280px', height: '400px', left: '10%' }}></div>
              <div style={{ position: 'absolute', width: '200px', height: '200px', background: '#fef08a', borderRadius: '50%', right: '20%', top: '20%', zIndex: 2, animation: 'floatItem 7s ease-in-out infinite' }}></div>

              <div className="floating-widget" style={{ top: '25%', right: '5%', zIndex: 10, animationDelay: '1.5s' }}>
                <div style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '50%', boxShadow: '0 0 10px rgba(239,68,68,0.5)' }}></div>
                <span style={{ fontSize: '0.95rem', fontWeight: '800', color: '#222' }}>Скасування заборонено</span>
              </div>

              <div className="floating-widget" style={{ bottom: '15%', left: '10%', zIndex: 10, animationDelay: '0.5s' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#C2D8C4' }}>₴</span>
                <span style={{ fontSize: '0.95rem', fontWeight: '800', color: '#222' }}>Передоплата 50%</span>
              </div>

              <div className="floating-widget" style={{ top: '5%', left: '20%', padding: '0.6rem 1rem', zIndex: 10, animationDelay: '2.5s' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><polyline points="16 21 21 21 21 16"></polyline></svg>
                <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#64748b' }}>Перенести</span>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* 5. ФІНАЛЬНИЙ ЗАКЛИК ДО ДІЇ */}
      <section className="reveal-on-scroll" style={{ backgroundColor: '#222222', padding: '8rem 0', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: '600px', height: '600px', background: '#C2D8C4', borderRadius: '50%', top: '-300px', left: '50%', transform: 'translateX(-50%)', opacity: 0.1, filter: 'blur(80px)' }}></div>
        <div className="container" style={{ position: 'relative', zIndex: 10 }}>
          <h2 style={{ fontSize: '3rem', fontWeight: '900', color: '#ffffff', marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>Готові вивести бізнес на новий рівень?</h2>
          <p style={{ color: '#cbd5e1', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto 2.5rem auto', lineHeight: '1.6' }}>Приєднуйтесь до платформи BookEra Business. Усі функції включено. Жодних прихованих платежів чи сюрпризів.</p>

          <button onClick={handleStartBusinessClick} className="btn-theme anim" style={{ padding: '1.2rem 3.5rem', borderRadius: '12px', fontSize: '1.1rem', boxShadow: '0 10px 30px rgba(194, 216, 196, 0.15)' }}>
            {userRole === 'vendor' ? 'Перейти в панель керування' : isLoggedIn ? 'Відкрити свій бізнес' : 'Створити кабінет компанії'}
          </button>
        </div>
      </section>

      {/* 6. ФУТЕР */}
      <footer style={{ backgroundColor: '#1a1a1a', borderTop: '1px solid #333333', padding: '4rem 0 3rem 0' }}>
        <div className="container">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', borderBottom: '1px solid #333333', paddingBottom: '3rem', marginBottom: '2rem' }}>
            <div style={{ flex: 1, display: 'flex', gap: '4rem' }}>
              <Link href="#" className="footer-link anim">Блог</Link>
              <Link href="#" className="footer-link anim">Про нас</Link>
              <Link href="#" className="footer-link anim">Поширені запитання</Link>
              <Link href="#" className="footer-link anim">Політика конфіденційності</Link>
              <Link href="#" className="footer-link anim">Умови використання</Link>
              <Link href="#" className="footer-link anim">Кар'єра</Link>
              <Link href={userRole === 'vendor' ? "/cabinet" : "/business"} className="footer-link anim" style={{ color: '#C2D8C4', fontWeight: '700' }}>BookEra Business</Link>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#C2D8C4' }}>Book<span style={{ color: '#fff' }}>Era</span></div>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>© 2026 BookEra Inc. Усі права захищено.</span>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
               <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #475569', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}>IG</div>
               <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid #475569', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}>FB</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}