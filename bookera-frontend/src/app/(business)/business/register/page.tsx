'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';

export default function BusinessRegisterWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState('');

  // Модалки
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);

  // Додаткові категорії
  const [showMoreCategories, setShowMoreCategories] = useState(false);

  // Стейт онбордингу
  const [formData, setFormData] = useState({
    businessName: '',
    phone: '',
    businessCategory: '',
    businessType: '',
    workspace: '',
    city: '',
    street: '',
    addressDetails: '',
    teamSize: '',
    hours: {
      monday: { isOpen: true, open: '09:00', close: '20:00' },
      tuesday: { isOpen: true, open: '09:00', close: '20:00' },
      wednesday: { isOpen: true, open: '09:00', close: '20:00' },
      thursday: { isOpen: true, open: '09:00', close: '20:00' },
      friday: { isOpen: true, open: '09:00', close: '20:00' },
      saturday: { isOpen: false, open: '10:00', close: '16:00' },
      sunday: { isOpen: false, open: '10:00', close: '16:00' }
    },
    services: [] as any[],
    staff: [
      { id: 1, name: 'Я (Власник)', role: 'Власник', email: '', phone: '' }
    ]
  });

  const [newStaff, setNewStaff] = useState({ name: '', email: '', phone: '', role: '' });
  const [serviceForm, setServiceForm] = useState({ id: 0, name: '', duration: 60, price: '' });
  const [editingServiceId, setEditingServiceId] = useState<number | null>(null);

  // Категорії
  const mainCategories = [
    { id: 'hair', name: 'Волосся' },
    { id: 'barber', name: 'Барбер' },
    { id: 'nails', name: 'Нігті' },
    { id: 'skincare', name: 'Догляд за шкірою' },
    { id: 'brows', name: 'Брови та вії' },
    { id: 'massage', name: 'Масаж' },
    { id: 'makeup', name: 'Макіяж' },
    { id: 'wellness', name: 'Wellness & Spa' }
  ];

  const moreCategories = [
    { id: 'aesthetic', name: 'Естетична медицина' },
    { id: 'hair_removal', name: 'Видалення волосся' },
    { id: 'home_services', name: 'Послуги на дому' },
    { id: 'piercing', name: 'Пірсинг' },
    { id: 'pets', name: 'Домашні улюбленці' },
    { id: 'dentistry', name: 'Стоматологія' },
    { id: 'health', name: 'Здоров\'я та самопочуття' },
    { id: 'professional', name: 'Професійні послуги' },
    { id: 'other', name: 'Інше' }
  ];

  // Динамічні базові послуги
  const defaultServicesMap: Record<string, any[]> = {
    'barber': [
      { id: 1, name: 'Чоловіча стрижка', duration: 45, price: '500' },
      { id: 2, name: 'Моделювання бороди', duration: 30, price: '300' }
    ],
    'hair': [
      { id: 1, name: 'Жіноча стрижка', duration: 60, price: '800' },
      { id: 2, name: 'Укладка волосся', duration: 40, price: '500' },
      { id: 3, name: 'Фарбування (в один тон)', duration: 120, price: '1500' }
    ],
    'nails': [
      { id: 1, name: 'Манікюр + Гель-лак', duration: 90, price: '600' },
      { id: 2, name: 'Педикюр (Апаратний)', duration: 90, price: '750' }
    ],
    'brows': [
      { id: 1, name: 'Корекція та фарбування брів', duration: 45, price: '450' },
      { id: 2, name: 'Ламінування вій', duration: 60, price: '600' }
    ],
    'massage': [
      { id: 1, name: 'Загальний масаж тіла', duration: 60, price: '800' },
      { id: 2, name: 'Масаж спини та шиї', duration: 30, price: '500' }
    ],
    'skincare': [
      { id: 1, name: 'Чистка обличчя', duration: 90, price: '900' },
      { id: 2, name: 'Пілінг', duration: 45, price: '700' }
    ],
    'makeup': [
      { id: 1, name: 'Вечірній макіяж', duration: 60, price: '800' },
      { id: 2, name: 'Макіяж Nude', duration: 40, price: '600' }
    ],
  };

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
    if (step < 10) setStep(prev => prev + 1);
    else handleFinalSubmit();
  };

  const handleBack = () => {
    if (step > 1) setStep(prev => prev - 1);
    else router.push('/business');
  };

  const handleFinalSubmit = async () => {
    setLoading(true);
    try {
      // owner_id більше НЕ передається звідси - раніше бралось з
      // localStorage.getItem('userId'), яке будь-хто міг підмінити в DevTools.
      // Тепер сервер сам визначає власника з перевіреного JWT-токена.
      const token = await getAuthToken();

      // ISO-порядок днів (0=понеділок...6=неділя), замість українських назв,
      // які писались у JSON-поле shifts, якого в новій схемі більше немає -
      // натомість окрема таблиця business_hours.
      const weekdayOrder: (keyof typeof formData.hours)[] =
        ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const hoursPayload = weekdayOrder.map((day, index) => ({
        weekday: index,
        is_open: formData.hours[day].isOpen,
        open_time: formData.hours[day].open,
        close_time: formData.hours[day].close,
      }));

      // 1. Створюємо бізнес через FastAPI (не напряму в Supabase)
      const business = await api.registerBusiness(token, {
        name: formData.businessName,
        category: formData.businessCategory,
        business_type: formData.businessType,
        workspace_type: formData.workspace,
        address: formData.workspace === 'client_place'
          ? formData.city.trim()
          : `${formData.city}, ${formData.street} ${formData.addressDetails}`.trim(),
        phone: `+380${formData.phone}`,
        hours: hoursPayload,
      });

      // 2. Зберігаємо послуги (кожна - окремим запитом, бекенд не має bulk-create)
      for (const s of formData.services) {
        await api.createService(token, {
          business_id: business.id,
          name: s.name,
          price: Number(s.price),
          duration_minutes: s.duration,
        });
      }

      // 3. Запрошення команді через FastAPI (тепер з токеном - раніше йшло
      // без жодної авторизації на хардкоджений 127.0.0.1:8000, що в проді
      // взагалі нікуди не вело)
      for (const member of formData.staff) {
        const isOwner = member.name.includes('Власник');
        if (!isOwner && member.email) {
          await api.inviteStaff(token, business.id, {
            email: member.email,
            role: member.role.toLowerCase().includes('адмін') ? 'admin' : 'master',
          });
        }
      }

      // Роль власника FastAPI вже виставив сам усередині registerBusiness -
      // окремого оновлення 'profiles' більше не потрібно (такої таблиці нема).
      localStorage.setItem('userRole', 'owner');

      router.push('/cabinet');

    } catch (error: any) {
      alert("Відбулася помилка при збереженні: " + error.message);
      setLoading(false);
    }
  };

  const handleToggleHour = (day: keyof typeof formData.hours) => {
    setFormData({ ...formData, hours: { ...formData.hours, [day]: { ...formData.hours[day], isOpen: !formData.hours[day].isOpen } } });
  };

  const handleTimeChange = (day: keyof typeof formData.hours, type: 'open' | 'close', value: string) => {
    setFormData({ ...formData, hours: { ...formData.hours, [day]: { ...formData.hours[day], [type]: value } } });
  };

  const handlePhoneChange = (e: any, fieldType: 'business' | 'staff') => {
    let val = e.target.value;
    if (!val.startsWith('+380')) {
      const lastChar = val.slice(-1);
      if (val.length === 1 && /\d/.test(lastChar)) val = '+380 ' + lastChar;
      else val = '+380 ';
    }
    const digitsOnly = val.substring(4).replace(/\D/g, '').slice(0, 9);
    if (fieldType === 'business') setFormData({ ...formData, phone: digitsOnly });
    else setNewStaff({ ...newStaff, phone: digitsOnly });
  };

  const isEmailValid = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const addStaffMember = () => {
    if (newStaff.name.length >= 2 && isEmailValid(newStaff.email) && newStaff.phone.length === 9) {
      setFormData({ ...formData, staff: [...formData.staff, { ...newStaff, id: Date.now() }] });
      setNewStaff({ name: '', email: '', phone: '', role: '' });
      setIsStaffModalOpen(false);
    }
  };

  const openServiceModal = (service: any = null) => {
    if (service) {
      setEditingServiceId(service.id);
      setServiceForm(service);
    } else {
      setEditingServiceId(null);
      setServiceForm({ id: 0, name: '', duration: 60, price: '' });
    }
    setIsServiceModalOpen(true);
  };

  const saveService = () => {
    if (editingServiceId) {
      setFormData({ ...formData, services: formData.services.map(s => s.id === editingServiceId ? { ...serviceForm, id: editingServiceId } : s) });
    } else {
      setFormData({ ...formData, services: [...formData.services, { ...serviceForm, id: Date.now() }] });
    }
    setIsServiceModalOpen(false);
  };

  const deleteService = (id: number) => {
    setFormData({ ...formData, services: formData.services.filter(s => s.id !== id) });
  };

  const isStepValid = () => {
    switch (step) {
      case 1: return formData.businessName.trim().length >= 2 && formData.phone.length === 9;
      case 2: return formData.businessCategory !== '';
      case 3: return formData.businessType !== '';
      case 4: return formData.workspace !== '';
      case 5:
        if (formData.workspace === 'client_place') return formData.city.trim().length >= 2;
        return formData.city.trim().length >= 2 && formData.street.trim().length >= 2;
      case 6: return formData.teamSize !== '';
      case 7: return Object.values(formData.hours).some(day => day.isOpen);
      case 8: return formData.services.length > 0;
      case 9: return formData.staff.length > 0;
      case 10: return true;
      default: return false;
    }
  };

  const progressPercentage = (step / 10) * 100;

  const getDynamicSidePanel = () => {
    switch (step) {
      case 1: return { title: "Створення профілю", desc: "Вкажіть назву та контактний телефон." };
      case 2: return { title: "Сфера діяльності", desc: "Оберіть основний напрямок." };
      case 3: return { title: "Формат бізнесу", desc: "Впливає на фінансові звіти та рівні доступу." };
      case 4: return { title: "Локація", desc: "Впливає на відображення вашої адреси." };
      case 5: return { title: "Адреса", desc: "Де саме ви знаходитесь?" };
      case 6: return { title: "Команда", desc: "Скільки людей працює у закладі?" };
      case 7: return { title: "Робочі години", desc: "Встановіть базовий графік для онлайн-записів." };
      case 8: return { title: "Прайс-лист", desc: "Базові послуги для вашої сфери." };
      case 9: return { title: "Майстри", desc: "Додайте фахівців вашої команди." };
      case 10: return { title: "Все готово", desc: "Ваш профіль повністю налаштовано." };
      default: return { title: "Налаштування", desc: "" };
    }
  };

  const sidePanel = getDynamicSidePanel();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100vw', backgroundColor: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif', alignItems: 'center', paddingTop: '4rem', paddingBottom: '4rem' }}>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .anim-step { animation: fadeIn 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) forwards; display: flex; flex-direction: column; width: 100%; }
        
        /* BookEra Style Card */
        .wizard-card {
          width: 100%; max-width: 500px; background: #ffffff; border-radius: 24px; 
          box-shadow: 0 10px 40px rgba(0,0,0,0.04), 0 2px 10px rgba(0,0,0,0.02);
          padding: 2.5rem 2.5rem; position: relative; border: 1px solid #e2e8f0; overflow: hidden;
        }

        .top-progress-bar { width: 100%; height: 4px; background-color: #f1f5f9; position: absolute; top: 0; left: 0; }
        .top-progress-fill { height: 100%; background-color: #0f172a; transition: width 0.4s cubic-bezier(0.25, 1, 0.5, 1); border-radius: 0 4px 4px 0; }

        .back-btn { background: transparent; border: none; cursor: pointer; color: #64748b; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; transition: 0.2s; position: absolute; top: 1.25rem; left: 1rem; font-size: 1.2rem; }
        .back-btn:hover { background: #f1f5f9; color: #0f172a; }

        /* Inputs */
        .custom-input { width: 100%; padding: 0.9rem 1rem; border: 1px solid #cbd5e1; border-radius: 12px; font-size: 1rem; font-weight: 500; box-sizing: border-box; margin-bottom: 1.2rem; transition: all 0.2s ease; color: #0f172a; background: #f8fafc; font-family: inherit; }
        .custom-input:focus { outline: none; background: #ffffff; border-color: #0f172a; box-shadow: 0 0 0 3px rgba(15,23,42,0.05); }
        .custom-input::placeholder { color: #94a3b8; font-weight: 400; }
        
        .input-label { font-size: 0.85rem; font-weight: 700; color: #64748b; margin-bottom: 0.4rem; display: block; text-transform: uppercase; letter-spacing: 0.05em; }

        /* Картки вибору */
        .option-card { border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 1.25rem; margin-bottom: 0.8rem; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: flex-start; gap: 1rem; background: #ffffff; }
        .option-card:hover { border-color: #cbd5e1; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.02); }
        .option-card.active { border-color: #0f172a; background: #f8fafc; box-shadow: 0 0 0 1px #0f172a; }
        
        .radio-circle { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #cbd5e1; display: flex; align-items: center; justify-content: center; transition: 0.2s; flex-shrink: 0; margin-top: 1px; }
        .option-card.active .radio-circle { border-color: #0f172a; }
        .option-card.active .radio-circle::after { content: ''; width: 10px; height: 10px; border-radius: 50%; background-color: #0f172a; }
        
        .option-title { font-weight: 800; color: #0f172a; font-size: 1.05rem; margin-bottom: 0.2rem; }

        /* BookEra Row Lists */
        .booksy-row { border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 1.1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: all 0.2s ease; background: #ffffff; margin-bottom: 0.5rem; }
        .booksy-row:hover { border-color: #cbd5e1; background: #f8fafc; }
        .booksy-row.active { border-color: #0f172a; background: #f8fafc; box-shadow: 0 0 0 1px #0f172a; }
        .booksy-row-text { font-weight: 700; color: #0f172a; font-size: 1rem; }

        /* Час як у кабінеті */
        .time-input { padding: 0.5rem 0.6rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.9rem; color: #0f172a; background: #fff; font-family: inherit; font-weight: 600; outline: none; cursor: pointer; width: 80px; text-align: center; transition: 0.2s; }
        .time-input:focus { border-color: #0f172a; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }

        .continue-btn { width: 100%; background-color: #0f172a; color: #ffffff; font-weight: 700; border: none; padding: 1.1rem; border-radius: 12px; cursor: pointer; transition: all 0.2s ease; font-size: 1.05rem; margin-top: 1.5rem; box-shadow: 0 4px 12px rgba(15,23,42,0.15); }
        .continue-btn:disabled { background-color: #e2e8f0; color: #94a3b8; cursor: not-allowed; box-shadow: none; }
        .continue-btn:not(:disabled):hover { background-color: #1e293b; transform: translateY(-1px); box-shadow: 0 6px 15px rgba(15,23,42,0.2); }

        .btn-outline { width: 100%; background-color: transparent; color: #0f172a; font-weight: 700; border: 1.5px dashed #cbd5e1; padding: 1rem; border-radius: 12px; cursor: pointer; transition: 0.2s; font-size: 0.95rem; display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin-bottom: 1rem; }
        .btn-outline:hover { background-color: #f8fafc; border-color: #94a3b8; }

        .action-icon { background: transparent; border: none; cursor: pointer; color: #64748b; font-size: 1.1rem; padding: 0.4rem; border-radius: 8px; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
        .action-icon:hover { background: #f1f5f9; color: #0f172a; }
        .action-icon.danger:hover { color: #ef4444; background: #fef2f2; }
        
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15,23,42,0.4); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 1rem; box-sizing: border-box; }
        .modal-content { background: #ffffff; width: 100%; max-width: 420px; border-radius: 20px; padding: 1.5rem 2rem; box-shadow: 0 20px 40px rgba(0,0,0,0.15); animation: fadeIn 0.2s ease-out; }

        /* 🟢 ПРАВИЛЬНИЙ І РОБОЧИЙ СКРОЛ КАТЕГОРІЙ */
        .categories-scroll-wrapper { max-height: 380px; overflow-y: auto; padding-right: 0.5rem; margin-right: -0.5rem; display: flex; flex-direction: column; }
        .categories-scroll-wrapper::-webkit-scrollbar { width: 4px; }
        .categories-scroll-wrapper::-webkit-scrollbar-track { background: transparent; }
        .categories-scroll-wrapper::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>

      {/* ОРИГІНАЛЬНИЙ ЛОГОТИП BOOKERA BUSINESS */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'center' }}>
        <Link href="/business" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#111827', letterSpacing: '-0.04em' }}>
            Book<span style={{ color: '#8fae92' }}>Era</span>
          </div>
          <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '700', marginLeft: '6px' }}>Business</span>
        </Link>
      </div>

      <div className="wizard-card">
        {/* ПОВЕРНУЛИ ПРОГРЕС БАР ЗВЕРХУ */}
        <div className="top-progress-bar"><div className="top-progress-fill" style={{ width: `${progressPercentage}%` }}></div></div>

        {step > 1 && step < 10 && <button onClick={handleBack} className="back-btn">←</button>}

        <div style={{ textAlign: 'center', marginBottom: '2rem', marginTop: step > 1 ? '1rem' : '0' }}>
          {/* ПОВЕРНУЛИ ТЕКСТ КРОКУ */}
          <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Крок {step} з 10</div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.4rem 0', letterSpacing: '-0.02em' }}>
            {sidePanel.title}
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0, lineHeight: '1.4' }}>
            {sidePanel.desc}
          </p>
        </div>

        <div>
          {/* КРОК 1 */}
          {step === 1 && (
            <div className="anim-step">
              <label className="input-label">Назва закладу</label>
              <input type="text" placeholder="Barber Studio" className="custom-input" value={formData.businessName} onChange={(e) => setFormData({...formData, businessName: e.target.value})} autoFocus />

              <label className="input-label">Номер телефону</label>
              <input
                type="tel"
                placeholder="+380 99 123 45 67"
                className="custom-input"
                value={formData.phone ? `+380 ${formData.phone}` : '+380 '}
                onChange={(e) => handlePhoneChange(e, 'business')}
              />
            </div>
          )}

          {/* 🟢 КРОК 2: КАТЕГОРІЯ (З виправленим скролом та відокремленими блоками) */}
          {step === 2 && (
            <div className="anim-step">
              <div className="categories-scroll-wrapper">
                {mainCategories.map(cat => (
                  <div key={cat.id} className={`booksy-row ${formData.businessCategory === cat.id ? 'active' : ''}`} onClick={() => {
                    const defaultSrvs = defaultServicesMap[cat.id] || [{ id: 1, name: 'Консультація', duration: 30, price: '300' }];
                    setFormData({...formData, businessCategory: cat.id, services: defaultSrvs});
                    setTimeout(() => setStep(3), 200);
                  }}>
                    <span className="booksy-row-text">{cat.name}</span>
                    {formData.businessCategory === cat.id ? (
                       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    ) : (
                       <div style={{ color: '#cbd5e1', fontSize: '1.4rem', fontWeight: 'bold' }}>›</div>
                    )}
                  </div>
                ))}

                <div className={`booksy-row`} onClick={() => setShowMoreCategories(!showMoreCategories)} style={{ borderStyle: 'dashed', backgroundColor: 'transparent', marginBottom: '1rem' }}>
                  <span className="booksy-row-text" style={{ color: '#64748b' }}>{showMoreCategories ? 'Сховати' : 'Інші сфери...'}</span>
                  <div style={{ color: '#cbd5e1', fontSize: '1.4rem', fontWeight: 'bold', transform: showMoreCategories ? 'rotate(90deg)' : 'rotate(0deg)', transition: '0.2s' }}>›</div>
                </div>

                {showMoreCategories && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '1rem', borderLeft: '2px solid #e2e8f0', marginLeft: '0.5rem', marginBottom: '1rem' }}>
                    {moreCategories.map(cat => (
                      <div key={cat.id} className={`booksy-row ${formData.businessCategory === cat.id ? 'active' : ''}`} onClick={() => {
                        const defaultSrvs = defaultServicesMap[cat.id] || [{ id: 1, name: 'Базова послуга', duration: 60, price: '500' }];
                        setFormData({...formData, businessCategory: cat.id, services: defaultSrvs});
                        setTimeout(() => setStep(3), 200);
                      }} style={{ marginBottom: 0 }}>
                        <span className="booksy-row-text" style={{ fontSize: '0.95rem' }}>{cat.name}</span>
                        {formData.businessCategory === cat.id ? (
                           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        ) : (
                           <div style={{ color: '#cbd5e1', fontSize: '1.2rem', fontWeight: 'bold' }}>›</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* КРОК 3: ФОРМАТ БІЗНЕСУ */}
          {step === 3 && (
            <div className="anim-step">
              <div className={`option-card ${formData.businessType === 'individual' ? 'active' : ''}`} onClick={() => setFormData({...formData, businessType: 'individual'})}>
                <div className="radio-circle"></div>
                <div>
                  <div className="option-title">Приватний майстер / ФОП</div>
                  <div style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: '1.4' }}>Індивідуальна фінансова аналітика та управління.</div>
                </div>
              </div>

              <div className={`option-card ${formData.businessType === 'company' ? 'active' : ''}`} onClick={() => setFormData({...formData, businessType: 'company'})}>
                <div className="radio-circle"></div>
                <div>
                  <div className="option-title">Компанія / Салон</div>
                  <div style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: '1.4' }}>Для команд. Розширене налаштування зарплат та каси.</div>
                </div>
              </div>
            </div>
          )}

          {/* КРОК 4: ЛОКАЦІЯ СЕРВІСУ */}
          {step === 4 && (
            <div className="anim-step">
              <div className={`option-card ${formData.workspace === 'my_place' ? 'active' : ''}`} onClick={() => setFormData({...formData, workspace: 'my_place'})}>
                <div className="radio-circle"></div>
                <div>
                  <div className="option-title">У закладі (Студія)</div>
                  <div style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: '1.4' }}>Клієнти приходять за вашою адресою.</div>
                </div>
              </div>

              <div className={`option-card ${formData.workspace === 'client_place' ? 'active' : ''}`} onClick={() => setFormData({...formData, workspace: 'client_place'})}>
                <div className="radio-circle"></div>
                <div>
                  <div className="option-title">Виїзне обслуговування</div>
                  <div style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: '1.4' }}>Ви приїжджаєте до клієнта. Вулиця не обов'язкова.</div>
                </div>
              </div>
            </div>
          )}

          {/* КРОК 5: АДРЕСА */}
          {step === 5 && (
            <div className="anim-step">
              <label className="input-label">Місто / Населений пункт</label>
              <input type="text" placeholder="Наприклад: Львів" className="custom-input" value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} autoFocus />

              {formData.workspace !== 'client_place' ? (
                <>
                  <label className="input-label">Вулиця та будинок</label>
                  <input type="text" placeholder="Наприклад: вул. Івана Франка, 12" className="custom-input" value={formData.street} onChange={(e) => setFormData({...formData, street: e.target.value})} />

                  <label className="input-label">Додаткові деталі (Необов'язково)</label>
                  <input type="text" placeholder="2 поверх, кабінет 4" className="custom-input" style={{ marginBottom: 0 }} value={formData.addressDetails} onChange={(e) => setFormData({...formData, addressDetails: e.target.value})} />
                </>
              ) : (
                <>
                  <label className="input-label">Район виїзду (Опціонально)</label>
                  <input type="text" placeholder="Наприклад: Сихівський район" className="custom-input" style={{ marginBottom: 0 }} value={formData.street} onChange={(e) => setFormData({...formData, street: e.target.value})} />
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem', lineHeight: '1.4' }}>Для виїзного обслуговування достатньо вказати лише місто. Вулиця не перевіряється.</div>
                </>
              )}
            </div>
          )}

          {/* КРОК 6: КОМАНДА */}
          {step === 6 && (
            <div className="anim-step">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                {['Тільки я', '2-4 спеціалісти', '5-9 спеціалістів', 'Більше 10'].map((size) => (
                  <div key={size} className={`option-card ${formData.teamSize === size ? 'active' : ''}`} style={{ marginBottom: 0, padding: '1.2rem 1rem', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.6rem' }} onClick={() => setFormData({...formData, teamSize: size})}>
                    <div className="radio-circle"></div>
                    <div className="option-title" style={{ margin: 0, fontSize: '0.95rem' }}>{size}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 🟢 КРОК 7: РОБОЧІ ГОДИНИ (Як у Кабінеті: Зелені тумблери) */}
          {step === 7 && (
            <div className="anim-step">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {Object.entries(formData.hours).map(([dayKey, data]) => {
                  const dayNames: any = { monday: 'Понеділок', tuesday: 'Вівторок', wednesday: 'Середа', thursday: 'Четвер', friday: 'П\'ятниця', saturday: 'Субота', sunday: 'Неділя' };
                  return (
                    <div key={dayKey} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', background: data.isOpen ? '#fff' : '#f8fafc', borderRadius: '12px', border: '1px solid', borderColor: data.isOpen ? '#e2e8f0' : '#f1f5f9', transition: 'all 0.2s' }}>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '140px' }}>
                        {/* Тумблер */}
                        <div
                          onClick={() => handleToggleHour(dayKey as any)}
                          style={{ width: '42px', height: '24px', borderRadius: '12px', background: data.isOpen ? '#10b981' : '#cbd5e1', position: 'relative', cursor: 'pointer', transition: 'background 0.3s' }}
                        >
                          <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: data.isOpen ? '20px' : '2px', transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}></div>
                        </div>
                        <div style={{ fontWeight: '700', color: data.isOpen ? '#0f172a' : '#94a3b8', fontSize: '0.95rem', transition: 'color 0.3s' }}>
                          {dayNames[dayKey]}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {data.isOpen ? (
                          <>
                            <input type="time" value={data.open} onChange={(e) => handleTimeChange(dayKey as any, 'open', e.target.value)} className="time-input" />
                            <span style={{ color: '#cbd5e1', fontWeight: '700' }}>—</span>
                            <input type="time" value={data.close} onChange={(e) => handleTimeChange(dayKey as any, 'close', e.target.value)} className="time-input" />
                          </>
                        ) : (
                          <div style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: '600', paddingRight: '0.5rem' }}>Вихідний</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* КРОК 8: ПРАЙС-ЛИСТ */}
          {step === 8 && (
            <div className="anim-step">
              <div style={{ marginBottom: '1rem' }}>
                {formData.services.length === 0 && <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.95rem' }}>Список порожній.</div>}

                {formData.services.map((service, index, arr) => (
                  <div key={service.id} className="booksy-row" style={{ padding: '1rem 1.25rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '1rem', marginBottom: '0.2rem' }}>{service.name}</div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>{service.duration} хв • <span style={{ color: '#0f172a', fontWeight: '700' }}>{service.price} ₴</span></div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <button onClick={() => openServiceModal(service)} className="action-icon">✎</button>
                      <button onClick={() => deleteService(service.id)} className="action-icon danger">✕</button>
                    </div>
                  </div>
                ))}
              </div>

              <button className="btn-outline" onClick={() => openServiceModal()}>+ Додати послугу</button>
            </div>
          )}

          {/* КРОК 9: КОМАНДА */}
          {step === 9 && (
            <div className="anim-step">
              <div style={{ marginBottom: '1rem' }}>
                {formData.staff.map((member) => (
                  <div key={member.id} className="booksy-row" style={{ padding: '1rem 1.25rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#f1f5f9', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '1rem', marginRight: '1rem' }}>
                      {member.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '1rem', marginBottom: '0.1rem' }}>{member.name}</div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>{member.role}</div>
                    </div>
                    {member.id !== 1 && (
                      <button onClick={() => setFormData({...formData, staff: formData.staff.filter(s => s.id !== member.id)})} className="action-icon danger">✕</button>
                    )}
                  </div>
                ))}
              </div>

              <button className="btn-outline" onClick={() => setIsStaffModalOpen(true)}>+ Запросити фахівця</button>
            </div>
          )}

          {/* КРОК 10: УСПІХ */}
          {step === 10 && (
            <div className="anim-step" style={{ alignItems: 'center', textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ width: '64px', height: '64px', background: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', boxShadow: '0 8px 20px rgba(16, 185, 129, 0.2)' }}>
                 <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <div style={{ width: '100%', textAlign: 'left', marginBottom: 0 }}>
                 <div className="booksy-row" style={{ cursor: 'default' }}>
                    <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.95rem' }}>Календар готовий до запису</span>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>
                 </div>
                 <div className="booksy-row" style={{ cursor: 'default' }}>
                    <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.95rem' }}>Системні сповіщення налаштовано</span>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>
                 </div>
                 <div className="booksy-row" style={{ cursor: 'default' }}>
                    <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.95rem' }}>Команда додана та очікує</span>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>
                 </div>
              </div>
            </div>
          )}

        </div>

        {/* Кнопка ПРОДОВЖИТИ */}
        {step !== 2 && (
          <button
            onClick={handleNext}
            className="continue-btn"
            disabled={!isStepValid() || loading}
          >
            {loading ? 'Збереження...' : step === 10 ? 'Відкрити Кабінет' : 'Продовжити'}
          </button>
        )}

      </div>

      {/* 🟢 МОДАЛКА МАЙСТРА */}
      {isStaffModalOpen && (
        <div className="modal-overlay" onClick={() => setIsStaffModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: '#0f172a' }}>Новий фахівець</h3>
              <button onClick={() => setIsStaffModalOpen(false)} style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', color: '#64748b', transition: '0.2s', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseOver={e=>e.currentTarget.style.background='#e2e8f0'}>✕</button>
            </div>

            <label className="input-label">Ім'я та прізвище</label>
            <input type="text" placeholder="Наприклад: Олексій" className="custom-input" value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} autoFocus />

            <label className="input-label">Email адреса</label>
            <input type="email" placeholder="alex@gmail.com" className="custom-input" value={newStaff.email} onChange={e => setNewStaff({...newStaff, email: e.target.value})} />
            {!isEmailValid(newStaff.email) && newStaff.email.length > 0 && <span style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '-1rem', marginBottom: '1rem', display: 'block', fontWeight: '600' }}>Некоректний формат email</span>}

            <label className="input-label">Номер телефону</label>
            <input
              type="tel"
              placeholder="+380 99 123 45 67"
              className="custom-input"
              value={newStaff.phone ? `+380 ${newStaff.phone}` : '+380 '}
              onChange={(e) => handlePhoneChange(e, 'staff')}
            />

            <label className="input-label">Посада</label>
            <input type="text" placeholder="Топ-майстер" className="custom-input" value={newStaff.role} onChange={e => setNewStaff({...newStaff, role: e.target.value})} style={{ marginBottom: 0 }} />

            <button
               className="continue-btn"
               onClick={addStaffMember}
               disabled={newStaff.name.length < 2 || !isEmailValid(newStaff.email) || newStaff.phone.length !== 9 || newStaff.role.length < 2}
            >
              Додати
            </button>
          </div>
        </div>
      )}

      {/* 🟢 МОДАЛКА ПОСЛУГИ */}
      {isServiceModalOpen && (
        <div className="modal-overlay" onClick={() => setIsServiceModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: '#0f172a' }}>{editingServiceId ? 'Редагувати' : 'Нова послуга'}</h3>
              <button onClick={() => setIsServiceModalOpen(false)} style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', color: '#64748b', transition: '0.2s', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseOver={e=>e.currentTarget.style.background='#e2e8f0'}>✕</button>
            </div>

            <label className="input-label">Назва послуги</label>
            <input type="text" placeholder="Чоловіча стрижка" className="custom-input" value={serviceForm.name} onChange={e => setServiceForm({...serviceForm, name: e.target.value})} autoFocus />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="input-label">Тривалість</label>
                <select className="custom-input" style={{ cursor: 'pointer', appearance: 'none', marginBottom: 0 }} value={serviceForm.duration} onChange={e => setServiceForm({...serviceForm, duration: Number(e.target.value)})}>
                  <option value={15}>15 хв</option>
                  <option value={30}>30 хв</option>
                  <option value={45}>45 хв</option>
                  <option value={60}>1 год</option>
                  <option value={90}>1.5 год</option>
                  <option value={120}>2 год</option>
                </select>
              </div>
              <div>
                <label className="input-label">Вартість (₴)</label>
                <input type="number" placeholder="500" className="custom-input" style={{ marginBottom: 0 }} value={serviceForm.price} onChange={e => setServiceForm({...serviceForm, price: e.target.value})} />
              </div>
            </div>

            <button className="continue-btn" onClick={saveService} disabled={serviceForm.name.length < 2 || !serviceForm.price}>
               Зберегти
            </button>
          </div>
        </div>
      )}

    </div>
  );
}