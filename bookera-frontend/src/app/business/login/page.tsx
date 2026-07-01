// src/app/business/login/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function BusinessLoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Спроба входу:', formData);

    try {
      const response = await fetch('http://127.0.0.1:8001/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Вхід успішний!', data);
        alert(`Вітаємо, ${data.name || 'користувачу'}! Вхід виконано.`);

        // Зберігаємо юзера для кабінету
        localStorage.setItem('userName', data.name || 'Власник');
        localStorage.setItem('userId', data.user_id);

        router.push('/cabinet');
      } else {
        const errorData = await response.json();
        alert(`Помилка: ${errorData.detail || 'Невірні дані'}`);
      }
    } catch (error) {
      console.error('🛑 Помилка мережі:', error);
      alert('Не вдалося з\'єднатися з сервером.');
    }
  }; // <-- Ось ця дужка з крапкою з комою, скоріш за все, загубилась!

  return (
    <div style={{ position: 'relative', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#ffffff', display: 'flex', flexDirection: 'column' }}>

      <style>{`


        .container { max-width: 1340px; margin: 0 auto; padding: 0 4rem; width: 100%; box-sizing: border-box; }
        .input-premium {
          width: 100%;
          background-color: rgba(11, 15, 23, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #ffffff;
          padding: 0.85rem 1rem;
          border-radius: 10px;
          font-size: 0.95rem;
          box-sizing: border-box;
          transition: 0.2s;
        }
        .input-premium::placeholder { color: #64748b; }
        .input-premium:focus {
          outline: none;
          border-color: #c5a880;
          background-color: rgba(11, 15, 23, 0.9);
          box-shadow: 0 0 0 3px rgba(197, 168, 128, 0.15);
        }
        .btn-gold {
          background-color: #c5a880; color: #0b0f17; font-weight: 800; border: none; cursor: pointer; transition: 0.2s;
          width: 100%; padding: 1rem; border-radius: 10px; font-size: 1.05rem; margin-top: 1rem;
        }
        .btn-gold:hover { background-color: #b39369; box-shadow: 0 4px 20px rgba(197, 168, 128, 0.4); transform: translateY(-2px); }
        .auth-link { color: #c5a880; text-decoration: none; font-weight: 700; transition: 0.2s; }
        .auth-link:hover { color: #ffffff; }

        .glass-card {
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
      `}</style>

      {/* Фонове фото із затемненням */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1 }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(11, 15, 23, 0.85)' }}></div>
        <img
          src="https://images.unsplash.com/photo-1522337660859-02fbefca4702?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80"
          alt="Barbershop Background"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {/* МІНІ-ХЕДЕР */}
      <header style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '72px',
        backgroundColor: 'transparent', zIndex: 100, display: 'flex', alignItems: 'center'
      }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

          {/* Ліва частина з логотипом (точна копія з бізнес-лендінгу) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3rem' }}>
            <Link href="/business" style={{ fontSize: '1.6rem', fontWeight: '900', color: '#c5a880', letterSpacing: '-0.04em', textDecoration: 'none' }}>
              Book<span style={{ color: '#ffffff' }}>Era</span>
              <span style={{ fontSize: '0.85rem', color: '#e2e8f0', marginLeft: '6px', fontWeight: '500', letterSpacing: 'normal' }}>Business</span>
            </Link>
          </div>

          {/* Права частина з кнопкою (точна копія з бізнес-лендінгу) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}>
            <Link href="/business" className="nav-link anim" style={{ color: '#94a3b8', transition: '0.2s' }} onMouseOver={(e) => e.currentTarget.style.color = '#fff'} onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}>
              ← Назад на сайт
            </Link>
          </div>

        </div>
      </header>

      {/* КОНТЕНТ ЛОГІНУ */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', zIndex: 10 }}>
        {/* Додано marginTop: '-10vh' бо форма логіну коротша і її треба підтягнути сильніше */}
        <div className="glass-card" style={{ width: '100%', maxWidth: '420px', padding: '3rem', borderRadius: '24px', marginTop: '-10vh' }}>

          <h1 style={{ fontSize: '2rem', fontWeight: '800', margin: '0 0 0.5rem 0', color: '#ffffff', textAlign: 'center' }}>
            З поверненням
          </h1>
          <p style={{ color: '#cbd5e1', fontSize: '0.95rem', textAlign: 'center', marginBottom: '2.5rem' }}>
            Увійдіть до свого кабінету BookEra Business.
          </p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.4rem' }}>Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} className="input-premium" placeholder="admin@salon.com" required />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#cbd5e1' }}>Пароль</label>
                <span style={{ fontSize: '0.8rem', color: '#c5a880', cursor: 'pointer' }}>Забули пароль?</span>
              </div>
              <input type="password" name="password" value={formData.password} onChange={handleChange} className="input-premium" placeholder="••••••••" required />
            </div>

            <button type="submit" className="btn-gold">
              Увійти в кабінет
            </button>

          </form>

          <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.9rem', color: '#cbd5e1' }}>
            Немає акаунту? <Link href="/business/register" className="auth-link">Зареєструватись</Link>
          </div>

        </div>
      </main>

    </div>
  );
}