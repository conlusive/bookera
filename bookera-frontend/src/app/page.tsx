'use client';

import { useState, useEffect } from 'react';

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [businesses, setBusinesses] = useState<any[]>([]);

  // 1. Відстежуємо скрол до рівня закінчення Hero-блоку (~500px)
  useEffect(() => {
    const handleScroll = () => {
      const currentScroll = window.scrollY || document.documentElement.scrollTop;
      console.log("Поточна позиція скролу (px):", currentScroll);

      if (currentScroll > 500) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    handleScroll();

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 2. КЛІЄНТСЬКА ВИГРУЗКА ДАНИХ (127.0.0.1:8001)
  useEffect(() => {
    async function loadBusinesses() {
      try {
        console.log("Надсилаємо запит до бекенду на http://127.0.0.1:8001/businesses/all ...");
        const res = await fetch('http://127.0.0.1:8001/businesses/all');

        if (res.ok) {
          const data = await res.json();
          console.log("Успішно отримано салони з бази даних:", data);
          setBusinesses(data);
        } else {
          console.error("Бекенд відповів, але повернув помилку. Статус:", res.status);
        }
      } catch (error) {
        console.error("Мережева помилка! Не вдалося достукатися до API:", error);
      }
    }
    loadBusinesses();
  }, []);

  const categories = [
    { name: 'Барбершопи', icon: '💇‍♂️', count: '142 заклади' },
    { name: 'Нігтьова естетика', icon: '💅', count: '98 закладів' },
    { name: 'Брови & Вії', icon: '👁️', count: '76 закладів' },
    { name: 'Косметологія', icon: '✨', count: '54 заклади' },
    { name: 'Масаж & SPA', icon: '💆‍♀️', count: '41 заклад' },
    { name: 'Тату студії', icon: '🎨', count: '19 закладів' },
  ];

  return (
    <div style={{ backgroundColor: '#fafafa', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#0b0f17' }}>

      {/* ПРЕМІУМ СТИЛІ ТА ХОВЕРИ */}
      <style>{`
        .anim { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); }
        .category-item:hover {
          border-color: #c5a880 !important;
          transform: translateY(-3px);
          box-shadow: 0 12px 20px rgba(197, 168, 128, 0.08);
        }
        .salon-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 30px rgba(11, 15, 23, 0.06);
        }
        .btn-gold { background-color: #c5a880 !important; color: #05070a !important; }
        .btn-gold:hover { background-color: #b39369 !important; transform: scale(1.02); }
        .input-focus:focus { border-color: #c5a880 !important; }
      `}</style>

      {/* 1. РОЗУМНИЙ ХЕДЕР */}
      <header style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        backgroundColor: scrolled ? '#0b0f17' : 'transparent',
        borderBottom: scrolled ? '1px solid #1e293b' : 'none',
        padding: scrolled ? '0.6rem 4rem' : '1.25rem 4rem',
        zIndex: 100,
        boxShadow: scrolled ? '0 10px 30px rgba(0,0,0,0.2)' : 'none'
      }} className="anim">
        <div style={{ maxWidth: '1340px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

          {/* Логотип */}
          <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#c5a880', letterSpacing: '-0.04em', cursor: 'pointer' }}>
            Book<span style={{ color: '#ffffff' }}>Era</span>
          </div>

          {/* Міні-пошук при скролі */}
          <div style={{
            display: 'flex',
            gap: '0.25rem',
            backgroundColor: '#ffffff',
            padding: '0.35rem',
            borderRadius: '10px',
            maxWidth: '550px',
            width: '100%',
            margin: '0 2rem',
            opacity: scrolled ? 1 : 0,
            transform: scrolled ? 'translateY(0)' : 'translateY(-10px)',
            visibility: scrolled ? 'visible' : 'hidden'
          }} className="anim">
            <input type="text" placeholder="Що шукаєте?" style={{ flex: 1, padding: '0.4rem 0.75rem', border: 'none', outline: 'none', fontSize: '0.9rem', color: '#0b0f17' }} />
            <input type="text" defaultValue="Львів" style={{ width: '100px', padding: '0.4rem 0.75rem', border: 'none', borderLeft: '1px solid #e2e8f0', outline: 'none', fontSize: '0.9rem', fontWeight: '600', color: '#0b0f17' }} />
            <button className="btn-gold" style={{ border: 'none', padding: '0 1.2rem', borderRadius: '7px', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer' }}>Знайти</button>
          </div>

          {/* Правий блок */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <span
  style={{ fontSize: '0.9rem', fontWeight: '600', color: '#c5a880', cursor: 'pointer' }}
  onClick={() => window.location.href = '/business'}
>
  Для бізнесу
</span>
            <button className="anim" style={{ backgroundColor: 'transparent', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#ffffff', padding: '0.55rem 1.25rem', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem' }}>
              Кабінет
            </button>
          </div>
        </div>
      </header>

      {/* 2. МАТОВИЙ HERO БЛОК */}
      <section style={{
        backgroundColor: '#0b0f17',
        color: '#ffffff',
        padding: '11rem 2rem 8rem 2rem',
        textAlign: 'center',
        position: 'relative',
        background: 'radial-gradient(circle at top right, #161f30 0%, #0b0f17 100%)'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <span style={{ border: '1px solid rgba(197, 168, 128, 0.3)', color: '#c5a880', padding: '0.4rem 1.2rem', borderRadius: '30px', fontSize: '0.8rem', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '1.75rem', display: 'inline-block', backgroundColor: 'rgba(197, 168, 128, 0.03)' }}>
            Ексклюзивне бронювання послуг в Україні
          </span>
          <h1 style={{ fontSize: '3.6rem', fontWeight: '800', marginBottom: '1.5rem', letterSpacing: '-0.03em', lineHeight: '1.15' }}>
            Твій час. Твій style. <br/>
            <span style={{ color: '#c5a880' }}>Завжди бездоганно.</span>
          </h1>
          <p style={{ color: '#8f9bba', fontSize: '1.15rem', maxWidth: '600px', margin: '0 auto', lineHeight: '1.6', fontWeight: '400' }}>
            Online-запис до топ-майстрів твого міста. Жодних очікувань чи зайвих дзвінків.
          </p>
        </div>

        {/* ПЛАВАЮЧИЙ ГОЛОВНИЙ ПОШУК */}
        <div style={{
          backgroundColor: '#ffffff',
          padding: '0.6rem',
          borderRadius: '16px',
          boxShadow: '0 30px 60px rgba(5, 7, 10, 0.25)',
          maxWidth: '940px',
          width: 'calc(100% - 4rem)',
          display: 'flex',
          gap: '0.5rem',
          border: '1px solid rgba(255,255,255,0.08)',
          position: 'absolute',
          bottom: '-35px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20
        }}>
          <div style={{ flex: 1.5, display: 'flex', alignItems: 'center', padding: '0.5rem 1rem' }}>
            <span style={{ marginRight: '0.75rem', fontSize: '1.2rem' }}>🔍</span>
            <input type="text" placeholder="Яка послуга чи майстер вас цікавить?" style={{ width: '100%', border: 'none', outline: 'none', color: '#0b0f17', fontSize: '1rem', fontWeight: '500' }} />
          </div>
          <div style={{ width: '1px', backgroundColor: '#e2e8f0', margin: '0.5rem 0' }}></div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0.5rem 1rem' }}>
            <span style={{ marginRight: '0.75rem', fontSize: '1.2rem' }}>📍</span>
            <input type="text" defaultValue="Львів" style={{ width: '100%', border: 'none', outline: 'none', color: '#0b0f17', fontSize: '1rem', fontWeight: '600' }} />
          </div>
          <button className="anim btn-gold" style={{ padding: '1rem 3.5rem', borderRadius: '12px', border: 'none', fontSize: '1rem', fontWeight: '750', cursor: 'pointer', boxShadow: '0 4px 15px rgba(197, 168, 128, 0.25)' }}>
            Знайти заклади
          </button>
        </div>
      </section>

      {/* 3. КАТЕГОРІЇ ПОСЛУГ */}
      <section style={{ maxWidth: '1340px', margin: '7rem auto 0 auto', padding: '0 4rem' }}>
        <h2 style={{ fontSize: '1.6rem', fontWeight: '800', marginBottom: '0.25rem', letterSpacing: '-0.02em' }}>Категорії сервісу</h2>
        <p style={{ color: '#64748b', margin: '0 0 2rem 0', fontSize: '0.9rem' }}>Миттєвий вибір напрямку послуг</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '1.25rem' }}>
          {categories.map((cat) => (
            <div key={cat.name} className="anim category-item" style={{ backgroundColor: '#ffffff', padding: '1.75rem 1.25rem', borderRadius: '14px', border: '1px solid #eef0f3', cursor: 'pointer' }}>
              <div style={{ fontSize: '2.4rem', marginBottom: '1rem' }}>{cat.icon}</div>
              <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#0b0f17', marginBottom: '0.25rem' }}>{cat.name}</div>
              <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: '500' }}>{cat.count}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. ЖИВИЙ СПИСОК ЗАКЛАДІВ З БЕКЕНДУ */}
      <section style={{ maxWidth: '1340px', margin: '5rem auto 0 auto', padding: '0 4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: '800', letterSpacing: '-0.02em' }}>Рекомендовані студії у Львові</h2>
            <p style={{ color: '#64748b', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>Винятковий сервіс за оцінками відвідувачів</p>
          </div>
          <span style={{ color: '#c5a880', fontWeight: '750', cursor: 'pointer', fontSize: '0.95rem' }}>Усі заклади міста →</span>
        </div>

        {businesses.length === 0 ? (
          <div style={{ padding: '6rem 2rem', backgroundColor: '#ffffff', borderRadius: '20px', border: '1px solid #eef0f3', textAlign: 'center' }}>
            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>🏛️</span>
            <p style={{ fontSize: '1.25rem', fontWeight: '700', margin: '0 0 0.5rem 0', color: '#0b0f17' }}>Платформа активована</p>
            <p style={{ color: '#64748b', fontSize: '0.95rem', maxWidth: '420px', margin: '0 auto', lineHeight: '1.6' }}>
              Зв'язок з FastAPI та PostgreSQL стабільний. Наразі база даних порожня. Давай наповнимо її реальними преміум-закладами!
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '2rem' }}>
            {businesses.map((business: any) => (
              /* ЗМІНЕНО: Клік на всю картку перенаправляє на профіль салону */
              <div
                key={business.slug}
                className="anim salon-card"
                style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #eef0f3', overflow: 'hidden', cursor: 'pointer' }}
                onClick={() => window.location.href = `/salon/${business.slug}`}
              >
                <div style={{ height: '210px', background: 'linear-gradient(135deg, #0b0f17 0%, #1e293b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c5a880', fontSize: '4.5rem', position: 'relative' }}>
                  ✨
                  <div style={{ position: 'absolute', top: '1rem', right: '1rem', backgroundColor: '#ffffff', padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', color: '#0b0f17', display: 'flex', alignItems: 'center', gap: '0.25rem', boxShadow: '0 4px 10px rgba(0,0,0,0.08)' }}>
                    ⭐ 4.9
                  </div>
                </div>
                <div style={{ padding: '1.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: '800', margin: 0, letterSpacing: '-0.01em', color: '#0b0f17' }}>{business.name}</h3>
                    <span style={{ color: '#c5a880', fontWeight: '700', fontSize: '1.1rem' }}>від 500 ₴</span>
                  </div>
                  <p style={{ margin: '0 0 1.5rem 0', color: '#475569', fontSize: '0.95rem' }}>
                    📍 {business.address}
                  </p>

                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    <span style={{ backgroundColor: '#f8fafc', color: '#334155', fontSize: '0.75rem', padding: '0.3rem 0.65rem', borderRadius: '6px', fontWeight: '600', border: '1px solid #e2e8f0' }}>Преміум догляд</span>
                    <span style={{ backgroundColor: '#f8fafc', color: '#334155', fontSize: '0.75rem', padding: '0.3rem 0.65rem', borderRadius: '6px', fontWeight: '600', border: '1px solid #e2e8f0' }}>Стиліст</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      Доступно: <span style={{ color: '#0b0f17', fontWeight: '700' }}>Сьогодні з 15:00</span>
                    </div>
                    {/* ЗМІНЕНО: Велику кнопку видалено, натомість додано елегантний текстовий лінк */}
                    <span style={{ color: '#c5a880', fontSize: '0.9rem', fontWeight: '750' }}>
                      Детальніше →
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. B2B МАРКЕТИНГОВИЙ БЛОК */}
      <section style={{ maxWidth: '1340px', margin: '7rem auto 6rem auto', padding: '0 4rem' }}>
        <div style={{ backgroundColor: '#0b0f17', borderRadius: '24px', padding: '4.5rem', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem', background: 'radial-gradient(circle at bottom left, #161f30, #0b0f17)', border: '1px solid rgba(197, 168, 128, 0.15)' }}>
          <div style={{ maxWidth: '650px' }}>
            <h2 style={{ fontSize: '2.2rem', fontWeight: '800', marginBottom: '1rem', letterSpacing: '-0.02em', color: '#ffffff' }}>Розвивайте бізнес разом з BookEra</h2>
            <p style={{ color: '#94a3b8', fontSize: '1.1rem', margin: 0, lineHeight: '1.6' }}>
              Цифрова екосистема для преміальних салонів, barbershop-ів та майстрів. Повний контроль розкладу, CRM, аналітика завантаженості та автоматичні сповіщення клієнтів.
            </p>
          </div>
          <button className="anim btn-gold" style={{ padding: '1.1rem 2.5rem', borderRadius: '12px', border: 'none', fontSize: '1rem', fontWeight: '750', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Зареєструвати заклади
          </button>
        </div>
      </section>

    </div>
  );
}