'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SalonProfile() {
  const { slug } = useParams();
  const router = useRouter();

  const [salon, setSalon] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [bookedAppointments, setBookedAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Стан для шапки та профілю
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [initials, setInitials] = useState<string>('');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [cityQuery, setCityQuery] = useState('Львів');

  // Стан для модалки
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState('2026-06-27');
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedMasterId, setSelectedMasterId] = useState<number>(0);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const staffers = [
    { id: 0, name: "Будь-хто", role: "Без переваг", color: "#e2e8f0", icon: "👥" },
    { id: 1, name: "Яміло", role: "Топ-майстер", color: "#1e293b", icon: "👨🏽‍💼" },
    { id: 2, name: "Луїс", role: "Стиліст", color: "#c5a880", icon: "👨🏼‍🎨" },
    { id: 3, name: "Катріна", role: "Колорист", color: "#334155", icon: "👩🏼‍🦱" },
    { id: 4, name: "Едгар", role: "Молодший", color: "#94a3b8", icon: "👨🏻‍🦱" },
  ];

  const calendarDays = [
    { date: '2026-06-27', dayNum: '27', dayName: 'Сб' },
    { date: '2026-06-28', dayNum: '28', dayName: 'Нд' },
    { date: '2026-06-29', dayNum: '29', dayName: 'Пн' },
    { date: '2026-06-30', dayNum: '30', dayName: 'Вв' },
    { date: '2026-07-01', dayNum: '1', dayName: 'Ср' },
    { date: '2026-07-02', dayNum: '2', dayName: 'Чт' },
    { date: '2026-07-03', dayNum: '3', dayName: 'Пт' },
  ];

  const timeSlots = {
    morning: ['09:00', '10:30'],
    afternoon: ['12:00', '13:30', '15:00'],
    evening: ['17:00', '18:15', '19:30']
  };

  useEffect(() => {
    // Перевірка сесії
    if (typeof window !== 'undefined') {
      const storedName = localStorage.getItem('userName');
      if (storedName) {
        setIsLoggedIn(true);
        setUserName(storedName);
        const nameParts = storedName.split(' ');
        const init = nameParts.length > 1 ? nameParts[0][0] + nameParts[1][0] : nameParts[0][0];
        setInitials(init.toUpperCase());
      }
    }

    if (slug) loadDataFromBackend();
  }, [slug]);

  // Закриття меню
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

  const loadDataFromBackend = async () => {
    try {
      const resBusiness = await fetch(`http://127.0.0.1:8001/businesses/${slug}`);
      if (resBusiness.ok) {
        const salonData = await resBusiness.json();
        setSalon(salonData);

        const resServices = await fetch(`http://127.0.0.1:8001/businesses/${salonData.id}/services`);
        if (resServices.ok) setServices(await resServices.json());

        const resBooked = await fetch(`http://127.0.0.1:8001/appointments/booked?business_id=${salonData.id}`);
        if (resBooked.ok) setBookedAppointments(await resBooked.json());
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const isSlotBusy = (time: string) => {
    const targetDateTimeStr = `${selectedDate}T${time}:00`;
    const appointmentsAtTime = bookedAppointments.filter((app: any) => app.start_time.replace('Z', '') === targetDateTimeStr);
    if (selectedMasterId === 0) return appointmentsAtTime.length >= (staffers.length - 1);
    return appointmentsAtTime.some((app: any) => app.master_id === selectedMasterId);
  };

  const findFirstFreeMasterId = (time: string) => {
    const targetDateTimeStr = `${selectedDate}T${time}:00`;
    const busyMasterIds = bookedAppointments.filter((app: any) => app.start_time.replace('Z', '') === targetDateTimeStr).map((app: any) => app.master_id);
    const freeMaster = staffers.slice(1).find(staff => !busyMasterIds.includes(staff.id));
    return freeMaster ? freeMaster.id : 1;
  };

  const handleConfirmBooking = async () => {
    if (!selectedTime) return alert("Оберіть час!");
    try {
      const startTimeIso = `${selectedDate}T${selectedTime}:00`;
      const finalMasterId = selectedMasterId === 0 ? findFirstFreeMasterId(selectedTime) : selectedMasterId;
      const res = await fetch('http://127.0.0.1:8001/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: salon.id, service_id: selectedService.id, client_id: 1, master_id: finalMasterId, start_time: startTimeIso })
      });
      if (res.ok) {
        setBookingSuccess(true);
        await loadDataFromBackend();
        setTimeout(() => {
          setIsModalOpen(false);
          setBookingSuccess(false);
          setSelectedTime(null);
        }, 2200);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
    setIsLoggedIn(false);
    setIsProfileOpen(false);
    setUserName(null);
    router.push('/login');
  };

  const galleryPhotos = [
    "https://d2zdpiztbgorvt.cloudfront.net/region1/us/481342/biz_photo/37b3ba97c70144ecb6a9f27b90745d-flawless-fades-studio-biz-photo-22fa4e1e561f4fc8b8e6ad41255e26-booksy.jpeg?size=640x427",
    "https://d2zdpiztbgorvt.cloudfront.net/region1/us/481342/biz_photo/5cae86992018478ca5c0f4da56d90e-flawless-fades-studio-biz-photo-42f75605a905499180a10a7d3dfbea-booksy.jpeg?size=640x427",
    "https://d2zdpiztbgorvt.cloudfront.net/region1/us/481342/biz_photo/063d6d5b5649480ca9fb648543c5f0-flawless-fades-studio-biz-photo-fdfe9ce0cfe4436d9bb02a4c779a42-booksy.jpeg?size=640x427"
  ];

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#0f172a' }}>

      <style>{`
        .container { max-width: 1340px; margin: 0 auto; padding: 0 4rem; width: 100%; box-sizing: border-box; }
        .anim { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); }

        .btn-gold { background-color: #c5a880 !important; color: #0b0f17 !important; font-weight: 750; }
        .btn-gold:hover { background-color: #b39369 !important; box-shadow: 0 4px 12px rgba(197, 168, 128, 0.3); }
        .btn-dark { background-color: #0f172a !important; color: #ffffff !important; font-weight: 700; }
        .btn-dark:hover { background-color: #1e293b !important; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2); transform: translateY(-2px); }
        .btn-outline { border: 1px solid #e2e8f0; background-color: #ffffff; color: #0f172a; font-weight: 600; }
        .btn-outline:hover { border-color: #cbd5e1; background-color: #f1f5f9; }
        .nav-link { color: #ffffff; text-decoration: none; transition: 0.2s; font-weight: 600; font-size: 0.95rem; }
        .nav-link:hover { color: #c5a880 !important; }

        /* Галерея */
        .gallery-container { display: grid; grid-template-columns: 2.2fr 1fr; gap: 16px; height: 420px; border-radius: 20px; overflow: hidden; margin-top: 110px; }
        .gallery-main { width: 100%; height: 100%; object-fit: cover; }
        .gallery-side { display: grid; grid-template-rows: 1fr 1fr; gap: 16px; height: 100%; }
        .gallery-img { width: 100%; height: 100%; object-fit: cover; border-radius: 12px; cursor: pointer; transition: 0.3s; }
        .gallery-img:hover { opacity: 0.9; filter: brightness(0.9); }

        /* Картки */
        .white-card { background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 2rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02); }
        .service-row { border-bottom: 1px solid #f1f5f9; padding: 1.5rem 0; display: flex; justify-content: space-between; align-items: center; transition: 0.2s; }
        .service-row:last-child { border-bottom: none; padding-bottom: 0; }
        .service-row:first-child { padding-top: 0; }

        /* Модалка */
        .time-pill { border: 1px solid #cbd5e1; background-color: #ffffff; padding: 0.6rem 1.25rem; border-radius: 10px; cursor: pointer; font-size: 0.85rem; font-weight: 700; transition: all 0.2s; color: #0f172a; }
        .time-pill:hover:not(.busy):not(.selected) { border-color: #94a3b8; }
        .time-pill.selected { background-color: #0f172a !important; color: #ffffff !important; border-color: #0f172a; }
        .time-pill.busy { background-color: #f8fafc !important; color: #94a3b8 !important; border-color: #e2e8f0; cursor: not-allowed !important; text-decoration: line-through; }
        .master-card { padding: 0.5rem; border-radius: 12px; border: 1px solid #e2e8f0; cursor: pointer; transition: 0.2s; background: #ffffff; }
        .master-card.selected { border-color: #0f172a; background-color: #f8fafc; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .date-card { padding: 0.75rem 0.5rem; border-radius: 12px; border: 1px solid #e2e8f0; cursor: pointer; text-align: center; min-width: 60px; transition: 0.2s; background: #ffffff; }
        .date-card.selected { background-color: #0f172a; color: #ffffff; border-color: #0f172a; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .footer-link { color: #94a3b8; text-decoration: none; font-size: 0.9rem; }
        .footer-link:hover { color: #ffffff; }

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
      `}</style>

      {/* 1. ТЕМНИЙ ХЕДЕР З СМАРТ ПРОФІЛЕМ */}
      <header style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '72px',
        backgroundColor: '#0b0f17', borderBottom: '1px solid #1e293b',
        zIndex: 100, display: 'flex', alignItems: 'center',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
      }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

          <Link href="/" style={{ fontSize: '1.6rem', fontWeight: '900', color: '#c5a880', letterSpacing: '-0.04em', textDecoration: 'none' }}>
            Book<span style={{ color: '#ffffff' }}>Era</span>
          </Link>

          <div style={{
            display: 'flex', gap: '0.25rem', backgroundColor: '#ffffff', padding: '0.35rem', borderRadius: '8px',
            maxWidth: '560px', width: '100%', margin: '0 1rem', border: '1px solid #1e293b', boxSizing: 'border-box'
          }} className="anim">
            <input type="text" placeholder="Послуга, бренд або салон" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ flex: '1 1 auto', minWidth: 0, border: 'none', outline: 'none', padding: '0.4rem 0.75rem', fontSize: '0.85rem', color: 'black', backgroundColor: 'transparent' }} />
            <div style={{ width: '1px', height: '24px', backgroundColor: '#1e293b', alignSelf: 'center' }}></div>
            <input type="text" value={cityQuery} onChange={(e) => setCityQuery(e.target.value)} style={{ flex: '0 1 120px', minWidth: 0, border: 'none', outline: 'none', padding: '0.4rem 0.75rem', fontSize: '0.85rem', fontWeight: '700', color: '#c5a880', backgroundColor: 'transparent' }} />
            <button className="anim btn-gold" style={{ flexShrink: 0, border: 'none', padding: '0.4rem 1.25rem', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>Знайти</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center' }}>
            {isLoggedIn ? (
              <div style={{ position: 'relative' }} ref={profileRef}>
                <div onClick={() => setIsProfileOpen(!isProfileOpen)} className="profile-trigger">
                  <span className="profile-name" style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                    {userName}
                  </span>
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
            ) : (
              <span onClick={() => router.push('/login')} className="nav-link anim" style={{ cursor: 'pointer' }}>Увійти / Зареєструватись</span>
            )}
          </div>

        </div>
      </header>

      {/* 2. СУЧАСНА ГАЛЕРЕЯ */}
      <section className="container">
        <div className="gallery-container">
          <div style={{ width: '100%', height: '100%', borderRadius: '16px 0 0 16px', overflow: 'hidden' }}>
            <img src={salon?.thumbnail_photo || galleryPhotos[0]} className="gallery-main anim" alt="Головне фото" />
          </div>
          <div className="gallery-side">
            <div style={{ width: '100%', height: '100%', borderRadius: '0 16px 0 0', overflow: 'hidden' }}>
              <img src={galleryPhotos[1]} className="gallery-img" alt="Фото 2" />
            </div>
            <div style={{ width: '100%', height: '100%', borderRadius: '0 0 16px 0', overflow: 'hidden', position: 'relative' }}>
              <img src={galleryPhotos[2]} className="gallery-img" alt="Фото 3" />
              <button className="btn-outline anim" style={{ position: 'absolute', bottom: '15px', right: '15px', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🖼️</span> Всі фото
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 3. НАЗВА ТА ОСНОВНА ІНФО */}
      <section className="container" style={{ marginTop: '2.5rem', marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '2.8rem', fontWeight: '900', margin: '0 0 0.5rem 0', color: '#0f172a', letterSpacing: '-0.02em' }}>
              {salon ? salon.name : "Завантаження..."}
            </h1>
            <p style={{ color: '#475569', fontSize: '1.05rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '500' }}>
              <span>📍</span> {salon ? salon.address : "..."}
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0' }}>
              <span style={{ color: '#fbbf24', fontSize: '1.4rem' }}>★</span>
              <span style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a' }}>5.0</span>
              <span style={{ color: '#64748b', fontSize: '0.95rem', marginLeft: '0.25rem', fontWeight: '500' }}>(388 відгуків)</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. ОСНОВНА СІТКА КОНТЕНТУ */}
      <main className="container" style={{ paddingBottom: '6rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '4rem' }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
            <div className="white-card">
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '1rem', color: '#0f172a' }}>Про нас</h2>
              <p style={{ color: '#475569', lineHeight: '1.6', fontSize: '1rem', margin: 0 }}>
                {salon?.description || "Ми — сучасний простір краси, де кожен клієнт отримує індивідуальний підхід та преміальний сервіс. Наші майстри постійно вдосконалюють свої навички, щоб пропонувати вам найкращі світові тренди та техніки."}
              </p>
            </div>

            <div className="white-card">
              <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '1.5rem', color: '#0f172a' }}>Послуги</h2>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {loading ? (
                  <div style={{ color: '#94a3b8', padding: '1rem 0' }}>Завантаження прайсу...</div>
                ) : (
                  services.map((service) => (
                    <div key={service.id} className="service-row">
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '800', fontSize: '1.15rem', color: '#0f172a', marginBottom: '0.3rem' }}>{service.name}</div>
                        <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: '500' }}>⏱️ {service.duration_minutes} хв</div>
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', paddingRight: '2.5rem' }}>
                        {service.price} ₴
                      </div>
                      <button
                        className="btn-dark anim"
                        style={{ border: 'none', padding: '0.85rem 1.75rem', borderRadius: '10px', cursor: 'pointer', fontSize: '0.95rem' }}
                        onClick={() => { setSelectedService(service); setIsModalOpen(true); }}
                      >
                        Вибрати час
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div>
            <div style={{ position: 'sticky', top: '100px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="white-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: '0 0 1.25rem 0', color: '#0f172a' }}>Наші топ-майстри</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                  {staffers.slice(1).map((staff, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: '54px', height: '54px', borderRadius: '50%', backgroundColor: staff.color, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', color: '#fff' }}>
                        {staff.icon}
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0f172a' }}>{staff.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{staff.role}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="white-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ height: '180px', background: 'radial-gradient(ellipse at center, #e2e8f0 0%, #cbd5e1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>📍</div>
                <div style={{ padding: '1.5rem' }}>
                  <div style={{ fontWeight: '800', fontSize: '1.05rem', color: '#0f172a', marginBottom: '0.25rem' }}>{salon ? salon.name : "..."}</div>
                  <div style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.5' }}>{salon ? salon.address : "..."}</div>
                  <button className="btn-outline anim" style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', marginTop: '1.25rem', cursor: 'pointer', fontSize: '0.95rem' }}>Показати маршрут</button>
                </div>
              </div>

              <div className="white-card anim" style={{ cursor: 'pointer', border: '1px solid #c5a880', display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem' }}>
                <div style={{ fontSize: '2.2rem' }}>🎁</div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: '0 0 0.2rem 0', color: '#0f172a' }}>Подарункові сертифікати</h3>
                  <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>Ідеальний подарунок для близьких</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* МОДАЛКА БРОНЮВАННЯ */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="anim" style={{ backgroundColor: '#ffffff', borderRadius: '24px', width: '100%', maxWidth: '540px', padding: '2.5rem', position: 'relative', boxSizing: 'border-box', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>

            <button style={{ background: '#f1f5f9', color: '#64748b', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', position: 'absolute', top: '1.5rem', right: '1.5rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setIsModalOpen(false)}>✕</button>

            {bookingSuccess ? (
              <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
                <h2 style={{ color: '#0f172a', fontWeight: '800' }}>Успішно заброньовано!</h2>
                <p style={{ color: '#64748b' }}>Чекаємо на вас у нашому салоні.</p>
              </div>
            ) : (
              <>
                <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.25rem', paddingRight: '2rem' }}>Бронювання візиту</h2>
                <p style={{ fontWeight: '600', color: '#c5a880', fontSize: '1.05rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                  {selectedService?.name} • {selectedService?.price} ₴
                </p>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>1. Оберіть майстра</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem', marginTop: '0.75rem' }}>
                    {staffers.map((staff) => (
                      <div key={staff.id} onClick={() => { setSelectedMasterId(staff.id); setSelectedTime(null); }} className={`master-card anim ${selectedMasterId === staff.id ? 'selected' : ''}`}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: staff.color, margin: '0 auto 0.4rem auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.1rem' }}>{staff.icon}</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: '700', textAlign: 'center', color: selectedMasterId === staff.id ? '#0f172a' : '#475569' }}>{staff.name}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>2. Оберіть дату</label>
                  <div className="hide-scrollbar" style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', marginTop: '0.75rem', paddingBottom: '0.25rem' }}>
                    {calendarDays.map((day) => (
                      <div key={day.date} onClick={() => { setSelectedDate(day.date); setSelectedTime(null); }} className={`date-card anim ${selectedDate === day.date ? 'selected' : ''}`}>
                        <div style={{ fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.15rem' }}>{day.dayName}</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: '800' }}>{day.dayNum}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: '2.5rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>3. Доступний час</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
                    {['morning', 'afternoon', 'evening'].map((period) => (
                      <div key={period} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#94a3b8', width: '55px' }}>
                          {period === 'morning' ? 'Ранок' : period === 'afternoon' ? 'День' : 'Вечір'}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {timeSlots[period as keyof typeof timeSlots].map((time) => {
                            const busy = isSlotBusy(time);
                            const selected = selectedTime === time;
                            return (
                              <button key={time} disabled={busy} onClick={() => setSelectedTime(time)} className={`time-pill anim ${busy ? 'busy' : ''} ${selected ? 'selected' : ''}`}>
                                {time}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button onClick={handleConfirmBooking} className="btn-dark anim" style={{ width: '100%', border: 'none', padding: '1.1rem', borderRadius: '12px', fontSize: '1.05rem', cursor: 'pointer' }}>
                  Підтвердити бронювання
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 5. ФУТЕР */}
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