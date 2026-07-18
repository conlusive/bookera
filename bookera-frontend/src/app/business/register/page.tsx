'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

export default function BusinessRegisterWizard() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState('');

  // Модалки
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);

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
      monday: { isOpen: true, open: '10:00', close: '19:00' },
      tuesday: { isOpen: true, open: '10:00', close: '19:00' },
      wednesday: { isOpen: true, open: '10:00', close: '19:00' },
      thursday: { isOpen: true, open: '10:00', close: '19:00' },
      friday: { isOpen: true, open: '10:00', close: '19:00' },
      saturday: { isOpen: false, open: '10:00', close: '15:00' },
      sunday: { isOpen: false, open: '10:00', close: '15:00' }
    },
    services: [
      { id: 1, name: 'Чоловіча стрижка', duration: 45, price: '500' },
      { id: 2, name: 'Моделювання бороди', duration: 30, price: '300' }
    ],
    staff: [
      { id: 1, name: 'Я (Власник)', role: 'Власник', email: '', phone: '' }
    ]
  });

  const [newStaff, setNewStaff] = useState({ name: '', email: '', phone: '', role: '' });
  const [serviceForm, setServiceForm] = useState({ id: 0, name: '', duration: 60, price: '' });
  const [editingServiceId, setEditingServiceId] = useState<number | null>(null);

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

  // 🚀 РЕАЛЬНИЙ ЗАПИС У БАЗУ ДАНИХ
  const handleFinalSubmit = async () => {
    setLoading(true);
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) throw new Error('Користувача не знайдено в сесії');

      const dayMap: Record<string, string> = { monday: 'Понеділок', tuesday: 'Вівторок', wednesday: 'Середа', thursday: 'Четвер', friday: 'П\'ятниця', saturday: 'Субота', sunday: 'Неділя' };
      const mappedShifts = Object.entries(formData.hours).map(([key, value]) => ({
        day: dayMap[key],
        active: value.isOpen,
        start: value.open,
        end: value.close
      }));

      const { data: business, error: bizError } = await supabase
        .from('businesses')
        .insert({
          owner_id: userId,
          name: formData.businessName,
          category: formData.businessCategory,
          address: `${formData.city}, ${formData.street} ${formData.addressDetails}`.trim(),
          phone: `+380${formData.phone}`,
          shifts: mappedShifts
        })
        .select()
        .single();

      if (bizError) throw bizError;

      if (formData.services.length > 0) {
        const servicesToInsert = formData.services.map(s => ({
          business_id: business.id,
          name: s.name,
          price: Number(s.price),
          duration: s.duration
        }));
        await supabase.from('services').insert(servicesToInsert);
      }

      if (formData.staff.length > 0) {
        const staffToInsert = formData.staff.map(s => {
          const isOwner = s.name.includes('Власник');
          return {
            business_id: business.id,
            name: isOwner ? (userName || 'Власник бізнесу') : s.name,
            title: s.role,
            email: s.email || null,
            phone: s.phone ? `+380${s.phone}` : (isOwner ? `+380${formData.phone}` : null),
            role: isOwner ? 'owner' : 'master',
            status: isOwner ? 'active' : 'pending',
            provides_services: true,
            commission_rate: 40,
            fixed_salary: 0
          };
        });

        const { error: staffError } = await supabase.from('staff').insert(staffToInsert);
        if (staffError) throw new Error("Не вдалося зберегти команду.");
      }

      await supabase.from('profiles').update({ role: 'vendor' }).eq('id', userId);
      localStorage.setItem('userRole', 'vendor');
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

  // 🟢 Валідація Email
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

  // 🟢 СУВОРА ВАЛІДАЦІЯ КОЖНОГО КРОКУ
  const isStepValid = () => {
    switch (step) {
      case 1: return formData.businessName.trim().length >= 2 && formData.phone.length === 9;
      case 2: return formData.businessCategory !== '';
      case 3: return formData.businessType !== '';
      case 4: return formData.workspace !== '';
      case 5: return formData.city.trim().length >= 2 && formData.street.trim().length >= 2;
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
      case 1: return { title: "Створення профілю", desc: "Вкажіть публічну назву вашого закладу та офіційний контактний телефон." };
      case 2: return { title: "Сфера діяльності", desc: "Оберіть основний напрямок для ідеальної адаптації системи." };
      case 3: return { title: "Формат бізнесу", desc: "Як саме ви працюєте? Це потрібно для фінансів." };
      case 4: return { title: "Локація сервісу", desc: "Ви приймаєте в салоні чи працюєте на виїзді?" };
      case 5: return { title: "Адреса", desc: "Де саме ви знаходитесь? Клієнти бачитимуть це на мапі." };
      case 6: return { title: "Команда", desc: "Скільки людей працює у вашому закладі?" };
      case 7: return { title: "Робочі години", desc: "Встановіть базовий графік для онлайн-записів." };
      case 8: return { title: "Прайс-лист", desc: "Створіть свій каталог послуг з цінами та тривалістю." };
      case 9: return { title: "Майстри", desc: "Додайте майстрів. Вони отримають запрошення на пошту." };
      case 10: return { title: "Все готово 🎉", desc: "Ваш профіль повністю налаштовано. Запускаємо систему!" };
      default: return { title: "Налаштування", desc: "" };
    }
  };

  const sidePanel = getDynamicSidePanel();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100vw', backgroundColor: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif', alignItems: 'center', paddingTop: '4rem', paddingBottom: '4rem' }}>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .anim-step { animation: fadeIn 0.3s ease-out forwards; display: flex; flex-direction: column; width: 100%; height: 100%; }

        .wizard-card {
          width: 100%; max-width: 580px; background: #ffffff; border-radius: 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.04);
          padding: 3rem; position: relative; overflow: hidden; border: 1px solid #e2e8f0;
        }

        .top-progress-bar { width: 100%; height: 4px; background-color: #f1f5f9; position: absolute; top: 0; left: 0; }
        .top-progress-fill { height: 100%; background-color: #0f172a; transition: width 0.4s cubic-bezier(0.25, 1, 0.5, 1); }

        .back-btn { background: #f8fafc; border: 1px solid #e2e8f0; cursor: pointer; color: #475569; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; transition: 0.2s; position: absolute; top: 1.5rem; left: 1.5rem; font-size: 1.1rem; }
        .back-btn:hover { background: #f1f5f9; color: #0f172a; }

        .input-field { width: 100%; padding: 1rem 1.2rem; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 1rem; box-sizing: border-box; margin-bottom: 1.5rem; transition: 0.2s; color: #0f172a; background: #f8fafc; }
        .input-field:focus { outline: none; border-color: #cbd5e1; background: #fff; box-shadow: 0 0 0 3px rgba(15,23,42,0.05); }
        .input-field::placeholder { color: #94a3b8; }
        .input-label { font-size: 0.85rem; font-weight: 700; color: #475569; margin-bottom: 0.5rem; display: block; text-transform: uppercase; letter-spacing: 0.05em; }

        .phone-input-wrapper { display: flex; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 1.5rem; transition: 0.2s; background: #f8fafc; }
        .phone-input-wrapper:focus-within { border-color: #cbd5e1; background: #fff; box-shadow: 0 0 0 3px rgba(15,23,42,0.05); }
        .phone-prefix { padding: 1rem 1.2rem; background-color: transparent; border-right: 1px solid #e2e8f0; font-weight: 700; color: #0f172a; display: flex; align-items: center; }
        .phone-input { width: 100%; padding: 1rem 1.2rem; border: none; outline: none; font-size: 1rem; color: #0f172a; background: transparent; }
        .phone-input::placeholder { color: #94a3b8; }

        .option-card { border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.2rem 1.5rem; margin-bottom: 1rem; cursor: pointer; transition: 0.2s; display: flex; align-items: flex-start; gap: 1rem; background: #fff; }
        .option-card:hover { border-color: #cbd5e1; background: #f8fafc; transform: translateY(-1px); }
        .option-card.active { border-color: #0f172a; background: #f8fafc; box-shadow: 0 0 0 1px #0f172a; }
        
        .radio-circle { width: 20px; height: 20px; border-radius: 50%; border: 2px solid #cbd5e1; display: flex; align-items: center; justify-content: center; transition: 0.2s; flex-shrink: 0; margin-top: 2px; }
        .option-card.active .radio-circle { border-color: #0f172a; }
        .option-card.active .radio-circle::after { content: ''; width: 10px; height: 10px; border-radius: 50%; background-color: #0f172a; }
        
        .option-title { font-weight: 800; color: #0f172a; font-size: 1.05rem; margin-bottom: 0.3rem; }
        .option-desc { color: #64748b; font-size: 0.9rem; line-height: 1.4; }

        .booksy-row { border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: all 0.2s ease; background: #ffffff; margin-bottom: 0.5rem; }
        .booksy-row:hover { border-color: #cbd5e1; background: #f8fafc; }
        .booksy-row.active { border-color: #0f172a; background: #f8fafc; box-shadow: 0 0 0 1px #0f172a; }
        .booksy-row-text { font-weight: 700; color: #0f172a; font-size: 1rem; }

        .time-input { padding: 0.6rem 0.8rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.9rem; color: #0f172a; background: #fff; font-family: inherit; font-weight: 600; outline: none; cursor: pointer; transition: 0.2s; }
        .time-input:focus { border-color: #0f172a; }

        .continue-btn { width: 100%; background-color: #0f172a; color: #ffffff; font-weight: 800; border: none; padding: 1.2rem; border-radius: 12px; cursor: pointer; transition: 0.2s; font-size: 1.05rem; margin-top: 2rem; box-shadow: 0 4px 12px rgba(15,23,42,0.15); }
        .continue-btn:disabled { background-color: #f1f5f9; color: #94a3b8; cursor: not-allowed; box-shadow: none; }
        .continue-btn:not(:disabled):hover { background-color: #1e293b; transform: translateY(-1px); }

        .btn-outline { width: 100%; background-color: transparent; color: #0f172a; font-weight: 700; border: 1px dashed #cbd5e1; padding: 1.1rem; border-radius: 12px; cursor: pointer; transition: 0.2s; font-size: 0.95rem; margin-bottom: 1rem; display: flex; justify-content: center; align-items: center; gap: 0.5rem; }
        .btn-outline:hover { background-color: #f8fafc; border-color: #94a3b8; }

        .switch { position: relative; display: inline-block; width: 46px; height: 24px; flex-shrink: 0; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #e2e8f0; transition: .2s; border-radius: 24px; }
        .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .2s; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        input:checked + .slider { background-color: #0f172a; }
        input:checked + .slider:before { transform: translateX(22px); }

        .list-row { display: flex; align-items: center; justify-content: space-between; padding: 1rem 0; border-bottom: 1px solid #f1f5f9; }

        .action-icon { background: none; border: none; cursor: pointer; color: #94a3b8; font-size: 1.2rem; padding: 0.4rem; border-radius: 8px; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
        .action-icon:hover { background: #f1f5f9; color: #0f172a; }
        .action-icon.danger:hover { color: #ef4444; background: #fef2f2; }
        
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15,23,42,0.4); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 1000; padding: 2rem; box-sizing: border-box; }
        .modal-content { background: #fff; width: 100%; max-width: 480px; border-radius: 24px; padding: 2.5rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
      `}</style>

      {/* 🟢 ЛОГОТИП ЯК НА ГОЛОВНІЙ СТОРІНЦІ */}
      <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
        <Link href="/business" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: '2rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.03em' }}>
            Book<span style={{ color: '#c5a880' }}>Era</span>
          </span>
          <span style={{ fontSize: '1.1rem', color: '#64748b', fontWeight: '800', letterSpacing: '0.02em' }}>
            Business
          </span>
        </Link>
      </div>

      <div className="wizard-card">
        <div className="top-progress-bar"><div className="top-progress-fill" style={{ width: `${progressPercentage}%` }}></div></div>

        {step > 1 && step < 10 && <button onClick={handleBack} className="back-btn">←</button>}

        <div style={{ textAlign: 'center', marginBottom: '2.5rem', marginTop: step > 1 ? '1rem' : '0' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#0f172a', margin: '0 0 0.5rem 0', letterSpacing: '-0.02em' }}>
            {sidePanel.title}
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0, lineHeight: '1.5' }}>
            {sidePanel.desc}
          </p>
        </div>

        <div>
          {/* КРОК 1 */}
          {step === 1 && (
            <div className="anim-step">
              <label className="input-label">Публічна назва закладу</label>
              <input type="text" placeholder="Наприклад: Barber Studio" className="input-field" value={formData.businessName} onChange={(e) => setFormData({...formData, businessName: e.target.value})} autoFocus />

              <label className="input-label">Контактний телефон (Для клієнтів)</label>
              <div className="phone-input-wrapper">
                <div className="phone-prefix">+380</div>
                <input type="tel" placeholder="99 123 45 67" maxLength={9} className="phone-input" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value.replace(/\D/g, '')})} />
              </div>
            </div>
          )}

          {/* КРОК 2 */}
          {step === 2 && (
            <div className="anim-step">
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {[
                  { id: 'barber', name: 'Барбершоп' },
                  { id: 'hair', name: 'Салон краси / Перукарня' },
                  { id: 'nails', name: 'Нігтьова студія' },
                  { id: 'brows', name: 'Брови та вії' },
                  { id: 'massage', name: 'Масаж та СПА' },
                  { id: 'tattoo', name: 'Тату та пірсинг' }
                ].map(cat => (
                  <div key={cat.id} className={`booksy-row ${formData.businessCategory === cat.id ? 'active' : ''}`} onClick={() => { setFormData({...formData, businessCategory: cat.id}); setTimeout(() => setStep(3), 200); }}>
                    <div className="booksy-row-text">{cat.name}</div>
                    <div style={{ color: '#cbd5e1', fontSize: '1.2rem', fontWeight: 'bold' }}>›</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* КРОК 3 */}
          {step === 3 && (
            <div className="anim-step">
              <div className={`option-card ${formData.businessType === 'individual' ? 'active' : ''}`} onClick={() => setFormData({...formData, businessType: 'individual'})}>
                <div className="radio-circle"></div>
                <div>
                  <div className="option-title">Приватний майстер / ФОП</div>
                  <div className="option-desc">Самостійна робота або оренда кабінету.</div>
                </div>
              </div>

              <div className={`option-card ${formData.businessType === 'company' ? 'active' : ''}`} onClick={() => setFormData({...formData, businessType: 'company'})}>
                <div className="radio-circle"></div>
                <div>
                  <div className="option-title">Компанія / Салон</div>
                  <div className="option-desc">Заклад з командою найманих працівників.</div>
                </div>
              </div>
            </div>
          )}

          {/* КРОК 4 */}
          {step === 4 && (
            <div className="anim-step">
              <div className={`option-card ${formData.workspace === 'my_place' ? 'active' : ''}`} onClick={() => setFormData({...formData, workspace: 'my_place'})}>
                <div className="radio-circle"></div>
                <div>
                  <div className="option-title">У закладі (Студія/Салон)</div>
                  <div className="option-desc">Клієнти приходять до вас за вказаною адресою.</div>
                </div>
              </div>

              <div className={`option-card ${formData.workspace === 'client_place' ? 'active' : ''}`} onClick={() => setFormData({...formData, workspace: 'client_place'})}>
                <div className="radio-circle"></div>
                <div>
                  <div className="option-title">Виїзне обслуговування</div>
                  <div className="option-desc">Ви приїжджаєте до клієнта додому або в офіс.</div>
                </div>
              </div>
            </div>
          )}

          {/* КРОК 5 */}
          {step === 5 && (
            <div className="anim-step">
              <label className="input-label">Місто / Населений пункт</label>
              <input type="text" placeholder="Наприклад: Львів" className="input-field" value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} autoFocus />

              <label className="input-label">Вулиця та будинок</label>
              <input type="text" placeholder="Наприклад: вул. Івана Франка, 12" className="input-field" value={formData.street} onChange={(e) => setFormData({...formData, street: e.target.value})} />

              <label className="input-label">Додаткові деталі (Необов'язково)</label>
              <input type="text" placeholder="2 поверх, кабінет 4" className="input-field" style={{ marginBottom: 0 }} value={formData.addressDetails} onChange={(e) => setFormData({...formData, addressDetails: e.target.value})} />
            </div>
          )}

          {/* КРОК 6 */}
          {step === 6 && (
            <div className="anim-step">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {['Тільки я', '2-4 спеціалісти', '5-9 спеціалістів', 'Більше 10'].map((size) => (
                  <div key={size} className={`option-card ${formData.teamSize === size ? 'active' : ''}`} style={{ marginBottom: 0, padding: '1.5rem 1rem', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.8rem' }} onClick={() => setFormData({...formData, teamSize: size})}>
                    <div className="radio-circle"></div>
                    <div className="option-title" style={{ margin: 0, fontSize: '0.95rem' }}>{size}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* КРОК 7 */}
          {step === 7 && (
            <div className="anim-step">
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '16px', padding: '0.5rem 1.5rem', background: '#f8fafc' }}>
                {Object.entries(formData.hours).map(([dayKey, data]) => {
                  const dayNames = { monday: 'Понеділок', tuesday: 'Вівторок', wednesday: 'Середа', thursday: 'Четвер', friday: 'П\'ятниця', saturday: 'Субота', sunday: 'Неділя' };
                  return (
                    <div key={dayKey} className="list-row" style={{ borderBottom: dayKey === 'sunday' ? 'none' : '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '140px' }}>
                        <label className="switch">
                          <input type="checkbox" checked={data.isOpen} onChange={() => handleToggleHour(dayKey as any)} />
                          <span className="slider"></span>
                        </label>
                        <div style={{ fontWeight: '700', color: data.isOpen ? '#0f172a' : '#94a3b8', fontSize: '0.9rem', transition: '0.2s' }}>{dayNames[dayKey as keyof typeof dayNames]}</div>
                      </div>

                      {data.isOpen ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input type="time" value={data.open} onChange={(e) => handleTimeChange(dayKey as any, 'open', e.target.value)} className="time-input" />
                          <span style={{ color: '#94a3b8' }}>-</span>
                          <input type="time" value={data.close} onChange={(e) => handleTimeChange(dayKey as any, 'close', e.target.value)} className="time-input" />
                        </div>
                      ) : (
                        <div style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: '600', width: '180px', textAlign: 'right', paddingRight: '1rem' }}>
                          Вихідний
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* КРОК 8 */}
          {step === 8 && (
            <div className="anim-step">
              <div style={{ marginBottom: '1.5rem' }}>
                {formData.services.length === 0 && <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.95rem', padding: '2rem 0' }}>Список послуг порожній.</p>}

                {formData.services.map(service => (
                  <div key={service.id} className="list-row" style={{ background: '#fff', padding: '1.25rem', borderRadius: '16px', marginBottom: '0.5rem', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '1.05rem', marginBottom: '0.2rem' }}>{service.name}</div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>{service.duration} хв • <span style={{ color: '#0f172a', fontWeight: '700' }}>{service.price} ₴</span></div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => openServiceModal(service)} className="action-icon">✎</button>
                      <button onClick={() => deleteService(service.id)} className="action-icon danger">✕</button>
                    </div>
                  </div>
                ))}
              </div>

              <button className="btn-outline" onClick={() => openServiceModal()}>+ Додати послугу</button>
            </div>
          )}

          {/* КРОК 9 */}
          {step === 9 && (
            <div className="anim-step">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1.5rem' }}>
                {formData.staff.map(member => (
                  <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', padding: '1.25rem', border: '1px solid #e2e8f0', background: '#fff', borderRadius: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ width: '46px', height: '46px', borderRadius: '50%', backgroundColor: '#f1f5f9', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '1.1rem', border: '1px solid #e2e8f0' }}>
                      {member.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '1.05rem', marginBottom: '0.2rem' }}>{member.name}</div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>
                        {member.role} {member.email && `• ${member.email}`}
                      </div>
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

          {/* КРОК 10 */}
          {step === 10 && (
            <div className="anim-step" style={{ alignItems: 'center', textAlign: 'center', padding: '2rem 0' }}>
              <div style={{ width: '80px', height: '80px', background: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', boxShadow: '0 10px 30px rgba(16, 185, 129, 0.3)' }}>
                 <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem', width: '100%', textAlign: 'left', marginBottom: '1rem' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.8rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>
                    <span style={{ fontWeight: '600', color: '#0f172a' }}>Календар готовий до онлайн-запису 24/7.</span>
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.8rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>
                    <span style={{ fontWeight: '600', color: '#0f172a' }}>Системні сповіщення налаштовано.</span>
                 </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>
                    <span style={{ fontWeight: '600', color: '#0f172a' }}>Команда додана та очікує запрошень.</span>
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
            {loading ? 'Збереження...' : step === 10 ? 'Відкрити Панель Керування' : 'Продовжити'}
          </button>
        )}

      </div>

      {/* 🟢 МОДАЛКА МАЙСТРА */}
      {isStaffModalOpen && (
        <div className="modal-overlay" onClick={() => setIsStaffModalOpen(false)}>
          <div className="modal-content anim-step" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.4rem', fontWeight: '900', margin: 0, color: '#0f172a' }}>Новий фахівець</h3>
              <button onClick={() => setIsStaffModalOpen(false)} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', color: '#64748b', transition: '0.2s' }} onMouseOver={e=>e.currentTarget.style.background='#e2e8f0'} onMouseOut={e=>e.currentTarget.style.background='#f1f5f9'}>✕</button>
            </div>

            <label className="input-label">Ім'я та прізвище</label>
            <input type="text" placeholder="Наприклад, Олексій" className="input-field" value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} autoFocus />

            <label className="input-label">Email адреса (Сюди прийде запрошення)</label>
            <input type="email" placeholder="alex@gmail.com" className="input-field" value={newStaff.email} onChange={e => setNewStaff({...newStaff, email: e.target.value})} />
            {!isEmailValid(newStaff.email) && newStaff.email.length > 0 && <span style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '-1rem', marginBottom: '1.5rem', display: 'block', fontWeight: '600' }}>Некоректний формат email</span>}

            <label className="input-label">Номер телефону</label>
            <div className="phone-input-wrapper">
              <div className="phone-prefix" style={{ borderRight: 'none', paddingRight: '0.5rem' }}>+380</div>
              <input type="tel" placeholder="99 123 45 67" maxLength={9} className="phone-input" style={{ paddingLeft: '0.5rem' }} value={newStaff.phone} onChange={(e) => setNewStaff({...newStaff, phone: e.target.value.replace(/\D/g, '')})} />
            </div>

            <label className="input-label">Посада</label>
            <input type="text" placeholder="Топ-майстер" className="input-field" value={newStaff.role} onChange={e => setNewStaff({...newStaff, role: e.target.value})} />

            <button
               className="continue-btn"
               style={{ marginTop: '1rem' }}
               onClick={addStaffMember}
               disabled={newStaff.name.length < 2 || !isEmailValid(newStaff.email) || newStaff.phone.length !== 9 || newStaff.role.length < 2}
            >
              Додати в команду
            </button>
          </div>
        </div>
      )}

      {/* 🟢 МОДАЛКА ПОСЛУГИ */}
      {isServiceModalOpen && (
        <div className="modal-overlay" onClick={() => setIsServiceModalOpen(false)}>
          <div className="modal-content anim-step" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.4rem', fontWeight: '900', margin: 0, color: '#0f172a' }}>{editingServiceId ? 'Редагувати послугу' : 'Нова послуга'}</h3>
              <button onClick={() => setIsServiceModalOpen(false)} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', color: '#64748b', transition: '0.2s' }} onMouseOver={e=>e.currentTarget.style.background='#e2e8f0'} onMouseOut={e=>e.currentTarget.style.background='#f1f5f9'}>✕</button>
            </div>

            <label className="input-label">Назва послуги</label>
            <input type="text" placeholder="Наприклад: Чоловіча стрижка" className="input-field" value={serviceForm.name} onChange={e => setServiceForm({...serviceForm, name: e.target.value})} autoFocus />

            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <div style={{ flex: 1 }}>
                <label className="input-label">Тривалість</label>
                <select className="input-field" style={{ cursor: 'pointer', appearance: 'none' }} value={serviceForm.duration} onChange={e => setServiceForm({...serviceForm, duration: Number(e.target.value)})}>
                  <option value={15}>15 хв</option>
                  <option value={30}>30 хв</option>
                  <option value={45}>45 хв</option>
                  <option value={60}>1 година</option>
                  <option value={90}>1.5 години</option>
                  <option value={120}>2 години</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label className="input-label">Вартість (₴)</label>
                <input type="number" placeholder="500" className="input-field" value={serviceForm.price} onChange={e => setServiceForm({...serviceForm, price: e.target.value})} />
              </div>
            </div>

            <button className="continue-btn" style={{ marginTop: '1rem' }} onClick={saveService} disabled={serviceForm.name.length < 2 || !serviceForm.price}>
               Зберегти послугу
            </button>
          </div>
        </div>
      )}

    </div>
  );
}