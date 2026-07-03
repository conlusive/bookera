'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';

const Icons = {
  SidebarToggle: ({ collapsed }: { collapsed: boolean }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      {collapsed ? <polyline points="11 8 15 12 11 16"></polyline> : <polyline points="13 8 9 12 13 16"></polyline>}
    </svg>
  ),
  Storefront: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>,
  Calendar: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>,
  Stats: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>,
  Clients: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
  Services: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>,
  Team: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
  Marketing: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
  ChevronDown: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>,
  ChevronUp: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>,
  ChevronLeft: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>,
  ChevronRight: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>,
  Settings: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>,
  LogOut: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>,
  CreditCard: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>,
  Globe: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>,
  Box: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>,
  User: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
  Edit: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>,
  Camera: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>,
  Image: () => <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>,
  Clock: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>,
  MapPin: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>,
  MapPinBig: () => <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>,
  Plus: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
  Trash: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>,
  Grip: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>,
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  Sparkles: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path><path d="M5 3v4"></path><path d="M19 17v4"></path><path d="M3 5h4"></path><path d="M17 19h4"></path></svg>,
  TrendingUp: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>,
  TrendingDown: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"></polyline><polyline points="16 17 22 17 22 11"></polyline></svg>,
  SortAlpha: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 10v-5.5a2.5 2.5 0 0 0-5 0v5.5"></path><path d="M10 8h5"></path><path d="M15 20v-5.5a2.5 2.5 0 0 0-5 0v5.5"></path><path d="M10 18h5"></path><path d="M4 6h4"></path><path d="M4 18h4"></path><path d="M6 4v16"></path></svg>,
  Filter: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
};

// Мокові дані для Журналу записів (щоб показати дизайн)
const mockAppointments = [
  { id: 1, client: 'Олександр В.', service: 'Чоловіча стрижка', startHour: 10, startMin: 0, duration: 60, master: 'Яміло', color: '#e0e7ff', textColor: '#3730a3', status: 'Підтверджено' },
  { id: 2, client: 'Максим С.', service: 'Моделювання бороди', startHour: 12, startMin: 30, duration: 45, master: 'Луїс', color: '#fef3c7', textColor: '#b45309', status: 'Очікує' },
  { id: 3, client: 'Іван К.', service: 'Комплекс', startHour: 15, startMin: 0, duration: 90, master: 'Яміло', color: '#dcfce7', textColor: '#047857', status: 'Оплачено' }
];

