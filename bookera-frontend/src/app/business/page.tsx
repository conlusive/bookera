// src/app/business/page.tsx
'use client';

import { useState, useEffect } from 'react';

export default function BusinessCabinet() {
  const [scrolled, setScrolled] = useState(false);
  const [myBusinesses, setMyBusinesses] = useState<any[]>([]);

  // Керування екранами кабінету: 'dashboard' або 'manage_salon'
  const [currentView, setCurrentView] = useState<'dashboard' | 'manage_salon'>('dashboard');
  const [selectedBusiness, setSelectedBusiness] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);

  // Режим редагування профілю закладу
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editInstagram, setEditInstagram] = useState('https://instagram.com/solidbarber');
  const [editWebsite, setEditWebsite] = useState('https://solidbarber.lviv.ua');

  // Стан для форми створення нового бізнесу
  const [bizName, setBizName] = useState('');
  const [bizSlug, setBizSlug] = useState('');
  const [bizAddress, setBizAddress] = useState('');
  const [bizSuccess, setBizSuccess] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Стан для прайсу
  const [srvName, setSrvName] = useState('');
  const [srvDuration, setSrvDuration] = useState('45');
  const [srvPrice, setSrvPrice] = useState('');
  const [editingServiceId, setEditingServiceId] = useState<number | null>(null);

  const staffers = [
    { name: "Олександр", role: "Top Barber", color: "#1e293b", icon: "👨🏽‍💼" },
    { name: "Дмитро", role: "Stylist", color: "#c5a880", icon: "👨🏼‍🎨" },
    { name: "Артур", role: "Color Master", color: "#334155", icon: "👩🏼‍🦱" },
    { name: "Влад", role: "Junior", color: "#475569", icon: "👨🏻‍🦱" }
  ];

  useEffect(() => {
    const handleScroll = () => {
      if ((window.scrollY || document.documentElement.scrollTop) > 50) setScrolled(true);
      else setScrolled(false);
    };
    window.addEventListener('scroll', handleScroll);
    loadBusinesses();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (selectedBusiness) {
      loadServices(selectedBusiness.id);
    }
  }, [selectedBusiness]);

  const loadBusinesses = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8001/businesses/all');
      if (res.ok) setMyBusinesses(await res.json());
    } catch (error) {
      console.error("Помилка завантаження закладів:", error);
    }
  };

  const loadServices = async (bizId: number) => {
    try {
      const res = await fetch(`http://127.0.0.1:8001/businesses/${bizId}/services`);
      if (res.ok) setServices(await res.json());
    } catch (error) {
      console.error("Помилка завантаження послуг:", error);
    }
  };

  const handleManageSalon = (business: any) => {
    setSelectedBusiness(business);
    setEditName(business.name);
    setEditAddress(business.address);
    setEditSlug(business.slug);
    setCurrentView('manage_salon');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setSelectedBusiness(null);
    setServices([]);
    setIsEditingProfile(false);
    cancelEditService();
  };

  const handleUpdateBusinessProfile = async () => {
    if (!editName || !editAddress || !editSlug) return alert("Поля профілю не можуть бути порожніми!");
    try {
      const res = await fetch(`http://127.0.0.1:8001/businesses/${selectedBusiness.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          slug: editSlug,
          address: editAddress,
          owner_id: selectedBusiness.owner_id
        })
      });

      if (res.ok) {
        const updatedData = await res.json();
        setSelectedBusiness(updatedData);
        setIsEditingProfile(false);
        await loadBusinesses();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!srvName || !srvPrice) return alert("Заповніть назву та ціну послуги!");

    try {
      if (editingServiceId) {
        const res = await fetch(`http://127.0.0.1:8001/businesses/services/${editingServiceId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: srvName, duration_minutes: parseInt(srvDuration), price: parseFloat(srvPrice), business_id: selectedBusiness.id })
        });
        if (res.ok) {
          cancelEditService();
          await loadServices(selectedBusiness.id);
        }
      } else {
        const res = await fetch('http://127.0.0.1:8001/businesses/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: srvName, duration_minutes: parseInt(srvDuration), price: parseFloat(srvPrice), business_id: selectedBusiness.id })
        });
        if (res.ok) {
          setSrvName('');
          setSrvPrice('');
          await loadServices(selectedBusiness.id);
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteService = async (id: number) => {
    if (!confirm("Ви впевнені, що хочете видалити цю послугу з прайсу?")) return;
    try {
      const res = await fetch(`http://127.0.0.1:8001/businesses/services/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await loadServices(selectedBusiness.id);
        if (editingServiceId === id) cancelEditService();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const startEditService = (service: any) => {
    setEditingServiceId(service.id);
    setSrvName(service.name);
    setSrvDuration(service.duration_minutes.toString());
    setSrvPrice(service.price.toString());
  };

  const cancelEditService = () => {
    setEditingServiceId(null);
    setSrvName('');
    setSrvPrice('');
    setSrvDuration('45');
  };

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizName || !bizSlug || !bizAddress) return alert("Заповніть усі поля салону!");
    try {
      const res = await fetch('http://127.0.0.1:8001/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: bizName, slug: bizSlug, address: bizAddress, owner_id: 1 })
      });
      if (res.ok) {
        setBizSuccess(true);
        setBizName('');
        setBizSlug('');
        setBizAddress('');
        await loadBusinesses();
        setShowAddForm(false);
        setTimeout(() => setBizSuccess(false), 3000);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleNameChange = (val: string) => {
    setBizName(val);
    const generatedSlug = val.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
    setBizSlug(generatedSlug);
  };

  const handleEditNameChange = (val: string) => {
    setEditName(val);
    const generatedSlug = val.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
    setEditSlug(generatedSlug);
  };

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#0b0f17' }}>

      <style>{`
        .anim { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); }
        .btn-gold { background-color: #c5a880 !important; color: #05070a !important; }
        .btn-gold:hover { background-color: #b39369 !important; transform: scale(1.02); }
        .btn-booksy-style { background-color: #0b0f17 !important; color: #ffffff !important; }
        .btn-booksy-style:hover { background-color: #c5a880 !important; color: #0b0f17 !important; transform: scale(1.02); }
        .input-premium { width: 100%; padding: 0.8rem 1rem; border: 1px solid #d0d5dd; border-radius: 10px; outline: none; font-size: 0.95rem; font-weight: 600; transition: all 0.2s; }
        .input-premium:focus { border-color: #0b0f17; box-shadow: 0 0 0 4px rgba(11,15,23,0.05); }
        .input-dark-premium { width: 100%; padding: 0.75rem 1rem; background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #ffffff; outline: none; font-size: 0.95rem; font-weight: 600; transition: all 0.2s; }
        .input-dark-premium:focus { border-color: #c5a880; background-color: rgba(255,255,255,0.1); box-shadow: 0 0 0 3px rgba(197, 168, 128, 0.15); }
        .card-premium { background-color: #ffffff; border-radius: 20px; padding: 2.5rem; border: 1px solid #eaecf0; box-shadow: 0 10px 30px rgba(0,0,0,0.02); }
        .business-row-card:hover { border-color: #c5a880 !important; box-shadow: 0 20px 30px rgba(11, 15, 23, 0.05); transform: translateY(-3px); }
        .service-row:hover { background-color: #fcfcfd; }
        .action-btn { border: none; padding: 0.5rem 0; border-radius: 8px; font-weight: 700; font-size: 0.85rem; cursor: pointer; transition: 0.2s; display: inline-flex; align-items: center; justify-content: center; height: 38px; }
      `}</style>

      {/* ВИПРАВЛЕНО 1: ХЕДЕР ТЕПЕР ІДЕНТИЧНИЙ ГОЛОВНІЙ СТОРІНЦІ (КОНТЕНТ ЗАКРИТИЙ В MAX-WIDTH КАНАЛІ) */}
      <header style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        backgroundColor: scrolled ? '#0b0f17' : 'transparent',
        borderBottom: scrolled ? '1px solid #1e293b' : 'none',
        padding: scrolled ? '0.6rem 0' : '1.25rem 0',
        zIndex: 100
      }} className="anim">
        <div style={{ maxWidth: '1340px', margin: '0 auto', padding: '0 4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#c5a880', cursor: 'pointer' }} onClick={() => window.location.href = '/'}>
            Book<span style={{ color: '#ffffff' }}>Era</span>
            <span style={{ fontSize: '0.8rem', color: '#ffffff', marginLeft: '0.5rem', fontWeight: '600', backgroundColor: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>БІЗНЕС</span>
          </div>
          <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#c5a880', cursor: 'pointer' }} onClick={() => window.location.href = '/'}>Повернутись на сайт →</span>
        </div>
      </header>

      {/* СИНІЙ БАНЕР З ІДЕНТИЧНИМ ВИРІВНЯННЯМ І ПРЕКРАСНОЮ ЗРУЧНОЮ ФОРМОЮ */}
      <section style={{
        backgroundColor: '#0b0f17',
        color: '#ffffff',
        background: 'radial-gradient(circle at top right, #161f30 0%, #0b0f17 100%)',
        minHeight: '240px',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        padding: '8.5rem 0 3.5rem 0',
        transition: 'all 0.3s ease'
      }}>
        <div style={{ maxWidth: '1340px', width: '100%', margin: '0 auto', padding: '0 4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box' }}>
          {currentView === 'dashboard' ? (
            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1 style={{ fontSize: '2.5rem', fontWeight: '900', margin: 0, letterSpacing: '-0.03em' }}>Мій Бізнес Кабінет</h1>
                <p style={{ color: '#94a3b8', margin: '0.25rem 0 0 0', fontSize: '1rem' }}>Керуйте діючими студіями або реєструйте нові преміум-локації.</p>
              </div>
            </div>
          ) : (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Рядок Навігації та Заголовка */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <button onClick={handleBackToDashboard} style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.15)', padding: '0.35rem 0.85rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }} className="anim">← Назад</button>
                    <span style={{ color: '#c5a880', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Живий Конструктор</span>
                  </div>
                  {!isEditingProfile && (
                    <>
                      <h1 style={{ fontSize: '2.6rem', fontWeight: '900', margin: 0, letterSpacing: '-0.03em' }}>{selectedBusiness?.name}</h1>
                      <p style={{ color: '#94a3b8', margin: '0.25rem 0 0 0', fontSize: '1rem' }}>📍 {selectedBusiness?.address}</p>
                    </>
                  )}
                </div>

                {!isEditingProfile && (
                  <button onClick={() => setIsEditingProfile(true)} className="anim btn-gold" style={{ border: 'none', padding: '0.6rem 1.5rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '750', cursor: 'pointer' }}>⚙️ Редагувати профіль закладу</button>
                )}
              </div>

              {/* ВИПРАВЛЕНО 2: РОЗКІШНЕ, ПРОСТОРЕ ПОЛЕ РЕДАКТОРУ ПРОФІЛЮ ЗАМІСТЬ УЖАСНОЇ СМУЖКИ */}
              {isEditingProfile && (
                <div style={{ width: '100%', backgroundColor: 'rgba(255,255,255,0.02)', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.07)', boxSizing: 'border-box' }} className="anim">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#c5a880', fontWeight: '700', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Назва закладу</label>
                        <input type="text" className="input-dark-premium" value={editName} onChange={(e) => handleEditNameChange(e.target.value)} placeholder="Введіть назву салону" />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', fontWeight: '700', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Унікальний URL Slug (системний)</label>
                        <input type="text" className="input-dark-premium" value={editSlug} onChange={(e) => setEditSlug(e.target.value)} disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#c5a880', fontWeight: '700', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Адреса локації</label>
                        <input type="text" className="input-dark-premium" value={editAddress} onChange={(e) => setEditAddress(e.target.value)} placeholder="Введіть повну адресу" />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', fontWeight: '700', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Instagram URL</label>
                          <input type="text" className="input-dark-premium" value={editInstagram} onChange={(e) => setEditInstagram(e.target.value)} placeholder="https://instagram.com/..." />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', fontWeight: '700', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Офіційний сайт</label>
                          <input type="text" className="input-dark-premium" value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} placeholder="https://..." />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Кнопки дій з преміум-виглядом */}
                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.5rem' }}>
                    <button onClick={() => setIsEditingProfile(false)} style={{ backgroundColor: 'transparent', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)', padding: '0.65rem 1.5rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer' }} className="anim">Скасувати</button>
                    <button onClick={handleUpdateBusinessProfile} className="anim btn-gold" style={{ border: 'none', padding: '0.65rem 2rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 20px rgba(197, 168, 128, 0.25)' }}>💾 Зберегти зміни профілю</button>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </section>

      {/* КОНТЕНТ */}
      <main style={{ maxWidth: '1340px', margin: '0 auto', padding: '0 4rem', boxSizing: 'border-box' }}>

        {/* ================= ЕКРАН 1: ДЕШБОРД ================= */}
        {currentView === 'dashboard' && (
          <div style={{ padding: '3rem 0 6rem 0' }}>
            {myBusinesses.length === 0 ? (
              <div style={{ maxWidth: '600px', margin: '0 auto' }} className="card-premium">
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <span style={{ fontSize: '3rem' }}>🏛️</span>
                  <h2 style={{ fontSize: '1.6rem', fontWeight: '800', margin: '0.5rem 0' }}>Зареєструвати новий заклад</h2>
                  <p style={{ color: '#667085', fontSize: '0.95rem' }}>Внесіть дані вашої першої студії, щоб відкрити клієнтський онлайн-запис.</p>
                </div>
                <form onSubmit={handleCreateBusiness} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <input type="text" className="input-premium" placeholder="Назва закладу" value={bizName} onChange={(e) => handleNameChange(e.target.value)} />
                  <input type="text" className="input-premium" placeholder="Slug (генерується автоматично)" value={bizSlug} onChange={(e) => setBizSlug(e.target.value)} />
                  <input type="text" className="input-premium" placeholder="Адреса" value={bizAddress} onChange={(e) => setBizAddress(e.target.value)} />
                  <button type="submit" className="anim btn-gold" style={{ border: 'none', padding: '1rem', borderRadius: '12px', fontSize: '1rem', fontWeight: '800', cursor: 'pointer', marginTop: '1rem' }}>Активувати заклад на платформі</button>
                </form>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: showAddForm ? '1.3fr 1fr' : '1fr', gap: '3.5rem', alignItems: 'start' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.6rem', fontWeight: '800', margin: 0 }}>Керувати моїми закладами</h2>
                    {!showAddForm && (
                      <button onClick={() => setShowAddForm(true)} className="anim btn-gold" style={{ border: 'none', padding: '0.75rem 1.5rem', borderRadius: '10px', fontWeight: '750', fontSize: '0.9rem', cursor: 'pointer' }}>➕ Зареєструвати нову філію</button>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {myBusinesses.map((b: any) => (
                      <div
                        key={b.id}
                        className="anim card-premium business-row-card"
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2rem', cursor: 'pointer', border: '1px solid #eef0f3' }}
                        onClick={() => handleManageSalon(b)}
                      >
                        <div>
                          <h3 style={{ fontSize: '1.4rem', fontWeight: '900', margin: '0 0 0.4rem 0', color: '#0b0f17' }}>{b.name}</h3>
                          <p style={{ margin: 0, color: '#667085', fontSize: '1rem', fontWeight: '500' }}>📍 {b.address}</p>
                        </div>
                        <span style={{ color: '#c5a880', fontWeight: '800', fontSize: '1rem' }}>Керувати закладом →</span>
                      </div>
                    ))}
                  </div>
                </div>

                {showAddForm && (
                  <div className="card-premium" style={{ border: '1px solid #c5a880', position: 'sticky', top: '7rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0 }}>Нова локація</h3>
                      <button onClick={() => setShowAddForm(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#667085' }}>✕</button>
                    </div>
                    <form onSubmit={handleCreateBusiness} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <input type="text" className="input-premium" placeholder="Назва закладу" value={bizName} onChange={(e) => handleNameChange(e.target.value)} />
                      <input type="text" className="input-premium" placeholder="slug-адреса" value={bizSlug} onChange={(e) => setBizSlug(e.target.value)} />
                      <input type="text" className="input-premium" placeholder="Повна адреса" value={bizAddress} onChange={(e) => setBizAddress(e.target.value)} />
                      <button type="submit" className="anim btn-gold" style={{ border: 'none', padding: '0.9rem', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', marginTop: '0.5rem' }}>Додати філію</button>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= ЕКРАН 2: ЖИВИЙ КОНСТРУКТОР ================= */}
        {currentView === 'manage_salon' && (
          <div style={{ display: 'grid', gridTemplateColumns: '7fr 4fr', gap: '3.5rem', margin: '2rem auto 6rem auto' }}>

            {/* ЛІВА ЧАСТИНА */}
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

                {/* ВИПРАВЛЕНО 3: СУВОРА ТРИКОЛОНКОВА СІТКА GRID. НІЧОГО НЕ ПЛИВЕ, ВСЕ СТОЇТЬ ЗАЛІЗОБЕТОННО */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '2.5rem' }}>
                  {services.length === 0 ? (
                    <div style={{ color: '#667085', fontStyle: 'italic', padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>Прайс порожній. Додайте першу процедуру у формі нижче!</div>
                  ) : (
                    services.map((service: any) => (
                      <div key={service.id} className="anim service-row" style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 120px 260px',
                        alignItems: 'center',
                        padding: '1.5rem 0',
                        borderBottom: '1px solid #f2f4f7'
                      }}>

                        {/* Колонна 1: Опис послуги */}
                        <div style={{ paddingRight: '1rem' }}>
                          <div style={{ fontWeight: '800', fontSize: '1.25rem', color: '#0b0f17', marginBottom: '0.35rem', lineHeight: '1.3' }}>
                            {service.name}
                          </div>
                          <div style={{ color: '#667085', fontSize: '0.9rem', fontWeight: '600' }}>
                            ⏱️ {service.duration_minutes} хв
                          </div>
                        </div>

                        {/* Колонна 2: Ціна (Фіксована ширина, вирівняна праворуч) */}
                        <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#0b0f17', textAlign: 'right', paddingRight: '1.5rem' }}>
                          {service.price} ₴
                        </div>

                        {/* Колонна 3: Кнопки Дій (Фіксована ширина, завжди на одному місці) */}
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button onClick={() => startEditService(service)} className="action-btn" style={{ backgroundColor: '#0b0f17', color: '#ffffff', width: '120px' }}>
                            ✏️ Редагувати
                          </button>
                          <button onClick={() => handleDeleteService(service.id)} className="action-btn" style={{ backgroundColor: '#fee2e2', color: '#ef4444', width: '110px' }}>
                            🗑️ Видалити
                          </button>
                        </div>

                      </div>
                    ))
                  )}
                </div>

                {/* ФОРМА ПРАЙСУ */}
                <div style={{ backgroundColor: '#ffffff', border: '2px dashed #cbd5e1', borderRadius: '20px', padding: '2rem', marginTop: '2rem' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '850', marginBottom: '1.25rem', color: '#0b0f17' }}>
                    {editingServiceId ? "⚡ Редагування послуги" : "➕ Додати нову послугу в прайс"}
                  </h3>
                  <form onSubmit={handleSaveService} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem' }}>Назва процедури</label>
                      <input type="text" className="input-premium" placeholder="Наприклад: Комплексна стрижка + борода" value={srvName} onChange={(e) => setSrvName(e.target.value)} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem' }}>Тривалість</label>
                        <select className="input-premium" value={srvDuration} onChange={(e) => setSrvDuration(e.target.value)} style={{ backgroundColor: '#fff' }}>
                          <option value="30">30 хвилин</option>
                          <option value="45">45 хвилин</option>
                          <option value="60">1 година</option>
                          <option value="90">1.5 години</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.4rem' }}>Ціна (₴)</label>
                        <input type="number" className="input-premium" placeholder="500" value={srvPrice} onChange={(e) => setSrvPrice(e.target.value)} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                      {editingServiceId && (
                        <button type="button" onClick={cancelEditService} style={{ flex: 1, border: 'none', padding: '0.9rem', borderRadius: '10px', fontSize: '0.95rem', fontWeight: '700', cursor: 'pointer', backgroundColor: '#f1f5f9', color: '#334155' }}>Скасувати</button>
                      )}
                      <button type="submit" className="anim btn-booksy-style" style={{ flex: 2, border: 'none', padding: '0.9rem', borderRadius: '10px', fontSize: '0.95rem', fontWeight: '800', cursor: 'pointer' }}>
                        {editingServiceId ? "Зберегти зміни" : "Опублікувати послугу в прайс"}
                      </button>
                    </div>
                  </form>
                </div>

              </div>
            </div>

            {/* ПРАВА СТОРОНА */}
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                <div style={{ border: '1px solid #eaecf0', borderRadius: '16px', overflow: 'hidden', backgroundColor: '#ffffff' }}>
                  <div style={{ height: '130px', background: 'radial-gradient(ellipse at center, #cbd5e1 0%, #94a3b8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📍</div>
                  <div style={{ padding: '1.25rem' }}>
                    <div style={{ fontWeight: '800', fontSize: '1rem', marginBottom: '0.2rem', color: '#0b0f17' }}>{selectedBusiness?.name}</div>
                    <div style={{ color: '#667085', fontSize: '0.85rem' }}>{selectedBusiness?.address}</div>
                  </div>
                </div>

                <div style={{ border: '1px solid #eaecf0', borderRadius: '16px', padding: '1.5rem', backgroundColor: '#ffffff' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: '0 0 1.25rem 0', color: '#0b0f17' }}>Наші топ-майстри</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                    {staffers.map((staff, idx) => (
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
                    <a href={editInstagram} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: '#0b0f17' }}>📸 Instagram</a>
                    <span style={{ color: '#cbd5e1' }}>•</span>
                    <a href={editWebsite} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: '#c5a880' }}>🌐 Наш сайт</a>
                  </div>
                </div>

              </div>
            </div>

          </div>
        )}

      </main>

    </div>
  );
}