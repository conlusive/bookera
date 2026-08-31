'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';
import { isBusinessRole } from '@/lib/roles';

const categoriesData = [
  { name: 'Рекомендовані', slug: 'all' },
  { name: 'Волосся', slug: 'hair' },
  { name: 'Барбер', slug: 'barber' },
  { name: 'Нігті', slug: 'nails' },
  { name: 'Догляд за шкірою', slug: 'skincare' },
  { name: 'Брови та вії', slug: 'brows' },
  { name: 'Масаж', slug: 'massage' },
  { name: 'Макіяж', slug: 'makeup' },
  { name: 'Wellness & Spa', slug: 'spa' }
];

const extraCategoriesData = [
  { name: 'Естетична медицина', slug: 'aesthetic-medicine' },
  { name: 'Видалення волосся', slug: 'hair-removal' },
  { name: 'Послуги на дому', slug: 'home-services' },
  { name: 'Пірсинг', slug: 'piercing' },
  { name: 'Домашні улюбленці', slug: 'pets' },
  { name: 'Стоматологія', slug: 'dentistry' },
  { name: 'Здоров\'я та самопочуття', slug: 'health' },
  { name: 'Професійні послуги', slug: 'professional' },
  { name: 'Інше', slug: 'other' }
];

const categoryTitles: Record<string, string> = {
  'hair': 'Стрижки та укладки',
  'barber': 'Барбершопи',
  'nails': 'Манікюр та педикюр',
  'skincare': 'Догляд за шкірою',
  'brows': 'Брови та вії',
  'massage': 'Масаж та релакс',
  'makeup': 'Макіяж та візаж',
  'spa': 'Wellness & Spa',
  'aesthetic-medicine': 'Естетична медицина',
  'hair-removal': 'Видалення волосся',
  'home-services': 'Послуги на дому',
  'piercing': 'Пірсинг студії',
  'pets': 'Послуги для улюбленців',
  'dentistry': 'Стоматологія',
  'health': 'Здоров\'я та самопочуття',
  'professional': 'Професійні послуги',
  'other': 'Інші послуги'
};

const topCities = [
  'Київ', 'Львів', 'Одеса', 'Дніпро',
  'Харків', 'Івано-Франківськ', 'Вінниця', 'Тернопіль',
  'Ужгород', 'Хмельницький', 'Чернівці', 'Рівне',
  'Полтава', 'Черкаси', 'Луцьк', 'Житомир'
];

