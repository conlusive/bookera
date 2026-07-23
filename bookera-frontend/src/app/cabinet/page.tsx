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
  Settings: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>,
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
  Filter: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>,
  Phone: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>,
  Mail: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>,
  Tag: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>,
  Send: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>,
  CheckCircle: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>,
  AlertCircle: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>,
  XCircle: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
};

// --- ГЛОБАЛЬНІ КОНСТАНТИ ТА ДАНІ ---
const popularTags = ["Стрижка", "Борода", "Комплекс", "Брови"];

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

const sortOptions = [
  { value: 'custom', label: 'Свій порядок (Вручну)', icon: <Icons.Grip /> },
  { value: 'priceAsc', label: 'Від найдешевших', icon: <Icons.TrendingUp /> },
  { value: 'priceDesc', label: 'Від найдорожчих', icon: <Icons.TrendingDown /> },
  { value: 'nameAsc', label: 'За алфавітом (А-Я)', icon: <Icons.SortAlpha /> },
];

const clientSortOptions = [
  { value: 'recent', label: 'За останнім візитом', icon: <Icons.Clock /> },
  { value: 'spent_desc', label: 'За доходом (Найбільше)', icon: <Icons.TrendingUp /> },
  { value: 'visits_desc', label: 'За кількістю візитів', icon: <Icons.User /> },
  { value: 'name_asc', label: 'За алфавітом (А-Я)', icon: <Icons.SortAlpha /> },
];

const businessSettingsCards = [
  { id: 'payments', title: 'Платежі та каса', desc: 'Налаштуйте методи оплати, депозити та захист від неявок.', icon: Icons.CreditCard },
  { id: 'booking', title: 'Онлайн бронювання', desc: 'Вирішіть, які опції запису будуть доступні клієнтам.', icon: Icons.Globe },
  { id: 'advanced', title: 'Системні правила', desc: 'Авто-підтвердження записів, сповіщення та безпека.', icon: Icons.Settings },
  { id: 'inventory', title: 'Склад та Матеріали', desc: 'Ведіть облік витратних матеріалів та товарів.', icon: Icons.Box },
  { id: 'billing', title: 'Підписка та білінг', desc: 'Деталі оплати, поточний тариф та методи платежу.', icon: Icons.Calendar },
];

// --- 🎨 КОЛЬОРИ МАЙСТРІВ ТА ПОСЛУГ ---
const MASTER_COLORS = [
  { pastelBg: '#e0e7ff', pastelBorder: '#818cf8', pastelText: '#312e81', vividBg: '#4f46e5', vividBorder: '#3730a3' }, // Indigo
  { pastelBg: '#dcfce7', pastelBorder: '#86efac', pastelText: '#14532d', vividBg: '#16a34a', vividBorder: '#15803d' }, // Green
  { pastelBg: '#fef08a', pastelBorder: '#fde047', pastelText: '#713f12', vividBg: '#eab308', vividBorder: '#ca8a04' }, // Yellow
  { pastelBg: '#ffedd5', pastelBorder: '#fdba74', pastelText: '#7c2d12', vividBg: '#f97316', vividBorder: '#ea580c' }, // Orange
  { pastelBg: '#fce7f3', pastelBorder: '#f472b6', pastelText: '#831843', vividBg: '#ec4899', vividBorder: '#db2777' }, // Pink
  { pastelBg: '#f3e8ff', pastelBorder: '#d8b4fe', pastelText: '#581c87', vividBg: '#a855f7', vividBorder: '#9333ea' }, // Purple
  { pastelBg: '#cffafe', pastelBorder: '#67e8f9', pastelText: '#164e63', vividBg: '#06b6d4', vividBorder: '#0891b2' }, // Cyan
  { pastelBg: '#ffe4e6', pastelBorder: '#fda4af', pastelText: '#881337', vividBg: '#f43f5e', vividBorder: '#e11d48' }, // Rose
  { pastelBg: '#ccfbf1', pastelBorder: '#6ee7b7', pastelText: '#064e3b', vividBg: '#10b981', vividBorder: '#059669' }, // Emerald
  { pastelBg: '#fef3c7', pastelBorder: '#fcd34d', pastelText: '#78350f', vividBg: '#f59e0b', vividBorder: '#d97706' }, // Amber
  { pastelBg: '#e0f2fe', pastelBorder: '#93c5fd', pastelText: '#1e3a8a', vividBg: '#3b82f6', vividBorder: '#2563eb' }, // Blue
  { pastelBg: '#f3f4f6', pastelBorder: '#d1d5db', pastelText: '#111827', vividBg: '#6b7280', vividBorder: '#4b5563' }, // Gray
];

const toLocalDateStr = (d: Date) => {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().split('T')[0];
};

const checkSameDay = (dbDateStr: string, targetDateObj: Date) => {
  if (!dbDateStr) return false;
  if (dbDateStr.length === 10) {
    const [y, m, d] = dbDateStr.split('-');
    return parseInt(y, 10) === targetDateObj.getFullYear() &&
           parseInt(m, 10) - 1 === targetDateObj.getMonth() &&
           parseInt(d, 10) === targetDateObj.getDate();
  }
  const d = new Date(dbDateStr);
  return d.getFullYear() === targetDateObj.getFullYear() &&
         d.getMonth() === targetDateObj.getMonth() &&
         d.getDate() === targetDateObj.getDate();
};

// 🟢 ОКРЕМИЙ КОМПОНЕНТ ДЛЯ ЧЕРВОНОЇ ЛІНІЇ
const CurrentTimeIndicator = ({ gridStartHour, gridTotalHours, isToday }: { gridStartHour: number, gridTotalHours: number, isToday: boolean }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    if (!isToday) return;
    // Оновлюємо щосекунди (1000 мс) для ідеальної точності
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, [isToday]);

  if (!isToday) return null;

  const currentHourAdjusted = time.getHours() < gridStartHour ? time.getHours() + 24 : time.getHours();
  // Розрахунок з секундами для ідеально плавного руху
  const currentMinutesOffset = (currentHourAdjusted - gridStartHour) * 60 + time.getMinutes() + (time.getSeconds() / 60);

  if (currentMinutesOffset < 0 || currentMinutesOffset > gridTotalHours * 60) return null;

  // 🔴 Змінили transition на 'top 1s linear', щоб рух був ідеально синхронізований із секундами
  return (
    <div style={{ position: 'absolute', top: `${currentMinutesOffset}px`, left: 0, right: 0, zIndex: 20, pointerEvents: 'none', transition: 'top 1s linear' }}>

      {/* 🔴 Крапка на осі (чітко на межі між сірою колонкою і сіткою) */}
      <div style={{ position: 'absolute', left: '56px', top: '-4px', width: '9px', height: '9px', borderRadius: '50%', background: '#ef4444', zIndex: 11 }}></div>

      {/* 🔴 Лінія, що тягнеться через всю сітку */}
      <div style={{ position: 'absolute', left: '60px', right: 0, top: '0', borderTop: '2px solid #ef4444', opacity: 0.8, zIndex: 9 }}></div>

      {/* 🔴 Сучасна плашка з часом */}
      <div style={{ position: 'absolute', left: '68px', top: '-11px', backgroundColor: '#ef4444', color: '#ffffff', padding: '2px 6px', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(239, 68, 68, 0.3)', zIndex: 12 }}>
        <span style={{ fontSize: '0.65rem', fontWeight: '800', letterSpacing: '0.05em' }}>
          {time.getHours().toString().padStart(2, '0')}:{time.getMinutes().toString().padStart(2, '0')}
        </span>
      </div>

    </div>
  );
};

export default function BusinessCabinet() {
  const router = useRouter();
  const supabase = createClient();

  // --- РЕФЕРЕНСИ ДЛЯ DOM-ЕЛЕМЕНТІВ ---
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const clientSortMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const bizMenuRef = useRef<HTMLDivElement>(null);

  // --- СТАНИ ДЛЯ ДАТ І ТАСОК ---
  const [tasks, setTasks] = useState<{id: number, text: string, completed: boolean, date: string}[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const now = new Date();

  const formatDateKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const realTodayStr = formatDateKey(now);

  const hasOverdueTasks = (dateObj: Date) => {
    const dStr = formatDateKey(dateObj);
    return tasks.some(t => t.date === dStr && !t.completed && t.date < realTodayStr);
  };

  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);

  const [services, setServices] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);

  // --- СТАНИ ДЛЯ ФОТОГРАФІЙ ---
  const [logo, setLogo] = useState<string | null>(null);
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null);
  const [workplacePhotos, setWorkplacePhotos] = useState<string[]>([]);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

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
  const [isBizMenuOpen, setIsBizMenuOpen] = useState(false); // 🟢 ДОДАНО СТАН МЕНЮ
  const [myBusinesses, setMyBusinesses] = useState<any[]>([]);

  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('day');
  // 🟢 НОВІ СТАНИ ДЛЯ ФІЧ
  const [waitlist, setWaitlist] = useState<any[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'todo' | 'waitlist'>('todo');
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [clipboardApp, setClipboardApp] = useState<any>(null);
  const [contextMenu, setContextMenu] = useState<{x: number, y: number, app: any} | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isApptModalOpen, setIsApptModalOpen] = useState(false);

  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [isBookingDetailsModalOpen, setIsBookingDetailsModalOpen] = useState(false);

  const [apptForm, setApptForm] = useState({
    client_name: '', client_phone: '+380', service_id: '', staff_id: '', date: toLocalDateStr(new Date()), time: '10:00', block_reason: '', duration: 60
  });

  const [newClientForm, setNewClientForm] = useState({ name: '', phone: '+380', email: '' });

  const [filterMaster, setFilterMaster] = useState('all');
  const [isBlockMode, setIsBlockMode] = useState(false);
  const [isMasterFilterOpen, setIsMasterFilterOpen] = useState(false);
  const masterFilterRef = useRef<HTMLDivElement>(null);

// --- СТАНИ ДЛЯ МЕНЕДЖЕРА ЗАДАЧ ---
  const [showTaskInfoModal, setShowTaskInfoModal] = useState(false);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState(''); // 🟢 ПОВЕРНУЛИ ЦЕЙ РЯДОК
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingTaskText, setEditingTaskText] = useState('');
  const [hasSeenTaskInfo, setHasSeenTaskInfo] = useState(false);

// --- СТАНИ ДЛЯ МАРКЕТИНГУ ---
  const [marketingView, setMarketingView] = useState<'overview' | 'campaigns' | 'promotions'>('overview');
  const [campaignTab, setCampaignTab] = useState<'automated' | 'mass'>('automated');
  const [automations, setAutomations] = useState({ welcome: false, crossSell: false, lost: false, reviews: false });
  const [marketingForm, setMarketingForm] = useState({ type: 'sms', audience: 'all', message: '' });
  const [isSendingPromo, setIsSendingPromo] = useState(false);
  const [comingSoonModal, setComingSoonModal] = useState<{ isOpen: boolean, title: string, desc: string }>({ isOpen: false, title: '', desc: '' });

// --- СТАНИ ТА ФУНКЦІЇ ДЛЯ НАЛАШТУВАНЬ (100% РОБОЧІ) ---
  const [settingsView, setSettingsView] = useState<'main' | 'payments' | 'billing' | 'advanced' | 'booking' | 'inventory'>('main');
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);

  const [bookingSettings, setBookingSettings] = useState({
    is_active: true, min_advance_hours: 2, max_advance_days: 30, cancellation_policy: 'Безкоштовне скасування за 24 години до візиту.'
  });

  const [notificationSettings, setNotificationSettings] = useState({
    notify_client_booking: true, notify_client_reminder: true, notify_staff_booking: true, auto_approve: true
  });

  const [paymentsSettings, setPaymentsSettings] = useState({
    require_deposit: false, deposit_amount: 100, cancellation_fee: false, mobile_payments: true
  });

  const [inventory, setInventory] = useState<any[]>([]);
  const [newInventoryItem, setNewInventoryItem] = useState({ name: '', qty: 1, price: 0 });

  // Універсальна функція збереження
  const saveSettingsToDB = async (column: string, data: any, successMsg: string) => {
    if (!business) return;
    setIsSettingsSaving(true);
    try {
      await supabase.from('businesses').update({ [column]: data }).eq('id', business.id);
      setComingSoonModal({ isOpen: true, title: 'Успішно!', desc: successMsg });
    } catch(e) { console.error(e); alert('Помилка збереження!'); } finally { setIsSettingsSaving(false); }
  };

  const handleAddInventory = async () => {
    if (!newInventoryItem.name.trim() || newInventoryItem.price < 0 || newInventoryItem.qty <= 0) return alert("Введіть коректні дані");
    const newInv = [{ ...newInventoryItem, id: Date.now() }, ...inventory];
    setInventory(newInv);
    setNewInventoryItem({ name: '', qty: 1, price: 0 });
    if (business) await supabase.from('businesses').update({ inventory: newInv }).eq('id', business.id);
  };

  const handleDeleteInventory = async (id: number) => {
    if (!confirm("Видалити товар зі складу?")) return;
    const newInv = inventory.filter(i => i.id !== id);
    setInventory(newInv);
    if (business) await supabase.from('businesses').update({ inventory: newInv }).eq('id', business.id);
  };



// --- СТАНИ ДЛЯ СТАТИСТИКИ (Повноцінні) ---
  const [statsTab, setStatsTab] = useState<'overview' | 'appointments' | 'revenue' | 'services' | 'staff' | 'clients'>('overview');
  const [statsPeriodType, setStatsPeriodType] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [statsDate, setStatsDate] = useState(new Date());
  const [statsCurrentPage, setStatsCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null); // 🟢 Додано для сортування

