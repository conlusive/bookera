'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Business } from '@/types';

// 🟢 ІМПОРТУЄМО ІКОНКИ ТА КОНСТАНТИ З ТВОГО ОКРЕМОГО ФАЙЛУ
import { Icons, navItems, toLocalDateStr } from '@/components/shared';

import CalendarTab from '@/components/cabinet/CalendarTab';
import StatsTab from '@/components/cabinet/StatsTab';
import ClientsTab from '@/components/cabinet/ClientsTab';
import ServicesTab from '@/components/cabinet/ServicesTab';
import TeamTab from '@/components/cabinet/TeamTab';
import InventoryTab from '@/components/cabinet/InventoryTab';
import MarketingTab from '@/components/cabinet/MarketingTab';
import SettingsTab from '@/components/cabinet/SettingsTab';
import StorefrontTab from '@/components/cabinet/StorefrontTab';

export default function BusinessCabinet() {
  const router = useRouter();
  const supabase = createClient();

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const bizMenuRef = useRef<HTMLDivElement>(null);

  const [currentDate, setCurrentDate] = useState(new Date());

  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [business, setBusiness] = useState<Business | null>(null);

  const [services, setServices] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState('Calendar');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isBizMenuOpen, setIsBizMenuOpen] = useState(false);
  const [myBusinesses, setMyBusinesses] = useState<any[]>([]);

  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('day');
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [clipboardApp, setClipboardApp] = useState<any>(null);
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, app: any} | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);

  const [isApptModalOpen, setIsApptModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [isBookingDetailsModalOpen, setIsBookingDetailsModalOpen] = useState(false);

  const [apptForm, setApptForm] = useState({
    client_name: '', client_phone: '+380', service_id: '', staff_id: '', date: toLocalDateStr(new Date()), time: '10:00', block_reason: '', duration: 60, source: 'Адмін-панель'
  });

  const [filterMaster, setFilterMaster] = useState('all');
  const [isBlockMode, setIsBlockMode] = useState(false);

  const [dragConfirmData, setDragConfirmData] = useState<{app: any, targetDate: Date, newStart: string, newEnd: string} | null>(null);

  const [clientsList, setClientsList] = useState<any[]>([]);
  const [viewingClient, setViewingClient] = useState<any>(null);
  const [editingClientNotes, setEditingClientNotes] = useState('');
  const [editingClientAllergies, setEditingClientAllergies] = useState('');
  const [newClientForm, setNewClientForm] = useState({ name: '', phone: '+380', email: '' });
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [isSavingClient, setIsSavingClient] = useState(false);

  // 🟢 Змінено тип параметра bizId на number | string
  const fetchClientsFromDB = async (bizId: number | string) => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('business_id', bizId)
      .order('last_visit', { ascending: false });

    if (!error && data) {
      setClientsList(data);
    }
  };

  const handleSaveNewClient = async () => {
    if (!business) return alert("Помилка: закладу не обрано!");
    if (!newClientForm.name.trim()) return alert("Введіть ім'я клієнта!");

    let finalPhone = '';
    if (newClientForm.phone && newClientForm.phone !== '+380') {
      const phoneStripped = newClientForm.phone.replace(/\D/g, '');
      if (phoneStripped.length !== 12) {
        return alert("Некоректний номер телефону! Введіть 9 цифр після +380.");
      }
      finalPhone = '+' + phoneStripped;
    }

    const emailTrimmed = newClientForm.email.trim();
    if (emailTrimmed) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
        return alert("Некоректний формат Email (має бути щось типу: example@mail.com)!");
      }
    }

    setIsSavingClient(true);
    try {
      const safeDate = new Date().toISOString().split('T')[0];
      const newClientData = {
        business_id: business.id,
        name: newClientForm.name.trim(),
        phone: finalPhone,
        email: emailTrimmed || null,
        last_visit: safeDate,
        visits: 0,
        spent: 0,
        tags: ['Новий']
      };

      const { error: insertError } = await supabase.from('clients').insert([newClientData]);
      if (insertError) {
         const { tags, ...clientDataWithoutTags } = newClientData;
         await supabase.from('clients').insert([clientDataWithoutTags]);
      }

      await fetchClientsFromDB(business.id);
      setIsAddClientModalOpen(false);
      setNewClientForm({ name: '', phone: '+380', email: '' });
    } catch (err) {
      console.error(err);
      alert("Помилка при створенні клієнта");
    } finally {
      setIsSavingClient(false);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!confirm("Ви впевнені, що хочете назавжди видалити цього клієнта з бази? Усі його дані будуть втрачені.")) return;
    try {
      const {error} = await supabase.from('clients').delete().eq('id', clientId);
      if (error) {
        console.error("Помилка видалення клієнта:", error);
        alert("Не вдалося видалити клієнта.");
        return;
      }
      setClientsList(prev => prev.filter(c => c.id !== clientId));
      setViewingClient(null);
    } catch (err) {
      console.error("Системна помилка:", err);
      alert("Не вдалося видалити клієнта.");
    }
  };

  const handleSaveClientNotes = async () => {
    if (!viewingClient) return;
    try {
      const { error } = await supabase.from('clients').update({ notes: editingClientNotes, allergies: editingClientAllergies }).eq('id', viewingClient.id);
      if (error) {
         console.error("Помилка збереження:", error);
         alert("Не вдалося зберегти зміни.");
         return;
      }
      const updatedClients = clientsList.map(c => c.id === viewingClient.id ? { ...c, notes: editingClientNotes, allergies: editingClientAllergies } : c);
      setClientsList(updatedClients);
      setViewingClient({ ...viewingClient, notes: editingClientNotes, allergies: editingClientAllergies });
      alert("Зміни успішно збережено!");
    } catch (err) {
      console.error("Системна помилка:", err);
      alert("Не вдалося зберегти зміни.");
    }
  };

  const handleBookAgain = (client: any) => {
    setViewingClient(null);
    setApptForm({
      ...apptForm,
      client_name: client.name,
      client_phone: client.phone,
      date: toLocalDateStr(currentDate)
    });
    setIsBlockMode(false);
    setIsApptModalOpen(true);
  };

  const handleAddTag = async () => {
    if (!viewingClient) return;
    const newTag = window.prompt("Введіть новий тег (наприклад: VIP, Знижка 10%, Капризний):");
    if (!newTag || newTag.trim() === '') return;

    const currentTags = viewingClient.tags || [];
    if (currentTags.includes(newTag.trim())) return alert("Такий тег вже існує у цього клієнта!");

    const updatedTags = [...currentTags, newTag.trim()];

    try {
      await supabase.from('clients').update({ tags: updatedTags }).eq('id', viewingClient.id);
      const updatedClients = clientsList.map(c => c.id === viewingClient.id ? { ...c, tags: updatedTags } : c);
      setClientsList(updatedClients);
      setViewingClient({ ...viewingClient, tags: updatedTags });
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
     if (!confirm(`Видалити тег "${tagToRemove}"?`)) return;
     const updatedTags = viewingClient.tags.filter((t: string) => t !== tagToRemove);
     try {
        await supabase.from('clients').update({ tags: updatedTags }).eq('id', viewingClient.id);
        const updatedClients = clientsList.map(c => c.id === viewingClient.id ? { ...c, tags: updatedTags } : c);
        setClientsList(updatedClients);
        setViewingClient({ ...viewingClient, tags: updatedTags });
     } catch(err) {
        console.error(err);
     }
  };

  const getBadgeClass = (tag: string) => {
    const t = tag.toLowerCase();
    if (t.includes('vip') || t.includes('постійний')) return 'vip';
    if (t.includes('новий') || t.includes('імпорт')) return 'new';
    if (t.includes('проблемний') || t.includes('алергія')) return 'problem';
    return 'default';
  };

  const [showCalSettingsModal, setShowCalSettingsModal] = useState(false);
  const [showShiftsModal, setShowShiftsModal] = useState(false);

  const [calSettings, setCalSettings] = useState({
    defaultView: 'day',
    displayMode: 'fit',
    colorScheme: 'pastel',
    colorMode: 'master',
  });

  const [shifts, setShifts] = useState([
    { day: 'Понеділок', active: true, start: '09:00', end: '20:00' },
    { day: 'Вівторок', active: true, start: '09:00', end: '20:00' },
    { day: 'Середа', active: true, start: '09:00', end: '20:00' },
    { day: 'Четвер', active: true, start: '09:00', end: '20:00' },
    { day: 'П\'ятниця', active: true, start: '09:00', end: '20:00' },
    { day: 'Субота', active: true, start: '10:00', end: '18:00' },
    { day: 'Неділя', active: false, start: '09:00', end: '20:00' },
  ]);

  // 🟢 Змінено тип параметра bizId на number | string
  const loadSpecificBusiness = async (bizId: number | string) => {
    setLoading(true);
    try {
      let targetBiz = myBusinesses.find(b => String(b.id) === String(bizId));

      if (!targetBiz) {
        const { data } = await supabase.from('businesses').select('*').eq('id', bizId).single();
        if (data) targetBiz = data;
      }

      if (targetBiz) {
        setBusiness(targetBiz);
        localStorage.setItem('bookera_active_biz_id', String(targetBiz.id));

        if (targetBiz.cal_settings) setCalSettings(targetBiz.cal_settings);
        if (targetBiz.shifts) setShifts(targetBiz.shifts);

        const [srvsRes, mastersRes, clientsRes] = await Promise.all([
          supabase.from('services').select('*').eq('business_id', targetBiz.id).order('order_index', { ascending: true }),
          supabase.from('staff').select('*').eq('business_id', targetBiz.id),
          supabase.from('clients').select('*').eq('business_id', targetBiz.id).order('last_visit', { ascending: false })
        ]);

        setServices(srvsRes.data || []);
        setTeam(mastersRes.data || []);
        if (clientsRes.data) setClientsList(clientsRes.data);
        setFilterMaster('all');
      }
    } catch (error) {
      console.error("Помилка завантаження бізнесу:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const savedTab = localStorage.getItem('bookera_activeTab');
    if (savedTab) setActiveTab(savedTab);

    const savedView = localStorage.getItem('bookera_calendarView');
    if (savedView) setCalendarView(savedView as any);

    let isMounted = true;

    async function loadCabinetData() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          router.push('/business');
          return;
        }

        const userId = session.user.id;
        const userEmail = session.user.email;

        const [profileRes, bizRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
          supabase.from('businesses').select('*').eq('owner_id', userId)
        ]);

        if (!isMounted) return;

        const allBiz = bizRes.data || [];
        const isOwner = allBiz.length > 0;

        // 🟢 Гарантуємо наявність id та ролі vendor для власника бізнесу
        const profileData = profileRes.data || {};
        setUserProfile({
          id: userId,
          email: userEmail,
          full_name: profileData.full_name || session.user.user_metadata?.full_name || userEmail,
          role: profileData.role || (isOwner ? 'vendor' : 'client'),
          ...profileData
        });

        if (allBiz.length > 0) {
          setMyBusinesses(allBiz);

          const savedBizId = localStorage.getItem('bookera_active_biz_id');
          const targetBiz = (savedBizId && allBiz.find(b => String(b.id) === String(savedBizId)))
            ? allBiz.find(b => String(b.id) === String(savedBizId))
            : allBiz[0];

          setBusiness(targetBiz);
          localStorage.setItem('bookera_active_biz_id', String(targetBiz.id));

          if (targetBiz.cal_settings) setCalSettings(targetBiz.cal_settings);
          if (targetBiz.shifts) setShifts(targetBiz.shifts);

          const [srvsRes, mastersRes, clientsRes] = await Promise.all([
            supabase.from('services').select('*').eq('business_id', targetBiz.id).order('order_index', { ascending: true }),
            supabase.from('staff').select('*').eq('business_id', targetBiz.id),
            supabase.from('clients').select('*').eq('business_id', targetBiz.id).order('last_visit', { ascending: false })
          ]);

          if (isMounted) {
            setServices(srvsRes.data || []);
            setTeam(mastersRes.data || []);
            if (clientsRes.data) setClientsList(clientsRes.data);
          }
        }
      } catch (error) {
        console.error("Помилка завантаження даних:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void loadCabinetData();

    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    async function fetchAppointments() {
      if (!business) return;

      const y = currentDate.getFullYear();
      const m = currentDate.getMonth();

      const startFetch = new Date(y, m, 1);
      startFetch.setDate(startFetch.getDate() - 7);

      const endFetch = new Date(y, m + 1, 0);
      endFetch.setDate(endFetch.getDate() + 7);
      endFetch.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('business_id', business.id)
        .gte('booking_date', toLocalDateStr(startFetch))
        .lte('booking_date', toLocalDateStr(endFetch));

      if (!error && data) {
        const currentTime = new Date();

        const processedData = data.map(app => {
          if (app.status === 'blocked' || app.color === 'blocked') return app;
          if (app.status !== 'confirmed' && app.status !== undefined && app.status !== null) return app;

          if (app.booking_date && app.end_time && app.start_time) {
            const [year, month, day] = app.booking_date.split('-').map(Number);
            const [startH] = app.start_time.split(':').map(Number);
            let [endH, endM] = app.end_time.split(':').map(Number);

            if (endH < startH) endH += 24;

            const endDateTime = new Date(year, month - 1, day, endH, endM);

            if (currentTime > endDateTime) {
              supabase.from('bookings').update({ status: 'completed' }).eq('id', app.id).then();
              return { ...app, status: 'completed' };
            }
          }
          return app;
        });

        setAppointments(processedData);
      }
    }
    void fetchAppointments();
  }, [currentDate.getFullYear(), currentDate.getMonth(), business?.id]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
      if (bizMenuRef.current && !bizMenuRef.current.contains(event.target as Node)) {
        setIsBizMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    router.push('/business');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (activeTab === 'Calendar') {
         if (e.key === 'ArrowLeft') {
            const d = new Date(currentDate);
            if (calendarView === 'day') d.setDate(d.getDate() - 1);
            else if (calendarView === 'week') d.setDate(d.getDate() - 7);
            else d.setMonth(d.getMonth() - 1);
            setCurrentDate(d);
         } else if (e.key === 'ArrowRight') {
            const d = new Date(currentDate);
            if (calendarView === 'day') d.setDate(d.getDate() + 1);
            else if (calendarView === 'week') d.setDate(d.getDate() + 7);
            else d.setMonth(d.getMonth() + 1);
            setCurrentDate(d);
         } else if (e.code === 'KeyD') {
            setCalendarView('day'); localStorage.setItem('bookera_calendarView', 'day');
         } else if (e.code === 'KeyW') {
            setCalendarView('week'); localStorage.setItem('bookera_calendarView', 'week');
         } else if (e.code === 'KeyM') {
            setCalendarView('month'); localStorage.setItem('bookera_calendarView', 'month');
         } else if (e.code === 'KeyN') {
            setApptForm({ client_name: '', client_phone: '+380', service_id: '', staff_id: filterMaster !== 'all' ? filterMaster : '', date: toLocalDateStr(currentDate), time: '10:00', block_reason: '', duration: 60, source: 'Адмін-панель' });
            setIsBlockMode(false); setIsApptModalOpen(true);
         }
      }

      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyK') {
         e.preventDefault();
         setIsGlobalSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentDate, calendarView, activeTab, filterMaster]);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    document.addEventListener("click", closeMenu);
    document.addEventListener("contextmenu", closeMenu);
    return () => {
      document.removeEventListener("click", closeMenu);
      document.removeEventListener("contextmenu", closeMenu);
    };
  }, []);

  const handleSaveShifts = async () => {
    if (business) {
      await supabase.from('businesses').update({ shifts: shifts }).eq('id', business.id);
    }
    setShowShiftsModal(false);
  };

  const handleSaveAppointment = async () => {
    if (!business) return alert("Помилка: бізнес не обрано.");

    let finalPhone = '';
    if (!isBlockMode && apptForm.client_phone && apptForm.client_phone !== '+380') {
      const phoneStripped = apptForm.client_phone.replace(/\D/g, '');
      if (phoneStripped.length !== 12) {
        return alert("Некоректний номер телефону! Введіть 9 цифр після +380.");
      }
      finalPhone = '+' + phoneStripped;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return alert("Помилка: Ви не авторизовані (сесія відсутня).");

      const selectedService = services.find(s => String(s.id) === String(apptForm.service_id));
      if (!isBlockMode && !selectedService) return alert("Оберіть існуючу послугу.");

      const [hours, minutes] = apptForm.time.split(':').map(Number);
      const startDateTime = new Date(1970, 0, 1, hours, minutes);
      const endDateTime = new Date(startDateTime.getTime() + (isBlockMode ? apptForm.duration : selectedService.duration) * 60000);

      const startTimeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
      const endTimeStr = `${endDateTime.getHours().toString().padStart(2, '0')}:${endDateTime.getMinutes().toString().padStart(2, '0')}:00`;

      const bookingData = isBlockMode
      ? {
          business_id: business.id,
          staff_id: apptForm.staff_id || null,
          service_id: null,
          client_name: 'Неробочий час',
          client_phone: '0000000000',
          client_email: null,
          booking_date: apptForm.date,
          start_time: startTimeStr,
          end_time: endTimeStr,
          status: 'blocked'
        }
      : {
          business_id: business.id,
          staff_id: apptForm.staff_id || null,
          service_id: apptForm.service_id,
          client_name: apptForm.client_name,
          client_phone: finalPhone,
          client_email: null,
          booking_date: apptForm.date,
          start_time: startTimeStr,
          end_time: endTimeStr,
          status: 'confirmed',
          source: apptForm.source
        };

      const { data, error } = await supabase.from('bookings').insert([bookingData]).select().single();

      if (error) {
        console.error("Деталі помилки Supabase:", error);
        alert(`Помилка бази даних: ${error.message}`);
      } else if (data) {

        if (!isBlockMode) {
          const servicePrice = selectedService ? selectedService.price : 0;
          const name = apptForm.client_name?.trim() || 'Невідомий';
          const safeDate = apptForm.date ? apptForm.date.substring(0, 10) : new Date().toISOString().split('T')[0];

          try {
            let existingClient = null;
            if (finalPhone !== '') {
              const { data } = await supabase.from('clients').select('*').eq('business_id', business.id).eq('phone', finalPhone).limit(1);
              if (data && data.length > 0) existingClient = data[0];
            }
            if (!existingClient && name !== 'Невідомий') {
              const { data } = await supabase.from('clients').select('*').eq('business_id', business.id).eq('name', name).limit(1);
              if (data && data.length > 0) existingClient = data[0];
            }

            if (existingClient) {
              await supabase.from('clients').update({
                last_visit: safeDate,
                visits: (existingClient.visits || 0) + 1,
                spent: (existingClient.spent || 0) + servicePrice,
                phone: existingClient.phone || finalPhone
              }).eq('id', existingClient.id);
            } else {
              const { error: insertError } = await supabase.from('clients').insert([{
                business_id: business.id,
                name: name,
                phone: finalPhone,
                last_visit: safeDate,
                visits: 1,
                spent: servicePrice,
                source: apptForm.source
              }]);
              if (insertError) console.error("Деталі помилки Supabase:", insertError);
            }
            await fetchClientsFromDB(business.id);
          } catch (syncErr) {
            console.error("Помилка коду при синхронізації клієнта:", syncErr);
          }
        }
        setAppointments([...appointments, data]);
        setIsApptModalOpen(false);
        setApptForm({ client_name: '', client_phone: '+380', service_id: '', staff_id: '', date: toLocalDateStr(currentDate), time: '10:00', block_reason: '', duration: 60, source: 'Адмін-панель' });
        setIsBlockMode(false);
      }
    } catch (err: any) {
      console.error("Системна помилка створення запису:", err);
      alert(`Критична помилка: ${err.message || 'Невідома помилка'}`);
    }
  };

  const handleUpdateBookingStatus = async (newStatus: string, appToUpdate: any = selectedBooking) => {
    if (!appToUpdate) return;
    const finalStatus = appToUpdate.status === newStatus ? 'confirmed' : newStatus;

    try {
      const { error } = await supabase.from('bookings').update({ status: finalStatus }).eq('id', appToUpdate.id);
      if (error) {
         console.error(error);
         alert("Помилка при оновленні статусу запису.");
         return;
      }
      setAppointments(prev => prev.map(app => app.id === appToUpdate.id ? { ...app, status: finalStatus } : app));
      if (selectedBooking && selectedBooking.id === appToUpdate.id) {
         setSelectedBooking({ ...selectedBooking, status: finalStatus });
      }
    } catch (err) {
      console.error(err);
      alert("Системна помилка при оновленні статусу запису.");
    }
  };

  const getUserInitials = (name: string) => {
    if (!name) return 'В';
    const parts = name.split(' ');
    return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0][0].toUpperCase();
  };

  const confirmDragDrop = async () => {
    if (!dragConfirmData) return;
    const { app, targetDate, newStart, newEnd } = dragConfirmData;
    const newDateStr = toLocalDateStr(targetDate);

    let newStatus = app.status;
    if (newDateStr === app.booking_date && newStart > app.start_time && app.status !== 'completed') {
       newStatus = 'late';
    }

    setAppointments(prev => prev.map(a =>
       String(a.id) === String(app.id)
       ? { ...a, booking_date: newDateStr, start_time: newStart, end_time: newEnd, status: newStatus }
       : a
    ));
    setDragConfirmData(null);

    if (business) {
       await supabase.from('bookings').update({ booking_date: newDateStr, start_time: newStart, end_time: newEnd, status: newStatus }).eq('id', app.id);
    }
  };

  const handleUpdateBookingTime = async (newStartTime: string) => {
     if (!selectedBooking || !newStartTime || newStartTime.length !== 5 || !newStartTime.includes(':')) return;

     const [h, m] = newStartTime.split(':').map(Number);
     if (isNaN(h) || isNaN(m)) return;

     const [oldStartH, oldStartM] = selectedBooking.start_time.split(':').map(Number);
     const [oldEndH, oldEndM] = selectedBooking.end_time.split(':').map(Number);

     let duration = (oldEndH * 60 + oldEndM) - (oldStartH * 60 + oldStartM);
     if (duration < 0) duration += 24 * 60;

     if (isNaN(duration) || duration <= 0) {
        const srv = services.find(s => String(s.id) === String(selectedBooking.service_id));
        duration = srv ? srv.duration : 60;
     }

     const totalEnd = h * 60 + m + duration;
     const newEndStr = `${String(Math.floor(totalEnd / 60) % 24).padStart(2, '0')}:${String(totalEnd % 60).padStart(2, '0')}:00`;
     const newStartStr = `${newStartTime}:00`;

     let newStatus = selectedBooking.status;
     if (newStartStr > selectedBooking.start_time && selectedBooking.status !== 'completed') newStatus = 'late';

     const updatedApp = { ...selectedBooking, start_time: newStartStr, end_time: newEndStr, status: newStatus };

     setSelectedBooking(updatedApp);
     setAppointments(prev => prev.map(a => a.id === updatedApp.id ? updatedApp : a));

     if (business) {
       await supabase.from('bookings').update({ start_time: newStartStr, end_time: newEndStr, status: newStatus }).eq('id', updatedApp.id);
     }
  };

  const handleCancelBooking = async () => {
    if (!selectedBooking) return;
    const isBlock = selectedBooking.status === 'blocked' || selectedBooking.color === 'blocked';

    if (!confirm(`Ви впевнені, що хочете скасувати ${isBlock ? 'цю перерву' : 'цей запис'}?`)) return;

    try {
      const { error } = await supabase.from('bookings').delete().eq('id', selectedBooking.id);
      if (error) {
         console.error(error);
         alert("Помилка при скасуванні. Перевірте консоль.");
         return;
      }
      setAppointments(prev => prev.filter(a => a.id !== selectedBooking.id));
      setIsBookingDetailsModalOpen(false);
      setSelectedBooking(null);
    } catch (err) {
      console.error(err);
      alert("Системна помилка при скасуванні.");
    }
  };

  const averageTicketPrice = useMemo(() => {
    if (!services || services.length === 0) return 500;
    const total = services.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
    return Math.round(total / services.length);
  }, [services]);

  const marketingStats = useMemo(() => {
    const totalIncome = clientsList.reduce((sum, c) => sum + (Number(c.spent) || 0), 0);
    const marketingIncome = totalIncome * 0.15;
    const returned = clientsList.filter(c => c.visits > 1).length;
    const clientsWithPhone = clientsList.filter(c => c.phone && c.phone.length > 5).length;
    const phonePercentage = clientsList.length > 0 ? Math.round((clientsWithPhone / clientsList.length) * 100) : 0;

    return {
      income: Math.round(marketingIncome),
      incomeTrend: 0,
      returnedClients: returned,
      returnedTrend: 0,
      openRate: phonePercentage,
      openRateTrend: clientsWithPhone
    };
  }, [clientsList]);

  const availableSlots = useMemo(() => {
    const slots = [];
    const today = new Date();

    const timeToMins = (timeStr: string) => {
      if (!timeStr) return 0;
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    const minsToTime = (mins: number) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    for (let i = 1; i <= 4; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      const dateStr = targetDate.toISOString().split('T')[0];
      const dayOfWeek = targetDate.getDay() === 0 ? 6 : targetDate.getDay() - 1;

      const shift = shifts[dayOfWeek];
      if (!shift || !shift.active) continue;

      const dayApps = appointments
        .filter(a => a.booking_date === dateStr && a.status !== 'blocked')
        .sort((a, b) => a.start_time.localeCompare(b.start_time));

      const formattedDate = targetDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
      const dayName = targetDate.toLocaleDateString('uk-UA', { weekday: 'long' });

      if (i === 1 && dayApps.length <= 1) {
        slots.push({
          id: `urgent-${dateStr}`, date: formattedDate, time: `${shift.start.substring(0,5)} - ${shift.end.substring(0,5)}`,
          type: 'urgent', title: 'Критичний спад завантаження', insight: 'На завтра майже немає записів. Рекомендуємо запустити розсилку по базі "Втрачені клієнти", щоб швидко заповнити розклад.',
          suggestedPromo: 15, audience: 'lost'
        });
        continue;
      }

      if (dayApps.length >= 2) {
        let foundGap = false;
        for (let j = 0; j < dayApps.length - 1; j++) {
          const endMins1 = timeToMins(dayApps[j].end_time);
          const startMins2 = timeToMins(dayApps[j+1].start_time);
          const gapMins = startMins2 - endMins1;

          if (gapMins >= 60 && gapMins <= 120) {
            slots.push({
              id: `gap-${dateStr}-${j}`, date: formattedDate, time: `${minsToTime(endMins1)} - ${minsToTime(startMins2)}`,
              type: 'gap', title: 'Вікно між записами', insight: `Зʼявилося ідеальне вікно (${gapMins} хв) між щільними записами. Запропонуйте цей час VIP-клієнтам для швидкої послуги.`,
              suggestedPromo: 0, audience: 'vip'
            });
            foundGap = true;
            break;
          }
        }
        if (foundGap) continue;
      }

      if (dayApps.length > 0) {
        const firstAppStart = timeToMins(dayApps[0].start_time);
        const shiftStart = timeToMins(shift.start);
        if (firstAppStart >= timeToMins("13:00:00") && shiftStart < timeToMins("11:00:00")) {
          slots.push({
            id: `lull-${dateStr}`, date: formattedDate, time: `${shift.start.substring(0,5)} - 13:00`,
            type: 'lull', title: `Низьке завантаження (${dayName})`, insight: 'Ранкові години абсолютно вільні. Запустіть акцію "Щасливі години", щоб залучити клієнтів з гнучким графіком.',
            suggestedPromo: 10, audience: 'all'
          });
        }
      }
    }
    return slots.slice(0, 3);
  }, [appointments, shifts]);

  if (loading) {
    const renderTabSkeleton = () => {
      switch (activeTab) {
        case 'Calendar':
          return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="skel-bg" style={{ width: '260px', height: '36px', borderRadius: '10px' }}></div>
                <div className="skel-bg" style={{ width: '180px', height: '36px', borderRadius: '10px' }}></div>
              </div>
              <div style={{ display: 'flex', gap: '2.5rem', flex: 1 }}>
                <div className="skel-bg" style={{ width: '280px', borderRadius: '16px' }}></div>
                <div className="skel-bg" style={{ flex: 1, borderRadius: '16px' }}></div>
              </div>
            </div>
          );
        case 'Stats':
          return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '2.5rem' }}>
              <div style={{ display: 'flex', gap: '2.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
                {[1, 2, 3, 4].map(i => <div key={i} className="skel-bg" style={{ width: '80px', height: '14px', borderRadius: '6px' }}></div>)}
              </div>
              <div style={{ display: 'flex', gap: '2.5rem', flex: 1 }}>
                <div className="skel-bg" style={{ flex: 1, borderRadius: '16px', minHeight: '500px' }}></div>
                <div style={{ width: '340px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                   <div className="skel-bg" style={{ width: '100%', height: '140px', borderRadius: '16px' }}></div>
                   <div className="skel-bg" style={{ width: '100%', height: '220px', borderRadius: '16px' }}></div>
                   <div className="skel-bg" style={{ width: '100%', height: '260px', borderRadius: '16px' }}></div>
                </div>
              </div>
            </div>
          );
        case 'Clients':
          return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2.5rem', marginTop: '0.5rem' }}>
                 <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="skel-bg" style={{ width: '60px', height: '36px', borderRadius: '20px' }}></div>
                    <div className="skel-bg" style={{ width: '60px', height: '36px', borderRadius: '20px' }}></div>
                 </div>
                 <div className="skel-bg" style={{ width: '280px', height: '44px', borderRadius: '10px' }}></div>
              </div>
              <div className="skel-bg" style={{ width: '100%', height: '50px', borderRadius: '12px 12px 0 0', marginBottom: '4px' }}></div>
              {[1, 2, 3, 4, 5, 6, 7].map(i => <div key={i} className="skel-bg" style={{ width: '100%', height: '65px', marginBottom: '4px', borderRadius: '4px' }}></div>)}
            </div>
          );
        case 'Services':
        case 'Inventory':
        case 'Team':
          return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '2.5rem', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                 <div className="skel-bg" style={{ width: '300px', height: '40px', borderRadius: '12px' }}></div>
              </div>
              <div style={{ display: 'flex', gap: '2.5rem', flex: 1 }}>
                <div style={{ flex: 1 }}>
                   <div className="skel-bg" style={{ width: '100%', height: '50px', borderRadius: '12px 12px 0 0', marginBottom: '4px' }}></div>
                   {[1, 2, 3, 4, 5].map(i => <div key={i} className="skel-bg" style={{ width: '100%', height: '70px', marginBottom: '4px', borderRadius: '4px' }}></div>)}
                </div>
                <div style={{ width: '340px', display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '4rem' }}>
                   <div className="skel-bg" style={{ width: '100%', height: '150px', borderRadius: '16px' }}></div>
                   <div className="skel-bg" style={{ width: '100%', height: '200px', borderRadius: '16px' }}></div>
                </div>
              </div>
            </div>
          );
        default:
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div className="skel-bg" style={{ width: '280px', height: '40px', borderRadius: '10px' }}></div>
              <div className="skel-bg" style={{ width: '100%', height: '450px', borderRadius: '16px' }}></div>
            </div>
          );
      }
    };

    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#fafafa', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <style>{`
          @keyframes pulse-skel {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
          .skel-bg { background-color: #e2e8f0; animation: pulse-skel 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; border-radius: 8px; }
        `}</style>
        <aside style={{ width: isSidebarCollapsed ? '80px' : '260px', backgroundColor: '#ffffff', borderRight: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', padding: '1rem', flexShrink: 0, transition: 'width 0.3s' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start', gap: '0.75rem', marginBottom: '2.5rem', padding: '0.5rem' }}>
            <div className="skel-bg" style={{ width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0 }}></div>
            {!isSidebarCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div className="skel-bg" style={{ width: '110px', height: '14px' }}></div>
                <div className="skel-bg" style={{ width: '70px', height: '10px' }}></div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: isSidebarCollapsed ? '0.75rem 0' : '0.6rem 0.8rem', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start' }}>
                <div className="skel-bg" style={{ width: '20px', height: '20px', borderRadius: '4px', flexShrink: 0 }}></div>
                {!isSidebarCollapsed && <div className="skel-bg" style={{ width: '120px', height: '14px' }}></div>}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start', gap: '0.75rem', padding: '0.5rem' }}>
            <div className="skel-bg" style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0 }}></div>
            {!isSidebarCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div className="skel-bg" style={{ width: '90px', height: '12px' }}></div>
                <div className="skel-bg" style={{ width: '50px', height: '10px' }}></div>
              </div>
            )}
          </div>
        </aside>

        <main style={{ flex: 1, padding: '2rem 3rem', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {renderTabSkeleton()}
        </main>
      </div>
    );
  }

  if (!business) {
    return (
      <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: '800', color: '#0f172a', marginBottom: '1rem' }}>Немає активних закладів</h2>
        <button onClick={() => router.push('/business/register')} style={{ padding: '1rem 2rem', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Створити бізнес</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#fafafa', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        /* 🟢 ДОДАНО: Приховані скроли для Apple-style сайдбару */
        .apple-sidebar-nav::-webkit-scrollbar { display: none; }
        .apple-sidebar-nav { -ms-overflow-style: none; scrollbar-width: none; }

        /* 🟢 ДОДАНО: Стилі для крутих тултипів при згорнутому сайдбарі */
        .nav-item-wrapper .nav-tooltip {
           position: absolute;
           left: calc(100% + 15px);
           top: 50%;
           transform: translateY(-50%) translateX(10px);
           background: #0f172a;
           color: #fff;
           padding: 0.5rem 0.8rem;
           border-radius: 8px;
           font-size: 0.8rem;
           font-weight: 600;
           opacity: 0;
           visibility: hidden;
           transition: all 0.2s cubic-bezier(0.25, 1, 0.5, 1);
           z-index: 1000;
           white-space: nowrap;
           box-shadow: 0 4px 12px rgba(15,23,42,0.15);
           pointer-events: none;
        }
        .nav-item-wrapper .nav-tooltip::before {
           content: '';
           position: absolute;
           top: 50%;
           left: -5px;
           transform: translateY(-50%);
           border-width: 6px 6px 6px 0;
           border-style: solid;
           border-color: transparent #0f172a transparent transparent;
        }
        .nav-item-wrapper:hover .nav-tooltip {
           opacity: 1;
           visibility: visible;
           transform: translateY(-50%) translateX(0);
        }

        .cal-app-card { transition: top 0.3s cubic-bezier(0.25, 1, 0.5, 1), left 0.3s cubic-bezier(0.25, 1, 0.5, 1), height 0.3s ease; }
        .cal-app-card:active { transform: scale(0.98); opacity: 0.9; transition: transform 0.1s; }
        @keyframes fadeSlide { from { opacity: 0; transform: translateX(10px); } to { opacity: 1; transform: translateX(0); } }
        .animated-calendar { animation: fadeSlide 0.3s ease-out; }
        .custom-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .menu-popup { animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        .editable-block { position: relative; border-radius: 16px; transition: all 0.2s; border: 2px dashed transparent; }
        .editable-block:hover { border-color: #3b82f6; }
        .edit-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(59, 130, 246, 0.05); display: flex; align-items: center; justify-content: center; opacity: 0; transition: 0.2s; z-index: 10; border-radius: 14px; cursor: pointer; }
        .editable-block:hover .edit-overlay { opacity: 1; }
        .edit-btn { background: #3b82f6; color: #fff; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 600; border: none; display: flex; gap: 0.5rem; align-items: center; box-shadow: 0 4px 12px rgba(59,130,246,0.3); font-size: 0.9rem; cursor: pointer; }
        .edit-btn:hover { background: #2563eb; transform: scale(1.05); transition: 0.2s; }

        .inline-input { border: 1px dashed transparent; background: transparent; font-family: inherit; transition: all 0.2s; border-radius: 6px; }
        .inline-input:hover { border-color: #94a3b8; background: rgba(241, 245, 249, 0.5); }
        .inline-input:focus { border-color: #3b82f6; background: #fff; outline: none; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }

        .client-dark-btn { background-color: #0f172a; color: #ffffff; font-weight: 700; border: none; padding: 0.85rem 1.75rem; border-radius: 10px; cursor: pointer; transition: 0.2s; }
        .client-dark-btn:hover { background-color: #1e293b; }
        .client-white-card { background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.5rem; box-shadow: 0 4px 20px rgba(0,0,0,0.02); }

        .service-list-item { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem 1rem 0.5rem; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; transition: all 0.2s cubic-bezier(0.25, 1, 0.5, 1); }
        .service-list-item:hover { border-color: #cbd5e1; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
        .service-list-item.dragging { opacity: 0.4; transform: scale(0.98); border: 2px dashed #94a3b8; }
        .service-list-item.drag-over { border-top: 4px solid #0f172a; transform: translateY(4px); }

        .drag-handle { color: #cbd5e1; display: flex; align-items: center; justify-content: center; transition: 0.2s; margin-right: 0.5rem; }
        .drag-handle.active { cursor: grab; }
        .drag-handle.active:hover { color: #0f172a; }
        .drag-handle.active:active { cursor: grabbing; color: #0f172a; }
        .drag-handle.disabled { opacity: 0; cursor: default; width: 0; margin: 0; overflow: hidden; }

        .action-icon-btn { background: transparent; border: none; color: #94a3b8; cursor: pointer; padding: 0.4rem; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .action-icon-btn:hover { background: #f1f5f9; color: #0f172a; }
        .action-icon-btn.delete:hover { background: #fef2f2; color: #ef4444; }

        .search-input { width: 100%; padding: 0.75rem 1rem 0.75rem 2.5rem; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 0.95rem; outline: none; transition: 0.2s; background: #f8fafc; color: #0f172a; font-family: inherit; }
        .search-input:focus { background: #fff; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }

        .custom-select-trigger { width: 100%; padding: 0.75rem 1rem; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 0.95rem; background: #f8fafc; color: #0f172a; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: 0.2s; font-weight: 500; }
        .custom-select-trigger:hover { background: #f1f5f9; border-color: #cbd5e1; }
        .custom-select-dropdown { position: absolute; top: calc(100% + 4px); left: 0; width: 100%; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); z-index: 50; overflow: hidden; animation: slideUp 0.2s ease; }
        .custom-select-option { padding: 0.75rem 1rem; display: flex; align-items: center; gap: 0.75rem; font-size: 0.9rem; color: #475569; cursor: pointer; transition: 0.2s; font-weight: 500; }
        .custom-select-option:hover { background: #f8fafc; color: #0f172a; }
        .custom-select-option.selected { background: #f1f5f9; color: #0f172a; font-weight: 600; }

        .tag-pill { background: #f1f5f9; color: #475569; padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: 0.2s; border: 1px solid transparent; }
        .tag-pill:hover { background: #e2e8f0; color: #0f172a; }

        .modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15,23,42,0.4); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 1000; overflow-y: auto; padding: 2rem 0; }
        .modal-content { background: #fff; width: 100%; max-width: 480px; border-radius: 20px; padding: 2rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); margin: auto; }
        .modal-input { width: 100%; padding: 0.8rem 1rem; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 0.95rem; outline: none; transition: 0.2s; background: #fff; color: #0f172a; font-family: inherit; }
        .modal-input:focus { border-color: #0f172a; box-shadow: 0 0 0 2px rgba(15,23,42,0.1); }
        .modal-label { display: block; font-size: 0.85rem; font-weight: 700; color: #475569; margin-bottom: 0.4rem; }

        /* Стилі для Календаря */
        .cal-sidebar { width: 280px; display: flex; flexDirection: column; gap: 1.5rem; flexShrink: 0; }
        .cal-mini-day { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; border-radius: 50%; cursor: pointer; transition: 0.2s; color: #475569; }
        .cal-mini-day:hover { background: #f1f5f9; }
        .cal-mini-day.selected { background: #0f172a; color: #fff; font-weight: 700; }
        
        .cal-grid-row { display: flex; border-bottom: 1px dashed #e2e8f0; position: relative; cursor: pointer; transition: background-color 0.2s; -webkit-tap-highlight-color: transparent; user-select: none; }
        .cal-grid-row:hover { background-color: #f8fafc; }
        .cal-grid-row:active { background-color: #f1f5f9; transition: none; }
        
        .cal-week-cell { height: 60px; border-bottom: 1px solid #f1f5f9; cursor: pointer; position: relative; z-index: 1; transition: background-color 0.2s; -webkit-tap-highlight-color: transparent; user-select: none; }
        .cal-week-cell:hover { background-color: #f8fafc; }
        .cal-week-cell:active { background-color: #f1f5f9; transition: none; }

        .month-view-cell { border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 0.5rem; cursor: pointer; transition: background-color 0.2s; background-color: #ffffff; position: relative; -webkit-tap-highlight-color: transparent; user-select: none; }
        .month-view-cell:hover { background-color: #f8fafc; }
        .month-view-cell:active { background-color: #f1f5f9; transition: none; }
        
        .cal-time-col { width: 60px; padding: 0.5rem; font-size: 0.8rem; color: #94a3b8; font-weight: 500; text-align: right; border-right: 1px solid #e2e8f0; flex-shrink: 0; position: relative; z-index: 10; background: #ffffff !important; }
        
        /* Стилі статусів візиту */
        .cal-app-card.status-completed { opacity: 0.6; }
        .cal-app-card.status-no-show { background-color: #fee2e2 !important; border-color: #ef4444 !important; color: #991b1b !important; opacity: 0.8; text-decoration: line-through; border-left-color: #ef4444 !important; }
        .cal-app-card.status-late { border-left-color: #f59e0b !important; border-left-width: 6px !important; }
        
        /* 🟩 ІДЕАЛЬНА ШТРИХОВКА для неробочих годин */
        .non-working-bg {
          background-image: repeating-linear-gradient(
            45deg,
            #ffffff,
            #ffffff 10px,
            #f1f5f9 10px,
            #f1f5f9 20px
          ) !important;
          background-color: #ffffff !important;
        }

        .week-day-header { flex: 1; text-align: center; padding: 0.5rem; cursor: pointer; border-left: 1px solid #e2e8f0; transition: 0.2s; overflow: hidden; position: relative; z-index: 10; }
        .week-day-header:hover { background-color: #f1f5f9; }

        .fab-button { position: fixed; bottom: 2rem; right: 3rem; width: 60px; height: 60px; border-radius: 50%; background: #0f172a; color: #fff; border: none; box-shadow: 0 10px 20px rgba(15,23,42,0.3); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.3s; z-index: 50; }
        .fab-button:hover { transform: translateY(-4px); box-shadow: 0 15px 25px rgba(15,23,42,0.4); }
        .quick-add-hint { opacity: 0; transition: 0.2s; color: #94a3b8; font-size: 0.85rem; position: absolute; right: 20px; top: 50%; transform: translateY(-50%); pointer-events: none; display: flex; align-items: center; gap: 0.3rem; }
        .cal-grid-row:hover .quick-add-hint { opacity: 1; }

        /* Стилі для кастомних select у модалці */
        .modal-select-wrapper { position: relative; }
        .modal-select-wrapper select {
          appearance: none; -webkit-appearance: none; width: 100%;
          padding: 0.8rem 2.5rem 0.8rem 1rem; border: 1px solid #cbd5e1;
          border-radius: 10px; font-size: 0.95rem; background-color: #fff;
          color: #0f172a; font-family: inherit; cursor: pointer; transition: 0.2s;
        }
        .modal-select-wrapper select:focus {
          border-color: #0f172a; box-shadow: 0 0 0 2px rgba(15,23,42,0.1); outline: none;
        }
        .modal-select-icon {
          position: absolute; right: 1rem; top: 50%; transform: translateY(-50%);
          pointer-events: none; color: #64748b;
        }

        /* Стилі для фото-менеджера */
        .photo-upload-card {
            border: 2px dashed #cbd5e1;
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #94a3b8;
            cursor: pointer;
            transition: 0.2s;
            background: #f8fafc;
            position: relative;
            overflow: hidden;
        }
        .photo-upload-card:hover {
            border-color: #3b82f6;
            background: #eff6ff;
            color: #3b82f6;
        }
        .photo-remove-btn {
            position: absolute; top: 0.5rem; right: 0.5rem; background: rgba(15, 23, 42, 0.7); color: #fff; border: none; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0; transition: 0.2s;
        }
        .photo-upload-card:hover .photo-remove-btn { opacity: 1; }
        
        /* --- СТИЛІ ДЛЯ ТАБЛИЦІ КЛІЄНТІВ --- */
        .client-table { width: 100%; border-collapse: separate; border-spacing: 0; }
        .client-table th { text-align: left; padding: 1.2rem 1.5rem; color: #64748b; font-weight: 700; font-size: 0.85rem; border-bottom: 2px solid #e2e8f0; text-transform: uppercase; letter-spacing: 0.05em; background: #fff; position: sticky; top: 0; z-index: 10; }
        .client-table td { padding: 1.2rem 1.5rem; color: #0f172a; font-size: 0.95rem; border-bottom: 1px solid #f1f5f9; background: #fff; transition: 0.2s; }
        .client-table tr { cursor: pointer; transition: 0.2s; }
        .client-table tr:hover td { background: #f8fafc; }
        .status-badge { padding: 0.3rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700; display: inline-block; white-space: nowrap; }
        .status-badge.vip { background: #fef08a; color: #854d0e; }
        .status-badge.new { background: #dcfce7; color: #166534; }
        .status-badge.problem { background: #fee2e2; color: #991b1b; }
        .status-badge.default { background: #f1f5f9; color: #475569; }
      `}</style>


      {/* 🔴 САЙДБАР (Світлий, повітряний Apple/SaaS Стиль) */}
      <aside style={{ width: isSidebarCollapsed ? '88px' : '280px', backgroundColor: '#ffffff', borderRight: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', flexShrink: 0, transition: 'width 0.3s cubic-bezier(0.25, 1, 0.5, 1)', zIndex: 100 }}>

        {/* 1. ВИБІР БІЗНЕСУ */}
        <div style={{ position: 'relative', padding: isSidebarCollapsed ? '1rem 0' : '1rem' }} ref={bizMenuRef}>
          <div
            onClick={() => setIsBizMenuOpen(!isBizMenuOpen)}
            style={{
              backgroundColor: isBizMenuOpen ? '#f8fafc' : 'transparent',
              borderRadius: '12px',
              padding: isSidebarCollapsed ? '0' : '0.6rem 0.8rem',
              width: isSidebarCollapsed ? '44px' : '100%',
              height: isSidebarCollapsed ? '44px' : 'auto',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
              cursor: 'pointer',
              transition: 'all 0.2s',
              position: 'relative',
              zIndex: 51
            }}
            onMouseOver={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
            onMouseOut={e => { if (!isBizMenuOpen) e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: isSidebarCollapsed ? '0' : '0.75rem', justifyContent: 'center' }}>
              <div style={{ flexShrink: 0, width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: '800', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                {business?.logo ? <img src={business.logo} alt="Лого" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : business?.name?.charAt(0).toUpperCase() || 'B'}
              </div>
              <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', opacity: isSidebarCollapsed ? 0 : 1, width: isSidebarCollapsed ? 0 : '130px', transform: isSidebarCollapsed ? 'translateX(-10px)' : 'translateX(0)', transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)' }}>
                <div style={{ color: '#0f172a', fontSize: '1rem', fontWeight: '700', textOverflow: 'ellipsis', overflow: 'hidden' }}>{business?.name || 'Завантаження'}</div><div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: '500' }}>{userProfile?.role === 'vendor' ? 'Pro Plan' : 'Майстер'}</div>
              </div>
            </div>
            <div style={{ color: '#94a3b8', flexShrink: 0, opacity: isSidebarCollapsed ? 0 : 1, width: isSidebarCollapsed ? 0 : 'auto', overflow: 'hidden', transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)', transform: isBizMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <Icons.ChevronDown />
            </div>
          </div>

          {isBizMenuOpen && (
            <div className="menu-popup" style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: isSidebarCollapsed ? 'calc(100% + 10px)' : '1rem', right: isSidebarCollapsed ? 'auto' : '1rem', width: isSidebarCollapsed ? '240px' : 'calc(100% - 2rem)',
              backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '0.5rem', boxShadow: '0 12px 40px rgba(0,0,0,0.08)', zIndex: 200
            }}>
              <div style={{ padding: '0.4rem 0.8rem 0.6rem 0.8rem', fontSize: '0.7rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ваші заклади</div>
              {myBusinesses.map(biz => {
                const isActive = business?.id === biz.id;
                return (
                  <button
                    key={biz.id}
                    onClick={() => { setIsBizMenuOpen(false); if (!isActive) void loadSpecificBusiness(biz.id); }}
                    style={{ width: '100%', padding: '0.6rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.75rem', background: isActive ? '#f8fafc' : 'transparent', border: 'none', color: '#0f172a', fontSize: '0.9rem', cursor: 'pointer', borderRadius: '10px', textAlign: 'left', transition: '0.2s', marginBottom: '0.2rem' }}
                    onMouseOver={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                    onMouseOut={e => e.currentTarget.style.backgroundColor = isActive ? '#f8fafc' : 'transparent'}
                  >
                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: biz.logo ? 'transparent' : (isActive ? '#0f172a' : '#f1f5f9'), color: isActive ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '700', flexShrink: 0, overflow: 'hidden' }}>
                      {biz.logo ? <img src={biz.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : biz.name?.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontWeight: isActive ? '700' : '500', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{biz.name}</span>
                    {isActive && <div style={{ color: '#0f172a' }}><Icons.CheckCircle /></div>}
                  </button>
                )
              })}
              <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '0.4rem 0' }}></div>
              <button
                onClick={() => router.push('/business/register')}
                style={{ width: '100%', padding: '0.6rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'transparent', border: 'none', color: '#475569', fontSize: '0.9rem', cursor: 'pointer', borderRadius: '10px', transition: '0.2s', textAlign: 'left', fontWeight: '600' }}
                onMouseOver={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.color = '#0f172a'; }}
                onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#475569'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', background: '#f1f5f9', borderRadius: '6px' }}><Icons.Plus /></div>
                Створити заклад
              </button>
            </div>
          )}
        </div>

        {/* 2. НАВІГАЦІЯ (Apple Style: прихований скрол, ідеальні квадрати при згорнутому меню) */}
        <nav className="apple-sidebar-nav" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: isSidebarCollapsed ? '0 0.5rem' : '0 0.75rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {!isSidebarCollapsed && <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase', padding: '0.5rem 0.8rem', marginTop: '0.5rem' }}>Робоче середовище</div>}

          {navItems
            .filter(item => {
              const role = userProfile?.role;
              // ✂️ Для майстра показуємо лише робочі вкладки
              if (role === 'master') {
                return ['Calendar', 'Clients', 'Services', 'Team'].includes(item.id);
              }
              // 👔 Для адміністратора приховуємо системні налаштування
              if (role === 'admin') {
                return ['Calendar', 'Clients', 'Services', 'Team', 'Inventory', 'Stats'].includes(item.id);
              }
              // 👑 Власник (owner / vendor) бачить усі вкладки
              return true;
            })
            .map(item => {
            const isActive = activeTab === item.id;
            return (
              <div key={item.id} className="nav-item-wrapper" style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={() => { setActiveTab(item.id); localStorage.setItem('bookera_activeTab', item.id); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                    width: isSidebarCollapsed ? '44px' : '100%',
                    height: isSidebarCollapsed ? '44px' : 'auto',
                    padding: isSidebarCollapsed ? '0' : '0.6rem 0.8rem',
                    backgroundColor: isActive ? '#f1f5f9' : 'transparent',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    color: isActive ? '#0f172a' : '#64748b',
                    transition: 'all 0.2s ease',
                    textAlign: 'left'
                  }}
                  onMouseOver={e => { if (!isActive) { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.color = '#0f172a'; } }}
                  onMouseOut={e => { if (!isActive) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#64748b'; } }}
                >
                  <div style={{ flexShrink: 0, color: isActive ? '#0f172a' : '#94a3b8', display: 'flex', transition: '0.2s' }}>
                    <item.icon />
                  </div>
                  <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', opacity: isSidebarCollapsed ? 0 : 1, width: isSidebarCollapsed ? 0 : '100%', marginLeft: isSidebarCollapsed ? 0 : '0.8rem', transform: isSidebarCollapsed ? 'translateX(-10px)' : 'translateX(0)', transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: isActive ? '600' : '500' }}>{item.label}</span>
                  </div>
                </button>
                {/* 🟢 Стильний Тултип при згорнутому сайдбарі */}
                {isSidebarCollapsed && (
                  <div className="nav-tooltip">
                    {item.label}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* 3. ПРОФІЛЬ ТА КНОПКА ЗГОРТАННЯ */}
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: 'auto' }}>

          <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
             <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                style={{
                  background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                  justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                  width: isSidebarCollapsed ? '44px' : '100%',
                  height: isSidebarCollapsed ? '44px' : 'auto',
                  padding: isSidebarCollapsed ? '0' : '0.6rem',
                  borderRadius: '10px', transition: '0.2s', gap: '0.8rem'
                }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
             >
               <Icons.SidebarToggle collapsed={isSidebarCollapsed} />
               {!isSidebarCollapsed && <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>Згорнути меню</span>}
             </button>
          </div>

          <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '0.2rem 0' }}></div>

          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', width: '100%' }} ref={profileMenuRef}>
            <div onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                 style={{
                   width: isSidebarCollapsed ? '44px' : '100%',
                   height: isSidebarCollapsed ? '44px' : 'auto',
                   padding: isSidebarCollapsed ? '0' : '0.5rem',
                   borderRadius: '12px',
                   display: 'flex', alignItems: 'center',
                   justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                   gap: isSidebarCollapsed ? '0' : '0.75rem', cursor: 'pointer', transition: '0.2s',
                   backgroundColor: isProfileMenuOpen ? '#f8fafc' : 'transparent'
                 }}
                 onMouseOver={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                 onMouseOut={e => { if(!isProfileMenuOpen) e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#0f172a', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.95rem', flexShrink: 0 }}>
                {getUserInitials(userProfile?.full_name)}
              </div>
              <div style={{ flex: isSidebarCollapsed ? 'none' : 1, overflow: 'hidden', opacity: isSidebarCollapsed ? 0 : 1, width: isSidebarCollapsed ? 0 : '100%', transform: isSidebarCollapsed ? 'translateX(-10px)' : 'translateX(0)', transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)' }}>
                <div style={{ color: '#0f172a', fontSize: '0.95rem', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userProfile?.full_name || 'Користувач'}</div>
                <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: '500', whiteSpace: 'nowrap' }}>{userProfile?.role === 'vendor' ? 'Власник' : 'Майстер'}</div>
              </div>
            </div>

            {isProfileMenuOpen && (
              <div className="menu-popup" style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: isSidebarCollapsed ? 'calc(100% + 10px)' : '0', width: isSidebarCollapsed ? '220px' : '100%', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '0.5rem', boxShadow: '0 12px 40px rgba(0,0,0,0.08)', zIndex: 200 }}>
                <div style={{ padding: '0.4rem 0.8rem 0.6rem 0.8rem', borderBottom: '1px solid #f1f5f9', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '800' }}>Акаунт</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0f172a', marginTop: '2px', wordWrap: 'break-word' }}>{userProfile?.full_name}</div>
                </div>
                <button onClick={() => router.push('/')} style={{ width: '100%', padding: '0.6rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'transparent', border: 'none', color: '#475569', fontSize: '0.9rem', cursor: 'pointer', borderRadius: '10px', transition: '0.2s', textAlign: 'left', fontWeight: '500' }} onMouseOver={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.color = '#0f172a'; }} onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#475569'; }}>
                  <Icons.Globe /> Головна сторінка
                </button>
                <button onClick={() => router.push('/profile')} style={{ width: '100%', padding: '0.6rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'transparent', border: 'none', color: '#475569', fontSize: '0.9rem', cursor: 'pointer', borderRadius: '10px', transition: '0.2s', textAlign: 'left', fontWeight: '500' }} onMouseOver={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.color = '#0f172a'; }} onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#475569'; }}>
                  <Icons.User /> Налаштування
                </button>
                <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '0.4rem 0' }}></div>
                <button onClick={handleLogout} style={{ width: '100%', padding: '0.6rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.9rem', cursor: 'pointer', borderRadius: '10px', transition: '0.2s', textAlign: 'left', fontWeight: '600' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#fef2f2'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                  <Icons.LogOut /> Вийти з системи
                </button>
              </div>
            )}
          </div>

        </div>
      </aside>

      {/* 🔴 ГОЛОВНА РОБОЧА ЗОНА */}
      <main className="custom-scroll" style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff', overflowY: 'auto', position: 'relative' }}>

        {/* 🟢 ВСІ ВКЛАДКИ ПІДКЛЮЧЕНІ ТУТ */}
        {activeTab === 'Calendar' && <CalendarTab business={business} team={team} services={services} userProfile={userProfile} />}
        {activeTab === 'Inventory' && <InventoryTab business={business} team={team} Icons={Icons} />}
        {activeTab === 'Clients' && <ClientsTab business={business} clientsList={clientsList} setClientsList={setClientsList} fetchClientsFromDB={fetchClientsFromDB} onBookAgain={handleBookAgain} />}
        {activeTab === 'Services' && <ServicesTab business={business} services={services} setServices={setServices} Icons={Icons} />}
        {activeTab === 'Storefront' && <StorefrontTab business={business} services={services} team={team} Icons={Icons} setActiveTab={setActiveTab} />}

        {activeTab === 'Stats' && <StatsTab business={business} services={services} team={team} />}

        {activeTab === 'Team' && <TeamTab business={business} team={team} setTeam={setTeam} services={services} userProfile={userProfile} appointments={appointments} setActiveTab={setActiveTab} setFilterMaster={setFilterMaster} globalShifts={shifts} />}

        {activeTab === 'Marketing' && (
          // @ts-ignore
          <MarketingTab
            business={business}
            clientsList={clientsList}
            Icons={Icons}
            marketingStats={marketingStats}
            availableSlots={availableSlots as any}
            averageTicketPrice={averageTicketPrice}
          />
        )}

        {activeTab === 'Settings' && <SettingsTab business={business} Icons={Icons} />}

        {/* 🟢 БУФЕР ОБМІНУ (КОПІЮВАННЯ) */}
        {clipboardApp && (
           <div style={{ position: 'absolute', top: 0, left: 0, right: 0, background: '#eff6ff', borderBottom: '1px solid #bfdbfe', padding: '0.6rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 101, animation: 'slideDown 0.2s ease-out' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#1d4ed8', fontWeight: '600' }}>
                 <Icons.Edit />
                 <span><b>Скопійовано:</b> {clipboardApp.client_name}. Клікніть на будь-яку вільну годину на сітці, щоб вставити.</span>
              </div>
              <button onClick={() => setClipboardApp(null)} style={{ background: '#dbeafe', border: 'none', color: '#1e3a8a', padding: '0.3rem 0.8rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}>Скасувати</button>
           </div>
        )}

        {/* 🟢 КОНТЕКСТНЕ МЕНЮ (ПРАВИЙ КЛІК) */}
        {contextMenu && (
          <div style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, background: '#fff', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', zIndex: 3000, overflow: 'hidden', border: '1px solid #e2e8f0', width: '220px', animation: 'slideUp 0.1s ease-out' }}>
            <div style={{ padding: '0.8rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.85rem', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
               {contextMenu.app.status === 'blocked' ? 'Перерва' : contextMenu.app.client_name}
            </div>
            {contextMenu.app.status !== 'blocked' && (
              <>
                <button onClick={() => handleUpdateBookingStatus('completed', contextMenu.app)} style={{ width: '100%', padding: '0.8rem 1rem', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.9rem', color: '#16a34a', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.6rem' }}><Icons.CheckCircle /> Завершено</button>
                <button onClick={() => handleUpdateBookingStatus('late', contextMenu.app)} style={{ width: '100%', padding: '0.8rem 1rem', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.9rem', color: '#d97706', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.6rem' }}><Icons.AlertCircle /> Запізнення</button>
                <button onClick={() => handleUpdateBookingStatus('no-show', contextMenu.app)} style={{ width: '100%', padding: '0.8rem 1rem', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.9rem', color: '#dc2626', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.6rem', borderBottom: '1px solid #f1f5f9' }}><Icons.XCircle /> Не прийшов</button>
                <button onClick={() => setClipboardApp(contextMenu.app)} style={{ width: '100%', padding: '0.8rem 1rem', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.9rem', color: '#0f172a', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.6rem' }}><Icons.Edit /> Скопіювати візит</button>
              </>
            )}
            <button onClick={() => { setSelectedBooking(contextMenu.app); void handleCancelBooking(); }} style={{ width: '100%', padding: '0.8rem 1rem', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.9rem', color: '#ef4444', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.6rem' }}><Icons.Trash /> Скасувати запис</button>
          </div>
        )}

      </main>

      {/* 🟢 МОДАЛКА ГЛОБАЛЬНОГО ПОШУКУ (CMD+K) */}
      {isGlobalSearchOpen && (
         <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '10vh' }} onClick={() => setIsGlobalSearchOpen(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: '0', maxWidth: '600px', overflow: 'hidden', background: '#fff', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
               <div style={{ display: 'flex', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                  <Icons.Search />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Пошук клієнтів (ім'я або телефон)..."
                    onChange={() => {}}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setActiveTab('Clients');
                        localStorage.setItem('bookera_activeTab', 'Clients');
                        setIsGlobalSearchOpen(false);
                      }
                      if (e.key === 'Escape') {
                        setIsGlobalSearchOpen(false);
                      }
                    }}
                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: '1.1rem', padding: '0 1rem', background: 'transparent' }}
                  />
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: '700' }}>ESC</div>
               </div>
            </div>
         </div>
      )}

      {/* --- МОДАЛЬНЕ ВІКНО ДОДАВАННЯ КЛІЄНТА (ОКРЕМО ВІД КАЛЕНДАРЯ) --- */}
      {isAddClientModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddClientModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ animation: 'slideUp 0.3s ease', maxWidth: '450px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>Новий клієнт</h2>
              <button onClick={() => setIsAddClientModalOpen(false)} style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label className="modal-label">Ім'я та прізвище *</label>
                <input
                  type="text"
                  value={newClientForm.name}
                  onChange={e => setNewClientForm({...newClientForm, name: e.target.value})}
                  className="modal-input"
                  placeholder="Наприклад: Олена Коваленко"
                  autoFocus
                />
              </div>
              <div>
                <label className="modal-label">Номер телефону</label>
                <input
                  type="text"
                  value={newClientForm.phone}
                  onChange={e => setNewClientForm({...newClientForm, phone: e.target.value})}
                  className="modal-input"
                  placeholder="+380..."
                />
              </div>
              <div>
                <label className="modal-label">Email (необов'язково)</label>
                <input
                  type="email"
                  value={newClientForm.email}
                  onChange={e => setNewClientForm({...newClientForm, email: e.target.value})}
                  className="modal-input"
                  placeholder="client@email.com"
                />
              </div>
            </div>

            <button
              onClick={handleSaveNewClient}
              disabled={isSavingClient}
              style={{ width: '100%', marginTop: '2.5rem', padding: '0.85rem', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '1rem', cursor: isSavingClient ? 'not-allowed' : 'pointer', opacity: isSavingClient ? 0.7 : 1, transition: '0.2s' }}
              onMouseOver={e => {if (!isSavingClient) e.currentTarget.style.backgroundColor = '#1e293b'}}
              onMouseOut={e => {if (!isSavingClient) e.currentTarget.style.backgroundColor = '#0f172a'}}
            >
              {isSavingClient ? 'Збереження...' : 'Додати клієнта в базу'}
            </button>
          </div>
        </div>
      )}

      {/* --- МОДАЛЬНЕ ВІКНО КАРТКИ КЛІЄНТА (CRM) --- */}
      {viewingClient && (
        <div className="modal-overlay" onClick={() => setViewingClient(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ animation: 'slideUp 0.3s ease', maxWidth: '850px', padding: 0, overflow: 'hidden' }}>

            <div style={{ padding: '2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#0f172a', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '1.5rem', flexShrink: 0, boxShadow: '0 4px 10px rgba(15,23,42,0.15)' }}>
                  {getUserInitials(viewingClient.name)}
                </div>
                <div>
                  <h2 style={{ fontSize: '1.6rem', fontWeight: '900', color: '#0f172a', margin: '0 0 0.4rem 0' }}>{viewingClient.name}</h2>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {viewingClient.tags?.map((tag: string, idx: number) => (
                      <span
                        key={idx}
                        className={`status-badge ${getBadgeClass(tag)}`}
                        onClick={() => handleRemoveTag(tag)}
                        style={{ cursor: 'pointer' }}
                        title="Натисніть, щоб видалити"
                      >
                        {tag} ✕
                      </span>
                    ))}
                    <button onClick={handleAddTag} style={{ background: 'transparent', border: '1px dashed #cbd5e1', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.borderColor='#94a3b8'} onMouseOut={e => e.currentTarget.style.borderColor='#cbd5e1'}>
                      <Icons.Plus /> Тег
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <button
                  onClick={() => handleDeleteClient(viewingClient.id)}
                  title="Видалити клієнта з бази"
                  style={{ background: '#fff', border: '1px solid #fee2e2', width: '36px', height: '36px', borderRadius: '50%', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' }}
                  onMouseOver={e => e.currentTarget.style.backgroundColor = '#fef2f2'}
                  onMouseOut={e => e.currentTarget.style.backgroundColor = '#fff'}
                >
                  <Icons.Trash />
                </button>
                <button
                  onClick={() => setViewingClient(null)}
                  style={{ background: '#ffffff', border: '1px solid #e2e8f0', width: '36px', height: '36px', borderRadius: '50%', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' }}
                  onMouseOver={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                  onMouseOut={e => e.currentTarget.style.backgroundColor = '#ffffff'}
                >
                  ✕
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', padding: '2rem', gap: '2.5rem' }}>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                <div>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: '800', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '1rem' }}>Контактна інформація</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: '#0f172a', fontSize: '0.95rem', fontWeight: '600' }}>
                      <div style={{ color: '#64748b' }}><Icons.Phone /></div>
                      {viewingClient.phone || 'Не вказано'}
                    </div>
                    {viewingClient.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: '#475569', fontSize: '0.95rem', fontWeight: '500' }}>
                        <div style={{ color: '#64748b' }}><Icons.Mail /></div>
                        {viewingClient.email}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ height: '1px', backgroundColor: '#e2e8f0' }}></div>

                <div>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: '800', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '1rem' }}>Статистика</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Візити</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#0f172a', lineHeight: '1' }}>{viewingClient.visits || 0}</div>
                    </div>
                    <div style={{ background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)', padding: '1.25rem', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Дохід (LTV)</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#10b981', lineHeight: '1', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                        {viewingClient.spent || 0}
                        <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: '700' }}>₴</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ height: '1px', backgroundColor: '#e2e8f0' }}></div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <button onClick={() => handleBookAgain(viewingClient)} className="client-dark-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', padding: '0.9rem', borderRadius: '12px' }}>
                    <Icons.Calendar /> Створити запис
                  </button>
                  {viewingClient.phone && (
                    <button style={{ padding: '0.9rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', color: '#0f172a', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#f1f5f9'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#ffffff'}>
                      <Icons.Phone /> Зателефонувати
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                      <h3 style={{ fontSize: '0.85rem', fontWeight: '800', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em', margin: 0 }}>Особисті нотатки</h3>
                      {(editingClientNotes !== (viewingClient.notes || '') || editingClientAllergies !== (viewingClient.allergies || '')) && (
                        <button onClick={handleSaveClientNotes} style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '0.4rem 1rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', transition: '0.2s', boxShadow: '0 2px 8px rgba(15,23,42,0.2)' }}>
                          Зберегти зміни
                        </button>
                      )}
                    </div>
                    <textarea
                      value={editingClientNotes}
                      onChange={e => setEditingClientNotes(e.target.value)}
                      placeholder="Напишіть тут інформацію про клієнта: що любить, які особливості, побажання до послуг..."
                      className="inline-input custom-scroll"
                      style={{ width: '100%', height: '100px', padding: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '0.95rem', color: '#334155', resize: 'none', lineHeight: '1.5', outline: 'none' }}
                    />
                  </div>

                  <div style={{ background: '#fff1f2', border: '1px dashed #fca5a5', padding: '1.25rem', borderRadius: '12px', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ color: '#ef4444', marginTop: '2px' }}><Icons.AlertCircle /></div>
                    <div style={{ flex: 1 }}>
                       <div style={{ fontSize: '0.8rem', fontWeight: '800', color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Алергії та протипоказання</div>
                       <input
                         type="text"
                         value={editingClientAllergies}
                         onChange={e => setEditingClientAllergies(e.target.value)}
                         placeholder="Вкажіть особливості (наприклад: алергія на латекс)..."
                         style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid #fca5a5', padding: '0.4rem 0', fontSize: '0.9rem', color: '#7f1d1d', outline: 'none' }}
                       />
                       <div style={{ fontSize: '0.7rem', color: '#f87171', marginTop: '0.4rem' }}>*Ця інформація буде підсвічуватись майстру перед візитом</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: '800', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '0.8rem' }}>Історія записів</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {viewingClient.last_visit ? (
                      (() => {
                        const vDate = new Date(viewingClient.last_visit);
                        vDate.setHours(0,0,0,0);
                        const tDate = new Date();
                        tDate.setHours(0,0,0,0);

                        const isFuture = vDate >= tDate;

                        return (
                          <div style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: '700', color: '#0f172a', marginBottom: '0.2rem' }}>
                                {isFuture ? 'Запланований візит' : 'Останній візит'}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                {new Date(viewingClient.last_visit).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })}
                              </div>
                            </div>
                            <div style={{ fontWeight: '700', color: isFuture ? '#3b82f6' : '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              {isFuture ? <><Icons.Clock /> Очікується</> : <><Icons.CheckCircle /> Успішно</>}
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div style={{ fontSize: '0.9rem', color: '#64748b' }}>Ще немає історії візитів</div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- МОДАЛЬНЕ ВІКНО НОВОГО ЗАПИСУ (КАЛЕНДАР) --- */}
      {isApptModalOpen && (
        <div className="modal-overlay" onClick={() => setIsApptModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ animation: 'slideUp 0.3s ease' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>Створити</h2>
              <button onClick={() => setIsApptModalOpen(false)} style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
              <button
                onClick={() => setIsBlockMode(false)}
                style={{ paddingBottom: '0.5rem', background: 'none', border: 'none', borderBottom: !isBlockMode ? '2px solid #0f172a' : '2px solid transparent', fontWeight: !isBlockMode ? '700' : '500', color: !isBlockMode ? '#0f172a' : '#64748b', cursor: 'pointer', fontSize: '0.95rem' }}
              >
                Новий клієнт
              </button>
              <button
                onClick={() => setIsBlockMode(true)}
                style={{ paddingBottom: '0.5rem', background: 'none', border: 'none', borderBottom: isBlockMode ? '2px solid #0f172a' : '2px solid transparent', fontWeight: isBlockMode ? '700' : '500', color: isBlockMode ? '#0f172a' : '#64748b', cursor: 'pointer', fontSize: '0.95rem' }}
              >
                Блокувати час
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              <div>
                <label className="modal-label">Дата</label>
                <input
                  type="date"
                  value={apptForm.date}
                  onChange={e => setApptForm({...apptForm, date: e.target.value})}
                  className="modal-input"
                  style={{ cursor: 'pointer' }}
                />
              </div>

              {!isBlockMode ? (
                <>
                  <div>
                    <label className="modal-label">Ім'я клієнта</label>
                    <input type="text" value={apptForm.client_name} onChange={e => setApptForm({...apptForm, client_name: e.target.value})} className="modal-input" placeholder="Наприклад: Іван Іванов" />
                  </div>
                  <div>
                    <label className="modal-label">Номер телефону</label>
                    <input
                      type="text"
                      value={apptForm.client_phone}
                      onChange={e => {
                        let val = e.target.value;
                        if (!val.startsWith('+380')) val = '+380';
                        const digits = val.slice(4).replace(/\D/g, '');
                        setApptForm({...apptForm, client_phone: '+380' + digits.slice(0, 9)});
                      }}
                      className="modal-input"
                    />
                  </div>
                  <div>
                    <label className="modal-label">Послуга</label>
                    <div className="modal-select-wrapper">
                      <select
                        value={apptForm.service_id}
                        onChange={e => {
                          const selectedService = services.find(s => String(s.id) === e.target.value);
                          setApptForm({ ...apptForm, service_id: e.target.value, duration: selectedService ? selectedService.duration : apptForm.duration });
                        }}
                      >
                        <option value="" disabled>Оберіть послугу...</option>
                        {(() => {
                           let availableServices = services;
                           if (apptForm.staff_id) {
                              const selectedM = team.find(t => String(t.id) === String(apptForm.staff_id));
                              if (selectedM && selectedM.assigned_services && selectedM.assigned_services.length > 0) {
                                 availableServices = services.filter(s => selectedM.assigned_services.includes(String(s.id)) || selectedM.assigned_services.includes(Number(s.id)));
                              }
                           }

                           if (availableServices.length === 0) {
                              return <option value="" disabled>Майстер не надає жодних послуг</option>
                           }

                           return availableServices.map(s => (
                             <option key={s.id} value={s.id}>{s.name} ({s.price} ₴)</option>
                           ));
                        })()}
                      </select>
                      <div className="modal-select-icon"><Icons.ChevronDown /></div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="modal-label">Причина блокування</label>
                    <input type="text" value={apptForm.block_reason} onChange={e => setApptForm({...apptForm, block_reason: e.target.value})} className="modal-input" placeholder="Наприклад: Перерва на обід, раннє закриття..." />
                  </div>
                </>
              )}

              <div>
                <label className="modal-label">Майстер</label>
                <div className="modal-select-wrapper">
                  <select value={apptForm.staff_id} onChange={e => setApptForm({...apptForm, staff_id: e.target.value})}>
                    <option value="">{isBlockMode ? 'Весь заклад (всі майстри)' : 'Будь-який майстер (Не вказано)'}</option>
                    {team.filter(m => m.provides_services !== false).map(m => ( <option key={m.id} value={m.id}>{m.name}</option> ))}
                  </select>
                  <div className="modal-select-icon"><Icons.ChevronDown /></div>
                </div>

                {(() => {
                   if (apptForm.date && apptForm.time) {
                      const apptDate = new Date(apptForm.date);
                      const dayIdx = apptDate.getDay() === 0 ? 6 : apptDate.getDay() - 1;
                      const [appH, appM] = apptForm.time.split(':').map(Number);
                      const appTime = appH * 60 + appM;

                      if (apptForm.staff_id) {
                         const selectedM = team.find(t => String(t.id) === String(apptForm.staff_id));
                         if (selectedM && selectedM.shifts && selectedM.shifts.length === 7) {
                            const shift = selectedM.shifts[dayIdx];
                            if (!shift.active) {
                               return (
                                 <div style={{ marginTop: '0.8rem', padding: '0.8rem', background: '#fff1f2', border: '1px dashed #f87171', borderRadius: '8px', color: '#b91c1c', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600' }}>
                                   <Icons.AlertCircle /> У майстра вихідний на цю дату!
                                 </div>
                               );
                            } else {
                               const [startH, startM] = shift.start.split(':').map(Number);
                               const [endH, endM] = shift.end.split(':').map(Number);
                               if (appTime < startH * 60 + startM || appTime >= endH * 60 + endM) {
                                  return (
                                     <div style={{ marginTop: '0.8rem', padding: '0.8rem', background: '#fffbeb', border: '1px dashed #fcd34d', borderRadius: '8px', color: '#b45309', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600' }}>
                                       <Icons.AlertCircle /> Час поза графіком майстра ({shift.start} - {shift.end})
                                     </div>
                                  );
                               }
                            }
                         }
                      } else {
                         const activeMasters = team.filter(m => m.provides_services !== false);

                         if (activeMasters.length > 0) {
                            const isAnyoneWorking = activeMasters.some(m => {
                               if (!m.shifts || m.shifts.length !== 7) return false;
                               const shift = m.shifts[dayIdx];
                               if (!shift.active) return false;
                               const [startH, startM] = shift.start.split(':').map(Number);
                               const [endH, endM] = shift.end.split(':').map(Number);
                               return appTime >= startH * 60 + startM && appTime < endH * 60 + endM;
                            });

                            if (!isAnyoneWorking) {
                               return (
                                 <div style={{ marginTop: '0.8rem', padding: '0.8rem', background: '#fff1f2', border: '1px dashed #f87171', borderRadius: '8px', color: '#b91c1c', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600' }}>
                                   <Icons.AlertCircle /> Увага! Жоден майстер не працює в цей час.
                                 </div>
                               );
                            }
                         } else {
                            const shift = shifts[dayIdx];
                            if (shift && !shift.active) {
                               return (
                                 <div style={{ marginTop: '0.8rem', padding: '0.8rem', background: '#fff1f2', border: '1px dashed #f87171', borderRadius: '8px', color: '#b91c1c', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600' }}>
                                   <Icons.AlertCircle /> У закладу вихідний на цю дату!
                                 </div>
                               );
                            } else if (shift) {
                               const [startH, startM] = shift.start.split(':').map(Number);
                               const [endH, endM] = shift.end.split(':').map(Number);
                               if (appTime < startH * 60 + startM || appTime >= endH * 60 + endM) {
                                  return (
                                     <div style={{ marginTop: '0.8rem', padding: '0.8rem', background: '#fffbeb', border: '1px dashed #fcd34d', borderRadius: '8px', color: '#b45309', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600' }}>
                                       <Icons.AlertCircle /> Час поза графіком закладу ({shift.start} - {shift.end})
                                     </div>
                                  );
                               }
                            }
                         }
                      }
                   }
                   return null;
                })()}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: !isBlockMode ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="modal-label">Час (Початок)</label>
                  <input type="time" value={apptForm.time} onChange={e => setApptForm({...apptForm, time: e.target.value})} className="modal-input" />
                </div>
                {isBlockMode && (
                  <div>
                    <label className="modal-label">Тривалість (хв)</label>
                    <input type="number" value={apptForm.duration} onChange={e => setApptForm({...apptForm, duration: Number(e.target.value)})} className="modal-input" />
                  </div>
                )}
              </div>
            </div>

            <button onClick={handleSaveAppointment} style={{ width: '100%', marginTop: '2.5rem', padding: '0.85rem', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '1rem', cursor: 'pointer', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#1e293b'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#0f172a'}>
              {isBlockMode ? 'Заблокувати' : 'Створити запис'}
            </button>
          </div>
        </div>
      )}

      {/* --- МОДАЛЬНЕ ВІКНО ДЕТАЛЕЙ ЗАПИСУ (З РЕДАГУВАННЯМ ЧАСУ ТА ДІЯМИ) --- */}
      {isBookingDetailsModalOpen && selectedBooking && (
        <div className="modal-overlay" onClick={() => setIsBookingDetailsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ animation: 'slideUp 0.3s ease', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                {selectedBooking.status === 'blocked' || selectedBooking.color === 'blocked' ? 'Деталі перерви' : 'Деталі запису'}
              </h2>
              <button onClick={() => setIsBookingDetailsModalOpen(false)} style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              {selectedBooking.status !== 'blocked' && selectedBooking.color !== 'blocked' ? (
                <>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600', display: 'block' }}>Клієнт</span>
                    <span style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a' }}>{selectedBooking.client_name}</span>
                    {selectedBooking.client_phone && <div style={{ fontSize: '0.9rem', color: '#475569', marginTop: '2px' }}>{selectedBooking.client_phone}</div>}
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600', display: 'block' }}>Послуга</span>
                    <span style={{ fontSize: '1rem', fontWeight: '600', color: '#0f172a' }}>
                      {services.find(s => s.id === selectedBooking.service_id)?.name || selectedBooking.service_name || 'Невідома послуга'}
                    </span>
                  </div>
                </>
              ) : (
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600', display: 'block' }}>Причина блокування</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a' }}>{selectedBooking.service_name || 'Перерва'}</span>
                </div>
              )}

              <div>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600', display: 'block' }}>Майстер</span>
                <span style={{ fontSize: '0.95rem', fontWeight: '500', color: '#0f172a' }}>
                  {team.find(m => m.id === selectedBooking.staff_id)?.name || selectedBooking.master_name || 'Будь-який (Не вказано)'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '2rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700', display: 'block', textTransform: 'uppercase' }}>Час початку</span>
                  <input
                    type="time"
                    value={selectedBooking.start_time.substring(0, 5)}
                    onChange={(e) => handleUpdateBookingTime(e.target.value)}
                    style={{ fontSize: '1.1rem', fontWeight: '800', color: '#3b82f6', border: 'none', background: 'transparent', outline: 'none', cursor: 'pointer', padding: 0 }}
                  />
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700', display: 'block', textTransform: 'uppercase' }}>Тривалість</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a' }}>
                    {selectedBooking.start_time && selectedBooking.end_time && !selectedBooking.start_time.includes('NaN') ? (
                      (() => {
                        const [sH, sM] = selectedBooking.start_time.split(':').map(Number);
                        const [eH, eM] = selectedBooking.end_time.split(':').map(Number);
                        let duration = (eH * 60 + eM) - (sH * 60 + sM);
                        if (duration < 0) duration += 24 * 60;
                        return isNaN(duration) ? '...' : duration;
                      })()
                    ) : (
                      services.find(s => String(s.id) === String(selectedBooking.service_id))?.duration || 60
                    )} хв
                  </span>
                </div>
              </div>
            </div>

            {/* 🟢 МЕНЮ ДІЙ (ОПТИМІЗОВАНЕ) */}
            {selectedBooking.status !== 'blocked' && selectedBooking.color !== 'blocked' && (
              <div style={{ marginBottom: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '700', display: 'block', marginBottom: '0.8rem', textTransform: 'uppercase' }}>Дії з візитом</span>

                {/* 1. Статуси */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem', marginBottom: '0.6rem' }}>
                  <button onClick={() => handleUpdateBookingStatus('completed')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', padding: '0.6rem 0', border: '1px solid #86efac', background: selectedBooking.status === 'completed' ? '#dcfce7' : '#fff', color: '#166534', borderRadius: '8px', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer', transition: '0.2s', whiteSpace: 'nowrap' }}>
                    <Icons.CheckCircle /> Завершено
                  </button>
                  <button onClick={() => handleUpdateBookingStatus('late')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', padding: '0.6rem 0', border: '1px solid #fde047', background: selectedBooking.status === 'late' ? '#fef08a' : '#fff', color: '#854d0e', borderRadius: '8px', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer', transition: '0.2s', whiteSpace: 'nowrap' }}>
                    <Icons.AlertCircle /> Запізнення
                  </button>
                  <button onClick={() => handleUpdateBookingStatus('no-show')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', padding: '0.6rem 0', border: '1px solid #fca5a5', background: selectedBooking.status === 'no-show' ? '#fee2e2' : '#fff', color: '#991b1b', borderRadius: '8px', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer', transition: '0.2s', whiteSpace: 'nowrap' }}>
                    <Icons.XCircle /> Не прийшов
                  </button>
                </div>

                {/* 2. Швидкі інструменти */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                   <button onClick={() => {
                      setApptForm({ ...apptForm, client_name: selectedBooking.client_name, client_phone: selectedBooking.client_phone || '+380', service_id: selectedBooking.service_id, staff_id: selectedBooking.staff_id, duration: services.find(s=>String(s.id)===String(selectedBooking.service_id))?.duration || 60, date: toLocalDateStr(currentDate) });
                      setIsBookingDetailsModalOpen(false);
                      setIsBlockMode(false);
                      setIsApptModalOpen(true);
                   }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', borderRadius: '8px', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', transition: '0.2s' }} onMouseOver={e=>e.currentTarget.style.background='#f1f5f9'} onMouseOut={e=>e.currentTarget.style.background='#f8fafc'}>
                      <Icons.Calendar /> Повторити
                   </button>

                   <button onClick={() => {
                      setClipboardApp(selectedBooking);
                      setIsBookingDetailsModalOpen(false);
                   }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', borderRadius: '8px', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', transition: '0.2s' }} onMouseOver={e=>e.currentTarget.style.background='#f1f5f9'} onMouseOut={e=>e.currentTarget.style.background='#f8fafc'}>
                      <Icons.Edit /> Копіювати
                   </button>
                </div>
              </div>
            )}

            <button onClick={handleCancelBooking} style={{ width: '100%', padding: '0.85rem', backgroundColor: '#fff', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '10px', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#fecaca'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#fff'}>
              <Icons.Trash />
              {selectedBooking?.status === 'blocked' || selectedBooking?.color === 'blocked' ? 'Видалити перерву' : 'Скасувати запис повністю'}
            </button>
          </div>
        </div>
      )}

      {/* --- МОДАЛЬНЕ ВІКНО ПІДТВЕРДЖЕННЯ ПЕРЕНЕСЕННЯ (DRAG & DROP) --- */}
      {dragConfirmData && (
        <div className="modal-overlay" onClick={() => setDragConfirmData(null)} style={{ zIndex: 2000 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)', maxWidth: '420px', textAlign: 'center', padding: '2.5rem' }}>

            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 9l4-4 4 4"/><path d="M9 5v14"/><path d="M19 15l-4 4-4-4"/><path d="M15 19V5"/></svg>
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.8rem' }}>Перенести запис?</h2>
            <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '1.5rem' }}>Будь ласка, перевірте новий час візиту перед підтвердженням.</p>

            <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '16px', marginBottom: '2rem', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: '800', color: '#0f172a', marginBottom: '0.8rem', fontSize: '1.05rem' }}>
                {dragConfirmData.app.client_name}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', background: '#fff', padding: '0.8rem', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>Було</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: '600', color: '#475569', textDecoration: 'line-through' }}>{dragConfirmData.app.start_time.substring(0, 5)}</span>
                </div>

                <div style={{ color: '#cbd5e1' }}><Icons.ChevronRight /></div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: '#3b82f6', fontWeight: '800', textTransform: 'uppercase', marginBottom: '2px' }}>Стане</span>

                  {/* 🟢 ІНТЕРАКТИВНА ЗМІНА ЧАСУ ПРЯМО ТУТ */}
                  <input
                    type="time"
                    value={dragConfirmData.newStart.substring(0, 5)}
                    onChange={e => {
                        const newStartTime = e.target.value;
                        const [h, m] = newStartTime.split(':').map(Number);
                        const [oldStartH, oldStartM] = dragConfirmData.app.start_time.split(':').map(Number);
                        const [oldEndH, oldEndM] = dragConfirmData.app.end_time.split(':').map(Number);
                        let duration = (oldEndH * 60 + oldEndM) - (oldStartH * 60 + oldStartM);
                        if (duration < 0) duration += 24 * 60;
                        const totalEnd = h * 60 + m + duration;
                        const newEndStr = `${String(Math.floor(totalEnd / 60) % 24).padStart(2, '0')}:${String(totalEnd % 60).padStart(2, '0')}:00`;
                        setDragConfirmData({...dragConfirmData, newStart: `${newStartTime}:00`, newEnd: newEndStr});
                    }}
                    style={{ fontSize: '1.2rem', fontWeight: '800', color: '#3b82f6', border: 'none', background: 'transparent', outline: 'none', cursor: 'pointer', padding: 0 }}
                  />

                </div>
              </div>

              <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '1rem', fontWeight: '600' }}>
                Дата: {dragConfirmData.targetDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setDragConfirmData(null)} style={{ flex: 1, padding: '0.9rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#e2e8f0'} onMouseOut={e => e.currentTarget.style.background = '#f1f5f9'}>
                Скасувати
              </button>
              <button onClick={confirmDragDrop} style={{ flex: 1, padding: '0.9rem', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer', transition: '0.2s', boxShadow: '0 4px 15px rgba(15,23,42,0.15)' }} onMouseOver={e => e.currentTarget.style.background = '#1e293b'} onMouseOut={e => e.currentTarget.style.background = '#0f172a'}>
                Перенести
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- МОДАЛЬНЕ ВІКНО: НАЛАШТУВАННЯ КАЛЕНДАРЯ --- */}
      {showCalSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowCalSettingsModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ animation: 'slideUp 0.3s ease', maxWidth: '750px', padding: '0' }}>
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <button onClick={() => setShowCalSettingsModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', color: '#64748b' }}><Icons.ChevronLeft /></button>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>Налаштування календаря</h2>
              </div>
              <button
                onClick={async (e) => {
                  const btn = e.currentTarget;
                  const originalText = btn.innerText;
                  btn.innerText = 'Збереження...';
                  btn.style.opacity = '0.7';
                  btn.disabled = true;

                  if (business) {
                    await supabase.from('businesses').update({ cal_settings: calSettings }).eq('id', business.id);
                    setCalendarView(calSettings.defaultView as any);
                    localStorage.setItem('bookera_calendarView', calSettings.defaultView);
                  }

                  btn.innerText = '✓ Збережено';
                  btn.style.background = '#10b981';
                  btn.style.opacity = '1';

                  setTimeout(() => {
                    btn.innerText = originalText;
                    btn.style.background = '#0f172a';
                    btn.disabled = false;
                    setShowCalSettingsModal(false);
                  }, 600);
                }}
                style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', transition: '0.2s' }}
              >
                Зберегти
              </button>
            </div>

            <div className="custom-scroll" style={{ padding: '2rem', maxHeight: '80vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

              <div>
                <label style={{ display: 'block', fontSize: '0.95rem', fontWeight: '800', color: '#0f172a', marginBottom: '1rem' }}>Вигляд за замовчуванням</label>
                <div style={{ display: 'flex', gap: '2rem' }}>
                  {['day', 'week', 'month'].map(view => (
                    <label key={view} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.95rem', color: '#475569', fontWeight: '500' }}>
                      <input type="radio" checked={calSettings.defaultView === view} onChange={() => setCalSettings({...calSettings, defaultView: view})} style={{ display: 'none' }} />
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: calSettings.defaultView === view ? '6px solid #0f172a' : '1.5px solid #cbd5e1', transition: 'all 0.2s ease', flexShrink: 0, boxSizing: 'border-box' }}></div>
                      {view === 'day' ? 'День' : view === 'week' ? 'Тиждень' : 'Місяць'}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.95rem', fontWeight: '800', color: '#0f172a', marginBottom: '1rem' }}>Кольорова схема</label>
                <div style={{ display: 'flex', gap: '1.5rem' }}>
                  <div
                    onClick={() => setCalSettings({...calSettings, colorScheme: 'pastel'})}
                    style={{ flex: 1, border: `2px solid ${calSettings.colorScheme === 'pastel' ? '#0f172a' : '#e2e8f0'}`, borderRadius: '12px', padding: '1.2rem', cursor: 'pointer', transition: '0.2s', position: 'relative' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: calSettings.colorScheme === 'pastel' ? '6px solid #0f172a' : '1.5px solid #cbd5e1', transition: 'all 0.2s ease', flexShrink: 0, boxSizing: 'border-box' }}></div>
                      <span style={{ fontWeight: '700', fontSize: '1rem', color: '#0f172a' }}>Пастельні</span>
                    </div>
                    <div style={{ borderTop: '1px dashed #e2e8f0', borderLeft: '1px dashed #e2e8f0', height: '60px', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: '10px', left: '10px', width: '80%', height: '15px', background: '#e0e7ff', borderLeft: '3px solid #cbd5e1', borderRadius: '4px' }}></div>
                      <div style={{ position: 'absolute', top: '35px', left: '30px', width: '60%', height: '20px', background: '#dcfce7', borderLeft: '3px solid #cbd5e1', borderRadius: '4px' }}></div>
                    </div>
                  </div>

                  <div
                    onClick={() => setCalSettings({...calSettings, colorScheme: 'vivid'})}
                    style={{ flex: 1, border: `2px solid ${calSettings.colorScheme === 'vivid' ? '#0f172a' : '#e2e8f0'}`, borderRadius: '12px', padding: '1.2rem', cursor: 'pointer', transition: '0.2s', position: 'relative' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: calSettings.colorScheme === 'vivid' ? '6px solid #0f172a' : '1.5px solid #cbd5e1', transition: 'all 0.2s ease', flexShrink: 0, boxSizing: 'border-box' }}></div>
                      <span style={{ fontWeight: '700', fontSize: '1rem', color: '#0f172a' }}>Яскраві</span>
                    </div>
                    <div style={{ borderTop: '1px dashed #e2e8f0', borderLeft: '1px dashed #e2e8f0', height: '60px', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: '10px', left: '10px', width: '80%', height: '15px', background: '#3b82f6', borderRadius: '4px' }}></div>
                      <div style={{ position: 'absolute', top: '35px', left: '30px', width: '60%', height: '20px', background: '#10b981', borderRadius: '4px' }}></div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.95rem', fontWeight: '800', color: '#0f172a', marginBottom: '1rem' }}>Відображення кольорів у розкладі</label>
                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.95rem', color: '#475569', fontWeight: '500' }}>
                    <input
                      type="radio"
                      checked={calSettings.colorMode === 'master' || !calSettings.colorMode}
                      onChange={() => setCalSettings({...calSettings, colorMode: 'master'})}
                      style={{ display: 'none' }}
                    />
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: (calSettings.colorMode === 'master' || !calSettings.colorMode) ? '6px solid #0f172a' : '1.5px solid #cbd5e1', transition: 'all 0.2s ease', flexShrink: 0, boxSizing: 'border-box' }}></div>
                    Колір за майстром
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.95rem', color: '#475569', fontWeight: '500' }}>
                    <input
                      type="radio"
                      checked={calSettings.colorMode === 'category'}
                      onChange={() => setCalSettings({...calSettings, colorMode: 'category'})}
                      style={{ display: 'none' }}
                    />
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: calSettings.colorMode === 'category' ? '6px solid #0f172a' : '1.5px solid #cbd5e1', transition: 'all 0.2s ease', flexShrink: 0, boxSizing: 'border-box' }}></div>
                    Колір за послугою
                  </label>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.8rem', lineHeight: '1.4' }}>
                  {calSettings.colorMode === 'category' ? 'Записи будуть забарвлені автоматично на основі категорії послуги.' : 'Кожен майстер матиме свій індивідуальний колір.'}
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '1rem' }}>Робочі години та перерви</div>
                <button
                  onClick={() => {
                    setShowCalSettingsModal(false);
                    setShowShiftsModal(true);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.5rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', color: '#0f172a', transition: '0.2s' }}
                  onMouseOver={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                  onMouseOut={e => e.currentTarget.style.backgroundColor = '#fff'}
                >
                  <Icons.Clock /> Налаштувати зміни
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* --- МОДАЛКА: НАЛАШТУВАННЯ РОБОЧИХ ЗМІН --- */}
      {showShiftsModal && (
        <div className="modal-overlay" onClick={() => setShowShiftsModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ animation: 'slideUp 0.3s ease', maxWidth: '600px', padding: '0' }}>
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <button
                  onClick={() => { setShowShiftsModal(false); setShowCalSettingsModal(true); }}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', color: '#64748b' }}
                >
                  <Icons.ChevronLeft />
                </button>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.2rem 0' }}>Робочі години</h2>
              </div>
              <button onClick={handleSaveShifts} style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#1e293b'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#0f172a'}>
                Зберегти
              </button>
            </div>

            <div className="custom-scroll" style={{ padding: '2rem', maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {shifts.map((shift, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', transition: '0.2s', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', width: '160px' }}>
                    <div
                      onClick={() => { const newShifts = [...shifts]; newShifts[idx].active = !shift.active; setShifts(newShifts); }}
                      style={{ width: '44px', height: '24px', borderRadius: '12px', background: shift.active ? '#10b981' : '#cbd5e1', position: 'relative', cursor: 'pointer', transition: '0.3s', flexShrink: 0 }}
                    >
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: shift.active ? '22px' : '2px', transition: '0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}></div>
                    </div>
                    <div style={{ fontWeight: '700', color: shift.active ? '#0f172a' : '#94a3b8', fontSize: '1rem' }}>{shift.day}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '240px' }}>
                    {shift.active ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', width: '100%', justifyContent: 'space-between' }}>
                        <input
                          type="time" value={shift.start}
                          onChange={(e) => { const newShifts = [...shifts]; newShifts[idx].start = e.target.value; setShifts(newShifts); }}
                          style={{ padding: '0.5rem 0.8rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: '700', color: '#0f172a', fontSize: '0.95rem', background: '#fff', outline: 'none', transition: '0.2s', width: '100px', textAlign: 'center' }}
                        />
                        <span style={{ color: '#94a3b8', fontWeight: '800' }}>—</span>
                        <input
                          type="time" value={shift.end}
                          onChange={(e) => { const newShifts = [...shifts]; newShifts[idx].end = e.target.value; setShifts(newShifts); }}
                          style={{ padding: '0.5rem 0.8rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: '700', color: '#0f172a', fontSize: '0.95rem', background: '#fff', outline: 'none', transition: '0.2s', width: '100px', textAlign: 'center' }}
                        />
                      </div>
                    ) : (
                      <div style={{ padding: '0.5rem 0', width: '100%', textAlign: 'center', color: '#94a3b8', fontWeight: '700', fontSize: '0.95rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                        Вихідний
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}