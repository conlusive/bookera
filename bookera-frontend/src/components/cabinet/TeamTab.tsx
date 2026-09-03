'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';
import { isOwnerRole, OWNER_ROLE } from '@/lib/roles';
import { useToast } from '@/context/ToastContext';
import SaveButton from '@/components/ui/SaveButton';
import { Icons } from '@/components/shared';


// 🟢 Локальні іконки
const WalletIcon = () => (
  <svg width="1.2em" height="1.2em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
  </svg>
);

const CreditCardIcon = () => (
  <svg width="1.2em" height="1.2em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="14" x="2" y="5" rx="2" />
    <line x1="2" x2="22" y1="10" y2="10" />
  </svg>
);

// 🟢 Кнопка збереження зі спінером


export default function TeamTab({ business, team = [], setTeam, services = [], userProfile, setActiveTab, setFilterMaster, globalShifts = [] }: any) {
  const supabase = useMemo(() => createClient(), []);

  // --- СТАНИ КОМАНДИ ---
  const [selectedStaffId, setSelectedStaffId] = useState<string | number | null>(null);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [staffActiveTab, setStaffActiveTab] = useState<'general' | 'services' | 'schedule' | 'finance' | 'security'>('general');

  // 🟢 ЗБЕРЕЖЕННЯ АКТИВНОЇ ВКЛАДКИ ТА ПРАЦІВНИКА ПРИ ОНОВЛЕННІ
  useEffect(() => {
    const savedTab = localStorage.getItem('bookera_staff_active_tab');
    if (savedTab) setStaffActiveTab(savedTab as any);

    const savedStaff = localStorage.getItem('bookera_selected_staff_id');
    if (savedStaff) setSelectedStaffId(savedStaff);
  }, []);

  const handleTabChange = (tabId: any) => {
    setStaffActiveTab(tabId);
    localStorage.setItem('bookera_staff_active_tab', tabId);
  };

  const handleStaffSelect = (staffId: any) => {
    setSelectedStaffId(staffId);
    localStorage.setItem('bookera_selected_staff_id', String(staffId));
  };

  const [localAssignedServices, setLocalAssignedServices] = useState<string[]>([]);
  const [staffServiceSearchQuery, setStaffServiceSearchQuery] = useState('');

  // 🟢 СТЕЙТ ДЛЯ ЗАРПЛАТИ
  const [payoutHistory, setPayoutHistory] = useState<any[]>([]);
  const [duePayouts, setDuePayouts] = useState<any[]>([]);
  const [payoutPreview, setPayoutPreview] = useState<{
    gross_revenue: number; commission_rate: number; payout_amount: number;
    completed_appointments_count: number; period_start: string;
    commission_part?: number; fixed_part?: number; tax_rate?: number; tax_amount?: number;
    materials_cost?: number; materials_deducted?: boolean;
  } | null>(null);
  const [isLoadingFinance, setIsLoadingFinance] = useState(false);

// 🟢 Стан збереження форми (для кнопки)
  const [isSavingStaff, setIsSavingStaff] = useState(false);

  // 🟢 СТАНИ МОДАЛОК
  const [isInviteStaffModalOpen, setIsInviteStaffModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'master' });
  const [isInvitingStaff, setIsInvitingStaff] = useState(false);

  // 🟢 Стейт та плавний показ Toast-сповіщень (з анімацією випливання і запливання)
  // Використовуємо СПІЛЬНУ систему повідомлень замість власної: раніше тут
  // була окрема реалізація зі своєю плашкою, через що на екрані могли
  // зʼявитись дві різні плашки, а success показувався всупереч загальному
  // правилу (успіх підтверджує сама кнопка, а не тост у кутку).
  const { showToast } = useToast();

  // ПРИМІТКА: тут раніше був useEffect, що синхронізував ім'я/телефон
  // співробітника з таблиці 'profiles' (auth-профіль) у таблицю 'staff'.
  // Обидві таблиці більше не існують - персонал тепер напряму User-модель
  // на бекенді, і api.listStaff() вже повертає актуальні full_name/phone
  // без потреби в окремій синхронізації.

  // Стани модалки передачі прав
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [newOwnerId, setNewOwnerId] = useState<string>('');
  const [transferConfirmed, setTransferConfirmed] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  // Фірмові кольори системи
  const colors = {
    bg: '#ffffff',
    surface: '#f8fafc',
    textPrimary: '#0f172a',
    textSecondary: '#64748b',
    border: '#e2e8f0',
    blue: '#3b82f6',
    blueLight: '#eff6ff',
    green: '#10b981',
    red: '#ef4444',
    wMintBg: '#dcfce7', wMintBorder: '#86efac', wMintText: '#166534',
  };

// --- ЛОГІКА МАЙСТРА ТА ДОСТУПІВ ---
  // 🟢 Залізобетонна перевірка прав власника за ID, роллю або email
  // isOwnerRole приймає всі історичні назви ролі власника ('business_owner'
  // з бекенду, а також старі 'vendor'/'owner'). Раніше тут звірялось лише
  // з 'vendor'/'owner' - і власник із роллю 'business_owner' не отримував
  // прав на редагування власної ж картки.
  const isSystemOwner = Boolean(
    (userProfile?.id && business?.owner_id && String(userProfile.id) === String(business.owner_id)) ||
    isOwnerRole(userProfile?.role)
  );

  const currentLoggedInStaff = (team || []).find((t: any) => t.email === userProfile?.email || String(t.id) === String(userProfile?.id));
  const currentUserRole = isSystemOwner ? OWNER_ROLE : (currentLoggedInStaff?.role || 'master');
  const hasAdminRights = isSystemOwner || currentUserRole === 'admin' || isOwnerRole(currentUserRole);


  // Гарантуємо наявність картки власника, навіть якщо база staff ще порожня
  const effectiveTeam = useMemo(() => {
    let list = [...(team || [])];
    const hasOwnerInList = list.some((t: any) => isOwnerRole(t.role) || t.email === userProfile?.email || String(t.id) === String(userProfile?.id));

    if (!hasOwnerInList && isSystemOwner && userProfile) {
      list.unshift({
        id: userProfile.id || 'owner-profile',
        name: userProfile.full_name || 'Я (Власник)',
        email: userProfile.email || '',
        phone: userProfile.phone || business?.phone || '',
        role: 'owner',
        status: 'active',
        title: 'Власник бізнесу',
        provides_services: true,
        assigned_services: (services || []).map((s: any) => String(s.id)),
        shifts: globalShifts,
        commission_rate: 100,
        fixed_salary: 0
      });
    }
    return list;
  }, [team, userProfile, isSystemOwner, services, globalShifts, business]);

  let currentStaff = selectedStaffId ? effectiveTeam.find((t: any) => String(t.id) === String(selectedStaffId)) : null;

  let isOwnerProfile = false;

  if (currentStaff) {
    currentStaff = { ...currentStaff };


    // Перевірка: чи це дійсно профіль власника (навіть якщо роль збилась)
    isOwnerProfile = currentStaff.name?.includes('Власник') || isOwnerRole(currentStaff.role) || (isSystemOwner && currentStaff.email === userProfile?.email);

    if (isOwnerProfile) {
      currentStaff.role = 'owner'; // Примусово повертаємо права
      if (currentStaff.name === 'Я (Власник)' && userProfile?.full_name && !userProfile.full_name.includes('@')) currentStaff.name = userProfile.full_name;
      if (!currentStaff.phone || currentStaff.phone.trim() === '') currentStaff.phone = userProfile?.phone || business?.phone || '';
      if (!currentStaff.email || currentStaff.email.trim() === '') currentStaff.email = userProfile?.email || business?.email || '';
      if (!currentStaff.title || currentStaff.title.trim() === '') currentStaff.title = 'Власник бізнесу';
    } else {
      if (!currentStaff.title || currentStaff.title.trim() === '') currentStaff.title = currentStaff.role === 'admin' ? 'Адміністратор' : 'Спеціаліст';
    }
  }

  const defaultWeekShifts = [
    { day: 'Понеділок', active: true, start: '09:00', end: '20:00' },
    { day: 'Вівторок', active: true, start: '09:00', end: '20:00' },
    { day: 'Середа', active: true, start: '09:00', end: '20:00' },
    { day: 'Четвер', active: true, start: '09:00', end: '20:00' },
    { day: "П'ятниця", active: true, start: '09:00', end: '20:00' },
    { day: 'Субота', active: true, start: '10:00', end: '18:00' },
    { day: 'Неділя', active: false, start: '09:00', end: '20:00' },
  ];

  const providesServices = currentStaff?.provides_services !== false;

  // 🟢 Безпечний розбір масиву змін із захистом від null/undefined/string
  const staffShifts = useMemo(() => {
    let s = currentStaff?.shifts;
    if (typeof s === 'string') {
      try { s = JSON.parse(s); } catch { s = null; }
    }
    if (Array.isArray(s) && s.length > 0) return s;

    let g = globalShifts;
    if (typeof g === 'string') {
      try { g = JSON.parse(g); } catch { g = null; }
    }
    if (Array.isArray(g) && g.length > 0) return g;

    return defaultWeekShifts;
  }, [currentStaff?.shifts, globalShifts]);

  useEffect(() => {
    if (currentStaff) {
      setLocalAssignedServices(currentStaff.assigned_services || services.map((s: any) => String(s.id)));
      // Вантажимо розрахунок ОДРАЗУ при виборі співробітника, а не при
      // відкритті вкладки "Зарплата" - раніше через це зелений блок
      // зʼявлявся ривком, окремо від решти картки.
      fetchUnpaidAppointments(currentStaff.id, currentStaff.last_payout_date);
    }
  }, [selectedStaffId, services]);

  // Нагадування "кому вже пора платити" - за періодичністю з картки майстра.
  // Свідомо не автосписання: система нагадує, рішення ухвалює власник.
  useEffect(() => {
    if (!business?.id || !hasAdminRights) return;
    void (async () => {
      try {
        const token = await getAuthToken();
        const res = await api.listDuePayouts(token, business.id);
        setDuePayouts(res.due || []);
      } catch {
        // Нагадування - річ допоміжна: якщо не завантажилось, решта
        // вкладки має працювати як звичайно.
      }
    })();
  }, [business?.id, hasAdminRights, payoutHistory.length]);

  const fetchUnpaidAppointments = async (staffId: string, lastPayoutDate: string | null) => {
    setIsLoadingFinance(true);
    try {
      const token = await getAuthToken();
      // Розрахунок тепер повністю на бекенді (той самий period-based підхід,
      // що не дає одному й тому ж візиту потрапити у дві виплати підряд) -
      // раніше фронтенд сам тягнув сирі 'bookings' і рахував суму на клієнті.
      const [preview, history] = await Promise.all([
        api.getPayoutPreview(token, business.id, staffId),
        api.listPayouts(token, business.id, staffId).catch(() => []),
      ]);
      setPayoutPreview(preview);
      setPayoutHistory(Array.isArray(history) ? history : []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingFinance(false);
    }
  };

  const getUserInitials = (name: string) => {
    if (!name) return 'В';
    const parts = name.split(' ');
    return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0][0].toUpperCase();
  };

  const handleInviteStaff = async () => {
    const targetEmail = inviteForm.email.trim().toLowerCase();
    if (!targetEmail) return showToast('Введіть електронну пошту співробітника', 'error');
    if (!business?.id) return showToast('Заклад не обрано', 'error');

    setIsInvitingStaff(true);
    try {
      const existingInTeam = (team || []).find((t: any) => t.email?.toLowerCase() === targetEmail);
      if (existingInTeam) {
        showToast('Співробітник із такою поштою вже у команді', 'error');
        setIsInvitingStaff(false);
        return;
      }

      // Шукаємо дані в профілях
      // 2. Автоматично шукаємо дані в базі зареєстрованих користувачів (регістронезалежно)
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .ilike('email', targetEmail)
        .maybeSingle();

      const staffName = existingProfile?.full_name?.trim() || targetEmail.split('@')[0];
      const staffPhone = existingProfile?.phone?.trim() || null;
      const isRegistered = Boolean(existingProfile && existingProfile.full_name);

      const newStaffData = {
        business_id: business.id,
        name: staffName,
        email: targetEmail,
        phone: staffPhone,
        role: inviteForm.role || 'master',
        status: existingProfile ? 'active' : 'pending',
        title: inviteForm.role === 'admin' ? 'Адміністратор' : 'Спеціаліст',
        provides_services: inviteForm.role === 'master',
        assigned_services: inviteForm.role === 'master' ? (services || []).map((s: any) => String(s.id)) : [],
        commission_rate: 40,
        fixed_salary: 0,
        tax_rate: 0,
        payment_method: 'cash'
      };

      const { data, error } = await supabase
        .from('staff')
        .insert([newStaffData])
        .select()
        .single();

      if (error) {
        console.error("Помилка додавання в staff:", error);
        showToast(error?.message || 'Не вдалося зберегти', 'error');
        return;
      }

      setTeam((prev: any[]) => [...prev, data]);
      setSelectedStaffId(data.id);
      setIsInviteStaffModalOpen(false);
      setInviteForm({ email: '', role: 'master' });
      showToast(`Запрошення надіслано: ${data.name}`, 'info');
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Не вдалося додати співробітника', 'error');
    } finally {
      setIsInvitingStaff(false);
    }
  };

  const handleUpdateLocalStaff = (updates: any) => {
    const updatedStaff = { ...currentStaff, ...updates };
    setTeam(team.map((t: any) => String(t.id) === String(currentStaff.id) ? updatedStaff : t));
  };