// --- СТАНИ ДЛЯ ПЕРСОНАЛУ ---
  const [selectedStaffId, setSelectedStaffId] = useState<string | number | null>(null);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [staffActiveTab, setStaffActiveTab] = useState<'services' | 'schedule'>('services');

  // 🟢 ГЛОБАЛЬНИЙ СТЕЙТ ДЛЯ ПОСЛУГ МАЙСТРА (Щоб не було помилок Hooks)
  const [localAssignedServices, setLocalAssignedServices] = useState<string[]>([]);

  useEffect(() => {
    if (activeTab === 'Team' && selectedStaffId) {
      const currentM = team.find(t => String(t.id) === String(selectedStaffId)) || team[0];
      if (currentM) {
         setLocalAssignedServices(currentM.assigned_services || services.map(s => String(s.id)));
      }
    }
  }, [selectedStaffId, team, activeTab, services]);

  // 🟢 ДОДАЙ ЦЕЙ РЯДОК ДЛЯ ПОШУКУ ПОСЛУГ У ПРОФІЛІ:
  const [staffServiceSearchQuery, setStaffServiceSearchQuery] = useState('');

  // 🟢 Нові стани для реального додавання персоналу
  const [isInviteStaffModalOpen, setIsInviteStaffModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', role: 'master', phone: '' });
  const [isInvitingStaff, setIsInvitingStaff] = useState(false);

  // --- ФУНКЦІЇ МЕНЕДЖЕРА ЗАДАЧ ---
  const handleAddTaskClick = () => {
    if (!hasSeenTaskInfo && tasks.length === 0) {
      setShowTaskInfoModal(true);
    } else {
      setIsAddingTask(true);
    }
  };

  const confirmTaskInfo = () => {
    setHasSeenTaskInfo(true);
    setShowTaskInfoModal(false);
    setIsAddingTask(true);
  };

  const saveNewTask = async () => {
    if (newTaskText.trim() === '') {
      setIsAddingTask(false);
      return;
    }
    const dateKey = formatDateKey(currentDate);
    const newTasks = [...tasks, { id: Date.now(), text: newTaskText, completed: false, date: dateKey }];
    setTasks(newTasks);
    setNewTaskText('');
    setIsAddingTask(false);
    if (business) await supabase.from('businesses').update({ tasks: newTasks }).eq('id', business.id);
  };

  const toggleTask = async (id: number) => {
    const newTasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    setTasks(newTasks);
    if (business) await supabase.from('businesses').update({ tasks: newTasks }).eq('id', business.id);
  };

  const startEditTask = (task: any) => {
    setEditingTaskId(task.id);
    setEditingTaskText(task.text);
  };

  const saveEditedTask = async (id: number) => {
    if (!editingTaskText.trim()) {
      setEditingTaskId(null);
      return;
    }
    const newTasks = tasks.map(t => t.id === id ? { ...t, text: editingTaskText.trim() } : t);
    setTasks(newTasks);
    setEditingTaskId(null);
    if (business) await supabase.from('businesses').update({ tasks: newTasks }).eq('id', business.id);
  };

  const deleteTask = async (id: number) => {
    if (!confirm('Видалити цю справу?')) return;
    const newTasks = tasks.filter(t => t.id !== id);
    setTasks(newTasks);
    if (business) await supabase.from('businesses').update({ tasks: newTasks }).eq('id', business.id);
  };

  // --- СТАНИ ДЛЯ КЛІЄНТСЬКОЇ БАЗИ ---
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [viewingClient, setViewingClient] = useState<any>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [clientSortType, setClientSortType] = useState('recent');
  const [isClientSortDropdownOpen, setIsClientSortDropdownOpen] = useState(false);
  const [editingClientNotes, setEditingClientNotes] = useState('');
  const [editingClientAllergies, setEditingClientAllergies] = useState(''); // 🟢 Додано стан для алергій

  // --- БАЗА КЛІЄНТІВ (SUPABASE) ---
  const fetchClientsFromDB = async (bizId: string) => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('business_id', bizId)
      .order('last_visit', { ascending: false });

    if (!error && data) {
      setClientsList(data);
    }
  };

  const filteredAndSortedClients = clientsList
    .filter(c => (c.name || '').toLowerCase().includes(clientSearch.toLowerCase()) || (c.phone || '').includes(clientSearch))
    .sort((a, b) => {
      if (clientSortType === 'recent') return new Date(b.last_visit || 0).getTime() - new Date(a.last_visit || 0).getTime();
      if (clientSortType === 'spent_desc') return (b.spent || 0) - (a.spent || 0);
      if (clientSortType === 'visits_desc') return (b.visits || 0) - (a.visits || 0);
      if (clientSortType === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      return 0;
    });

  // --- ПАГІНАЦІЯ КЛІЄНТІВ ---
  const [clientCurrentPage, setClientCurrentPage] = useState(1);
  const clientsPerPage = 10;

  // --- ДОДАВАННЯ НОВОГО КЛІЄНТА (ОКРЕМО ВІД КАЛЕНДАРЯ) ---
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [isSavingClient, setIsSavingClient] = useState(false);

const handleSaveNewClient = async () => {
    if (!newClientForm.name.trim()) return alert("Введіть ім'я клієнта!");
    let finalPhone = '';
    if (newClientForm.phone && newClientForm.phone !== '+380') {
      const phoneStripped = newClientForm.phone.replace(/\D/g, '');
      if (phoneStripped.length !== 12) {
        return alert("Некоректний номер телефону! Введіть 9 цифр після +380.");
      }
      finalPhone = '+' + phoneStripped;
    }

    // 🟢 ЖОРСТКА ВАЛІДАЦІЯ EMAIL
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
        phone: finalPhone, // 👈 ОСЬ ТУТ ЗМІНА
        email: emailTrimmed || null,
        last_visit: safeDate,
        visits: 0,
        spent: 0,
        tags: ['Новий']
      };

      const { error: insertError } = await supabase.from('clients').insert([newClientData]);
      if (insertError) {
         delete newClientData.tags;
         await supabase.from('clients').insert([newClientData]);
      }

      await fetchClientsFromDB(business.id);
      setIsAddClientModalOpen(false);
      setNewClientForm({ name: '', phone: '', email: '' });
    } catch (err) {
      console.error(err);
      alert("Помилка при створенні клієнта");
    } finally {
      setIsSavingClient(false);
    }
  };

  useEffect(() => {
    setClientCurrentPage(1);
  }, [clientSearch, clientSortType]);

  const handleDeleteClient = async (clientId: string) => {
    if (!confirm("Ви впевнені, що хочете назавжди видалити цього клієнта з бази? Усі його дані будуть втрачені.")) return;
    try {
      const { error } = await supabase.from('clients').delete().eq('id', clientId);
      if (error) throw error;
      setClientsList(prev => prev.filter(c => c.id !== clientId));
      setViewingClient(null);
    } catch (err) {
      console.error("Помилка видалення клієнта:", err);
      alert("Не вдалося видалити клієнта.");
    }
  };

  // --- ЛОГІКА ЗБЕРЕЖЕННЯ НОТАТОК, АЛЕРГІЙ ТА ТЕГІВ ---
  const handleSaveClientNotes = async () => {
    if (!viewingClient) return;
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          notes: editingClientNotes,
          allergies: editingClientAllergies // 🟢 Зберігаємо алергії
        })
        .eq('id', viewingClient.id);

      if (error) throw error;

      const updatedClients = clientsList.map(c => c.id === viewingClient.id ? { ...c, notes: editingClientNotes, allergies: editingClientAllergies } : c);
      setClientsList(updatedClients);
      setViewingClient({ ...viewingClient, notes: editingClientNotes, allergies: editingClientAllergies });
      alert("Зміни успішно збережено!");
    } catch (err) {
      console.error("Помилка збереження:", err);
      alert("Не вдалося зберегти зміни.");
    }
  };

  const openViewingClient = (client: any) => {
    setViewingClient(client);
    setEditingClientNotes(client.notes || '');
    setEditingClientAllergies(client.allergies || ''); // 🟢 Підтягуємо алергії з БД
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

  // 🟢 ФУНКЦІЇ ДЛЯ ТЕГІВ
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

const handleSendMarketing = async () => {
    // 1. Валідація повідомлення
    if (!marketingForm.message || marketingForm.message.trim() === '') {
      return setComingSoonModal({
        isOpen: true,
        title: 'Порожнє повідомлення',
        desc: 'Будь ласка, введіть текст повідомлення перед відправкою розсилки.'
      });
    }

    // 2. Перевірка чи є база
    if (clientsList.length === 0) {
      return setComingSoonModal({
        isOpen: true,
        title: 'База порожня',
        desc: 'У вашій базі ще немає клієнтів. Немає кому надсилати повідомлення.'
      });
    }

    setIsSendingPromo(true);

    try {
      let recipients = [];
      const now = new Date();

      // Формуємо цільову аудиторію
      if (marketingForm.audience === 'vip') {
        recipients = clientsList.filter(c => {
           if (!c.tags || !Array.isArray(c.tags)) return false;
           return c.tags.some((tag: string) => tag.toLowerCase().includes('vip'));
        });
      } else if (marketingForm.audience === 'lost') {
        recipients = clientsList.filter(c => {
           if (!c.last_visit) return false;
           const lastVisitDate = new Date(c.last_visit);
           const diffTime = Math.abs(now.getTime() - lastVisitDate.getTime());
           const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
           return diffDays > 30;
        });
      } else {
        recipients = clientsList;
      }

      // СТРОГА ФІЛЬТРАЦІЯ
      const validRecipients = recipients.filter(c => {
        if (marketingForm.type === 'sms') {
          if (!c.phone) return false;
          const phoneStripped = c.phone.replace(/[\s\-\(\)]/g, '');
          return /^\+?\d{10,15}$/.test(phoneStripped);
        } else if (marketingForm.type === 'email') {
          if (!c.email) return false;
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email);
        }
        return false;
      });

      if (validRecipients.length === 0) {
        setIsSendingPromo(false);
        const contactType = marketingForm.type === 'sms' ? 'валідним номером телефону (мін. 10 цифр)' : 'коректною Email-адресою';
        return setComingSoonModal({
          isOpen: true,
          title: 'Немає отримувачів',
          desc: `Серед обраної аудиторії (${recipients.length} клієнтів) не знайдено жодного з ${contactType}. Очистіть базу від невірних даних.`
        });
      }

      // 🟢 РЕАЛЬНА ВІДПРАВКА НА НАШ БЕКЕНД
      const response = await fetch('/api/marketing/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: marketingForm.type,
          message: marketingForm.message,
          recipients: validRecipients.map(c => ({
            name: c.name,
            phone: c.phone,
            email: c.email
          }))
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Помилка сервера');
      }

      // Успіх
      const filteredOut = recipients.length - validRecipients.length;
      const filterNotice = filteredOut > 0 ? ` (Відсіяно ${filteredOut} контактів з невірними або відсутніми даними).` : '.';

      setComingSoonModal({
        isOpen: true,
        title: 'Розсилку успішно відправлено! 🚀',
        desc: `Кампанію (${marketingForm.type.toUpperCase()}) було надіслано ${validRecipients.length} клієнтам${filterNotice}`
      });

      setMarketingForm({ audience: 'all', message: '', type: 'sms' });

    } catch (err: any) {
      console.error("Помилка відправки розсилки:", err);
      setComingSoonModal({
        isOpen: true,
        title: 'Помилка відправки',
        desc: `Виникла системна помилка: ${err.message}. Перевірте налаштування (API ключі).`
      });
    } finally {
      setIsSendingPromo(false);
    }
  };

  const [showCalSettingsModal, setShowCalSettingsModal] = useState(false);
  const [showShiftsModal, setShowShiftsModal] = useState(false);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);

  const [calSettings, setCalSettings] = useState({
    defaultView: 'day',
    displayMode: 'fit',
    colorScheme: 'pastel',
    colorMode: 'master', // 🟢 ДОДАНО СТАН ДЛЯ КОЛІРНОГО РЕЖИМУ
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

  // 🟢 ФУНКЦІЯ ДЛЯ ЗАВАНТАЖЕННЯ КОНКРЕТНОГО БІЗНЕСУ (Перемикання)
  const loadSpecificBusiness = async (bizId: string) => {
    setLoading(true);
    try {
      const { data: bizData } = await supabase.from('businesses').select('*').eq('id', bizId).single();

      if (bizData) {
        setBusiness(bizData);
        // Зберігаємо вибір, щоб при перезавантаженні сторінки відкривався цей же заклад
        localStorage.setItem('bookera_active_biz_id', bizData.id);

        setFormData({
          name: bizData.name || '',
          category: bizData.category || '',
          address: bizData.address || '',
          description: bizData.description || '',
        });

        if (bizData.cal_settings) setCalSettings(bizData.cal_settings);
        if (bizData.shifts) setShifts(bizData.shifts);
        if (bizData.tasks) setTasks(bizData.tasks);

        // Оновлюємо фото та налаштування, якщо їх немає - скидаємо на дефолтні
        if (bizData.logo) setLogo(bizData.logo); else setLogo(null);
        if (bizData.cover_photo) setCoverPhoto(bizData.cover_photo); else setCoverPhoto(null);
        if (bizData.workplace_photos) setWorkplacePhotos(bizData.workplace_photos); else setWorkplacePhotos([]);

        if (bizData.service_sort_type) setServiceSortType(bizData.service_sort_type);
        if (bizData.booking_settings) setBookingSettings(bizData.booking_settings);
        if (bizData.notification_settings) setNotificationSettings(bizData.notification_settings);
        if (bizData.payments_settings) setPaymentsSettings(bizData.payments_settings);
        if (bizData.inventory) setInventory(bizData.inventory); else setInventory([]);

        const { data: srvs } = await supabase
          .from('services')
          .select('*')
          .eq('business_id', bizData.id)
          .order('order_index', { ascending: true })
          .order('created_at', { ascending: true });
        setServices(srvs || []);

        const { data: masters } = await supabase.from('staff').select('*').eq('business_id', bizData.id);
        setTeam(masters || []);

        await fetchClientsFromDB(bizData.id);

        // Скидаємо локальні фільтри (щоб не шукало майстра з попереднього закладу)
        setFilterMaster('all');
        setSelectedStaffId(null);
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

    async function loadCabinetData() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) return router.push('/business');

        const userId = session.user.id;
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
        setUserProfile(profile || { full_name: session.user.email });

        // 🟢 Витягуємо ВСІ бізнеси користувача для бокового меню
        const { data: allBiz } = await supabase.from('businesses').select('id, name, logo').eq('owner_id', userId);

        if (allBiz && allBiz.length > 0) {
          setMyBusinesses(allBiz);

          // Шукаємо останній відкритий заклад у пам'яті (або беремо перший у списку)
          const savedBizId = localStorage.getItem('bookera_active_biz_id');
          const targetBizId = savedBizId && allBiz.some(b => String(b.id) === String(savedBizId)) ? savedBizId : allBiz[0].id;

          await loadSpecificBusiness(targetBizId);
        } else {
          setLoading(false); // У користувача ще немає закладів
        }
      } catch (error) {
        console.error("Помилка завантаження даних:", error);
        setLoading(false);
      }
    }
    loadCabinetData();
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
          // Ігноруємо перерви та записи, які вже мають змінений статус (запізнення, не прийшов тощо)
          if (app.status === 'blocked' || app.color === 'blocked') return app;
          if (app.status !== 'confirmed' && app.status !== undefined && app.status !== null) return app;

          if (app.booking_date && app.end_time && app.start_time) {
            const [year, month, day] = app.booking_date.split('-').map(Number);
            const [startH] = app.start_time.split(':').map(Number);
            let [endH, endM] = app.end_time.split(':').map(Number);

            // Якщо запис закінчується наступного дня (переходить через північ)
            if (endH < startH) endH += 24;

            const endDateTime = new Date(year, month - 1, day, endH, endM);

            // Якщо поточний час більший за час закінчення запису
            if (currentTime > endDateTime) {
              // Фоново оновлюємо статус в базі даних, щоб не гальмувати інтерфейс
              supabase.from('bookings').update({ status: 'completed' }).eq('id', app.id).then();
              return { ...app, status: 'completed' };
            }
          }
          return app;
        });

        setAppointments(processedData);
      }
    }
    fetchAppointments();
  }, [currentDate.getFullYear(), currentDate.getMonth(), business?.id]);

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
      if (clientSortMenuRef.current && !clientSortMenuRef.current.contains(event.target as Node)) {
        setIsClientSortDropdownOpen(false);
      }
      if (viewMenuRef.current && !viewMenuRef.current.contains(event.target as Node)) {
        setIsViewDropdownOpen(false);
      }
      // 🟢 ДОДАНО УМОВУ ДЛЯ МЕНЮ БІЗНЕСІВ
      if (bizMenuRef.current && !bizMenuRef.current.contains(event.target as Node)) {
        setIsBizMenuOpen(false);
      }
      if (masterFilterRef.current && !masterFilterRef.current.contains(event.target as Node)) {
        setIsMasterFilterOpen(false);
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

  // 🟢 ГАРЯЧІ КЛАВІШІ (PRO SHORTCUTS)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return; // Не спрацьовує, якщо юзер щось друкує

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
         // Використовуємо e.code, щоб шорткати працювали на будь-якій розкладці (Укр/Англ)
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
      }

      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyK') {
         e.preventDefault();
         setIsGlobalSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentDate, calendarView, activeTab, filterMaster]);

  // Закриття контекстного меню при кліку будь-де
  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    document.addEventListener("click", closeMenu);
    document.addEventListener("contextmenu", closeMenu); // 🟢 Додав закриття і при правому кліку в іншому місці
    return () => {
      document.removeEventListener("click", closeMenu);
      document.removeEventListener("contextmenu", closeMenu);
    };
  }, []);



  const handleSaveCalSettings = async () => {
    if (business) {
      await supabase.from('businesses').update({ cal_settings: calSettings }).eq('id', business.id);
    }
    setShowCalSettingsModal(false);
  };

  const handleSaveShifts = async () => {
    if (business) {
      await supabase.from('businesses').update({ shifts: shifts }).eq('id', business.id);
    }
    setShowShiftsModal(false);
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

// 🟢 ГЛОБАЛЬНА ЛОГІКА: Запрошення персоналу
  const handleInviteStaff = async () => {
    if (!inviteForm.email || !inviteForm.name) return alert("Заповніть обов'язкові поля: Ім'я та Email.");
    setIsInvitingStaff(true);
    try {
      const newStaffData = {
        business_id: business.id,
        name: inviteForm.name.trim(),
        email: inviteForm.email.trim(),
        phone: inviteForm.phone.trim() || null,
        role: inviteForm.role,
        status: 'pending',
        provides_services: inviteForm.role === 'master',
        assigned_services: inviteForm.role === 'master' ? services.map(s => s.id) : [],
        commission_rate: 40,
        fixed_salary: 0,
        payout_history: [],
        auto_payout: false,
        keeps_tips: true,
        deduct_materials: false,
        payout_period: 'weekly',
        payout_day: 'monday'
      };

      const { data, error } = await supabase.from('staff').insert([newStaffData]).select().single();
      if (error) throw error;

      setTeam([...team, data]);
      setIsInviteStaffModalOpen(false);
      setInviteForm({ email: '', name: '', role: 'master', phone: '' });
      alert(`Запрошення успішно надіслано на ${inviteForm.email}!`);
    } catch (err) {
      console.error(err);
      alert("Помилка при додаванні співробітника.");
    } finally {
      setIsInvitingStaff(false);
    }
  };

  const handleSaveAppointment = async () => {
    // 🟢 ЖОРСТКА ВАЛІДАЦІЯ ТЕЛЕФОНУ В КАЛЕНДАРІ
    let finalPhone = '';
    if (!isBlockMode && apptForm.client_phone && apptForm.client_phone !== '+380') {
      const phoneStripped = apptForm.client_phone.replace(/\D/g, ''); // Залишаємо лише цифри
      if (phoneStripped.length !== 12) { // 380 + 9 цифр
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
          client_phone: finalPhone, // 👈 ОСЬ ТУТ ЗМІНА
          client_email: null,
          booking_date: apptForm.date,
          start_time: startTimeStr,
          end_time: endTimeStr,
          status: 'confirmed'
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
                phone: existingClient.phone || finalPhone // 🟢 Оновлюємо номер, якщо він був порожній
              }).eq('id', existingClient.id);
            } else {
              const { error: insertError } = await supabase.from('clients').insert([{
                business_id: business.id,
                name: name,
                phone: finalPhone, // 🟢 Зберігаємо ВАЛІДНИЙ номер
                last_visit: safeDate,
                visits: 1,
                spent: servicePrice
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
        setApptForm({ client_name: '', client_phone: '+380', service_id: '', staff_id: '', date: toLocalDateStr(currentDate), time: '10:00', block_reason: '', duration: 60 });
        setIsBlockMode(false);
      }
    } catch (err: any) {
      console.error("Системна помилка створення запису:", err);
      alert(`Критична помилка: ${err.message || 'Невідома помилка'}`);
    }
  };

  const handleUpdateBookingStatus = async (newStatus: string) => {
    if (!selectedBooking) return;

    // 🟢 Якщо клікнули на той самий статус - скидаємо його на базовий ('confirmed')
    const finalStatus = selectedBooking.status === newStatus ? 'confirmed' : newStatus;

    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: finalStatus })
        .eq('id', selectedBooking.id);

      if (error) throw error;

      setAppointments(prev => prev.map(app =>
        app.id === selectedBooking.id ? { ...app, status: finalStatus } : app
      ));
      setSelectedBooking({ ...selectedBooking, status: finalStatus });

    } catch (err) {
      console.error(err);
      alert("Помилка при оновленні статусу запису.");
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === 'completed') return <span title="Завершено" style={{color: '#16a34a', display: 'flex', alignItems: 'center'}}><Icons.CheckCircle /></span>;
    if (status === 'late') return <span title="Запізнюється" style={{color: '#d97706', display: 'flex', alignItems: 'center'}}><Icons.AlertCircle /></span>;
    if (status === 'no-show') return <span title="Не прийшов" style={{color: '#dc2626', display: 'flex', alignItems: 'center'}}><Icons.XCircle /></span>;
    return null;
  };

  const getSmartAdvice = () => {
    if (!business || !services) return { title: "Завантаження...", text: "Аналізуємо ваші дані..." };
    if (services.length === 0) {
      return {
        title: "Час заробляти!",
        text: "Прайс-лист порожній. Додайте перші 3-4 послуги, щоб клієнти могли бронювати час онлайн."
      };
    }

    const prices = services.map(s => s.price);
    const durations = services.map(s => s.duration);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const maxPrice = Math.max(...prices);

    if (services.length < 3) {
      return {
        title: "Розширте асортимент",
        text: "У вас мало послуг. Спробуйте додати супутні сервіси (наприклад, догляд або стайлінг), щоб збільшити середній чек."
      };
    }

    const hasQuickAddons = durations.some(d => d <= 15);
    if (!hasQuickAddons) {
      return {
        title: "Швидкі послуги",
        text: "У вас немає послуг коротше 15 хвилин. Додайте 'Експрес-догляд' або швидкі додаткові послуги, які клієнт може докупити прямо в кріслі."
      };
    }

    if (maxPrice < avgPrice * 1.5) {
      return {
        title: "Преміум-сегмент",
        text: "Ваші ціни дуже схожі. Додайте 'VIP-комплекс' або авторську послугу за вищою ціною. Навіть якщо її братимуть рідше, це підніме цінність базових послуг в очах клієнта."
      };
    }

    const hasCombo = services.some(s => s.name.toLowerCase().includes('комплекс') || s.name.toLowerCase().includes('комбо') || s.name.toLowerCase().includes('+'));
    if (!hasCombo) {
      return {
        title: "Продавайте комплексами",
        text: "Об'єднайте популярні послуги у 'Комплекс' (наприклад, 'Стрижка + Борода') зі знижкою 5-10%. Це найпростіший спосіб підвищити продажі."
      }
    }

    return {
      title: "Ідеальний баланс",
      text: "Ваш прайс-лист виглядає чудово збалансованим! Рекомендуємо раз на місяць аналізувати статистику, щоб виявляти найбільш прибуткові послуги."
    };
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

  const handleDragEnd = async () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const newServices = [...services];
      const [draggedItem] = newServices.splice(draggedIndex, 1);
      newServices.splice(dragOverIndex, 0, draggedItem);
      // Миттєво оновлюємо інтерфейс
      setServices(newServices);

      // Фоново зберігаємо новий порядок в Supabase
      if (business) {
        const updatePromises = newServices.map((srv, idx) =>
          supabase.from('services').update({ order_index: idx }).eq('id', srv.id)
        );

        const results = await Promise.all(updatePromises);

        // Перевіряємо, чи не було помилок при збереженні
        const hasErrors = results.some(res => res.error);
        if (hasErrors) {
          console.error("Не вдалося зберегти порядок у базу даних. Перевір SQL-запит.");
        }
      }
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const getUserInitials = (name: string) => {
    if (!name) return 'В';
    const parts = name.split(' ');
    return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0][0].toUpperCase();
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'cover' | 'workplace') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      if (type === 'logo') {
        setLogo(base64String);
        if (business) await supabase.from('businesses').update({ logo: base64String }).eq('id', business.id);
      } else if (type === 'cover') {
        setCoverPhoto(base64String);
        if (business) await supabase.from('businesses').update({ cover_photo: base64String }).eq('id', business.id);
      } else if (type === 'workplace') {
        const newWP = [...workplacePhotos, base64String];
        setWorkplacePhotos(newWP);
        if (business) await supabase.from('businesses').update({ workplace_photos: newWP }).eq('id', business.id);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeWorkplacePhoto = async (indexToRemove: number) => {
    const newWP = workplacePhotos.filter((_, idx) => idx !== indexToRemove);
    setWorkplacePhotos(newWP);
    if (business) {
      await supabase.from('businesses').update({ workplace_photos: newWP }).eq('id', business.id);
    }
  };

const handleQuickAdd = (hour: number, targetDate: Date = currentDate) => {
    // 🟢 ПЕРЕВІРКА НА ВИХІДНИЙ
    let currentEffectiveShifts = shifts;
    // 🟢 ЯКЩО АКТИВНЕ КОПІЮВАННЯ ВІЗИТУ
    if (clipboardApp) {
       setApptForm({
         client_name: clipboardApp.client_name,
         client_phone: clipboardApp.client_phone || '+380',
         service_id: clipboardApp.service_id,
         staff_id: filterMaster !== 'all' ? filterMaster : clipboardApp.staff_id,
         date: toLocalDateStr(targetDate),
         time: `${hour.toString().padStart(2, '0')}:00`,
         block_reason: '',
         duration: clipboardApp.duration || 60
       });
       setIsBlockMode(false);
       setIsApptModalOpen(true);
       setClipboardApp(null);
       return;
    }
    if (filterMaster !== 'all') {
       const m = team.find(t => String(t.id) === String(filterMaster));
       if (m && m.shifts && m.shifts.length === 7) currentEffectiveShifts = m.shifts;
    }

    const shiftIdx = targetDate.getDay() === 0 ? 6 : targetDate.getDay() - 1;
    const shift = currentEffectiveShifts[shiftIdx];

    if (!shift.active) {
       if (!confirm("⚠️ Увага! У цей день у майстра (або закладу) ВИХІДНИЙ.\n\nБажаєте все одно створити запис поза графіком?")) return;
    }

    const displayHour = hour % 24;
    setApptForm({
      client_name: '',
      client_phone: '+380',
      service_id: '',
      block_reason: '',
      duration: 60,
      date: toLocalDateStr(targetDate),
      time: `${displayHour.toString().padStart(2, '0')}:00`,
      staff_id: filterMaster !== 'all' ? filterMaster : ''
    });
    setIsBlockMode(false);
    setIsApptModalOpen(true);
  };

  const openBookingDetails = (app: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBooking(app);
    setIsBookingDetailsModalOpen(true);
  };

// 🟢 СТАН ДЛЯ DRAG-AND-DROP ТА АНІМАЦІЙ
  const [dragConfirmData, setDragConfirmData] = useState<{app: any, targetDate: Date, newStart: string, newEnd: string} | null>(null);

  // 🟢 ЛОГІКА DRAG-AND-DROP (Розумний снайпінг по 15 хв)
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
       const snappedM = Math.floor(y / 15) * 15; // Дасть 0, 15, 30 або 45

       newStartH = targetHour;
       newStartM = snappedM;
    }

    const [oldStartH, oldStartM] = app.start_time.split(':').map(Number);
    const [oldEndH, oldEndM] = app.end_time.split(':').map(Number);
    let duration = (oldEndH * 60 + oldEndM) - (oldStartH * 60 + oldStartM);
    if (duration < 0) duration += 24 * 60;

    // Захист: якщо тривалість була зламана (NaN), беремо стандартну
    if (isNaN(duration) || duration <= 0) {
        const srv = services.find(s => String(s.id) === String(app.service_id));
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

  // 🟢 ПІДТВЕРДЖЕННЯ ПЕРЕНЕСЕННЯ
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

  // 🟢 ЗМІНА ЧАСУ З ДЕТАЛЕЙ ЗАПИСУ (ЗАХИСТ ВІД NaN)
  const handleUpdateBookingTime = async (newStartTime: string) => {
     // Чекаємо, поки користувач введе час повністю (формат HH:MM)
     if (!selectedBooking || !newStartTime || newStartTime.length !== 5 || !newStartTime.includes(':')) return;

     const [h, m] = newStartTime.split(':').map(Number);
     if (isNaN(h) || isNaN(m)) return;

     const [oldStartH, oldStartM] = selectedBooking.start_time.split(':').map(Number);
     const [oldEndH, oldEndM] = selectedBooking.end_time.split(':').map(Number);

     let duration = (oldEndH * 60 + oldEndM) - (oldStartH * 60 + oldStartM);
     if (duration < 0) duration += 24 * 60;

     // Якщо тривалість вже зламана (NaN), відновлюємо її з послуги
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
      if (error) throw error;

      setAppointments(prev => prev.filter(a => a.id !== selectedBooking.id));
      setIsBookingDetailsModalOpen(false);
      setSelectedBooking(null);
    } catch (err) {
      console.error(err);
      alert("Помилка при скасуванні. Перевірте консоль.");
    }
  };

  const getPageHeader = () => {
    if (activeTab === 'Settings') return { title: 'Налаштування', desc: 'Керування параметрами та даними вашого бізнесу' };
    if (activeTab === 'Storefront') return { title: 'Редактор профілю закладу', desc: 'Редагуйте інформацію прямо тут. Зміни відобразяться на сторінці вашого закладу.' };
    if (activeTab === 'Stats') return { title: 'Статистика та звіти', desc: 'Детальна аналітика роботи вашого бізнесу.' };
    if (activeTab === 'Services') return { title: 'Прайс-лист послуг', desc: 'Керуйте своїми послугами, цінами та порядком відображення.' };
    if (activeTab === 'Calendar') return { title: 'Журнал записів', desc: 'Керуйте розкладом та переглядайте майбутні візити клієнтів.' };
    if (activeTab === 'Clients') return { title: 'Клієнтська база', desc: 'Управління вашими клієнтами, нотатками та історією візитів.' };
    return { title: navItems.find(item => item.id === activeTab)?.label || '', desc: `Керування даними закладу "${business?.name}"` };
  };

