// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Лаконічні категорії
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

export default function HomePage() {
  const [scrollState, setScrollState] = useState('top');
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchWhat, setSearchWhat] = useState('');
  const [searchWhere, setSearchWhere] = useState('Львів');

  // Хедер випливає ТІЛЬКИ коли зникає основний пошук (скрол > 400)
  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      if (y < 50) {
        setScrollState('top'); // Верхівка: прозорий, без пошуку
      } else if (y >= 50 && y < 500) {
        setScrollState('hidden'); // Ховаємо хедер, поки скролимо відео
      } else {
        setScrollState('scrolled'); // Відео пройшло: випливає темний з пошуком
      }
    };
    window.addEventListener('scroll', handleScroll);
    loadBusinesses();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const loadBusinesses = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8001/businesses/all');
      if (res.ok) {
        setBusinesses(await res.json());
      }
    } catch (error) {
      console.error("Помилка завантаження закладів:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#0f172a' }}>

      <style>{`
        .container { max-width: 1340px; margin: 0 auto; padding: 0 4rem; width: 100%; box-sizing: border-box; }

        .anim { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); }
        .btn-gold { background-color: #c5a880 !important; color: #0b0f17 !important; font-weight: 750; }
        .btn-gold:hover { background-color: #b39369 !important; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(197, 168, 128, 0.3); }

        .nav-link { color: #ffffff; text-decoration: none; transition: 0.2s; font-weight: 600; font-size: 0.9rem; }
        .nav-link:hover { color: #c5a880 !important; }

        /* Лаконічні текстові категорії для світлого фону */
        .category-text-link {
          color: #64748b;
          font-weight: 650;
          font-size: 0.95rem;
          text-decoration: none;
          white-space: nowrap;
          position: relative;
          padding-bottom: 6px;
          transition: color 0.3s;
        }
        .category-text-link::after {
          content: ''; position: absolute; width: 0; height: 2px; bottom: 0; left: 0;
          background-color: #c5a880; transition: width 0.3s;
        }
        .category-text-link:hover { color: #0f172a; }
        .category-text-link:hover::after { width: 100%; }

        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        /* Картки закладів */
        .premium-card { background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.03); cursor: pointer; }
        .premium-card:hover { transform: translateY(-5px); border-color: #c5a880; box-shadow: 0 12px 30px rgba(197, 168, 128, 0.15); }

        /* Картки додатків (Світла тема - тепер частина сторінки, а не футера) */
        .app-promo-card {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          padding: 4rem 3rem;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          box-shadow: 0 4px 20px rgba(0,0,0,0.02);
        }
        .app-promo-card:hover {
          border-color: #c5a880;
          box-shadow: 0 10px 30px rgba(197, 168, 128, 0.1);
          transform: translateY(-4px);
        }

        .footer-link { color: #94a3b8; text-decoration: none; font-size: 0.9rem; }
        .footer-link:hover { color: #ffffff; }
      `}</style>

      {/* 1. РОЗУМНА НАВІГАЦІЙНА ПАНЕЛЬ (HEADER) */}
      <header style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '72px',
        backgroundColor: scrollState === 'scrolled' ? '#0b0f17' : 'transparent',
        borderBottom: scrollState === 'scrolled' ? '1px solid #1e293b' : 'none',
        zIndex: 100, display: 'flex', alignItems: 'center',
        boxShadow: scrollState === 'scrolled' ? '0 10px 30px rgba(0,0,0,0.5)' : 'none',
        transform: scrollState === 'hidden' ? 'translateY(-100%)' : 'translateY(0)',
        transition: 'transform 0.3s ease-in-out, background-color 0.3s ease-in-out'
      }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

          <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#c5a880', letterSpacing: '-0.04em', cursor: 'pointer' }} onClick={() => window.location.href = '/'}>
            Book<span style={{ color: '#ffffff' }}>Era</span>
          </div>

          {/* Міні-пошук: з'являється ТІЛЬКИ в стані 'scrolled' */}
          <div style={{
            display: 'flex', gap: '0.25rem', backgroundColor: '#ffffff', padding: '0.35rem', borderRadius: '8px',
            maxWidth: '540px', width: '100%', margin: '0 2rem',
            opacity: scrollState === 'scrolled' ? 1 : 0,
            visibility: scrollState === 'scrolled' ? 'visible' : 'hidden',
            border: '1px solid #e2e8f0', boxSizing: 'border-box',
            transition: 'opacity 0.3s ease-in-out'
          }}>
            <input type="text" placeholder="Послуга, бренд або салон" value={searchWhat} onChange={(e) => setSearchWhat(e.target.value)} style={{ flex: '1 1 auto', minWidth: 0, padding: '0.4rem 0.75rem', border: 'none', outline: 'none', fontSize: '0.85rem', color: '#0f172a', backgroundColor: 'transparent' }} />
            <div style={{ width: '1px', height: '24px', backgroundColor: '#e2e8f0', alignSelf: 'center' }}></div>
            <input type="text" value={searchWhere} onChange={(e) => setSearchWhere(e.target.value)} style={{ flex: '0 1 120px', minWidth: 0, padding: '0.4rem 0.75rem', border: 'none', outline: 'none', fontSize: '0.85rem', fontWeight: '700', color: '#c5a880', backgroundColor: 'transparent' }} />
            <button className="btn-gold" style={{ flexShrink: 0, border: 'none', padding: '0.4rem 1.25rem', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap', transition: '0.2s' }}>Знайти</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}>
            <Link href="/business" className="nav-link" style={{ transition: '0.2s' }}>Для бізнесу</Link>
            <span className="nav-link" style={{ color: '#c5a880', cursor: 'pointer', transition: '0.2s' }}>Увійти</span>
          </div>

        </div>
      </header>

      {/* 2. HERO БАНЕР З ВІДЕО ТА ФОРМОЮ */}
      <section style={{ position: 'relative', width: '100%', height: '540px', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(11, 15, 23, 0.75)', zIndex: 2 }}></div>
          <video playsInline autoPlay muted loop style={{ width: '100%', height: '100%', objectFit: 'cover' }}>
            <source src="https://booksy-public.s3.amazonaws.com/horizontal_.webm" type="video/webm" />
            <source src="https://booksy-public.s3.amazonaws.com/US.mp4" type="video/mp4" />
          </video>
        </div>

        <div style={{ position: 'relative', zIndex: 10, maxWidth: '1340px', width: '100%', margin: '0 auto', padding: '4rem 4rem 0 4rem', boxSizing: 'border-box', textAlign: 'center' }}>
          <div style={{ color: '#c5a880', fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Будь впевненим у своєму стилі</div>
          <h1 style={{ fontSize: '2.6rem', fontWeight: '800', color: '#ffffff', maxWidth: '750px', margin: '0 auto 2.5rem auto', lineHeight: '1.25', letterSpacing: '-0.02em' }}>
            Знайди свого майстра та бронюй послуги краси в один клік
          </h1>

          {/* Головний пошуковий віджет (Світлий для контрасту) */}
          <div style={{
            backgroundColor: '#ffffff', padding: '6px', borderRadius: '12px', border: '1px solid #e2e8f0',
            maxWidth: '840px', width: '100%', margin: '0 auto', display: 'flex', alignItems: 'center', boxSizing: 'border-box', boxShadow: '0 20px 40px rgba(0,0,0,0.15)'
          }}>
            <div style={{ flex: 1.3, display: 'flex', alignItems: 'center', padding: '0 0.75rem' }}>
              <span style={{ marginRight: '0.5rem', opacity: 0.6 }}>🔍</span>
              <input type="text" placeholder="Послуга, бренд або салон" value={searchWhat} onChange={(e) => setSearchWhat(e.target.value)} style={{ width: '100%', border: 'none', outline: 'none', color: '#0f172a', fontSize: '0.95rem', backgroundColor: 'transparent' }} />
            </div>
            <div style={{ width: '1px', height: '24px', backgroundColor: '#e2e8f0' }}></div>
            <div style={{ flex: 0.9, display: 'flex', alignItems: 'center', padding: '0 0.75rem' }}>
              <span style={{ marginRight: '0.5rem', opacity: 0.6 }}>📍</span>
              <input type="text" value={searchWhere} onChange={(e) => setSearchWhere(e.target.value)} style={{ width: '100%', border: 'none', outline: 'none', color: '#0f172a', fontSize: '0.95rem', fontWeight: '600', backgroundColor: 'transparent' }} />
            </div>
            <div style={{ width: '1px', height: '24px', backgroundColor: '#e2e8f0' }}></div>
            <div style={{ flex: 0.8, display: 'flex', alignItems: 'center', padding: '0 0.75rem' }}>
              <span style={{ marginRight: '0.5rem', opacity: 0.6 }}>📅</span>
              <span style={{ color: '#64748b', fontSize: '0.95rem', cursor: 'pointer' }}>Будь-коли</span>
            </div>
            <button className="btn-gold anim" style={{ padding: '0.75rem 2rem', borderRadius: '8px', border: 'none', fontSize: '0.95rem', cursor: 'pointer' }}>
              Пошук
            </button>
          </div>
        </div>
      </section>

      {/* 3. КАТЕГОРІЇ ПОСЛУГ */}
      <section className="container" style={{ paddingTop: '2.5rem', paddingBottom: '3.5rem' }}>
        <div className="hide-scrollbar" style={{ display: 'flex', gap: '2.5rem', overflowX: 'auto', justifyContent: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.5rem' }}>
          {categoriesData.map((cat) => (
            <Link key={cat.slug} href={`/s/${cat.slug}`} className="category-text-link anim">
              {cat.name}
            </Link>
          ))}
          <Link href="/categories" className="category-text-link anim" style={{ color: '#c5a880' }}>
            Більше...
          </Link>
        </div>
      </section>

      {/* 4. РЕКОМЕНДОВАНІ ЗАКЛАДИ */}
      <section className="container" style={{ paddingBottom: '5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
            Рекомендовані майстри та студії
          </h2>
          <span className="anim" style={{ color: '#b39369', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem' }}>
            Дивитись всі →
          </span>
        </div>

        {loading ? (
          <div style={{ color: '#b39369', padding: '4rem 0', textAlign: 'center', fontWeight: '650' }}>Завантаження актуальної бази салонів...</div>
        ) : businesses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', backgroundColor: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
            <h3 style={{ color: '#0f172a', fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.5rem' }}>Локації ще не додано</h3>
            <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Станьте першим, хто розмістить свій бізнес на платформі.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}>
            {businesses.map((biz: any) => (
              <Link key={biz.slug} href={`/salon/${biz.slug}`} className="anim premium-card" style={{ textDecoration: 'none' }}>
                <div style={{ height: '200px', backgroundColor: '#f1f5f9', position: 'relative' }}>
                  <img
                    src={biz.thumbnail_photo || "https://d2zdpiztbgorvt.cloudfront.net/region1/us/481342/biz_photo/5f28c4906bb6475692f485b86f7147-flawless-fades-hair-systems-in-biz-photo-c643db9da71d4eea86e3e9ef3f4dc6-booksy.jpeg?size=640x427"}
                    alt={biz.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{ position: 'absolute', top: '12px', right: '12px', backgroundColor: '#ffffff', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                    <span style={{ color: '#fbbf24' }}>★</span> {biz.reviews_rank ? biz.reviews_rank.toFixed(1) : '5.0'}
                  </div>
                </div>
                <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: '0 0 0.4rem 0', color: '#0f172a' }}>{biz.name}</h3>
                  <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 1.25rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    📍 {biz.address}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>{biz.reviews_count || 0} відгуків</span>
                    <button className="anim" style={{ backgroundColor: '#f8fafc', color: '#0f172a', border: '1px solid #e2e8f0', padding: '0.4rem 1.25rem', borderRadius: '6px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>
                      Записатись
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 5. БЛОКИ ПРО ДОДАТКИ ТА БІЗНЕС (Тепер частина світлого контенту!) */}
      <section style={{ backgroundColor: '#ffffff', padding: '2rem 0 6rem 0' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '2rem' }}>

            {/* Картка для Клієнтів */}
            <div className="app-promo-card anim">
              <div style={{ color: '#c5a880', fontSize: '1rem', fontWeight: '700', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📱</span> Додаток BookEra
              </div>
              <h2 style={{ fontSize: '2.2rem', fontWeight: '800', color: '#0f172a', marginBottom: '1.5rem', lineHeight: '1.2' }}>
                Знаходьте та бронюйте візити миттєво
              </h2>
              <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: '1.6', marginBottom: '2.5rem', maxWidth: '350px' }}>
                Забудьте про дзвінки. Обирайте послугу, зручний час та записуйтесь у будь-який час, де б ви не знаходились.
              </p>
              <button className="btn-gold anim" style={{ padding: '1rem 3rem', borderRadius: '10px', fontSize: '1rem', border: 'none', cursor: 'pointer' }}>
                Завантажити
              </button>
            </div>

            {/* Картка для Бізнесу */}
            <div className="app-promo-card anim">
              <div style={{ color: '#c5a880', fontSize: '1rem', fontWeight: '700', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🏛️</span> BookEra Pro
              </div>
              <h2 style={{ fontSize: '2.2rem', fontWeight: '800', color: '#0f172a', marginBottom: '1.5rem', lineHeight: '1.2' }}>
                BookEra для вашого бізнесу
              </h2>
              <p style={{ color: '#64748b', fontSize: '1rem', lineHeight: '1.6', marginBottom: '2.5rem', maxWidth: '350px' }}>
                Отримайте сучасні інструменти для керування розкладом, клієнтами та маркетингом. Все в одній системі.
              </p>
              <Link href="/business" style={{ width: '100%', maxWidth: 'max-content' }}>
                <button className="anim" style={{ backgroundColor: '#0f172a', color: '#ffffff', padding: '1rem 3rem', borderRadius: '10px', fontSize: '1rem', fontWeight: '700', border: 'none', cursor: 'pointer', width: '100%' }}>
                  Розвивати бізнес
                </button>
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* 6. ФУТЕР (Темний, як і раніше) */}
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