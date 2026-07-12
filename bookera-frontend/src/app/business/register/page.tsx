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
    ],
    businessFocus: '',
    bookingAdvance: '',
    previousTools: ''
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
    if (step < 13) setStep(prev => prev + 1);
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

      // 1. Створюємо запис про бізнес
      const { data: business, error: bizError } = await supabase
        .from('businesses')
        .insert({
          owner_id: userId,
          name: formData.businessName,
          category: formData.businessCategory,
          address: `${formData.city}, ${formData.street} ${formData.addressDetails}`.trim(),
          phone: `+380${formData.phone}`,
        })
        .select()
        .single();

      if (bizError) throw bizError;

      // 2. Зберігаємо послуги
      if (formData.services.length > 0) {
        const servicesToInsert = formData.services.map(s => ({
          business_id: business.id,
          name: s.name,
          price: Number(s.price),
          duration: s.duration
        }));
        await supabase.from('services').insert(servicesToInsert);
      }

      // 3. Зберігаємо команду (🟢 ТУТ ВИПРАВЛЕНО БАГ З ДАНИМИ)
      if (formData.staff.length > 0) {
        const staffToInsert = formData.staff.map(s => {
          const isOwner = s.name.includes('Власник');

          return {
            business_id: business.id,
            name: isOwner ? (userName || 'Власник бізнесу') : s.name, // Ставимо твоє реальне ім'я
            title: s.role, // Посада для клієнтів (Топ-майстер і тд)
            email: s.email || null, // 🟢 Тепер email зберігається!
            phone: s.phone ? `+380${s.phone}` : (isOwner ? `+380${formData.phone}` : null), // 🟢 Тепер телефон зберігається!
            role: isOwner ? 'owner' : 'master', // Системна роль
            status: isOwner ? 'active' : 'pending', // Власник активний одразу, інші очікують
            provides_services: true,
            commission_rate: 40,
            fixed_salary: 0
          };
        });

        const { error: staffError } = await supabase.from('staff').insert(staffToInsert);
        if (staffError) {
           console.error("Помилка додавання команди:", staffError);
           throw new Error("Не вдалося зберегти команду. Перевірте структуру таблиці staff у Supabase.");
        }
      }

      // 4. Оновлюємо статус користувача на Власника (vendor)
      await supabase
        .from('profiles')
        .update({ role: 'vendor' })
        .eq('id', userId);

      // 5. Оновлюємо локальний стейт і переходимо в кабінет
      localStorage.setItem('userRole', 'vendor');
      router.push('/cabinet');

    } catch (error: any) {
      alert("Відбулася помилка при збереженні: " + error.message);
      setLoading(false);
    }
  };

  const handleToggleHour = (day: keyof typeof formData.hours) => {
    setFormData({
      ...formData,
      hours: { ...formData.hours, [day]: { ...formData.hours[day], isOpen: !formData.hours[day].isOpen } }
    });
  };

  const handleTimeChange = (day: keyof typeof formData.hours, type: 'open' | 'close', value: string) => {
    setFormData({
      ...formData,
      hours: { ...formData.hours, [day]: { ...formData.hours[day], [type]: value } }
    });
  };

  const addStaffMember = () => {
    if (newStaff.name && newStaff.email && newStaff.phone.length === 9) {
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
      setFormData({
        ...formData,
        services: formData.services.map(s => s.id === editingServiceId ? { ...serviceForm, id: editingServiceId } : s)
      });
    } else {
      setFormData({
        ...formData,
        services: [...formData.services, { ...serviceForm, id: Date.now() }]
      });
    }
    setIsServiceModalOpen(false);
  };

  const deleteService = (id: number) => {
    setFormData({ ...formData, services: formData.services.filter(s => s.id !== id) });
  };

  const isStepValid = () => {
    switch (step) {
      case 1: return formData.businessName.trim() !== '' && formData.phone.length === 9;
      case 2: return formData.businessCategory !== '';
      case 3: return formData.businessType !== '';
      case 4: return formData.workspace !== '';
      case 5: return formData.city.trim() !== '' && formData.street.trim() !== '';
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

  const getDynamicSidePanel = () => {
    switch (step) {
      case 1: return { title: "Створення компанії", desc: "Вкажіть публічну назву вашого закладу та офіційний контактний телефон для зв'язку з клієнтами." };
      case 2: return { title: "Сфера діяльності", desc: "Оберіть основний напрямок, щоб ми адаптували систему під ваші потреби." };
      case 3: return { title: "Юридичний статус", desc: "Як саме ви працюєте? Це допоможе налаштувати фінансові інструменти." };
      case 4: return { title: "Формат роботи", desc: "Клієнти приходять до вас, чи ви працюєте на виїзді?" };
      case 5: return { title: "Локація", desc: "Точна адреса спростить пошук вашого закладу для нових клієнтів на мапі." };
      case 6: return { title: "Масштаб бізнесу", desc: "Скільки спеціалістів працює у вашій команді?" };
      case 7: return { title: "Робочі години", desc: "Встановіть базовий графік, коли клієнти зможуть бронювати візити." };
      case 8: return { title: "Прайс-лист", desc: "Налаштуйте каталог послуг. Визначте тривалість та вартість для зручного онлайн-запису." };
      case 9: return { title: "Команда майстрів", desc: "Додайте працівників, щоб налаштувати їм персональні графіки та доступ до кабінету." };
      case 10: return { title: "Пріоритети", desc: "Яка головна мета вашого бізнесу на даному етапі розвитку?" };
      case 11: return { title: "Глибина запису", desc: "На скільки часу вперед клієнти можуть бронювати візити?" };
      case 12: return { title: "Досвід з CRM", desc: "Чи використовували ви раніше інші системи автоматизації записів?" };
      case 13: return { title: "Майже готово", desc: "Усі модулі системи налаштовані. Ласкаво просимо до платформи BookEra Business." };
      default: return { title: "BookEra Business", desc: "Налаштування профілю." };
    }
  };

  const sidePanel = getDynamicSidePanel();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100vw', backgroundColor: '#f1f5f9', fontFamily: 'system-ui, -apple-system, sans-serif', alignItems: 'center', justifyContent: 'center', padding: '2rem', boxSizing: 'border-box' }}>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .anim-step { animation: fadeIn 0.3s ease-out forwards; display: flex; flex-direction: column; width: 100%; }

        .split-card { display: flex; width: 100%; max-width: 1050px; height: 650px; background: #ffffff; border-radius: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.08); overflow: hidden; flex-direction: row; }

        .split-left { flex: 0.85; position: relative; padding: 3.5rem; display: flex; flex-direction: column; color: white; background: #0f172a; overflow: hidden; }
        .split-left-img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.5; mix-blend-mode: overlay; pointer-events: none; }

        .split-right { flex: 1.15; position: relative; display: flex; flex-direction: column; background: #ffffff; padding: 3.5rem 4.5rem 3rem 4.5rem; }

        /* 🔥 ЕЛЕГАНТНИЙ СКРОЛБАР (Замість прихованого) */
        .form-scroll-area { flex: 1; overflow-y: auto; padding-right: 16px; margin-right: -16px; display: flex; flex-direction: column; }
        .form-scroll-area::-webkit-scrollbar { width: 6px; }
        .form-scroll-area::-webkit-scrollbar-track { background: transparent; }
        .form-scroll-area::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
        .form-scroll-area::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }

        .top-progress-bar { width: 100%; height: 4px; background-color: #f1f5f9; position: absolute; top: 0; left: 0; z-index: 10; }
        .top-progress-fill { height: 100%; background-color: #c5a880; transition: width 0.4s ease; }

        .back-btn { background: transparent; border: 1px solid #e2e8f0; cursor: pointer; color: #475569; display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 50%; transition: 0.2s; position: absolute; top: 1.5rem; left: 1.5rem; z-index: 12; }
        .back-btn:hover { background: #f8fafc; color: #0f172a; border-color: #cbd5e1; }

        .step-title { font-size: 1.8rem; font-weight: 800; color: #0f172a; margin: 0 0 0.5rem 0; letter-spacing: -0.02em; }
        .step-subtitle { color: #64748b; font-size: 0.95rem; margin-bottom: 2rem; line-height: 1.5; }

        .booksy-list { display: flex; flex-direction: column; gap: 0.5rem; width: 100%; }
        .booksy-row { border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: all 0.2s ease; background: #ffffff; }
        .booksy-row:hover { border-color: #0f172a; background: #fafafa; }
        .booksy-row.active { border-color: #0f172a; background: #ffffff; box-shadow: 0 0 0 1px #0f172a; }
        .booksy-row-text { font-weight: 600; color: #0f172a; font-size: 0.95rem; }

        .option-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.1rem 1.25rem; margin-bottom: 0.75rem; cursor: pointer; transition: 0.2s; display: flex; align-items: flex-start; gap: 1rem; background: #ffffff; }
        .option-card:hover { border-color: #cbd5e1; }
        .option-card.active { border-color: #0f172a; box-shadow: 0 0 0 1px #0f172a; }
        .radio-circle { width: 18px; height: 18px; border-radius: 50%; border: 1px solid #cbd5e1; display: flex; align-items: center; justify-content: center; transition: 0.2s; flex-shrink: 0; margin-top: 2px; }
        .option-card.active .radio-circle { border-color: #0f172a; }
        .option-card.active .radio-circle::after { content: ''; width: 8px; height: 8px; border-radius: 50%; background-color: #0f172a; }
        .option-title { font-weight: 700; color: #0f172a; font-size: 1rem; margin-bottom: 0.2rem; }
        .option-desc { color: #64748b; font-size: 0.85rem; line-height: 1.4; }

        .input-field { width: 100%; padding: 1rem 1.1rem; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 0.95rem; box-sizing: border-box; margin-bottom: 1.25rem; transition: 0.2s; color: #0f172a; background: #fff; }
        .input-field:focus { outline: none; border-color: #0f172a; }
        .input-label { font-size: 0.85rem; font-weight: 600; color: #475569; margin-bottom: 0.5rem; display: block; }

        .phone-input-wrapper { display: flex; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; margin-bottom: 1.25rem; transition: 0.2s; }
        .phone-input-wrapper:focus-within { border-color: #0f172a; }
        .phone-prefix { padding: 1rem 1.1rem; background-color: #f8fafc; border-right: 1px solid #cbd5e1; font-weight: 600; color: #0f172a; display: flex; align-items: center; }
        .phone-input { width: 100%; padding: 1rem 1.1rem; border: none; outline: none; font-size: 0.95rem; color: #0f172a; }

        .time-input { padding: 0.5rem 0.6rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; color: #0f172a; background: #f8fafc; font-family: inherit; font-weight: 500; outline: none; cursor: pointer; transition: 0.2s; }
        .time-input:focus { border-color: #0f172a; background: #fff; }

        .continue-btn { width: 100%; background-color: #0f172a; color: #ffffff; font-weight: 600; border: none; padding: 1.1rem; border-radius: 10px; cursor: pointer; transition: 0.2s; font-size: 1rem; margin-top: auto; letter-spacing: 0.02em; flex-shrink: 0; }
        .continue-btn:disabled { background-color: #f1f5f9; color: #94a3b8; cursor: not-allowed; }
        .continue-btn:not(:disabled):hover { background-color: #1e293b; transform: translateY(-1px); }

        .btn-outline { width: 100%; background-color: transparent; color: #0f172a; font-weight: 600; border: 1px dashed #cbd5e1; padding: 1rem; border-radius: 10px; cursor: pointer; transition: 0.2s; font-size: 0.95rem; margin-bottom: 1rem; flex-shrink: 0; }
        .btn-outline:hover { background-color: #f8fafc; border-color: #94a3b8; }

        .switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #e2e8f0; transition: .2s; border-radius: 24px; }
        .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .2s; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        input:checked + .slider { background-color: #0f172a; }
        input:checked + .slider:before { transform: translateX(20px); }

        .list-row { display: flex; align-items: center; justify-content: space-between; padding: 0.85rem 0; border-bottom: 1px solid #f1f5f9; }

        .success-item { display: flex; align-items: flex-start; gap: 1rem; background: #f8fafc; padding: 1.25rem; border-radius: 12px; margin-bottom: 0.75rem; border: 1px solid #e2e8f0; }
        .success-icon-dot { width: 6px; height: 6px; border-radius: 50%; background: #0f172a; margin-top: 7px; flex-shrink: 0; }

        .action-icon { background: none; border: none; cursor: pointer; color: #94a3b8; font-size: 1rem; padding: 0.4rem; border-radius: 6px; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
        .action-icon:hover { background: #f1f5f9; color: #0f172a; }
        .action-icon.danger:hover { color: #ef4444; background: #fef2f2; }
      `}</style>

      <div className="split-card">

        <div className="split-left">
          <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop" className="split-left-img" alt="Abstract Background" />

          <div style={{ position: 'relative', zIndex: 10 }}>
            <Link href="/business" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: '1.8rem', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.03em' }}>
                Book<span style={{ color: '#c5a880' }}>Era</span>
              </span>
              <span style={{ fontSize: '0.9rem', color: '#cbd5e1', fontWeight: '500' }}>Business</span>
            </Link>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', position: 'relative', zIndex: 2 }}>
            <div key={step} style={{ animation: 'fadeIn 0.5s ease', width: '100%' }}>
              <h1 style={{ fontSize: '2.5rem', fontWeight: '800', lineHeight: '1.1', margin: '0 0 1rem 0', letterSpacing: '-0.02em', color: '#ffffff' }}>
                {sidePanel.title}
              </h1>
              <p style={{ fontSize: '1rem', color: '#cbd5e1', lineHeight: '1.6', maxWidth: '90%', fontWeight: '400' }}>
                {sidePanel.desc}
              </p>
            </div>
          </div>
        </div>

        <div className="split-right">

          <div className="top-progress-bar">
            <div className="top-progress-fill" style={{ width: `${progressPercentage}%` }}></div>
          </div>

          {step < 13 && (
            <button onClick={handleBack} className="back-btn">←</button>
          )}

          <div className="form-scroll-area">

            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '1.5rem', textAlign: 'center' }}>
              Крок {step} з 13
            </div>

            {/* КРОК 1 */}
            {step === 1 && (
              <div className="anim-step">
                <h2 className="step-title" style={{ textAlign: 'center' }}>Про ваш бізнес</h2>
                <p className="step-subtitle" style={{ textAlign: 'center' }}>Введіть дані для створення публічного профілю.</p>

                <label className="input-label">Публічна назва закладу</label>
                <input type="text" placeholder="Наприклад, Barber Studio" className="input-field" value={formData.businessName} onChange={(e) => setFormData({...formData, businessName: e.target.value})} />

                <label className="input-label">Контактний телефон компанії</label>
                <div className="phone-input-wrapper">
                  <div className="phone-prefix">+380</div>
                  <input
                    type="tel"
                    placeholder="99 123 45 67"
                    maxLength={9}
                    className="phone-input"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value.replace(/\D/g, '')})}
                  />
                </div>
              </div>
            )}

            {/* КРОК 2 */}
            {step === 2 && (
              <div className="anim-step">
                <h2 className="step-title" style={{ textAlign: 'center' }}>Сфера діяльності</h2>
                <p className="step-subtitle" style={{ textAlign: 'center' }}>Який напрямок найкраще описує ваш сервіс?</p>

                <div className="booksy-list">
                  {[
                    { id: 'barber', name: 'Барбершоп' },
                    { id: 'hair', name: 'Салон краси / Перукарня' },
                    { id: 'nails', name: 'Нігтьова студія' },
                    { id: 'brows', name: 'Брови та вії' },
                    { id: 'massage', name: 'Масаж та СПА' },
                    { id: 'tattoo', name: 'Тату та пірсинг' }
                  ].map(cat => (
                    <div
                      key={cat.id}
                      className={`booksy-row ${formData.businessCategory === cat.id ? 'active' : ''}`}
                      onClick={() => {
                        setFormData({...formData, businessCategory: cat.id});
                        setTimeout(() => setStep(3), 150);
                      }}
                    >
                      <div className="booksy-row-text">{cat.name}</div>
                      <div className="booksy-chevron">›</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* КРОК 3 */}
            {step === 3 && (
              <div className="anim-step">
                <h2 className="step-title" style={{ textAlign: 'center' }}>Юридична форма</h2>
                <p className="step-subtitle" style={{ textAlign: 'center' }}>Оберіть формат ведення вашої діяльності.</p>

                <div className={`option-card ${formData.businessType === 'individual' ? 'active' : ''}`} onClick={() => setFormData({...formData, businessType: 'individual'})}>
                  <div className="radio-circle"></div>
                  <div>
                    <div className="option-title">Приватний майстер / ФОП</div>
                    <div className="option-desc">Самостійна робота, оренда крісла або особистий кабінет.</div>
                  </div>
                </div>

                <div className={`option-card ${formData.businessType === 'company' ? 'active' : ''}`} onClick={() => setFormData({...formData, businessType: 'company'})}>
                  <div className="radio-circle"></div>
                  <div>
                    <div className="option-title">Компанія / Салон</div>
                    <div className="option-desc">Заклад краси, студія або мережа з найманими працівниками.</div>
                  </div>
                </div>
              </div>
            )}

            {/* КРОК 4 */}
            {step === 4 && (
              <div className="anim-step">
                <h2 className="step-title" style={{ textAlign: 'center' }}>Локація сервісу</h2>
                <p className="step-subtitle" style={{ textAlign: 'center' }}>Де саме надаються ваші послуги?</p>

                <div className={`option-card ${formData.workspace === 'my_place' ? 'active' : ''}`} onClick={() => setFormData({...formData, workspace: 'my_place'})}>
                  <div className="radio-circle"></div>
                  <div>
                    <div className="option-title">Фіксована адреса закладу</div>
                    <div className="option-desc">Клієнти приходять до вас у салон чи студію.</div>
                  </div>
                </div>

                <div className={`option-card ${formData.workspace === 'client_place' ? 'active' : ''}`} onClick={() => setFormData({...formData, workspace: 'client_place'})}>
                  <div className="radio-circle"></div>
                  <div>
                    <div className="option-title">Виїзне обслуговування</div>
                    <div className="option-desc">Послуги надаються виключно на локації замовника.</div>
                  </div>
                </div>
              </div>
            )}

            {/* КРОК 5 */}
            {step === 5 && (
              <div className="anim-step">
                <h2 className="step-title" style={{ textAlign: 'center' }}>Адреса закладу</h2>
                <p className="step-subtitle" style={{ textAlign: 'center' }}>Ці дані допоможуть клієнтам знайти вас на мапі.</p>

                <label className="input-label">Місто / Населений пункт</label>
                <input type="text" placeholder="Наприклад: Львів" className="input-field" value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} />

                <label className="input-label">Вулиця та номер будинку</label>
                <input type="text" placeholder="Наприклад: вул. Івана Франка, 12" className="input-field" value={formData.street} onChange={(e) => setFormData({...formData, street: e.target.value})} />

                <label className="input-label">Додаткові деталі (необов'язково)</label>
                <input type="text" placeholder="2 поверх, кабінет 4" className="input-field" value={formData.addressDetails} onChange={(e) => setFormData({...formData, addressDetails: e.target.value})} />
              </div>
            )}

            {/* КРОК 6 */}
            {step === 6 && (
              <div className="anim-step">
                <h2 className="step-title" style={{ textAlign: 'center' }}>Масштаб команди</h2>
                <p className="step-subtitle" style={{ textAlign: 'center' }}>Вкажіть загальну кількість спеціалістів у закладі.</p>

                {['Тільки я', '2-4 спеціалісти', '5-9 спеціалістів', 'Більше 10'].map((size) => (
                  <div key={size} className={`option-card ${formData.teamSize === size ? 'active' : ''}`} style={{ padding: '1rem 1.25rem' }} onClick={() => setFormData({...formData, teamSize: size})}>
                    <div className="radio-circle"></div>
                    <div className="option-title" style={{ margin: 0 }}>{size}</div>
                  </div>
                ))}
              </div>
            )}

            {/* КРОК 7 */}
            {step === 7 && (
              <div className="anim-step">
                <h2 className="step-title" style={{ textAlign: 'center' }}>Робочі години</h2>
                <p className="step-subtitle" style={{ textAlign: 'center' }}>Встановіть базовий графік для онлайн-записів.</p>

                <div>
                  {Object.entries(formData.hours).map(([dayKey, data]) => {
                    const dayNames = { monday: 'Понеділок', tuesday: 'Вівторок', wednesday: 'Середа', thursday: 'Четвер', friday: 'П\'ятниця', saturday: 'Субота', sunday: 'Неділя' };
                    return (
                      <div key={dayKey} className="list-row" style={{ padding: '0.6rem 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '130px' }}>
                          <label className="switch">
                            <input type="checkbox" checked={data.isOpen} onChange={() => handleToggleHour(dayKey as any)} />
                            <span className="slider"></span>
                          </label>
                          <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.9rem' }}>{dayNames[dayKey as keyof typeof dayNames]}</div>
                        </div>

                        {data.isOpen ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input type="time" value={data.open} onChange={(e) => handleTimeChange(dayKey as any, 'open', e.target.value)} className="time-input" />
                            <span style={{ color: '#94a3b8' }}>-</span>
                            <input type="time" value={data.close} onChange={(e) => handleTimeChange(dayKey as any, 'close', e.target.value)} className="time-input" />
                          </div>
                        ) : (
                          <div style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: '500', width: '150px', textAlign: 'right' }}>
                            Зачинено
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
                <h2 className="step-title" style={{ textAlign: 'center' }}>Прайс-лист послуг</h2>
                <p className="step-subtitle" style={{ textAlign: 'center' }}>Налаштуйте каталог для онлайн-бронювання.</p>

                <div style={{ marginBottom: '1rem' }}>
                  {formData.services.length === 0 && <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>Ви ще не додали жодної послуги.</p>}

                  {formData.services.map(service => (
                    <div key={service.id} className="list-row" style={{ border: '1px solid #e2e8f0', padding: '1rem', borderRadius: '12px', marginBottom: '0.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.95rem' }}>{service.name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>{service.duration} хв • {service.price} ₴</div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button onClick={() => openServiceModal(service)} className="action-icon">✎</button>
                        <button onClick={() => deleteService(service.id)} className="action-icon danger">🗑</button>
                      </div>
                    </div>
                  ))}
                </div>

                <button className="btn-outline" onClick={() => openServiceModal()}>+ Додати нову послугу</button>
              </div>
            )}

            {/* КРОК 9 */}
            {step === 9 && (
              <div className="anim-step">
                <h2 className="step-title" style={{ textAlign: 'center' }}>Співробітники</h2>
                <p className="step-subtitle" style={{ textAlign: 'center' }}>Додайте майстрів для налаштування персональних графіків.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                  {formData.staff.map(member => (
                    <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.85rem', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#f1f5f9', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.9rem' }}>
                        {member.name.charAt(0)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.95rem' }}>{member.name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{member.role}</div>
                      </div>
                      {member.id !== 1 && (
                        <button onClick={() => setFormData({...formData, staff: formData.staff.filter(s => s.id !== member.id)})} className="action-icon danger">🗑</button>
                      )}
                    </div>
                  ))}
                </div>

                <button className="btn-outline" onClick={() => setIsStaffModalOpen(true)}>+ Запросити майстра</button>
              </div>
            )}

            {/* КРОК 10 */}
            {step === 10 && (
              <div className="anim-step">
                <h2 className="step-title" style={{ textAlign: 'center' }}>Пріоритет розвитку</h2>
                <p className="step-subtitle" style={{ textAlign: 'center' }}>Яке завдання є ключовим для вашого бізнесу зараз?</p>

                <div className={`option-card ${formData.businessFocus === 'new_clients' ? 'active' : ''}`} onClick={() => setFormData({...formData, businessFocus: 'new_clients'})}>
                  <div className="radio-circle"></div><div className="option-desc" style={{ color: '#0f172a', fontWeight: '500' }}>Залучення нового потоку клієнтів.</div>
                </div>
                <div className={`option-card ${formData.businessFocus === 'balance' ? 'active' : ''}`} onClick={() => setFormData({...formData, businessFocus: 'balance'})}>
                  <div className="radio-circle"></div><div className="option-desc" style={{ color: '#0f172a', fontWeight: '500' }}>Утримання бази та підвищення частоти візитів.</div>
                </div>
                <div className={`option-card ${formData.businessFocus === 'manage' ? 'active' : ''}`} onClick={() => setFormData({...formData, businessFocus: 'manage'})}>
                  <div className="radio-circle"></div><div className="option-desc" style={{ color: '#0f172a', fontWeight: '500' }}>Оптимізація процесів та розвантаження адміна.</div>
                </div>
              </div>
            )}

            {/* КРОК 11 */}
            {step === 11 && (
              <div className="anim-step">
                <h2 className="step-title" style={{ textAlign: 'center' }}>Глибина планування</h2>
                <p className="step-subtitle" style={{ textAlign: 'center' }}>Як задовго клієнти зазвичай записуються?</p>

                <div className={`option-card ${formData.bookingAdvance === 'same_week' ? 'active' : ''}`} onClick={() => setFormData({...formData, bookingAdvance: 'same_week'})}>
                  <div className="radio-circle"></div><div className="option-desc" style={{ color: '#0f172a', fontWeight: '500' }}>Протягом поточного тижня.</div>
                </div>
                <div className={`option-card ${formData.bookingAdvance === '1_4_weeks' ? 'active' : ''}`} onClick={() => setFormData({...formData, bookingAdvance: '1_4_weeks'})}>
                  <div className="radio-circle"></div><div className="option-desc" style={{ color: '#0f172a', fontWeight: '500' }}>Попередній запис за 1-3 тижні.</div>
                </div>
                <div className={`option-card ${formData.bookingAdvance === 'month_plus' ? 'active' : ''}`} onClick={() => setFormData({...formData, bookingAdvance: 'month_plus'})}>
                  <div className="radio-circle"></div><div className="option-desc" style={{ color: '#0f172a', fontWeight: '500' }}>Більше ніж за місяць наперед.</div>
                </div>
              </div>
            )}

            {/* КРОК 12 */}
            {step === 12 && (
              <div className="anim-step">
                <h2 className="step-title" style={{ textAlign: 'center' }}>Досвід автоматизації</h2>
                <p className="step-subtitle" style={{ textAlign: 'center' }}>Чи використовували ви CRM раніше?</p>

                <div className={`option-card ${formData.previousTools === 'no' ? 'active' : ''}`} onClick={() => setFormData({...formData, previousTools: 'no'})}>
                  <div className="radio-circle"></div>
                  <div>
                    <div className="option-title">Ні, ведемо запис вручну</div>
                    <div className="option-desc">Блокноти, Excel або месенджери.</div>
                  </div>
                </div>
                <div className={`option-card ${formData.previousTools === 'yes' ? 'active' : ''}`} onClick={() => setFormData({...formData, previousTools: 'yes'})}>
                  <div className="radio-circle"></div>
                  <div>
                    <div className="option-title">Так, маємо досвід з CRM</div>
                    <div className="option-desc">Переходимо з іншої платформи.</div>
                  </div>
                </div>
              </div>
            )}

            {/* КРОК 13 */}
            {step === 13 && (
              <div className="anim-step">
                <h2 className="step-title" style={{ textAlign: 'center' }}>Профіль готовий 🎉</h2>
                <p className="step-subtitle" style={{ textAlign: 'center' }}>Конфігурацію системи автоматизації завершено.</p>

                <div className="success-item">
                  <div className="success-icon-dot"></div>
                  <div style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.4, fontWeight: '500' }}>Календар готовий до онлайн-запису 24/7.</div>
                </div>
                <div className="success-item">
                  <div className="success-icon-dot"></div>
                  <div style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.4, fontWeight: '500' }}>Активовано захист від неявок та нагадування.</div>
                </div>
                <div className="success-item">
                  <div className="success-icon-dot"></div>
                  <div style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.4, fontWeight: '500' }}>Підготовлено фінансову аналітику.</div>
                </div>
              </div>
            )}

          </div>

          {/* Кнопка ПРОДОВЖИТИ */}
          {step !== 2 && (
            <div style={{ marginTop: '1.5rem' }}>
              <button
                onClick={handleNext}
                className="continue-btn"
                disabled={!isStepValid() || loading}
              >
                {loading ? 'Налаштування системи...' : step === 13 ? 'Відкрити Панель Керування' : 'Продовжити'}
              </button>
            </div>
          )}

        </div>
      </div>

      {/* МОДАЛКА МАЙСТРА */}
      {isStaffModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="anim-step" style={{ backgroundColor: '#ffffff', width: '100%', maxWidth: '400px', borderRadius: '16px', padding: '2rem', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: '#0f172a' }}>Новий фахівець</h3>
              <button onClick={() => setIsStaffModalOpen(false)} style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', color: '#475569' }}>✕</button>
            </div>

            <label className="input-label">Ім'я та прізвище</label>
            <input type="text" placeholder="Наприклад, Олексій" className="input-field" value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} />

            <label className="input-label">Email адреса</label>
            <input type="email" placeholder="alex@gmail.com" className="input-field" value={newStaff.email} onChange={e => setNewStaff({...newStaff, email: e.target.value})} />

            <label className="input-label">Номер телефону</label>
            <div className="phone-input-wrapper">
              <div className="phone-prefix">+380</div>
              <input
                type="tel"
                placeholder="99 123 45 67"
                maxLength={9}
                className="phone-input"
                value={newStaff.phone}
                onChange={(e) => setNewStaff({...newStaff, phone: e.target.value.replace(/\D/g, '')})}
              />
            </div>

            <label className="input-label">Посада</label>
            <input type="text" placeholder="Топ-майстер" className="input-field" style={{ marginBottom: '1.5rem' }} value={newStaff.role} onChange={e => setNewStaff({...newStaff, role: e.target.value})} />

            <button className="continue-btn" onClick={addStaffMember} disabled={!newStaff.name || !newStaff.email || newStaff.phone.length !== 9}>Додати в команду</button>
          </div>
        </div>
      )}

      {/* МОДАЛКА ПОСЛУГИ */}
      {isServiceModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div className="anim-step" style={{ backgroundColor: '#ffffff', width: '100%', maxWidth: '400px', borderRadius: '16px', padding: '2rem', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: '#0f172a' }}>{editingServiceId ? 'Редагувати послугу' : 'Нова послуга'}</h3>
              <button onClick={() => setIsServiceModalOpen(false)} style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', color: '#475569' }}>✕</button>
            </div>

            <label className="input-label">Назва послуги</label>
            <input type="text" placeholder="Наприклад, Чоловіча стрижка" className="input-field" value={serviceForm.name} onChange={e => setServiceForm({...serviceForm, name: e.target.value})} />

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label className="input-label">Тривалість (хв)</label>
                <select className="input-field" style={{ cursor: 'pointer' }} value={serviceForm.duration} onChange={e => setServiceForm({...serviceForm, duration: Number(e.target.value)})}>
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

            <button className="continue-btn" style={{ marginTop: '0.5rem' }} onClick={saveService} disabled={!serviceForm.name || !serviceForm.price}>Зберегти послугу</button>
          </div>
        </div>
      )}

    </div>
  );
}