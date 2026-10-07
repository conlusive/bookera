'use client';

import { useState, useEffect } from 'react';
import {
  Shop,
  Calendar1,
  ChartSquare,
  Profile2User,
  TaskSquare,
  People,
  RecordCircle,
  Box,
  Setting2,
  Logout,
  CardTick,
  Global,
  User,
  Edit2,
  Camera,
  Gallery,
  Clock,
  Location,
  Add,
  Trash,
  Component,
  SearchNormal1,
  MagicStar,
  TrendUp,
  TrendDown,
  TextalignJustifycenter,
  FilterTick,
  Call,
  Sms,
  Tag,
  Send2,
  TickCircle,
  InfoCircle,
  CloseCircle,
  MessageText,
  Paperclip,
  ArrowDown2,
  ArrowUp2,
  ArrowLeft2,
  ArrowRight2,
  ArchiveBox,
  Instagram,
  ClipboardText,
  Cake,
  ImportCurve,
  ExportCurve,
} from 'iconsax-react';

export const Icons = {
  SidebarToggle: ({ collapsed }: { collapsed: boolean }) => (
    <div style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <ArrowLeft2 size="20" color="currentColor" variant="Linear" />
    </div>
  ),
  Storefront: () => <Shop size="20" color="currentColor" variant="Linear" />,
  Calendar: () => <Calendar1 size="20" color="currentColor" variant="Linear" />,
  Stats: () => <ChartSquare size="20" color="currentColor" variant="Linear" />,
  Clients: () => <Profile2User size="20" color="currentColor" variant="Linear" />,
  Services: () => <TaskSquare size="20" color="currentColor" variant="Linear" />,
  Team: () => <People size="20" color="currentColor" variant="Linear" />,
  Marketing: () => <RecordCircle size="20" color="currentColor" variant="Linear" />,
  Inventory: () => <Box size="20" color="currentColor" variant="Linear" />,
  Archive: () => <ArchiveBox size="20" color="currentColor" variant="Linear" />,
  Settings: () => <Setting2 size="20" color="currentColor" variant="Linear" />,
  LogOut: () => <Logout size="16" color="currentColor" variant="Linear" />,
  CreditCard: () => <CardTick size="20" color="currentColor" variant="Linear" />,
  Globe: () => <Global size="20" color="currentColor" variant="Linear" />,
  Box: () => <Box size="20" color="currentColor" variant="Linear" />,
  User: () => <User size="20" color="currentColor" variant="Linear" />,
  Edit: () => <Edit2 size="16" color="currentColor" variant="Linear" />,
  Camera: () => <Camera size="20" color="currentColor" variant="Linear" />,
  Image: () => <Gallery size="40" color="currentColor" variant="Linear" />,
  Clock: () => <Clock size="16" color="currentColor" variant="Linear" />,
  MapPin: () => <Location size="20" color="currentColor" variant="Linear" />,
  MapPinBig: () => <Location size="48" color="currentColor" variant="Linear" />,
  Plus: () => <Add size="18" color="currentColor" variant="Linear" />,
  Trash: () => <Trash size="16" color="currentColor" variant="Linear" />,
  TrashSmall: () => <Trash size="14" color="currentColor" variant="Linear" />,
  Grip: () => <Component size="20" color="currentColor" variant="Linear" />,
  Search: () => <SearchNormal1 size="16" color="currentColor" variant="Linear" />,
  Sparkles: () => <MagicStar size="20" color="currentColor" variant="Linear" />,
  TrendingUp: () => <TrendUp size="16" color="currentColor" variant="Linear" />,
  TrendingDown: () => <TrendDown size="16" variant="Linear" color="currentColor" />,
  SortAlpha: () => <TextalignJustifycenter size="16" color="currentColor" variant="Linear" />,
  Filter: () => <FilterTick size="16" color="currentColor" variant="Linear" />,
  Phone: () => <Call size="16" color="currentColor" variant="Linear" />,
  Mail: () => <Sms size="16" color="currentColor" variant="Linear" />,
  Tag: () => <Tag size="16" color="currentColor" variant="Linear" />,
  Send: () => <Send2 size="18" color="currentColor" variant="Linear" />,
  // Іконки меню - усі 20 px, як решта пунктів. Image (40) і Send (18)
  // потрібні в інших місцях, тож для меню - окремі.
  NavPortfolio: () => <Gallery size="20" color="currentColor" variant="Linear" />,
  NavRequests: () => <Send2 size="20" color="currentColor" variant="Linear" />,
  NavMyClients: () => <User size="20" color="currentColor" variant="Linear" />,
  NavEarnings: () => <CardTick size="20" color="currentColor" variant="Linear" />,
  NavActivity: () => <ClipboardText size="20" color="currentColor" variant="Linear" />,
  // Торт - той самий стиль, що й решта іконок (замість смайлика 🎂)
  Import: () => <ImportCurve size="16" color="currentColor" variant="Linear" />,
  Export: () => <ExportCurve size="16" color="currentColor" variant="Linear" />,
  Duplicates: () => <Profile2User size="16" color="currentColor" variant="Linear" />,
  Cake: ({ size = 16 }: { size?: number }) => <Cake size={String(size)} color="currentColor" variant="Linear" />,
  CheckCircle: () => <TickCircle size="16" color="currentColor" variant="Bold" />,
  AlertCircle: () => <InfoCircle size="16" color="currentColor" variant="Bold" />,
  XCircle: () => <CloseCircle size="16" color="currentColor" variant="Bold" />,
  Chat: () => <MessageText size="18" color="currentColor" variant="Linear" />,
  Telegram: () => <Send2 size="18" color="currentColor" variant="Linear" />,
  Instagram: () => <Instagram size="18" color="currentColor" variant="Linear" />,
  Paperclip: () => <Paperclip size="16" color="currentColor" variant="Linear" />,
  ChevronDown: () => <ArrowDown2 size="16" color="currentColor" variant="Linear" />,
  ChevronUp: () => <ArrowUp2 size="16" color="currentColor" variant="Linear" />,
  ChevronLeft: () => <ArrowLeft2 size="16" color="currentColor" variant="Linear" />,
  ChevronRight: () => <ArrowRight2 size="16" color="currentColor" variant="Linear" />
};

