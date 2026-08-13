'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Icons, toLocalDateStr } from '@/components/shared';

export default function InventoryTab({ business, team }: any) {
  const supabase = createClient();
  const [activeMode, setActiveMode] = useState<'expenses' | 'stock'>('expenses');

  // 🟢 СТЕЙТИ ДАНИХ
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [virtualSalaries, setVirtualSalaries] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 🟢 ЛОГІКА КАЛЕНДАРЯ
  const [periodType, setPeriodType] = useState<'day' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [customStart, setCustomStart] = useState(new Date());
  const [customEnd, setCustomEnd] = useState(new Date());

  const [tempStart, setTempStart] = useState<Date | null>(new Date());
  const [tempEnd, setTempEnd] = useState<Date | null>(new Date());
  const [viewDate, setViewDate] = useState(new Date());
  const datePickerRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState('');

  // 🟢 СТЕЙТИ ПАГІНАЦІЇ
  const [expensePage, setExpensePage] = useState(1);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [plannedPage, setPlannedPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [sortConfig, setSortConfig] = useState<{ key: 'expense_date' | 'category' | 'amount' | null, direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' });

  const [isExpModalOpen, setIsExpModalOpen] = useState(false);
  const [isInvModalOpen, setIsInvModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [isCustomDatePickerOpen, setIsCustomDatePickerOpen] = useState(false);
  const [pickerViewDate, setPickerViewDate] = useState(new Date());

  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [editingInventory, setEditingInventory] = useState<any>(null);

  const [expForm, setExpForm] = useState({ amount: '', category: 'Оренда', description: '', date: toLocalDateStr(new Date()), recurrence: 'none' });
  const [invForm, setInvForm] = useState({ name: '', quantity: '', unit: 'шт', price: '' });

  const EXPENSE_CATEGORIES = ['Матеріали', 'Оренда', 'Комунальні', 'Зарплата', 'Маркетинг', 'Податки', 'Інше'];
  const UNIT_TYPES = ['шт', 'мл', 'літри', 'грами'];

  const todayStr = toLocalDateStr(new Date());

  // Надійний конвертер дати для уникнення зміщень через часові пояси
  const getLocalYYYYMMDD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // --- ФУНКЦІЇ ДАТ ТА КАЛЕНДАРЯ ---
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

  const currPeriod = getStartEnd(currentDate, periodType);

  const currentPeriodLabel = (() => {
    const formatShort = (d: Date) => d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
    if (periodType === 'day') return currentDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
    if (periodType === 'month') return currentDate.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });
    if (periodType === 'year') return currentDate.getFullYear().toString();
    if (periodType === 'week') {
      return `${formatShort(currPeriod.start)} - ${formatShort(currPeriod.end)} ${currPeriod.end.getFullYear()}`;
    }
    if (periodType === 'custom') {
      return `${formatShort(customStart)} - ${formatShort(customEnd)}`;
    }
    return '';
  })();

  const shiftPeriod = (direction: -1 | 1) => {
    if (periodType === 'custom') {
      const diff = (customEnd.getTime() - customStart.getTime()) + 86400000;
      setCustomStart(new Date(customStart.getTime() + (diff * direction)));
      setCustomEnd(new Date(customEnd.getTime() + (diff * direction)));
    } else {
      const nd = new Date(currentDate);
      if (periodType === 'day') nd.setDate(nd.getDate() + direction);
      if (periodType === 'week') nd.setDate(nd.getDate() + (7 * direction));
      if (periodType === 'month') nd.setMonth(nd.getMonth() + direction);
      if (periodType === 'year') nd.setFullYear(nd.getFullYear() + direction);
      setCurrentDate(nd);
    }
    setExpensePage(1);
  };

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
      setPeriodType('custom');
      setIsDatePickerOpen(false);
      setExpensePage(1);
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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setIsDatePickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- ЗАВАНТАЖЕННЯ ДАНИХ З БД ---
  useEffect(() => {
    const fetchAllData = async () => {
      if (!business?.id) return;
      setIsLoading(true);
      try {
        const [expRes, invRes] = await Promise.all([
          supabase.from('expenses').select('*').eq('business_id', business.id).order('expense_date', { ascending: false }),
          supabase.from('inventory').select('*').eq('business_id', business.id).order('created_at', { ascending: false })
        ]);
        if (expRes.data) setAllExpenses(expRes.data);
        if (invRes.data) setInventory(invRes.data);
      } catch (error) {
        console.error("Помилка завантаження:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllData();
  }, [business?.id]);

  // 🟢 ГЕНЕРАЦІЯ АВТО-ПРОГНОЗУ ЗАРПЛАТ (Оновлена логіка)
  useEffect(() => {
    if (!team || !Array.isArray(team)) return;

    const virtual: any[] = [];
    const today = new Date();
    today.setHours(0,0,0,0);

    // Прогнозуємо на 3 місяці вперед
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 90);

    team.forEach((staff: any) => {
       const fixed = Number(staff.fixed_salary) || 0;

       let currentIterDate = new Date(today);
       currentIterDate.setDate(currentIterDate.getDate() + 1); // Починаємо з завтра

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

    // Групуємо зарплати різних майстрів в одну лінію
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
  }, [team]);

  // Об'єднуємо реальні витрати та прогнозовані зарплати
  const combinedExpenses = [...allExpenses, ...virtualSalaries];

  // ФІЛЬТРАЦІЯ ВИТРАТ ПО КАЛЕНДАРЮ
  const currentExpenses = combinedExpenses.filter(e => {
    const d = new Date(e.expense_date);
    d.setHours(0,0,0,0);
    return d >= currPeriod.start && d <= currPeriod.end;
  });

  const handleSaveExpense = async () => {
    if (!expForm.amount || Number(expForm.amount) <= 0) return alert('Введіть коректну суму більше нуля');
    setIsSaving(true);
    try {
      const expenseData = {
        amount: Number(expForm.amount),
        category: expForm.category,
        description: expForm.description.trim(),
        expense_date: expForm.date,
        recurrence: expForm.recurrence
      };

      const generateFutureExpenses = async (startDate: string, recType: string) => {
        const futureInserts = [];
        const [year, month, day] = startDate.split('-').map(Number);
        const limit = recType === 'weekly' ? 52 : 12;

        for (let i = 1; i <= limit; i++) {
          let nextDate = recType === 'weekly'
            ? new Date(year, month - 1, day + (i * 7))
            : new Date(year, month - 1 + i, day);

          futureInserts.push({
            business_id: business.id,
            amount: Number(expForm.amount),
            category: expForm.category,
            description: expForm.description.trim(),
            expense_date: toLocalDateStr(nextDate),
            recurrence: recType
          });
        }
        if (futureInserts.length > 0) {
          const { error: batchError, data } = await supabase.from('expenses').insert(futureInserts).select();
          if (batchError) console.error("Помилка автогенерації:", batchError);
          return data || [];
        }
        return [];
      };

      let updatedAllExpenses = [...allExpenses];

      if (editingExpense) {
        const oldDate = editingExpense.expense_date;
        const isDateChanged = oldDate !== expForm.date;
        const isAmountChanged = Number(editingExpense.amount) !== Number(expForm.amount);
        const wasRecurring = editingExpense.recurrence && editingExpense.recurrence !== 'none';

        const { data: updatedRecord, error } = await supabase.from('expenses').update(expenseData).eq('id', editingExpense.id).select().single();
        if (error) throw new Error(error.message);

        updatedAllExpenses = updatedAllExpenses.map(e => e.id === editingExpense.id ? updatedRecord : e);

        if (wasRecurring && (isDateChanged || isAmountChanged)) {
          const updateFuture = window.confirm('Ви змінили дату або суму регулярного платежу. Бажаєте автоматично оновити всі майбутні записи цієї витрати?');

          if (updateFuture) {
            const { data: futureMatches } = await supabase
              .from('expenses')
              .select('*')
              .eq('business_id', business.id)
              .eq('category', editingExpense.category)
              .eq('description', editingExpense.description || '')
              .gt('expense_date', oldDate);

            if (futureMatches && futureMatches.length > 0) {
              const oldD = new Date(oldDate);
              const newD = new Date(expForm.date);
              const diffDays = Math.round((newD.getTime() - oldD.getTime()) / (1000 * 3600 * 24));

              const updates = futureMatches.map(match => {
                const matchDate = new Date(match.expense_date);
                matchDate.setDate(matchDate.getDate() + diffDays);
                const y = matchDate.getFullYear();
                const m = String(matchDate.getMonth() + 1).padStart(2, '0');
                const d = String(matchDate.getDate()).padStart(2, '0');

                return {
                  id: match.id,
                  business_id: business.id,
                  category: match.category,
                  description: match.description,
                  amount: Number(expForm.amount),
                  expense_date: `${y}-${m}-${d}`,
                  recurrence: expForm.recurrence
                };
              });

              const { data: updatedFutures, error: updateError } = await supabase.from('expenses').upsert(updates).select();
              if (updateError) console.error("Помилка оновлення майбутніх:", updateError);

              if (updatedFutures) {
                 updatedAllExpenses = updatedAllExpenses.map(e => {
                    const match = updatedFutures.find(u => u.id === e.id);
                    return match ? match : e;
                 });
              }
            }
          }
        }
        else if (!wasRecurring && expForm.recurrence !== 'none') {
           const newFutures = await generateFutureExpenses(expForm.date, expForm.recurrence);
           updatedAllExpenses = [...newFutures, ...updatedAllExpenses];
        }

      } else {
        const { data: newRecord, error } = await supabase.from('expenses').insert([{ ...expenseData, business_id: business.id }]).select().single();
        if (error) throw new Error(error.message);

        updatedAllExpenses = [newRecord, ...updatedAllExpenses];

        if (expForm.recurrence !== 'none') {
           const newFutures = await generateFutureExpenses(expForm.date, expForm.recurrence);
           updatedAllExpenses = [...newFutures, ...updatedAllExpenses];
        }
      }

      updatedAllExpenses.sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime());
      setAllExpenses(updatedAllExpenses);
      closeExpModal();
    } catch (err: any) {
      alert(`Помилка: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveInventory = async () => {
    if (!invForm.name.trim()) return alert('Введіть назву товару');
    setIsSaving(true);
    try {
      const invData = {
        name: invForm.name.trim(),
        quantity: Number(invForm.quantity) || 0,
        unit: invForm.unit,
        price: Number(invForm.price) || 0
      };

      if (editingInventory) {
        const { data, error } = await supabase.from('inventory').update(invData).eq('id', editingInventory.id).select().single();
        if (error) throw new Error(error.message);
        setInventory(inventory.map(i => i.id === editingInventory.id ? data : i));
      } else {
        const { data, error } = await supabase.from('inventory').insert([{ ...invData, business_id: business.id }]).select().single();
        if (error) throw new Error(error.message);
        setInventory([data, ...inventory]);
      }

      closeInvModal();
    } catch (err: any) {
      alert(`Помилка: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteExpense = async (id: string) => {
    if (!confirm('Видалити витрату?')) return;
    try {
      await supabase.from('expenses').delete().eq('id', id);
      setAllExpenses(allExpenses.filter(e => e.id !== id));
    } catch (error) { console.error(error); }
  };

  const deleteInventory = async (id: string) => {
    if (!confirm('Видалити товар?')) return;
    try {
      await supabase.from('inventory').delete().eq('id', id);
      setInventory(inventory.filter(i => i.id !== id));
    } catch (error) { console.error(error); }
  };

  const shiftPickerMonth = (direction: number) => {
    const newDate = new Date(pickerViewDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setPickerViewDate(newDate);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    let startDayIndex = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < startDayIndex; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  const handleOpenNewExpense = () => {
    setExpForm({ amount: '', category: 'Оренда', description: '', date: todayStr, recurrence: 'none' });
    setPickerViewDate(new Date());
    setIsExpModalOpen(true);
  };

  const startEditExpense = (expense: any) => {
    setEditingExpense(expense);
    setExpForm({
      amount: String(expense.amount),
      category: expense.category,
      description: expense.description || '',
      date: expense.expense_date,
      recurrence: expense.recurrence || 'none'
    });
    setPickerViewDate(new Date(expense.expense_date));
    setIsExpModalOpen(true);
  };

  const startEditInventory = (item: any) => {
    setEditingInventory(item);
    setInvForm({
      name: item.name,
      quantity: String(item.quantity),
      unit: item.unit,
      price: String(item.price)
    });
    setIsInvModalOpen(true);
  };

  const closeExpModal = () => {
    setIsExpModalOpen(false);
    setIsCustomDatePickerOpen(false);
    setEditingExpense(null);
    setExpForm({ amount: '', category: 'Оренда', description: '', date: todayStr, recurrence: 'none' });
  };

  const closeInvModal = () => {
    setIsInvModalOpen(false);
    setEditingInventory(null);
    setInvForm({ name: '', quantity: '', unit: 'шт', price: '' });
  };

  // --- ФІЛЬТРАЦІЯ, СОРТУВАННЯ ТА ПАГІНАЦІЯ ---
  const filteredExpenses = currentExpenses.filter(e =>
    (e.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const requestSort = (key: 'expense_date' | 'category' | 'amount') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setExpensePage(1);
  };

  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    if (!sortConfig.key) return 0;

    if (sortConfig.key === 'expense_date') {
      const dateA = new Date(a.expense_date).getTime();
      const dateB = new Date(b.expense_date).getTime();
      return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
    }
    if (sortConfig.key === 'amount') {
      return sortConfig.direction === 'asc' ? Number(a.amount) - Number(b.amount) : Number(b.amount) - Number(a.amount);
    }
    if (sortConfig.key === 'category') {
      return sortConfig.direction === 'asc' ? a.category.localeCompare(b.category) : b.category.localeCompare(a.category);
    }
    return 0;
  });

  const totalExpensePages = Math.ceil(sortedExpenses.length / ITEMS_PER_PAGE);
  const paginatedExpenses = sortedExpenses.slice((expensePage - 1) * ITEMS_PER_PAGE, expensePage * ITEMS_PER_PAGE);

  const filteredInventory = inventory.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const totalInventoryPages = Math.ceil(filteredInventory.length / ITEMS_PER_PAGE);
  const paginatedInventory = filteredInventory.slice((inventoryPage - 1) * ITEMS_PER_PAGE, inventoryPage * ITEMS_PER_PAGE);

  // Метрики віджета
  const totalPeriodExpenses = currentExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  // 🟢 ПРОГНОЗ НА НАСТУПНИЙ МІСЯЦЬ (Враховує авто-зарплати)
  const nextMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
  const nextMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0);
  const nextMStartStr = `${nextMonthStart.getFullYear()}-${String(nextMonthStart.getMonth() + 1).padStart(2, '0')}-01`;
  const nextMEndStr = `${nextMonthEnd.getFullYear()}-${String(nextMonthEnd.getMonth() + 1).padStart(2, '0')}-${String(nextMonthEnd.getDate()).padStart(2, '0')}`;

  const nextMonthName = nextMonthStart.toLocaleDateString('uk-UA', { month: 'long' });
  const formattedNextMonth = nextMonthName.charAt(0).toUpperCase() + nextMonthName.slice(1);

  const upcomingMonthItems = combinedExpenses
    .filter(e => e.expense_date >= nextMStartStr && e.expense_date <= nextMEndStr)
    .sort((a, b) => new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime());

  const upcomingMonthTotal = upcomingMonthItems.reduce((sum, e) => sum + Number(e.amount), 0);

  const PLANNED_PER_PAGE = 4;
  const totalPlannedPages = Math.ceil(upcomingMonthItems.length / PLANNED_PER_PAGE);
  const paginatedPlannedItems = upcomingMonthItems.slice((plannedPage - 1) * PLANNED_PER_PAGE, plannedPage * PLANNED_PER_PAGE);

  const categoryBreakdown = currentExpenses.reduce((acc: any, curr: any) => {
    acc[curr.category] = (acc[curr.category] || 0) + Number(curr.amount);
    return acc;
  }, {});

  const totalStockValue = inventory.reduce((sum, i) => sum + (Number(i.quantity) * Number(i.price)), 0);
  const lowStockItems = inventory.filter(i => i.quantity <= 5 && i.quantity > 0);
  const outOfStockItems = inventory.filter(i => i.quantity <= 0);

  const theme = {
    textMain: '#0f172a',
    textMuted: '#64748b',
    border: '#e2e8f0',
    bgLight: '#f8fafc',
    blue: '#3b82f6',
    red: '#ef4444',
    darkBg: '#0f172a',
    darkTextMuted: '#94a3b8',
    appleGray: '#f5f5f7'
  };

  const categoryStyles: Record<string, { fill: string, bg: string }> = {
    'Матеріали': { fill: '#3b82f6', bg: '#eff6ff' },
    'Оренда': { fill: '#f59e0b', bg: '#fffbeb' },
    'Комунальні': { fill: '#0ea5e9', bg: '#ecfeff' },
    'Зарплата': { fill: '#10b981', bg: '#ecfdf5' },
    'Маркетинг': { fill: '#8b5cf6', bg: '#faf5ff' },
    'Податки': { fill: '#ef4444', bg: '#fef2f2' },
    'Інше': { fill: '#94a3b8', bg: '#f1f5f9' },
  };

  const renderSortIcon = (key: string) => {
    const isActive = sortConfig.key === key;
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
           style={{
             marginLeft: '6px',
             opacity: isActive ? 1 : 0.3,
             transform: isActive && sortConfig.direction === 'desc' ? 'rotate(180deg)' : 'none',
             transition: 'transform 0.2s, opacity 0.2s'
           }}>
        <path d="M6 15l6-6 6 6"/>
      </svg>
    );
  };

  return (
    <div style={{ padding: '2rem 3rem', flexGrow: 1, width: '100%', animation: 'fadeSlide 0.3s ease-out' }}>

      {/* 🟢 ГОЛОВНИЙ GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '2.5rem', alignItems: 'start' }}>

        {/* ЛІВА КОЛОНКА */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ display: 'flex', background: theme.bgLight, padding: '4px', borderRadius: '12px', gap: '4px', border: `1px solid ${theme.border}` }}>
              <button onClick={() => { setActiveMode('expenses'); setSearchQuery(''); setExpensePage(1); }} style={{ padding: '0.5rem 2rem', border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', transition: '0.2s', background: activeMode === 'expenses' ? '#ffffff' : 'transparent', color: activeMode === 'expenses' ? theme.textMain : theme.textMuted, boxShadow: activeMode === 'expenses' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none' }}>
                Фінансові витрати
              </button>
              <button onClick={() => { setActiveMode('stock'); setSearchQuery(''); setInventoryPage(1); }} style={{ padding: '0.5rem 2rem', border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', transition: '0.2s', background: activeMode === 'stock' ? '#ffffff' : 'transparent', color: activeMode === 'stock' ? theme.textMain : theme.textMuted, boxShadow: activeMode === 'stock' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none' }}>
                Облік матеріалів
              </button>
            </div>
          </div>

          {activeMode === 'expenses' ? (
            <div style={{ animation: 'slideUp 0.2s ease-out' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem' }}>

                {/* 🟢 КАЛЕНДАР */}
                <div style={{ position: 'relative' }} ref={datePickerRef}>
                  <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: `1px solid ${theme.border}`, borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <button onClick={() => shiftPeriod(-1)} style={{ padding: '8px 12px', border: 'none', borderRight: `1px solid ${theme.border}`, background: 'transparent', cursor: 'pointer', color: theme.textMuted, borderTopLeftRadius: '10px', borderBottomLeftRadius: '10px' }}>&lt;</button>

                    <div
                      onClick={() => {
                         setIsDatePickerOpen(!isDatePickerOpen);
                         if (!isDatePickerOpen) {
                            setTempStart(periodType === 'custom' ? customStart : currPeriod.start);
                            setTempEnd(periodType === 'custom' ? customEnd : currPeriod.end);
                            setViewDate(periodType === 'custom' ? customStart : currPeriod.start);
                         }
                      }}
                      style={{ padding: '8px 16px', fontSize: '0.85rem', fontWeight: '600', minWidth: '180px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: theme.textMain }}
                    >
                      <div style={{ width: 14, height: 14, color: theme.textMuted, display: 'flex' }}><Icons.Calendar /></div>
                      <span style={{ flex: 1, textAlign: 'center', textTransform: 'capitalize' }}>{currentPeriodLabel}</span>
                    </div>

                    <button onClick={() => shiftPeriod(1)} style={{ padding: '8px 12px', border: 'none', borderLeft: `1px solid ${theme.border}`, background: 'transparent', cursor: 'pointer', color: theme.textMuted, borderTopRightRadius: '10px', borderBottomRightRadius: '10px' }}>&gt;</button>
                  </div>

                  {isDatePickerOpen && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '8px', background: '#fff', border: `1px solid ${theme.border}`, borderRadius: '14px', padding: '1.25rem', boxShadow: '0 8px 30px rgba(0,0,0,0.1)', zIndex: 50, width: '300px', cursor: 'default' }}>
                      <div style={{ display: 'flex', background: theme.bgLight, borderRadius: '8px', padding: '2px', marginBottom: '1.25rem' }}>
                        {[
                          { id: 'day', label: 'День' },
                          { id: 'week', label: 'Тиждень' },
                          { id: 'month', label: 'Місяць' },
                          { id: 'year', label: 'Рік' }
                        ].map(pt => (
                          <button
                            key={pt.id}
                            onClick={() => {
                              setPeriodType(pt.id as any);
                              setCurrentDate(new Date());
                              setIsDatePickerOpen(false);
                              setExpensePage(1);
                            }}
                            style={{
                              flex: 1, padding: '6px 0',
                              background: periodType === pt.id ? '#ffffff' : 'transparent',
                              color: periodType === pt.id ? theme.textMain : theme.textMuted,
                              border: 'none', borderRadius: '6px', fontSize: '0.75rem',
                              fontWeight: periodType === pt.id ? '600' : '400',
                              cursor: 'pointer',
                              boxShadow: periodType === pt.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                              transition: '0.2s'
                            }}
                          >
                            {pt.label}
                          </button>
                        ))}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '0 4px' }}>
                         <strong style={{ fontSize: '0.9rem', color: theme.textMain, fontWeight: '600' }}>
                           {viewDate.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' })}
                         </strong>
                         <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} style={{ width: '24px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1.2rem', color: theme.textMuted }}>&lt;</button>
                            <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} style={{ width: '24px', height: '24px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1.2rem', color: theme.textMuted }}>&gt;</button>
                         </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px 0', textAlign: 'center', marginBottom: '1.25rem' }}>
                         {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map(d => (
                           <div key={d} style={{ fontSize: '0.7rem', fontWeight: '600', color: theme.textMuted, marginBottom: '6px' }}>{d}</div>
                         ))}
                         {generateCalendarDays().map((day, idx) => {
                           const isSel = isSelectedDate(day!);
                           const isStart = isEdgeDate(day!, 'start');
                           const isEnd = isEdgeDate(day!, 'end');
                           const isToday = day ? new Date(viewDate.getFullYear(), viewDate.getMonth(), day).toDateString() === todayStr : false;

                           return (
                             <div key={idx} style={{ position: 'relative', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {isSel && day && <div style={{ position: 'absolute', top: '2px', bottom: '2px', left: isStart ? '50%' : '0', right: isEnd ? '50%' : '0', backgroundColor: '#e5f1ff', zIndex: 1 }}></div>}

                                <button
                                  onClick={() => day && handleCalendarClick(day)}
                                  disabled={!day}
                                  style={{
                                    position: 'relative', zIndex: 2,
                                    width: '30px', height: '30px', borderRadius: '50%', border: 'none', padding: 0,
                                    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: (isStart || isEnd) ? theme.blue : 'transparent',
                                    color: (isStart || isEnd) ? '#fff' : (day ? theme.textMain : 'transparent'),
                                    fontSize: '0.85rem', fontWeight: (isStart || isEnd) ? '600' : '400',
                                    cursor: day ? 'pointer' : 'default',
                                    transition: '0.2s'
                                  }}
                                >
                                  {day || ''}
                                  {isToday && !(isStart || isEnd) && (
                                    <div style={{ position: 'absolute', bottom: '3px', left: '50%', transform: 'translateX(-50%)', width: '4px', height: '4px', borderRadius: '50%', backgroundColor: theme.blue }}></div>
                                  )}
                                </button>
                             </div>
                           )
                         })}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '1.25rem' }}>
                        <div>
                           <label style={{ display: 'block', fontSize: '0.65rem', color: theme.textMuted, marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase' }}>Початок</label>
                           <input type="date" value={toInputFormat(tempStart)} onChange={(e) => { if(e.target.value) setTempStart(new Date(e.target.value)) }} style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: `1px solid ${theme.border}`, fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box', background: theme.bgLight }} />
                        </div>
                        <div>
                           <label style={{ display: 'block', fontSize: '0.65rem', color: theme.textMuted, marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase' }}>Кінець</label>
                           <input type="date" value={toInputFormat(tempEnd)} onChange={(e) => { if(e.target.value) setTempEnd(new Date(e.target.value)) }} style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: `1px solid ${theme.border}`, fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box', background: theme.bgLight }} />
                        </div>
                      </div>

                      <button onClick={applyCustomDate} style={{ width: '100%', background: theme.textMain, color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer' }}>Застосувати</button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, justifyContent: 'flex-end' }}>
                  <div style={{ position: 'relative', maxWidth: '280px', width: '100%' }}>
                     <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: theme.textMuted, display: 'flex' }}><Icons.Search /></div>
                     <input
                       type="text"
                       placeholder="Пошук витрат..."
                       value={searchQuery}
                       onChange={(e) => { setSearchQuery(e.target.value); setExpensePage(1); }}
                       style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem', borderRadius: '10px', border: `1px solid ${theme.border}`, outline: 'none', fontSize: '0.9rem', color: theme.textMain, transition: '0.2s' }}
                       onFocus={e => e.currentTarget.style.borderColor = theme.blue}
                       onBlur={e => e.currentTarget.style.borderColor = theme.border}
                     />
                  </div>
                  <button onClick={handleOpenNewExpense} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: theme.textMain, color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', transition: '0.2s', boxShadow: '0 4px 12px rgba(15,23,42,0.1)' }} onMouseOver={e=>e.currentTarget.style.transform='translateY(-2px)'} onMouseOut={e=>e.currentTarget.style.transform='translateY(0)'}>
                    <Icons.Plus /> Додати витрату
                  </button>
                </div>
              </div>

              <div style={{ background: '#fff', border: `1px solid ${theme.border}`, borderRadius: '16px', overflow: 'hidden' }}>
                {isLoading ? <div style={{ padding: '4rem', textAlign: 'center', color: theme.textMuted }}>Оновлення...</div> :
                 filteredExpenses.length === 0 ? (
                  <div style={{ padding: '5rem 2rem', textAlign: 'center' }}>
                    <div style={{ color: theme.border, marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}><div style={{ transform: 'scale(2)' }}><Icons.Calendar /></div></div>
                    <h4 style={{ color: theme.textMain, fontSize: '1rem', marginBottom: '0.4rem', fontWeight: '600' }}>Нічого не знайдено</h4>
                    <p style={{ color: theme.textMuted, fontSize: '0.9rem', margin: 0 }}>Спробуйте змінити запит або додайте нову витрату.</p>
                  </div>
                ) : (
                  <>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: theme.appleGray, borderBottom: `1px solid ${theme.border}` }}>
                          <th onClick={() => requestSort('expense_date')} style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: theme.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', userSelect: 'none', transition: '0.2s' }} onMouseOver={e=>e.currentTarget.style.color=theme.textMain} onMouseOut={e=>e.currentTarget.style.color=theme.textMuted}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>Дата {renderSortIcon('expense_date')}</div>
                          </th>
                          <th onClick={() => requestSort('category')} style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: theme.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', userSelect: 'none', transition: '0.2s' }} onMouseOver={e=>e.currentTarget.style.color=theme.textMain} onMouseOut={e=>e.currentTarget.style.color=theme.textMuted}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>Категорія {renderSortIcon('category')}</div>
                          </th>
                          <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: theme.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Опис
                          </th>
                          <th onClick={() => requestSort('amount')} style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: theme.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', userSelect: 'none', transition: '0.2s' }} onMouseOver={e=>e.currentTarget.style.color=theme.textMain} onMouseOut={e=>e.currentTarget.style.color=theme.textMuted}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>Сума {renderSortIcon('amount')}</div>
                          </th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedExpenses.map(e => {
                          const isPlanned = e.expense_date > todayStr;
                          return (
                          <tr key={e.id} style={{ borderBottom: `1px solid ${theme.bgLight}`, transition: '0.2s' }} onMouseOver={ev=>ev.currentTarget.style.background='#f8fafc'} onMouseOut={ev=>ev.currentTarget.style.background='#fff'}>
                            <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', color: theme.textMuted, fontWeight: '500' }}>
                              {new Date(e.expense_date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}

                              {isPlanned && <div style={{ fontSize: '0.65rem', color: theme.blue, background: '#eff6ff', padding: '2px 6px', borderRadius: '6px', display: 'inline-block', marginLeft: '6px', fontWeight: '700' }}>Заплановано</div>}

                              {e.recurrence === 'monthly' && <div style={{ fontSize: '0.65rem', color: '#8b5cf6', background: '#faf5ff', padding: '2px 6px', borderRadius: '6px', display: 'inline-block', marginLeft: '6px', fontWeight: '700' }}>Щомісяця</div>}
                              {e.recurrence === 'weekly' && <div style={{ fontSize: '0.65rem', color: '#10b981', background: '#ecfdf5', padding: '2px 6px', borderRadius: '6px', display: 'inline-block', marginLeft: '6px', fontWeight: '700' }}>Щотижня</div>}
                            </td>

                            <td style={{ padding: '1rem 1.5rem' }}>
                               <span style={{ background: categoryStyles[e.category]?.bg || theme.bgLight, color: categoryStyles[e.category]?.fill || theme.textMain, padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600' }}>{e.category}</span>
                            </td>
                            <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', color: theme.textMain }}>
                              {e.description || '—'}
                            </td>
                            <td style={{ padding: '1rem 1.5rem', fontSize: '0.95rem', color: theme.textMain, fontWeight: '700', textAlign: 'right', whiteSpace: 'nowrap' }}>
                               {e.isVirtual && Number(e.amount) === 0 ? <span style={{ color: theme.textMuted, fontSize: '0.85rem' }}>Залежить від комісії</span> : `${Number(e.amount).toLocaleString('uk-UA')} ₴`}
                            </td>
                            <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                              {e.isVirtual ? (
                                <span style={{ fontSize: '0.75rem', color: theme.blue, background: '#eff6ff', padding: '4px 8px', borderRadius: '6px', fontWeight: '600' }}>Авто-прогноз</span>
                              ) : (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                  <button onClick={() => startEditExpense(e)} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', transition: '0.2s' }} onMouseOver={ev=>ev.currentTarget.style.color=theme.blue} onMouseOut={ev=>ev.currentTarget.style.color='#cbd5e1'} title="Редагувати">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                  </button>
                                  <button onClick={() => deleteExpense(e.id)} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', transition: '0.2s' }} onMouseOver={ev=>ev.currentTarget.style.color=theme.red} onMouseOut={ev=>ev.currentTarget.style.color='#cbd5e1'} title="Видалити">
                                    <Icons.TrashSmall />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>

                    {totalExpensePages > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: `1px solid ${theme.bgLight}` }}>
                        <span style={{ fontSize: '0.85rem', color: theme.textMuted, fontWeight: '500' }}>
                          Сторінка {expensePage} з {totalExpensePages}
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button disabled={expensePage === 1} onClick={() => setExpensePage(p => p - 1)} style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', border: `1px solid ${theme.border}`, background: expensePage === 1 ? theme.bgLight : '#fff', color: expensePage === 1 ? '#cbd5e1' : theme.textMain, cursor: expensePage === 1 ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: '600', transition: '0.2s' }}>Назад</button>
                          <button disabled={expensePage === totalExpensePages} onClick={() => setExpensePage(p => p + 1)} style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', border: `1px solid ${theme.border}`, background: expensePage === totalExpensePages ? theme.bgLight : '#fff', color: expensePage === totalExpensePages ? '#cbd5e1' : theme.textMain, cursor: expensePage === totalExpensePages ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: '600', transition: '0.2s' }}>Далі</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div style={{ animation: 'slideUp 0.2s ease-out' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ position: 'relative', width: '280px' }}>
                   <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: theme.textMuted, display: 'flex' }}><Icons.Search /></div>
                   <input
                     type="text"
                     placeholder="Пошук матеріалів..."
                     value={searchQuery}
                     onChange={(e) => { setSearchQuery(e.target.value); setInventoryPage(1); }}
                     style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem', borderRadius: '10px', border: `1px solid ${theme.border}`, outline: 'none', fontSize: '0.9rem', color: theme.textMain, transition: '0.2s' }}
                     onFocus={e => e.currentTarget.style.borderColor = theme.blue}
                     onBlur={e => e.currentTarget.style.borderColor = theme.border}
                   />
                </div>
                <button onClick={() => setIsInvModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: theme.textMain, color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', transition: '0.2s', boxShadow: '0 4px 12px rgba(15,23,42,0.1)' }} onMouseOver={e=>e.currentTarget.style.transform='translateY(-2px)'} onMouseOut={e=>e.currentTarget.style.transform='translateY(0)'}>
                  <Icons.Plus /> Додати товар
                </button>
              </div>

              <div style={{ background: '#fff', border: `1px solid ${theme.border}`, borderRadius: '16px', overflow: 'hidden' }}>
                {isLoading ? <div style={{ padding: '4rem', textAlign: 'center', color: theme.textMuted }}>Завантаження...</div> :
                 inventory.length === 0 ? (
                  <div style={{ padding: '5rem 2rem', textAlign: 'center' }}>
                    <div style={{ color: theme.border, marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}><div style={{ transform: 'scale(2)' }}><Icons.Archive /></div></div>
                    <h4 style={{ color: theme.textMain, fontSize: '1rem', marginBottom: '0.4rem', fontWeight: '600' }}>Склад порожній</h4>
                    <p style={{ color: theme.textMuted, fontSize: '0.9rem', margin: 0 }}>Додайте сюди матеріали для контролю залишків.</p>
                  </div>
                ) : filteredInventory.length === 0 ? (
                   <div style={{ padding: '3rem', textAlign: 'center', color: theme.textMuted, fontSize: '0.9rem' }}>Нічого не знайдено за запитом "{searchQuery}"</div>
                ) : (
                  <>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: theme.appleGray, borderBottom: `1px solid ${theme.border}` }}>
                          <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: theme.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Назва</th>
                          <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: theme.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Залишок</th>
                          <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: theme.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Вартість од.</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedInventory.map(i => (
                          <tr key={i.id} style={{ borderBottom: `1px solid ${theme.bgLight}`, transition: '0.2s' }} onMouseOver={ev=>ev.currentTarget.style.background='#f8fafc'} onMouseOut={ev=>ev.currentTarget.style.background='#fff'}>
                            <td style={{ padding: '1rem 1.5rem', fontSize: '0.95rem', color: theme.textMain, fontWeight: '600' }}>
                               <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: i.quantity > 5 ? '#10b981' : (i.quantity > 0 ? '#f59e0b' : theme.red) }} title="Статус"></div>
                                  {i.name}
                               </div>
                            </td>
                            <td style={{ padding: '1rem 1.5rem', textAlign: 'center', fontSize: '0.9rem', color: theme.textMain, fontWeight: '600' }}>
                              {i.quantity} <span style={{ color: theme.textMuted, fontWeight: '500' }}>{i.unit}</span>
                            </td>
                            <td style={{ padding: '1rem 1.5rem', fontSize: '0.95rem', color: theme.textMain, textAlign: 'right' }}>
                               {Number(i.price).toLocaleString('uk-UA')} ₴
                            </td>
                            <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                <button onClick={() => startEditInventory(i)} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', transition: '0.2s' }} onMouseOver={ev=>ev.currentTarget.style.color=theme.blue} onMouseOut={ev=>ev.currentTarget.style.color='#cbd5e1'} title="Редагувати">
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                </button>
                                <button onClick={() => deleteInventory(i.id)} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', transition: '0.2s' }} onMouseOver={ev=>ev.currentTarget.style.color=theme.red} onMouseOut={ev=>ev.currentTarget.style.color='#cbd5e1'} title="Видалити">
                                  <Icons.TrashSmall />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {totalInventoryPages > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: `1px solid ${theme.bgLight}` }}>
                        <span style={{ fontSize: '0.85rem', color: theme.textMuted, fontWeight: '500' }}>
                          Сторінка {inventoryPage} з {totalInventoryPages}
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button disabled={inventoryPage === 1} onClick={() => setInventoryPage(p => p - 1)} style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', border: `1px solid ${theme.border}`, background: inventoryPage === 1 ? theme.bgLight : '#fff', color: inventoryPage === 1 ? '#cbd5e1' : theme.textMain, cursor: inventoryPage === 1 ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: '600', transition: '0.2s' }}>Назад</button>
                          <button disabled={inventoryPage === totalInventoryPages} onClick={() => setInventoryPage(p => p + 1)} style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', border: `1px solid ${theme.border}`, background: inventoryPage === totalInventoryPages ? theme.bgLight : '#fff', color: inventoryPage === totalInventoryPages ? '#cbd5e1' : theme.textMain, cursor: inventoryPage === totalInventoryPages ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: '600', transition: '0.2s' }}>Далі</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 🟢 ПРАВА КОЛОНКА */}
        <div style={{ position: 'sticky', top: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {activeMode === 'expenses' ? (
            <>
              {/* 1. ФІНАНСОВІ ВИТРАТИ */}
              <div style={{ background: '#fff1f2', border: '1.5px dashed #fda4af', borderRadius: '16px', padding: '1.25rem' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                     <span style={{ color: '#be123c', display: 'flex', alignItems: 'center' }}><Icons.TrendingDown /></span>
                     <h3 style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '700', color: '#be123c', letterSpacing: '0.5px' }}>
                        Витрати за період
                     </h3>
                   </div>
                 </div>

                 <p style={{ fontSize: '0.75rem', color: '#be123c', marginBottom: '1rem', opacity: 0.8, marginTop: '-0.5rem' }}>
                   За {currentPeriodLabel}
                 </p>

                 <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.6)', borderRadius: '12px' }}>
                    <div style={{ fontSize: '0.65rem', color: '#be123c', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                       Загальна сума
                    </div>
                    <strong style={{ fontSize: '1.5rem', fontWeight: '800', color: '#be123c', whiteSpace: 'nowrap' }}>
                      {totalPeriodExpenses.toLocaleString('uk-UA')} ₴
                    </strong>
                 </div>
              </div>

              <div style={{ background: '#fff', border: `2px dashed ${theme.border}`, padding: '1.5rem', borderRadius: '16px', boxShadow: 'none' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                     <div style={{ color: theme.blue, display: 'flex' }}><Icons.Calendar /></div>
                     <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: theme.textMain }}>
                       План: {formattedNextMonth}
                     </h4>
                   </div>
                   <div style={{ background: '#eff6ff', color: theme.blue, padding: '0.25rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700' }}>
                     {upcomingMonthItems.length}
                   </div>
                 </div>

                 <div style={{ fontSize: '1.5rem', fontWeight: '800', letterSpacing: '-0.03em', color: theme.textMain, marginBottom: '1.2rem' }}>
                   {upcomingMonthTotal.toLocaleString('uk-UA')} <span style={{ fontSize: '1rem', color: theme.textMuted }}>₴</span>
                 </div>

                 {upcomingMonthItems.length > 0 ? (
                   <>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                       {paginatedPlannedItems.map(f => (
                         <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.6rem', borderBottom: `1px dashed ${theme.border}` }}>
                           <div>
                             <div style={{ color: theme.textMain, fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {f.description || f.category}
                             </div>
                             <div style={{ color: theme.textMuted, fontSize: '0.75rem', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {new Date(f.expense_date).toLocaleDateString('uk-UA', {day:'numeric', month:'short'})}
                                {f.isVirtual && <span style={{ color: theme.blue, background: '#eff6ff', padding: '2px 4px', borderRadius: '4px', fontSize: '0.6rem' }}>Прогноз</span>}
                             </div>
                           </div>
                           <div style={{ fontWeight: '700', color: theme.textMain, fontSize: '0.9rem' }}>
                             {f.isVirtual && Number(f.amount) === 0 ? <span style={{ color: theme.textMuted, fontSize: '0.8rem' }}>Залежить від комісії</span> : `${Number(f.amount).toLocaleString('uk-UA')} ₴`}
                           </div>
                         </div>
                       ))}
                     </div>

                     {/* 🟢 ПАГІНАЦІЯ ВІДЖЕТА */}
                     {totalPlannedPages > 1 && (
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.5rem' }}>
                          <button
                            disabled={plannedPage === 1}
                            onClick={() => setPlannedPage(p => p - 1)}
                            style={{ background: 'transparent', border: 'none', color: plannedPage === 1 ? '#cbd5e1' : theme.blue, cursor: plannedPage === 1 ? 'default' : 'pointer', display: 'flex', padding: '4px', transition: '0.2s' }}
                          >
                            <Icons.ChevronLeft />
                          </button>
                          <span style={{ fontSize: '0.75rem', fontWeight: '600', color: theme.textMuted }}>
                            {plannedPage} з {totalPlannedPages}
                          </span>
                          <button
                            disabled={plannedPage === totalPlannedPages}
                            onClick={() => setPlannedPage(p => p + 1)}
                            style={{ background: 'transparent', border: 'none', color: plannedPage === totalPlannedPages ? '#cbd5e1' : theme.blue, cursor: plannedPage === totalPlannedPages ? 'default' : 'pointer', display: 'flex', padding: '4px', transform: 'rotate(180deg)', transition: '0.2s' }}
                          >
                            <Icons.ChevronLeft />
                          </button>
                       </div>
                     )}
                   </>
                 ) : (
                   <div style={{ fontSize: '0.85rem', color: theme.textMuted, lineHeight: '1.4' }}>
                     Немає запланованих витрат чи зарплат на {formattedNextMonth.toLowerCase()}.
                   </div>
                 )}
              </div>

              <div style={{ background: '#fff', border: `1px solid ${theme.border}`, padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>

                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                   <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: theme.textMain }}>Структура витрат</h4>
                 </div>

                 <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                   {EXPENSE_CATEGORIES.map(cat => {
                     const amount = categoryBreakdown[cat] || 0;
                     const percent = totalPeriodExpenses > 0 ? Math.round((amount / totalPeriodExpenses) * 100) : 0;
                     const style = categoryStyles[cat] || categoryStyles['Інше'];

                     return (
                       <div key={cat}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px', alignItems: 'center' }}>
                           <span style={{ color: theme.textMain, fontWeight: '600' }}>{cat}</span>
                           <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                             <span style={{ color: amount > 0 ? theme.textMuted : '#cbd5e1', fontWeight: '600', fontSize: '0.8rem' }}>{amount.toLocaleString('uk-UA')} ₴</span>
                             <span style={{ color: amount > 0 ? style.fill : '#cbd5e1', fontWeight: '700', width: '36px', textAlign: 'right', fontSize: '0.85rem' }}>{percent}%</span>
                           </div>
                         </div>
                         <div style={{ width: '100%', height: '6px', background: amount > 0 ? style.bg : '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                           <div style={{ width: `${percent}%`, height: '100%', background: amount > 0 ? style.fill : 'transparent', borderRadius: '4px', transition: 'width 0.5s ease-out' }}></div>
                         </div>
                       </div>
                     );
                   })}
                 </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ background: '#fff', border: `1px solid ${theme.border}`, padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.2rem' }}>
                   <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#eff6ff', color: theme.blue, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     <Icons.Archive />
                   </div>
                   <div style={{ background: '#eff6ff', color: theme.blue, padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700' }}>
                     Актив
                   </div>
                 </div>
                 <div style={{ fontSize: '0.85rem', fontWeight: '600', color: theme.textMuted, marginBottom: '0.3rem' }}>Капітал у товарі</div>
                 <div style={{ fontSize: '1.8rem', fontWeight: '800', color: theme.textMain, letterSpacing: '-0.03em' }}>
                   {totalStockValue.toLocaleString('uk-UA')} <span style={{ fontSize: '1.1rem', color: theme.textMuted }}>₴</span>
                 </div>
              </div>

              {(lowStockItems.length > 0 || outOfStockItems.length > 0) && (
                <div style={{ background: '#fff', border: `1px solid ${theme.border}`, padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.2rem', color: theme.red }}>
                     <Icons.AlertCircle />
                     <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700' }}>Потрібно замовити</h4>
                   </div>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                     {outOfStockItems.map(i => (
                       <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', paddingBottom: '0.6rem', borderBottom: `1px dashed ${theme.border}` }}>
                         <span style={{ color: theme.textMain, fontWeight: '600' }}>{i.name}</span>
                         <span style={{ color: theme.red, fontWeight: '700' }}>Немає!</span>
                       </div>
                     ))}
                     {lowStockItems.map(i => (
                       <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', paddingBottom: '0.6rem', borderBottom: `1px dashed ${theme.border}` }}>
                         <span style={{ color: theme.textMain, fontWeight: '600' }}>{i.name}</span>
                         <span style={{ color: '#f59e0b', fontWeight: '700' }}>Залишилось {i.quantity}</span>
                       </div>
                     ))}
                   </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>

      {isCustomDatePickerOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} onClick={(e) => { e.stopPropagation(); setIsCustomDatePickerOpen(false); }} />
      )}

      {isExpModalOpen && (
        <div className="modal-overlay" onClick={closeExpModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ animation: 'slideUp 0.3s ease', maxWidth: '420px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: theme.textMain, margin: 0 }}>
                {editingExpense ? 'Редагувати витрату' : 'Новий запис'}
              </h2>
              <button onClick={closeExpModal} style={{ background: theme.bgLight, border: 'none', width: '32px', height: '32px', borderRadius: '50%', color: theme.textMuted, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="modal-label" style={{ fontWeight: '600' }}>Сума (₴) *</label>
                <input type="number" autoFocus value={expForm.amount} onChange={e=>setExpForm({...expForm, amount: e.target.value})} className="modal-input" placeholder="Наприклад: 1500" />
              </div>
              <div>
                <label className="modal-label" style={{ fontWeight: '600' }}>Категорія *</label>
                <div className="modal-select-wrapper">
                  <select value={expForm.category} onChange={e=>setExpForm({...expForm, category: e.target.value})}>
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <div className="modal-select-icon"><Icons.ChevronDown /></div>
                </div>
              </div>
              <div>
                <label className="modal-label" style={{ fontWeight: '600' }}>Опис (необов'язково)</label>
                <input type="text" value={expForm.description} onChange={e=>setExpForm({...expForm, description: e.target.value})} className="modal-input" placeholder="Наприклад: Закупівля шампунів" />
              </div>

              <div>
                <label className="modal-label" style={{ fontWeight: '600' }}>Дата</label>
                <div style={{ position: 'relative' }}>
                  <div
                    onClick={() => setIsCustomDatePickerOpen(!isCustomDatePickerOpen)}
                    className="modal-input"
                    style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: `1px solid ${theme.border}` }}
                  >
                    <span style={{ color: theme.textMain, fontWeight: '500' }}>
                      {new Date(expForm.date).toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                    <div style={{ color: theme.textMuted, display: 'flex' }}><Icons.Calendar /></div>
                  </div>

                  {isCustomDatePickerOpen && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '8px', background: '#fff', border: `1px solid ${theme.border}`, borderRadius: '12px', padding: '1rem', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 100, width: '100%', animation: 'slideUp 0.2s ease' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <button type="button" onClick={(e) => { e.stopPropagation(); shiftPickerMonth(-1); }} style={{ background: theme.bgLight, border: 'none', padding: '4px', borderRadius: '6px', cursor: 'pointer', color: theme.textMuted }}><Icons.ChevronLeft /></button>
                          <span style={{ fontWeight: '700', fontSize: '0.9rem', color: theme.textMain, textTransform: 'capitalize' }}>
                            {pickerViewDate.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' })}
                          </span>
                          <button type="button" onClick={(e) => { e.stopPropagation(); shiftPickerMonth(1); }} style={{ background: theme.bgLight, border: 'none', padding: '4px', borderRadius: '6px', cursor: 'pointer', color: theme.textMuted, transform: 'rotate(180deg)' }}><Icons.ChevronLeft /></button>
                       </div>
                       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
                          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map(d => <div key={d} style={{ fontSize: '0.7rem', color: theme.textMuted, fontWeight: '700' }}>{d}</div>)}
                          {getDaysInMonth(pickerViewDate).map((day, idx) => {
                             if (!day) return <div key={idx} />;
                             const dateStr = `${pickerViewDate.getFullYear()}-${String(pickerViewDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                             const isSelected = dateStr === expForm.date;
                             const isToday = dateStr === todayStr;
                             return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setExpForm({...expForm, date: dateStr}); setIsCustomDatePickerOpen(false); }}
                                  style={{ width: '32px', height: '32px', margin: 'auto', borderRadius: '50%', background: isSelected ? theme.blue : 'transparent', color: isSelected ? '#fff' : (isToday ? theme.blue : theme.textMain), border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: isSelected || isToday ? '700' : '500', transition: '0.2s' }}
                                  onMouseOver={e=> { if(!isSelected) e.currentTarget.style.background = theme.bgLight }}
                                  onMouseOut={e=> { if(!isSelected) e.currentTarget.style.background = 'transparent' }}
                                >
                                  {day}
                                </button>
                             )
                          })}
                       </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="modal-label" style={{ fontWeight: '600' }}>Повторення</label>
                <div className="modal-select-wrapper">
                  <select value={expForm.recurrence} onChange={e=>setExpForm({...expForm, recurrence: e.target.value})}>
                    <option value="none">Без повторень</option>
                    <option value="weekly">Щотижня (на рік вперед)</option>
                    <option value="monthly">Щомісяця (на рік вперед)</option>
                  </select>
                  <div className="modal-select-icon"><Icons.ChevronDown /></div>
                </div>
                {expForm.recurrence !== 'none' && (
                  <div style={{ fontSize: '0.75rem', color: theme.blue, marginTop: '0.5rem', background: '#eff6ff', padding: '0.6rem', borderRadius: '8px', lineHeight: '1.4' }}>
                    {editingExpense
                      ? "Увага: старі майбутні платежі цієї категорії будуть оновлені та перенесені відповідно до нової дати."
                      : "Система автоматично створить майбутні платежі починаючи з цієї дати. Вони з'являться у графі 'Заплановано'."}
                  </div>
                )}
              </div>

            </div>
            <button onClick={handleSaveExpense} disabled={isSaving} style={{ width: '100%', marginTop: '2rem', padding: '0.85rem', backgroundColor: theme.textMain, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '0.95rem', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1, transition: '0.2s' }}>
              {isSaving ? 'Збереження...' : 'Зберегти'}
            </button>
          </div>
        </div>
      )}

      {isInvModalOpen && (
        <div className="modal-overlay" onClick={closeInvModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ animation: 'slideUp 0.3s ease', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: theme.textMain, margin: 0 }}>
                {editingInventory ? 'Редагувати матеріал' : 'Новий матеріал'}
              </h2>
              <button onClick={closeInvModal} style={{ background: theme.bgLight, border: 'none', width: '32px', height: '32px', borderRadius: '50%', color: theme.textMuted, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="modal-label" style={{ fontWeight: '600' }}>Назва</label>
                <input type="text" autoFocus value={invForm.name} onChange={e=>setInvForm({...invForm, name: e.target.value})} className="modal-input" placeholder="Окисник 6% 1000мл" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="modal-label" style={{ fontWeight: '600' }}>Кількість</label>
                  <input type="number" value={invForm.quantity} onChange={e=>setInvForm({...invForm, quantity: e.target.value})} className="modal-input" placeholder="0" />
                </div>
                <div>
                  <label className="modal-label" style={{ fontWeight: '600' }}>Од. виміру</label>
                  <div className="modal-select-wrapper">
                    <select value={invForm.unit} onChange={e=>setInvForm({...invForm, unit: e.target.value})}>
                      {UNIT_TYPES.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <div className="modal-select-icon"><Icons.ChevronDown /></div>
                  </div>
                </div>
              </div>
              <div>
                <label className="modal-label" style={{ fontWeight: '600' }}>Вартість за одиницю (₴)</label>
                <input type="number" value={invForm.price} onChange={e=>setInvForm({...invForm, price: e.target.value})} className="modal-input" placeholder="0" />
              </div>
            </div>
            <button onClick={handleSaveInventory} disabled={isSaving} style={{ width: '100%', marginTop: '2rem', padding: '0.85rem', backgroundColor: theme.textMain, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '0.95rem', cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1, transition: '0.2s' }}>
              {isSaving ? 'Збереження...' : 'Зберегти'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}