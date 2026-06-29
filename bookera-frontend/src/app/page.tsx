// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchWhat, setSearchWhat] = useState('');
  const [searchWhere, setSearchWhere] = useState('Львів');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
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

  const categories = [
    { name: 'Волосся', slug: 'hair-salon' },
    { name: 'Барбер', slug: 'barber-shop' },
    { name: 'Нігті', slug: 'nail-salon' },
    { name: 'Догляд за шкірою', slug: 'skin-care' },
    { name: 'Брови та вії', slug: 'brows-lashes' },
    { name: 'Масаж', slug: 'massage' },
    { name: 'Макіяж', slug: 'makeup' },
    { name: 'Wellness & Spa', slug: 'wellness-day-spa' }
  ];

  return (
    <div style={{ backgroundColor: '#0b0f17', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#ffffff' }}>

      <style>{`
        .anim { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); }
        .btn-gold { background-color: #c5a880 !important; color: #0b0f17 !important; font-weight: 750; }
        .btn-gold:hover { background-color: #b39369 !important; transform: scale(1.02); }
        .nav-link:hover { color: #c5a880 !important; }
        .category-tab { color: rgba(255,255,255,0.7); font-weight: 600; font-size: 0.95rem; text-decoration: none; padding-bottom: 0.5rem; border-bottom: 2px solid transparent; cursor: pointer; white-space: nowrap; }
        .category-tab:hover { color: #c5a880; border-color: #c5a880; }
        .premium-card { background-color: #111622; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.2); }
        .premium-card:hover { transform: translateY(-5px); border-color: #c5a880; box-shadow: 0 12px 30px rgba(197, 168, 128, 0.1); }
        .footer-link { color: #94a3b8; text-decoration: none; font-size: 0.9rem; }
        .footer-link:hover { color: #ffffff; }
      `}</style>

      {/* 1. ВЕРХНЯ НАВІГАЦІЙНА ПАНЕЛЬ (HEADER) */}
      <header style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '72px',
        backgroundColor: scrolled ? '#0b0f17' : 'transparent',
        borderBottom: scrolled ? '1px solid #1e293b' : 'none',
        zIndex: 100, display: 'flex', alignItems: 'center',
        boxShadow: scrolled ? '0 10px 30px rgba(0,0,0,0.3)' : 'none'
      }} className="anim">
        <div style={{ maxWidth: '1340px', width: '100%', margin: '0 auto', padding: '0 4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box' }}>

          {/* Логотип */}
          <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#c5a880', letterSpacing: '-0.04em', cursor: 'pointer' }} onClick={() => window.location.href = '/'}>
            Book<span style={{ color: '#ffffff' }}>Era</span>
          </div>

          {/* Компактний пошуковий рядок в хедері (активується при скролі) */}
          <div style={{
            display: 'flex', gap: '0.25rem', backgroundColor: '#111622', padding: '0.35rem', borderRadius: '8px',
            maxWidth: '460px', width: '100%', margin: '0 2rem', opacity: scrolled ? 1 : 0,
            transform: scrolled ? 'translateY(0)' : 'translateY(-10px)', visibility: scrolled ? 'visible' : 'hidden', border: '1px solid #1e293b'
          }} className="anim">
            <input type="text" placeholder="Яку послугу шукаєте?" value={searchWhat} onChange={(e) => setSearchWhat(e.target.value)} style={{ flex: 1, padding: '0.4rem 0.75rem', border: 'none', outline: 'none', fontSize: '0.85rem', color: '#fff', backgroundColor: 'transparent' }} />
            <input type="text" value={searchWhere} onChange={(e) => setSearchWhere(e.target.value)} style={{ width: '90px', padding: '0.4rem 0.75rem', border: 'none', borderLeft: '1px solid #1e293b', outline: 'none', fontSize: '0.85rem', fontWeight: '600', color: '#c5a880', backgroundColor: 'transparent' }} />
            <button className="btn-gold anim" style={{ border: 'none', padding: '0 0.85rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>Знайти</button>
          </div>

          {/* Блок авторизації та лістингу бізнесу */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}>
            <span className="nav-link anim" style={{ fontSize: '0.9rem', fontWeight: '600', color: '#ffffff', cursor: 'pointer' }} onClick={() => window.location.href = '/business'}>Додати свій бізнес</span>
            <span className="nav-link anim" style={{ fontSize: '0.9rem', fontWeight: '600', color: '#c5a880', cursor: 'pointer' }}>Увійти</span>
          </div>

        </div>
      </header>

      {/* 2. ВЕЛИКИЙ HERO БАНЕР З ВІДЕО ТА ФОРМОЮ ЦЕНТРОВАНОГО ПОШУКУ */}
      <section style={{ position: 'relative', width: '100%', height: '540px', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>

        {/* Фонове відео з контейнером затемнення */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1 }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(11, 15, 23, 0.72)', zIndex: 2 }}></div>
          <video playsInline autoPlay muted loop style={{ width: '100%', height: '100%', objectFit: 'cover' }}>
            <source src="https://booksy-public.s3.amazonaws.com/horizontal_.webm" type="video/webm" />
            <source src="https://booksy-public.s3.amazonaws.com/US.mp4" type="video/mp4" />
          </video>
        </div>

        {/* Контент поверх відео (Пошукова панель за структурою Booksy) */}
        <div style={{ position: 'relative', zIndex: 10, maxWidth: '1340px', width: '100%', margin: '0 auto', padding: '4rem 4rem 0 4rem', boxSizing: 'border-box', textAlign: 'center' }}>
          <div style={{ color: '#c5a880', fontSize: '1.1rem', fontWeight: '700', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Будь впевненим у своєму стилі</div>
          <h1 style={{ fontSize: '2.6rem', fontWeight: '800', maxWidth: '750px', margin: '0 auto 2.5rem auto', lineHeight: '1.25', letterSpacing: '-0.02em' }}>
            Знайди свого майстра та бронюй послуги краси в один клік
          </h1>

          {/* Головний симетричний пошуковий віджет */}
          <div style={{
            backgroundColor: '#111622', padding: '6px', borderRadius: '12px', border: '1px solid #1e293b',
            maxWidth: '840px', width: '100%', margin: '0 auto 2.5rem auto', display: 'flex', alignItems: 'center', boxSizing: 'border-box'
          }}>
            <div style={{ flex: 1.3, display: 'flex', alignItems: 'center', padding: '0 0.75rem' }}>
              <span style={{ marginRight: '0.5rem', opacity: 0.6 }}>🔍</span>
              <input type="text" placeholder="Послуга, бренд або салон" value={searchWhat} onChange={(e) => setSearchWhat(e.target.value)} style={{ width: '100%', border: 'none', outline: 'none', color: '#fff', fontSize: '0.95rem', backgroundColor: 'transparent' }} />
            </div>
            <div style={{ width: '1px', height: '24px', backgroundColor: '#1e293b' }}></div>
            <div style={{ flex: 0.9, display: 'flex', alignItems: 'center', padding: '0 0.75rem' }}>
              <span style={{ marginRight: '0.5rem', opacity: 0.6 }}>📍</span>
              <input type="text" value={searchWhere} onChange={(e) => setSearchWhere(e.target.value)} style={{ width: '100%', border: 'none', outline: 'none', color: '#fff', fontSize: '0.95rem', fontWeight: '600', backgroundColor: 'transparent' }} />
            </div>
            <div style={{ width: '1px', height: '24px', backgroundColor: '#1e293b' }}></div>
            <div style={{ flex: 0.8, display: 'flex', alignItems: 'center', padding: '0 0.75rem' }}>
              <span style={{ marginRight: '0.5rem', opacity: 0.6 }}>📅</span>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem', cursor: 'pointer' }}>Будь-коли</span>
            </div>
            <button className="anim btn-gold" style={{ padding: '0.75rem 2rem', borderRadius: '8px', border: 'none', fontSize: '0.95rem', cursor: 'pointer' }}>
              Пошук
            </button>
          </div>

          {/* Горизонтальна лінія категорій */}
          <div style={{ display: 'flex', gap: '1.75rem', overflowX: 'auto', width: '100%', paddingBottom: '0.25rem' }}>
            {categories.map((cat) => (
              <a key={cat.name} href={`/s/${cat.slug}`} className="category-tab anim">
                {cat.name}
              </a>
            ))}
            <span className="category-tab anim" style={{ color: '#c5a880' }}>Більше...</span>
          </div>

        </div>
      </section>

      {/* 3. ОСНОВНИЙ КОНТЕНТ СТОРІНКИ (РЕКОМЕНДОВАНІ ЗАКЛАДИ) */}
      <main style={{ maxWidth: '1340px', margin: '3.5rem auto 6rem auto', padding: '0 4rem', boxSizing: 'border-box' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>Рекомендовані майстри та студії</h2>
          <span style={{ color: '#c5a880', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem' }}>Дивитись всі →</span>
        </div>

        {loading ? (
          <div style={{ color: '#c5a880', padding: '4rem 0', textAlign: 'center', fontWeight: '650' }}>Завантаження актуальної бази салонів...</div>
        ) : businesses.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', backgroundColor: '#111622', borderRadius: '16px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '1rem' }}>🏛️</span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '0.5rem' }}>Локації ще не додано</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', maxWidth: '420px', margin: '0 auto', lineHeight: '1.5' }}>
              База даних успішно підключена. Перейдіть у кабінет бізнесу, щоб зареєструвати першу філію у Львові.
            </p>
          </div>
        ) : (
          /* Адаптивна CSS-сітка карток замість зламаного леяуту */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '2rem' }}>
            {businesses.map((biz: any) => (
              <div key={biz.slug} className="anim premium-card" onClick={() => window.location.href = `/salon/${biz.slug}`}>

                {/* Зображення / Заглушка картки закладу */}
                <div style={{ height: '190px', backgroundColor: '#1e293b', position: 'relative' }}>
                  <img
                    src={biz.thumbnail_photo || "https://d2zdpiztbgorvt.cloudfront.net/region1/us/481342/biz_photo/5f28c4906bb6475692f485b86f7147-flawless-fades-hair-systems-in-biz-photo-c643db9da71d4eea86e3e9ef3f4dc6-booksy.jpeg?size=640x427"}
                    alt={biz.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{ position: 'absolute', top: '12px', right: '12px', backgroundColor: '#0b0f17', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '700', color: '#c5a880', border: '1px solid #1e293b' }}>
                    ★ 5.0
                  </div>
                </div>

                {/* Текстовий контент картки */}
                <div style={{ padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.4rem' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: '#ffffff' }}>{biz.name}</h3>
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 1.25rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {biz.address}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #1e293b', paddingTop: '0.9rem' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{biz.reviews_count || 0} відгуків</span>
                    <button className="btn-gold anim" style={{ border: 'none', padding: '0.45rem 1.25rem', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>Записатись</button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

        {/* 4. СЕКЦІЯ ЗАВАНТАЖЕННЯ МОБІЛЬНИХ ДОДАТКІВ (ОБРОБЛЕНИЙ ДИЗАЙН) */}
        <section style={{ marginTop: '6rem', backgroundColor: '#111622', borderRadius: '16px', border: '1px solid #1e293b', padding: '3.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem' }}>

            {/* Для клієнтів */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '2rem' }}>📱</span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0 }}>Додаток BookEra для клієнтів</h3>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
                Забудь про нескінченні дзвінки. Знаходь найкращі студії свого міста, переглядай вільні вікна улюблених майстрів та бронюй візити миттєво.
              </p>
              <button className="anim btn-gold" style={{ border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontSize: '0.9rem', cursor: 'pointer' }}>Завантажити додаток</button>
            </div>

            {/* Для бізнесу */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '2rem' }}>🏛️</span>
                <h3 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0 }}>BookEra Pro для твого бізнесу</h3>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
                Отримай повний контроль над завантаженням локації. Електронний календар, онлайн-запис клієнтів 24/7, автоматичні нагадування та маркетинг в одній системі.
              </p>
              <button className="anim" style={{ backgroundColor: '#ffffff', color: '#0b0f17', fontWeight: '750', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontSize: '0.9rem', cursor: 'pointer' }} onClick={() => window.location.href = '/business'}>Розвивати бізнес</button>
            </div>

          </div>
        </section>

        {/* 5. СЕО ТЕКСТОВА СЕКЦІЯ */}
        <section style={{ marginTop: '5rem', borderTop: '1px solid #1e293b', paddingTop: '3rem' }}>
          <h3 style={{ fontSize: '1.3rem', fontWeight: '800', marginBottom: '1rem' }}>Онлайн-бронювання нового покоління</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.6', maxWidth: '900px' }}>
            Шукаєш топовий барбершоп, салон краси, майстра манікюру чи професійний масаж у Львові? Наша екосистема робить процес запису до фахівців максимально швидким. Більше ніяких узгоджень графіків у месенджерах. Обирай послугу, перевіряй відгуки реальних клієнтів та керуй своїм часом самостійно в режимі реального часу.
          </p>
        </section>

      </main>

      {/* 6. ФУТЕР (FOOTER) */}
      <footer style={{ backgroundColor: '#070a10', borderTop: '1px solid #1e293b', padding: '3.5rem 0' }}>
        <div style={{ maxWidth: '1340px', margin: '0 auto', padding: '0 4rem', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '2rem' }}>

            <nav style={{ display: 'flex', gap: '4rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <a href="#" className="footer-link anim">Блог</a>
                <a href="#" className="footer-link anim">Про нас</a>
                <a href="#" className="footer-link anim">Часті питання (FAQ)</a>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <a href="#" className="footer-link anim">Умови використання</a>
                <a href="#" className="footer-link anim">Політика конфіденційності</a>
                <a href="#" className="footer-link anim">Контакти підтримки</a>
              </div>
            </nav>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: '900', color: '#c5a880', marginBottom: '0.5rem' }}>BookEra</div>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>© 2026 Створено для найкращих сервісів.</span>
            </div>

          </div>
        </div>
      </footer>

    </div>
  );
}