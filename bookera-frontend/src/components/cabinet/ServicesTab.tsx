'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';

// Локальні іконки
const CopyIcon = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2-2v1"></path></svg>);
const CheckIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>);
const XIcon = () => (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>);

interface ServicesTabProps {
  business: any;
  services: any[];
  setServices: React.Dispatch<React.SetStateAction<any[]>>;
  Icons: any;
}

export default function ServicesTab({ business, services, setServices, Icons }: ServicesTabProps) {
  const supabase = useMemo(() => createClient(), []);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const addonDropdownRef = useRef<HTMLDivElement>(null);

  // --- СТАНИ ---
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [sortMode, setSortMode] = useState<'custom' | 'view'>('custom');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [activeSort, setActiveSort] = useState<{column: string, dir: 'asc'|'desc'} | null>(null);

  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isAdviceOpen, setIsAdviceOpen] = useState(false);

  const [selectedServices, setSelectedServices] = useState<number[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Модалка послуги
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [serviceForm, setServiceForm] = useState({
    name: '', duration: 30, price: 0, category: 'Основні', description: '', is_active: true, addon_services: [] as number[]
  });
  const [isServiceSaving, setIsServiceSaving] = useState(false);

  // Спеціальні стани для Розумного пошуку додаткових послуг (Upsell)
  const [addonSearch, setAddonSearch] = useState('');
  const [isAddonDropdownOpen, setIsAddonDropdownOpen] = useState(false);

  // Тости
  const [toast, setToast] = useState<{ show: boolean, msg: string, type: 'success' | 'error' | 'info' }>({ show: false, msg: '', type: 'success' });
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(serviceSearchQuery), 300);
    return () => clearTimeout(timer);
  }, [serviceSearchQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setIsSortDropdownOpen(false);
      }
      if (addonDropdownRef.current && !addonDropdownRef.current.contains(event.target as Node)) {
        setIsAddonDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- ЛОГІКА КАТЕГОРІЙ ---
  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    services.forEach(s => cats.add(s.category || 'Основні'));
    return Array.from(cats);
  }, [services]);

  // --- ЛОГІКА ВІДОБРАЖЕННЯ ТА СОРТУВАННЯ ---
  const displayedServices = useMemo(() => {
    let result = [...services];

    if (selectedCategory) {
      result = result.filter(s => (s.category || 'Основні') === selectedCategory);
    }

    if (debouncedSearch) {
      result = result.filter(s =>
        String(s?.name ?? '').toLowerCase().includes(String(debouncedSearch ?? '').toLowerCase()) ||
        (s.category && String(s.category).toLowerCase().includes(String(debouncedSearch ?? '').toLowerCase()))
      );
    }

    if (sortMode === 'view' && activeSort) {
       const { column, dir } = activeSort;
       result.sort((a, b) => {
          let valA = a[column];
          let valB = b[column];
          if (column === 'name') {
             return dir === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
          } else {
             return dir === 'asc' ? (Number(valA) || 0) - (Number(valB) || 0) : (Number(valB) || 0) - (Number(valA) || 0);
          }
       });
    } else {
       result.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    }

    return result;
  }, [services, debouncedSearch, sortMode, activeSort, selectedCategory]);

  const groupedServices = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    displayedServices.forEach(s => {
      const cat = s.category || 'Основні';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    });
    return groups;
  }, [displayedServices]);

  // --- ЛОГІКА UPSELL (ДОДАТКОВІ ПОСЛУГИ) ---
  const selectedAddons = useMemo(() => {
    return services.filter(s => serviceForm.addon_services.includes(s.id));
  }, [services, serviceForm.addon_services]);

  const availableAddonsGrouped = useMemo(() => {
    const filtered = services.filter(s =>
      s.id !== editingService?.id &&
      !serviceForm.addon_services.includes(s.id) &&
      String(s?.name ?? '').toLowerCase().includes(String(addonSearch ?? '').toLowerCase())
    );

    const groups: { [key: string]: any[] } = {};
    filtered.forEach(s => {
      const cat = s.category || 'Інше';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    });
    return groups;
  }, [services, editingService, serviceForm.addon_services, addonSearch]);

  const handleAddAddon = (id: number) => {
    setServiceForm(prev => ({ ...prev, addon_services: [...prev.addon_services, id] }));
    setAddonSearch('');
  };

  const handleRemoveAddon = (id: number) => {
    setServiceForm(prev => ({ ...prev, addon_services: prev.addon_services.filter(aId => aId !== id) }));
  };

  // --- МАСОВІ ДІЇ ТА СОТРУВАННЯ ---
  const toggleSelectAll = () => {
    if (selectedServices.length === displayedServices.length && displayedServices.length > 0) {
      setSelectedServices([]);
    } else {
      setSelectedServices(displayedServices.map(s => s.id));
    }
  };

  const toggleSelectService = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedServices.includes(id)) {
      setSelectedServices(selectedServices.filter(sId => sId !== id));
    } else {
      setSelectedServices([...selectedServices, id]);
    }
  };

  const handleBulkVisibility = async (makeActive: boolean) => {
    if (selectedServices.length === 0) return;
    try {
      setServices(prev => prev.map(s => selectedServices.includes(s.id) ? { ...s, is_active: makeActive } : s));
      const token = await getAuthToken();
      // Бекенд не має "масового" ендпоінта - викликаємо існуючий по одному
      // на кожну обрану послугу (прийнятно для дії "виділив кілька -> дію").
      await Promise.all(selectedServices.map(id => api.updateService(token, Number(id), { is_active: makeActive })));
      showToast(makeActive ? `Показано послуг: ${selectedServices.length}` : `Приховано послуг: ${selectedServices.length}`, 'success');
      setSelectedServices([]);
    } catch (error: any) {
      showToast(error?.message || 'Помилка оновлення статусу', 'error');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedServices.length === 0) return;
    if (!confirm(`Ви впевнені, що хочете видалити ${selectedServices.length} послуг?`)) return;
    try {
      setServices(prev => prev.filter(s => !selectedServices.includes(s.id)));
      const token = await getAuthToken();
      await Promise.all(selectedServices.map(id => api.deleteService(token, Number(id))));
      showToast(`Видалено послуг: ${selectedServices.length}`, 'success');
      setSelectedServices([]);
    } catch (error: any) {
      showToast(error?.message || 'Помилка при видаленні', 'error');
    }
  };

  const selectedServicesObjects = services.filter(s => selectedServices.includes(s.id));
  const activeCount = selectedServicesObjects.filter(s => s.is_active !== false).length;
  const hiddenCount = selectedServicesObjects.length - activeCount;

  const handleSortMenuClick = (mode: 'custom' | 'view') => {
    setSortMode(mode);
    setActiveSort(null);
    setIsSortDropdownOpen(false);
    showToast(mode === 'custom' ? 'Увімкнено Свій порядок' : 'Увімкнено Режим перегляду', 'info');
  };

  const applyHeaderSort = async (column: 'name' | 'duration' | 'price') => {
    const newDir = (activeSort?.column === column && activeSort.dir === 'asc') ? 'desc' : 'asc';
    setActiveSort({ column, dir: newDir });

    if (sortMode === 'custom') {
      let newServices = [...services];
      newServices.sort((a, b) => {
        let valA = a[column];
        let valB = b[column];
        if (column === 'name') {
          return newDir === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
        } else {
          return newDir === 'asc' ? (Number(valA) || 0) - (Number(valB) || 0) : (Number(valB) || 0) - (Number(valA) || 0);
        }
      });

      const updatedServices = newServices.map((srv, idx) => ({ ...srv, order_index: idx }));
      setServices(updatedServices);
      showToast(`Порядок збережено для клієнтів`, 'success');

      if (business) {
        try {
          const token = await getAuthToken();
          await Promise.all(updatedServices.map(srv =>
            api.updateService(token, Number(srv.id), { order_index: srv.order_index })
          ));
        } catch (error) {
          showToast("Помилка збереження порядку в БД", "error");
        }
      }
    }
  };

  const getSortIndicator = (columnName: string) => {
    if (activeSort?.column === columnName) {
      return activeSort.dir === 'asc' ? '↑' : '↓';
    }
    return '';
  };

  // --- DRAG & DROP ---
  const handleDragStart = (e: React.DragEvent, id: number) => {
    if (sortMode !== 'custom' || debouncedSearch || selectedCategory) return;
    const index = services.findIndex(s => s.id === id);
    setDraggedIndex(index);
  };

  const handleDragEnter = (e: React.DragEvent, id: number) => {
    if (sortMode !== 'custom' || debouncedSearch || selectedCategory) return;
    e.preventDefault();
    const index = services.findIndex(s => s.id === id);
    setDragOverIndex(index);
  };

  const handleDragEnd = async () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const newServices = [...services];
      newServices.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

      const [draggedItem] = newServices.splice(draggedIndex, 1);
      newServices.splice(dragOverIndex, 0, draggedItem);

      const updatedServices = newServices.map((srv, idx) => ({ ...srv, order_index: idx }));
      setServices(updatedServices);
      setActiveSort(null);

      if (business) {
        getAuthToken().then(token =>
          Promise.all(updatedServices.map(srv =>
            api.updateService(token, Number(srv.id), { order_index: srv.order_index })
          ))
        ).catch(() => showToast("Помилка збереження порядку", "error"));
      }
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // --- ДІЇ З ПОСЛУГАМИ ---
  const handleToggleActive = async (service: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = !service.is_active;
    setServices(services.map(s => s.id === service.id ? { ...s, is_active: newStatus } : s));
    try {
      const token = await getAuthToken();
      await api.updateService(token, Number(service.id), { is_active: newStatus });
      showToast(newStatus ? "Доступно онлайн" : "Приховано", "info");
    } catch (error) {
      setServices(services.map(s => s.id === service.id ? { ...s, is_active: !newStatus } : s));
      showToast("Помилка", "error");
    }
  };

  const handleDuplicate = async (service: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
        const token = await getAuthToken();
        const created = await api.createService(token, {
          business_id: business.id,
          name: `${service.name} (Копія)`,
          duration_minutes: service.duration_minutes,
          price: service.price,
          addon_service_ids: service.addon_service_ids || [],
        });
        setServices(prev => [...prev, created]);
        showToast("Послугу здубльовано", "success");
    } catch (error: any) {
        showToast(error?.message || "Не вдалося здублювати", "error");
    }
  };

  const openServiceModal = (service: any = null, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (service) {
      setEditingService(service);
      setServiceForm({
        name: service.name || '', duration: service.duration || 30, price: service.price || 0,
        category: service.category || 'Основні', description: service.description || '',
        is_active: service.is_active !== false, addon_services: service.addon_services || []
      });
    } else {
      setEditingService(null);
      setServiceForm({ name: '', duration: 30, price: 0, category: 'Основні', description: '', is_active: true, addon_services: [] });
    }
    setAddonSearch('');
    setIsAddonDropdownOpen(false);
    setIsServiceModalOpen(true);
  };

  const handleSaveService = async () => {
    if (!serviceForm.name || serviceForm.price < 0 || serviceForm.duration <= 0) {
      return showToast("Перевірте правильність заповнення полів", "error");
    }

    setIsServiceSaving(true);
    try {
      const token = await getAuthToken();

      if (editingService) {
        const updated = await api.updateService(token, editingService.id, {
          name: serviceForm.name,
          duration_minutes: serviceForm.duration,
          price: serviceForm.price,
          description: serviceForm.description,
          is_active: serviceForm.is_active,
          addon_service_ids: serviceForm.addon_services,
        });
        setServices(prev => prev.map(s => s.id === editingService.id ? updated : s));
        showToast("Послугу оновлено", "success");
      } else {
        const created = await api.createService(token, {
          business_id: business.id,
          name: serviceForm.name,
          duration_minutes: serviceForm.duration,
          price: serviceForm.price,
          addon_service_ids: serviceForm.addon_services,
        });
        setServices(prev => [...prev, created]);
        showToast("Послугу додано", "success");
      }
      setIsServiceModalOpen(false);
    } catch (error: any) {
      showToast(error?.message || "Помилка збереження послуги", "error");
    } finally {
      setIsServiceSaving(false);
    }
  };

  const handleDeleteService = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm("Ви впевнені, що хочете видалити цю послугу?")) return;
    try {
      const token = await getAuthToken();
      await api.deleteService(token, id);
      setServices(prev => prev.filter(s => s.id !== id));
      setSelectedServices(prev => prev.filter(sId => sId !== id));
      showToast("Послугу видалено", "info");
      setIsServiceModalOpen(false);
    } catch (error: any) {
      showToast(error?.message || "Помилка видалення", "error");
    }
  };

  const getSmartAdvice = () => {
    if (!services || services.length === 0) return { title: "Прайс порожній", text: "Додайте базові послуги (стрижка, манікюр тощо)." };
    const inactive = services.filter(s => s.is_active === false).length;
    if (services.length < 4) return { title: "Розширте асортимент", text: "Додайте супутні сервіси (наприклад, 'Миття голови'), щоб збільшити середній чек." };
    if (inactive > 0) return { title: "Увага до прихованих", text: `У вас ${inactive} прихованих послуг. Вони не доступні для клієнтів.` };
    if (!services.some(s => String(s?.name ?? '').toLowerCase().includes('комплекс'))) return { title: "Створіть комбо", text: "Об'єднайте декілька послуг у 'Комплекс' зі знижкою." };
    return { title: "Ідеальний баланс", text: "Ваш прайс-лист відмінно налаштований!" };
  };

  const stats = useMemo(() => {
    const total = services.length;
    const active = services.filter(s => s.is_active !== false).length;
    const avgPrice = total > 0 ? Math.round(services.reduce((acc, s) => acc + (s.price || 0), 0) / total) : 0;
    return { total, active, avgPrice };
  }, [services]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: '#fff' }}>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translate(-50%, 20px); } to { opacity: 1; transform: translate(-50%, 0); } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .toast-animate { animation: fadeIn 0.3s ease forwards; }

        .clean-input { width: 100%; padding: 0.5rem 0.8rem; border-radius: 8px; border: 1px solid #e2e8f0; background: #fafafa; font-size: 0.85rem; color: #0f172a; outline: none; transition: all 0.2s; }
        .clean-input:focus { border-color: #cbd5e1; background: #fff; }

        .clean-btn { background: #0f172a; color: #fff; border: none; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; }
        .clean-btn:hover { background: #1e293b; }

        .clean-btn-ghost { background: transparent; color: #64748b; border: 1px solid #e2e8f0; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; }
        .clean-btn-ghost:hover { background: #f8fafc; color: #0f172a; }

        .category-pill { padding: 0.4rem 1.2rem; border-radius: 999px; background: #fff; border: 1px solid #e2e8f0; color: #64748b; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: 0.2s; white-space: nowrap; flex-shrink: 0; }
        .category-pill:hover { background: #f8fafc; color: #0f172a; }
        .category-pill.active { background: #0f172a; color: #fff; border-color: #0f172a; }

        .service-table { width: 100%; border-collapse: collapse; text-align: left; }
        .service-table th { padding: 0.6rem 1rem; color: #94a3b8; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #f1f5f9; position: sticky; top: 0; background: #fdfdfd; z-index: 10; transition: color 0.2s; }
        .service-table th.sortable:hover { color: #0f172a; cursor: pointer; }
        .service-table td { padding: 0.6rem 1rem; border-bottom: 1px solid #f8fafc; vertical-align: middle; transition: background 0.15s; }
        .service-table tr { cursor: pointer; transition: 0.15s; }
        .service-table tr.service-row:hover td { background: #f8fafc; }
        
        .category-header td { color: #94a3b8; font-weight: 700; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; padding: 1.5rem 1rem 0.4rem 1rem; border: none; }

        .service-row.dragging td { opacity: 0.4; }
        .service-row.drag-over td { border-top: 1px solid #0f172a; }
        .drag-handle { color: #cbd5e1; display: inline-flex; align-items: center; justify-content: center; transition: 0.2s; opacity: 0.3; cursor: grab; padding-right: 0.2rem; }
        .service-row:hover .drag-handle { opacity: 1; color: #94a3b8; }
        .drag-handle.disabled { cursor: not-allowed; opacity: 0 !important; }

        .row-actions { display: flex; flex-direction: row; gap: 0.4rem; opacity: 1; justify-content: flex-end; align-items: center; }
        .row-action-btn { width: 32px; height: 32px; border-radius: 8px; background: transparent; border: none; display: flex; align-items: center; justify-content: center; color: #cbd5e1; cursor: pointer; transition: 0.2s; }
        .service-row:hover .row-action-btn { color: #64748b; }
        .row-action-btn:hover { background: #f1f5f9; color: #0f172a !important; }
        .row-action-btn.delete:hover { background: #fee2e2; color: #ef4444 !important; }

        .apple-switch { position: relative; width: 32px; height: 18px; background: #e2e8f0; border-radius: 10px; cursor: pointer; transition: 0.3s; margin: 0 auto; }
        .apple-switch.on { background: #10b981; }
        .apple-switch-knob { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; background: #fff; border-radius: 50%; transition: 0.3s; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
        .apple-switch.on .apple-switch-knob { transform: translateX(14px); }

        .clean-select-trigger { display: flex; align-items: center; gap: 0.4rem; cursor: pointer; font-size: 0.85rem; font-weight: 500; color: #475569; transition: 0.2s; padding: 0.4rem 0.6rem; border-radius: 6px; }
        .clean-select-trigger:hover { color: #0f172a; background: #f8fafc; }
        .clean-select-dropdown { position: absolute; top: calc(100% + 5px); right: 0; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); z-index: 50; overflow: hidden; animation: slideDown 0.2s ease; min-width: 220px; padding: 0.3rem; }
        .clean-select-option { padding: 0.5rem 0.8rem; font-size: 0.8rem; font-weight: 500; color: #475569; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: 0.2s; border-radius: 4px; }
        .clean-select-option:hover { background: #f8fafc; color: #0f172a; }
        .clean-select-option.selected { color: #0f172a; font-weight: 600; background: #f1f5f9; }

        .min-checkbox { width: 18px; height: 18px; border: 1.5px solid #cbd5e1; border-radius: 5px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease; background: #fff; margin: 0; padding: 0; flex-shrink: 0; }
        .min-checkbox:hover { border-color: #94a3b8; }
        .min-checkbox.checked { background: #0f172a; border-color: #0f172a; color: #fff; }
        .min-checkbox svg { width: 12px; height: 12px; opacity: 0; transform: scale(0.5); transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .min-checkbox.checked svg { opacity: 1; transform: scale(1); }

        .addon-chip { display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; color: #0f172a; transition: 0.2s; }
        .addon-chip button { background: transparent; border: none; padding: 0; display: flex; align-items: center; justify-content: center; color: #94a3b8; cursor: pointer; transition: 0.2s; margin-left: 2px; }
        .addon-chip button:hover { color: #ef4444; }

        .addon-dropdown-item { cursor: pointer; transition: 0.2s; display: flex; justify-content: space-between; align-items: center; }
        .addon-dropdown-item:hover { background: #f1f5f9; }

        .widget-card { background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; padding: 1.2rem; margin-bottom: 0.8rem; }
        .widget-title { font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.6rem; display: flex; justify-content: space-between; align-items: center; }

        .custom-scroll::-webkit-scrollbar { width: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 6px; }
        .custom-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* --- ТУЛБАР --- */}
      <div style={{ padding: '0.8rem 2rem 0 2rem', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 20 }}>
         <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ position: 'relative', width: '280px' }}>
               <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex' }}>
                  <Icons.Search />
               </div>
               <input
                  type="text"
                  value={serviceSearchQuery}
                  onChange={(e) => setServiceSearchQuery(e.target.value)}
                  className="clean-input"
                  placeholder="Пошук послуги..."
                  style={{ paddingLeft: '2.2rem' }}
               />
            </div>
         </div>

         <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <div style={{ position: 'relative' }} ref={sortMenuRef}>
               <div className="clean-select-trigger" onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}>
                  <span style={{ color: '#94a3b8' }}>Сортування:</span>
                  <span style={{ fontWeight: 600 }}>
                    {sortMode === 'custom' ? 'Свій порядок' : 'Режим перегляду'}
                  </span>
                  <div style={{ color: '#cbd5e1', display: 'flex', transform: 'scale(0.8)' }}><Icons.ChevronDown /></div>
               </div>

               {isSortDropdownOpen && (
                  <div className="clean-select-dropdown">
                     <div onClick={() => handleSortMenuClick('custom')} className={`clean-select-option ${sortMode === 'custom' ? 'selected' : ''}`}>
                        Свій порядок
                        {sortMode === 'custom' && <div style={{ color: '#0f172a', transform: 'scale(0.8)' }}><Icons.CheckCircle /></div>}
                     </div>
                     <div onClick={() => handleSortMenuClick('view')} className={`clean-select-option ${sortMode === 'view' ? 'selected' : ''}`}>
                        Режим перегляду
                        {sortMode === 'view' && <div style={{ color: '#0f172a', transform: 'scale(0.8)' }}><Icons.CheckCircle /></div>}
                     </div>
                  </div>
               )}
            </div>

            <div style={{ width: '1px', height: '16px', background: '#e2e8f0', margin: '0 0.2rem' }}></div>

            <button onClick={() => openServiceModal()} className="clean-btn">
               <Icons.Plus /> Додати
            </button>
         </div>
      </div>

      {/* ФІЛЬТР КАТЕГОРІЙ */}
      {uniqueCategories.length > 0 && (
        <div className="hide-scrollbar" style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '1rem 2rem', background: '#fff', borderBottom: '1px solid #f1f5f9' }}>
           <button
             className={`category-pill ${!selectedCategory ? 'active' : ''}`}
             onClick={() => setSelectedCategory(null)}
           >
             Всі послуги
           </button>
           {uniqueCategories.map(cat => (
              <button
                key={cat}
                className={`category-pill ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
           ))}
        </div>
      )}

      {/* --- ТАБЛИЦЯ ТА САЙДБАР --- */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', flex: 1, overflow: 'hidden' }}>

        <div className="custom-scroll" style={{ overflowY: 'auto', borderRight: '1px solid #f1f5f9', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: '1200px', paddingRight: '1.5rem', paddingLeft: '0.5rem' }}>
              {displayedServices.length > 0 ? (
                 <table className="service-table">
                    <thead>
                       <tr>
                          <th style={{ width: '40px', paddingLeft: '1.5rem' }}>
                             <div className={`min-checkbox ${selectedServices.length > 0 && selectedServices.length === displayedServices.length ? 'checked' : ''}`} onClick={toggleSelectAll}>
                                <CheckIcon />
                             </div>
                          </th>
                          <th style={{ width: '30px', padding: '0.6rem 0' }}></th>

                          <th className="sortable" style={{ width: 'auto', whiteSpace: 'nowrap' }} onClick={() => applyHeaderSort('name')}>
                            Назва послуги <span style={{ color: '#0f172a', display: 'inline-block', width: '12px', textAlign: 'center' }}>{getSortIndicator('name')}</span>
                          </th>
                          <th className="sortable" style={{ width: '130px', whiteSpace: 'nowrap' }} onClick={() => applyHeaderSort('duration')}>
                            Тривалість <span style={{ color: '#0f172a', display: 'inline-block', width: '12px', textAlign: 'center' }}>{getSortIndicator('duration')}</span>
                          </th>
                          <th className="sortable" style={{ width: '130px', whiteSpace: 'nowrap' }} onClick={() => applyHeaderSort('price')}>
                            Вартість <span style={{ color: '#0f172a', display: 'inline-block', width: '12px', textAlign: 'center' }}>{getSortIndicator('price')}</span>
                          </th>

                          <th style={{ width: '100px', textAlign: 'center' }}>Онлайн</th>
                          <th style={{ width: '100px', textAlign: 'right', paddingRight: '1.5rem' }}>Дії</th>
                       </tr>
                    </thead>
                    <tbody>
                       {Object.keys(groupedServices).map(category => (
                          <React.Fragment key={category}>
                             {!selectedCategory && (
                               <tr className="category-header">
                                  <td colSpan={7} style={{ paddingLeft: '1.5rem' }}>{category}</td>
                               </tr>
                             )}
                             {groupedServices[category].map(service => {
                                const originalIndex = services.findIndex(s => s.id === service.id);
                                const isDragDisabled = sortMode !== 'custom' || debouncedSearch.length > 0 || selectedCategory !== null;
                                const isSelected = selectedServices.includes(service.id);
                                const hasAddons = service.addon_services && service.addon_services.length > 0;

                                return (
                                   <tr
                                      key={service.id}
                                      className={`service-row ${draggedIndex === originalIndex ? 'dragging' : ''} ${dragOverIndex === originalIndex && draggedIndex !== originalIndex ? 'drag-over' : ''}`}
                                      draggable={!isDragDisabled}
                                      onDragStart={(e) => handleDragStart(e, service.id)}
                                      onDragEnter={(e) => handleDragEnter(e, service.id)}
                                      onDragEnd={handleDragEnd}
                                      onDragOver={(e) => e.preventDefault()}
                                      onClick={() => openServiceModal(service)}
                                      style={{ background: isSelected ? '#f8fafc' : 'transparent' }}
                                   >
                                      <td style={{ paddingLeft: '1.5rem' }}>
                                         <div className={`min-checkbox ${isSelected ? 'checked' : ''}`} onClick={(e) => toggleSelectService(service.id, e)}>
                                            <CheckIcon />
                                         </div>
                                      </td>
                                      <td style={{ padding: '0.6rem 0' }}>
                                         <div className={`drag-handle ${!isDragDisabled ? 'active' : 'disabled'}`} title={isDragDisabled ? "Перетягування доступне лише у 'Своєму порядку' без пошуку та фільтрів" : "Змінити порядок"}>
                                            <Icons.Grip />
                                         </div>
                                      </td>
                                      <td>
                                         <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                              <span style={{ fontWeight: '600', color: service.is_active === false ? '#94a3b8' : '#0f172a', fontSize: '0.9rem' }}>
                                                 {service.name}
                                              </span>
                                              {hasAddons && (
                                                <span style={{ background: '#f5f3ff', color: '#7c3aed', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '700' }}>
                                                  +{service.addon_services.length} Upsell
                                                </span>
                                              )}
                                            </div>
                                            {service.description && (
                                               <span style={{ color: '#94a3b8', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>
                                                  {service.description}
                                               </span>
                                            )}
                                         </div>
                                      </td>
                                      <td style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '500' }}>
                                         {service.duration} хв
                                      </td>
                                      <td style={{ color: '#0f172a', fontSize: '0.85rem', fontWeight: '700' }}>
                                         {service.price} ₴
                                      </td>
                                      <td>
                                         <div onClick={(e) => handleToggleActive(service, e)} className={`apple-switch ${service.is_active !== false ? 'on' : ''}`}>
                                            <div className="apple-switch-knob"></div>
                                         </div>
                                      </td>
                                      <td style={{ paddingRight: '1.5rem', whiteSpace: 'nowrap' }}>
                                         <div className="row-actions">
                                            <button className="row-action-btn" onClick={(e) => handleDuplicate(service, e)} title="Дублювати послугу">
                                               <CopyIcon />
                                            </button>
                                            <button className="row-action-btn delete" onClick={(e) => handleDeleteService(service.id, e)} title="Видалити">
                                               <Icons.TrashSmall />
                                            </button>
                                         </div>
                                      </td>
                                   </tr>
                                );
                             })}
                          </React.Fragment>
                       ))}
                    </tbody>
                 </table>
              ) : (
                 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '500px', color: '#64748b' }}>
                    <div style={{ background: '#fff', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', color: '#cbd5e1', border: '1px solid #f1f5f9' }}>
                       <Icons.Search />
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', margin: '0 0 0.4rem 0' }}>Послуг не знайдено</h3>
                    <p style={{ fontSize: '0.85rem' }}>Змініть параметри пошуку або додайте нову послугу.</p>
                 </div>
              )}
            </div>
        </div>

        {/* ПРАВА ЧАСТИНА: САЙДБАР */}
        <div className="custom-scroll" style={{ padding: '1.2rem', background: '#fff', overflowY: 'auto' }}>
           <div className="widget-card">
              <div className="widget-title" style={{ cursor: 'default' }}>Статистика прайсу</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#475569', fontSize: '0.8rem' }}>Усього послуг</span>
                    <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.85rem' }}>{stats.total}</span>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#475569', fontSize: '0.8rem' }}>Доступно онлайн</span>
                    <span style={{ fontWeight: '700', color: '#10b981', fontSize: '0.85rem' }}>{stats.active}</span>
                 </div>
                 <div style={{ height: '1px', background: '#e2e8f0', margin: '0.1rem 0' }}></div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#475569', fontSize: '0.8rem' }}>Середня ціна</span>
                    <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.85rem' }}>~{stats.avgPrice} ₴</span>
                 </div>
              </div>
           </div>

           <div style={{ background: '#f5f3ff', border: '1px dashed #c4b5fd', borderRadius: '12px', padding: '1rem', marginBottom: '0.8rem', cursor: 'pointer', transition: 'all 0.2s ease' }} onClick={() => setIsAiOpen(!isAiOpen)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#7c3aed' }}>
                 <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <Icons.Sparkles width="14" height="14" /> AI Insight
                 </span>
                 <span style={{ transform: isAiOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s', display: 'flex' }}>
                   <Icons.ChevronDown width="16" height="16" />
                 </span>
              </div>
              {isAiOpen && (
                 <div style={{ marginTop: '0.8rem', animation: 'fadeIn 0.2s ease', borderTop: '1px dashed rgba(124, 58, 237, 0.2)', paddingTop: '0.8rem' }}>
                    <div style={{ fontWeight: '700', color: '#5b21b6', marginBottom: '0.3rem', fontSize: '0.85rem' }}>{getSmartAdvice().title}</div>
                    <p style={{ fontSize: '0.75rem', color: '#6d28d9', lineHeight: '1.4', margin: 0 }}>{getSmartAdvice().text}</p>
                 </div>
              )}
           </div>

           <div style={{ background: '#fff', border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '1rem', marginBottom: '0.8rem', cursor: 'pointer', transition: 'all 0.2s ease' }} onClick={() => setIsAdviceOpen(!isAdviceOpen)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#64748b' }}>
                 <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Порада</span>
                 <span style={{ transform: isAdviceOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s', display: 'flex' }}>
                   <Icons.ChevronDown width="16" height="16" />
                 </span>
              </div>
              {isAdviceOpen && (
                 <div style={{ marginTop: '0.8rem', animation: 'fadeIn 0.2s ease', borderTop: '1px dashed #e2e8f0', paddingTop: '0.8rem' }}>
                    <p style={{ fontSize: '0.75rem', color: '#475569', lineHeight: '1.4', margin: 0 }}>
                       В <b>"Своєму порядку"</b> клік по колонках зберігає обране сортування для клієнтів.<br/><br/> У <b>"Режимі перегляду"</b> клік по колонках лише візуально сортує список для вас.
                    </p>
                 </div>
              )}
           </div>
        </div>
      </div>

      {/* Панель масових дій */}
      {selectedServices.length > 0 && (
         <div style={{ position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', background: '#0f172a', color: '#fff', padding: '0.6rem 1.2rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1.2rem', boxShadow: '0 10px 25px rgba(15,23,42,0.3)', zIndex: 100, animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: '600' }}>
               Вибрано: <span style={{ background: '#3b82f6', padding: '0.1rem 0.4rem', borderRadius: '4px', marginLeft: '0.2rem' }}>{selectedServices.length}</span>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem' }}>
               {activeCount > 0 && hiddenCount === 0 && (
                 <button onClick={() => handleBulkVisibility(false)} style={{ background: '#1e293b', border: 'none', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem' }}>Приховати</button>
               )}
               {hiddenCount > 0 && activeCount === 0 && (
                 <button onClick={() => handleBulkVisibility(true)} style={{ background: '#10b981', border: 'none', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem' }}>Показати</button>
               )}
               {activeCount > 0 && hiddenCount > 0 && (
                 <>
                   <button onClick={() => handleBulkVisibility(true)} style={{ background: '#10b981', border: 'none', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem' }}>Показати всі</button>
                   <button onClick={() => handleBulkVisibility(false)} style={{ background: '#1e293b', border: 'none', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem' }}>Приховати всі</button>
                 </>
               )}
               <button onClick={handleBulkDelete} style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem', marginLeft: '0.4rem' }}>Видалити</button>
            </div>

            <button onClick={() => setSelectedServices([])} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}><Icons.XCircle /></button>
         </div>
      )}

      {/* --- МОДАЛЬНЕ ВІКНО ПОСЛУГИ --- */}
      {isServiceModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15,23,42,0.3)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setIsServiceModalOpen(false)}>

          {/* 🟢 ЗМІНЕНО: Великий розмір вікна (85vh), гнучка структура, без зайвого розтягування */}
          <div className="toast-animate" onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '520px', height: '85vh', minHeight: '600px', maxHeight: '800px', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px rgba(0,0,0,0.15)', overflow: 'hidden' }}>

            {/* Хедер модалки */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                {editingService ? 'Редагувати послугу' : 'Нова послуга'}
              </h2>
              <button onClick={() => setIsServiceModalOpen(false)} style={{ background: '#f8fafc', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', transition: '0.2s' }} onMouseOver={e=>e.currentTarget.style.background='#e2e8f0'} onMouseOut={e=>e.currentTarget.style.background='#f8fafc'}>
                <XIcon />
              </button>
            </div>

            {/* 🟢 Скролиме тіло модалки. Зверни увагу на margin-right та padding-right для правильного скролу */}
            <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 1rem 1.5rem 2rem', marginRight: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', paddingRight: '0.5rem' }}>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '0.3rem' }}>Назва послуги *</label>
                  <input type="text" value={serviceForm.name} onChange={(e) => setServiceForm({...serviceForm, name: e.target.value})} className="clean-input" placeholder="Наприклад: Чоловіча стрижка" autoFocus />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '0.3rem' }}>Категорія</label>
                  <input type="text" value={serviceForm.category} onChange={(e) => setServiceForm({...serviceForm, category: e.target.value})} className="clean-input" placeholder="Наприклад: Стрижки, Борода..." />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '0.3rem' }}>Тривалість (хв) *</label>
                    <input type="number" value={serviceForm.duration || ''} onChange={(e) => setServiceForm({...serviceForm, duration: Number(e.target.value)})} className="clean-input" placeholder="60" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '0.3rem' }}>Ціна (₴) *</label>
                    <input type="number" value={serviceForm.price || ''} onChange={(e) => setServiceForm({...serviceForm, price: Number(e.target.value)})} className="clean-input" placeholder="500" />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '0.3rem' }}>Опис (необов'язково)</label>
                  <textarea
                    value={serviceForm.description}
                    onChange={(e) => setServiceForm({...serviceForm, description: e.target.value})}
                    className="clean-input custom-scroll"
                    placeholder="Що входить у цю послугу?"
                    style={{ minHeight: '80px', resize: 'none' }}
                  />
                </div>

                {/* 🟢 БЛОК UPSELL: Випадаючий список поверх усього */}
                {services.length > 0 && (
                  <div style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: '16px', border: '1px solid #e2e8f0', marginTop: '0.5rem' }} ref={addonDropdownRef}>
                     <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.4rem' }}>
                        <Icons.Sparkles width="16" height="16" color="#7c3aed" /> Пропонувати додатково
                     </label>
                     <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1rem 0', lineHeight: '1.4' }}>
                        Збільшуйте середній чек. Виберіть послуги, які клієнт побачить як рекомендацію під час запису.
                     </p>

                     {/* 🟢 Компактний скрол вибраних тегів */}
                     {selectedAddons.length > 0 && (
                       <div className="custom-scroll" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '1rem', maxHeight: '80px', overflowY: 'auto' }}>
                         {selectedAddons.map(addon => (
                           <div key={addon.id} className="addon-chip" style={{ background: '#fff', border: '1px solid #cbd5e1', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                             <span style={{ color: '#10b981', marginRight: '2px' }}>+</span>
                             {addon.name}
                             <button onClick={() => handleRemoveAddon(addon.id)} style={{ marginLeft: '4px' }}><XIcon /></button>
                           </div>
                         ))}
                       </div>
                     )}

                     <div style={{ position: 'relative' }}>
                       <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', pointerEvents: 'none' }}>
                          <Icons.Search width="16" height="16" />
                       </div>
                       <input
                         type="text"
                         value={addonSearch}
                         onChange={(e) => { setAddonSearch(e.target.value); setIsAddonDropdownOpen(true); }}
                         onFocus={() => setIsAddonDropdownOpen(true)}
                         placeholder="Шукати послугу для додавання..."
                         className="clean-input"
                         style={{ background: '#fff', paddingLeft: '2.4rem', paddingRight: '1rem', height: '44px', fontSize: '0.9rem', marginBottom: '0' }}
                       />

                       {/* 🟢 Абсолютний список, який випадає ПОВЕРХ кнопок футера */}
                       {isAddonDropdownOpen && Object.keys(availableAddonsGrouped).length > 0 && (
                         <div className="custom-scroll" style={{
                            position: 'absolute',
                            top: 'calc(100% + 8px)',
                            left: 0,
                            right: 0,
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '12px',
                            maxHeight: '240px',
                            overflowY: 'auto',
                            zIndex: 100,
                            boxShadow: '0 15px 35px rgba(0,0,0,0.15)'
                         }}>
                           {Object.keys(availableAddonsGrouped).map(cat => (
                             <div key={cat}>
                               <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0.6rem 1rem', background: '#f8fafc' }}>
                                 {cat}
                               </div>
                               {availableAddonsGrouped[cat].map(s => (
                                 <div
                                   key={s.id}
                                   onClick={() => handleAddAddon(s.id)}
                                   style={{ padding: '0.7rem 1rem', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background 0.2s' }}
                                   onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                                   onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
                                 >
                                   <div style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: '600' }}>{s.name}</div>
                                   <div style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: '700' }}>+{s.price} ₴</div>
                                 </div>
                               ))}
                             </div>
                           ))}
                         </div>
                       )}

                       {isAddonDropdownOpen && Object.keys(availableAddonsGrouped).length === 0 && (
                          <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', fontSize: '0.85rem', color: '#64748b', zIndex: 100, boxShadow: '0 15px 35px rgba(0,0,0,0.15)' }}>
                            Всі послуги вже додано або нічого не знайдено за запитом "{addonSearch}"
                          </div>
                       )}
                     </div>
                  </div>
                )}
              </div>
            </div>

            {/* Футер модалки (Кнопки дії завжди видимі знизу) */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', padding: '1.2rem 2rem', borderTop: '1px solid #f1f5f9', flexShrink: 0, background: '#fff' }}>
              <button onClick={() => setIsServiceModalOpen(false)} className="clean-btn-ghost">Скасувати</button>
              <button onClick={handleSaveService} disabled={isServiceSaving} className="clean-btn" style={{ opacity: isServiceSaving ? 0.7 : 1 }}>
                {isServiceSaving ? 'Збереження...' : 'Зберегти'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ТОСТИ */}
      {toast.show && (
        <div className="toast-animate" style={{ position: 'fixed', bottom: '2rem', right: '2rem', background: toast.type === 'error' ? '#ef4444' : (toast.type === 'info' ? '#3b82f6' : '#0f172a'), color: '#fff', padding: '0.8rem 1.2rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.6rem', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', zIndex: 9999, fontWeight: '600', fontSize: '0.85rem' }}>
           {toast.type === 'error' ? <Icons.AlertCircle /> : <Icons.CheckCircle />}
           {toast.msg}
        </div>
      )}

    </div>
  );
}