// --- ДИНАМІЧНИЙ РОЗРАХУНОК СІТКИ ЧАСУ ---
  const effectiveShifts = (() => {
    if (filterMaster !== 'all') {
      const m = team.find(t => String(t.id) === String(filterMaster));
      if (m && m.shifts && m.shifts.length === 7) return m.shifts;
    }
    return shifts; // fallback на загальний графік закладу
  })();

  const activeShifts = effectiveShifts.filter((s: any) => s.active);
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
    const d = new Date(currentDate);
    d.setDate(currentDate.getDate() - currentDayIndex + i);
    return d;
  });
  const isCurrentWeek = weekDays.some(wd => wd.toDateString() === now.toDateString());

  const renderNonWorkingHours = (shift: any) => {
    if (!shift.active) {
      return <div className="non-working-bg" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 1, pointerEvents: 'none' }}></div>;
    }

    const [startH, startM] = shift.start.split(':').map(Number);
    const [endH, endM] = shift.end.split(':').map(Number);

    const adjustedStartH = startH < gridStartHour ? startH + 24 : startH;
    const adjustedEndH = endH <= startH ? endH + 24 : endH;

    const startPx = Math.max(0, (adjustedStartH - gridStartHour) * 60 + startM);
    const endPx = Math.max(0, (adjustedEndH - gridStartHour) * 60 + endM);
    const totalPx = gridTotalHours * 60;

    return (
      <>
        {startPx > 0 && <div className="non-working-bg" style={{ position: 'absolute', top: 0, height: startPx, left: 0, right: 0, zIndex: 1, pointerEvents: 'none' }}></div>}
        {endPx < totalPx && <div className="non-working-bg" style={{ position: 'absolute', top: endPx, bottom: 0, left: 0, right: 0, zIndex: 1, pointerEvents: 'none' }}></div>}
      </>
    )
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
      if (adjustedEndH < adjustedStartH || (adjustedEndH === adjustedStartH && endM < startM)) {
         adjustedEndH += 24;
      }
      durationMins = (adjustedEndH - adjustedStartH) * 60 + (endM - startM);
    }

    return { top: topPx, height: durationMins };
  };

  // --- АЛГОРИТМ ДЛЯ ОБЧИСЛЕННЯ НАКЛАДАНЬ ЗАПИСІВ (OVERLAPS) ---
  const processOverlaps = (appsForDay: any[]) => {
    const processed = appsForDay.map(app => {
      const serviceDuration = services.find(s => String(s.id) === String(app.service_id))?.duration || app.duration || 60;
      const pos = getCardPosition(app.start_time, app.end_time, serviceDuration);
      return { ...app, startMins: pos.top, endMins: pos.top + pos.height, topPx: pos.top, heightPx: pos.height };
    }).sort((a, b) => a.startMins - b.startMins || (b.endMins - b.startMins) - (a.endMins - a.startMins));

    const groups: any[][] = [];
    let currentGroup: any[] = [];
    let groupEnd = 0;

    processed.forEach(app => {
      if (app.startMins >= groupEnd) {
        if (currentGroup.length > 0) groups.push(currentGroup);
        currentGroup = [app];
        groupEnd = app.endMins;
      } else {
        currentGroup.push(app);
        groupEnd = Math.max(groupEnd, app.endMins);
      }
    });
    if (currentGroup.length > 0) groups.push(currentGroup);

    groups.forEach(group => {
      const columns: any[][] = [];
      group.forEach(app => {
        let placed = false;
        for (let i = 0; i < columns.length; i++) {
          const col = columns[i];
          const lastApp = col[col.length - 1];
          if (lastApp.endMins <= app.startMins) {
            col.push(app);
            app.colIndex = i;
            placed = true;
            break;
          }
        }
        if (!placed) {
          columns.push([app]);
          app.colIndex = columns.length - 1;
        }
      });
      group.forEach(app => {
        app.colCount = columns.length;
      });
    });

    return processed;
  };

  const getMasterColor = (staffId: string) => {
    if (!staffId) return { pastelBg: '#f1f5f9', pastelBorder: '#cbd5e1', pastelText: '#475569', vividBg: '#64748b', vividBorder: '#475569' };
    const masterIndex = team.findIndex(m => String(m.id) === String(staffId));
    if (masterIndex === -1) return MASTER_COLORS[0];
    return MASTER_COLORS[masterIndex % MASTER_COLORS.length];
  };

  // 🟢 НОВА ЛОГІКА КОЛІРНОГО КОДУВАННЯ (Master або Category/Service)
  const getCardColor = (staffId: string, serviceId?: string) => {
    if (calSettings.colorMode === 'category' && serviceId) {
      const srv = services.find(s => String(s.id) === String(serviceId));
      // Хешуємо за категорією, а якщо її немає - за назвою послуги або ID
      const identifier = srv?.category?.trim() || srv?.name?.trim() || String(serviceId);
      let hash = 0;
      for (let i = 0; i < identifier.length; i++) hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
      const index = Math.abs(hash) % MASTER_COLORS.length;
      return MASTER_COLORS[index];
    }
    return getMasterColor(staffId);
  };

  const handleContextMenu = (e: React.MouseEvent, app: any) => {
    e.preventDefault(); e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, app });
  };

  const selectedDateStr = formatDateKey(currentDate);
  const tasksForSelectedDay = tasks.filter(t => t.date === selectedDateStr);

  // --- ФІЛЬТРАЦІЯ ЗАПИСІВ ---
  const filteredAppointments = appointments.filter(app => {
    // Якщо це перерва/блокування для всього закладу (без конкретного майстра) - показуємо її завжди
    const isGlobalBlock = (app.status === 'blocked' || app.color === 'blocked') && !app.staff_id;
    if (isGlobalBlock) return true;

    // Інакше застосовуємо фільтр по майстру
    if (filterMaster !== 'all' && String(app.staff_id) !== String(filterMaster)) return false;
    return true;
  });

  const currentViewAppointmentsCount = filteredAppointments.filter(app => {
    if (app.status === 'blocked' || app.color === 'blocked') return false;

    if (calendarView === 'day') {
      return checkSameDay(app.booking_date || app.start_time, currentDate);
    } else if (calendarView === 'week') {
      return weekDays.some(wd => checkSameDay(app.booking_date || app.start_time, wd));
    } else if (calendarView === 'month') {
      const appDateObj = new Date(app.booking_date || app.start_time);
      return appDateObj.getMonth() === currentDate.getMonth() && appDateObj.getFullYear() === currentDate.getFullYear();
    }
    return false;
  }).length;

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

        .month-view-cell { border-right: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 0.5rem; cursor: pointer; transition: 0.2s; background-color: #ffffff; position: relative; }
        .month-view-cell:hover { background-color: #f1f5f9; }

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
      <aside style={{ width: isSidebarCollapsed ? '80px' : '260px', backgroundColor: '#ffffff', borderRight: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', flexShrink: 0, transition: 'width 0.3s cubic-bezier(0.25, 1, 0.5, 1)', zIndex: 100 }}>

        {/* 1. ВИБІР БІЗНЕСУ (На самому верху, як у референсі) */}
        <div style={{ position: 'relative', padding: isSidebarCollapsed ? '1rem 0.5rem' : '1rem' }} ref={bizMenuRef}>
          <div
            onClick={() => setIsBizMenuOpen(!isBizMenuOpen)}
            style={{ backgroundColor: isBizMenuOpen ? '#f8fafc' : 'transparent', borderRadius: '10px', padding: isSidebarCollapsed ? '0.5rem 0' : '0.5rem 0.8rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'space-between', cursor: 'pointer', transition: 'all 0.2s', position: 'relative', zIndex: 51 }}
            onMouseOver={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
            onMouseOut={e => { if (!isBizMenuOpen) e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: isSidebarCollapsed ? '0' : '0.75rem', justifyContent: 'center' }}>
              {/* Аватарка Бізнесу */}
              <div style={{ flexShrink: 0, width: '32px', height: '32px', borderRadius: '8px', backgroundColor: logo ? 'transparent' : '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: '800', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                {logo ? <img src={logo} alt="Лого" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : business?.name?.charAt(0).toUpperCase() || 'B'}
              </div>
              {/* Назва Бізнесу */}
              <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', opacity: isSidebarCollapsed ? 0 : 1, width: isSidebarCollapsed ? 0 : '120px', transform: isSidebarCollapsed ? 'translateX(-10px)' : 'translateX(0)', transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)' }}>
                <div style={{ color: '#0f172a', fontSize: '0.95rem', fontWeight: '700', textOverflow: 'ellipsis', overflow: 'hidden' }}>{business?.name || 'Завантаження'}</div><div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: '500' }}>{userProfile?.role === 'vendor' ? 'Pro Plan' : 'Майстер'}</div>
              </div>
            </div>
            <div style={{ color: '#94a3b8', flexShrink: 0, opacity: isSidebarCollapsed ? 0 : 1, width: isSidebarCollapsed ? 0 : 'auto', overflow: 'hidden', transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)', transform: isBizMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <Icons.ChevronDown />
            </div>
          </div>

          {/* Випадаюче меню бізнесів */}
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
                    onClick={() => { setIsBizMenuOpen(false); if (!isActive) loadSpecificBusiness(biz.id); }}
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

        {/* 2. НАВІГАЦІЯ (Повітряна, світло-сірий Active State) */}
        <nav className="custom-scroll" style={{ flex: 1, overflowY: 'auto', padding: isSidebarCollapsed ? '0 0.5rem' : '0 0.8rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {!isSidebarCollapsed && <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase', padding: '0.5rem 0.8rem', marginTop: '0.5rem' }}>Робоче середовище</div>}

          {navItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => { setActiveTab(item.id); localStorage.setItem('bookera_activeTab', item.id); }} title={isSidebarCollapsed ? item.label : ''} style={{ display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start', width: '100%', padding: isSidebarCollapsed ? '0.75rem 0' : '0.6rem 0.8rem', backgroundColor: isActive ? '#f1f5f9' : 'transparent', border: 'none', borderRadius: '10px', cursor: 'pointer', color: isActive ? '#0f172a' : '#64748b', transition: 'all 0.2s ease', textAlign: 'left' }} onMouseOver={e => { if (!isActive) { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.color = '#0f172a'; } }} onMouseOut={e => { if (!isActive) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#64748b'; } }}>
                <div style={{ flexShrink: 0, color: isActive ? '#0f172a' : '#94a3b8', display: 'flex', transition: '0.2s' }}>
                  <item.icon />
                </div>
                <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', opacity: isSidebarCollapsed ? 0 : 1, width: isSidebarCollapsed ? 0 : '100%', marginLeft: isSidebarCollapsed ? 0 : '0.8rem', transform: isSidebarCollapsed ? 'translateX(-10px)' : 'translateX(0)', transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: isActive ? '700' : '500' }}>{item.label}</span>
                </div>
              </button>
            );
          })}
        </nav>

        {/* 3. ПРОФІЛЬ ТА КНОПКА ЗГОРТАННЯ (Внизу) */}
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: 'auto' }}>

          {/* Кнопка згортання */}
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start', padding: '0.6rem', borderRadius: '8px', transition: '0.2s', gap: '0.8rem', width: '100%' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
            <Icons.SidebarToggle collapsed={isSidebarCollapsed} />
            {!isSidebarCollapsed && <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>Згорнути меню</span>}
          </button>

          <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '0.2rem 0' }}></div>

          {/* ПРОФІЛЬ КОРИСТУВАЧА */}
          <div style={{ position: 'relative' }} ref={profileMenuRef}>
            <div onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)} style={{ padding: isSidebarCollapsed ? '0.6rem 0' : '0.5rem', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start', gap: isSidebarCollapsed ? '0' : '0.75rem', cursor: 'pointer', transition: '0.2s', backgroundColor: isProfileMenuOpen ? '#f8fafc' : 'transparent' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseOut={e => { if(!isProfileMenuOpen) e.currentTarget.style.backgroundColor = 'transparent' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#0f172a', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.85rem', flexShrink: 0 }}>
                {getUserInitials(userProfile?.full_name)}
              </div>
              <div style={{ flex: isSidebarCollapsed ? 'none' : 1, overflow: 'hidden', opacity: isSidebarCollapsed ? 0 : 1, width: isSidebarCollapsed ? 0 : '100%', transform: isSidebarCollapsed ? 'translateX(-10px)' : 'translateX(0)', transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)' }}>
                <div style={{ color: '#0f172a', fontSize: '0.9rem', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userProfile?.full_name || 'Користувач'}</div>
                <div style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: '500', whiteSpace: 'nowrap' }}>{userProfile?.role === 'vendor' ? 'Власник' : 'Майстер'}</div>
              </div>
            </div>

            {/* Випадаюче меню профілю (Відкривається вгору) */}
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
      <main className="custom-scroll" style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f8fafc', overflowY: 'auto', position: 'relative' }}>

        {/* Хедер - показуємо тільки якщо це не Календар, Клієнти, Статистика, Команда, Маркетинг АБО НАЛАШТУВАННЯ */}
        {activeTab !== 'Calendar' && activeTab !== 'Clients' && activeTab !== 'Stats' && activeTab !== 'Team' && activeTab !== 'Marketing' && activeTab !== 'Settings' && (
          <header style={{ padding: '2rem 3rem 1.5rem 3rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', zIndex: 10 }}>
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

              {/* Віджет Задачі (To-Do) */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontWeight: '700', color: '#0f172a', marginBottom: '1rem', fontSize: '0.95rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Справи на {isToday ? 'сьогодні' : currentDate.toLocaleDateString('uk-UA', {day: 'numeric', month: 'short'})}
                  <button onClick={handleAddTaskClick} style={{ background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
                    <Icons.Plus />
                  </button>
                </div>

                <div className="custom-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.2rem' }}>
                  {tasksForSelectedDay.length === 0 && !isAddingTask && (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8', fontSize: '0.85rem', border: '1px dashed #e2e8f0', borderRadius: '12px' }}>
                      Немає завдань на цей день.<br/>Натисніть <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>+</span> щоб додати.
                    </div>
                  )}

                  {tasksForSelectedDay.map(task => {
                    const isOverdue = task.date < realTodayStr && !task.completed;
                    const isEditing = editingTaskId === task.id;

                    return (
                      <div key={task.id} style={{
                        background: task.completed ? '#f8fafc' : (isOverdue ? '#fef2f2' : '#ffffff'),
                        border: '1px solid',
                        borderColor: task.completed ? '#f1f5f9' : (isOverdue ? '#fca5a5' : '#e2e8f0'),
                        borderRadius: '8px', padding: '0.75rem', display: 'flex', gap: '0.6rem', alignItems: 'flex-start',
                        transition: '0.2s', opacity: task.completed ? 0.6 : 1
                      }}>
                        <input type="checkbox" checked={task.completed} onChange={() => toggleTask(task.id)} style={{ marginTop: '0.2rem', accentColor: isOverdue ? '#ef4444' : '#0f172a', cursor: 'pointer', width: '16px', height: '16px', flexShrink: 0 }} />
                        {isEditing ? (
                           <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.3rem', minWidth: 0 }}>
                             <input autoFocus type="text" value={editingTaskText} onChange={e => setEditingTaskText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEditedTask(task.id); if (e.key === 'Escape') setEditingTaskId(null); }} style={{ flex: 1, minWidth: 0, border: '1px solid #3b82f6', borderRadius: '4px', padding: '0.25rem 0.4rem', fontSize: '0.85rem', outline: 'none', color: '#0f172a' }} />
                             <div style={{ display: 'flex', gap: '0.1rem', flexShrink: 0 }}>
                               <button onClick={() => saveEditedTask(task.id)} className="action-icon-btn" style={{ padding: '0.2rem', color: '#10b981' }}><Icons.CheckCircle /></button>
                               <button onClick={() => setEditingTaskId(null)} className="action-icon-btn" style={{ padding: '0.2rem', color: '#ef4444' }}><Icons.XCircle /></button>
                             </div>
                           </div>
                        ) : (
                           <>
                             <div style={{ fontSize: '0.85rem', color: task.completed ? '#94a3b8' : (isOverdue ? '#b91c1c' : '#334155'), lineHeight: '1.4', textDecoration: task.completed ? 'line-through' : 'none', flex: 1, wordBreak: 'break-word' }}>
                               {task.text}
                               {isOverdue && <span style={{ display: 'block', fontSize: '0.7rem', color: '#ef4444', marginTop: '4px', fontWeight: 'bold' }}>(Протерміновано)</span>}
                             </div>
                             <div style={{ display: 'flex', gap: '0.2rem', opacity: task.completed ? 0.3 : 1 }}>
                               <button onClick={() => startEditTask(task)} className="action-icon-btn" style={{ padding: '0.3rem' }}><Icons.Edit /></button>
                               <button onClick={() => deleteTask(task.id)} className="action-icon-btn delete" style={{ padding: '0.3rem' }}><Icons.Trash /></button>
                             </div>
                           </>
                        )}
                      </div>
                    );
                  })}

                  {isAddingTask && (
                    <div style={{ background: '#ffffff', border: '1px solid #3b82f6', borderRadius: '8px', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', boxShadow: '0 2px 8px rgba(59,130,246,0.1)' }}>
                      <input autoFocus type="text" value={newTaskText} onChange={e => setNewTaskText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveNewTask(); if (e.key === 'Escape') setIsAddingTask(false); }} placeholder="Що потрібно зробити?" style={{ border: 'none', outline: 'none', fontSize: '0.85rem', width: '100%', color: '#0f172a' }} />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button onClick={() => setIsAddingTask(false)} style={{ background: 'transparent', border: 'none', fontSize: '0.75rem', color: '#64748b', cursor: 'pointer', fontWeight: '600' }}>Скасувати</button>
                        <button onClick={saveNewTask} style={{ background: '#3b82f6', border: 'none', fontSize: '0.75rem', color: '#fff', cursor: 'pointer', borderRadius: '4px', padding: '0.3rem 0.6rem', fontWeight: '600' }}>Зберегти</button>
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
                    {/* Менше виділяється: прибрали зайві рамки та тіні */}
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }} ref={masterFilterRef}>
                      <div
                        onClick={() => setIsMasterFilterOpen(!isMasterFilterOpen)}
                        // 🟢 ОНОВЛЕНО: Прибрали minWidth та space-between. Трохи зменшили gap і збільшили бокові padding для клікабельності.
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'transparent', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600', color: '#475569', cursor: 'pointer', transition: '0.2s' }}
                        onMouseOver={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                        onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {filterMaster !== 'all' && (
                            <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: '800' }}>
                              {getUserInitials(team.find(m => String(m.id) === String(filterMaster))?.name || '')}
                            </div>
                          )}
                          {filterMaster === 'all' ? 'Усі майстри' : team.find(m => String(m.id) === String(filterMaster))?.name || 'Усі майстри'}
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
                          {team.map(m => (
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

                  {/* Компактний список-перемикач видів без важкого фону */}
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

              {/* 🟢 ОБГОРТКА ДЛЯ АНІМАЦІЇ */}
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

                      {/* Записи ДЕНЬ з Drag-and-Drop */}
                      {processOverlaps(filteredAppointments.filter(app => checkSameDay(app.booking_date || app.start_time, currentDate))).map(app => {
                        const serviceName = services.find(s => String(s.id) === String(app.service_id))?.name || app.service_name;
                        const staffName = team.find(m => String(m.id) === String(app.staff_id))?.name || app.master_name || 'Без майстра';
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

                        {/* 🟢 ЧЕРВОНА ЛІНІЯ НА ВЕСЬ ТИЖДЕНЬ */}
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

                                {/* Записи ТИЖДЕНЬ з Drag-and-Drop */}
                                {processOverlaps(dayApps).map(app => {
                                  const service = services.find(s => String(s.id) === String(app.service_id));
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

                    {/* 🟢 ДОДАНО: flexShrink: 0, щоб шапка ніколи не сплющувалась */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #f1f5f9', textAlign: 'center', fontWeight: '600', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '1rem 0', flexShrink: 0 }}>
                       <div>Пн</div><div>Вт</div><div>Ср</div><div>Чт</div><div>Пт</div><div>Сб</div><div>Нд</div>
                    </div>

                    {/* 🟢 ОНОВЛЕНО: Додано className="custom-scroll", overflowY: 'auto' та gridAutoRows: 'minmax(130px, 1fr)' */}
                    <div className="custom-scroll" style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(130px, 1fr)', overflowY: 'auto' }}>
                        {blanks.map(blank => <div key={`blank-${blank}`} style={{ borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', backgroundColor: '#fafafa' }}></div>)}

                        {days.map(day => {
                            const dObj = new Date(currentYear, currentMonth, day);
                            // ... далі йде твій старий код без змін ...
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
                                            <div key={app.id} draggable={!isBlock} onDragStart={(e) => { e.stopPropagation(); setIsDragging(true); e.dataTransfer.setData('text/plain', String(app.id)); }} onDragEnd={() => setIsDragging(false)} onClick={(e) => openBookingDetails(app, e)}
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

            <button className="fab-button" title="Новий запис" onClick={() => { setApptForm({ client_name: '', client_phone: '+380', service_id: '', staff_id: filterMaster !== 'all' ? filterMaster : '', date: toLocalDateStr(currentDate), time: '10:00', block_reason: '', duration: 60 }); setIsBlockMode(false); setIsApptModalOpen(true); }}>
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
                              onClick={async () => {
                                setServiceSortType(option.value);
                                setIsSortDropdownOpen(false);
                                // Зберігаємо вибір у базу даних
                                if (business) {
                                  const { error } = await supabase.from('businesses').update({ service_sort_type: option.value }).eq('id', business.id);
                                  if (error) console.error("Помилка збереження типу сортування:", error);
                                }
                              }}
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
            <div style={{ width: '100%', maxWidth: '1100px', display: 'flex', flexDirection: 'column', gap: '3rem' }}>

              {/* Менеджер фотографій (Візуальне відображення) */}
              <div
                className="editable-block"
                style={{
                  height: '380px',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  background: coverPhoto ? `url(${coverPhoto}) center/cover` : '#f1f5f9',
                  display: 'flex',
                  alignItems: 'flex-end',
                  padding: '2rem',
                  border: coverPhoto ? 'none' : '2px dashed #cbd5e1'
                }}
              >
                {!coverPhoto && (
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#94a3b8', textAlign: 'center' }}>
                    <Icons.Image />
                    <div style={{ fontWeight: '600', marginTop: '0.5rem' }}>Завантажте обкладинку</div>
                  </div>
                )}
                <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: logo ? `url(${logo}) center/cover` : '#ffffff', border: '4px solid #ffffff', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                  {!logo && <div style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: '600' }}>Лого</div>}
                </div>

                <div className="edit-overlay" onClick={() => setIsPhotoModalOpen(true)}>
                  <button className="edit-btn"><Icons.Camera /> Керувати фотографіями</button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
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
                    <div className="edit-overlay" onClick={() => { setActiveTab('Services'); localStorage.setItem('bookera_activeTab', 'Services'); }}>
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
                              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#f1f5f9', color: '#64748b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                {staff.avatar_url ? <img src={staff.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Avatar"/> : <Icons.User />}
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
                      <div className="edit-overlay" onClick={() => { setActiveTab('Team'); localStorage.setItem('bookera_activeTab', 'Team'); }}>
                        <button className="edit-btn"><Icons.Edit /> Керувати персоналом</button>
                      </div>
                    </div>

                    {/* Інтерактивна карта (Google Maps Embed) */}
                    <div className="client-white-card editable-block" style={{ padding: 0, overflow: 'hidden', height: '250px' }}>
                      <iframe
                        width="100%"
                        height="100%"
                        style={{ border: 0, pointerEvents: 'none' }}
                        loading="lazy"
                        allowFullScreen
                        referrerPolicy="no-referrer-when-downgrade"
                        src={`https://maps.google.com/maps?q=${encodeURIComponent(formData.address || 'Київ')}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                      ></iframe>

                      <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10 }}>
                        <button
                          onClick={() => {
                            if (formData.address) {
                              window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(formData.address)}`, '_blank');
                            } else {
                              alert('Спочатку вкажіть адресу закладу');
                            }
                          }}
                          style={{ padding: '0.5rem 0.8rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', color: '#3b82f6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                        >
                          Відкрити на Картах <Icons.Globe />
                        </button>
                      </div>

                      <div className="edit-overlay" onClick={() => {
                        const addrInput = document.querySelector('input[name="address"]') as HTMLInputElement;
                        if (addrInput) {
                          addrInput.focus();
                          addrInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }}>
                        <button className="edit-btn"><Icons.Edit /> Змінити адресу</button>
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
          <div style={{ padding: '2rem 3rem', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', maxWidth: '1440px', margin: '0 auto', width: '100%', backgroundColor: '#fafafa' }}>

            {/* --- ХЕДЕР ТА УПРАВЛІННЯ ЧАСОМ --- */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>Статистика та звіти</h2>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ display: 'flex', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.2rem' }}>
                  {[
                    { id: 'day', label: 'День' },
                    { id: 'week', label: 'Тиждень' },
                    { id: 'month', label: 'Місяць' },
                    { id: 'year', label: 'Рік' }
                  ].map(pt => (
                    <button
                      key={pt.id} onClick={() => { setStatsPeriodType(pt.id as any); setStatsDate(new Date()); setStatsCurrentPage(1); setSortConfig(null); }}
                      style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', fontWeight: '700', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: '0.2s', background: statsPeriodType === pt.id ? '#0f172a' : 'transparent', color: statsPeriodType === pt.id ? '#ffffff' : '#64748b' }}
                    >
                      {pt.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <button onClick={() => {
                      const nd = new Date(statsDate);
                      if (statsPeriodType === 'day') nd.setDate(nd.getDate() - 1);
                      if (statsPeriodType === 'week') nd.setDate(nd.getDate() - 7);
                      if (statsPeriodType === 'month') nd.setMonth(nd.getMonth() - 1);
                      if (statsPeriodType === 'year') nd.setFullYear(nd.getFullYear() - 1);
                      setStatsDate(nd); setStatsCurrentPage(1); setSortConfig(null);
                    }} style={{ background: 'transparent', border: 'none', borderRight: '1px solid #e2e8f0', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}
                  ><Icons.ChevronLeft /></button>

                  <div style={{ padding: '0 1.2rem', fontSize: '0.9rem', fontWeight: '700', color: '#0f172a', minWidth: '160px', textAlign: 'center' }}>
                    {(() => {
                      if (statsPeriodType === 'day') return statsDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
                      if (statsPeriodType === 'month') return statsDate.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });
                      if (statsPeriodType === 'year') return statsDate.getFullYear();
                      if (statsPeriodType === 'week') {
                        const d = new Date(statsDate);
                        const day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6:1);
                        const mon = new Date(d.setDate(diff)); const sun = new Date(d.setDate(diff + 6));
                        return `${mon.getDate()} ${mon.toLocaleDateString('uk-UA',{month:'short'})} - ${sun.getDate()} ${sun.toLocaleDateString('uk-UA',{month:'short'})}`;
                      }
                    })()}
                  </div>

                  <button onClick={() => {
                      const nd = new Date(statsDate);
                      if (statsPeriodType === 'day') nd.setDate(nd.getDate() + 1);
                      if (statsPeriodType === 'week') nd.setDate(nd.getDate() + 7);
                      if (statsPeriodType === 'month') nd.setMonth(nd.getMonth() + 1);
                      if (statsPeriodType === 'year') nd.setFullYear(nd.getFullYear() + 1);
                      setStatsDate(nd); setStatsCurrentPage(1); setSortConfig(null);
                    }} style={{ background: 'transparent', border: 'none', borderLeft: '1px solid #e2e8f0', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#475569' }}
                  ><Icons.ChevronRight /></button>
                </div>
              </div>
            </div>

            {(() => {
              const STATS_TABS = [
                { id: 'overview', label: 'Загальний огляд' },
                { id: 'appointments', label: 'Журнал візитів' },
                { id: 'revenue', label: 'Фінансовий звіт' },
                { id: 'services', label: 'Популярність послуг' },
                { id: 'staff', label: 'Ефективність команди' },
                { id: 'clients', label: 'Аналітика клієнтів' }
              ];

              const getStartEnd = (date: Date, type: string) => {
                const start = new Date(date), end = new Date(date);
                if (type === 'day') { start.setHours(0,0,0,0); end.setHours(23,59,59,999); }
                else if (type === 'month') { start.setDate(1); start.setHours(0,0,0,0); end.setMonth(end.getMonth() + 1, 0); end.setHours(23,59,59,999); }
                else if (type === 'year') { start.setMonth(0, 1); start.setHours(0,0,0,0); end.setMonth(11, 31); end.setHours(23,59,59,999); }
                else if (type === 'week') {
                  const day = start.getDay(), diff = start.getDate() - day + (day === 0 ? -6 : 1);
                  start.setDate(diff); start.setHours(0,0,0,0); end.setDate(diff + 6); end.setHours(23,59,59,999);
                }
                return { start, end };
              };

              const currPeriod = getStartEnd(statsDate, statsPeriodType);
              const now = new Date();

              const periodApps = appointments.filter(app => {
                if (app.status === 'blocked' || app.color === 'blocked') return false;
                const d = new Date(app.booking_date || app.start_time);
                return d >= currPeriod.start && d <= currPeriod.end;
              });

              // ГЛИБОКІ ФІНАНСОВІ АГРЕГАЦІЇ
              const stTotal = periodApps.length;
              const stCompleted = periodApps.filter(a => a.status === 'completed');
              const stNoShow = periodApps.filter(a => a.status === 'no-show');
              const stCancelled = periodApps.filter(a => a.status === 'cancelled');
              const stUpcoming = periodApps.filter(a => a.status !== 'completed' && a.status !== 'no-show' && a.status !== 'cancelled');

              const totalRev = stCompleted.reduce((sum, app) => sum + (services.find(s => String(s.id) === String(app.service_id))?.price || 0), 0);
              const lostRev = [...stNoShow, ...stCancelled].reduce((sum, app) => sum + (services.find(s => String(s.id) === String(app.service_id))?.price || 0), 0);
              const expectedRev = stUpcoming.reduce((sum, app) => sum + (services.find(s => String(s.id) === String(app.service_id))?.price || 0), 0);

              let forecastRev = 0;
              if (currPeriod.start <= now && currPeriod.end >= now) {
                const daysPassed = Math.max(1, Math.ceil((now.getTime() - currPeriod.start.getTime()) / (1000 * 60 * 60 * 24)));
                const totalDays = Math.max(1, Math.ceil((currPeriod.end.getTime() - currPeriod.start.getTime()) / (1000 * 60 * 60 * 24)));
                forecastRev = Math.round((totalRev / daysPassed) * totalDays);
              } else if (currPeriod.end < now) { forecastRev = totalRev; }
              else { forecastRev = expectedRev; }

              const serviceStats: Record<string, any> = {};
              const staffStats: Record<string, any> = {};
              const clientStats: Record<string, any> = {};

              periodApps.forEach(app => {
                const isCompleted = app.status === 'completed';
                const isCancelledOrNoShow = app.status === 'cancelled' || app.status === 'no-show';
                const sId = String(app.service_id);
                const srv = services.find(s => String(s.id) === sId);
                const price = srv?.price || 0;

                if (isCompleted) {
                  if (!serviceStats[sId]) serviceStats[sId] = { name: srv?.name || app.service_name, count: 0, rev: 0 };
                  serviceStats[sId].count++; serviceStats[sId].rev += price;
                }

                const defaultOwnerName = team.length > 0 ? team[0].name : 'Власник';
                const m = app.staff_id ? team.find(t => String(t.id) === String(app.staff_id)) : null;
                const mName = m ? m.name : defaultOwnerName;
                if (!staffStats[mName]) staffStats[mName] = { name: mName, count: 0, rev: 0, services: 0 };
                if (!isCancelledOrNoShow) staffStats[mName].count++;
                if (isCompleted) { staffStats[mName].rev += price; staffStats[mName].services++; }

                if (isCompleted) {
                  const p = app.client_phone || 'Невідомо';
                  if (!clientStats[p]) clientStats[p] = { name: app.client_name, phone: p, count: 0, rev: 0 };
                  clientStats[p].count++; clientStats[p].rev += price;
                }
              });

              let topServicesArr = Object.values(serviceStats).sort((a: any, b: any) => b.rev - a.rev);
              let topStaffArr = Object.values(staffStats).filter((m: any) => m.count > 0 || m.services > 0).sort((a: any, b: any) => b.rev - a.rev);
              let topClientsArr = Object.values(clientStats).sort((a: any, b: any) => b.rev - a.rev);

              // 🟢 МЕХАНІЗМ СОРТУВАННЯ ДАНИХ
              const handleSort = (key: string) => {
                let direction: 'asc' | 'desc' = 'desc';
                if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
                  direction = 'asc';
                }
                setSortConfig({ key, direction });
              };

              const getSortedData = (data: any[]) => {
                if (!sortConfig) return data;
                return [...data].sort((a, b) => {
                  let valA = a[sortConfig.key];
                  let valB = b[sortConfig.key];

                  if (sortConfig.key === 'date') {
                    valA = new Date(a.booking_date || a.start_time).getTime();
                    valB = new Date(b.booking_date || b.start_time).getTime();
                  } else if (sortConfig.key === 'client') {
                    valA = (a.client_name || '').toLowerCase();
                    valB = (b.client_name || '').toLowerCase();
                  } else if (sortConfig.key === 'service') {
                    valA = (services.find(s => String(s.id) === String(a.service_id))?.name || a.service_name || '').toLowerCase();
                    valB = (services.find(s => String(s.id) === String(b.service_id))?.name || b.service_name || '').toLowerCase();
                  } else if (sortConfig.key === 'status') {
                    valA = a.status || ''; valB = b.status || '';
                  } else if (sortConfig.key === 'price') {
                    valA = services.find(s => String(s.id) === String(a.service_id))?.price || 0;
                    valB = services.find(s => String(s.id) === String(b.service_id))?.price || 0;
                  }

                  if (typeof valA === 'string' && typeof valB === 'string') {
                     if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                     if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                     return 0;
                  }
                  return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
                });
              };

              const sortedApps = getSortedData(periodApps);
              topServicesArr = getSortedData(topServicesArr);
              topStaffArr = getSortedData(topStaffArr);
              topClientsArr = getSortedData(topClientsArr);

              const thStyle = { padding: '1rem 0.5rem', color: '#64748b', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase' as const, letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' };

              // Клікабельний заголовок (ТІЛЬКИ для динамічних таблиць)
              const SortableTH = ({ label, sortKey, align = 'left' }: { label: string, sortKey: string, align?: string }) => (
                <th onClick={() => handleSort(sortKey)} style={{ ...thStyle, textAlign: align as any, cursor: 'pointer', userSelect: 'none', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.color = '#0f172a'} onMouseOut={e => e.currentTarget.style.color = '#64748b'}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start' }}>
                    {label}
                    <span style={{ marginLeft: '4px', fontSize: '0.85rem', color: sortConfig?.key === sortKey ? '#0f172a' : '#cbd5e1' }}>
                      {sortConfig?.key === sortKey ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </span>
                  </div>
                </th>
              );

              // Деталізація для Фінансів
              const newClientRev = topClientsArr.filter((c:any) => c.count === 1).reduce((s:number, c:any) => s + c.rev, 0);
              const returningClientRev = topClientsArr.filter((c:any) => c.count > 1).reduce((s:number, c:any) => s + c.rev, 0);
              const avgCheckCompleted = stCompleted.length > 0 ? Math.round(totalRev / stCompleted.length) : 0;
              const bestStaff = topStaffArr.length > 0 ? [...topStaffArr].sort((a:any, b:any) => b.rev - a.rev)[0] : null;

              // ДАНІ ДЛЯ ГРАФІКІВ (Години / Дні)
              let chartLabels: string[] = []; let appsData: number[] = []; let revData: number[] = []; let expRevData: number[] = []; let lostRevData: number[] = [];
              if (statsPeriodType === 'day') {
                chartLabels = Array.from({length: 13}, (_, i) => `${(i+8).toString().padStart(2, '0')}:00`);
                appsData = Array(13).fill(0); revData = Array(13).fill(0); expRevData = Array(13).fill(0); lostRevData = Array(13).fill(0);
                periodApps.forEach(app => {
                  const hour = parseInt(app.start_time.split(':')[0]);
                  if (hour >= 8 && hour <= 20) {
                    const idx = hour - 8;
                    const price = services.find(s => String(s.id) === String(app.service_id))?.price || 0;
                    appsData[idx]++;
                    if (app.status === 'completed') revData[idx] += price;
                    else if (app.status === 'no-show' || app.status === 'cancelled') lostRevData[idx] += price;
                    else expRevData[idx] += price;
                  }
                });
              } else if (statsPeriodType === 'week') {
                for(let i=0; i<7; i++) {
                  const d = new Date(currPeriod.start); d.setDate(d.getDate() + i);
                  chartLabels.push(`${d.toLocaleDateString('uk-UA', {weekday: 'short'})} ${d.getDate()}`);
                }
                appsData = Array(7).fill(0); revData = Array(7).fill(0); expRevData = Array(7).fill(0); lostRevData = Array(7).fill(0);
                periodApps.forEach(app => {
                  const d = new Date(app.booking_date || app.start_time); const idx = d.getDay() === 0 ? 6 : d.getDay() - 1;
                  const price = services.find(s => String(s.id) === String(app.service_id))?.price || 0;
                  appsData[idx]++;
                  if (app.status === 'completed') revData[idx] += price;
                  else if (app.status === 'no-show' || app.status === 'cancelled') lostRevData[idx] += price;
                  else expRevData[idx] += price;
                });
              } else if (statsPeriodType === 'month') {
                const daysInMonth = currPeriod.end.getDate();
                chartLabels = Array.from({length: daysInMonth}, (_, i) => (i + 1).toString());
                appsData = Array(daysInMonth).fill(0); revData = Array(daysInMonth).fill(0); expRevData = Array(daysInMonth).fill(0); lostRevData = Array(daysInMonth).fill(0);
                periodApps.forEach(app => {
                  const d = new Date(app.booking_date || app.start_time); const idx = d.getDate() - 1;
                  const price = services.find(s => String(s.id) === String(app.service_id))?.price || 0;
                  appsData[idx]++;
                  if (app.status === 'completed') revData[idx] += price;
                  else if (app.status === 'no-show' || app.status === 'cancelled') lostRevData[idx] += price;
                  else expRevData[idx] += price;
                });
              } else {
                chartLabels = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру'];
                appsData = Array(12).fill(0); revData = Array(12).fill(0); expRevData = Array(12).fill(0); lostRevData = Array(12).fill(0);
                periodApps.forEach(app => {
                  const d = new Date(app.booking_date || app.start_time); const idx = d.getMonth();
                  const price = services.find(s => String(s.id) === String(app.service_id))?.price || 0;
                  appsData[idx]++;
                  if (app.status === 'completed') revData[idx] += price;
                  else if (app.status === 'no-show' || app.status === 'cancelled') lostRevData[idx] += price;
                  else expRevData[idx] += price;
                });
              }

              const maxApp = Math.max(...appsData, 5);
              const maxRev = Math.max(...revData, ...expRevData, 1000);

              const genLineBase = (data: number[], max: number, baseHeight: number) => {
                if (data.length === 0) return ''; const step = 1000 / (data.length > 1 ? data.length - 1 : 1);
                let d = `M 0 ${baseHeight - (data[0]/max)*baseHeight}`;
                for(let i = 1; i < data.length; i++) { d += ` L ${i * step} ${baseHeight - (data[i]/max)*baseHeight}`; }
                return d;
              };

              // ГРАФІК (Огляд)
              const SimpleChart = ({ title, data, max, labels, color, isCurrency = false }: any) => {
                const maxVal = Math.max(max, 10);
                const step = 1000 / (labels.length > 1 ? labels.length - 1 : 1);
                const isDense = labels.length > 15; // Якщо місяць (багато точок)

                return (
                  <div style={{ marginBottom: '2.5rem' }}>
                    <h3 style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '1.5rem', letterSpacing: '0.05em' }}>{title}</h3>
                    <div style={{ height: '140px', width: '100%', position: 'relative' }}>
                      <svg viewBox="0 -40 1000 180" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                        <line x1="0" y1="120" x2="1000" y2="120" stroke="#f1f5f9" strokeWidth="2" />
                        <path d={genLineBase(data, maxVal, 120)} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                        {data.map((val: number, i: number) => {
                          const x = i * step; const y = 120 - (val/maxVal)*120;
                          return (
                            <g key={i} style={{ cursor: 'crosshair' }}
                               onMouseEnter={(e) => {
                                 const p = e.currentTarget;
                                 (p.querySelector('.tooltip-bg') as any).style.opacity = '1';
                                 (p.querySelector('.tooltip-txt') as any).style.opacity = '1';
                                 if(p.querySelector('.hover-col')) (p.querySelector('.hover-col') as any).style.opacity = '1';
                                 const dot = p.querySelector('.dot') as any;
                                 dot.setAttribute('r', '5');
                               }}
                               onMouseLeave={(e) => {
                                 const p = e.currentTarget;
                                 (p.querySelector('.tooltip-bg') as any).style.opacity = '0';
                                 (p.querySelector('.tooltip-txt') as any).style.opacity = '0';
                                 if(p.querySelector('.hover-col')) (p.querySelector('.hover-col') as any).style.opacity = '0';
                                 const dot = p.querySelector('.dot') as any;
                                 dot.setAttribute('r', isDense ? '2.5' : '4');
                               }}
                            >
                              <rect x={x - step/2} y="-40" width={step} height="160" fill="transparent" />
                              {isDense && <line x1={x} y1="-30" x2={x} y2="120" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" opacity="0" className="hover-col" style={{ pointerEvents: 'none', transition: '0.15s ease' }} />}

                              {/* 🟢 КРАПКА ТЕПЕР ЗАВЖДИ ВИДИМА, АЛЕ МЕНША ДЛЯ МІСЯЦЯ */}
                              <circle cx={x} cy={y} r={isDense ? 2.5 : 4} fill="#fff" stroke={color} strokeWidth={isDense ? 1.5 : 2.5} className="dot" style={{ pointerEvents: 'none', transition: '0.15s ease' }} />

                              {/* 🟢 ЦИФРИ (ДНІ) ТЕПЕР ПОКАЗУЮТЬСЯ ВСІ (Шрифт менший якщо густо) */}
                              <text x={x} y="145" fill="#94a3b8" fontSize={isDense ? "9" : "11"} fontWeight="700" textAnchor={i===0?'start':i===labels.length-1?'end':'middle'} style={{ pointerEvents: 'none' }}>{labels[i]}</text>

                              <rect x={x > 800 ? x - 85 : x - 40} y={y - 35} width="85" height="24" rx="6" fill="#0f172a" className="tooltip-bg" opacity="0" style={{ pointerEvents: 'none', transition: '0.15s ease' }} />
                              <text x={x > 800 ? x - 42 : x + 2} y={y - 18} fill="#fff" fontSize="11" fontWeight="700" textAnchor="middle" className="tooltip-txt" opacity="0" style={{ pointerEvents: 'none', transition: '0.15s ease' }}>
                                {isCurrency ? `${val.toLocaleString('uk-UA')} ₴` : val}
                              </text>
                            </g>
                          )
                        })}
                      </svg>
                    </div>
                  </div>
                )
              };

              // МУЛЬТИ-ГРАФІК ФІНАНСІВ
              const FinanceMultiChart = ({ labels, actual, expected, lost, max }: any) => {
                const step = 1000 / (labels.length > 1 ? labels.length - 1 : 1);
                const isDense = labels.length > 15;
                return (
                  <div style={{ marginBottom: '2.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <h3 style={{ fontSize: '0.8rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Динаміка доходу (₴)</h3>
                      <div style={{ display: 'flex', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: '800', color: '#10b981' }}><span style={{ width: 12, height: 3, background: '#10b981', borderRadius: '2px' }}></span> Фактично</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: '800', color: '#3b82f6' }}><span style={{ width: 12, height: 3, borderTop: '2px dashed #3b82f6' }}></span> Очікується</div>
                      </div>
                    </div>

                    <div style={{ height: '170px', width: '100%', position: 'relative' }}>
                      <svg viewBox="0 -80 1000 220" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                        <line x1="0" y1="120" x2="1000" y2="120" stroke="#f1f5f9" strokeWidth="2" />

                        <path d={genLineBase(actual, max, 120)} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        <path d={genLineBase(expected, max, 120)} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeDasharray="6 6" strokeLinecap="round" strokeLinejoin="round" />

                        {labels.map((lbl: string, i: number) => {
                          const x = i * step;
                          const actY = 120 - (actual[i]/max)*120;
                          const expY = 120 - (expected[i]/max)*120;

                          return (
                            <g key={i} style={{ cursor: 'crosshair' }}
                               onMouseEnter={(e) => {
                                 const p = e.currentTarget;
                                 (p.querySelector('.fin-tooltip') as any).style.opacity = '1';
                                 (p.querySelector('.hover-col') as any).style.opacity = '1';
                                 p.querySelectorAll('.dot').forEach((d:any) => d.setAttribute('r', '5'));
                               }}
                               onMouseLeave={(e) => {
                                 const p = e.currentTarget;
                                 (p.querySelector('.fin-tooltip') as any).style.opacity = '0';
                                 (p.querySelector('.hover-col') as any).style.opacity = '0';
                                 p.querySelectorAll('.dot').forEach((d:any) => d.setAttribute('r', isDense ? '2.5' : '4'));
                               }}
                            >
                              <rect x={x - step/2} y="-80" width={step} height="200" fill="transparent" />

                              <line x1={x} y1="-70" x2={x} y2="120" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" opacity="0" className="hover-col" style={{ pointerEvents: 'none', transition: '0.15s ease' }} />

                              <circle cx={x} cy={actY} r={isDense ? 2.5 : 4} fill="#fff" stroke="#10b981" strokeWidth={isDense ? 1.5 : 2.5} className="dot" style={{ pointerEvents: 'none', transition: '0.15s ease' }} />
                              <circle cx={x} cy={expY} r={isDense ? 2.5 : 4} fill="#fff" stroke="#3b82f6" strokeWidth={isDense ? 1.5 : 2.5} className="dot" style={{ pointerEvents: 'none', transition: '0.15s ease' }} />

                              {/* 🟢 ЦИФРИ (ДНІ) */}
                              <text x={x} y="145" fill="#94a3b8" fontSize={isDense ? "9" : "11"} fontWeight="700" textAnchor={i===0?'start':i===labels.length-1?'end':'middle'} style={{ pointerEvents: 'none' }}>{lbl}</text>

                              <foreignObject x={x > 800 ? x - 175 : x + 15} y="-75" width="160" height="110" className="fin-tooltip" opacity="0" style={{ pointerEvents: 'none', transition: 'opacity 0.15s ease' }}>
                                <div style={{ background: '#0f172a', padding: '0.7rem 0.9rem', borderRadius: '10px', color: '#fff', fontSize: '0.75rem', boxShadow: '0 10px 25px rgba(0,0,0,0.15)' }}>
                                   <div style={{ fontWeight: '800', marginBottom: '8px', borderBottom: '1px solid #334155', paddingBottom: '6px', textAlign: 'center', color: '#cbd5e1' }}>{lbl}</div>
                                   <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981', marginBottom: '4px' }}><span>Отримано:</span> <b>{actual[i]} ₴</b></div>
                                   <div style={{ display: 'flex', justifyContent: 'space-between', color: '#60a5fa', marginBottom: '4px' }}><span>Очікується:</span> <b>{expected[i]} ₴</b></div>
                                   <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f87171' }}><span>Втрачено:</span> <b>{lost[i]} ₴</b></div>
                                </div>
                              </foreignObject>
                            </g>
                          )
                        })}
                      </svg>
                    </div>
                  </div>
                )
              };

              const downloadCSV = () => {
                let csvContent = "\uFEFF";
                let friendlyTabName = STATS_TABS.find(t => t.id === statsTab)?.label.replace(/\s+/g, '_') || "Звіт";
                const today = new Date();
                const cleanDateStr = `${today.getDate().toString().padStart(2, '0')}-${(today.getMonth()+1).toString().padStart(2, '0')}-${today.getFullYear()}`;
                let fileName = `BookEra_${friendlyTabName}_${cleanDateStr}.csv`;

                if (statsTab === 'overview' || statsTab === 'appointments') {
                  csvContent += "Дата,Час,Клієнт,Телефон,Майстер,Послуга,Статус,Сума (UAH)\n";
                  sortedApps.forEach(app => {
                    const date = new Date(app.booking_date || app.start_time).toLocaleDateString('uk-UA');
                    const time = app.start_time.substring(0,5);
                    const client = `"${app.client_name || 'Невідомо'}"`;
                    const phone = `"${app.client_phone || ''}"`;
                    const master = `"${team.find(t => String(t.id) === String(app.staff_id))?.name || 'Власник'}"`;
                    const srvObj = services.find(s => String(s.id) === String(app.service_id));
                    const service = `"${srvObj?.name || app.service_name || 'Послуга'}"`;
                    let statusStr = app.status === 'completed' ? "Завершено" : app.status === 'no-show' ? "Не прийшов" : app.status === 'cancelled' ? "Скасовано" : "Очікується";
                    const price = app.status === 'completed' ? (srvObj?.price || 0) : 0;
                    csvContent += `${date},${time},${client},${phone},${master},${service},${statusStr},${price}\n`;
                  });
                  csvContent += `\nВсього записів,,,,,,,${stTotal}\nЗагальний дохід,,,,,,,${totalRev}\n`;

                } else if (statsTab === 'services') {
                  csvContent += "Послуга,Кількість проданих,Дохід (UAH)\n";
                  topServicesArr.forEach(srv => { csvContent += `"${srv.name}",${srv.count},${srv.rev}\n`; });

                } else if (statsTab === 'staff') {
                  csvContent += "Майстер,Всього записів,Виконано успішно,Дохід (UAH)\n";
                  topStaffArr.forEach(m => { csvContent += `"${m.name}",${m.count},${m.services},${m.rev}\n`; });

                } else if (statsTab === 'clients') {
                  csvContent += "Клієнт,Телефон,Візитів за період,Витрачено (UAH)\n";
                  topClientsArr.forEach(c => { csvContent += `"${c.name}","${c.phone}",${c.count},${c.rev}\n`; });

                } else if (statsTab === 'revenue') {
                  csvContent += "Джерело доходу,Сума (UAH)\n";
                  csvContent += `Від постійних клієнтів,${returningClientRev}\nВід нових клієнтів,${newClientRev}\n\nРазом,${totalRev}\n`;
                }

                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute("download", fileName);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              };

              const ITEMS_PER_PAGE = 10;
              const paginate = (array: any[]) => array.slice((statsCurrentPage - 1) * ITEMS_PER_PAGE, statsCurrentPage * ITEMS_PER_PAGE);

              const PaginationUI = ({ totalItems }: { totalItems: number }) => {
                const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
                if (totalPages <= 1) return null;
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>
                      Показано {((statsCurrentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(statsCurrentPage * ITEMS_PER_PAGE, totalItems)} з {totalItems}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button disabled={statsCurrentPage === 1} onClick={() => setStatsCurrentPage(p => p - 1)} style={{ padding: '0.4rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: statsCurrentPage === 1 ? 'not-allowed' : 'pointer', opacity: statsCurrentPage === 1 ? 0.5 : 1, fontWeight: '600', color: '#0f172a' }}>Назад</button>
                      <button disabled={statsCurrentPage === totalPages} onClick={() => setStatsCurrentPage(p => p + 1)} style={{ padding: '0.4rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: statsCurrentPage === totalPages ? 'not-allowed' : 'pointer', opacity: statsCurrentPage === totalPages ? 0.5 : 1, fontWeight: '600', color: '#0f172a' }}>Вперед</button>
                    </div>
                  </div>
                );
              };

              const tdStyle = { padding: '1rem 0.5rem', fontSize: '0.9rem', color: '#0f172a', fontWeight: '600', borderBottom: '1px solid #f1f5f9' };
              const activeReportTitle = STATS_TABS.find(r => r.id === statsTab)?.label || 'Звіт';

              return (
                <>
                  {/* --- ВЕРХНІ ВКЛАДКИ --- */}
                  <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid #e2e8f0', marginBottom: '2.5rem' }}>
                    {STATS_TABS.map(tab => (
                      <div
                        key={tab.id}
                        onClick={() => { setStatsTab(tab.id as any); setStatsCurrentPage(1); setSortConfig(null); }}
                        style={{ paddingBottom: '0.8rem', fontSize: '0.95rem', cursor: 'pointer', transition: '0.2s', fontWeight: statsTab === tab.id ? '800' : '600', color: statsTab === tab.id ? '#0f172a' : '#64748b', borderBottom: statsTab === tab.id ? '2px solid #0f172a' : '2px solid transparent' }}
                      >
                        {tab.label}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '2.5rem' }}>

                    {/* --- ЛІВА КОЛОНКА --- */}
                    <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', minHeight: '600px', display: 'flex', flexDirection: 'column' }}>

                      <div style={{ padding: '2.5rem', flex: 1 }}>

                        {statsTab === 'overview' && (
                          <div>
                            <SimpleChart title="Динаміка записів (Кількість)" data={appsData.map((v,i)=>v+expRevData[i]/1000+lostRevData[i]/1000)} max={maxApp} labels={chartLabels} color="#0f172a" />
                            <SimpleChart title="Грошовий потік (Фактичний дохід, ₴)" data={revData} max={Math.max(...revData, 1000)} labels={chartLabels} color="#10b981" isCurrency={true} />

                            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', margin: '2rem 0 1.5rem 0' }}>Статуси візитів</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                              <thead>
                                <tr>
                                  <th style={thStyle}>Статус</th>
                                  <th style={{...thStyle, textAlign: 'center'}}>Кількість</th>
                                  <th style={{...thStyle, textAlign: 'center'}}>Відсоток</th>
                                  <th style={{...thStyle, textAlign: 'right'}}>Вартість</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td style={tdStyle}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', marginRight: '0.5rem' }}></span>Заплановано</td>
                                  <td style={{...tdStyle, textAlign: 'center'}}>{stUpcoming.length}</td>
                                  <td style={{...tdStyle, textAlign: 'center'}}>{stTotal ? Math.round((stUpcoming.length/stTotal)*100) : 0}%</td>
                                  <td style={{...tdStyle, textAlign: 'right'}}>{expectedRev.toLocaleString('uk-UA')} ₴</td>
                                </tr>
                                <tr>
                                  <td style={tdStyle}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#10b981', marginRight: '0.5rem' }}></span>Завершено</td>
                                  <td style={{...tdStyle, textAlign: 'center'}}>{stCompleted.length}</td>
                                  <td style={{...tdStyle, textAlign: 'center'}}>{stTotal ? Math.round((stCompleted.length/stTotal)*100) : 0}%</td>
                                  <td style={{...tdStyle, textAlign: 'right', color: '#10b981'}}>{totalRev.toLocaleString('uk-UA')} ₴</td>
                                </tr>
                                <tr>
                                  <td style={tdStyle}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#eab308', marginRight: '0.5rem' }}></span>Не прийшли</td>
                                  <td style={{...tdStyle, textAlign: 'center'}}>{stNoShow.length}</td>
                                  <td style={{...tdStyle, textAlign: 'center'}}>{stTotal ? Math.round((stNoShow.length/stTotal)*100) : 0}%</td>
                                  <td style={{...tdStyle, textAlign: 'right'}}>0 ₴</td>
                                </tr>
                                <tr>
                                  <td style={tdStyle}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#ef4444', marginRight: '0.5rem' }}></span>Скасовано</td>
                                  <td style={{...tdStyle, textAlign: 'center'}}>{stCancelled.length}</td>
                                  <td style={{...tdStyle, textAlign: 'center'}}>{stTotal ? Math.round((stCancelled.length/stTotal)*100) : 0}%</td>
                                  <td style={{...tdStyle, textAlign: 'right'}}>0 ₴</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )}

                        {statsTab === 'appointments' && (
                          <div>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', margin: '0 0 1.5rem 0' }}>Журнал візитів за обраний період</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                              <thead>
                                <tr>
                                  <SortableTH label="Дата / Час" sortKey="date" />
                                  <SortableTH label="Клієнт" sortKey="client" />
                                  <SortableTH label="Послуга" sortKey="service" />
                                  <SortableTH label="Статус" sortKey="status" />
                                  <SortableTH label="Вартість" sortKey="price" align="right" />
                                </tr>
                              </thead>
                              <tbody>
                                {sortedApps.length > 0 ? paginate(sortedApps).map(app => {
                                  const srvObj = services.find(s => String(s.id) === String(app.service_id));
                                  return (
                                    <tr key={app.id}>
                                      <td style={tdStyle}>{new Date(app.booking_date || app.start_time).toLocaleDateString('uk-UA')} <span style={{color:'#64748b', marginLeft:'8px'}}>{app.start_time.substring(0,5)}</span></td>
                                      <td style={{...tdStyle, fontWeight: '700'}}>{app.client_name}</td>
                                      <td style={{...tdStyle, color: '#475569'}}>{srvObj?.name || app.service_name}</td>
                                      <td style={tdStyle}>
                                        <span style={{ padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700', background: app.status === 'completed' ? '#dcfce7' : app.status === 'no-show' ? '#fee2e2' : app.status === 'cancelled' ? '#f1f5f9' : '#eff6ff', color: app.status === 'completed' ? '#166534' : app.status === 'no-show' ? '#991b1b' : app.status === 'cancelled' ? '#475569' : '#1d4ed8' }}>
                                          {app.status === 'completed' ? 'Завершено' : app.status === 'no-show' ? 'Не прийшов' : app.status === 'cancelled' ? 'Скасовано' : 'Очікується'}
                                        </span>
                                      </td>
                                      <td style={{...tdStyle, textAlign: 'right', fontWeight: '700'}}>{srvObj?.price || 0} ₴</td>
                                    </tr>
                                  )
                                }) : <tr><td colSpan={5} style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>Немає записів за цей період</td></tr>}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {statsTab === 'revenue' && (
                          <div>
                             <FinanceMultiChart labels={chartLabels} actual={revData} expected={expRevData} lost={lostRevData} max={maxRev} />

                             <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', margin: '3rem 0 1.5rem 0' }}>Фінансові показники</h3>
                             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '3rem' }}>
                               <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', borderTop: '4px solid #10b981', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                                 <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Фактичний дохід</div>
                                 <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#10b981' }}>{totalRev.toLocaleString('uk-UA')} ₴</div>
                               </div>
                               <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', borderTop: '4px solid #3b82f6', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                                 <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Запланований дохід</div>
                                 <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#3b82f6' }}>{expectedRev.toLocaleString('uk-UA')} ₴</div>
                               </div>
                               <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', borderTop: '4px solid #ef4444', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                                 <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Втрачений дохід</div>
                                 <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#ef4444' }}>{lostRev.toLocaleString('uk-UA')} ₴</div>
                               </div>
                               <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                                 <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                                   {currPeriod.start <= now && currPeriod.end >= now ? 'Прогноз системи' : 'Підсумок'}
                                 </div>
                                 <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#0f172a' }}>
                                   {forecastRev.toLocaleString('uk-UA')} ₴
                                 </div>
                               </div>
                             </div>

                             <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', margin: '0 0 1.5rem 0' }}>Джерела доходу (Деталізація)</h3>
                             <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                              <thead><tr><th style={{...thStyle, cursor:'default'}}>Показник</th><th style={{...thStyle, textAlign: 'right', cursor:'default'}}>Сума</th><th style={{...thStyle, width: '40%', cursor:'default'}}>Частка / Інфо</th></tr></thead>
                              <tbody>
                                <tr>
                                  <td style={{...tdStyle, fontWeight: '700'}}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', marginRight: '0.5rem' }}></span>Від постійних клієнтів</td>
                                  <td style={{...tdStyle, textAlign: 'right', fontWeight: '800'}}>{returningClientRev.toLocaleString('uk-UA')} ₴</td>
                                  <td style={tdStyle}><div style={{ width: '100%', height: 6, background: '#f1f5f9', borderRadius: 3 }}><div style={{ width: totalRev > 0 ? `${(returningClientRev/totalRev)*100}%` : '0%', height: '100%', background: '#3b82f6', borderRadius: 3 }}></div></div></td>
                                </tr>
                                <tr>
                                  <td style={{...tdStyle, fontWeight: '700'}}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#10b981', marginRight: '0.5rem' }}></span>Від нових клієнтів</td>
                                  <td style={{...tdStyle, textAlign: 'right', fontWeight: '800'}}>{newClientRev.toLocaleString('uk-UA')} ₴</td>
                                  <td style={tdStyle}><div style={{ width: '100%', height: 6, background: '#f1f5f9', borderRadius: 3 }}><div style={{ width: totalRev > 0 ? `${(newClientRev/totalRev)*100}%` : '0%', height: '100%', background: '#10b981', borderRadius: 3 }}></div></div></td>
                                </tr>
                                <tr>
                                  <td style={{...tdStyle, fontWeight: '700'}}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#eab308', marginRight: '0.5rem' }}></span>Топ-майстер</td>
                                  <td style={{...tdStyle, textAlign: 'right', fontWeight: '800'}}>{bestStaff ? bestStaff.rev.toLocaleString('uk-UA') : 0} ₴</td>
                                  <td style={tdStyle}><span style={{fontSize: '0.85rem', color: '#64748b', fontWeight: '600'}}>{bestStaff ? bestStaff.name : '—'}</span></td>
                                </tr>
                                <tr>
                                  <td style={{...tdStyle, fontWeight: '700'}}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6', marginRight: '0.5rem' }}></span>Середній чек (Завершено)</td>
                                  <td style={{...tdStyle, textAlign: 'right', fontWeight: '800'}}>{avgCheckCompleted.toLocaleString('uk-UA')} ₴</td>
                                  <td style={tdStyle}><span style={{fontSize: '0.85rem', color: '#64748b', fontWeight: '600'}}>На основі {stCompleted.length} візитів</span></td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )}

                        {statsTab === 'services' && (
                          <div>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', margin: '0 0 1.5rem 0' }}>Топ послуг за обраний період</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                              <thead>
                                <tr>
                                  <SortableTH label="Назва послуги" sortKey="name" />
                                  <SortableTH label="Кількість візитів" sortKey="count" align="center" />
                                  <SortableTH label="Згенерований дохід" sortKey="rev" align="right" />
                                </tr>
                              </thead>
                              <tbody>
                                {topServicesArr.length > 0 ? paginate(topServicesArr).map((srv, idx) => (
                                  <tr key={idx}>
                                    <td style={{...tdStyle, fontWeight: '700'}}>{srv.name}</td>
                                    <td style={{...tdStyle, textAlign: 'center'}}>{srv.count}</td>
                                    <td style={{...tdStyle, textAlign: 'right', fontWeight: '700', color: '#10b981'}}>{srv.rev.toLocaleString('uk-UA')} ₴</td>
                                  </tr>
                                )) : <tr><td colSpan={3} style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>Немає даних за цей період</td></tr>}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {statsTab === 'staff' && (
                          <div>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', margin: '0 0 1.5rem 0' }}>Ефективність команди</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                              <thead>
                                <tr>
                                  <SortableTH label="Майстер" sortKey="name" />
                                  <SortableTH label="Всього записів" sortKey="count" align="center" />
                                  <SortableTH label="Виконано послуг" sortKey="services" align="center" />
                                  <SortableTH label="Загальний дохід" sortKey="rev" align="right" />
                                </tr>
                              </thead>
                              <tbody>
                                {topStaffArr.length > 0 ? paginate(topStaffArr).map((m, idx) => (
                                  <tr key={idx}>
                                    <td style={{...tdStyle, display: 'flex', alignItems: 'center', gap: '1rem'}}>
                                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f1f5f9', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: '#0f172a', fontWeight: '800' }}>{m.name.substring(0,2).toUpperCase()}</div>
                                      {m.name}
                                    </td>
                                    <td style={{...tdStyle, textAlign: 'center'}}>{m.count}</td>
                                    <td style={{...tdStyle, textAlign: 'center'}}>{m.services}</td>
                                    <td style={{...tdStyle, textAlign: 'right', color: '#10b981', fontWeight: '700'}}>{m.rev.toLocaleString('uk-UA')} ₴</td>
                                  </tr>
                                )) : <tr><td colSpan={4} style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>Немає даних за цей період</td></tr>}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {statsTab === 'clients' && (
                          <div>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', margin: '0 0 1.5rem 0' }}>Аналітика клієнтської бази</h3>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '3rem', marginBottom: '2.5rem', paddingBottom: '2.5rem', borderBottom: '1px solid #f1f5f9' }}>
                              <div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Унікальні клієнти</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#0f172a', lineHeight: '1' }}>{topClientsArr.length}</div>
                              </div>
                              <div style={{ width: '1px', height: '35px', background: '#e2e8f0' }}></div>
                              <div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Середня частота</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#0f172a', lineHeight: '1', display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
                                  {topClientsArr.length > 0 ? (stCompleted.length / topClientsArr.length).toFixed(1) : '0.0'} <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: '600' }}>візитів</span>
                                </div>
                              </div>
                              <div style={{ width: '1px', height: '35px', background: '#e2e8f0' }}></div>
                              <div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Повернулись (2+ візити)</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#10b981', lineHeight: '1' }}>
                                  {topClientsArr.length > 0 ? Math.round((topClientsArr.filter((c: any) => c.count > 1).length / topClientsArr.length) * 100) : 0}<span style={{ fontSize: '1rem' }}>%</span>
                                </div>
                              </div>
                            </div>

                            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', margin: '0 0 1.5rem 0' }}>Деталізація візитів</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                              <thead>
                                <tr>
                                  <SortableTH label="Клієнт" sortKey="name" />
                                  <SortableTH label="Телефон" sortKey="phone" />
                                  <SortableTH label="Візитів" sortKey="count" align="center" />
                                  <SortableTH label="Дохід" sortKey="rev" align="right" />
                                </tr>
                              </thead>
                              <tbody>
                                {topClientsArr.length > 0 ? paginate(topClientsArr).map((c: any, idx: number) => (
                                  <tr key={idx}>
                                    <td style={{...tdStyle, fontWeight: '700'}}>{c.name || 'Без імені'}</td>
                                    <td style={{...tdStyle, color: '#64748b'}}>{c.phone || '—'}</td>
                                    <td style={{...tdStyle, textAlign: 'center'}}>{c.count}</td>
                                    <td style={{...tdStyle, textAlign: 'right', fontWeight: '700', color: '#10b981'}}>{c.rev.toLocaleString('uk-UA')} ₴</td>
                                  </tr>
                                )) : <tr><td colSpan={4} style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>Немає даних за цей період</td></tr>}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* --- КОМПОНЕНТ ПАГІНАЦІЇ --- */}
                      {statsTab === 'appointments' && <PaginationUI totalItems={periodApps.length} />}
                      {statsTab === 'services' && <PaginationUI totalItems={topServicesArr.length} />}
                      {statsTab === 'staff' && <PaginationUI totalItems={topStaffArr.length} />}
                      {statsTab === 'clients' && <PaginationUI totalItems={topClientsArr.length} />}

                    </div>

                    {/* --- ПРАВА КОЛОНКА (НАДІЙНИЙ STICKY) --- */}
                    <div style={{ height: '100%' }}>
                      <div style={{ position: 'sticky', top: '2.5rem', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', width: '100%', boxSizing: 'border-box' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', marginBottom: '1.5rem' }}>Швидкі звіти</h3>

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {STATS_TABS.map((report, idx) => (
                            <div
                              key={idx}
                              onClick={() => { setStatsTab(report.id as any); setStatsCurrentPage(1); setSortConfig(null); }}
                              style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.1rem 0',
                                borderBottom: idx !== 5 ? '1px solid #f1f5f9' : 'none', cursor: 'pointer', transition: '0.2s',
                                color: statsTab === report.id ? '#0f172a' : '#64748b',
                                fontWeight: statsTab === report.id ? '800' : '600'
                              }}
                              onMouseOver={e => { e.currentTarget.style.color = '#0f172a' }}
                              onMouseOut={e => { if (statsTab !== report.id) e.currentTarget.style.color = '#64748b' }}
                            >
                              <span style={{ fontSize: '0.9rem' }}>{report.label}</span>
                              <Icons.ChevronRight />
                            </div>
                          ))}
                        </div>

                        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
                          <button
                            onClick={downloadCSV}
                            style={{
                              width: '100%', background: '#f8fafc', border: '1px solid #cbd5e1', padding: '0.85rem', borderRadius: '8px',
                              color: '#0f172a', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', transition: '0.2s',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                            }}
                            onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'}
                            onMouseOut={e => e.currentTarget.style.background = '#f8fafc'}
                          >
                            Експорт: {activeReportTitle}
                          </button>
                        </div>
                      </div>
                    </div>

                  </div>
                </>
              );
            })()}
          </div>
        )        /* --- 4. КЛІЄНТСЬКА БАЗА --- */
        : activeTab === 'Clients' ? (
          <div style={{ padding: '2rem 3rem', flex: 1, display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>

            {/* 1. КОМПАКТНИЙ ХЕДЕР (Мінімалізм, замість великих карток) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem', position: 'relative', zIndex: 20 }}>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                 <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>Клієнти</h2>
                 <div style={{ padding: '0.3rem 0.8rem', background: '#f1f5f9', color: '#475569', borderRadius: '20px', fontSize: '0.85rem', fontWeight: '700' }}>
                    {clientsList.length} всього
                 </div>

                 {/* Акуратна статистика замість 3-х великих блоків */}
                 <div style={{ display: 'flex', gap: '1rem', marginLeft: '0.5rem', borderLeft: '2px solid #e2e8f0', paddingLeft: '1.5rem' }}>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}><span style={{ fontWeight: '700', color: '#10b981' }}>+{clientsList.filter(c => c.last_visit && new Date(c.last_visit).getMonth() === new Date().getMonth()).length}</span> нових</div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}><span style={{ fontWeight: '700', color: '#eab308' }}>{clientsList.filter(c => c.tags?.includes('VIP')).length}</span> VIP</div>
                 </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ position: 'relative', width: '280px' }}>
                  <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex' }}>
                    <Icons.Search />
                  </div>
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="search-input"
                    style={{ borderRadius: '10px', border: '1px solid #e2e8f0', padding: '0.6rem 1rem 0.6rem 2.4rem', backgroundColor: '#fff', fontSize: '0.9rem' }}
                    placeholder="Пошук клієнта..."
                  />
                </div>

                <div style={{ position: 'relative' }} ref={clientSortMenuRef}>
                  <div className="custom-select-trigger" onClick={() => setIsClientSortDropdownOpen(!isClientSortDropdownOpen)} style={{ minWidth: '180px', borderRadius: '10px', backgroundColor: '#fff', padding: '0.6rem 1rem', fontSize: '0.9rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {clientSortOptions.find(o => o.value === clientSortType)?.icon}
                      {clientSortOptions.find(o => o.value === clientSortType)?.label}
                    </div>
                    <Icons.ChevronDown />
                  </div>

                  {isClientSortDropdownOpen && (
                    <div className="custom-select-dropdown" style={{ minWidth: '180px' }}>
                      {clientSortOptions.map(option => (
                        <div
                          key={option.value}
                          className={`custom-select-option ${clientSortType === option.value ? 'selected' : ''}`}
                          onClick={() => {
                            setClientSortType(option.value);
                            setIsClientSortDropdownOpen(false);
                          }}
                        >
                          <span style={{ color: '#94a3b8' }}>{option.icon}</span>
                          {option.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 🔴 ТЕПЕР ВІДКРИВАЄ НОВУ МОДАЛКУ, А НЕ КАЛЕНДАР */}
                <button
                  onClick={() => setIsAddClientModalOpen(true)}
                  style={{ padding: '0.6rem 1.2rem', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: '0.2s' }}
                  onMouseOver={e => e.currentTarget.style.backgroundColor = '#1e293b'}
                  onMouseOut={e => e.currentTarget.style.backgroundColor = '#0f172a'}
                >
                  <Icons.Plus /> Додати
                </button>
              </div>
            </div>

            {/* 3. ТАБЛИЦЯ ТА ПАГІНАЦІЯ */}

            {/* 3. ТАБЛИЦЯ ТА ПАГІНАЦІЯ */}
            <div className="client-white-card custom-scroll" style={{ padding: 0, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
              {(() => {
                const indexOfLastClient = clientCurrentPage * clientsPerPage;
                const indexOfFirstClient = indexOfLastClient - clientsPerPage;
                const currentClients = filteredAndSortedClients.slice(indexOfFirstClient, indexOfLastClient);
                const totalClientPages = Math.ceil(filteredAndSortedClients.length / clientsPerPage);

                return currentClients.length > 0 ? (
                  <>
                    <table className="client-table" style={{ borderCollapse: 'collapse', width: '100%' }}>
                      <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
                        <tr>
                          <th style={{ color: '#94a3b8', fontSize: '0.75rem', padding: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>Клієнт</th>
                          <th style={{ color: '#94a3b8', fontSize: '0.75rem', padding: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>Контакти</th>
                          <th style={{ color: '#94a3b8', fontSize: '0.75rem', padding: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>Останній візит</th>
                          <th style={{ color: '#94a3b8', fontSize: '0.75rem', padding: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>Візити</th>
                          <th style={{ color: '#94a3b8', fontSize: '0.75rem', padding: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>Загальний дохід</th>
                          <th style={{ color: '#94a3b8', fontSize: '0.75rem', padding: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>Теги</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentClients.map(client => (
                          <tr key={client.id} onClick={() => openViewingClient(client)} style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}>
                            <td style={{ padding: '1rem 1.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#f8fafc', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.8rem', flexShrink: 0 }}>
                                  {getUserInitials(client.name)}
                                </div>
                                <span style={{ fontWeight: '600', color: '#1e293b', fontSize: '0.95rem' }}>{client.name}</span>
                              </div>
                            </td>
                            <td style={{ padding: '1rem 1.5rem', color: '#64748b', fontSize: '0.9rem' }}>
                              {client.phone || 'Не вказано'}
                            </td>
                            <td style={{ padding: '1rem 1.5rem', color: '#64748b', fontSize: '0.9rem' }}>
                              {client.last_visit ? new Date(client.last_visit).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                            </td>
                            <td style={{ padding: '1rem 1.5rem' }}>
                              <span style={{ background: '#f1f5f9', padding: '0.2rem 0.6rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>
                                {client.visits || 0}
                              </span>
                            </td>
                            <td style={{ padding: '1rem 1.5rem', fontWeight: '700', color: '#1e293b', fontSize: '0.95rem' }}>
                              {client.spent || 0} ₴
                            </td>
                            <td style={{ padding: '1rem 1.5rem' }}>
                              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                {client.tags?.map((tag: string, idx: number) => (
                                  <span key={idx} className={`status-badge ${getBadgeClass(tag)}`} style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>{tag}</span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {totalClientPages > 1 && (
                      <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', background: '#fff', marginTop: 'auto' }}>
                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Показано {indexOfFirstClient + 1}-{Math.min(indexOfLastClient, filteredAndSortedClients.length)} з {filteredAndSortedClients.length}</span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => setClientCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={clientCurrentPage === 1}
                            style={{ padding: '0.4rem 0.8rem', background: clientCurrentPage === 1 ? '#f8fafc' : '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', color: clientCurrentPage === 1 ? '#cbd5e1' : '#0f172a', cursor: clientCurrentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: '600' }}
                          >
                            Попередня
                          </button>
                          <button
                            onClick={() => setClientCurrentPage(prev => Math.min(prev + 1, totalClientPages))}
                            disabled={clientCurrentPage === totalClientPages}
                            style={{ padding: '0.4rem 0.8rem', background: clientCurrentPage === totalClientPages ? '#f8fafc' : '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', color: clientCurrentPage === totalClientPages ? '#cbd5e1' : '#0f172a', cursor: clientCurrentPage === totalClientPages ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: '600' }}
                          >
                            Наступна
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '5rem 2rem', color: '#64748b', margin: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', color: '#cbd5e1' }}><Icons.Clients /></div>
                    <h3 style={{ fontSize: '1.2rem', color: '#0f172a', fontWeight: '700', marginBottom: '0.5rem' }}>Клієнтів не знайдено</h3>
                    <p style={{ fontSize: '0.95rem' }}>Поки що у вашій базі немає клієнтів за цими параметрами.</p>
                  </div>
                );
              })()}
            </div>
          </div>
        )


/* --- 5. НАЛАШТУВАННЯ БІЗНЕСУ --- */
        : activeTab === 'Settings' ? (
          <div style={{ padding: '2rem 3rem', flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>

            {/* 🟢 ГОЛОВНЕ МЕНЮ НАЛАШТУВАНЬ */}
            {settingsView === 'main' && (
              <div style={{ maxWidth: '1000px', animation: 'fadeIn 0.3s ease-in-out' }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem' }}>
                  <div>
                    <h2 style={{ fontSize: '2rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.5rem 0', letterSpacing: '-0.02em' }}>Налаштування</h2>
                    <p style={{ color: '#64748b', fontSize: '1rem', margin: 0 }}>Керування параметрами, онлайн-записом та даними вашого бізнесу.</p>
                  </div>

                  {/* Рядок пошуку */}
                  <div style={{ position: 'relative', width: '320px' }}>
                    <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex' }}><Icons.Search /></div>
                    <input type="text" placeholder="Пошук..." style={{ width: '100%', padding: '0.7rem 1rem 0.7rem 2.4rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.95rem', outline: 'none', background: '#fff' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.5rem' }}>
                  {businessSettingsCards.map(card => (
                    <div
                      key={card.id}
                      onClick={() => setSettingsView(card.id as any)}
                      style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', alignItems: 'flex-start', gap: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}
                      onMouseOver={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.05)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                      onMouseOut={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                      <div style={{ color: '#0f172a', marginTop: '0.2rem' }}>
                        <card.icon />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', margin: '0 0 0.3rem 0' }}>{card.title}</h3>
                        <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0, lineHeight: '1.4' }}>{card.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 🟢 СПІЛЬНИЙ ХЕДЕР ДЛЯ ПІДСТОРІНОК */}
            {settingsView !== 'main' && (
              <div style={{ marginBottom: '2.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button onClick={() => setSettingsView('main')} style={{ background: 'transparent', border: 'none', color: '#0f172a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem', fontWeight: '800', transition: '0.2s', padding: 0 }} onMouseOver={e => e.currentTarget.style.opacity = '0.7'} onMouseOut={e => e.currentTarget.style.opacity = '1'}>
                  <Icons.ChevronLeft /> {businessSettingsCards.find(c => c.id === settingsView)?.title}
                </button>
              </div>
            )}

            {/* 🟢 ПІДСТОРІНКИ */}
            {settingsView !== 'main' && (
              <div style={{ maxWidth: '800px', width: '100%', animation: 'fadeIn 0.3s ease-in-out' }}>

              {/* --- ОНЛАЙН БРОНЮВАННЯ --- */}
              {settingsView === 'booking' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                      <div>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a', margin: '0 0 0.3rem 0' }}>Приймати онлайн-записи</h4>
                        <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>Клієнти зможуть самостійно записуватись через вашу сторінку.</p>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <div style={{ position: 'relative', width: '48px', height: '26px' }}>
                          <input type="checkbox" checked={bookingSettings.is_active} onChange={e => setBookingSettings({...bookingSettings, is_active: e.target.checked})} style={{ opacity: 0, width: 0, height: 0 }} />
                          <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: bookingSettings.is_active ? '#0f172a' : '#cbd5e1', borderRadius: '24px', transition: '.2s' }}>
                            <span style={{ position: 'absolute', height: '22px', width: '22px', left: bookingSettings.is_active ? '24px' : '2px', bottom: '2px', backgroundColor: 'white', borderRadius: '50%', transition: '.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}></span>
                          </span>
                        </div>
                      </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '0.6rem' }}>Мінімальний час до візиту</label>
                        <select value={bookingSettings.min_advance_hours} onChange={e => setBookingSettings({...bookingSettings, min_advance_hours: Number(e.target.value)})} style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#f8fafc', fontSize: '0.95rem', outline: 'none' }}>
                          <option value={0}>Можна записуватись прямо зараз</option>
                          <option value={1}>За 1 годину до початку</option>
                          <option value={2}>За 2 години до початку</option>
                          <option value={24}>За 24 години (1 добу)</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '0.6rem' }}>Максимальний горизонт</label>
                        <select value={bookingSettings.max_advance_days} onChange={e => setBookingSettings({...bookingSettings, max_advance_days: Number(e.target.value)})} style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#f8fafc', fontSize: '0.95rem', outline: 'none' }}>
                          <option value={7}>На 1 тиждень вперед</option>
                          <option value={14}>На 2 тижні вперед</option>
                          <option value={30}>На 1 місяць вперед</option>
                          <option value={90}>На 3 місяці вперед</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '0.6rem' }}>Правила скасування (Відображається клієнту)</label>
                      <input type="text" value={bookingSettings.cancellation_policy} onChange={e => setBookingSettings({...bookingSettings, cancellation_policy: e.target.value})} style={{ width: '100%', padding: '0.8rem 1rem', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '0.95rem', background: '#fff', color: '#0f172a', outline: 'none' }} />
                    </div>
                  </div>
                  <button onClick={() => saveSettingsToDB('booking_settings', bookingSettings, 'Налаштування онлайн-бронювання збережено.')} disabled={isSettingsSaving} style={{ padding: '1rem', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '1rem', cursor: isSettingsSaving ? 'not-allowed' : 'pointer', opacity: isSettingsSaving ? 0.7 : 1 }}>
                    {isSettingsSaving ? 'Збереження...' : 'Зберегти зміни'}
                  </button>
                </div>
              )}

              {/* --- СИСТЕМНІ ПРАВИЛА --- */}
              {settingsView === 'advanced' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
                    <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '12px 12px 0 0' }}>
                      <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Робота з клієнтами</h3>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', borderBottom: '1px solid #f1f5f9' }}>
                      <div>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a', margin: '0 0 0.3rem 0' }}>Авто-підтвердження записів</h4>
                        <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>Записи з інтернету одразу потрапляють в календар.</p>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <div style={{ position: 'relative', width: '48px', height: '26px' }}>
                          <input type="checkbox" checked={notificationSettings.auto_approve} onChange={e => setNotificationSettings({...notificationSettings, auto_approve: e.target.checked})} style={{ opacity: 0, width: 0, height: 0 }} />
                          <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: notificationSettings.auto_approve ? '#0f172a' : '#cbd5e1', borderRadius: '24px', transition: '.2s' }}><span style={{ position: 'absolute', height: '22px', width: '22px', left: notificationSettings.auto_approve ? '24px' : '2px', bottom: '2px', backgroundColor: 'white', borderRadius: '50%', transition: '.2s' }}></span></span>
                        </div>
                      </label>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', borderBottom: '1px solid #f1f5f9' }}>
                      <div>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a', margin: '0 0 0.3rem 0' }}>Сповіщати клієнта про запис</h4>
                        <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>Надсилати клієнту SMS/Email з підтвердженням.</p>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <div style={{ position: 'relative', width: '48px', height: '26px' }}>
                          <input type="checkbox" checked={notificationSettings.notify_client_booking} onChange={e => setNotificationSettings({...notificationSettings, notify_client_booking: e.target.checked})} style={{ opacity: 0, width: 0, height: 0 }} />
                          <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: notificationSettings.notify_client_booking ? '#0f172a' : '#cbd5e1', borderRadius: '24px', transition: '.2s' }}><span style={{ position: 'absolute', height: '22px', width: '22px', left: notificationSettings.notify_client_booking ? '24px' : '2px', bottom: '2px', backgroundColor: 'white', borderRadius: '50%', transition: '.2s' }}></span></span>
                        </div>
                      </label>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem' }}>
                      <div>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a', margin: '0 0 0.3rem 0' }}>Нагадування за 24 години</h4>
                        <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>Автоматичне нагадування клієнту для зменшення неявок.</p>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <div style={{ position: 'relative', width: '48px', height: '26px' }}>
                          <input type="checkbox" checked={notificationSettings.notify_client_reminder} onChange={e => setNotificationSettings({...notificationSettings, notify_client_reminder: e.target.checked})} style={{ opacity: 0, width: 0, height: 0 }} />
                          <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: notificationSettings.notify_client_reminder ? '#0f172a' : '#cbd5e1', borderRadius: '24px', transition: '.2s' }}><span style={{ position: 'absolute', height: '22px', width: '22px', left: notificationSettings.notify_client_reminder ? '24px' : '2px', bottom: '2px', backgroundColor: 'white', borderRadius: '50%', transition: '.2s' }}></span></span>
                        </div>
                      </label>
                    </div>
                  </div>
                  <button onClick={() => saveSettingsToDB('notification_settings', notificationSettings, 'Системні правила збережено.')} disabled={isSettingsSaving} style={{ padding: '1rem', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '1rem', cursor: isSettingsSaving ? 'not-allowed' : 'pointer', opacity: isSettingsSaving ? 0.7 : 1 }}>
                    {isSettingsSaving ? 'Збереження...' : 'Зберегти зміни'}
                  </button>
                </div>
              )}

              {/* --- ПЛАТЕЖІ ТА КАСА --- */}
              {settingsView === 'payments' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
                    <div style={{ padding: '1.5rem 2rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', borderRadius: '12px 12px 0 0' }}>
                      <h3 style={{ fontSize: '0.85rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Захист від неявок</h3>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', borderBottom: paymentsSettings.require_deposit ? '1px solid #f1f5f9' : 'none' }}>
                      <div>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#0f172a', margin: '0 0 0.3rem 0' }}>Брати передоплату (Депозит)</h4>
                        <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>Клієнт повинен сплатити фіксовану суму для підтвердження.</p>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <div style={{ position: 'relative', width: '44px', height: '24px' }}>
                          <input type="checkbox" checked={paymentsSettings.require_deposit} onChange={e => setPaymentsSettings({...paymentsSettings, require_deposit: e.target.checked})} style={{ opacity: 0, width: 0, height: 0 }} />
                          <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: paymentsSettings.require_deposit ? '#0f172a' : '#cbd5e1', borderRadius: '24px', transition: '.2s' }}><span style={{ position: 'absolute', height: '20px', width: '20px', left: paymentsSettings.require_deposit ? '22px' : '2px', bottom: '2px', backgroundColor: 'white', borderRadius: '50%', transition: '.2s' }}></span></span>
                        </div>
                      </label>
                    </div>

                    {paymentsSettings.require_deposit && (
                      <div style={{ padding: '1.5rem 2rem', background: '#fafafa' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '0.6rem' }}>Сума депозиту (₴)</label>
                        <input type="number" value={paymentsSettings.deposit_amount} onChange={e => setPaymentsSettings({...paymentsSettings, deposit_amount: Number(e.target.value)})} style={{ width: '100%', maxWidth: '200px', padding: '0.8rem 1rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '1rem', outline: 'none' }} />
                      </div>
                    )}
                  </div>
                  <button onClick={() => saveSettingsToDB('payments_settings', paymentsSettings, 'Налаштування платежів збережено.')} disabled={isSettingsSaving} style={{ padding: '1rem', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '1rem', cursor: isSettingsSaving ? 'not-allowed' : 'pointer', opacity: isSettingsSaving ? 0.7 : 1 }}>
                    {isSettingsSaving ? 'Збереження...' : 'Зберегти зміни'}
                  </button>
                </div>
              )}

              {/* --- СКЛАД --- */}
              {settingsView === 'inventory' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ padding: '1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Назва товару</label>
                        <input type="text" value={newInventoryItem.name} onChange={e => setNewInventoryItem({...newInventoryItem, name: e.target.value})} placeholder="American Crew Pomade" style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Кіл-сть</label>
                        <input type="number" value={newInventoryItem.qty || ''} onChange={e => setNewInventoryItem({...newInventoryItem, qty: Number(e.target.value)})} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Ціна (₴)</label>
                        <input type="number" value={newInventoryItem.price || ''} onChange={e => setNewInventoryItem({...newInventoryItem, price: Number(e.target.value)})} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '0.95rem' }} />
                      </div>
                      <button onClick={handleAddInventory} style={{ padding: '0.8rem 1.5rem', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', height: '43px' }}>Додати</button>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '1rem 1.5rem', color: '#64748b', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>Назва</th>
                          <th style={{ padding: '1rem 1.5rem', color: '#64748b', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>Залишок</th>
                          <th style={{ padding: '1rem 1.5rem', color: '#64748b', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>Ціна</th>
                          <th style={{ borderBottom: '1px solid #e2e8f0' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventory.length > 0 ? inventory.map((item, idx) => (
                          <tr key={item.id} style={{ borderBottom: idx !== inventory.length - 1 ? '1px solid #f1f5f9' : 'none', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                            <td style={{ padding: '1rem 1.5rem', fontWeight: '600', color: '#0f172a' }}>{item.name}</td>
                            <td style={{ padding: '1rem 1.5rem' }}><span style={{ background: item.qty <= 5 ? '#fef2f2' : '#f1f5f9', color: item.qty <= 5 ? '#ef4444' : '#0f172a', padding: '0.2rem 0.6rem', borderRadius: '6px', fontWeight: '700', fontSize: '0.85rem' }}>{item.qty} шт</span></td>
                            <td style={{ padding: '1rem 1.5rem', color: '#475569' }}>{item.price} ₴</td>
                            <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                              <button onClick={() => handleDeleteInventory(item.id)} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', cursor: 'pointer', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.color = '#ef4444'} onMouseOut={e => e.currentTarget.style.color = '#cbd5e1'}>
                                <Icons.Trash />
                              </button>
                            </td>
                          </tr>
                        )) : <tr><td colSpan={4} style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8', fontSize: '1rem' }}>Склад порожній. Додайте перший товар.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* --- ПІДПИСКА (БІЛІНГ) --- */}
              {settingsView === 'billing' && (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#3b82f6', background: '#eff6ff', padding: '0.3rem 0.6rem', borderRadius: '6px', display: 'inline-block', marginBottom: '1rem' }}>ПОТОЧНИЙ ТАРИФ</div>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#0f172a', margin: '0 0 0.2rem 0' }}>Pro Business</h3>
                    <p style={{ color: '#10b981', fontWeight: '700', margin: 0, fontSize: '1rem' }}>Всі функції активовано</p>
                  </div>
                  <button onClick={() => setComingSoonModal({ isOpen: true, title: 'Управління підпискою', desc: 'Цей функціонал зараз знаходиться на стадії тестування.' })} style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', padding: '0.8rem 1.5rem', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'} onMouseOut={e => e.currentTarget.style.background = '#f8fafc'}>
                    Керувати підпискою
                  </button>
                </div>
              )}

              </div>
            )}
          </div>
        )/* --- 6. МАРКЕТИНГ --- */
        : activeTab === 'Marketing' ? (
          <div style={{ padding: '2rem 3rem', flex: 1, display: 'flex', flexDirection: 'column', maxWidth: '1200px', margin: '0 auto', width: '100%', height: '100%' }}>

            {/* 🟢 1. ГОЛОВНИЙ ДАШБОРД (СУЧАСНИЙ КАРТКОВИЙ СТИЛЬ) */}
            {marketingView === 'overview' && (
              <div style={{ animation: 'fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)', display: 'flex', flexDirection: 'column', minHeight: '100%', paddingBottom: '2rem' }}>

                {/* ВЕРХНЯ ЧАСТИНА: Заголовок + Графічний колаж */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '4rem', alignItems: 'center', marginBottom: '3rem', marginTop: '1rem' }}>

                  {/* Ліва колонка: Текст та CTA */}
                  <div>
                    <h1 style={{ fontSize: '4rem', fontWeight: '900', color: '#0f172a', lineHeight: '1.05', letterSpacing: '-0.04em', margin: '0 0 1.5rem 0' }}>
                      Залучай<br/>Утримуй<br/>Зростай
                    </h1>
                    <p style={{ fontSize: '1.1rem', color: '#475569', lineHeight: '1.6', margin: '0 0 2.5rem 0', maxWidth: '420px', fontWeight: '500' }}>
                      BookEra — це не просто календар. Це дизайн-орієнтована система, що дозволяє в реальному часі бачити вплив ваших комунікацій на прибуток.
                    </p>
                    <button
                      onClick={() => setMarketingView('campaigns')}
                      style={{ background: '#0f172a', color: '#fff', padding: '1rem 2rem', fontSize: '1rem', fontWeight: '800', border: 'none', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: '0.8rem', boxShadow: '0 4px 15px rgba(15, 23, 42, 0.2)' }}
                      onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      Відкрити розсилки <span style={{ transition: 'transform 0.2s' }}>→</span>
                    </button>
                  </div>

                  {/* Права колонка: Абстрактний колаж-сітка */}
                  <div style={{ position: 'relative', height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 80px)', gridTemplateRows: 'repeat(4, 80px)', gap: '12px', position: 'relative' }}>

                      {/* Декоративні елементи */}
                      <div style={{ position: 'absolute', top: '-40px', right: '10px', width: '40px', height: '40px', background: '#e2e8f0', borderRadius: '12px' }}></div>
                      <div style={{ position: 'absolute', bottom: '20px', left: '-50px', width: '60px', height: '60px', background: '#f1f5f9', borderRadius: '16px' }}></div>
                      <div style={{ position: 'absolute', top: '100px', left: '-20px', width: '20px', height: '20px', background: '#cbd5e1', borderRadius: '6px' }}></div>

                      <div style={{ gridColumn: '1 / 3', gridRow: '1 / 3', background: '#0f172a', borderRadius: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
                         <div style={{ fontSize: '0.55rem', color: '#cbd5e1', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>Утримання</div>
                         <div style={{ width: '70px', height: '70px', borderRadius: '50%', border: '14px solid #fde047', borderTopColor: '#3b82f6', borderRightColor: '#10b981' }}></div>
                      </div>

                      <div style={{ gridColumn: '3 / 5', gridRow: '1 / 3', background: '#10b981', borderRadius: '24px', padding: '1.2rem', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 30px rgba(16, 185, 129, 0.2)' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#064e3b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Від акцій</div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.5rem', flex: 1, marginTop: '1rem' }}>
                          <div style={{ width: '30%', height: '40%', background: '#0f172a', borderRadius: '6px' }}></div>
                          <div style={{ width: '30%', height: '70%', background: '#0f172a', borderRadius: '6px' }}></div>
                          <div style={{ width: '30%', height: '100%', background: '#0f172a', borderRadius: '6px' }}></div>
                        </div>
                      </div>

                      <div style={{ gridColumn: '1 / 2', gridRow: '3 / 4', background: '#fde047', borderRadius: '20px', padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 4px 15px rgba(253, 224, 71, 0.3)' }}>
                         <div style={{ fontSize: '0.7rem', fontWeight: '900', color: '#854d0e', lineHeight: '1.2' }}>Активні<br/>розсилки</div>
                         <div style={{ marginTop: 'auto' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#854d0e" strokeWidth="3"><polyline points="7 17 17 17 17 7"></polyline><line x1="7" y1="17" x2="17" y2="7"></line></svg></div>
                      </div>

                      <div style={{ gridColumn: '2 / 4', gridRow: '3 / 5', background: '#0f172a', borderRadius: '24px', position: 'relative', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.05) 10px, rgba(255,255,255,0.05) 20px)' }}></div>
                        <div style={{ position: 'absolute', bottom: '1.5rem', right: '1.5rem', color: '#fff', fontWeight: '900', fontSize: '1.4rem', textAlign: 'right', lineHeight: '1' }}>99.9%<br/><span style={{fontSize: '0.7rem', color: '#cbd5e1', fontWeight: '600'}}>ВІДКРИТТЯ SMS</span></div>
                      </div>

                      <div style={{ gridColumn: '4 / 5', gridRow: '3 / 4', background: '#d8b4fe', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#581c87', boxShadow: '0 4px 15px rgba(216, 180, 254, 0.4)' }}>
                        <Icons.Sparkles />
                      </div>

                      <div style={{ gridColumn: '1 / 2', gridRow: '4 / 5', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                         <Icons.Mail />
                      </div>

                      <div style={{ gridColumn: '4 / 5', gridRow: '4 / 5', background: '#0f172a', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                         <Icons.Globe />
                      </div>

                    </div>
                  </div>
                </div>

                {/* НИЖНЯ ЧАСТИНА: Список фіч у вигляді повноцінних карток */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginTop: 'auto' }}>

                  {/* Картка 1: Google */}
                  <div
                    onClick={() => setComingSoonModal({ isOpen: true, title: 'Інтеграція з Google', desc: 'Можливість бронювати прямо через Google My Business наразі знаходиться на етапі тестування. Ми повідомимо вас, як тільки функція стане доступною!' })}
                    style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '24px', padding: '2rem', display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.06)'; }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.02)'; }}
                  >
                    <div style={{ marginBottom: '1.5rem', color: '#0f172a', background: '#f8fafc', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px' }}>
                      <Icons.Globe />
                    </div>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.5rem 0', letterSpacing: '-0.02em' }}>Записи з Google</h4>
                    <p style={{ fontSize: '0.95rem', color: '#64748b', margin: '0 0 1.5rem 0', lineHeight: '1.5', flex: 1 }}>Дозвольте знаходити вас на Картах та бронювати час в 1 клік прямо з пошуковика.</p>
                    <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Підключити →</span>
                  </div>

                  {/* Картка 2: Акції */}
                  <div
                    onClick={() => setMarketingView('promotions')}
                    style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '24px', padding: '2rem', display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.06)'; }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.02)'; }}
                  >
                    <div style={{ marginBottom: '1.5rem', color: '#0f172a', background: '#f8fafc', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px' }}>
                      <Icons.Tag />
                    </div>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.5rem 0', letterSpacing: '-0.02em' }}>Акції та Знижки</h4>
                    <p style={{ fontSize: '0.95rem', color: '#64748b', margin: '0 0 1.5rem 0', lineHeight: '1.5', flex: 1 }}>Створюйте гарячі пропозиції, щасливі години та знижки для заповнення розкладу.</p>
                    <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Налаштувати →</span>
                  </div>

                  {/* Картка 3: SMM */}
                  <div
                    onClick={() => setComingSoonModal({ isOpen: true, title: 'Інтеграція з Meta (SMM)', desc: 'Ми активно працюємо над прямою інтеграцією з Instagram та Facebook, щоб ваші клієнти могли бронювати прямо з соцмереж.' })}
                    style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '24px', padding: '2rem', display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(0,0,0,0.06)'; }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.02)'; }}
                  >
                    <div style={{ marginBottom: '1.5rem', color: '#0f172a', background: '#f8fafc', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '16px' }}>
                      <Icons.Camera />
                    </div>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.5rem 0', letterSpacing: '-0.02em' }}>SMM Інтеграції</h4>
                    <p style={{ fontSize: '0.95rem', color: '#475569', margin: '0 0 1.5rem 0', lineHeight: '1.5', flex: 1 }}>Кнопка "Забронювати" в Instagram. Готові шаблони постів для залучення трафіку.</p>
                    <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Прив'язати акаунт →</span>
                  </div>

                </div>
              </div>
            )}

            {/* 🟢 2. SMS ТА EMAIL РОЗСИЛКИ */}
            {marketingView === 'campaigns' && (
              <div style={{ animation: 'fadeIn 0.3s ease-in-out', display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '900px' }}>

                {/* Хедер внутрішньої сторінки */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
                  <button onClick={() => setMarketingView('overview')} style={{ background: '#fff', border: '1px solid #e2e8f0', width: '44px', height: '44px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a', cursor: 'pointer', transition: '0.2s', flexShrink: 0, boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }} onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = '#fff'}>
                    <Icons.ChevronLeft />
                  </button>
                  <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.2rem 0', letterSpacing: '-0.02em' }}>Кампанії та Розсилки</h2>
                    <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>Налаштуйте автоматизацію або створіть власну розсилку.</p>
                  </div>
                </div>

                {/* Сучасні Таби */}
                <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '0.4rem', borderRadius: '16px', width: 'fit-content', marginBottom: '2.5rem' }}>
                  <button onClick={() => setCampaignTab('automated')} style={{ background: campaignTab === 'automated' ? '#fff' : 'transparent', border: 'none', padding: '0.6rem 1.5rem', borderRadius: '12px', fontSize: '0.95rem', fontWeight: '700', color: campaignTab === 'automated' ? '#0f172a' : '#64748b', cursor: 'pointer', transition: '0.2s', boxShadow: campaignTab === 'automated' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none' }}>
                    Сценарії (Авто)
                  </button>
                  <button onClick={() => setCampaignTab('mass')} style={{ background: campaignTab === 'mass' ? '#fff' : 'transparent', border: 'none', padding: '0.6rem 1.5rem', borderRadius: '12px', fontSize: '0.95rem', fontWeight: '700', color: campaignTab === 'mass' ? '#0f172a' : '#64748b', cursor: 'pointer', transition: '0.2s', boxShadow: campaignTab === 'mass' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none' }}>
                    Власна розсилка
                  </button>
                </div>

                {/* 2.1 АВТОМАТИЧНІ КАМПАНІЇ */}
                {campaignTab === 'automated' && (
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {[
                        { id: 'welcome', title: 'Привітання нового клієнта', desc: 'Надсилається через 2 години після першого візиту з подякою.', badge: 'УТРИМАННЯ' },
                        { id: 'review', title: 'Запит на відгук', desc: 'Збирайте оцінки автоматично через 1 день після візиту.', badge: 'РЕПУТАЦІЯ' },
                        { id: 'lost', title: 'Повернення втрачених клієнтів', desc: 'Для тих, хто не був понад 45 днів. Може включати спецпропозицію.', badge: 'TOP ROI' },
                        { id: 'crossSell', title: 'Пропозиція супутніх послуг', desc: 'Розкажіть клієнтам про інші ваші послуги через 21 день.', badge: '' },
                      ].map((item, idx) => {
                        const isActive = (automations as any)[item.id];
                        return (
                          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', background: '#fff', borderBottom: idx !== 3 ? '1px solid #f1f5f9' : 'none', transition: '0.2s' }}>
                            <div style={{ flex: 1, paddingRight: '2rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.4rem' }}>
                                <h4 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>{item.title}</h4>
                                {item.badge && <span style={{ fontSize: '0.65rem', fontWeight: '800', color: '#3b82f6', background: '#eff6ff', padding: '0.2rem 0.6rem', borderRadius: '6px', letterSpacing: '0.05em' }}>{item.badge}</span>}
                              </div>
                              <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0, lineHeight: '1.4' }}>{item.desc}</p>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: isActive ? '#3b82f6' : '#94a3b8' }}>
                                {isActive ? 'Увімкнено' : 'Вимкнено'}
                              </span>
                              {/* 🟢 М'ЯКИЙ iOS ТУМБЛЕР */}
                              <div
                                onClick={() => setAutomations({ ...automations, [item.id]: !isActive })}
                                style={{ width: '44px', height: '24px', borderRadius: '12px', background: isActive ? '#3b82f6' : '#e2e8f0', position: 'relative', cursor: 'pointer', transition: 'background 0.3s', flexShrink: 0 }}
                              >
                                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: isActive ? '22px' : '2px', transition: 'left 0.3s cubic-bezier(0.25, 1, 0.5, 1)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}></div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* 2.2 МАСОВІ РОЗСИЛКИ + 🪄 AI MAGIC */}
                {campaignTab === 'mass' && (() => {
                  const handleAIGenerate = () => {
                    const templates: any = {
                      all: [
                        "Скучили за вами! 💇‍♂️ Знижка 15% на будь-яку послугу до кінця тижня. Бронюйте час онлайн: [посилання]",
                        "Вільне вікно на сьогодні! 🔥 Запишіться протягом години та отримайте догляд у подарунок: [посилання]"
                      ],
                      vip: [
                        "Тільки для своїх 🤫 Забронюйте час цього тижня і отримайте преміум-догляд абсолютно безкоштовно: [посилання]"
                      ],
                      lost: [
                        "Давно не бачились! 👀 Даруємо -20% на ваше наступне відвідування. Чекаємо на вас: [посилання]"
                      ]
                    };
                    const selectedTpl = templates[marketingForm.audience] || templates.all;
                    let randomText = marketingForm.message;
                    while (randomText === marketingForm.message) {
                      randomText = selectedTpl[Math.floor(Math.random() * selectedTpl.length)];
                    }
                    setMarketingForm({ ...marketingForm, message: randomText });
                  };

                  return (
                  <div style={{ maxWidth: '750px', background: '#fff', padding: '2rem', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                      {/* Вибір типу */}
                      <div style={{ display: 'flex', gap: '0.5rem', background: '#f8fafc', padding: '0.4rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                        <div onClick={() => setMarketingForm({...marketingForm, type: 'sms'})} style={{ flex: 1, padding: '1rem', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', background: marketingForm.type === 'sms' ? '#fff' : 'transparent', color: marketingForm.type === 'sms' ? '#0f172a' : '#64748b', transition: '0.2s', boxShadow: marketingForm.type === 'sms' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none' }}>
                          <Icons.Phone /> <span style={{ fontWeight: '700' }}>SMS-розсилка</span>
                        </div>
                        <div onClick={() => setMarketingForm({...marketingForm, type: 'email'})} style={{ flex: 1, padding: '1rem', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', background: marketingForm.type === 'email' ? '#fff' : 'transparent', color: marketingForm.type === 'email' ? '#0f172a' : '#64748b', transition: '0.2s', boxShadow: marketingForm.type === 'email' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none' }}>
                          <Icons.Mail /> <span style={{ fontWeight: '700' }}>Email-лист</span>
                        </div>
                      </div>

                      {/* Аудиторія */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '0.5rem' }}>Оберіть аудиторію</label>
                        <div className="modal-select-wrapper">
                          <select value={marketingForm.audience} onChange={e => setMarketingForm({...marketingForm, audience: e.target.value})} style={{ padding: '1rem', fontSize: '0.95rem', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#fff' }}>
                            <option value="all">Усі клієнти ({clientsList.length})</option>
                            <option value="vip">Тільки VIP-клієнти</option>
                            <option value="lost">Не були понад 30 днів (Спробувати повернути)</option>
                          </select>
                          <div className="modal-select-icon" style={{ right: '1.2rem' }}><Icons.ChevronDown /></div>
                        </div>
                      </div>

                      {/* Текст + AI */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                          <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#475569' }}>Текст повідомлення</label>
                          <button
                            onClick={handleAIGenerate}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'linear-gradient(135deg, #a855f7 0%, #3b82f6 100%)', color: '#fff', border: 'none', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer', transition: 'transform 0.2s', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)' }}
                            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
                            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                          >
                            <Icons.Sparkles /> AI-Генератор
                          </button>
                        </div>
                        <div style={{ position: 'relative' }}>
                          <textarea
                            value={marketingForm.message}
                            onChange={e => setMarketingForm({...marketingForm, message: e.target.value})}
                            className="inline-input custom-scroll"
                            style={{ width: '100%', minHeight: '160px', padding: '1.25rem', border: '1px solid #cbd5e1', borderRadius: '16px', fontSize: '1rem', background: '#fff', color: '#0f172a', resize: 'vertical', lineHeight: '1.5' }}
                            placeholder="Напишіть своє повідомлення або скористайтеся AI-генератором..."
                          />
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.4rem', fontWeight: '600' }}>
                          {marketingForm.message.length} символів
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '2.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '2rem' }}>
                      <button
                        onClick={handleSendMarketing}
                        disabled={isSendingPromo || clientsList.length === 0}
                        style={{ width: '100%', padding: '1.2rem', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '16px', fontWeight: '800', fontSize: '1.1rem', cursor: (isSendingPromo || clientsList.length === 0) ? 'not-allowed' : 'pointer', opacity: (isSendingPromo || clientsList.length === 0) ? 0.7 : 1, transition: '0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.6rem', boxShadow: '0 4px 20px rgba(15,23,42,0.15)' }}
                        onMouseOver={e => { if(!isSendingPromo && clientsList.length > 0) e.currentTarget.style.backgroundColor = '#1e293b' }}
                        onMouseOut={e => { if(!isSendingPromo && clientsList.length > 0) e.currentTarget.style.backgroundColor = '#0f172a' }}
                      >
                        {isSendingPromo ? 'НАДСИЛАННЯ...' : <><Icons.Send /> ВІДПРАВИТИ ({clientsList.length} клієнтів)</>}
                      </button>
                    </div>
                  </div>
                  );
                })()}
              </div>
            )}

            {/* 🟢 3. АКЦІЇ ТА ЗНИЖКИ (ЗГЛАДЖЕНИЙ СТИЛЬ) */}
            {marketingView === 'promotions' && (
              <div style={{ animation: 'fadeIn 0.3s ease-in-out', display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '900px' }}>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2.5rem' }}>
                  <button onClick={() => setMarketingView('overview')} style={{ background: '#fff', border: '1px solid #e2e8f0', width: '44px', height: '44px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a', cursor: 'pointer', transition: '0.2s', flexShrink: 0, boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }} onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = '#fff'}>
                    <Icons.ChevronLeft />
                  </button>
                  <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.2rem 0', letterSpacing: '-0.02em' }}>Промо та Знижки</h2>
                    <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>Заповнюйте порожні вікна в календарі за допомогою промокампаній.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                  {[
                    { icon: Icons.Sparkles, color: '#3b82f6', bg: '#eff6ff', title: 'Швидкий розпродаж (Flash Sale)', desc: 'Встановіть тимчасову знижку на вибрані послуги. Чудово працює перед святами.' },
                    { icon: Icons.Clock, color: '#eab308', bg: '#fefce8', title: 'Щасливі години (Happy Hours)', desc: 'Автоматично пропонуйте знижку в "мертві" години (наприклад, з 10:00 до 14:00).' },
                    { icon: Icons.TrendingDown, color: '#10b981', bg: '#f0fdf4', title: 'Знижка в останню хвилину', desc: 'Знижуйте ціну на вікна, які несподівано звільнилися на сьогодні або на завтра.' },
                    { icon: Icons.TrendingUp, color: '#ef4444', bg: '#fef2f2', title: 'Преміум години (Націнка)', desc: 'Встановіть націнку (+10-20%) на піковий час (наприклад, вечір п\'ятниці).' }
                  ].map((promo, idx) => (
                    <div
                      key={idx}
                      onClick={() => setComingSoonModal({ isOpen: true, title: promo.title, desc: 'Налаштування цієї акції наразі знаходяться в розробці. Слідкуйте за оновленнями!' })}
                      style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '1.5rem 2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1.5rem', borderRadius: '24px', transition: 'all 0.2s ease', boxShadow: '0 4px 20px rgba(0,0,0,0.01)' }}
                      onMouseOver={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.04)'; }}
                      onMouseOut={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.01)'; }}
                    >
                      <div style={{ width: '60px', height: '60px', background: promo.bg, borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: promo.color, flexShrink: 0 }}>
                        <promo.icon />
                      </div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.3rem 0' }}>{promo.title}</h4>
                        <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0, lineHeight: '1.4' }}>{promo.desc}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', background: '#f1f5f9', padding: '0.4rem 0.8rem', borderRadius: '8px', letterSpacing: '0.05em' }}>ВИМКНЕНО</span>
                        <div style={{ color: '#cbd5e1' }}><Icons.ChevronRight /></div>
                      </div>
                    </div>
                  ))}

                </div>
              </div>
            )}

            {/* 🟢 МОДАЛЬНЕ ВІКНО ДЛЯ "У РОЗРОБЦІ" (Щоб не було сірого алерту) */}
            {comingSoonModal.isOpen && (
              <div className="modal-overlay" onClick={() => setComingSoonModal({ isOpen: false, title: '', desc: '' })}>
                <div className="modal-content" onClick={e => e.stopPropagation()} style={{ animation: 'slideUp 0.3s ease', maxWidth: '420px', textAlign: 'center', padding: '2.5rem', borderRadius: '24px' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                    <Icons.Sparkles />
                  </div>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.8rem' }}>{comingSoonModal.title}</h2>
                  <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '2rem' }}>
                    {comingSoonModal.desc}
                  </p>
                  <button
                    onClick={() => setComingSoonModal({ isOpen: false, title: '', desc: '' })}
                    style={{ width: '100%', padding: '0.85rem', backgroundColor: '#0f172a', border: 'none', borderRadius: '16px', fontWeight: '700', fontSize: '1rem', color: '#ffffff', cursor: 'pointer', transition: '0.2s', boxShadow: '0 4px 15px rgba(15,23,42,0.2)' }}
                    onMouseOver={e => e.currentTarget.style.background = '#1e293b'}
                    onMouseOut={e => e.currentTarget.style.background = '#0f172a'}
                  >
                    Зрозуміло
                  </button>
                </div>
              </div>
            )}

          </div>
        )
                                    /* --- 7. ПЕРСОНАЛ (КОМАНДА) --- */
        : activeTab === 'Team' ? (
          <div style={{ display: 'flex', height: '100%', width: '100%', backgroundColor: '#fff', overflow: 'hidden' }}>

            {(() => {
              // 🟢 ЛОГІКА: Вибір майстра
              let currentStaff = selectedStaffId ? team.find(t => String(t.id) === String(selectedStaffId)) : team[0];
              if (!selectedStaffId && team.length > 0) setTimeout(() => setSelectedStaffId(team[0].id), 0);

              // 🟢 РОЗУМНЕ ПІДТЯГУВАННЯ ДАНИХ
              if (currentStaff) {
                const isOwner = currentStaff.name?.includes('Власник') || currentStaff.role === 'owner';
                currentStaff = { ...currentStaff };

                if (isOwner) {
                  if (currentStaff.name === 'Я (Власник)' && userProfile?.full_name && !userProfile.full_name.includes('@')) {
                    currentStaff.name = userProfile.full_name;
                  }
                  if (!currentStaff.phone || currentStaff.phone.trim() === '') currentStaff.phone = userProfile?.phone || business?.phone || '';
                  if (!currentStaff.email || currentStaff.email.trim() === '') currentStaff.email = userProfile?.email || business?.email || (userProfile?.full_name?.includes('@') ? userProfile.full_name : '') || '';
                  if (!currentStaff.title || currentStaff.title.trim() === '') currentStaff.title = 'Власник бізнесу';
                } else {
                  if (business?.team && Array.isArray(business.team)) {
                    const sName = currentStaff.name?.trim().toLowerCase() || '';
                    const regData = business.team.find((t: any) => typeof t === 'object' && t.name && t.name.trim().toLowerCase() === sName);

                    if (regData) {
                      if (!currentStaff.phone || currentStaff.phone.trim() === '') currentStaff.phone = regData.phone || regData.phoneNumber || regData.phone_number || '';
                      if (!currentStaff.email || currentStaff.email.trim() === '') currentStaff.email = regData.email || regData.mail || '';
                      if (!currentStaff.title || currentStaff.title.trim() === '') currentStaff.title = regData.title || regData.role || regData.position || '';
                    }
                  }
                  if (!currentStaff.title || currentStaff.title.trim() === '') {
                     currentStaff.title = currentStaff.role === 'admin' ? 'Адміністратор' : 'Спеціаліст';
                  }
                }
              }

              const filteredTeam = team.filter(member => member.name.toLowerCase().includes(staffSearchQuery.toLowerCase()));
              const providesServices = currentStaff?.provides_services !== false;
              const isOwnerProfile = currentStaff?.name?.includes('Власник') || currentStaff?.role === 'owner';

              // 🟢 ПРАВА ДОСТУПУ (RBAC)
              const currentUserRole = 'admin'; // 'admin', 'owner' або 'master'
              const hasAdminRights = currentUserRole === 'admin' || currentUserRole === 'owner';

              const staffShifts = currentStaff?.shifts && currentStaff.shifts.length > 0 ? currentStaff.shifts : shifts;

              // 🟢 ЛОГІКА: ЕКСПОРТ В ГУГЛ / APPLE КАЛЕНДАР (.ics)
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
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `grafik_${currentStaff.name.replace(/\s+/g, '_')}.ics`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              };

              // 🟢 ЛОГІКА: Оновлення послуг (Локально)
              const toggleStaffService = (serviceId: string) => {
                if (!currentStaff || !providesServices || !hasAdminRights) return;
                const currentAssigned = currentStaff.assigned_services || services.map(s => s.id);
                let newAssigned;

                if (currentAssigned.includes(serviceId)) {
                  newAssigned = currentAssigned.filter((id: string) => id !== serviceId);
                } else {
                  newAssigned = [...currentAssigned, serviceId];
                }
                handleUpdateLocalStaff({ assigned_services: newAssigned });
              };

              // 🟢 ЛОГІКА: Оновлення профілю локально
              const handleUpdateLocalStaff = (updates: any) => {
                const updatedStaff = { ...currentStaff, ...updates };
                setTeam(team.map(t => String(t.id) === String(currentStaff.id) ? updatedStaff : t));
              };

              // 🟢 ЛОГІКА: Збереження Загальної інформації в БД
              const handleSaveGeneralInfo = async () => {
                 if (!currentStaff || !hasAdminRights) return;
                 const { error } = await supabase.from('staff').update({
                    name: currentStaff.name,
                    title: currentStaff.title,
                    phone: currentStaff.phone,
                    email: currentStaff.email
                 }).eq('id', currentStaff.id);
                 if (error) throw error;

                 setTeam(team.map(t => String(t.id) === String(currentStaff.id) ? { ...t, name: currentStaff.name, title: currentStaff.title, phone: currentStaff.phone, email: currentStaff.email } : t));
              };

              // 🟢 ЛОГІКА: Збереження Налаштувань в БД
              const handleSaveSettingsDB = async (updates: any) => {
                if (!currentStaff || !hasAdminRights) return;
                handleUpdateLocalStaff(updates);
                const { error } = await supabase.from('staff').update(updates).eq('id', currentStaff.id);
                if (error) throw error;
              };

              const handleDeleteStaff = async () => {
                if (!currentStaff || !hasAdminRights) return;
                if (isOwnerProfile) return alert("Неможливо видалити профіль власника бізнесу.");
                if (!confirm(`Ви впевнені, що хочете звільнити ${currentStaff.name}? Усі майбутні записи до цього майстра потрібно буде перенести вручну.`)) return;

                try {
                  await supabase.from('staff').delete().eq('id', currentStaff.id);
                  setTeam(team.filter(t => String(t.id) !== String(currentStaff.id)));
                  setSelectedStaffId(null);
                  setStaffActiveTab('general');
                } catch (err) {
                  console.error("Помилка видалення:", err);
                  alert("Не вдалося видалити співробітника.");
                }
              };

              const getRoleBadge = (staff: any) => {
                if (staff.name.includes('Власник') || staff.role === 'owner') return { label: 'Власник бізнесу', color: '#8b5cf6', bg: '#f3e8ff' };
                if (staff.role === 'admin') return { label: 'Адміністратор', color: '#3b82f6', bg: '#eff6ff' };
                return { label: 'Спеціаліст', color: '#10b981', bg: '#dcfce7' };
              };

              const activeStaffTab = staffActiveTab === 'settings' ? 'security' : (staffActiveTab || 'general');

              return (
                <>
                  {/* --- ЛІВА ПАНЕЛЬ --- */}
                  <div style={{ width: '300px', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', backgroundColor: '#fcfcfc', zIndex: 10 }}>
                    <div style={{ padding: '2rem 1.5rem 1rem 1.5rem' }}>
                      <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', margin: '0 0 1rem 0' }}>Команда</h2>

                      <div style={{ position: 'relative', marginBottom: '1rem' }}>
                        <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}><Icons.Search /></div>
                        <input
                          type="text"
                          placeholder="Пошук співробітника..."
                          value={staffSearchQuery}
                          onChange={(e) => setStaffSearchQuery(e.target.value)}
                          style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.2rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem', outline: 'none', transition: '0.2s', backgroundColor: '#fff', boxSizing: 'border-box' }}
                        />
                      </div>

                      {hasAdminRights && (
                        <button
                          onClick={() => setIsInviteStaffModalOpen(true)}
                          style={{ width: '100%', padding: '0.6rem', background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: '0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                          onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
                          onMouseOut={e => e.currentTarget.style.background = '#fff'}
                        >
                          <Icons.Plus /> Запросити в команду
                        </button>
                      )}
                    </div>

                    <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 1rem 1rem 1rem' }}>
                      {filteredTeam.map((member) => {
                        const isSelected = String(selectedStaffId) === String(member.id) || (selectedStaffId === null && member.id === team[0]?.id);
                        const isPending = member.status === 'pending';
                        const badge = getRoleBadge(member);

                        if (!hasAdminRights && String(member.id) !== String(currentStaff?.id)) return null;

                        return (
                          <div
                            key={member.id}
                            onClick={() => { setSelectedStaffId(member.id); setStaffActiveTab('general'); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.6rem 0.8rem', borderRadius: '8px', cursor: 'pointer', transition: '0.2s', backgroundColor: isSelected ? '#f1f5f9' : 'transparent', marginBottom: '0.2rem' }}
                            onMouseOver={e => { if(!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc' }}
                            onMouseOut={e => { if(!isSelected) e.currentTarget.style.backgroundColor = 'transparent' }}
                          >
                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: isSelected ? '#0f172a' : '#e2e8f0', color: isSelected ? '#fff' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.8rem', flexShrink: 0 }}>
                              {getUserInitials(member.name)}
                            </div>
                            <div style={{ overflow: 'hidden', flex: 1 }}>
                              <div style={{ fontWeight: isSelected ? '700' : '600', color: '#0f172a', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.name}</div>
                              <div style={{ fontSize: '0.75rem', color: isPending ? '#f59e0b' : '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {isPending ? (
                                  <><span style={{width: 6, height: 6, borderRadius: '50%', background: '#f59e0b'}}></span> Очікує підтвердження</>
                                ) : (
                                  badge.label
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      {filteredTeam.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                          Співробітників не знайдено
                        </div>
                      )}
                    </div>
                  </div>

                  {/* --- ПРАВА ПАНЕЛЬ --- */}
                  <div className="custom-scroll" style={{ flex: 1, backgroundColor: '#fff', overflowY: 'auto', position: 'relative' }}>
                    {currentStaff ? (
                      <div style={{ maxWidth: '850px', margin: '0 auto', padding: '3rem 2rem' }}>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '2rem', color: '#0f172a' }}>
                              {getUserInitials(currentStaff.name)}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <h1 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.5rem 0' }}>{currentStaff.name}</h1>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '0.85rem', fontWeight: '600' }}>

                                {currentStaff.status === 'pending' ? (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#b45309', background: '#fef3c7', padding: '0.3rem 0.8rem', borderRadius: '20px' }}>
                                    <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }}></span>
                                    Очікує прийняття
                                  </span>
                                ) : (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: getRoleBadge(currentStaff).color, background: getRoleBadge(currentStaff).bg, padding: '0.3rem 0.8rem', borderRadius: '20px' }}>
                                    <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: getRoleBadge(currentStaff).color }}></span>
                                    {getRoleBadge(currentStaff).label}
                                  </span>
                                )}

                                {currentStaff.phone && ( <span style={{ color: '#64748b' }}>{currentStaff.phone}</span> )}
                                {currentStaff.email && (
                                  <>
                                    <span style={{ color: '#cbd5e1' }}>•</span>
                                    <span style={{ color: '#64748b' }}>{currentStaff.email}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {providesServices && (
                            <button onClick={() => { setActiveTab('Calendar'); setFilterMaster(currentStaff.id); }} style={{ padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', background: '#0f172a', fontWeight: '700', fontSize: '0.85rem', color: '#fff', cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', gap: '0.4rem' }} onMouseOver={e => e.currentTarget.style.background = '#1e293b'} onMouseOut={e => e.currentTarget.style.background = '#0f172a'}>
                              <Icons.Calendar /> Журнал записів
                            </button>
                          )}
                        </div>

                        {/* НАВІГАЦІЯ ПО ВКЛАДКАХ */}
                        <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid #e2e8f0', marginBottom: '2.5rem', overflowX: 'auto', paddingBottom: '2px' }}>
                          <div onClick={() => setStaffActiveTab('general')} style={{ paddingBottom: '0.8rem', fontSize: '0.95rem', cursor: 'pointer', transition: '0.2s', fontWeight: activeStaffTab === 'general' ? '800' : '600', color: activeStaffTab === 'general' ? '#0f172a' : '#64748b', borderBottom: activeStaffTab === 'general' ? '2px solid #0f172a' : '2px solid transparent', whiteSpace: 'nowrap' }}>Загальна інформація</div>
                          <div onClick={() => setStaffActiveTab('services')} style={{ paddingBottom: '0.8rem', fontSize: '0.95rem', cursor: 'pointer', transition: '0.2s', fontWeight: activeStaffTab === 'services' ? '800' : '600', color: activeStaffTab === 'services' ? '#0f172a' : '#64748b', borderBottom: activeStaffTab === 'services' ? '2px solid #0f172a' : '2px solid transparent', whiteSpace: 'nowrap' }}>Послуги</div>
                          <div onClick={() => setStaffActiveTab('schedule')} style={{ paddingBottom: '0.8rem', fontSize: '0.95rem', cursor: 'pointer', transition: '0.2s', fontWeight: activeStaffTab === 'schedule' ? '800' : '600', color: activeStaffTab === 'schedule' ? '#0f172a' : '#64748b', borderBottom: activeStaffTab === 'schedule' ? '2px solid #0f172a' : '2px solid transparent', whiteSpace: 'nowrap' }}>Графік роботи</div>

                          <div onClick={() => setStaffActiveTab('finance')} style={{ paddingBottom: '0.8rem', fontSize: '0.95rem', cursor: 'pointer', transition: '0.2s', fontWeight: activeStaffTab === 'finance' ? '800' : '600', color: activeStaffTab === 'finance' ? '#0f172a' : '#64748b', borderBottom: activeStaffTab === 'finance' ? '2px solid #0f172a' : '2px solid transparent', whiteSpace: 'nowrap' }}>Зарплата</div>
                          {hasAdminRights && <div onClick={() => setStaffActiveTab('security')} style={{ paddingBottom: '0.8rem', fontSize: '0.95rem', cursor: 'pointer', transition: '0.2s', fontWeight: activeStaffTab === 'security' ? '800' : '600', color: activeStaffTab === 'security' ? '#0f172a' : '#64748b', borderBottom: activeStaffTab === 'security' ? '2px solid #0f172a' : '2px solid transparent', whiteSpace: 'nowrap' }}>Доступ та Безпека</div>}
                        </div>

                        {/* 1. ЗАГАЛЬНА ІНФОРМАЦІЯ */}
                        {activeStaffTab === 'general' && (
                          <div style={{ animation: 'fadeIn 0.3s ease-in-out', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '2rem' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>ПІБ співробітника</label>
                                  <input
                                    type="text"
                                    value={currentStaff.name || ''}
                                    onChange={e => handleUpdateLocalStaff({ name: e.target.value })}
                                    disabled={!hasAdminRights}
                                    style={{ width: '100%', padding: '0.8rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', color: '#0f172a', outline: 'none', opacity: hasAdminRights ? 1 : 0.7 }}
                                  />
                                </div>
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Посада (Для клієнтів)</label>
                                  <input
                                    type="text"
                                    value={currentStaff.title || ''}
                                    placeholder="Наприклад: Топ-Барбер, Стиліст"
                                    onChange={e => handleUpdateLocalStaff({ title: e.target.value })}
                                    disabled={!hasAdminRights}
                                    style={{ width: '100%', padding: '0.8rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', color: '#0f172a', outline: 'none', opacity: hasAdminRights ? 1 : 0.7 }}
                                  />
                                </div>
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Телефон</label>
                                  <input
                                    type="text"
                                    value={currentStaff.phone || ''}
                                    placeholder="+380..."
                                    onChange={e => handleUpdateLocalStaff({ phone: e.target.value })}
                                    disabled={!hasAdminRights}
                                    style={{ width: '100%', padding: '0.8rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', color: '#0f172a', outline: 'none', opacity: hasAdminRights ? 1 : 0.7 }}
                                  />
                                </div>
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Email</label>
                                  <input
                                    type="email"
                                    value={currentStaff.email || ''}
                                    onChange={e => handleUpdateLocalStaff({ email: e.target.value })}
                                    disabled={!hasAdminRights}
                                    style={{ width: '100%', padding: '0.8rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', color: '#0f172a', outline: 'none', opacity: hasAdminRights ? 1 : 0.7 }}
                                  />
                                </div>
                              </div>
                            </div>
                            {hasAdminRights && (
                              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                  onClick={async (e) => {
                                    const btn = e.currentTarget;
                                    const originalText = btn.innerText;
                                    btn.innerText = 'Збереження...';
                                    btn.style.opacity = '0.7';
                                    btn.disabled = true;
                                    try {
                                      await handleSaveGeneralInfo();
                                      btn.innerText = '✓ Збережено';
                                      btn.style.background = '#10b981';
                                      btn.style.opacity = '1';
                                      setTimeout(() => alert("Особисті дані успішно збережено!"), 50);
                                      setTimeout(() => { btn.innerText = originalText; btn.style.background = '#0f172a'; btn.disabled = false; }, 3000);
                                    } catch(err) {
                                      alert("Помилка при збереженні.");
                                      btn.innerText = originalText;
                                      btn.style.opacity = '1';
                                      btn.disabled = false;
                                    }
                                  }}
                                  style={{ padding: '0.75rem 2.5rem', borderRadius: '8px', border: 'none', background: '#0f172a', fontWeight: '700', color: '#fff', fontSize: '0.95rem', cursor: 'pointer', transition: '0.2s', boxShadow: '0 4px 12px rgba(15,23,42,0.2)' }}
                                >
                                  Зберегти дані
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 2. ПОСЛУГИ */}
                        {activeStaffTab === 'services' && (
                          <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
                            {!providesServices ? (
                              <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                                <div style={{ color: '#94a3b8', marginBottom: '1rem' }}><Icons.Services /></div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.5rem 0' }}>Послуги вимкнено</h3>
                                <p style={{ fontSize: '0.95rem', color: '#64748b' }}>Цей співробітник не працює з клієнтами. Ви можете змінити це у вкладці "Доступ та Безпека".</p>
                              </div>
                            ) : (
                              <>
                                {(() => {
                                  const filteredStaffServices = services.filter(srv =>
                                    srv.name.toLowerCase().includes(staffServiceSearchQuery.toLowerCase()) ||
                                    (srv.category && srv.category.toLowerCase().includes(staffServiceSearchQuery.toLowerCase()))
                                  );

                                  const servicesByCategory = filteredStaffServices.reduce((acc: any, srv: any) => {
                                    const cat = (srv.category && srv.category.trim() !== '') ? srv.category.trim() : 'Інші послуги';
                                    if (!acc[cat]) acc[cat] = [];
                                    acc[cat].push(srv);
                                    return acc;
                                  }, {});

                                  const categoryKeys = Object.keys(servicesByCategory);
                                  const showHeaders = !(categoryKeys.length === 1 && categoryKeys[0] === 'Інші послуги');

                                  const allAssigned = localAssignedServices.length === services.length;

                                  const toggleServiceLocally = (id: string) => {
                                     if (!hasAdminRights) return;
                                     if (localAssignedServices.includes(String(id))) {
                                        setLocalAssignedServices(localAssignedServices.filter(sId => sId !== String(id)));
                                     } else {
                                        setLocalAssignedServices([...localAssignedServices, String(id)]);
                                     }
                                  };

                                  const toggleAllLocally = () => {
                                     if (!hasAdminRights) return;
                                     if (allAssigned) setLocalAssignedServices([]);
                                     else setLocalAssignedServices(services.map(s => String(s.id)));
                                  };

                                  return (
                                    <>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>Оберіть послуги, які виконує цей спеціаліст.</p>
                                        <span style={{ fontSize: '0.85rem', color: '#0f172a', fontWeight: '700', background: '#f1f5f9', padding: '0.3rem 0.8rem', borderRadius: '20px' }}>
                                          Вибрано: {localAssignedServices.length} з {services.length}
                                        </span>
                                      </div>

                                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
                                        <div style={{ position: 'relative', flex: 1 }}>
                                          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}><Icons.Search /></div>
                                          <input
                                            type="text"
                                            placeholder="Знайти послугу..."
                                            value={staffServiceSearchQuery}
                                            onChange={(e) => setStaffServiceSearchQuery(e.target.value)}
                                            style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.2rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', transition: '0.2s', background: '#fff' }}
                                          />
                                        </div>
                                        {hasAdminRights && services.length > 0 && (
                                          <button
                                            onClick={toggleAllLocally}
                                            style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', padding: '0.6rem 1rem', borderRadius: '8px', transition: '0.2s', whiteSpace: 'nowrap' }}
                                            onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'}
                                            onMouseOut={e => e.currentTarget.style.background = '#f8fafc'}
                                          >
                                            {allAssigned ? 'Зняти всі' : 'Вибрати всі'}
                                          </button>
                                        )}
                                      </div>

                                      <div className="custom-scroll" style={{ maxHeight: '450px', overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                        {categoryKeys.map(category => {
                                          const filteredCatServices = servicesByCategory[category].filter((srv: any) =>
                                            srv.name.toLowerCase().includes(staffServiceSearchQuery.toLowerCase()) ||
                                            category.toLowerCase().includes(staffServiceSearchQuery.toLowerCase())
                                          );

                                          if (filteredCatServices.length === 0) return null;

                                          return (
                                            <div key={category}>
                                              {showHeaders && (
                                                <h4 style={{ fontSize: '0.8rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.8rem', paddingLeft: '0.5rem', letterSpacing: '0.05em' }}>
                                                  {category}
                                                </h4>
                                              )}
                                              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                                                {filteredCatServices.map((srv: any, idx: number) => {
                                                  const isAssigned = localAssignedServices.includes(String(srv.id));

                                                  return (
                                                    <div
                                                      key={srv.id}
                                                      onClick={() => toggleServiceLocally(srv.id)}
                                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', borderBottom: idx !== filteredCatServices.length - 1 ? '1px solid #f1f5f9' : 'none', cursor: hasAdminRights ? 'pointer' : 'default', transition: 'background 0.2s' }}
                                                      onMouseOver={e => { if(hasAdminRights) e.currentTarget.style.backgroundColor = '#f8fafc' }}
                                                      onMouseOut={e => { if(hasAdminRights) e.currentTarget.style.backgroundColor = 'transparent' }}
                                                    >
                                                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                        <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: isAssigned ? '#10b981' : '#f1f5f9', border: isAssigned ? 'none' : '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', transition: '0.2s', opacity: hasAdminRights ? 1 : 0.5 }}>
                                                          {isAssigned && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                                        </div>
                                                        <div>
                                                          <div style={{ fontWeight: '700', color: isAssigned ? '#0f172a' : '#94a3b8', fontSize: '0.95rem', transition: 'color 0.2s' }}>{srv.name}</div>
                                                        </div>
                                                      </div>

                                                      <div style={{ display: 'flex', alignItems: 'center', gap: '3rem', opacity: isAssigned ? 1 : 0.5, transition: 'opacity 0.2s' }}>
                                                        <div style={{ textAlign: 'right' }}>
                                                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.1rem' }}>Тривалість</div>
                                                          <div style={{ fontWeight: '600', color: '#475569', fontSize: '0.85rem' }}>{srv.duration} хв</div>
                                                        </div>
                                                        <div style={{ textAlign: 'right', minWidth: '70px' }}>
                                                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.1rem' }}>Вартість</div>
                                                          <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '0.9rem' }}>{srv.price} ₴</div>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  )
                                                })}
                                              </div>
                                            </div>
                                          )
                                        })}
                                        {services.length === 0 && <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Прайс-лист порожній.</div>}
                                        {services.length > 0 && filteredStaffServices.length === 0 && <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Послуг за цим запитом не знайдено.</div>}
                                      </div>

                                      {/* 🟢 НАДІЙНА КНОПКА ЗБЕРЕЖЕННЯ */}
                                      {hasAdminRights && (
                                        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
                                          <button
                                            onClick={async (e) => {
                                              const btn = e.currentTarget;
                                              const originalText = btn.innerText;
                                              btn.innerText = 'Збереження...';
                                              btn.style.opacity = '0.7';
                                              btn.disabled = true;
                                              try {
                                                await handleSaveSettingsDB({ assigned_services: localAssignedServices });
                                                btn.innerText = '✓ Збережено';
                                                btn.style.background = '#10b981';
                                                btn.style.opacity = '1';
                                                setTimeout(() => alert("Послуги майстра успішно збережено!"), 50);
                                                setTimeout(() => { btn.innerText = originalText; btn.style.background = '#0f172a'; btn.disabled = false; }, 3000);
                                              } catch(err) {
                                                alert("Помилка при збереженні.");
                                                btn.innerText = originalText;
                                                btn.style.opacity = '1';
                                                btn.disabled = false;
                                              }
                                            }}
                                            style={{ padding: '0.75rem 2.5rem', borderRadius: '8px', border: 'none', background: '#0f172a', fontWeight: '700', color: '#fff', fontSize: '0.95rem', cursor: 'pointer', transition: '0.2s', boxShadow: '0 4px 12px rgba(15,23,42,0.2)' }}
                                            onMouseOver={e => e.currentTarget.style.background = '#1e293b'}
                                            onMouseOut={e => e.currentTarget.style.background = '#0f172a'}
                                          >
                                            Зберегти послуги
                                          </button>
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </>
                            )}
                          </div>
                        )}

                        {/* 3. ГРАФІК РОБОТИ */}
                        {activeStaffTab === 'schedule' && (
                          <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
                            {!providesServices ? (
                              <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                                <div style={{ color: '#94a3b8', marginBottom: '1rem' }}><Icons.Clock /></div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.5rem 0' }}>Графік вимкнено</h3>
                                <p style={{ fontSize: '0.95rem', color: '#64748b' }}>Цей співробітник не працює з клієнтами.</p>
                              </div>
                            ) : (
                              <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                  <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>Регулярні робочі години спеціаліста.</p>
                                  <div style={{ display: 'flex', gap: '1rem' }}>
                                    <button
                                      onClick={handleExportToCalendar}
                                      style={{ fontSize: '0.8rem', color: '#0f172a', fontWeight: '700', background: '#f1f5f9', border: '1px solid #cbd5e1', cursor: 'pointer', padding: '0.5rem 1rem', borderRadius: '6px', transition: '0.2s', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                      onMouseOver={e => e.currentTarget.style.background = '#e2e8f0'}
                                      onMouseOut={e => e.currentTarget.style.background = '#f1f5f9'}
                                    >
                                      <Icons.Calendar /> Експорт в календар
                                    </button>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                  {staffShifts.map((schedule: any, idx: number) => (
                                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: '#fff', borderRadius: '12px', border: '1px solid #f1f5f9', transition: '0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '150px' }}>
                                        <div
                                          onClick={() => {
                                            if (!hasAdminRights) return;
                                            const newShifts = [...staffShifts];
                                            newShifts[idx].active = !schedule.active;
                                            handleUpdateLocalStaff({ shifts: newShifts });
                                          }}
                                          style={{ width: '40px', height: '22px', borderRadius: '11px', background: schedule.active ? (hasAdminRights ? '#10b981' : '#94a3b8') : '#cbd5e1', position: 'relative', cursor: hasAdminRights ? 'pointer' : 'default', transition: '0.3s', flexShrink: 0 }}
                                        >
                                          <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: schedule.active ? '20px' : '2px', transition: '0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}></div>
                                        </div>
                                        <div style={{ fontWeight: '700', color: schedule.active ? '#0f172a' : '#94a3b8', fontSize: '0.95rem' }}>{schedule.day}</div>
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                        {schedule.active ? (
                                          <>
                                            <input
                                              disabled={!hasAdminRights}
                                              type="time" value={schedule.start}
                                              onChange={(e) => { const newShifts = [...staffShifts]; newShifts[idx].start = e.target.value; handleUpdateLocalStaff({ shifts: newShifts }); }}
                                              style={{ padding: '0.4rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: '600', color: '#0f172a', fontSize: '0.9rem', background: '#f8fafc', outline: 'none', opacity: hasAdminRights ? 1 : 0.7 }}
                                            />
                                            <span style={{ color: '#cbd5e1', fontWeight: '800' }}>—</span>
                                            <input
                                              disabled={!hasAdminRights}
                                              type="time" value={schedule.end}
                                              onChange={(e) => { const newShifts = [...staffShifts]; newShifts[idx].end = e.target.value; handleUpdateLocalStaff({ shifts: newShifts }); }}
                                              style={{ padding: '0.4rem 0.6rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: '600', color: '#0f172a', fontSize: '0.9rem', background: '#f8fafc', outline: 'none', opacity: hasAdminRights ? 1 : 0.7 }}
                                            />
                                          </>
                                        ) : (
                                          <div style={{ padding: '0.4rem 2rem', color: '#94a3b8', fontWeight: '600', fontSize: '0.9rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #e2e8f0' }}>Вихідний</div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {hasAdminRights && (
                                  <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                                    <button
                                      onClick={async (e) => {
                                        const btn = e.currentTarget;
                                        const originalText = btn.innerText;
                                        btn.innerText = 'Збереження...';
                                        btn.style.opacity = '0.7';
                                        btn.disabled = true;
                                        try {
                                          await handleSaveSettingsDB({ shifts: staffShifts });
                                          btn.innerText = '✓ Збережено';
                                          btn.style.background = '#10b981';
                                          btn.style.opacity = '1';
                                          setTimeout(() => { btn.innerText = originalText; btn.style.background = '#0f172a'; btn.disabled = false; }, 1500);
                                        } catch(err) {
                                          btn.innerText = originalText; btn.style.opacity = '1'; btn.disabled = false;
                                        }
                                      }}
                                      style={{ padding: '0.75rem 2.5rem', borderRadius: '8px', border: 'none', background: '#0f172a', fontWeight: '700', color: '#fff', fontSize: '0.95rem', cursor: 'pointer', transition: '0.2s', boxShadow: '0 4px 12px rgba(15,23,42,0.2)' }}
                                    >
                                      Зберегти графік
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {/* 4. ЗАРПЛАТА ТА КОМІСІЙНІ */}
                        {activeStaffTab === 'finance' && (
                          <div style={{ animation: 'fadeIn 0.3s ease-in-out', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                            {/* БЛОК 1: ПОТОЧНИЙ БАЛАНС ТА ВИПЛАТА */}
                            {(() => {
                              const lastPayoutDate = currentStaff.last_payout_date ? new Date(currentStaff.last_payout_date) : null;

                              const masterApps = appointments.filter(a => {
                                 if (String(a.staff_id) !== String(currentStaff.id) || a.status !== 'completed') return false;
                                 const appDate = new Date(a.booking_date || a.start_time);
                                 return lastPayoutDate ? appDate > lastPayoutDate : true;
                              });

                              const masterRevenue = masterApps.reduce((sum, app) => {
                                const srv = services.find(s => String(s.id) === String(app.service_id));
                                return sum + (srv ? srv.price : 0);
                              }, 0);

                              const fixedToPay = currentStaff.fixed_salary || 0;
                              const commissionEarned = masterRevenue * ((currentStaff.commission_rate || 0) / 100);
                              const totalPending = Math.round(fixedToPay + commissionEarned);

                              const isPayoutDisabled = totalPending <= 0;

                              const handlePayout = async () => {
                                 if (isPayoutDisabled) return;
                                 if (!confirm(`Зафіксувати виплату ${totalPending.toLocaleString('uk-UA')} ₴ для ${currentStaff.name}? Баланс буде обнулено.`)) return;

                                 const newPayout = {
                                    id: Date.now(),
                                    date: new Date().toISOString(),
                                    amount: totalPending,
                                    services_count: masterApps.length,
                                    revenue: masterRevenue,
                                    fixed_part: fixedToPay,
                                    commission_part: commissionEarned
                                 };

                                 const newHistory = [newPayout, ...(currentStaff.payout_history || [])];

                                 try {
                                    await supabase.from('staff').update({
                                       payout_history: newHistory,
                                       last_payout_date: new Date().toISOString()
                                    }).eq('id', currentStaff.id);

                                    handleUpdateLocalStaff({ payout_history: newHistory, last_payout_date: new Date().toISOString() });
                                 } catch (err) {
                                    console.error(err);
                                    alert("Помилка збереження виплати.");
                                 }
                              };

                              return (
                                <div style={{ background: '#eff6ff', border: '1px dashed #3b82f6', borderRadius: '12px', padding: '1.5rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                      <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#2563eb', marginBottom: '0.5rem' }}>
                                          <Icons.TrendingUp />
                                          <span style={{ fontWeight: '800', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Поточний заробіток майстра</span>
                                        </div>
                                        <p style={{ fontSize: '0.85rem', color: '#3b82f6', margin: '0 0 1.5rem 0' }}>
                                          Невиплачений дохід {lastPayoutDate ? `з ${lastPayoutDate.toLocaleDateString('uk-UA')} ` : 'за весь час '}
                                          (Виконано послуг: <b>{masterApps.length}</b> на суму <b>{masterRevenue.toLocaleString('uk-UA')} ₴</b>)
                                        </p>

                                        <div style={{ display: 'flex', gap: '2rem' }}>
                                          <div>
                                            <div style={{ fontSize: '0.75rem', color: '#60a5fa', fontWeight: '700' }}>Ставка</div>
                                            <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#1d4ed8' }}>{fixedToPay.toLocaleString('uk-UA')} ₴</div>
                                          </div>
                                          <div style={{ fontSize: '1.2rem', color: '#93c5fd', marginTop: '0.5rem' }}>+</div>
                                          <div>
                                            <div style={{ fontSize: '0.75rem', color: '#60a5fa', fontWeight: '700' }}>Відсоток ({currentStaff.commission_rate || 0}%)</div>
                                            <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#1d4ed8' }}>{commissionEarned.toLocaleString('uk-UA')} ₴</div>
                                          </div>
                                          <div style={{ fontSize: '1.2rem', color: '#93c5fd', marginTop: '0.5rem' }}>=</div>
                                          <div>
                                            <div style={{ fontSize: '0.75rem', color: '#60a5fa', fontWeight: '700' }}>До виплати</div>
                                            <div style={{ fontSize: '1.6rem', fontWeight: '900', color: '#1e3a8a', lineHeight: 1.2 }}>
                                              {totalPending.toLocaleString('uk-UA')} ₴
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {hasAdminRights && (
                                        <button
                                          onClick={handlePayout}
                                          disabled={isPayoutDisabled}
                                          style={{ background: isPayoutDisabled ? '#bfdbfe' : '#3b82f6', color: '#fff', border: 'none', padding: '0.8rem 1.5rem', borderRadius: '8px', fontWeight: '700', fontSize: '0.9rem', cursor: isPayoutDisabled ? 'not-allowed' : 'pointer', transition: '0.2s', boxShadow: isPayoutDisabled ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                        >
                                          <Icons.CheckCircle /> {isPayoutDisabled ? 'Виплачено' : 'Зафіксувати виплату'}
                                        </button>
                                      )}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* БЛОК 2: НАЛАШТУВАННЯ ЗАРПЛАТИ */}
                            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#f8fafc', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icons.Settings /></div>
                                <div>
                                  <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.2rem 0' }}>Налаштування зарплати</h3>
                                  <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>Умови нарахування для {currentStaff.name}.</p>
                                </div>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', padding: '1.5rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '0.5rem' }}>Комісія від послуг (%)</label>
                                  <div style={{ position: 'relative' }}>
                                    <input
                                      type="number"
                                      value={currentStaff.commission_rate || 0}
                                      onChange={e => hasAdminRights && handleUpdateLocalStaff({ commission_rate: Number(e.target.value) })}
                                      disabled={!hasAdminRights}
                                      style={{ width: '100%', padding: '0.8rem', paddingRight: '2rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '1rem', fontWeight: '700', color: '#0f172a', outline: 'none', opacity: hasAdminRights ? 1 : 0.7 }}
                                    />
                                    <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontWeight: '700' }}>%</span>
                                  </div>
                                </div>

                                <div>
                                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '0.5rem' }}>Фіксована ставка (₴)</label>
                                  <div style={{ position: 'relative' }}>
                                    <input
                                      type="number"
                                      value={currentStaff.fixed_salary || 0}
                                      onChange={e => hasAdminRights && handleUpdateLocalStaff({ fixed_salary: Number(e.target.value) })}
                                      disabled={!hasAdminRights}
                                      style={{ width: '100%', padding: '0.8rem', paddingRight: '2rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '1rem', fontWeight: '700', color: '#0f172a', outline: 'none', opacity: hasAdminRights ? 1 : 0.7 }}
                                    />
                                    <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontWeight: '700' }}>₴</span>
                                  </div>
                                </div>
                              </div>

                              <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'flex-start' }}>

                                 <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                   <div>
                                     <h4 style={{ fontSize: '0.9rem', fontWeight: '800', color: '#0f172a', marginBottom: '1rem' }}>Додаткові правила</h4>
                                     <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '0.5rem' }}>Періодичність виплат</label>
                                     <div style={{ position: 'relative' }}>
                                       <select
                                          value={currentStaff.payout_period || 'weekly'}
                                          onChange={e => {
                                            if (hasAdminRights) {
                                              const newPeriod = e.target.value;
                                              const newDay = newPeriod === 'weekly' ? 'monday' : '1';
                                              handleUpdateLocalStaff({ payout_period: newPeriod, payout_day: newDay });
                                            }
                                          }}
                                          disabled={!hasAdminRights}
                                          style={{ width: '100%', padding: '0.6rem 2.5rem 0.6rem 0.8rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem', color: '#0f172a', outline: 'none', cursor: hasAdminRights ? 'pointer' : 'default', opacity: hasAdminRights ? 1 : 0.7, appearance: 'none', minWidth: '200px' }}
                                        >
                                          <option value="daily">Щодня (наприкінці зміни)</option>
                                          <option value="weekly">Раз на тиждень</option>
                                          <option value="biweekly">Двічі на місяць</option>
                                          <option value="monthly">Раз на місяць</option>
                                        </select>
                                        <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }}><Icons.ChevronDown /></div>
                                     </div>
                                   </div>

                                   {currentStaff.payout_period !== 'daily' && (
                                     <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
                                       <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '0.5rem' }}>
                                         {currentStaff.payout_period === 'weekly' ? 'День виплати' : 'Число місяця'}
                                       </label>
                                       <div style={{ position: 'relative' }}>
                                         <select
                                            value={currentStaff.payout_day || (currentStaff.payout_period === 'weekly' ? 'monday' : '1')}
                                            onChange={e => hasAdminRights && handleUpdateLocalStaff({ payout_day: e.target.value })}
                                            disabled={!hasAdminRights}
                                            style={{ width: '100%', padding: '0.6rem 2.5rem 0.6rem 0.8rem', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.9rem', color: '#0f172a', outline: 'none', cursor: hasAdminRights ? 'pointer' : 'default', opacity: hasAdminRights ? 1 : 0.7, appearance: 'none', minWidth: '200px' }}
                                          >
                                            {currentStaff.payout_period === 'weekly' && (
                                              <>
                                                <option value="monday">Понеділок</option>
                                                <option value="tuesday">Вівторок</option>
                                                <option value="wednesday">Середа</option>
                                                <option value="thursday">Четвер</option>
                                                <option value="friday">П'ятниця</option>
                                                <option value="saturday">Субота</option>
                                                <option value="sunday">Неділя</option>
                                              </>
                                            )}
                                            {currentStaff.payout_period === 'monthly' && (
                                              [...Array(31)].map((_, i) => (
                                                <option key={i+1} value={String(i+1)}>{i+1}-е число</option>
                                              ))
                                            )}
                                            {currentStaff.payout_period === 'biweekly' && (
                                              [...Array(15)].map((_, i) => (
                                                <option key={i+1} value={String(i+1)}>{i+1}-е та {i+1+15}-е число</option>
                                              ))
                                            )}
                                          </select>
                                          <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }}><Icons.ChevronDown /></div>
                                       </div>
                                     </div>
                                   )}
                                 </div>

                                 <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', marginTop: '2.5rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: hasAdminRights ? 'pointer' : 'default', opacity: hasAdminRights ? 1 : 0.7 }}>
                                      <div style={{ position: 'relative', display: 'inline-block', width: '36px', height: '20px', flexShrink: 0 }}>
                                        <input
                                          type="checkbox"
                                          checked={currentStaff.auto_payout || false}
                                          onChange={e => hasAdminRights && handleUpdateLocalStaff({ auto_payout: e.target.checked })}
                                          style={{ opacity: 0, width: 0, height: 0 }}
                                        />
                                        <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: currentStaff.auto_payout ? '#10b981' : '#cbd5e1', transition: '.2s', borderRadius: '24px' }}>
                                          <span style={{ position: 'absolute', height: '16px', width: '16px', left: currentStaff.auto_payout ? '18px' : '2px', bottom: '2px', backgroundColor: 'white', transition: '.2s', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}></span>
                                        </span>
                                      </div>
                                      <span style={{ fontSize: '0.85rem', fontWeight: currentStaff.auto_payout ? '700' : '600', color: currentStaff.auto_payout ? '#10b981' : '#475569', transition: 'color 0.2s' }}>
                                        Автоматично обнуляти баланс
                                      </span>
                                    </label>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: hasAdminRights ? 'pointer' : 'default', opacity: hasAdminRights ? 1 : 0.7 }}>
                                      <div style={{ position: 'relative', display: 'inline-block', width: '36px', height: '20px', flexShrink: 0 }}>
                                        <input
                                          type="checkbox"
                                          checked={currentStaff.keeps_tips !== false}
                                          onChange={e => hasAdminRights && handleUpdateLocalStaff({ keeps_tips: e.target.checked })}
                                          style={{ opacity: 0, width: 0, height: 0 }}
                                        />
                                        <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: currentStaff.keeps_tips !== false ? '#10b981' : '#cbd5e1', transition: '.2s', borderRadius: '24px' }}>
                                          <span style={{ position: 'absolute', height: '16px', width: '16px', left: currentStaff.keeps_tips !== false ? '18px' : '2px', bottom: '2px', backgroundColor: 'white', transition: '.2s', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}></span>
                                        </span>
                                      </div>
                                      <span style={{ fontSize: '0.85rem', fontWeight: currentStaff.keeps_tips !== false ? '700' : '600', color: currentStaff.keeps_tips !== false ? '#10b981' : '#475569', transition: 'color 0.2s' }}>
                                        Майстер отримує 100% чайових
                                      </span>
                                    </label>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: hasAdminRights ? 'pointer' : 'default', opacity: hasAdminRights ? 1 : 0.7 }}>
                                      <div style={{ position: 'relative', display: 'inline-block', width: '36px', height: '20px', flexShrink: 0 }}>
                                        <input
                                          type="checkbox"
                                          checked={currentStaff.deduct_materials || false}
                                          onChange={e => hasAdminRights && handleUpdateLocalStaff({ deduct_materials: e.target.checked })}
                                          style={{ opacity: 0, width: 0, height: 0 }}
                                        />
                                        <span style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: currentStaff.deduct_materials ? '#10b981' : '#cbd5e1', transition: '.2s', borderRadius: '24px' }}>
                                          <span style={{ position: 'absolute', height: '16px', width: '16px', left: currentStaff.deduct_materials ? '18px' : '2px', bottom: '2px', backgroundColor: 'white', transition: '.2s', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}></span>
                                        </span>
                                      </div>
                                      <span style={{ fontSize: '0.85rem', fontWeight: currentStaff.deduct_materials ? '700' : '600', color: currentStaff.deduct_materials ? '#10b981' : '#475569', transition: 'color 0.2s' }}>
                                        Вираховувати вартість матеріалів
                                      </span>
                                    </label>

                                 </div>
                              </div>

                              {hasAdminRights && (
                                <div style={{ marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                                  <button
                                    onClick={async (e) => {
                                      const btn = e.currentTarget;
                                      const originalText = btn.innerText;
                                      btn.innerText = 'Збереження...';
                                      btn.style.opacity = '0.7';
                                      btn.disabled = true;
                                      try {
                                        await handleSaveSettingsDB({
                                          commission_rate: currentStaff.commission_rate,
                                          fixed_salary: currentStaff.fixed_salary,
                                          payout_period: currentStaff.payout_period,
                                          payout_day: currentStaff.payout_day,
                                          auto_payout: currentStaff.auto_payout,
                                          keeps_tips: currentStaff.keeps_tips,
                                          deduct_materials: currentStaff.deduct_materials
                                        });
                                        btn.innerText = '✓ Збережено';
                                        btn.style.background = '#10b981';
                                        btn.style.opacity = '1';
                                        setTimeout(() => alert("Налаштування зарплати успішно збережено!"), 50);
                                        setTimeout(() => { btn.innerText = originalText; btn.style.background = '#0f172a'; btn.disabled = false; }, 3000);
                                      } catch(err) {
                                        alert("Помилка при збереженні.");
                                        btn.innerText = originalText;
                                        btn.style.opacity = '1';
                                        btn.disabled = false;
                                      }
                                    }}
                                    style={{ padding: '0.8rem 2rem', borderRadius: '8px', border: 'none', background: '#0f172a', fontWeight: '700', color: '#fff', fontSize: '0.95rem', cursor: 'pointer', transition: '0.2s', boxShadow: '0 4px 12px rgba(15,23,42,0.2)' }}
                                  >
                                    Зберегти налаштування зарплати
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* БЛОК 3: АРХІВ ВИПЛАТ */}
                            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem' }}>
                               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                 <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>Історія виплат</h3>
                                 {currentStaff.payout_history && currentStaff.payout_history.length > 0 && (
                                   <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>
                                     Всього виплат: {currentStaff.payout_history.length}
                                   </span>
                                 )}
                               </div>

                               <div className="custom-scroll" style={{ display: 'flex', flexDirection: 'column', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                                 {currentStaff.payout_history && currentStaff.payout_history.length > 0 ? (
                                   currentStaff.payout_history.map((payout: any, i: number) => (
                                     <div key={payout.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: i !== currentStaff.payout_history.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                       <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icons.CheckCircle /></div>
                                          <div>
                                            <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.95rem' }}>
                                              Виплата • {new Date(payout.date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                                               {new Date(payout.date).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })} • Ставка: {payout.fixed_part || 0} ₴ • Комісія: {payout.commission_part || 0} ₴
                                            </div>
                                          </div>
                                       </div>
                                       <div style={{ fontWeight: '800', color: '#10b981', fontSize: '1.1rem', whiteSpace: 'nowrap' }}>
                                          {payout.amount.toLocaleString('uk-UA')} ₴
                                       </div>
                                     </div>
                                   ))
                                 ) : (
                                   <div style={{ textAlign: 'center', padding: '3rem 2rem', border: '1px dashed #e2e8f0', borderRadius: '8px' }}>
                                     <div style={{ color: '#94a3b8', fontSize: '0.95rem', fontWeight: '500' }}>Історія виплат порожня.</div>
                                     <div style={{ color: '#cbd5e1', fontSize: '0.8rem', marginTop: '0.5rem' }}>Щойно ви зафіксуєте виплату, вона з'явиться тут.</div>
                                   </div>
                                 )}
                               </div>
                            </div>

                          </div>
                        )}

                        {/* 5. ДОСТУП ТА БЕЗПЕКА (Тільки для Адмінів) */}
                        {activeStaffTab === 'security' && hasAdminRights && (
                          <div style={{ animation: 'fadeIn 0.3s ease-in-out', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                            {/* Налаштування Ролі */}
                            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem' }}>
                              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', margin: '0 0 1rem 0' }}>Системна роль</h3>
                              <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem' }}>Визначає рівень доступу співробітника до панелі керування та фінансових звітів.</p>

                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div
                                  onClick={() => !isOwnerProfile && handleUpdateLocalStaff({ role: 'master' })}
                                  style={{ padding: '1rem', border: `2px solid ${currentStaff.role !== 'admin' && !isOwnerProfile ? '#0f172a' : '#e2e8f0'}`, borderRadius: '10px', cursor: isOwnerProfile ? 'not-allowed' : 'pointer', background: currentStaff.role !== 'admin' && !isOwnerProfile ? '#f8fafc' : '#fff', opacity: isOwnerProfile ? 0.5 : 1, transition: '0.2s' }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                                    <input type="radio" checked={currentStaff.role !== 'admin' && !isOwnerProfile} readOnly style={{ accentColor: '#0f172a' }} />
                                    <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.95rem' }}>Спеціаліст</span>
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: '#64748b', paddingLeft: '1.5rem' }}>Має доступ лише до свого календаря та записів. Не бачить фінанси салону.</div>
                                </div>

                                <div
                                  onClick={() => !isOwnerProfile && handleUpdateLocalStaff({ role: 'admin' })}
                                  style={{ padding: '1rem', border: `2px solid ${currentStaff.role === 'admin' || isOwnerProfile ? '#0f172a' : '#e2e8f0'}`, borderRadius: '10px', cursor: isOwnerProfile ? 'not-allowed' : 'pointer', background: currentStaff.role === 'admin' || isOwnerProfile ? '#f8fafc' : '#fff', opacity: isOwnerProfile && currentStaff.role !== 'admin' ? 0.5 : 1, transition: '0.2s' }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                                    <input type="radio" checked={currentStaff.role === 'admin' || isOwnerProfile} readOnly style={{ accentColor: '#0f172a' }} />
                                    <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.95rem' }}>Адміністратор</span>
                                  </div>
                                  <div style={{ fontSize: '0.8rem', color: '#64748b', paddingLeft: '1.5rem' }}>Має повний доступ до клієнтської бази, розкладу всіх майстрів та налаштувань.</div>
                                </div>
                              </div>
                              {isOwnerProfile && <p style={{ fontSize: '0.8rem', color: '#8b5cf6', marginTop: '1rem', fontWeight: '600' }}>* Ви є власником бізнесу, ваша роль не може бути знижена.</p>}
                            </div>

                            {/* Налаштування Роботи з Клієнтами */}
                            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.3rem 0' }}>Приймає записи клієнтів</h3>
                                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>Якщо вимкнено, цей співробітник зникне з онлайн-бронювання та календаря (для чистих адмінів).</p>
                              </div>
                              <div
                                onClick={() => handleUpdateLocalStaff({ provides_services: !providesServices })}
                                style={{ width: '48px', height: '26px', borderRadius: '13px', background: providesServices ? '#10b981' : '#cbd5e1', position: 'relative', cursor: 'pointer', transition: 'background 0.3s', flexShrink: 0 }}
                              >
                                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: providesServices ? '24px' : '2px', transition: 'left 0.3s cubic-bezier(0.25, 1, 0.5, 1)', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }}></div>
                              </div>
                            </div>

                            {hasAdminRights && (
                              <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                  onClick={async (e) => {
                                    const btn = e.currentTarget;
                                    const originalText = btn.innerText;
                                    btn.innerText = 'Збереження...';
                                    btn.style.opacity = '0.7';
                                    btn.disabled = true;
                                    try {
                                      await handleSaveSettingsDB({
                                        role: currentStaff.role,
                                        provides_services: currentStaff.provides_services
                                      });
                                      btn.innerText = '✓ Збережено';
                                      btn.style.background = '#10b981';
                                      btn.style.opacity = '1';
                                      setTimeout(() => alert("Налаштування доступу успішно збережено!"), 50);
                                      setTimeout(() => { btn.innerText = originalText; btn.style.background = '#0f172a'; btn.disabled = false; }, 3000);
                                    } catch(err) {
                                      alert("Помилка при збереженні.");
                                      btn.innerText = originalText;
                                      btn.style.opacity = '1';
                                      btn.disabled = false;
                                    }
                                  }}
                                  style={{ padding: '0.8rem 2rem', borderRadius: '8px', border: 'none', background: '#0f172a', fontWeight: '700', color: '#fff', fontSize: '0.95rem', cursor: 'pointer', transition: '0.2s', boxShadow: '0 4px 12px rgba(15,23,42,0.2)' }}
                                >
                                  Зберегти налаштування доступу
                                </button>
                              </div>
                            )}

                            {/* Небезпечна зона (Звільнення) */}
                            {!isOwnerProfile && (
                              <div style={{ background: '#fff1f2', border: '1px dashed #fca5a5', borderRadius: '12px', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#991b1b', margin: '0 0 0.3rem 0' }}>Звільнення співробітника</h3>
                                  <p style={{ fontSize: '0.85rem', color: '#b91c1c', margin: 0 }}>Назавжди видалити доступ цієї особи до системи. Історія записів залишиться в базі.</p>
                                </div>
                                <button
                                  onClick={handleDeleteStaff}
                                  style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.7rem 1.5rem', borderRadius: '8px', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', transition: '0.2s', boxShadow: '0 4px 10px rgba(239, 68, 68, 0.2)' }}
                                  onMouseOver={e => e.currentTarget.style.background = '#dc2626'}
                                  onMouseOut={e => e.currentTarget.style.background = '#ef4444'}
                                >
                                  Видалити з команди
                                </button>
                              </div>
                            )}

                          </div>
                        )}

                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1.5rem', opacity: 0.5 }}><Icons.Team /></div>
                        <h3 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.5rem 0' }}>Оберіть співробітника</h3>
                        <p style={{ fontSize: '1rem', fontWeight: '500' }}>Виберіть людину зі списку ліворуч для перегляду деталей</p>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}

            {/* 🟢 МОДАЛЬНЕ ВІКНО ДОДАВАННЯ ПЕРСОНАЛУ (ЗАПРОШЕННЯ) */}
            {isInviteStaffModalOpen && (
              <div className="modal-overlay" onClick={() => setIsInviteStaffModalOpen(false)}>
                <div className="modal-content" onClick={e => e.stopPropagation()} style={{ animation: 'slideUp 0.3s ease', maxWidth: '420px' }}>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>Додати співробітника</h2>
                    <button onClick={() => setIsInviteStaffModalOpen(false)} style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>

                  <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                    Ми надішлемо запрошення на вказану електронну пошту. Співробітник отримає лист з посиланням для входу в систему.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label className="modal-label">Ім'я та прізвище *</label>
                      <input type="text" value={inviteForm.name} onChange={e => setInviteForm({...inviteForm, name: e.target.value})} className="modal-input" placeholder="Наприклад: Анна Коваль" autoFocus />
                    </div>
                    <div>
                      <label className="modal-label">Електронна пошта (Email) *</label>
                      <input type="email" value={inviteForm.email} onChange={e => setInviteForm({...inviteForm, email: e.target.value})} className="modal-input" placeholder="anna@example.com" />
                    </div>
                    <div>
                      <label className="modal-label">Телефон</label>
                      <input type="text" value={inviteForm.phone} onChange={e => setInviteForm({...inviteForm, phone: e.target.value})} className="modal-input" placeholder="+380..." />
                    </div>

                    <div>
                      <label className="modal-label">Роль у системі</label>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <div onClick={() => setInviteForm({...inviteForm, role: 'master'})} style={{ flex: 1, padding: '0.8rem', border: `2px solid ${inviteForm.role === 'master' ? '#0f172a' : '#e2e8f0'}`, borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', background: inviteForm.role === 'master' ? '#f8fafc' : '#fff' }}>
                          <input type="radio" checked={inviteForm.role === 'master'} readOnly style={{ accentColor: '#0f172a' }} />
                          <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.85rem' }}>Спеціаліст</span>
                        </div>
                        <div onClick={() => setInviteForm({...inviteForm, role: 'admin'})} style={{ flex: 1, padding: '0.8rem', border: `2px solid ${inviteForm.role === 'admin' ? '#0f172a' : '#e2e8f0'}`, borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', background: inviteForm.role === 'admin' ? '#f8fafc' : '#fff' }}>
                          <input type="radio" checked={inviteForm.role === 'admin'} readOnly style={{ accentColor: '#0f172a' }} />
                          <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.85rem' }}>Адміністратор</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                       if (!inviteForm.email || !inviteForm.name) return alert("Заповніть обов'язкові поля: Ім'я та Email.");
                       setIsInvitingStaff(true);
                       try {
                         const newStaffData = { business_id: business.id, name: inviteForm.name.trim(), email: inviteForm.email.trim(), phone: inviteForm.phone.trim() || null, role: inviteForm.role, status: 'pending', provides_services: inviteForm.role === 'master', assigned_services: inviteForm.role === 'master' ? services.map(s => s.id) : [], commission_rate: 40, fixed_salary: 0, payout_history: [], auto_payout: false, keeps_tips: true, deduct_materials: false, payout_period: 'weekly', payout_day: 'monday' };
                         const { data, error } = await supabase.from('staff').insert([newStaffData]).select().single();
                         if (error) throw error;
                         setTeam([...team, data]);
                         setIsInviteStaffModalOpen(false);
                         setInviteForm({ email: '', name: '', role: 'master', phone: '' });
                         alert(`Запрошення успішно надіслано на ${inviteForm.email}!`);
                       } catch (err) { console.error(err); alert("Помилка при додаванні співробітника."); } finally { setIsInvitingStaff(false); }
                    }}
                    disabled={isInvitingStaff}
                    style={{ width: '100%', marginTop: '2rem', padding: '0.85rem', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '0.95rem', cursor: isInvitingStaff ? 'not-allowed' : 'pointer', opacity: isInvitingStaff ? 0.7 : 1, transition: '0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                  >
                    {isInvitingStaff ? 'Відправка...' : <><Icons.Send /> Надіслати запрошення</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )/* --- 8. ІНШІ ВКЛАДКИ (ЗАГЛУШКА) --- */
        : (
          <div style={{ padding: '3rem', flex: 1 }}>
            <div style={{ width: '100%', height: '400px', border: '2px dashed #e2e8f0', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }}>
              <div style={{ color: '#cbd5e1', marginBottom: '1rem' }}>
                {(() => { const Icon = navItems.find(item => item.id === activeTab)?.icon || Icons.Storefront; return <Icon />; })()}
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#334155', margin: '0 0 0.5rem 0' }}>Розділ у розробці</h3>
            </div>
          </div>
        )}
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
            <button onClick={() => { setSelectedBooking(contextMenu.app); handleCancelBooking(); }} style={{ width: '100%', padding: '0.8rem 1rem', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.9rem', color: '#ef4444', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.6rem' }}><Icons.Trash /> Скасувати запис</button>
          </div>
        )}

      </main>

      {/* 🟢 МОДАЛКА ГЛОБАЛЬНОГО ПОШУКУ (CMD+K) */}
      {isGlobalSearchOpen && (
         <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '10vh' }} onClick={() => setIsGlobalSearchOpen(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: '0', maxWidth: '600px', overflow: 'hidden', background: '#fff', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
               <div style={{ display: 'flex', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                  <Icons.Search />
                  <input autoFocus type="text" placeholder="Пошук клієнтів (ім'я або телефон)..." onChange={(e) => { const val = e.target.value.toLowerCase(); if (val) setClientSearch(val); }} onKeyDown={(e) => { if (e.key === 'Enter') { setActiveTab('Clients'); localStorage.setItem('bookera_activeTab', 'Clients'); setIsGlobalSearchOpen(false); } if (e.key === 'Escape') setIsGlobalSearchOpen(false); }} style={{ flex: 1, border: 'none', outline: 'none', fontSize: '1.1rem', padding: '0 1rem', background: 'transparent' }} />
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

            {/* Header Картки Клієнта */}
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

              {/* Верхні кнопки керування */}
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

            {/* Body Картки */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', padding: '2rem', gap: '2.5rem' }}>

              {/* Ліва колонка: Контакти, Статистика та Дії */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                {/* Контакти */}
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

                {/* 🟢 Оновлена, акуратніша статистика */}
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

                {/* Швидкі дії */}
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

              {/* Права колонка: Нотатки та Історія */}
              {/* 🟢 Зменшено gap, щоб підняти блок історії */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                {/* Нотатки та Алергії */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                      <h3 style={{ fontSize: '0.85rem', fontWeight: '800', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em', margin: 0 }}>Особисті нотатки</h3>
                      {/* 🟢 Перевіряємо обидва поля на зміни */}
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
                      style={{ width: '100%', height: '100px', padding: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '0.95rem', color: '#334155', resize: 'none', lineHeight: '1.5', outline: 'none' }} // 🟢 height: 100px + resize: none
                    />
                  </div>

                  {/* 🟢 Блок Алергій / Важливих відміток */}
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

                {/* Коротка історія */}
                <div>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: '800', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '0.8rem' }}>Історія записів</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {viewingClient.last_visit ? (
                      (() => {
                        const vDate = new Date(viewingClient.last_visit);
                        vDate.setHours(0,0,0,0);
                        const tDate = new Date();
                        tDate.setHours(0,0,0,0);

                        // 🟢 ЗМІНА ТУТ: >= замість > (щоб сьогоднішні записи теж були "Очікується")
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

      {/* --- МОДАЛЬНЕ ВІКНО КЕРУВАННЯ ФОТОГРАФІЯМИ --- */}
      {isPhotoModalOpen && (
        <div className="modal-overlay" onClick={() => setIsPhotoModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ animation: 'slideUp 0.3s ease', maxWidth: '800px', padding: '0' }}>
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <button onClick={() => setIsPhotoModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', color: '#64748b' }}><Icons.ChevronLeft /></button>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>Зображення профілю</h2>
              </div>
            </div>

            <div className="custom-scroll" style={{ padding: '2rem', maxHeight: '70vh', overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem' }}>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a', margin: '0 0 0.5rem 0' }}>Логотип</h3>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.5rem' }}>Завантажте логотип вашого бізнесу, щоб клієнти вас впізнавали.</p>

                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <label className="photo-upload-card" style={{ width: '120px', height: '120px', borderRadius: '50%', background: logo ? `url(${logo}) center/cover` : '#f8fafc' }}>
                      {!logo && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}><Icons.Camera /><span style={{ fontSize: '0.75rem', fontWeight: '600' }}>Додати</span></div>}
                      <input type="file" style={{ display: 'none' }} accept="image/*" onChange={(e) => handlePhotoUpload(e, 'logo')} />
                    </label>
                  </div>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a', margin: '0 0 0.5rem 0' }}>Обкладинка</h3>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.5rem' }}>Перше, що бачать клієнти на вашій сторінці.</p>

                  <label className="photo-upload-card" style={{ width: '100%', height: '160px', background: coverPhoto ? `url(${coverPhoto}) center/cover` : '#f8fafc' }}>
                    {!coverPhoto && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}><Icons.Camera /><span style={{ fontSize: '0.85rem', fontWeight: '600' }}>Додати фото</span></div>}
                    <input type="file" style={{ display: 'none' }} accept="image/*" onChange={(e) => handlePhotoUpload(e, 'cover')} />
                  </label>
                </div>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a', margin: '0 0 0.5rem 0' }}>Фото інтер'єру</h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.5rem' }}>Покажіть клієнтам свій простір ще до того, як вони до вас завітають.</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>

                  {workplacePhotos.map((photoBase64, idx) => (
                    <div key={idx} className="photo-upload-card" style={{ width: '100%', aspectRatio: '1/1', background: `url(${photoBase64}) center/cover`, border: 'none' }}>
                       <button className="photo-remove-btn" onClick={() => removeWorkplacePhoto(idx)}>✕</button>
                    </div>
                  ))}

                  <label className="photo-upload-card" style={{ width: '100%', aspectRatio: '1/1' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}><Icons.Camera /><span style={{ fontSize: '0.75rem', fontWeight: '600' }}>Додати фото</span></div>
                    <input type="file" style={{ display: 'none' }} accept="image/*" onChange={(e) => handlePhotoUpload(e, 'workplace')} />
                  </label>

                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* --- МОДАЛЬНЕ ВІКНО ДОДАВАННЯ/РЕДАГУВАННЯ ПОСЛУГИ --- */}
      {isServiceModalOpen && (
        <div className="modal-overlay" onClick={() => setIsServiceModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
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
                           // 🟢 Фільтруємо послуги залежно від обраного майстра
                           let availableServices = services;
                           if (apptForm.staff_id) {
                              const selectedM = team.find(t => String(t.id) === String(apptForm.staff_id));
                              if (selectedM && selectedM.assigned_services && selectedM.assigned_services.length > 0) {
                                 // Показуємо тільки ті послуги, які є в масиві assigned_services майстра
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
                    {/* 🟢 ФІЛЬТРУЄМО ТИХ, ХТО НЕ НАДАЄ ПОСЛУГ */}
                    {team.filter(m => m.provides_services !== false).map(m => ( <option key={m.id} value={m.id}>{m.name}</option> ))}
                  </select>
                  <div className="modal-select-icon"><Icons.ChevronDown /></div>
                </div>

                {/* 🟢 РОЗУМНЕ ВІЗУАЛЬНЕ ПОПЕРЕДЖЕННЯ ПРО ВИХІДНИЙ/ПОЗА ГРАФІКОМ */}
                {(() => {
                   if (apptForm.date && apptForm.time) {
                      const apptDate = new Date(apptForm.date);
                      const dayIdx = apptDate.getDay() === 0 ? 6 : apptDate.getDay() - 1;
                      const [appH, appM] = apptForm.time.split(':').map(Number);
                      const appTime = appH * 60 + appM;

                      if (apptForm.staff_id) {
                         // Обрано конкретного майстра
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
                         // Обрано "Будь-який майстер" або "Весь заклад"
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
                            // Немає майстрів, перевіряємо загальний графік
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

      {/* --- МОДАЛКА: ІНФОРМАЦІЯ ПРО ЗАДАЧІ --- */}
      {showTaskInfoModal && (
        <div className="modal-overlay" onClick={() => setShowTaskInfoModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ animation: 'slideUp 0.3s ease', maxWidth: '400px', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
              <Icons.Sparkles />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.5rem' }}>Менеджер задач</h2>
            <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '2rem' }}>
              Тут ви можете створювати швидкі списки справ на день (To-Do). Вони допоможуть майстрам та адміністраторам не забути про замовлення матеріалів, дзвінки клієнтам чи інші важливі задачі.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button onClick={() => setShowTaskInfoModal(false)} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '8px', fontWeight: '600', color: '#475569', cursor: 'pointer', flex: 1 }}>Скасувати</button>
              <button onClick={confirmTaskInfo} style={{ padding: '0.75rem 1.5rem', backgroundColor: '#3b82f6', border: 'none', borderRadius: '8px', fontWeight: '600', color: '#ffffff', cursor: 'pointer', flex: 1, boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>Зрозуміло</button>
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