'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Icons } from '@/components/shared';
import { api, SlotStatusItem } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import { isBusinessRole } from '@/lib/roles';
import { ALL_AMENITIES } from '@/lib/amenities';
import Avatar from '@/components/ui/Avatar';
import { getAuthToken, getAuthTokenOrNull } from '@/lib/auth-token-client';

// === 1. КОНСТАНТИ ТА ХЕЛПЕРИ ===
const SERVICES_PER_PAGE = 5;
const REVIEWS_PER_PAGE = 5;
const REVIEW_MAX_LENGTH = 500;

const sortOptionsList = [
  { value: 'default', label: 'За замовчуванням' },
  { value: 'price_asc', label: 'Найдешевші' },
  { value: 'price_desc', label: 'Найдорожчі' },
  { value: 'duration', label: 'Швидкі послуги' }
];

const fmtDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Точна перевірка вихідного дня (Python-індекси 0=Пн..6=Нд та JS 0=Нд..6=Сб)
/**
 * Чи заклад не працює цього дня.
 *
 * Джерело - working_hours, та сама таблиця business_hours, з якою
 * працює CRM. Раніше тут читалось поле days_off: заклад міняв графік
 * у кабінеті, а сторінка салону про це не знала й показувала суботу
 * закритою.
 *
 * Якщо графік ще не заповнений - вважаємо, що заклад працює. Порожній
 * графік означає «не налаштовано», а не «зачинено назавжди»: новий
 * заклад не має виглядати закритим одразу після реєстрації.
 */
const isSalonDayOff = (date: Date, salonObj: any): boolean => {
  const hours = salonObj?.working_hours;
  if (!Array.isArray(hours) || hours.length === 0) return false;

  // weekday у базі: 0 = понеділок ... 6 = неділя.
  // getDay(): 0 = неділя ... 6 = субота.
  const weekday = (date.getDay() + 6) % 7;
  const day = hours.find((h: any) => Number(h.weekday) === weekday);
  if (!day) return false;
  return !day.is_open;
};

const getFirstAvailableWorkingDate = (salonObj: any) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 45; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (!isSalonDayOff(d, salonObj)) {
      return fmtDate(d);
    }
  }
  return fmtDate(today);
};

const formatReviewDateTime = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const date = d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    return `${date} о ${time}`;
  } catch {
    return dateStr;
  }
};

const getReviewAuthorName = (r: any) => {
  return (
    r.author_name ||
    r.client_name ||
    r.author ||
    r.user_name ||
    r.profiles?.full_name ||
    r.profile?.full_name ||
    r.user?.full_name ||
    'Клієнт'
  );
};

const timeToMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const getStaffName = (t: any): string => {
  if (!t) return 'Майстер';
  if (t.full_name && typeof t.full_name === 'string' && t.full_name.trim()) {
    return t.full_name.trim();
  }
  if (t.name && typeof t.name === 'string' && t.name.trim()) {
    return t.name.trim();
  }
  const combined = `${t.first_name || ''} ${t.last_name || ''}`.trim();
  if (combined) return combined;

  const profile = t.profiles || t.profile || t.user;
  if (profile) {
    if (profile.full_name?.trim()) return profile.full_name.trim();
    if (profile.name?.trim()) return profile.name.trim();
    const profCombined = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    if (profCombined) return profCombined;
    if (profile.user_metadata?.full_name?.trim()) return profile.user_metadata.full_name.trim();
    if (profile.email) return profile.email.split('@')[0];
  }
  if (t.email && typeof t.email === 'string') return t.email.split('@')[0];
  return 'Майстер';
};

// Список усіх доступних зручностей із лапкою для тварин

