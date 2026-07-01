'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function BusinessRegisterWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState('');

  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);

  // Стейт для всіх відповідей онбордингу
  const [formData, setFormData] = useState({
    phoneCode: '',
    businessCategory: '',
    businessType: '',
    workspace: '',
    address: '',
    addressDetails: '',
    teamSize: '',
    hours: {
      monday: { isOpen: true, time: '10:00 - 19:00' },
      tuesday: { isOpen: true, time: '10:00 - 19:00' },
      wednesday: { isOpen: true, time: '10:00 - 19:00' },
      thursday: { isOpen: true, time: '10:00 - 19:00' },
      friday: { isOpen: true, time: '10:00 - 19:00' },
      saturday: { isOpen: false, time: '10:00 - 15:00' },
      sunday: { isOpen: false, time: 'Закрито' }
    },
    services: [
      { id: 1, name: 'Чоловіча стрижка', duration: '40 хв', price: '500 ₴' },
      { id: 2, name: 'Моделювання бороди', duration: '30 хв', price: '300 ₴' }
    ],
    staff: [
      { id: 1, name: 'Я (Власник)', role: 'Власник', email: '', phone: '' }
    ],
    businessFocus: '',
    bookingAdvance: '',
    previousTools: ''
  });

  const [newStaff, setNewStaff] = useState({ name: '', email: '', phone: '', role: '' });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedName = localStorage.getItem('userName');
      if (!storedName) {
        router.push('/business');
      } else {
        setUserName(storedName.split(' ')[0]);
      }
    }
  }, []);

  const handleNext = () => {
    if (step < 13) setStep(prev => prev + 1);
    else handleFinalSubmit();
  };

  const handleBack = () => {
    if (step > 1) setStep(prev => prev - 1);
    else router.push('/business');
  };

  const handleFinalSubmit = () => {
    setLoading(true);
    setTimeout(() => {
      localStorage.setItem('userRole', 'vendor');
      setLoading(false);
      router.push('/cabinet');
    }, 1500);
  };

  const handleToggleHour = (day: keyof typeof formData.hours) => {
    setFormData({
      ...formData,
      hours: { ...formData.hours, [day]: { ...formData.hours[day], isOpen: !formData.hours[day].isOpen } }
    });
  };

  const addStaffMember = () => {
    if (newStaff.name) {
      setFormData({ ...formData, staff: [...formData.staff, { ...newStaff, id: Date.now() }] });
      setNewStaff({ name: '', email: '', phone: '', role: '' });
      setIsStaffModalOpen(false);
    }
  };

  const isStepValid = () => {
    switch (step) {
      case 1: return formData.phoneCode.length === 4;
      case 2: return formData.businessCategory !== '';
      case 3: return formData.businessType !== '';
      case 4: return formData.workspace !== '';
      case 5: return formData.address.trim() !== '';
      case 6: return formData.teamSize !== '';
      case 7: return true;
      case 8: return formData.services.length > 0;
      case 9: return true;
      case 10: return formData.businessFocus !== '';
      case 11: return formData.bookingAdvance !== '';
      case 12: return formData.previousTools !== '';
      case 13: return true;
      default: return false;
    }
  };

  const progressPercentage = (step / 13) * 100;

  // Динамічний контент лівої панелі (Унікальна фішка BookEra)
  const getDynamicSidePanel = () => {
    if (step === 1) return { title: "Безпека понад усе", desc: "Ми перевіряємо номери телефонів, щоб захистити платформу від спаму та фейкових бронювань." };
    if (step >= 2 && step <= 4) return { title: "Закладаємо фундамент", desc: "Розкажіть про свій формат, щоб ми адаптували інструменти BookEra саме під ваш стиль роботи." };
    if (step >= 5 && step <= 7) return { title: "Ваш простір та час", desc: "Клієнти люблять знати, куди вони йдуть і коли ви доступні. Налаштуйте свій ідеальний графік." };
    if (step >= 8 && step <= 9) return { title: "Послуги та команда", desc: "Ваш прайс та майстри — це візитівка бізнесу. Зробіть їх бездоганними для нових клієнтів." };
    if (step >= 10 && step <= 12) return { title: "Налаштування потоку", desc: "Як саме клієнти будуть до вас записуватись? Визначаємо правила гри." };
    return { title: "Вітаємо в сім'ї!", desc: "Ваш бізнес готовий до масштабування. Починаємо нову еру разом з BookEra." };
  };

  const sidePanel = getDynamicSidePanel();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#ffffff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }
        .anim-step { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; display: flex; flex-direction: column; flex: 1; height: 100%; }

        /* Ліва динамічна панель */
        .split-left { flex: 0.8; background-color: #0b0f17; position: relative; display: flex; flex-direction: column; justify-content: space-between; padding: 4rem; color: #ffffff; overflow: hidden; }
        .split-left::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: radial-gradient(circle at top left, rgba(197,168,128,0.15), transparent 50%); z-index: 1; pointer-events: none; }

        /* Права форма */
        .split-right { flex: 1.2; display: flex; flex-direction: column; position: relative; background: #ffffff; }

        /* Прогрес бар на всю ширину правої частини */
        .top-progress-bar { width: 100%; height: 4px; background-color: #f1f5f9; position: absolute; top: 0; left: 0; z-index: 10; }
        .top-progress-fill { height: 100%; background-color: #c5a880; transition: width 0.5s cubic-bezier(0.25, 1, 0.5, 1); }

        .form-wrapper { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem 2rem; overflow-y: auto; }
        .form-content { width: 100%; max-width: 460px; min-height: 480px; display: flex; flex-direction: column; }

        .back-btn { position: absolute; top: 2rem; left: 2.5rem; background: transparent; border: 1px solid #e2e8f0; font-size: 1.2rem; cursor: pointer; color: #0f172a; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; transition: 0.2s; z-index: 10; }
        .back-btn:hover { background: #f8fafc; border-color: #cbd5e1; }

        .step-title { font-size: 2rem; font-weight: 900; color: #0f172a; margin: 0 0 0.5rem 0; letter-spacing: -0.03em; line-height: 1.1; }
        .step-subtitle { color: #64748b; font-size: 1rem; margin-bottom: 2.5rem; line-height: 1.5; }

        .category-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 2rem; }
        .cat-card { border: 2px solid #e2e8f0; border-radius: 16px; padding: 1.5rem 1rem; text-align: center; cursor: pointer; transition: 0.2s; background: #fff; }
        .cat-card:hover { border-color: #c5a880; background: #fdfdf9; transform: translateY(-3px); box-shadow: 0 10px 20px rgba(197, 168, 128, 0.08); }
        .cat-card.active { border-color: #c5a880; background: #fdfdf9; box-shadow: 0 4px 15px rgba(197, 168, 128, 0.15); }
        .cat-icon { font-size: 2.2rem; margin-bottom: 0.75rem; }
        .cat-name { font-weight: 800; color: #0f172a; font-size: 0.95rem; }

        .option-card { border: 2px solid #e2e8f0; border-radius: 14px; padding: 1.25rem 1.5rem; margin-bottom: 1rem; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; gap: 1.25rem; background: #ffffff; }
        .option-card:hover { border-color: #cbd5e1; background: #f8fafc; }
        .option-card.active { border-color: #0f172a; background: #f8fafc; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }

        .radio-circle { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #cbd5e1; display: flex; align-items: center; justify-content: center; transition: 0.2s; flex-shrink: 0; }
        .option-card.active .radio-circle { border-color: #c5a880; }
        .option-card.active .radio-circle::after { content: ''; width: 12px; height: 12px; border-radius: 50%; background-color: #c5a880; }

        .option-title { font-weight: 800; color: #0f172a; font-size: 1.05rem; margin-bottom: 0.25rem; }
        .option-desc { color: #64748b; font-size: 0.9rem; line-height: 1.4; font-weight: 500; }

        .input-field { width: 100%; padding: 1.1rem 1.25rem; border: 1px solid #cbd5e1; border-radius: 12px; font-size: 1.05rem; box-sizing: border-box; margin-bottom: 1.25rem; transition: 0.2s; color: #0f172a; background: #fff; }
        .input-field:focus { outline: none; border-color: #c5a880; box-shadow: 0 0 0 4px rgba(197, 168, 128, 0.15); }

        .continue-btn { width: 100%; background-color: #0f172a; color: #ffffff; font-weight: 800; border: none; padding: 1.25rem; border-radius: 14px; cursor: pointer; transition: 0.2s; font-size: 1.1rem; margin-top: auto; letter-spacing: 0.02em; }
        .continue-btn:disabled { background-color: #e2e8f0; color: #94a3b8; cursor: not-allowed; }
        .continue-btn:not(:disabled):hover { background-color: #c5a880; color: #0f172a; box-shadow: 0 10px 25px rgba(197, 168, 128, 0.3); transform: translateY(-2px); }

        .btn-outline { width: 100%; background-color: transparent; color: #0f172a; font-weight: 800; border: 2px dashed #e2e8f0; padding: 1.1rem; border-radius: 14px; cursor: pointer; transition: 0.2s; font-size: 1.05rem; margin-bottom: 1.5rem; }
        .btn-outline:hover { background-color: #f8fafc; border-color: #cbd5e1; }

        /* Кастомний Toggle в кольорах бренду */
        .switch { position: relative; display: inline-block; width: 48px; height: 26px; flex-shrink: 0; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #e2e8f0; transition: .3s; border-radius: 26px; }
        .slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.15); }
        input:checked + .slider { background-color: #c5a880; }
        input:checked + .slider:before { transform: translateX(22px); }

        .list-row { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 0; border-bottom: 1px solid #f1f5f9; }
        .list-row:last-child { border-bottom: none; }

        .map-placeholder { width: 100%; height: 220px; background-color: #f1f5f9; border-radius: 16px; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; border: 1px solid #e2e8f0; }
        .map-pin { font-size: 2.5rem; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3)); z-index: 2; }
        .map-bg { position: absolute; width: 100%; height: 100%; object-fit: cover; opacity: 0.4; z-index: 1; filter: grayscale(100%); }

        .success-item { display: flex; align-items: center; gap: 1.25rem; background: #f8fafc; padding: 1.5rem; border-radius: 16px; margin-bottom: 0.75rem; border: 1px solid #f1f5f9; transition: 0.2s; }
        .success-item:hover { transform: translateX(5px); border-color: #e2e8f0; background: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
        .success-icon { font-size: 2rem; }

        @media (max-width: 1000px) { .split-left { display: none; } }
      `}</style>

      {/* ЛІВА ЧАСТИНА (Динамічний Бренд-Асистент) */}
      <div className="split-left">
        <div style={{ position: 'relative', zIndex: 2 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '2rem', fontWeight: '900', color: '#c5a880', letterSpacing: '-0.04em', lineHeight: 1 }}>
              Book<span style={{ color: '#ffffff' }}>Era</span>
            </span>
            <span style={{ fontSize: '1rem', color: '#e2e8f0', fontWeight: '500', lineHeight: 1 }}>Business</span>
          </Link>
        </div>

        <div key={sidePanel.title} style={{ position: 'relative', zIndex: 2, animation: 'fadeIn 0.5s ease' }}>
          <div style={{ display: 'inline-block', border: '1px solid rgba(197, 168, 128, 0.4)', color: '#c5a880', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '800', letterSpacing: '0.05em', margin: '0 0 1.5rem 0', textTransform: 'uppercase' }}>
            Крок {step} з 13
          </div>
          <h1 style={{ fontSize: '3.2rem', fontWeight: '900', lineHeight: '1.1', margin: '0 0 1.5rem 0', letterSpacing: '-0.02em', color: '#ffffff' }}>
            {sidePanel.title}
          </h1>
          <p style={{ fontSize: '1.15rem', color: '#94a3b8', lineHeight: '1.6', maxWidth: '400px', fontWeight: '500' }}>
            {sidePanel.desc}
          </p>
        </div>

        <div style={{ position: 'relative', zIndex: 2, fontSize: '0.85rem', color: '#475569', fontWeight: '600' }}>
          Допомога: support@bookera.com
        </div>
      </div>

      {/* ПРАВА ЧАСТИНА (Форма) */}
      <div className="split-right">

        {/* Прогрес бар зверху */}
        <div className="top-progress-bar">
          <div className="top-progress-fill" style={{ width: `${progressPercentage}%` }}></div>
        </div>

        {step < 13 && (
          <button onClick={handleBack} className="back-btn">←</button>
        )}

        <div className="form-wrapper">
          <div className="form-content">

            {/* КРОК 1: Телефон */}
            {step === 1 && (
              <div className="anim-step" style={{ textAlign: 'center', marginTop: '2rem' }}>
                <h2 className="step-title">Підтвердіть номер</h2>
                <p className="step-subtitle">Ми надіслали 4-значний код на номер<br/><b style={{ color: '#0f172a' }}>+380 99 123 45 67</b></p>

                <input
                  type="text" placeholder="- - - -" maxLength={4}
                  className="input-field"
                  style={{ textAlign: 'center', fontSize: '2.5rem', letterSpacing: '0.8em', fontWeight: '900', padding: '1.5rem', background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '16px' }}
                  value={formData.phoneCode} onChange={(e) => setFormData({...formData, phoneCode: e.target.value})}
                />
                <div style={{ color: '#c5a880', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer', marginTop: '1rem' }}>Відправити код ще раз (0:54)</div>
              </div>
            )}

            {/* КРОК 2: Категорія Бізнесу */}
            {step === 2 && (
              <div className="anim-step">
                <h2 className="step-title">Сфера діяльності</h2>
                <p className="step-subtitle">Який напрямок найкраще описує ваш бізнес?</p>

                <div className="category-grid">
                  {[
                    { id: 'barber', name: 'Барбершоп', icon: '💈' },
                    { id: 'hair', name: 'Перукарня', icon: '✂️' },
                    { id: 'nails', name: 'Нігтьова студія', icon: '💅' },
                    { id: 'spa', name: 'Масаж та СПА', icon: '💆‍♀️' },
                  ].map(cat => (
                    <div key={cat.id} className={`cat-card ${formData.businessCategory === cat.id ? 'active' : ''}`} onClick={() => setFormData({...formData, businessCategory: cat.id})}>
                      <div className="cat-icon">{cat.icon}</div>
                      <div className="cat-name">{cat.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* КРОК 3: Тип бізнесу */}
            {step === 3 && (
              <div className="anim-step">
                <h2 className="step-title">Форма реєстрації</h2>
                <p className="step-subtitle">Як ваш бізнес зареєстровано юридично?</p>

                <div className={`option-card ${formData.businessType === 'individual' ? 'active' : ''}`} onClick={() => setFormData({...formData, businessType: 'individual'})}>
                  <div className="radio-circle"></div>
                  <div>
                    <div className="option-title">Індивідуальний майстер / ФОП</div>
                    <div className="option-desc">Я працюю як самостійний спеціаліст.</div>
                  </div>
                </div>

                <div className={`option-card ${formData.businessType === 'company' ? 'active' : ''}`} onClick={() => setFormData({...formData, businessType: 'company'})}>
                  <div className="radio-circle"></div>
                  <div>
                    <div className="option-title">Компанія / ТОВ</div>
                    <div className="option-desc">Офіційний салон з найманими працівниками.</div>
                  </div>
                </div>
              </div>
            )}

            {/* КРОК 4: Місце роботи */}
            {step === 4 && (
              <div className="anim-step">
                <h2 className="step-title">Де ви працюєте{userName ? `, ${userName}` : ''}?</h2>
                <p className="step-subtitle">Оберіть основний формат надання послуг.</p>

                <div className={`option-card ${formData.workspace === 'my_place' ? 'active' : ''}`} onClick={() => setFormData({...formData, workspace: 'my_place'})}>
                  <div className="radio-circle"></div>
                  <div>
                    <div className="option-title">У своєму закладі</div>
                    <div className="option-desc">Клієнти приходять до мене (салон, кабінет).</div>
                  </div>
                </div>

                <div className={`option-card ${formData.workspace === 'client_place' ? 'active' : ''}`} onClick={() => setFormData({...formData, workspace: 'client_place'})}>
                  <div className="radio-circle"></div>
                  <div>
                    <div className="option-title">На виїзді у клієнта</div>
                    <div className="option-desc">Послуги надаються на локації клієнта.</div>
                  </div>
                </div>
              </div>
            )}

            {/* КРОК 5: Адреса */}
            {step === 5 && (
              <div className="anim-step">
                <h2 className="step-title">Адреса закладу</h2>

                <div className="map-placeholder">
                  <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" className="map-bg" alt="Map" />
                  <span className="map-pin">📍</span>
                  <div style={{ position: 'absolute', bottom: '15px', background: '#0f172a', color: '#fff', padding: '0.6rem 1.2rem', borderRadius: '20px', fontSize: '0.85rem', zIndex: 3, fontWeight: '700' }}>Уточнити на мапі</div>
                </div>

                <input type="text" placeholder="Місто, вулиця та номер будинку" className="input-field" style={{ marginBottom: '0.75rem' }} value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
                <input type="text" placeholder="Номер офісу, кабінету (необов'язково)" className="input-field" value={formData.addressDetails} onChange={(e) => setFormData({...formData, addressDetails: e.target.value})} />
              </div>
            )}

            {/* КРОК 6: Розмір команди */}
            {step === 6 && (
              <div className="anim-step">
                <h2 className="step-title">Масштаб бізнесу</h2>
                <p className="step-subtitle">Вкажіть кількість спеціалістів у закладі.</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {['Тільки я', '2-4 майстри', '5-9 майстрів', 'Більше 10'].map((size) => (
                    <div key={size} className={`option-card ${formData.teamSize === size ? 'active' : ''}`} style={{ margin: 0, padding: '1rem', flexDirection: 'column', textAlign: 'center', gap: '0.75rem' }} onClick={() => setFormData({...formData, teamSize: size})}>
                      <div className="radio-circle" style={{ margin: '0 auto' }}></div>
                      <div className="option-title" style={{ margin: 0, fontSize: '0.95rem' }}>{size}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* КРОК 7: Графік */}
            {step === 7 && (
              <div className="anim-step">
                <h2 className="step-title">Графік роботи</h2>
                <p className="step-subtitle">Коли ви готові приймати клієнтів?</p>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {Object.entries(formData.hours).map(([dayKey, data]) => {
                    const dayNames = { monday: 'Понеділок', tuesday: 'Вівторок', wednesday: 'Середа', thursday: 'Четвер', friday: 'П\'ятниця', saturday: 'Субота', sunday: 'Неділя' };
                    return (
                      <div key={dayKey} className="list-row">
                        <label className="switch">
                          <input type="checkbox" checked={data.isOpen} onChange={() => handleToggleHour(dayKey as any)} />
                          <span className="slider"></span>
                        </label>
                        <div style={{ fontWeight: '800', color: '#0f172a', width: '100px', fontSize: '0.95rem' }}>{dayNames[dayKey as keyof typeof dayNames]}</div>
                        <div style={{ color: data.isOpen ? '#0f172a' : '#94a3b8', fontSize: '0.95rem', fontWeight: data.isOpen ? '700' : '500' }}>
                          {data.isOpen ? data.time : 'Закрито'} {data.isOpen && <span style={{ color: '#cbd5e1', marginLeft: '0.5rem' }}>›</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* КРОК 8: Послуги */}
            {step === 8 && (
              <div className="anim-step">
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', margin: '0 auto 1rem auto', border: '3px solid #e2e8f0', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                    <img src="https://images.unsplash.com/photo-1599351431202-1e0f0137899a?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80" alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <h2 className="step-title">Ваш прайс-лист</h2>
                  <p className="step-subtitle" style={{ marginBottom: '1rem' }}>Ми додали популярні послуги. Ви зможете відредагувати їх пізніше.</p>
                </div>

                <div style={{ marginBottom: '1.5rem', flex: 1, overflowY: 'auto' }}>
                  {formData.services.map(service => (
                    <div key={service.id} className="list-row">
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <span style={{ cursor: 'pointer', color: '#cbd5e1', fontSize: '1.2rem', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.color='#ef4444'} onMouseOut={e => e.currentTarget.style.color='#cbd5e1'}>🗑️</span>
                        <div>
                          <div style={{ fontWeight: '800', color: '#0f172a' }}>{service.name}</div>
                          <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>{service.duration}</div>
                        </div>
                      </div>
                      <div style={{ fontWeight: '800', color: '#0f172a', background: '#f1f5f9', padding: '0.4rem 0.8rem', borderRadius: '8px' }}>{service.price}</div>
                    </div>
                  ))}
                </div>

                <button className="btn-outline">+ Додати нову послугу</button>
              </div>
            )}

            {/* КРОК 9: Команда */}
            {step === 9 && (
              <div className="anim-step">
                <h2 className="step-title">Ваша команда</h2>
                <p className="step-subtitle">Додайте майстрів, щоб вони мали власні графіки та могли приймати записи.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                  {formData.staff.map(member => (
                    <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', border: '1px solid #e2e8f0', borderRadius: '16px', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#0f172a', color: '#c5a880', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '1.3rem' }}>
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '1.05rem', marginBottom: '0.2rem' }}>{member.name}</div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>{member.role}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <button className="btn-outline" onClick={() => setIsStaffModalOpen(true)}>+ Додати працівника</button>

                {isStaffModalOpen && (
                  <div className="sub-modal-overlay">
                    <div className="sub-modal anim-step">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <h3 style={{ fontSize: '1.6rem', fontWeight: '900', margin: 0, color: '#0f172a', letterSpacing: '-0.02em' }}>Новий працівник</h3>
                        <button onClick={() => setIsStaffModalOpen(false)} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
                      </div>
                      <input type="text" placeholder="Ім'я та Прізвище" className="input-field" value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} />
                      <input type="email" placeholder="E-mail адреса" className="input-field" value={newStaff.email} onChange={e => setNewStaff({...newStaff, email: e.target.value})} />
                      <input type="text" placeholder="Посада (напр. Топ-барбер)" className="input-field" value={newStaff.role} onChange={e => setNewStaff({...newStaff, role: e.target.value})} />
                      <button className="continue-btn" style={{ marginTop: '1rem' }} onClick={addStaffMember} disabled={!newStaff.name}>Зберегти працівника</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* КРОК 10: Фокус */}
            {step === 10 && (
              <div className="anim-step">
                <h2 className="step-title">Яка головна мета вашого бізнесу зараз?</h2>
                <div style={{ marginTop: '2rem' }}>
                  <div className={`option-card ${formData.businessFocus === 'new_clients' ? 'active' : ''}`} onClick={() => setFormData({...formData, businessFocus: 'new_clients'})}>
                    <div className="radio-circle"></div><div className="option-desc" style={{ color: formData.businessFocus === 'new_clients' ? '#0f172a' : '#64748b', fontWeight: formData.businessFocus === 'new_clients' ? '700' : '500', fontSize: '1rem' }}>Потрібні нові клієнти, щоб заповнити вікна.</div>
                  </div>
                  <div className={`option-card ${formData.businessFocus === 'balance' ? 'active' : ''}`} onClick={() => setFormData({...formData, businessFocus: 'balance'})}>
                    <div className="radio-circle"></div><div className="option-desc" style={{ color: formData.businessFocus === 'balance' ? '#0f172a' : '#64748b', fontWeight: formData.businessFocus === 'balance' ? '700' : '500', fontSize: '1rem' }}>Баланс між новими та збереженням постійних.</div>
                  </div>
                  <div className={`option-card ${formData.businessFocus === 'manage' ? 'active' : ''}`} onClick={() => setFormData({...formData, businessFocus: 'manage'})}>
                    <div className="radio-circle"></div><div className="option-desc" style={{ color: formData.businessFocus === 'manage' ? '#0f172a' : '#64748b', fontWeight: formData.businessFocus === 'manage' ? '700' : '500', fontSize: '1rem' }}>Розклад заповнений, шукаю інструмент управління.</div>
                  </div>
                </div>
              </div>
            )}

            {/* КРОК 11: Бронювання */}
            {step === 11 && (
              <div className="anim-step">
                <h2 className="step-title">Глибина запису</h2>
                <p className="step-subtitle">Як задовго клієнти зазвичай записуються до вас?</p>
                <div style={{ marginTop: '1.5rem' }}>
                  <div className={`option-card ${formData.bookingAdvance === 'same_week' ? 'active' : ''}`} onClick={() => setFormData({...formData, bookingAdvance: 'same_week'})}>
                    <div className="radio-circle"></div><div className="option-desc" style={{ color: formData.bookingAdvance === 'same_week' ? '#0f172a' : '#64748b', fontWeight: formData.bookingAdvance === 'same_week' ? '700' : '500', fontSize: '1rem' }}>Протягом того ж тижня.</div>
                  </div>
                  <div className={`option-card ${formData.bookingAdvance === '1_4_weeks' ? 'active' : ''}`} onClick={() => setFormData({...formData, bookingAdvance: '1_4_weeks'})}>
                    <div className="radio-circle"></div><div className="option-desc" style={{ color: formData.bookingAdvance === '1_4_weeks' ? '#0f172a' : '#64748b', fontWeight: formData.bookingAdvance === '1_4_weeks' ? '700' : '500', fontSize: '1rem' }}>За 1-4 тижні наперед.</div>
                  </div>
                  <div className={`option-card ${formData.bookingAdvance === 'month_plus' ? 'active' : ''}`} onClick={() => setFormData({...formData, bookingAdvance: 'month_plus'})}>
                    <div className="radio-circle"></div><div className="option-desc" style={{ color: formData.bookingAdvance === 'month_plus' ? '#0f172a' : '#64748b', fontWeight: formData.bookingAdvance === 'month_plus' ? '700' : '500', fontSize: '1rem' }}>Бронюють як мінімум за місяць.</div>
                  </div>
                </div>
              </div>
            )}

            {/* КРОК 12: Інструменти */}
            {step === 12 && (
              <div className="anim-step">
                <h2 className="step-title">Досвід роботи з CRM</h2>
                <p className="step-subtitle">Чи використовували ви раніше інші програми для запису?</p>
                <div style={{ marginTop: '2rem' }}>
                  <div className={`option-card ${formData.previousTools === 'no' ? 'active' : ''}`} onClick={() => setFormData({...formData, previousTools: 'no'})}>
                    <div className="radio-circle"></div><div className="option-title" style={{ margin: 0, fontSize: '1.1rem' }}>Ні, це мій перший досвід</div>
                  </div>
                  <div className={`option-card ${formData.previousTools === 'yes' ? 'active' : ''}`} onClick={() => setFormData({...formData, previousTools: 'yes'})}>
                    <div className="radio-circle"></div><div className="option-title" style={{ margin: 0, fontSize: '1.1rem' }}>Так, маю досвід використання</div>
                  </div>
                </div>
              </div>
            )}

            {/* КРОК 13: Успіх */}
            {step === 13 && (
              <div className="anim-step" style={{ marginTop: '1rem' }}>
                <h2 className="step-title" style={{ fontSize: '2.4rem' }}>Вітаємо{userName ? `, ${userName}` : ''}! 🎉</h2>
                <p className="step-subtitle" style={{ fontSize: '1.1rem', marginBottom: '2rem' }}>Ваш бізнес-профіль успішно створено.</p>

                <div className="success-item">
                  <div className="success-icon">📱</div>
                  <div style={{ fontSize: '1rem', color: '#0f172a', fontWeight: '700', lineHeight: 1.4 }}>Клієнти самостійно бронюють послуги 24/7.</div>
                </div>
                <div className="success-item">
                  <div className="success-icon">🔔</div>
                  <div style={{ fontSize: '1rem', color: '#0f172a', fontWeight: '700', lineHeight: 1.4 }}>Автоматичні нагадування захистять від неявок.</div>
                </div>
                <div className="success-item">
                  <div className="success-icon">💳</div>
                  <div style={{ fontSize: '1rem', color: '#0f172a', fontWeight: '700', lineHeight: 1.4 }}>Безпечні платежі та зручна аналітика доходів.</div>
                </div>
              </div>
            )}

            {/* Кнопка Продовжити */}
            <button
              onClick={handleNext}
              className="continue-btn"
              disabled={!isStepValid() || loading}
            >
              {loading ? 'Створюємо кабінет...' : step === 13 ? 'Перейти в Кабінет' : 'Продовжити'}
            </button>

          </div>
        </div>
      </div>

    </div>
  );
}