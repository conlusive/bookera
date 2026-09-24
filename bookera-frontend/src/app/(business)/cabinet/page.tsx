'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';
import { useToast } from '@/context/ToastContext';
import SubscriptionExpired from '@/components/cabinet/SubscriptionExpired';
import Avatar from '@/components/ui/Avatar';
import type { SubscriptionState } from '@/lib/api';
import { isOwnerRole } from '@/lib/roles';
import { Business } from '@/types';

// Іконки та константи
import { Icons, navItems, toLocalDateStr } from '@/components/shared';

import CalendarTab from '@/components/cabinet/CalendarTab';
import dynamic from 'next/dynamic';
import SmartImage from '@/components/ui/SmartImage';

/**
 * Вкладки кабінету вантажаться, лише коли їх відкривають.
 *
 * Раніше всі девʼять імпортувались одразу - понад 12 тисяч рядків коду,
 * хоча людина бачить одну вкладку. Власник, що зайшов глянути розклад,
 * чекав, поки завантажаться склад, маркетинг, налаштування й решта.
 *
 * Календар лишається звичайним імпортом: з нього кабінет відкривається,
 * і відкладати його означало б показати порожній екран на старті.
 *
 * Поки вкладка вантажиться вперше - тихий заповнювач тієї ж висоти:
 * без стрибка сторінки, коли вкладка зʼявиться.
 */
const TabLoading = () => (
  <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#AEAEB2', fontSize: '0.9rem' }}>
    Завантаження…
  </div>
);
const StatsTab = dynamic(() => import('@/components/cabinet/StatsTab'), { ssr: false, loading: TabLoading });
const ClientsTab = dynamic(() => import('@/components/cabinet/ClientsTab'), { ssr: false, loading: TabLoading });
const ServicesTab = dynamic(() => import('@/components/cabinet/ServicesTab'), { ssr: false, loading: TabLoading });
const TeamTab = dynamic(() => import('@/components/cabinet/TeamTab'), { ssr: false, loading: TabLoading });
const InventoryTab = dynamic(() => import('@/components/cabinet/InventoryTab'), { ssr: false, loading: TabLoading });
const MarketingTab = dynamic(() => import('@/components/cabinet/MarketingTab'), { ssr: false, loading: TabLoading });
const SettingsTab = dynamic(() => import('@/components/cabinet/SettingsTab'), { ssr: false, loading: TabLoading });
const StorefrontTab = dynamic(() => import('@/components/cabinet/StorefrontTab'), { ssr: false, loading: TabLoading });

function normalizeStaff(list: any[]): any[] {
  return (list || []).map((s: any) => ({
    ...s,
    name: s.full_name || s.name || s.email || 'Без імені',
  }));
}

function roleLabel(role?: string | null): string {
  if (isOwnerRole(role)) return 'Власник';
  if (role === 'admin') return 'Адміністратор';
  if (role === 'master') return 'Майстер';
  return 'Співробітник';
}

