// src/app/business/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function BusinessLandingPage() {
  const [scrolled, setScrolled] = useState(false);

  // Плавна поява фону хедера при скролі
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#0f172a' }}>

      <style>{`
        /* СИНХРОНІЗОВАНА СІТКА З ГОЛОВНОЮ СТОРІНКОЮ */
        .container { max-width: 1340px; margin: 0 auto; padding: 0 4rem; width: 100%; box-sizing: border-box; }

        .anim { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); }

        .btn-gold { background-color: #c5a880 !important; color: #ffffff !important; font-weight: 800; border: none; cursor: pointer; }
        .btn-gold:hover { background-color: #b39369 !important; box-shadow: 0 4px 15px rgba(197, 168, 128, 0.3); transform: translateY(-2px); }

        .btn-dark { background-color: #0b0f17 !important; color: #ffffff !important; font-weight: 800; border: none; cursor: pointer; }
        .btn-dark:hover { background-color: #1e293b !important; box-shadow: 0 4px 15px rgba(11, 15, 23, 0.3); transform: translateY(-2px); }

        .nav-link { color: #ffffff; text-decoration: none; transition: 0.2s; font-weight: 600; font-size: 0.95rem; }
        .nav-link:hover { color: #c5a880 !important; }

        .footer-link { color: #94a3b8; text-decoration: none; font-size: 0.9rem; }
        .footer-link:hover { color: #ffffff; }

        /* Блоки з контентом 50/50 */
        .split-section { display: grid; grid-template-columns: 1fr 1fr; gap: 5rem; align-items: center; padding: 6rem 0; }
        .split-img-wrapper { border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.08); height: 500px; }
        .split-img { width: 100%; height: 100%; object-fit: cover; }

        .feature-check { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; color: #475569; font-weight: 500; fontSize: 1.05rem; }
      `}</style>

      {/* 1. БІЗНЕС ХЕДЕР */}
      <header style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '72px',
        backgroundColor: scrolled ? '#0b0f17' : 'transparent',
        borderBottom: scrolled ? '1px solid #1e293b' : 'none',
        zIndex: 100, display: 'flex', alignItems: 'center',
        boxShadow: scrolled ? '0 10px 30px rgba(0,0,0,0.5)' : 'none'
      }} className="anim">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '3rem' }}>
            <Link href="/" style={{ fontSize: '1.6rem', fontWeight: '900', color: '#c5a880', letterSpacing: '-0.04em', textDecoration: 'none' }}>
              Book<span style={{ color: '#ffffff' }}>Era</span>
              <span style={{ fontSize: '0.85rem', color: '#e2e8f0', marginLeft: '6px', fontWeight: '500', letterSpacing: 'normal' }}>Business</span>
            </Link>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}>
            <Link href="/" className="nav-link anim" style={{ transition: '0.2s' }}>Для клієнтів</Link>
            <Link href="/cabinet" className="nav-link anim" style={{ color: '#c5a880', cursor: 'pointer', transition: '0.2s' }}>Увійти</Link>
          </div>

        </div>
      </header>

      {/* 2. HERO СЕКЦІЯ */}
      <section style={{ position: 'relative', width: '100%', height: '700px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
          {/* Градієнтне затемнення */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(90deg, rgba(11,15,23,0.95) 0%, rgba(11,15,23,0.7) 50%, rgba(11,15,23,0.3) 100%)', zIndex: 2 }}></div>
          {/* Фонове фото преміум салону */}
          <img
            src="https://images.unsplash.com/photo-1622286342621-4bd786c2447c?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80"
            alt="Salon Professional"
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }}
          />
        </div>

        <div className="container" style={{ position: 'relative', zIndex: 10 }}>
          <div style={{ maxWidth: '650px' }}>
            <div style={{ display: 'inline-block', border: '1px solid rgba(197, 168, 128, 0.4)', color: '#c5a880', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.05em', marginBottom: '1.5rem', textTransform: 'uppercase' }}>
              Універсальне рішення
            </div>
            <h1 style={{ fontSize: '3.5rem', fontWeight: '900', color: '#ffffff', lineHeight: '1.15', marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>
              Бізнес-додаток, створений для барберів та салонів
            </h1>
            <p style={{ color: '#e2e8f0', fontSize: '1.15rem', lineHeight: '1.6', marginBottom: '2.5rem' }}>
              Відкрийте нові можливості для свого бізнесу. Онлайн-запис, розумний календар, захист від неявок та інструменти маркетингу в одній екосистемі BookEra Business.
            </p>
            <Link href="/cabinet">
              <button className="btn-gold anim" style={{ padding: '1rem 2.5rem', borderRadius: '10px', fontSize: '1.05rem' }}>
                Почати безкоштовно
              </button>
            </Link>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '1rem' }}>
              Не потрібна кредитна картка. 14 днів безкоштовного тестування.
            </p>
          </div>
        </div>
      </section>

      {/* 3. СТАТИСТИКА (By the numbers) */}
      <section style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '4rem 0' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#0b0f17', marginBottom: '0.5rem' }}>24/7</div>
              <div style={{ color: '#64748b', fontWeight: '600' }}>Доступність для запису клієнтів</div>
            </div>
            <div>
              <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#0b0f17', marginBottom: '0.5rem' }}>-40%</div>
              <div style={{ color: '#64748b', fontWeight: '600' }}>Зменшення неявок (No-shows)</div>
            </div>
            <div>
              <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#0b0f17', marginBottom: '0.5rem' }}>+25%</div>
              <div style={{ color: '#64748b', fontWeight: '600' }}>Зростання кількості нових клієнтів</div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. БЛОКИ З ПЕРЕВАГАМИ (Як у Booksy) */}
      <section className="container">

        {/* Блок 1: Онлайн-запис */}
        <div className="split-section">
          <div className="split-img-wrapper">
            <img src="https://images.unsplash.com/photo-1560066984-138dadb4c035?ixlib=rb-4.0.3&auto=format&fit=crop&w=1074&q=80" alt="Online Booking" className="split-img" />
          </div>
          <div>
            <h2 style={{ fontSize: '2.2rem', fontWeight: '800', color: '#0f172a', marginBottom: '1.25rem', lineHeight: '1.2' }}>
              Заповнений календар без зайвих дзвінків
            </h2>
            <p style={{ color: '#64748b', fontSize: '1.05rem', lineHeight: '1.6', marginBottom: '2rem' }}>
              Ваш бізнес працює навіть коли ви спите. Дозвольте клієнтам бачити ваш вільний час та записуватись самостійно 24 години на добу, 7 днів на тиждень.
            </p>

            <div className="feature-check">
              <span style={{ color: '#c5a880', fontSize: '1.2rem' }}>✔</span> Професійна сторінка запису
            </div>
            <div className="feature-check">
              <span style={{ color: '#c5a880', fontSize: '1.2rem' }}>✔</span> Інтеграція з Instagram та Google
            </div>
            <div className="feature-check">
              <span style={{ color: '#c5a880', fontSize: '1.2rem' }}>✔</span> Автоматичні нагадування клієнтам
            </div>
          </div>
        </div>

        {/* Блок 2: Захист від неявок */}
        <div className="split-section" style={{ borderTop: '1px solid #f1f5f9' }}>
          <div>
            <h2 style={{ fontSize: '2.2rem', fontWeight: '800', color: '#0f172a', marginBottom: '1.25rem', lineHeight: '1.2' }}>
              Захистіть свій час та дохід від неявок
            </h2>
            <p style={{ color: '#64748b', fontSize: '1.05rem', lineHeight: '1.6', marginBottom: '2rem' }}>
              Клієнти забувають про візит? Налаштуйте правила скасування та беріть передоплату. BookEra бере на себе всю неприємну роботу з гарантії вашого доходу.
            </p>

            <div className="feature-check">
              <span style={{ color: '#c5a880', fontSize: '1.2rem' }}>✔</span> Правила скасування бронювань
            </div>
            <div className="feature-check">
              <span style={{ color: '#c5a880', fontSize: '1.2rem' }}>✔</span> Безпечні онлайн-платежі
            </div>
            <div className="feature-check">
              <span style={{ color: '#c5a880', fontSize: '1.2rem' }}>✔</span> Чорний список проблемних клієнтів
            </div>
          </div>
          <div className="split-img-wrapper">
            <img src="https://images.unsplash.com/photo-1599351431202-1e0f0137899a?ixlib=rb-4.0.3&auto=format&fit=crop&w=1074&q=80" alt="No-show protection" className="split-img" />
          </div>
        </div>

      </section>

      {/* 5. ФІНАЛЬНИЙ ЗАКЛИК ДО ДІЇ */}
      <section style={{ backgroundColor: '#0b1120', padding: '6rem 0', textAlign: 'center' }}>
        <div className="container">
          <h2 style={{ fontSize: '2.8rem', fontWeight: '900', color: '#ffffff', marginBottom: '1.5rem', letterSpacing: '-0.02em' }}>
            Готові вивести бізнес на новий рівень?
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto 2.5rem auto', lineHeight: '1.6' }}>
            Приєднуйтесь до платформи BookEra Business. Усі функції включено. Жодних прихованих платежів чи сюрпризів.
          </p>
          <Link href="/cabinet">
            <button className="btn-gold anim" style={{ padding: '1rem 3rem', borderRadius: '10px', fontSize: '1.1rem' }}>
              Створити кабінет компанії
            </button>
          </Link>
        </div>
      </section>

      {/* 6. ФУТЕР (Точно такий як на всьому сайті) */}
      <footer style={{ backgroundColor: '#05070a', borderTop: '1px solid #1e293b', padding: '4rem 0 3rem 0' }}>
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