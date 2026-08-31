'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Icons, MASTER_COLORS, toLocalDateStr, checkSameDay, CurrentTimeIndicator } from '@/components/shared';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';
import { useToast } from '@/context/ToastContext';

// Іконка для чекбоксу в стилі Apple
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

// Масиви пастельних кольорів для справ
const TASK_COLORS = ['#fdf4ff', '#f0fdf4', '#fffbeb', '#f0f9ff', '#fff1f2'];
const TASK_BORDERS = ['#f5d0fe', '#bbf7d0', '#fde68a', '#bae6fd', '#fecdd3'];

export default function CalendarTab({ business, team = [], services = [], refreshClients, userProfile }: any) {
  const supabase = useMemo(() => createClient(), []);
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
  const [appointments, setAppointments] = useState<any[]>([]);
  const [tasks, setTasks] = useState<{id: number, text: string, completed: boolean, date: string}[]>([]);

  const [calSettings, setCalSettings] = useState({
    defaultView: 'day', displayMode: 'fit', colorScheme: 'pastel', colorMode: 'master',
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
    if (business) {
      const savedTasks = localStorage.getItem(`bookera_tasks_${business.id}`);
      if (savedTasks) setTasks(JSON.parse(savedTasks));
      else if (business.tasks) setTasks(business.tasks);
      if (business.cal_settings) setCalSettings(business.cal_settings);
      if (business.shifts) {
        if (Array.isArray(business.shifts)) {
          setShifts(business.shifts);
        } else if (typeof business.shifts === 'string') {
          try {
            const parsed = JSON.parse(business.shifts);
            if (Array.isArray(parsed)) setShifts(parsed);
          } catch (e) {}
        }
      }
    }
  }, [business]);

  // Завантаження збереженого вигляду
  useEffect(() => {
    const savedView = localStorage.getItem('bookera_calendarView');
    if (savedView) setCalendarView(savedView as any);
  }, []);

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
        const currentTime = new Date();

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

          if (result.status === 'confirmed' && currentTime > end) {
            // Реальний PATCH через бекенд (і коректне нарахування комісії,
            // якщо джерело - маркетплейс), не fire-and-forget запит.
            api.updateAppointmentStatus(token, app.id, 'completed').catch(() => {});
            return { ...result, status: 'completed' };
          }
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
        is_open: s.active,
        open_time: s.start,
        close_time: s.end,
      }));
      await Promise.all([
        new Promise(resolve => setTimeout(resolve, 500)),
        api.setBusinessHours(token, business.id, hoursPayload),
      ]);
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
  const saveNewTask = async () => {
    if (!newTaskText.trim()) return setIsAddingTask(false);
    const newTasks = [...tasks, { id: Date.now(), text: newTaskText, completed: false, date: formatDateKey(currentDate) }];
    setTasks(newTasks); setNewTaskText(''); setIsAddingTask(false);
    if (business) localStorage.setItem(`bookera_tasks_${business.id}`, JSON.stringify(newTasks));
  };
  const toggleTask = async (id: number) => {
    const newTasks = tasks.map((t: any) => t.id === id ? { ...t, completed: !t.completed } : t);
    setTasks(newTasks);
    if (business) localStorage.setItem(`bookera_tasks_${business.id}`, JSON.stringify(newTasks));
  };
  const startEditTask = (task: any) => { setEditingTaskId(task.id); setEditingTaskText(task.text); };
  const saveEditedTask = async (id: number) => {
    if (!editingTaskText.trim()) return setEditingTaskId(null);
    const newTasks = tasks.map((t: any) => t.id === id ? { ...t, text: editingTaskText.trim() } : t);
    setTasks(newTasks); setEditingTaskId(null);
    if (business) localStorage.setItem(`bookera_tasks_${business.id}`, JSON.stringify(newTasks));
  };
  const deleteTask = async (id: number) => {
    if (!confirm('Видалити цю справу?')) return;
    const newTasks = tasks.filter((t: any) => t.id !== id);
    setTasks(newTasks);
    if (business) localStorage.setItem(`bookera_tasks_${business.id}`, JSON.stringify(newTasks));
  };

