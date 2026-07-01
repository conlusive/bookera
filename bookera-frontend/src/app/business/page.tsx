'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function BusinessLandingPage() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Стейт для модального вікна логіну
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLoginView, setIsLoginView] = useState(true); // Перемикач Вхід/Реєстрація

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');

  // Дані для профілю
  const [userName, setUserName] = useState<string | null>(null);
  const [initials, setInitials] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('client');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);

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

    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
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
      // Даємо роль 'client', бо бізнес ще не створено. Роль 'vendor' дамо в кінці візарду.
      const newRole = 'client';

      localStorage.setItem('userName', newName);
      localStorage.setItem('userId', '1');
      localStorage.setItem('userRole', newRole);

      setIsLoggedIn(true);
      setIsAuthModalOpen(false);

      // Миттєвий перехід на онбординг!
      router.push('/business/register');
    } catch (error) {
      alert("Помилка мережі");
    }
  };

  // 🔴 РОЗУМНА ФУНКЦІЯ ДЛЯ ВСІХ КНОПОК "ПОЧАТИ БІЗНЕС"
  const handleStartBusinessClick = () => {
    if (userRole === 'vendor') {
      router.push('/cabinet');
    } else if (isLoggedIn) {
      router.push('/business/register');
    } else {
      setIsLoginView(false); // Відкриваємо модалку на вкладці "Реєстрація"
      setIsAuthModalOpen(true);
    }
  };

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#0f172a' }}>

      <style>{`
        .container { max-width: 1340px; margin: 0 auto; padding: 0 4rem; width: 100%; box-sizing: border-box; }
        .anim { transition: all 0.3s ease-in-out; }
        .btn-gold { background-color: #c5a880 !important; color: #ffffff !important; font-weight: 800; border: none; cursor: pointer; }
        .btn-gold:hover { background-color: #b39369 !important; box-shadow: 0 4px 15px rgba(197, 168, 128, 0.3); transform: translateY(-2px); }
        .nav-link { color: #ffffff; text-decoration: none; transition: 0.2s; font-weight: 600; font-size: 0.9rem; }
        .nav-link:hover { color: #c5a880 !important; }
        .footer-link { color: #94a3b8; text-decoration: none; font-size: 0.9rem; }
        .footer-link:hover { color: #ffffff; }
        .split-section { display: grid; grid-template-columns: 1fr 1fr; gap: 5rem; align-items: center; padding: 6rem 0; }
        .split-img-wrapper { border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.08); height: 500px; }
        .split-img { width: 100%; height: 100%; object-fit: cover; }
        .feature-check { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; color: #475569; font-weight: 500; fontSize: 1.05rem; }

        /* Стилі для модального вікна логіну */
        .modal-input { width: 100%; padding: 0.85rem 1rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem; box-sizing: border-box; margin-bottom: 1rem; transition: 0.2s; }
        .modal-input:focus { outline: none; border-color: #0f172a; box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.1); }
        .social-btn { display: flex; align-items: center; justify-content: center; gap: 0.75rem; width: 100%; padding: 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; font-weight: 600; color: #0f172a; cursor: pointer; margin-bottom: 0.75rem; transition: 0.2s; }
        .social-btn:hover { background: #f8fafc; }

        /* Glassmorphism Профіль */
        .profile-menu-container { position: absolute; top: 150%; right: 0; width: 230px; background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); padding: 0.5rem; z-index: 1001; border: 1px solid rgba(255, 255, 255, 0.6); }
        .profile-menu-item { display: block; width: 100%; text-align: left; padding: 0.75rem 1rem; border-radius: 8px; color: #334155; text-decoration: none; font-size: 0.9rem; font-weight: 500; transition: all 0.2s ease; background: transparent; border: none; cursor: pointer; }
        .profile-menu-item:hover { background-color: rgba(15, 23, 42, 0.05); color: #0f172a; }
        .profile-menu-logout { color: #ef4444; border-top: 1px solid rgba(0,0,0,0.05); border-radius: 0 0 8px 8px; margin-top: 4px; padding-top: 0.85rem; }
        .profile-menu-logout:hover { background-color: rgba(239, 68, 68, 0.08); color: #dc2626; }
        .profile-trigger { cursor: pointer; display: flex; align-items: center; gap: 0.6rem; user-select: none; padding: 0.3rem; border-radius: 20px; transition: 0.2s; }
        .profile-trigger .profile-name { color: #e2e8f0; transition: 0.2s; }
        .profile-trigger svg path { stroke: #94a3b8; transition: 0.2s; }
        .profile-trigger:hover .profile-name { color: #ffffff; }
        .profile-trigger:hover svg path { stroke: #ffffff; }
      `}</style>

      {/* МОДАЛКА ЛОГІНУ/РЕЄСТРАЦІЇ */}
      {isAuthModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="anim" style={{ backgroundColor: '#ffffff', width: '100%', maxWidth: '440px', borderRadius: '16px', padding: '2.5rem', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>

            <button onClick={() => { setIsAuthModalOpen(false); setIsLoginView(true); }} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', fontSize: '1.5rem', color: '#64748b', cursor: 'pointer' }}>×</button>

            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', textAlign: 'center', marginBottom: '0.5rem', color: '#0f172a' }}>
              {isLoginView ? 'Почати' : 'Створити акаунт'}
            </h2>
            <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.95rem', marginBottom: '2rem' }}>
              {isLoginView ? 'Увійдіть або створіть акаунт для керування візитами.' : 'Заповніть дані для реєстрації на платформі.'}
            </p>

            <form onSubmit={handleModalAuth}>
              {!isLoginView && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <input type="text" placeholder="Ім'я" value={regFirstName} onChange={(e) => setRegFirstName(e.target.value)} className="modal-input" style={{ marginBottom: 0 }} required />
                  <input type="text" placeholder="Прізвище" value={regLastName} onChange={(e) => setRegLastName(e.target.value)} className="modal-input" style={{ marginBottom: 0 }} required />
                </div>
              )}

              <input type="email" placeholder="Email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="modal-input" required />
              <input type="password" placeholder="Пароль" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="modal-input" required />

              <button type="submit" style={{ width: '100%', padding: '1rem', backgroundColor: '#0f172a', color: '#fff', borderRadius: '8px', fontWeight: '700', border: 'none', cursor: 'pointer', marginBottom: '1.5rem', fontSize: '1rem' }}>
                {isLoginView ? 'Продовжити' : 'Зареєструватись'}
              </button>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0', color: '#94a3b8', fontSize: '0.85rem' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }}></div><span style={{ padding: '0 1rem' }}>АБО</span><div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }}></div>
            </div>

            <button className="social-btn" onClick={() => alert('Ця функція з\'явиться пізніше')}>Продовжити з Google</button>
            <button className="social-btn" onClick={() => alert('Ця функція з\'явиться пізніше')}>Продовжити з Apple</button>

            <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#64748b', marginTop: '1.5rem' }}>
              {isLoginView ? (
                <>Немає акаунту? <span onClick={() => setIsLoginView(false)} style={{ color: '#0f172a', fontWeight: '700', cursor: 'pointer' }}>Зареєструватись</span></>
              ) : (
                <>Вже маєте акаунт? <span onClick={() => setIsLoginView(true)} style={{ color: '#0f172a', fontWeight: '700', cursor: 'pointer' }}>Увійти</span></>
              )}
            </p>
          </div>
        </div>
      )}

      {/* 1. БІЗНЕС ХЕДЕР */}
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
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}>
            <Link href="/" className="nav-link anim" style={{ transition: '0.2s' }}>Для клієнтів</Link>

            {isLoggedIn ? (
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

                    {/* Доступ до Кабінету тільки якщо ти вже Vendor */}
                    {userRole === 'vendor' && (
                      <Link href="/cabinet" className="profile-menu-item" onClick={() => setIsProfileOpen(false)}>Бізнес-кабінет</Link>
                    )}

                    <Link href="/settings" className="profile-menu-item" onClick={() => setIsProfileOpen(false)}>Налаштування</Link>
                    <button onClick={handleLogout} className="profile-menu-item profile-menu-logout">
                      Вийти з акаунту
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <span onClick={() => setIsAuthModalOpen(true)} className="nav-link anim" style={{ color: '#c5a880', cursor: 'pointer', transition: '0.2s' }}>Увійти / Зареєструватись</span>
            )}
          </div>

        </div>
      </header>

      {/* 2. HERO СЕКЦІЯ */}
      <section style={{ position: 'relative', width: '100%', height: '700px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(90deg, rgba(11,15,23,0.95) 0%, rgba(11,15,23,0.7) 50%, rgba(11,15,23,0.3) 100%)', zIndex: 2 }}></div>
          <img src="https://images.unsplash.com/photo-1622286342621-4bd786c2447c?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80" alt="Salon Professional" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }} />
        </div>

        <div className="container" style={{ position: 'relative', zIndex: 10 }}>
          <div style={{ maxWidth: '650px' }}>
            <div style={{ display: 'inline-block', border: '1px solid rgba(197, 168, 128, 0.4)', color: '#c5a880', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.05em', marginBottom: '1.5rem', textTransform: 'uppercase' }}>Універсальне рішення</div>
            <h1 style={{ fontSize: '3.5rem', fontWeight: '900', color: '#ffffff', lineHeight: '1.15', marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>Бізнес-додаток, створений для барберів та салонів</h1>
            <p style={{ color: '#e2e8f0', fontSize: '1.15rem', lineHeight: '1.6', marginBottom: '2.5rem' }}>Відкрийте нові можливості для свого бізнесу. Онлайн-запис, розумний календар, захист від неявок та інструменти маркетингу в одній екосистемі BookEra Business.</p>

            {/* 🔴 РОЗУМНА КНОПКА З ФУНКЦІЄЮ */}
            <button onClick={handleStartBusinessClick} className="btn-gold anim" style={{ padding: '1rem 2.5rem', borderRadius: '10px', fontSize: '1.05rem' }}>
              {userRole === 'vendor' ? 'Перейти в панель керування' : isLoggedIn ? 'Відкрити свій бізнес на BookEra' : 'Почати безкоштовно'}
            </button>

            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '1rem' }}>Не потрібна кредитна картка. 14 днів безкоштовного тестування.</p>
          </div>
        </div>
      </section>

      {/* 3. СТАТИСТИКА */}
      <section style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '4rem 0' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', textAlign: 'center' }}>
            <div><div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#0b0f17', marginBottom: '0.5rem' }}>24/7</div><div style={{ color: '#64748b', fontWeight: '600' }}>Доступність для запису клієнтів</div></div>
            <div><div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#0b0f17', marginBottom: '0.5rem' }}>-40%</div><div style={{ color: '#64748b', fontWeight: '600' }}>Зменшення неявок (No-shows)</div></div>
            <div><div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#0b0f17', marginBottom: '0.5rem' }}>+25%</div><div style={{ color: '#64748b', fontWeight: '600' }}>Зростання кількості нових клієнтів</div></div>
          </div>
        </div>
      </section>

      {/* 4. БЛОКИ З ПЕРЕВАГАМИ */}
      <section className="container">
        <div className="split-section">
          <div className="split-img-wrapper"><img src="https://images.unsplash.com/photo-1560066984-138dadb4c035?ixlib=rb-4.0.3&auto=format&fit=crop&w=1074&q=80" alt="Online Booking" className="split-img" /></div>
          <div>
            <h2 style={{ fontSize: '2.2rem', fontWeight: '800', color: '#0f172a', marginBottom: '1.25rem', lineHeight: '1.2' }}>Заповнений календар без зайвих дзвінків</h2>
            <p style={{ color: '#64748b', fontSize: '1.05rem', lineHeight: '1.6', marginBottom: '2rem' }}>Ваш бізнес працює навіть коли ви спите. Дозвольте клієнтам бачити ваш вільний час та записуватись самостійно 24 години на добу, 7 днів на тиждень.</p>
            <div className="feature-check"><span style={{ color: '#c5a880', fontSize: '1.2rem' }}>✔</span> Професійна сторінка запису</div>
            <div className="feature-check"><span style={{ color: '#c5a880', fontSize: '1.2rem' }}>✔</span> Інтеграція з Instagram та Google</div>
            <div className="feature-check"><span style={{ color: '#c5a880', fontSize: '1.2rem' }}>✔</span> Автоматичні нагадування клієнтам</div>
          </div>
        </div>
        <div className="split-section" style={{ borderTop: '1px solid #f1f5f9' }}>
          <div>
            <h2 style={{ fontSize: '2.2rem', fontWeight: '800', color: '#0f172a', marginBottom: '1.25rem', lineHeight: '1.2' }}>Захистіть свій час та дохід від неявок</h2>
            <p style={{ color: '#64748b', fontSize: '1.05rem', lineHeight: '1.6', marginBottom: '2rem' }}>Клієнти забувають про візит? Налаштуйте правила скасування та беріть передоплату. BookEra бере на себе всю неприємну роботу з гарантії вашого доходу.</p>
            <div className="feature-check"><span style={{ color: '#c5a880', fontSize: '1.2rem' }}>✔</span> Правила скасування бронювань</div>
            <div className="feature-check"><span style={{ color: '#c5a880', fontSize: '1.2rem' }}>✔</span> Безпечні онлайн-платежі</div>
            <div className="feature-check"><span style={{ color: '#c5a880', fontSize: '1.2rem' }}>✔</span> Чорний список проблемних клієнтів</div>
          </div>
          <div className="split-img-wrapper"><img src="https://images.unsplash.com/photo-1599351431202-1e0f0137899a?ixlib=rb-4.0.3&auto=format&fit=crop&w=1074&q=80" alt="No-show protection" className="split-img" /></div>
        </div>
      </section>

      {/* 5. ФІНАЛЬНИЙ ЗАКЛИК ДО ДІЇ */}
      <section style={{ backgroundColor: '#0b1120', padding: '6rem 0', textAlign: 'center' }}>
        <div className="container">
          <h2 style={{ fontSize: '2.8rem', fontWeight: '900', color: '#ffffff', marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>Готові вивести бізнес на новий рівень?</h2>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto 2.5rem auto', lineHeight: '1.6' }}>Приєднуйтесь до платформи BookEra Business. Усі функції включено. Жодних прихованих платежів чи сюрпризів.</p>

          {/* 🔴 РОЗУМНА КНОПКА РОЛЕЙ В ФУТЕРІ */}
          <button onClick={handleStartBusinessClick} className="btn-gold anim" style={{ padding: '1rem 3rem', borderRadius: '10px', fontSize: '1.1rem' }}>
            {userRole === 'vendor' ? 'Перейти в панель керування' : isLoggedIn ? 'Відкрити свій бізнес' : 'Створити кабінет компанії'}
          </button>
        </div>
      </section>

      {/* 6. ФУТЕР */}
      <footer style={{ backgroundColor: '#05070a', borderTop: '1px solid #1e293b', padding: '4rem 0 3rem 0' }}>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '2rem' }}>
            <nav style={{ display: 'flex', gap: '5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}><Link href="#" className="footer-link anim">Блог</Link><Link href="#" className="footer-link anim">Про нас</Link><Link href="#" className="footer-link anim">Питання та відповіді</Link></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}><Link href="#" className="footer-link anim">Умови використання</Link><Link href="#" className="footer-link anim">Політика конфіденційності</Link><Link href="#" className="footer-link anim">Контакти</Link></div>
            </nav>
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#c5a880' }}>Book<span style={{ color: '#fff' }}>Era</span></div><span style={{ color: '#64748b', fontSize: '0.85rem' }}>© 2026 Всі права захищені.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}