export const navItems = [
  { id: 'Calendar', label: 'Календар', icon: Icons.Calendar },
  { id: 'Clients', label: 'Клієнти', icon: Icons.Clients },
  { id: 'Services', label: 'Послуги', icon: Icons.Services },
  { id: 'Team', label: 'Команда', icon: Icons.Team },
  { id: 'MyClients', label: 'Мої клієнти', icon: Icons.NavMyClients },
  { id: 'MyPortfolio', label: 'Портфоліо', icon: Icons.NavPortfolio },
  { id: 'MyRequests', label: 'Запити', icon: Icons.NavRequests },
  { id: 'MyEarnings', label: 'Заробіток', icon: Icons.NavEarnings },
  { id: 'Storefront', label: 'Онлайн-вітрина', icon: Icons.Globe },
  { id: 'Inventory', label: 'Склад і Витрати', icon: Icons.Box },
  { id: 'Marketing', label: 'Маркетинг', icon: Icons.Marketing },
  { id: 'Stats', label: 'Аналітика', icon: Icons.Stats },
  { id: 'Activity', label: 'Журнал дій', icon: Icons.NavActivity },
  { id: 'Settings', label: 'Налаштування', icon: Icons.Settings }
];

const MASTER_COLORS = [
  { pastelBg: '#e0e7ff', pastelBorder: '#818cf8', pastelText: '#312e81', vividBg: '#4f46e5', vividBorder: '#3730a3' },
  { pastelBg: '#dcfce7', pastelBorder: '#86efac', pastelText: '#14532d', vividBg: '#16a34a', vividBorder: '#15803d' },
  { pastelBg: '#fef08a', pastelBorder: '#fde047', pastelText: '#713f12', vividBg: '#eab308', vividBorder: '#ca8a04' },
  { pastelBg: '#ffedd5', pastelBorder: '#fdba74', pastelText: '#7c2d12', vividBg: '#f97316', vividBorder: '#ea580c' },
  { pastelBg: '#fce7f3', pastelBorder: '#f472b6', pastelText: '#831843', vividBg: '#ec4899', vividBorder: '#db2777' },
  { pastelBg: '#f3e8ff', pastelBorder: '#d8b4fe', pastelText: '#581c87', vividBg: '#a855f7', vividBorder: '#9333ea' },
  { pastelBg: '#cffafe', pastelBorder: '#67e8f9', pastelText: '#164e63', vividBg: '#06b6d4', vividBorder: '#0891b2' },
  { pastelBg: '#ffe4e6', pastelBorder: '#fda4af', pastelText: '#881337', vividBg: '#f43f5e', vividBorder: '#e11d48' },
  { pastelBg: '#ccfbf1', pastelBorder: '#6ee7b7', pastelText: '#064e3b', vividBg: '#10b981', vividBorder: '#059669' },
  { pastelBg: '#fef3c7', pastelBorder: '#fcd34d', pastelText: '#78350f', vividBg: '#f59e0b', vividBorder: '#d97706' },
  { pastelBg: '#e0f2fe', pastelBorder: '#93c5fd', pastelText: '#1e3a8a', vividBg: '#3b82f6', vividBorder: '#2563eb' },
  { pastelBg: '#f3f4f6', pastelBorder: '#d1d5db', pastelText: '#111827', vividBg: '#6b7280', vividBorder: '#4b5563' },
];

