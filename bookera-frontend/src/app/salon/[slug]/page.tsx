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

  const [searchQuery, setSearchQuery] = useState('');
  const [cityQuery, setCityQuery] = useState('Львів');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState('2026-06-27');
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedMasterId, setSelectedMasterId] = useState<number>(0);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const instagramUrl = 'https://instagram.com/solidbarber';
  const websiteUrl = 'https://solidbarber.lviv.ua';

  const staffers = [
    { id: 0, name: "Будь-хто", role: "Без переваг", color: "#64748b", icon: "👥" },
    { id: 1, name: "Рауль", role: "Топ 👑", color: "#1e293b", icon: "👨🏽‍💼" },
    { id: 2, name: "Яміло", role: "Стиліст", color: "#c5a880", icon: "👨🏼‍🎨" },
    { id: 3, name: "Катріна", role: "Колір", color: "#334155", icon: "👩🏼‍🦱" },
    { id: 4, name: "Едгар", role: "Молодший", color: "#475569", icon: "👨🏻‍🦱" },
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
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const isSlotBusy = (time: string) => {
    const targetDateTimeStr = `${selectedDate}T${time}:00`;
    const appointmentsAtTime = bookedAppointments.filter((app: any) => app.start_time.replace('Z', '') === targetDateTimeStr);
    if (selectedMasterId === 0) {
      return appointmentsAtTime.length >= (staffers.length - 1);
    }
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
        setBookingSuccess(true); await loadDataFromBackend();
        setTimeout(() => { setIsModalOpen(false); setBookingSuccess(false); setSelectedTime(null); }, 2200);
      }
    } catch (e) { console.error(e); }
  };

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#0b0f17' }}>

      <style>{`
        .anim { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); }
        .btn-gold { background-color: #c5a880 !important; color: #05070a !important; }
        .btn-gold:hover { background-color: #b39369 !important; transform: scale(1.02); }
        .btn-booksy-style { background-color: #0b0f17 !important; color: #ffffff !important; }
        .btn-booksy-style:hover { background-color: #c5a880 !important; color: #0b0f17 !important; transform: scale(1.02); }
        .service-row:hover { background-color: #fcfcfd; }
        .time-pill { border: 1px solid #e4e4e7; background-color: #ffffff; padding: 0.5rem 1.1rem; border-radius: 8px; cursor: pointer; font-size: 0.85rem; font-weight: 700; transition: all 0.2s; }
        .time-pill.selected { background-color: #0b0f17 !important; color: #ffffff !important; }
        .time-pill.busy { background-color: #f4f4f5 !important; color: #a1a1aa !important; cursor: not-allowed !important; text-decoration: line-through; }
        .close-modal-btn { background: #f1f5f9; border: none; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; }
      `}</style>

      {/* ШАПКА З ІДЕНТИЧНИМИ ГЕОМЕТРИЧНИМИ ВІДСТУПАМИ ХЕДЕРА BOOKSY */}
      <header style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '78px',
        backgroundColor: scrolled ? '#0b0f17' : 'transparent',
        borderBottom: scrolled ? '1px solid #1e293b' : 'none',
        padding: '1.25rem 0', zIndex: 100, display: 'flex', alignItems: 'center',
        boxShadow: scrolled ? '0 10px 30px rgba(0,0,0,0.2)' : 'none'
      }} className="anim">
        <div style={{ maxWidth: '1340px', margin: '0 auto', padding: '0 4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box', width: '100%' }}>

          <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#c5a880', letterSpacing: '-0.04em', cursor: 'pointer' }} onClick={() => window.location.href = '/'}>
            Book<span style={{ color: '#ffffff' }}>Era</span>
          </div>

          {/* АКТИВНИЙ ЦЕНТРАЛЬНИЙ ПОШУКОВИЙ ВІДЖЕТ */}
          <div style={{
            flex: '0 1 450px', margin: '0 2rem', backgroundColor: '#ffffff', borderRadius: '10px', padding: '0.35rem', display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0'
          }}>
            <input type="text" placeholder="Що шукаєте?" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ flex: 1.3, border: 'none', outline: 'none', padding: '0.4rem 0.75rem', fontSize: '0.9rem', color: '#0b0f17', backgroundColor: 'transparent' }} />
            <div style={{ width: '1px', height: '20px', backgroundColor: '#e2e8f0' }}></div>
            <input type="text" value={cityQuery} onChange={(e) => setCityQuery(e.target.value)} style={{ flex: 0.7, border: 'none', outline: 'none', padding: '0.4rem 0.75rem', fontSize: '0.9rem', fontWeight: '700', color: '#0b0f17', backgroundColor: 'transparent' }} />
            <button className="anim btn-gold" style={{ border: 'none', padding: '0 1rem', borderRadius: '7px', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>Знайти</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#c5a880', cursor: 'pointer' }} onClick={() => window.location.href = '/business'}>Для бізнесу</span>
            <button className="anim" style={{ backgroundColor: 'transparent', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#ffffff', padding: '0.55rem 1.25rem', borderRadius: '8px', fontWeight: '600', fontSize: '0.9rem' }} onClick={() => window.location.href = '/business'}>Кабінет</button>
          </div>

        </div>
      </header>

      {/* БАНЕР */}
      <section style={{ backgroundColor: '#0b0f17', color: '#ffffff', padding: '11rem 0 3.5rem 0', background: 'radial-gradient(circle at top right, #161f30 0%, #0b0f17 100%)', height: '240px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', width: '100%' }}>
        <div style={{ maxWidth: '1340px', width: '100%', margin: '0 auto', padding: '0 4rem', boxSizing: 'border-box' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '900', margin: 0 }}>{salon ? salon.name : "Завантаження..."}</h1>
          <p style={{ color: '#94a3b8', margin: '0.25rem 0 0 0', fontSize: '1rem' }}>{salon ? `📍 ${salon.address} • ` : ""} <span style={{ color: '#c5a880', fontWeight: '700' }}>⭐ 5.0 (388 відгуків)</span></p>
        </div>
      </section>

      {/* КОНТЕНТ СІТКА */}
      <main style={{ maxWidth: '1340px', margin: '0 auto', padding: '0 4rem', boxSizing: 'border-box' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '7fr 4fr', gap: '3.5rem', margin: '2rem 0 6rem 0' }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: '0.5rem', height: '380px', borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg, #0b0f17 0%, #1e293b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c5a880', fontSize: '4rem' }}>💈</div>
              <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: '0.5rem' }}>
                <div style={{ background: '#c5a880', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>✨</div>
                <div style={{ background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>✂️</div>
              </div>
            </div>

            <div>
              <h2>Послуги закладу</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {!loading && services.map((service) => (
                  <div key={service.id} className="anim service-row" style={{ display: 'grid', gridTemplateColumns: '1fr 120px 200px', alignItems: 'center', padding: '1.5rem 0', borderBottom: '1px solid #f2f4f7' }}>
                    <div>
                      <div style={{ fontWeight: '800', fontSize: '1.25rem' }}>{service.name}</div>
                      <div style={{ color: '#667085', fontSize: '0.9rem' }}>⏱️ {service.duration_minutes} хв</div>
                    </div>
                    <div style={{ fontSize: '1.35rem', fontWeight: '900', textAlign: 'right', paddingRight: '1.5rem' }}>{service.price} ₴</div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button className="anim btn-booksy-style" style={{ border: 'none', padding: '0.65rem 0', borderRadius: '8px', fontWeight: '700', width: '180px', cursor: 'pointer' }} onClick={() => { setSelectedService(service); setIsModalOpen(true); }}>Вибрати час</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', position: 'sticky', top: '7rem' }}>
              <div style={{ border: '1px solid #eaecf0', borderRadius: '16px', overflow: 'hidden', backgroundColor: '#ffffff' }}>
                <div style={{ height: '130px', background: 'radial-gradient(ellipse at center, #cbd5e1 0%, #94a3b8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📍</div>
                <div style={{ padding: '1.25rem' }}><div style={{ fontWeight: '800' }}>{salon ? salon.name : "..."}</div><div style={{ color: '#667085', fontSize: '0.85rem' }}>{salon ? salon.address : "..."}</div></div>
              </div>
              <div style={{ border: '1px solid #eaecf0', borderRadius: '16px', padding: '1.5rem', backgroundColor: '#ffffff' }}>
                <h3>Наші топ-майстри</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center', marginTop: '1rem' }}>
                  {staffers.slice(1).map((staff, idx) => (
                    <div key={idx}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: staff.color, margin: '0 auto 0.4rem auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>{staff.icon}</div>
                      <div style={{ fontSize: '0.8rem', fontWeight: '700' }}>{staff.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* МОДАЛКА */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(5, 7, 10, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '520px', padding: '1.5rem', position: 'relative', boxSizing: 'border-box' }}>
            <button className="close-modal-btn" style={{ position: 'absolute', top: '1.25rem', right: '1.25rem' }} onClick={() => setIsModalOpen(false)}>✕</button>
            {bookingSuccess ? (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}><h3>🎉 Успішно заброньовано!</h3></div>
            ) : (
              <>
                <h3>Бронювання послуги</h3>
                <p style={{ fontWeight: '800', color: '#c5a880' }}>{selectedService?.name} • {selectedService?.price} ₴</p>
                <div style={{ marginTop: '1rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b' }}>ОБЕРІТЬ МАЙСТРА</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.4rem', textAlign: 'center', marginTop: '0.5rem' }}>
                    {staffers.map((staff) => (
                      <div key={staff.id} onClick={() => { setSelectedMasterId(staff.id); setSelectedTime(null); }} style={{ padding: '0.4rem 0.2rem', borderRadius: '10px', border: selectedMasterId === staff.id ? '2px solid #0b0f17' : '1px solid #e4e4e7', cursor: 'pointer', backgroundColor: selectedMasterId === staff.id ? '#f8fafc' : 'transparent' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: staff.color, margin: '0 auto 0.25rem auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{staff.icon}</div>
                        <div style={{ fontSize: '0.7rem', fontWeight: '750' }}>{staff.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: '1rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b' }}>ОБЕРІТЬ ДАТУ</label>
                  <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', marginTop: '0.5rem' }}>
                    {calendarDays.map((day) => (
                      <div key={day.date} onClick={() => { setSelectedDate(day.date); setSelectedTime(null); }} style={{ padding: '0.5rem 0', borderRadius: '8px', border: '1px solid #e4e4e7', cursor: 'pointer', textAlign: 'center', minWidth: '54px', backgroundColor: selectedDate === day.date ? '#0b0f17' : '#ffffff', color: selectedDate === day.date ? '#ffffff' : '#0b0f17' }}>
                        <div style={{ fontSize: '0.65rem' }}>{day.dayName}</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '800' }}>{day.dayNum}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b' }}>ДОСТУПНИЙ ЧАС</label>
                  {['morning', 'afternoon', 'evening'].map((period) => (
                    <div key={period} style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#a1a1aa', width: '55px' }}>{period === 'morning' ? 'Ранок' : period === 'afternoon' ? 'День' : 'Вечір'}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {timeSlots[period as keyof typeof timeSlots].map((time) => {
                          const busy = isSlotBusy(time); const selected = selectedTime === time;
                          return <button key={time} disabled={busy} onClick={() => setSelectedTime(time)} className={`time-pill ${busy ? 'busy' : ''} ${selected ? 'selected' : ''}`}>{time}</button>;
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={handleConfirmBooking} className="anim btn-gold" style={{ width: '100%', border: 'none', padding: '0.85rem', borderRadius: '10px', fontSize: '0.95rem', fontWeight: '800', cursor: 'pointer' }}>Підтвердити бронювання</button>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}