export default function BusinessCabinet() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);

  const [services, setServices] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [gallery, setGallery] = useState<string[]>([]);

  const [formData, setFormData] = useState({ name: '', category: '', address: '', description: '' });
  const [isSaving, setIsSaving] = useState(false);

  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [serviceForm, setServiceForm] = useState({ name: '', duration: 30, price: 0 });
  const [isServiceSaving, setIsServiceSaving] = useState(false);

  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [serviceSortType, setServiceSortType] = useState('custom');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isInsightOpen, setIsInsightOpen] = useState(false);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [activeTab, setActiveTab] = useState('Calendar');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const navItems = [
    { id: 'Calendar', label: 'Журнал записів', icon: Icons.Calendar },
    { id: 'Clients', label: 'Клієнтська база', icon: Icons.Clients },
    { id: 'Stats', label: 'Статистика та звіти', icon: Icons.Stats },
    { id: 'Team', label: 'Персонал', icon: Icons.Team },
    { id: 'Services', label: 'Послуги', icon: Icons.Services },
    { id: 'Storefront', label: 'Профіль закладу', icon: Icons.Storefront },
    { id: 'Marketing', label: 'Маркетинг', icon: Icons.Marketing },
    { id: 'Settings', label: 'Налаштування', icon: Icons.Settings },
  ];

  const popularTags = ["Стрижка", "Борода", "Комплекс", "Брови"];
  const sortOptions = [
    { value: 'custom', label: 'Свій порядок (Вручну)', icon: <Icons.Grip /> },
    { value: 'priceAsc', label: 'Від найдешевших', icon: <Icons.TrendingUp /> },
    { value: 'priceDesc', label: 'Від найдорожчих', icon: <Icons.TrendingDown /> },
    { value: 'nameAsc', label: 'За алфавітом (А-Я)', icon: <Icons.SortAlpha /> },
  ];

  const businessSettingsCards = [
    { id: 'payments', title: 'Платежі та каса', desc: 'Налаштуйте методи оплати, перевірте рахунки.', icon: Icons.CreditCard },
    { id: 'details', title: 'Деталі бізнесу', desc: 'Редагуйте інформацію про заклад, локацію та правила.', icon: Icons.Storefront },
    { id: 'services', title: 'Налаштування послуг', desc: 'Додайте деталі послуг та згрупуйте їх.', icon: Icons.Services },
    { id: 'advanced', title: 'Додаткові опції', desc: 'Доступ до налаштувань бронювання та сповіщень.', icon: Icons.Settings },
    { id: 'billing', title: 'Підписка та білінг', desc: 'Деталі оплати, підписка та методи оплати.', icon: Icons.Calendar },
    { id: 'booking', title: 'Онлайн бронювання', desc: 'Вирішіть, які опції будуть доступні клієнтам.', icon: Icons.Globe },
    { id: 'inventory', title: 'Склад', desc: 'Налаштуйте інвентар для відстеження товарів.', icon: Icons.Box },
  ];

  useEffect(() => {
    async function loadCabinetData() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) return router.push('/business');

        const userId = session.user.id;
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
        setUserProfile(profile || { full_name: session.user.email });

        const { data: bizData } = await supabase.from('businesses').select('*').eq('owner_id', userId).limit(1).single();

        if (bizData) {
          setBusiness(bizData);
          setFormData({
            name: bizData.name || '',
            category: bizData.category || '',
            address: bizData.address || '',
            description: bizData.description || '',
          });
          setGallery(bizData.photos || []);

          const { data: srvs } = await supabase.from('services').select('*').eq('business_id', bizData.id).order('id', { ascending: true });
          setServices(srvs || []);

          const { data: masters } = await supabase.from('masters').select('*').eq('business_id', bizData.id);
          setTeam(masters || []);
        }
      } catch (error) {
        console.error("Помилка завантаження даних:", error);
      } finally {
        setLoading(false);
      }
    }
    loadCabinetData();
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [formData.description, activeTab]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setIsSortDropdownOpen(false);
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveBusinessInfo = async () => {
    if (!business) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('businesses').update({
        name: formData.name, category: formData.category, address: formData.address, description: formData.description,
      }).eq('id', business.id);
      if (error) throw error;
      setBusiness({ ...business, ...formData });
      alert("Дані успішно збережено!");
    } catch (error) {
      console.error(error);
      alert("Помилка при збереженні.");
    } finally {
      setIsSaving(false);
    }
  };

  const openServiceModal = (service: any = null) => {
    if (service) {
      setEditingService(service);
      setServiceForm({ name: service.name, duration: service.duration, price: service.price });
    } else {
      setEditingService(null);
      setServiceForm({ name: '', duration: 30, price: 0 });
    }
    setIsServiceModalOpen(true);
  };

  const handleSaveService = async () => {
    if (!serviceForm.name || serviceForm.price < 0 || serviceForm.duration <= 0) return alert("Будь ласка, заповніть всі поля коректно.");
    setIsServiceSaving(true);
    try {
      if (editingService) {
        const { data, error } = await supabase.from('services').update(serviceForm).eq('id', editingService.id).select().single();
        if (error) throw error;
        setServices(prev => prev.map(s => s.id === editingService.id ? data : s));
      } else {
        const { data, error } = await supabase.from('services').insert({ ...serviceForm, business_id: business.id }).select().single();
        if (error) throw error;
        setServices(prev => [...prev, data]);
      }
      setIsServiceModalOpen(false);
    } catch (error) {
      console.error(error);
      alert("Помилка збереження послуги.");
    } finally {
      setIsServiceSaving(false);
    }
  };

  const handleDeleteService = async (id: number) => {
    if (!confirm("Ви впевнені, що хочете видалити цю послугу?")) return;
    try {
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (error) throw error;
      setServices(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      console.error(error);
    }
  };

  const getSmartAdvice = () => {
    if (services.length === 0) return { title: "З чого почати?", text: "Додайте 3-4 базові послуги (наприклад, чоловіча стрижка, моделювання бороди), щоб клієнти могли почати записуватись до вас." };
    const avgPrice = services.reduce((acc, s) => acc + s.price, 0) / services.length;
    if (services.length < 3) return { title: "Більше вибору", text: "У вас мало послуг. Додайте супутні сервіси (миття голови, камуфляж), щоб стимулювати додаткові продажі." };
    if (avgPrice < 400) return { title: "Підвищення чеку", text: "Ваш середній чек виглядає низьким. Спробуйте додати преміум-комплекс (наприклад, 'VIP Стрижка + Борода') за вищою ціною." };
    return { title: "Ідеальний баланс", text: "Ваш прайс-лист виглядає чудово! Слідкуйте за аналітикою, щоб виявити наймаржинальніші послуги." };
  };

  const getSortedServices = () => {
    let result = [...services];
    if (serviceSortType === 'priceAsc') result.sort((a, b) => a.price - b.price);
    if (serviceSortType === 'priceDesc') result.sort((a, b) => b.price - a.price);
    if (serviceSortType === 'nameAsc') result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  };

  const getDisplayedServicesForAdmin = () => {
    let result = getSortedServices();
    if (serviceSearchQuery) {
      result = result.filter(s => s.name.toLowerCase().includes(serviceSearchQuery.toLowerCase()));
    }
    return result;
  };

  const handleDragStart = (e: React.DragEvent, id: number) => {
    if (serviceSortType !== 'custom' || serviceSearchQuery) return;
    const index = services.findIndex(s => s.id === id);
    setDraggedIndex(index);
  };

  const handleDragEnter = (e: React.DragEvent, id: number) => {
    if (serviceSortType !== 'custom' || serviceSearchQuery) return;
    e.preventDefault();
    const index = services.findIndex(s => s.id === id);
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const newServices = [...services];
      const [draggedItem] = newServices.splice(draggedIndex, 1);
      newServices.splice(dragOverIndex, 0, draggedItem);
      setServices(newServices);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const getUserInitials = (name: string) => {
    if (!name) return 'В';
    const parts = name.split(' ');
    return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0][0].toUpperCase();
  };

  const getPageHeader = () => {
    if (activeTab === 'Settings') return { title: 'Налаштування', desc: 'Керування параметрами та даними вашого бізнесу' };
    if (activeTab === 'Storefront') return { title: 'Редактор профілю закладу', desc: 'Редагуйте інформацію прямо тут. Зміни відобразяться на сторінці вашого закладу.' };
    if (activeTab === 'Stats') return { title: 'Статистика та звіти', desc: 'Детальна аналітика роботи вашого бізнесу.' };
    if (activeTab === 'Services') return { title: 'Прайс-лист послуг', desc: 'Керуйте своїми послугами, цінами та порядком відображення.' };
    if (activeTab === 'Calendar') return { title: 'Журнал записів', desc: 'Керуйте розкладом та переглядайте майбутні візити клієнтів.' };
    return { title: navItems.find(item => item.id === activeTab)?.label || '', desc: `Керування даними закладу "${business?.name}"` };
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0e0e11' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #1f2128', borderTopColor: '#c5a880', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
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
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background-color: #272a30; border-radius: 10px; }
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

        .modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15,23,42,0.4); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 1000; }
        .modal-content { background: #fff; width: 100%; max-width: 450px; border-radius: 20px; padding: 2rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
        .modal-input { width: 100%; padding: 0.8rem 1rem; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 0.95rem; outline: none; transition: 0.2s; background: #fff; color: #0f172a; }
        .modal-input:focus { border-color: #0f172a; box-shadow: 0 0 0 2px rgba(15,23,42,0.1); }
        .modal-label { display: block; font-size: 0.85rem; font-weight: 700; color: #475569; margin-bottom: 0.4rem; }

        /* Стилі для Календаря */
        .cal-sidebar { width: 280px; display: flex; flexDirection: column; gap: 1.5rem; flexShrink: 0; }
        .cal-mini-day { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; border-radius: 50%; cursor: pointer; transition: 0.2s; color: #475569; }
        .cal-mini-day:hover { background: #f1f5f9; }
        .cal-mini-day.selected { background: #0f172a; color: #fff; font-weight: 700; }
        .cal-grid-row { display: flex; border-bottom: 1px dashed #e2e8f0; position: relative; }
        .cal-time-col { width: 60px; padding: 0.5rem; font-size: 0.8rem; color: #94a3b8; font-weight: 500; text-align: right; border-right: 1px solid #e2e8f0; }
        .cal-app-card { position: absolute; left: 70px; right: 20px; border-radius: 8px; padding: 0.5rem 0.75rem; border-left: 4px solid; box-shadow: 0 2px 4px rgba(0,0,0,0.05); font-size: 0.85rem; overflow: hidden; cursor: pointer; transition: 0.2s; }
        .cal-app-card:hover { transform: translateX(2px); box-shadow: 0 4px 6px rgba(0,0,0,0.08); }
        .fab-button { position: fixed; bottom: 2rem; right: 3rem; width: 60px; height: 60px; border-radius: 50%; background: #0f172a; color: #fff; border: none; box-shadow: 0 10px 20px rgba(15,23,42,0.3); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.3s; }
        .fab-button:hover { transform: translateY(-4px); box-shadow: 0 15px 25px rgba(15,23,42,0.4); }
      `}</style>

      {/* 🔴 САЙДБАР */}
      <aside style={{ width: isSidebarCollapsed ? '80px' : '280px', backgroundColor: '#0e0e11', borderRight: '1px solid #1f2128', display: 'flex', flexDirection: 'column', flexShrink: 0, transition: 'width 0.4s cubic-bezier(0.25, 1, 0.5, 1)' }}>
        <div style={{ padding: '1.5rem 1rem', display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'space-between', minHeight: '76px' }}>
          <div style={{ opacity: isSidebarCollapsed ? 0 : 1, width: isSidebarCollapsed ? 0 : 'auto', overflow: 'hidden', transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)', whiteSpace: 'nowrap' }}>
            <span style={{ color: '#8b8d98', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase', marginLeft: '0.5rem' }}>Панель керування</span>
          </div>
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem', borderRadius: '8px', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
            <Icons.SidebarToggle collapsed={isSidebarCollapsed} />
          </button>
        </div>

        <div style={{ padding: isSidebarCollapsed ? '0 0.5rem' : '0 1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#1a1c23', border: '1px solid #272a30', borderRadius: '10px', padding: isSidebarCollapsed ? '0.6rem 0' : '0.6rem 0.8rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'space-between', cursor: 'pointer', transition: 'background-color 0.2s, padding 0.3s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#1f2128'} onMouseOut={e => e.currentTarget.style.backgroundColor = '#1a1c23'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isSidebarCollapsed ? '0' : '0.75rem', justifyContent: 'center' }}>
              <div style={{ flexShrink: 0, width: '26px', height: '26px', borderRadius: '6px', backgroundColor: '#272a30', color: '#a1a1aa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: '700' }}>
                {business.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', opacity: isSidebarCollapsed ? 0 : 1, width: isSidebarCollapsed ? 0 : '120px', transform: isSidebarCollapsed ? 'translateX(-10px)' : 'translateX(0)', transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)' }}>
                <span style={{ color: '#ffffff', fontSize: '0.95rem', fontWeight: '600' }}>{business.name}</span>
              </div>
            </div>
            <div style={{ color: '#a1a1aa', flexShrink: 0, opacity: isSidebarCollapsed ? 0 : 1, width: isSidebarCollapsed ? 0 : 'auto', overflow: 'hidden', transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)' }}>
              <Icons.ChevronDown />
            </div>
          </div>
        </div>

        <nav className="custom-scroll" style={{ flex: 1, overflowY: 'auto', padding: isSidebarCollapsed ? '0 0.5rem' : '0 1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {navItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => setActiveTab(item.id)} title={isSidebarCollapsed ? item.label : ''} style={{ display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start', width: '100%', padding: isSidebarCollapsed ? '0.75rem 0' : '0.75rem 1rem', backgroundColor: isActive ? 'rgba(255,255,255,0.04)' : 'transparent', border: 'none', borderRadius: '10px', cursor: 'pointer', position: 'relative', color: isActive ? '#ffffff' : '#8b8d98', transition: 'background-color 0.2s ease, color 0.2s ease, padding 0.3s', textAlign: 'left' }} onMouseOver={e => { if (!isActive) e.currentTarget.style.color = '#ffffff'; }} onMouseOut={e => { if (!isActive) e.currentTarget.style.color = '#8b8d98'; }}>
                <div style={{ flexShrink: 0, color: isActive ? '#ffffff' : '#8b8d98', display: 'flex', transition: '0.2s' }}>
                  <item.icon />
                </div>
                <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', opacity: isSidebarCollapsed ? 0 : 1, width: isSidebarCollapsed ? 0 : '100%', marginLeft: isSidebarCollapsed ? 0 : '1rem', transform: isSidebarCollapsed ? 'translateX(-10px)' : 'translateX(0)', transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: isActive ? '600' : '500' }}>{item.label}</span>
                </div>
                {isActive && <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', width: '4px', height: '60%', borderRadius: '4px 0 0 4px', backgroundColor: '#ffffff', boxShadow: '-2px 0 10px rgba(255, 255, 255, 0.3)' }}></div>}
              </button>
            );
          })}
        </nav>

        <div style={{ position: 'relative' }} ref={profileMenuRef}>
          <div onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)} style={{ padding: isSidebarCollapsed ? '1.25rem 0' : '1.25rem 1.5rem', borderTop: '1px solid #1f2128', display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start', gap: isSidebarCollapsed ? '0' : '0.85rem', cursor: 'pointer', transition: 'background-color 0.2s, padding 0.3s', backgroundColor: isProfileMenuOpen ? '#1a1c23' : 'transparent' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#1a1c23'} onMouseOut={e => { if(!isProfileMenuOpen) e.currentTarget.style.backgroundColor = 'transparent' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#272a30', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.9rem', flexShrink: 0 }}>
              {getUserInitials(userProfile?.full_name)}
            </div>
            <div style={{ flex: isSidebarCollapsed ? 'none' : 1, overflow: 'hidden', opacity: isSidebarCollapsed ? 0 : 1, width: isSidebarCollapsed ? 0 : '100%', transform: isSidebarCollapsed ? 'translateX(-10px)' : 'translateX(0)', transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)' }}>
              <div style={{ color: '#ffffff', fontSize: '0.95rem', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userProfile?.full_name || 'Користувач'}</div>
              <div style={{ color: '#8b8d98', fontSize: '0.8rem', fontWeight: '500', whiteSpace: 'nowrap' }}>{userProfile?.role === 'vendor' ? 'Власник бізнесу' : 'Майстер'}</div>
            </div>
          </div>
          {isProfileMenuOpen && (
            <div className="menu-popup" style={{ position: 'absolute', bottom: '100%', left: isSidebarCollapsed ? '0.5rem' : '1rem', right: isSidebarCollapsed ? 'auto' : '1rem', marginBottom: '0.5rem', width: isSidebarCollapsed ? '200px' : 'auto', backgroundColor: '#1a1c23', border: '1px solid #272a30', borderRadius: '12px', padding: '0.4rem', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 50 }}>
              <button onClick={() => router.push('/profile')} style={{ width: '100%', padding: '0.6rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'transparent', border: 'none', color: '#e4e4e7', fontSize: '0.9rem', cursor: 'pointer', borderRadius: '8px', transition: '0.2s', textAlign: 'left' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#272a30'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}><Icons.User /> Налаштування акаунту</button>
              <div style={{ height: '1px', backgroundColor: '#272a30', margin: '0.3rem 0' }}></div>
              <button onClick={handleLogout} style={{ width: '100%', padding: '0.6rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'transparent', border: 'none', color: '#f87171', fontSize: '0.9rem', cursor: 'pointer', borderRadius: '8px', transition: '0.2s', textAlign: 'left' }} onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(248, 113, 113, 0.1)'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}><Icons.LogOut /> Вийти з системи</button>
            </div>
          )}
        </div>
      </aside>

      {/* 🔴 ГОЛОВНА РОБОЧА ЗОНА */}
      <main className="custom-scroll" style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', overflowY: 'auto', position: 'relative' }}>

        {/* Хедер - показуємо тільки якщо це не Календар (календар має свій) */}
        {activeTab !== 'Calendar' && (
          <header style={{ padding: '2rem 3rem 1.5rem 3rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff' }}>
            <div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>{getPageHeader().title}</h1>
              <p style={{ color: '#64748b', fontSize: '0.95rem', margin: '0.25rem 0 0 0' }}>{getPageHeader().desc}</p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              {activeTab === 'Storefront' && (
                <>
                  <button
                    onClick={() => router.push(`/salon/${business.id}`)}
                    style={{ padding: '0.6rem 1.25rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: '600', color: '#0f172a', cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    onMouseOver={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                    onMouseOut={e => e.currentTarget.style.backgroundColor = '#ffffff'}
                  >
                    <Icons.Globe /> Переглянути як клієнт
                  </button>

                  <button
                    onClick={handleSaveBusinessInfo}
                    disabled={isSaving}
                    style={{ padding: '0.6rem 1.25rem', backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', fontWeight: '600', color: '#ffffff', cursor: isSaving ? 'not-allowed' : 'pointer', transition: '0.2s', opacity: isSaving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    onMouseOver={e => { if(!isSaving) e.currentTarget.style.backgroundColor = '#1e293b' }}
                    onMouseOut={e => { if(!isSaving) e.currentTarget.style.backgroundColor = '#0f172a' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    {isSaving ? 'Збереження...' : 'Зберегти зміни'}
                  </button>
                </>
              )}

              {activeTab === 'Services' && (
                <button
                  onClick={() => openServiceModal()}
                  style={{ padding: '0.6rem 1.25rem', backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', fontWeight: '600', color: '#ffffff', cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  onMouseOver={e => e.currentTarget.style.backgroundColor = '#1e293b'}
                  onMouseOut={e => e.currentTarget.style.backgroundColor = '#0f172a'}
                >
                  <Icons.Plus /> Додати послугу
                </button>
              )}
            </div>
          </header>
        )}

        {/* --- 0. ЖУРНАЛ ЗАПИСІВ (КАЛЕНДАР) --- */}
        {activeTab === 'Calendar' ? (
          <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>

            {/* Ліва панель: Міні-календар та фільтри */}
            <div className="custom-scroll" style={{ width: '320px', borderRight: '1px solid #e2e8f0', backgroundColor: '#ffffff', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', overflowY: 'auto' }}>

              {/* Міні-календар */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '1.05rem' }}>Липень 2026</div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="action-icon-btn"><Icons.ChevronLeft /></button>
                    <button className="action-icon-btn"><Icons.ChevronRight /></button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.2rem', textAlign: 'center', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '600', color: '#94a3b8' }}>
                  <div>Пн</div><div>Вт</div><div>Ср</div><div>Чт</div><div>Пт</div><div>Сб</div><div>Нд</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.2rem' }}>
                  {/* Заглушки для вирівнювання (1 липня - середа) */}
                  <div></div><div></div>
                  {Array.from({length: 31}, (_, i) => i + 1).map(day => (
                    <div key={day} className={`cal-mini-day ${day === 3 ? 'selected' : ''}`}>
                      {day}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ height: '1px', backgroundColor: '#f1f5f9' }}></div>

              {/* Фільтри */}
              <div>
                <div style={{ fontWeight: '700', color: '#0f172a', marginBottom: '1rem', fontSize: '0.95rem' }}>Статус оплати</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#475569', cursor: 'pointer' }}>
                    <input type="checkbox" defaultChecked style={{ accentColor: '#10b981', width: '16px', height: '16px' }} />
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#10b981'}}></div> Оплачено</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#475569', cursor: 'pointer' }}>
                    <input type="checkbox" defaultChecked style={{ accentColor: '#0f172a', width: '16px', height: '16px' }} />
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#64748b'}}></div> Неоплачено</span>
                  </label>
                </div>
              </div>

              <div>
                <div style={{ fontWeight: '700', color: '#0f172a', marginBottom: '1rem', fontSize: '0.95rem' }}>Статус запису</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#475569', cursor: 'pointer' }}>
                    <input type="checkbox" defaultChecked style={{ accentColor: '#3b82f6', width: '16px', height: '16px' }} /> Підтверджено
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#475569', cursor: 'pointer' }}>
                    <input type="checkbox" defaultChecked style={{ accentColor: '#f59e0b', width: '16px', height: '16px' }} /> Очікує підтвердження
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: '#475569', cursor: 'pointer' }}>
                    <input type="checkbox" defaultChecked style={{ accentColor: '#ef4444', width: '16px', height: '16px' }} /> Скасовано / Не прийшов
                  </label>
                </div>
              </div>

            </div>

            {/* Права панель: Сітка розкладу */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', overflow: 'hidden' }}>

              {/* Топ бар календаря */}
              <div style={{ padding: '1rem 2rem', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button className="client-dark-btn" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>Сьогодні</button>
                  <div style={{ display: 'flex', gap: '0.2rem' }}>
                    <button className="action-icon-btn"><Icons.ChevronLeft /></button>
                    <button className="action-icon-btn"><Icons.ChevronRight /></button>
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', marginLeft: '0.5rem' }}>П'ятниця, 3 Липня</div>
                </div>
                <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '0.2rem' }}>
                  <button style={{ background: '#fff', border: 'none', borderRadius: '6px', padding: '0.4rem 1rem', fontWeight: '600', color: '#0f172a', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>День</button>
                  <button style={{ background: 'transparent', border: 'none', borderRadius: '6px', padding: '0.4rem 1rem', fontWeight: '500', color: '#64748b', cursor: 'pointer' }}>Тиждень</button>
                </div>
              </div>

              {/* Сітка (1px = 1 хвилина. Година = 60px) */}
              <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', position: 'relative', paddingBottom: '4rem' }}>

                {/* Сірий блок неробочого часу (до 10:00) */}
                <div style={{ position: 'absolute', top: 0, left: '60px', right: 0, height: '60px', background: 'repeating-linear-gradient(45deg, #f8fafc, #f8fafc 10px, #ffffff 10px, #ffffff 20px)' }}></div>

                {Array.from({length: 11}, (_, i) => i + 9).map(hour => (
                  <div key={hour} className="cal-grid-row" style={{ height: '60px' }}>
                    <div className="cal-time-col">
                      {hour.toString().padStart(2, '0')}:00
                    </div>
                  </div>
                ))}

                {/* Рендер записів (абсолютне позиціювання) */}
                {mockAppointments.map(app => {
                  const topOffset = ((app.startHour - 9) * 60) + app.startMin;
                  const height = app.duration;
                  return (
                    <div key={app.id} className="cal-app-card" style={{
                      top: `${topOffset}px`,
                      height: `${height}px`,
                      backgroundColor: app.color,
                      borderColor: app.textColor,
                      color: app.textColor
                    }}>
                      <div style={{ fontWeight: '700', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{app.service}</span>
                        <span>{app.startHour.toString().padStart(2, '0')}:{app.startMin.toString().padStart(2, '0')}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem', opacity: 0.9 }}>
                        <span>Клієнт: {app.client}</span>
                        <span>{app.master}</span>
                      </div>
                    </div>
                  );
                })}

                {/* Індикатор поточного часу (наприклад, 14:40) */}
                <div style={{ position: 'absolute', top: `${(14 - 9)*60 + 40}px`, left: '60px', right: 0, borderTop: '2px solid #ef4444', zIndex: 10 }}>
                  <div style={{ position: 'absolute', left: '-50px', top: '-10px', background: '#ef4444', color: '#fff', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700' }}>14:40</div>
                </div>

              </div>
            </div>

            {/* FAB (Floating Action Button) для нового запису */}
            <button className="fab-button" title="Новий запис">
              <Icons.Plus />
            </button>

          </div>
        )

        /* --- 1. КЕРУВАННЯ ПОСЛУГАМИ --- */
        : activeTab === 'Services' ? (
          <div style={{ padding: '2rem 3rem', flex: 1, maxWidth: '1400px', margin: '0 auto', width: '100%' }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '3rem' }}>

              {/* ЛІВА КОЛОНКА: СПИСОК ПОСЛУГ */}
              <div>
                {getDisplayedServicesForAdmin().length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {getDisplayedServicesForAdmin().map((service) => {
                      const originalIndex = services.findIndex(s => s.id === service.id);
                      const isDragDisabled = serviceSortType !== 'custom' || serviceSearchQuery.length > 0;

                      return (
                        <div
                          key={service.id}
                          draggable={!isDragDisabled}
                          onDragStart={(e) => handleDragStart(e, service.id)}
                          onDragEnter={(e) => handleDragEnter(e, service.id)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => e.preventDefault()}
                          className={`service-list-item ${draggedIndex === originalIndex ? 'dragging' : ''} ${dragOverIndex === originalIndex && draggedIndex !== originalIndex ? 'drag-over' : ''}`}
                        >
                          <div className={`drag-handle ${!isDragDisabled ? 'active' : 'disabled'}`} title={isDragDisabled ? "" : "Потягніть, щоб перемістити"}>
                            <Icons.Grip />
                          </div>

                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '2rem' }}>
                            <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.95rem', flex: 1 }}>{service.name}</span>
                            <span style={{ color: '#64748b', fontSize: '0.9rem', width: '80px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Icons.Clock /> {service.duration} хв</span>
                            <span style={{ fontWeight: '700', color: '#0f172a', width: '80px', textAlign: 'right' }}>{service.price} ₴</span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', marginLeft: '1rem' }}>
                            <button className="action-icon-btn" onClick={() => openServiceModal(service)} title="Редагувати">
                              <Icons.Edit />
                            </button>
                            <button className="action-icon-btn delete" onClick={() => handleDeleteService(service.id)} title="Видалити">
                              <Icons.Trash />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '4rem 0', backgroundColor: '#fff', border: '1px dashed #cbd5e1', borderRadius: '12px' }}>
                    <p style={{ color: '#64748b', fontSize: '1rem' }}>Нічого не знайдено або прайс-лист порожній.</p>
                  </div>
                )}
              </div>

              {/* ПРАВА КОЛОНКА: ПАНЕЛЬ ІНСТРУМЕНТІВ */}
              <div>
                <div style={{ position: 'sticky', top: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                  {/* Фільтри та Сортування */}
                  <div className="client-white-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', margin: '0 0 1.2rem 0' }}>Налаштування списку</h3>

                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '0.4rem' }}>Пошук послуги</label>
                      <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex' }}>
                          <Icons.Search />
                        </div>
                        <input
                          type="text"
                          value={serviceSearchQuery}
                          onChange={(e) => setServiceSearchQuery(e.target.value)}
                          className="search-input"
                          placeholder="Знайти..."
                        />
                      </div>

                      {/* Швидкі підказки (Чіпи) */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.8rem' }}>
                        {popularTags.map(tag => (
                          <div key={tag} onClick={() => setServiceSearchQuery(tag)} className="tag-pill">
                            {tag}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ position: 'relative' }} ref={sortMenuRef}>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '0.4rem' }}>Сортувати за</label>
                      <div className="custom-select-trigger" onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {sortOptions.find(o => o.value === serviceSortType)?.icon}
                          {sortOptions.find(o => o.value === serviceSortType)?.label}
                        </div>
                        <Icons.ChevronDown />
                      </div>

                      {isSortDropdownOpen && (
                        <div className="custom-select-dropdown">
                          {sortOptions.map(option => (
                            <div
                              key={option.value}
                              className={`custom-select-option ${serviceSortType === option.value ? 'selected' : ''}`}
                              onClick={() => { setServiceSortType(option.value); setIsSortDropdownOpen(false); }}
                            >
                              <span style={{ color: '#94a3b8' }}>{option.icon}</span>
                              {option.label}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Розумна Порада (AI Insight) */}
                  <div className="client-white-card" style={{ padding: '1.5rem', background: 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid #e2e8f0' }}>
                    <div onClick={() => setIsInsightOpen(!isInsightOpen)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#8b5cf6' }}>
                        <Icons.Sparkles />
                        <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Insight</h3>
                      </div>
                      <div style={{ color: '#94a3b8', transform: isInsightOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.3s' }}><Icons.ChevronDown /></div>
                    </div>
                    {isInsightOpen && (
                      <div style={{ marginTop: '1rem', animation: 'slideDown 0.3s ease' }}>
                        <div style={{ fontWeight: '700', color: '#0f172a', marginBottom: '0.3rem', fontSize: '1.05rem' }}>{getSmartAdvice().title}</div>
                        <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.5', margin: 0 }}>{getSmartAdvice().text}</p>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>

          </div>
        )

        /* --- 2. РЕДАКТОР СТОРІНКИ (Онлайн-вітрина) --- */
        : activeTab === 'Storefront' ? (
          <div style={{ padding: '3rem', flex: 1, display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: '1100px' }}>

              <div className="editable-block" style={{ marginBottom: '3rem' }}>
                {gallery.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: '16px', height: '380px', borderRadius: '16px', overflow: 'hidden' }}>
                    <img src={gallery[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Головне фото" />
                    <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: '16px' }}>
                      {gallery[1] && <img src={gallery[1]} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '0 16px 0 0' }} alt="Фото 2" />}
                      {gallery[2] && <img src={gallery[2]} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '0 0 16px 0' }} alt="Фото 3" />}
                    </div>
                  </div>
                ) : (
                  <div style={{ height: '280px', backgroundColor: '#ffffff', border: '2px dashed #cbd5e1', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                    <div style={{ color: '#94a3b8', marginBottom: '1rem' }}><Icons.Image /></div>
                    <div style={{ fontWeight: '700', fontSize: '1.2rem', color: '#0f172a' }}>Немає фотографій</div>
                    <div style={{ fontSize: '0.95rem', marginTop: '0.5rem' }}>Додайте фото інтер'єру та ваших робіт</div>
                  </div>
                )}
                <div className="edit-overlay">
                  <button className="edit-btn"><Icons.Camera /> Керувати галереєю</button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3rem' }}>
                <div style={{ flex: 1, paddingRight: '2rem' }}>
                  <input
                    name="name" value={formData.name} onChange={handleInputChange}
                    className="inline-input"
                    style={{ fontSize: '2.8rem', fontWeight: '900', color: '#0f172a', width: '100%', padding: '0.2rem 0.5rem', marginLeft: '-0.5rem', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}
                    placeholder="Назва вашого закладу"
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#475569', marginLeft: '0.1rem' }}>
                    <Icons.MapPin />
                    <input
                      name="address" value={formData.address} onChange={handleInputChange}
                      className="inline-input"
                      style={{ fontSize: '1.1rem', color: '#475569', fontWeight: '500', width: '100%', padding: '0.2rem 0.5rem' }}
                      placeholder="Місто, вулиця та номер будинку"
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '3rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>

                  <div className="client-white-card">
                    <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '1rem', color: '#0f172a' }}>Про нас</h2>
                    <textarea
                      ref={textareaRef}
                      name="description"
                      value={formData.description || ''}
                      onChange={handleInputChange}
                      maxLength={1000}
                      className="inline-input"
                      style={{ width: '100%', minHeight: '130px', fontSize: '1.05rem', color: '#475569', lineHeight: '1.6', padding: '0.5rem', marginLeft: '-0.5rem', resize: 'none', overflow: 'hidden' }}
                      placeholder="Напишіть короткий, але привабливий опис вашого простору..."
                    />
                    <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                      {(formData.description || '').length} / 1000
                    </div>
                  </div>

                  <div className="client-white-card editable-block">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>Послуги</h2>
                    </div>

                    {getSortedServices().length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {getSortedServices().map(service => (
                          <div key={service.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 0', borderBottom: '1px solid #f1f5f9' }}>
                            <div>
                              <div style={{ fontWeight: '800', fontSize: '1.15rem', color: '#0f172a', marginBottom: '0.3rem' }}>{service.name}</div>
                              <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Icons.Clock /> {service.duration} хв
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>{service.price} ₴</div>
                              <button className="client-dark-btn" style={{ opacity: 0.5 }}>Вибрати</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '3rem 0', color: '#64748b', border: '1px dashed #e2e8f0', borderRadius: '12px' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem', color: '#0f172a' }}>Прайс-лист порожній</div>
                        <div style={{ fontSize: '0.95rem' }}>Додайте послуги, щоб клієнти могли їх забронювати</div>
                      </div>
                    )}
                    <div className="edit-overlay" onClick={() => setActiveTab('Services')}>
                      <button className="edit-btn"><Icons.Edit /> Керувати послугами</button>
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', position: 'sticky', top: '2rem' }}>
                    <div className="client-white-card editable-block" style={{ padding: '1.5rem' }}>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: '0 0 1.5rem 0', color: '#0f172a' }}>Наша команда</h3>

                      {team.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', textAlign: 'center' }}>
                          {team.map((staff, idx) => (
                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#f1f5f9', color: '#64748b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Icons.User />
                              </div>
                              <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap' }}>{staff.name}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '1rem 0', color: '#64748b' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', color: '#cbd5e1', marginBottom: '0.8rem' }}><Icons.Team /></div>
                          <div style={{ fontSize: '0.95rem', fontWeight: '500' }}>Команда не додана</div>
                        </div>
                      )}
                      <div className="edit-overlay" onClick={() => setActiveTab('Team')}>
                        <button className="edit-btn"><Icons.Edit /> Керувати персоналом</button>
                      </div>
                    </div>

                    <div className="client-white-card editable-block" style={{ padding: 0, overflow: 'hidden' }}>
                      <div style={{ height: '180px', background: 'radial-gradient(ellipse at center, #f1f5f9 0%, #e2e8f0 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                        <Icons.MapPinBig />
                      </div>
                      <div style={{ padding: '1.5rem' }}>
                        <div style={{ fontWeight: '800', fontSize: '1.05rem', color: '#0f172a', marginBottom: '0.25rem' }}>{formData.name || 'Назва закладу'}</div>
                        <div style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.5' }}>{formData.address || 'Адреса не вказана'}</div>
                        <button style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', marginTop: '1.25rem', fontSize: '0.95rem', border: '1px solid #e2e8f0', background: '#fff', fontWeight: '600', color: '#0f172a' }}>Показати маршрут</button>
                      </div>
                      <div className="edit-overlay">
                        <button className="edit-btn"><Icons.Edit /> Змінити пін на карті</button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )

        /* --- 3. СТАТИСТИКА ТА ЗВІТИ --- */
        : activeTab === 'Stats' ? (
          <div style={{ padding: '3rem', flex: 1, maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
            <div style={{ display: 'flex', gap: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#0f172a', cursor: 'pointer', paddingBottom: '0.5rem', borderBottom: '2px solid #0f172a', whiteSpace: 'nowrap' }}>Огляд</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
              <div className="client-white-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Записи та заповненість</h3>
                <div style={{ height: '150px', borderBottom: '2px solid #34d399', position: 'relative' }}></div>
              </div>
              <div className="client-white-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.5rem' }}>Записи</h3>
                <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>0</div>
              </div>
            </div>
          </div>
        )

        /* --- 4. НАЛАШТУВАННЯ БІЗНЕСУ --- */
        : activeTab === 'Settings' ? (
          <div style={{ padding: '3rem', flex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', maxWidth: '1200px' }}>
              {businessSettingsCards.map(card => (
                <div key={card.id} style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }} onMouseOver={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)'; }} onMouseOut={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                    <div style={{ color: '#0f172a' }}><card.icon /></div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>{card.title}</h3>
                  </div>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0, paddingLeft: '2.5rem', lineHeight: '1.4' }}>{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )

        /* --- 5. ІНШІ ВКЛАДКИ --- */
        : (
          <div style={{ padding: '3rem', flex: 1 }}>
            <div style={{ width: '100%', height: '400px', border: '2px dashed #e2e8f0', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }}>
              <div style={{ color: '#cbd5e1', marginBottom: '1rem' }}>
                {(() => { const Icon = navItems.find(item => item.id === activeTab)?.icon || Icons.Sales; return <Icon />; })()}
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#334155', margin: '0 0 0.5rem 0' }}>Розділ у розробці</h3>
            </div>
          </div>
        )}
      </main>

      {/* --- МОДАЛЬНЕ ВІКНО ДОДАВАННЯ/РЕДАГУВАННЯ ПОСЛУГИ --- */}
      {isServiceModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                {editingService ? 'Редагувати послугу' : 'Нова послуга'}
              </h2>
              <button onClick={() => setIsServiceModalOpen(false)} style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label className="modal-label">Назва послуги</label>
                <input type="text" value={serviceForm.name} onChange={(e) => setServiceForm({...serviceForm, name: e.target.value})} className="modal-input" placeholder="Наприклад: Чоловіча стрижка" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="modal-label">Тривалість (хвилин)</label>
                  <input type="number" value={serviceForm.duration || ''} onChange={(e) => setServiceForm({...serviceForm, duration: Number(e.target.value)})} className="modal-input" placeholder="60" />
                </div>
                <div>
                  <label className="modal-label">Ціна (₴)</label>
                  <input type="number" value={serviceForm.price || ''} onChange={(e) => setServiceForm({...serviceForm, price: Number(e.target.value)})} className="modal-input" placeholder="500" />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2.5rem' }}>
              <button onClick={() => setIsServiceModalOpen(false)} style={{ padding: '0.8rem 1.5rem', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '8px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>Скасувати</button>
              <button onClick={handleSaveService} disabled={isServiceSaving} style={{ padding: '0.8rem 1.5rem', backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', fontWeight: '600', color: '#ffffff', cursor: isServiceSaving ? 'not-allowed' : 'pointer', opacity: isServiceSaving ? 0.7 : 1 }}>
                {isServiceSaving ? 'Збереження...' : 'Зберегти'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}