// --- СИСТЕМА ЗАПИСІВ ---
  const handleSaveAppointment = async () => {
    let finalPhone = '';
    if (!isBlockMode && apptForm.client_phone && apptForm.client_phone !== '+380') {
      const phoneStripped = apptForm.client_phone.replace(/\D/g, '');
      if (phoneStripped.length !== 12) {
        showToast("Некоректний номер! Введіть 9 цифр після +380", "error");
        return;
      }
      finalPhone = '+' + phoneStripped;
    }

    if (!isBlockMode && !apptForm.client_name.trim()) {
      showToast("Введіть ім'я клієнта", "error");
      return;
    }

    const selectedService = services.find((s: any) => String(s.id) === String(apptForm.service_id));
    if (!isBlockMode && !selectedService) {
      showToast("Оберіть послугу зі списку", "error");
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
      const created = await api.createManualAppointment(token, {
        business_id: business.id,
        service_id: isBlockMode ? undefined : Number(apptForm.service_id),
        start_time: startDateTime.toISOString(),
        duration_minutes: isBlockMode ? apptForm.duration : undefined,
        master_id: apptForm.staff_id || undefined,
        client_name: isBlockMode ? undefined : apptForm.client_name.trim(),
        client_phone: isBlockMode ? undefined : finalPhone,
        notes: isBlockMode ? (apptForm.block_reason || 'Перерва') : undefined,
        is_block: isBlockMode,
      });

      if (!isBlockMode && refreshClients) refreshClients();

      const end = new Date(created.end_time);
      const pad = (n: number) => String(n).padStart(2, '0');
      setAppointments(prev => [...prev, {
        ...created,
        staff_id: created.master_id,
        booking_date: apptForm.date,
        start_time: `${pad(hours)}:${pad(minutes)}:00`,
        end_time: `${pad(end.getHours())}:${pad(end.getMinutes())}:00`,
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

  const handleCancelBooking = async () => {
    if (!selectedBooking) return;
    const isBlock = selectedBooking.status === 'blocked' || selectedBooking.color === 'blocked';
    if (!confirm(`Ви впевнені, що хочете скасувати ${isBlock ? 'цю перерву' : 'цей запис'}?`)) return;
    try {
      const token = await getAuthToken();
      // 'cancelled' замість жорсткого видалення - зберігає історію для
      // статистики й обліку, узгоджено з рештою системи.
      await api.updateAppointmentStatus(token, selectedBooking.id, 'cancelled');

      setAppointments(prev => prev.filter(a => a.id !== selectedBooking.id));
      setIsBookingDetailsModalOpen(false);
      setSelectedBooking(null);
      showToast(isBlock ? 'Перерву видалено' : 'Запис успішно скасовано', 'success');
    } catch (err: any) {
      showToast(err?.message || "Помилка при скасуванні запису", "error");
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
        duration = srv ? srv.duration : 60;
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
    let newStatus = app.status;
    if (newDateStr === app.booking_date && newStart > app.start_time && app.status !== 'completed') newStatus = 'late';

    setAppointments(prev => prev.map(a => String(a.id) === String(app.id) ? { ...a, booking_date: newDateStr, start_time: newStart, end_time: newEnd, status: newStatus } : a ));
    setDragConfirmData(null);
    if (business) {
      try {
        const token = await getAuthToken();
        const newStartIso = new Date(`${newDateStr}T${newStart}`);
        await api.rescheduleAppointment(token, app.id, newStartIso.toISOString());
      } catch (err: any) {
        showToast(err?.message || "Не вдалося перенести запис", "error");
      }
    }
  };

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
    const masterIndex = team.findIndex((m: any) => String(m.id) === String(staffId));
    if (masterIndex === -1) return MASTER_COLORS[0];
    return MASTER_COLORS[masterIndex % MASTER_COLORS.length];
  };

  const getCardColor = (staffId: string, serviceId?: string) => {
    if (calSettings.colorMode === 'category' && serviceId) {
      const srv = services.find((s: any) => String(s.id) === String(serviceId));
      const identifier = srv?.category?.trim() || srv?.name?.trim() || String(serviceId);
      let hash = 0;
      for (let i = 0; i < identifier.length; i++) hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
      const index = Math.abs(hash) % MASTER_COLORS.length;
      return MASTER_COLORS[index];
    }
    return getMasterColor(staffId);
  };

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

  const processOverlaps = (appsForDay: any[]) => {
    const processed = appsForDay.map(app => {
      const serviceDuration = services.find((s: any) => String(s.id) === String(app.service_id))?.duration || app.duration || 60;
      const pos = getCardPosition(app.start_time, app.end_time, serviceDuration);
      return { ...app, startMins: pos.top, endMins: pos.top + pos.height, topPx: pos.top, heightPx: pos.height };
    }).sort((a, b) => a.startMins - b.startMins || (b.endMins - b.startMins) - (a.endMins - a.startMins));

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

  const filteredAppointments = appointments.filter(app => {
    // Загальна перерва закладу (без прив'язки до майстра)
    const isGlobalBlock = (app.status === 'blocked' || app.color === 'blocked') && !app.staff_id;
    if (isGlobalBlock) return true;

    // Якщо залогінений майстер — відфільтровуємо все, крім його ID
    if (filterMaster !== 'all' && String(app.staff_id) !== String(filterMaster)) {
      return false;
    }
    return true;
  });

  const currentViewAppointmentsCount = filteredAppointments.filter(app => {
    if (app.status === 'blocked' || app.color === 'blocked') return false;
    if (calendarView === 'day') return checkSameDay(app.booking_date || app.start_time, currentDate);
    else if (calendarView === 'week') return weekDays.some(wd => checkSameDay(app.booking_date || app.start_time, wd));
    else if (calendarView === 'month') {
      const appDateObj = new Date(app.booking_date || app.start_time);
      return appDateObj.getMonth() === currentDate.getMonth() && appDateObj.getFullYear() === currentDate.getFullYear();
    }
    return false;
  }).length;

  return (
    <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>
      <style>{`
        /* Спеціальний чекбокс для задач (Apple style) */
        .min-checkbox { width: 18px; height: 18px; border: 1.5px solid #cbd5e1; border-radius: 5px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease; background: #fff; flex-shrink: 0; }
        .min-checkbox:hover { border-color: #94a3b8; }
        .min-checkbox.checked { background: #0f172a; border-color: #0f172a; color: #fff; }
        .min-checkbox svg { width: 12px; height: 12px; opacity: 0; transform: scale(0.5); transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .min-checkbox.checked svg { opacity: 1; transform: scale(1); }
        
        .task-action-btn { color: #94a3b8; background: transparent; border: none; cursor: pointer; transition: 0.2s; padding: 0.2rem; display: flex; align-items: center; justify-content: center; }
        .task-action-btn:hover { color: #0f172a; }
        .task-action-btn.delete:hover { color: #ef4444; }
      `}</style>

      {/* Ліва панель: Міні-календар та віджети */}
      <div className="custom-scroll" style={{ width: '320px', borderRight: '1px solid #e2e8f0', backgroundColor: '#ffffff', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', overflowY: 'auto', flexShrink: 0, zIndex: 10 }}>
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
            <div>Пн</div><div>Вт</div><div>Ср</div><div>Чт</div><div>Пт</div><div>Сб</div><div>Нд</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.2rem' }}>
            {blanks.map(blank => <div key={`blank-${blank}`}></div>)}
            {days.map(day => {
              const isSelected = day === currentDate.getDate();
              const dObj = new Date(currentYear, currentMonth, day);
              const hasOverdue = hasOverdueTasks(dObj);

              return (
                <div
                  key={day}
                  onClick={() => { setCurrentDate(dObj); setCalendarView('day'); localStorage.setItem('bookera_calendarView', 'day'); }}
                  className={`cal-mini-day ${isSelected ? 'selected' : ''}`}
                  style={{ position: 'relative' }}
                >
                  {day}
                  {hasOverdue && <div style={{ position: 'absolute', top: '2px', right: '2px', width: '6px', height: '6px', backgroundColor: '#ef4444', borderRadius: '50%' }}></div>}
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
            <button onClick={handleAddTaskClick} style={{ background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: '0.2s', padding: 0 }} onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
          </div>

<div className="custom-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.2rem' }}>
            {tasksForSelectedDay.length === 0 && !isAddingTask && (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8', fontSize: '0.85rem', border: '1px dashed #e2e8f0', borderRadius: '8px' }}>
                Немає завдань на цей день.<br/>Натисніть <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>+</span> щоб додати.
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
              <div style={{ background: '#ffffff', border: '1px solid #3b82f6', borderRadius: '8px', padding: '0.4rem 0.6rem', display: 'flex', gap: '0.6rem', alignItems: 'center', boxShadow: '0 2px 8px rgba(59,130,246,0.1)' }}>
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
        <div style={{ padding: '1rem 2rem', borderBottom: '1px solid #f1f5f9', backgroundColor: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', position: 'relative', zIndex: 100 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <button
              onClick={() => { setCurrentDate(new Date()); setCalendarView('day'); localStorage.setItem('bookera_calendarView', 'day'); }}
              style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', fontWeight: '600', backgroundColor: '#f1f5f9', color: '#0f172a', border: 'none', borderRadius: '8px', cursor: 'pointer', transition: '0.2s' }}
              onMouseOver={e=>e.currentTarget.style.backgroundColor='#e2e8f0'}
              onMouseOut={e=>e.currentTarget.style.backgroundColor='#f1f5f9'}
            >
              Сьогодні
            </button>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
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
            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', textTransform: 'capitalize', letterSpacing: '-0.02em' }}>
              {calendarView === 'week'
                ? `${weekDays[0].getDate()} - ${weekDays[6].getDate()} ${currentDate.toLocaleString('uk-UA', { month: 'short' })}`
                : calendarView === 'month'
                  ? currentDate.toLocaleString('uk-UA', { month: 'long', year: 'numeric' })
                  : currentDate.toLocaleString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' })
              }
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }} ref={masterFilterRef}>
                <div
                  onClick={() => { if (!isMasterUser) setIsMasterFilterOpen(!isMasterFilterOpen); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: isMasterUser ? '#f1f5f9' : 'transparent',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    color: '#475569',
                    cursor: isMasterUser ? 'default' : 'pointer',
                    transition: '0.2s'
                  }}
                  onMouseOver={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                  onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: String(filterMaster) === String(m.id) ? '#0f172a' : '#e2e8f0', color: String(filterMaster) === String(m.id) ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: '800', flexShrink: 0 }}>
                          {getUserInitials(m.name)}
                        </div>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', backgroundColor: '#f8fafc', padding: '0.2rem 0.6rem', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
                Записів: {currentViewAppointmentsCount}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', background: 'transparent' }}>
              {['day', 'week', 'month'].map(view => {
                const labels: any = { day: 'День', week: 'Тиждень', month: 'Місяць' };
                const isActive = calendarView === view;
                return (
                  <button
                    key={view}
                    onClick={() => { setCalendarView(view as any); localStorage.setItem('bookera_calendarView', view); }}
                    style={{
                      padding: '0.35rem 0.8rem', fontSize: '0.85rem', fontWeight: isActive ? '700' : '500',
                      color: isActive ? '#0f172a' : '#64748b', background: isActive ? '#f1f5f9' : 'transparent',
                      border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s ease'
                    }}
                    onMouseOver={e => { if(!isActive) e.currentTarget.style.color = '#0f172a'; }}
                    onMouseOut={e => { if(!isActive) e.currentTarget.style.color = '#64748b'; }}
                  >
                    {labels[view]}
                  </button>
                )
              })}
            </div>

            <button onClick={() => setShowCalSettingsModal(true)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.color = '#0f172a'} onMouseOut={e => e.currentTarget.style.color = '#94a3b8'} title="Налаштування">
              <Icons.Settings />
            </button>
          </div>
        </div>

        {/* ОБГОРТКА ДЛЯ АНІМАЦІЇ */}
        <div className="animated-calendar" key={currentDate.toISOString() + calendarView} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* --- ДЕНЬ --- */}
          {calendarView === 'day' && (
            <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minWidth: '600px' }}>
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

                {processOverlaps(filteredAppointments.filter(app => checkSameDay(app.booking_date || app.start_time, currentDate))).map(app => {
                  const serviceName = services.find((s:any) => String(s.id) === String(app.service_id))?.name || app.service_name;
                  const staffName = team.find((m:any) => String(m.id) === String(app.staff_id))?.name || app.master_name || 'Без майстра';
                  const isBlock = app.status === 'blocked' || app.color === 'blocked';
                  const mColors = getCardColor(app.staff_id, app.service_id);
                  const isCompact = app.heightPx <= 45;
                  const isTiny = app.heightPx <= 25;
                  const widthPercent = 100 / (app.colCount || 1);
                  const leftPercent = (app.colIndex || 0) * widthPercent;

                  return (
                    <div
                      key={app.id}
                      draggable={!isBlock}
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(app.id)); }}
                      onContextMenu={(e) => handleContextMenu(e, app)}
                      className={`cal-app-card ${isBlock ? 'non-working-bg' : ''} ${app.status ? 'status-' + app.status : ''}`}
                      style={{
                        position: 'absolute', top: `${app.topPx}px`, height: `${app.heightPx}px`,
                        left: `calc(68px + (100% - 76px) * ${leftPercent / 100})`, width: `calc((100% - 76px) * ${widthPercent / 100} - 6px)`,
                        backgroundColor: isBlock ? 'transparent' : (calSettings.colorScheme === 'vivid' ? mColors.vividBg : mColors.pastelBg),
                        color: isBlock ? '#64748b' : (calSettings.colorScheme === 'vivid' ? '#ffffff' : mColors.pastelText),
                        borderLeft: isBlock ? '2px dashed #cbd5e1' : `3px solid ${calSettings.colorScheme === 'vivid' ? mColors.vividBorder : mColors.vividBg}`,
                        borderRadius: '8px',
                        padding: isTiny ? '0.1rem 0.5rem' : (isCompact ? '0.3rem 0.6rem' : '0.5rem 0.75rem'),
                        display: 'flex', flexDirection: isCompact ? 'row' : 'column', alignItems: isCompact ? 'center' : 'flex-start',
                        gap: isCompact ? '0.5rem' : '2px', fontSize: isTiny ? '0.7rem' : '0.8rem',
                        cursor: isBlock ? 'pointer' : 'grab', zIndex: 5 + (app.colIndex || 0), overflow: 'hidden', boxShadow: isBlock ? 'none' : '0 1px 4px rgba(0,0,0,0.03)', boxSizing: 'border-box'
                      }}
                      onClick={(e) => openBookingDetails(app, e)}
                    >
                      {isBlock ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: isCompact?'flex-start':'center', height: '100%', fontWeight: '600', fontSize: '0.85rem', width: '100%' }}>
                          {app.block_reason || app.service_name || 'Перерва'}
                        </div>
                      ) : (
                        <>
                          <div style={{ fontWeight: '700', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', width: '100%', minWidth: 0 }}>
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{serviceName} {isCompact && <span style={{ fontWeight: '500', opacity: 0.8, marginLeft: '0.4rem' }}>{app.client_name}</span>}</span>
                            <span style={{display: 'flex', alignItems: 'center', gap: '0.2rem', flexShrink: 0, fontSize: isTiny ? '0.65rem' : '0.75rem', fontWeight: '700', opacity: 0.7}}>{app.start_time.substring(0, 5)} {getStatusIcon(app.status)}</span>
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

          {/* --- ТИЖДЕНЬ --- */}
          {calendarView === 'week' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#ffffff', flexShrink: 0 }}>
                <div style={{ width: '60px', flexShrink: 0, borderRight: '1px solid #e2e8f0' }}></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1 }}>
                  {weekDays.map((day, i) => (
                    <div key={i} style={{ padding: '1rem', textAlign: 'center', borderRight: i !== 6 ? '1px solid #e2e8f0' : 'none' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>{['Нд', 'Пн', 'Вв', 'Ср', 'Чт', 'Пт', 'Сб'][day.getDay()]}</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: '900', color: day.toDateString() === now.toDateString() ? '#0f172a' : '#475569' }}>{day.getDate()}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ position: 'relative', display: 'flex', minHeight: `${(gridEndHour - gridStartHour) * 60}px` }}>
                  <div style={{ width: '60px', flexShrink: 0, borderRight: '1px solid #e2e8f0', background: '#fff', position: 'sticky', left: 0, zIndex: 10 }}>
                    {Array.from({ length: gridEndHour - gridStartHour }).map((_, i) => (
                      <div key={i} style={{ height: '60px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '0.5rem 0', color: '#94a3b8', fontSize: '0.75rem', fontWeight: '600', borderBottom: '1px solid transparent' }}>{gridStartHour + i}:00</div>
                    ))}
                  </div>

                  {isCurrentWeek && <CurrentTimeIndicator gridStartHour={gridStartHour} gridTotalHours={gridTotalHours} isToday={true} />}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flex: 1 }}>
                    {weekDays.map((weekDay, i) => {
                      const dayApps = filteredAppointments.filter(app => checkSameDay(app.booking_date || app.start_time, weekDay));
                      const dayShift = effectiveShifts[weekDay.getDay() === 0 ? 6 : weekDay.getDay() - 1];
                      const isCurrentDay = weekDay.toDateString() === now.toDateString();

                      return (
                        <div key={i} style={{ borderRight: i !== 6 ? '1px solid #e2e8f0' : 'none', position: 'relative', background: isCurrentDay ? '#f8fafc' : '#fff' }}>
                          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, pointerEvents: 'none' }}>{renderNonWorkingHours(dayShift)}</div>

                          {Array.from({ length: gridEndHour - gridStartHour }).map((_, hIdx) => (
                            <div key={hIdx} onClick={() => handleQuickAdd(gridStartHour + hIdx, weekDay)} className="cal-week-cell" style={{ height: '60px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', position: 'relative', zIndex: 1 }}
                                 onDragOver={e => e.preventDefault()} onDrop={e => handleDropAppointment(e, weekDay, gridStartHour + hIdx)}></div>
                          ))}

                          {processOverlaps(dayApps).map(app => {
                            const service = services.find((s:any) => String(s.id) === String(app.service_id));
                            const isBlock = app.status === 'blocked' || app.color === 'blocked';
                            const mColors = getCardColor(app.staff_id, app.service_id);
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
                                  background: isBlock ? 'transparent' : (calSettings.colorScheme === 'vivid' ? mColors.vividBg : mColors.pastelBg),
                                  borderRadius: '8px',
                                  padding: isTiny ? '0.1rem 0.4rem' : (isCompact ? '0.2rem 0.5rem' : '0.4rem 0.6rem'),
                                  display: 'flex', flexDirection: isCompact ? 'row' : 'column', alignItems: isCompact ? 'center' : 'flex-start',
                                  gap: isCompact ? '0.3rem' : '2px',
                                  color: isBlock ? '#64748b' : (calSettings.colorScheme === 'vivid' ? '#ffffff' : mColors.pastelText),
                                  fontSize: isTiny ? '0.65rem' : '0.75rem',
                                  cursor: isBlock ? 'pointer' : 'grab', zIndex: 5 + (app.colIndex || 0),
                                  borderLeft: isBlock ? '2px dashed #cbd5e1' : `3px solid ${calSettings.colorScheme === 'vivid' ? mColors.vividBorder : mColors.vividBg}`,
                                  overflow: 'hidden', boxShadow: isBlock ? 'none' : '0 1px 3px rgba(0,0,0,0.03)', boxSizing: 'border-box'
                                }}
                              >
                                <div style={{ fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flexShrink: 1, width: '100%' }}>
                                  {isBlock ? (app.block_reason || app.service_name || 'Перерва') : app.client_name}
                                </div>
                                {!isBlock && (
                                  <div style={{ opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '500', fontSize: isTiny ? '0.6rem' : '0.7rem', minWidth: 0, flexShrink: 1, width: '100%' }}>
                                    {isCompact ? `• ${service?.name || ''}` : service?.name}
                                  </div>
                                )}
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
          {calendarView === 'month' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#fff', position: 'relative', zIndex: 1, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #f1f5f9', textAlign: 'center', fontWeight: '600', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '1rem 0', flexShrink: 0 }}>
                 <div>Пн</div><div>Вт</div><div>Ср</div><div>Чт</div><div>Пт</div><div>Сб</div><div>Нд</div>
              </div>

              <div className="custom-scroll" style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(130px, 1fr)', overflowY: 'auto' }}>
                  {blanks.map(blank => <div key={`blank-${blank}`} style={{ borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', backgroundColor: '#fafafa' }}></div>)}

                  {days.map(day => {
                      const dObj = new Date(currentYear, currentMonth, day);
                      const isMDayToday = dObj.toDateString() === now.toDateString();
                      const hasOverdue = hasOverdueTasks(dObj);
                      const dayApps = filteredAppointments.filter(app => checkSameDay(app.booking_date || app.start_time, dObj));

                      return (
                          <div key={day} className="month-view-cell" onClick={() => { setCurrentDate(dObj); setCalendarView('day'); localStorage.setItem('bookera_calendarView', 'day'); }}
                               onDragOver={e => e.preventDefault()} onDrop={e => handleDropAppointment(e, dObj)}
                               style={{ borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: '0.5rem', display: 'flex', flexDirection: 'column' }}>

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingTop: '4px' }}>
                                    {hasOverdue && <div style={{ width: '6px', height: '6px', backgroundColor: '#ef4444', borderRadius: '50%' }}></div>}
                                    {dayApps.filter(a => a.status !== 'blocked').length > 0 && (
                                      <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: '600' }}>{dayApps.filter(a => a.status !== 'blocked').length} зап.</span>
                                    )}
                                  </div>
                                  <span style={{ fontWeight: isMDayToday ? '700' : '500', color: isMDayToday ? '#ffffff' : '#0f172a', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', backgroundColor: isMDayToday ? '#0f172a' : 'transparent', fontSize: '0.9rem' }}>{day}</span>
                              </div>

                              {dayApps.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, overflow: 'hidden', width: '100%' }}>
                                  {dayApps.slice(0, 4).map(app => {
                                    const isBlock = app.status === 'blocked' || app.color === 'blocked';
                                    const mColors = getCardColor(app.staff_id, app.service_id);
                                    return (
                                      <div key={app.id} draggable={!isBlock} onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData('text/plain', String(app.id)); }} onClick={(e) => openBookingDetails(app, e)}
                                        className={`${isBlock ? 'non-working-bg' : ''} ${app.status ? 'status-' + app.status : ''}`} style={{
                                        fontSize: '0.7rem',
                                        backgroundColor: isBlock ? 'transparent' : (calSettings.colorScheme === 'vivid' ? mColors.vividBg : mColors.pastelBg),
                                        color: isBlock ? '#64748b' : (calSettings.colorScheme === 'vivid' ? '#ffffff' : mColors.pastelText),
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
            </div>
          )}
        </div>
      </div>

      {/* --- КНОПКА НОВОГО ЗАПИСУ --- */}
      <button className="fab-button" title="Новий запис" onClick={() => { setApptForm({ client_name: '', client_phone: '+380', service_id: '', staff_id: filterMaster !== 'all' ? filterMaster : '', date: toLocalDateStr(currentDate), time: '10:00', block_reason: '', duration: 60 }); setIsBlockMode(false); setIsApptModalOpen(true); }}>
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
                Блокувати час
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
                          const selectedService = services.find((s:any) => String(s.id) === e.target.value);
                          setApptForm({ ...apptForm, service_id: e.target.value, duration: selectedService ? selectedService.duration : apptForm.duration });
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
                    <option value="">{isBlockMode ? 'Весь заклад (всі майстри)' : 'Будь-який майстер (Не вказано)'}</option>
                    {team.filter((m:any) => m.provides_services !== false).map((m:any) => ( <option key={m.id} value={m.id}>{m.name}</option> ))}
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

      {/* --- МОДАЛКА ДЕТАЛЕЙ ЗАПИСУ --- */}
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
                      {services.find((s:any) => s.id === selectedBooking.service_id)?.name || selectedBooking.service_name || 'Невідома послуга'}
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
                  {team.find((m:any) => m.id === selectedBooking.staff_id)?.name || selectedBooking.master_name || 'Будь-який (Не вказано)'}
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
                      services.find((s:any) => String(s.id) === String(selectedBooking.service_id))?.duration || 60
                    )} хв
                  </span>
                </div>
              </div>
            </div>

            {selectedBooking.status !== 'blocked' && selectedBooking.color !== 'blocked' && (
              <div style={{ marginBottom: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '700', display: 'block', marginBottom: '0.8rem', textTransform: 'uppercase' }}>Дії з візитом</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem', marginBottom: '0.6rem' }}>
                  <button onClick={() => handleUpdateBookingStatus('completed')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', padding: '0.6rem 0', border: '1px solid #86efac', background: selectedBooking.status === 'completed' ? '#dcfce7' : '#fff', color: '#166534', borderRadius: '8px', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer', transition: '0.2s', whiteSpace: 'nowrap' }}><Icons.CheckCircle /> Завершено</button>
                  <button onClick={() => handleUpdateBookingStatus('late')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', padding: '0.6rem 0', border: '1px solid #fde047', background: selectedBooking.status === 'late' ? '#fef08a' : '#fff', color: '#854d0e', borderRadius: '8px', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer', transition: '0.2s', whiteSpace: 'nowrap' }}><Icons.AlertCircle /> Запізнення</button>
                  <button onClick={() => handleUpdateBookingStatus('no-show')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', padding: '0.6rem 0', border: '1px solid #fca5a5', background: selectedBooking.status === 'no-show' ? '#fee2e2' : '#fff', color: '#991b1b', borderRadius: '8px', fontWeight: '700', fontSize: '0.75rem', cursor: 'pointer', transition: '0.2s', whiteSpace: 'nowrap' }}><Icons.XCircle /> Не прийшов</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                   <button onClick={() => { setApptForm({ ...apptForm, client_name: selectedBooking.client_name, client_phone: selectedBooking.client_phone || '+380', service_id: selectedBooking.service_id, staff_id: selectedBooking.staff_id, duration: services.find((s:any)=>String(s.id)===String(selectedBooking.service_id))?.duration || 60, date: toLocalDateStr(currentDate) }); setIsBookingDetailsModalOpen(false); setIsBlockMode(false); setIsApptModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', borderRadius: '8px', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', transition: '0.2s' }} onMouseOver={e=>e.currentTarget.style.background='#f1f5f9'} onMouseOut={e=>e.currentTarget.style.background='#f8fafc'}><Icons.Calendar /> Повторити</button>
                   <button onClick={() => { setClipboardApp(selectedBooking); setIsBookingDetailsModalOpen(false); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.6rem', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', borderRadius: '8px', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', transition: '0.2s' }} onMouseOver={e=>e.currentTarget.style.background='#f1f5f9'} onMouseOut={e=>e.currentTarget.style.background='#f8fafc'}><Icons.Edit /> Копіювати</button>
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

      {/* --- МОДАЛКА ПЕРЕНЕСЕННЯ (DRAG & DROP) --- */}
      {dragConfirmData && (
        <div className="modal-overlay" onClick={() => setDragConfirmData(null)} style={{ zIndex: 2000 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)', maxWidth: '420px', textAlign: 'center', padding: '2.5rem' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
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
                  <span style={{ fontSize: '0.7rem', color: '#3b82f6', fontWeight: '800', textTransform: 'uppercase', marginBottom: '2px' }}>Стане</span>
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
                    style={{ fontSize: '1.2rem', fontWeight: '800', color: '#3b82f6', border: 'none', background: 'transparent', outline: 'none', cursor: 'pointer', padding: 0 }}
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
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}><Icons.Sparkles /></div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.5rem' }}>Менеджер задач</h2>
            <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '2rem' }}>Тут ви можете створювати швидкі списки справ на день (To-Do).</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button onClick={() => setShowTaskInfoModal(false)} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '8px', fontWeight: '600', color: '#475569', cursor: 'pointer', flex: 1 }}>Скасувати</button>
              <button onClick={confirmTaskInfo} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#3b82f6', border: 'none', borderRadius: '8px', fontWeight: '600', color: '#ffffff', cursor: 'pointer', flex: 1, boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>Зрозуміло</button>
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

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.6rem' }}>Кольорова схема</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                  {['pastel', 'vivid'].map(scheme => (
                    <div
                      key={scheme}
                      onClick={() => setCalSettings({...calSettings, colorScheme: scheme})}
                      style={{
                        border: `1.5px solid ${calSettings.colorScheme === scheme ? '#0f172a' : '#e2e8f0'}`,
                        borderRadius: '10px',
                        padding: '0.8rem',
                        cursor: 'pointer',
                        background: calSettings.colorScheme === scheme ? '#f8fafc' : '#fff',
                        transition: '0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                        <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: calSettings.colorScheme === scheme ? '4px solid #0f172a' : '1.5px solid #cbd5e1', flexShrink: 0 }}></div>
                        <span style={{ fontWeight: '700', fontSize: '0.85rem', color: '#0f172a' }}>{scheme === 'pastel' ? 'Пастельні' : 'Яскраві'}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <div style={{ flex: 1, height: '8px', borderRadius: '3px', background: scheme === 'pastel' ? '#e0e7ff' : '#3b82f6' }}></div>
                        <div style={{ flex: 1, height: '8px', borderRadius: '3px', background: scheme === 'pastel' ? '#dcfce7' : '#10b981' }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.6rem' }}>Колір карток у розкладі</label>
                <div style={{ display: 'flex', gap: '1.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: '#334155', fontWeight: '500' }}>
                    <input type="radio" checked={calSettings.colorMode === 'master' || !calSettings.colorMode} onChange={() => setCalSettings({...calSettings, colorMode: 'master'})} style={{ display: 'none' }} />
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: (calSettings.colorMode === 'master' || !calSettings.colorMode) ? '5px solid #0f172a' : '1.5px solid #cbd5e1', flexShrink: 0 }}></div>
                    За майстром
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: '#334155', fontWeight: '500' }}>
                    <input type="radio" checked={calSettings.colorMode === 'category'} onChange={() => setCalSettings({...calSettings, colorMode: 'category'})} style={{ display: 'none' }} />
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: calSettings.colorMode === 'category' ? '5px solid #0f172a' : '1.5px solid #cbd5e1', flexShrink: 0 }}></div>
                    За послугою
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.9rem 1rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.85rem' }}>Графік роботи закладу</div>
                <button
                  type="button"
                  onClick={() => { setShowCalSettingsModal(false); setShowShiftsModal(true); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.8rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer', color: '#0f172a' }}
                >
                  <Icons.Clock /> Змінити
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- МОДАЛКА НАЛАШТУВАННЯ РОБОЧИХ ЗМІН (КОМПАКТНА) --- */}
      {showShiftsModal && (
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
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 1rem', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', width: '130px' }}>
                    <div onClick={() => { const newShifts = [...shifts]; newShifts[idx].active = !shift.active; setShifts(newShifts); }} style={{ width: '38px', height: '22px', borderRadius: '11px', background: shift.active ? '#10b981' : '#cbd5e1', position: 'relative', cursor: 'pointer', transition: '0.3s', flexShrink: 0 }}>
                      <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: shift.active ? '18px' : '2px', transition: '0.3s', boxShadow: '0 1px 2px rgba(0,0,0,0.15)' }}></div>
                    </div>
                    <div style={{ fontWeight: '600', color: shift.active ? '#0f172a' : '#94a3b8', fontSize: '0.9rem' }}>{shift.day}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
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
              <button onClick={() => { setClipboardApp(contextMenu.app); setContextMenu(null); }} style={{ width: '100%', padding: '0.8rem 1rem', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.9rem', color: '#0f172a', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.6rem' }}><Icons.Edit /> Скопіювати візит</button>
            </>
          )}
          <button onClick={() => { setSelectedBooking(contextMenu.app); handleCancelBooking(); setContextMenu(null); }} style={{ width: '100%', padding: '0.8rem 1rem', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.9rem', color: '#ef4444', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.6rem' }}><Icons.Trash /> Скасувати запис</button>
        </div>
      )}
    </div>
  );
}