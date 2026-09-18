'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';
import { isBusinessRole } from '@/lib/roles';
import Avatar from '@/components/ui/Avatar';
import HeroVideoBackdrop from '@/components/home/HeroVideoBackdrop';

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
  const [scrollState, setScrollState] = useState<'top' | 'scrolled' | 'hiding'>('top');

  const [businesses] = useState<any[]>(initialBusinesses || []);
  const [favorites, setFavorites] = useState<number[]>([]);

  // Авторизація
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

  // Пошук
  const [searchWhat, setSearchWhat] = useState('');
  const [searchWhere, setSearchWhere] = useState('Львів');
  const [searchDate, setSearchDate] = useState('');
  const [searchTime, setSearchTime] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [availableBizIds, setAvailableBizIds] = useState<number[] | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [nearbySlots, setNearbySlots] = useState<Record<number, string[]>>({});
  const [isLoadingNearbySlots, setIsLoadingNearbySlots] = useState<boolean>(true);

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
  const nearbyScrollRef = useRef<HTMLDivElement>(null);
  const collectionsScrollRef = useRef<HTMLDivElement>(null);
  const isAutoSearchRun = useRef(false);

  // Геолокація
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            setUserCoords({ lat: latitude, lng: longitude }); // зберігаємо точні координати
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

  // Ініціалізація
  useEffect(() => {
    setMounted(true);

    if (typeof window !== 'undefined') {
      const storedName = localStorage.getItem('userName');
      const storedRole = localStorage.getItem('userRole') || 'client';
      const storedAvatar = localStorage.getItem('userAvatar');
      const storedFavs = localStorage.getItem('bookera_favs');

      if (storedFavs) {
        try { setFavorites(JSON.parse(storedFavs)); } catch {}
      }

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

      const handleStorageUpdate = () => {
        setAvatarUrl(localStorage.getItem('userAvatar') || null);
        const updatedName = localStorage.getItem('userName');
        if (updatedName) setUserName(updatedName);
      };
      window.addEventListener('storage', handleStorageUpdate);
    }

    const handleScroll = () => {
      if (window.scrollY > 380) {
        setScrollState('scrolled');
      } else if (window.scrollY > 140) {
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
    }, { threshold: 0.12 });

    setTimeout(() => {
      document.querySelectorAll('.reveal-on-scroll').forEach(el => observer.observe(el));
    }, 100);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, [supabase]);

  // Закриття кліком поза межами
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


  const toggleFavorite = async (bizId: number) => {
    const isFav = favorites.includes(bizId);
    const updated = isFav
      ? favorites.filter(id => id !== bizId)
      : [...favorites, bizId];
    setFavorites(updated);
    localStorage.setItem('bookera_favs', JSON.stringify(updated));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        if (isFav) {
          await api.removeFavorite(session.access_token, bizId);
        } else {
          await api.addFavorite(session.access_token, bizId);
        }
      }
    } catch (err) {
      console.error('Помилка синхронізації улюбленого з БД:', err);
    }
  };

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

        const profile = data.user?.user_metadata;
        let finalName = profile?.full_name || 'Користувач';
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

        if (error) {
          alert(`Помилка реєстрації: ${error.message}`);
          return;
        }

        localStorage.setItem('userName', targetFullName);
        localStorage.setItem('userRole', 'client');
        if (data?.session?.user) localStorage.setItem('userId', data.session.user.id);

        setUserName(targetFullName);
        setUserRole('client');
        const initialsStr = targetFullName.length >= 2 ? targetFullName.substring(0, 2).toUpperCase() : 'К';
        setInitials(initialsStr);

        setIsLoggedIn(true);
        setIsAuthModalOpen(false);
      }
    } catch {
      alert("Відбулася помилка при з'єднанні з сервером.");
    }
  };

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

    setTimeout(() => {
      const targetElement = document.getElementById('salons-section');
      if (targetElement) {
        const headerOffset = 85;
        const elementPosition = targetElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
           top: offsetPosition,
           behavior: 'smooth'
        });
      }
    }, 120);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
      void handleSearch();
    }
  };

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
      .filter(b => b.name?.toLowerCase().includes(searchLower))
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

  // Фільтрація каталогу
  const filteredBusinesses = useMemo(() => {
    return businesses
      .filter(biz => {
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
          const searchableText = `${biz.category || ''} ${biz.name || ''} ${biz.description || ''} ${(biz.tags || []).join(' ')}`.toLowerCase();
          matchesCategory = terms.some(term => searchableText.includes(term));
        }

        let matchesText = true;
        if (appliedSearch) {
          const query = appliedSearch.toLowerCase();
          const fullText = `${biz.category || ''} ${biz.name || ''} ${biz.description || ''} ${biz.address || ''} ${(biz.tags || []).join(' ')}`.toLowerCase();
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

  // Заклади поблизу
  const nearbyBusinesses = useMemo(() => {
    if (!searchWhere || searchWhere.trim() === '') return businesses.slice(0, 6);
    const loc = searchWhere.toLowerCase().trim();
    const matches = businesses.filter(b =>
      (b.city && b.city.toLowerCase().includes(loc)) ||
      (b.address && b.address.toLowerCase().includes(loc))
    );
    return matches.length > 0 ? matches : businesses.slice(0, 6);
  }, [businesses, searchWhere]);

  // Розрахунок точної відстані від користувача до закладу
  const getSalonDistance = useCallback((biz: any) => {
    if (!userCoords) return null;

    let sLat = biz.latitude || biz.layout_config?.lat;
    let sLng = biz.longitude || biz.layout_config?.lng;

    if (!sLat || !sLng) {
      const addr = (biz.address || '').toLowerCase();
      if (addr.includes('дорошенка')) { sLat = 49.8407; sLng = 24.0275; }
      else if (addr.includes('городоцька')) { sLat = 49.8390; sLng = 24.0150; }
      else if (addr.includes('коперника')) { sLat = 49.8375; sLng = 24.0260; }
      else if (addr.includes('франка')) { sLat = 49.8340; sLng = 24.0340; }
      else if (addr.includes('пекарська')) { sLat = 49.8380; sLng = 24.0410; }
      else if (addr.includes('шевченка')) { sLat = 49.8470; sLng = 24.0120; }
      else { sLat = 49.8419; sLng = 24.0315; }
    }

    const R = 6371e3;
    const dLat = ((sLat - userCoords.lat) * Math.PI) / 180;
    const dLon = ((sLng - userCoords.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((userCoords.lat * Math.PI) / 180) *
      Math.cos((sLat * Math.PI) / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const meters = Math.round(R * c);

    if (meters < 1000) {
      return `${Math.round(meters / 50) * 50 || 50} м`;
    }
    return `${(meters / 1000).toFixed(1)} км`;
  }, [userCoords]);

  // Завантаження реальних слотів на сьогодні для закладу
  useEffect(() => {
    if (!nearbyBusinesses || nearbyBusinesses.length === 0) return;

    let isMounted = true;
    const todayStr = new Date().toISOString().split('T')[0];

    async function loadRealSlots() {
      setIsLoadingNearbySlots(true);
      const slotsMap: Record<number, string[]> = {};

      await Promise.all(
        nearbyBusinesses.slice(0, 6).map(async (biz) => {
          const srvId = biz.services?.[0]?.id;
          if (!srvId) return;

          try {
            const res = await api.getAvailableSlots({
              business_id: Number(biz.id),
              service_id: Number(srvId),
              target_date: todayStr,
              master_id: '0',
            });

            const free = (res.slots || [])
              .filter((s: any) => s.status === 'available')
              .slice(0, 3)
              .map((s: any) => s.time.substring(0, 5));

            slotsMap[biz.id] = free;
          } catch (err) {
            console.warn(`Помилка отримання слотів салону ${biz.id}:`, err);
          }
        })
      );

      if (isMounted) {
        setNearbySlots(slotsMap);
        setIsLoadingNearbySlots(false);
      }
    }

    void loadRealSlots();
    return () => { isMounted = false; };
  }, [nearbyBusinesses]);

  const displayedBusinesses = isExpanded ? filteredBusinesses : filteredBusinesses.slice(0, 8);
  const isDefaultView = activeCategory === 'all' && !appliedSearch && !searchDate;

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
            if (!isPast) setSearchDate(isSelected ? '' : dateStr);
          }}
          style={{
            height: '34px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isPast ? 'default' : 'pointer',
            borderRadius: '10px',
            backgroundColor: isSelected ? '#111827' : 'transparent',
            color: isSelected ? '#ffffff' : (isPast ? '#cbd5e1' : '#111827'),
            fontWeight: isSelected ? '700' : '500',
            fontSize: '0.9rem',
            transition: 'all 0.15s ease',
          }}
        >
          {i}
        </div>
      );
    }
    return days;
  };

  const renderDatePicker = () => (
    <div className="search-dropdown anim" style={{ maxHeight: 'none', overflowY: 'visible', padding: '1.5rem', width: '350px', right: 0, left: 'auto', top: 'calc(100% + 14px)', borderRadius: '22px' }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', color: '#64748b' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <div style={{ fontWeight: '700', color: '#111827', fontSize: '0.95rem', textTransform: 'capitalize' }}>
          {currentMonth.toLocaleString('uk-UA', { month: 'long', year: 'numeric' })}
        </div>
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', color: '#64748b' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8', fontWeight: '700', marginBottom: '0.5rem' }}>
        <div>Пн</div><div>Вт</div><div>Ср</div><div>Чт</div><div>Пт</div><div>Сб</div><div>Нд</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '1.25rem' }}>
        {renderCalendarDays()}
      </div>

      <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '1.25rem', display: 'flex', gap: '6px', justifyContent: 'space-between' }}>
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
                flex: 1, padding: '8px 4px', borderRadius: '10px', border: '1px solid',
                borderColor: isSelected ? '#111827' : '#e2e8f0',
                background: isSelected ? '#111827' : '#fff',
                color: isSelected ? '#fff' : '#475569',
                fontWeight: '600', cursor: 'pointer', fontSize: '0.78rem', transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
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
    if (activeCategory === 'all') return 'Рекомендовані майстри та студії';
    return categoryTitles[activeCategory] || 'Заклади';
  };

  const getSectionSubtitle = () => {
    if (appliedSearch) return `Знайдено закладів: ${filteredBusinesses.length}`;
    if (activeCategory === 'all') return 'Найкращі фахівці за відгуками клієнтів';
    return 'Найкращі майстри та студії у цій категорії';
  };

  // 🟢 ЄДИНА КАРТКА ЗАКЛАДУ (ОДНАКОВИЙ РОЗМІР 1:1)
  const renderCard = (biz: any, options?: { distanceTag?: string; showTimeSlots?: boolean }) => {
    const rank = parseFloat(biz.rating);
    const hasRating = !isNaN(rank) && rank > 0;
    const displayRank = hasRating ? rank.toFixed(1) : '5.0';
    const reviewCount = parseInt(biz.reviews_count) || 0;
    const bgImage = biz.cover_photo || biz.logo || "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80";
    const isFav = favorites.includes(biz.id);

    // Справжня мінімальна ціна серед послуг салону
    const prices = (biz.services || [])
      .map((s: any) => Number(s.price))
      .filter((p: number) => !isNaN(p) && p > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : null;

    const categoryLabels: Record<string, string> = {
      barber: 'Барбер',
      hair: 'Волосся',
      nails: 'Нігті',
      skincare: 'Догляд',
      brows: 'Брови',
      massage: 'Масаж',
      makeup: 'Макіяж',
      spa: 'Spa',
    };
    const category = categoryLabels[biz.category] || categoryTitles[biz.category] || biz.category || 'Студія';

    // Формування точної локації та відстані
    const locationText = options?.distanceTag
      ? `${options.distanceTag} • ${biz.address || biz.city || 'Центр'}`
      : ([biz.city, biz.address].filter(Boolean).join(', ') || 'Адресу уточнюйте');

    const todayStr = new Date().toISOString().split('T')[0];
    const salonSlots = nearbySlots[biz.id] || [];
    const primaryService = biz.services?.[0];

    return (
      <Link key={biz.id} href={`/${biz.slug || biz.id}`} className="apple-biz-card anim">
        <div className="card-photo-box">
          <img src={bgImage} alt={biz.name} loading="lazy" decoding="async" className="card-photo-img" />

          <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: '6px', zIndex: 2 }}>
            {options?.distanceTag ? (
              <div className="glass-pill">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>{options.distanceTag}</span>
              </div>
            ) : (
              (!hasRating || rank >= 4.8) && (
                <div className="glass-pill">
                  <span style={{ color: '#f59e0b' }}>★</span>
                  <span>Топ вибір</span>
                </div>
              )
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFavorite(biz.id);
            }}
            className="glass-fav-btn anim"
            title="Зберегти"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={isFav ? "#ef4444" : "none"} stroke={isFav ? "#ef4444" : "#111827"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>

        <div className="card-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
            <h3 className="card-heading">{biz.name}</h3>
            <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#111827', whiteSpace: 'nowrap' }}>
              {minPrice ? `від ${minPrice} ₴` : 'від 450 ₴'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#111827', fontWeight: '700' }}>
              <span style={{ color: '#f59e0b' }}>★</span> {displayRank}
              <span style={{ color: '#94a3b8', fontWeight: '400', fontSize: '0.75rem' }}>({reviewCount})</span>
            </span>
            <span>•</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{category}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.85rem' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
            <span style={{ color: '#10b981', fontWeight: '600' }}>Відкрито</span>
            <span>•</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{locationText}</span>
          </div>

          {/* РЕАЛЬНІ СЛОТИ ЧАСУ НА СЬОГОДНІ */}
          {options?.showTimeSlots ? (
            <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.72rem', color: '#8fae92', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Сьогодні:
              </span>
              {salonSlots.length > 0 ? (
                <div style={{ display: 'flex', gap: '5px' }}>
                  {salonSlots.map(time => (
                    <button
                      key={time}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const query = new URLSearchParams({
                          date: todayStr,
                          time: time,
                        });
                        if (primaryService?.id) query.set('service', String(primaryService.id));
                        router.push(`/${biz.slug || biz.id}?${query.toString()}`);
                      }}
                      className="interactive-time-chip anim"
                    >
                      {time}
                    </button>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: '500' }}>
                  Немає слотів на сьогодні
                </span>
              )}
            </div>
          ) : (
            <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '500' }}>
                Швидкий запис
              </span>
              <span className="card-action-link">
                Записатись
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </span>
            </div>
          )}
        </div>
      </Link>
    );
  };

  const scrollNearby = (direction: 'left' | 'right') => {
    if (nearbyScrollRef.current) {
      const scrollAmount = 320;
      nearbyScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const scrollCollections = (direction: 'left' | 'right') => {
    if (collectionsScrollRef.current) {
      const scrollAmount = 340;
      collectionsScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (!mounted) return null;

  const isHeaderDark = scrollState === 'scrolled' || scrollState === 'hiding';

  return (
    <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif', color: '#222222', overflowX: 'hidden' }}>

      <style>{`
        html, body {
          background-color: #111215 !important;
          margin: 0;
          padding: 0;
        }

        .container { max-width: 1340px; margin: 0 auto; padding: 0 4rem; width: 100%; box-sizing: border-box; position: relative; z-index: 10; }
        .anim { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); }
        
        .btn-theme { background-color: #C2D8C4 !important; color: #222222 !important; font-weight: 750; border: none; cursor: pointer; }
        .btn-theme:hover { background-color: #AECAB0 !important; transform: translateY(-2px); box-shadow: 0 4px 14px rgba(194, 216, 196, 0.4); }
        
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

        /* СКЛЯНІ ДРОПДАУНИ */
        .search-dropdown {
          position: absolute; top: calc(100% + 8px); left: 0; width: 100%; 
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-radius: 18px;
          box-shadow: 0 20px 45px -10px rgba(0,0,0,0.1), 0 0 1px 1px rgba(0,0,0,0.04);
          border: 1px solid rgba(255, 255, 255, 0.7);
          z-index: 50;
          max-height: 280px; overflow-y: auto; padding: 0.5rem;
        }
        .search-dropdown-item {
          padding: 0.65rem 0.85rem; cursor: pointer; border-radius: 10px; font-size: 0.9rem; color: #334155; transition: background 0.15s;
          display: flex; justify-content: space-between; align-items: center;
        }
        .search-dropdown-item:hover { background: rgba(0, 0, 0, 0.05); color: #0f172a; font-weight: 600; }
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
        .view-all-text-btn:hover { color: #8fae92; }

        /* ОДНАКОВІ КАРТКИ В СТИЛІ APPLE */
        .apple-biz-card {
          background: #ffffff;
          border-radius: 20px;
          border: 1px solid rgba(0, 0, 0, 0.06);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          text-decoration: none;
          position: relative;
          box-shadow: 0 4px 18px rgba(0, 0, 0, 0.03);
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s ease;
          box-sizing: border-box;
        }
        .apple-biz-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 36px -8px rgba(0, 0, 0, 0.08);
          border-color: rgba(0, 0, 0, 0.1);
        }
        .card-photo-box {
          width: 100%;
          height: 175px;
          position: relative;
          overflow: hidden;
          background-color: #f1f5f9;
        }
        .card-photo-img {
          position: absolute; top: 0; left: 0; width: 100%; height: 100%;
          object-fit: cover;
          transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .apple-biz-card:hover .card-photo-img {
          transform: scale(1.04);
        }

        /* СКЛЯНИЙ БЕЙДЖ */
        .glass-pill {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.7);
          padding: 4px 9px;
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 700;
          color: #111827;
          display: flex;
          align-items: center;
          gap: 4px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        /* КНОПКА «В ОБРАНЕ» */
        .glass-fav-btn {
          position: absolute; top: 10px; right: 10px; z-index: 2;
          width: 32px; height: 32px; border-radius: 50%;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.7);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }
        .glass-fav-btn:hover {
          transform: scale(1.1);
          background: #ffffff;
        }

        .card-body {
          padding: 1.15rem;
          display: flex;
          flex-direction: column;
          flex: 1;
        }
        .card-heading {
          font-size: 1.12rem;
          font-weight: 800;
          color: #111827;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: -0.015em;
        }
        .card-action-link {
          font-size: 0.85rem;
          font-weight: 700;
          color: #111827;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: color 0.15s ease, transform 0.15s ease;
        }
        .apple-biz-card:hover .card-action-link {
          color: #8fae92;
          transform: translateX(2px);
        }

        /* КЛІКАБЕЛЬНІ СЛОТИ ЧАСУ */
        .interactive-time-chip {
          background: #f1f5f9;
          color: #111827;
          border: 1px solid transparent;
          border-radius: 8px;
          padding: 4px 8px;
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
        }
        .interactive-time-chip:hover {
          background: #C2D8C4;
          color: #111827;
          transform: translateY(-1px);
        }

        /* СІТКА КАТАЛОГУ */
        .salons-layout {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.75rem 1.5rem;
          width: 100%;
        }
        @media (max-width: 1120px) { .salons-layout { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 820px) { .salons-layout { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 560px) { .salons-layout { grid-template-columns: 1fr; } }

        /* ОДНАКОВИЙ РОЗМІР КАРТОК У КАРУСЕЛІ */
        .nearby-carousel {
          display: flex;
          gap: 1.5rem;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          padding-bottom: 0.5rem;
        }
        .nearby-carousel-item {
          flex: 0 0 calc((100% - 4.5rem) / 4);
          min-width: 270px;
          scroll-snap-align: start;
        }

        .carousel-nav-btn {
          width: 36px; height: 36px;
          border-radius: 50%;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          color: #111827;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .carousel-nav-btn:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          transform: scale(1.05);
        }

        /* 🌟 ВИТОНЧЕНІ КУРАТОРСЬКІ ДОБІРКИ У ДВА РЯДИ ЗІ ЗМІЩЕННЯМ */
        .editorial-scroll-wrapper {
          overflow-x: auto;
          padding-bottom: 0.8rem;
          margin: 0 -0.5rem;
          padding-left: 0.5rem;
          padding-right: 0.5rem;
        }
        .editorial-staggered-track {
          display: flex;
          flex-direction: column;
          gap: 1.15rem;
          width: max-content;
        }
        .editorial-stream-row {
          display: flex;
          gap: 1.15rem;
        }
        .editorial-stream-row.offset-row {
          margin-left: 55px; /* ЕЛЕГАНТНЕ ЗМІЩЕННЯ ДРУГОГО РЯДУ ВПРАВО */
        }

        .compact-editorial-card {
          width: 275px;
          height: 132px; /* КОМПАКТНА ВИСОТА */
          border-radius: 20px;
          overflow: hidden;
          position: relative;
          text-decoration: none;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 1.15rem 1.25rem;
          box-shadow: 0 6px 20px -6px rgba(0, 0, 0, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.18);
          box-sizing: border-box;
          cursor: pointer;
        }
        
        /* СВІТЛОВИЙ БЛІК APPLE */
        .compact-editorial-card::after {
          content: '';
          position: absolute;
          top: -50%;
          left: -60%;
          width: 40%;
          height: 200%;
          background: linear-gradient(105deg, transparent 30%, rgba(255, 255, 255, 0.25) 50%, transparent 70%);
          transform: rotate(25deg);
          transition: transform 0.65s ease-in-out;
          pointer-events: none;
          z-index: 4;
        }
        .compact-editorial-card:hover::after {
          transform: rotate(25deg) translate(280%, 0);
        }

        .compact-editorial-bg {
          position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;
          transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 1;
        }
        .compact-editorial-card:hover .compact-editorial-bg {
          transform: scale(1.06);
        }
        .compact-editorial-overlay {
          position: absolute; top: 0; left: 0; width: 100%; height: 100%;
          background: linear-gradient(180deg, rgba(17, 24, 39, 0.1) 0%, rgba(17, 24, 39, 0.4) 40%, rgba(17, 24, 39, 0.88) 100%);
          z-index: 2;
        }
        .compact-tag {
          position: relative; z-index: 3;
          align-self: flex-start;
          background: rgba(255, 255, 255, 0.22);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.35);
          color: #ffffff;
          font-size: 0.68rem;
          font-weight: 750;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 3px 9px;
          border-radius: 999px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .compact-footer {
          position: relative; z-index: 3;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .compact-title {
          color: #ffffff;
          font-size: 1.05rem;
          font-weight: 800;
          margin: 0;
          letter-spacing: -0.02em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .compact-chevron {
          width: 22px; height: 22px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.25);
          backdrop-filter: blur(12px);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: transform 0.2s ease, background 0.2s ease;
        }
        .compact-editorial-card:hover .compact-chevron {
          background: #ffffff;
          transform: translateX(2px);
        }
        .compact-editorial-card:hover .compact-chevron svg {
          stroke: #111827;
        }

        .reveal-on-scroll { opacity: 0; transform: translateY(30px); transition: opacity 0.8s ease-out, transform 0.8s cubic-bezier(0.25, 0.8, 0.25, 1); }
        .reveal-on-scroll.is-visible { opacity: 1; transform: translateY(0); }
        .delay-100 { transition-delay: 100ms; }
        .delay-200 { transition-delay: 200ms; }

        .compact-features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3rem; margin-bottom: 1rem; }
        @media (max-width: 992px) { .compact-features-grid { grid-template-columns: 1fr; gap: 2.5rem; } }
        
        .info-section { padding: 5rem 0 6rem 0; position: relative; z-index: 10; }
        .info-title { font-size: 2rem; font-weight: 900; color: #111827; line-height: 1.2; margin-bottom: 1rem; letter-spacing: -0.02em; }
        .info-desc { color: #64748b; font-size: 1rem; line-height: 1.6; margin-bottom: 1rem; font-weight: 400; }

        @keyframes float-widget { 0% { transform: translateY(0px); } 50% { transform: translateY(-12px); } 100% { transform: translateY(0px); } }

        .massive-blob { position: absolute; right: -5%; top: -10%; width: 55%; height: 120%; background: #222222; border-radius: 40% 60% 30% 70% / 50% 50% 50% 50%; z-index: 1; pointer-events: none; }
        .massive-blob-bg { position: absolute; right: -2%; top: -5%; width: 58%; height: 120%; background: #C2D8C4; border-radius: 50% 50% 60% 40% / 40% 60% 40% 60%; z-index: 0; opacity: 0.5; pointer-events: none; }

        .floating-widget { position: absolute; z-index: 10; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); padding: 1rem 1.5rem; border-radius: 100px; box-shadow: 0 20px 40px rgba(0,0,0,0.08); display: flex; align-items: center; gap: 1rem; border: 1px solid rgba(255, 255, 255, 1); animation: float-widget 6s ease-in-out infinite; }
        
        .city-link { color: #94a3b8; text-decoration: none; font-size: 0.95rem; display: flex; align-items: center; gap: 0.5rem; transition: 0.2s; font-weight: 500; }
        .city-link:hover { color: #ffffff; transform: translateX(4px); }
        .city-link svg { stroke: #8fae92; }

        .modal-input { width: 100%; padding: 0.85rem 1rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem; box-sizing: border-box; margin-bottom: 1rem; transition: 0.2s; }
        .modal-input:focus { outline: none; border-color: #222222; box-shadow: 0 0 0 3px rgba(34, 34, 34, 0.1); }
        .social-btn { display: flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; padding: 0.85rem; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; font-weight: 600; color: #475569; cursor: pointer; transition: 0.2s; font-size: 0.95rem; }
        .social-btn:hover { background-color: #f8fafc; border-color: #cbd5e1; color: #0f172a; }

        /* ЧОРНИЙ ФУТЕР */
        .clean-dark-footer {
          background-color: #111215;
          color: #ffffff;
          padding: 4.5rem 0 2.5rem 0;
          position: relative;
          z-index: 10;
        }
        .footer-col-title {
          color: #ffffff;
          font-size: 0.82rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 1.35rem;
        }
        .footer-nav-link {
          color: #94A3B8;
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 500;
          transition: color 0.15s ease, transform 0.15s ease;
          display: inline-block;
          line-height: 1.5;
        }
        .footer-nav-link:hover {
          color: #ffffff;
          transform: translateX(2px);
        }

        /* СКЛЯНИЙ ХЕДЕР */
        .main-header {
          position: absolute; top: 0; left: 0; width: 100%; height: 72px; z-index: 1000;
          display: flex; align-items: center; background-color: transparent; border-bottom: 1px solid transparent;
        }
        .main-header.top { transform: translateY(0); }
        .main-header.scrolled {
          position: fixed;
          background-color: rgba(255, 255, 255, 0.82);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
          box-shadow: 0 4px 30px rgba(0, 0, 0, 0.03);
          animation: slideDown 0.4s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
        }
        .main-header.hiding {
          position: fixed;
          background-color: rgba(255, 255, 255, 0.82);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
          box-shadow: 0 4px 30px rgba(0, 0, 0, 0.03);
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
        <div onClick={() => setIsAuthModalOpen(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(17, 24, 39, 0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(12px)' }}>
          <div className="anim" onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#ffffff', width: '100%', maxWidth: '420px', borderRadius: '24px', padding: '2.5rem', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)' }}>
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

      {/* ХЕДЕР */}
      <header className={`main-header ${scrollState}`}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', height: '100%', gap: '1rem' }}>

          <div style={{ width: '180px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: '900', color: isHeaderDark ? '#111827' : '#ffffff', letterSpacing: '-0.04em', transition: 'color 0.3s ease' }}>
                Book<span style={{ color: '#8fae92' }}>Era</span>
              </div>
            </Link>
          </div>

          {/* ПОШУК У ХЕДЕРІ */}
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
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(0, 0, 0, 0.07)',
              borderRadius: '12px',
              padding: '4px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
              width: '100%',
              maxWidth: '650px',
              position: 'relative'
            }}>

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

          {/* ПРОФІЛЬ */}
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

                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={userName || 'Аватарка'}
                      style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <Avatar name={userName} size={36} />
                  )}

                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transform: isProfileOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0 }}>
                    <path d="M1 1L5 5L9 1" stroke={isHeaderDark ? '#64748b' : '#ffffff'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>

                {isProfileOpen && (
                  <div className="search-dropdown anim" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '210px', padding: '0.4rem', zIndex: 1001 }}>
                    <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f1f5f9', marginBottom: '0.25rem' }}>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Акаунт</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111827', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
                    </div>
                    <Link href="/account/profile" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: '8px', color: '#334155', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '550', boxSizing: 'border-box' }} onClick={() => setIsProfileOpen(false)}>Мій профіль</Link>
                    {isBusinessRole(userRole) && (
                      <Link href="/cabinet" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: '8px', color: '#334155', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '550', boxSizing: 'border-box' }} onClick={() => setIsProfileOpen(false)}>Панель салону</Link>
                    )}
                    <Link href="/account/profile?tab=settings" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: '8px', color: '#334155', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '550', boxSizing: 'border-box' }} onClick={() => setIsProfileOpen(false)}>Налаштування</Link>
                    <button onClick={handleLogout} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: '8px', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '550', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', borderTop: '1px solid #f1f5f9', marginTop: '2px', boxSizing: 'border-box' }}>Вийти з акаунту</button>
                  </div>
                )}
              </div>
            ) : (
              <span
                onClick={() => { setIsLoginView(true); setIsAuthModalOpen(true); }}
                className="anim"
                style={{ color: isHeaderDark ? '#111827' : '#ffffff', cursor: 'pointer', transition: 'color 0.2s ease', fontWeight: '600', fontSize: '0.95rem', whiteSpace: 'nowrap' }}
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
      <section style={{ position: 'relative', width: '100%', height: '560px', display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden' }}>
        {/* Фон: три відео поруч замість одного.
            Обличчя, волосся, тіло - за секунду показують, чим тут
            займаються, і роблять це без жодного слова. */}
        <HeroVideoBackdrop />

        <div className="reveal-on-scroll" style={{ position: 'relative', zIndex: 50, maxWidth: '1340px', width: '100%', margin: '0 auto', padding: '4rem 4rem 0 4rem', boxSizing: 'border-box', textAlign: 'center' }}>
          <h1 style={{ fontSize: '3.2rem', fontWeight: '800', color: '#ffffff', maxWidth: '800px', margin: '0 auto 1rem auto', lineHeight: '1.2', letterSpacing: '-0.02em' }}>
            Догляд за собою в один клік
          </h1>
          <p style={{ fontSize: '1.15rem', color: 'rgba(255,255,255,0.92)', maxWidth: '600px', margin: '0 auto 2.5rem auto', lineHeight: '1.5', fontWeight: '500' }}>
            Знаходьте перевірених фахівців поблизу та миттєво бронюйте візити онлайн без зайвих дзвінків.
          </p>

          {/* ПОШУК (HERO) */}
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.6)',
            borderRadius: '14px',
            padding: '4px',
            maxWidth: '700px',
            width: '100%',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            boxSizing: 'border-box',
            boxShadow: '0 20px 48px -10px rgba(0,0,0,0.18)',
            position: 'relative',
            zIndex: 100,
            height: '44px'
          }}>

            <div ref={heroWhatRef} style={{ flex: 1.3, position: 'relative', display: 'flex', alignItems: 'center', padding: '0 0.5rem 0 1rem', height: '100%' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.6rem', flexShrink: 0 }}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.6rem', flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.6rem', flexShrink: 0 }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              <span style={{ color: searchDate || searchTime ? '#222222' : '#64748b', fontSize: '0.95rem', fontWeight: searchDate || searchTime ? '600' : '400', flexGrow: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {getDisplayDateTime()}
              </span>

              {isDateOpen && activeSearch === 'hero' && renderDatePicker()}
            </div>

            <button type="button" onClick={() => void handleSearch()} style={{ width: '36px', height: '36px', borderRadius: '18px', backgroundColor: '#111827', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '8px', marginRight: '4px', flexShrink: 0, transition: '0.2s' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='#334155'} onMouseOut={e=>e.currentTarget.style.backgroundColor='#111827'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </button>

          </div>
        </div>
      </section>


      {/* КАТЕГОРІЇ ПОСЛУГ */}
      <section className="container reveal-on-scroll delay-100" style={{ paddingTop: '2.5rem', paddingBottom: '3rem', position: 'relative', zIndex: 40 }}>
        <div className="hide-scrollbar" style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: '1.5rem', position: 'relative', zIndex: 10 }}>
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

      {/* 🟢 1. СПЕРШУ: ПОБЛИЗУ ВАС ІЗ ВІЛЬНИМИ ВІКНАМИ (КАРУСЕЛЬ З ОДНАКОВИМ РОЗМІРОМ) */}
      {isDefaultView && nearbyBusinesses.length > 0 && (
        <section className="reveal-on-scroll" style={{ paddingBottom: '4.5rem' }}>
          <div className="container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.75rem' }}>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#8fae92', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>
                  Швидкий візит • {searchWhere || 'Львів'}
                </div>
                <h2 style={{ fontSize: '2.2rem', fontWeight: '900', color: '#111827', margin: 0, letterSpacing: '-0.03em' }}>
                  Поблизу вас із вільними вікнами
                </h2>
                <p style={{ color: '#64748b', fontSize: '1rem', marginTop: '0.35rem', marginBottom: 0 }}>
                  Забронюйте час прямо сьогодні без попередніх дзвінків
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button onClick={() => scrollNearby('left')} className="carousel-nav-btn" aria-label="Вліво">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
                <button onClick={() => scrollNearby('right')} className="carousel-nav-btn" aria-label="Вправо">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
              </div>
            </div>

            <div ref={nearbyScrollRef} className="nearby-carousel hide-scrollbar">
              {nearbyBusinesses.map((biz, idx) => {
                const distance = getSalonDistance(biz) || `${250 + idx * 150} м`;
                return (
                  <div key={`nearby-${biz.id}`} className="nearby-carousel-item">
                    {renderCard(biz, {
                      distanceTag: distance,
                      showTimeSlots: true
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 🟢 2. ПОТІМ: ВАМ МОЖЕ СПОДОБАТИСЯ (КОМПАКТНІ ДОБІРКИ У 2 РЯДИ ЗІ ЗМІЩЕННЯМ ТА СКРОЛОМ) */}
      {isDefaultView && (
        <section className="reveal-on-scroll" style={{ padding: '3.5rem 0 4rem 0', backgroundColor: '#fbfbfd', borderTop: '1px solid rgba(0,0,0,0.05)', borderBottom: '1px solid rgba(0,0,0,0.05)', marginBottom: '4.5rem' }}>
          <div className="container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.75rem' }}>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#8fae92', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>
                  Вам може сподобатися
                </div>
                <h2 style={{ fontSize: '2.1rem', fontWeight: '900', color: '#111827', margin: 0, letterSpacing: '-0.03em' }}>
                  Кураторські колекції
                </h2>
              </div>

              {/* Навігація скролу колекцій */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button onClick={() => scrollCollections('left')} className="carousel-nav-btn" aria-label="Вліво">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
                <button onClick={() => scrollCollections('right')} className="carousel-nav-btn" aria-label="Вправо">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
              </div>
            </div>

            {/* КОМПАКТНИЙ СКРОЛ-ТРЕК З ДВОМА ЗМІЩЕНИМИ РЯДАМИ */}
            <div ref={collectionsScrollRef} className="editorial-scroll-wrapper hide-scrollbar">
              <div className="editorial-staggered-track">

                {/* РЯД 1 */}
                <div className="editorial-stream-row">

                  <div onClick={() => handleCategorySelect('barber')} className="compact-editorial-card anim">
                    <img src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80" alt="Барбершопи" className="compact-editorial-bg" />
                    <div className="compact-editorial-overlay"></div>
                    <span className="compact-tag">8 закладів</span>
                    <div className="compact-footer">
                      <h3 className="compact-title">Чоловіча класика & Fades</h3>
                      <div className="compact-chevron"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg></div>
                    </div>
                  </div>

                  <div onClick={() => handleCategorySelect('nails')} className="compact-editorial-card anim">
                    <img src="https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=600&q=80" alt="Манікюр" className="compact-editorial-bg" />
                    <div className="compact-editorial-overlay"></div>
                    <span className="compact-tag">14 студій</span>
                    <div className="compact-footer">
                      <h3 className="compact-title">Естетика манікюру</h3>
                      <div className="compact-chevron"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg></div>
                    </div>
                  </div>

                  <div onClick={() => handleCategorySelect('spa')} className="compact-editorial-card anim">
                    <img src="https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=600&q=80" alt="Spa" className="compact-editorial-bg" />
                    <div className="compact-editorial-overlay"></div>
                    <span className="compact-tag">6 просторів</span>
                    <div className="compact-footer">
                      <h3 className="compact-title">Wellness, спа & релакс</h3>
                      <div className="compact-chevron"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg></div>
                    </div>
                  </div>

                  <div onClick={() => handleCategorySelect('hair')} className="compact-editorial-card anim">
                    <img src="https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80" alt="Волосся" className="compact-editorial-bg" />
                    <div className="compact-editorial-overlay"></div>
                    <span className="compact-tag">12 салонів</span>
                    <div className="compact-footer">
                      <h3 className="compact-title">Стрижки & авторський колір</h3>
                      <div className="compact-chevron"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg></div>
                    </div>
                  </div>

                  <div onClick={() => handleCategorySelect('makeup')} className="compact-editorial-card anim">
                    <img src="https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=600&q=80" alt="Макіяж" className="compact-editorial-bg" />
                    <div className="compact-editorial-overlay"></div>
                    <span className="compact-tag">7 майстрів</span>
                    <div className="compact-footer">
                      <h3 className="compact-title">Вечірній образ & візаж</h3>
                      <div className="compact-chevron"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg></div>
                    </div>
                  </div>

                </div>

                {/* РЯД 2 (ЗМІЩЕНИЙ ВПРАВО НА 55PX) */}
                <div className="editorial-stream-row offset-row">

                  <div onClick={() => handleCategorySelect('skincare')} className="compact-editorial-card anim">
                    <img src="https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=600&q=80" alt="Догляд за шкірою" className="compact-editorial-bg" />
                    <div className="compact-editorial-overlay"></div>
                    <span className="compact-tag">9 центрів</span>
                    <div className="compact-footer">
                      <h3 className="compact-title">Догляд за шкірою & Glow</h3>
                      <div className="compact-chevron"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg></div>
                    </div>
                  </div>

                  <div onClick={() => handleCategorySelect('brows')} className="compact-editorial-card anim">
                    <img src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80" alt="Брови та вії" className="compact-editorial-bg" />
                    <div className="compact-editorial-overlay"></div>
                    <span className="compact-tag">11 студій</span>
                    <div className="compact-footer">
                      <h3 className="compact-title">Ламінування брів & вій</h3>
                      <div className="compact-chevron"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg></div>
                    </div>
                  </div>

                  <div onClick={() => handleCategorySelect('massage')} className="compact-editorial-card anim">
                    <img src="https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=600&q=80" alt="Масаж" className="compact-editorial-bg" />
                    <div className="compact-editorial-overlay"></div>
                    <span className="compact-tag">8 фахівців</span>
                    <div className="compact-footer">
                      <h3 className="compact-title">Масажні техніки & тонус</h3>
                      <div className="compact-chevron"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg></div>
                    </div>
                  </div>

                  <div onClick={() => handleCategorySelect('aesthetic-medicine')} className="compact-editorial-card anim">
                    <img src="https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=600&q=80" alt="Естетика" className="compact-editorial-bg" />
                    <div className="compact-editorial-overlay"></div>
                    <span className="compact-tag">5 клінік</span>
                    <div className="compact-footer">
                      <h3 className="compact-title">Естетична медицина</h3>
                      <div className="compact-chevron"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg></div>
                    </div>
                  </div>

                  <div onClick={() => handleCategorySelect('hair-removal')} className="compact-editorial-card anim">
                    <img src="https://images.unsplash.com/photo-1512290900672-1f5be1c66f54?auto=format&fit=crop&w=600&q=80" alt="Епіляція" className="compact-editorial-bg" />
                    <div className="compact-editorial-overlay"></div>
                    <span className="compact-tag">6 студій</span>
                    <div className="compact-footer">
                      <h3 className="compact-title">Лазерна епіляція</h3>
                      <div className="compact-chevron"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg></div>
                    </div>
                  </div>

                </div>

              </div>
            </div>
          </div>
        </section>
      )}

      {/* 🟢 3. І ПОТІМ: РЕКОМЕНДОВАНІ МАЙСТРИ ТА СТУДІЇ (КАТАЛОГ) */}
      <section className="reveal-on-scroll" style={{ paddingBottom: '5rem' }} id="salons-section">
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.25rem', position: 'relative', zIndex: 50 }}>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#8fae92', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>
                Топ вибір користувачів
              </div>
              <h2 style={{ fontSize: '2.4rem', fontWeight: '900', color: '#111827', margin: 0, letterSpacing: '-0.04em' }}>
                {getSectionTitle()}
              </h2>
              <p style={{ color: '#64748b', fontSize: '1.05rem', marginTop: '0.4rem', marginBottom: 0 }}>
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

              {filteredBusinesses.length > 8 && (
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
              <h3 style={{ color: '#111827', fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>Закладів не знайдено</h3>
              <p style={{ color: '#64748b', fontSize: '1.05rem', maxWidth: '480px', margin: '0 auto', lineHeight: '1.5' }}>Спробуйте обрати інше місто або скинути фільтри.</p>
              <button
                onClick={() => { handleCategorySelect('all'); setAppliedSearch(''); setSearchWhat(''); }}
                style={{ marginTop: '2rem', padding: '0.85rem 2rem', backgroundColor: '#222222', color: '#fff', border: 'none', borderRadius: '99px', cursor: 'pointer', fontWeight: '700', fontSize: '1rem', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              >
                Скинути фільтри
              </button>
            </div>
          ) : (
            <div className="salons-layout anim">
              {displayedBusinesses.map((biz: any) => renderCard(biz))}
            </div>
          )}
        </div>
      </section>

      {/* ІНФОРМАЦІЙНА СІТКА */}
      <section className="info-section">
        <div className="container">
          <div className="compact-features-grid">
            <div className="reveal-on-scroll">
              <div style={{ width: '52px', height: '52px', borderRadius: '16px', backgroundColor: '#f0fdf4', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
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
                BookEra — це сервіс миттєвого бронювання, де можна легко й швидко знаходити вільні дати та записуватися. Більше жодних телефонних дзвінків.
              </p>
            </div>
            <div className="reveal-on-scroll delay-100">
              <div style={{ width: '52px', height: '52px', borderRadius: '16px', backgroundColor: '#eff6ff', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
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
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
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
                Дізнайтеся більше про них — переглядайте профілі, читайте реальні відгуки інших клієнтів та ознайомлюйтеся з їхніми роботами перед тим, як записатись.
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
                <div style={{ width: '40px', height: '40px', background: '#C2D8C4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', color: '#222', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
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
      <section className="reveal-on-scroll" style={{ padding: '5rem 0', backgroundColor: '#111827', borderTop: '1px solid rgba(255, 255, 255, 0.08)', position: 'relative', zIndex: 20 }}>
        <div className="container">
          <h2 style={{ fontSize: '2rem', fontWeight: '800', color: '#ffffff', textAlign: 'center', marginBottom: '3rem', letterSpacing: '-0.02em' }}>
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

      {/* ЧОРНИЙ ФУТЕР ІЗ КОТИКОМ */}
      <footer className="clean-dark-footer" style={{ marginTop: 'auto', position: 'relative', overflow: 'hidden' }}>
        <div className="container">

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: '3rem', marginBottom: '3.5rem' }}>
            <div>
              <Link href="/" style={{ textDecoration: 'none', display: 'inline-block', marginBottom: '1rem' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#ffffff', letterSpacing: '-0.04em' }}>
                  Book<span style={{ color: '#8fae92' }}>Era</span>
                </div>
              </Link>
              <p style={{ color: '#94A3B8', fontSize: '0.88rem', lineHeight: '1.6', margin: '0 0 1.25rem 0', maxWidth: '300px' }}>
                Простий та надійний онлайн-запис до перевірених майстрів і салонів краси у вашому місті.
              </p>
            </div>

            <div>
              <div className="footer-col-title">Можливості</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <Link href="/" className="footer-nav-link">Онлайн-запис</Link>
                <Link href="/" className="footer-nav-link">Пошук закладів</Link>
                <Link href="/" className="footer-nav-link">Подарункові сертифікати</Link>
                <Link href="/account/profile" className="footer-nav-link">Особистий кабінет</Link>
              </div>
            </div>

            <div>
              <div className="footer-col-title">Для бізнесу</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <Link href="/business" className="footer-nav-link" style={{ color: '#C2D8C4', fontWeight: 600 }}>BookEra Business</Link>
                <Link href="/business/register" className="footer-nav-link">Підключити салон</Link>
                <Link href="/cabinet" className="footer-nav-link">Панель керування CRM</Link>
                <Link href="/business#pricing" className="footer-nav-link">Тарифи</Link>
              </div>
            </div>

            <div>
              <div className="footer-col-title">Підтримка</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <Link href="#" className="footer-nav-link">Служба турботи</Link>
                <Link href="/#faq" className="footer-nav-link">Поширені запитання</Link>
                <Link href="#" className="footer-nav-link">Безпека клієнтів</Link>
                <Link href="#" className="footer-nav-link">Контакти команди</Link>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                <Link href="#" style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', textDecoration: 'none', letterSpacing: '0.04em' }}>ПОЛІТИКА КОНФІДЕНЦІЙНОСТІ</Link>
                <Link href="#" style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', textDecoration: 'none', letterSpacing: '0.04em' }}>УМОВИ ВИКОРИСТАННЯ</Link>
                <Link href="#" style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', textDecoration: 'none', letterSpacing: '0.04em' }}>БЕЗПЕКА</Link>
              </div>

              <div style={{ color: '#64748B', fontSize: '0.78rem' }}>
                © 2026 BookEra. Платформа онлайн-запису до закладів краси в Україні.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', color: '#64748B', fontSize: '0.82rem', fontWeight: 500 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                SSL Захист
              </span>
              <span>•</span>
              <span>Україна • UA</span>
            </div>
          </div>

        </div>

        {/* ВЕСЕЛИЙ КОТИК В НИЗУ ФУТЕРА */}
        <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none', userSelect: 'none', zIndex: 12, lineHeight: 0 }}>
          <svg width="84" height="42" viewBox="0 0 100 50" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
            <path d="M20 50 C20 22, 80 22, 80 50 Z" fill="#1C1D22" stroke="#2D2F36" strokeWidth="1.5" />
            <polygon points="26,30 20,8 38,22" fill="#1C1D22" stroke="#2D2F36" strokeWidth="1.5" />
            <polygon points="27,27 23,13 35,21" fill="#FFB4C2" />
            <polygon points="74,30 80,8 62,22" fill="#1C1D22" stroke="#2D2F36" strokeWidth="1.5" />
            <polygon points="73,27 77,13 65,21" fill="#FFB4C2" />
            <ellipse cx="40" cy="34" rx="3.5" ry="4.5" fill="#C2D8C4" />
            <circle cx="41" cy="33" r="1.5" fill="#111" />
            <ellipse cx="60" cy="34" rx="3.5" ry="4.5" fill="#C2D8C4" />
            <circle cx="61" cy="33" r="1.5" fill="#111" />
            <polygon points="50,38 47,35 53,35" fill="#FFB4C2" />
            <line x1="33" y1="36" x2="18" y2="34" stroke="#64748B" strokeWidth="1" strokeLinecap="round" />
            <line x1="33" y1="38" x2="19" y2="39" stroke="#64748B" strokeWidth="1" strokeLinecap="round" />
            <line x1="67" y1="36" x2="82" y2="34" stroke="#64748B" strokeWidth="1" strokeLinecap="round" />
            <line x1="67" y1="38" x2="81" y2="39" stroke="#64748B" strokeWidth="1" strokeLinecap="round" />
            <ellipse cx="28" cy="48" rx="6" ry="4" fill="#2D2F36" stroke="#111" strokeWidth="1" />
            <ellipse cx="72" cy="48" rx="6" ry="4" fill="#2D2F36" stroke="#111" strokeWidth="1" />
          </svg>
        </div>
      </footer>
    </div>
  );
}