export default function BusinessCabinet() {
  const { showToast } = useToast();
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  const [settingsTarget, setSettingsTarget] = useState<string | undefined>();
  const [bannerHiddenUntil, setBannerHiddenUntil] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return Number(localStorage.getItem('bookera_sub_banner_hidden') || 0);
  });
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

  // Синхронізація посади для нижньої плашки профілю
  const currentStaffMember = useMemo(() => {
    return (team || []).find((m: any) =>
      (userProfile?.email && m.email?.toLowerCase() === userProfile.email.toLowerCase()) ||
      (userProfile?.id && String(m.id) === String(userProfile.id))
    );
  }, [team, userProfile]);

  const userRoleDisplay = useMemo(() => {
    if (currentStaffMember?.specialization?.trim()) {
      return currentStaffMember.specialization.trim();
    }
    if (currentStaffMember?.title?.trim()) {
      return currentStaffMember.title.trim();
    }
    return roleLabel(userProfile?.role);
  }, [currentStaffMember, userProfile?.role]);

  // Слухач подій для швидкого оновлення імені/телефону
  useEffect(() => {
    const handleProfileUpdate = (e: any) => {
      if (e.detail?.name) {
        setUserProfile((prev: any) => prev ? { ...prev, full_name: e.detail.name, phone: e.detail.phone ?? prev.phone } : prev);
      }
    };
    window.addEventListener('user-profile-updated', handleProfileUpdate);
    return () => window.removeEventListener('user-profile-updated', handleProfileUpdate);
  }, []);

  const fetchClientsFromDB = async (bizId: number | string) => {
    try {
      const token = await getAuthToken();
      const data = await api.listClients(token, Number(bizId));
      setClientsList(data);
    } catch (err) {
      console.error("Помилка завантаження клієнтів:", err);
    }
  };

  const handleSaveNewClient = async () => {
    if (!business) return showToast('Заклад не обрано', 'error');
    if (!newClientForm.name.trim()) return showToast("Введіть ім'я клієнта", 'error');

    let finalPhone = '';
    if (newClientForm.phone && newClientForm.phone !== '+380') {
      const phoneStripped = newClientForm.phone.replace(/\D/g, '');
      if (phoneStripped.length !== 12) {
        return showToast('Некоректний номер: потрібно 9 цифр після +380', 'error');
      }
      finalPhone = '+' + phoneStripped;
    }

    const emailTrimmed = newClientForm.email.trim();
    if (emailTrimmed) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
        return showToast('Некоректна пошта — приклад: example@mail.com', 'error');
      }
    }

    setIsSavingClient(true);
    try {
      const token = await getAuthToken();
      await api.createClient(token, {
        business_id: business.id,
        name: newClientForm.name.trim(),
        phone: finalPhone,
        email: emailTrimmed || undefined,
        tags: ['Новий'],
      });

      await fetchClientsFromDB(business.id);
      setIsAddClientModalOpen(false);
      setNewClientForm({ name: '', phone: '+380', email: '' });
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Не вдалося створити клієнта', 'error');
    } finally {
      setIsSavingClient(false);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!confirm("Ви впевнені, що хочете назавжди видалити цього клієнта з бази? Усі його дані будуть втрачені.")) return;
    try {
      const token = await getAuthToken();
      await api.deleteClient(token, Number(clientId));
      setClientsList(prev => prev.filter(c => c.id !== clientId));
      setViewingClient(null);
    } catch (err: any) {
      console.error("Помилка видалення клієнта:", err);
      showToast(err?.message || 'Не вдалося видалити клієнта', 'error');
    }
  };

  const handleSaveClientNotes = async () => {
    if (!viewingClient) return;
    try {
      const token = await getAuthToken();
      await api.updateClient(token, viewingClient.id, { notes: editingClientNotes, allergies: editingClientAllergies });
      const updatedClients = clientsList.map(c => c.id === viewingClient.id ? { ...c, notes: editingClientNotes, allergies: editingClientAllergies } : c);
      setClientsList(updatedClients);
      setViewingClient({ ...viewingClient, notes: editingClientNotes, allergies: editingClientAllergies });
    } catch (err: any) {
      console.error("Системна помилка:", err);
      showToast(err?.message || 'Не вдалося зберегти зміни', 'error');
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
    if (currentTags.includes(newTag.trim())) return showToast('Такий тег уже є', 'error');

    const updatedTags = [...currentTags, newTag.trim()];

    try {
      const token = await getAuthToken();
      await api.updateClient(token, viewingClient.id, { tags: updatedTags });
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
        const token = await getAuthToken();
        await api.updateClient(token, viewingClient.id, { tags: updatedTags });
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

  const loadSpecificBusiness = async (bizId: number | string) => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      let targetBiz = myBusinesses.find(b => String(b.id) === String(bizId));

      if (!targetBiz) {
        targetBiz = await api.getBusiness(bizId);
      }

      if (targetBiz) {
        try {
          const switched = await api.switchWorkplace(token, Number(targetBiz.id));
          setUserProfile((prev: any) => prev ? { ...prev, role: switched.role, business_id: switched.business_id } : prev);
        } catch (err: any) {
          showToast(err?.message || 'Не вдалося перемкнути заклад', 'error');
          return;
        }

        setBusiness(targetBiz);
        localStorage.setItem('bookera_active_biz_id', String(targetBiz.id));
        const savedCal = localStorage.getItem(`bookera_cal_settings_${targetBiz.id}`);
        if (savedCal) setCalSettings(JSON.parse(savedCal));

        const [srvsData, teamData, clientsData, hoursData] = await Promise.all([
          api.getBusinessServices(targetBiz.id),
          api.listStaff(token, targetBiz.id),
          api.listClients(token, targetBiz.id),
          api.getBusinessHours(targetBiz.id),
        ]);

        setServices(srvsData || []);
        setTeam(normalizeStaff(teamData));
        if (clientsData) setClientsList(clientsData);
        if (hoursData && hoursData.length > 0) {
          const dayNames = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота', 'Неділя'];
          const byWeekday = new Map(hoursData.map(h => [h.weekday, h]));
          setShifts(dayNames.map((day, i) => {
            const h = byWeekday.get(i);
            return h
              ? { day, active: h.is_open, start: h.open_time.slice(0, 5), end: h.close_time.slice(0, 5) }
              : { day, active: true, start: '09:00', end: '20:00' };
          }));
        }
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
          console.warn('[cabinet] Немає активної сесії, повертаю на /business', sessionError);
          router.push('/business');
          return;
        }

        const userId = session.user.id;
        const userEmail = session.user.email;
        const token = session.access_token;

        const me = await api.getMyProfile(token);

        if (!isMounted) return;

        setUserProfile({
          id: userId,
          email: userEmail,
          full_name: me.full_name || session.user.user_metadata?.full_name || userEmail,
          role: me.role || 'client',
        });

        setSubscription(me.subscription ?? null);

        if (!me.business_id) {
          router.push('/business/register');
          return;
        }

        if (me.business && me.business_id) {
          setMyBusinesses([me.business]);
          void (async () => {
            try {
              const places = await api.listMyWorkplaces(token);
              if (places.length > 1) {
                setMyBusinesses(places.map(p => ({
                  id: p.business_id, name: p.name, slug: p.slug,
                  city: p.city, logo: p.logo, cover_photo: (p as any).cover_photo || p.logo, role: p.role,
                  has_access: p.has_access,
                })));
              }
            } catch {}
          })();
          setBusiness(me.business);
          localStorage.setItem('bookera_active_biz_id', String(me.business.id));
          const savedCal = localStorage.getItem(`bookera_cal_settings_${me.business.id}`);
          if (savedCal) setCalSettings(JSON.parse(savedCal));

          const [srvsData, teamData, clientsData, hoursData] = await Promise.all([
            api.getBusinessServices(me.business.id),
            api.listStaff(token, me.business.id),
            api.listClients(token, me.business.id),
            api.getBusinessHours(me.business.id),
          ]);

          if (isMounted) {
            setServices(srvsData || []);
            setTeam(normalizeStaff(teamData));
            if (clientsData) setClientsList(clientsData);
            if (hoursData && hoursData.length > 0) {
              const dayNames = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота', 'Неділя'];
              const byWeekday = new Map(hoursData.map(h => [h.weekday, h]));
              setShifts(dayNames.map((day, i) => {
                const h = byWeekday.get(i);
                return h
                  ? { day, active: h.is_open, start: h.open_time.slice(0, 5), end: h.close_time.slice(0, 5) }
                  : { day, active: true, start: '09:00', end: '20:00' };
              }));
            }
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

      try {
        const token = await getAuthToken();
        const apiAppointments = await api.getBookedAppointments(token, business.id);
        const currentTime = new Date();

        const processedData = apiAppointments.map((app: any) => {
          const start = new Date(app.start_time);
          const end = new Date(app.end_time);
          const pad = (n: number) => String(n).padStart(2, '0');

          const mapped = {
            ...app,
            staff_id: app.master_id,
            booking_date: toLocalDateStr(start),
            start_time: `${pad(start.getHours())}:${pad(start.getMinutes())}:00`,
            end_time: `${pad(end.getHours())}:${pad(end.getMinutes())}:00`,
          };

          if (mapped.status === 'blocked') return mapped;
          if (mapped.status === 'confirmed' && currentTime > end) {
            api.updateAppointmentStatus(token, app.id, 'completed').catch(() => {});
            return { ...mapped, status: 'completed' };
          }
          return mapped;
        });

        setAppointments(processedData);
      } catch (err) {
        console.error("Помилка завантаження записів:", err);
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
      try {
        const token = await getAuthToken();
        const dayNames = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота', 'Неділя'];
        const hoursPayload = shifts.map((s: any) => ({
          weekday: dayNames.indexOf(s.day),
          is_open: s.active,
          open_time: s.start,
          close_time: s.end,
        }));
        await api.setBusinessHours(token, business.id, hoursPayload);
      } catch (err: any) {
        showToast(err?.message || 'Не вдалося зберегти графік', 'error');
      }
    }
    setShowShiftsModal(false);
  };

  const handleSaveAppointment = async () => {
    if (!business) return showToast('Заклад не обрано', 'error');

    let finalPhone = '';
    if (!isBlockMode && apptForm.client_phone && apptForm.client_phone !== '+380') {
      const phoneStripped = apptForm.client_phone.replace(/\D/g, '');
      if (phoneStripped.length !== 12) {
        return showToast('Некоректний номер: потрібно 9 цифр після +380', 'error');
      }
      finalPhone = '+' + phoneStripped;
    }

    try {
      const token = await getAuthToken();

      const selectedService = services.find(s => String(s.id) === String(apptForm.service_id));
      if (!isBlockMode && !selectedService) return showToast('Оберіть послугу', 'error');

      const [hours, minutes] = apptForm.time.split(':').map(Number);
      const startDateTime = new Date(`${apptForm.date}T00:00:00`);
      startDateTime.setHours(hours, minutes, 0, 0);

      const created = await api.createManualAppointment(token, {
        business_id: business.id,
        service_id: isBlockMode ? undefined : Number(apptForm.service_id),
        start_time: startDateTime.toISOString(),
        duration_minutes: isBlockMode ? apptForm.duration : undefined,
        master_id: apptForm.staff_id || undefined,
        client_name: isBlockMode ? undefined : apptForm.client_name,
        client_phone: isBlockMode ? undefined : finalPhone,
        is_block: isBlockMode,
      });

      if (!isBlockMode) {
        await fetchClientsFromDB(business.id);
      }

      const end = new Date(created.end_time);
      const pad = (n: number) => String(n).padStart(2, '0');
      setAppointments([...appointments, {
        ...created,
        staff_id: created.master_id,
        booking_date: apptForm.date,
        start_time: `${pad(hours)}:${pad(minutes)}:00`,
        end_time: `${pad(end.getHours())}:${pad(end.getMinutes())}:00`,
      }]);
      setIsApptModalOpen(false);
      setApptForm({ client_name: '', client_phone: '+380', service_id: '', staff_id: '', date: toLocalDateStr(currentDate), time: '10:00', block_reason: '', duration: 60, source: 'Адмін-панель' });
      setIsBlockMode(false);
    } catch (err: any) {
      console.error("Системна помилка створення запису:", err);
      showToast(err?.message || 'Не вдалося створити запис', 'error');
    }
  };

  const handleUpdateBookingStatus = async (newStatus: string, appToUpdate: any = selectedBooking) => {
    if (!appToUpdate) return;
    const finalStatus = appToUpdate.status === newStatus ? 'confirmed' : newStatus;

    try {
      const token = await getAuthToken();
      await api.updateAppointmentStatus(token, appToUpdate.id, finalStatus as any);
      setAppointments(prev => prev.map(app => app.id === appToUpdate.id ? { ...app, status: finalStatus } : app));
      if (selectedBooking && selectedBooking.id === appToUpdate.id) {
         setSelectedBooking({ ...selectedBooking, status: finalStatus });
      }
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Не вдалося оновити статус', 'error');
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
       try {
         const token = await getAuthToken();
         const newStartIso = new Date(`${newDateStr}T${newStart}`);
         await api.rescheduleAppointment(token, app.id, newStartIso.toISOString());
       } catch (err: any) {
         console.error(err);
         showToast(err?.message || 'Не вдалося перенести запис', 'error');
       }
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
       try {
         const token = await getAuthToken();
         const newStartIso = new Date(`${selectedBooking.booking_date}T${newStartStr}`);
         await api.rescheduleAppointment(token, updatedApp.id, newStartIso.toISOString());
       } catch (err: any) {
         console.error(err);
         showToast(err?.message || 'Не вдалося перенести запис', 'error');
       }
     }
  };

  const handleCancelBooking = async () => {
    if (!selectedBooking) return;
    const isBlock = selectedBooking.status === 'blocked' || selectedBooking.color === 'blocked';

    if (!confirm(`Ви впевнені, що хочете скасувати ${isBlock ? 'цю перерву' : 'цей запис'}?`)) return;

    try {
      const token = await getAuthToken();
      await api.updateAppointmentStatus(token, selectedBooking.id, 'cancelled');
      setAppointments(prev => prev.filter(a => a.id !== selectedBooking.id));
      setIsBookingDetailsModalOpen(false);
      setSelectedBooking(null);
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || 'Не вдалося скасувати запис', 'error');
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

  if (!loading && subscription && !subscription.has_access && business?.id) {
    return (
      <SubscriptionExpired
        businessId={business.id}
        businessName={business.name}
        subscription={subscription}
      />
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#fafafa', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <style>{`
          @keyframes pulse-skel {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
          .skel-bg { background-color: #e2e8f0; animation: pulse-skel 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; border-radius: 8px; }
        `}</style>
        <aside style={{ width: isSidebarCollapsed ? '80px' : '265px', backgroundColor: '#ffffff', borderRight: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', padding: '1rem', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2.5rem', padding: '0.5rem' }}>
            <div className="skel-bg" style={{ width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0 }}></div>
            {!isSidebarCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div className="skel-bg" style={{ width: '110px', height: '14px' }}></div>
                <div className="skel-bg" style={{ width: '70px', height: '10px' }}></div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.8rem' }}>
                <div className="skel-bg" style={{ width: '20px', height: '20px', borderRadius: '4px', flexShrink: 0 }}></div>
                {!isSidebarCollapsed && <div className="skel-bg" style={{ width: '120px', height: '14px' }}></div>}
              </div>
            ))}
          </div>
        </aside>
        <main style={{ flex: 1, padding: '2rem 3rem', display: 'flex', flexDirection: 'column' }}>
          <div className="skel-bg" style={{ width: '260px', height: '36px', borderRadius: '10px', marginBottom: '1.5rem' }}></div>
          <div className="skel-bg" style={{ flex: 1, borderRadius: '16px' }}></div>
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
        .apple-sidebar-nav::-webkit-scrollbar { display: none; }
        .apple-sidebar-nav { -ms-overflow-style: none; scrollbar-width: none; }
        
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

        @keyframes menuPopIn {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(-6px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .menu-popup {
          animation: menuPopIn 0.16s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transform-origin: top center;
        }

        /* Блоки вітрини.
           Синій пунктир по периметру кожного блоку при наведенні
           перетворював сторінку на конструктор: власник дивиться, як
           заклад виглядатиме для КЛІЄНТА, а бачить обведені рамки.

           Лишилась м'яка підкладка кольору матчі - її досить, щоб
           зрозуміти, що блок редагується, і вона не сперечається
           з самим вмістом. */
        .editable-block { position: relative; border-radius: 16px; transition: background-color 0.18s ease; }
        .editable-block:hover { background-color: rgba(194, 216, 196, 0.1); }
        .edit-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(194, 216, 196, 0.12); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.18s ease; cursor: pointer; border-radius: inherit; }
        .editable-block:hover .edit-overlay { opacity: 1; }
        .edit-btn { background: #222222; color: #fff; padding: 0.6rem 1.2rem; border-radius: 10px; font-weight: 600; border: none; display: flex; gap: 0.5rem; align-items: center; font-size: 0.875rem; font-family: inherit; cursor: pointer; }
        .edit-btn:hover { background: #000; }

        /* Поля редагування у вітрині.
           Пунктирна рамка при наведенні й синє кільце у фокусі
           перетворювали сторінку на форму: людина дивиться, як заклад
           виглядатиме для клієнта, а бачить обведені прямокутники.
           Лишилась м'яка підкладка - її досить, щоб зрозуміти, що
           текст редагується. */
        .inline-input { border: none; background: transparent; font-family: inherit; transition: background-color 0.15s ease; border-radius: 8px; padding: 2px 6px; margin-left: -6px; }
        .inline-input:hover { background: rgba(194, 216, 196, 0.16); }
        .inline-input:focus { background: rgba(194, 216, 196, 0.24); outline: none; }

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
        .search-input:focus { background: #fff; border-color: #8FAE93; box-shadow: 0 0 0 3px rgba(194,216,196,0.25); }

        .modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15,23,42,0.4); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 1000; overflow-y: auto; padding: 2rem 0; }
        .modal-content { background: #fff; width: 100%; max-width: 480px; border-radius: 20px; padding: 2rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); margin: auto; }
        .modal-input { width: 100%; padding: 0.8rem 1rem; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 0.95rem; outline: none; transition: 0.2s; background: #fff; color: #0f172a; font-family: inherit; }
        .modal-input:focus { border-color: #0f172a; box-shadow: 0 0 0 2px rgba(15,23,42,0.1); }
        .modal-label { display: block; font-size: 0.85rem; font-weight: 700; color: #475569; margin-bottom: 0.4rem; }

        .cal-sidebar { width: 280px; display: flex; flexDirection: column; gap: 1.5rem; flexShrink: 0; }
        .cal-grid-row { display: flex; border-bottom: 1px dashed #e2e8f0; position: relative; cursor: pointer; transition: background-color 0.2s; user-select: none; }
        .cal-grid-row:hover { background-color: #f8fafc; }
        .cal-time-col { width: 60px; padding: 0.5rem; font-size: 0.8rem; color: #94a3b8; font-weight: 500; text-align: right; border-right: 1px solid #e2e8f0; flex-shrink: 0; background: #ffffff !important; }
        
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
      `}</style>

      {/* САЙДБАР (Шовковистий Apple SaaS Стиль) */}
      <aside style={{
        width: isSidebarCollapsed ? '76px' : '265px',
        backgroundColor: '#ffffff',
        borderRight: '1px solid #f1f5f9',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        transition: 'width 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)',
        willChange: 'width',
        zIndex: 100,
      }}>

        {/* 1. ВИБІР БІЗНЕСУ (Легкий, не перевантажений дизайн) */}
        <div style={{ position: 'relative', padding: isSidebarCollapsed ? '0.85rem 0.5rem' : '0.85rem 0.75rem' }} ref={bizMenuRef}>
          <div
            onClick={() => setIsBizMenuOpen(!isBizMenuOpen)}
            style={{
              backgroundColor: isBizMenuOpen ? '#f8fafc' : 'transparent',
              borderRadius: '12px',
              padding: isSidebarCollapsed ? '0.35rem' : '0.45rem 0.6rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
              boxSizing: 'border-box',
            }}
            onMouseOver={e => {
              if (!isBizMenuOpen) e.currentTarget.style.backgroundColor = '#f8fafc';
            }}
            onMouseOut={e => {
              if (!isBizMenuOpen) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', minWidth: 0 }}>
              <div style={{
                flexShrink: 0,
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.95rem',
                fontWeight: '700',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              }}>
                {(business?.cover_photo || business?.logo) ? (
                  <SmartImage src={business.cover_photo || business.logo} alt={business?.name || 'Лого'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  business?.name?.charAt(0).toUpperCase() || 'B'
                )}
              </div>

              {/* Плавне зникнення тексту без ламання рядків */}
              <div style={{
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                maxWidth: isSidebarCollapsed ? 0 : '140px',
                opacity: isSidebarCollapsed ? 0 : 1,
                transform: isSidebarCollapsed ? 'translateX(-6px)' : 'translateX(0)',
                transition: 'max-width 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s ease, transform 0.2s ease',
                pointerEvents: isSidebarCollapsed ? 'none' : 'auto',
              }}>
                <div style={{ color: '#0f172a', fontSize: '0.92rem', fontWeight: '700', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {business?.name || 'Завантаження'}
                </div>
              </div>
            </div>

            {!isSidebarCollapsed && (
              <div style={{
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                transform: isBizMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)',
                flexShrink: 0,
                marginLeft: '0.4rem',
              }}>
                <Icons.ChevronDown />
              </div>
            )}
          </div>

          {/* Легке плаваюче меню вибору закладів */}
          {isBizMenuOpen && (
            <div
              className="menu-popup"
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: isSidebarCollapsed ? 'calc(100% + 8px)' : '0.75rem',
                right: isSidebarCollapsed ? 'auto' : '0.75rem',
                width: isSidebarCollapsed ? '230px' : 'calc(100% - 1.5rem)',
                backgroundColor: '#ffffff',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: '14px',
                padding: '0.4rem',
                boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.12), 0 4px 10px -2px rgba(0, 0, 0, 0.04)',
                zIndex: 300,
                boxSizing: 'border-box',
              }}
            >
              <div style={{ padding: '0.35rem 0.6rem 0.45rem 0.6rem', fontSize: '0.68rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Ваші заклади
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {myBusinesses.map(biz => {
                  const isActive = business?.id === biz.id;
                  const photo = biz.cover_photo || biz.logo;

                  return (
                    <button
                      key={biz.id}
                      type="button"
                      onClick={() => {
                        setIsBizMenuOpen(false);
                        if (!isActive) void loadSpecificBusiness(biz.id);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.65rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: isActive ? '#f1f5f9' : 'transparent',
                        border: 'none',
                        borderRadius: '9px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background-color 0.12s ease',
                        boxSizing: 'border-box',
                      }}
                      onMouseOver={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                      onMouseOut={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                        <div style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '7px',
                          backgroundColor: photo ? 'transparent' : (isActive ? '#0f172a' : '#f1f5f9'),
                          color: isActive ? '#ffffff' : '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          flexShrink: 0,
                          overflow: 'hidden',
                        }}>
                          {photo ? <SmartImage src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : biz.name?.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: '0.88rem', fontWeight: isActive ? '700' : '500', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {biz.name}
                        </span>
                      </div>

                      {isActive && (
                        <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#0f172a', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '800', flexShrink: 0, marginLeft: '0.4rem' }}>
                          ✓
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '0.35rem 0.2rem' }}></div>

              <button
                type="button"
                onClick={() => router.push('/business/register')}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.65rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '9px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.12s ease',
                  boxSizing: 'border-box',
                }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', background: '#f1f5f9', borderRadius: '7px', color: '#475569', flexShrink: 0 }}>
                  <Icons.Plus />
                </div>
                <span style={{ fontSize: '0.86rem', fontWeight: '600', color: '#334155' }}>
                  Створити заклад
                </span>
              </button>
            </div>
          )}
        </div>

        {/* 2. НАВІГАЦІЯ */}
        <nav className="apple-sidebar-nav" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: isSidebarCollapsed ? '0 0.5rem' : '0 0.75rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {!isSidebarCollapsed && (
            <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.4rem 0.75rem', marginTop: '0.3rem' }}>
              Робоче середовище
            </div>
          )}

          {navItems
            .filter(item => {
              const role = userProfile?.role;
              if (isOwnerRole(role)) return true;
              if (role === 'admin') {
                return ['Calendar', 'Clients', 'Services', 'Team', 'Inventory', 'Stats'].includes(item.id);
              }
              return ['Calendar', 'Clients', 'Services', 'Team'].includes(item.id);
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
                    width: isSidebarCollapsed ? '42px' : '100%',
                    height: isSidebarCollapsed ? '42px' : 'auto',
                    padding: isSidebarCollapsed ? '0' : '0.55rem 0.75rem',
                    backgroundColor: isActive ? '#f1f5f9' : 'transparent',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    color: isActive ? '#0f172a' : '#64748b',
                    transition: 'all 0.15s ease',
                    textAlign: 'left'
                  }}
                  onMouseOver={e => { if (!isActive) { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.color = '#0f172a'; } }}
                  onMouseOut={e => { if (!isActive) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#64748b'; } }}
                >
                  <div style={{ flexShrink: 0, color: isActive ? '#0f172a' : '#94a3b8', display: 'flex', transition: '0.15s' }}>
                    <item.icon />
                  </div>
                  <div style={{
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    maxWidth: isSidebarCollapsed ? 0 : '180px',
                    opacity: isSidebarCollapsed ? 0 : 1,
                    marginLeft: isSidebarCollapsed ? 0 : '0.75rem',
                    transform: isSidebarCollapsed ? 'translateX(-6px)' : 'translateX(0)',
                    transition: 'max-width 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s ease, margin-left 0.28s ease',
                    pointerEvents: isSidebarCollapsed ? 'none' : 'auto',
                  }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: isActive ? '600' : '500' }}>{item.label}</span>
                  </div>
                </button>
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
        <div style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: 'auto' }}>

          <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
             <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                style={{
                  background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                  justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                  width: isSidebarCollapsed ? '42px' : '100%',
                  height: isSidebarCollapsed ? '42px' : 'auto',
                  padding: isSidebarCollapsed ? '0' : '0.55rem 0.65rem',
                  borderRadius: '10px', transition: '0.15s', gap: '0.75rem'
                }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
             >
               <Icons.SidebarToggle collapsed={isSidebarCollapsed} />
               <div style={{
                 overflow: 'hidden',
                 whiteSpace: 'nowrap',
                 maxWidth: isSidebarCollapsed ? 0 : '150px',
                 opacity: isSidebarCollapsed ? 0 : 1,
                 transform: isSidebarCollapsed ? 'translateX(-6px)' : 'translateX(0)',
                 transition: 'max-width 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s ease, transform 0.2s ease',
                 pointerEvents: isSidebarCollapsed ? 'none' : 'auto',
               }}>
                 <span style={{ fontSize: '0.88rem', fontWeight: '600' }}>Згорнути меню</span>
               </div>
             </button>
          </div>

          <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '0.2rem 0' }}></div>

          {/* Картка користувача знизу з актуальною посадою */}
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', width: '100%' }} ref={profileMenuRef}>
            <div onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                 style={{
                   width: isSidebarCollapsed ? '42px' : '100%',
                   height: isSidebarCollapsed ? '42px' : 'auto',
                   padding: isSidebarCollapsed ? '0' : '0.45rem 0.6rem',
                   borderRadius: '12px',
                   display: 'flex', alignItems: 'center',
                   justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                   gap: isSidebarCollapsed ? '0' : '0.7rem', cursor: 'pointer', transition: '0.15s',
                   backgroundColor: isProfileMenuOpen ? '#f8fafc' : 'transparent'
                 }}
                 onMouseOver={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                 onMouseOut={e => { if(!isProfileMenuOpen) e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <Avatar name={userProfile?.full_name} src={userProfile?.avatar_url} size={34} />
              <div style={{
                flex: isSidebarCollapsed ? 'none' : 1,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                maxWidth: isSidebarCollapsed ? 0 : '160px',
                opacity: isSidebarCollapsed ? 0 : 1,
                transform: isSidebarCollapsed ? 'translateX(-6px)' : 'translateX(0)',
                transition: 'max-width 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s ease, transform 0.2s ease',
                pointerEvents: isSidebarCollapsed ? 'none' : 'auto',
              }}>
                <div style={{ color: '#0f172a', fontSize: '0.92rem', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {userProfile?.full_name || 'Користувач'}
                </div>
                <div style={{ color: '#64748b', fontSize: '0.78rem', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {userRoleDisplay}
                </div>
              </div>
            </div>

            {isProfileMenuOpen && (
              <div className="menu-popup" style={{
                position: 'absolute', bottom: 'calc(100% + 6px)', left: isSidebarCollapsed ? 'calc(100% + 8px)' : '0', width: isSidebarCollapsed ? '210px' : '100%',
                backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '14px', padding: '0.4rem',
                boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.12), 0 4px 10px -2px rgba(0, 0, 0, 0.04)', zIndex: 200
              }}>
                <div style={{ padding: '0.35rem 0.65rem 0.45rem 0.65rem', borderBottom: '1px solid #f1f5f9', marginBottom: '0.25rem' }}>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '800' }}>Акаунт</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: '700', color: '#0f172a', marginTop: '2px', wordWrap: 'break-word' }}>{userProfile?.full_name}</div>
                </div>
                <button onClick={() => router.push('/')} style={{ width: '100%', padding: '0.5rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.65rem', background: 'transparent', border: 'none', color: '#475569', fontSize: '0.88rem', cursor: 'pointer', borderRadius: '8px', transition: '0.12s', textAlign: 'left', fontWeight: '500' }} onMouseOver={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.color = '#0f172a'; }} onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#475569'; }}>
                  <Icons.Globe /> Головна сторінка
                </button>
                <button onClick={() => router.push('/profile')} style={{ width: '100%', padding: '0.5rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.65rem', background: 'transparent', border: 'none', color: '#475569', fontSize: '0.88rem', cursor: 'pointer', borderRadius: '8px', transition: '0.12s', textAlign: 'left', fontWeight: '500' }} onMouseOver={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.color = '#0f172a'; }} onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#475569'; }}>
                  <Icons.User /> Налаштування
                </button>
                <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '0.25rem 0' }}></div>
                <button onClick={handleLogout} style={{ width: '100%', padding: '0.5rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.65rem', background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.88rem', cursor: 'pointer', borderRadius: '8px', transition: '0.12s', textAlign: 'left', fontWeight: '600' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#fef2f2'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                  <Icons.LogOut /> Вийти з системи
                </button>
              </div>
            )}
          </div>

        </div>
      </aside>

      {/* ГОЛОВНА РОБОЧА ЗОНА */}
      <main className="custom-scroll" style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff', overflowY: 'auto', position: 'relative' }}>

        {subscription?.has_access && subscription.days_left !== null &&
         (subscription.is_trial || subscription.days_left <= 7) &&
         (subscription.days_left <= 2 || Date.now() > bannerHiddenUntil) && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            gap: '0.75rem', flexWrap: 'wrap',
            padding: '0.6rem 1.5rem',
            background: subscription.days_left <= 3 ? '#FDF6E9' : '#F4FAF5',
            borderBottom: `1px solid ${subscription.days_left <= 3 ? 'rgba(180,130,40,0.22)' : '#E4EBE3'}`,
            fontSize: '0.85rem', color: '#2E3A30', flexShrink: 0,
          }}>
            <span>
              {subscription.is_trial ? 'Пробний період' : 'Підписка'}
              {' '}закінчується{' '}
              <b>{subscription.days_left === 0
                ? 'сьогодні'
                : `через ${subscription.days_left} ${subscription.days_left === 1 ? 'день' : subscription.days_left < 5 ? 'дні' : 'днів'}`}</b>
            </span>
            <button
              onClick={async () => {
                try {
                  const token = await getAuthToken();
                  const checkout = await api.createSubscriptionCheckout(token, business.id);
                  if (checkout.payment_url) { window.location.href = checkout.payment_url; return; }
                  if (checkout.activated) {
                    const me = await api.getMyProfile(token);
                    setSubscription(me.subscription ?? null);
                    showToast(`Підписку продовжено на ${checkout.period_days} днів`, 'info');
                    return;
                  }
                  showToast('Оплата ще не налаштована. Зверніться до підтримки.', 'error');
                } catch (err: any) {
                  showToast(err?.message || 'Не вдалося створити платіж', 'error');
                }
              }}
              style={{
                height: '30px', padding: '0 0.85rem', borderRadius: '8px', border: 'none',
                background: '#222222', color: '#fff', fontSize: '0.8rem', fontWeight: 600,
                fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
              }}
            >
              Продовжити
            </button>

            {subscription.days_left > 2 && (
              <button
                onClick={() => {
                  const until = Date.now() + 24 * 60 * 60 * 1000;
                  localStorage.setItem('bookera_sub_banner_hidden', String(until));
                  setBannerHiddenUntil(until);
                }}
                title="Нагадати завтра"
                style={{
                  width: '26px', height: '26px', borderRadius: '50%', border: 'none',
                  background: 'transparent', color: '#6B756A', cursor: 'pointer',
                  fontSize: '1rem', lineHeight: 1, flexShrink: 0,
                }}
              >
                ×
              </button>
            )}
          </div>
        )}

        {activeTab === 'Calendar' && <CalendarTab business={business} team={team} services={services} userProfile={userProfile} />}
        {activeTab === 'Inventory' && <InventoryTab business={business} team={team} Icons={Icons} />}
        {activeTab === 'Clients' && <ClientsTab business={business} clientsList={clientsList} setClientsList={setClientsList} fetchClientsFromDB={fetchClientsFromDB} onBookAgain={handleBookAgain} />}
        {activeTab === 'Services' && <ServicesTab business={business} services={services} setServices={setServices} Icons={Icons} />}
        {activeTab === 'Storefront' && <StorefrontTab business={business} services={services} team={team} Icons={Icons} setActiveTab={setActiveTab} onNavigate={(tab: string, view?: string) => { setSettingsTarget(view); setActiveTab(tab); }} />}

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

        {activeTab === 'Settings' && <SettingsTab business={business} Icons={Icons} onNavigate={setActiveTab} initialView={settingsTarget} />}

        {clipboardApp && (
           <div style={{ position: 'absolute', top: 0, left: 0, right: 0, background: '#eff6ff', borderBottom: '1px solid #bfdbfe', padding: '0.6rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 101, animation: 'slideDown 0.2s ease-out' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#1d4ed8', fontWeight: '600' }}>
                 <Icons.Edit />
                 <span><b>Скопійовано:</b> {clipboardApp.client_name}. Клікніть на будь-яку вільну годину на сітці, щоб вставити.</span>
              </div>
              <button onClick={() => setClipboardApp(null)} style={{ background: '#dbeafe', border: 'none', color: '#1e3a8a', padding: '0.3rem 0.8rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}>Скасувати</button>
           </div>
        )}

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

      {/* МОДАЛКА ГЛОБАЛЬНОГО ПОШУКУ (CMD+K) */}
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

      {/* МОДАЛЬНЕ ВІКНО ДОДАВАННЯ КЛІЄНТА */}
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

      {/* МОДАЛЬНЕ ВІКНО КАРТКИ КЛІЄНТА */}
      {viewingClient && (
        <div className="modal-overlay" onClick={() => setViewingClient(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ animation: 'slideUp 0.3s ease', maxWidth: '850px', padding: 0, overflow: 'hidden' }}>

            <div style={{ padding: '2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                <Avatar name={viewingClient.name} size={64} />
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
                            <div style={{ fontWeight: '700', color: isFuture ? '#6F9273' : '#5C7A61', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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

      {/* МОДАЛЬНЕ ВІКНО НОВОГО ЗАПИСУ */}
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

      {/* МОДАЛЬНЕ ВІКНО ДЕТАЛЕЙ ЗАПИСУ */}
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
                    style={{ fontSize: '1.1rem', fontWeight: '800', color: '#2E3A30', border: 'none', background: 'transparent', outline: 'none', cursor: 'pointer', padding: 0 }}
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

            {selectedBooking.status !== 'blocked' && selectedBooking.color !== 'blocked' && (
              <div style={{ marginBottom: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '700', display: 'block', marginBottom: '0.8rem', textTransform: 'uppercase' }}>Дії з візитом</span>

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

      {/* МОДАЛЬНЕ ВІКНО ПІДТВЕРДЖЕННЯ ПЕРЕНЕСЕННЯ */}
      {dragConfirmData && (
        <div className="modal-overlay" onClick={() => setDragConfirmData(null)} style={{ zIndex: 2000 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)', maxWidth: '420px', textAlign: 'center', padding: '2.5rem' }}>

            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#F4FAF5', color: '#6F9273', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
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
                  <span style={{ fontSize: '0.7rem', color: '#6F9273', fontWeight: '800', textTransform: 'uppercase', marginBottom: '2px' }}>Стане</span>
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
                    style={{ fontSize: '1.2rem', fontWeight: '800', color: '#2E3A30', border: 'none', background: 'transparent', outline: 'none', cursor: 'pointer', padding: 0 }}
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

      {/* МОДАЛЬНЕ ВІКНО НАЛАШТУВАННЯ КАЛЕНДАРЯ */}
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
                    localStorage.setItem(`bookera_cal_settings_${business.id}`, JSON.stringify(calSettings));
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

      {/* МОДАЛКА НАЛАШТУВАННЯ РОБОЧИХ ЗМІН */}
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