/**
 * Колір майстра за його порядковим номером у команді - без обмеження на розмір команди.
 * Перші 12 - добірні кольори. Далі колір генерується «золотим кутом» (137.5° по колу відтінків):
 * сусідні номери завжди далеко один від одного, а кожне нове коло змінює насиченість і світлість,
 * тому навіть у команді з 40 людей кольори не зливаються і не повторюються.
 */
export const masterPalette = (index: number) => {
  if (index < MASTER_COLORS.length) return MASTER_COLORS[Math.max(0, index)];
  const n = index - MASTER_COLORS.length;
  const hue = Math.round((n * 137.508 + 20) % 360);
  const tier = Math.floor(n / 6) % 3;                 // 0 - соковитий, 1 - темніший, 2 - світліший
  const sat = [68, 58, 74][tier];
  const vivid = [48, 38, 58][tier];
  return {
    pastelBg: `hsl(${hue} 80% 92%)`,
    pastelBorder: `hsl(${hue} 70% 76%)`,
    pastelText: `hsl(${hue} 60% 20%)`,
    vividBg: `hsl(${hue} ${sat}% ${vivid}%)`,
    vividBorder: `hsl(${hue} ${sat}% ${vivid - 10}%)`,
  };
};

export const toLocalDateStr = (d: Date) => {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().split('T')[0];
};

export const checkSameDay = (dbDateStr: string, targetDateObj: Date) => {
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

export const CurrentTimeIndicator = ({ gridStartHour, gridTotalHours, isToday }: { gridStartHour: number, gridTotalHours: number, isToday: boolean }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    if (!isToday) return;
    const interval = setInterval(() => setTime(new Date()), 15_000);  // лінія часу рухається плавно (CSS), перемальовувати щосекунди не треба
    return () => clearInterval(interval);
  }, [isToday]);

  if (!isToday) return null;

  const currentHourAdjusted = time.getHours() < gridStartHour ? time.getHours() + 24 : time.getHours();
  const currentMinutesOffset = (currentHourAdjusted - gridStartHour) * 60 + time.getMinutes() + (time.getSeconds() / 60);

  if (currentMinutesOffset < 0 || currentMinutesOffset > gridTotalHours * 60) return null;

  return (
    <div style={{ position: 'absolute', top: `${currentMinutesOffset}px`, left: 0, right: 0, zIndex: 20, pointerEvents: 'none', transition: 'top 15s linear' }}>
      <div style={{ position: 'absolute', left: '56px', top: '-4px', width: '9px', height: '9px', borderRadius: '50%', background: '#ef4444', zIndex: 11 }}></div>
      <div style={{ position: 'absolute', left: '60px', right: 0, top: '0', borderTop: '2px solid #ef4444', opacity: 0.8, zIndex: 9 }}></div>
      <div style={{ position: 'absolute', left: '68px', top: '-11px', backgroundColor: '#ef4444', color: '#ffffff', padding: '2px 6px', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(239, 68, 68, 0.3)', zIndex: 12 }}>
        <span style={{ fontSize: '0.65rem', fontWeight: '800', letterSpacing: '0.05em' }}>
          {time.getHours().toString().padStart(2, '0')}:{time.getMinutes().toString().padStart(2, '0')}
        </span>
      </div>
    </div>
  );
};
