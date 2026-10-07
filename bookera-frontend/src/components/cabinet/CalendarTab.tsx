'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Icons, masterPalette, toLocalDateStr, checkSameDay, CurrentTimeIndicator } from '@/components/shared';
import { isOwnerRole } from '@/lib/roles';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';
import { useToast } from '@/context/ToastContext';
import { formatDuration } from '@/lib/duration';
import HelpTip from '@/components/ui/HelpTip';

// Іконка для чекбоксу в стилі Apple
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

// Масиви пастельних кольорів для справ
const TASK_COLORS = ['#fdf4ff', '#f0fdf4', '#fffbeb', '#f0f9ff', '#fff1f2'];
const TASK_BORDERS = ['#f5d0fe', '#bbf7d0', '#fde68a', '#bae6fd', '#fecdd3'];

const statusStyle: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: 'Завершено', color: '#3F6F4B', bg: '#EAF4EC' },
  cancelled: { label: 'Скасовано', color: '#64748b', bg: '#f1f5f9' },
  'no-show': { label: 'Не прийшов', color: '#B42318', bg: '#FEECEA' },
  pending: { label: 'Очікує', color: '#8A5A00', bg: '#FFF4DC' },
};
const minutesOf = (a: any) => {
  const t = (v: any) => { const m = String(v || '').match(/(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
  const st = t(a.start_time), en = t(a.end_time);
  return st !== null && en !== null && en > st ? en - st : (a.duration || null);
};
const fmtMin = (m: number | null) => !m ? '' : m >= 60 ? `${Math.floor(m / 60)} год${m % 60 ? ` ${m % 60} хв` : ''}` : `${m} хв`;

export default function CalendarTab({ business, team = [], services = [], refreshClients, userProfile }: any) {
  // Години роботи закладу - лише власник і адміністратор.
  const canEditSalonHours = isOwnerRole(userProfile?.role) || userProfile?.role === 'admin';
  const { showToast } = useToast();
  const now = new Date();

  // Стейт завантаження для кнопок збереження
  const [isSavingCalSettings, setIsSavingCalSettings] = useState(false);
  const [isSavingShifts, setIsSavingShifts] = useState(false);
  const [isSavingAppt, setIsSavingAppt] = useState(false);

  // --- РЕФЕРЕНСИ ---
  const masterFilterRef = useRef<HTMLDivElement>(null);

  // --- СТАНИ КАЛЕНДАРЯ ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('day');
  // День можна дивитись сіткою (за годинами) або списком за майстрами - список зручніший на телефоні.
  const [dayLayout, setDayLayout] = useState<'grid' | 'list'>('grid');
  const [listExpanded, setListExpanded] = useState<Record<string, boolean>>({});
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  // Місяць на телефоні (як у Apple Календарі): дотик по дню лише вибирає його, записи дня - під сіткою
  const [monthSel, setMonthSel] = useState<Date | null>(null);
  // Тиждень і місяць у списку: дні згорнуті, крім сьогоднішнього; клік по дню відкриває/закриває його
  const [agendaOpen, setAgendaOpen] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!viewMenuOpen) return;
    const close = () => setViewMenuOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [viewMenuOpen]);
  // Пошук клієнта по всіх записах: знайти, коли людина записана, було
  // неможливо - доводилось гортати календар вручну.
  const [clientSearch, setClientSearch] = useState('');
  const [appointments, setAppointments] = useState<any[]>([]);
  const [tasks, setTasks] = useState<{id: number, text: string, completed: boolean, date: string}[]>([]);

  const [calSettings, setCalSettings] = useState({
    // Лишився лише вигляд за замовчуванням.
    //
    // colorScheme (пастельні/яскраві) і colorMode (за майстром/за послугою)
    // прибрані свідомо: кожен подвоював гілки в коді забарвлення карток,
    // а обирали їх один раз і забували. Один продуманий варіант - пастель
    // із кольором за майстром - працює краще за два посередні.
    defaultView: 'day',
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

  // 🟢 Автоматична фіксація майстра, якщо увійти з роллю 'master'
  const isMasterUser = userProfile?.role === 'master';
  const myMasterId = team.find((m: any) => m.email === userProfile?.email || m.id === userProfile?.id)?.id;

  const [filterMaster, setFilterMaster] = useState<string>(isMasterUser && myMasterId ? String(myMasterId) : 'all');

  useEffect(() => {
    if (isMasterUser && myMasterId) {
      setFilterMaster(String(myMasterId));
    }
  }, [isMasterUser, myMasterId]);
  const [isMasterFilterOpen, setIsMasterFilterOpen] = useState(false);
  const [clipboardApp, setClipboardApp] = useState<any>(null);
  const [apptAddonIds, setApptAddonIds] = useState<number[]>([]);
  // Останнє перенесення - щоб його можна було відкотити одним кліком.
  // Перетягнути картку не туди легко, а згадувати, звідки саме її
  // перетягнули, доводиться по памʼяті.
  const [lastMove, setLastMove] = useState<any>(null);
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, app: any} | null>(null);
  const [dragConfirmData, setDragConfirmData] = useState<{app: any, targetDate: Date, newStart: string, newEnd: string} | null>(null);

  // --- МОДАЛКИ ТА ФОРМИ ---
  const [showCalSettingsModal, setShowCalSettingsModal] = useState(false);
  const [showShiftsModal, setShowShiftsModal] = useState(false);
  const [isApptModalOpen, setIsApptModalOpen] = useState(false);
  const [isBlockMode, setIsBlockMode] = useState(false);
  const [apptForm, setApptForm] = useState({ client_name: '', client_phone: '+380', service_id: '', staff_id: '', date: toLocalDateStr(new Date()), time: '10:00', block_reason: '', duration: 60 });
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [isBookingDetailsModalOpen, setIsBookingDetailsModalOpen] = useState(false);

  // --- МЕНЕДЖЕР ЗАДАЧ ---
  const [showTaskInfoModal, setShowTaskInfoModal] = useState(false);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingTaskText, setEditingTaskText] = useState('');
  const [hasSeenTaskInfo, setHasSeenTaskInfo] = useState(false);

// Синхронізація даних при зміні бізнесу
  useEffect(() => {
    if (!business?.id) return;

    void (async () => {
      try {
        const token = await getAuthToken();
        const list = await api.listTasks(token, business.id);
        setTasks(list.map((t: any) => ({ ...t, date: t.task_date })));
      } catch {}
    })();

    if (business.cal_settings) setCalSettings(business.cal_settings);

    // Завантажуємо актуальний розклад із business_hours
    void (async () => {
      try {
        const token = await getAuthToken();
        const dayNames = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота', 'Неділя'];
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/crm/businesses/${business.id}/hours`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const loaded = dayNames.map((day, idx) => {
              const item = data.find((h: any) => h.weekday === idx);
              return {
                day,
                active: item ? Boolean(item.is_open) : idx !== 6,
                start: item?.open_time ? String(item.open_time).substring(0, 5) : '09:00',
                end: item?.close_time ? String(item.close_time).substring(0, 5) : '20:00',
              };
            });
            setShifts(loaded);
          }
        }
      } catch (e) {
        console.error('Помилка завантаження графіку:', e);
      }
    })();
  }, [business?.id]);

  // Відновлення налаштувань календаря після перезавантаження.
  // Раніше читався ЛИШЕ поточний вигляд, а кольорова схема й режим
  // забарвлення карток губились - їх зберігали, але ніколи не читали.
  useEffect(() => {
    if (!business?.id) return;

    const savedSettings = localStorage.getItem(`bookera_cal_settings_${business.id}`);
    let restored: any = null;
    if (savedSettings) {
      try {
        restored = JSON.parse(savedSettings);
        setCalSettings(prev => ({ ...prev, ...restored }));
      } catch {
        // Пошкоджений запис не має ламати вкладку - лишаємо усталені значення.
      }
    }

    // Поточний вигляд має пріоритет над усталеним: якщо людина перемкнулась
    // на місяць вручну, після перезавантаження вона очікує побачити місяць.
    try {
      const savedLayout = localStorage.getItem('bookera_dayLayout');
      if (savedLayout === 'list' || savedLayout === 'grid') setDayLayout(savedLayout);
    } catch { /* приватний режим */ }
    const savedView = localStorage.getItem('bookera_calendarView');
    if (savedView) setCalendarView(savedView as any);
    else if (restored?.defaultView) setCalendarView(restored.defaultView);
  }, [business?.id]);

  // Закриття меню при кліку зовні
  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    document.addEventListener("click", closeMenu);
    document.addEventListener("contextmenu", closeMenu);
    function handleClickOutside(event: MouseEvent) {
      if (masterFilterRef.current && !masterFilterRef.current.contains(event.target as Node)) {
        setIsMasterFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("click", closeMenu);
      document.removeEventListener("contextmenu", closeMenu);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 🟢 ГАРЯЧІ КЛАВІШІ (PRO SHORTCUTS)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

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
        setApptForm({ client_name: '', client_phone: '+380', service_id: '', staff_id: filterMaster !== 'all' ? filterMaster : '', date: toLocalDateStr(currentDate), time: '10:00', block_reason: '', duration: 60 });
        setIsBlockMode(false); setIsApptModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentDate, calendarView, filterMaster]);

 // Завантаження записів (FastAPI + Supabase Fallback)
  useEffect(() => {
    async function fetchAppointments() {
      if (!business) return;

      try {
        const token = await getAuthToken();
        const apiData = await api.getBookedAppointments(token, business.id);

        const mapped = apiData.map((app: any) => {
          const start = new Date(app.start_time);
          const end = new Date(app.end_time);
          const pad = (n: number) => String(n).padStart(2, '0');
          const result = {
            ...app,
            staff_id: app.master_id,
            booking_date: toLocalDateStr(start),
            start_time: `${pad(start.getHours())}:${pad(start.getMinutes())}:00`,
            end_time: `${pad(end.getHours())}:${pad(end.getMinutes())}:00`,
          };

          // Автозавершення минулих візитів переїхало на бекенд
          // (services/reminders.py, фоновий цикл раз на годину).
          //
          // Тут воно спрацьовувало лише коли хтось відкривав календар:
          // заклад не заходив тиждень - тиждень записів висіли
          // «підтвердженими», і виплати майстрам рахувались неправильно.
          //
          // Показуємо статус як він є. Розбіжність між екраном і базою
          // гірша за короткий проміжок, поки фоновий процес не спрацював.
          return result;
        });

        setAppointments(mapped);
      } catch (e: any) {
        console.error("Помилка завантаження записів:", e);
      }
    }
    fetchAppointments();
  }, [currentDate.getFullYear(), currentDate.getMonth(), business?.id]);


  // --- ФУНКЦІЇ ДАТ ТА УТИЛІТИ ---
  const formatDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const realTodayStr = formatDateKey(now);
  const hasOverdueTasks = (dateObj: Date) => tasks.some((t: any) => t.date === formatDateKey(dateObj) && !t.completed && t.date < realTodayStr);
  const getUserInitials = (name: string) => {
    if (!name) return 'В';
    const parts = name.split(' ');
    return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0][0].toUpperCase();
  };

  const handleSaveCalSettings = async () => {
    if (!business?.id || isSavingCalSettings) return;
    setIsSavingCalSettings(true);
    try {
      // Суто вигляд календаря (кольори, режим перегляду), не бізнес-дані -
      // достатньо зберігати локально в браузері.
      await new Promise(resolve => setTimeout(resolve, 500));
      localStorage.setItem(`bookera_cal_settings_${business.id}`, JSON.stringify(calSettings));

      // Раніше налаштування зберігались, але вигляд НЕ перемикався:
      // людина обирала «Тиждень», бачила «Збережено» - і лишалась у дні.
      // Тепер обраний вигляд застосовується одразу і запамʼятовується
      // окремим ключем, щоб пережити перезавантаження сторінки.
      const view = calSettings.defaultView as 'day' | 'week' | 'month';
      setCalendarView(view);
      localStorage.setItem('bookera_calendarView', view);

      showToast('Налаштування календаря збережено', 'success');
      setShowCalSettingsModal(false);
    } catch (err: any) {
      showToast('Помилка збереження налаштувань', 'error');
    } finally {
      setIsSavingCalSettings(false);
    }
  };

const handleSaveShifts = async () => {
    if (!business?.id || isSavingShifts) return;
    setIsSavingShifts(true);
    try {
      const token = await getAuthToken();
      const dayNames = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота', 'Неділя'];
      const hoursPayload = shifts.map((s: any) => ({
        weekday: dayNames.indexOf(s.day),
        is_open: Boolean(s.active),
        open_time: s.start ? s.start.substring(0, 5) : '09:00',
        close_time: s.end ? s.end.substring(0, 5) : '20:00',
      }));

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/crm/businesses/${business.id}/hours`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(hoursPayload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Не вдалося зберегти графік');
      }

      showToast('Графік змін закладу збережено', 'success');
      setShowShiftsModal(false);
    } catch (err: any) {
      showToast(err?.message || 'Помилка збереження графіка', 'error');
    } finally {
      setIsSavingShifts(false);
    }
  };
  const handleAddTaskClick = () => { if (!hasSeenTaskInfo && tasks.length === 0) setShowTaskInfoModal(true); else setIsAddingTask(true); };
  const confirmTaskInfo = () => { setHasSeenTaskInfo(true); setShowTaskInfoModal(false); setIsAddingTask(true); };
  // Справи тепер на бекенді, а не в localStorage: список, у який
  // записують робочі справи, має бути видно з будь-якого пристрою
  // і не зникати при чистці кешу браузера.
  //
  // Скрізь оптимістичне оновлення: інтерфейс змінюється одразу, а якщо
  // запит не пройшов - повертаємо як було й кажемо про це. Чекати на
  // сервер, щоб побачити галочку, у щоденній роботі дратує.
  const saveNewTask = async () => {
    if (!newTaskText.trim() || !business?.id) return setIsAddingTask(false);
    const text = newTaskText.trim();
    setNewTaskText(''); setIsAddingTask(false);
    try {
      const token = await getAuthToken();
      const created = await api.createTask(token, {
        business_id: business.id,
        task_date: toLocalDateStr(currentDate),
        text,
      });
      setTasks(prev => [...prev, { ...created, date: created.task_date }]);
    } catch (err: any) {
      showToast(err?.message || 'Не вдалося додати справу', 'error');
    }
  };

  const toggleTask = async (id: number) => {
    const task = tasks.find((t: any) => t.id === id);
    if (!task) return;
    const next = !task.completed;
    setTasks(prev => prev.map((t: any) => t.id === id ? { ...t, completed: next } : t));
    try {
      const token = await getAuthToken();
      await api.updateTask(token, id, { completed: next });
    } catch (err: any) {
      setTasks(prev => prev.map((t: any) => t.id === id ? { ...t, completed: !next } : t));
      showToast(err?.message || 'Не вдалося оновити справу', 'error');
    }
  };

  const startEditTask = (task: any) => { setEditingTaskId(task.id); setEditingTaskText(task.text); };

  const saveEditedTask = async (id: number) => {
    const text = editingTaskText.trim();
    if (!text) return setEditingTaskId(null);
    const before = tasks.find((t: any) => t.id === id)?.text;
    setTasks(prev => prev.map((t: any) => t.id === id ? { ...t, text } : t));
    setEditingTaskId(null);
    try {
      const token = await getAuthToken();
      await api.updateTask(token, id, { text });
    } catch (err: any) {
      setTasks(prev => prev.map((t: any) => t.id === id ? { ...t, text: before ?? t.text } : t));
      showToast(err?.message || 'Не вдалося зберегти справу', 'error');
    }
  };

  const deleteTask = async (id: number) => {
    if (!confirm('Видалити цю справу?')) return;
    const removed = tasks.find((t: any) => t.id === id);
    setTasks(prev => prev.filter((t: any) => t.id !== id));
    try {
      const token = await getAuthToken();
      await api.deleteTask(token, id);
    } catch (err: any) {
      if (removed) setTasks(prev => [...prev, removed]);
      showToast(err?.message || 'Не вдалося видалити справу', 'error');
    }
  };

// --- СИСТЕМА ЗАПИСІВ ---
  const handleSaveAppointment = async () => {
    let finalPhone = '';
    if (!isBlockMode && apptForm.client_phone && apptForm.client_phone !== '+380') {
      const phoneStripped = apptForm.client_phone.replace(/\D/g, '');
      if (phoneStripped.length !== 12) {
        showToast("Некоректний номер! Введіть 9 цифр після +380", 'error', { field: 'appt-phone' });
        return;
      }
      finalPhone = '+' + phoneStripped;
    }

    if (!isBlockMode && !apptForm.client_name.trim()) {
      showToast("Введіть ім'я клієнта", 'error', { field: 'appt-name' });
      return;
    }

    const selectedService = services.find((s: any) => String(s.id) === String(apptForm.service_id));
    if (!isBlockMode && !selectedService) {
      showToast("Оберіть послугу зі списку", 'error', { field: 'appt-service' });
      return;
    }

    setIsSavingAppt(true);
    try {
      const token = await getAuthToken();
      const [hours, minutes] = apptForm.time.split(':').map(Number);
      const startDateTime = new Date(`${apptForm.date}T00:00:00`);
      startDateTime.setHours(hours, minutes, 0, 0);

      // Весь пошук/створення клієнта за телефоном тепер робить бекенд
      // (POST /crm/appointments) - раніше тут було ~15 рядків ручного
      // select+update/insert напряму в Supabase.
      const blockTitle = apptForm.block_reason.trim() || 'Перерва';

      const created = await api.createManualAppointment(token, {
        business_id: business.id,
        service_id: isBlockMode || !apptForm.service_id ? undefined : Number(apptForm.service_id),
        start_time: startDateTime.toISOString(),
        duration_minutes: isBlockMode ? (Number(apptForm.duration) || 60) : (Number(selectedService?.duration_minutes) || 60),
        master_id: apptForm.staff_id ? String(apptForm.staff_id) : undefined,
        client_name: isBlockMode ? blockTitle : apptForm.client_name.trim(),
        client_phone: isBlockMode || !finalPhone ? undefined : finalPhone,
        notes: isBlockMode ? blockTitle : undefined,
        is_block: isBlockMode,
        addon_service_ids: !isBlockMode && apptAddonIds.length > 0 ? apptAddonIds : undefined,
      });

      if (!isBlockMode && refreshClients) refreshClients();

      const pad = (n: number) => String(n).padStart(2, '0');
      const durationVal = isBlockMode ? (Number(apptForm.duration) || 60) : (Number(selectedService?.duration_minutes) || 60);
      const totalEndMinutes = hours * 60 + minutes + durationVal;
      const endH = Math.floor(totalEndMinutes / 60) % 24;
      const endM = totalEndMinutes % 60;
      const localEndTimeStr = `${pad(endH)}:${pad(endM)}:00`;

      setAppointments(prev => [...prev, {
        ...created,
        staff_id: created.master_id || null,
        booking_date: apptForm.date,
        start_time: `${pad(hours)}:${pad(minutes)}:00`,
        end_time: localEndTimeStr,
        status: isBlockMode ? 'blocked' : (created.status || 'confirmed'),
        block_reason: isBlockMode ? blockTitle : undefined,
      }]);
      setIsApptModalOpen(false);
      setApptForm({ client_name: '', client_phone: '+380', service_id: '', staff_id: '', date: toLocalDateStr(currentDate), time: '10:00', block_reason: '', duration: 60 });
      setIsBlockMode(false);
      showToast(isBlockMode ? 'Час успішно заблоковано' : 'Запис успішно створено!', 'success');
    } catch (err: any) {
      showToast(`Помилка: ${err.message}`, "error");
    } finally {
      setIsSavingAppt(false);
    }
  };

  const handleUpdateBookingStatus = async (newStatus: string, specificApp: any = null) => {
    const appToUpdate = specificApp || selectedBooking;
    if (!appToUpdate) return;
    const finalStatus = appToUpdate.status === newStatus ? 'confirmed' : newStatus;
    try {
      const token = await getAuthToken();
      await api.updateAppointmentStatus(token, appToUpdate.id, finalStatus as any);

      setAppointments(prev => prev.map(a => a.id === appToUpdate.id ? { ...a, status: finalStatus } : a));
      if (selectedBooking && selectedBooking.id === appToUpdate.id) {
        setSelectedBooking({ ...selectedBooking, status: finalStatus });
      }

      const statusLabels: any = { completed: 'Виконано', late: 'Запізнення', 'no-show': 'Не прийшов', confirmed: 'Підтверджено' };
      showToast(`Статус змінено: ${statusLabels[finalStatus] || finalStatus}`, 'info');
    } catch (err) {
      showToast("Не вдалося оновити статус запису", "error");
    }
  };

  // Запит клієнта чекає відповіді закладу (режим «підтверджую записи вручну»): підтвердити чи відхилити. Клієнт отримає лист.
  const handleDecideBooking = async (app: any, approve: boolean) => {
    if (!app) return;
    try {
      const token = await getAuthToken();
      await api.updateAppointmentStatus(token, app.id, (approve ? 'confirmed' : 'cancelled') as any);
      setAppointments(prev => approve ? prev.map(a => a.id === app.id ? { ...a, status: 'confirmed' } : a) : prev.filter(a => String(a.id) !== String(app.id)));
      if (selectedBooking && selectedBooking.id === app.id) {
        if (approve) setSelectedBooking({ ...selectedBooking, status: 'confirmed' }); else { setIsBookingDetailsModalOpen(false); setSelectedBooking(null); }
      }
      showToast(approve ? 'Запис підтверджено, клієнт отримає лист' : 'Запис відхилено, клієнт отримає лист', approve ? 'success' : 'info');
    } catch (err: any) {
      showToast(err?.message || 'Не вдалося відповісти на запит', 'error');
    }
  };

  const handleCancelBooking = async (appToCancel?: any) => {
    const target = appToCancel || selectedBooking;
    if (!target) return;
    const isBlock = target.status === 'blocked' || target.color === 'blocked' || !target.service_id;
    if (!confirm(`Ви впевнені, що хочете видалити ${isBlock ? 'цю перерву' : 'цей запис'}?`)) return;

    const targetId = target.id;
    setIsBookingDetailsModalOpen(false);
    setSelectedBooking(null);
    setAppointments(prev => prev.filter(a => String(a.id) !== String(targetId)));

    try {
      const token = await getAuthToken();
      let success = false;
      try {
        await api.updateAppointmentStatus(token, targetId, 'cancelled');
        success = true;
      } catch {}

      if (!success) {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        await fetch(`${baseUrl}/crm/appointments/${targetId}`, {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      }
      showToast(isBlock ? 'Перерву видалено' : 'Запис скасовано', 'success');
    } catch (err: any) {
      setAppointments(prev => [...prev, target]);
      showToast(err?.message || "Помилка при видаленні", "error");
    }
  };

  // Чайові за завершений візит - зберігаємо, коли поле втрачає фокус
  const handleSaveTip = async (amount: number) => {
    if (!selectedBooking) return;
    if (amount === Number(selectedBooking.tip_amount || 0)) return;
    try {
      const token = await getAuthToken();
      const r = await api.setAppointmentTip(token, Number(selectedBooking.id), amount);
      setSelectedBooking((b: any) => b && { ...b, tip_amount: r.tip_amount });
      setAppointments((prev: any[]) => prev.map(a => (a.id === selectedBooking.id ? { ...a, tip_amount: r.tip_amount } : a)));
      showToast(amount ? `Чайові ${amount} ₴ збережено` : 'Чайові прибрано', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Не вдалося зберегти чайові', 'error');
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
        const srv = services.find((s: any) => String(s.id) === String(selectedBooking.service_id));
        duration = Number(srv?.duration_minutes) || 60; // поле сервера - duration_minutes
     }
     const totalEnd = h * 60 + m + duration;
     const newEndStr = `${String(Math.floor(totalEnd / 60) % 24).padStart(2, '0')}:${String(totalEnd % 60).padStart(2, '0')}:00`;
     const newStartStr = `${newStartTime}:00`;
     const isBlock = selectedBooking.status === 'blocked' || selectedBooking.color === 'blocked';
     let newStatus = selectedBooking.status;

     // Зміна статусу на "запізнення" застосовується виключно до клієнтських записів
     if (!isBlock && newStartStr > selectedBooking.start_time && selectedBooking.status !== 'completed') {
       newStatus = 'late';
     }

     const updatedApp = { ...selectedBooking, start_time: newStartStr, end_time: newEndStr, status: newStatus };
     setSelectedBooking(updatedApp);
     setAppointments(prev => prev.map(a => a.id === updatedApp.id ? updatedApp : a));
     if (business) {
       // Запамʼятовуємо стан ДО зміни: якщо сервер відмовить, треба
       // повернути картку на місце, а не лишати екран із неправдою.
       const before = { app: selectedBooking, prevDate: selectedBooking.booking_date, prevStart: selectedBooking.start_time, prevEnd: selectedBooking.end_time, prevStatus: selectedBooking.status };
       try {
         const token = await getAuthToken();
         const newStartIso = new Date(`${selectedBooking.booking_date}T${newStartStr}`);
         await api.rescheduleAppointment(token, updatedApp.id, newStartIso.toISOString());
         setLastMove(before);
       } catch (err: any) {
         setSelectedBooking(selectedBooking);
         setAppointments(prev => prev.map(a => a.id === selectedBooking.id ? selectedBooking : a));
         showToast(err?.message || "Не вдалося перенести запис", "error");
       }
     }
  };

  const handleQuickAdd = (hour: number, targetDate: Date = currentDate) => {
    let currentEffectiveShifts = shifts;
    if (clipboardApp) {
       setApptForm({ client_name: clipboardApp.client_name, client_phone: clipboardApp.client_phone || '+380', service_id: clipboardApp.service_id, staff_id: filterMaster !== 'all' ? filterMaster : clipboardApp.staff_id, date: toLocalDateStr(targetDate), time: `${hour.toString().padStart(2, '0')}:00`, block_reason: '', duration: clipboardApp.duration || 60 });
       setIsBlockMode(false); setIsApptModalOpen(true); setClipboardApp(null);
       return;
    }
    if (filterMaster !== 'all') {
       const m = team.find((t: any) => String(t.id) === String(filterMaster));
       if (m && m.shifts && m.shifts.length === 7) currentEffectiveShifts = m.shifts;
    }
    const shiftIdx = targetDate.getDay() === 0 ? 6 : targetDate.getDay() - 1;
    const shift = currentEffectiveShifts[shiftIdx];
    if (!shift.active && !confirm("⚠️ Увага! У цей день вихідний.\nБажаєте створити запис поза графіком?")) return;
    const displayHour = hour % 24;
    setApptForm({ client_name: '', client_phone: '+380', service_id: '', block_reason: '', duration: 60, date: toLocalDateStr(targetDate), time: `${displayHour.toString().padStart(2, '0')}:00`, staff_id: filterMaster !== 'all' ? filterMaster : '' });
    setIsBlockMode(false); setIsApptModalOpen(true);
  };

  const handleDropAppointment = (e: React.DragEvent, targetDate: Date, targetHour?: number) => {
    e.preventDefault();
    const appId = e.dataTransfer.getData('text/plain');
    if (!appId) return;
    const app = appointments.find(a => String(a.id) === appId);
    if (!app || app.status === 'blocked' || app.color === 'blocked') return;

    let newStartH = parseInt(app.start_time.split(':')[0], 10);
    let newStartM = parseInt(app.start_time.split(':')[1], 10);

    if (targetHour !== undefined) {
       const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
       const y = e.clientY - rect.top;
       const snappedM = Math.floor(y / 15) * 15;
       newStartH = targetHour; newStartM = snappedM;
    }

    const [oldStartH, oldStartM] = app.start_time.split(':').map(Number);
    const [oldEndH, oldEndM] = app.end_time.split(':').map(Number);
    let duration = (oldEndH * 60 + oldEndM) - (oldStartH * 60 + oldStartM);
    if (duration < 0) duration += 24 * 60;
    if (isNaN(duration) || duration <= 0) {
        const srv = services.find((s: any) => String(s.id) === String(app.service_id));
        duration = Number(srv?.duration_minutes) || 60; // поле сервера - duration_minutes
    }

    const totalNewStartMins = newStartH * 60 + newStartM;
    const totalNewEndMins = totalNewStartMins + duration;
    const newEndH = Math.floor(totalNewEndMins / 60) % 24;
    const newEndM = totalNewEndMins % 60;
    const newStartStr = `${String(newStartH).padStart(2, '0')}:${String(newStartM).padStart(2, '0')}:00`;
    const newEndStr = `${String(newEndH).padStart(2, '0')}:${String(newEndM).padStart(2, '0')}:00`;

    if (app.start_time === newStartStr && checkSameDay(app.booking_date || app.start_time, targetDate)) return;
    setDragConfirmData({ app, targetDate, newStart: newStartStr, newEnd: newEndStr });
  };

  const confirmDragDrop = async () => {
    if (!dragConfirmData) return;
    const { app, targetDate, newStart, newEnd } = dragConfirmData;
    const newDateStr = toLocalDateStr(targetDate);
    const isBlock = app.status === 'blocked' || app.color === 'blocked';
    let newStatus = app.status;

    if (!isBlock && newDateStr === app.booking_date && newStart > app.start_time && app.status !== 'completed') {
      newStatus = 'late';
    }

    setAppointments(prev => prev.map(a => String(a.id) === String(app.id) ? { ...a, booking_date: newDateStr, start_time: newStart, end_time: newEnd, status: newStatus } : a ));
    setDragConfirmData(null);
    if (business) {
      const before = { app, prevDate: app.booking_date, prevStart: app.start_time, prevEnd: app.end_time, prevStatus: app.status };
      try {
        const token = await getAuthToken();
        const newStartIso = new Date(`${newDateStr}T${newStart}`);
        await api.rescheduleAppointment(token, app.id, newStartIso.toISOString());
        setLastMove(before);
      } catch (err: any) {
        // Відкочуємо екран до стану до перетягування: показувати картку
        // на новому місці, коли сервер її туди не переніс, - гірше за
        // саму помилку.
        setAppointments(prev => prev.map(a => String(a.id) === String(app.id) ? app : a));
        showToast(err?.message || "Не вдалося перенести запис", "error");
      }
    }
  };

  /**
   * Повертає запис туди, звідки його щойно перенесли.
   *
   * Спершу пишемо на сервер і лише потім оновлюємо екран: якщо відкат
   * не пройде, інтерфейс не має показувати неправду - саме цієї
   * помилки припускалось саме перенесення до цього виправлення.
   */
  // Пропозиція відкотити живе 10 секунд: якщо людина за цей час не
  // помітила помилки, вона вже прийняла нове місце як правильне, і
  // смужка внизу лише заважає.
  useEffect(() => {
    if (!lastMove) return;
    const t = setTimeout(() => setLastMove(null), 10000);
    return () => clearTimeout(t);
  }, [lastMove]);


  const openBookingDetails = (app: any, e: React.MouseEvent) => { e.stopPropagation(); setSelectedBooking(app); setIsBookingDetailsModalOpen(true); };
  const handleContextMenu = (e: React.MouseEvent, app: any) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, app }); };

  const getStatusIcon = (status: string) => {
    if (status === 'completed') return <span title="Завершено" style={{color: '#16a34a', display: 'flex', alignItems: 'center'}}><Icons.CheckCircle /></span>;
    if (status === 'late') return <span title="Запізнюється" style={{color: '#d97706', display: 'flex', alignItems: 'center'}}><Icons.AlertCircle /></span>;
    if (status === 'no-show') return <span title="Не прийшов" style={{color: '#dc2626', display: 'flex', alignItems: 'center'}}><Icons.XCircle /></span>;
    return null;
  };

  const getMasterColor = (staffId: string) => {
    if (!staffId) return { pastelBg: '#f1f5f9', pastelBorder: '#cbd5e1', pastelText: '#475569', vividBg: '#64748b', vividBorder: '#475569' };
    // Номер за відсортованим списком id: колір не залежить від порядку команди у відповіді сервера
    const masterIndex = masterOrder.indexOf(String(staffId));
    if (masterIndex === -1) return masterPalette(0);
    return masterPalette(masterIndex);
  };
  const masterOrder = useMemo(() => (team || []).map((m: any) => String(m.id)).sort(), [team]);

  // Колір картки - завжди за майстром: у салоні з кількома людьми саме
  // це найшвидше відповідає на питання «чий це запис».
  const getCardColor = (staffId: string) => getMasterColor(staffId);

  // --- РОЗРАХУНКИ СІТКИ ---
  const effectiveShifts = useMemo(() => {
    let targetShifts: any = shifts;
    if (filterMaster !== 'all') {
      const m = (team || []).find((t: any) => String(t.id) === String(filterMaster));
      if (m && m.shifts) {
        targetShifts = m.shifts;
      }
    }
    if (typeof targetShifts === 'string') {
      try { targetShifts = JSON.parse(targetShifts); } catch { targetShifts = null; }
    }
    if (Array.isArray(targetShifts) && targetShifts.length === 7) {
      return targetShifts;
    }
    return defaultWeekShifts;
  }, [filterMaster, team, shifts]);

  const activeShifts = Array.isArray(effectiveShifts) ? effectiveShifts.filter((s: any) => s.active) : [];
  let gridStartHour = 8;
  let gridEndHour = 20;

  if (activeShifts.length > 0) {
    gridStartHour = Math.min(...activeShifts.map((s: any) => parseInt(s.start.split(':')[0], 10)));
    gridEndHour = Math.max(...activeShifts.map((s: any) => {
      let h = parseInt(s.end.split(':')[0], 10);
      return h <= gridStartHour ? h + 24 : h;
    }));
  } else if (business) {
     const parseTime = (val: any) => parseInt(String(val).split(':')[0], 10);
     if (business.work_start) gridStartHour = parseTime(business.work_start);
     if (business.work_end) {
        let e = parseTime(business.work_end);
        gridEndHour = e <= gridStartHour ? e + 24 : e;
     }
  }
  if (gridEndHour === gridStartHour) gridEndHour = gridStartHour + 24;

  const gridTotalHours = gridEndHour - gridStartHour;
  const hoursArray = Array.from({length: gridTotalHours}, (_, i) => gridStartHour + i);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => {
    let day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const selectedMonthDay = (monthSel && monthSel.getFullYear() === currentYear && monthSel.getMonth() === currentMonth)
    ? monthSel
    : (now.getFullYear() === currentYear && now.getMonth() === currentMonth ? now : new Date(currentYear, currentMonth, 1));

  const isToday = currentDate.toDateString() === now.toDateString();
  const currentDayIndex = currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1;
  const weekDays = Array.from({length: 7}).map((_, i) => {
    const d = new Date(currentDate); d.setDate(currentDate.getDate() - currentDayIndex + i); return d;
  });
  const isCurrentWeek = weekDays.some(wd => wd.toDateString() === now.toDateString());

  const defaultWeekShifts = [
    { day: 'Понеділок', active: true, start: '09:00', end: '20:00' },
    { day: 'Вівторок', active: true, start: '09:00', end: '20:00' },
    { day: 'Середа', active: true, start: '09:00', end: '20:00' },
    { day: 'Четвер', active: true, start: '09:00', end: '20:00' },
    { day: "П'ятниця", active: true, start: '09:00', end: '20:00' },
    { day: 'Субота', active: true, start: '10:00', end: '18:00' },
    { day: 'Неділя', active: false, start: '09:00', end: '20:00' },
  ];

  // 🟢 Захист від падіння, якщо shift не передано або він undefined
  const renderNonWorkingHours = (shift: any) => {
    if (!shift || typeof shift !== 'object' || !shift.active) {
      return <div className="non-working-bg" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 1, pointerEvents: 'none' }}></div>;
    }
    const startStr = shift.start || '09:00';
    const endStr = shift.end || '20:00';
    const [startH, startM] = startStr.split(':').map(Number);
    const [endH, endM] = endStr.split(':').map(Number);
    const adjustedStartH = startH < gridStartHour ? startH + 24 : startH;
    const adjustedEndH = endH <= startH ? endH + 24 : endH;
    const startPx = Math.max(0, (adjustedStartH - gridStartHour) * 60 + (startM || 0));
    const endPx = Math.max(0, (adjustedEndH - gridStartHour) * 60 + (endM || 0));
    const totalPx = gridTotalHours * 60;
    return (
      <>
        {startPx > 0 && <div className="non-working-bg" style={{ position: 'absolute', top: 0, height: startPx, left: 0, right: 0, zIndex: 1, pointerEvents: 'none' }}></div>}
        {endPx < totalPx && <div className="non-working-bg" style={{ position: 'absolute', top: endPx, bottom: 0, left: 0, right: 0, zIndex: 1, pointerEvents: 'none' }}></div>}
      </>
    );
  };

  const getCardPosition = (startTimeStr: string, endTimeStr: string, defaultDuration: number = 60) => {
    if (!startTimeStr) return { top: 0, height: defaultDuration };
    const [startH, startM] = startTimeStr.split(':').map(Number);
    const adjustedStartH = startH < gridStartHour ? startH + 24 : startH;
    const topPx = (adjustedStartH - gridStartHour) * 60 + startM;
    let durationMins = defaultDuration;
    if (endTimeStr) {
      const [endH, endM] = endTimeStr.split(':').map(Number);
      let adjustedEndH = endH < gridStartHour ? endH + 24 : endH;
      if (adjustedEndH < adjustedStartH || (adjustedEndH === adjustedStartH && endM < startM)) adjustedEndH += 24;
      durationMins = (adjustedEndH - adjustedStartH) * 60 + (endM - startM);
    }
    return { top: topPx, height: durationMins };
  };

  /**
   * Колонки майстрів у денному вигляді.
   *
   * Повертає null, коли колонки не потрібні - тоді працює звичайний
   * режим «усі в одній смузі». Це принципово: у майстра-одинака
   * (манікюр удома, приватний барбер) колонка на одну людину лише
   * забирає ширину й нічого не пояснює.
   *
   * Колонки зʼявляються, коли майстрів справді кілька і не обрано
   * фільтр по конкретному. Тоді порожня колонка одразу означає
   * «ця людина вільна» - а це найчастіше питання, коли дзвонить клієнт.
   */
  const dayColumns = useMemo(() => {
    if (filterMaster !== 'all') return null;
    const masters = (team || []).filter((m: any) => m.provides_services !== false);
    return masters.length >= 2 ? masters : null;
  }, [team, filterMaster]);

  /**
   * Розкладка карток на день.
   *
   * Без колонок - як було: записи, що перетинаються, ділять ширину.
   * З колонками - кожен майстер отримує свою смугу, а всередині неї
   * його власні накладання діляться далі. Записи без майстра йдуть
   * в окрему останню смугу: втратити їх гірше, ніж показати осібно.
   */
  const layoutDayAppointments = useCallback((apps: any[]) => {
    if (!dayColumns) {
      return processOverlaps(apps).map((a: any) => ({
        ...a,
        colStart: (a.colIndex || 0) / (a.colCount || 1),
        colSpan: 1 / (a.colCount || 1),
        isGlobalBlock: !a.staff_id || a.staff_id === 'all',
      }));
    }

    const globalBlocks = apps.filter((a: any) =>
      (a.status === 'blocked' || a.color === 'blocked' || !a.service_id) && (!a.staff_id || a.staff_id === 'all' || a.staff_id === '0')
    ).map((a: any) => {
      const pos = getCardPosition(a.start_time, a.end_time, a.duration || 60);
      return {
        ...a,
        topPx: pos.top,
        heightPx: Math.max(pos.height, 30),
        colStart: 0,
        colSpan: 1,
        colIndex: 0,
        isGlobalBlock: true,
      };
    });

    const masterApps = apps.filter((a: any) =>
      !((a.status === 'blocked' || a.color === 'blocked' || !a.service_id) && (!a.staff_id || a.staff_id === 'all' || a.staff_id === '0'))
    );

    const unassigned = masterApps.filter((a: any) =>
      !a.staff_id || !dayColumns.some((m: any) => String(m.id) === String(a.staff_id)));
    const lanes = [
      ...dayColumns.map((m: any) => ({
        key: String(m.id),
        apps: masterApps.filter((a: any) => String(a.staff_id) === String(m.id)),
      })),
      ...(unassigned.length ? [{ key: '__none', apps: unassigned }] : []),
    ];

    const laneWidth = 1 / lanes.length;
    const placedMasterApps = lanes.flatMap((lane, laneIdx) =>
      processOverlaps(lane.apps).map((a: any) => ({
        ...a,
        colStart: laneIdx * laneWidth + ((a.colIndex || 0) / (a.colCount || 1)) * laneWidth,
        colSpan: laneWidth / (a.colCount || 1),
        isGlobalBlock: false,
      }))
    );

    return [...globalBlocks, ...placedMasterApps];
  }, [dayColumns, services]);

  const processOverlaps = (appsForDay: any[]) => {
    const processed = appsForDay.map((app: any) => {
      const serviceDuration = services.find((s: any) => String(s.id) === String(app.service_id))?.duration || app.duration || 60;
      const pos = getCardPosition(app.start_time, app.end_time, serviceDuration);
      return { ...app, startMins: pos.top, endMins: pos.top + pos.height, topPx: pos.top, heightPx: pos.height };
    }).sort((a: any, b: any) => a.startMins - b.startMins || (b.endMins - b.startMins) - (a.endMins - a.startMins));

    const groups: any[][] = []; let currentGroup: any[] = []; let groupEnd = 0;
    processed.forEach(app => {
      if (app.startMins >= groupEnd) {
        if (currentGroup.length > 0) groups.push(currentGroup);
        currentGroup = [app]; groupEnd = app.endMins;
      } else { currentGroup.push(app); groupEnd = Math.max(groupEnd, app.endMins); }
    });
    if (currentGroup.length > 0) groups.push(currentGroup);

    groups.forEach(group => {
      const columns: any[][] = [];
      group.forEach(app => {
        let placed = false;
        for (let i = 0; i < columns.length; i++) {
          const col = columns[i];
          const lastApp = col[col.length - 1];
          if (lastApp.endMins <= app.startMins) { col.push(app); app.colIndex = i; placed = true; break; }
        }
        if (!placed) { columns.push([app]); app.colIndex = columns.length - 1; }
      });
      group.forEach(app => { app.colCount = columns.length; });
    });
    return processed;
  };

  const tasksForSelectedDay = tasks.filter((t: any) => t.date === formatDateKey(currentDate));

  const filteredAppointments = useMemo(() => appointments.filter(app => {
    if (app.status === 'cancelled') return false;

    const isGlobalBlock = (app.status === 'blocked' || app.color === 'blocked' || !app.service_id) &&
      (!app.staff_id || app.staff_id === 'all' || app.staff_id === '0');

    // Перерва для всього закладу діє для всіх і завжди видима
    if (isGlobalBlock) return true;

    // Якщо обрано конкретного майстра — показуємо лише його записи та його особисті перерви
    if (filterMaster !== 'all') {
      return String(app.staff_id) === String(filterMaster);
    }
    return true;
  }), [appointments, filterMaster]);

  /**
   * Записи, згруповані за днем.
   *
   * Раніше кожна клітинка календаря проганяла ПОВНИЙ список записів
   * через filter + checkSameDay. У місячному вигляді це 30+ проходів
   * по всіх записах закладу на кожен перемальовок, у тижневому - 7.
   * При кількох сотнях записів це помітно гальмувало прокрутку й
   * перетягування.
   *
   * Тепер один прохід будує індекс за датою, а клітинка бере готовий
   * масив за ключем - O(1) замість повного сканування.
   */
  const toCleanDateKey = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'string') {
      const match = val.match(/^\d{4}-\d{2}-\d{2}/);
      if (match) return match[0];
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const app of filteredAppointments) {
      const raw = app.booking_date || app.start_time;
      if (!raw) continue;
      const key = toCleanDateKey(raw);
      if (!key) continue;
      const list = map.get(key);
      if (list) list.push(app);
      else map.set(key, [app]);
    }
    return map;
  }, [filteredAppointments]);

  const getAppointmentsForDay = useCallback(
    (date: Date) => appointmentsByDate.get(toCleanDateKey(date)) || [],
    [appointmentsByDate]
  );

  /**
   * Наскільки щільно зайнятий день - частка робочого часу під записами.
   *
   * Саме частка, а не кількість: «8 записів» нічого не каже, поки не
   * знаєш, скільки вони тривають і який графік у закладі. Півгодинні
   * манікюри й тригодинне фарбування - різна завантаженість при
   * однаковому лічильнику.
   */
  /**
   * Вільні проміжки між записами - куди ще можна когось поставити.
   *
   * Показуємо лише вікна від 30 хвилин: коротші не мають практичного
   * сенсу для салону, а підсвічувати кожні 10 хвилин - зробити сітку
   * рябою й марною.
   *
   * Рахуємо в межах робочого дня: вільний час до відкриття й після
   * закриття - не вікно, а просто неробочий час, він уже показаний
   * штрихуванням.
   */
  const getFreeGaps = useCallback((date: Date, staffId?: string) => {
    const shiftIdx = date.getDay() === 0 ? 6 : date.getDay() - 1;
    const shift = shifts?.[shiftIdx];
    if (!shift?.active) return [];

    const toMin = (t: string) => {
      const [h, m] = String(t).split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const dayStart = toMin(shift.start);
    const dayEnd = toMin(shift.end);
    if (dayEnd <= dayStart) return [];

    const dayAll = (appointmentsByDate.get(toLocalDateStr(date)) || []).filter((a: any) => a.status !== 'cancelled');
    // Для окремого майстра: його записи плюс спільні перерви закладу. Вільний майстер при зайнятих
    // колегах теж отримує «Вільно» - на весь робочий день.
    // Спільна перерва: блок без майстра. Звичайний запис без майстра не займає колег.
    const isShared = (a: any) => (a.status === 'blocked' || a.color === 'blocked' || !a.service_id) && (!a.staff_id || a.staff_id === 'all' || a.staff_id === '0');
    const busy = (staffId === undefined ? dayAll : dayAll.filter((a: any) => String(a.staff_id) === staffId || isShared(a)))
      .map((a: any) => {
        const s = toMin(a.start_time);
        let e = toMin(a.end_time);
        if (e < s) e += 24 * 60;
        return { s, e };
      })
      .sort((a, b) => a.s - b.s);

    const gaps: { start: number; end: number }[] = [];
    let cursor = dayStart;
    for (const b of busy) {
      if (b.s - cursor >= 30) gaps.push({ start: cursor, end: b.s });
      cursor = Math.max(cursor, b.e);
    }
    if (dayEnd - cursor >= 30) gaps.push({ start: cursor, end: dayEnd });

    // Порожній день - це не «вікно», а просто вільний день: підсвічувати
    // його цілком означало б кричати там, де й так усе видно.
    if (dayAll.length === 0) return [];
    return gaps;
  }, [appointmentsByDate, shifts]);

  const getDayLoad = useCallback((date: Date) => {
    const apps = appointmentsByDate.get(toLocalDateStr(date)) || [];
    const real = apps.filter((a: any) => a.status !== 'blocked' && a.color !== 'blocked' && a.status !== 'cancelled');
    if (real.length === 0) return 0;

    const shiftIdx = date.getDay() === 0 ? 6 : date.getDay() - 1;
    const shift = shifts?.[shiftIdx];
    if (!shift?.active) return 1; // запис у вихідний - день зайнятий за визначенням

    const toMin = (t: string) => {
      const [h, m] = String(t).split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const workMinutes = toMin(shift.end) - toMin(shift.start);
    if (workMinutes <= 0) return 0;

    const busy = real.reduce((sum: number, a: any) => {
      const start = toMin(a.start_time);
      let end = toMin(a.end_time);
      if (end < start) end += 24 * 60; // візит через північ
      return sum + Math.max(0, end - start);
    }, 0);

    return Math.min(1, busy / workMinutes);
  }, [appointmentsByDate, shifts]);

  /**
   * Пошук записів за іменем або телефоном клієнта.
   *
   * Шукає по ВСІХ завантажених записах, а не лише по видимому періоду -
   * інакше сенс губиться: людина шукає саме тому, що не знає, коли візит.
   * Показуємо найближчі до сьогодні: спершу майбутні, потім минулі.
   */
  const clientSearchResults = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (q.length < 2) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return filteredAppointments
      .filter((a: any) => {
        if (a.status === 'blocked' || a.color === 'blocked') return false;
        const name = String(a.client_name ?? '').toLowerCase();
        const phone = String(a.client_phone ?? '').replace(/\D/g, '');
        return name.includes(q) || (q.replace(/\D/g, '').length >= 3 && phone.includes(q.replace(/\D/g, '')));
      })
      .map((a: any) => ({ ...a, _date: new Date(a.booking_date || a.start_time) }))
      .sort((a: any, b: any) => {
        const aFuture = a._date >= today, bFuture = b._date >= today;
        if (aFuture !== bFuture) return aFuture ? -1 : 1;
        return aFuture ? a._date - b._date : b._date - a._date;
      })
      .slice(0, 8);
  }, [clientSearch, filteredAppointments]);

  /**
   * Скільки принесе поточний період.
   *
   * Рахуємо лише підтверджені й завершені: скасовані грошей не дають,
   * а показувати їх у сумі означало б обіцяти дохід, якого не буде.
   */
  const currentViewRevenue = useMemo(() => {
    const sumOf = (list: any[]) => list.reduce((s: number, a: any) => {
      if (a.status === 'cancelled' || a.status === 'blocked' || a.color === 'blocked') return s;
      const service = services.find((sv: any) => String(sv.id) === String(a.service_id));
      return s + Number(a.price ?? service?.price ?? 0);
    }, 0);

    if (calendarView === 'day') return sumOf(getAppointmentsForDay(currentDate));
    if (calendarView === 'week') return weekDays.reduce((s, wd) => s + sumOf(getAppointmentsForDay(wd)), 0);

    let total = 0;
    for (const [key, list] of appointmentsByDate) {
      const [y, m] = key.split('-').map(Number);
      if (y === currentDate.getFullYear() && m === currentDate.getMonth() + 1) total += sumOf(list);
    }
    return total;
  }, [calendarView, currentDate, weekDays, appointmentsByDate, getAppointmentsForDay, services]);

  const pendingList = useMemo(() => appointments
    .filter((a: any) => a.status === 'pending_approval')
    .sort((a: any, b: any) => String(a.date || a.start_time).localeCompare(String(b.date || b.start_time))), [appointments]);

  const currentViewAppointmentsCount = useMemo(() => {
    const countReal = (list: any[]) =>
      list.filter(a => a.status !== 'blocked' && a.color !== 'blocked').length;

    if (calendarView === 'day') return countReal(getAppointmentsForDay(currentDate));
    if (calendarView === 'week') return weekDays.reduce((sum, wd) => sum + countReal(getAppointmentsForDay(wd)), 0);

    // Місяць: рахуємо за індексом, без повторного перебору всіх записів
    let total = 0;
    for (const [key, list] of appointmentsByDate) {
      const [y, m] = key.split('-').map(Number);
      if (y === currentDate.getFullYear() && m === currentDate.getMonth() + 1) total += countReal(list);
    }
    return total;
  }, [calendarView, currentDate, weekDays, appointmentsByDate, getAppointmentsForDay]);

  return (
    <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>
      <style>{`
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
        .cal-m-legend { display: none; }
        .cal-m-group-head { display: flex; align-items: center; gap: 0.5rem; padding: 0.9rem 0 0.35rem; }
        .cal-m-group-head b { font-size: 0.95rem; color: #0f172a; }
        .cal-m-group-head span:last-child { margin-left: auto; font-size: 0.78rem; color: #94a3b8; font-weight: 600; }
        .cal-m-agenda { display: none; }
        .cal-m-agenda-head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid #eef1f4; }
        .cal-m-agenda-title { font-size: 1rem; font-weight: 700; color: #0f172a; }
        .cal-m-agenda-sub { font-size: 0.8rem; color: #64748b; margin-top: 2px; }
        .cal-m-agenda-head button { border: 1px solid #e2e8f0; background: #fff; color: #0f172a; border-radius: 999px; padding: 0.35rem 0.8rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
        .cal-m-agenda-more { width: 100%; padding: 0.7rem 0; border: none; background: transparent; color: #475569; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
        .cal-pending-chip { display: inline-flex; align-items: center; gap: 0.4rem; flex-shrink: 0; height: 30px; padding: 0 0.7rem; border-radius: 999px; border: 1px solid #fcd9a1; background: #fff8ec; color: #92400e; font-family: inherit; font-size: 0.8rem; font-weight: 700; cursor: pointer; white-space: nowrap; }
        .cal-pending-chip i { width: 7px; height: 7px; border-radius: 50%; background: #f59e0b; display: block; }
        .cal-pending-chip span { font-weight: 600; }
        .cal-pending-box { border: 1px solid #fcd9a1; background: #fffaf0; border-radius: 12px; padding: 0.8rem 0.9rem; margin-bottom: 0.7rem; display: flex; flex-direction: column; gap: 0.6rem; }
        .cal-pending-box b { display: block; font-size: 0.88rem; color: #92400e; }
        .cal-pending-box span { font-size: 0.78rem; color: #b45309; }
        .cal-pending-btns { display: flex; gap: 0.5rem; }
        .cal-pending-btns button { flex: 1; height: 38px; border-radius: 10px; border: 1px solid #e2e8f0; background: #fff; color: #0f172a; font-family: inherit; font-size: 0.85rem; font-weight: 700; cursor: pointer; }
        .cal-pending-btns button.ok { background: #0f172a; border-color: #0f172a; color: #fff; }
        .status-pending_approval { border: 1.5px dashed #f59e0b !important; }
        .fab-button { position: fixed; right: 1.5rem; bottom: 1.5rem; width: 56px; height: 56px; border-radius: 50%; border: none; background: #0f172a; color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.28); cursor: pointer; z-index: 30; transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .fab-button:hover { transform: scale(1.06); box-shadow: 0 10px 28px rgba(15, 23, 42, 0.34); }
        .fab-button:active { transform: scale(0.96); }
        .fab-button svg { width: 24px; height: 24px; }
        .cal-list-inner { padding: 0 1.75rem 6rem; }
        .cal-list-row { padding-left: 0.75rem !important; padding-right: 0.25rem !important; display: grid; grid-template-columns: 5rem minmax(0, 1.2fr) minmax(0, 1.6fr) 7rem 8.5rem; column-gap: 1.25rem; align-items: center; padding: 0.75rem 0; border-bottom: 1px solid #f4f6f8; cursor: pointer; }
        @media (hover: hover) { .cal-list-row:hover { background: #fafbfc; } }
        .cal-list-row.with-master { grid-template-columns: 5rem minmax(0, 1.2fr) minmax(0, 1.4fr) minmax(0, 0.9fr) 7rem 8.5rem; }
        .cl-status { text-align: right; }
        .cl-m-only { display: none; }
        @media (max-width: 860px) {
          .fab-button { right: 1rem; bottom: 1rem; }
          .cal-pending-chip span { display: none; }
          .cal-list-inner { padding: 0 1rem 6rem; }
          .cal-list-row { grid-template-columns: 3.4rem minmax(0, 1fr) auto; grid-template-areas: "time client price" "time svc status"; column-gap: 0.75rem; row-gap: 2px; padding: 0.65rem 0; }
          .cal-list-row.with-master { grid-template-columns: 3.4rem minmax(0, 1fr) auto; }
          .cl-master { display: none !important; }
          .cl-m-only { display: inline; }
          .cl-time { grid-area: time; }
          .cl-client { grid-area: client; }
          .cl-svc { grid-area: svc; }
          .cl-price { grid-area: price; }
          .cl-status { grid-area: status; justify-self: end; }
        }
        @media (min-width: 861px) and (max-width: 1600px) { .cal-toolbar__count { display: none !important; } }
        .cal-toolbar__right { display: none !important; }
        @media (max-width: 860px) {
          .cal-left { display: none !important; }
          /* Панель у два рядки: зверху дата зі стрілками і шестерня, знизу майстри й вигляд */
          .cal-toolbar { flex-wrap: wrap !important; padding: 0.5rem 0.75rem !important; row-gap: 0.35rem !important; column-gap: 0.25rem !important; }
          .cal-toolbar__rest, .cal-toolbar__rightwrap { display: contents !important; }
          .cal-toolbar__left { order: 1; flex: 1 1 auto !important; flex-shrink: 1 !important; min-width: 0; }
          .cal-gear { order: 2; margin-left: auto; padding: 8px !important; }
          .cal-master-wrap { order: 3; }
          .cal-toolbar__right { display: none !important; }
          .cal-view-menu { order: 4; margin-left: auto; }
          .cal-layout-icons { order: 5; }
          .cal-toolbar__count, .cal-toolbar__search { display: none !important; }
          .cal-toolbar__right { gap: 0 !important; }
          .cal-toolbar__right button { padding: 0.45rem 0.26rem !important; font-size: 0.76rem !important; }
          .cal-master-btn { padding: 0.35rem 0.1rem !important; font-size: 0.78rem !important; gap: 0.2rem !important; }
          .cal-time-input { width: 150px !important; }
          /* Колонка з годинами лишається на місці, коли день гортають убік */
          .cal-day-wrap .cal-time-col { position: sticky; left: 0; z-index: 4; }
          /* Робочі години: день з перемикачем, нижче дві години на всю ширину */
          .cal-shift-row { flex-wrap: wrap; row-gap: 0.5rem; }
          .cal-shift-day { width: 100% !important; }
          .cal-shift-times { width: 100%; }
          .cal-shift-times > div { width: 100%; }
          .cal-shift-times input[type="time"] { flex: 1 1 0; min-width: 0; width: auto !important; font-size: 16px; }
          .cal-m-head, .cal-m-grid { grid-template-columns: repeat(7, minmax(0, 1fr)) !important; }
          .cal-m-head { font-size: 0.65rem !important; letter-spacing: 0 !important; padding: 0.7rem 0 !important; }
          .cal-m-grid { grid-auto-rows: minmax(64px, 1fr) !important; }
          .month-view-cell { padding: 0.3rem 0.15rem !important; align-items: center; min-width: 0; }
          .month-view-cell > div:first-child { flex-direction: column-reverse; align-items: center !important; margin-bottom: 0.2rem !important; }
          .month-view-cell > div:first-child > div { padding-top: 2px !important; }
          .cal-m-chips { display: none !important; }
          .cal-m-dots { display: flex !important; align-items: center; justify-content: center; gap: 3px; margin-top: auto; padding-bottom: 0.2rem; }
          .cal-m-dots i { width: 6px; height: 6px; border-radius: 50%; display: block; }
          .cal-m-dots b { font-size: 0.65rem; font-weight: 700; color: #64748b; margin-left: 2px; }
          /* Місяць на телефоні: рівні невисокі клітинки без рамок, число по центру, під ним крапки майстрів */
          .cal-m-wrap { overflow-y: auto !important; }
          .cal-m-legend { display: flex !important; gap: 0.35rem; overflow-x: auto; padding: 0.35rem 0.75rem 0.1rem; scrollbar-width: none; flex-shrink: 0; }
          .cal-m-legend::-webkit-scrollbar { display: none; }
          .cal-m-legend button { display: inline-flex; align-items: center; gap: 0.4rem; border: none; background: transparent; padding: 0.25rem 0.55rem; font-size: 0.78rem; font-weight: 600; color: #475569; white-space: nowrap; cursor: pointer; }
          .cal-m-legend i { width: 9px; height: 9px; border-radius: 50%; display: block; }
          .cal-m-grid { flex: none !important; overflow: visible !important; grid-auto-rows: 58px !important; align-content: start; padding: 0 0.25rem; }
          .cal-m-num { width: 30px !important; height: 30px !important; font-size: 1rem !important; }
          .cal-m-num.is-today { background: transparent !important; color: #0f172a !important; box-shadow: inset 0 0 0 1.5px #0f172a; }
          .cal-m-num.is-sel { background: #0f172a !important; color: #fff !important; box-shadow: none; }
          .cal-m-dots i { width: 7px !important; height: 7px !important; }
          .cal-m-dots b { font-size: 0.75rem !important; color: #334155 !important; margin-left: 3px; }
          .cal-m-agenda { display: block !important; border-top: 1px solid #eef1f4; margin-top: 0.5rem; padding: 0.9rem 1rem 6rem; background: #fff; }
          .month-view-cell { border: none !important; border-bottom: 1px solid #f3f5f7 !important; padding: 0.35rem 0 0.2rem !important; justify-content: flex-start; gap: 3px; }
          .month-view-cell > div:first-child { margin-bottom: 0 !important; }
          .cal-m-blank { background: transparent !important; border: none !important; }
          .cal-m-load { display: none !important; }
          .cal-m-dots { margin-top: 0 !important; padding-bottom: 0 !important; min-height: 10px; }
          .cal-m-head { border-bottom: none !important; padding: 0.55rem 0 0.35rem !important; margin: 0 0.25rem; }
          /* Тиждень: сім колонок з мінімальною шириною, гортається вбік; години й шапка лишаються на місці */
          .cal-week-head, .cal-week-body { min-width: 800px; }
          .cal-week-wrap .cal-time-col { position: sticky; left: 0; z-index: 13; width: 44px !important; }
          .cal-week-wrap .cal-week-head .cal-time-col { z-index: 14; }
          .cal-week-hcell { padding: 0.55rem 0.2rem !important; }
          .cal-week-hcell > div:last-child { font-size: 1.1rem !important; }
          .cal-m-count { display: none !important; }
          .cal-toolbar .action-icon-btn { padding: 0.65rem !important; }
        }
      `}</style>

      {/* Ліва панель: Міні-календар та віджети */}
      <div className="custom-scroll cal-left" style={{ width: '320px', borderRight: '1px solid #e2e8f0', backgroundColor: '#ffffff', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', overflowY: 'auto', flexShrink: 0, zIndex: 10 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', padding: '0 0.2rem' }}>
            <div style={{ fontWeight: '800', color: '#111827', fontSize: '1.15rem', textTransform: 'capitalize', letterSpacing: '-0.02em' }}>
              {currentDate.toLocaleString('uk-UA', { month: 'long', year: 'numeric' })}
            </div>
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button onClick={() => {
                  const d = new Date(currentDate);
                  if (calendarView === 'day') d.setDate(d.getDate() - 1);
                  else if (calendarView === 'week') d.setDate(d.getDate() - 7);
                  else d.setMonth(d.getMonth() - 1);
                  setCurrentDate(d);
              }} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', padding: 0, transition: '0.2s' }} onMouseOver={e=>e.currentTarget.style.color='#111827'} onMouseOut={e=>e.currentTarget.style.color='#94a3b8'}><Icons.ChevronLeft /></button>
              <button onClick={() => {
                  const d = new Date(currentDate);
                  if (calendarView === 'day') d.setDate(d.getDate() + 1);
                  else if (calendarView === 'week') d.setDate(d.getDate() + 7);
                  else d.setMonth(d.getMonth() + 1);
                  setCurrentDate(d);
              }} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', padding: 0, transition: '0.2s' }} onMouseOver={e=>e.currentTarget.style.color='#111827'} onMouseOut={e=>e.currentTarget.style.color='#94a3b8'}><Icons.ChevronRight /></button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.2rem', textAlign: 'center', marginBottom: '0.8rem', fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8' }}>
            <div>Пн</div><div>Вт</div><div>Ср</div><div>Чт</div><div>Пт</div>
            <div style={{ color: '#d92d20' }}>Сб</div><div style={{ color: '#d92d20' }}>Нд</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.2rem' }}>
            {blanks.map(blank => <div key={`blank-${blank}`}></div>)}
            {days.map(day => {
              const dObj = new Date(currentYear, currentMonth, day);
              const isSelected =
                dObj.getDate() === currentDate.getDate() &&
                dObj.getMonth() === currentDate.getMonth() &&
                dObj.getFullYear() === currentDate.getFullYear();
              const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6;
              const hasOverdue = hasOverdueTasks(dObj);

              return (
                <div
                  key={day}
                  onClick={() => {
                    setCurrentDate(dObj);
                    setCalendarView('day');
                    localStorage.setItem('bookera_calendarView', 'day');
                  }}
                  style={{
                    position: 'relative',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    backgroundColor: isSelected ? '#0f172a' : 'transparent',
                    color: isSelected ? '#ffffff' : (isWeekend ? '#d92d20' : '#0f172a'),
                    fontWeight: isSelected ? '700' : '500',
                  }}
                  onMouseOver={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = '#f1f5f9';
                  }}
                  onMouseOut={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {day}
                  {hasOverdue && (
                    <div style={{ position: 'absolute', top: '2px', right: '2px', width: '6px', height: '6px', backgroundColor: '#ef4444', borderRadius: '50%' }}></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ height: '1px', backgroundColor: '#f1f5f9' }}></div>

        {/* Віджет Задачі (ОНОВЛЕНО: Сучасний стиль та різнокольорові фони) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontWeight: '800', color: '#0f172a', marginBottom: '1rem', fontSize: '1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Справи на {isToday ? 'сьогодні' : currentDate.toLocaleDateString('uk-UA', {day: 'numeric', month: 'short'})}
            <button onClick={handleAddTaskClick} style={{ background: 'transparent', border: 'none', color: '#6F9273', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: '0.2s', padding: 0 }} onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
          </div>

<div className="custom-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.2rem' }}>
            {tasksForSelectedDay.length === 0 && !isAddingTask && (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8', fontSize: '0.85rem', border: '1px dashed #e2e8f0', borderRadius: '8px' }}>
                Немає завдань на цей день.<br/>Натисніть <span style={{ color: '#6F9273', fontWeight: 'bold' }}>+</span> щоб додати.
              </div>
            )}

            {tasksForSelectedDay.map((task: any) => {
              const isOverdue = task.date < realTodayStr && !task.completed;
              const isEditing = editingTaskId === task.id;

              // Визначаємо колір фону для кожної задачі
              const colorIndex = task.id % TASK_COLORS.length;
              const bgColor = task.completed ? '#f8fafc' : (isOverdue ? '#fef2f2' : TASK_COLORS[colorIndex]);
              const borderColor = task.completed ? '#e2e8f0' : (isOverdue ? '#fca5a5' : TASK_BORDERS[colorIndex]);

              return (
                <div key={task.id} style={{
                  background: bgColor,
                  border: `1px solid ${borderColor}`,
                  borderRadius: '8px', padding: '0.4rem 0.6rem', display: 'flex', gap: '0.6rem', alignItems: 'center',
                  transition: 'all 0.2s ease', opacity: task.completed ? 0.6 : 1
                }}>
                  <div className={`min-checkbox ${task.completed ? 'checked' : ''}`} onClick={() => toggleTask(task.id)}>
                     <CheckIcon />
                  </div>

                  {isEditing ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                        <input
                          autoFocus
                          type="text"
                          value={editingTaskText}
                          onChange={e => setEditingTaskText(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEditedTask(task.id); if (e.key === 'Escape') setEditingTaskId(null); }}
                          style={{ flex: 1, minWidth: 0, border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0.15rem 0.4rem', fontSize: '0.85rem', outline: 'none', color: '#0f172a', background: '#fff' }}
                        />
                        <div style={{ display: 'flex', gap: '0.1rem', flexShrink: 0 }}>
                          <button onClick={() => saveEditedTask(task.id)} className="task-action-btn" style={{ color: '#10b981', padding: '0.15rem' }}>
                             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </button>
                          <button onClick={() => setEditingTaskId(null)} className="task-action-btn delete" style={{ padding: '0.15rem' }}>
                             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          </button>
                        </div>
                      </div>
                  ) : (
                      <>
                        <div style={{ fontSize: '0.85rem', color: task.completed ? '#94a3b8' : (isOverdue ? '#b91c1c' : '#334155'), lineHeight: '1.2', textDecoration: task.completed ? 'line-through' : 'none', flex: 1, wordBreak: 'break-word', fontWeight: '500' }}>
                          {task.text}
                          {isOverdue && <span style={{ display: 'block', fontSize: '0.65rem', color: '#ef4444', marginTop: '2px', fontWeight: 'bold' }}>(Протерміновано)</span>}
                        </div>
                        <div style={{ display: 'flex', gap: '0.2rem', opacity: task.completed ? 0.3 : 1 }}>
                          <button onClick={() => startEditTask(task)} className="task-action-btn" style={{ padding: '0.15rem' }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                          </button>
                          <button onClick={() => deleteTask(task.id)} className="task-action-btn delete" style={{ padding: '0.15rem' }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                          </button>
                        </div>
                      </>
                  )}
                </div>
              );
            })}

            {isAddingTask && (
              <div style={{ background: '#ffffff', border: '1px solid #8FAE93', borderRadius: '8px', padding: '0.4rem 0.6rem', display: 'flex', gap: '0.6rem', alignItems: 'center', boxShadow: '0 2px 8px rgba(59,130,246,0.1)' }}>
                <div className="min-checkbox" style={{ opacity: 0.3, cursor: 'default' }}></div>
                <input
                  autoFocus
                  type="text"
                  value={newTaskText}
                  onChange={e => setNewTaskText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveNewTask(); if (e.key === 'Escape') setIsAddingTask(false); }}
                  placeholder="Що потрібно зробити?"
                  style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', fontSize: '0.85rem', color: '#0f172a', fontWeight: '500', background: 'transparent' }}
                />
                <div style={{ display: 'flex', gap: '0.1rem', flexShrink: 0 }}>
                  <button onClick={saveNewTask} className="task-action-btn" style={{ color: '#10b981', padding: '0.15rem' }}>
                     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </button>
                  <button onClick={() => setIsAddingTask(false)} className="task-action-btn delete" style={{ padding: '0.15rem' }}>
                     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Права панель: Сітка розкладу */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', overflow: 'hidden' }}>

        {/* Топ бар календаря */}
        <div
          className="cal-toolbar"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'nowrap', padding: '0.65rem 1rem', borderBottom: '1px solid #f1f5f9', backgroundColor: '#ffffff', position: 'relative', zIndex: 100 }}
        >
          <div className="cal-toolbar__left" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <button
              onClick={() => { setCurrentDate(new Date()); setCalendarView('day'); localStorage.setItem('bookera_calendarView', 'day'); }}
              style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem', fontWeight: '600', backgroundColor: '#f1f5f9', color: '#0f172a', border: 'none', borderRadius: '8px', cursor: 'pointer', transition: '0.2s', flexShrink: 0 }}
              onMouseOver={e=>e.currentTarget.style.backgroundColor='#e2e8f0'}
              onMouseOut={e=>e.currentTarget.style.backgroundColor='#f1f5f9'}
            >
              Сьогодні
            </button>
            <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
              <button className="action-icon-btn" style={{ padding: '0.4rem' }} onClick={() => {
                  const d = new Date(currentDate);
                  if (calendarView === 'day') d.setDate(d.getDate() - 1);
                  else if (calendarView === 'week') d.setDate(d.getDate() - 7);
                  else d.setMonth(d.getMonth() - 1);
                  setCurrentDate(d);
              }}><Icons.ChevronLeft /></button>
              <button className="action-icon-btn" style={{ padding: '0.4rem' }} onClick={() => {
                  const d = new Date(currentDate);
                  if (calendarView === 'day') d.setDate(d.getDate() + 1);
                  else if (calendarView === 'week') d.setDate(d.getDate() + 7);
                  else d.setMonth(d.getMonth() + 1);
                  setCurrentDate(d);
              }}><Icons.ChevronRight /></button>
            </div>
            {clipboardApp && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                background: '#EEF7EF', border: '1px solid rgba(94,122,97,0.28)',
                borderRadius: '20px', padding: '0.25rem 0.5rem 0.25rem 0.75rem',
                fontSize: '0.75rem', fontWeight: 600, color: '#2E3A30', flexShrink: 0,
              }}>
                <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Копія: {clipboardApp.client_name || 'запис'}
                </span>
                <button
                  onClick={() => setClipboardApp(null)}
                  title="Скасувати копіювання"
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#5C6B5E', fontSize: '1rem', lineHeight: 1, padding: '0 2px' }}
                >
                  ×
                </button>
              </div>
            )}

            <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', flexShrink: 0, paddingRight: '0.35rem' }}>
              {calendarView === 'week'
                ? `${weekDays[0].getDate()} - ${weekDays[6].getDate()} ${currentDate.toLocaleString('uk-UA', { month: 'short' })}`
                : calendarView === 'month'
                  ? `${currentDate.toLocaleString('uk-UA', { month: 'long' })} ${currentDate.getFullYear()}`
                  : `${currentDate.toLocaleString('uk-UA', { weekday: 'short' })}, ${currentDate.getDate()} ${currentDate.toLocaleString('uk-UA', { month: 'short' })}`
              }
            </div>
            {pendingList.length > 0 && (
              <button type="button" className="cal-pending-chip" onClick={() => { setSelectedBooking(pendingList[0]); setIsBookingDetailsModalOpen(true); }} title="Записи, які чекають вашого підтвердження">
                <i />{pendingList.length}<span> {pendingList.length === 1 ? 'чекає підтвердження' : 'чекають підтвердження'}</span>
              </button>
            )}
          </div>

          <div className="cal-toolbar__rest" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
            <div className="cal-master-wrap" style={{ position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0 }} ref={masterFilterRef}>
              <div
                className="cal-master-btn"
                onClick={() => { if (!isMasterUser) setIsMasterFilterOpen(!isMasterFilterOpen); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: 'transparent',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  color: '#475569',
                  cursor: isMasterUser ? 'default' : 'pointer',
                  transition: '0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {filterMaster !== 'all' && (
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: '800' }}>
                      {getUserInitials(team.find((m:any) => String(m.id) === String(filterMaster))?.name || '')}
                    </div>
                  )}
                  {filterMaster === 'all' ? 'Усі майстри' : team.find((m:any) => String(m.id) === String(filterMaster))?.name || 'Усі майстри'}
                </div>
                <div style={{ color: '#94a3b8', display: 'flex', transform: isMasterFilterOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }}>
                  <Icons.ChevronDown />
                </div>
              </div>

              {isMasterFilterOpen && (
                <div className="custom-scroll custom-select-dropdown" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: '100%', minWidth: '220px', maxHeight: '300px', overflowY: 'auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.08)', zIndex: 200, padding: '0.4rem' }}>
                  <div
                    onClick={() => { setFilterMaster('all'); setIsMasterFilterOpen(false); }}
                    style={{ padding: '0.6rem 0.8rem', fontSize: '0.9rem', fontWeight: filterMaster === 'all' ? '700' : '500', color: filterMaster === 'all' ? '#0f172a' : '#475569', cursor: 'pointer', borderRadius: '8px', background: filterMaster === 'all' ? '#f1f5f9' : 'transparent', marginBottom: '0.2rem' }}
                  >
                    Усі майстри
                  </div>
                  {team.map((m:any) => (
                    <div
                      key={m.id}
                      onClick={() => { setFilterMaster(m.id); setIsMasterFilterOpen(false); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.8rem', fontSize: '0.9rem', fontWeight: String(filterMaster) === String(m.id) ? '700' : '500', color: String(filterMaster) === String(m.id) ? '#0f172a' : '#475569', cursor: 'pointer', borderRadius: '8px', background: String(filterMaster) === String(m.id) ? '#f1f5f9' : 'transparent', marginBottom: '0.1rem' }}
                    >
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: String(filterMaster) === String(m.id) ? getCardColor(String(m.id)).vividBg : getCardColor(String(m.id)).pastelBg, color: String(filterMaster) === String(m.id) ? '#fff' : getCardColor(String(m.id)).pastelText, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: '800', flexShrink: 0 }}>
                        {getUserInitials(m.name)}
                      </div>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="cal-toolbar__count" style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', backgroundColor: '#f8fafc', padding: '0.25rem 0.55rem', borderRadius: '20px', whiteSpace: 'nowrap', flexShrink: 0, border: '1px solid #f1f5f9' }}>
              Записів: {currentViewAppointmentsCount}
              {currentViewRevenue > 0 && (
                <span style={{ marginLeft: '0.4rem', paddingLeft: '0.4rem', borderLeft: '1px solid #dbe3dc', color: '#2E3A30' }}>
                  {currentViewRevenue.toLocaleString('uk-UA')} ₴
                </span>
              )}
            </div>

            {/* Пошук клієнта по всіх записах */}
            <div className="cal-toolbar__search" style={{ position: 'relative', flex: '0 1 140px', minWidth: '80px' }}>
              <input
                type="text"
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                placeholder="Знайти…"
                style={{ width: '100%', height: '30px', padding: '0 0.6rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.8rem', color: '#0f172a', background: '#fff', outline: 'none', boxSizing: 'border-box' }}
              />
              {clientSearch.trim().length >= 2 && (
                <div style={{ position: 'absolute', top: '36px', right: 0, width: '300px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 12px 32px rgba(15,23,42,0.12)', zIndex: 100, overflow: 'hidden' }}>
                  {clientSearchResults.length === 0 ? (
                    <div style={{ padding: '0.9rem 1rem', fontSize: '0.82rem', color: '#94a3b8' }}>Нічого не знайдено</div>
                  ) : clientSearchResults.map((a: any) => {
                    const isPast = a._date < new Date(new Date().setHours(0, 0, 0, 0));
                    return (
                      <div
                        key={a.id}
                        onClick={() => {
                          setCurrentDate(a._date);
                          setCalendarView('day');
                          localStorage.setItem('bookera_calendarView', 'day');
                          setSelectedBooking(a);
                          setIsBookingDetailsModalOpen(true);
                          setClientSearch('');
                        }}
                        style={{ padding: '0.65rem 1rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', opacity: isPast ? 0.55 : 1 }}
                        onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseOut={e => e.currentTarget.style.background = '#fff'}
                      >
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>{a.client_name || 'Без імені'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                          {a._date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}
                          {' · '}{String(a.start_time || '').slice(0, 5)}
                          {isPast && ' · минулий'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Перемикач виглядів та іконка налаштувань (завжди зафіксовані праворуч) */}
            <div className="cal-toolbar__rightwrap" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
              <div className="cal-toolbar__right" style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'transparent' }}>
                {([['day', 'День'], ['week', 'Тиждень'], ['month', 'Місяць']] as const).map(([view, label]) => {
                  const isActive = calendarView === view;
                  return (
                    <button
                      key={view}
                      className="cal-view-tab"
                      onClick={() => { setCalendarView(view); localStorage.setItem('bookera_calendarView', view); }}
                      style={{
                        padding: '0.35rem 0.65rem', fontSize: '0.82rem', fontWeight: isActive ? '700' : '500',
                        color: isActive ? '#0f172a' : '#64748b', background: isActive ? '#f1f5f9' : 'transparent',
                        border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s ease'
                      }}
                      onMouseOver={e => { if(!isActive) e.currentTarget.style.color = '#0f172a'; }}
                      onMouseOut={e => { if(!isActive) e.currentTarget.style.color = '#64748b'; }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Телефон: День / Тиждень / Місяць згорнуті в один випадний вибір, щоб не займати місце */}
              <div className="cal-view-menu" style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                <button type="button" onClick={() => setViewMenuOpen(o => !o)} aria-haspopup="menu" aria-expanded={viewMenuOpen}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', border: 'none', background: 'transparent', color: '#0f172a', borderRadius: '8px', padding: '0.4rem 0.4rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>
                  {calendarView === 'day' ? 'День' : calendarView === 'week' ? 'Тиждень' : 'Місяць'}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                </button>
                {viewMenuOpen && (
                  <div role="menu" style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 8px 24px rgba(15,23,42,0.12)', padding: '4px', zIndex: 40, minWidth: '120px' }}>
                    {([['day', 'День'], ['week', 'Тиждень'], ['month', 'Місяць']] as const).map(([view, label]) => (
                      <button key={view} type="button" role="menuitem"
                        onClick={() => { setCalendarView(view); localStorage.setItem('bookera_calendarView', view); setViewMenuOpen(false); }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', color: '#0f172a', fontWeight: calendarView === view ? 700 : 500, fontSize: '0.9rem', padding: '0.55rem 0.7rem', borderRadius: '7px', cursor: 'pointer' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Сітка / список для дня - лише іконки */}
              {/* Сітка / список - лише іконки, для дня, тижня й місяця */}
              <div className="cal-layout-icons" role="group" aria-label="Вигляд" style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                {([['grid', 'Сітка'], ['list', 'Список']] as const).map(([mode, label]) => (
                  <button key={mode} type="button" title={label} aria-label={label} aria-pressed={dayLayout === mode}
                    onClick={() => { setDayLayout(mode); try { localStorage.setItem('bookera_dayLayout', mode); } catch { /* */ } }}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0.4rem 0.4rem 0.3rem', display: 'flex', alignItems: 'center', color: dayLayout === mode ? '#0f172a' : '#b6bfcb' }}>
                    {mode === 'grid' ? (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="18" rx="1.5"/><rect x="14" y="3" width="7" height="18" rx="1.5"/></svg>
                    ) : (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>
                    )}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className="cal-gear"
                onClick={() => setShowCalSettingsModal(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  borderRadius: '6px',
                  transition: 'color 0.15s ease',
                  flexShrink: 0
                }}
                onMouseOver={e => e.currentTarget.style.color = '#0f172a'}
                onMouseOut={e => e.currentTarget.style.color = '#94a3b8'}
                title="Налаштування"
              >
                <Icons.Settings />
              </button>
            </div>
          </div>
        </div>

        {/* ОБГОРТКА ДЛЯ АНІМАЦІЇ */}
        <div className="animated-calendar" key={currentDate.toISOString() + calendarView} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* --- ДЕНЬ --- */}
          {dayLayout === 'list' && (() => {
            // Список: день - за майстрами, тиждень і місяць - за днями. Заголовки липкі, довгі розділи обрізані кнопкою «Ще N».
            const LIST_CAP = 6;
            const isBlockApp = (a: any) => a.status === 'blocked' || a.color === 'blocked' || !a.service_id;
            const byTime = (list: any[]) => [...list].sort((a: any, b: any) => String(a.start_time).localeCompare(String(b.start_time)));
            type Section = { key: string; title: string; sub?: string; dot?: string; today?: boolean; apps: any[]; empty: string };
            const collapsible = true;  // і дні (тиждень, місяць), і майстри (день) згортаються по кліку на заголовок
            let sections: Section[] = [];
            const withMaster = calendarView !== 'day';
            const masterName = (a: any) => (team || []).find((m: any) => String(m.id) === String(a.staff_id))?.name || '';
            if (calendarView === 'day') {
              const dayApps = byTime(getAppointmentsForDay(currentDate));
              const lanes: { key: string; name: string; staffId: string | null; apps: any[] }[] = dayColumns
                ? dayColumns.map((m: any) => ({ key: String(m.id), name: m.name || m.full_name || 'Майстер', staffId: String(m.id) as string | null, apps: dayApps.filter((a: any) => String(a.staff_id) === String(m.id)) }))
                : [{ key: 'one', name: filterMaster !== 'all' ? ((team || []).find((m: any) => String(m.id) === String(filterMaster))?.name || 'Записи') : 'Записи', staffId: (filterMaster !== 'all' ? String(filterMaster) : null) as string | null, apps: dayApps.filter((a: any) => filterMaster === 'all' || String(a.staff_id) === String(filterMaster) || !a.staff_id) }];
              if (dayColumns) {
                const rest = dayApps.filter((a: any) => !dayColumns.some((m: any) => String(m.id) === String(a.staff_id)));
                if (rest.length) lanes.push({ key: '__none', name: 'Без майстра', staffId: null, apps: rest });
              }
              sections = lanes.map(l => ({ key: l.key, title: l.name, dot: l.staffId ? getCardColor(l.staffId).vividBg : '#94a3b8', apps: l.apps, empty: 'Вільний' }));
            } else {
              const dates: Date[] = calendarView === 'week' ? weekDays : days.map(d => new Date(currentYear, currentMonth, d));
              sections = dates.map(d => ({
                key: d.toDateString(),
                title: (() => { const t = d.toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'long' }); return t.charAt(0).toUpperCase() + t.slice(1); })(),
                today: d.toDateString() === now.toDateString(),
                apps: byTime(getAppointmentsForDay(d)),
                empty: 'Записів немає',
              }));
              // Місяць: лише дні із записами, інакше список на 30 порожніх рядків
              if (calendarView === 'month') sections = sections.filter(sec => sec.apps.length > 0);
            }
            if (sections.length === 0) {
              return <div className="cal-list" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.95rem', background: '#fff' }}>У цьому місяці записів немає</div>;
            }
            return (
              <div className="cal-list custom-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: '#fff' }}>
                <div className="cal-list-inner">
                  {sections.map(sec => {
                    const real = sec.apps.filter((a: any) => !isBlockApp(a));
                    const sum = real.filter((a: any) => a.status !== 'cancelled' && a.status !== 'no-show').reduce((t: number, a: any) => t + (Number(a.price) || 0), 0);
                    const expKey = `${calendarView}:${sec.key}:${currentDate.toDateString()}`;
                    const open = !!listExpanded[expKey];
                    // День у тижні/місяці: за замовчуванням відкритий лише сьогоднішній (або перший із записами, якщо сьогодні поза періодом)
                    const hasToday = sections.some(x => x.today);
                    const defaultOpen = calendarView === 'day' || !!sec.today || (!hasToday && sec.key === (sections.find(x => x.apps.length > 0)?.key));
                    const dayOpen = collapsible ? (agendaOpen[expKey] ?? defaultOpen) : true;
                    const shown = dayOpen ? (open ? sec.apps : sec.apps.slice(0, LIST_CAP)) : [];
                    const hidden = dayOpen ? sec.apps.length - shown.length : 0;
                    return (
                      <section key={sec.key}>
                        <div
                          onClick={collapsible && sec.apps.length > 0 ? () => setAgendaOpen(prev => ({ ...prev, [expKey]: !dayOpen })) : undefined}
                          role={collapsible && sec.apps.length > 0 ? 'button' : undefined}
                          aria-expanded={collapsible && sec.apps.length > 0 ? dayOpen : undefined}
                          style={{ position: 'sticky', top: 0, zIndex: 3, background: '#fff', display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.8rem 0 0.5rem', borderBottom: '1px solid #eef1f4', cursor: collapsible && sec.apps.length > 0 ? 'pointer' : 'default' }}>
                          {collapsible && sec.apps.length > 0 && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: dayOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease' }}><path d="M9 6l6 6-6 6"/></svg>
                          )}
                          {sec.dot && <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: sec.dot, flexShrink: 0 }} />}
                          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sec.title}</h3>
                          {sec.today && <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#fff', background: '#0f172a', padding: '1px 8px', borderRadius: '999px' }}>Сьогодні</span>}
                          <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {real.length === 0 ? sec.empty : `${real.length} зап.${sum ? ` · ${sum.toLocaleString('uk-UA')} ₴` : ''}`}
                          </span>
                        </div>
                        {shown.map((app: any) => {
                          const block = isBlockApp(app);
                          const svc = services.find((x: any) => String(x.id) === String(app.service_id));
                          const off = app.status === 'cancelled' || app.status === 'no-show';
                          const st = statusStyle[app.status as string];
                          const dur = fmtMin(minutesOf(app));
                          const master = withMaster ? masterName(app) : '';
                          return (
                            <div key={app.id} className={`cal-list-row${withMaster ? ' with-master' : ''}`} onClick={(e) => openBookingDetails(app, e)} role="button" tabIndex={0}
                              style={{ opacity: off ? 0.55 : 1, boxShadow: `inset 3px 0 0 ${app.staff_id && !block ? getCardColor(String(app.staff_id)).vividBg : '#cbd5e1'}` }}>
                              <div className="cl-time" style={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1.25 }}>
                                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{String(app.start_time).substring(0, 5)}</div>
                                {app.end_time && <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{String(app.end_time).substring(0, 5)}</div>}
                              </div>
                              <div className="cl-client" style={{ fontWeight: 600, fontSize: '0.92rem', color: block ? '#64748b' : '#0f172a', textDecoration: app.status === 'no-show' ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {block ? (app.block_reason || app.service_name || 'Перерва') : app.client_name}
                              </div>
                              <div className="cl-svc" style={{ fontSize: '0.8rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {block ? '' : [svc?.name || app.service_name, dur].filter(Boolean).join(' · ')}
                                {master && <span className="cl-m-only" style={{ color: getCardColor(String(app.staff_id)).pastelText, fontWeight: 600 }}> · {master}</span>}
                              </div>
                              {withMaster && (
                                <div className="cl-master" style={{ fontSize: '0.8rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  {master && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: getCardColor(String(app.staff_id)).vividBg, flexShrink: 0 }} />}
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{master}</span>
                                </div>
                              )}
                              <div className="cl-price" style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a', textAlign: 'right' }}>
                                {!block && app.price ? `${Number(app.price).toLocaleString('uk-UA')} ₴` : ''}
                              </div>
                              <div className="cl-status">
                                {st && <span style={{ fontSize: '0.68rem', fontWeight: 600, color: st.color, background: st.bg, padding: '1px 7px', borderRadius: '999px', whiteSpace: 'nowrap' }}>{st.label}</span>}
                              </div>
                            </div>
                          );
                        })}
                        {dayOpen && sec.apps.length > LIST_CAP && (
                          <button type="button" onClick={() => setListExpanded(prev => ({ ...prev, [expKey]: !open }))}
                            style={{ width: '100%', padding: '0.7rem 0', border: 'none', background: 'transparent', color: '#475569', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', borderBottom: '1px solid #f4f6f8' }}>
                            {open ? 'Згорнути' : `Показати ще ${hidden}`}
                          </button>
                        )}
                      </section>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {calendarView === 'day' && dayLayout === 'grid' && (
            /* Шапка з іменами й сітка гортаються вбік РАЗОМ: коли в колонках багато майстрів,
               їх не стискаємо, а даємо провести пальцем (або коліщатком) ліворуч-праворуч.
               Мінімальна ширина колонки - 140px; на ПК, де місця вистачає, нічого не змінюється. */
            <div className="cal-day-wrap" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowX: 'auto', overflowY: 'auto', ['--day-min' as string]: `${76 + Math.max(dayColumns ? dayColumns.length : 1, 1) * 140}px` } as React.CSSProperties}>
          {calendarView === 'day' && dayColumns && (
            /* Шапка колонок: без неї смуги нічого не означають.
               Липка, щоб імена не їхали вгору під час прокрутки дня. */
            <div style={{ display: 'flex', paddingLeft: '68px', paddingRight: '8px', borderBottom: '1px solid #EDF1EC', background: '#fff', position: 'sticky', top: 0, zIndex: 5, flexShrink: 0, minWidth: 'max(100%, var(--day-min, 0px))', boxSizing: 'border-box' }}>
              {[...dayColumns, ...(getAppointmentsForDay(currentDate).some((a: any) => a.status !== 'blocked' && a.color !== 'blocked' && (!a.staff_id || !dayColumns.some((m: any) => String(m.id) === String(a.staff_id)))) ? [{ id: '__none', name: 'Без майстра' }] : [])].map((m: any) => (
                <div
                  key={m.id}
                  onClick={() => m.id !== '__none' && setFilterMaster(String(m.id))}
                  title={m.id !== '__none' ? 'Показати лише цього майстра' : undefined}
                  style={{ flex: 1, minWidth: 0, padding: '0.5rem 0.4rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: 600, color: m.id === '__none' ? '#A5AEA3' : '#2E3A30', cursor: m.id === '__none' ? 'default' : 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {m.id !== '__none' && <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: getCardColor(String(m.id)).vividBg, marginRight: '0.4rem', verticalAlign: 'middle' }} />}
                  {m.name}
                </div>
              ))}
            </div>
          )}

          {calendarView === 'day' && (
            <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', minWidth: 'max(100%, var(--day-min, 0px))', boxSizing: 'border-box' }}>
              <div style={{ position: 'relative', height: `${gridTotalHours * 60}px`, flexShrink: 0, zIndex: 1 }}>
                {hoursArray.map((hour, i) => {
                  const displayHour = hour % 24;
                  return (
                    <div
                      key={i} className="cal-grid-row" style={{ height: '60px', cursor: 'pointer' }} onClick={() => handleQuickAdd(displayHour)}
                      onDragOver={e => e.preventDefault()} onDrop={e => handleDropAppointment(e, currentDate, displayHour)}
                    >
                      <div className="cal-time-col">
                        <div>{displayHour.toString().padStart(2, '0')}:00</div>
                        {hour >= 24 && <div style={{ fontSize: '0.55rem', color: '#cbd5e1' }}>+1д</div>}
                      </div>
                      <div className="quick-add-hint"><Icons.Plus /> <span>Додати запис</span></div>
                    </div>
                  );
                })}

                <div style={{ position: 'absolute', top: 0, bottom: 0, left: '60px', right: 0, pointerEvents: 'none' }}>
                  {renderNonWorkingHours(effectiveShifts[currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1])}
                </div>

                {/* Межі між смугами майстрів. Волосяні: вони мають лише
                    підказувати, де закінчується одна колонка, а не ділити
                    екран на клітки. */}
                {dayColumns && (() => {
                  const dayApps = getAppointmentsForDay(currentDate);
                  const hasUnassigned = dayApps.some((a: any) => !a.staff_id || !dayColumns.some((m: any) => String(m.id) === String(a.staff_id)));
                  const total = dayColumns.length + (hasUnassigned ? 1 : 0);
                  return Array.from({ length: total - 1 }, (_, i) => (
                    <div
                      key={`lane-${i}`}
                      style={{
                        position: 'absolute', top: 0, bottom: 0,
                        left: `calc(68px + (100% - 76px) * ${(i + 1) / total})`,
                        width: '1px', background: '#EDF1EC', pointerEvents: 'none', zIndex: 1,
                      }}
                    />
                  ));
                })()}

                {/* Вільні вікна між записами - куди ще можна когось поставити.
                    pointerEvents: none, щоб підсвітка не перехоплювала клік:
                    натискання по вікну має створювати запис, як і будь-де. */}
                {(() => {
                  // Без колонок - вікна всього дня; з колонками - окремо для кожного майстра в його смузі
                  const hasUnassignedLane = !!dayColumns && getAppointmentsForDay(currentDate).some((a: any) => a.status !== 'blocked' && a.color !== 'blocked' && (!a.staff_id || !dayColumns.some((m: any) => String(m.id) === String(a.staff_id))));
                  const lanes: { key: string; gaps: { start: number; end: number }[]; laneIdx: number; total: number }[] = dayColumns
                    ? dayColumns.map((m: any, idx: number) => ({ key: String(m.id), gaps: getFreeGaps(currentDate, String(m.id)), laneIdx: idx, total: dayColumns.length + (hasUnassignedLane ? 1 : 0) }))
                    : [{ key: 'all', gaps: getFreeGaps(currentDate), laneIdx: 0, total: 1 }];
                  return lanes.flatMap(lane => lane.gaps.map((gap, i) => {
                    const top = (gap.start - gridStartHour * 60);
                    const height = gap.end - gap.start;
                    if (top < 0 || height <= 0) return null;
                    const hours = Math.floor(height / 60);
                    const mins = height % 60;
                    const pos: React.CSSProperties = dayColumns
                      ? { left: `calc(68px + (100% - 76px) * ${lane.laneIdx / lane.total})`, width: `calc((100% - 76px) / ${lane.total} - 6px)` }
                      : { left: '60px', right: 0 };
                    return (
                      <div
                        key={`gap-${lane.key}-${i}`}
                        style={{
                          position: 'absolute', ...pos,
                          top: `${top}px`, height: `${height}px`,
                          background: 'rgba(194, 216, 196, 0.14)',
                          borderTop: '1px dashed rgba(143, 174, 147, 0.5)',
                          borderBottom: '1px dashed rgba(143, 174, 147, 0.5)',
                          pointerEvents: 'none', zIndex: 2,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {height >= 45 && (
                          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#6F9273', letterSpacing: '0.01em' }}>
                            Вільно {hours > 0 ? `${hours} год ` : ''}{mins > 0 ? `${mins} хв` : ''}
                          </span>
                        )}
                      </div>
                    );
                  }));
                })()}

                {layoutDayAppointments(getAppointmentsForDay(currentDate)).map((app: any) => {
                  const serviceName = services.find((s:any) => String(s.id) === String(app.service_id))?.name || app.service_name;
                  const addonNames = (Array.isArray(app.addon_service_ids) ? app.addon_service_ids : [])
                    .map((id: number) => services.find((s: any) => String(s.id) === String(id))?.name)
                    .filter(Boolean)
                    .join(', ');
                  const staffName = team.find((m:any) => String(m.id) === String(app.staff_id))?.name || app.master_name || 'Без майстра';
                  const isBlock = app.status === 'blocked' || app.color === 'blocked' || !app.service_id;
                  const blockTitle = (app.block_reason || app.notes || app.client_name || 'Перерва').trim();
                  const mColors = getCardColor(app.staff_id);
                  const isCompact = (app.heightPx || 60) <= 45;
                  const isTiny = (app.heightPx || 60) <= 25;
                  const leftPercent = (app.colStart ?? 0) * 100;
                  const widthPercent = (app.colSpan ?? 1) * 100;

                  return (
                    <div
                      key={app.id}
                      draggable={!isBlock}
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(app.id)); }}
                      onContextMenu={(e) => handleContextMenu(e, app)}
                      className={`cal-app-card ${isBlock ? 'non-working-bg' : ''} ${app.status ? 'status-' + app.status : ''}`}
                      style={{
                        position: 'absolute',
                        top: `${app.topPx}px`,
                        height: `${Math.max(app.heightPx || 30, 25)}px`,
                        left: `calc(68px + (100% - 76px) * ${leftPercent / 100})`,
                        width: `calc((100% - 76px) * ${widthPercent / 100} - 6px)`,
                        backgroundColor: isBlock ? '#ffffff' : mColors.pastelBg,
                        color: isBlock ? '#334155' : mColors.pastelText,
                        border: isBlock ? '1px solid #cbd5e1' : 'none',
                        borderLeft: isBlock ? '4px solid #94a3b8' : `3px solid ${mColors.vividBg}`,
                        borderRadius: '8px',
                        padding: isTiny ? '0.1rem 0.5rem' : isCompact ? '0.3rem 0.6rem' : '0.5rem 0.75rem',
                        display: 'flex',
                        flexDirection: isCompact ? 'row' : 'column',
                        alignItems: isCompact ? 'center' : 'flex-start',
                        gap: isCompact ? '0.5rem' : '2px',
                        fontSize: isTiny ? '0.7rem' : '0.8rem',
                        cursor: 'pointer',
                        zIndex: isBlock ? 6 : (5 + (app.colIndex || 0)),
                        overflow: 'hidden',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                        boxSizing: 'border-box'
                      }}
                      onClick={(e) => openBookingDetails(app, e)}
                    >
                      {isBlock ? (
                        <div style={{ display: 'flex', flexDirection: isCompact ? 'row' : 'column', justifyContent: 'center', height: '100%', width: '100%', minWidth: 0, gap: '2px' }}>
                          <div style={{ fontWeight: '700', fontSize: isTiny ? '0.7rem' : '0.82rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {blockTitle}
                          </div>
                          {!isTiny && (
                            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {!app.staff_id || app.staff_id === 'all' || app.staff_id === '0' ? 'Весь заклад' : staffName}
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <div style={{ fontWeight: '700', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', width: '100%', minWidth: 0 }}>
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                              {serviceName}{addonNames ? ` + ${addonNames}` : ''} {isCompact && <span style={{ fontWeight: '500', opacity: 0.8, marginLeft: '0.4rem' }}>{app.client_name}</span>}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', flexShrink: 0, fontSize: isTiny ? '0.65rem' : '0.75rem', fontWeight: '700', opacity: 0.7 }}>
                              {app.start_time.substring(0, 5)} {getStatusIcon(app.status)}
                            </span>
                          </div>
                          {!isCompact && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '0.1rem', opacity: 0.8, fontSize: '0.75rem', fontWeight: '500', minWidth: 0 }}>
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '1rem', minWidth: 0 }}>{app.client_name}</span>
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>{staffName}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}

                <CurrentTimeIndicator gridStartHour={gridStartHour} gridTotalHours={gridTotalHours} isToday={isToday} />
              </div>
              <div style={{ flex: 1, display: 'flex', minHeight: '4rem' }}><div style={{ width: '60px', flexShrink: 0, borderRight: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}></div><div className="non-working-bg" style={{ flex: 1 }}></div></div>
            </div>
          )}
            </div>
          )}

          {/* --- ТИЖДЕНЬ --- */}
          {calendarView === 'week' && dayLayout === 'grid' && (
            <div className="custom-scroll cal-week-wrap" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
              <div className="cal-week-head" style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#ffffff', flexShrink: 0, position: 'sticky', top: 0, zIndex: 12 }}>
                <div className="cal-time-col" style={{ width: '60px', flexShrink: 0, borderRight: '1px solid #e2e8f0', background: '#ffffff' }}></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1 }}>
                  {weekDays.map((day, i) => (
                    <div key={i} className="cal-week-hcell" style={{ padding: '1rem', textAlign: 'center', borderRight: i !== 6 ? '1px solid #e2e8f0' : 'none' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>{['Нд', 'Пн', 'Вв', 'Ср', 'Чт', 'Пт', 'Сб'][day.getDay()]}</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: '900', color: day.toDateString() === now.toDateString() ? '#0f172a' : '#475569' }}>{day.getDate()}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ flex: 'none' }}>
                <div className="cal-week-body" style={{ position: 'relative', display: 'flex', minHeight: `${(gridEndHour - gridStartHour) * 60}px` }}>
                  <div className="cal-time-col" style={{ width: '60px', flexShrink: 0, borderRight: '1px solid #e2e8f0', background: '#fff', position: 'sticky', left: 0, zIndex: 10 }}>
                    {Array.from({ length: gridEndHour - gridStartHour }).map((_, i) => (
                      <div key={i} style={{ height: '60px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '0.5rem 0', color: '#94a3b8', fontSize: '0.75rem', fontWeight: '600', borderBottom: '1px solid transparent' }}>{gridStartHour + i}:00</div>
                    ))}
                  </div>

                  {isCurrentWeek && <CurrentTimeIndicator gridStartHour={gridStartHour} gridTotalHours={gridTotalHours} isToday={true} />}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1 }}>
                    {weekDays.map((weekDay, i) => {
                      const dayApps = getAppointmentsForDay(weekDay);
                      const dayShift = effectiveShifts[weekDay.getDay() === 0 ? 6 : weekDay.getDay() - 1];
                      const isCurrentDay = weekDay.toDateString() === now.toDateString();

                      return (
                        <div key={i} style={{ borderRight: i !== 6 ? '1px solid #e2e8f0' : 'none', position: 'relative', background: isCurrentDay ? '#f8fafc' : '#fff' }}>
                          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, pointerEvents: 'none' }}>{renderNonWorkingHours(dayShift)}</div>

                          {Array.from({ length: gridEndHour - gridStartHour }).map((_, hIdx) => (
                            <div key={hIdx} onClick={() => handleQuickAdd(gridStartHour + hIdx, weekDay)} className="cal-week-cell" style={{ height: '60px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', position: 'relative', zIndex: 1 }}
                                 onDragOver={e => e.preventDefault()} onDrop={e => handleDropAppointment(e, weekDay, gridStartHour + hIdx)}></div>
                          ))}

                          {processOverlaps(dayApps).map((app: any) => {
                            const service = services.find((s:any) => String(s.id) === String(app.service_id));
                            const isBlock = app.status === 'blocked' || app.color === 'blocked';
                            const mColors = getCardColor(app.staff_id);
                            const isCompact = app.heightPx <= 45;
                            const isTiny = app.heightPx <= 25;
                            const widthPercent = 100 / (app.colCount || 1);
                            const leftPercent = (app.colIndex || 0) * widthPercent;

                            return (
                              <div
                                key={app.id}
                                draggable={!isBlock}
                                onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(app.id)); }}
                                className={`${isBlock ? 'non-working-bg' : ''} ${app.status ? 'status-' + app.status : ''}`}
                                onClick={(e) => { e.stopPropagation(); openBookingDetails(app, e); }}
                                style={{
                                  position: 'absolute', top: `${app.topPx}px`, left: `calc(${leftPercent}% + 2px)`, width: `calc(${widthPercent}% - 4px)`, height: `${app.heightPx}px`,
                                  background: isBlock ? 'transparent' : (mColors.pastelBg),
                                  borderRadius: '8px',
                                  padding: isTiny ? '0.1rem 0.4rem' : (isCompact ? '0.2rem 0.5rem' : '0.4rem 0.6rem'),
                                  display: 'flex', flexDirection: isCompact ? 'row' : 'column', alignItems: isCompact ? 'center' : 'flex-start',
                                  gap: isCompact ? '0.3rem' : '2px',
                                  color: isBlock ? '#64748b' : (mColors.pastelText),
                                  fontSize: isTiny ? '0.65rem' : '0.75rem',
                                  cursor: isBlock ? 'pointer' : 'grab', zIndex: 5 + (app.colIndex || 0),
                                  borderLeft: isBlock ? '2px dashed #cbd5e1' : `3px solid ${mColors.vividBg}`,
                                  overflow: 'hidden', boxShadow: isBlock ? 'none' : '0 1px 3px rgba(0,0,0,0.03)', boxSizing: 'border-box'
                                }}
                              >
                                <div style={{ fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flexShrink: 1, width: '100%' }}>
                                  {isBlock ? (app.block_reason || app.service_name || 'Перерва') : app.client_name}
                                </div>
                                {!isBlock && (() => {
                                  const addonNames = (app.addon_service_ids || [])
                                    .map((id: number) => services.find((s: any) => String(s.id) === String(id))?.name)
                                    .filter(Boolean)
                                    .join(', ');
                                  return (
                                    <div style={{ opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '500', fontSize: isTiny ? '0.6rem' : '0.7rem', minWidth: 0, flexShrink: 1, width: '100%' }}>
                                      {isCompact ? `• ${service?.name || ''}` : service?.name}
                                      {addonNames ? ` + ${addonNames}` : ''}
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --- МІСЯЦЬ --- */}
          {calendarView === 'month' && dayLayout === 'grid' && (
            <div className="cal-m-wrap" style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#fff', position: 'relative', zIndex: 1, overflow: 'hidden' }}>
              <div className="cal-m-head" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #f1f5f9', textAlign: 'center', fontWeight: '600', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '1rem 0', flexShrink: 0 }}>
                 <div>Пн</div><div>Вт</div><div>Ср</div><div>Чт</div><div>Пт</div>
                 <div style={{ color: '#d92d20' }}>Сб</div><div style={{ color: '#d92d20' }}>Нд</div>
              </div>

              {filterMaster === 'all' && (team || []).filter((m: any) => m.provides_services !== false).length >= 2 && (
                /* Підказка до крапок: колір - майстер. Дотик по імені показує лише його записи */
                <div className="cal-m-legend">
                  {(team || []).filter((m: any) => m.provides_services !== false).map((m: any) => (
                    <button key={m.id} type="button" onClick={() => setFilterMaster(String(m.id))}>
                      <i style={{ background: getCardColor(String(m.id)).vividBg }} />{m.name || m.full_name}
                    </button>
                  ))}
                </div>
              )}

              <div className="custom-scroll cal-m-grid" style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(130px, 1fr)', overflowY: 'auto' }}>
                  {blanks.map(blank => <div key={`blank-${blank}`} className="cal-m-blank" style={{ borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', backgroundColor: '#fafafa' }}></div>)}

                  {days.map(day => {
                      const dObj = new Date(currentYear, currentMonth, day);
                      const isMDayToday = dObj.toDateString() === now.toDateString();
                      const isMSel = selectedMonthDay.toDateString() === dObj.toDateString();
                      const hasOverdue = hasOverdueTasks(dObj);
                      const dayApps = getAppointmentsForDay(dObj);
                      const dayLoad = getDayLoad(dObj);

                      return (
                          <div key={day} className="month-view-cell" onClick={() => {
                                 // Телефон: лише вибрати день (записи нижче); ПК: відкрити день, як раніше
                                 if (typeof window !== 'undefined' && window.matchMedia('(max-width: 860px)').matches) { setMonthSel(dObj); return; }
                                 setCurrentDate(dObj); setCalendarView('day'); localStorage.setItem('bookera_calendarView', 'day');
                               }}
                               onDragOver={e => e.preventDefault()} onDrop={e => handleDropAppointment(e, dObj)}
                               style={{ borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: '0.5rem', display: 'flex', flexDirection: 'column' }}>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingTop: '4px' }}>
                                    {hasOverdue && <div style={{ width: '6px', height: '6px', backgroundColor: '#ef4444', borderRadius: '50%' }}></div>}
                                    {dayApps.filter((a: any) => a.status !== 'blocked').length > 0 && (
                                      <span className="cal-m-count" style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: '600' }}>{dayApps.filter((a: any) => a.status !== 'blocked').length} зап.</span>
                                    )}
                                  </div>
                                  <span className={`cal-m-num${isMDayToday ? ' is-today' : ''}${isMSel ? ' is-sel' : ''}`} style={{ fontWeight: isMDayToday ? '700' : '500',
                                    // Вихідні червоним, як у системному календарі.
                                    // Це не декор: у календарі, куди дивляться щодня,
                                    // межа тижня має читатись без підрахунку стовпців.
                                    color: isMDayToday ? '#ffffff' : (dObj.getDay() === 0 || dObj.getDay() === 6 ? '#d92d20' : '#0f172a'), width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', backgroundColor: isMDayToday ? '#0f172a' : 'transparent', fontSize: '0.9rem' }}>{day}</span>
                              </div>

                              {dayLoad > 0 && (
                                <div
                                  className="cal-m-load"
                                  title={`Зайнято ${Math.round(dayLoad * 100)}% робочого часу`}
                                  style={{ height: '3px', borderRadius: '2px', background: '#eef2f0', overflow: 'hidden', marginBottom: '0.35rem', flexShrink: 0 }}
                                >
                                  <div style={{
                                    width: `${Math.round(dayLoad * 100)}%`,
                                    height: '100%',
                                    borderRadius: '2px',
                                    // Матча для звичайного дня, теплий відтінок ближче
                                    // до повного - щоб перевантажені дні впадали в око
                                    // без окремої легенди.
                                    background: dayLoad >= 0.85 ? '#D99A2B' : dayLoad >= 0.5 ? '#8FAE93' : '#C2D8C4',
                                    transition: 'width 0.2s ease',
                                  }} />
                                </div>
                              )}

                              {dayApps.length > 0 && (
                                <div className="cal-m-dots" style={{ display: 'none' }}>
                                  {dayApps.filter((a: any) => a.status !== 'blocked' && a.color !== 'blocked').slice(0, 3).map((a: any) => (
                                    <i key={a.id} style={{ background: getCardColor(a.staff_id).vividBg }} />
                                  ))}
                                  {dayApps.filter((a: any) => a.status !== 'blocked' && a.color !== 'blocked').length > 0 && (
                                    <b>{dayApps.filter((a: any) => a.status !== 'blocked' && a.color !== 'blocked').length}</b>
                                  )}
                                </div>
                              )}
                              {dayApps.length > 0 && (
                                <div className="cal-m-chips" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, overflow: 'hidden', width: '100%' }}>
                                  {dayApps.slice(0, 4).map((app: any) => {
                                    const isBlock = app.status === 'blocked' || app.color === 'blocked';
                                    const mColors = getCardColor(app.staff_id);
                                    return (
                                      <div key={app.id} draggable={!isBlock} onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData('text/plain', String(app.id)); }} onClick={(e) => openBookingDetails(app, e)}
                                        className={`${isBlock ? 'non-working-bg' : ''} ${app.status ? 'status-' + app.status : ''}`} style={{
                                        fontSize: '0.7rem',
                                        backgroundColor: isBlock ? 'transparent' : (mColors.pastelBg),
                                        color: isBlock ? '#64748b' : (mColors.pastelText),
                                        padding: '0.25rem 0.5rem', borderRadius: '6px', border: isBlock ? '1px dashed #cbd5e1' : 'none', cursor: isBlock ? 'pointer' : 'grab', opacity: app.status === 'completed' ? 0.6 : 1, textDecoration: app.status === 'no-show' ? 'line-through' : 'none', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: '600', width: '100%', boxSizing: 'border-box', overflow: 'hidden'
                                      }}>
                                        <span style={{ opacity: 0.7, fontWeight: '700', flexShrink: 0 }}>{app.start_time.substring(0, 5)}</span>
                                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flex: 1 }}>{isBlock ? (app.block_reason || app.service_name || 'Перерва') : app.client_name}</span>
                                      </div>
                                    )
                                  })}
                                  {dayApps.length > 4 && <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '500', paddingLeft: '0.2rem', marginTop: 'auto' }}>+ ще {dayApps.length - 4}</div>}
                                </div>
                              )}
                          </div>
                      )
                  })}
              </div>

              {/* Телефон: записи вибраного дня під сіткою (на ПК блок прихований) */}
              {(() => {
                const sel = selectedMonthDay;
                const dayList = [...getAppointmentsForDay(sel)].sort((a: any, b: any) => String(a.start_time).localeCompare(String(b.start_time)));
                const isBlk = (a: any) => a.status === 'blocked' || a.color === 'blocked' || !a.service_id;
                const real = dayList.filter((a: any) => !isBlk(a));
                const sum = real.filter((a: any) => a.status !== 'cancelled' && a.status !== 'no-show').reduce((t: number, a: any) => t + (Number(a.price) || 0), 0);
                const key = `m:${sel.toDateString()}`;
                const title = sel.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });
                // Записи дня за майстрами: одразу зрозуміло, чиї вони
                const known = (team || []).filter((m: any) => m.provides_services !== false);
                const groups: { key: string; name: string; color: string; apps: any[] }[] = known
                  .map((m: any) => ({ key: String(m.id), name: m.name || m.full_name || 'Майстер', color: getCardColor(String(m.id)).vividBg, apps: dayList.filter((a: any) => String(a.staff_id) === String(m.id)) }))
                  .filter((g: any) => g.apps.length > 0);
                const rest = dayList.filter((a: any) => !known.some((m: any) => String(m.id) === String(a.staff_id)));
                if (rest.length) groups.push({ key: '__none', name: 'Без майстра', color: '#94a3b8', apps: rest });
                return (
                  <div className="cal-m-agenda">
                    <div className="cal-m-agenda-head">
                      <div>
                        <div className="cal-m-agenda-title">{title.charAt(0).toUpperCase() + title.slice(1)}</div>
                        <div className="cal-m-agenda-sub">{real.length > 0 ? `${real.length} ${real.length === 1 ? 'запис' : real.length < 5 ? 'записи' : 'записів'}${sum ? ` · ${sum.toLocaleString('uk-UA')} ₴` : ''}` : 'Записів немає'}</div>
                      </div>
                      <button type="button" onClick={() => { setCurrentDate(sel); setCalendarView('day'); localStorage.setItem('bookera_calendarView', 'day'); }}>Відкрити день</button>
                    </div>
                    {groups.map(g => {
                      const gOpen = !!listExpanded[`${key}:${g.key}`];
                      const gShown = gOpen ? g.apps : g.apps.slice(0, 4);
                      return (
                        <div key={g.key} className="cal-m-group">
                          <div className="cal-m-group-head">
                            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                            <b>{g.name}</b>
                            <span>{g.apps.filter((a: any) => !isBlk(a)).length > 0 ? `${g.apps.filter((a: any) => !isBlk(a)).length} зап.` : ''}</span>
                          </div>
                          {gShown.map((app: any) => {
                            const block = isBlk(app);
                            const svc = services.find((x: any) => String(x.id) === String(app.service_id));
                            const off = app.status === 'cancelled' || app.status === 'no-show';
                            const st = statusStyle[app.status as string];
                            const dur = fmtMin(minutesOf(app));
                            return (
                              <div key={app.id} className="cal-list-row" onClick={(e) => openBookingDetails(app, e)} role="button" tabIndex={0}
                                style={{ opacity: off ? 0.55 : 1, boxShadow: `inset 3px 0 0 ${g.color}` }}>
                                <div className="cl-time" style={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1.25 }}>
                                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>{String(app.start_time).substring(0, 5)}</div>
                                  {app.end_time && <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{String(app.end_time).substring(0, 5)}</div>}
                                </div>
                                <div className="cl-client" style={{ fontWeight: 600, fontSize: '0.92rem', color: block ? '#64748b' : '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {block ? (app.block_reason || app.service_name || 'Перерва') : app.client_name}
                                </div>
                                <div className="cl-svc" style={{ fontSize: '0.8rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {block ? '' : [svc?.name || app.service_name, dur].filter(Boolean).join(' · ')}
                                </div>
                                <div className="cl-price" style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a', textAlign: 'right' }}>{!block && app.price ? `${Number(app.price).toLocaleString('uk-UA')} ₴` : ''}</div>
                                <div className="cl-status">{st && <span style={{ fontSize: '0.68rem', fontWeight: 600, color: st.color, background: st.bg, padding: '1px 7px', borderRadius: '999px', whiteSpace: 'nowrap' }}>{st.label}</span>}</div>
                              </div>
                            );
                          })}
                          {g.apps.length > 4 && (
                            <button type="button" className="cal-m-agenda-more" onClick={() => setListExpanded(prev => ({ ...prev, [`${key}:${g.key}`]: !gOpen }))}>
                              {gOpen ? 'Згорнути' : `Показати ще ${g.apps.length - 4}`}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* --- КНОПКА НОВОГО ЗАПИСУ --- */}
      <button className="fab-button" title="Новий запис" onClick={() => { setApptForm({ client_name: '', client_phone: '+380', service_id: '', staff_id: filterMaster !== 'all' ? filterMaster : '', date: toLocalDateStr(currentDate), time: checkSameDay(toLocalDateStr(new Date()), currentDate) ? `${String(Math.min(23, new Date().getHours() + 1)).padStart(2, '0')}:00` : '10:00', block_reason: '', duration: 60 }); setIsBlockMode(false); setIsApptModalOpen(true); }}>
        <Icons.Plus />
      </button>

      {/* --- МОДАЛКА НОВОГО ЗАПИСУ --- */}
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
                Блокувати час <HelpTip>Закрити час для онлайн-запису: перерва, обід, особисті справи. Клієнти не зможуть записатись на цей проміжок, а в календарі він буде сірим.</HelpTip>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label className="modal-label">Дата</label>
                <input type="date" value={apptForm.date} onChange={e => setApptForm({...apptForm, date: e.target.value})} className="modal-input" style={{ cursor: 'pointer' }} />
              </div>

              {!isBlockMode ? (
                <>
                  <div>
                    <label className="modal-label">Ім'я клієнта</label>
                    <input data-field="appt-name" type="text" value={apptForm.client_name} onChange={e => setApptForm({...apptForm, client_name: e.target.value})} className="modal-input" placeholder="Наприклад: Іван Іванов" />
                  </div>
                  <div>
                    <label className="modal-label">Номер телефону</label>
                    <input data-field="appt-phone"
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
                      <select data-field="appt-service"
                        value={apptForm.service_id}
                        onChange={e => {
                          const selectedService = services.find((s:any) => String(s.id) === e.target.value);
                          setApptAddonIds([]);
                          setApptForm({ ...apptForm, service_id: e.target.value, duration: selectedService ? Number(selectedService.duration_minutes) || apptForm.duration : apptForm.duration });
                        }}
                      >
                        <option value="" disabled>Оберіть послугу...</option>
                        {(() => {
                           let availableServices = services;
                           if (apptForm.staff_id) {
                              const selectedM = team.find((t:any) => String(t.id) === String(apptForm.staff_id));
                              if (selectedM && selectedM.assigned_services && selectedM.assigned_services.length > 0) {
                                 availableServices = services.filter((s:any) => selectedM.assigned_services.includes(String(s.id)) || selectedM.assigned_services.includes(Number(s.id)));
                              }
                           }
                           if (availableServices.length === 0) return <option value="" disabled>Майстер не надає жодних послуг</option>
                           return availableServices.map((s:any) => ( <option key={s.id} value={s.id}>{s.name} ({s.price} ₴)</option> ));
                        })()}
                      </select>
                      <div className="modal-select-icon"><Icons.ChevronDown /></div>
                    </div>
                  </div>

                  {/* Додаткові послуги. Мінімальний вигляд: адміністратор
                      бере трубку й записує клієнта, який просить ще й
                      бороду - це має лягти в ТОЙ САМИЙ запис, інакше
                      тривалість і ціна будуть неправильні. */}
                  {(() => {
                    const svc = services.find((s: any) => String(s.id) === String(apptForm.service_id));
                    const addons = svc?.addons || [];
                    if (addons.length === 0) return null;
                    return (
                      <div>
                        <label className="modal-label">Додатково</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {addons.map((addon: any) => (
                            <label key={addon.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={apptAddonIds.includes(addon.id)}
                                onChange={e => setApptAddonIds(prev =>
                                  e.target.checked ? [...prev, addon.id] : prev.filter(id => id !== addon.id)
                                )}
                              />
                              <span>{addon.name}</span>
                              <span style={{ marginLeft: 'auto', color: '#64748b' }}>
                                +{addon.price} ₴ · {formatDuration(addon.duration_minutes)}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div>
                  <label className="modal-label">Причина блокування</label>
                  <input type="text" value={apptForm.block_reason} onChange={e => setApptForm({...apptForm, block_reason: e.target.value})} className="modal-input" placeholder="Наприклад: Перерва на обід..." />
                </div>
              )}

              <div>
                <label className="modal-label">Майстер</label>
                <div className="modal-select-wrapper">
                  <select value={apptForm.staff_id} onChange={e => setApptForm({...apptForm, staff_id: e.target.value})}>
                    {/* Майстер записує лише у свій графік: ні колег, ні «будь-якого», ні весь заклад
                        (сервер це теж забороняє) */}
                    {!isMasterUser && <option value="">{isBlockMode ? 'Весь заклад (всі майстри)' : 'Будь-який майстер (Не вказано)'}</option>}
                    {team.filter((m:any) => m.provides_services !== false && (!isMasterUser || String(m.id) === String(userProfile?.id))).map((m:any) => ( <option key={m.id} value={m.id}>{m.name}</option> ))}
                  </select>
                  <div className="modal-select-icon"><Icons.ChevronDown /></div>
                </div>

                {/* Попередження про графік */}
                {(() => {
                   if (apptForm.date && apptForm.time) {
                      const apptDate = new Date(apptForm.date);
                      const dayIdx = apptDate.getDay() === 0 ? 6 : apptDate.getDay() - 1;
                      const [appH, appM] = apptForm.time.split(':').map(Number);
                      const appTime = appH * 60 + appM;

                      if (apptForm.staff_id) {
                         const selectedM = team.find((t:any) => String(t.id) === String(apptForm.staff_id));
                         if (selectedM && selectedM.shifts && selectedM.shifts.length === 7) {
                            const shift = selectedM.shifts[dayIdx];
                            if (!shift.active) return <div style={{ marginTop: '0.8rem', padding: '0.8rem', background: '#fff1f2', border: '1px dashed #f87171', borderRadius: '8px', color: '#b91c1c', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600' }}><Icons.AlertCircle /> У майстра вихідний на цю дату!</div>;
                            const [startH, startM] = shift.start.split(':').map(Number);
                            const [endH, endM] = shift.end.split(':').map(Number);
                            if (appTime < startH * 60 + startM || appTime >= endH * 60 + endM) return <div style={{ marginTop: '0.8rem', padding: '0.8rem', background: '#fffbeb', border: '1px dashed #fcd34d', borderRadius: '8px', color: '#b45309', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600' }}><Icons.AlertCircle /> Час поза графіком майстра</div>;
                         }
                      } else {
                         const activeMasters = team.filter((m:any) => m.provides_services !== false);
                         if (activeMasters.length > 0) {
                            const isAnyoneWorking = activeMasters.some((m:any) => {
                               if (!m.shifts || m.shifts.length !== 7) return false;
                               const shift = m.shifts[dayIdx];
                               if (!shift.active) return false;
                               const [startH, startM] = shift.start.split(':').map(Number);
                               const [endH, endM] = shift.end.split(':').map(Number);
                               return appTime >= startH * 60 + startM && appTime < endH * 60 + endM;
                            });
                            if (!isAnyoneWorking) return <div style={{ marginTop: '0.8rem', padding: '0.8rem', background: '#fff1f2', border: '1px dashed #f87171', borderRadius: '8px', color: '#b91c1c', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600' }}><Icons.AlertCircle /> Увага! Жоден майстер не працює в цей час.</div>;
                         } else {
                            const shift = shifts[dayIdx];
                            if (shift && !shift.active) return <div style={{ marginTop: '0.8rem', padding: '0.8rem', background: '#fff1f2', border: '1px dashed #f87171', borderRadius: '8px', color: '#b91c1c', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600' }}><Icons.AlertCircle /> У закладу вихідний на цю дату!</div>;
                            if (shift) {
                               const [startH, startM] = shift.start.split(':').map(Number);
                               const [endH, endM] = shift.end.split(':').map(Number);
                               if (appTime < startH * 60 + startM || appTime >= endH * 60 + endM) return <div style={{ marginTop: '0.8rem', padding: '0.8rem', background: '#fffbeb', border: '1px dashed #fcd34d', borderRadius: '8px', color: '#b45309', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600' }}><Icons.AlertCircle /> Час поза графіком закладу</div>;
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

            <button
              onClick={handleSaveAppointment}
              disabled={isSavingAppt}
              style={{
                width: '100%', marginTop: '2.5rem', padding: '0.85rem',
                backgroundColor: isSavingAppt ? '#334155' : '#0f172a',
                color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '1rem',
                cursor: isSavingAppt ? 'not-allowed' : 'pointer', transition: '0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
              }}
            >
              {isSavingAppt ? (
                <>
                  <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.6s linear infinite' }}></span>
                  <span>Збереження...</span>
                </>
              ) : (
                <span>{isBlockMode ? 'Заблокувати' : 'Створити запис'}</span>
              )}
            </button>
          </div>
        </div>
      )}


      {/* --- ДЕТАЛІ ЗАПИСУ --- */}
      {isBookingDetailsModalOpen && selectedBooking && (() => {
        const isBlock = selectedBooking.status === 'blocked' || selectedBooking.color === 'blocked';
        const serviceName = services.find((s: any) => String(s.id) === String(selectedBooking.service_id))?.name;
        const masterName = team.find((m: any) => String(m.id) === String(selectedBooking.staff_id))?.name;

        const duration = (() => {
          const s = selectedBooking.start_time, e = selectedBooking.end_time;
          if (!s || !e || String(s).includes('T')) return null;
          const [sH, sM] = String(s).split(':').map(Number);
          let [eH, eM] = String(e).split(':').map(Number);
          if (eH < sH) eH += 24;
          const mins = (eH * 60 + eM) - (sH * 60 + sM);
          if (mins <= 0) return null;
          const h = Math.floor(mins / 60), m = mins % 60;
          return `${h ? h + ' год ' : ''}${m ? m + ' хв' : ''}`.trim();
        })();

        // Статуси однаковою вагою в один ряд: раніше кожен мав власний
        // яскравий колір із рамкою, і вікно перетворювалось на світлофор.
        // Тепер виділяється лише ПОТОЧНИЙ стан, решта спокійні.
        const statuses = [
          { key: 'completed', label: 'Завершено' },
          { key: 'late', label: 'Запізнення' },
          { key: 'no-show', label: 'Не прийшов' },
        ];

        return (
          <div className="modal-overlay" onClick={() => setIsBookingDetailsModalOpen(false)}>
            <div
              className="modal-content"
              onClick={e => e.stopPropagation()}
              style={{ animation: 'slideUp 0.25s ease', maxWidth: '400px', width: '100%', background: '#fff', borderRadius: '18px', padding: '1.5rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#222222', letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {isBlock ? (selectedBooking.block_reason || selectedBooking.notes || selectedBooking.client_name || 'Перерва') : (selectedBooking.client_name || 'Без імені')}
                  </div>
                  {!isBlock && selectedBooking.client_phone && (
                    <a href={`tel:${selectedBooking.client_phone}`} style={{ fontSize: '0.85rem', color: '#5C6B5E', textDecoration: 'none' }}>
                      {selectedBooking.client_phone}
                    </a>
                  )}
                </div>
                <button
                  onClick={() => setIsBookingDetailsModalOpen(false)}
                  style={{ flexShrink: 0, width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: '#F2F6F1', color: '#5C6B5E', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}
                >
                  ×
                </button>
              </div>

              {/* Час і тривалість - головне в картці, тому найбільшим кеглем.
                  Час редагується просто тут: це найчастіша правка. */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', marginBottom: '1.25rem' }}>
                <input
                  type="time"
                  className="cal-time-input"
                  value={String(selectedBooking.start_time || '').substring(0, 5)}
                  onChange={e => handleUpdateBookingTime(e.target.value)}
                  style={{ fontSize: '1.6rem', fontWeight: 700, color: '#222222', border: 'none', background: 'transparent', padding: 0, outline: 'none', width: '105px', letterSpacing: '-0.02em', fontFamily: 'inherit' }}
                />
                {duration && <span style={{ fontSize: '0.9rem', color: '#6B756A' }}>{duration}</span>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid #EDF1EC', marginBottom: '1.25rem' }}>
                {!isBlock && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.875rem' }}>
                    <span style={{ color: '#6B756A' }}>Послуга</span>
                    <span style={{ color: '#222222', fontWeight: 500, textAlign: 'right' }}>{serviceName || '—'}</span>
                  </div>
                )}

                {/* Додаткові послуги, обрані клієнтом при записі.
                    Без них майстер бачить лише основну послугу й не знає,
                    що людина доплатила за додаткові - а вони вже в ціні
                    та в тривалості візиту. */}
                {!isBlock && (selectedBooking.addon_service_ids?.length ?? 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.875rem' }}>
                    <span style={{ color: '#6B756A' }}>Додатково</span>
                    <span style={{ color: '#222222', fontWeight: 500, textAlign: 'right' }}>
                      {(selectedBooking.addon_service_ids as number[])
                        .map((id: number) => services.find((s: any) => String(s.id) === String(id))?.name)
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6B756A' }}>Майстер</span>
                  <span style={{ color: '#222222', fontWeight: 600, textAlign: 'right' }}>
                    {isBlock && (!selectedBooking.staff_id || selectedBooking.staff_id === 'all' || selectedBooking.staff_id === '0')
                      ? 'Весь заклад (всі майстри)'
                      : (masterName || 'Не призначено')}
                  </span>
                </div>
                {!isBlock && selectedBooking.deposit_status && selectedBooking.deposit_due ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.875rem' }}>
                    <span style={{ color: '#6B756A' }}>Завдаток</span>
                    <span style={{ fontWeight: 600, textAlign: 'right', color: selectedBooking.deposit_status === 'awaiting' ? '#B45309' : '#222222' }}>
                      {selectedBooking.deposit_status === 'awaiting' && `${selectedBooking.deposit_due} ₴ — чекаємо оплату`}
                      {(selectedBooking.deposit_status === 'held' || selectedBooking.deposit_status === 'paid_out') && `${selectedBooking.deposit_paid ?? selectedBooking.deposit_due} ₴ сплачено${selectedBooking.price ? ` · у закладі ${Math.max(Number(selectedBooking.price) - Number(selectedBooking.deposit_paid ?? selectedBooking.deposit_due), 0)} ₴` : ''}`}
                      {selectedBooking.deposit_status === 'retained' && `${selectedBooking.deposit_paid ?? selectedBooking.deposit_due} ₴ — лишається вам (неявка)`}
                      {selectedBooking.deposit_status === 'refunded' && `${selectedBooking.deposit_paid ?? selectedBooking.deposit_due} ₴ — повернено клієнту`}
                    </span>
                  </div>
                ) : null}
              </div>

              {!isBlock && selectedBooking.status === 'pending_approval' && (
                <div className="cal-pending-box">
                  <div><b>Чекає вашого підтвердження</b><span>Клієнт отримає лист із вашою відповіддю.</span></div>
                  <div className="cal-pending-btns">
                    <button type="button" className="ok" onClick={() => void handleDecideBooking(selectedBooking, true)}>Підтвердити</button>
                    <button type="button" onClick={() => void handleDecideBooking(selectedBooking, false)}>Відхилити</button>
                  </div>
                </div>
              )}
              {!isBlock && selectedBooking.status !== 'pending_approval' && (
                <>
                  <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
                    {statuses.map(s => {
                      const active = selectedBooking.status === s.key;
                      return (
                        <button
                          key={s.key}
                          onClick={() => handleUpdateBookingStatus(s.key)}
                          style={{
                            flex: 1, height: '36px', borderRadius: '9px', cursor: 'pointer',
                            fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'inherit',
                            letterSpacing: '-0.01em', transition: 'background-color 0.15s, color 0.15s',
                            border: '1px solid ' + (active ? 'transparent' : 'rgba(34,34,34,0.12)'),
                            background: active ? '#222222' : '#fff',
                            color: active ? '#fff' : '#5C6B5E',
                          }}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Чайові - лише за завершений візит. Потрапляють у заробіток
                      майстра й в оцінку якості його роботи («Команда» → «Якість»). */}
                  {selectedBooking.status === 'completed' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 0.85rem', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', flex: 1 }}>Чайові</span>
                      <span style={{ position: 'relative' }}>
                        <input
                          key={selectedBooking.id}
                          type="text"
                          inputMode="numeric"
                          defaultValue={selectedBooking.tip_amount ? String(Math.round(selectedBooking.tip_amount)) : ''}
                          placeholder="0"
                          onChange={e => { e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6); }}
                          onBlur={e => void handleSaveTip(Number(e.target.value || 0))}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                          style={{ width: '96px', height: '34px', padding: '0 1.6rem 0 0.6rem', borderRadius: '9px', border: '1px solid #e2e8f0', fontFamily: 'inherit', fontSize: '0.9rem', textAlign: 'right', outline: 'none' }}
                        />
                        <span style={{ position: 'absolute', right: '0.55rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '0.85rem' }}>₴</span>
                      </span>
                    </div>
                  )}

                  <button
                    onClick={() => { setClipboardApp(selectedBooking); setIsBookingDetailsModalOpen(false); showToast('Запис скопійовано — оберіть вільний час', 'info'); }}
                    style={{ width: '100%', height: '36px', borderRadius: '9px', border: '1px solid rgba(34,34,34,0.12)', background: '#fff', color: '#222222', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'inherit', marginBottom: '1rem' }}
                  >
                    Повторити візит
                  </button>
                </>
              )}

              {/* Скасування - текстом, а не великою червоною кнопкою: це
                  рідкісна й незворотна дія, вона не має тягнути погляд
                  щоразу, коли відкриваєш картку. */}
              <button
                onClick={() => void handleCancelBooking(selectedBooking)}
                style={{ width: '100%', height: '34px', background: 'transparent', border: 'none', color: '#A83934', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'inherit', borderRadius: '9px', transition: 'background-color 0.15s' }}
                onMouseOver={e => e.currentTarget.style.background = '#FBF0EF'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                {isBlock ? 'Видалити перерву' : 'Скасувати запис'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* --- МОДАЛКА ПЕРЕНЕСЕННЯ (DRAG & DROP) --- */}
      {dragConfirmData && (
        <div className="modal-overlay" onClick={() => setDragConfirmData(null)} style={{ zIndex: 2000 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)', maxWidth: '420px', textAlign: 'center', padding: '2.5rem' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#F4FAF5', color: '#6F9273', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 9l4-4 4 4"/><path d="M9 5v14"/><path d="M19 15l-4 4-4-4"/><path d="M15 19V5"/></svg>
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.8rem' }}>Перенести запис?</h2>
            <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '16px', marginBottom: '2rem', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: '800', color: '#0f172a', marginBottom: '0.8rem', fontSize: '1.05rem' }}>{dragConfirmData.app.client_name}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', background: '#fff', padding: '0.8rem', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>Було</span>
                  <span style={{ fontSize: '1.1rem', fontWeight: '600', color: '#475569', textDecoration: 'line-through' }}>{dragConfirmData.app.start_time.substring(0, 5)}</span>
                </div>
                <div style={{ color: '#cbd5e1' }}><Icons.ChevronRight /></div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: '#6F9273', fontWeight: '800', textTransform: 'uppercase', marginBottom: '2px' }}>Стане</span>
                  <input
                    type="time" value={dragConfirmData.newStart.substring(0, 5)}
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
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '1rem', fontWeight: '600' }}>Дата: {dragConfirmData.targetDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setDragConfirmData(null)} style={{ flex: 1, padding: '0.9rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#e2e8f0'} onMouseOut={e => e.currentTarget.style.background = '#f1f5f9'}>Скасувати</button>
              <button onClick={confirmDragDrop} style={{ flex: 1, padding: '0.9rem', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer', transition: '0.2s', boxShadow: '0 4px 15px rgba(15,23,42,0.15)' }} onMouseOver={e => e.currentTarget.style.background = '#1e293b'} onMouseOut={e => e.currentTarget.style.background = '#0f172a'}>Перенести</button>
            </div>
          </div>
        </div>
      )}

      {/* --- МОДАЛКА ІНФО ЗАДАЧ --- */}
      {showTaskInfoModal && (
        <div className="modal-overlay" onClick={() => setShowTaskInfoModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ animation: 'slideUp 0.3s ease', maxWidth: '400px', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#F4FAF5', color: '#6F9273', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}><Icons.Sparkles /></div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.5rem' }}>Менеджер задач</h2>
            <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '2rem' }}>Тут ви можете створювати швидкі списки справ на день (To-Do).</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button onClick={() => setShowTaskInfoModal(false)} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '8px', fontWeight: '600', color: '#475569', cursor: 'pointer', flex: 1 }}>Скасувати</button>
              <button onClick={confirmTaskInfo} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#222222', border: 'none', borderRadius: '8px', fontWeight: '600', color: '#ffffff', cursor: 'pointer', flex: 1, boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>Зрозуміло</button>
            </div>
          </div>
        </div>
      )}

      {/* --- МОДАЛКА НАЛАШТУВАННЯ КАЛЕНДАРЯ (КОМПАКТНА) --- */}
      {showCalSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowCalSettingsModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)', maxWidth: '460px', padding: '0', borderRadius: '16px' }}>
            <div style={{ padding: '1.1rem 1.4rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <button onClick={() => setShowCalSettingsModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', color: '#64748b', padding: 0 }}><Icons.ChevronLeft /></button>
                <h2 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>Налаштування календаря</h2>
              </div>
              <button
                type="button"
                onClick={handleSaveCalSettings}
                disabled={isSavingCalSettings}
                style={{
                  padding: '0.45rem 1rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: isSavingCalSettings ? '#334155' : '#0f172a',
                  fontWeight: '600',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  cursor: isSavingCalSettings ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 2px 6px rgba(15, 23, 42, 0.12)'
                }}
              >
                {isSavingCalSettings ? (
                  <>
                    <span style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.6s linear infinite' }}></span>
                    <span>Збереження...</span>
                  </>
                ) : (
                  <span>Зберегти</span>
                )}
              </button>
            </div>

            <div className="custom-scroll" style={{ padding: '1.25rem 1.4rem', maxHeight: '75vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.6rem' }}>Вигляд за замовчуванням</label>
                <div style={{ display: 'flex', gap: '1.5rem' }}>
                  {['day', 'week', 'month'].map(view => (
                    <label key={view} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: '#334155', fontWeight: '500' }}>
                      <input type="radio" checked={calSettings.defaultView === view} onChange={() => setCalSettings({...calSettings, defaultView: view})} style={{ display: 'none' }} />
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: calSettings.defaultView === view ? '5px solid #0f172a' : '1.5px solid #cbd5e1', transition: 'all 0.2s ease', flexShrink: 0, boxSizing: 'border-box' }}></div>
                      {view === 'day' ? 'День' : view === 'week' ? 'Тиждень' : 'Місяць'}
                    </label>
                  ))}
                </div>
              </div>


              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.9rem 1rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.85rem' }}>Графік роботи закладу</div>
{/* Години закладу змінюють лише власник і адміністратор - сервер
                    однаково не дасть зберегти (403). Майстрові - пояснення,
                    а не форма, яку він заповнить і не зможе зберегти. */}
                {canEditSalonHours ? (
                <button
                  type="button"
                  onClick={() => { setShowCalSettingsModal(false); setShowShiftsModal(true); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.8rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', color: '#0f172a' }}
                >
                  <Icons.Clock /> Змінити
                </button>
                ) : (
                  <span style={{ fontSize: '0.8rem', color: '#64748b', textAlign: 'right', maxWidth: '200px', lineHeight: 1.4 }}>
                    Змінює власник. Свій графік можна попросити змінити у «Запитах».
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- МОДАЛКА НАЛАШТУВАННЯ РОБОЧИХ ЗМІН (КОМПАКТНА) --- */}
      {showShiftsModal && canEditSalonHours && (
        <div className="modal-overlay" onClick={() => setShowShiftsModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)', maxWidth: '460px', padding: '0', borderRadius: '16px' }}>
            <div style={{ padding: '1.1rem 1.4rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <button onClick={() => { setShowShiftsModal(false); setShowCalSettingsModal(true); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', color: '#64748b', padding: 0 }}><Icons.ChevronLeft /></button>
                <h2 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>Робочі години</h2>
              </div>
              <button
                type="button"
                onClick={handleSaveShifts}
                disabled={isSavingShifts}
                style={{
                  padding: '0.45rem 1rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: isSavingShifts ? '#334155' : '#0f172a',
                  fontWeight: '600',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  cursor: isSavingShifts ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 2px 6px rgba(15, 23, 42, 0.12)'
                }}
              >
                {isSavingShifts ? (
                  <>
                    <span style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.6s linear infinite' }}></span>
                    <span>Збереження...</span>
                  </>
                ) : (
                  <span>Зберегти</span>
                )}
              </button>
            </div>

            <div className="custom-scroll" style={{ padding: '1.25rem 1.4rem', maxHeight: '75vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {shifts.map((shift, idx) => (
                <div key={idx} className="cal-shift-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 1rem', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div className="cal-shift-day" style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', width: '130px' }}>
                    <div onClick={() => { const newShifts = [...shifts]; newShifts[idx].active = !shift.active; setShifts(newShifts); }} style={{ width: '38px', height: '22px', borderRadius: '11px', background: shift.active ? '#10b981' : '#cbd5e1', position: 'relative', cursor: 'pointer', transition: '0.3s', flexShrink: 0 }}>
                      <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: shift.active ? '18px' : '2px', transition: '0.3s', boxShadow: '0 1px 2px rgba(0,0,0,0.15)' }}></div>
                    </div>
                    <div style={{ fontWeight: '600', color: shift.active ? '#0f172a' : '#94a3b8', fontSize: '0.9rem' }}>{shift.day}</div>
                  </div>

                  <div className="cal-shift-times" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    {shift.active ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input type="time" value={shift.start} onChange={(e) => { const newShifts = [...shifts]; newShifts[idx].start = e.target.value; setShifts(newShifts); }} style={{ padding: '0.35rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: '600', color: '#0f172a', fontSize: '0.85rem', width: '75px', textAlign: 'center', outline: 'none' }} />
                        <span style={{ color: '#94a3b8', fontWeight: '700' }}>—</span>
                        <input type="time" value={shift.end} onChange={(e) => { const newShifts = [...shifts]; newShifts[idx].end = e.target.value; setShifts(newShifts); }} style={{ padding: '0.35rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: '600', color: '#0f172a', fontSize: '0.85rem', width: '75px', textAlign: 'center', outline: 'none' }} />
                      </div>
                    ) : (
                      <div style={{ padding: '0.35rem 1rem', color: '#94a3b8', fontWeight: '600', fontSize: '0.8rem', background: '#f8fafc', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>Вихідний</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
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
              <button onClick={() => { setClipboardApp(contextMenu.app); setContextMenu(null); showToast('Запис скопійовано — оберіть вільний час', 'info'); }} style={{ width: '100%', padding: '0.8rem 1rem', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.9rem', color: '#0f172a', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.6rem' }}><Icons.Edit /> Скопіювати візит</button>
            </>
          )}
          <button onClick={() => { setSelectedBooking(contextMenu.app); handleCancelBooking(); setContextMenu(null); }} style={{ width: '100%', padding: '0.8rem 1rem', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.9rem', color: '#ef4444', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.6rem' }}><Icons.Trash /> Скасувати запис</button>
        </div>
      )}
    </div>
  );
}