export default function SalonClient({
  initialSalon,
  initialServices,
  initialTeam,
  initialReviews
}: {
  initialSalon: any;
  initialServices: any[];
  initialTeam: any[];
  initialReviews: any[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();

  const [, setMounted] = useState(false);

  // --- Серверні дані ---
  const [salon] = useState<any>(initialSalon);
  const [services] = useState<any[]>(initialServices || []);
  const [team] = useState<any[]>(initialTeam || []);
  const [reviews, setReviews] = useState<any[]>(initialReviews || []);
  const [, setBookedAppointments] = useState<any[]>([]);

  // --- Стейт юзера ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [initials, setInitials] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('client');
  const [userId, setUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // --- Стейт авторизації (Модалка) ---
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLoginView, setIsLoginView] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');

  // --- Стейт для хедера (Пошук) ---
  const [headerSearchWhat, setHeaderSearchWhat] = useState('');
  const [headerSearchWhere, setHeaderSearchWhere] = useState('Львів');
  const [headerSearchDate, setHeaderSearchDate] = useState('');
  const [searchTime, setSearchTime] = useState('');
  const [isDateOpen, setIsDateOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const headerDateRef = useRef<HTMLDivElement>(null);

  // --- Інтерфейс сторінки ---
  const [isFavorite, setIsFavorite] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('default');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const [visibleServicesCount, setVisibleServicesCount] = useState(SERVICES_PER_PAGE);

  // --- Відгуки та відповіді ---
  const [reviewFilter, setReviewFilter] = useState('all');
  const [currentReviewPage, setCurrentReviewPage] = useState(1);
  const [reviewRating, setReviewRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const [replyingToReviewId, setReplyingToReviewId] = useState<number | string | null>(null);
  const [replyText, setReplyText] = useState<string>('');
  const [isSubmittingReply, setIsSubmittingReply] = useState<boolean>(false);

  // --- БРОНЮВАННЯ (ПОКРОКОВА МОДАЛКА) ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [modalServiceSearch, setModalServiceSearch] = useState('');
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedMasterId, setSelectedMasterId] = useState<number | string>(0);
  const [bookingCalendarMonth, setBookingCalendarMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedAddonIds, setSelectedAddonIds] = useState<number[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'on_site' | 'online'>('on_site');
  const [certCode, setCertCode] = useState('');
  const [certState, setCertState] = useState<{ valid: boolean; amount: number; message: string } | null>(null);
  const [isCheckingCert, setIsCheckingCert] = useState(false);
  const [pendingBookingId, setPendingBookingId] = useState<number | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(600);

  const [slotItems, setSlotItems] = useState<SlotStatusItem[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  const activeAmenities = useMemo(() => {
    const rawList = salon?.layout_config?.amenities ?? salon?.amenities;
    const list = Array.isArray(rawList)
      ? rawList
      : ['parking', 'card_payment', 'wifi', 'accessibility', 'coffee_tea'];
    return ALL_AMENITIES.filter(a => list.includes(a.id));
  }, [salon?.layout_config, salon?.amenities]);

  const totalCalculatedPrice = useMemo(() => {
    const base = Number(selectedService?.price || 0);
    const addons = (selectedService?.addons || [])
      .filter((a: any) => selectedAddonIds.includes(a.id))
      .reduce((sum: number, a: any) => sum + Number(a.price || 0), 0);
    const discount = certState?.valid ? Math.min(certState.amount, base + addons) : 0;
    return Math.max(0, base + addons - discount);
  }, [selectedService, selectedAddonIds, certState]);

  const totalCalculatedDuration = useMemo(() => {
    const base = Number(selectedService?.duration_minutes || selectedService?.duration || 60);
    const addons = (selectedService?.addons || [])
      .filter((a: any) => selectedAddonIds.includes(a.id))
      .reduce((sum: number, a: any) => sum + Number(a.duration_minutes || 0), 0);
    return base + addons;
  }, [selectedService, selectedAddonIds]);

  useEffect(() => {
    setMounted(true);
    const storedName = localStorage.getItem('userName');
    const storedRole = localStorage.getItem('userRole') || 'client';
    const storedId = localStorage.getItem('userId');
    const storedAvatar = localStorage.getItem('userAvatar');

    if (storedAvatar) setAvatarUrl(storedAvatar);

    if (storedName) {
      setIsLoggedIn(true);
      const displayName = storedName.includes('@') ? 'Користувач' : storedName;
      setUserName(displayName);
      setUserRole(storedRole);
      setUserId(storedId);
      const nameParts = displayName.split(' ');
      const init = nameParts.length > 1 ? nameParts[0][0] + nameParts[1][0] : nameParts[0][0];
      setInitials(init.toUpperCase());
    }
  }, []);

  useEffect(() => {
    if (!salon?.id) return;
    try {
      const storageKey = `salon_review_replies_${salon.id}`;
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      if (Object.keys(saved).length > 0) {
        setReviews((prev) =>
          prev.map((r) => {
            if (saved[r.id]) {
              return {
                ...r,
                reply: r.reply || saved[r.id].text,
                reply_author: r.reply_author || saved[r.id].author,
                reply_created_at: r.reply_created_at || saved[r.id].created_at,
              };
            }
            return r;
          })
        );
      }
    } catch (e) {
      console.warn(e);
    }
  }, [salon?.id]);

  const fetchAvailableSlots = useCallback(async () => {
    if (!salon?.id || !selectedService?.id || !selectedDate) return;
    setIsLoadingSlots(true);
    try {
      const data = await api.getAvailableSlots({
        business_id: salon.id,
        service_id: selectedService.id,
        target_date: selectedDate,
        master_id: selectedMasterId ? String(selectedMasterId) : '0',
        duration_minutes: totalCalculatedDuration,
      });
      setSlotItems(data.slots || []);
    } catch {
      setSlotItems([]);
    } finally {
      setIsLoadingSlots(false);
    }
  }, [salon?.id, selectedService?.id, selectedDate, selectedMasterId, totalCalculatedDuration]);

  useEffect(() => {
    if (isModalOpen && selectedDate && selectedService && currentStep === 3) {
      void fetchAvailableSlots();
    }
  }, [isModalOpen, selectedDate, selectedService, selectedMasterId, currentStep, fetchAvailableSlots]);

  useEffect(() => {
    // «Повторити візит» із профілю: ?service=12&master=abc
    //
    // Відкриваємо вікно бронювання з уже обраною послугою й майстром.
    // Людина хоче «так само, як минулого разу» - змушувати її шукати
    // ту саму послугу в списку означає повторювати роботу, яку вона
    // вже зробила.
    const repeatServiceId = searchParams.get('service');
    if (repeatServiceId && services?.length) {
      const service = services.find((s: any) => String(s.id) === repeatServiceId);
      if (service) {
        const master = searchParams.get('master');
        if (master) setSelectedMasterId(master);
        openModal(service);
      }
    }

    const dl = searchParams.get('dl');
    if (dl) localStorage.setItem('direct_link_token', dl);
    // services у залежностях: на першому рендері список ще порожній,
    // і без цього «повторити візит» мовчки нічого не відкривало б.
  }, [searchParams, services]);

  // Таймер бронювання
  useEffect(() => {
    if (currentStep !== 4 || bookingSuccess) return;

    setTimeLeft(600);
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [currentStep, bookingSuccess]);

  useEffect(() => {
    if (currentStep === 4 && !bookingSuccess && timeLeft === 0) {
      showToast('Час на підтвердження вичерпано. Слот розблоковано.', 'error');
      void closeModal();
    }
  }, [timeLeft, currentStep, bookingSuccess, showToast]);

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  /**
   * Найближче вільне вікно послуги.
   *
   * Раніше цей текст був ВИГАДАНИЙ: брався поточний час, округлювався
   * до 15 хвилин, і виходило «Сьогодні о 13:15» - незалежно від того,
   * чи вільний цей час насправді. Години 10:00 і 20:00 були
   * захардкоджені й не мали стосунку до графіка закладу.
   *
   * Тепер питаємо сервер. Поки відповідь не прийшла - не пишемо нічого:
   * «Сьогодні о 13:15», яке через секунду міняється на «Завтра»,
   * виглядає як поломка.
   */
  const [nearestSlots, setNearestSlots] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!salon?.id || !services?.length) return;
    let cancelled = false;

    void (async () => {
      const found: Record<number, string> = {};

      for (const service of services.slice(0, 12)) {
        // Шукаємо на 14 днів уперед: далі вже не «найближче»,
        // і 14 запитів на послугу - забагато.
        for (let offset = 0; offset < 14; offset++) {
          const day = new Date();
          day.setDate(day.getDate() + offset);
          // Локальна дата, а не ISO: у ISO вечірні дати зсуваються
          // на наступний день через UTC.
          const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;

          try {
            const data = await api.getAvailableSlots({
              business_id: salon.id,
              service_id: service.id,
              target_date: dateStr,
              master_id: '0',
            });
            const free = (data.slots || []).find((s: any) => s.status === 'available');
            if (free) {
              const label = offset === 0 ? 'Сьогодні' : offset === 1 ? 'Завтра'
                : day.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
              found[service.id] = `${label} о ${free.time}`;
              break;
            }
          } catch {
            break;
          }
        }
      }

      if (!cancelled) setNearestSlots(found);
    })();

    return () => { cancelled = true; };
  }, [salon?.id, services]);

  const getServiceAvailabilityText = useCallback(
    (service: any) => nearestSlots[service.id] || '',
    [nearestSlots]
  );


  const galleryPhotos = useMemo(() => {
    if (!salon) return [];
    const photos = [];
    if (salon.cover_photo) photos.push(salon.cover_photo);
    if (salon.workplace_photos && Array.isArray(salon.workplace_photos)) photos.push(...salon.workplace_photos);
    return Array.from(new Set(photos));
  }, [salon]);

  useEffect(() => {
    if (currentImageIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCurrentImageIndex(null);
      } else if (e.key === 'ArrowLeft') {
        setCurrentImageIndex((prev) => (prev === 0 ? galleryPhotos.length - 1 : (prev ?? 0) - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrentImageIndex((prev) => (prev === galleryPhotos.length - 1 ? 0 : (prev ?? 0) + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentImageIndex, galleryPhotos.length]);

  useEffect(() => {
    setVisibleServicesCount(SERVICES_PER_PAGE);
  }, [searchQuery, sortOrder]);

  useEffect(() => {
    // Раніше і перевірка, і збереження йшли НАПРЯМУ в таблицю favorites
    // через Supabase. Але в моделях цієї таблиці не існувало - запис
    // мовчки не проходив, і заклад ніколи не зʼявлявся в профілі.
    async function checkFavorite() {
      if (!salon?.id) return;
      try {
        const token = await getAuthTokenOrNull();
        if (!token) return;
        const favorites = await api.listMyFavorites(token);
        setIsFavorite(favorites.some((b: any) => String(b.id) === String(salon.id)));
      } catch {
        // Не критично: кнопка просто лишиться в стані «не збережено».
      }
    }
    void checkFavorite();
  }, [salon?.id]);

  const handleToggleFavorite = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!salon?.id) return;

    const nextState = !isFavorite;
    setIsFavorite(nextState);

    try {
      const token = await getAuthToken();
      if (nextState) {
        await api.addFavorite(token, salon.id);
        showToast('Заклад додано до улюблених', 'success');
      } else {
        await api.removeFavorite(token, salon.id);
        showToast('Заклад видалено з улюблених', 'info');
      }
    } catch {
      setIsFavorite(!nextState);
      showToast('Не вдалося оновити улюблені', 'error');
    }
  };

  const fetchBookings = useCallback(async (bizId: number) => {
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .eq('business_id', bizId)
      .neq('status', 'cancelled');
    if (data) setBookedAppointments(data);
  }, [supabase]);

  useEffect(() => {
    if (!salon?.id) return;
    const channel = supabase
      .channel(`room_${salon.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        void fetchBookings(salon.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [salon?.id, fetchBookings, supabase]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileRef.current && !profileRef.current.contains(target)) setIsProfileOpen(false);
      if (sortRef.current && !sortRef.current.contains(target)) setIsSortOpen(false);
      if (headerDateRef.current && !headerDateRef.current.contains(target)) setIsDateOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleHeaderSearch = () => {
    const params = new URLSearchParams();
    if (headerSearchWhat) params.append('what', headerSearchWhat);
    if (headerSearchWhere) params.append('where', headerSearchWhere);
    if (headerSearchDate) params.append('date', headerSearchDate);
    if (searchTime) params.append('time', searchTime);
    router.push(`/?${params.toString()}`);
  };

const formatRole = (role?: string) => {
    if (!role) return 'Спеціаліст';
    if (role === 'business_owner' || role === 'owner' || role === 'vendor') return 'Власник';
    if (role === 'admin') return 'Адміністратор';
    if (role === 'master') return 'Спеціаліст';
    return role;
  };

  // Сортуємо команду згідно з налаштованим у CRM порядком
  const activeTeam = useMemo(() => {
    // Прихованих з вітрини не показуємо.
    //
    // show_in_storefront ховає людину ЛИШЕ звідси - вибір майстра при
    // бронюванні бере повний список. Майстер може приймати записи,
    // але не хотіти своє фото на сайті.
    //
    // Порівнюємо з false: у тих, кого не чіпали, поля немає, і вони
    // мають лишатись видимими.
    const visible = (team || []).filter((m: any) => m.show_in_storefront !== false);
    const order = salon?.layout_config?.team_order;
    if (Array.isArray(order) && order.length > 0) {
      const copy = [...visible];
      return copy.sort((a, b) => {
        const idxA = order.indexOf(String(a.id));
        const idxB = order.indexOf(String(b.id));
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });
    }
    return visible;
  }, [team, salon?.layout_config?.team_order]);

  /**
   * Список майстрів для ВИБОРУ ПРИ БРОНЮВАННІ.
   *
   * Будується з ПОВНОГО складу (team), а не з activeTeam: майстер,
   * прихований із блоку «Наша команда», має далі приймати записи -
   * інакше перемикач «не показувати на сайті» позбавляв би людину
   * роботи, а йшлося про протилежне.
   */
  const staffers = useMemo(() => {
    const list: any[] = [{ id: 0, name: "Будь-який майстер", role: "Найближчий вільний час", photo: null }];
    (team || []).forEach((t: any) => {
      list.push({
        id: t.id,
        name: getStaffName(t),
        role: t.specialization || t.title || formatRole(t.role),
        photo: t.avatar_url || t.photo || t.profiles?.avatar_url || t.profile?.avatar_url || null,
        assigned_services: t.assigned_services,
        provides_services: t.provides_services,
      });
    });
    return list;
  }, [team]);

  /**
   * Склад для блоку «Наша команда».
   *
   * Той самий формат, що й staffers, але БЕЗ прихованих і без
   * службового пункту «Будь-який майстер». Два списки потрібні саме
   * тому, що вони відповідають на різні питання: «до кого можна
   * записатись» і «кого показувати на сайті».
   */
  const storefrontTeam = useMemo(() => {
    return activeTeam.map((t: any) => ({
      id: t.id,
      name: getStaffName(t),
      role: t.specialization || t.title || formatRole(t.role),
      photo: t.avatar_url || t.photo || t.profiles?.avatar_url || t.profile?.avatar_url || null,
    }));
  }, [activeTeam]);

  // Фільтруємо список майстрів під обрану послугу
  const availableStaffersForService = useMemo(() => {
    if (!selectedService) return staffers;
    const matchingMasters = staffers.filter((staff) => {
      if (staff.id === 0) return false;
      if (staff.provides_services === false) return false;
      if (Array.isArray(staff.assigned_services)) {
        return staff.assigned_services.map(String).includes(String(selectedService.id));
      }
      return true;
    });

    if (matchingMasters.length === 0) return [];
    return [staffers[0], ...matchingMasters];
  }, [staffers, selectedService]);

  useEffect(() => {
    if (selectedMasterId !== 0) {
      const isStillAvailable = availableStaffersForService.some(s => String(s.id) === String(selectedMasterId));
      if (!isStillAvailable) {
        setSelectedMasterId(0);
      }
    }
  }, [availableStaffersForService, selectedMasterId]);

  const processedServices = useMemo(() => {
    let result = [...services];
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(lowerQuery));
    }
    if (sortOrder === 'price_asc') result.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    else if (sortOrder === 'price_desc') result.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    else if (sortOrder === 'duration') result.sort((a, b) => (a.duration_minutes || 0) - (b.duration_minutes || 0));
    return result;
  }, [services, searchQuery, sortOrder]);

  const modalFilteredServices = useMemo(() => {
    if (!modalServiceSearch.trim()) return services;
    const q = modalServiceSearch.toLowerCase();
    return services.filter((s) => s.name.toLowerCase().includes(q));
  }, [services, modalServiceSearch]);

  const displayedServices = useMemo(() => {
    return processedServices.slice(0, visibleServicesCount);
  }, [processedServices, visibleServicesCount]);

  // Фільтрація відгуків
  const filteredReviews = useMemo(() => {
    let filtered = [...reviews];
    if (reviewFilter === 'positive') filtered = filtered.filter((r) => (Number(r.rating) || 5) >= 4);
    if (reviewFilter === 'negative') filtered = filtered.filter((r) => (Number(r.rating) || 5) <= 3);
    return filtered;
  }, [reviews, reviewFilter]);

  // СУВОРЕ ОБМЕЖЕННЯ: НЕ БІЛЬШЕ 5 ВІДГУКІВ НА СТОРІНКУ
  const paginatedReviews = useMemo(() => {
    const start = (currentReviewPage - 1) * REVIEWS_PER_PAGE;
    return filteredReviews.slice(start, start + REVIEWS_PER_PAGE);
  }, [filteredReviews, currentReviewPage]);

  const totalReviewPages = Math.ceil(filteredReviews.length / REVIEWS_PER_PAGE);

  const handleModalAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLoginView) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password: loginPassword,
        });

        if (error) {
          showToast(`Помилка входу: ${error.message}`, 'error');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role, avatar_url')
          .eq('id', data.user.id)
          .single();

        const metadataName = data.user?.user_metadata?.full_name || data.user?.user_metadata?.name;
        let finalName = profile?.full_name || metadataName || 'Гість';

        if (finalName.includes('@')) finalName = 'Користувач';
        const finalRole = profile?.role || 'client';

        localStorage.setItem('userName', finalName);
        localStorage.setItem('userRole', finalRole);
        localStorage.setItem('userId', data.user.id);
        if (profile?.avatar_url) localStorage.setItem('userAvatar', profile.avatar_url);

        setUserName(finalName);
        setUserRole(finalRole);
        setUserId(data.user.id);
        if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
        const nameParts = finalName.split(' ');
        const init = nameParts.length > 1 ? nameParts[0][0] + nameParts[1][0] : nameParts[0][0];
        setInitials(init.toUpperCase());

        setIsLoggedIn(true);
        setIsAuthModalOpen(false);
        showToast(`З поверненням, ${finalName}!`, 'success');

        if (finalRole === 'vendor') router.push('/cabinet');
      } else {
        const targetEmail = loginEmail.trim().toLowerCase();
        const targetFullName = `${regFirstName} ${regLastName}`.trim();

        const { data, error } = await supabase.auth.signUp({
          email: targetEmail,
          password: loginPassword,
          options: { data: { full_name: targetFullName } }
        });

        if (error) {
          showToast(`Помилка реєстрації: ${error.message}`, 'error');
          return;
        }

        localStorage.setItem('userName', targetFullName);
        localStorage.setItem('userRole', 'client');
        if (data?.session?.user) {
          localStorage.setItem('userId', data.session.user.id);
          setUserId(data.session.user.id);
        }

        setUserName(targetFullName);
        setUserRole('client');
        setInitials((regFirstName[0] + (regLastName[0] || '')).toUpperCase());

        setIsLoggedIn(true);
        setIsAuthModalOpen(false);
        showToast('Акаунт успішно зареєстровано!', 'success');
      }
    } catch {
      showToast("Помилка зв'язку із сервером", 'error');
    }
  };

  const openModal = (service?: any) => {
    const firstWorkingDate = getFirstAvailableWorkingDate(salon);

    setSelectedService(service || services[0] || null);
    setSelectedAddonIds([]);
    setPaymentMethod('on_site');
    setCertCode('');
    setCertState(null);
    setSelectedTime(null);
    setSelectedDate(firstWorkingDate);
    setBookingCalendarMonth(new Date(firstWorkingDate));
    setPendingBookingId(null);
    setBookingSuccess(false);

    setCurrentStep(1);
    setIsModalOpen(true);
  };

  const closeModal = async () => {
    setIsModalOpen(false);
    if (pendingBookingId && !bookingSuccess) {
      try {
        await api.unlockTimeSlot({
          business_id: salon.id,
          service_id: selectedService?.id,
          start_time: `${selectedDate}T${selectedTime}:00`,
          session_token: userId || undefined
        });
      } catch (e) {
        console.warn(e);
      }
    }
    setTimeout(() => {
      setCurrentStep(1);
      setBookingSuccess(false);
      setPendingBookingId(null);
    }, 280);
  };

  const handleProceedToConfirmation = async () => {
    if (availableStaffersForService.length === 0) {
      showToast("Для цієї послуги немає доступних спеціалістів", 'error');
      return;
    }
    if (!selectedTime) {
      showToast("Будь ласка, оберіть час запису", 'info');
      return;
    }
    if (!isLoggedIn) {
      setIsAuthModalOpen(true);
      return;
    }

    const directLinkToken = localStorage.getItem('direct_link_token') || undefined;

    try {
      const lockRes = await api.lockTimeSlot({
        business_id: salon.id,
        service_id: selectedService.id,
        start_time: `${selectedDate}T${selectedTime}:00`,
        master_id: selectedMasterId ? String(selectedMasterId) : "0",
        session_token: userId || undefined,
        direct_link_token: directLinkToken,
        duration_minutes: totalCalculatedDuration,
        addon_service_ids: selectedAddonIds.length > 0 ? selectedAddonIds : undefined,
      } as any);

      setPendingBookingId(lockRes.booking_id);
      setCurrentStep(4);
      void fetchBookings(salon.id);
    } catch (err: any) {
      showToast(err.message || "Цей час щойно зайняли. Будь ласка, оберіть інший слот.", 'error');
      void fetchBookings(salon.id);
    }
  };

  const handleStepBackFromConfirmation = async () => {
    if (pendingBookingId) {
      try {
        await api.unlockTimeSlot({
          business_id: salon.id,
          service_id: selectedService?.id,
          start_time: `${selectedDate}T${selectedTime}:00`,
          session_token: userId || undefined
        });
      } catch (e) {
        console.warn(e);
      }
      setPendingBookingId(null);
    }
    setCurrentStep(3);
  };

  const handleConfirmBooking = async () => {
    try {
      const directLinkToken = localStorage.getItem('direct_link_token') || undefined;
      const safePhone = localStorage.getItem('userPhone') || '';
      const clientDisplayName = userName || 'Гість';
      const { data: { user } } = await supabase.auth.getUser();
      const clientUserEmail = user?.email || loginEmail || '';

      await api.createAppointment({
        gift_certificate_code: certState?.valid ? certCode.trim() : undefined,
        business_id: salon.id,
        service_id: selectedService.id,
        start_time: `${selectedDate}T${selectedTime}:00`,
        master_id: String(selectedMasterId || "0"),
        session_token: user?.id || userId || undefined,
        client_name: clientDisplayName,
        client_phone: safePhone,
        client_email: clientUserEmail,
        direct_link_token: directLinkToken,
        // Додаткові послуги. Без них клієнт обирав послуг на 800 ₴,
        // а заклад бачив у календарі 500 ₴ і 45 хвилин замість 75 -
        // майстер не знав, що робити, і не встигав.
        addon_service_ids: selectedAddonIds.length > 0 ? selectedAddonIds : undefined,
      });

      setBookingSuccess(true);
      void fetchBookings(salon.id);
      showToast('Запис успішно підтверджено!', 'success');
      setTimeout(() => void closeModal(), 2200);
    } catch (e: any) {
      showToast(e.message || "Помилка підтвердження бронювання.", 'error');
    }
  };

  // Відправка відгуку (без TS-помилок)
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) {
      setIsAuthModalOpen(true);
      return;
    }
    if (reviewRating === 0) {
      showToast("Будь ласка, оберіть кількість зірок.", 'info');
      return;
    }

    setIsSubmittingReview(true);
    try {
      const authorName = userName || 'Гість';
      const created = await api.createReview({
        business_id: salon.id,
        author_name: authorName,
        rating: reviewRating,
        comment: reviewText,
      });

      const newReviewItem = {
        ...created,
        id: created?.id || Date.now(),
        author_name: created?.author_name || (created as any)?.client_name || authorName,
        rating: created?.rating || reviewRating,
        comment: created?.comment || reviewText,
        created_at: created?.created_at || new Date().toISOString(),
      };

      setReviews([newReviewItem, ...reviews]);
      setReviewRating(0);
      setHoverRating(0);
      setReviewText('');
      showToast('Дякуємо за ваш відгук!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Не вдалося відправити відгук.', 'error');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleReplySubmit = async (reviewId: number | string) => {
    if (!replyText.trim()) return;
    if (!isLoggedIn) {
      setIsAuthModalOpen(true);
      return;
    }

    setIsSubmittingReply(true);
    const replyAuthorName = isBusinessRole(userRole)
      ? salon?.name || userName || 'Адміністратор'
      : userName || 'Користувач';
    const nowIso = new Date().toISOString();

    const replyData = {
      text: replyText.trim(),
      author: replyAuthorName,
      created_at: nowIso,
    };

    setReviews((prev) =>
      prev.map((r) => {
        if (r.id === reviewId) {
          return {
            ...r,
            reply: replyData.text,
            reply_author: replyData.author,
            reply_created_at: replyData.created_at,
          };
        }
        return r;
      })
    );

    try {
      const storageKey = `salon_review_replies_${salon?.id}`;
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      saved[reviewId] = replyData;
      localStorage.setItem(storageKey, JSON.stringify(saved));
    } catch (e) {
      console.warn(e);
    }

    try {
      await supabase
        .from('reviews')
        .update({
          reply: replyData.text,
          reply_author: replyData.author,
          reply_created_at: replyData.created_at,
        })
        .eq('id', reviewId);
    } catch (e) {
      console.warn(e);
    }

    showToast('Відповідь успішно збережено!', 'success');
    setReplyText('');
    setReplyingToReviewId(null);
    setIsSubmittingReply(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    setAvatarUrl(null);
    setIsLoggedIn(false);
    setIsProfileOpen(false);
    setUserName(null);
    setUserRole('client');
    showToast('Ви вийшли з акаунту', 'info');
    router.push('/');
  };

  const handleShare = () => {
    const cleanUrl = salon?.slug ? `${window.location.origin}/${salon.slug}` : window.location.href;
    void navigator.clipboard.writeText(cleanUrl);
    showToast('Посилання скопійовано в буфер обміну!', 'success');
  };

  // ТОЧНА ГЕОЛОКАЦІЯ ДЛЯ GOOGLE MAPS
  const fullMapQuery = useMemo(() => {
    const parts: string[] = [];
    if (salon?.address) parts.push(salon.address.trim());
    if (salon?.city) parts.push(salon.city.trim());
    else parts.push('Львів');
    parts.push('Україна');
    return parts.join(', ');
  }, [salon]);

  const mapQuery = encodeURIComponent(fullMapQuery);
  const mapIframeUrl = `https://maps.google.com/maps?q=${mapQuery}&t=m&z=17&ie=UTF8&iwloc=&output=embed`;
  const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

  const realReviewsCount = useMemo(() => {
    if (reviews.length > 0) return reviews.length;
    const count = salon?.reviews_count ? parseInt(salon.reviews_count, 10) : 0;
    return isNaN(count) ? 0 : count;
  }, [reviews, salon]);

  const realAverageRating = useMemo(() => {
    if (reviews.length > 0) {
      const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
      return sum / reviews.length;
    }
    if (realReviewsCount > 0 && salon?.rating) {
      const r = parseFloat(salon.rating);
      return isNaN(r) ? 0 : r;
    }
    return 0;
  }, [reviews, salon, realReviewsCount]);

  const getDisplayDateTime = () => {
    if (!headerSearchDate && !searchTime) return 'Будь-коли';
    const datePart = headerSearchDate ? new Date(headerSearchDate).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }) : 'Будь-який день';
    if (!searchTime) return datePart;
    return `${datePart}, ${searchTime.toLowerCase()}`;
  };

  const renderHeaderCalendarDays = () => {
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
      const isSelected = headerSearchDate === dateStr;

      days.push(
        <div
          key={i}
          onClick={(e) => {
            e.stopPropagation();
            if (!isPast) setHeaderSearchDate(isSelected ? '' : dateStr);
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

  // Календар модалки
  const renderBookingMonthCalendar = () => {
    const year = bookingCalendarMonth.getFullYear();
    const month = bookingCalendarMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days = [];

    for (let i = 0; i < startOffset; i++) {
      days.push(<div key={`empty-modal-${i}`} className="cal-cell"></div>);
    }

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const cellDate = new Date(year, month, dayNum);
      const cellDateFormatted = fmtDate(cellDate);
      const isPast = cellDate < today;
      const isDayOff = isSalonDayOff(cellDate, salon);
      const isUnavailable = isPast || isDayOff;
      const isSelected = selectedDate === cellDateFormatted;
      const isToday = cellDate.getTime() === today.getTime();

      if (isUnavailable) {
        days.push(
          <div key={dayNum} className="cal-cell">
            <div className="cal-date-disabled">
              {dayNum}
            </div>
          </div>
        );
      } else {
        days.push(
          <div key={dayNum} className="cal-cell">
            <button
              type="button"
              onClick={() => {
                setSelectedDate(cellDateFormatted);
                setSelectedTime(null);
              }}
              className={`cal-date-btn ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
            >
              {dayNum}
            </button>
          </div>
        );
      }
    }
    return days;
  };

  const formattedMonthTitle = useMemo(() => {
    const raw = bookingCalendarMonth.toLocaleString('uk-UA', { month: 'long', year: 'numeric' });
    const clean = raw.replace(/\s*р\.?$/i, '').trim();
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }, [bookingCalendarMonth]);

  const validSlots = useMemo(() => {
    if (!slotItems || slotItems.length === 0) return [];
    return slotItems;
  }, [slotItems]);

  useEffect(() => {
    if (selectedTime) {
      const current = validSlots.find((s) => s.time === selectedTime);
      if (!current || current.status !== 'available') {
        setSelectedTime(null);
      }
    }
  }, [validSlots, selectedTime]);

  return (
    <div style={{
      backgroundColor: '#ffffff',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#222222',
      paddingTop: '86px'
    }}>

      <style dangerouslySetInnerHTML={{ __html: `
        .container { max-width: 1340px; margin: 0 auto; padding: 0 4rem; width: 100%; box-sizing: border-box; position: relative; z-index: 10; }
        .anim { transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
        .section-card { background-color: #ffffff; border-radius: 24px; padding: 2rem; box-shadow: 0 4px 20px rgba(0,0,0,0.03); border: 1px solid #f1f5f9; }
        .section-title { font-size: 1.5rem; font-weight: 800; color: #1D1D1F; margin: 0; letter-spacing: -0.02em; }
        .service-pill { background-color: transparent; border-bottom: 1px solid #f1f5f9; padding: 1.5rem 0; display: flex; flex-direction: column; gap: 0.8rem; }
        .service-pill:last-child { border-bottom: none; }
        .service-pill-top { display: flex; justify-content: space-between; align-items: center; width: 100%; }
        .service-btn { background: #000000; color: #ffffff; padding: 0.6rem 1.4rem; border-radius: 14px; font-weight: 600; font-size: 0.95rem; border: none; cursor: pointer; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
        .service-btn:hover { background: #1C1C1E; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,0,0,0.15); }
        .service-btn:active { transform: scale(0.98); }
        .load-more-btn { width: 100%; background: transparent; border: 1px dashed #cbd5e1; color: #475569; padding: 1rem; border-radius: 16px; font-weight: 600; font-size: 0.95rem; cursor: pointer; transition: all 0.2s ease; display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin-top: 1rem; }
        .load-more-btn:hover { background: #f8fafc; border-color: #94a3b8; color: #1D1D1F; }
        .review-filter-btn { background: transparent; border: 1px solid #e2e8f0; color: #64748b; padding: 0.4rem 1rem; border-radius: 99px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: 0.2s; }
        .review-filter-btn.active { background: #111827; color: #ffffff; border-color: #111827; }
        .page-btn { width: 36px; height: 36px; border-radius: 10px; background: transparent; border: 1px solid #e2e8f0; color: #64748b; font-weight: 700; cursor: pointer; display: flex; justify-content: center; align-items: center; }
        .page-btn.active { background: #111827; color: #ffffff; border-color: #111827; }
        .star-btn { background: transparent; border: none; cursor: pointer; font-size: 1.8rem; line-height: 1; padding: 0 2px; color: #e2e8f0; outline: none; }
        .star-btn.active { color: #f59e0b; }
        
        .review-textarea { 
          width: 100%; 
          border: 1px solid #e2e8f0; 
          border-radius: 12px; 
          padding: 1rem; 
          font-size: 0.95rem; 
          font-family: inherit; 
          resize: none !important; 
          height: 110px; 
          min-height: 110px; 
          max-height: 110px;
          outline: none; 
          background: #ffffff; 
          box-sizing: border-box; 
          transition: border-color 0.2s ease;
        }
        .review-textarea:focus { border-color: #111827; box-shadow: 0 0 0 3px rgba(17,24,39,0.06); }
        
        .sort-trigger { display: flex; align-items: center; gap: 0.4rem; background: transparent; border: none; font-size: 0.95rem; color: #64748b; cursor: pointer; padding: 0.5rem 0; font-family: inherit; font-weight: 500; }
        .search-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 220px; background: #ffffff; border-radius: 16px; box-shadow: 0 16px 40px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; z-index: 50; max-height: 280px; overflow-y: auto; padding: 0.5rem; }
        .search-dropdown-item { padding: 0.6rem 0.75rem; cursor: pointer; border-radius: 8px; font-size: 0.9rem; color: #334155; display: flex; justify-content: space-between; align-items: center; text-align: left; width: 100%; border: none; background: transparent; }
        .search-dropdown-item:hover { background: #f8fafc; color: #111827; font-weight: 600; }
        .action-btn { display: flex; align-items: center; gap: 0.4rem; background: #ffffff; border: 1px solid rgba(0,0,0,0.08); color: #1D1D1F; padding: 0.6rem 1.2rem; border-radius: 12px; font-weight: 700; font-size: 0.95rem; cursor: pointer; }
        .icon-btn:hover { background: #F5F5F7 !important; border-color: rgba(0,0,0,0.18) !important; transform: translateY(-1px); }
        .team-avatar { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #64748b; overflow: hidden; background: #f1f5f9; }
        .gallery-main { width: 100%; height: 100%; object-fit: cover; cursor: pointer; transition: 0.3s; }
        .gallery-main:hover { filter: brightness(0.95); }
        .gallery-nav-btn { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.15); border: none; color: white; width: 56px; height: 56px; border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; backdrop-filter: blur(4px); font-size: 2rem; z-index: 2010; font-weight: 300; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        /* ЧОРНИЙ СУЧАСНИЙ ФУТЕР */
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

        /* АНІМАЦІЇ ДЛЯ МОДАЛКИ ТА КРОКІВ */
        @keyframes appleModalIn {
          from { opacity: 0; transform: scale(0.985) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes appleStepIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .apple-modal-sheet {
          animation: appleModalIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          box-shadow: 0 20px 50px -10px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.04);
        }

        .apple-step-anim {
          animation: appleStepIn 0.24s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        /* ПЛАВНЕ ПРОМАЛЬОВУВАННЯ ГАЛОЧКИ */
        @keyframes checkCirclePop {
          0% { transform: scale(0.5); opacity: 0; }
          65% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes checkStrokeAnim {
          0% { stroke-dashoffset: 36; }
          100% { stroke-dashoffset: 0; }
        }
        .success-circle-anim {
          animation: checkCirclePop 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .success-check-stroke {
          stroke-dasharray: 36;
          stroke-dashoffset: 36;
          animation: checkStrokeAnim 0.35s ease-out 0.22s forwards;
        }

        .apple-back-btn {
          background: transparent;
          border: none;
          color: #86868B;
          font-weight: 500;
          font-size: 0.92rem;
          padding: 0.5rem 0.2rem;
          cursor: pointer;
          transition: color 0.15s ease;
          font-family: inherit;
        }
        .apple-back-btn:hover {
          color: #1D1D1F;
        }

        .cal-cell {
          width: 100%;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .cal-date-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.92rem;
          font-weight: 500;
          border: none;
          background: transparent;
          color: #1D1D1F;
          cursor: pointer;
          transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          outline: none;
          flex-shrink: 0;
        }
        .cal-date-btn:hover:not(.selected) {
          background-color: #F5F5F7;
        }
        .cal-date-btn.selected {
          background-color: #000000 !important;
          color: #FFFFFF !important;
          font-weight: 700;
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
        }
        .cal-date-btn.today:not(.selected)::after {
          content: '';
          position: absolute;
          bottom: 3px;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background-color: #000000;
        }

        .cal-date-disabled {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #C7C7CC;
          font-size: 0.9rem;
          font-weight: 400;
          user-select: none;
          cursor: not-allowed;
          opacity: 0.45;
        }

        .apple-time-pill {
          border: 1px solid rgba(0, 0, 0, 0.08);
          background-color: #FFFFFF;
          height: 38px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 600;
          color: #1D1D1F;
          transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          align-items: center;
          justify-content: center;
          outline: none;
        }
        .apple-time-pill:hover:not(.busy):not(.locked):not(.active) {
          background-color: #F5F5F7;
          border-color: rgba(0, 0, 0, 0.18);
        }
        .apple-time-pill.active {
          background-color: #000000 !important;
          color: #FFFFFF !important;
          border-color: #000000 !important;
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.18);
        }
        .apple-time-pill.locked {
          background-color: #FFFBEB !important;
          color: #B45309 !important;
          border: 1px dashed #F59E0B !important;
          cursor: not-allowed;
          font-size: 0.82rem;
        }
        .apple-time-pill.busy {
          background-color: transparent !important;
          color: #C7C7CC !important;
          border: 1px solid rgba(0, 0, 0, 0.04) !important;
          cursor: not-allowed;
          text-decoration: line-through;
          opacity: 0.4;
        }

        .apple-btn-primary {
          background: #000000;
          color: #FFFFFF;
          font-weight: 600;
          font-size: 0.92rem;
          padding: 0.75rem 1.6rem;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .apple-btn-primary:hover:not(:disabled) {
          background: #1C1C1E;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        .apple-btn-primary:active:not(:disabled) {
          transform: scale(0.98);
        }
        .apple-btn-primary:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .apple-btn-secondary {
          background: #F5F5F7;
          color: #1D1D1F;
          font-weight: 600;
          font-size: 0.88rem;
          padding: 0.55rem 1rem;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .apple-btn-secondary:hover {
          background: #E8E8ED;
        }
        .apple-btn-secondary:active {
          transform: scale(0.98);
        }

        .apple-card-selectable {
          border: 1.5px solid rgba(0, 0, 0, 0.06);
          background-color: #FFFFFF;
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .apple-card-selectable:hover {
          background-color: #FAFAFC;
          border-color: rgba(0, 0, 0, 0.14);
        }
        .apple-card-selectable.selected {
          border-color: #000000;
          background-color: #FFFFFF;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);
        }
      `}} />

      {/* МОДАЛКА АВТОРИЗАЦІЇ */}
      {isAuthModalOpen && (
        <div onClick={() => setIsAuthModalOpen(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(17, 24, 39, 0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
          <div className="anim" onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#ffffff', width: '100%', maxWidth: '420px', borderRadius: '24px', padding: '2.5rem', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <button onClick={() => { setIsAuthModalOpen(false); setIsLoginView(true); }} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', fontSize: '1.2rem', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            <h2 style={{ fontSize: '1.8rem', fontWeight: '800', textAlign: 'center', marginBottom: '0.5rem', color: '#111827', letterSpacing: '-0.02em' }}>{isLoginView ? 'З поверненням' : 'Почати роботу'}</h2>
            <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: '1.4' }}>{isLoginView ? 'Увійдіть, щоб керувати розкладом.' : 'Створіть акаунт для бронювання.'}</p>
            <form onSubmit={handleModalAuth}>
              {!isLoginView && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <input type="text" placeholder="Ім'я" value={regFirstName} onChange={(e) => setRegFirstName(e.target.value)} style={{ padding: '0.85rem 1rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', marginBottom: '1rem' }} required />
                  <input type="text" placeholder="Прізвище" value={regLastName} onChange={(e) => setRegLastName(e.target.value)} style={{ padding: '0.85rem 1rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', marginBottom: '1rem' }} required />
                </div>
              )}
              <input type="email" placeholder="Email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.85rem 1rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', marginBottom: '1rem' }} required />
              <input type="password" placeholder="Пароль" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '0.85rem 1rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', marginBottom: '1rem' }} required />
              <button type="submit" style={{ width: '100%', padding: '1rem', backgroundColor: '#111827', color: '#fff', borderRadius: '12px', fontWeight: '700', border: 'none', cursor: 'pointer', marginTop: '0.5rem', fontSize: '1rem' }}>{isLoginView ? 'Продовжити' : 'Зареєструватись'}</button>
            </form>
          </div>
        </div>
      )}

      {/* --- ХЕДЕР: ФІКСОВАНИЙ ЯК РАНІШЕ --- */}
      <header style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '72px',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid #f1f5f9',
        boxShadow: '0 4px 30px rgba(0,0,0,0.05)'
      }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', height: '100%', gap: '1rem' }}>

          <div style={{ width: '180px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#111827', letterSpacing: '-0.04em', transition: 'color 0.3s ease' }}>
                Book<span style={{ color: '#8fae92' }}>Era</span>
              </div>
            </Link>
          </div>

          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start', marginLeft: '1rem' }}>
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
              <div style={{ flex: 1.3, position: 'relative', display: 'flex', alignItems: 'center', padding: '0 0.5rem 0 1rem', height: '100%' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.6rem', flexShrink: 0 }}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input
                  type="text"
                  placeholder="Послуга, бренд або салон"
                  value={headerSearchWhat}
                  onChange={(e) => setHeaderSearchWhat(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleHeaderSearch(); }}
                  style={{ width: '100%', border: 'none', outline: 'none', color: '#222222', fontSize: '0.95rem', backgroundColor: 'transparent' }}
                />
              </div>

              <div style={{ width: '1px', height: '28px', backgroundColor: '#e2e8f0' }}></div>

              <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', padding: '0 0.5rem', height: '100%' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.6rem', flexShrink: 0 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                <input
                  type="text"
                  placeholder="Місто"
                  value={headerSearchWhere}
                  onChange={(e) => setHeaderSearchWhere(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleHeaderSearch(); }}
                  style={{ width: '100%', border: 'none', outline: 'none', color: '#222222', fontSize: '0.95rem', fontWeight: '600', backgroundColor: 'transparent' }}
                />
              </div>

              <div style={{ width: '1px', height: '28px', backgroundColor: '#e2e8f0' }}></div>

              <div ref={headerDateRef} style={{ flex: 0.8, position: 'relative', display: 'flex', alignItems: 'center', padding: '0 1.25rem 0 0.5rem', height: '100%', cursor: 'pointer' }} onClick={() => setIsDateOpen(!isDateOpen)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.6rem', flexShrink: 0 }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <span style={{ color: headerSearchDate || searchTime ? '#222222' : '#64748b', fontSize: '0.95rem', fontWeight: headerSearchDate || searchTime ? '600' : '400', flexGrow: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {getDisplayDateTime()}
                </span>

                {isDateOpen && (
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
                      {renderHeaderCalendarDays()}
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
                )}
              </div>

              <button type="button" onClick={handleHeaderSearch} style={{ width: '34px', height: '34px', borderRadius: '18px', backgroundColor: '#111827', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '8px', marginRight: '4px', flexShrink: 0, transition: '0.2s' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='#334155'} onMouseOut={e=>e.currentTarget.style.backgroundColor='#111827'}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </button>
            </div>
          </div>

          <div style={{ width: '320px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1.5rem' }}>
            <Link
              href="/business"
              style={{
                whiteSpace: 'nowrap',
                fontSize: '0.95rem',
                fontWeight: '600',
                textDecoration: 'none',
                color: '#475569',
                transition: 'color 0.2s ease',
                cursor: 'pointer'
              }}
              onMouseOver={(e) => { e.currentTarget.style.color = '#8fae92'; }}
              onMouseOut={(e) => { e.currentTarget.style.color = '#475569'; }}
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
                    color: '#111827',
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
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        flexShrink: 0
                      }}
                    />
                  ) : (
                    <Avatar name={userName} size={36} />
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
                      stroke="#64748b"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
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
                  color: '#111827',
                  cursor: 'pointer',
                  transition: 'color 0.2s ease',
                  fontWeight: '600',
                  fontSize: '0.95rem',
                  whiteSpace: 'nowrap'
                }}
                onMouseOver={(e) => { e.currentTarget.style.color = '#8fae92'; }}
                onMouseOut={(e) => { e.currentTarget.style.color = '#111827'; }}
              >
                Увійти / Зареєструватись
              </span>
            )}
          </div>
        </div>
      </header>

      {/* --- ОБКЛАДИНКА ТА ДЕТАЛІ ЗАЛАДУ --- */}
      <section className="container">
        {galleryPhotos.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: galleryPhotos.length > 1 ? '2fr 1fr' : '1fr', gap: '1rem', width: '100%', height: '420px', marginBottom: '2.5rem' }}>
            <div style={{ borderRadius: '24px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.08)', position: 'relative' }}>
              <Image src={galleryPhotos[0]} alt="Обкладинка закладу" fill sizes="(max-width: 768px) 100vw, 66vw" style={{ objectFit: 'cover' }} className="gallery-main" onClick={() => setCurrentImageIndex(0)} />
            </div>
            {galleryPhotos.length > 1 && (
              <div style={{ display: 'grid', gridTemplateRows: galleryPhotos.length > 2 ? 'repeat(2, 1fr)' : '1fr', gap: '1rem', height: '100%' }}>
                {galleryPhotos.slice(1, 3).map((photo, idx) => (
                  <div key={idx} style={{ borderRadius: '24px', overflow: 'hidden', boxShadow: '0 10px 20px rgba(0,0,0,0.05)', position: 'relative', height: '100%' }}>
                    <Image src={photo} alt={`Фото ${idx + 1}`} fill sizes="(max-width: 768px) 100vw, 33vw" style={{ objectFit: 'cover' }} className="gallery-main" onClick={() => setCurrentImageIndex(idx + 1)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ШАПКА ЗАКЛАДУ */}
        <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '2.5rem', fontWeight: '800', margin: 0, color: '#1D1D1F', letterSpacing: '-0.02em' }}>
                {salon ? salon.name : "Завантаження..."}
              </h1>
              {realReviewsCount > 0 && realAverageRating > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
                  <span style={{ color: '#f59e0b', fontSize: '1.25rem', lineHeight: 1 }}>★</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1D1D1F' }}>{realAverageRating.toFixed(1)}</span>
                  <span style={{ color: '#86868B', fontSize: '0.85rem', fontWeight: '500' }}>({realReviewsCount})</span>
                </div>
              )}
            </div>
            <div style={{ color: '#86868B', fontSize: '0.92rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <div style={{ display: 'flex', width: '16px', height: '16px', color: '#86868B' }}><Icons.MapPin /></div>
              {salon ? salon.address : "Адреса завантажується..."}
            </div>

            {salon?.phone && salon?.show_phone_publicly !== false && (
              <a
                href={`tel:${salon.phone}`}
                style={{
                  color: '#86868B',
                  fontSize: '0.92rem',
                  fontWeight: '500',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  textDecoration: 'none',
                  transition: 'color 0.15s ease',
                  width: 'fit-content'
                }}
                onMouseOver={(e) => (e.currentTarget.style.color = '#1D1D1F')}
                onMouseOut={(e) => (e.currentTarget.style.color = '#86868B')}
              >
                <div style={{ display: 'flex', width: '15px', height: '15px', color: '#86868B' }}><Icons.Phone /></div>
                <span>{salon.phone}</span>
              </a>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              className="icon-btn anim"
              onClick={handleShare}
              title="Поділитися"
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                border: '1px solid rgba(0,0,0,0.08)',
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#1D1D1F',
                transition: 'all 0.15s ease'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </button>

            <button
              type="button"
              className="icon-btn anim"
              onClick={handleToggleFavorite}
              title={isFavorite ? "В улюблених" : "Додати в улюблені"}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                border: '1px solid rgba(0,0,0,0.08)',
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill={isFavorite ? "#ef4444" : "none"} stroke={isFavorite ? "#ef4444" : "#1D1D1F"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* --- СПИСОК ПОСЛУГ (ЧИСТИЙ БЕЙДЖ БЕЗ БОРДЕРА) --- */}
      <main className="container main-content-wrapper" style={{ paddingBottom: '6rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '4rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3.5rem' }}>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <h2 className="section-title">Послуги</h2>
                  <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 0 }}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input type="text" placeholder="Пошук послуги..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '0.95rem', padding: '0.4rem 0 0.4rem 1.8rem', width: '200px', backgroundColor: 'transparent' }} />
                  </div>
                </div>
                <div style={{ position: 'relative' }} ref={sortRef}>
                  <button type="button" onClick={() => setIsSortOpen(!isSortOpen)} className="sort-trigger">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                    Сортування: <span>{sortOptionsList.find(o => o.value === sortOrder)?.label}</span>
                  </button>
                  {isSortOpen && (
                    <div className="search-dropdown anim">
                      {sortOptionsList.map(opt => (
                        <button key={opt.value} type="button" className="search-dropdown-item" style={{ fontWeight: sortOrder === opt.value ? '700' : '500', backgroundColor: sortOrder === opt.value ? '#f8fafc' : 'transparent' }} onClick={(e) => { e.preventDefault(); setSortOrder(opt.value); setIsSortOpen(false); }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                {processedServices.length === 0 ? (
                  <div style={{ color: '#94a3b8', padding: '2rem 0', fontSize: '1rem', textAlign: 'center', background: '#f8fafc', borderRadius: '16px', fontWeight: '600' }}>За вашим запитом послуг не знайдено.</div>
                ) : (
                  <>
                    {displayedServices.map((service) => {
                      const availText = getServiceAvailabilityText(service);
                      return (
                        <div key={service.id} className="service-pill">
                          <div className="service-pill-top">
                            <div>
                              <div style={{ fontWeight: '700', fontSize: '1.15rem', color: '#1D1D1F', marginBottom: '0.35rem' }}>{service.name}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <div style={{ color: '#64748b', fontSize: '0.88rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <div style={{ display: 'flex', width: '14px', height: '14px' }}><Icons.Clock /></div> {service.duration_minutes || service.duration || 60} хв
                                </div>
                                <div style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  color: '#065F46',
                                  background: 'rgba(16, 185, 129, 0.08)',
                                  border: 'none',
                                  padding: '3px 8.5px',
                                  borderRadius: '6px'
                                }}>
                                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#10B981', flexShrink: 0 }} />
                                  <span>{availText}</span>
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                              <div style={{ fontWeight: '800', color: '#1D1D1F', fontSize: '1.25rem' }}>{service.price} ₴</div>
                              <button className="service-btn" onClick={() => openModal(service)}>Вибрати</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {processedServices.length > visibleServicesCount && (
                      <button className="load-more-btn anim" onClick={() => setVisibleServicesCount(prev => prev + SERVICES_PER_PAGE)}>
                        Показати ще послуги ({processedServices.length - visibleServicesCount})
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ПРО ЗАКЛАД */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '2.5rem' }}>
              <h2 className="section-title" style={{ marginBottom: '1.25rem' }}>Про заклад</h2>
              <p style={{ color: '#475569', lineHeight: '1.7', fontSize: '1rem', margin: 0, whiteSpace: 'pre-wrap', fontWeight: '400' }}>
                {salon?.description?.trim() || salon?.about?.trim() || "Опис закладу наразі відсутній."}
              </p>
            </div>

            {/* ВІДГУКИ КЛІЄНТІВ ТА ВІДПОВІДІ */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '2.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 className="section-title">Відгуки клієнтів</h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className={`review-filter-btn ${reviewFilter === 'all' ? 'active' : ''}`} onClick={() => { setReviewFilter('all'); setCurrentReviewPage(1); }}>Всі</button>
                  <button className={`review-filter-btn ${reviewFilter === 'positive' ? 'active' : ''}`} onClick={() => { setReviewFilter('positive'); setCurrentReviewPage(1); }}>Позитивні</button>
                  <button className={`review-filter-btn ${reviewFilter === 'negative' ? 'active' : ''}`} onClick={() => { setReviewFilter('negative'); setCurrentReviewPage(1); }}>Негативні</button>
                </div>
              </div>

              {/* ФОРМА ЗАЛИШЕННЯ ВІДГУКУ */}
              <div style={{ padding: '1.5rem', borderRadius: '20px', border: '1px solid #e2e8f0', background: '#f8fafc', marginBottom: '2rem' }}>
                {!isLoggedIn ? (
                  <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                    <p style={{ color: '#475569', fontSize: '1rem', fontWeight: '500', marginBottom: '1rem' }}>Увійдіть, щоб поділитися враженнями</p>
                    <button onClick={() => setIsAuthModalOpen(true)} className="apple-btn-primary">Увійти в акаунт</button>
                  </div>
                ) : (
                  <form onSubmit={handleReviewSubmit}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                      <div style={{ fontWeight: '700', color: '#1D1D1F', fontSize: '1.05rem' }}>Залишити відгук як <span style={{color: '#8fae92', marginLeft: '4px', fontWeight: '800'}}>{userName}</span></div>
                      <div style={{ display: 'flex', gap: '2px' }} onMouseLeave={() => setHoverRating(0)}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button key={star} type="button" className={`star-btn ${(hoverRating || reviewRating) >= star ? 'active' : ''}`} onMouseEnter={() => setHoverRating(star)} onClick={() => setReviewRating(star)}>★</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <textarea className="review-textarea" placeholder="Напишіть ваші враження..." value={reviewText} onChange={(e) => setReviewText(e.target.value)} maxLength={REVIEW_MAX_LENGTH} required></textarea>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                      <button type="submit" disabled={isSubmittingReview} className="apple-btn-primary">{isSubmittingReview ? 'Відправка...' : 'Надіслати відгук'}</button>
                    </div>
                  </form>
                )}
              </div>

              {/* СПИСОК ВІДГУКІВ (МАКСИМУМ 5 НА СТОРІНКУ) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {paginatedReviews.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2.5rem 0', color: '#86868B', fontSize: '0.95rem' }}>
                    Ще немає відгуків. Будьте першим, хто поділиться враженнями!
                  </div>
                ) : (
                  paginatedReviews.map((review) => {
                    const authorName = getReviewAuthorName(review);
                    const authorInitial = authorName.charAt(0).toUpperCase();

                    return (
                      <div key={review.id} style={{ padding: '1.5rem', borderRadius: '20px', border: '1px solid #f1f5f9', background: '#fff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '50%',
                              backgroundColor: '#F1F5F9',
                              color: '#111827',
                              fontWeight: '800',
                              fontSize: '0.9rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              {authorInitial}
                            </div>

                            <div>
                              <div style={{ fontWeight: '700', color: '#1D1D1F', fontSize: '0.98rem', lineHeight: '1.2' }}>
                                {authorName}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginTop: '3px' }}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <span
                                    key={star}
                                    style={{
                                      color: star <= (Number(review.rating) || 5) ? '#F59E0B' : '#E2E8F0',
                                      fontSize: '0.92rem',
                                      lineHeight: 1
                                    }}
                                  >
                                    ★
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div style={{ color: '#86868B', fontSize: '0.82rem', fontWeight: '500' }}>
                            {formatReviewDateTime(review.created_at)}
                          </div>
                        </div>

                        <p style={{ color: '#1D1D1F', margin: 0, fontSize: '0.95rem', lineHeight: '1.6', fontWeight: '400' }}>
                          {review.comment}
                        </p>

                        {(review.reply || review.response || review.business_reply) && (
                          <div style={{
                            marginTop: '1.1rem',
                            padding: '1rem 1.25rem',
                            borderRadius: '16px',
                            backgroundColor: '#FBFBFD',
                            border: '1px solid rgba(0, 0, 0, 0.06)',
                            borderLeft: '3px solid #111827'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: '700', fontSize: '0.88rem', color: '#111827' }}>
                                  {review.reply_author || salon?.name || 'Відповідь закладу'}
                                </span>
                                <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#166534', background: '#F0FDF4', padding: '2px 7px', borderRadius: '6px' }}>
                                  Заклад
                                </span>
                              </div>
                              <span style={{ fontSize: '0.78rem', color: '#86868B' }}>
                                {formatReviewDateTime(review.reply_created_at || review.created_at)}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569', lineHeight: '1.5' }}>
                              {review.reply || review.response || review.business_reply}
                            </p>
                          </div>
                        )}

                        {!review.reply && !review.response && !review.business_reply && (
                          <div style={{ marginTop: '0.85rem' }}>
                            {replyingToReviewId !== review.id ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyingToReviewId(review.id);
                                  setReplyText('');
                                }}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#86868B',
                                  fontSize: '0.84rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: 0,
                                  transition: 'color 0.15s ease'
                                }}
                                onMouseOver={(e) => (e.currentTarget.style.color = '#111827')}
                                onMouseOut={(e) => (e.currentTarget.style.color = '#86868B')}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="9 17 4 12 9 7" />
                                  <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                                </svg>
                                <span>Відповісти</span>
                              </button>
                            ) : (
                              <div style={{ marginTop: '0.75rem', background: '#FBFBFD', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '14px', padding: '1rem' }}>
                                <textarea
                                  placeholder="Напишіть вашу відповідь від імені закладу..."
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  style={{
                                    width: '100%',
                                    height: '75px',
                                    border: '1px solid #E2E8F0',
                                    borderRadius: '10px',
                                    padding: '0.75rem',
                                    fontSize: '0.9rem',
                                    outline: 'none',
                                    fontFamily: 'inherit',
                                    resize: 'none',
                                    boxSizing: 'border-box'
                                  }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.65rem' }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReplyingToReviewId(null);
                                      setReplyText('');
                                    }}
                                    className="apple-btn-secondary"
                                    style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem' }}
                                  >
                                    Скасувати
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isSubmittingReply || !replyText.trim()}
                                    onClick={() => handleReplySubmit(review.id)}
                                    className="apple-btn-primary"
                                    style={{ padding: '0.45rem 1.1rem', fontSize: '0.82rem' }}
                                  >
                                    {isSubmittingReply ? 'Збереження...' : 'Відповісти'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* ПАГІНАЦІЯ ВІДГУКІВ */}
              {totalReviewPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '2rem' }}>
                  <button
                    type="button"
                    disabled={currentReviewPage === 1}
                    onClick={() => setCurrentReviewPage((p) => Math.max(1, p - 1))}
                    style={{
                      padding: '0.45rem 0.85rem',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      background: '#FFFFFF',
                      color: currentReviewPage === 1 ? '#CBD5E1' : '#1D1D1F',
                      cursor: currentReviewPage === 1 ? 'not-allowed' : 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 600
                    }}
                  >
                    Назад
                  </button>
                  {Array.from({ length: totalReviewPages }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCurrentReviewPage(i + 1)}
                      className={`page-btn ${currentReviewPage === i + 1 ? 'active' : ''}`}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        border: currentReviewPage === i + 1 ? '1px solid #111827' : '1px solid #E2E8F0',
                        background: currentReviewPage === i + 1 ? '#111827' : '#FFFFFF',
                        color: currentReviewPage === i + 1 ? '#FFFFFF' : '#64748B',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontSize: '0.88rem'
                      }}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={currentReviewPage === totalReviewPages}
                    onClick={() => setCurrentReviewPage((p) => Math.min(totalReviewPages, p + 1))}
                    style={{
                      padding: '0.45rem 0.85rem',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      background: '#FFFFFF',
                      color: currentReviewPage === totalReviewPages ? '#CBD5E1' : '#1D1D1F',
                      cursor: currentReviewPage === totalReviewPages ? 'not-allowed' : 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 600
                    }}
                  >
                    Вперед
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ПРАВА КОЛОНКА (ЛИПКИЙ СКРОЛ STICKY) */}
          <div>
            <div style={{ position: 'sticky', top: '96px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* НАША КОМАНДА
                  showTeam перевіряється тут, а не лише в редакторі вітрини:
                  раніше власник вимикав блок у себе, а на сторінці салону
                  команда все одно показувалась - перевірки просто не було.
                  Порівнюємо з false, а не через істинність: у закладів,
                  які нічого не налаштовували, поля немає взагалі, і вони
                  мають бачити команду за замовчуванням. */}
              {salon?.layout_config?.showTeam !== false && (
              <div className="section-card" style={{ padding: '1.75rem 2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <h3 className="section-title" style={{ fontSize: '1.25rem', margin: 0 }}>Наша команда</h3>
                  {staffers.length > 4 && (
                    <span style={{ fontSize: '0.74rem', color: '#86868B', fontWeight: 500 }}>
                      Свайп →
                    </span>
                  )}
                </div>

                <div
                  className="hide-scrollbar"
                  style={{
                    display: 'flex',
                    gap: '1.25rem',
                    overflowX: 'auto',
                    paddingBottom: '0.25rem',
                    scrollSnapType: 'x mandatory',
                    WebkitOverflowScrolling: 'touch',
                  }}
                >
                  {/* Блок «Наша команда» бере activeTeam - список БЕЗ
                      прихованих. staffers тут не годиться: він для вибору
                      майстра при бронюванні й містить повний склад плюс
                      службовий пункт «Будь-який майстер». */}
                  {storefrontTeam.map((staff: any, idx: number) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        width: '76px',
                        textAlign: 'center',
                        flexShrink: 0,
                        scrollSnapAlign: 'start',
                      }}
                    >
                      <div className="team-avatar" style={{ width: '50px', height: '50px', borderRadius: '50%', marginBottom: '0.45rem', position: 'relative', flexShrink: 0, overflow: 'hidden', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {staff.photo ? (
                          <Image src={staff.photo} alt={staff.name} fill sizes="50px" style={{ objectFit: 'cover' }} />
                        ) : (
                          <div style={{ display: 'flex', width: '22px', height: '22px', color: '#86868B' }}><Icons.User /></div>
                        )}
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1D1D1F', lineHeight: '1.2', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={staff.name}>
                        {staff.name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#86868B', marginTop: '2px', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={staff.role}>
                        {staff.role}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* КАРТА
                  showMap теж не перевірявся: власник вимикав карту
                  в редакторі, а клієнт її бачив. */}
              {salon?.layout_config?.showMap !== false && (
              <div className="section-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ height: '200px', width: '100%', position: 'relative', overflow: 'hidden', borderRadius: '24px 24px 0 0', background: '#e2e8f0' }}>
                  <div style={{ position: 'absolute', top: '-160px', left: '-160px', width: 'calc(100% + 320px)', height: 'calc(100% + 320px)' }}>
                    <iframe
                      src={mapIframeUrl}
                      style={{
                        width: '100%',
                        height: '100%',
                        border: 0,
                        pointerEvents: 'none'
                      }}
                      allowFullScreen={false}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                </div>

                <div style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                    <div style={{ color: '#86868B', display: 'flex', flexShrink: 0, width: '16px', height: '16px' }}><Icons.MapPin /></div>
                    <span style={{ color: '#1D1D1F', fontSize: '0.88rem', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {salon?.address || 'Адреса закладу'}
                    </span>
                  </div>

                  <a
                    href={googleMapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="apple-btn-secondary anim"
                    style={{
                      textDecoration: 'none',
                      padding: '0.45rem 0.9rem',
                      fontSize: '0.82rem',
                      fontWeight: '600',
                      borderRadius: '10px',
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>Карта</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="7" y1="17" x2="17" y2="7" />
                      <polyline points="7 7 17 7 17 17" />
                    </svg>
                  </a>
                </div>
              </div>
              )}

              {/* ЗРУЧНОСТІ */}
              {salon?.layout_config?.showAmenities !== false && activeAmenities.length > 0 && (
                <div className="section-card">
                  <h3 className="section-title" style={{ fontSize: '1.25rem', marginBottom: '1.25rem' }}>Зручності</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.1rem' }}>
                    {activeAmenities.map((item) => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: '#1D1D1F', fontSize: '0.86rem', fontWeight: '500' }}>
                        <span style={{ color: '#86868B', display: 'flex', alignItems: 'center' }}>{item.icon}</span>
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </main>

      {/* ========================================================= */}
      {/* ПРИЄМНИЙ ЧОРНИЙ ФУТЕР ІЗ КОТИКОМ                          */}
      {/* ========================================================= */}
      <footer className="clean-dark-footer">
        <div className="container">

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: '3rem', marginBottom: '3.5rem' }}>

            {/* 1. БРЕНД */}
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

            {/* 2. МОЖЛИВОСТІ */}
            <div>
              <div className="footer-col-title">Можливості</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <Link href="/" className="footer-nav-link">Онлайн-запис</Link>
                <Link href="/" className="footer-nav-link">Пошук закладів</Link>
                <Link href="/" className="footer-nav-link">Подарункові сертифікати</Link>
                <Link href="/account/profile" className="footer-nav-link">Особистий кабінет</Link>
              </div>
            </div>

            {/* 3. ДЛЯ БІЗНЕСУ */}
            <div>
              <div className="footer-col-title">Для бізнесу</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <Link href="/business" className="footer-nav-link" style={{ color: '#C2D8C4', fontWeight: 600 }}>BookEra Business</Link>
                <Link href="/business/register" className="footer-nav-link">Підключити салон</Link>
                <Link href="/cabinet" className="footer-nav-link">Панель керування CRM</Link>
                <Link href="/business#pricing" className="footer-nav-link">Тарифи</Link>
              </div>
            </div>

            {/* 4. ПІДТРИМКА */}
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

          {/* НИЖНЯ ПЛАШКА: ЮРИДИЧНІ ПОСИЛАННЯ + КОПІРАЙТ */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem', position: 'relative' }}>

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

            {/* ВЕСЕЛИЙ КОТИК, ЩО ТРИМАЄ ФУТЕР */}
            <div style={{ position: 'absolute', bottom: '-40px', right: '48%', transform: 'translateX(50%)', pointerEvents: 'none', userSelect: 'none', zIndex: 12 }}>
              <svg width="84" height="42" viewBox="0 0 100 50" fill="none" xmlns="http://www.w3.org/2000/svg">
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

          </div>

        </div>
      </footer>

      {/* --- ГАЛЕРЕЯ (ПОВНОЕКРАННИЙ ПЕРЕГЛЯД ТА ГОРТАННЯ) --- */}
      {currentImageIndex !== null && galleryPhotos.length > 0 && (
        <div
          onClick={() => setCurrentImageIndex(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.88)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            userSelect: 'none'
          }}
        >
          <button
            onClick={() => setCurrentImageIndex(null)}
            style={{
              position: 'absolute',
              top: '1.5rem',
              right: '1.5rem',
              background: 'rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              border: 'none',
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2010,
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)')}
            onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <div
            style={{
              position: 'absolute',
              top: '1.75rem',
              left: '50%',
              transform: 'translateX(-50%)',
              color: '#ffffff',
              fontSize: '0.9rem',
              fontWeight: 600,
              background: 'rgba(0, 0, 0, 0.45)',
              padding: '0.35rem 0.9rem',
              borderRadius: '20px',
              zIndex: 2010
            }}
          >
            {currentImageIndex + 1} / {galleryPhotos.length}
          </div>

          {galleryPhotos.length > 1 && (
            <button
              className="gallery-nav-btn"
              style={{ left: '1.5rem' }}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentImageIndex((prev) => (prev === 0 ? galleryPhotos.length - 1 : (prev ?? 0) - 1));
              }}
            >
              ‹
            </button>
          )}

          <img
            src={galleryPhotos[currentImageIndex]}
            alt={`Фото ${currentImageIndex + 1}`}
            style={{
              maxWidth: '88vw',
              maxHeight: '85vh',
              objectFit: 'contain',
              borderRadius: '16px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
              zIndex: 2005,
              animation: 'appleModalIn 0.2s ease forwards'
            }}
            onClick={(e) => e.stopPropagation()}
          />

          {galleryPhotos.length > 1 && (
            <button
              className="gallery-nav-btn"
              style={{ right: '1.5rem' }}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentImageIndex((prev) => (prev === galleryPhotos.length - 1 ? 0 : (prev ?? 0) + 1));
              }}
            >
              ›
            </button>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* МОДАЛЬНЕ ВІКНО БРОНЮВАННЯ (ОРИГІНАЛЬНИЙ СТЕППЕР + ПЛАВНІСТЬ) */}
      {/* ========================================================= */}
      {isModalOpen && (
        <div onClick={closeModal} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', padding: '1rem', boxSizing: 'border-box' }}>
          <div className="apple-modal-sheet" onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#ffffff', borderRadius: '24px', width: '100%', maxWidth: '780px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>

            {/* ХЕДЕР */}
            <div style={{ padding: '1.35rem 2rem 1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1D1D1F', margin: 0, letterSpacing: '-0.02em' }}>
                  Запис до {salon?.name || 'закладу'}
                </h2>
                <p style={{ fontSize: '0.82rem', color: '#86868B', margin: '3px 0 0 0', fontWeight: '400' }}>
                  {salon?.address}
                </p>
              </div>

              {!bookingSuccess && (
                <button onClick={closeModal} style={{ background: '#F5F5F7', color: '#86868B', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              )}
            </div>

            {/* ОРИГІНАЛЬНИЙ СТЕППЕР: РИСОЧКИ ПЛАВНО ПЛИВУТЬ */}
            {!bookingSuccess && (
              <div style={{ padding: '0.85rem 2rem', backgroundColor: '#FBFBFD', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {[
                    { step: 1, label: 'Послуга' },
                    { step: 2, label: 'Спеціаліст' },
                    { step: 3, label: 'Дата і час' },
                    { step: 4, label: 'Підтвердження' },
                  ].map((item, idx) => {
                    const isPassed = currentStep > item.step;
                    const isActive = currentStep === item.step;
                    return (
                      <React.Fragment key={item.step}>
                        <div
                          onClick={() => {
                            if (isPassed) {
                              if (currentStep === 4) handleStepBackFromConfirmation();
                              else setCurrentStep(item.step as any);
                            }
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: isPassed ? 'pointer' : 'default',
                            opacity: isActive ? 1 : (isPassed ? 0.85 : 0.4),
                            transition: 'opacity 0.25s ease'
                          }}
                        >
                          <div style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.74rem',
                            fontWeight: '700',
                            backgroundColor: isActive ? '#000000' : (isPassed ? '#E5E5EA' : 'transparent'),
                            color: isActive ? '#FFFFFF' : '#1D1D1F',
                            border: isPassed || isActive ? 'none' : '1.5px solid #D2D2D7',
                            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                            transform: isActive ? 'scale(1.05)' : 'scale(1)'
                          }}>
                            {isPassed ? '✓' : item.step}
                          </div>
                          <span style={{ fontSize: '0.85rem', fontWeight: isActive ? 600 : 500, color: '#1D1D1F' }}>
                            {item.label}
                          </span>
                        </div>

                        {/* ОРИГІНАЛЬНА РИСОЧКА З ПЛАВНИМ ПЕРЕТІКАННЯМ */}
                        {idx < 3 && (
                          <div style={{
                            flex: 1,
                            height: '1.5px',
                            backgroundColor: '#E5E5EA',
                            margin: '0 12px',
                            maxWidth: '44px',
                            position: 'relative',
                            overflow: 'hidden',
                            borderRadius: '2px'
                          }}>
                            <div style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              height: '100%',
                              width: currentStep > item.step ? '100%' : '0%',
                              backgroundColor: '#1D1D1F',
                              transition: 'width 0.38s cubic-bezier(0.16, 1, 0.3, 1)'
                            }} />
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}

            {/* КОНТЕНТ */}
            <div style={{ minHeight: '380px', maxHeight: 'calc(85vh - 130px)', padding: '1.6rem 2rem', overflowY: 'auto', boxSizing: 'border-box' }} className="hide-scrollbar">

              {bookingSuccess ? (
                /* КРАСИВА ПЛАВНА ГАЛОЧКА ТА УСПІХ */
                <div className="apple-step-anim" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3.5rem 0', textAlign: 'center' }}>
                  <div className="success-circle-anim" style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    backgroundColor: '#F2F9F3',
                    color: '#166534',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1.25rem',
                    boxShadow: '0 4px 14px rgba(22, 101, 52, 0.12)'
                  }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline className="success-check-stroke" points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                  <h3 style={{ fontSize: '1.55rem', fontWeight: '700', color: '#1D1D1F', margin: '0 0 0.5rem 0' }}>Запис підтверджено</h3>
                  <p style={{ color: '#86868B', fontSize: '0.95rem', maxWidth: '380px', lineHeight: '1.5', margin: 0 }}>
                    Чекаємо на вас <strong>{selectedDate.split('-').reverse().join('.')}</strong> о <strong>{selectedTime}</strong>.
                  </p>
                </div>

              ) : currentStep === 1 ? (

                /* КРОК 1: ПОСЛУГА */
                <div className="apple-step-anim">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: '700', color: '#1D1D1F' }}>Каталог послуг</span>
                    <input
                      type="text"
                      placeholder="Пошук..."
                      value={modalServiceSearch}
                      onChange={(e) => setModalServiceSearch(e.target.value)}
                      style={{ width: '200px', padding: '0.5rem 0.85rem', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', fontSize: '0.85rem', outline: 'none', background: '#FBFBFD' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {modalFilteredServices.map((srv) => {
                      const isSelected = selectedService?.id === srv.id;
                      const hasAddons = (srv.addons?.length ?? 0) > 0;

                      return (
                        <div
                          key={srv.id}
                          className={`apple-card-selectable ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            if (selectedService?.id !== srv.id) {
                              setSelectedService(srv);
                              setSelectedAddonIds([]);
                            }
                          }}
                          style={{ padding: '1.1rem 1.25rem', display: 'flex', flexDirection: 'column', transition: 'all 0.2s ease' }}
                        >
                          {/* Головний рядок послуги */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <div>
                              <div style={{ fontWeight: '700', color: '#1D1D1F', fontSize: '1rem', marginBottom: '3px' }}>
                                {srv.name}
                              </div>
                              <div style={{ color: '#86868B', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>{isSelected && selectedAddonIds.length > 0 ? totalCalculatedDuration : (srv.duration_minutes || srv.duration || 60)} хв</span>
                                {hasAddons && !isSelected && (
                                  <span style={{ background: '#F5F5F7', padding: '1px 6px', borderRadius: '6px', fontSize: '0.74rem', color: '#5C6B5E' }}>
                                    є дод. послуги
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
                              <span style={{ fontSize: '1.15rem', fontWeight: '800', color: '#1D1D1F' }}>
                                {isSelected && selectedAddonIds.length > 0 ? totalCalculatedPrice : srv.price} ₴
                              </span>
                              <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: isSelected ? '5px solid #000000' : '1.5px solid #D2D2D7', backgroundColor: '#FFFFFF', transition: 'all 0.15s ease' }}></div>
                            </div>
                          </div>

                          {/* Випадаючий список додаткових послуг при виборі цієї послуги */}
                          {isSelected && hasAddons && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                marginTop: '1rem',
                                paddingTop: '0.9rem',
                                borderTop: '1px solid rgba(0,0,0,0.06)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#1D1D1F', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  Додати до послуги
                                </span>
                                <span style={{ fontSize: '0.74rem', color: '#86868B' }}>
                                  збільшує час візиту
                                </span>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {srv.addons.map((addon: any) => {
                                  const isPicked = selectedAddonIds.includes(addon.id);
                                  return (
                                    <div
                                      key={addon.id}
                                      onClick={() => {
                                        setSelectedAddonIds(prev =>
                                          isPicked ? prev.filter(id => id !== addon.id) : [...prev, addon.id]
                                        );
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '0.65rem 0.85rem',
                                        borderRadius: '10px',
                                        border: `1.5px solid ${isPicked ? '#000000' : 'rgba(0,0,0,0.06)'}`,
                                        background: isPicked ? '#FBFBFD' : '#FFFFFF',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div
                                          style={{
                                            width: '16px',
                                            height: '16px',
                                            borderRadius: '4px',
                                            border: isPicked ? 'none' : '1.5px solid #C7C7CC',
                                            backgroundColor: isPicked ? '#000000' : '#FFFFFF',
                                            color: '#FFFFFF',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '10px',
                                            fontWeight: 'bold',
                                          }}
                                        >
                                          {isPicked && '✓'}
                                        </div>
                                        <span style={{ fontSize: '0.88rem', fontWeight: isPicked ? '600' : '500', color: '#1D1D1F' }}>
                                          {addon.name}
                                        </span>
                                        {addon.duration_minutes > 0 && (
                                          <span style={{ fontSize: '0.74rem', color: '#5C6B5E', background: '#F2F6F1', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                            +{addon.duration_minutes} хв
                                          </span>
                                        )}
                                      </div>
                                      <span style={{ fontSize: '0.9rem', fontWeight: '700', color: '#1D1D1F' }}>
                                        +{addon.price} ₴
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

              ) : currentStep === 2 ? (

                /* КРОК 2: СПЕЦІАЛІСТ */
                <div className="apple-step-anim">
                  <div style={{ marginBottom: '1.25rem' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: '#1D1D1F', margin: 0 }}>Оберіть спеціаліста</h3>
                    <p style={{ fontSize: '0.82rem', color: '#86868B', margin: '3px 0 0 0' }}>Для послуги: {selectedService?.name}</p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.85rem' }}>
                    {availableStaffersForService.map((staff) => {
                      const isSelected = selectedMasterId === staff.id;
                      return (
                        <div
                          key={staff.id}
                          className={`apple-card-selectable ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedMasterId(staff.id);
                            setSelectedTime(null);
                          }}
                          style={{ padding: '1.2rem 0.85rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}
                        >
                          <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#F5F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem', position: 'relative', overflow: 'hidden' }}>
                            {staff.photo ? (
                              <Image src={staff.photo} alt={staff.name} fill sizes="52px" style={{ objectFit: 'cover' }} />
                            ) : (
                              <div style={{ display: 'flex', width: '20px', height: '20px', color: '#86868B' }}><Icons.User /></div>
                            )}
                          </div>
                          <div style={{ fontWeight: '600', fontSize: '0.92rem', color: '#1D1D1F', marginBottom: '2px' }}>{staff.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#86868B' }}>{staff.role}</div>
                        </div>
                      );
                    })}
                  </div>
                  {availableStaffersForService.length === 0 && (
                    <div style={{ padding: '2.5rem 1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#F5F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#86868B' }}>
                        <Icons.User />
                      </div>
                      <div style={{ fontWeight: '700', color: '#1D1D1F', fontSize: '1.05rem' }}>
                        Немає доступних спеціалістів
                      </div>
                      <p style={{ color: '#86868B', fontSize: '0.88rem', margin: 0, maxWidth: '360px', lineHeight: 1.4 }}>
                        Наразі в закладі немає майстрів, які виконують послугу «{selectedService?.name}». Будь ласка, оберіть іншу послугу.
                      </p>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        className="apple-btn-secondary"
                        style={{ marginTop: '0.5rem' }}
                      >
                        ← Обрати іншу послугу
                      </button>
                    </div>
                  )}
                </div>

              ) : currentStep === 3 ? (

                /* КРОК 3: МІСЯЧНИЙ КАЛЕНДАР + ЧАС */
                <div className="apple-step-anim">
                  <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: '2.5rem' }}>

                    {/* Ліва частина: Календар на місяць */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <span style={{ fontWeight: '700', fontSize: '1.02rem', color: '#1D1D1F' }}>
                          {formattedMonthTitle}
                        </span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => setBookingCalendarMonth(new Date(bookingCalendarMonth.getFullYear(), bookingCalendarMonth.getMonth() - 1, 1))}
                            style={{ width: '30px', height: '30px', border: 'none', borderRadius: '50%', background: '#F5F5F7', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1D1D1F' }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setBookingCalendarMonth(new Date(bookingCalendarMonth.getFullYear(), bookingCalendarMonth.getMonth() + 1, 1))}
                            style={{ width: '30px', height: '30px', border: 'none', borderRadius: '50%', background: '#F5F5F7', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1D1D1F' }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontSize: '0.72rem', fontWeight: '600', color: '#86868B', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <div>Пн</div><div>Вт</div><div>Ср</div><div>Чт</div><div>Пт</div><div>Сб</div><div>Нд</div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: '4px' }}>
                        {renderBookingMonthCalendar()}
                      </div>
                    </div>

                    {/* Права частина: Слоти годин */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ fontWeight: '700', fontSize: '1.02rem', color: '#1D1D1F' }}>
                          Вільний час
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#86868B', marginTop: '2px' }}>
                          {selectedDate.split('-').reverse().join('.')}
                        </div>
                      </div>

                      <div style={{ flex: 1, minHeight: '180px', maxHeight: '210px', overflowY: 'auto', paddingRight: '4px' }} className="hide-scrollbar">
                        {isLoadingSlots ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#86868B', fontSize: '0.88rem' }}>
                            Пошук вільних слотів...
                          </div>
                        ) : validSlots.length === 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', color: '#86868B', fontSize: '0.85rem', background: '#FBFBFD', borderRadius: '14px', padding: '1rem' }}>
                            На цю дату немає вільних годин. Будь ласка, оберіть інший робочий день.
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                            {validSlots.map((slot) => {
                              if (slot.status === 'locked') {
                                return <button key={slot.time} disabled className="apple-time-pill locked">{slot.time}</button>;
                              }
                              if (slot.status === 'booked') {
                                return <button key={slot.time} disabled className="apple-time-pill busy">{slot.time}</button>;
                              }
                              return (
                                <button
                                  key={slot.time}
                                  onClick={() => setSelectedTime(slot.time)}
                                  className={`apple-time-pill ${selectedTime === slot.time ? 'active' : ''}`}
                                >
                                  {slot.time}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>


                    </div>
                  </div>
                </div>

              ) : (

                /* КРОК 4: ПІДСУМОК ТА ОПЛАТА */
                <div className="apple-step-anim">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FDF8F0', border: '1px solid rgba(217, 119, 6, 0.16)', padding: '0.75rem 1.25rem', borderRadius: '14px', marginBottom: '1.4rem', color: '#8A5314' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: '600' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                      Слот зарезервовано для вас
                    </div>
                    <span style={{ fontSize: '0.92rem', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>
                      {formatCountdown(timeLeft)}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: '2rem' }}>
                    <div style={{ background: '#FBFBFD', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '18px', padding: '1.25rem' }}>
                      <h4 style={{ fontSize: '0.92rem', fontWeight: '700', color: '#1D1D1F', margin: '0 0 1rem 0' }}>Деталі запису</h4>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#86868B', fontSize: '0.88rem' }}>Послуга</span>
                          <span style={{ fontWeight: '600', color: '#1D1D1F', fontSize: '0.92rem' }}>{selectedService?.name}</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#86868B', fontSize: '0.88rem' }}>Спеціаліст</span>
                          <span style={{ fontWeight: '600', color: '#1D1D1F', fontSize: '0.92rem' }}>
                            {selectedMasterId === 0 ? 'Будь-який майстер' : staffers.find(s => s.id === selectedMasterId)?.name}
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#86868B', fontSize: '0.88rem' }}>Дата та час</span>
                          <span style={{ fontWeight: '600', color: '#1D1D1F', fontSize: '0.92rem' }}>
                            {selectedDate.split('-').reverse().join('.')} о {selectedTime}
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#86868B', fontSize: '0.88rem' }}>Тривалість</span>
                          <span style={{ fontWeight: '600', color: '#1D1D1F', fontSize: '0.92rem' }}>
                            ~{totalCalculatedDuration} хв
                          </span>
                        </div>

                        {selectedAddonIds.length > 0 && (
                          <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '0.75rem' }}>
                            <div style={{ fontSize: '0.78rem', color: '#86868B', marginBottom: '4px' }}>Додатково:</div>
                            {selectedService?.addons?.filter((a: any) => selectedAddonIds.includes(a.id)).map((addon: any) => (
                              <div key={addon.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                                <span>+ {addon.name}</span>
                                <span style={{ fontWeight: '600' }}>{addon.price} ₴</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ marginBottom: '1.2rem' }}>
                          <h4 style={{ fontSize: '0.92rem', fontWeight: '700', color: '#1D1D1F', margin: '0 0 0.65rem 0' }}>
                            Спосіб оплати
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => setPaymentMethod('on_site')}
                              style={{
                                padding: '0.65rem 0.85rem',
                                borderRadius: '12px',
                                border: `1.5px solid ${paymentMethod === 'on_site' ? '#000000' : 'rgba(0,0,0,0.08)'}`,
                                background: paymentMethod === 'on_site' ? '#FBFBFD' : '#FFFFFF',
                                cursor: 'pointer',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <div style={{
                                width: '14px',
                                height: '14px',
                                borderRadius: '50%',
                                border: paymentMethod === 'on_site' ? '4.5px solid #000000' : '1.5px solid #D2D2D7',
                                backgroundColor: '#FFFFFF',
                                flexShrink: 0
                              }} />
                              <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1D1D1F' }}>При візиті</div>
                                <div style={{ fontSize: '0.72rem', color: '#86868B' }}>Готівка / картка</div>
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() => setPaymentMethod('online')}
                              style={{
                                padding: '0.65rem 0.85rem',
                                borderRadius: '12px',
                                border: `1.5px solid ${paymentMethod === 'online' ? '#000000' : 'rgba(0,0,0,0.08)'}`,
                                background: paymentMethod === 'online' ? '#FBFBFD' : '#FFFFFF',
                                cursor: 'pointer',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <div style={{
                                width: '14px',
                                height: '14px',
                                borderRadius: '50%',
                                border: paymentMethod === 'online' ? '4.5px solid #000000' : '1.5px solid #D2D2D7',
                                backgroundColor: '#FFFFFF',
                                flexShrink: 0
                              }} />
                              <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1D1D1F' }}>Оплата онлайн</div>
                                <div style={{ fontSize: '0.72rem', color: '#86868B' }}>Картка / Apple Pay</div>
                              </div>
                            </button>
                          </div>
                        </div>

                        <h4 style={{ fontSize: '0.92rem', fontWeight: '700', color: '#1D1D1F', margin: '0 0 0.75rem 0' }}>Подарунковий сертифікат</h4>
                        {!certState?.valid ? (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <input
                              type="text"
                              placeholder="Код сертифіката"
                              value={certCode}
                              onChange={(e) => { setCertCode(e.target.value.toUpperCase()); setCertState(null); }}
                              style={{ flex: 1, padding: '0.6rem 0.8rem', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', textTransform: 'uppercase', fontSize: '0.85rem', outline: 'none', background: '#FBFBFD' }}
                            />
                            <button
                              type="button"
                              disabled={!certCode.trim() || isCheckingCert}
                              onClick={async () => {
                                setIsCheckingCert(true);
                                try {
                                  const res = await api.checkGiftCertificate(certCode.trim(), salon.id);
                                  setCertState({ valid: res.valid, amount: Number(res.remaining_amount || 0), message: res.message });
                                } catch (err: any) {
                                  setCertState({ valid: false, amount: 0, message: err?.message || 'Недійсний код' });
                                } finally {
                                  setIsCheckingCert(false);
                                }
                              }}
                              style={{ padding: '0 1rem', fontSize: '0.82rem', background: '#F5F5F7', color: '#1D1D1F', fontWeight: 600, borderRadius: '10px', border: 'none', cursor: 'pointer' }}
                            >
                              {isCheckingCert ? '...' : 'Застосувати'}
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', background: '#F2F9F3', border: '1px solid #D1EAD5', borderRadius: '12px' }}>
                            <div>
                              <div style={{ fontWeight: '600', color: '#166534', fontSize: '0.85rem' }}>Сертифікат враховано</div>
                              <div style={{ fontSize: '0.75rem', color: '#15803d' }}>Доступно {certState.amount} ₴</div>
                            </div>
                            <button type="button" onClick={() => { setCertCode(''); setCertState(null); }} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontWeight: '600', cursor: 'pointer', fontSize: '0.8rem' }}>Прибрати</button>
                          </div>
                        )}
                        {certState && !certState.valid && (
                          <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '4px' }}>{certState.message}</div>
                        )}
                      </div>

                      <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '1rem', marginTop: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontSize: '1rem', fontWeight: '600', color: '#1D1D1F' }}>До сплати</span>
                          <span style={{ fontSize: '1.65rem', fontWeight: '800', color: '#1D1D1F', letterSpacing: '-0.02em' }}>{totalCalculatedPrice} ₴</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              )}
            </div>

            {/* ФУТЕР МОДАЛКИ */}
            {!bookingSuccess && (
              <div style={{ padding: '1.1rem 2rem', borderTop: '1px solid rgba(0,0,0,0.06)', backgroundColor: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {currentStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (currentStep === 4) handleStepBackFromConfirmation();
                      else setCurrentStep((prev) => (prev - 1) as any);
                    }}
                    className="apple-back-btn"
                  >
                    Назад
                  </button>
                ) : <div></div>}

                <div>
                  {currentStep === 1 && (
                    <button
                      type="button"
                      disabled={!selectedService}
                      onClick={() => setCurrentStep(2)}
                      className="apple-btn-primary"
                    >
                      Продовжити
                    </button>
                  )}

                  {currentStep === 2 && (
                    <button
                      type="button"
                      disabled={availableStaffersForService.length === 0}
                      onClick={() => {
                        if (availableStaffersForService.length === 0) return;
                        setCurrentStep(3);
                      }}
                      className="apple-btn-primary"
                    >
                      Продовжити
                    </button>
                  )}

                  {currentStep === 3 && (
                    <button
                      type="button"
                      disabled={!selectedTime}
                      onClick={handleProceedToConfirmation}
                      className="apple-btn-primary"
                    >
                      Перейти до підтвердження
                    </button>
                  )}

                  {currentStep === 4 && (
                    <button
                      type="button"
                      onClick={handleConfirmBooking}
                      className="apple-btn-primary"
                      style={{ padding: '0.75rem 2.2rem' }}
                    >
                      {paymentMethod === 'online' ? 'Перейти до оплати' : 'Підтвердити запис'}
                    </button>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}