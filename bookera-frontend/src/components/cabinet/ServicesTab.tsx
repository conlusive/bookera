'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';
import FormModal, { Field, FormDisclosure, FormSection } from '@/components/ui/FormModal';
import DurationPicker from '@/components/ui/DurationPicker';
import { formatDuration } from '@/lib/duration';
import { notify } from '@/lib/feedback';

// Локальні іконки
const CopyIcon = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2-2v1"></path></svg>);
const CheckIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>);
const XIcon = () => (<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>);

// Зрозуміла іконка з 6 крапок для перетягування
const GripDotsIcon = () => (
  <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
    <circle cx="2" cy="2" r="1.5" />
    <circle cx="8" cy="2" r="1.5" />
    <circle cx="2" cy="8" r="1.5" />
    <circle cx="8" cy="8" r="1.5" />
    <circle cx="2" cy="14" r="1.5" />
    <circle cx="8" cy="14" r="1.5" />
  </svg>
);

interface ServicesTabProps {
  business: any;
  services: any[];
  setServices: React.Dispatch<React.SetStateAction<any[]>>;
  Icons: any;
}

export default function ServicesTab({ business, services, setServices, Icons }: ServicesTabProps) {
  const supabase = useMemo(() => createClient(), []);
  const addonDropdownRef = useRef<HTMLDivElement>(null);

  // --- СТАНИ ---
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [activeSort, setActiveSort] = useState<{column: string, dir: 'asc'|'desc'} | null>(null);

  const [isAiOpen, setIsAiOpen] = useState(false);

  const [selectedServices, setSelectedServices] = useState<number[]>([]);

  // Модалка послуги
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [serviceForm, setServiceForm] = useState({
    name: '', duration: 60, price: 0, category: '', description: '', is_active: true, addon_services: [] as number[]
  });
  const [priceTouched, setPriceTouched] = useState(false);
  const [isServiceSaving, setIsServiceSaving] = useState(false);

  const formValid = serviceForm.name.trim().length >= 2 && serviceForm.duration >= 5 && serviceForm.duration <= 480 && serviceForm.price >= 0;

  // Спеціальні стани для Розумного пошуку додаткових послуг (Upsell)
  const [addonSearch, setAddonSearch] = useState('');
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [serviceMaterials, setServiceMaterials] = useState<{ inventory_item_id: number; quantity_per_use: number }[]>([]);
  const [isAddonDropdownOpen, setIsAddonDropdownOpen] = useState(false);

  // Тости
  // Відгук на місці замість сповіщень (lib/feedback.ts)
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success', opts?: { field?: string }) => notify(msg, type, opts);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(serviceSearchQuery), 300);
    return () => clearTimeout(timer);
  }, [serviceSearchQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
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
    services.forEach(s => cats.add(s.category || 'Без категорії'));
    return Array.from(cats);
  }, [services]);

  // --- ЛОГІКА ВІДОБРАЖЕННЯ ТА СОРТУВАННЯ ---
  const orderedServices = useMemo(
    () => [...services].sort((a, b) => (a.order_index || 0) - (b.order_index || 0)),
    [services],
  );

  const displayedServices = useMemo(() => {
    let result = [...services];

    if (selectedCategory) {
      result = result.filter(s => (s.category || 'Без категорії') === selectedCategory);
    }

    if (debouncedSearch) {
      result = result.filter(s =>
        String(s?.name ?? '').toLowerCase().includes(String(debouncedSearch ?? '').toLowerCase()) ||
        (s.category && String(s.category).toLowerCase().includes(String(debouncedSearch ?? '').toLowerCase()))
      );
    }

    // Клік по колонці сортує ЛИШЕ на екрані власника. Порядок для клієнтів -
    // окремий режим («Порядок для клієнтів») і зберігається лише кнопкою.
    if (activeSort) {
       const { column, dir } = activeSort;
       result.sort((a, b) => {
          // «duration» у заголовку таблиці - це duration_minutes на сервері
          const key = column === 'duration' ? 'duration_minutes' : column;
          let valA = a[key];
          let valB = b[key];
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
  }, [services, debouncedSearch, activeSort, selectedCategory]);

  const groupedServices = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    displayedServices.forEach(s => {
      const cat = s.category || 'Без категорії';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(s);
    });
    return groups;
  }, [displayedServices]);

  // Категорії, що вже є, - підказки в полі «Категорія»: одна назва для
  // групи, без «Стрижки» й «стрижки» поруч.
  const existingCategories = useMemo(
    () => Array.from(new Set(services.map(s => (s.category || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'uk')),
    [services],
  );

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

  // Колонка: за зростанням -> за спаданням -> як у вас (скинути)
  const applyHeaderSort = (column: 'name' | 'duration' | 'price') => {
    setActiveSort(prev => {
      if (prev?.column !== column) return { column, dir: 'asc' };
      if (prev.dir === 'asc') return { column, dir: 'desc' };
      return null;
    });
  };

  const getSortIndicator = (columnName: string) =>
    activeSort?.column === columnName ? (activeSort.dir === 'asc' ? '↑' : '↓') : '';

  const SORT_LABEL: Record<string, string> = { name: 'назвою', duration: 'тривалістю', price: 'ціною' };

  // --- ПОРЯДОК ДЛЯ КЛІЄНТІВ ---
  // Окремий режим: чернетка порядку, яка НЕ зберігається, доки власник не
  // натисне «Зберегти порядок». Раніше клік по колонці в «Своєму порядку»
  // одразу переставляв прайс для всіх клієнтів - легко було зробити це
  // випадково, бо зовні режими не відрізнялись.
  const [reorderMode, setReorderMode] = useState(false);
  const [draftIds, setDraftIds] = useState<number[]>([]);
  const [dragId, setDragId] = useState<number | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  const startReorder = () => {
    setDraftIds(orderedServices.map(s => Number(s.id)));
    setReorderMode(true);
  };
  const orderChanged = reorderMode && draftIds.join(',') !== orderedServices.map(s => Number(s.id)).join(',');

  const moveDraft = (id: number, delta: number) => {
    setDraftIds(ids => {
      const i = ids.indexOf(id), j = i + delta;
      if (i < 0 || j < 0 || j >= ids.length) return ids;
      const next = [...ids];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };
  const dropDraft = (overId: number) => {
    if (dragId === null || dragId === overId) return;
    setDraftIds(ids => {
      const next = ids.filter(x => x !== dragId);
      next.splice(next.indexOf(overId), 0, dragId);
      return next;
    });
  };
  const presetDraft = (kind: 'name' | 'price' | 'duration') => {
    const byId = new Map(services.map(s => [Number(s.id), s]));
    setDraftIds(ids => [...ids].sort((a, b) => {
      const x = byId.get(a), y = byId.get(b);
      if (kind === 'name') return String(x?.name).localeCompare(String(y?.name), 'uk');
      if (kind === 'price') return Number(x?.price || 0) - Number(y?.price || 0);
      return Number(x?.duration_minutes || 0) - Number(y?.duration_minutes || 0);
    }));
  };
  const saveReorder = async () => {
    setIsSavingOrder(true);
    try {
      const token = await getAuthToken();
      await api.reorderServices(token, Number(business.id), draftIds);
      const pos = new Map(draftIds.map((id, i) => [id, i]));
      setServices(prev => prev.map(s => ({ ...s, order_index: pos.get(Number(s.id)) ?? s.order_index })));
      setReorderMode(false);
      setActiveSort(null);
      showToast('Порядок збережено - так послуги бачать клієнти', 'success');
    } catch {
      showToast('Не вдалося зберегти порядок', 'error');
    } finally {
      setIsSavingOrder(false);
    }
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
          name: `${service.name} (копія)`,
          duration_minutes: service.duration_minutes,
          price: service.price,
          description: service.description,
          category: service.category,
          is_active: false,
          addon_service_ids: service.addon_service_ids || [],
        } as any);
        setServices(prev => [...prev, created]);
        showToast("Копію створено - вона прихована, поки не перевірите", "success");
    } catch (error: any) {
        showToast(error?.message || "Не вдалося здублювати", "error");
    }
  };

  const openServiceModal = (service: any = null, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (service) {
      setEditingService(service);
      // Поля - ТАК, як їх віддає сервер. Раніше форма читала duration й
      // addon_services, яких у відповіді немає: відкрити й зберегти послугу
      // означало тривалість 30 хв і стерті додаткові послуги.
      setServiceForm({
        name: service.name || '', duration: Number(service.duration_minutes) || 60, price: Number(service.price) || 0,
        category: service.category || '', description: service.description || '',
        is_active: service.is_active !== false, addon_services: service.addon_service_ids || []
      });
      setPriceTouched(true);
    } else {
      setEditingService(null);
      setServiceForm({ name: '', duration: 60, price: 0, category: selectedCategory || '', description: '', is_active: true, addon_services: [] });
      setPriceTouched(false);
    }
    setAddonSearch('');
    setIsAddonDropdownOpen(false);
    setIsServiceModalOpen(true);
  };

  const materialsCost = serviceMaterials.reduce((sum, m) => {
    const item = inventoryItems.find((i: any) => i.id === m.inventory_item_id);
    return sum + Number(item?.cost_per_unit || 0) * Number(m.quantity_per_use || 0);
  }, 0);

  useEffect(() => {
    if (!isServiceModalOpen || !business?.id) return;
    void (async () => {
      try {
        const token = await getAuthToken();
        const items = await api.listInventory(token, business.id);
        setInventoryItems(items || []);
        if (editingService?.id) {
          const mats = await api.getServiceMaterials(token, editingService.id);
          setServiceMaterials((mats || []).map((m: any) => ({
            inventory_item_id: m.inventory_item_id,
            quantity_per_use: m.quantity_per_use,
          })));
        } else {
          setServiceMaterials([]);
        }
      } catch {
        setInventoryItems([]);
      }
    })();
  }, [isServiceModalOpen, editingService?.id, business?.id]);

  const handleSaveService = async () => {
    if (!formValid) {
      return showToast("Вкажіть назву (від 2 символів), тривалість і ціну", "error");
    }

    setIsServiceSaving(true);
    try {
      const token = await getAuthToken();

      if (editingService) {
        const updated = await api.updateService(token, editingService.id, {
          name: serviceForm.name.trim(),
          duration_minutes: serviceForm.duration,
          price: serviceForm.price,
          description: serviceForm.description,
          category: serviceForm.category,
          is_active: serviceForm.is_active,
          addon_service_ids: serviceForm.addon_services,
        } as any);
        setServices(prev => prev.map(s => s.id === editingService.id ? updated : s));
        await api.setServiceMaterials(token, editingService.id, serviceMaterials.filter(m => m.quantity_per_use > 0));
        showToast("Послугу оновлено", "success");
      } else {
        const created = await api.createService(token, {
          business_id: business.id,
          name: serviceForm.name.trim(),
          duration_minutes: serviceForm.duration,
          price: serviceForm.price,
          description: serviceForm.description,
          category: serviceForm.category,
          is_active: serviceForm.is_active,
          addon_service_ids: serviceForm.addon_services,
        } as any);
        setServices(prev => [...prev, created]);
        if (serviceMaterials.length > 0) {
          await api.setServiceMaterials(token, created.id, serviceMaterials.filter(m => m.quantity_per_use > 0));
        }
        showToast("Послугу додано", "success");
      }
      setIsServiceModalOpen(false);
    } catch (error: any) {
      showToast(error?.message || "Помилка збереження послуги", "error");
    } finally {
      setIsServiceSaving(false);
    }
  };

  const handleDeleteService = async (id: number, e?: React.MouseEvent, confirmed = false) => {
    if (e) e.stopPropagation();
    // З вікна - уже підтверджено в самій кнопці; зі списку - як раніше.
    if (!confirmed && !confirm("Видалити цю послугу назавжди?")) return;
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

  // Підказка - перевірки саме цього прайсу, від найважливішої.
  // Раніше звалась «AI Insight», хоча це були заготовлені фрази.
  const getSmartAdvice = () => {
    if (!services.length) return { title: 'Прайс порожній', text: 'Додайте послуги - без них клієнти не зможуть записатись онлайн.' };
    const noDesc = services.filter(s => !String(s.description || '').trim()).length;
    const hidden = services.filter(s => s.is_active === false).length;
    const noCat = services.filter(s => !String(s.category || '').trim()).length;
    const noPrice = services.filter(s => !Number(s.price)).length;
    if (noPrice) return { title: `${noPrice} без ціни`, text: 'Послуга за 0 ₴ відлякує: клієнт не розуміє, скільки заплатить. Вкажіть ціну або «від».' };
    if (noDesc) return { title: `${noDesc} без опису`, text: 'Клієнти частіше записуються, коли бачать, що входить у послугу. Додайте короткий опис.' };
    if (services.length > 6 && noCat === services.length) return { title: 'Згрупуйте прайс', text: 'Понад 6 послуг без категорій важко переглядати. Додайте категорії: «Стрижки», «Фарбування».' };
    if (hidden) return { title: `${hidden} прихованих`, text: 'Приховані послуги не видно для онлайн-запису. Перевірте, чи це навмисно.' };
    return { title: 'Прайс у порядку', text: 'Усі послуги мають ціну, опис і доступні для запису.' };
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
        .clean-input:focus { border-color: #436b49; background: #fff; }

        .clean-btn { background: #0f172a; color: #fff; border: none; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; }
        .clean-btn:hover { background: #1e293b; }

        .clean-btn-ghost { background: transparent; color: #64748b; border: 1px solid #e2e8f0; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; }
        .clean-btn-ghost:hover { background: #f8fafc; color: #0f172a; }

        .category-pill { padding: 0.4rem 1.2rem; border-radius: 999px; background: #fff; border: 1px solid #e2e8f0; color: #64748b; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: 0.2s; white-space: nowrap; flex-shrink: 0; }
        .category-pill:hover { background: #f8fafc; color: #0f172a; }
        .category-pill.active { background: #0f172a; color: #fff; border-color: #0f172a; }

        /* Таблиця з м'якими заокругленими рядками без гострих кутів */
        .service-table { 
          width: 100%; 
          border-collapse: separate; 
          border-spacing: 0 4px; 
          text-align: left; 
        }
        .service-table th { 
          padding: 0.75rem 1rem; 
          color: #94a3b8; 
          font-size: 0.7rem; 
          font-weight: 700; 
          text-transform: uppercase; 
          letter-spacing: 0.05em; 
          border-bottom: 1px solid #f1f5f9; 
          position: sticky; 
          top: 0; 
          background: #fff; 
          z-index: 10; 
          transition: color 0.2s; 
        }
        .service-table th.sortable:hover { color: #0f172a; cursor: pointer; }
        
        .service-table td { 
          padding: 0.95rem 1rem; 
          border-bottom: 1px solid #f8fafc; 
          border-top: 1px solid transparent;
          vertical-align: middle; 
          transition: background 0.15s ease; 
        }
        .service-table tr { cursor: pointer; transition: 0.15s; }
        .service-table tr.service-row:hover td { background: #f8fafc; }

        /* Плавні заокруглення лівого та правого краю рядка */
        .service-table tr.service-row td:first-child {
          border-top-left-radius: 12px;
          border-bottom-left-radius: 12px;
          padding-left: 1.25rem;
        }
        .service-table tr.service-row td:last-child {
          border-top-right-radius: 12px;
          border-bottom-right-radius: 12px;
          padding-right: 1.25rem;
        }
        
        .category-header td { 
          color: #94a3b8; 
          font-weight: 700; 
          font-size: 0.75rem; 
          text-transform: uppercase; 
          letter-spacing: 0.06em; 
          padding: 1.6rem 1.25rem 0.5rem 1.25rem; 
          border: none !important; 
          background: transparent !important; 
        }

        .service-row.dragging td { opacity: 0.4; }
        .service-row.drag-over td { border-top: 1px solid #436b49 !important; }
        
        .drag-handle { 
          color: #cbd5e1; 
          display: inline-flex; 
          align-items: center; 
          justify-content: center; 
          transition: 0.2s; 
          opacity: 0.4; 
          cursor: grab; 
        }
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
        .clean-select-dropdown { position: absolute; top: calc(100% + 5px); right: 0; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); z-index: 50; overflow: hidden; animation: slideDown 0.2s ease; min-width: 200px; padding: 0.3rem; }
        .clean-select-option { padding: 0.55rem 0.85rem; font-size: 0.85rem; font-weight: 500; color: #475569; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: 0.2s; border-radius: 6px; }
        .clean-select-option:hover { background: #f8fafc; color: #0f172a; }
        .clean-select-option.selected { color: #0f172a; font-weight: 600; background: #f1f5f9; }

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
            {/* Порядок для клієнтів - окремий режим. Сортування колонок нижче - лише
                для перегляду й нічого не змінює на сторінці салону. */}
            <button type="button" className="clean-btn-ghost" onClick={startReorder} disabled={services.length < 2}
              title="Порядок, у якому клієнти бачать послуги на сторінці салону">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" /></svg>
              Порядок для клієнтів
            </button>

            <div style={{ width: '1px', height: '16px', background: '#e2e8f0', margin: '0 0.2rem' }}></div>

            <button onClick={() => openServiceModal()} className="clean-btn">
               <Icons.Plus /> Додати
            </button>
         </div>
      </div>

      {/* ФІЛЬТР КАТЕГОРІЙ */}
      {!reorderMode && uniqueCategories.length > 0 && (
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', flex: 1, overflow: 'hidden' }}>

        <div className="custom-scroll" style={{ overflowY: 'auto', borderRight: '1px solid #f1f5f9', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: '1200px', padding: '0 1.25rem' }}>
              {reorderMode ? (
                <div className="ro">
                  <div className="ro-banner">
                    <div>
                      <b>Порядок на сторінці салону</b>
                      <span>Перетягніть послуги або скористайтесь стрілками. Клієнти побачать зміни лише після збереження.</span>
                    </div>
                    <div className="ro-actions">
                      <button type="button" className="clean-btn-ghost" onClick={() => setReorderMode(false)} disabled={isSavingOrder}>Скасувати</button>
                      <button type="button" className="clean-btn" onClick={() => void saveReorder()} disabled={!orderChanged || isSavingOrder}>
                        {isSavingOrder ? 'Зберігаємо…' : 'Зберегти порядок'}
                      </button>
                    </div>
                  </div>
                  <div className="ro-presets">
                    <span>Швидко впорядкувати:</span>
                    <button type="button" onClick={() => presetDraft('name')}>За назвою</button>
                    <button type="button" onClick={() => presetDraft('price')}>Дешевші спершу</button>
                    <button type="button" onClick={() => presetDraft('duration')}>Коротші спершу</button>
                  </div>
                  <ol className="ro-list">
                    {draftIds.map((id, i) => {
                      const s = services.find(x => Number(x.id) === id);
                      if (!s) return null;
                      return (
                        <li key={id} draggable className={dragId === id ? 'dragging' : ''}
                          onDragStart={() => setDragId(id)} onDragOver={e => { e.preventDefault(); dropDraft(id); }} onDragEnd={() => setDragId(null)}>
                          <span className="ro-grip" aria-hidden><GripDotsIcon /></span>
                          <span className="ro-num">{i + 1}</span>
                          <span className="ro-name">
                            <b>{s.name}</b>
                            <small>{s.category || 'Без категорії'} · {formatDuration(s.duration_minutes)}{s.is_active === false ? ' · прихована' : ''}</small>
                          </span>
                          <span className="ro-price">{Number(s.price).toLocaleString('uk-UA')} ₴</span>
                          <span className="ro-arrows">
                            <button type="button" aria-label="Вище" disabled={i === 0} onClick={() => moveDraft(id, -1)}>↑</button>
                            <button type="button" aria-label="Нижче" disabled={i === draftIds.length - 1} onClick={() => moveDraft(id, 1)}>↓</button>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              ) : (
              <>
              {activeSort && (
                <div className="svc-sortnote">
                  <span>Відсортовано за {SORT_LABEL[activeSort.column]} - <b>лише для вас</b>. Клієнти бачать послуги у вашому порядку.</span>
                  <button type="button" onClick={() => setActiveSort(null)}>Скинути</button>
                </div>
              )}
              {displayedServices.length > 0 ? (
                 <table className="service-table">
                    <thead>
                       <tr>

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
                          <th style={{ width: '100px', textAlign: 'right', paddingRight: '1.25rem' }}>Дії</th>
                       </tr>
                    </thead>
                    <tbody>
                       {Object.keys(groupedServices).map(category => (
                          <React.Fragment key={category}>
                             {!selectedCategory && (
                               <tr className="category-header">
                                  <td colSpan={5}>{category}</td>
                               </tr>
                             )}
                             {groupedServices[category].map(service => {
                                // addon_service_ids - так поле зветься на сервері; раніше перевірялось
                                // addon_services, і значок додаткових не показувався ніколи.
                                const hasAddons = (service.addon_service_ids || []).length > 0;

                                return (
                                   <tr
                                      key={service.id}
                                      className="service-row"
                                      onClick={() => openServiceModal(service)}
                                   >
                                      <td>
                                         <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                              <span style={{ fontWeight: '600', color: service.is_active === false ? '#94a3b8' : '#0f172a', fontSize: '0.98rem' }}>
                                                 {service.name}
                                              </span>
                                              {hasAddons && (
                                                <span style={{ background: '#f5f3ff', color: '#7c3aed', padding: '2px 7px', borderRadius: '5px', fontSize: '0.7rem', fontWeight: '700' }}>
                                                  +{(service.addon_service_ids || []).length} додатково
                                                </span>
                                              )}
                                            </div>
                                            {service.description && (
                                               <span style={{ color: '#94a3b8', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '340px' }}>
                                                  {service.description}
                                               </span>
                                            )}
                                         </div>
                                      </td>
                                      <td style={{ color: '#64748b', fontSize: '0.92rem', fontWeight: '500' }}>
                                         {formatDuration(service.duration_minutes)}
                                      </td>
                                      <td style={{ color: '#0f172a', fontSize: '0.98rem', fontWeight: '700' }}>
                                         {service.price} ₴
                                      </td>
                                      <td>
                                         <div onClick={(e) => handleToggleActive(service, e)} className={`apple-switch ${service.is_active !== false ? 'on' : ''}`}>
                                            <div className="apple-switch-knob"></div>
                                         </div>
                                      </td>
                                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
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
              </>
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
                    <Icons.Sparkles width="14" height="14" /> Підказка
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

        </div>
      </div>

      {/* --- МОДАЛЬНЕ ВІКНО ПОСЛУГИ --- */}
      {/* Вікно послуги - єдиний шаблон FormModal (components/ui/FormModal) */}
      <FormModal
        open={isServiceModalOpen}
        onClose={() => setIsServiceModalOpen(false)}
        title={editingService ? 'Редагувати послугу' : 'Нова послуга'}
        subtitle={editingService ? `${editingService.name} · ${formatDuration(editingService.duration_minutes)} · ${Number(editingService.price).toLocaleString('uk-UA')} ₴` : 'Клієнти побачать її на сторінці закладу'}
        primary={{ label: editingService ? 'Зберегти' : 'Додати послугу', onClick: () => void handleSaveService(), loading: isServiceSaving, disabled: !formValid }}
        danger={editingService ? { label: 'Видалити послугу', confirmLabel: 'Видалити назавжди?', onClick: () => void handleDeleteService(editingService.id, undefined, true) } : undefined}
      >
        <FormSection>
          <Field label="Назва" required error={serviceForm.name && serviceForm.name.trim().length < 2 ? 'Щонайменше 2 символи' : undefined}>
            <input className="fm-input" value={serviceForm.name} maxLength={80} autoFocus placeholder="Напр., Чоловіча стрижка"
              onChange={e => setServiceForm({ ...serviceForm, name: e.target.value })} />
          </Field>
          <Field label="Категорія" hint={existingCategories.length ? 'Оберіть наявну або впишіть нову' : 'Група в прайсі: «Стрижки», «Фарбування»'}>
            <input className="fm-input" value={serviceForm.category} maxLength={60} placeholder="Напр., Стрижки"
              onChange={e => setServiceForm({ ...serviceForm, category: e.target.value })} />
          </Field>
          {existingCategories.length > 0 && (
            <div className="fm-chips" style={{ marginTop: '-0.35rem' }}>
              {existingCategories.map(cat => (
                <button key={cat} type="button" className={`fm-chip ${serviceForm.category.trim() === cat ? 'on' : ''}`}
                  onClick={() => setServiceForm({ ...serviceForm, category: serviceForm.category.trim() === cat ? '' : cat })}>
                  {cat}
                </button>
              ))}
            </div>
          )}
        </FormSection>

        <FormSection title="Тривалість" hint="Скільки часу займає послуга - стільки й буде зайнято в календарі.">
          <DurationPicker value={serviceForm.duration} onChange={v => setServiceForm({ ...serviceForm, duration: v })} />
        </FormSection>

        <FormSection title="Ціна й видимість">
          <div className="fm-row">
            <Field label="Ціна" required>
              <span className="fm-affix">
                <input className="fm-input" type="text" inputMode="numeric" value={serviceForm.price === 0 && !priceTouched ? '' : String(serviceForm.price)}
                  placeholder="0" onChange={e => { const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 7); setPriceTouched(true); setServiceForm({ ...serviceForm, price: v ? Number(v) : 0 }); }} />
                <span>₴</span>
              </span>
            </Field>
            <Field label="Клієнти бачать послугу" hint={serviceForm.is_active ? 'Доступна для онлайн-запису' : 'Прихована - лише для запису з кабінету'}>
              <span className="svc-seg">
                <button type="button" className={serviceForm.is_active ? 'on' : ''} onClick={() => setServiceForm({ ...serviceForm, is_active: true })}>Так</button>
                <button type="button" className={!serviceForm.is_active ? 'on' : ''} onClick={() => setServiceForm({ ...serviceForm, is_active: false })}>Приховано</button>
              </span>
            </Field>
          </div>
        </FormSection>

        <FormSection title="Опис" hint="Що входить у послугу - клієнти бачать це під назвою.">
          <textarea className="fm-input" maxLength={500} value={serviceForm.description} placeholder="Напр., стрижка машинкою й ножицями, миття голови, укладка"
            onChange={e => setServiceForm({ ...serviceForm, description: e.target.value })} />
          <div className="fm-counter">{serviceForm.description.length} / 500</div>
        </FormSection>

        {services.filter(s => s.id !== editingService?.id).length > 0 && (
          <FormDisclosure
            title="Пропонувати додатково"
            summary={serviceForm.addon_services.length ? `Обрано: ${selectedAddons.map(a => a.name).join(', ')}` : 'Клієнт побачить їх як доповнення під час запису'}
            defaultOpen={serviceForm.addon_services.length > 0}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>}
          >
            <div ref={addonDropdownRef} style={{ position: 'relative' }}>
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
          </FormDisclosure>
        )}

        <FormDisclosure
          title="Матеріали зі складу"
          summary={serviceMaterials.length
            ? `${serviceMaterials.length} ${serviceMaterials.length === 1 ? 'матеріал' : serviceMaterials.length < 5 ? 'матеріали' : 'матеріалів'}${materialsCost > 0 ? ` · собівартість ${materialsCost.toLocaleString('uk-UA')} ₴` : ''}`
            : 'Списуються автоматично, коли візит позначають завершеним'}
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></svg>}
        >
                {inventoryItems.length === 0 ? (
                  <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '10px', fontSize: '0.85rem', color: '#64748b', textAlign: 'center' }}>
                    Спочатку додайте позиції у вкладці «Склад і Витрати».
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {inventoryItems.map((item: any) => {
                      const linked = serviceMaterials.find(m => m.inventory_item_id === item.id);
                      return (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.6rem 0.9rem', background: linked ? '#f0f9ff' : '#fff', border: `1px solid ${linked ? '#bae6fd' : '#e2e8f0'}`, borderRadius: '10px' }}>
                          <input
                            type="checkbox"
                            className="fm-check"
                            checked={Boolean(linked)}
                            onChange={e => {
                              setServiceMaterials(prev => e.target.checked
                                ? [...prev, { inventory_item_id: item.id, quantity_per_use: 1 }]
                                : prev.filter(m => m.inventory_item_id !== item.id));
                            }}
                            style={{ width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0 }}
                          />
                          <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 500, color: '#0f172a' }}>
                            {item.name}
                            <span style={{ color: '#94a3b8', fontWeight: 400 }}> · залишок {Number(item.quantity).toLocaleString('uk-UA')} {item.unit}</span>
                          </span>
                          {linked && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                              <input
                                type="text"
                                inputMode="decimal"
                                className="fm-input"
                                value={linked.quantity_per_use}
                                onChange={e => {
                                  const val = Number(e.target.value.replace(',', '.').replace(/[^0-9.]/g, '')) || 0;
                                  setServiceMaterials(prev => prev.map(m =>
                                    m.inventory_item_id === item.id ? { ...m, quantity_per_use: val } : m));
                                }}
                                style={{ width: 84, height: 34, textAlign: 'right' }}
                              />
                              <span style={{ fontSize: '0.85rem', color: '#64748b', minWidth: '30px' }}>{item.unit}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
        </FormDisclosure>
      </FormModal>

      <style jsx>{`
        .svc-sortnote { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.65rem 0.9rem; margin-bottom: 0.75rem; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 0.85rem; color: #475569; }
        .svc-sortnote b { color: #0f172a; }
        .svc-sortnote button { border: none; background: none; font-family: inherit; font-size: 0.85rem; font-weight: 600; color: #0f172a; cursor: pointer; white-space: nowrap; }
        .ro-banner { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 1rem 1.2rem; border-radius: 14px; background: #eef6ef; border: 1px solid #cfe3d1; flex-wrap: wrap; }
        .ro-banner b { display: block; font-size: 0.975rem; color: #0f172a; }
        .ro-banner span { display: block; font-size: 0.85rem; color: #3f5f45; margin-top: 2px; }
        .ro-actions { display: flex; gap: 0.5rem; }
        .ro-presets { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; margin: 0.9rem 0 0.6rem; font-size: 0.8rem; color: #64748b; }
        .ro-presets button { height: 30px; padding: 0 0.8rem; border-radius: 999px; border: 1px solid #e2e8f0; background: #fff; font-family: inherit; font-size: 0.8rem; color: #0f172a; cursor: pointer; }
        .ro-presets button:hover { background: #f8fafc; }
        .ro-list { list-style: none; margin: 0; padding: 0; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background: #fff; }
        .ro-list li { display: grid; grid-template-columns: 22px 28px 1fr auto auto; align-items: center; gap: 0.75rem; padding: 0.7rem 1rem; border-top: 1px solid #f1f5f9; cursor: grab; background: #fff; transition: background-color .15s; }
        .ro-list li:first-child { border-top: none; }
        .ro-list li:hover { background: #f8fafc; }
        .ro-list li.dragging { opacity: .5; background: #eef6ef; }
        .ro-grip { color: #94a3b8; display: flex; }
        .ro-num { font-size: 0.8rem; font-weight: 700; color: #94a3b8; font-variant-numeric: tabular-nums; }
        .ro-name b { display: block; font-size: 0.9rem; color: #0f172a; font-weight: 600; }
        .ro-name small { display: block; font-size: 0.78rem; color: #64748b; margin-top: 1px; }
        .ro-price { font-size: 0.9rem; font-weight: 600; color: #0f172a; font-variant-numeric: tabular-nums; }
        .ro-arrows { display: flex; gap: 0.25rem; }
        .ro-arrows button { width: 30px; height: 30px; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff; cursor: pointer; font-size: 0.9rem; color: #0f172a; }
        .ro-arrows button:hover:not(:disabled) { background: #f1f5f9; }
        .ro-arrows button:disabled { color: #cbd5e1; cursor: default; }
        .svc-seg { display: flex; background: #f1f5f9; border-radius: 10px; padding: 3px; height: 42px; box-sizing: border-box; }
        .svc-seg button { flex: 1; border: none; background: transparent; border-radius: 8px; font-family: inherit; font-size: 0.875rem; color: #0f172a; cursor: pointer; }
        .svc-seg button.on { background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.1); font-weight: 600; }
      `}</style>

      {/* ТОСТИ */}

    </div>
  );
}