// 🟢 Надійне збереження в базу з реактивним станом кнопки та Toast-сповіщенням
  const handleSaveSettingsDB = async (updates: any, notify: boolean = true) => {
    // Раніше тут стояло !hasAdminRights - і майстер не міг зберегти навіть
    // власне імʼя. Тепер пускаємо, якщо це адмін АБО власна картка; бекенд
    // усе одно відкине спробу майстра змінити собі ставку чи роль.
    if (!currentStaff || isSavingStaff) return;
    if (!hasAdminRights && !isOwnCard) return;
    setIsSavingStaff(true);
    handleUpdateLocalStaff(updates);

    try {
      // Бекенд тепер підтримує ВСІ поля картки співробітника, включно з
      // оплатою праці (оклад/податок/спосіб виплати), особистим графіком
      // і переліком послуг конкретного майстра. Раніше цих колонок не було,
      // і я тимчасово прибрав їх з інтерфейсу - це було помилкою, бо для
      // частини салонів фіксована ставка є основним способом оплати.
      // Назви полів у CRM і на бекенді історично розійшлись (title проти
      // specialization, keeps_tips проти tips_full тощо). Раніше ці поля
      // просто не потрапляли в запит - виглядало наче збереглось, а після
      // перезавантаження значення зникало. Тепер мапінг єдиною таблицею.
      const FIELD_MAP: Record<string, string> = {
        name: 'full_name',
        title: 'specialization',
        specialization: 'specialization',
        phone: 'phone',
        avatar_url: 'avatar_url',
        role: 'role',
        commission_rate: 'commission_rate',
        fixed_salary: 'fixed_salary',
        tax_rate: 'tax_rate',
        payment_method: 'payment_method',
        card_number: 'card_number',
        bank_name: 'bank_name',
        shifts: 'shifts',
        assigned_services: 'assigned_services',
        provides_services: 'provides_services',
        payout_period: 'payout_period',
        payout_day: 'payout_day',
        keeps_tips: 'tips_full',
        tips_full: 'tips_full',
        deduct_materials: 'deduct_materials',
        auto_payout: 'auto_reset_balance',
        auto_reset_balance: 'auto_reset_balance',
        is_active: 'is_active',
      };

      const backendUpdates: Record<string, any> = {};
      for (const [key, value] of Object.entries(updates)) {
        const backendKey = FIELD_MAP[key];
        if (!backendKey || value === undefined) continue;
        backendUpdates[backendKey] = backendKey === 'payout_day' ? String(value) : value;
      }
      // email не редагується тут: він належить обліковому запису Supabase,
      // змінити його можна лише через процедуру зміни пошти самим
      // користувачем (з підтвердженням), а не адміністратором CRM.

      const hasBackendFields = Object.keys(backendUpdates).length > 0;

      const [res] = await Promise.all([
        hasBackendFields
          ? (async () => {
              const token = await getAuthToken();
              await api.updateStaff(token, String(currentStaff.id), backendUpdates);
            })()
          : Promise.resolve(),
        new Promise(resolve => setTimeout(resolve, 600))
      ]);

      if (notify) showToast("Зміни успішно збережено", "success");
    } catch (err: any) {
      console.error("Помилка збереження в БД:", err);
      showToast(err?.message || "Помилка при збереженні даних", "error");
    } finally {
      setIsSavingStaff(false);
    }
  };

  const handleDeleteStaff = async () => {
    if (!currentStaff || !hasAdminRights) return;
    if (isOwnerProfile) return showToast('Профіль власника видалити не можна', 'error');
    if (!confirm(`Ви впевнені, що хочете звільнити ${currentStaff.name}? Усі майбутні записи потрібно буде перенести вручну.`)) return;

    try {
      const token = await getAuthToken();
      await api.removeStaff(token, String(currentStaff.id));
      setTeam(team.filter((t: any) => String(t.id) !== String(currentStaff.id)));
      setSelectedStaffId(null);
      setStaffActiveTab('general');
    } catch (err: any) { showToast(err?.message || 'Не вдалося видалити співробітника', 'error'); }
  };

  // 🟢 ЛОГІКА ПЕРЕДАЧІ ПРАВ ВЛАСНИКА
  const handleTransferOwnership = async () => {
    if (!newOwnerId) return showToast('Оберіть співробітника зі списку', 'error');
    if (!transferConfirmed) return showToast('Підтвердіть передачу прав галочкою', 'error');

    setIsTransferring(true);
    try {
      // Один запит замість трьох окремих (businesses.update + 2x staff.update) -
      // бекенд сам перевіряє, що це РЕАЛЬНИЙ власник (не просто хтось із
      // доступом до CRM), і атомарно міняє і owner_id, і ролі обох сторін.
      const token = await getAuthToken();
      await api.transferOwnership(token, business.id, String(newOwnerId));

      showToast('Права власності передано', 'info');
      window.location.reload();

    } catch (err: any) {
      showToast(err?.message || 'Не вдалося передати права', 'error');
    } finally {
      setIsTransferring(false);
      setIsTransferModalOpen(false);
      setNewOwnerId('');
      setTransferConfirmed(false);
    }
  };

  const handleExportToCalendar = () => {
    if (!currentStaff) return;
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//BookEra//Schedule//UK\n";
    const daysMap = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
    const baseDates = ['20240101', '20240102', '20240103', '20240104', '20240105', '20240106', '20240107'];

    staffShifts.forEach((shift: any, idx: number) => {
      if (shift.active && shift.start && shift.end) {
        const [startH, startM] = shift.start.split(':');
        const [endH, endM] = shift.end.split(':');
        icsContent += "BEGIN:VEVENT\n";
        icsContent += `SUMMARY:Робоча зміна (${currentStaff.name})\n`;
        icsContent += `DTSTART:${baseDates[idx]}T${startH}${startM}00\n`;
        icsContent += `DTEND:${baseDates[idx]}T${endH}${endM}00\n`;
        icsContent += `RRULE:FREQ=WEEKLY;BYDAY=${daysMap[idx]}\n`;
        icsContent += "END:VEVENT\n";
      }
    });
    icsContent += "END:VCALENDAR";
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `grafik_${(currentStaff.name || 'staff').replace(/\s+/g, '_')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Три рівні, дзеркально до перевірок на бекенді:
  //   isSystemOwner  - власник: усе, включно з передачею прав
  //   hasAdminRights - адміністратор: усе, крім передачі власності
  //   isOwnCard      - майстер про себе: контакти й графік, але не ставка/роль
  const isOwnCard = Boolean(
    currentStaff && userProfile &&
    (String(currentStaff.id) === String(userProfile.id) || currentStaff.email === userProfile.email)
  );
  const canEditContacts = hasAdminRights || isOwnCard;   // імʼя, телефон, посада
  const canEditSchedule = hasAdminRights || isOwnCard;   // власний графік
  const canEditFinance = hasAdminRights;                 // ставка, відсоток, податок
  const canEditServices = hasAdminRights;                // які послуги виконує

  const getRoleBadge = (staff: any) => {
    if ((staff.name || '').includes('Власник') || isOwnerRole(staff.role)) return { label: 'Власник бізнесу', color: colors.blue, bg: colors.blueLight };
    if (staff.role === 'admin') return { label: 'Адміністратор', color: '#5856d6', bg: '#f2f2f7' };
    return { label: 'Спеціаліст', color: colors.green, bg: '#dcfce7' };
  };

  const activeStaffTab = staffActiveTab || 'general';

  const currentPhoneDisplay = currentStaff?.phone?.startsWith('+380') ? currentStaff.phone : '+380' + (currentStaff?.phone ? currentStaff.phone.replace(/\D/g, '').replace(/^380/, '') : '');

  // Захищаємо ОБИДВІ сторони порівняння: і поле співробітника, і сам
  // пошуковий рядок. Компонент може відрендеритись до того, як стан
  // ініціалізувався, і тоді staffSearchQuery ще undefined - через це
  // падав увесь кабінет, а не лише вкладка "Команда".
  const filteredTeam = (team || []).filter((member: any) => {
    const label = String(member?.name ?? member?.full_name ?? '');
    const query = String(staffSearchQuery ?? '');
    return label.toLowerCase().includes(query.toLowerCase());
  });

  // 🟢 Реактивна кнопка збереження зі спінером та станом "Збереження..."


  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', backgroundColor: colors.bg, overflow: 'hidden' }}>

      {/* 🟢 CSS-Анімації для плавного Toast і спінера кнопки */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes toastSlideIn {
          from {
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes toastSlideOut {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateY(30px) scale(0.95);
          }
        }
        .toast-in {
          animation: toastSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .toast-out {
          animation: toastSlideOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* --- ЛІВА ПАНЕЛЬ КОМАНДИ --- */}
      <div style={{ width: '300px', borderRight: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', backgroundColor: colors.surface, zIndex: 10 }}>
        <div style={{ padding: '2rem 1.5rem 1rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: colors.textPrimary, margin: 0, letterSpacing: '-0.5px' }}>Команда</h2>
            {hasAdminRights && (
              <button
                className="bk-btn bk-btn-primary bk-btn-sm"
                onClick={() => setIsInviteStaffModalOpen(true)}
              >
                <Icons.Plus /> Додати
              </button>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: colors.textSecondary }}><Icons.Search /></div>
            <input type="text" placeholder="Пошук..." value={staffSearchQuery} onChange={(e) => setStaffSearchQuery(e.target.value)} style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.2rem', borderRadius: '10px', border: `1px solid ${colors.border}`, fontSize: '0.9rem', outline: 'none', transition: '0.2s', backgroundColor: colors.bg, color: colors.textPrimary }} onFocus={e => e.currentTarget.style.borderColor = colors.blue} onBlur={e => e.currentTarget.style.borderColor = colors.border}/>
          </div>
        </div>

        <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 1rem 1rem 1rem' }}>
          {filteredTeam.map((member: any) => {
            const isSelected = String(selectedStaffId) === String(member.id) || (selectedStaffId === null && member.id === team[0]?.id);
            const isPending = member.status === 'pending';
            const badge = getRoleBadge(member);
            // Замість окремого банера над списком - позначка прямо на картці:
            // видно, кому пора платити, не відводячи погляд від людини.
            const due = duePayouts.find((d: any) => String(d.staff_id) === String(member.id));

            if (!hasAdminRights && String(member.id) !== String(currentLoggedInStaff?.id)) return null;

            return (
              <div key={member.id} onClick={() => handleStaffSelect(member.id)} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', borderRadius: '12px', cursor: 'pointer', transition: '0.2s', backgroundColor: isSelected ? colors.bg : 'transparent', boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.04)' : 'none', marginBottom: '0.2rem', border: isSelected ? `1px solid ${colors.border}` : '1px solid transparent' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: isSelected ? colors.textPrimary : colors.border, color: isSelected ? '#fff' : colors.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.9rem', flexShrink: 0 }}>
                  {getUserInitials(member.name)}
                </div>
                <div style={{ overflow: 'hidden', flex: 1 }}>
                  <div style={{ fontWeight: isSelected ? '600' : '500', color: colors.textPrimary, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.name}</div>
                  <div style={{ fontSize: '0.75rem', color: isPending ? '#f59e0b' : colors.textSecondary, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {isPending ? <><span style={{width: 6, height: 6, borderRadius: '50%', background: '#f59e0b'}}></span> Очікує</> : badge.label}
                  </div>
                </div>

                {due && (
                  <span
                    title={`До виплати ${Number(due.amount_due).toLocaleString('uk-UA')} ₴`}
                    style={{
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      color: '#8A5A1E',
                      background: '#FDF6E9',
                      border: '0.5px solid rgba(180, 130, 40, 0.22)',
                      padding: '3px 8px',
                      borderRadius: '20px',
                      lineHeight: 1,
                    }}
                  >
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#D99A2B', flexShrink: 0 }} />
                    {Number(due.amount_due).toLocaleString('uk-UA')} ₴
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* --- ПРАВА ПАНЕЛЬ --- */}
      <div className="custom-scroll" style={{ flex: 1, backgroundColor: colors.bg, overflowY: 'auto', position: 'relative' }}>
        {currentStaff ? (
          <div style={{ maxWidth: '850px', margin: '0 auto', padding: '3rem 2rem' }}>

            {/* ХЕДЕР ПРОФІЛЮ */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: colors.surface, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '2rem', color: colors.textPrimary }}>
                  {getUserInitials(currentStaff.name)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <h1 style={{ fontSize: '1.8rem', fontWeight: '800', color: colors.textPrimary, margin: 0, letterSpacing: '-0.5px' }}>{currentStaff.name}</h1>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '0.85rem', fontWeight: '600' }}>
                    {currentStaff.status === 'pending' ? (
                      <span style={{ color: '#b45309', background: '#fef3c7', padding: '0.2rem 0.6rem', borderRadius: '8px' }}>Очікує прийняття</span>
                    ) : (
                      <span style={{ color: getRoleBadge(currentStaff).color, background: getRoleBadge(currentStaff).bg, padding: '0.2rem 0.6rem', borderRadius: '8px' }}>{getRoleBadge(currentStaff).label}</span>
                    )}
                  </div>
                </div>
              </div>

              {providesServices && (
                <button onClick={() => { setActiveTab('Calendar'); setFilterMaster(currentStaff.id); }} style={{ padding: '0.7rem 1.2rem', borderRadius: '10px', border: 'none', background: colors.blueLight, fontWeight: '600', fontSize: '0.9rem', color: colors.blue, cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onMouseOver={e => e.currentTarget.style.background = '#dbeafe'} onMouseOut={e => e.currentTarget.style.background = colors.blueLight}>
                  <Icons.Calendar /> Відкрити розклад
                </button>
              )}
            </div>

            {/* НАВІГАЦІЯ ПО ВКЛАДКАХ */}
            <div style={{ display: 'flex', gap: '2.5rem', borderBottom: `1px solid ${colors.border}`, marginBottom: '2.5rem', overflowX: 'auto' }}>
              {[
                { id: 'general', label: 'Загальна інформація' },
                { id: 'services', label: 'Послуги' },
                { id: 'schedule', label: 'Графік роботи' },
                { id: 'finance', label: 'Зарплата' },
                ...(hasAdminRights ? [{ id: 'security', label: 'Доступ та Безпека' }] : [])
              ].map(tab => (
                <div
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  style={{
                    paddingBottom: '1rem', fontSize: '0.95rem', cursor: 'pointer', transition: '0.2s',
                    fontWeight: activeStaffTab === tab.id ? '700' : '500',
                    color: activeStaffTab === tab.id ? colors.textPrimary : colors.textSecondary,
                    borderBottom: activeStaffTab === tab.id ? `2px solid ${colors.textPrimary}` : '2px solid transparent',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {tab.label}
                </div>
              ))}
            </div>

            {/* --- 1. ЗАГАЛЬНА ІНФОРМАЦІЯ --- */}
            {activeStaffTab === 'general' && (
              <div style={{ animation: 'slideUp 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {hasAdminRights && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-1rem' }}>
                    <button
                      type="button"
                      disabled={isSavingStaff}
                      onClick={() => handleSaveSettingsDB({
                        name: currentStaff.name,
                        title: currentStaff.title,
                        phone: currentStaff.phone,
                      })}
                      style={{
                        padding: '0.65rem 1.4rem',
                        borderRadius: '10px',
                        border: 'none',
                        background: isSavingStaff ? '#334155' : colors.textPrimary,
                        fontWeight: '700',
                        color: '#ffffff',
                        fontSize: '0.9rem',
                        cursor: isSavingStaff ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.55rem',
                        boxShadow: isSavingStaff ? 'none' : '0 4px 12px rgba(15, 23, 42, 0.15)',
                        opacity: isSavingStaff ? 0.85 : 1,
                      }}
                      onMouseOver={e => { if (!isSavingStaff) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                      onMouseOut={e => { if (!isSavingStaff) e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                      {isSavingStaff ? (
                        <>
                          <span style={{
                            width: '13px',
                            height: '13px',
                            border: '2px solid rgba(255, 255, 255, 0.3)',
                            borderTopColor: '#ffffff',
                            borderRadius: '50%',
                            display: 'inline-block',
                            animation: 'spin 0.6s linear infinite'
                          }}></span>
                          <span>Збереження...</span>
                        </>
                      ) : (
                        <span>Зберегти дані</span>
                      )}
                    </button>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: colors.textSecondary, marginBottom: '0.4rem' }}>ПІБ співробітника</label>
                    <input type="text" value={currentStaff.name || ''} onChange={e => handleUpdateLocalStaff({ name: e.target.value })} disabled={!canEditContacts} style={{ width: '100%', padding: '0.8rem 1rem', background: '#fff', border: `1px solid ${colors.border}`, borderRadius: '10px', fontSize: '0.95rem', fontWeight: '500', color: colors.textPrimary, outline: 'none', transition: '0.2s' }} onFocus={e => e.currentTarget.style.borderColor = colors.blue} onBlur={e => e.currentTarget.style.borderColor = colors.border} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: colors.textSecondary, marginBottom: '0.4rem' }}>Посада (Для клієнтів)</label>
                    <input type="text" value={currentStaff.title || ''} placeholder="Наприклад: Топ-Барбер" onChange={e => handleUpdateLocalStaff({ title: e.target.value })} disabled={!canEditContacts} style={{ width: '100%', padding: '0.8rem 1rem', background: '#fff', border: `1px solid ${colors.border}`, borderRadius: '10px', fontSize: '0.95rem', fontWeight: '500', color: colors.textPrimary, outline: 'none', transition: '0.2s' }} onFocus={e => e.currentTarget.style.borderColor = colors.blue} onBlur={e => e.currentTarget.style.borderColor = colors.border} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: colors.textSecondary, marginBottom: '0.4rem' }}>Телефон</label>
                    <input type="text" value={currentPhoneDisplay} onChange={e => { if (!canEditContacts) return; let val = e.target.value; if (!val.startsWith('+380')) val = '+380'; const digits = val.slice(4).replace(/\D/g, ''); handleUpdateLocalStaff({ phone: '+380' + digits.slice(0, 9) }); }} disabled={!canEditContacts} style={{ width: '100%', padding: '0.8rem 1rem', background: '#fff', border: `1px solid ${colors.border}`, borderRadius: '10px', fontSize: '0.95rem', fontWeight: '600', color: colors.textPrimary, outline: 'none', transition: '0.2s' }} onFocus={e => e.currentTarget.style.borderColor = colors.blue} onBlur={e => e.currentTarget.style.borderColor = colors.border} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: colors.textSecondary, marginBottom: '0.4rem' }}>Email</label>
                    <input type="email" value={currentStaff.email || ''} readOnly disabled title="Пошта належить обліковому запису і змінюється власником акаунта" style={{ width: '100%', padding: '0.8rem 1rem', background: '#fff', border: `1px solid ${colors.border}`, borderRadius: '10px', fontSize: '0.95rem', fontWeight: '500', color: colors.textPrimary, outline: 'none', transition: '0.2s' }} onFocus={e => e.currentTarget.style.borderColor = colors.blue} onBlur={e => e.currentTarget.style.borderColor = colors.border} />
                  </div>
                </div>
              </div>
            )}

            {/* --- 2. ПОСЛУГИ --- */}
            {activeStaffTab === 'services' && (
              <div style={{ animation: 'slideUp 0.3s ease-out' }}>
                 {!providesServices ? (
                  <div style={{ textAlign: 'center', padding: '4rem 2rem', background: colors.surface, borderRadius: '16px', border: `1px dashed ${colors.border}` }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: colors.textPrimary, margin: 0 }}>Послуги вимкнено</h3>
                  </div>
                ) : (
                  <>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ position: 'relative', width: '300px' }}>
                          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: colors.textSecondary }}><Icons.Search /></div>
                          <input type="text" placeholder="Знайти послугу..." value={staffServiceSearchQuery} onChange={(e) => setStaffServiceSearchQuery(e.target.value)} style={{ width: '100%', padding: '0.7rem 1rem 0.7rem 2.2rem', borderRadius: '10px', border: `1px solid ${colors.border}`, background: '#fff', fontSize: '0.9rem', outline: 'none', transition: '0.2s' }} />
                        </div>

                        {/* КНОПКА ВИБРАТИ ВСІ (Автозбереження) */}
                        {canEditServices && (
                          <button
                            onClick={() => {
                              const allAssigned = localAssignedServices.length === services.length;
                              const newAssigned = allAssigned ? [] : services.map((s:any) => String(s.id));
                              setLocalAssignedServices(newAssigned);
                              handleSaveSettingsDB({ assigned_services: newAssigned });
                            }}
                            style={{ background: colors.blueLight, border: 'none', color: colors.blue, fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', padding: '0.6rem 1rem', borderRadius: '8px', transition: '0.2s', whiteSpace: 'nowrap' }}
                            onMouseOver={e => e.currentTarget.style.background = '#dbeafe'}
                            onMouseOut={e => e.currentTarget.style.background = colors.blueLight}
                          >
                            {localAssignedServices.length === services.length ? 'Зняти всі' : `Вибрати всі (${services.length})`}
                          </button>
                        )}
                      </div>

                      <div className="custom-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                         {services.map((srv: any) => {
                            const isAssigned = localAssignedServices.includes(String(srv.id));
                            if (staffServiceSearchQuery && !String(srv?.name ?? '').toLowerCase().includes(String(staffServiceSearchQuery ?? '').toLowerCase())) return null;
                            return (
                               <div key={srv.id} onClick={() => {
                                  if (!hasAdminRights) return;
                                  const newAssigned = isAssigned ? localAssignedServices.filter(id => id !== String(srv.id)) : [...localAssignedServices, String(srv.id)];
                                  setLocalAssignedServices(newAssigned);
                                  handleSaveSettingsDB({ assigned_services: newAssigned }); // Автозбереження кліку
                               }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', background: '#fff', border: `1px solid ${colors.border}`, borderRadius: '12px', cursor: hasAdminRights ? 'pointer' : 'default' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ width: '20px', height: '20px', borderRadius: '6px', background: isAssigned ? colors.blue : colors.surface, border: isAssigned ? 'none' : `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                                      {isAssigned && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                    </div>
                                    <div style={{ fontWeight: '600', color: isAssigned ? colors.textPrimary : colors.textSecondary, fontSize: '0.95rem' }}>{srv.name}</div>
                                  </div>
                               </div>
                            )
                         })}
                      </div>
                  </>
                )}
              </div>
            )}

            {/* --- 3. ГРАФІК РОБОТИ --- */}
            {activeStaffTab === 'schedule' && (
              <div style={{ animation: 'slideUp 0.3s ease-out' }}>
                {!providesServices ? (
                  <div style={{ textAlign: 'center', padding: '4rem 2rem', background: colors.surface, borderRadius: '16px', border: `1px dashed ${colors.border}` }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: colors.textPrimary, margin: '0 0 0.5rem 0' }}>Графік вимкнено</h3>
                    <p style={{ fontSize: '0.95rem', color: colors.textSecondary, margin: 0 }}>Цей співробітник не працює з клієнтами.</p>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
                      <div>
                         <h3 style={{ fontSize: '1rem', fontWeight: '700', color: colors.textPrimary, margin: '0 0 0.4rem 0' }}>Регулярні робочі години</h3>
                         <p style={{ fontSize: '0.85rem', color: colors.textSecondary, margin: 0 }}>Зміни зберігаються автоматично.</p>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                         <button onClick={handleExportToCalendar} style={{ fontSize: '0.85rem', color: colors.blue, fontWeight: '600', background: colors.blueLight, border: 'none', cursor: 'pointer', padding: '0.6rem 1rem', borderRadius: '8px', transition: '0.2s', display: 'flex', alignItems: 'center', gap: '0.4rem' }} onMouseOver={e => e.currentTarget.style.background = '#dbeafe'} onMouseOut={e => e.currentTarget.style.background = colors.blueLight}>
                           <Icons.Calendar /> Експорт
                         </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', border: `1px solid ${colors.border}`, borderRadius: '12px', overflow: 'hidden' }}>
                      {staffShifts.map((schedule: any, idx: number) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', background: '#fff', borderBottom: idx !== staffShifts.length - 1 ? `1px solid ${colors.surface}` : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '180px' }}>
                            <div onClick={() => {
                               if (!canEditSchedule) return;
                               // map замість мутації елемента: staffShifts - результат
                               // useMemo, і зміна "на місці" не створює новий масив,
                               // тому React міг не перемалювати рядок.
                               const newShifts = staffShifts.map((s: any, i: number) =>
                                 i === idx ? { ...s, active: !schedule.active } : s
                               );
                               handleUpdateLocalStaff({ shifts: newShifts });
                               handleSaveSettingsDB({ shifts: newShifts }); // Автозбереження тогла
                            }} style={{ userSelect: 'none', WebkitUserSelect: 'none', width: '40px', height: '22px', borderRadius: '12px', background: schedule.active ? (canEditSchedule ? colors.green : colors.textSecondary) : colors.border, position: 'relative', cursor: canEditSchedule ? 'pointer' : 'default', transition: 'background 0.3s', flexShrink: 0 }}>
                              <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: schedule.active ? '20px' : '2px', transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}></div>
                            </div>
                            <div style={{ fontWeight: '600', color: schedule.active ? colors.textPrimary : colors.textSecondary, fontSize: '0.95rem' }}>{schedule.day}</div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            {schedule.active ? (
                              <>
                                <input disabled={!canEditSchedule} type="time" value={schedule.start} onChange={(e) => {
                                   // map, а не мутація: [...staffShifts] копіює лише
                                   // зовнішній масив, самі обʼєкти лишаються спільними,
                                   // тому запис "на місці" міняв і вихідні дані теж.
                                   const newShifts = staffShifts.map((s: any, i: number) =>
                                     i === idx ? { ...s, start: e.target.value } : s
                                   );
                                   handleUpdateLocalStaff({ shifts: newShifts });
                                }} onBlur={() => {
                                   // Зберігаємо АКТУАЛЬНИЙ графік із currentStaff, а не
                                   // staffShifts: цей useMemo міг ще не перерахуватись,
                                   // і на бекенд ішло старе значення - через це зміна
                                   // часу не зберігалась.
                                   handleSaveSettingsDB({ shifts: currentStaff.shifts || staffShifts });
                                }} style={{ padding: '0.5rem 0.8rem', border: `1px solid ${colors.border}`, borderRadius: '8px', fontWeight: '500', color: colors.textPrimary, fontSize: '0.95rem', background: '#fff', outline: 'none', opacity: canEditSchedule ? 1 : 0.7 }} />
                                <span style={{ color: colors.textSecondary, fontWeight: '400' }}>—</span>
                                <input disabled={!canEditSchedule} type="time" value={schedule.end} onChange={(e) => {
                                   // map, а не мутація: [...staffShifts] копіює лише
                                   // зовнішній масив, самі обʼєкти лишаються спільними,
                                   // тому запис "на місці" міняв і вихідні дані теж.
                                   const newShifts = staffShifts.map((s: any, i: number) =>
                                     i === idx ? { ...s, end: e.target.value } : s
                                   );
                                   handleUpdateLocalStaff({ shifts: newShifts });
                                }} onBlur={() => {
                                   // Зберігаємо АКТУАЛЬНИЙ графік із currentStaff, а не
                                   // staffShifts: цей useMemo міг ще не перерахуватись,
                                   // і на бекенд ішло старе значення - через це зміна
                                   // часу не зберігалась.
                                   handleSaveSettingsDB({ shifts: currentStaff.shifts || staffShifts });
                                }} style={{ padding: '0.5rem 0.8rem', border: `1px solid ${colors.border}`, borderRadius: '8px', fontWeight: '500', color: colors.textPrimary, fontSize: '0.95rem', background: '#fff', outline: 'none', opacity: canEditSchedule ? 1 : 0.7 }} />
                              </>
                            ) : <div style={{ padding: '0.5rem 2rem', color: colors.textSecondary, fontWeight: '500', fontSize: '0.95rem', background: colors.surface, borderRadius: '8px', border: `1px dashed ${colors.border}` }}>Вихідний</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* --- 4. ЗАРПЛАТА ТА КОМІСІЙНІ --- */}
            {activeStaffTab === 'finance' && (
              <div style={{ animation: 'slideUp 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

                {/* 🟢 М'ЯТНИЙ ВІДЖЕТ ЗАРОБІТКУ ТА ПОДАТКІВ */}
                {(() => {
                  if (!payoutPreview) {
                    // Скелетон тієї ж висоти, що й готовий блок - щоб картка
                    // не «стрибала», коли розрахунок довантажиться.
                    return (
                      <div style={{ background: colors.wMintBg, border: `1.5px dashed ${colors.wMintBorder}`, borderRadius: '16px', padding: '1.5rem', minHeight: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.wMintText, opacity: 0.7, fontSize: '0.9rem', fontWeight: 600 }}>
                        Рахуємо невиплачений дохід…
                      </div>
                    );
                  }
                  const periodStart = payoutPreview.period_start ? new Date(payoutPreview.period_start) : null;
                  const isPayoutDisabled = payoutPreview.payout_amount <= 0;

                  const handlePayout = async () => {
                     if (isPayoutDisabled) return;
                     if (!confirm(`Зафіксувати виплату ${payoutPreview.payout_amount.toLocaleString('uk-UA')} ₴ для ${currentStaff.name}?`)) return;

                     try {
                        const token = await getAuthToken();
                        // Бекенд сам: закриває період (щоб той самий візит не
                        // потрапив у виплату двічі), створює пов'язаний запис
                        // витрати - раніше це було 3 окремих ручних Supabase-запити.
                        await api.createPayout(token, business.id, currentStaff.id);
                        await fetchUnpaidAppointments(currentStaff.id, null);
                        showToast(`Виплату ${payoutPreview.payout_amount.toLocaleString('uk-UA')} ₴ успішно зафіксовано!`, "success");
                     } catch (err: any) {
                        showToast(err?.message || "Помилка збереження виплати", "error");
                     }
                  };

                  return (
                    <div style={{ background: colors.wMintBg, border: `1.5px dashed ${colors.wMintBorder}`, borderRadius: '16px', padding: '1.5rem', position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: colors.wMintText, marginBottom: '0.5rem' }}>
                               <Icons.TrendingUp />
                               <span style={{ fontWeight: '800', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Невиплачений дохід майстра</span>
                            </div>

                            <p style={{ fontSize: '0.85rem', color: colors.wMintText, margin: '0 0 1.5rem 0', opacity: 0.8 }}>
                              Розрахунок з: <b>{periodStart ? periodStart.toLocaleDateString('uk-UA') : 'початку роботи'}</b>
                              {' '}(Виконано: <b>{payoutPreview.completed_appointments_count}</b> візитів на суму <b>{Number(payoutPreview.gross_revenue).toLocaleString('uk-UA')} ₴</b>)
                            </p>

                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.5rem', flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ fontSize: '0.75rem', color: colors.wMintText, marginBottom: '4px', opacity: 0.8, fontWeight: '600' }}>Відсоток ({payoutPreview.commission_rate}%)</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: colors.wMintText }}>{Number(payoutPreview.commission_part || 0).toLocaleString('uk-UA')} ₴</div>
                              </div>

                              {Number(payoutPreview.fixed_part) > 0 && (
                                <>
                                  <div style={{ fontSize: '1.1rem', color: colors.wMintBorder, paddingBottom: '2px' }}>+</div>
                                  <div>
                                    <div style={{ fontSize: '0.75rem', color: colors.wMintText, marginBottom: '4px', opacity: 0.8, fontWeight: '600' }}>Ставка</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: '700', color: colors.wMintText }}>{Number(payoutPreview.fixed_part).toLocaleString('uk-UA')} ₴</div>
                                  </div>
                                </>
                              )}

                              {Number(payoutPreview.materials_cost) > 0 && (
                                <>
                                  <div style={{ fontSize: '1.1rem', color: payoutPreview.materials_deducted ? colors.red : colors.wMintBorder, opacity: 0.6, paddingBottom: '2px' }}>
                                    {payoutPreview.materials_deducted ? '−' : '·'}
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '0.75rem', color: payoutPreview.materials_deducted ? colors.red : colors.wMintText, marginBottom: '4px', opacity: 0.8, fontWeight: '600' }}>
                                      Матеріали{!payoutPreview.materials_deducted && ' (довідково)'}
                                    </div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: '700', color: payoutPreview.materials_deducted ? colors.red : colors.wMintText, opacity: payoutPreview.materials_deducted ? 1 : 0.6 }}>
                                      {Number(payoutPreview.materials_cost).toLocaleString('uk-UA')} ₴
                                    </div>
                                  </div>
                                </>
                              )}

                              {Number(payoutPreview.tax_amount) > 0 && (
                                <>
                                  <div style={{ fontSize: '1.1rem', color: colors.red, opacity: 0.6, paddingBottom: '2px' }}>−</div>
                                  <div>
                                    <div style={{ fontSize: '0.75rem', color: colors.red, marginBottom: '4px', opacity: 0.85, fontWeight: '600' }}>Податок ({payoutPreview.tax_rate}%)</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: '700', color: colors.red }}>{Number(payoutPreview.tax_amount).toLocaleString('uk-UA')} ₴</div>
                                  </div>
                                </>
                              )}

                              <div style={{ fontSize: '1.1rem', color: colors.wMintBorder, paddingBottom: '2px', marginLeft: '0.5rem' }}>=</div>

                              <div style={{ marginLeft: '0.5rem' }}>
                                <div style={{ fontSize: '0.75rem', color: colors.wMintText, marginBottom: '4px', fontWeight: '800', textTransform: 'uppercase' }}>До виплати</div>
                                <div style={{ fontSize: '2rem', fontWeight: '800', color: colors.wMintText, lineHeight: 1, letterSpacing: '-1px' }}>
                                  {payoutPreview.payout_amount.toLocaleString('uk-UA')} <span style={{fontSize: '1.2rem', opacity: 0.8}}>₴</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {hasAdminRights && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                               <button
                                 onClick={handlePayout}
                                 disabled={isPayoutDisabled}
                                 className="bk-btn bk-btn-primary"
                               >
                                 <Icons.CheckCircle /> {isPayoutDisabled ? 'Виплачено' : 'Зафіксувати'}
                               </button>
                            </div>
                          )}
                      </div>
                    </div>
                  );
                })()}

                {/* 🟢 ОСНОВНІ НАЛАШТУВАННЯ ЗАРПЛАТИ */}
                <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: `1px solid ${colors.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                     <div>
                       <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: colors.textPrimary, margin: '0 0 0.4rem 0' }}>Налаштування зарплати</h3>
                       <p style={{ fontSize: '0.85rem', color: colors.textSecondary, margin: 0 }}>Параметри автоматичного розрахунку.</p>
                     </div>
                     {hasAdminRights && (
                        <button
                           type="button"
                           disabled={isSavingStaff}
                           onClick={() => handleSaveSettingsDB({
                              commission_rate: currentStaff.commission_rate || 0,
                              fixed_salary: currentStaff.fixed_salary || 0,
                              tax_rate: currentStaff.tax_rate || 0,
                              payout_period: currentStaff.payout_period || 'weekly',
                              payout_day: currentStaff.payout_day || 'monday',
                              auto_payout: currentStaff.auto_payout || false,
                              keeps_tips: currentStaff.keeps_tips !== false,
                              deduct_materials: currentStaff.deduct_materials || false,
                              payment_method: currentStaff.payment_method || 'cash',
                              card_number: currentStaff.card_number || '',
                              bank_name: currentStaff.bank_name || ''
                           })}
                           style={{
                              padding: '0.65rem 1.4rem',
                              borderRadius: '10px',
                              border: 'none',
                              background: isSavingStaff ? '#334155' : colors.textPrimary,
                              fontWeight: '700',
                              color: '#ffffff',
                              fontSize: '0.9rem',
                              cursor: isSavingStaff ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.55rem',
                              boxShadow: isSavingStaff ? 'none' : '0 4px 12px rgba(15, 23, 42, 0.15)',
                              opacity: isSavingStaff ? 0.85 : 1,
                           }}
                        >
                           {isSavingStaff ? (
                              <>
                                 <span style={{
                                    width: '13px',
                                    height: '13px',
                                    border: '2px solid rgba(255, 255, 255, 0.3)',
                                    borderTopColor: '#ffffff',
                                    borderRadius: '50%',
                                    display: 'inline-block',
                                    animation: 'spin 0.6s linear infinite'
                                 }}></span>
                                 <span>Збереження...</span>
                              </>
                           ) : (
                              <span>Зберегти</span>
                           )}
                        </button>
                     )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: colors.textSecondary, marginBottom: '0.6rem' }}>Комісія від послуг (%)</label>
                      <div style={{ position: 'relative' }}>
                        <input
                           type="number"
                           value={currentStaff.commission_rate || 0}
                           onChange={e => canEditFinance && handleUpdateLocalStaff({ commission_rate: Number(e.target.value) })}
                           disabled={!hasAdminRights}
                           style={{ width: '100%', padding: '0.8rem 1rem', paddingRight: '2.5rem', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '10px', fontSize: '0.95rem', fontWeight: '600', color: colors.textPrimary, outline: 'none' }}
                        />
                        <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: colors.textSecondary, fontWeight: '500' }}>%</span>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: colors.textSecondary, marginBottom: '0.6rem' }}>Фіксована ставка (₴)</label>
                      <div style={{ position: 'relative' }}>
                        <input
                           type="number"
                           value={currentStaff.fixed_salary || 0}
                           onChange={e => canEditFinance && handleUpdateLocalStaff({ fixed_salary: Number(e.target.value) })}
                           disabled={!hasAdminRights}
                           style={{ width: '100%', padding: '0.8rem 1rem', paddingRight: '2.5rem', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '10px', fontSize: '0.95rem', fontWeight: '600', color: colors.textPrimary, outline: 'none' }}
                        />
                        <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: colors.textSecondary, fontWeight: '500' }}>₴</span>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: colors.textSecondary, marginBottom: '0.6rem' }}>Податок / Утримання (%)</label>
                      <div style={{ position: 'relative' }}>
                        <input
                           type="number"
                           value={currentStaff.tax_rate || 0}
                           onChange={e => canEditFinance && handleUpdateLocalStaff({ tax_rate: Number(e.target.value) })}
                           disabled={!hasAdminRights}
                           style={{ width: '100%', padding: '0.8rem 1rem', paddingRight: '2.5rem', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '10px', fontSize: '0.95rem', fontWeight: '600', color: colors.textPrimary, outline: 'none' }}
                        />
                        <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: colors.textSecondary, fontWeight: '500' }}>%</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'flex-start' }}>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                       {(() => {
                          const safePeriod = currentStaff.payout_period || 'weekly';
                          const safeDay = currentStaff.payout_day || (safePeriod === 'weekly' ? 'monday' : '1');

                          return (
                            <>
                               <div>
                                 <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: colors.textSecondary, marginBottom: '0.4rem' }}>Періодичність виплат</label>
                                 <div style={{ position: 'relative' }}>
                                   <select
                                      value={safePeriod}
                                      onChange={e => {
                                         if (hasAdminRights) {
                                            const newPeriod = e.target.value;
                                            const newDay = newPeriod === 'weekly' ? 'monday' : '1';
                                            handleUpdateLocalStaff({ payout_period: newPeriod, payout_day: newDay });
                                         }
                                      }}
                                      disabled={!hasAdminRights}
                                      style={{ width: '100%', padding: '0.8rem 2.5rem 0.8rem 1rem', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '10px', fontSize: '0.95rem', color: colors.textPrimary, outline: 'none', cursor: hasAdminRights ? 'pointer' : 'default', opacity: hasAdminRights ? 1 : 0.7, appearance: 'none', fontWeight: '500' }}
                                   >
                                      <option value="daily">Щодня (наприкінці зміни)</option>
                                      <option value="weekly">Раз на тиждень</option>
                                      <option value="biweekly">Двічі на місяць</option>
                                      <option value="monthly">Раз на місяць</option>
                                   </select>
                                   <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: colors.textSecondary }}><Icons.ChevronDown /></div>
                                 </div>
                               </div>

                               {safePeriod !== 'daily' && (
                                 <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
                                   <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: colors.textSecondary, marginBottom: '0.4rem' }}>
                                      {safePeriod === 'weekly' ? 'День виплати' : 'Число місяця'}
                                   </label>
                                   <div style={{ position: 'relative' }}>
                                     <select
                                        value={safeDay}
                                        onChange={e => {
                                           if(hasAdminRights) {
                                              handleUpdateLocalStaff({ payout_day: e.target.value });
                                           }
                                        }}
                                        disabled={!hasAdminRights}
                                        style={{ width: '100%', padding: '0.8rem 2.5rem 0.8rem 1rem', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '10px', fontSize: '0.95rem', color: colors.textPrimary, outline: 'none', cursor: hasAdminRights ? 'pointer' : 'default', opacity: hasAdminRights ? 1 : 0.7, appearance: 'none', fontWeight: '500' }}
                                     >
                                        {safePeriod === 'weekly' && (
                                          <><option value="monday">Понеділок</option><option value="tuesday">Вівторок</option><option value="wednesday">Середа</option><option value="thursday">Четвер</option><option value="friday">П'ятниця</option><option value="saturday">Субота</option><option value="sunday">Неділя</option></>
                                        )}
                                        {safePeriod === 'monthly' && [...Array(31)].map((_, i) => (
                                          <option key={i+1} value={String(i+1)}>{i+1}-е число</option>
                                        ))}
                                        {safePeriod === 'biweekly' && [...Array(15)].map((_, i) => (
                                          <option key={i+1} value={String(i+1)}>{i+1}-е та {i+1+15}-е число</option>
                                        ))}
                                     </select>
                                     <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: colors.textSecondary }}><Icons.ChevronDown /></div>
                                   </div>
                                 </div>
                               )}
                            </>
                          );
                       })()}
                     </div>

                     <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', marginTop: '0.5rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: canEditFinance ? 'pointer' : 'default', opacity: canEditFinance ? 1 : 0.7, userSelect: 'none', WebkitUserSelect: 'none' }}>
                          <div style={{ position: 'relative', display: 'inline-block', width: '40px', height: '22px', flexShrink: 0 }}>
                             <input type="checkbox" checked={currentStaff.auto_payout || false} onChange={e => {
                                if(hasAdminRights) {
                                   handleUpdateLocalStaff({ auto_payout: e.target.checked });
                                }
                             }} style={{ opacity: 0, width: 0, height: 0 }} />
                             <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: currentStaff.auto_payout ? colors.green : colors.border, transition: '.3s', borderRadius: '30px' }}><span style={{ position: 'absolute', height: '18px', width: '18px', left: currentStaff.auto_payout ? '20px' : '2px', bottom: '2px', backgroundColor: 'white', transition: '.3s', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}></span></span>
                          </div>
                          <span style={{ fontSize: '0.9rem', fontWeight: '500', color: colors.textPrimary }}>Автоматично обнуляти баланс</span>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: canEditFinance ? 'pointer' : 'default', opacity: canEditFinance ? 1 : 0.7, userSelect: 'none', WebkitUserSelect: 'none' }}>
                          <div style={{ position: 'relative', display: 'inline-block', width: '40px', height: '22px', flexShrink: 0 }}>
                             <input type="checkbox" checked={currentStaff.keeps_tips !== false} onChange={e => {
                                if(hasAdminRights) {
                                   handleUpdateLocalStaff({ keeps_tips: e.target.checked });
                                }
                             }} style={{ opacity: 0, width: 0, height: 0 }} />
                             <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: currentStaff.keeps_tips !== false ? colors.green : colors.border, transition: '.3s', borderRadius: '30px' }}><span style={{ position: 'absolute', height: '18px', width: '18px', left: currentStaff.keeps_tips !== false ? '20px' : '2px', bottom: '2px', backgroundColor: 'white', transition: '.3s', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}></span></span>
                          </div>
                          <span style={{ fontSize: '0.9rem', fontWeight: '500', color: colors.textPrimary }}>Майстер отримує 100% чайових</span>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: canEditFinance ? 'pointer' : 'default', opacity: canEditFinance ? 1 : 0.7, userSelect: 'none', WebkitUserSelect: 'none' }}>
                          <div style={{ position: 'relative', display: 'inline-block', width: '40px', height: '22px', flexShrink: 0 }}>
                             <input type="checkbox" checked={currentStaff.deduct_materials || false} onChange={e => {
                                if(hasAdminRights) {
                                   handleUpdateLocalStaff({ deduct_materials: e.target.checked });
                                }
                             }} style={{ opacity: 0, width: 0, height: 0 }} />
                             <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: currentStaff.deduct_materials ? colors.green : colors.border, transition: '.3s', borderRadius: '30px' }}><span style={{ position: 'absolute', height: '18px', width: '18px', left: currentStaff.deduct_materials ? '20px' : '2px', bottom: '2px', backgroundColor: 'white', transition: '.3s', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}></span></span>
                          </div>
                          <span style={{ fontSize: '0.9rem', fontWeight: '500', color: colors.textPrimary }}>Вираховувати вартість матеріалів</span>
                        </label>
                     </div>
                  </div>
                </div>

                {/* 🟢 БЛОК "СПОСІБ ВИПЛАТИ ТА РЕКВІЗИТИ" */}
                <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: `1px solid ${colors.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                     <div>
                       <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: colors.textPrimary, margin: '0 0 0.4rem 0' }}>Спосіб виплати</h3>
                       <p style={{ fontSize: '0.85rem', color: colors.textSecondary, margin: 0 }}>Оберіть, як майстер отримує заробітну плату.</p>
                     </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', marginBottom: currentStaff.payment_method === 'card' ? '1.5rem' : '0' }}>
                     <div
                        onClick={() => hasAdminRights && handleUpdateLocalStaff({ payment_method: 'cash' })}
                        style={{ flex: 1, padding: '1rem', border: `1.5px solid ${(!currentStaff.payment_method || currentStaff.payment_method === 'cash') ? colors.blue : colors.border}`, borderRadius: '12px', background: (!currentStaff.payment_method || currentStaff.payment_method === 'cash') ? colors.blueLight : colors.surface, cursor: hasAdminRights ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '0.8rem', transition: '0.2s', opacity: hasAdminRights ? 1 : 0.7 }}
                     >
                        <div style={{ color: (!currentStaff.payment_method || currentStaff.payment_method === 'cash') ? colors.blue : colors.textSecondary }}><WalletIcon /></div>
                        <span style={{ fontWeight: '600', color: (!currentStaff.payment_method || currentStaff.payment_method === 'cash') ? colors.blue : colors.textPrimary, fontSize: '0.95rem' }}>Готівкою</span>
                     </div>

                     <div
                        onClick={() => hasAdminRights && handleUpdateLocalStaff({ payment_method: 'card' })}
                        style={{ flex: 1, padding: '1rem', border: `1.5px solid ${currentStaff.payment_method === 'card' ? colors.blue : colors.border}`, borderRadius: '12px', background: currentStaff.payment_method === 'card' ? colors.blueLight : colors.surface, cursor: hasAdminRights ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '0.8rem', transition: '0.2s', opacity: hasAdminRights ? 1 : 0.7 }}
                     >
                        <div style={{ color: currentStaff.payment_method === 'card' ? colors.blue : colors.textSecondary }}><CreditCardIcon /></div>
                        <span style={{ fontWeight: '600', color: currentStaff.payment_method === 'card' ? colors.blue : colors.textPrimary, fontSize: '0.95rem' }}>На картку / IBAN</span>
                     </div>
                  </div>

                  {currentStaff.payment_method === 'card' && (
                     <div style={{ animation: 'slideUp 0.3s ease-out', display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem', padding: '1.5rem', background: colors.surface, borderRadius: '12px', border: `1px dashed ${colors.border}` }}>
                        <div>
                           <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: colors.textSecondary, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Номер картки або IBAN</label>
                           <input
                              type="text"
                              placeholder="0000 0000 0000 0000"
                              value={currentStaff.card_number || ''}
                              onChange={e => {
                                 if (!hasAdminRights) return;
                                 let val = e.target.value.replace(/[^\d\w]/g, '');
                                 if (/^\d+$/.test(val)) {
                                    val = val.replace(/(.{4})/g, '$1 ').trim();
                                    if(val.length > 19) val = val.substring(0, 19);
                                 }
                                 handleUpdateLocalStaff({ card_number: val });
                              }}
                              disabled={!hasAdminRights}
                              style={{ width: '100%', padding: '0.8rem 1rem', background: '#fff', border: `1px solid ${colors.border}`, borderRadius: '10px', fontSize: '1rem', fontWeight: '600', color: colors.textPrimary, outline: 'none', transition: '0.2s', fontFamily: 'monospace' }}
                              onFocus={e => e.currentTarget.style.borderColor = colors.blue}
                              onBlur={e => e.currentTarget.style.borderColor = colors.border}
                           />
                        </div>
                        <div>
                           <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: colors.textSecondary, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Назва банку</label>
                           <input
                              type="text"
                              placeholder="Наприклад: Monobank"
                              value={currentStaff.bank_name || ''}
                              onChange={e => hasAdminRights && handleUpdateLocalStaff({ bank_name: e.target.value })}
                              disabled={!hasAdminRights}
                              style={{ width: '100%', padding: '0.8rem 1rem', background: '#fff', border: `1px solid ${colors.border}`, borderRadius: '10px', fontSize: '0.95rem', fontWeight: '500', color: colors.textPrimary, outline: 'none', transition: '0.2s' }}
                              onFocus={e => e.currentTarget.style.borderColor = colors.blue}
                              onBlur={e => e.currentTarget.style.borderColor = colors.border}
                           />
                        </div>
                     </div>
                  )}
                </div>

                <div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem' }}>
                     <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: colors.textPrimary, margin: 0 }}>Історія виплат</h3>
                   </div>
                   <div className="custom-scroll" style={{ display: 'flex', flexDirection: 'column', maxHeight: '400px', overflowY: 'auto' }}>
                     {payoutHistory.length > 0 ? (
                       <div style={{ border: `1px solid ${colors.border}`, borderRadius: '12px', overflow: 'hidden' }}>
                         {payoutHistory.map((payout: any, i: number) => (
                           <div key={payout.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', background: '#fff', borderBottom: i !== payoutHistory.length - 1 ? `1px solid ${colors.surface}` : 'none' }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: colors.surface, color: colors.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icons.CheckCircle /></div>
                                <div>
                                  <div style={{ fontWeight: '600', color: colors.textPrimary, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                     Виплата • {new Date(payout.paid_at || payout.created_at).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })}
                                     {currentStaff.payment_method === 'card' ? (
                                        <span style={{ fontSize: '0.65rem', background: colors.blueLight, color: colors.blue, padding: '2px 6px', borderRadius: '6px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '2px' }}><CreditCardIcon /> На картку</span>
                                     ) : (
                                        <span style={{ fontSize: '0.65rem', background: colors.surface, color: colors.textSecondary, padding: '2px 6px', borderRadius: '6px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '2px' }}><WalletIcon /> Готівкою</span>
                                     )}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: colors.textSecondary, marginTop: '4px', fontWeight: '500' }}>
                                    Візитів: {payout.appointments_count ?? 0} • Ставка: {Number(payout.fixed_part || 0).toLocaleString('uk-UA')} ₴ • Комісія: {Number(payout.commission_part || 0).toLocaleString('uk-UA')} ₴{Number(payout.tax_amount) > 0 ? ` • Податок: -${Number(payout.tax_amount).toLocaleString('uk-UA')} ₴` : ''}{Number(payout.materials_cost) > 0 ? ` • Матеріали: -${Number(payout.materials_cost).toLocaleString('uk-UA')} ₴` : ''}
                                  </div>
                                </div>
                             </div>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                               <div style={{ fontWeight: '700', color: payout.status === 'cancelled' ? colors.textSecondary : colors.green, fontSize: '1.1rem', textDecoration: payout.status === 'cancelled' ? 'line-through' : 'none' }}>
                                 {Number(payout.payout_amount).toLocaleString('uk-UA')} ₴
                               </div>
                               {payout.status === 'cancelled' ? (
                                 <span style={{ fontSize: '0.7rem', background: colors.surface, color: colors.textSecondary, padding: '3px 8px', borderRadius: '6px', fontWeight: '700' }}>Скасовано</span>
                               ) : hasAdminRights && (
                                 <button
                                   onClick={async () => {
                                     const reason = window.prompt('Причина скасування виплати (необовʼязково):');
                                     if (reason === null) return;
                                     if (!confirm('Скасувати цю виплату? Візити з неї повернуться в наступний розрахунок.')) return;
                                     try {
                                       const token = await getAuthToken();
                                       await api.cancelPayout(token, business.id, currentStaff.id, payout.id, reason);
                                       await fetchUnpaidAppointments(currentStaff.id, null);
                                       showToast('Виплату скасовано, суму повернуто в розрахунок', 'info');
                                     } catch (err: any) {
                                       showToast(err?.message || 'Не вдалося скасувати виплату', 'error');
                                     }
                                   }}
                                   className="bk-btn bk-btn-danger bk-btn-sm"
                                 >
                                   Скасувати
                                 </button>
                               )}
                             </div>
                           </div>
                         ))}
                       </div>
                     ) : (
                       <div style={{ textAlign: 'center', padding: '3rem 2rem', background: colors.surface, borderRadius: '12px', color: colors.textSecondary }}>Історія виплат порожня.</div>
                     )}
                   </div>
                </div>
              </div>
            )}

            {/* --- 5. ДОСТУП ТА БЕЗПЕКА --- */}
            {activeStaffTab === 'security' && hasAdminRights && (
              <div style={{ animation: 'slideUp 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

                {/* 🟢 СИСТЕМНА РОЛЬ: Ховаємо вибір ролей повністю, якщо це Власник */}
                {!isOwnerProfile && (
                  <div>
                    <div style={{ marginBottom: '1.5rem' }}>
                       <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: colors.textPrimary, margin: '0 0 0.5rem 0' }}>Системна роль</h3>
                       <p style={{ fontSize: '0.85rem', color: colors.textSecondary, margin: 0 }}>Визначає рівень доступу співробітника до панелі керування та звітів.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                      <div onClick={() => {
                         handleUpdateLocalStaff({ role: 'master' });
                         handleSaveSettingsDB({ role: 'master' }); // Автозбереження
                      }} style={{ padding: '1.25rem', border: `1.5px solid ${currentStaff.role !== 'admin' ? colors.blue : colors.border}`, borderRadius: '12px', cursor: 'pointer', background: currentStaff.role !== 'admin' ? colors.blueLight : '#fff', transition: '0.2s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                           <input type="radio" checked={currentStaff.role !== 'admin'} readOnly style={{ accentColor: colors.blue }} />
                           <span style={{ fontWeight: '600', color: colors.textPrimary, fontSize: '1rem' }}>Спеціаліст</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: colors.textSecondary, paddingLeft: '1.8rem', lineHeight: '1.4' }}>Має доступ лише до свого календаря та записів. Не бачить фінанси салону та аналітику.</div>
                      </div>

                      <div onClick={() => {
                         handleUpdateLocalStaff({ role: 'admin' });
                         handleSaveSettingsDB({ role: 'admin' }); // Автозбереження
                      }} style={{ padding: '1.25rem', border: `1.5px solid ${currentStaff.role === 'admin' ? colors.blue : colors.border}`, borderRadius: '12px', cursor: 'pointer', background: currentStaff.role === 'admin' ? colors.blueLight : '#fff', transition: '0.2s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                           <input type="radio" checked={currentStaff.role === 'admin'} readOnly style={{ accentColor: colors.blue }} />
                           <span style={{ fontWeight: '600', color: colors.textPrimary, fontSize: '1rem' }}>Адміністратор</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: colors.textSecondary, paddingLeft: '1.8rem', lineHeight: '1.4' }}>Має повний доступ до клієнтської бази, розкладу всіх майстрів, зарплат та налаштувань.</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 🟢 БЛОК ЗАПИСІВ */}
                <div style={{ background: '#fff', border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><h3 style={{ fontSize: '1rem', fontWeight: '600', color: colors.textPrimary, margin: '0 0 0.3rem 0' }}>Приймає записи клієнтів</h3><p style={{ fontSize: '0.8rem', color: colors.textSecondary, margin: 0 }}>Якщо вимкнено, співробітник зникне з онлайн-бронювання та розкладу.</p></div>
                  <div onClick={() => {
                     handleUpdateLocalStaff({ provides_services: !providesServices });
                     handleSaveSettingsDB({ provides_services: !providesServices }); // Автозбереження тогла
                  }} style={{ width: '46px', height: '26px', borderRadius: '13px', background: providesServices ? colors.green : colors.border, position: 'relative', cursor: 'pointer', transition: 'background 0.3s', flexShrink: 0 }}><div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: providesServices ? '22px' : '2px', transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}></div></div>
                </div>

                {/* 🟢 ЛОГІКА ЗВІЛЬНЕННЯ / ПЕРЕДАЧІ ПРАВ ВЛАСНИКА */}
                {!isOwnerProfile ? (
                  <div style={{ background: '#fef2f2', border: `1px dashed ${colors.red}`, borderRadius: '12px', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: colors.red, margin: 0 }}>Звільнення співробітника</h3>
                      <p style={{ fontSize: '0.85rem', color: '#991b1b', margin: 0 }}>Назавжди видалити доступ цієї особи до системи. Історія записів залишиться в базі.</p>
                    </div>
                    <button onClick={handleDeleteStaff} style={{ background: colors.red, color: '#fff', border: 'none', padding: '0.8rem 1.5rem', borderRadius: '10px', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.opacity = '0.8'} onMouseOut={e => e.currentTarget.style.opacity = '1'}>
                      Звільнити майстра
                    </button>
                  </div>
                ) : (
                  <div style={{ background: colors.surface, border: `1px dashed ${colors.border}`, borderRadius: '12px', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: '700', color: colors.textPrimary, margin: '0 0 0.4rem 0' }}>Передача прав власника</h3>
                      <p style={{ fontSize: '0.85rem', color: colors.textSecondary, margin: 0, maxWidth: '400px', lineHeight: 1.4 }}>Щоб звільнити цей профіль, потрібно спочатку передати права власності на бізнес іншому адміністратору.</p>
                    </div>
                    {isSystemOwner ? (
                        <button onClick={() => setIsTransferModalOpen(true)} style={{ background: '#fff', color: colors.textPrimary, border: `1px solid ${colors.border}`, padding: '0.8rem 1.5rem', borderRadius: '10px', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', transition: '0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} onMouseOver={e => e.currentTarget.style.background = colors.surface} onMouseOut={e => e.currentTarget.style.background = '#fff'}>
                          Передати права
                        </button>
                    ) : (
                        <div style={{ fontSize: '0.85rem', fontWeight: '600', color: colors.textSecondary, padding: '0.8rem 1.5rem', background: '#f1f5f9', borderRadius: '10px' }}>
                          Лише власник
                        </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: colors.textSecondary }}>
            <div style={{ fontSize: '3rem', marginBottom: '1.5rem', opacity: 0.5 }}><Icons.Team /></div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: colors.textPrimary, margin: '0 0 0.5rem 0' }}>Оберіть співробітника</h3>
            <p style={{ fontSize: '0.9rem', fontWeight: '500' }}>Виберіть людину зі списку ліворуч для перегляду деталей</p>
          </div>
        )}
      </div>

      {/* --- МОДАЛЬНЕ ВІКНО ПЕРЕДАЧІ ПРАВ ВЛАСНИКА --- */}
      {isTransferModalOpen && (
        <div className="modal-overlay" onClick={() => { setIsTransferModalOpen(false); setNewOwnerId(''); setTransferConfirmed(false); }} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ animation: 'slideUp 0.3s ease', maxWidth: '450px', background: '#fff', padding: '2rem', borderRadius: '20px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: colors.textPrimary, margin: 0 }}>Передача прав</h2>
              <button onClick={() => { setIsTransferModalOpen(false); setNewOwnerId(''); setTransferConfirmed(false); }} style={{ background: colors.surface, border: 'none', width: '32px', height: '32px', borderRadius: '50%', color: colors.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <div style={{ background: '#fff1f2', border: '1px dashed #fca5a5', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
               <p style={{ fontSize: '0.85rem', color: '#991b1b', margin: 0, lineHeight: 1.5, fontWeight: '500' }}>
                  <strong>Увага:</strong> Ця дія незворотна. Ви втратите статус власника та повний контроль над бізнесом. Новий власник зможе керувати всіма аспектами системи, включаючи звільнення співробітників.
               </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: '700', color: colors.textPrimary }}>Оберіть нового власника зі списку команди</label>

              <div className="custom-scroll" style={{ maxHeight: '200px', overflowY: 'auto', border: `1px solid ${colors.border}`, borderRadius: '12px', background: '#f8fafc', padding: '0.5rem' }}>
                 {team.filter((m: any) => String(m.id) !== String(currentStaff.id) && m.status !== 'pending').length > 0 ? (
                   team.filter((m: any) => String(m.id) !== String(currentStaff.id) && m.status !== 'pending').map((m: any) => (
                     <div
                       key={m.id}
                       onClick={() => setNewOwnerId(m.id)}
                       style={{
                         display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem', borderRadius: '8px', cursor: 'pointer', transition: '0.2s',
                         background: newOwnerId === m.id ? colors.blueLight : 'transparent',
                         border: `1px solid ${newOwnerId === m.id ? colors.blue : 'transparent'}`
                       }}
                     >
                       <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: newOwnerId === m.id ? colors.blue : colors.surface, color: newOwnerId === m.id ? '#fff' : colors.textPrimary, border: `1px solid ${newOwnerId === m.id ? 'transparent' : colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.85rem', flexShrink: 0 }}>
                         {getUserInitials(m.name)}
                       </div>
                       <div style={{ flex: 1, overflow: 'hidden' }}>
                         <div style={{ fontWeight: '600', color: colors.textPrimary, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                         <div style={{ fontSize: '0.75rem', color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email}</div>
                       </div>
                       {newOwnerId === m.id && <div style={{ color: colors.blue }}><Icons.CheckCircle /></div>}
                     </div>
                   ))
                 ) : (
                   <div style={{ padding: '2rem 1rem', textAlign: 'center', fontSize: '0.85rem', color: colors.textSecondary }}>Немає доступних співробітників для передачі прав.</div>
                 )}
              </div>
            </div>

            {newOwnerId && (
               <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none', marginBottom: '2rem', padding: '1rem', background: '#fff', border: `1px solid ${colors.red}`, borderRadius: '12px' }}>
                 <input
                   type="checkbox"
                   checked={transferConfirmed}
                   onChange={(e) => setTransferConfirmed(e.target.checked)}
                   style={{ marginTop: '2px', width: '18px', height: '18px', accentColor: colors.red, cursor: 'pointer' }}
                 />
                 <span style={{ fontSize: '0.85rem', color: colors.textPrimary, fontWeight: '500', lineHeight: 1.4 }}>
                   Я розумію, що дія незворотна, і підтверджую передачу прав власності на бізнес.
                 </span>
               </label>
            )}

            <button
              onClick={handleTransferOwnership}
              disabled={isTransferring || !newOwnerId || !transferConfirmed}
              style={{ width: '100%', padding: '0.85rem', backgroundColor: colors.red, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '0.95rem', cursor: (isTransferring || !newOwnerId || !transferConfirmed) ? 'not-allowed' : 'pointer', opacity: (isTransferring || !newOwnerId || !transferConfirmed) ? 0.5 : 1, transition: '0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
            >
              {isTransferring ? 'Передача...' : 'Підтвердити передачу прав'}
            </button>
          </div>
        </div>
      )}

      {/* --- МОДАЛЬНЕ ВІКНО ДОДАВАННЯ ПЕРСОНАЛУ (ТІЛЬКИ EMAIL ТА РОЛЬ) --- */}
      {isInviteStaffModalOpen && (
        <div className="modal-overlay" onClick={() => setIsInviteStaffModalOpen(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ animation: 'slideUp 0.3s ease', maxWidth: '420px', background: '#fff', padding: '2rem', borderRadius: '20px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: colors.textPrimary, margin: 0 }}>Додати співробітника</h2>
              <button onClick={() => setIsInviteStaffModalOpen(false)} style={{ background: colors.surface, border: 'none', width: '32px', height: '32px', borderRadius: '50%', color: colors.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <p style={{ fontSize: '0.85rem', color: colors.textSecondary, marginBottom: '1.5rem', lineHeight: '1.4' }}>Введіть email співробітника. Система автоматично підтягне його ім'я та телефон із зареєстрованого профілю.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: colors.textSecondary, marginBottom: '0.4rem' }}>Електронна пошта *</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={e => setInviteForm({...inviteForm, email: e.target.value})}
                  style={{ width: '100%', padding: '0.8rem 1rem', background: '#fff', border: `1px solid ${colors.border}`, borderRadius: '10px', fontSize: '0.95rem', fontWeight: '500', color: colors.textPrimary, outline: 'none', transition: '0.2s', boxSizing: 'border-box' }}
                  onFocus={e => e.currentTarget.style.borderColor = colors.blue}
                  onBlur={e => e.currentTarget.style.borderColor = colors.border}
                  placeholder="anna@example.com"
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: colors.textSecondary, marginBottom: '0.4rem' }}>Роль у системі</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div
                    onClick={() => setInviteForm({...inviteForm, role: 'master'})}
                    style={{ flex: 1, padding: '0.8rem', border: `1.5px solid ${inviteForm.role === 'master' ? colors.blue : colors.border}`, borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', background: inviteForm.role === 'master' ? colors.blueLight : '#fff', transition: '0.2s' }}
                  >
                    <input type="radio" checked={inviteForm.role === 'master'} readOnly style={{ accentColor: colors.blue }} />
                    <span style={{ fontWeight: '600', color: colors.textPrimary, fontSize: '0.9rem' }}>Спеціаліст</span>
                  </div>
                  <div
                    onClick={() => setInviteForm({...inviteForm, role: 'admin'})}
                    style={{ flex: 1, padding: '0.8rem', border: `1.5px solid ${inviteForm.role === 'admin' ? colors.blue : colors.border}`, borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', background: inviteForm.role === 'admin' ? colors.blueLight : '#fff', transition: '0.2s' }}
                  >
                    <input type="radio" checked={inviteForm.role === 'admin'} readOnly style={{ accentColor: colors.blue }} />
                    <span style={{ fontWeight: '600', color: colors.textPrimary, fontSize: '0.9rem' }}>Адмін</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              className="bk-btn bk-btn-primary bk-btn-lg bk-btn-block"
              style={{ marginTop: '2rem' }}
              onClick={handleInviteStaff}
              disabled={isInvitingStaff}
            >
              {isInvitingStaff ? 'Додавання...' : 'Додати в команду'}
            </button>
          </div>
        </div>
      )}

      {/* 🟢 Стилізоване Toast-сповіщення у кольорах BookEra */}
    </div>
  );
}