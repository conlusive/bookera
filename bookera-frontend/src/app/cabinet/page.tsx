'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CabinetPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);
  const [initials, setInitials] = useState<string>('');

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let storedName = localStorage.getItem('userName');

    if (!storedName) {
      storedName = 'Діма Кора';
      localStorage.setItem('userName', storedName);
      localStorage.setItem('userId', '1');
    }

    setUserName(storedName);
    const nameParts = storedName.split(' ');
    const init = nameParts.length > 1
      ? nameParts[0][0] + nameParts[1][0]
      : nameParts[0][0];
    setInitials(init.toUpperCase());

    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
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

  const handleLogout = () => {
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
    router.push('/business/login');
  };

  if (!userName) return null;

  const businesses = [
    {
      id: 1,
      name: "Solid Barber & Co.",
      address: "м. Львів, вул. Вірменська, 12",
      appointmentsToday: 12,
      mastersCount: 4
    }
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column' }}>

      <style>{`
        .container { max-width: 1340px; margin: 0 auto; padding: 0 4rem; width: 100%; box-sizing: border-box; }
        .anim { transition: all 0.3s ease-in-out; }

        .nav-item {
          color: #94a3b8;
          text-decoration: none;
          font-weight: 500;
          font-size: 0.95rem;
          transition: color 0.2s ease;
        }
        .nav-item:hover { color: #ffffff; }
        .nav-item.active { color: #c5a880; font-weight: 600; }

        .btn-gold {
          background-color: #c5a880; color: #fff; border: none; padding: 0.75rem 1.5rem;
          border-radius: 8px; font-weight: 700; cursor: pointer; transition: 0.2s;
        }
        .btn-gold:hover { background-color: #b39369; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(197, 168, 128, 0.2); }

        .business-card {
          background: #ffffff; border-radius: 16px; padding: 2rem;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02);
          display: flex; justify-content: space-between; align-items: center;
          transition: 0.3s; border: 1px solid #f1f5f9;
        }
        .business-card:hover {
          transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0, 0, 0, 0.04); border-color: #e2e8f0;
        }

        /* GLASSMORPHISM ПРОФІЛЬ */
        .profile-menu-container {
          position: absolute; top: 150%; right: 0; width: 230px;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-radius: 16px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          padding: 0.5rem; z-index: 1001;
          border: 1px solid rgba(255, 255, 255, 0.6);
        }
        .profile-menu-item { display: block; width: 100%; text-align: left; padding: 0.75rem 1rem; border-radius: 8px; color: #334155; text-decoration: none; font-size: 0.9rem; font-weight: 500; transition: all 0.2s ease; background: transparent; border: none; cursor: pointer; }
        .profile-menu-item:hover { background-color: rgba(15, 23, 42, 0.05); color: #0f172a; }
        .profile-menu-logout { color: #ef4444; border-top: 1px solid rgba(0,0,0,0.05); border-radius: 0 0 8px 8px; margin-top: 4px; padding-top: 0.85rem; }
        .profile-menu-logout:hover { background-color: rgba(239, 68, 68, 0.08); color: #dc2626; }

        .profile-trigger { cursor: pointer; display: flex; align-items: center; gap: 0.6rem; user-select: none; padding: 0.3rem; border-radius: 20px; transition: 0.2s; }
        .profile-trigger .profile-name { color: #e2e8f0; transition: 0.2s; }
        .profile-trigger svg path { stroke: #94a3b8; transition: 0.2s; }
        .profile-trigger:hover .profile-name { color: #ffffff; }
        .profile-trigger:hover svg path { stroke: #ffffff; }

        .footer-link { color: #94a3b8; text-decoration: none; font-size: 0.9rem; transition: 0.2s; }
        .footer-link:hover { color: #ffffff; }
      `}</style>

      {/* 1. ХЕДЕР (Ідеально вирівняний по центру) */}
      <header className="anim" style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '72px',
        backgroundColor: scrolled ? '#0b0f17' : 'transparent',
        borderBottom: scrolled ? '1px solid #1e293b' : 'none',
        zIndex: 1000,
        boxShadow: scrolled ? '0 10px 30px rgba(0,0,0,0.5)' : 'none'
      }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '100%' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '3rem' }}>
            <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '1.6rem', fontWeight: '900', color: '#c5a880', letterSpacing: '-0.04em', lineHeight: 1 }}>
                Book<span style={{ color: '#ffffff' }}>Era</span>
              </span>
              <span style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: '500', lineHeight: 1 }}>Business</span>
            </Link>

            <nav style={{ display: 'flex', gap: '1.75rem', alignItems: 'center' }}>
              <Link href="/cabinet" className="nav-item active">Мої заклади</Link>
              <Link href="#" className="nav-item">Календар</Link>
              <Link href="#" className="nav-item">Клієнти</Link>
              <Link href="#" className="nav-item">Аналітика</Link>
            </nav>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}>
            <div style={{ position: 'relative' }} ref={profileRef}>
              <div onClick={() => setIsProfileOpen(!isProfileOpen)} className="profile-trigger">
                <span className="profile-name" style={{ fontSize: '0.9rem', fontWeight: '600' }}>{userName}</span>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '50%', backgroundColor: '#c5a880',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0b0f17',
                  fontWeight: '800', fontSize: '0.85rem', boxShadow: '0 2px 8px rgba(197, 168, 128, 0.25)'
                }}>
                  {initials}
                </div>
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: isProfileOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
                  <path d="M1 1L5 5L9 1" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>

              {isProfileOpen && (
                <div className="anim profile-menu-container">
                  <div style={{ padding: '0.5rem 1rem 0.75rem 1rem', borderBottom: '1px solid rgba(0,0,0,0.05)', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Акаунт</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>{userName}</div>
                  </div>
                  <Link href="/profile" className="profile-menu-item" onClick={() => setIsProfileOpen(false)}>Мій профіль</Link>
                  <Link href="/cabinet" className="profile-menu-item" onClick={() => setIsProfileOpen(false)}>Бізнес-кабінет</Link>
                  <Link href="/settings" className="profile-menu-item" onClick={() => setIsProfileOpen(false)}>Налаштування</Link>
                  <button onClick={handleLogout} className="profile-menu-item profile-menu-logout">
                    Вийти з акаунту
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 2. HERO */}
      <div style={{ position: 'relative', padding: '9rem 0 5rem 0', backgroundColor: '#0b0f17', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.25, zIndex: 0 }}>
           <img
            src="https://images.unsplash.com/photo-1522337660859-02fbefca4702?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80"
            alt="Barbershop"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: '2.8rem', color: '#ffffff', fontWeight: '800', margin: '0 0 0.75rem 0', letterSpacing: '-0.02em' }}>Мій Бізнес Кабінет</h1>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem', margin: 0, maxWidth: '600px', lineHeight: '1.6' }}>
            Вітаємо, {userName}. Керуйте своїми закладами та переглядайте статистику в реальному часі.
          </p>
        </div>
      </div>

      {/* 3. MAIN (Контент займає весь простір, flex: 1) */}
      <main className="container" style={{ padding: '4rem 4rem', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', color: '#0f172a', fontWeight: '800', margin: 0 }}>Керувати моїми закладами</h2>
          <button className="btn-gold">+ Зареєструвати нову філію</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {businesses.map((biz) => (
            <div key={biz.id} className="business-card">
              <div>
                <h3 style={{ fontSize: '1.25rem', color: '#0f172a', fontWeight: '800', margin: '0 0 0.4rem 0' }}>{biz.name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  <span style={{ color: '#c5a880', marginRight: '6px' }}>📍</span> {biz.address}
                </div>
                <Link href={`/cabinet/business/${biz.id}`} style={{ color: '#c5a880', textDecoration: 'none', fontWeight: '600', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px', transition: '0.2s' }} onMouseOver={(e) => e.currentTarget.style.color = '#0f172a'} onMouseOut={(e) => e.currentTarget.style.color = '#c5a880'}>
                  Керувати закладом <span style={{ fontSize: '1.1rem' }}>→</span>
                </Link>
              </div>

              <div style={{ display: 'flex', gap: '1.25rem' }}>
                <div style={{ border: '1px solid #f8fafc', borderRadius: '12px', padding: '1rem 2rem', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a' }}>{biz.appointmentsToday}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', marginTop: '4px', letterSpacing: '0.05em' }}>Записів сьогодні</div>
                </div>
                <div style={{ border: '1px solid #f8fafc', borderRadius: '12px', padding: '1rem 2rem', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a' }}>{biz.mastersCount}</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', marginTop: '4px', letterSpacing: '0.05em' }}>Майстри</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* 4. ПОВЕРНУТО ВЕЛИКИЙ ФУТЕР */}
      <footer style={{ backgroundColor: '#05070a', borderTop: '1px solid #1e293b', padding: '4rem 0 3rem 0', marginTop: 'auto' }}>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '2rem' }}>
            <nav style={{ display: 'flex', gap: '5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <Link href="#" className="footer-link anim">Блог</Link>
                <Link href="#" className="footer-link anim">Про нас</Link>
                <Link href="#" className="footer-link anim">Питання та відповіді</Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <Link href="#" className="footer-link anim">Умови використання</Link>
                <Link href="#" className="footer-link anim">Політика конфіденційності</Link>
                <Link href="#" className="footer-link anim">Контакти</Link>
              </div>
            </nav>
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#c5a880' }}>Book<span style={{ color: '#fff' }}>Era</span></div>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>© 2026 Всі права захищені.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}