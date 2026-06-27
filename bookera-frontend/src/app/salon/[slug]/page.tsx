// src/app/salon/[slug]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function SalonProfile() {
  const { slug } = useParams();
  const [salon, setSalon] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [bookedAppointments, setBookedAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);

  // Стан для оригінального пошукового віджета
  const [searchQuery, setSearchQuery] = useState('');
  const [cityQuery, setCityQuery] = useState('Львів');

  // Стан для Booksy-бронювання
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState('2026-06-27');
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedMasterId, setSelectedMasterId] = useState<number>(0); // 0 = Будь-хто
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Соціальні лінки
  const instagramUrl = 'https://instagram.com/solidbarber';
  const websiteUrl = 'https://solidbarber.lviv.ua';

  const staffers = [
    { id: 0, name: "Будь-хто", role: "Без переваг", color: "#64748b", icon: "👥" },
    { id: 1, name: "Рауль", role: "Топ Барбер", color: "#1e293b", icon: "👨🏽‍💼" },
    { id: 2, name: "Яміло", role: "Стиліст", color: "#c5a880", icon: "👨🏼‍🎨" },
    { id: 3, name: "Катріна", role: "Колорист", color: "#334155", icon: "👩🏼‍🦱" },
    { id: 4, name: "Едгар", role: "Молодший майстер", color: "#475569", icon: "👨🏻‍🦱" },
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
    const handleScroll = () => {
      if ((window.scrollY || document.documentElement.scrollTop) > 50) setScrolled(true);
      else setScrolled(false);
    };
    window.addEventListener('scroll', handleScroll);
    if (slug) loadDataFromBackend();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [slug]);

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
      console.error("Помилка завантаження даних клієнта:", error);
    } finally {
      setLoading(false);
    }
  };

  const isSlotBusy = (time: string) => {
    const targetDateTimeStr = `${selectedDate}T${time}:00`;
    const appointmentsAtTime = bookedAppointments.filter((app: any) => app.start_time.replace('Z', '') === targetDateTimeStr);

    if (selectedMasterId === 0) {
      const totalRealMasters = staffers.length - 1;
      return appointmentsAtTime.length >= totalRealMasters;
    } else {
      return appointmentsAtTime.some((app: any) => app.master_id === selectedMasterId);
    }
  };

  const findFirstFreeMasterId = (time: string) => {
    const targetDateTimeStr = `${selectedDate}T${time}:00`;
    const busyMasterIds = bookedAppointments
      .filter((app: any) => app.start_time.replace('Z', '') === targetDateTimeStr)
      .map((app: any) => app.master_id);

    const freeMaster = staffers.slice(1).find(staff => !busyMasterIds.includes(staff.id));
    return freeMaster ? freeMaster.id : 1;
  };

  const handleConfirmBooking = async () => {
    if (!selectedTime) return alert("Будь ласка, оберіть час!");
    try {
      const startTimeIso = `${selectedDate}T${selectedTime}:00`;
      const finalMasterId = selectedMasterId === 0 ? findFirstFreeMasterId(selectedTime) : selectedMasterId;

      const res = await fetch('http://127.0.0.1:8001/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: salon.id,
          service_id: selectedService.id,
          client_id: 1,
          master_id: finalMasterId,
          start_time: startTimeIso
        })
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
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) return <div style={{ backgroundColor: '#0b0f17', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c5a880' }}>Синхронізація з екосистемою BookEra...</div>;
  if (!salon) return <div style={{ backgroundColor: '#0b0f17', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>Заклад не знайдено.</div>;

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#0b0f17' }}>

      <style>{`
        .anim { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); }
        .btn-gold { background-color: #c5a880 !important; color: #05070a !important; }
        .btn-gold:hover { background-color: #b39369 !important; transform: scale(1.02); }
        .btn-booksy-style { background-color: #0b0f17 !important; color: #ffffff !important; }
        .btn-booksy-style:hover { background-color: #c5a880 !important; color: #0b0f17 !important; transform: scale(1.02); }
        .service-row:hover { background-color: #fcfcfd; }
        .time-pill { border: 1px solid #e4e4e7; background-color: #ffffff; padding: 0.75rem 1.5rem; border-radius: 10px; cursor: pointer; font-weight: 700; text-align: center; transition: all 0.2s; }
        .time-pill:hover { border-color: #0b0f17; background-color: #f8fafc; }
        .time-pill.selected { background-color: #0b0f17 !important; color: #ffffff !important; border-color: #0b0f17 !important; }
        .time-pill.busy { background-color: #f4f4f5 !important; color: #a1a1aa !important; border-color: #e4e4e7 !important; cursor: not-allowed !important; text-decoration: line-through; }
        .close-modal-btn { background: #f1f5f9; border: none; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1rem; cursor: pointer; color: #0b0f17; transition: all 0.2s; }
        .close-modal-btn:hover { background: #e2e8f0; transform: scale(1.05); }
      `}</style>

      {/* ХЕДЕР СИНХРОНІЗОВАНИЙ З ГОЛОВНОЮ НА 100% */}
      <header style={{
        position: 'fixed', top: 0, left: 0, width: '100%',
        backgroundColor: scrolled ? '#0b0f17' : 'transparent',
        borderBottom: scrolled ? '1px solid #1e293b' : 'none',
        padding: scrolled ? '0.6rem 0' : '1.25rem 0', zIndex: 100
      }} className="anim">
        <div style={{ maxWidth: '1340px', margin: '0 auto', padding: '0 4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box' }}>

          {/* Логотип */}
          <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#c5a880', cursor: 'pointer' }} onClick={() => window.location.href = '/'}>
            Book<span style={{ color: '#ffffff' }}>Era</span>
          </div>

          {/* ВИПРАВЛЕНО: ПОВНА КОПІЯ ПРЕМІУМ ПОШУКОВОГО ВІДЖЕТА З ГОЛОВНОЇ СТОРІНКИ */}
          <div style={{
            flex: '0 1 540px',
            margin: '0 1.5rem',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            border: '1px solid #e4e4e7'
          }}>
            {/* Пошук послуги */}
            <input
              type="text"
              placeholder="Що шукаєте?"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1.3,
                border: 'none',
                outline: 'none',
                padding: '0.55rem 0.75rem',
                fontSize: '0.88rem',
                fontWeight: '600',
                color: '#0b0f17',
                backgroundColor: 'transparent'
              }}
            />

            {/* Розділювальна лінія */}
            <div style={{ width: '1px', height: '24px', backgroundColor: '#e4e4e7' }}></div>

            {/* Локація */}
            <input
              type="text"
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              style={{
                flex: 0.7,
                border: 'none',
                outline: 'none',
                padding: '0.55rem 0.75rem',
                fontSize: '0.88rem',
                fontWeight: '700',
                color: '#0b0f17',
                backgroundColor: 'transparent'
              }}
            />

            {/* Золота кнопка Знайти */}
            <button
              className="anim btn-gold"
              style={{
                border: 'none',
                padding: '0.55rem 1.25rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: '800',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              Знайти
            </button>
          </div>

          {/* Навігація */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#c5a880', cursor: 'pointer' }} onClick={() => window.location.href = '/business'}>Для бізнесу</span>
            <button className="anim" style={{ backgroundColor: 'transparent', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#ffffff', padding: '0.55rem 1.25rem', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem' }}>
              Кабінет
            </button>
          </div>

        </div>
      </header>

      {/* БАНЕР */}
      <section style={{
        backgroundColor: '#0b0f17', color: '#ffffff',
        padding: '0 4rem',
        background: 'radial-gradient(circle at top right, #161f30 0%, #0b0f17 100%)',
        height: '240px', boxSizing: 'border-box', display: 'flex', alignItems: 'center',
        paddingTop: '4rem'
      }}>
        <div style={{ maxWidth: '1340px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '900', margin: 0, letterSpacing: '-0.03em' }}>{salon.name}</h1>
          <p style={{ color: '#94a3b8', margin: '0.25rem 0 0 0', fontSize: '1rem' }}>📍 {salon.address} • <span style={{ color: '#c5a880', fontWeight: '700' }}>⭐ 5.0 (388 відгуків)</span></p>
        </div>
      </section>

      {/* ДВОКОЛОНКОВА СІТКА КОНТЕНТУ */}
      <main style={{ maxWidth: '1340px', margin: '0 auto', padding: '0 4rem', boxSizing: 'border-box' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '7fr 4fr', gap: '3.5rem', margin: '2rem 0 6rem 0' }}>

          {/* ЛІВА КОЛОНКА */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

            <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: '0.5rem', height: '380px', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg, #0b0f17 0%, #1e293b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c5a880', fontSize: '4rem' }}>💈</div>
              <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: '0.5rem' }}>
                <div style={{ background: '#c5a880', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>✨</div>
                <div style={{ background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>✂️</div>
              </div>
            </div>

            <div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: '800', marginBottom: '1.5rem', color: '#0b0f17' }}>Послуги закладу</h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {services.map((service: any) => (
                  <div key={service.id} className="anim service-row" style={{
                    display: 'grid', gridTemplateColumns: '1fr 120px 200px', alignItems: 'center', padding: '1.5rem 0', borderBottom: '1px solid #f2f4f7'
                  }}>

                    <div style={{ paddingRight: '1rem' }}>
                      <div style={{ fontWeight: '800', fontSize: '1.25rem', color: '#0b0f17', marginBottom: '0.35rem' }}>{service.name}</div>
                      <div style={{ color: '#667085', fontSize: '0.9rem', fontWeight: '600' }}>⏱️ {service.duration_minutes} хв</div>
                    </div>

                    <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#0b0f17', textAlign: 'right', paddingRight: '1.5rem' }}>
                      {service.price} ₴
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        className="anim btn-booksy-style"
                        style={{ border: 'none', padding: '0.65rem 0', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', width: '180px' }}
                        onClick={() => { setSelectedService(service); setIsModalOpen(true); }}
                      >
                        Вибрати час
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* ПРАВА КОЛОНКА */}
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', position: 'sticky', top: '7rem' }}>

              <div style={{ border: '1px solid #eaecf0', borderRadius: '16px', overflow: 'hidden', backgroundColor: '#ffffff' }}>
                <div style={{ height: '130px', background: 'radial-gradient(ellipse at center, #cbd5e1 0%, #94a3b8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📍</div>
                <div style={{ padding: '1.25rem' }}>
                  <div style={{ fontWeight: '800', fontSize: '1rem', marginBottom: '0.2rem', color: '#0b0f17' }}>{salon.name}</div>
                  <div style={{ color: '#667085', fontSize: '0.85rem' }}>{salon.address}</div>
                </div>
              </div>

              <div style={{ border: '1px solid #eaecf0', borderRadius: '16px', padding: '1.5rem', backgroundColor: '#ffffff' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: '0 0 1.25rem 0', color: '#0b0f17' }}>Наші топ-майстри</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                  {staffers.slice(1).map((staff, idx) => (
                    <div key={idx}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: staff.color, margin: '0 auto 0.4rem auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>{staff.icon}</div>
                      <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#0b0f17' }}>{staff.name}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ border: '1px solid #eaecf0', borderRadius: '16px', padding: '1.5rem', backgroundColor: '#ffffff' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: '0 0 1rem 0', color: '#0b0f17' }}>Робочі години</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.9rem' }}>
                  <span style={{ fontWeight: '700', color: '#0b0f17' }}>Понеділок - Неділя</span>
                  <span style={{ fontWeight: '700', color: '#c5a880' }}>09:00 AM - 09:00 PM</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', border: '1px solid #eaecf0', borderRadius: '16px', padding: '1.25rem', backgroundColor: '#ffffff' }}>
                <div style={{ fontWeight: '800', fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Діючі лінки закладу</div>
                <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.9rem', fontWeight: '700' }}>
                  <a href={instagramUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: '#0b0f17' }}>📸 Instagram</a>
                  <span style={{ color: '#cbd5e1' }}>•</span>
                  <a href={websiteUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: '#c5a880' }}>🌐 Наш сайт</a>
                </div>
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* МОДАЛЬНЕ ВІКНО БРОНЮВАННЯ */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(5, 7, 10, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', maxWidth: '1050px', width: '90%', height: '80vh', boxShadow: '0 30px 70px rgba(0,0,0,0.2)', display: 'grid', gridTemplateColumns: '1.4fr 1fr', overflow: 'hidden', border: '1px solid #eaecf0', position: 'relative' }}>

            <div style={{ position: 'absolute', top: '1.25rem', left: '1.25rem', zIndex: 10 }}>
              <button className="close-modal-btn" onClick={() => { setIsModalOpen(false); setSelectedTime(null); }}>✕</button>
            </div>

            {!bookingSuccess ? (
              <>
                <div style={{ padding: '3.5rem 2.5rem 2.5rem 2.5rem', overflowY: 'auto', borderRight: '1px solid #f2f4f7' }}>
                  <div style={{ fontWeight: '800', fontSize: '1.25rem', marginBottom: '1.5rem', color: '#0b0f17' }}>
                    <span>Червень - Липень 2026</span> 📅
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '1.25rem', borderBottom: '1px solid #f2f4f7', marginBottom: '2rem' }}>
                    {calendarDays.map((day) => (
                      <button
                        key={day.date}
                        onClick={() => { setSelectedDate(day.date); setSelectedTime(null); }}
                        style={{
                          minWidth: '60px', height: '75px', borderRadius: '50px', border: '1px solid #e4e4e7',
                          backgroundColor: selectedDate === day.date ? '#0b0f17' : '#ffffff',
                          color: selectedDate === day.date ? '#ffffff' : '#0b0f17',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: '0.15rem'
                        }}
                        className="anim"
                      >
                        <span style={{ fontSize: '1.15rem', fontWeight: '800' }}>{day.dayNum}</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: '600', opacity: 0.7 }}>{day.dayName}</span>
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {['morning', 'afternoon', 'evening'].map((block: string) => (
                      <div key={block}>
                        <h4 style={{ margin: '0 0 0.85rem 0', color: '#64748b', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '600' }}>
                          {block === 'morning' ? 'Ранок' : block === 'afternoon' ? 'День' : 'Вечір'}
                        </h4>
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                          {(timeSlots as any)[block].map((t: string) => {
                            const busy = isSlotBusy(t);
                            return (
                              <button key={t} disabled={busy} className={`time-pill ${selectedTime === t ? 'selected' : ''} ${busy ? 'busy' : ''}`} onClick={() => setSelectedTime(t)}>{t}</button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ backgroundColor: '#f9fafb', padding: '3.5rem 2.5rem 2.5rem 2.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: '900', margin: '0 0 1.25rem 0', color: '#0b0f17' }}>Ваше замовлення</h3>
                    <div style={{ backgroundColor: '#ffffff', border: '1px solid #e4e4e7', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '2rem' }}>
                      <div style={{ fontWeight: '800', fontSize: '1rem', color: '#0b0f17' }}>{selectedService?.name}</div>
                      <div style={{ color: '#64748b', fontSize: '0.85rem' }}>⏱️ {selectedService?.duration_minutes} хв</div>
                    </div>

                    <h4 style={{ fontSize: '0.9rem', fontWeight: '800', margin: '0 0 1rem 0', color: '#64748b', textTransform: 'uppercase' }}>Доступні майстри</h4>
                    <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                      {staffers.map((staff) => (
                        <div key={staff.id} onClick={() => { setSelectedMasterId(staff.id); setSelectedTime(null); }}
                          style={{
                            textAlign: 'center', cursor: 'pointer', padding: '0.5rem', borderRadius: '14px', border: '2px solid',
                            borderColor: selectedMasterId === staff.id ? '#0b0f17' : 'transparent',
                            backgroundColor: selectedMasterId === staff.id ? '#ffffff' : 'transparent', minWidth: '75px'
                          }} className="anim"
                        >
                          <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: staff.color, margin: '0 auto 0.4rem auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', border: '2px solid #ffffff', boxShadow: selectedMasterId === staff.id ? '0 0 0 2px #0b0f17' : '0 0 0 2px #e4e4e7' }}>{staff.icon}</div>
                          <div style={{ fontSize: '0.75rem', fontWeight: '750', color: '#0b0f17' }}>{staff.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #e4e4e7', paddingTop: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <span style={{ fontWeight: '700', color: '#64748b' }}>Загалом</span>
                      <span style={{ fontSize: '1.6rem', fontWeight: '900', color: '#0b0f17' }}>{selectedService?.price} ₴</span>
                    </div>
                    <button onClick={handleConfirmBooking} disabled={!selectedTime} className="anim"
                      style={{
                        width: '100%', backgroundColor: selectedTime ? '#0b0f17' : '#e4e4e7', color: selectedTime ? '#ffffff' : '#a1a1aa',
                        border: 'none', padding: '1rem', borderRadius: '12px', fontWeight: '800', fontSize: '1rem', cursor: selectedTime ? 'pointer' : 'not-allowed'
                      }}
                    >
                      Підтвердити запис
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }}>
                <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1rem' }}>🎉</span>
                <h3 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#0b0f17' }}>Успішно заброньовано!</h3>
                <p style={{ color: '#64748b', fontSize: '1rem' }}>Ваш візит занесено в розклад майстра через BookEra.</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}