export default function HomePageClient({ initialBusinesses }: { initialBusinesses: any[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [mounted, setMounted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Стан для хедера: 'top' (прозорий), 'scrolled' (білий), 'hiding' (зникає)
  const [scrollState, setScrollState] = useState<'top' | 'scrolled' | 'hiding'>('top');

  const [businesses] = useState<any[]>(initialBusinesses);

  // --- Стейт авторизації ---
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLoginView, setIsLoginView] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  const [regPhone, setRegPhone] = useState('');

  const [userName, setUserName] = useState<string | null>(null);
  const [initials, setInitials] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('client');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // --- Стан для пошуку ---
  const [searchWhat, setSearchWhat] = useState('');
  const [searchWhere, setSearchWhere] = useState('Львів');
  const [searchDate, setSearchDate] = useState('');
  const [searchTime, setSearchTime] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [availableBizIds, setAvailableBizIds] = useState<number[] | null>(null);

  const [isWhatOpen, setIsWhatOpen] = useState(false);
  const [isWhereOpen, setIsWhereOpen] = useState(false);
  const [isDateOpen, setIsDateOpen] = useState(false);
  const [activeSearch, setActiveSearch] = useState<'hero' | 'header' | null>(null);

  const [isMoreCategoriesOpen, setIsMoreCategoriesOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('popular');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const heroWhatRef = useRef<HTMLDivElement>(null);
  const heroWhereRef = useRef<HTMLDivElement>(null);
  const heroDateRef = useRef<HTMLDivElement>(null);

  const headerWhatRef = useRef<HTMLDivElement>(null);
  const headerWhereRef = useRef<HTMLDivElement>(null);
  const headerDateRef = useRef<HTMLDivElement>(null);

  const sortRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const isAutoSearchRun = useRef(false);

  // Геолокація
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=uk`);
            const data = await res.json();
            const city = data.address?.city || data.address?.town || data.address?.village || data.address?.state;
            if (city) setSearchWhere(city);
          } catch (error) {
            console.error('Не вдалося визначити локацію:', error);
          }
        },
        (error) => console.log('Локація:', error.message)
      );
    }
  }, []);

  // Ініціалізація та логіка скролу хедера
  useEffect(() => {
    setMounted(true);

    if (typeof window !== 'undefined') {
  const storedName = localStorage.getItem('userName');
  const storedRole = localStorage.getItem('userRole') || 'client';
  const storedAvatar = localStorage.getItem('userAvatar');

  if (storedAvatar) setAvatarUrl(storedAvatar);

  if (storedName) {
    setIsLoggedIn(true);
    const displayName = storedName.includes('@') ? 'Користувач' : storedName;
    setUserName(displayName);
    setUserRole(storedRole);
    const nameParts = displayName.split(' ');
    const init = nameParts.length > 1 ? nameParts[0][0] + nameParts[1][0] : nameParts[0][0];
    setInitials(init.toUpperCase());
  }

  // Миттєве оновлення при зміні фото в сусідній вкладці/профілі
  const handleStorageUpdate = () => {
    setAvatarUrl(localStorage.getItem('userAvatar') || null);
    const updatedName = localStorage.getItem('userName');
    if (updatedName) setUserName(updatedName);
  };
  window.addEventListener('storage', handleStorageUpdate);
}

    // 🟢 ВІДНОВЛЕНА ПРАВИЛЬНА ЛОГІКА СКРОЛУ
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setScrollState('scrolled');
      } else if (window.scrollY > 150) {
        setScrollState(prevState => {
          if (prevState === 'scrolled') return 'hiding';
          if (prevState === 'top') return 'top';
          return prevState;
        });
      } else {
        setScrollState('top');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    }, { threshold: 0.15 });

    setTimeout(() => {
      document.querySelectorAll('.reveal-on-scroll').forEach(el => observer.observe(el));
    }, 100);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, [supabase]);

  // Закриття дропдаунів кліком поза межами
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileRef.current && !profileRef.current.contains(target)) setIsProfileOpen(false);

      const clickedWhat = heroWhatRef.current?.contains(target) || headerWhatRef.current?.contains(target);
      if (!clickedWhat) setIsWhatOpen(false);

      const clickedWhere = heroWhereRef.current?.contains(target) || headerWhereRef.current?.contains(target);
      if (!clickedWhere) setIsWhereOpen(false);

      const clickedDate = heroDateRef.current?.contains(target) || headerDateRef.current?.contains(target);
      if (!clickedDate) setIsDateOpen(false);

      if (sortRef.current && !sortRef.current.contains(target)) setIsSortOpen(false);
      if (moreRef.current && !moreRef.current.contains(target)) setIsMoreCategoriesOpen(false);
    };

    const handleScrollClose = () => {
      setIsProfileOpen(false);
      setIsWhatOpen(false);
      setIsWhereOpen(false);
      setIsDateOpen(false);
      setIsSortOpen(false);
      setIsMoreCategoriesOpen(false);
      setActiveSearch(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollClose, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollClose);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userAvatar');
    setAvatarUrl(null);
    setIsLoggedIn(false);
    setIsProfileOpen(false);
    setUserName(null);
    setUserRole('client');
  };

  const handleModalAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLoginView) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password: loginPassword,
        });

        if (error) {
          alert(`Помилка входу: ${error.message}`);
          return;
        }

        // full_name/role вже є в user_metadata (записані туди під час
        // реєстрації нижче) - окремого запиту до 'profiles' не потрібно,
        // такої таблиці більше немає.
        const profile = data.user?.user_metadata;

        let finalName = profile?.full_name || data.user?.user_metadata?.full_name || 'Користувач';
        if (finalName.includes('@')) finalName = 'Користувач';
        const finalRole = profile?.role || 'client';

        localStorage.setItem('userName', finalName);
        localStorage.setItem('userRole', finalRole);
        localStorage.setItem('userId', data.user.id);

        setUserName(finalName);
        setUserRole(finalRole);
        setInitials(finalName.substring(0, 2).toUpperCase());

        setIsLoggedIn(true);
        setIsAuthModalOpen(false);

        if (finalRole === 'vendor') router.push('/cabinet');
} else {
        const targetEmail = loginEmail.trim().toLowerCase();
        const targetFullName = `${regFirstName} ${regLastName}`.trim();
        const targetPhone = regPhone.trim();

        const { data, error } = await supabase.auth.signUp({
          email: targetEmail,
          password: loginPassword,
          options: {
            data: {
              full_name: targetFullName,
              phone: targetPhone || null,
              role: 'client'
            }
          }
        });

        // 1. Спочатку перевіряємо помилку
        if (error) {
          alert(`Помилка реєстрації: ${error.message}`);
          return;
        }

        // Дані вже збережені в user_metadata (переданому в signUp вище) -
        // окремого запису в 'profiles' не потрібно, такої таблиці немає.

        localStorage.setItem('userName', targetFullName);
        localStorage.setItem('userRole', 'client');
        if (data?.session?.user) localStorage.setItem('userId', data.session.user.id);

        setUserName(targetFullName);
        setUserRole('client');
        const initialsStr = targetFullName.length >= 2 ? targetFullName.substring(0, 2).toUpperCase() : 'К';
        setInitials(initialsStr);

        setIsLoggedIn(true);
        setIsAuthModalOpen(false);
      }    } catch (error) {
      alert("Відбулася помилка при з'єднанні з сервером.");
    }
  };

  // 🟢 ГАРАНТОВАНИЙ ПОШУК ТА ПЛАВНИЙ СКРОЛ ДО РЕЗУЛЬТАТІВ
  const handleSearch = async () => {
    const term = searchWhat.trim().toLowerCase();

    if (term === '') {
      setActiveCategory('all');
      setAppliedSearch('');
    } else {
      const allCategories = [...categoriesData, ...extraCategoriesData];
      const matchedCat = allCategories.find(c =>
        c.name.toLowerCase() === term ||
        (term.length > 3 && c.name.toLowerCase().includes(term))
      );

      if (matchedCat && matchedCat.slug !== 'all') {
        setActiveCategory(matchedCat.slug);
        setAppliedSearch('');
      } else {
        setActiveCategory('all');
        setAppliedSearch(searchWhat);
      }
    }

    setIsWhatOpen(false);
    setIsWhereOpen(false);
    setIsDateOpen(false);
    setIsExpanded(true);
    setActiveSearch(null);

    // Запит на бекенд, якщо обрана дата
    if (searchDate) {
      try {
        const availableBizs = await api.searchAvailableBusinesses({
          city: searchWhere,
          target_date: searchDate,
          time_period: searchTime && searchTime !== 'Будь-коли' ? searchTime : undefined,
          category: activeCategory !== 'all' ? activeCategory : undefined,
        });
        setAvailableBizIds(availableBizs.map((b: any) => b.id));
      } catch (error) {
        console.warn("Бекенд недоступний:", error);
        setAvailableBizIds(null);
      }
    } else {
      setAvailableBizIds(null);
    }

    // 🎯 ТОЧНИЙ ФОКУС: Прокрутка до секції з картками після оновлення стейту
    setTimeout(() => {
      const targetElement = document.getElementById('salons-section');
      if (targetElement) {
        // Враховуємо висоту фіксованого хедера (72px) + невеликий відступ (18px)
        const headerOffset = 90;
        const elementPosition = targetElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
           top: offsetPosition,
           behavior: 'smooth'
        });
      }
    }, 150);
  };

  // 🟢 ГЛОБАЛЬНИЙ ОБРОБНИК ENTER ДЛЯ ІНПУТІВ
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
      void handleSearch();
    }
  };

  // Зчитуємо параметри з URL
  useEffect(() => {
    const what = searchParams.get('what');
    const where = searchParams.get('where');
    const date = searchParams.get('date');
    const time = searchParams.get('time');

    if (what) setSearchWhat(what);
    if (where) setSearchWhere(where);
    if (date) setSearchDate(date);
    if (time) setSearchTime(time);
  }, [searchParams]);

  // Автоматично запускаємо пошук, як тільки дата підтягнулась у стейт
  useEffect(() => {
    const dateParam = searchParams.get('date');
    if (!isAutoSearchRun.current && dateParam && searchDate === dateParam) {
      isAutoSearchRun.current = true;
      void handleSearch();
    }
  }, [searchDate, searchParams]);

  const handleCategorySelect = (slug: string) => {
    setActiveCategory(slug);
    setAppliedSearch('');
    setSearchWhat('');
    setIsExpanded(false);
  };

  const { whatSuggestions, whereSuggestions } = useMemo(() => {
    const searchLower = searchWhat.trim().toLowerCase();

    const matchedCategories = categoriesData
      .filter(c => c.name.toLowerCase().includes(searchLower) && c.slug !== 'all')
      .map(c => ({ name: c.name, type: 'Категорія' }));

    const matchedSalons = businesses
      .filter(b => b.name.toLowerCase().includes(searchLower))
      .slice(0, 4)
      .map(b => ({ name: b.name, type: 'Салон' }));

    const what = searchWhat
      ? [...matchedCategories, ...matchedSalons]
      : categoriesData.filter(c => c.slug !== 'all').map(c => ({ name: c.name, type: 'Категорія' }));

    const where = searchWhere
      ? topCities.filter(c => c.toLowerCase().includes(searchWhere.toLowerCase()))
      : topCities;

    return { whatSuggestions: what, whereSuggestions: where };
  }, [searchWhat, searchWhere, businesses]);

  const filteredBusinesses = useMemo(() => {
    return businesses
      .filter(biz => {
        // Якщо ми шукали по даті, пропускаємо тільки ті ID, що повернув бекенд
        if (availableBizIds !== null && !availableBizIds.includes(biz.id)) {
          return false;
        }

        let matchesCategory = true;
        if (activeCategory !== 'all' && !appliedSearch) {
          const searchTerms: Record<string, string[]> = {
            'barber': ['барбер', 'barber', 'чоловічі', 'men', 'fades'],
            'hair': ['волосся', 'перукар', 'hair', 'стрижк', 'salon', 'зачіск'],
            'nails': ['нігті', 'манікюр', 'педикюр', 'nail', 'маникюр'],
            'massage': ['масаж', 'massage'],
            'spa': ['spa', 'спа', 'wellness', 'релакс'],
            'skincare': ['шкір', 'косметолог', 'skin', 'догляд'],
            'brows': ['бров', 'вій', 'brows', 'lashes', 'брови', 'вії'],
            'makeup': ['макіяж', 'makeup', 'мейкап', 'візаж'],
            'aesthetic-medicine': ['медицина', 'естетика', 'ін\'єкції', 'лікар'],
            'hair-removal': ['лазер', 'епіляція', 'депіляція', 'шугаринг'],
            'home-services': ['дому', 'виїзд'],
            'piercing': ['пірсинг', 'прокол'],
            'pets': ['тварини', 'грумінг', 'собак', 'котів'],
            'dentistry': ['стоматолог', 'зуби', 'відбілювання'],
            'health': ['здоров', 'остеопат', 'терапія'],
            'professional': ['консультація', 'стиліст', 'імідж'],
            'other': ['інше']
          };
          const terms = searchTerms[activeCategory] || [];
          const searchableText = `${biz.category || ''} ${biz.name} ${biz.description || ''} ${(biz.tags || []).join(' ')}`.toLowerCase();
          matchesCategory = terms.some(term => searchableText.includes(term));
        }

        let matchesText = true;
        if (appliedSearch) {
          const query = appliedSearch.toLowerCase();
          const fullText = `${biz.category || ''} ${biz.name} ${biz.description || ''} ${biz.address || ''} ${(biz.tags || []).join(' ')}`.toLowerCase();
          matchesText = fullText.includes(query);
        }

        let matchesLocation = true;
        if (searchWhere && searchWhere.trim() !== '') {
          const locationQuery = searchWhere.toLowerCase().trim();
          const bizLocation = `${biz.city || ''} ${biz.address || ''}`.toLowerCase();
          matchesLocation = bizLocation.includes(locationQuery);
        }

        return matchesCategory && matchesText && matchesLocation;
      })
      .sort((a, b) => {
        if (sortBy === 'rating') {
          return (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0);
        }
        if (sortBy === 'newest') {
          return (parseInt(b.id) || 0) - (parseInt(a.id) || 0);
        }
        return 0;
      });
  }, [businesses, activeCategory, appliedSearch, sortBy, searchWhere, availableBizIds]);

  const displayedBusinesses = isExpanded ? filteredBusinesses : filteredBusinesses.slice(0, 4);

  const getDisplayDateTime = () => {
    if (!searchDate && !searchTime) return 'Будь-коли';
    const datePart = searchDate ? new Date(searchDate).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }) : 'Будь-який день';
    if (!searchTime) return datePart;
    return `${datePart}, ${searchTime.toLowerCase()}`;
  };

  const renderCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const startDay = firstDay === 0 ? 6 : firstDay - 1;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = [];

    for (let i = 0; i < startDay; i++) days.push(<div key={`empty-${i}`} style={{ padding: '0.2rem' }}></div>);

    for (let i = 1; i <= daysInMonth; i++) {
      const cellDate = new Date(year, month, i);
      const isPast = cellDate < today;
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const isSelected = searchDate === dateStr;

      days.push(
        <div
          key={i}
          onClick={(e) => {
            e.stopPropagation();
            if (!isPast) {
              setSearchDate(isSelected ? '' : dateStr);
            }
          }}
          style={{
            height: '34px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isPast ? 'default' : 'pointer',
            borderRadius: '10px',
            backgroundColor: isSelected ? '#0f172a' : 'transparent',
            color: isSelected ? '#ffffff' : (isPast ? '#cbd5e1' : '#0f172a'),
            fontWeight: isSelected ? '700' : '500',
            fontSize: '0.95rem',
            transition: 'all 0.2s ease',
          }}
          onMouseOver={(e) => { if (!isPast && !isSelected) e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
          onMouseOut={(e) => { if (!isPast && !isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          {i}
        </div>
      );
    }
    return days;
  };

  const renderDatePicker = () => (
    <div className="search-dropdown anim" style={{ maxHeight: 'none', overflowY: 'visible', padding: '1.5rem', width: '360px', right: 0, left: 'auto', top: 'calc(100% + 14px)', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 24px 50px rgba(0,0,0,0.1)' }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', color: '#64748b', transition: '0.2s' }} onMouseOver={e=>e.currentTarget.style.background='#f8fafc'} onMouseOut={e=>e.currentTarget.style.background='#fff'}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '1rem', textTransform: 'capitalize' }}>
          {currentMonth.toLocaleString('uk-UA', { month: 'long', year: 'numeric' })}
        </div>
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', color: '#64748b', transition: '0.2s' }} onMouseOver={e=>e.currentTarget.style.background='#f8fafc'} onMouseOut={e=>e.currentTarget.style.background='#fff'}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8', fontWeight: '700', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
        <div>Пн</div><div>Вт</div><div>Ср</div><div>Чт</div><div>Пт</div><div>Сб</div><div>Нд</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '1.25rem' }}>
        {renderCalendarDays()}
      </div>

      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', display: 'flex', gap: '6px', justifyContent: 'space-between' }}>
        {['Ранок', 'Обід', 'Вечір', 'Будь-коли'].map(period => {
          const isSelected = searchTime === period || (period === 'Будь-коли' && searchTime === '');
          return (
            <button
              key={period}
              onClick={(e) => {
                e.stopPropagation();
                setSearchTime(period === 'Будь-коли' ? '' : period);
              }}
              style={{
                flex: 1, padding: '10px 4px', borderRadius: '12px', border: '1px solid',
                borderColor: isSelected ? '#0f172a' : '#e2e8f0',
                background: isSelected ? '#0f172a' : '#fff',
                color: isSelected ? '#fff' : '#475569',
                fontWeight: '600', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
              onMouseOver={(e) => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
              onMouseOut={(e) => { if (!isSelected) e.currentTarget.style.background = '#fff'; }}
            >
              {period}
            </button>
          );
        })}
      </div>
    </div>
  );

  const sortOptions = [
    { value: 'popular', label: 'За популярністю' },
    { value: 'rating', label: 'За рейтингом' },
    { value: 'newest', label: 'Спочатку нові' }
  ];

  const getSectionTitle = () => {
    if (appliedSearch) return `Результати пошуку: «${appliedSearch}»`;
    if (activeCategory === 'all') return 'Рекомендовані майстри';
    return categoryTitles[activeCategory] || 'Заклади';
  };

  const getSectionSubtitle = () => {
    if (appliedSearch) return `Знайдено закладів: ${filteredBusinesses.length}`;
    if (activeCategory === 'all') return 'Знайдіть ідеального спеціаліста для себе';
    return 'Найкращі майстри та студії у цій категорії';
  };

  if (!mounted) return null;

  const isHeaderDark = scrollState === 'scrolled' || scrollState === 'hiding';

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#222222', overflowX: 'hidden' }}>

      <style>{`
        .container { max-width: 1340px; margin: 0 auto; padding: 0 4rem; width: 100%; box-sizing: border-box; position: relative; z-index: 10; }
        .anim { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); }
        
        .btn-theme { background-color: #C2D8C4 !important; color: #222222 !important; font-weight: 750; border: none; cursor: pointer; }
        .btn-theme:hover { background-color: #AECAB0 !important; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(194, 216, 196, 0.4); }
        
        .category-btn { 
          color: #64748b; font-weight: 650; font-size: 0.95rem; white-space: nowrap; position: relative; 
          padding-bottom: 6px; transition: color 0.3s; background: none; border: none; cursor: pointer; 
          font-family: inherit; padding-left: 0; padding-right: 0; z-index: 10;
        }
        .category-btn::after { content: ''; position: absolute; width: 0; height: 2px; bottom: 0; left: 0; background-color: #222222; transition: width 0.3s; }
        .category-btn:hover { color: #222222; }
        .category-btn:hover::after { width: 100%; }
        .category-btn.active { color: #222222; font-weight: 800; }
        .category-btn.active::after { width: 100%; }
        
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        .search-dropdown {
          position: absolute; top: calc(100% + 8px); left: 0; width: 100%; 
          background: #ffffff; border-radius: 16px;
          box-shadow: 0 16px 40px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; z-index: 50;
          max-height: 280px; overflow-y: auto; padding: 0.5rem;
        }
        .search-dropdown-item {
          padding: 0.6rem 0.75rem; cursor: pointer; border-radius: 8px; font-size: 0.9rem; color: #334155; transition: background 0.2s;
          display: flex; justify-content: space-between; align-items: center;
        }
        .search-dropdown-item:hover { background: #f8fafc; color: #0f172a; font-weight: 600; }
        .badge-tag { font-size: 0.7rem; color: #94a3b8; background-color: #f1f5f9; padding: 3px 8px; border-radius: 6px; font-weight: 600; }

        .sort-trigger {
          display: flex; align-items: center; gap: 0.4rem; background: transparent; border: none;
          font-size: 0.95rem; color: #64748b; cursor: pointer; padding: 0.5rem 0;
          transition: color 0.2s; font-family: inherit; font-weight: 500;
        }
        .sort-trigger:hover { color: #111827; }
        .sort-trigger span { color: #111827; font-weight: 700; }

        .view-all-text-btn {
          display: flex; align-items: center; gap: 0.4rem; background: transparent; border: none;
          font-size: 0.95rem; font-weight: 700; color: #111827; cursor: pointer; padding: 0.5rem 0;
          transition: color 0.2s; font-family: inherit;
        }
        .view-all-text-btn:hover { color: #64748b; }
        .view-all-text-btn svg { transition: transform 0.2s; }
        .view-all-text-btn:hover svg { transform: translateY(2px); }
        .view-all-text-btn.expanded:hover svg { transform: translateY(-2px); }

        .salons-layout { display: flex; flex-wrap: wrap; gap: 2.5rem 1.5rem; width: 100%; position: relative; z-index: 10; }
        .tour-card { 
          flex: 0 0 calc((100% - 4.5rem) / 4); max-width: calc((100% - 4.5rem) / 4);
          background: #ffffff; border-radius: 20px; overflow: hidden; 
          box-shadow: 0 12px 30px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04); transition: transform 0.3s ease, box-shadow 0.3s ease; 
          display: flex; flex-direction: column; text-decoration: none; position: relative; border: 1px solid #f1f5f9; 
        }
        .tour-card:hover { transform: translateY(-6px); box-shadow: 0 20px 40px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.06); }
        .tour-card-img-wrapper { width: 100%; height: 170px; position: relative; overflow: hidden; background: #f1f5f9; }
        .tour-card-bg { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease; }
        .tour-card:hover .tour-card-bg { transform: scale(1.05); }
        .tour-badge-top { position: absolute; top: 12px; left: 12px; background: #ffffff; color: #111827; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.12); z-index: 2; }
        .tour-badge-top .star { color: #f59e0b; font-size: 0.9rem; }
        .tour-card-content { padding: 1.25rem; display: flex; flex-direction: column; flex: 1; }
        .tour-title { font-size: 1.15rem; font-weight: 800; color: #111827; margin: 0 0 0.4rem 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.01em; }
        .tour-desc { color: #6b7280; font-size: 0.85rem; margin: 0 0 1rem 0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .tour-info-row { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 0.65rem 0; margin-bottom: 1rem; }
        .tour-info-item { display: flex; align-items: center; gap: 6px; color: #374151; font-size: 0.8rem; font-weight: 600; }
        .tour-info-item svg { color: #9ca3af; width: 14px; height: 14px; }
        .tour-info-divider { width: 1px; height: 20px; background: #e5e7eb; }
        .tour-tags { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
        .tour-tag-pill { background: #f3f4f6; color: #111827; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
        .tour-book-btn { width: 100%; background: linear-gradient(180deg, #2d2d2d 0%, #111111 100%); color: #ffffff; padding: 0.85rem; border-radius: 999px; font-weight: 700; font-size: 0.95rem; text-align: center; cursor: pointer; transition: all 0.2s ease; border: none; box-shadow: 0 4px 14px rgba(0,0,0,0.15); }
        .tour-card:hover .tour-book-btn { background: linear-gradient(180deg, #3d3d3d 0%, #1a1a1a 100%); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.2); }

        .skeleton-pulse { background: #e2e8f0; animation: pulse 1.5s infinite ease-in-out; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }

        .reveal-on-scroll { opacity: 0; transform: translateY(40px); transition: opacity 0.8s ease-out, transform 0.8s cubic-bezier(0.25, 0.8, 0.25, 1); }
        .reveal-on-scroll.is-visible { opacity: 1; transform: translateY(0); }
        .delay-100 { transition-delay: 100ms; }
        .delay-200 { transition-delay: 200ms; }

        .compact-features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3rem; margin-bottom: 1rem; }
        @media (max-width: 992px) { .compact-features-grid { grid-template-columns: 1fr; gap: 2.5rem; } }
        
        .info-section { padding: 4rem 0 6rem 0; position: relative; z-index: 10; }
        .info-title { font-size: 2rem; font-weight: 900; color: #111827; line-height: 1.2; margin-bottom: 1rem; letter-spacing: -0.02em; }
        .info-desc { color: #64748b; font-size: 1rem; line-height: 1.6; margin-bottom: 1rem; font-weight: 400; }

        @keyframes float-widget { 0% { transform: translateY(0px); } 50% { transform: translateY(-12px); } 100% { transform: translateY(0px); } }

        .massive-blob { position: absolute; right: -5%; top: -10%; width: 55%; height: 120%; background: #222222; border-radius: 40% 60% 30% 70% / 50% 50% 50% 50%; z-index: 1; pointer-events: none; }
        .massive-blob-bg { position: absolute; right: -2%; top: -5%; width: 58%; height: 120%; background: #C2D8C4; border-radius: 50% 50% 60% 40% / 40% 60% 40% 60%; z-index: 0; opacity: 0.5; pointer-events: none; }

        .floating-widget { position: absolute; z-index: 10; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); padding: 1rem 1.5rem; border-radius: 100px; box-shadow: 0 20px 40px rgba(0,0,0,0.08); display: flex; align-items: center; gap: 1rem; border: 1px solid rgba(255, 255, 255, 1); animation: float-widget 6s ease-in-out infinite; }
        
        .city-link { color: #475569; text-decoration: none; font-size: 0.95rem; display: flex; align-items: center; gap: 0.5rem; transition: 0.2s; font-weight: 500; }
        .city-link:hover { color: #222222; transform: translateX(4px); }
        .city-link svg { stroke: #C2D8C4; }

        .modal-input { width: 100%; padding: 0.85rem 1rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem; box-sizing: border-box; margin-bottom: 1rem; transition: 0.2s; }
        .modal-input:focus { outline: none; border-color: #222222; box-shadow: 0 0 0 3px rgba(34, 34, 34, 0.1); }
        .social-btn { display: flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; padding: 0.85rem; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; font-weight: 600; color: #475569; cursor: pointer; transition: 0.2s; font-size: 0.95rem; }
        .social-btn:hover { background-color: #f8fafc; border-color: #cbd5e1; color: #0f172a; }

        /* 🟢 ПРАВИЛЬНА АНІМАЦІЯ ТА ПОЗИЦІЮВАННЯ ХЕДЕРА */
        .main-header {
          position: absolute; top: 0; left: 0; width: 100%; height: 72px; z-index: 1000;
          display: flex; align-items: center; background-color: transparent; border-bottom: 1px solid transparent;
        }
        .main-header.top { transform: translateY(0); }
        .main-header.scrolled {
          position: fixed; background-color: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid #f1f5f9; box-shadow: 0 4px 30px rgba(0,0,0,0.05);
          animation: slideDown 0.4s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
        }
        .main-header.hiding {
          position: fixed; background-color: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid #f1f5f9; box-shadow: 0 4px 30px rgba(0,0,0,0.05);
          animation: slideUp 0.4s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
        }
        .main-header.top .nav-link { color: #ffffff; }
        .main-header.scrolled .nav-link, .main-header.hiding .nav-link { color: #475569; }
        .main-header.scrolled .nav-link:hover, .main-header.hiding .nav-link:hover { color: #8fae92 !important; }

        @keyframes slideDown { from { transform: translateY(-100%); } to { transform: translateY(0); } }
        @keyframes slideUp { from { transform: translateY(0); } to { transform: translateY(-100%); } }
      `}</style>

      {/* МОДАЛКА ЛОГІНУ/РЕЄСТРАЦІЇ */}
      {isAuthModalOpen && (
        <div onClick={() => setIsAuthModalOpen(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(17, 24, 39, 0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
          <div className="anim" onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#ffffff', width: '100%', maxWidth: '420px', borderRadius: '24px', padding: '2.5rem', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <button onClick={() => { setIsAuthModalOpen(false); setIsLoginView(true); }} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', fontSize: '1.2rem', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' }}>×</button>
            <h2 style={{ fontSize: '1.8rem', fontWeight: '800', textAlign: 'center', marginBottom: '0.5rem', color: '#111827', letterSpacing: '-0.02em' }}>{isLoginView ? 'З поверненням' : 'Почати роботу'}</h2>
            <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: '1.4' }}>{isLoginView ? 'Увійдіть, щоб керувати розкладом.' : 'Створіть акаунт для вашого бізнесу.'}</p>
            <form onSubmit={handleModalAuth}>
              {!isLoginView && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0rem' }}>
                  <input type="text" placeholder="Ім'я" value={regFirstName} onChange={(e) => setRegFirstName(e.target.value)} className="modal-input" required />
                  <input type="text" placeholder="Прізвище" value={regLastName} onChange={(e) => setRegLastName(e.target.value)} className="modal-input" required />
                </div>
              )}
              <input type="email" placeholder="Email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="modal-input" required />
              <input type="password" placeholder="Пароль" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="modal-input" required />
              <button type="submit" style={{ width: '100%', padding: '1rem', backgroundColor: '#111827', color: '#fff', borderRadius: '12px', fontWeight: '700', border: 'none', cursor: 'pointer', marginBottom: '1.5rem', marginTop: '0.5rem', fontSize: '1rem', transition: '0.2s' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='#0f172a'} onMouseOut={e=>e.currentTarget.style.backgroundColor='#111827'}>{isLoginView ? 'Продовжити' : 'Зареєструватись'}</button>
            </form>
            <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0', color: '#94a3b8', fontSize: '0.85rem' }}><div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }}></div><span style={{ padding: '0 1rem' }}>АБО</span><div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }}></div></div>
            <button className="social-btn" onClick={() => alert('Ця функція з\'явиться пізніше')}>Google</button>
            <p style={{ textAlign: 'center', fontSize: '0.9rem', color: '#64748b', marginTop: '1.5rem' }}>{isLoginView ? (<>Немає акаунту? <span onClick={() => setIsLoginView(false)} style={{ color: '#111827', fontWeight: '700', cursor: 'pointer' }}>Створити</span></>) : (<>Вже маєте акаунт? <span onClick={() => setIsLoginView(true)} style={{ color: '#111827', fontWeight: '700', cursor: 'pointer' }}>Увійти</span></>)}</p>
          </div>
        </div>
      )}

      {/* ОРИГІНАЛЬНИЙ ХЕДЕР З ДОДАНИМ ПОШУКОМ */}
      <header className={`main-header ${scrollState}`}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', height: '100%', gap: '1rem' }}>

          {/* ЛОГОТИП */}
          <div style={{ width: '180px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: '900', color: isHeaderDark ? '#111827' : '#ffffff', letterSpacing: '-0.04em', transition: 'color 0.3s ease' }}>
                Book<span style={{ color: '#8fae92' }}>Era</span>
              </div>
            </Link>
          </div>

          {/* 🟢 ПОШУК У ХЕДЕРІ */}
          <div style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'flex-start',
            opacity: scrollState !== 'top' ? 1 : 0,
            pointerEvents: scrollState !== 'top' ? 'auto' : 'none',
            visibility: scrollState !== 'top' ? 'visible' : 'hidden',
            transform: scrollState !== 'top' ? 'translateY(0)' : 'translateY(-10px)',
            transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
            marginLeft: '1rem'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '4px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
              width: '100%',
              maxWidth: '650px',
              position: 'relative'
            }}>

              {/* ЩО (HEADER) */}
              <div ref={headerWhatRef} style={{ flex: 1.3, position: 'relative', display: 'flex', alignItems: 'center', padding: '0 0.5rem 0 1rem', height: '100%' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.6rem', flexShrink: 0 }}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input
                  type="text" placeholder="Послуга, бренд або салон"
                  value={searchWhat}
                  onChange={(e) => { setSearchWhat(e.target.value); setIsWhatOpen(true); setActiveSearch('header'); }}
                  onFocus={() => { setIsWhatOpen(true); setActiveSearch('header'); }}
                  onKeyDown={handleInputKeyDown}
                  style={{ width: '100%', border: 'none', outline: 'none', color: '#222222', fontSize: '0.95rem', backgroundColor: 'transparent' }}
                />
                {isWhatOpen && whatSuggestions.length > 0 && activeSearch === 'header' && scrollState !== 'top' && (
                  <div className="search-dropdown anim" style={{ top: 'calc(100% + 14px)' }}>
                    {whatSuggestions.map((item, idx) => (
                      <div key={idx} className="search-dropdown-item" onClick={() => { setSearchWhat(item.name); setIsWhatOpen(false); }}>
                        <span>{item.name}</span><span className="badge-tag">{item.type}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ width: '1px', height: '28px', backgroundColor: '#e2e8f0' }}></div>

              {/* ДЕ (HEADER) */}
              <div ref={headerWhereRef} style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', padding: '0 0.5rem', height: '100%' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.6rem', flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                <input
                  type="text" placeholder="Місто"
                  value={searchWhere}
                  onChange={(e) => { setSearchWhere(e.target.value); setIsWhereOpen(true); setActiveSearch('header'); }}
                  onFocus={() => { setIsWhereOpen(true); setActiveSearch('header'); }}
                  onKeyDown={handleInputKeyDown}
                  style={{ width: '100%', border: 'none', outline: 'none', color: '#222222', fontSize: '0.95rem', fontWeight: '600', backgroundColor: 'transparent' }}
                />
                {isWhereOpen && whereSuggestions.length > 0 && activeSearch === 'header' && scrollState !== 'top' && (
                  <div className="search-dropdown anim" style={{ top: 'calc(100% + 14px)' }}>
                    {whereSuggestions.map((city) => (
                      <div key={city} className="search-dropdown-item" onClick={() => { setSearchWhere(city); setIsWhereOpen(false); }}>{city}</div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ width: '1px', height: '28px', backgroundColor: '#e2e8f0' }}></div>

              {/* КОЛИ (HEADER) */}
              <div ref={headerDateRef} style={{ flex: 0.8, position: 'relative', display: 'flex', alignItems: 'center', padding: '0 1.25rem 0 0.5rem', height: '100%', cursor: 'pointer' }} onClick={() => { setIsDateOpen(!isDateOpen); setActiveSearch('header'); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.6rem', flexShrink: 0 }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <span style={{ color: searchDate || searchTime ? '#222222' : '#64748b', fontSize: '0.95rem', fontWeight: searchDate || searchTime ? '600' : '400', flexGrow: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {getDisplayDateTime()}
                </span>

                {isDateOpen && activeSearch === 'header' && scrollState !== 'top' && (
                  renderDatePicker()
                )}
              </div>

              <button type="button" onClick={() => void handleSearch()} style={{ width: '34px', height: '34px', borderRadius: '18px', backgroundColor: '#111827', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '8px', marginRight: '4px', flexShrink: 0, transition: '0.2s' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='#334155'} onMouseOut={e=>e.currentTarget.style.backgroundColor='#111827'}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </button>

            </div>
          </div>

          {/* ПРОФІЛЬ ТА МЕНЮ */}
          <div style={{ width: '320px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1.5rem' }}>
            <Link
              href="/business"
              style={{
                whiteSpace: 'nowrap',
                fontSize: '0.95rem',
                fontWeight: '600',
                textDecoration: 'none',
                color: isHeaderDark ? '#475569' : '#ffffff',
                transition: 'color 0.2s ease',
                cursor: 'pointer'
              }}
              onMouseOver={(e) => { e.currentTarget.style.color = '#8fae92'; }}
              onMouseOut={(e) => { e.currentTarget.style.color = isHeaderDark ? '#475569' : '#ffffff'; }}
            >
              Для бізнесу
            </Link>

            {isLoggedIn ? (
              <div style={{ position: 'relative' }} ref={profileRef}>
                <div
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    userSelect: 'none',
                    padding: '0.3rem 0.5rem',
                    borderRadius: '20px',
                    transition: 'all 0.2s ease'
                  }}
                  className="anim"
                >
                  <span style={{
                    color: isHeaderDark ? '#111827' : '#ffffff',
                    transition: 'color 0.2s ease',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    whiteSpace: 'nowrap'
                  }}>
                    {userName}
                  </span>

                  {/* 🟢 РЕНДЕР АВАТАРКИ АБО ІНІЦІАЛІВ */}
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={userName || 'Аватарка'}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        flexShrink: 0
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: isHeaderDark ? '#f1f5f9' : '#C2D8C4',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#111827',
                      fontWeight: '800',
                      fontSize: '0.9rem',
                      boxShadow: isHeaderDark ? 'none' : '0 2px 8px rgba(194, 216, 196, 0.35)',
                      transition: 'all 0.2s ease',
                      flexShrink: 0
                    }}>
                      {initials}
                    </div>
                  )}

                  <svg
                    width="10"
                    height="6"
                    viewBox="0 0 10 6"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{
                      transform: isProfileOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                      flexShrink: 0
                    }}
                  >
                    <path
                      d="M1 1L5 5L9 1"
                      stroke={isHeaderDark ? '#64748b' : '#ffffff'}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ transition: 'stroke 0.2s ease' }}
                    />
                  </svg>
                </div>

                {isProfileOpen && (
                  <div className="search-dropdown anim" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '210px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 16px 40px rgba(0,0,0,0.08)', padding: '0.4rem', zIndex: 1001 }}>
                    <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f1f5f9', marginBottom: '0.25rem' }}>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Акаунт</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111827', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
                    </div>
                    <Link href="/account/profile" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: '8px', color: '#334155', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '550', boxSizing: 'border-box' }} onClick={() => setIsProfileOpen(false)}>Мій профіль</Link>
                    {isBusinessRole(userRole) && (
                      <Link href="/cabinet" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: '8px', color: '#334155', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '550', boxSizing: 'border-box' }} onClick={() => setIsProfileOpen(false)}>Панель салону</Link>
                    )}
                    <Link href="/account/profile" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: '8px', color: '#334155', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '550', boxSizing: 'border-box' }} onClick={() => setIsProfileOpen(false)}>Налаштування</Link>
                    <button onClick={handleLogout} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: '8px', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '550', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', borderTop: '1px solid #f1f5f9', marginTop: '2px', boxSizing: 'border-box' }}>Вийти з акаунту</button>
                  </div>
                )}
              </div>
            ) : (
              <span
                onClick={() => { setIsLoginView(true); setIsAuthModalOpen(true); }}
                className="anim"
                style={{
                  color: isHeaderDark ? '#111827' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'color 0.2s ease',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                  whiteSpace: 'nowrap'
                }}
                onMouseOver={(e) => { e.currentTarget.style.color = '#8fae92'; }}
                onMouseOut={(e) => { e.currentTarget.style.color = isHeaderDark ? '#111827' : '#ffffff'; }}
              >
                Увійти / Зареєструватись
              </span>
            )}
          </div>
        </div>
      </header>

      {/* HERO БАНЕР */}
      <section style={{ position: 'relative', width: '100%', height: '540px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(34, 34, 34, 0.75)', zIndex: 2 }}></div>
          <video playsInline autoPlay muted loop crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }}>
            <source src="https://booksy-public.s3.amazonaws.com/horizontal_.webm" type="video/webm" />
          </video>
        </div>

        <div className="reveal-on-scroll" style={{ position: 'relative', zIndex: 50, maxWidth: '1340px', width: '100%', margin: '0 auto', padding: '4rem 4rem 0 4rem', boxSizing: 'border-box', textAlign: 'center' }}>
          <h1 style={{ fontSize: '3.2rem', fontWeight: '800', color: '#ffffff', maxWidth: '800px', margin: '0 auto 1rem auto', lineHeight: '1.2', letterSpacing: '-0.02em' }}>
            Догляд за собою в один клік
          </h1>
          <p style={{ fontSize: '1.15rem', color: '#ffffff', maxWidth: '600px', margin: '0 auto 2.5rem auto', lineHeight: '1.5', fontWeight: '500' }}>
            Знаходьте перевірених фахівців поблизу та миттєво бронюйте візити онлайн без зайвих дзвінків.
          </p>

          {/* 🟢 ОСНОВНИЙ ПОШУК (HERO) */}
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid transparent',
            borderRadius: '12px',
            padding: '4px',
            maxWidth: '700px',
            width: '100%',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            boxSizing: 'border-box',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            position: 'relative',
            zIndex: 100,
            height: '42px'
          }}>

            <div ref={heroWhatRef} style={{ flex: 1.3, position: 'relative', display: 'flex', alignItems: 'center', padding: '0 0.5rem 0 1rem', height: '100%' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.6rem', flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                placeholder="Послуга, бренд або салон"
                value={searchWhat}
                onChange={(e) => { setSearchWhat(e.target.value); setIsWhatOpen(true); setActiveSearch('hero'); }}
                onFocus={() => { setIsWhatOpen(true); setActiveSearch('hero'); }}
                onKeyDown={handleInputKeyDown}
                style={{ width: '100%', border: 'none', outline: 'none', color: '#222222', fontSize: '0.95rem', backgroundColor: 'transparent', padding: '0.8rem 0' }}
              />
              {isWhatOpen && whatSuggestions.length > 0 && activeSearch === 'hero' && (
                <div className="search-dropdown anim">
                  {whatSuggestions.map((item, idx) => (
                    <div key={idx} className="search-dropdown-item" onClick={() => { setSearchWhat(item.name); setIsWhatOpen(false); }}>
                      <span>{item.name}</span>
                      <span className="badge-tag">{item.type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ width: '1px', height: '28px', backgroundColor: '#e2e8f0' }}></div>

            <div ref={heroWhereRef} style={{ flex: 0.9, position: 'relative', display: 'flex', alignItems: 'center', padding: '0 0.75rem', height: '100%' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.6rem', flexShrink: 0 }}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <input
                type="text"
                placeholder="Де шукаємо?"
                value={searchWhere}
                onChange={(e) => { setSearchWhere(e.target.value); setIsWhereOpen(true); setActiveSearch('hero'); }}
                onFocus={() => { setIsWhereOpen(true); setActiveSearch('hero'); }}
                onKeyDown={handleInputKeyDown}
                style={{ width: '100%', border: 'none', outline: 'none', color: '#222222', fontSize: '0.95rem', fontWeight: '600', backgroundColor: 'transparent', padding: '0.8rem 0' }}
              />
              {isWhereOpen && whereSuggestions.length > 0 && activeSearch === 'hero' && (
                <div className="search-dropdown anim">
                  {whereSuggestions.map((city) => (
                    <div key={city} className="search-dropdown-item" onClick={() => { setSearchWhere(city); setIsWhereOpen(false); }}>{city}</div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ width: '1px', height: '28px', backgroundColor: '#e2e8f0' }}></div>

            <div ref={heroDateRef} style={{ flex: 0.8, position: 'relative', display: 'flex', alignItems: 'center', padding: '0 1.25rem 0 0.5rem', cursor: 'pointer', height: '100%' }} onClick={() => { setIsDateOpen(!isDateOpen); setActiveSearch('hero'); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.6rem', flexShrink: 0 }}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <span style={{ color: searchDate || searchTime ? '#222222' : '#64748b', fontSize: '0.95rem', fontWeight: searchDate || searchTime ? '600' : '400', flexGrow: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {getDisplayDateTime()}
              </span>

              {isDateOpen && activeSearch === 'hero' && (
                renderDatePicker()
              )}
            </div>

            <button type="button" onClick={() => void handleSearch()} style={{ width: '34px', height: '34px', borderRadius: '18px', backgroundColor: '#111827', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '8px', marginRight: '4px', flexShrink: 0, transition: '0.2s' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='#334155'} onMouseOut={e=>e.currentTarget.style.backgroundColor='#111827'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </button>

          </div>
        </div>
      </section>

      {/* КАТЕГОРІЇ ПОСЛУГ */}
      <section className="container reveal-on-scroll delay-100" style={{ paddingTop: '2.5rem', paddingBottom: '3.5rem', position: 'relative', zIndex: 40 }}>
        <div className="hide-scrollbar" style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '1.5rem', position: 'relative', zIndex: 10 }}>
          {categoriesData.map((cat) => {
            const isActive = activeCategory === cat.slug && !appliedSearch;
            return (
              <button
                key={cat.slug}
                onClick={() => handleCategorySelect(cat.slug)}
                className={`category-btn anim ${isActive ? 'active' : ''}`}
              >
                {cat.name}
              </button>
            );
          })}

          <div style={{ position: 'relative' }} ref={moreRef}>
            <button
              onClick={() => setIsMoreCategoriesOpen(!isMoreCategoriesOpen)}
              className={`category-btn anim ${isMoreCategoriesOpen ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              Більше...
            </button>
            {isMoreCategoriesOpen && (
              <div className="search-dropdown anim" style={{ top: '140%', right: 0, left: 'auto', width: '240px' }}>
                {extraCategoriesData.map(cat => (
                  <div
                    key={cat.slug}
                    className="search-dropdown-item"
                    style={{ padding: '0.6rem 1rem', fontSize: '0.9rem' }}
                    onClick={() => { handleCategorySelect(cat.slug); setIsMoreCategoriesOpen(false); }}
                  >
                    {cat.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* РЕКОМЕНДОВАНІ ЗАКЛАДИ */}
      <section className="reveal-on-scroll" style={{ paddingBottom: '5rem' }} id="salons-section">
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem', position: 'relative', zIndex: 50 }}>
            <div>
              <h2 style={{ fontSize: '2.4rem', fontWeight: '900', color: '#111827', margin: 0, letterSpacing: '-0.04em' }}>
                {getSectionTitle()}
              </h2>
              <p style={{ color: '#64748b', fontSize: '1.05rem', marginTop: '0.5rem', marginBottom: 0 }}>
                {getSectionSubtitle()}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>

              <div style={{ position: 'relative' }} ref={sortRef}>
                <button
                  type="button"
                  onClick={() => setIsSortOpen(!isSortOpen)}
                  className="sort-trigger"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                  </svg>
                  Сортування: <span>{sortOptions.find(o => o.value === sortBy)?.label}</span>
                </button>

                {isSortOpen && (
                  <div className="search-dropdown anim" style={{ top: '120%', right: 0, left: 'auto', width: '240px', zIndex: 100 }}>
                    {sortOptions.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        className="search-dropdown-item"
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          border: 'none',
                          display: 'block',
                          backgroundColor: sortBy === opt.value ? '#f8fafc' : 'transparent',
                          fontWeight: sortBy === opt.value ? '700' : '500'
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSortBy(opt.value);
                          setIsSortOpen(false);
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {filteredBusinesses.length > 4 && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className={`view-all-text-btn anim ${isExpanded ? 'expanded' : ''}`}
                >
                  {isExpanded ? 'Згорнути' : 'Дивитись всі'}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {isExpanded ? <polyline points="18 15 12 9 6 15"></polyline> : <polyline points="6 9 12 15 18 9"></polyline>}
                  </svg>
                </button>
              )}

            </div>
          </div>

          {filteredBusinesses.length === 0 ? (
            <div className="anim" style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '6rem 2rem', backgroundColor: '#f8fafc', borderRadius: '24px', border: '1px dashed #cbd5e1', margin: '2rem 0' }}>
              <div style={{ width: '72px', height: '72px', backgroundColor: '#ffffff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </div>
              <h3 style={{ color: '#111827', fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>Майстрів не знайдено</h3>
              <p style={{ color: '#64748b', fontSize: '1.05rem', maxWidth: '480px', margin: '0 auto', lineHeight: '1.5' }}>На жаль, за вашим запитом немає доступних закладів. Спробуйте змінити фільтри або повернутись до всіх рекомендацій.</p>
              <button
                onClick={() => { handleCategorySelect('all'); setAppliedSearch(''); setSearchWhat(''); }}
                style={{ marginTop: '2rem', padding: '0.85rem 2rem', backgroundColor: '#222222', color: '#fff', border: 'none', borderRadius: '99px', cursor: 'pointer', fontWeight: '700', fontSize: '1rem', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              >
                Скинути пошук
              </button>
            </div>
          ) : (
            <div className="salons-layout anim">
              {displayedBusinesses.map((biz: any) => {
                const rank = parseFloat(biz.rating);
                const hasRating = !isNaN(rank) && rank > 0;
                const displayRank = hasRating ? rank.toFixed(1) : '-';
                const reviewCount = parseInt(biz.reviews_count) || 0;
                const bgImage = biz.cover_photo || biz.logo || "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80";
                const category = biz.category || 'Салон краси';

                return (
                  <Link key={biz.id} href={`/${biz.slug || biz.id}`} className="tour-card">
                    <div className="tour-card-img-wrapper">
                      <img src={bgImage} alt={biz.name} loading="lazy" decoding="async" className="tour-card-bg" />
                      {hasRating && rank >= 4.8 && (
                        <div className="tour-badge-top">
                          <span className="star">★</span> Топ Вибір
                        </div>
                      )}
                    </div>
                    <div className="tour-card-content">
                      <h3 className="tour-title">{biz.name}</h3>
                      <p className="tour-desc">{biz.address || 'Комфортна атмосфера, професійні майстри та індивідуальний підхід до кожного клієнта.'}</p>
                      <div className="tour-info-row">
                        <div className="tour-info-item">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                          <span>{hasRating ? displayRank : 'Новий'}</span>
                        </div>
                        <div className="tour-info-divider"></div>
                        <div className="tour-info-item">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                          <span>{reviewCount} відг.</span>
                        </div>
                        <div className="tour-info-divider"></div>
                        <div className="tour-info-item">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path><line x1="16" y1="8" x2="2" y2="22"></line><line x1="17.5" y1="15" x2="9" y2="6.5"></line></svg>
                          <span style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60px'}}>{category}</span>
                        </div>
                      </div>

                      {(() => {
                        const cardTags = Array.isArray(biz.tags) ? biz.tags : [];
                        if (cardTags.length === 0) return null;

                        const maxTags = 2;
                        const visibleTags = cardTags.slice(0, maxTags);
                        const hiddenCount = cardTags.length - maxTags;

                        return (
                          <div className="tour-tags">
                            {visibleTags.map((tag: string, i: number) => (
                              <span key={i} className="tour-tag-pill">{tag}</span>
                            ))}
                            {hiddenCount > 0 && (
                              <span className="tour-tag-pill">+{hiddenCount}</span>
                            )}
                          </div>
                        );
                      })()}

                      <button className="tour-book-btn">Записатись</button>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* НОВА КОМПАКТНА ІНФОРМАЦІЙНА СІТКА */}
      <section className="info-section">
        <div className="container">
          <div className="compact-features-grid">
            <div className="reveal-on-scroll">
              <div style={{ width: '52px', height: '52px', borderRadius: '16px', backgroundColor: '#f0fdf4', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              </div>
              <h2 className="info-title">
                Зручно бронюйте візити <br/>
                <span style={{ position: 'relative', display: 'inline-block', zIndex: 1, color: '#111827' }}>
                  онлайн
                  <svg style={{ position: 'absolute', bottom: '0', left: '-5%', width: '110%', height: '12px', zIndex: -1 }} viewBox="0 0 100 12" preserveAspectRatio="none">
                    <path d="M2 10 Q 50 2 98 10" stroke="#C2D8C4" strokeWidth="4" fill="none" strokeLinecap="round" />
                  </svg>
                </span>
              </h2>
              <p className="info-desc">
                Хочете записатися до перукаря, барбера, на манікюр чи в масажний салон у вашому районі? Шукаєте місце, де найкращі спеціалісти подбають про вашу красу?
              </p>
              <p className="info-desc">
                BookEra — це безкоштовний додаток для бронювання, де можна легко й швидко знаходити вільні дати та записуватися. Більше жодних телефонних дзвінків.
              </p>
            </div>
            <div className="reveal-on-scroll delay-100">
              <div style={{ width: '52px', height: '52px', borderRadius: '16px', backgroundColor: '#eff6ff', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
              </div>
              <h2 className="info-title">
                Щось змінилося? <br/>Не переймайтеся — <br/>
                <span style={{ position: 'relative', display: 'inline-block', zIndex: 1, color: '#111827' }}>
                  ми нагадаємо
                  <svg style={{ position: 'absolute', bottom: '-2px', left: '-2%', width: '104%', height: '10px', zIndex: -1 }} viewBox="0 0 100 10" preserveAspectRatio="none">
                    <path d="M0 5 Q 25 10 50 5 T 100 5" stroke="#bfdbfe" strokeWidth="4" fill="none" strokeLinecap="round" />
                  </svg>
                </span>
              </h2>
              <p className="info-desc">
                Керуйте своїми візитами звідусіль. Переносьте записи або скасовуйте бронювання без незручних телефонних дзвінків та пояснень.
              </p>
              <p className="info-desc">
                Ми знаємо, що у вас щодня безліч справ! Тому BookEra надсилатиме вам автоматичні нагадування про майбутні візити, аби ви нічого не пропустили.
              </p>
            </div>
            <div className="reveal-on-scroll delay-200">
              <div style={{ width: '52px', height: '52px', borderRadius: '16px', backgroundColor: '#fefce8', color: '#a16207', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
              </div>
              <h2 className="info-title">
                Бронюйте в <span style={{ position: 'relative', display: 'inline-block', zIndex: 1 }}>
                  найкращих
                  <svg style={{ position: 'absolute', bottom: '-4px', left: '0', width: '100%', height: '10px', zIndex: -1 }} viewBox="0 0 100 10" preserveAspectRatio="none">
                    <path d="M0 5 Q 50 15 100 5" stroke="#facc15" strokeWidth="4" fill="none" strokeLinecap="round" />
                  </svg>
                </span> спеціалістів
              </h2>
              <p className="info-desc">
                У BookEra ви знайдете найкращі заклади для здоров'я та салони краси у вашому регіоні.
              </p>
              <p className="info-desc">
                Дізнайтеся більше про них — переглядайте профілі, читайте реальні відгуки інших клієнтів та ознайомлюйтеся з їхніми роботами в портфоліо перед тим, як записатись.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ТЕМНА СЕКЦІЯ (ДЛЯ БІЗНЕСУ - DASHBOARD) */}
      <section className="info-section" style={{ backgroundColor: '#111827', color: '#fff', padding: '10rem 0', position: 'relative', zIndex: 20, overflow: 'hidden' }}>
        <div className="massive-blob-bg"></div>
        <div className="massive-blob"></div>

        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6rem', alignItems: 'center' }}>

            <div className="reveal-on-scroll" style={{ position: 'relative', zIndex: 10 }}>
              <h2 style={{ fontSize: '3.5rem', fontWeight: '900', color: '#fff', lineHeight: '1.1', marginBottom: '1.5rem', letterSpacing: '-0.03em' }}>
                Сучасне <span style={{ display: 'inline-block', background: '#C2D8C4', padding: '0 1rem', borderRadius: '16px', color: '#222222', transform: 'rotate(-2deg)' }}>рішення</span> <br/>для вашого бізнесу
              </h2>
              <p style={{ color: '#cbd5e1', fontSize: '1.15rem', lineHeight: '1.6', marginBottom: '1.5rem', fontWeight: '400', maxWidth: '450px' }}>
                BookEra Business — це повноцінна екосистема для власників салонів та приватних майстрів. Залучайте нових клієнтів, керуйте розкладом та ведіть фінансову аналітику в одній програмі.
              </p>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem' }}>
                <Link href="/business" style={{ textDecoration: 'none' }}>
                  <button className="btn-theme anim" style={{ padding: '1rem 2.5rem', borderRadius: '30px', fontSize: '1rem' }}>Створити профіль</button>
                </Link>
              </div>
            </div>

            <div className="reveal-on-scroll delay-100" style={{ position: 'relative', height: '450px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ width: '100%', position: 'absolute' }}>
                <svg viewBox="0 0 600 400" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto', filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.5))' }}>
                  <rect x="20" y="20" width="560" height="360" rx="20" fill="#ffffff" stroke="#e2e8f0" strokeWidth="4"/>
                  <rect x="20" y="20" width="120" height="360" rx="20" fill="#f8fafc" />
                  <rect x="40" y="60" width="80" height="12" rx="6" fill="#cbd5e1" />
                  <rect x="40" y="90" width="60" height="10" rx="5" fill="#e2e8f0" />
                  <rect x="40" y="115" width="70" height="10" rx="5" fill="#e2e8f0" />
                  <rect x="40" y="140" width="50" height="10" rx="5" fill="#e2e8f0" />
                  <rect x="160" y="40" width="400" height="40" rx="10" fill="#f8fafc" />
                  <circle cx="530" cy="60" r="10" fill="#cbd5e1" />
                  <rect x="160" y="100" width="380" height="140" rx="12" fill="#f1f5f9" />
                  <path d="M 180 200 L 230 150 L 280 180 L 350 120 L 420 160 L 520 130" stroke="#8fae92" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="350" cy="120" r="6" fill="#8fae92" />
                  <circle cx="520" cy="130" r="6" fill="#8fae92" />
                  <path d="M 180 220 L 520 220" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="6 6" />
                  <path d="M 180 180 L 520 180" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="6 6" />
                  <rect x="160" y="260" width="180" height="100" rx="12" fill="#f8fafc" />
                  <rect x="180" y="280" width="20" height="20" rx="4" fill="#e2e8f0" />
                  <rect x="210" y="280" width="20" height="20" rx="4" fill="#e2e8f0" />
                  <rect x="240" y="280" width="20" height="20" rx="4" fill="#C2D8C4" />
                  <rect x="270" y="280" width="20" height="20" rx="4" fill="#e2e8f0" />
                  <rect x="300" y="280" width="20" height="20" rx="4" fill="#e2e8f0" />
                  <rect x="180" y="310" width="20" height="20" rx="4" fill="#e2e8f0" />
                  <rect x="210" y="310" width="20" height="20" rx="4" fill="#fde047" />
                  <rect x="240" y="310" width="20" height="20" rx="4" fill="#e2e8f0" />
                  <rect x="270" y="310" width="20" height="20" rx="4" fill="#e2e8f0" />
                  <rect x="300" y="310" width="20" height="20" rx="4" fill="#e2e8f0" />
                  <rect x="360" y="260" width="180" height="100" rx="12" fill="#C2D8C4" />
                  <circle cx="400" cy="310" r="20" fill="#ffffff" fillOpacity="0.5" />
                  <path d="M 400 300 L 400 320 M 390 310 L 410 310" stroke="#111827" strokeWidth="4" strokeLinecap="round" />
                  <rect x="440" y="295" width="60" height="10" rx="5" fill="#111827" />
                  <rect x="440" y="315" width="40" height="8" rx="4" fill="#111827" fillOpacity="0.5" />
                </svg>
              </div>
              <div className="floating-widget" style={{ left: '-10px', bottom: '15%' }}>
                <div style={{ width: '40px', height: '40px', background: '#C2D8C4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', color: '#222', flexShrink: 0 }}>✓</div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '1rem', fontWeight: '800', color: '#111827', lineHeight: '1.2' }}>+40% клієнтів</span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Завдяки системі</span>
                </div>
              </div>
              <div className="floating-widget" style={{ top: '8%', right: '-20px', padding: '0.8rem 1.2rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8fae92" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                <span style={{ fontSize: '0.9rem', fontWeight: '800', color: '#111827' }}>Аналітика</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* БЛОК МІСТ */}
      <section className="reveal-on-scroll" style={{ padding: '6rem 0', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', position: 'relative', zIndex: 20 }}>
        <div className="container">
          <h2 style={{ fontSize: '2rem', fontWeight: '800', color: '#222222', textAlign: 'center', marginBottom: '3rem', letterSpacing: '-0.02em' }}>
            Шукайте свого спеціаліста за містом
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem 2rem' }}>
            {topCities.map(city => (
              <Link key={city} href={`/s/${searchWhat}?location=${city}`} className="city-link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                {city}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ФУТЕР */}
      <footer style={{ backgroundColor: '#1a1a1a', padding: '4rem 0 2rem 0', position: 'relative', zIndex: 20 }}>
        <div className="container">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', borderBottom: '1px solid #333333', paddingBottom: '3rem', margin: '0 0 2rem 0' }}>
            <div style={{ flex: 1, display: 'flex', gap: '4rem' }}>
              <Link href="#" className="footer-link anim">Блог</Link>
              <Link href="#" className="footer-link anim">Про нас</Link>
              <Link href="#" className="footer-link anim">Поширені запитання</Link>
              <Link href="#" className="footer-link anim">Політика конфіденційності</Link>
              <Link href="#" className="footer-link anim">Умови використання</Link>
              <Link href="#" className="footer-link anim">Кар'єра</Link>
              <Link href={isBusinessRole(userRole) ? "/cabinet" : "/business"} className="footer-link anim" style={{ color: '#C2D8C4', fontWeight: '700' }}>BookEra Business</Link>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#C2D8C4' }}>Book<span style={{ color: '#fff' }}>Era</span></div>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>© 2026 BookEra Inc. Усі права захищено.</span>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
               {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={userName || 'Аватарка'}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    flexShrink: 0
                  }}
                />
              ) : (
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: isHeaderDark ? '#f1f5f9' : '#C2D8C4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#111827',
                  fontWeight: '800',
                  fontSize: '0.9rem',
                  boxShadow: isHeaderDark ? 'none' : '0 2px 8px rgba(194, 216, 196, 0.35)',
                  transition: 'all 0.2s ease',
                  flexShrink: 0
                }}>
                  {initials}
                </div>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}