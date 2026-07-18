'use client';

import { useState, useEffect, useRef } from 'react';
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

export default function HomePage() {
  const supabase = createClient();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [scrollState, setScrollState] = useState('top');
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
  const carouselRef = useRef<HTMLDivElement>(null);

  const [searchWhat, setSearchWhat] = useState('');
  const [searchWhere, setSearchWhere] = useState('Львів');

  useEffect(() => {
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

    const handleScroll = () => {
      const y = window.scrollY;
      if (y < 50) setScrollState('top');
      else if (y >= 50 && y < 500) setScrollState('hidden');
      else setScrollState('scrolled');
    };

    window.addEventListener('scroll', handleScroll);
    loadBusinesses();

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

  const loadBusinesses = async () => {
    try {
      const { data, error } = await supabase.from('businesses').select('*');
      if (error) throw error;
      if (data) {
        const sortedData = data.sort((a, b) => {
          const rankA = parseFloat(a.reviews_rank) || 0;
          const rankB = parseFloat(b.reviews_rank) || 0;
          if (rankB !== rankA) return rankB - rankA;
          else {
            const countA = parseInt(a.reviews_count) || 0;
            const countB = parseInt(b.reviews_count) || 0;
            return countB - countA;
          }
        });
        setBusinesses(sortedData.slice(0, 15));
      }
    } catch (error) {
      console.error("Помилка завантаження закладів:", error);
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  };

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = 324;
      carouselRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');
    setIsLoggedIn(false);
    setIsProfileOpen(false);
    setUserName(null);
    setUserRole('client');
  };

  const handleModalAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newName = isLoginView ? 'Діма Кора' : `${regFirstName} ${regLastName}`;
      const newRole = isLoginView ? 'vendor' : 'client';
      localStorage.setItem('userName', newName);
      localStorage.setItem('userId', '1');
      localStorage.setItem('userRole', newRole);
      setUserName(newName);
      setUserRole(newRole);
      const nameParts = newName.split(' ');
      const init = nameParts.length > 1 ? nameParts[0][0] + nameParts[1][0] : nameParts[0][0];
      setInitials(init.toUpperCase());
      setIsLoggedIn(true);
      setIsAuthModalOpen(false);
      setIsLoginView(true);
    } catch (error) {
      alert("Помилка мережі");
    }
  };

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#222222', overflowX: 'hidden' }}>

      <style>{`
        .container { max-width: 1340px; margin: 0 auto; padding: 0 4rem; width: 100%; box-sizing: border-box; }
        .anim { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); }
        
        .btn-theme { background-color: #C2D8C4 !important; color: #222222 !important; font-weight: 750; border: none; cursor: pointer; }
        .btn-theme:hover { background-color: #AECAB0 !important; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(194, 216, 196, 0.4); }
        
        .nav-link { color: #ffffff; text-decoration: none; transition: 0.2s; font-weight: 600; font-size: 0.9rem; }
        .nav-link:hover { color: #C2D8C4 !important; }

        .category-text-link { color: #64748b; font-weight: 650; font-size: 0.95rem; text-decoration: none; white-space: nowrap; position: relative; padding-bottom: 6px; transition: color 0.3s; }
        .category-text-link::after { content: ''; position: absolute; width: 0; height: 2px; bottom: 0; left: 0; background-color: #222222; transition: width 0.3s; }
        .category-text-link:hover { color: #222222; }
        .category-text-link:hover::after { width: 100%; }
        
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        .carousel-wrapper { position: relative; width: 100%; max-width: 1340px; margin: 0 auto; }
        .carousel-container { display: flex; gap: 1.5rem; overflow-x: auto; scroll-snap-type: x mandatory; padding: 0.5rem 4rem 3rem 4rem; scroll-behavior: smooth; }
        .carousel-container::-webkit-scrollbar { display: none; }
        
        .tour-card { flex: 0 0 300px; scroll-snap-align: start; background: #222222; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); transition: transform 0.3s ease, box-shadow 0.3s ease; display: flex; flex-direction: column; text-decoration: none; height: 420px; position: relative; }
        .tour-card:hover { transform: translateY(-8px); box-shadow: 0 20px 40px rgba(0,0,0,0.15); }
        .tour-card-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 1; transition: 0.5s ease; }
        .tour-card:hover .tour-card-bg { transform: scale(1.05); }
        .tour-card-gradient { position: absolute; bottom: 0; left: 0; width: 100%; height: 65%; background: linear-gradient(to top, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.6) 50%, rgba(15, 23, 42, 0) 100%); z-index: 2; }
        
        .bookmark-icon { position: absolute; top: 16px; right: 16px; width: 32px; height: 32px; border-radius: 50%; background: rgba(0,0,0,0.3); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; color: #fff; transition: 0.2s; z-index: 5; }
        .bookmark-icon:hover { background: rgba(0,0,0,0.5); transform: scale(1.05); }

        .tour-card-content { position: absolute; bottom: 0; left: 0; width: 100%; padding: 1.5rem; z-index: 3; display: flex; flex-direction: column; box-sizing: border-box; }
        .tour-title { font-size: 1.4rem; font-weight: 800; color: #ffffff; margin: 0 0 0.2rem 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 2px 4px rgba(0,0,0,0.5); }
        .tour-desc { color: #cbd5e1; font-size: 0.85rem; margin: 0 0 1.2rem 0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        
        .tour-tags { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
        .tour-badge { border: 1px solid rgba(255,255,255,0.2); color: #e2e8f0; padding: 0.3rem 0.75rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600; display: flex; align-items: center; gap: 0.3rem; backdrop-filter: blur(4px); }
        .tour-badge.rating { color: #ffffff; border-color: rgba(255,255,255,0.4); }
        .tour-badge.rating .star { color: #facc15; }
        
        .tour-book-btn { width: 100%; background: rgba(255,255,255,0.1); backdrop-filter: blur(8px); color: #ffffff; border: 1px solid rgba(255,255,255,0.2); padding: 0.85rem; border-radius: 12px; font-weight: 600; font-size: 0.95rem; cursor: pointer; transition: 0.2s; display: flex; justify-content: space-between; align-items: center; }
        .tour-card:hover .tour-book-btn { background: rgba(255,255,255,0.25); border-color: rgba(255,255,255,0.4); }

        .floating-next-btn { position: absolute; right: 1.5rem; top: 45%; transform: translateY(-50%); width: 50px; height: 50px; border-radius: 50%; background: rgba(255,255,255,0.95); backdrop-filter: blur(8px); border: 1px solid #e2e8f0; box-shadow: 0 10px 25px rgba(0,0,0,0.1); display: flex; align-items: center; justify-content: center; cursor: pointer; color: #0f172a; z-index: 10; transition: 0.2s; }
        .floating-next-btn:hover { background: #ffffff; transform: translateY(-50%) scale(1.1); box-shadow: 0 15px 35px rgba(0,0,0,0.15); }

        .reveal-on-scroll { opacity: 0; transform: translateY(40px); transition: opacity 0.8s ease-out, transform 0.8s cubic-bezier(0.25, 0.8, 0.25, 1); }
        .reveal-on-scroll.is-visible { opacity: 1; transform: translateY(0); }
        .delay-100 { transition-delay: 100ms; }
        .delay-200 { transition-delay: 200ms; }

        .info-section { padding: 8rem 0; overflow: hidden; position: relative; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; align-items: center; position: relative; z-index: 10; }
        
        .info-title { font-size: 3.5rem; font-weight: 900; color: #222222; line-height: 1.1; margin-bottom: 1.5rem; letter-spacing: -0.03em; }
        .info-title-highlight { color: #8fae92; }
        
        .info-desc { color: #64748b; font-size: 1.15rem; line-height: 1.6; margin-bottom: 1.5rem; font-weight: 400; max-width: 480px; }
        
        @keyframes morphBig {
          0% { border-radius: 40% 60% 30% 70% / 50% 50% 50% 50%; }
          100% { border-radius: 50% 50% 60% 40% / 40% 60% 40% 60%; }
        }
        @keyframes float1 { 0% { transform: translate(0, 0) rotate(0deg); } 50% { transform: translate(15px, -15px) rotate(5deg); } 100% { transform: translate(0, 0) rotate(0deg); } }
        @keyframes float2 { 0% { transform: translate(0, 0) rotate(0deg); } 50% { transform: translate(-10px, 20px) rotate(-5deg); } 100% { transform: translate(0, 0) rotate(0deg); } }
        
        @keyframes float-widget {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
          100% { transform: translateY(0px); }
        }

        @keyframes pulse-dot {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }

        .massive-blob { position: absolute; right: -5%; top: -10%; width: 55%; height: 120%; background: #222222; border-radius: 40% 60% 30% 70% / 50% 50% 50% 50%; z-index: 1; animation: morphBig 15s ease-in-out infinite alternate; }
        .massive-blob-bg { position: absolute; right: -2%; top: -5%; width: 58%; height: 120%; background: #C2D8C4; border-radius: 50% 50% 60% 40% / 40% 60% 40% 60%; z-index: 0; opacity: 0.5; animation: morphBig 20s ease-in-out infinite alternate-reverse; }

        .geo-shape-1 { position: absolute; width: 320px; height: 320px; background: #C2D8C4; border-radius: 50% 50% 50% 0; z-index: 1; opacity: 0.7; animation: float1 8s ease-in-out infinite; }
        .geo-shape-2 { position: absolute; width: 220px; height: 220px; background: #fef08a; border-radius: 50%; z-index: 2; opacity: 0.8; animation: float2 10s ease-in-out infinite alternate; }
        .geo-shape-3 { position: absolute; width: 280px; height: 400px; background: #222222; border-radius: 140px; z-index: 1; animation: float1 12s ease-in-out infinite reverse; }

        .floating-widget { 
          position: absolute; z-index: 10; 
          background: rgba(255, 255, 255, 0.95); 
          backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
          padding: 1rem 1.5rem; 
          border-radius: 100px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.08); 
          display: flex; align-items: center; gap: 1rem; 
          border: 1px solid rgba(255, 255, 255, 1); 
          animation: float-widget 6s ease-in-out infinite;
        }
        
        .floating-widget.dark {
          background: rgba(34, 34, 34, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #fff;
        }
        
        .city-link { color: #475569; text-decoration: none; font-size: 0.95rem; display: flex; align-items: center; gap: 0.5rem; transition: 0.2s; font-weight: 500; }
        .city-link:hover { color: #222222; transform: translateX(4px); }
        .city-link svg { stroke: #C2D8C4; }

        .modal-input { width: 100%; padding: 0.85rem 1rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem; box-sizing: border-box; margin-bottom: 1rem; transition: 0.2s; }
        .modal-input:focus { outline: none; border-color: #222222; box-shadow: 0 0 0 3px rgba(34, 34, 34, 0.1); }
      `}</style>

      {/* МОДАЛКА ЛОГІНУ/РЕЄСТРАЦІЇ */}
      {isAuthModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="anim" style={{ backgroundColor: '#ffffff', width: '100%', maxWidth: '440px', borderRadius: '16px', padding: '2.5rem', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
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

      {/* ХЕДЕР */}
      <header style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '72px',
        backgroundColor: scrollState === 'scrolled' ? '#222222' : 'transparent',
        borderBottom: scrollState === 'scrolled' ? '1px solid #333333' : 'none',
        zIndex: 100, display: 'flex', alignItems: 'center',
        boxShadow: scrollState === 'scrolled' ? '0 10px 30px rgba(0,0,0,0.3)' : 'none',
        transform: scrollState === 'hidden' ? 'translateY(-100%)' : 'translateY(0)',
        transition: 'transform 0.3s ease-in-out, background-color 0.3s ease-in-out'
      }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#C2D8C4', letterSpacing: '-0.04em', cursor: 'pointer' }} onClick={() => window.location.href = '/'}>
            Book<span style={{ color: '#ffffff' }}>Era</span>
          </div>

          <div style={{
            display: 'flex', gap: '0.25rem', backgroundColor: '#ffffff', padding: '0.35rem', borderRadius: '8px',
            maxWidth: '540px', width: '100%', margin: '0 2rem', opacity: scrollState === 'scrolled' ? 1 : 0,
            visibility: scrollState === 'scrolled' ? 'visible' : 'hidden', border: '1px solid #e2e8f0', boxSizing: 'border-box',
            transition: 'opacity 0.3s ease-in-out'
          }}>
            <input type="text" placeholder="Послуга, бренд або салон" value={searchWhat} onChange={(e) => setSearchWhat(e.target.value)} style={{ flex: '1 1 auto', minWidth: 0, padding: '0.4rem 0.75rem', border: 'none', outline: 'none', fontSize: '0.85rem', color: '#222222', backgroundColor: 'transparent' }} />
            <div style={{ width: '1px', height: '24px', backgroundColor: '#e2e8f0', alignSelf: 'center' }}></div>
            <input type="text" value={searchWhere} onChange={(e) => setSearchWhere(e.target.value)} style={{ flex: '0 1 120px', minWidth: 0, padding: '0.4rem 0.75rem', border: 'none', outline: 'none', fontSize: '0.85rem', fontWeight: '700', color: '#222222', backgroundColor: 'transparent' }} />
            <button className="btn-theme anim" style={{ flexShrink: 0, padding: '0.4rem 1.25rem', borderRadius: '6px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>Знайти</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}>
            <Link href={userRole === 'vendor' ? "/cabinet" : "/business"} className="nav-link" style={{ transition: '0.2s' }}>Для бізнесу</Link>

            {isLoggedIn ? (
              <div style={{ position: 'relative' }} ref={profileRef}>
                <div onClick={() => setIsProfileOpen(!isProfileOpen)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem', userSelect: 'none', padding: '0.3rem', borderRadius: '20px', transition: '0.2s' }}>
                  <span style={{ color: '#e2e8f0', transition: '0.2s', fontSize: '0.9rem', fontWeight: '600' }}>{userName}</span>
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '50%', backgroundColor: '#C2D8C4',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#222222',
                    fontWeight: '800', fontSize: '0.85rem', boxShadow: '0 2px 8px rgba(194, 216, 196, 0.25)'
                  }}>{initials}</div>
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: isProfileOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}><path d="M1 1L5 5L9 1" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>

                {isProfileOpen && (
                  <div className="anim" style={{ position: 'absolute', top: '150%', right: 0, width: '230px', background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(16px)', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', padding: '0.5rem', zIndex: 1001, border: '1px solid rgba(255, 255, 255, 0.6)' }}>
                    <div style={{ padding: '0.5rem 1rem 0.75rem 1rem', borderBottom: '1px solid rgba(0,0,0,0.05)', marginBottom: '0.5rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Акаунт</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#222222', marginTop: '2px' }}>{userName}</div>
                    </div>
                    <Link href="/profile" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '8px', color: '#334155', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '500', transition: 'all 0.2s ease' }} onClick={() => setIsProfileOpen(false)}>Мій профіль</Link>
                    {userRole === 'vendor' && (<Link href="/cabinet" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '8px', color: '#334155', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '500', transition: 'all 0.2s ease' }} onClick={() => setIsProfileOpen(false)}>Бізнес-кабінет</Link>)}
                    <Link href="/settings" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '8px', color: '#334155', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '500', transition: 'all 0.2s ease' }} onClick={() => setIsProfileOpen(false)}>Налаштування</Link>
                    <button onClick={handleLogout} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '8px', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '500', transition: 'all 0.2s ease', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', borderTop: '1px solid rgba(0,0,0,0.05)', marginTop: '4px', paddingTop: '0.85rem' }}>Вийти з акаунту</button>
                  </div>
                )}
              </div>
            ) : (
              <span onClick={() => setIsAuthModalOpen(true)} className="nav-link anim" style={{ color: '#C2D8C4', cursor: 'pointer', transition: '0.2s' }}>Увійти / Зареєструватись</span>
            )}
          </div>
        </div>
      </header>

      {/* 🟢 2. ОНОВЛЕНИЙ HERO БАНЕР */}
      <section style={{ position: 'relative', width: '100%', height: '540px', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(34, 34, 34, 0.75)', zIndex: 2 }}></div>
          <video playsInline autoPlay muted loop style={{ width: '100%', height: '100%', objectFit: 'cover' }}>
            <source src="https://booksy-public.s3.amazonaws.com/horizontal_.webm" type="video/webm" />
          </video>
        </div>
        <div className="reveal-on-scroll" style={{ position: 'relative', zIndex: 10, maxWidth: '1340px', width: '100%', margin: '0 auto', padding: '4rem 4rem 0 4rem', boxSizing: 'border-box', textAlign: 'center' }}>

          {/* Оригінальні тексти */}
          <div style={{ color: '#C2D8C4', fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Будь впевненим у своєму стилі</div>
          <h1 style={{ fontSize: '2.6rem', fontWeight: '800', color: '#ffffff', maxWidth: '750px', margin: '0 auto 2.5rem auto', lineHeight: '1.25', letterSpacing: '-0.02em' }}>
            Знайди свого майстра та бронюй послуги краси в один клік
          </h1>

          {/* Оригінальний білий пошуковий блок */}
          <div style={{ backgroundColor: '#ffffff', padding: '6px', borderRadius: '12px', border: '1px solid #e2e8f0', maxWidth: '840px', width: '100%', margin: '0 auto', display: 'flex', alignItems: 'center', boxSizing: 'border-box', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
            <div style={{ flex: 1.3, display: 'flex', alignItems: 'center', padding: '0 0.75rem' }}><span style={{ marginRight: '0.5rem', opacity: 0.6 }}>🔍</span><input type="text" placeholder="Послуга, бренд або салон" value={searchWhat} onChange={(e) => setSearchWhat(e.target.value)} style={{ width: '100%', border: 'none', outline: 'none', color: '#222222', fontSize: '0.95rem', backgroundColor: 'transparent' }} /></div>
            <div style={{ width: '1px', height: '24px', backgroundColor: '#e2e8f0' }}></div>
            <div style={{ flex: 0.9, display: 'flex', alignItems: 'center', padding: '0 0.75rem' }}><span style={{ marginRight: '0.5rem', opacity: 0.6 }}>📍</span><input type="text" value={searchWhere} onChange={(e) => setSearchWhere(e.target.value)} style={{ width: '100%', border: 'none', outline: 'none', color: '#222222', fontSize: '0.95rem', fontWeight: '600', backgroundColor: 'transparent' }} /></div>
            <div style={{ width: '1px', height: '24px', backgroundColor: '#e2e8f0' }}></div>
            <div style={{ flex: 0.8, display: 'flex', alignItems: 'center', padding: '0 0.75rem' }}><span style={{ marginRight: '0.5rem', opacity: 0.6 }}>📅</span><span style={{ color: '#64748b', fontSize: '0.95rem', cursor: 'pointer' }}>Будь-коли</span></div>
            <button className="btn-theme anim" style={{ padding: '0.75rem 2rem', borderRadius: '8px', fontSize: '0.95rem' }}>Пошук</button>
          </div>

        </div>
      </section>

      {/* 3. КАТЕГОРІЇ ПОСЛУГ */}
      <section className="container reveal-on-scroll delay-100" style={{ paddingTop: '2.5rem', paddingBottom: '3.5rem' }}>
        <div className="hide-scrollbar" style={{ display: 'flex', gap: '2.5rem', overflowX: 'auto', justifyContent: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.5rem' }}>
          {categoriesData.map((cat) => (<Link key={cat.slug} href={`/s/${cat.slug}`} className="category-text-link anim">{cat.name}</Link>))}
          <Link href="/categories" className="category-text-link anim" style={{ color: '#222222', fontWeight: '800' }}>Більше...</Link>
        </div>
      </section>

      {/* 4. РЕКОМЕНДОВАНІ ЗАКЛАДИ */}
      <section className="reveal-on-scroll" style={{ paddingBottom: '5rem', overflow: 'hidden' }}>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '2.2rem', fontWeight: '800', color: '#222222', margin: 0, letterSpacing: '-0.03em' }}>Рекомендовані майстри та студії</h2>
            <Link href="/explore" className="anim" style={{ color: '#64748b', fontWeight: '700', textDecoration: 'none', fontSize: '0.95rem' }}>Дивитись всі →</Link>
          </div>
        </div>

        {loading ? (
          <div style={{ color: '#64748b', padding: '4rem 0', textAlign: 'center', fontWeight: '650' }}>Завантаження актуальної бази салонів...</div>
        ) : businesses.length === 0 ? (
          <div className="container">
            <div style={{ textAlign: 'center', padding: '4rem', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
              <h3 style={{ color: '#222222', fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.5rem' }}>Локації ще не додано</h3>
              <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Станьте першим, хто розмістить свій бізнес на платформі.</p>
            </div>
          </div>
        ) : (
          <div className="carousel-wrapper">
            <div className="carousel-container" ref={carouselRef}>
              {businesses.map((biz: any) => {
                const rank = parseFloat(biz.reviews_rank);
                const hasRating = !isNaN(rank) && rank > 0;
                const displayRank = hasRating ? rank.toFixed(1) : null;
                const reviewCount = parseInt(biz.reviews_count) || 0;
                const bgImage = biz.cover_photo || biz.logo || "https://d2zdpiztbgorvt.cloudfront.net/region1/us/481342/biz_photo/5f28c4906bb6475692f485b86f7147-flawless-fades-hair-systems-in-biz-photo-c643db9da71d4eea86e3e9ef3f4dc6-booksy.jpeg?size=640x427";

                return (
                  <Link key={biz.id} href={`/salon/${biz.id}`} className="tour-card">
                    <img src={bgImage} alt={biz.name} className="tour-card-bg" />
                    <div className="tour-card-gradient"></div>
                    <div className="bookmark-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg></div>

                    <div className="tour-card-content">
                      <div>
                        <h3 className="tour-title">{biz.name}</h3>
                        <p className="tour-desc">📍 {biz.address || 'Адреса не вказана'}</p>
                      </div>

                      <div className="tour-tags">
                        {hasRating ? (
                          <span className="tour-badge rating"><span className="star">★</span> {displayRank}</span>
                        ) : (
                          <span className="tour-badge" style={{ borderColor: '#C2D8C4', color: '#C2D8C4' }}>Новий заклад</span>
                        )}
                        <span className="tour-badge">{biz.category || 'Салон'}</span>
                        {reviewCount > 0 && <span className="tour-badge">{reviewCount} відг.</span>}
                      </div>

                      <div className="tour-book-btn">Записатись</div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {businesses.length > 3 && (
              <button className="floating-next-btn" onClick={() => scrollCarousel('right')}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
            )}
          </div>
        )}
      </section>

      {/* 🟢 НОВІ ІНФОРМАЦІЙНІ БЛОКИ */}

      {/* Секція 1: Зручне бронювання */}
      <section className="info-section">
        <div className="container">
          <div className="info-grid">

            {/* Текст зліва */}
            <div className="reveal-on-scroll">
              <h2 className="info-title">
                Зручно бронюйте візити <br/>
                <span className="info-title-highlight">онлайн</span>
              </h2>
              <p className="info-desc">
                Хочете записатися до перукаря, барбера, на манікюр чи в масажний салон у вашому районі? Шукаєте місце, де найкращі спеціалісти подбають про вашу красу?
              </p>
              <p className="info-desc">
                BookEra — це безкоштовний додаток для бронювання, де можна легко й швидко знаходити вільні дати та записуватися. Більше жодних телефонних дзвінків.
              </p>
              <Link href="/explore" style={{ textDecoration: 'none' }}>
                <button className="btn-theme anim" style={{ padding: '1rem 2.5rem', borderRadius: '30px', fontSize: '1rem', marginTop: '1rem' }}>Почати пошук</button>
              </Link>
            </div>

            {/* Абстрактна Геометрія Справа */}
            <div className="reveal-on-scroll delay-100" style={{ position: 'relative', height: '400px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div className="geo-shape-1" style={{ right: '5%', top: '10%' }}></div>
              <div className="geo-shape-2" style={{ left: '15%', bottom: '5%' }}></div>
              <div style={{ position: 'absolute', width: '160px', height: '160px', background: '#222222', borderRadius: '30px', transform: 'rotate(15deg)', top: '20%', left: '25%', zIndex: 3 }}></div>

              <div className="floating-widget" style={{ bottom: '15%', right: '10%', padding: '0.8rem 1.5rem', animationDelay: '0s' }}>
                <div style={{ width: '40px', height: '40px', background: '#222222', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C2D8C4', flexShrink: 0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: '800', color: '#222', lineHeight: '1.2' }}>Економія часу</span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Запис в 3 кліки</span>
                </div>
              </div>

              <div className="floating-widget" style={{ top: '15%', left: '5%', padding: '0.8rem 1.2rem', animationDelay: '1.5s' }}>
                <div style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '50%', boxShadow: '0 0 8px rgba(16,185,129,0.5)' }}></div>
                <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#222' }}>Є вікно на 14:30</span>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* Секція 2: Нагадування */}
      <section className="info-section" style={{ backgroundColor: '#fafafa' }}>
        <div className="container">
          <div className="info-grid">

            {/* Абстрактна Геометрія Зліва */}
            <div className="reveal-on-scroll" style={{ position: 'relative', height: '400px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', order: 1 }}>
              <div className="geo-shape-3" style={{ left: '10%', top: '0' }}></div>
              <div style={{ position: 'absolute', width: '200px', height: '200px', background: '#C2D8C4', borderRadius: '50%', right: '20%', bottom: '10%', zIndex: 2 }}></div>
              <div style={{ position: 'absolute', width: '100px', height: '100px', background: '#fef08a', borderRadius: '20px', right: '15%', top: '20%', zIndex: 2, transform: 'rotate(-20deg)' }}></div>

              <div className="floating-widget" style={{ top: '35%', left: '0', padding: '0.8rem 1.5rem', animationDelay: '0s' }}>
                <div style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '50%', animation: 'pulse-dot 2s infinite' }}></div>
                <span style={{ fontSize: '0.95rem', fontWeight: '800', color: '#222' }}>Завтра візит об 11:00</span>
              </div>

              <div className="floating-widget" style={{ bottom: '20%', right: '10%', padding: '0.8rem 1.2rem', animationDelay: '2s' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><polyline points="16 21 21 21 21 16"></polyline></svg>
                <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#64748b' }}>Перенести візит</span>
              </div>

            </div>

            {/* Текст Справа */}
            <div className="reveal-on-scroll delay-100" style={{ position: 'relative', zIndex: 10, order: 2 }}>
              <h2 className="info-title">
                Щось змінилося? <br/>Не переймайтеся — <br/><span className="info-title-highlight">ми нагадаємо</span>
              </h2>
              <p className="info-desc">
                Керуйте своїми візитами звідусіль. Переносьте записи або скасовуйте бронювання без незручних телефонних дзвінків та пояснень.
              </p>
              <p className="info-desc">
                Ми знаємо, що у вас щодня безліч справ! Тому BookEra надсилатиме вам автоматичні нагадування про майбутні візити, аби ви нічого не пропустили.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Секція 3: Топ майстри */}
      <section className="info-section">
        <div className="container">
          <div className="info-grid">

            {/* Текст зліва */}
            <div className="reveal-on-scroll">
              <h2 className="info-title">
                Бронюйте в <span style={{ position: 'relative' }}>найкращих<svg style={{position: 'absolute', bottom: '-8px', left: 0, width: '100%'}} viewBox="0 0 100 10" preserveAspectRatio="none"><path d="M0 5 Q 50 15 100 5" stroke="#facc15" strokeWidth="4" fill="none"/></svg></span> спеціалістів поблизу
              </h2>
              <p className="info-desc">
                У BookEra ви знайдете найкращі заклади для здоров'я та салони краси у вашому регіоні.
              </p>
              <p className="info-desc">
                Дізнайтеся більше про них — переглядайте профілі, читайте реальні відгуки інших клієнтів та ознайомлюйтеся з їхніми роботами в портфоліо перед тим, як записатись.
              </p>
            </div>

            {/* Абстрактна Геометрія Справа */}
            <div className="reveal-on-scroll delay-100" style={{ position: 'relative', height: '400px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ position: 'absolute', width: '380px', height: '380px', background: 'transparent', borderRadius: '50%', right: '10%', border: '2px dashed #cbd5e1', zIndex: 1, animation: 'spin 20s linear infinite' }}></div>
              <div className="blob-1" style={{ width: '250px', height: '250px', top: '15%', right: '15%', zIndex: 2, background: '#fef08a' }}></div>
              <div style={{ position: 'absolute', width: '180px', height: '180px', background: '#222222', borderRadius: '40px', bottom: '10%', left: '20%', zIndex: 3, transform: 'rotate(-10deg)' }}></div>

              <div className="floating-widget" style={{ bottom: '15%', left: '5%', animationDelay: '0s' }}>
                <div style={{ color: '#facc15', fontSize: '1.2rem', letterSpacing: '2px' }}>★★★★★</div>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#222' }}>4.9 з 5</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>На основі 120 відгуків</div>
                </div>
              </div>

              <div className="floating-widget" style={{ top: '20%', right: '5%', padding: '0.8rem 1.2rem', animationDelay: '1.5s' }}>
                <span style={{ fontSize: '1.2rem' }}>🏆</span>
                <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#222' }}>Топ-рейтинг</span>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* Секція 4: B2B Продукт (Темна тема) */}
      <section className="info-section" style={{ backgroundColor: '#222222', color: '#fff', padding: '10rem 0' }}>
        <div className="massive-blob-bg"></div>
        <div className="massive-blob"></div>

        <div className="container">
          <div className="info-grid" style={{ gap: '6rem' }}>

            {/* Текстова частина зліва */}
            <div className="reveal-on-scroll" style={{ position: 'relative', zIndex: 10, order: 1 }}>
              <h2 className="info-title" style={{ color: '#fff' }}>
                Сучасне <span style={{ display: 'inline-block', background: '#C2D8C4', padding: '0 1rem', borderRadius: '16px', color: '#222222', transform: 'rotate(-2deg)' }}>рішення</span> <br/>для вашого бізнесу
              </h2>
              <p className="info-desc" style={{ color: '#cbd5e1', maxWidth: '450px' }}>
                BookEra Business — це повноцінна екосистема для власників салонів та приватних майстрів. Залучайте нових клієнтів, керуйте розкладом та ведіть фінансову аналітику в одній програмі.
              </p>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
                <Link href={userRole === 'vendor' ? "/cabinet" : "/business"} style={{ textDecoration: 'none' }}>
                  <button className="btn-theme anim" style={{ padding: '1rem 2.5rem', borderRadius: '30px', fontSize: '1rem' }}>Створити профіль</button>
                </Link>
              </div>
            </div>

            {/* Абстрактна Геометрія Справа */}
            <div className="reveal-on-scroll delay-100" style={{ position: 'relative', height: '450px', display: 'flex', justifyContent: 'center', alignItems: 'center', order: 2 }}>

              <div style={{ position: 'absolute', width: '280px', height: '280px', borderRadius: '50%', border: '2px dashed rgba(255,255,255,0.2)', animation: 'spin 30s linear infinite', zIndex: 1 }}></div>
              <div style={{ position: 'absolute', width: '160px', height: '160px', background: '#fef08a', borderRadius: '50%', top: '10%', right: '10%', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', zIndex: 2 }}></div>
              <div style={{ position: 'absolute', width: '120px', height: '240px', background: '#C2D8C4', borderRadius: '60px', bottom: '10%', left: '15%', transform: 'rotate(25deg)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', zIndex: 3 }}></div>
              <div style={{ position: 'absolute', width: '60px', height: '60px', background: '#ffffff', borderRadius: '16px', top: '40%', left: '30%', transform: 'rotate(-15deg)', opacity: 0.1, zIndex: 1 }}></div>

              <div className="floating-widget dark" style={{ left: '0', bottom: '20%', animationDelay: '0s' }}>
                <div style={{ width: '40px', height: '40px', background: '#C2D8C4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', color: '#222', flexShrink: 0 }}>✓</div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '1rem', fontWeight: '800', color: '#fff', lineHeight: '1.2' }}>+40% клієнтів</span>
                  <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Завдяки системі</span>
                </div>
              </div>

              <div className="floating-widget dark" style={{ top: '10%', right: '0', padding: '0.8rem 1.2rem', animationDelay: '2.5s' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C2D8C4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#fff' }}>Аналітика</span>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* 🟢 БЛОК МІСТ */}
      <section className="reveal-on-scroll" style={{ padding: '6rem 0', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
        <div className="container">
          <h2 style={{ fontSize: '2rem', fontWeight: '800', color: '#222222', textAlign: 'center', marginBottom: '3rem', letterSpacing: '-0.02em' }}>
            Шукайте свого спеціаліста за містом
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem 2rem' }}>
            {topCities.map(city => (
              <Link key={city} href={`/s/${searchWhat}?location=${city}`} className="city-link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                {city}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 🟢 ФУТЕР */}
      <footer style={{ backgroundColor: '#1a1a1a', padding: '4rem 0 2rem 0' }}>
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