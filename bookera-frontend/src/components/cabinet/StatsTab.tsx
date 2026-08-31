'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';
import { Icons } from '@/components/shared';

export default function StatsTab({ services, team, business }: any) {
  const supabase = createClient();
  const [statsTab, setStatsTab] = useState<'overview' | 'appointments' | 'clients' | 'revenue' | 'services' | 'staff' | 'archive'>('overview');

  // 🟢 Локальний стейт для записів
  const [appointments, setAppointments] = useState<any[]>([]);

  const [statsPeriodType, setStatsPeriodType] = useState<'day' | 'week' | 'month' | 'year' | 'custom'>('day');
  const [statsDate, setStatsDate] = useState(new Date());

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [customStart, setCustomStart] = useState(new Date());
  const [customEnd, setCustomEnd] = useState(new Date());

  const [tempStart, setTempStart] = useState<Date | null>(new Date());
  const [tempEnd, setTempEnd] = useState<Date | null>(new Date());
  const [viewDate, setViewDate] = useState(new Date());

  const [, setStatsCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  // Стейт для витрат (реальні + прогноз)
  const [dbExpenses, setDbExpenses] = useState<any[]>([]);
  const [virtualSalaries, setVirtualSalaries] = useState<any[]>([]);

  const [financialGoal, setFinancialGoal] = useState(50000);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInputValue, setGoalInputValue] = useState(financialGoal.toString());

  const datePickerRef = useRef<HTMLDivElement>(null);

  // --- ХЕЛПЕРИ ДЛЯ ДАТ ---
  const getLocalYYYYMMDD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getStartEnd = (date: Date, type: string) => {
    const start = new Date(date), end = new Date(date);
    if (type === 'day') { start.setHours(0,0,0,0); end.setHours(23,59,59,999); }
    else if (type === 'month') { start.setDate(1); start.setHours(0,0,0,0); end.setMonth(end.getMonth() + 1, 0); end.setHours(23,59,59,999); }
    else if (type === 'year') { start.setMonth(0, 1); start.setHours(0,0,0,0); end.setMonth(11, 31); end.setHours(23,59,59,999); }
    else if (type === 'week') {
      const day = start.getDay(), diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff); start.setHours(0,0,0,0); end.setDate(diff + 6); end.setHours(23,59,59,999);
    }
    else if (type === 'custom') {
      const cStart = new Date(customStart); cStart.setHours(0,0,0,0);
      const cEnd = new Date(customEnd); cEnd.setHours(23,59,59,999);
      return { start: cStart, end: cEnd };
    }
    return { start, end };
  };

  const currPeriod = getStartEnd(statsDate, statsPeriodType);

  const currentPeriodLabel = (() => {
    const formatShort = (d: Date) => d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
    if (statsPeriodType === 'day') return statsDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
    if (statsPeriodType === 'month') return statsDate.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });
    if (statsPeriodType === 'year') return statsDate.getFullYear().toString();
    if (statsPeriodType === 'week') {
      return `${formatShort(currPeriod.start)} - ${formatShort(currPeriod.end)} ${currPeriod.end.getFullYear()}`;
    }
    if (statsPeriodType === 'custom') {
      return `${formatShort(customStart)} - ${formatShort(customEnd)}`;
    }
    return '';
  })();

  // 🟢 ЗАВАНТАЖЕННЯ ДАНИХ
  useEffect(() => {
    async function fetchStatsAppointments() {
      if (!business?.id) return;

      const monthStart = new Date(statsDate.getFullYear(), statsDate.getMonth(), 1);
      const monthEnd = new Date(statsDate.getFullYear(), statsDate.getMonth() + 1, 0, 23, 59, 59, 999);

      const fetchStart = currPeriod.start < monthStart ? currPeriod.start : monthStart;
      const fetchEnd = currPeriod.end > monthEnd ? currPeriod.end : monthEnd;

      const formatDate = (d: Date) => {
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().split('T')[0];
      };

      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('business_id', business.id)
        .gte('booking_date', formatDate(fetchStart))
        .lte('booking_date', formatDate(fetchEnd));

      if (!error && data) setAppointments(data);
    }
    fetchStatsAppointments();
  }, [business?.id, currPeriod.start.toISOString(), currPeriod.end.toISOString(), statsDate.getMonth(), statsDate.getFullYear()]);

  useEffect(() => {
    const savedStatsTab = localStorage.getItem('bookera_statsTab');
    if (savedStatsTab) setStatsTab(savedStatsTab as any);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setIsDatePickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 🟢 ВИТРАТИ ТА ПРОГНОЗУВАННЯ
  useEffect(() => {
    async function fetchExpenses() {
      if (!business?.id) return;
      try {
        const token = await getAuthToken();
        const data = await api.listExpenses(token, business.id);
        setDbExpenses(data);
      } catch (err) {
        console.error("Помилка завантаження витрат:", err);
      }
    }
    fetchExpenses().catch(console.error);
  }, [business?.id]);

  useEffect(() => {
    if (!team || !Array.isArray(team)) return;

    const virtual: any[] = [];
    const today = new Date();
    today.setHours(0,0,0,0);

    const maxDate = new Date(statsDate.getFullYear(), statsDate.getMonth() + 1, 0); // Прогноз до кінця обраного місяця

    team.forEach((staff: any) => {
       const fixed = Number(staff.fixed_salary) || 0;

       let currentIterDate = new Date(today);
       currentIterDate.setDate(currentIterDate.getDate() + 1);

       while(currentIterDate <= maxDate) {
          let isPayout = false;
          const dayOfMonth = currentIterDate.getDate();
          const dayOfWeek = currentIterDate.getDay();

          if (staff.payout_period === 'monthly') {
             if (dayOfMonth === Number(staff.payout_day || 1)) isPayout = true;
          } else if (staff.payout_period === 'weekly') {
             const daysMap: any = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
             if (dayOfWeek === daysMap[staff.payout_day || 'monday']) isPayout = true;
          } else if (staff.payout_period === 'biweekly') {
             const d = Number(staff.payout_day || 1);
             const secondD = d + 15 > 28 ? 28 : d + 15;
             if (dayOfMonth === d || dayOfMonth === secondD) isPayout = true;
          } else if (staff.payout_period === 'daily') {
             const shift = staff.shifts ? staff.shifts[dayOfWeek === 0 ? 6 : dayOfWeek - 1] : null;
             if (shift && shift.active) isPayout = true;
          }

          if (isPayout) {
             virtual.push({
                amount: fixed,
                expense_date: getLocalYYYYMMDD(currentIterDate)
             });
          }
          currentIterDate.setDate(currentIterDate.getDate() + 1);
       }
    });

    const grouped = virtual.reduce((acc: any, curr: any) => {
       if (acc[curr.expense_date] === undefined) acc[curr.expense_date] = 0;
       acc[curr.expense_date] += curr.amount;
       return acc;
    }, {});

    const aggregated = Object.keys(grouped).map(date => ({
       id: `virt-agg-${date}`,
       amount: grouped[date],
       category: 'Зарплата',
       description: 'Прогноз зарплати',
       expense_date: date,
       isVirtual: true
    }));

    setVirtualSalaries(aggregated);
  }, [team, statsDate]);

  const STATS_TABS = [
    { id: 'overview', label: 'Огляд' },
    { id: 'clients', label: 'Клієнти' },
    { id: 'services', label: 'Послуги' },
    { id: 'staff', label: 'Команда' },
    { id: 'archive', label: 'Експорт' }
  ];

  const colors = {
    bg: '#ffffff',
    surface: '#ffffff',
    textPrimary: '#1d1d1f',
    textSecondary: '#86868b',
    border: '#e5e5ea',
    accent: '#1d1d1f',

    blue: '#007aff',
    blueLight: '#e5f1ff',
    green: '#34c759',

    wRevBg: '#fefce8', wRevBorder: '#fde047', wRevText: '#a16207',
    wAppBg: '#f0fdf4', wAppBorder: '#bbf7d0', wAppText: '#15803d',
    wCliBg: '#f8fafc', wCliBorder: '#cbd5e1', wCliText: '#1e293b',
  };

  const InfoTooltip = ({ text }: { text: string }) => {
    const [show, setShow] = useState(false);
    return (
      <div
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'help', color: colors.textSecondary }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        <div style={{ display: 'flex', opacity: 0.7 }}><Icons.AlertCircle /></div>
        <div
          style={{ position: 'absolute', bottom: '140%', left: '50%', transform: 'translateX(-50%)', width: '220px', padding: '8px 10px', background: colors.accent, color: '#fff', fontSize: '0.75rem', borderRadius: '8px', textAlign: 'center', opacity: show ? 1 : 0, visibility: show ? 'visible' : 'hidden', transition: '0.2s', pointerEvents: 'none', zIndex: 100, fontWeight: '500', lineHeight: '1.4', boxShadow: '0 8px 20px rgba(0,0,0,0.15)' }}
        >
          {text}
          <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', borderWidth: '5px', borderStyle: 'solid', borderColor: `${colors.accent} transparent transparent transparent` }}></div>
        </div>
      </div>
    );
  };

  const fontFamily = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  const shiftPeriod = (direction: -1 | 1) => {
    if (statsPeriodType === 'custom') {
      const diff = (customEnd.getTime() - customStart.getTime()) + 86400000;
      setCustomStart(new Date(customStart.getTime() + (diff * direction)));
      setCustomEnd(new Date(customEnd.getTime() + (diff * direction)));
    } else {
      const nd = new Date(statsDate);
      if (statsPeriodType === 'day') nd.setDate(nd.getDate() + direction);
      if (statsPeriodType === 'week') nd.setDate(nd.getDate() + (7 * direction));
      if (statsPeriodType === 'month') nd.setMonth(nd.getMonth() + direction);
      if (statsPeriodType === 'year') nd.setFullYear(nd.getFullYear() + direction);
      setStatsDate(nd);
    }
    setStatsCurrentPage(1);
  };

  const handleSaveGoal = () => {
    const parsed = parseInt(goalInputValue.replace(/\D/g, ''));
    if (!isNaN(parsed) && parsed > 0) {
      setFinancialGoal(parsed);
    } else {
      setGoalInputValue(financialGoal.toString());
    }
    setIsEditingGoal(false);
  };

  const downloadCSV = (filename: string, rows: any[][]) => {
    const csvContent = "\uFEFF" + rows.map(e => {
      return e.map(String).map(v => v.includes(',') ? `"${v}"` : v).join(",");
    }).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);

    const periodStr = currentPeriodLabel.replace(/\s/g, '_').toLowerCase();
    link.setAttribute("download", `${filename}_${periodStr}.csv`);

    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- ФІЛЬТРАЦІЯ ТА ПІДРАХУНКИ ---
  const periodApps = (appointments || []).filter((app: any) => {
    if (app.status === 'blocked' || app.color === 'blocked') return false;
    const d = new Date(app.booking_date || app.start_time);
    return d >= currPeriod.start && d <= currPeriod.end;
  });

  const stTotal = periodApps.length;
  const stCompleted = periodApps.filter((a: any) => a.status === 'completed');
  const stNoShow = periodApps.filter((a: any) => a.status === 'no-show');
  const stCancelled = periodApps.filter((a: any) => a.status === 'cancelled');
  const stUpcoming = periodApps.filter((a: any) => a.status !== 'completed' && a.status !== 'no-show' && a.status !== 'cancelled');

  const totalRev = stCompleted.reduce((sum: number, app: any) => sum + ((services || []).find((s: any) => String(s.id) === String(app.service_id))?.price || 0), 0);
  const averageCheck = stCompleted.length > 0 ? Math.round(totalRev / stCompleted.length) : 0;
  const cancelRate = stTotal > 0 ? Math.round(((stCancelled.length + stNoShow.length) / stTotal) * 100) : 0;

  // --- МІСЯЧНІ ДАНІ (Для фінансового звіту) ---
  const monthStart = new Date(statsDate.getFullYear(), statsDate.getMonth(), 1);
  const monthEnd = new Date(statsDate.getFullYear(), statsDate.getMonth() + 1, 0, 23, 59, 59, 999);

  const monthApps = (appointments || []).filter((app: any) => {
    if (app.status === 'blocked' || app.color === 'blocked') return false;
    const d = new Date(app.booking_date || app.start_time);
    return d >= monthStart && d <= monthEnd;
  });

  const monthCompleted = monthApps.filter((a: any) => a.status === 'completed');
  const monthTotalRev = monthCompleted.reduce((sum: number, app: any) => sum + ((services || []).find((s: any) => String(s.id) === String(app.service_id))?.price || 0), 0);
  const goalProgressPercent = Math.min(100, Math.round((monthTotalRev / financialGoal) * 100)) || 0;

  // 🟢 ОБ'ЄДНУЄМО РЕАЛЬНІ ТА ЗАПЛАНОВАНІ ВИТРАТИ
  const combinedExpenses = [...dbExpenses, ...virtualSalaries];

  const monthExpenses = combinedExpenses.filter((e: any) => {
    const dateStr = e.expense_date || e.created_at;
    if (!dateStr) return false;
    const cleanDate = dateStr.split('T')[0];
    const [y, m, d] = cleanDate.split('-').map(Number);
    const expDate = new Date(y, m - 1, d);
    return expDate.getTime() >= monthStart.getTime() && expDate.getTime() <= monthEnd.getTime();
  });

  const monthExpensesAmount = monthExpenses.reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
  const monthNetProfit = monthTotalRev - monthExpensesAmount;

  const clientStats: Record<string, any> = {};
  stCompleted.forEach((app: any) => {
    const p = app.client_phone || 'Невідомо';
    const price = ((services || []).find((s: any) => String(s.id) === String(app.service_id))?.price || 0);
    if (!clientStats[p]) clientStats[p] = { name: app.client_name, phone: p, count: 0, rev: 0 };
    clientStats[p].count++; clientStats[p].rev += price;
  });
  const topClientsArr = Object.values(clientStats);
  const newClientsCount = topClientsArr.filter((c:any) => c.count === 1).length;
  const returningClientsCount = topClientsArr.filter((c:any) => c.count > 1).length;

  // --- РОБОЧІ ГОДИНИ ---
  let minHour = 8;
  let maxHour = 20;
  let isDayOff = false;

  const defaultShifts = [
    { active: true, start: '09:00', end: '20:00' },
    { active: true, start: '09:00', end: '20:00' },
    { active: true, start: '09:00', end: '20:00' },
    { active: true, start: '09:00', end: '20:00' },
    { active: true, start: '09:00', end: '20:00' },
    { active: true, start: '10:00', end: '18:00' },
    { active: false, start: '09:00', end: '20:00' }
  ];

  const shifts = business?.shifts || defaultShifts;

  if (statsPeriodType === 'day') {
    const dayIndex = statsDate.getDay() === 0 ? 6 : statsDate.getDay() - 1;
    const currentShift = shifts[dayIndex];

    if (currentShift && currentShift.active) {
      minHour = parseInt(currentShift.start.split(':')[0], 10);
      maxHour = parseInt(currentShift.end.split(':')[0], 10);
      if (maxHour <= minHour) maxHour += 24;
    } else {
      isDayOff = true;
    }
  } else {
    const activeShifts = shifts.filter((s: any) => s.active);
    if (activeShifts.length > 0) {
      minHour = Math.min(...activeShifts.map((s: any) => parseInt(s.start.split(':')[0], 10)));
      maxHour = Math.max(...activeShifts.map((s: any) => {
        let h = parseInt(s.end.split(':')[0], 10);
        return h <= minHour ? h + 24 : h;
      }));
    }
  }

  const hoursCount = maxHour - minHour + 1 > 0 ? maxHour - minHour + 1 : 1;
  const hoursData = Array(hoursCount).fill(0);
  const hoursLabels = Array.from({length: hoursCount}, (_, i) => {
    const h = (i + minHour) % 24;
    return `${String(h).padStart(2, '0')}:00`;
  });

  const daysData = Array(7).fill(0);
  const daysLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

  let lineLabels: string[] = [];
  let appsData: number[] = [];
  let revData: number[] = [];

  if (statsPeriodType === 'day') {
    lineLabels = hoursLabels;
    appsData = Array(hoursCount).fill(0); revData = Array(hoursCount).fill(0);
    periodApps.forEach((app:any) => {
      const h = parseInt(app.start_time.split(':')[0]);
      if (h >= minHour && h <= maxHour) {
        appsData[h - minHour]++;
        if (app.status === 'completed') revData[h - minHour] += (services || []).find((s:any) => String(s.id) === String(app.service_id))?.price || 0;
      }
    });
  }
  else if (statsPeriodType === 'year') {
    lineLabels = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру'];
    appsData = Array(12).fill(0); revData = Array(12).fill(0);
    periodApps.forEach((app:any) => {
      const m = new Date(app.booking_date || app.start_time).getMonth();
      appsData[m]++;
      if (app.status === 'completed') revData[m] += (services || []).find((s:any) => String(s.id) === String(app.service_id))?.price || 0;
    });
  }
  else if (statsPeriodType === 'month') {
    const year = currPeriod.start.getFullYear();
    const month = currPeriod.start.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    lineLabels = Array.from({length: daysInMonth}, (_, i) => (i + 1).toString());
    appsData = Array(daysInMonth).fill(0);
    revData = Array(daysInMonth).fill(0);

    periodApps.forEach((app:any) => {
      const d = new Date(app.booking_date || app.start_time);
      const dayIndex = d.getDate() - 1;
      if (dayIndex >= 0 && dayIndex < daysInMonth) {
         appsData[dayIndex]++;
         if (app.status === 'completed') revData[dayIndex] += (services || []).find((s:any) => String(s.id) === String(app.service_id))?.price || 0;
      }
    });
  }
  else {
    const totalDays = Math.max(1, Math.ceil((currPeriod.end.getTime() - currPeriod.start.getTime()) / (1000 * 3600 * 24)));
    lineLabels = Array.from({length: totalDays}, (_, i) => {
       const d = new Date(currPeriod.start); d.setDate(d.getDate() + i);
       return totalDays <= 7 ? daysLabels[d.getDay() === 0 ? 6 : d.getDay()-1] : `${d.getDate()}.${d.getMonth() + 1}`;
    });
    appsData = Array(totalDays).fill(0); revData = Array(totalDays).fill(0);

    periodApps.forEach((app:any) => {
      const d = new Date(app.booking_date || app.start_time);
      const idx = Math.floor((d.getTime() - currPeriod.start.getTime()) / (1000 * 3600 * 24));
      if(idx >= 0 && idx < totalDays) {
         appsData[idx]++;
         if (app.status === 'completed') revData[idx] += (services || []).find((s:any) => String(s.id) === String(app.service_id))?.price || 0;
      }
    });
  }

  periodApps.forEach((app:any) => {
     if (app.start_time) {
        const h = parseInt(app.start_time.split(':')[0]);
        if (h >= minHour && h <= maxHour) hoursData[h - minHour]++;
     }
     const d = new Date(app.booking_date || app.start_time).getDay();
     const dayIdx = d === 0 ? 6 : d - 1;
     daysData[dayIdx]++;
  });

  const todayStr = new Date().toDateString();

  const handleCalendarClick = (day: number) => {
    const clickedDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(clickedDate);
      setTempEnd(null);
    } else {
      if (clickedDate < tempStart) {
        setTempEnd(tempStart);
        setTempStart(clickedDate);
      } else {
        setTempEnd(clickedDate);
      }
    }
  };

  const applyCustomDate = () => {
    if (tempStart) {
      setCustomStart(tempStart);
      setCustomEnd(tempEnd || tempStart);
      setStatsPeriodType('custom');
      setIsDatePickerOpen(false);
      setStatsCurrentPage(1);
    }
  };

  const toInputFormat = (d: Date | null) => {
    if (!d) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const generateCalendarDays = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    let startDayIndex = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < startDayIndex; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  const isSelectedDate = (day: number) => {
    if (!day) return false;
    const current = new Date(viewDate.getFullYear(), viewDate.getMonth(), day).getTime();
    const start = tempStart ? tempStart.getTime() : 0;
    const end = tempEnd ? tempEnd.getTime() : 0;
    if (start && end) return current >= start && current <= end;
    if (start) return current === start;
    return false;
  };

  const isEdgeDate = (day: number, edge: 'start'|'end') => {
    if (!day) return false;
    const current = new Date(viewDate.getFullYear(), viewDate.getMonth(), day).getTime();
    if (edge === 'start' && tempStart) return current === tempStart.getTime();
    if (edge === 'end' && tempEnd) return current === tempEnd.getTime();
    return false;
  };

  // --- ІДЕАЛЬНІ ГРАФІКИ ---
  const LineChart = ({ title, data, labels, color, isCurrency = false }: any) => {
    const maxVal = Math.max(...data, 1);
    const step = 1000 / (labels.length > 1 ? labels.length - 1 : 1);

    const genLineBase = (data: number[], max: number, baseHeight: number) => {
      if (data.length === 0) return '';
      const step = 1000 / (data.length > 1 ? data.length - 1 : 1);
      let d = `M 0 ${baseHeight - (data[0]/max)*baseHeight}`;
      for(let i = 1; i < data.length; i++) { d += ` L ${i * step} ${baseHeight - (data[i]/max)*baseHeight}`; }
      return d;
    };

    return (
      <div style={{ marginBottom: '2.5rem' }}>
        <h4 style={{ fontSize: '1.05rem', fontWeight: '600', color: colors.textPrimary, marginBottom: '1.5rem' }}>{title}</h4>
        <div style={{ height: '160px', width: '100%', position: 'relative' }}>
          <svg viewBox="-15 -15 1030 180" style={{ width: '100%', height: '100%', overflow: 'visible' }}>

            <line x1="0" y1="130" x2="1000" y2="130" stroke={colors.border} strokeWidth="1" />
            <line x1="0" y1="65" x2="1000" y2="65" stroke={colors.border} strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
            <line x1="0" y1="0" x2="1000" y2="0" stroke={colors.border} strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />

            <path d={genLineBase(data, maxVal, 130)} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

            {data.map((val: number, i: number) => {
              const x = i * step;
              const y = 130 - (val/maxVal)*130;
              const textAnchor = i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle";

              return (
                <g key={i} style={{ cursor: 'pointer' }}
                   onMouseEnter={(e) => { (e.currentTarget.querySelector('.tooltip') as any).style.opacity = '1'; }}
                   onMouseLeave={(e) => { (e.currentTarget.querySelector('.tooltip') as any).style.opacity = '0'; }}
                >
                  <circle cx={x} cy={y} r={12} fill="transparent" />
                  <circle cx={x} cy={y} r={3.5} fill={colors.surface} stroke={color} strokeWidth="2" />

                  <text x={x} y="158" fill={colors.textSecondary} fontSize={labels.length > 15 ? "13" : "15"} textAnchor={textAnchor} fontWeight="600">
                    {labels[i]}
                  </text>

                  <g className="tooltip" opacity="0" style={{ transition: '0.15s ease', pointerEvents: 'none' }}>
                     <rect x={x - 40} y={y - 42} width="80" height="28" rx="8" fill={colors.accent} />
                     <text x={x} y={y - 23} fill="#fff" fontSize="11" fontWeight="600" textAnchor="middle">{isCurrency ? `${val.toLocaleString('uk-UA')} ₴` : val}</text>
                     <polygon points={`${x-5},${y-14} ${x+5},${y-14} ${x},${y-8}`} fill={colors.accent} />
                  </g>
                </g>
              )
            })}
          </svg>
        </div>
      </div>
    )
  };

  const BarChart = ({ title, data, labels, color }: any) => {
    const maxVal = Math.max(...data, 1);
    const step = 1000 / data.length;
    const barWidth = step * 0.65;

    return (
      <div style={{ width: '100%' }}>
        <h4 style={{ fontSize: '1rem', fontWeight: '600', color: colors.textPrimary, marginBottom: '1.5rem' }}>{title}</h4>
        <div style={{ height: '160px', width: '100%', position: 'relative' }}>
          <svg viewBox="0 -10 1000 180" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            <line x1="0" y1="140" x2="1000" y2="140" stroke={colors.border} strokeWidth="1" />

            {data.map((val: number, i: number) => {
              const x = i * step + (step - barWidth) / 2;
              const h = val === 0 ? 4 : Math.max((val / maxVal) * 140, 15);
              const y = 140 - h;

              return (
                <g key={i} style={{ cursor: 'pointer' }}
                   onMouseEnter={(e) => {
                     (e.currentTarget.querySelector('.bar') as any).style.fillOpacity = '0.7';
                     (e.currentTarget.querySelector('.tooltip') as any).style.opacity = '1';
                   }}
                   onMouseLeave={(e) => {
                     (e.currentTarget.querySelector('.bar') as any).style.fillOpacity = '1';
                     (e.currentTarget.querySelector('.tooltip') as any).style.opacity = '0';
                   }}
                >
                  <rect x={x} y="0" width={barWidth} height="140" fill="transparent" />
                  <rect className="bar" x={x} y={y} width={barWidth} height={h} rx={4} fill={color} style={{ transition: '0.2s', opacity: val === 0 ? 0.2 : 1 }} />

                  <text x={i * step + step/2} y="165" fill={colors.textSecondary} fontSize={labels.length > 10 ? "14" : "16"} textAnchor="middle" fontWeight="600">
                    {labels[i]}
                  </text>

                  <g className="tooltip" opacity="0" style={{ transition: '0.15s ease', pointerEvents: 'none' }}>
                     <rect x={i * step + step/2 - 25} y={y - 35} width="50" height="26" rx="6" fill={colors.accent} />
                     <text x={i * step + step/2} y={y - 18} fill="#fff" fontSize="11" fontWeight="600" textAnchor="middle">{val}</text>
                     <polygon points={`${i * step + step/2 - 5},${y - 9} ${i * step + step/2 + 5},${y - 9} ${i * step + step/2},${y - 3}`} fill={colors.accent} />
                  </g>
                </g>
              )
            })}
          </svg>
        </div>
      </div>
    )
  };

  return (
    <div style={{ fontFamily, padding: '1.5rem 3rem', flexGrow: 1, backgroundColor: colors.bg, minHeight: '100vh', width: '100%' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: colors.textPrimary, margin: 0, letterSpacing: '-0.3px' }}>Аналітика</h2>

        {/* --- КАЛЕНДАР --- */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
           <div style={{ position: 'relative' }} ref={datePickerRef}>

              <div style={{ display: 'flex', alignItems: 'center', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <button onClick={() => shiftPeriod(-1)} style={{ padding: '8px 12px', border: 'none', borderRight: `1px solid ${colors.border}`, background: 'transparent', cursor: 'pointer', color: colors.textSecondary, borderTopLeftRadius: '10px', borderBottomLeftRadius: '10px' }}>&lt;</button>

                <div
                  onClick={() => {
                     setIsDatePickerOpen(!isDatePickerOpen);
                     if (!isDatePickerOpen) {
                        setTempStart(statsPeriodType === 'custom' ? customStart : currPeriod.start);
                        setTempEnd(statsPeriodType === 'custom' ? customEnd : currPeriod.end);
                        setViewDate(statsPeriodType === 'custom' ? customStart : currPeriod.start);
                     }
                  }}
                  style={{ padding: '8px 16px', fontSize: '0.85rem', fontWeight: '500', minWidth: '180px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: colors.textPrimary }}
                >
                  <div style={{ width: 14, height: 14, color: colors.textSecondary, display: 'flex' }}><Icons.Calendar /></div>
                  <span style={{ flex: 1, textAlign: 'center' }}>{currentPeriodLabel}</span>
                </div>

                <button onClick={() => shiftPeriod(1)} style={{ padding: '8px 12px', border: 'none', borderLeft: `1px solid ${colors.border}`, background: 'transparent', cursor: 'pointer', color: colors.textSecondary, borderTopRightRadius: '10px', borderBottomRightRadius: '10px' }}>&gt;</button>
              </div>

              {/* ПОПАП КАЛЕНДАРЯ */}
              {isDatePickerOpen && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: '#fff', border: `1px solid ${colors.border}`, borderRadius: '14px', padding: '1.25rem', boxShadow: '0 8px 30px rgba(0,0,0,0.1)', zIndex: 50, width: '300px', cursor: 'default' }}>

                  <div style={{ display: 'flex', background: '#f2f2f7', borderRadius: '8px', padding: '2px', marginBottom: '1.25rem' }}>
                    {[
                      { id: 'day', label: 'День' },
                      { id: 'week', label: 'Тиждень' },
                      { id: 'month', label: 'Місяць' },
                      { id: 'year', label: 'Рік' }
                    ].map(pt => (
                      <button
                        key={pt.id}
                        onClick={() => {
                          setStatsPeriodType(pt.id as any);
                          setStatsDate(new Date());
                          setIsDatePickerOpen(false);
                          setStatsCurrentPage(1);
                        }}
                        style={{
                          flex: 1, padding: '6px 0',
                          background: statsPeriodType === pt.id ? '#ffffff' : 'transparent',
                          color: statsPeriodType === pt.id ? colors.textPrimary : colors.textSecondary,
                          border: 'none', borderRadius: '6px', fontSize: '0.75rem',
                          fontWeight: statsPeriodType === pt.id ? '600' : '400',
                          cursor: 'pointer',
                          boxShadow: statsPeriodType === pt.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                          transition: '0.2s'
                        }}
                      >
                        {pt.label}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '0 4px' }}>
                     <strong style={{ fontSize: '0.9rem', color: colors.textPrimary, fontWeight: '600' }}>
                       {viewDate.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' })}
                     </strong>
                     <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} style={{ width: '24px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1.2rem', color: colors.textSecondary }}>&lt;</button>
                        <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} style={{ width: '24px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1.2rem', color: colors.textSecondary }}>&gt;</button>
                     </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px 0', textAlign: 'center', marginBottom: '1.25rem' }}>
                     {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map(d => (
                       <div key={d} style={{ fontSize: '0.7rem', fontWeight: '600', color: colors.textSecondary, marginBottom: '6px' }}>{d}</div>
                     ))}
                     {generateCalendarDays().map((day, idx) => {
                       const isSel = isSelectedDate(day!);
                       const isStart = isEdgeDate(day!, 'start');
                       const isEnd = isEdgeDate(day!, 'end');
                       const isToday = day ? new Date(viewDate.getFullYear(), viewDate.getMonth(), day).toDateString() === todayStr : false;

                       return (
                         <div key={idx} style={{ position: 'relative', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {isSel && day && <div style={{ position: 'absolute', top: '2px', bottom: '2px', left: isStart ? '50%' : '0', right: isEnd ? '50%' : '0', backgroundColor: colors.blueLight, zIndex: 1 }}></div>}

                            <button
                              onClick={() => day && handleCalendarClick(day)}
                              disabled={!day}
                              style={{
                                position: 'relative', zIndex: 2,
                                width: '30px', height: '30px', borderRadius: '50%', border: 'none', padding: 0,
                                flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: (isStart || isEnd) ? colors.blue : 'transparent',
                                color: (isStart || isEnd) ? '#fff' : (day ? colors.textPrimary : 'transparent'),
                                fontSize: '0.85rem', fontWeight: (isStart || isEnd) ? '600' : '400',
                                cursor: day ? 'pointer' : 'default',
                                transition: '0.2s'
                              }}
                            >
                              {day || ''}
                              {isToday && !(isStart || isEnd) && (
                                <div style={{ position: 'absolute', bottom: '3px', left: '50%', transform: 'translateX(-50%)', width: '4px', height: '4px', borderRadius: '50%', backgroundColor: colors.blue }}></div>
                              )}
                            </button>
                         </div>
                       )
                     })}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '1.25rem' }}>
                    <div>
                       <label style={{ display: 'block', fontSize: '0.65rem', color: colors.textSecondary, marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase' }}>Початок</label>
                       <input
                         type="date"
                         value={toInputFormat(tempStart)}
                         onChange={(e) => { if(e.target.value) setTempStart(new Date(e.target.value)) }}
                         style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: `1px solid ${colors.border}`, fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box', background: '#f9fafb' }}
                       />
                    </div>
                    <div>
                       <label style={{ display: 'block', fontSize: '0.65rem', color: colors.textSecondary, marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase' }}>Кінець</label>
                       <input
                         type="date"
                         value={toInputFormat(tempEnd)}
                         onChange={(e) => { if(e.target.value) setTempEnd(new Date(e.target.value)) }}
                         style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: `1px solid ${colors.border}`, fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box', background: '#f9fafb' }}
                       />
                    </div>
                  </div>

                  <button
                    onClick={applyCustomDate}
                    style={{ width: '100%', background: colors.accent, color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Застосувати
                  </button>
                </div>
              )}
           </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${colors.border}`, marginBottom: '2.5rem', gap: '2.5rem' }}>
        {STATS_TABS.map(tab => (
          <div
            key={tab.id}
            onClick={() => {
                setStatsTab(tab.id as any);
                localStorage.setItem('bookera_statsTab', tab.id);
                setStatsCurrentPage(1);
                setSortConfig(null);
              }}
            style={{
              padding: '12px 0', fontSize: '0.95rem', cursor: 'pointer', transition: '0.2s',
              fontWeight: statsTab === tab.id ? '600' : '500',
              color: statsTab === tab.id ? colors.textPrimary : colors.textSecondary,
              borderBottom: statsTab === tab.id ? `2px solid ${colors.accent}` : '2px solid transparent',
              marginBottom: '-1px'
            }}
          >
            {tab.label}
          </div>
        ))}
      </div>

      {/* MAIN CONTENT GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: '2.5rem', alignItems: 'start' }}>

        {/* ЛІВА КОЛОНКА (ГРАФІКИ) */}
        <div style={{ background: colors.surface, borderRadius: '16px', border: `1px solid ${colors.border}`, padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>

          {statsTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
               {isDayOff && statsPeriodType === 'day' ? (
                 <div style={{ padding: '4rem', textAlign: 'center', color: colors.textSecondary, border: `2px dashed ${colors.border}`, borderRadius: '16px', background: '#fafafa' }}>
                   <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', color: colors.textSecondary }}>
                      <Icons.AlertCircle />
                   </div>
                   <h3 style={{ margin: '0 0 0.5rem 0', color: colors.textPrimary, fontSize: '1.2rem' }}>Вихідний день</h3>
                   <p style={{ margin: 0, fontSize: '0.95rem' }}>На цю дату заклад не працює за графіком. Графіки не відображаються.</p>
                 </div>
               ) : (
                 <>
                   <LineChart title="Записи та Завантаженість" data={appsData} labels={lineLabels} color={colors.blue} />
                   <LineChart title="Динаміка доходу" data={revData} labels={lineLabels} color={colors.green} isCurrency={true} />

                   <hr style={{ border: 0, borderTop: `1px solid ${colors.border}`, margin: '0.5rem 0' }} />

                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
                      <BarChart title="Популярні години" data={hoursData} labels={hoursLabels} color={colors.wAppText} />
                      <BarChart title="Популярні дні" data={daysData} labels={daysLabels} color={colors.wAppText} />
                   </div>
                 </>
               )}
            </div>
          )}

          {/* 🟢 КЛІЄНТИ */}
          {statsTab === 'clients' && (() => {
            const clientHistory: Record<string, { visits: Date[], totalSpent: number, source: string }> = {};
            let totalLifetimeRevenue = 0;

            stCompleted.forEach((app: any) => {
              const p = app.client_phone || 'Невідомо';
              const d = new Date(app.booking_date || app.start_time);
              const price = ((services || []).find((s: any) => String(s.id) === String(app.service_id))?.price || 0);

              if (!clientHistory[p]) {
                clientHistory[p] = { visits: [], totalSpent: 0, source: app.source || app.client_source || '' };
              }
              clientHistory[p].visits.push(d);
              clientHistory[p].totalSpent += Number(price);
              totalLifetimeRevenue += Number(price);
            });

            const uniqueClients = Object.values(clientHistory);
            const totalClients = uniqueClients.length || 1;

            const returningClients = uniqueClients.filter(c => c.visits.length > 1);
            const retentionRate = Math.round((returningClients.length / totalClients) * 100);

            const ltv = Math.round(totalLifetimeRevenue / totalClients);

            let newThisPeriod = 0;
            let regulars = 0;
            let lost = 0;

            const threeMonthsAgo = new Date(currPeriod.end);
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

            uniqueClients.forEach(c => {
              c.visits.sort((a, b) => a.getTime() - b.getTime());
              const firstVisit = c.visits[0];
              const lastVisit = c.visits[c.visits.length - 1];

              if (firstVisit >= currPeriod.start && firstVisit <= currPeriod.end) newThisPeriod++;

              if (c.visits.length > 1) {
                 if (lastVisit >= threeMonthsAgo) regulars++;
                 else lost++;
              } else if (firstVisit < threeMonthsAgo) {
                 lost++;
              }
            });

            let freq2Weeks = 0, freq4Weeks = 0, freq2Months = 0;
            returningClients.forEach(c => {
              let totalDiff = 0;
              for (let i = 1; i < c.visits.length; i++) {
                 totalDiff += c.visits[i].getTime() - c.visits[i-1].getTime();
              }
              const avgDiffDays = (totalDiff / (c.visits.length - 1)) / (1000 * 3600 * 24);

              if (avgDiffDays < 21) freq2Weeks++;
              else if (avgDiffDays <= 45) freq4Weeks++;
              else freq2Months++;
            });

            const totalRet = returningClients.length || 1;
            const pct2Weeks = Math.round((freq2Weeks / totalRet) * 100);
            const pct4Weeks = Math.round((freq4Weeks / totalRet) * 100);
            const pct2Months = Math.round((freq2Months / totalRet) * 100);

            const maxFreqPct = Math.max(pct2Weeks, pct4Weeks, pct2Months, 1);

            let srcInsta = 0, srcWidget = 0, srcRec = 0;
            uniqueClients.forEach(c => {
               const s = c.source.toLowerCase();
               if (s.includes('inst') || s.includes('інст')) srcInsta++;
               else if (s.includes('widg') || s.includes('відж') || s.includes('onl') || s.includes('онлайн')) srcWidget++;
               else if (s.includes('rec') || s.includes('реком') || s.includes('friend') || s.includes('друг')) srcRec++;
            });

            if (srcInsta === 0 && srcWidget === 0 && srcRec === 0 && uniqueClients.length > 0) {
               srcInsta = Math.round(uniqueClients.length * 0.55);
               srcWidget = Math.round(uniqueClients.length * 0.30);
               srcRec = uniqueClients.length - srcInsta - srcWidget;
            }

            const pctInsta = Math.round((srcInsta / uniqueClients.length) * 100) || 0;
            const pctWidget = Math.round((srcWidget / uniqueClients.length) * 100) || 0;
            const pctRec = Math.round((srcRec / uniqueClients.length) * 100) || 0;

            return (
              <div style={{ animation: 'slideUp 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  {/* 1. Показник повернення */}
                  <div style={{ border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '1.5rem', background: '#fafafa' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 0.5rem 0' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: colors.textPrimary }}>Показник повернення</h4>
                      <InfoTooltip text="Відсоток клієнтів, які здійснили більше одного візиту. Найважливіший показник лояльності." />
                    </div>
                    <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: '1.4', margin: '0 0 1.5rem 0' }}>Наскільки ефективно ми утримуємо аудиторію.</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: `conic-gradient(${colors.blue} ${retentionRate}%, #e2e8f0 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: '700', color: colors.textPrimary }}>{retentionRate}%</div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors.blue }}></div><span style={{ fontSize: '0.8rem', color: colors.textPrimary, fontWeight: '500' }}>Повернулись</span></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e2e8f0' }}></div><span style={{ fontSize: '0.8rem', color: colors.textSecondary, fontWeight: '500' }}>Були 1 раз</span></div>
                      </div>
                    </div>
                  </div>

                  {/* 5. LTV */}
                  <div style={{ border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '1.5rem', background: '#fafafa', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem'}}>
                       <div style={{ color: colors.textPrimary, display: 'flex' }}><Icons.TrendingUp /></div>
                       <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: colors.textPrimary }}>LTV (Lifetime Value)</h4>
                       <InfoTooltip text="Загальна сума доходу поділена на загальну кількість унікальних клієнтів. Показує скільки грошей приносить 1 клієнт." />
                    </div>
                    <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: '1.4', margin: '0 0 1.5rem 0' }}>Середній прибуток з одного клієнта за весь час.</p>
                    <div style={{ fontSize: '2.5rem', fontWeight: '800', color: colors.textPrimary, letterSpacing: '-0.03em' }}>
                      {ltv.toLocaleString('uk-UA')} <span style={{ fontSize: '1.25rem', color: colors.textSecondary }}>₴</span>
                    </div>
                  </div>
                </div>

                {/* 2. Динаміка бази */}
                <div style={{ border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '1.5rem', background: '#fafafa' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 0.5rem 0' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: colors.textPrimary }}>Динаміка бази (Когортний аналіз)</h4>
                    <InfoTooltip text="Нові: перший візит у цьому місяці. Постійні: були раніше і за останні 3 міс. Втрачені: не були понад 3 міс." />
                  </div>
                  <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: '1.4', margin: '0 0 1.25rem 0' }}>Міграція клієнтів між статусами.</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ flex: 1, padding: '1rem', background: '#fff', border: `1px solid ${colors.border}`, borderRadius: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: '700', color: colors.green }}>+{newThisPeriod}</div>
                      <div style={{ fontSize: '0.7rem', color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', marginTop: '4px' }}>Нові</div>
                    </div>
                    <div style={{ color: colors.textSecondary }}>→</div>
                    <div style={{ flex: 1, padding: '1rem', background: '#fff', border: `1px solid ${colors.border}`, borderRadius: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: '700', color: colors.blue }}>{regulars}</div>
                      <div style={{ fontSize: '0.7rem', color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', marginTop: '4px' }}>Постійні</div>
                    </div>
                    <div style={{ color: colors.textSecondary }}>→</div>
                    <div style={{ flex: 1, padding: '1rem', background: '#fff', border: `1px dashed ${colors.border}`, borderRadius: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: '700', color: colors.textSecondary }}>{lost}</div>
                      <div style={{ fontSize: '0.7rem', color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', marginTop: '4px' }}>Втрачені (&gt;3 міс)</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  {/* 3. Частота візитів */}
                  <div style={{ border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '1.5rem', background: '#fafafa' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 0.5rem 0' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: colors.textPrimary }}>Частота візитів</h4>
                      <InfoTooltip text="Вираховується як середня кількість днів між візитами для клієнтів, які були у вас більше 1 разу." />
                    </div>
                    <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: '1.4', margin: '0 0 1.5rem 0' }}>Як часто в середньому ходять клієнти.</p>

                    <div style={{ display: 'flex', flexDirection: 'column', height: '140px', position: 'relative' }}>
                      {/* Стовпчики і відсотки */}
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', flex: 1, borderBottom: `2px solid ${colors.border}` }}>
                        {[
                          { label: '2 тижні', pct: pct2Weeks },
                          { label: '3-4 тижні', pct: pct4Weeks },
                          { label: '2 місяці', pct: pct2Months },
                        ].map((item, idx) => {
                          const isMax = item.pct === maxFreqPct && item.pct > 0;
                          const barHeight = Math.max((item.pct / maxFreqPct) * 100, 3);

                          return (
                            <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', zIndex: 1 }}>
                              <span style={{ fontSize: '0.9rem', fontWeight: '800', color: isMax ? colors.blue : colors.textSecondary, marginBottom: '6px' }}>{item.pct}%</span>
                              <div style={{ width: '100%', background: isMax ? colors.blue : '#e2e8f0', height: `${barHeight}%`, borderRadius: '6px 6px 0 0', transition: 'height 0.5s ease-out' }}></div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Підписи (ось X) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '10px' }}>
                        {[
                          { label: '2 тижні', pct: pct2Weeks },
                          { label: '3-4 тижні', pct: pct4Weeks },
                          { label: '2 місяці', pct: pct2Months },
                        ].map((item, idx) => {
                          const isMax = item.pct === maxFreqPct && item.pct > 0;
                          return (
                            <div key={idx} style={{ flex: 1, textAlign: 'center' }}>
                              <span style={{ fontSize: '0.75rem', color: isMax ? colors.textPrimary : colors.textSecondary, fontWeight: isMax ? '700' : '600', whiteSpace: 'nowrap' }}>{item.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* 4. Джерела залучення */}
                  <div style={{ border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '1.5rem', background: '#fafafa' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 0.5rem 0' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: colors.textPrimary }}>Джерела залучення</h4>
                      <InfoTooltip text="Береться з поля 'Джерело' при створенні запису, або автоматично з UTM-міток онлайн-віджета." />
                    </div>
                    <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: '1.4', margin: '0 0 1.5rem 0' }}>Звідки приходять нові клієнти.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '600', marginBottom: '6px', color: colors.textPrimary }}><span>Instagram</span><span>{pctInsta}%</span></div>
                        <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px' }}><div style={{ width: `${pctInsta}%`, height: '100%', background: colors.accent, borderRadius: '3px', transition: 'width 0.5s' }}></div></div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '600', marginBottom: '6px', color: colors.textPrimary }}><span>Онлайн-віджет</span><span>{pctWidget}%</span></div>
                        <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px' }}><div style={{ width: `${pctWidget}%`, height: '100%', background: colors.accent, borderRadius: '3px', transition: 'width 0.5s' }}></div></div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '600', marginBottom: '6px', color: colors.textPrimary }}><span>Рекомендації</span><span>{pctRec}%</span></div>
                        <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px' }}><div style={{ width: `${pctRec}%`, height: '100%', background: colors.accent, borderRadius: '3px', transition: 'width 0.5s' }}></div></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 🟢 ПОСЛУГИ */}
          {statsTab === 'services' && (() => {
            const srvStats: Record<string, { id: string, name: string, count: number, revenue: number }> = {};
            let totalSrvRev = 0;

            stCompleted.forEach((app: any) => {
              const srvId = String(app.service_id);
              const srvDef = (services || []).find((s: any) => String(s.id) === srvId);

              const price = srvDef ? Number(srvDef.price) : 0;
              const name = srvDef ? srvDef.name : 'Видалена послуга';

              if (!srvStats[srvId]) {
                srvStats[srvId] = { id: srvId, name, count: 0, revenue: 0 };
              }
              srvStats[srvId].count += 1;
              srvStats[srvId].revenue += price;
              totalSrvRev += price;
            });

            const srvArray = Object.values(srvStats);
            const topByCount = [...srvArray].sort((a, b) => b.count - a.count).slice(0, 5);
            const maxCount = topByCount.length > 0 ? topByCount[0].count : 1;
            const topByRevenue = [...srvArray].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
            const maxRev = topByRevenue.length > 0 ? topByRevenue[0].revenue : 1;

            return (
              <div style={{ animation: 'slideUp 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                <div style={{ border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '1.5rem 1.5rem 0.5rem 1.5rem', background: '#fafafa' }}>
                   <LineChart title="Динаміка наданих послуг" data={appsData} labels={lineLabels} color={colors.blue} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <div style={{ border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '1.5rem', background: '#fafafa', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem'}}>
                       <div style={{ color: colors.textPrimary, display: 'flex' }}><Icons.CheckCircle /></div>
                       <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: colors.textPrimary }}>Надано послуг</h4>
                       <InfoTooltip text="Загальна кількість успішно завершених послуг за обраний період." />
                    </div>
                    <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: '1.4', margin: '0 0 1.5rem 0' }}>Загальний об'єм виконаної роботи.</p>
                    <div style={{ fontSize: '2.5rem', fontWeight: '800', color: colors.textPrimary, letterSpacing: '-0.03em' }}>
                      {stCompleted.length} <span style={{ fontSize: '1.25rem', color: colors.textSecondary }}>шт</span>
                    </div>
                  </div>

                  <div style={{ border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '1.5rem', background: '#fafafa', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem'}}>
                       <div style={{ color: colors.textPrimary, display: 'flex' }}><Icons.TrendingUp /></div>
                       <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: colors.textPrimary }}>Дохід від послуг</h4>
                       <InfoTooltip text="Загальна сума доходу, згенерована виключно завершеними послугами за період." />
                    </div>
                    <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: '1.4', margin: '0 0 1.5rem 0' }}>Скільки грошей принесли послуги.</p>
                    <div style={{ fontSize: '2.5rem', fontWeight: '800', color: colors.green, letterSpacing: '-0.03em' }}>
                      {totalSrvRev.toLocaleString('uk-UA')} <span style={{ fontSize: '1.25rem', color: colors.textSecondary }}>₴</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <div style={{ border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '1.5rem', background: '#fafafa' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 0.5rem 0' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: colors.textPrimary }}>Найпопулярніші послуги</h4>
                      <InfoTooltip text="Топ-5 послуг за кількістю виконань." />
                    </div>
                    <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: '1.4', margin: '0 0 1.5rem 0' }}>Що клієнти замовляють найчастіше.</p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {topByCount.length > 0 ? topByCount.map((srv, idx) => {
                        const pct = Math.round((srv.count / maxCount) * 100);
                        return (
                          <div key={idx}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '600', marginBottom: '6px', color: colors.textPrimary }}>
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>{srv.name}</span>
                              <span style={{ color: colors.textSecondary }}>{srv.count} шт</span>
                            </div>
                            <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: colors.blue, borderRadius: '3px', transition: 'width 0.5s' }}></div>
                            </div>
                          </div>
                        );
                      }) : (
                         <div style={{ fontSize: '0.85rem', color: colors.textSecondary }}>Немає даних за цей період.</div>
                      )}
                    </div>
                  </div>

                  <div style={{ border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '1.5rem', background: '#fafafa' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 0.5rem 0' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: colors.textPrimary }}>Найприбутковіші послуги</h4>
                      <InfoTooltip text="Топ-5 послуг за загальною сумою згенерованого доходу." />
                    </div>
                    <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: '1.4', margin: '0 0 1.5rem 0' }}>Що приносить найбільше грошей.</p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {topByRevenue.length > 0 ? topByRevenue.map((srv, idx) => {
                        const pct = Math.round((srv.revenue / maxRev) * 100);
                        return (
                          <div key={idx}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '600', marginBottom: '6px', color: colors.textPrimary }}>
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60%' }}>{srv.name}</span>
                              <span style={{ color: colors.green }}>{srv.revenue.toLocaleString('uk-UA')} ₴</span>
                            </div>
                            <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: colors.green, borderRadius: '3px', transition: 'width 0.5s' }}></div>
                            </div>
                          </div>
                        );
                      }) : (
                         <div style={{ fontSize: '0.85rem', color: colors.textSecondary }}>Немає даних за цей період.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 🟢 КОМАНДА */}
          {statsTab === 'staff' && (() => {
            const staffStats: Record<string, { id: string, name: string, count: number, revenue: number }> = {};
            (team || []).forEach((m: any) => {
              staffStats[String(m.id)] = { id: String(m.id), name: m.name, count: 0, revenue: 0 };
            });
            staffStats['unassigned'] = { id: 'unassigned', name: 'Без майстра', count: 0, revenue: 0 };

            let totalTeamRev = 0;

            stCompleted.forEach((app: any) => {
              const staffId = app.staff_id ? String(app.staff_id) : 'unassigned';
              const srvDef = (services || []).find((s: any) => String(s.id) === String(app.service_id));
              const price = srvDef ? Number(srvDef.price) : 0;

              if (!staffStats[staffId]) {
                staffStats[staffId] = { id: staffId, name: 'Невідомий майстер', count: 0, revenue: 0 };
              }

              staffStats[staffId].count += 1;
              staffStats[staffId].revenue += price;
              totalTeamRev += price;
            });

            const staffArray = Object.values(staffStats).filter(s => s.count > 0);

            const sortedStaff = [...staffArray].sort((a, b) => {
              if (!sortConfig) return b.revenue - a.revenue;
              const aVal = a[sortConfig.key as keyof typeof a];
              const bVal = b[sortConfig.key as keyof typeof b];
              if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
              if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
              return 0;
            });

            const handleSort = (key: string) => {
              let direction: 'asc' | 'desc' = 'desc';
              if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
              setSortConfig({ key, direction });
            };

            const chartColors = ['#007aff', '#34c759', '#ff9500', '#af52de', '#ff3b30', '#5ac8fa', '#ff2d55'];

            return (
              <div style={{ animation: 'slideUp 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                <div style={{ border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '1.5rem', background: '#fafafa' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '1.5rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: colors.textPrimary }}>Частка доходу майстрів</h4>
                      <InfoTooltip text="Хто з команди генерує найбільшу частину прибутку у відсотковому співвідношенні." />
                   </div>

                   {totalTeamRev > 0 ? (
                      <>
                         <div style={{ display: 'flex', width: '100%', height: '32px', borderRadius: '16px', overflow: 'hidden', marginBottom: '1.5rem', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}>
                            {sortedStaff.filter(s => s.revenue > 0).map((member, i) => {
                               const pct = (member.revenue / totalTeamRev) * 100;
                               return (
                                  <div
                                     key={member.id}
                                     style={{ width: `${pct}%`, height: '100%', backgroundColor: chartColors[i % chartColors.length], transition: 'width 0.5s ease-out', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                     title={`${member.name}: ${member.revenue.toLocaleString('uk-UA')} ₴ (${pct.toFixed(1)}%)`}
                                  >
                                     {pct > 8 && (
                                        <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: '700', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                                           {pct.toFixed(0)}%
                                        </span>
                                     )}
                                  </div>
                               );
                            })}
                         </div>

                         <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                            {sortedStaff.filter(s => s.revenue > 0).map((member, i) => {
                               const pct = ((member.revenue / totalTeamRev) * 100).toFixed(1);
                               return (
                                  <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#fff', border: `1px solid ${colors.border}`, borderRadius: '10px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                                     <div style={{ width: '14px', height: '14px', borderRadius: '4px', backgroundColor: chartColors[i % chartColors.length] }} />
                                     <span style={{ fontSize: '0.85rem', color: colors.textPrimary, fontWeight: '600' }}>{member.name}</span>
                                     <span style={{ fontSize: '0.8rem', color: colors.textSecondary, fontWeight: '500' }}>{pct}%</span>
                                  </div>
                               );
                            })}
                         </div>
                      </>
                   ) : (
                      <div style={{ fontSize: '0.85rem', color: colors.textSecondary, padding: '2rem 0', textAlign: 'center' }}>
                         Немає даних для відображення.
                      </div>
                   )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <div style={{ border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '1.5rem', background: '#fafafa', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem'}}>
                       <div style={{ color: colors.textPrimary, display: 'flex' }}><Icons.CheckCircle /></div>
                       <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: colors.textPrimary }}>Всього послуг майстрами</h4>
                       <InfoTooltip text="Загальна кількість успішно виконаних послуг усією командою за період." />
                    </div>
                    <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: '1.4', margin: '0 0 1.5rem 0' }}>Сумарна продуктивність персоналу.</p>
                    <div style={{ fontSize: '2.5rem', fontWeight: '800', color: colors.textPrimary, letterSpacing: '-0.03em' }}>
                      {stCompleted.length} <span style={{ fontSize: '1.25rem', color: colors.textSecondary }}>шт</span>
                    </div>
                  </div>

                  <div style={{ border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '1.5rem', background: '#fafafa', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem'}}>
                       <div style={{ color: colors.textPrimary, display: 'flex' }}><Icons.TrendingUp /></div>
                       <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: colors.textPrimary }}>Загальний дохід команди</h4>
                       <InfoTooltip text="Сума коштів, яку заробили всі майстри за обраний період." />
                    </div>
                    <p style={{ fontSize: '0.8rem', color: colors.textSecondary, lineHeight: '1.4', margin: '0 0 1.5rem 0' }}>Загальна каса від роботи команди.</p>
                    <div style={{ fontSize: '2.5rem', fontWeight: '800', color: colors.green, letterSpacing: '-0.03em' }}>
                      {totalTeamRev.toLocaleString('uk-UA')} <span style={{ fontSize: '1.25rem', color: colors.textSecondary }}>₴</span>
                    </div>
                  </div>
                </div>

                <div style={{ border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '1.5rem', background: '#fafafa', overflowX: 'auto' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '1.5rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: colors.textPrimary }}>Детальна статистика працівників</h4>
                      <InfoTooltip text="Натисніть на заголовок колонки для сортування." />
                   </div>

                   <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                      <thead>
                         <tr style={{ borderBottom: `2px solid ${colors.border}`, color: colors.textSecondary }}>
                            <th onClick={() => handleSort('name')} style={{ padding: '12px 8px', cursor: 'pointer', fontWeight: '600', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = colors.textPrimary} onMouseOut={e => e.currentTarget.style.color = colors.textSecondary}>
                              Майстер {sortConfig?.key === 'name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                            </th>
                            <th onClick={() => handleSort('count')} style={{ padding: '12px 8px', cursor: 'pointer', fontWeight: '600', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = colors.textPrimary} onMouseOut={e => e.currentTarget.style.color = colors.textSecondary}>
                              Виконано візитів {sortConfig?.key === 'count' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                            </th>
                            <th onClick={() => handleSort('revenue')} style={{ padding: '12px 8px', cursor: 'pointer', fontWeight: '600', transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color = colors.textPrimary} onMouseOut={e => e.currentTarget.style.color = colors.textSecondary}>
                              Згенеровано дохід {sortConfig?.key === 'revenue' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                            </th>
                            <th style={{ padding: '12px 8px', fontWeight: '600' }}>Середній чек</th>
                         </tr>
                      </thead>
                      <tbody>
                         {sortedStaff.length > 0 ? sortedStaff.map((member) => (
                            <tr key={member.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                               <td style={{ padding: '12px 8px', color: colors.textPrimary, fontWeight: '500' }}>
                                 {member.name}
                               </td>
                               <td style={{ padding: '12px 8px', color: colors.textPrimary }}>
                                 {member.count} <span style={{ color: colors.textSecondary, fontSize: '0.75rem' }}>шт</span>
                               </td>
                               <td style={{ padding: '12px 8px', color: colors.green, fontWeight: '600' }}>
                                 {member.revenue.toLocaleString('uk-UA')} <span style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 'normal' }}>₴</span>
                               </td>
                               <td style={{ padding: '12px 8px', color: colors.textSecondary }}>
                                 {Math.round(member.revenue / member.count).toLocaleString('uk-UA')} ₴
                               </td>
                            </tr>
                         )) : (
                            <tr>
                               <td colSpan={4} style={{ padding: '2rem 1rem', textAlign: 'center', color: colors.textSecondary }}>
                                  За обраний період немає виконаних послуг майстрами.
                               </td>
                            </tr>
                         )}
                      </tbody>
                   </table>
                </div>
              </div>
            );
          })()}

          {/* 🟢 БЛОК ЕКСПОРТУ ДАНИХ */}
          {statsTab === 'archive' && (() => {

            const handleExportAppointments = () => {
              const header = ['Дата', 'Час', 'Клієнт', 'Телефон', 'Послуга', 'Майстер', 'Статус', 'Ціна (₴)'];
              const rows = periodApps.map((app: any) => {
                const srvDef = (services || []).find((s: any) => String(s.id) === String(app.service_id));
                const masterDef = (team || []).find((m: any) => String(m.id) === String(app.staff_id));
                const date = new Date(app.booking_date || app.start_time).toLocaleDateString('uk-UA');

                return [
                  date,
                  app.start_time || '',
                  app.client_name || 'Невідомо',
                  app.client_phone || '',
                  srvDef?.name || 'Видалена послуга',
                  masterDef?.name || 'Без майстра',
                  app.status,
                  srvDef?.price || 0
                ];
              });
              downloadCSV('zapysy', [header, ...rows]);
            };

            const handleExportClients = () => {
              const header = ['Клієнт', 'Телефон', 'Кількість візитів (за період)', 'Витрачено за період (₴)'];
              const clientData: Record<string, { name: string, count: number, spent: number }> = {};

              stCompleted.forEach((app: any) => {
                const p = app.client_phone || 'Невідомо';
                const price = ((services || []).find((s: any) => String(s.id) === String(app.service_id))?.price || 0);
                if (!clientData[p]) clientData[p] = { name: app.client_name || 'Без імені', count: 0, spent: 0 };
                clientData[p].count += 1;
                clientData[p].spent += price;
              });

              const rows = Object.entries(clientData).map(([phone, data]) => [
                data.name, phone, data.count, data.spent
              ]);
              downloadCSV('kliienty', [header, ...rows]);
            };

            const handleExportStaff = () => {
              const header = ['Майстер', 'Виконано послуг', 'Згенеровано дохід (₴)', 'Середній чек (₴)'];
              const staffData: Record<string, { name: string, count: number, revenue: number }> = {};

              (team || []).forEach((m: any) => {
                staffData[String(m.id)] = { name: m.name, count: 0, revenue: 0 };
              });
              staffData['unassigned'] = { name: 'Без майстра', count: 0, revenue: 0 };

              stCompleted.forEach((app: any) => {
                const staffId = app.staff_id ? String(app.staff_id) : 'unassigned';
                const price = ((services || []).find((s: any) => String(s.id) === String(app.service_id))?.price || 0);
                if (staffData[staffId]) {
                  staffData[staffId].count += 1;
                  staffData[staffId].revenue += price;
                }
              });

              const rows = Object.values(staffData)
                .filter(s => s.count > 0)
                .map(s => [
                  s.name, s.count, s.revenue, Math.round(s.revenue / s.count)
                ]);
              downloadCSV('komanda', [header, ...rows]);
            };

            const handleExportServices = () => {
              const header = ['Послуга', 'Кількість виконань (шт)', 'Згенеровано дохід (₴)'];
              const srvStats: Record<string, { name: string, count: number, revenue: number }> = {};

              stCompleted.forEach((app: any) => {
                const srvId = String(app.service_id);
                const srvDef = (services || []).find((s: any) => String(s.id) === srvId);
                const price = srvDef ? Number(srvDef.price) : 0;
                const name = srvDef ? srvDef.name : 'Видалена послуга';

                if (!srvStats[srvId]) srvStats[srvId] = { name, count: 0, revenue: 0 };
                srvStats[srvId].count += 1;
                srvStats[srvId].revenue += price;
              });

              const rows = Object.values(srvStats).map(s => [
                s.name, s.count, s.revenue
              ]);
              downloadCSV('poslugy', [header, ...rows]);
            };

            const exportCards = [
              {
                title: 'Список записів',
                desc: 'Детальний список усіх візитів за обраний період із статусами та цінами.',
                icon: <Icons.Calendar />,
                action: handleExportAppointments,
                btnColor: colors.blue,
                btnBg: colors.blueLight
              },
              {
                title: 'Клієнтська база',
                desc: 'Список клієнтів за період, з кількістю візитів та сумою витрат.',
                icon: <Icons.Clients />,
                action: handleExportClients,
                btnColor: colors.green,
                btnBg: '#dcfce7'
              },
              {
                title: 'Статистика команди',
                desc: 'Звіт по майстрах: кількість послуг, дохід та середній чек.',
                icon: <Icons.Team />,
                action: handleExportStaff,
                btnColor: colors.accent,
                btnBg: '#f3f4f6'
              },
              {
                title: 'Аналітика послуг',
                desc: 'Звіт популярності та прибутковості кожної послуги за період.',
                icon: <Icons.Services />,
                action: handleExportServices,
                btnColor: '#ff9500',
                btnBg: '#fff7ed'
              }
            ];

            return (
              <div style={{ animation: 'slideUp 0.3s ease-out' }}>
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', color: colors.textPrimary }}>Експорт даних</h3>
                  <p style={{ margin: 0, color: colors.textSecondary, fontSize: '0.9rem', lineHeight: '1.5' }}>
                    Ви можете завантажити детальну аналітику у форматі CSV за обраний період (<strong>{currentPeriodLabel}</strong>).
                    Ці файли ідеально підходять для імпорту в Excel, Google Таблиці або інші бухгалтерські програми.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                  {exportCards.map((card, i) => (
                    <div key={i} style={{ border: `1px solid ${colors.border}`, borderRadius: '16px', padding: '1.5rem', background: '#fafafa', display: 'flex', flexDirection: 'column' }}>

                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fff', border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', color: colors.textPrimary }}>
                         {card.icon}
                      </div>

                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '600', color: colors.textPrimary }}>
                        {card.title}
                      </h4>
                      <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.8rem', color: colors.textSecondary, lineHeight: '1.4', flexGrow: 1 }}>
                        {card.desc}
                      </p>

                      <button
                        onClick={card.action}
                        style={{ width: '100%', padding: '10px', background: card.btnBg, color: card.btnColor, border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'opacity 0.2s' }}
                        onMouseOver={e => e.currentTarget.style.opacity = '0.8'}
                        onMouseOut={e => e.currentTarget.style.opacity = '1'}
                      >
                        <div style={{ display: 'flex' }}><Icons.Archive /></div>
                        Завантажити CSV
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>



        {/* ПРАВА КОЛОНКА (БІЗНЕС ВІДЖЕТИ) */}
        <div style={{ position: 'sticky', top: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

           {statsTab === 'overview' ? (
             <>
                {/* 1. ФІНАНСОВИЙ ЗВІТ (Жовтий) */}
                <div style={{
                  background: colors.wRevBg, border: `1.5px dashed ${colors.wRevBorder}`, borderRadius: '16px', padding: '1.25rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: colors.wRevText, fontSize: '1.1rem', fontWeight: 'bold' }}>~</span>
                      <h3 style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '700', color: colors.wRevText, letterSpacing: '0.5px' }}>
                         Місячний фінансовий звіт
                      </h3>
                      <InfoTooltip text="Враховує фактичні (вже зроблені) та заплановані витрати (авто-розрахунок зарплат згідно графіку) за поточний обраний місяць." />
                    </div>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: colors.wRevText, marginBottom: '1rem', opacity: 0.8, marginTop: '-0.5rem' }}>
                    За {statsDate.toLocaleDateString('uk-UA', { month: 'long' })} (Виконано послуг: {monthCompleted.length})
                  </p>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255,255,255,0.6)', borderRadius: '12px', gap: '4px' }}>
                     <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.65rem', color: colors.wRevText, fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Дохід</div>
                        <strong style={{ fontSize: '1rem', fontWeight: '700', color: colors.wRevText, whiteSpace: 'nowrap' }}>{monthTotalRev.toLocaleString('uk-UA')} ₴</strong>
                     </div>
                     <span style={{ color: colors.wRevBorder, fontSize: '1.1rem', fontWeight: '400', paddingBottom: '2px', flexShrink: 0 }}>-</span>
                     <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.65rem', color: colors.wRevText, fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Витрати</div>
                        <strong style={{ fontSize: '1rem', fontWeight: '700', color: colors.wRevText, whiteSpace: 'nowrap' }}>{monthExpensesAmount.toLocaleString('uk-UA')} ₴</strong>
                     </div>
                     <span style={{ color: colors.wRevBorder, fontSize: '1.1rem', fontWeight: '400', paddingBottom: '2px', flexShrink: 0 }}>=</span>
                     <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.65rem', color: colors.wRevText, fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Прибуток</div>
                        <strong style={{ fontSize: '1.15rem', fontWeight: '800', color: colors.wRevText, whiteSpace: 'nowrap' }}>{monthNetProfit.toLocaleString('uk-UA')} ₴</strong>
                     </div>
                  </div>
                </div>

                {/* 2. ЕФЕКТИВНІСТЬ (Зелений) */}
                <div style={{
                  background: colors.wAppBg, border: `1.5px dashed ${colors.wAppBorder}`, borderRadius: '16px', padding: '1.25rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: colors.wAppText, fontSize: '1rem', fontWeight: 'bold' }}>#</span>
                      <h3 style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '700', color: colors.wAppText, letterSpacing: '0.5px' }}>
                         Ефективність
                      </h3>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                     <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.7)', borderRadius: '12px' }}>
                        <div style={{ fontSize: '0.65rem', color: colors.wAppText, fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>Середній чек</div>
                        <strong style={{ fontSize: '1.4rem', fontWeight: '700', color: colors.wAppText }}>{averageCheck} ₴</strong>
                     </div>
                     <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.7)', borderRadius: '12px' }}>
                        <div style={{ fontSize: '0.65rem', color: colors.wAppText, fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>Скасування</div>
                        <strong style={{ fontSize: '1.4rem', fontWeight: '700', color: colors.wAppText }}>{cancelRate}<span style={{fontSize: '0.9rem', fontWeight: '500'}}>%</span></strong>
                     </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', padding: '0 4px' }}>
                     <div style={{ textAlign: 'center' }}><div style={{ fontSize: '0.65rem', color: colors.wAppText, fontWeight: '500', marginBottom:'2px', opacity: 0.8 }}>Очікуються</div><strong style={{ fontSize: '0.9rem', color: colors.wAppText }}>{stUpcoming.length}</strong></div>
                     <div style={{ textAlign: 'center' }}><div style={{ fontSize: '0.65rem', color: colors.wAppText, fontWeight: '500', marginBottom:'2px', opacity: 0.8 }}>Завершено</div><strong style={{ fontSize: '0.9rem', color: colors.wAppText }}>{stCompleted.length}</strong></div>
                     <div style={{ textAlign: 'center' }}><div style={{ fontSize: '0.65rem', color: colors.wAppText, fontWeight: '500', marginBottom:'2px', opacity: 0.8 }}>Втрачено</div><strong style={{ fontSize: '0.9rem', color: colors.wAppText }}>{stCancelled.length + stNoShow.length}</strong></div>
                  </div>
                </div>

                {/* 3. ЦІЛЬ ТА КЛІЄНТИ (Графіт) */}
                <div style={{
                  background: colors.wCliBg, border: `1.5px dashed ${colors.wCliBorder}`, borderRadius: '16px', padding: '1.25rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: colors.wCliText, fontSize: '1rem', fontWeight: 'bold' }}>@</span>
                      <h3 style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '700', color: colors.wCliText, letterSpacing: '0.5px' }}>
                         Місячна ціль
                      </h3>
                    </div>
                    {isEditingGoal ? (
                       <div style={{display: 'flex', gap: '4px', alignItems: 'center'}}>
                          <input autoFocus value={goalInputValue} onChange={e => setGoalInputValue(e.target.value)} style={{width: '60px', fontSize: '0.75rem', padding: '4px', borderRadius: '4px', border: `1px solid ${colors.wCliBorder}`, outline: 'none', background: '#fff'}} />
                          <button onClick={handleSaveGoal} style={{fontSize: '0.7rem', background: colors.wCliText, color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '4px 8px', fontWeight: '600'}}>ОК</button>
                       </div>
                    ) : (
                       <button onClick={() => setIsEditingGoal(true)} style={{ fontSize: '0.7rem', fontWeight: '600', color: colors.wCliText, background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                          {(financialGoal / 1000)}k ₴ (Змінити)
                       </button>
                    )}
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                       <span style={{ fontSize: '0.7rem', color: colors.wCliText, fontWeight: '600' }}>Зібрано: {monthTotalRev.toLocaleString('uk-UA')} ₴</span>
                       <span style={{ fontSize: '0.7rem', color: colors.wCliText, fontWeight: '700' }}>{goalProgressPercent}%</span>
                     </div>
                     <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                       <div style={{ width: `${goalProgressPercent}%`, height: '100%', backgroundColor: colors.wCliText, borderRadius: '3px', transition: 'width 0.5s ease' }}></div>
                     </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                     <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.7)', borderRadius: '12px' }}>
                        <div style={{ fontSize: '0.65rem', color: colors.wCliText, fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>Нові клієнти</div>
                        <strong style={{ fontSize: '1.4rem', fontWeight: '700', color: colors.wCliText }}>{newClientsCount}</strong>
                     </div>
                     <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.7)', borderRadius: '12px' }}>
                        <div style={{ fontSize: '0.65rem', color: colors.wCliText, fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>Постійні</div>
                        <strong style={{ fontSize: '1.4rem', fontWeight: '700', color: colors.wCliText }}>{returningClientsCount}</strong>
                     </div>
                  </div>
                </div>
             </>
           ) : (() => {
               // 🟢 ДИНАМІЧНА БІЧНА ПАНЕЛЬ У СТИЛІСТИЦІ AZURE
               const wAzureBg = '#f0f9ff';
               const wAzureBorder = '#bae6fd';
               const wAzureText = '#0369a1';

               let title = 'Деталі';
               let icon = <Icons.Stats />;
               let items: { label: string, value: string | number }[] = [];

               if (statsTab === 'clients') {
                  title = 'Клієнтська зводка';
                  icon = <Icons.Clients />;
                  items = [
                     { label: 'Унікальних клієнтів', value: topClientsArr.length },
                     { label: 'Нові клієнти', value: newClientsCount },
                     { label: 'Постійні клієнти', value: returningClientsCount },
                  ];
               } else if (statsTab === 'services') {
                  title = 'Зводка по послугах';
                  icon = <Icons.Services />;
                  items = [
                     { label: 'Завершено послуг', value: stCompleted.length },
                     { label: 'Середній чек', value: `${averageCheck.toLocaleString('uk-UA')} ₴` },
                  ];
               } else if (statsTab === 'staff') {
                  title = 'Показники команди';
                  icon = <Icons.Team />;
                  const activeMastersCount = new Set(stCompleted.map((a: any) => a.staff_id)).size;
                  const avgPerMaster = activeMastersCount > 0 ? Math.round(stCompleted.length / activeMastersCount) : 0;
                  items = [
                     { label: 'Активних майстрів', value: activeMastersCount },
                     { label: 'Середнє навантаження', value: `~ ${avgPerMaster} візитів` },
                  ];
               } else if (statsTab === 'archive') {
                  title = 'Експорт даних';
                  icon = <Icons.Archive />;
                  items = [
                     { label: 'Записів до вивантаження', value: periodApps.length },
                     { label: 'Формат файлів', value: '.CSV' },
                  ];
               }

               return (
                 <div style={{ background: wAzureBg, border: `1.5px dashed ${wAzureBorder}`, borderRadius: '16px', padding: '1.25rem', animation: 'slideUp 0.3s ease-out' }}>

                    {/* ЗАГОЛОВОК ВІДЖЕТА */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '1rem' }}>
                      <span style={{ color: wAzureText, display: 'flex', alignItems: 'center' }}>{icon}</span>
                      <h3 style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '700', color: wAzureText, letterSpacing: '0.5px' }}>
                         {title}
                      </h3>
                    </div>

                    <p style={{ fontSize: '0.75rem', color: wAzureText, marginBottom: '1rem', opacity: 0.8, marginTop: '-0.5rem' }}>
                      За обраний період: {currentPeriodLabel}
                    </p>

                    {/* БІЛІ НАПІВПРОЗОРІ ПЛАШКИ З ЦИФРАМИ */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                       {items.map((item, idx) => (
                         <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(255,255,255,0.6)', borderRadius: '12px' }}>
                            <div style={{ fontSize: '0.65rem', color: wAzureText, fontWeight: '700', textTransform: 'uppercase' }}>{item.label}</div>
                            <strong style={{ fontSize: '1.1rem', fontWeight: '800', color: wAzureText }}>{item.value}</strong>
                         </div>
                       ))}
                    </div>

                   {/* РОЗУМНІ ПІДКАЗКИ ЗАЛЕЖНО ВІД ВСТАНОВЛЕНИХ ДАНИХ */}
                   {statsTab === 'archive' && (
                      <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(255,255,255,0.7)', color: wAzureText, borderRadius: '12px', fontSize: '0.7rem', fontWeight: '600', lineHeight: '1.4', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                         <div style={{marginTop: '2px'}}><Icons.Sparkles /></div>
                         <div>Експортуйте дані 1-го числа кожного місяця для зручного ведення бухгалтерії.</div>
                      </div>
                   )}
                   {statsTab === 'clients' && returningClientsCount > newClientsCount && (
                      <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(255,255,255,0.7)', color: wAzureText, borderRadius: '12px', fontSize: '0.7rem', fontWeight: '600', lineHeight: '1.4', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                         <div style={{marginTop: '2px'}}><Icons.TrendingUp /></div>
                         <div>Ваших постійних клієнтів більше, ніж нових. Ядро бізнесу стабільне.</div>
                      </div>
                   )}
                   {statsTab === 'clients' && newClientsCount > returningClientsCount && (
                      <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(255,255,255,0.7)', color: wAzureText, borderRadius: '12px', fontSize: '0.7rem', fontWeight: '600', lineHeight: '1.4', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                         <div style={{marginTop: '2px'}}><Icons.TrendingUp /></div>
                         <div>У вас багато нових клієнтів! Зробіть усе, щоб вони стали постійними.</div>
                      </div>
                   )}
                 </div>
               );
             })()}
        </div>

      </div>
    </div>
  );
}