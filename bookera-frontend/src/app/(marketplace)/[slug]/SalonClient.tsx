'use client';

import dynamic from 'next/dynamic';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
// Галерея - з пріоритетом: головне фото - перше, що бачить людина, і
// «ліниве» завантаження змушувало чекати, поки намалюється сторінка.
// imageLoadProps: Unsplash - напряму з їхнього CDN, чужі адреси (напр.
// аватарка Google у майстра) - як є, інакше next/image падає з помилкою.
import { imageLoadProps } from '@/lib/images';
import { createClient } from '@/lib/supabase/client';
import { Icons } from '@/components/shared';
import { api, SlotStatusItem } from '@/lib/api';
import { authErrorText, passwordProblem, CONFIRM_EMAIL_NOTICE } from '@/lib/auth-errors';
import { useToast } from '@/context/ToastContext';
import { isBusinessRole } from '@/lib/roles';
import ProfileMenu from '@/components/ui/ProfileMenu';
import { ALL_AMENITIES } from '@/lib/amenities';
import { storefrontMap } from '@/lib/storefront-map';
import WorkingHours from '@/components/salon/WorkingHours';
import { dayBlockedReason, formatUtcAsKyiv, formatUtcDateKyiv, kyivNow, kyivToday, openStatus } from '@/lib/salon-time';
import Avatar from '@/components/ui/Avatar';
import { useMyAvatar } from '@/lib/useMyAvatar';
import { getAuthToken, getAuthTokenOrNull } from '@/lib/auth-token-client';
import SmartImage from '@/components/ui/SmartImage';
import { resolveDisplayName } from '@/lib/displayName';
import { formatDuration } from '@/lib/duration';

// Модалки відкриваються за кліком - код вантажиться лише тоді, коли потрібен
const GiftCardModal = dynamic(() => import('@/components/salon/GiftCardModal'), { ssr: false });
const VisitFeedback = dynamic(() => import('@/components/visit/VisitFeedback'), { ssr: false });

// === 1. КОНСТАНТИ ТА ХЕЛПЕРИ ===
const SERVICES_PER_PAGE = 5;
const REVIEWS_PER_PAGE = 5;

// Назви - короткі, у тон фільтру на головній. Пояснення під кожною
// каже, ЯК саме впорядковано: «За замовчуванням» нічого не пояснювало.
const sortOptionsList = [
  { value: 'default', label: 'Рекомендовані', hint: 'Як упорядкував заклад' },
  { value: 'price_asc', label: 'Дешевші', hint: 'Від найдешевшої послуги' },
  { value: 'price_desc', label: 'Дорожчі', hint: 'Від найдорожчої послуги' },
  { value: 'duration', label: 'Швидші', hint: 'Від найкоротшої за часом' },
];

// «2026-10-05» -> «понеділок, 5 жовтня» (рік - лише якщо не поточний)
const fmtLongDate = (key: string) => {
  const d = new Date(`${key}T12:00:00`);
  if (isNaN(d.getTime())) return key;
  const sameYear = d.getFullYear() === kyivToday().getFullYear();
  return d.toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });
};

const fmtDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getFirstAvailableWorkingDate = (salonObj: any) => {
  const today = kyivToday();
  // Перший день, який справді можна обрати: не вихідний, не закритий період, у межах горизонту
  for (let i = 0; i < 120; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (!dayBlockedReason(d, salonObj)) return fmtDate(d);
  }
  return fmtDate(today);
};

// created_at у базі - UTC без пояса; показуємо київський час (lib/salon-time.ts)
const formatReviewDateTime = (dateStr: string) => formatUtcAsKyiv(dateStr);

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
  // Режим перегляду з редактора вітрини: показуємо кнопку повернення й не створюємо справжніх записів
  const isPreview = searchParams.get('preview') === '1';
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();

  const [, setMounted] = useState(false);

  // --- Серверні дані ---
  const [salon] = useState<any>(initialSalon);
  const [services] = useState<any[]>(initialServices || []);
  const [team] = useState<any[]>(initialTeam || []);
  const [reviews, setReviews] = useState<any[]>(initialReviews || []);
  // Команда: згорнута до першого ряду, розгортається; клік по майстру - його рейтинг і відгуки
  const [teamExpanded, setTeamExpanded] = useState(false);
  // Права колонка залипає при прокрутці. Якщо вона вища за екран, її нижні блоки (карта, зручності)
  // були б недосяжні, поки не домотаєш усю сторінку. Тому відступ вимірюємо: висока колонка
  // прокручується разом зі сторінкою, а її низ зупиняється біля нижнього краю екрана.
  const sideRef = useRef<HTMLDivElement>(null);
  const [sideTop, setSideTop] = useState(96);
  useEffect(() => {
    const el = sideRef.current;
    if (!el) return;
    const calc = () => setSideTop(Math.min(96, Math.round(window.innerHeight - el.offsetHeight - 40)));
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    window.addEventListener('resize', calc);
    return () => { ro.disconnect(); window.removeEventListener('resize', calc); };
  }, []);
  const [openMaster, setOpenMaster] = useState<any | null>(null);
  const [masterShown, setMasterShown] = useState(5);
  const [masterOnlyComments, setMasterOnlyComments] = useState(false);
  const openMasterCard = (staff: any) => { setMasterShown(5); setMasterOnlyComments(false); setOpenMaster(staff); };
  const TEAM_PREVIEW = 3;
  // Категорії послуг (ті самі, що у вкладці «Послуги» кабінету) - швидкий пошук
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // --- Стейт юзера ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [initials, setInitials] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('client');
  const [userId, setUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  // Фото з сервера: коли localStorage порожній (інша вкладка/пристрій) чи застаріле
  const syncedAvatar = useMyAvatar();
  useEffect(() => { if (syncedAvatar) setAvatarUrl(syncedAvatar); }, [syncedAvatar]);
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
  const [aboutOpen, setAboutOpen] = useState(false);
  const [currentReviewPage, setCurrentReviewPage] = useState(1);
  // Мої завершені візити в цей заклад - щоб оцінити прямо тут
  const [myVisitsHere, setMyVisitsHere] = useState<any[] | null>(null);
  // Лічильник: після оцінки чи видалення - перечитати візити з сервера
  const [visitsNonce, setVisitsNonce] = useState(0);
  const [feedbackVisit, setFeedbackVisit] = useState<any | null>(null);
  // «Не зараз» на пропозиції оцінити візит - пам'ятаємо в браузері, щоб не нагадувати щоразу
  const [dismissedReviewIds, setDismissedReviewIds] = useState<number[]>([]);
  useEffect(() => {
    try { setDismissedReviewIds(JSON.parse(localStorage.getItem('bookera_review_dismissed') || '[]')); } catch { /* ігноруємо */ }
  }, []);
  const dismissReviewPrompt = (id: number) => {
    setDismissedReviewIds(prev => {
      const next = [...prev, id].slice(-50);
      try { localStorage.setItem('bookera_review_dismissed', JSON.stringify(next)); } catch { /* ігноруємо */ }
      return next;
    });
  };
  const [confirmDeleteReview, setConfirmDeleteReview] = useState<number | null>(null);
  useEffect(() => {
    if (!isLoggedIn || !salon?.id) { setMyVisitsHere(null); return; }
    let alive = true;
    void (async () => {
      try {
        const t = await getAuthTokenOrNull();
        if (!t) return;
        const all = await api.listMyAppointments(t);
        if (alive) setMyVisitsHere(all.filter((a: any) => String(a.business_id) === String(salon.id) && a.status === 'completed' && a.manage_token)
          .sort((a: any, b: any) => String(b.start_time).localeCompare(String(a.start_time))));
      } catch { if (alive) setMyVisitsHere([]); }
    })();
    return () => { alive = false; };
  }, [isLoggedIn, salon?.id, visitsNonce]);
  const myTokenByAppointment = useMemo(
    () => new Map((myVisitsHere || []).map((v: any) => [Number(v.id), v.manage_token as string])),
    [myVisitsHere],
  );
  const refreshReviews = useCallback(async () => {
    if (!salon?.id) return;
    try { setReviews(await api.listReviews(Number(salon.id))); } catch { /* лишаємо як є */ }
  }, [salon?.id]);
  const deleteMyReview = async (review: any) => {
    const token = myTokenByAppointment.get(Number(review.appointment_id));
    if (!token) return;
    try {
      await api.deleteVisitReview(Number(review.appointment_id), token);
      setReviews(prev => prev.filter(r => r.id !== review.id));
      setMyVisitsHere(prev => (prev || []).map(v => (Number(v.id) === Number(review.appointment_id) ? { ...v, has_review: false } : v)));
      showToast('Відгук видалено', 'success');
    } catch (e: any) {
      showToast(e?.message || 'Не вдалося видалити відгук', 'error');
    } finally {
      setConfirmDeleteReview(null);
    }
  };

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
  // Згода на новини закладу: без попереднього вибору, лише за явним бажанням клієнта
  const [marketingConsent, setMarketingConsent] = useState(false);
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
    // Не обрано нічого - не показуємо нічого: вигадані Wi-Fi й паркування клієнт сприймає як обіцянку
    const list = Array.isArray(rawList) ? rawList : [];
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
      const displayName = resolveDisplayName({ full_name: storedName, email: storedName });
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

  /**
   * Година, обрана ще на картці закладу на головній.
   *
   * Раніше клік по годині на картці підставляв ПЕРШУ послугу закладу
   * й одразу кидав на вибір часу - людина не обирала ні послугу, ні
   * майстра. А година рахувалась для тієї першої послуги й будь-якого
   * майстра, тож для іншої послуги чи конкретного майстра могла
   * виявитись зайнятою.
   *
   * Тепер людина проходить звичайний шлях - послуга, майстер, час, -
   * а обрана година чекає на кроці часу. Там її перевіряємо проти
   * справжніх вільних слотів саме цієї послуги й майстра: вільна -
   * підставляємо, зайнята - чесно кажемо й даємо обрати іншу.
   *
   * Слот НЕ утримується, поки людина обирає: утримання на 10 хвилин
   * починається лише коли вона натискає «Далі» на кроці часу.
   */
  const [preferredTime, setPreferredTime] = useState<{ date: string; time: string } | null>(null);
  const [preferredMissed, setPreferredMissed] = useState<string | null>(null);
  // Для якої послуги, майстра й дати завантажені поточні слоти.
  // Без цього перевірка години могла спрацювати на СТАРИХ слотах -
  // у тому самому кадрі, коли людина дійшла до кроку часу, а свіжі
  // ще не прийшли, - і вільна година виявилася б «зайнятою».
  const [slotsKey, setSlotsKey] = useState('');

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
      setSlotsKey(`${selectedService.id}|${selectedMasterId || '0'}|${selectedDate}`);
    } catch {
      setSlotItems([]);
      setSlotsKey(`${selectedService.id}|${selectedMasterId || '0'}|${selectedDate}`);
    } finally {
      setIsLoadingSlots(false);
    }
  }, [salon?.id, selectedService?.id, selectedDate, selectedMasterId, totalCalculatedDuration]);

  // Слоти кроку часу прийшли - перевіряємо обрану на картці годину.
  useEffect(() => {
    if (!preferredTime || currentStep !== 3 || isLoadingSlots) return;
    // Чекаємо на слоти саме для поточного вибору.
    if (slotsKey !== `${selectedService?.id}|${selectedMasterId || '0'}|${selectedDate}`) return;
    // Людина сама змінила дату - обрана на картці година вже не про неї.
    if (selectedDate !== preferredTime.date) { setPreferredTime(null); return; }

    const free = slotItems.some((s: any) =>
      String(s.time).slice(0, 5) === preferredTime.time && s.status === 'available'
    );
    if (free) {
      setSelectedTime(preferredTime.time);
      setPreferredMissed(null);
    } else {
      setPreferredMissed(preferredTime.time);
    }
    setPreferredTime(null);
  }, [preferredTime, currentStep, isLoadingSlots, slotItems, selectedDate, slotsKey, selectedService?.id, selectedMasterId]);

  // Людина обрала інший час - попередження про зайняту годину зайве.
  useEffect(() => { if (selectedTime) setPreferredMissed(null); }, [selectedTime]);

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

        const dateParam = searchParams.get('date');
        const timeParam = searchParams.get('time');
        if (dateParam) {
          setSelectedDate(dateParam);
          setBookingCalendarMonth(new Date(dateParam));
        }
        if (timeParam && dateParam) {
          // Не стрибаємо на крок часу - година дочекається там.
          setPreferredTime({ date: dateParam, time: timeParam.slice(0, 5) });
        }
      }
    }

    // Швидкий запис із картки на головній: година є, послуги ще немає.
    // Відкриваємо запис із першого кроку - вибору послуги.
    const quickDate = searchParams.get('date');
    const quickTime = searchParams.get('time');
    if (!repeatServiceId && quickDate && quickTime && services?.length) {
      openModal();
      setSelectedDate(quickDate);
      setBookingCalendarMonth(new Date(quickDate));
      setPreferredTime({ date: quickDate, time: quickTime.slice(0, 5) });
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

    // ОДИН запит замість циклу.
    //
    // Раніше тут був цикл: до 12 послуг x до 14 днів, кожен день -
    // окремий запит, і всі ПОСЛІДОВНО. У гіршому випадку - 168
    // запитів у черзі при кожному відкритті сторінки. Тепер сервер
    // шукає сам, без мережі між кроками.
    void (async () => {
      try {
        const data: Record<string, string> = await api.getNearestSlots(salon.id);
        if (cancelled) return;

        const today = kyivToday();
        const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const todayKey = dayKey(today);
        const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
        const tomorrowKey = dayKey(tomorrow);

        const found: Record<number, string> = {};
        for (const [serviceId, stamp] of Object.entries(data)) {
          const [date, time] = stamp.split('T');
          // Підпис - той самий, що й раніше: «Сьогодні о 10:00».
          const label = date === todayKey ? 'Сьогодні'
            : date === tomorrowKey ? 'Завтра'
            : new Date(`${date}T00:00:00`).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
          found[Number(serviceId)] = `${label} о ${time}`;
        }
        setNearestSlots(found);
      } catch {
        // Не вийшло - підпис просто не показується. Вигадане «Сьогодні
        // о 13:15» гірше за його відсутність.
      }
    })();

    return () => { cancelled = true; };
  }, [salon?.id, services?.length]);

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
  }, [searchQuery, sortOrder, selectedCategory]);

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

  const [isGiftOpen, setIsGiftOpen] = useState(false);

  // Роботи майстрів - з їхніх портфоліо в кабінеті
  const [portfolio, setPortfolio] = useState<{ user_id: string; name: string; avatar_url: string | null; items: { id: number; image_url: string; caption: string | null }[] }[]>([]);
  const [portfolioOpen, setPortfolioOpen] = useState<{ image_url: string; caption: string | null } | null>(null);
  useEffect(() => {
    if (!salon?.id) return;
    void api.getPublicPortfolio(salon.id).then(setPortfolio).catch(() => setPortfolio([]));
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

  // Тут було читання ВСІХ записів закладу напряму з Supabase - з усіма
  // полями, включно з іменами, телефонами й поштами клієнтів, - плюс
  // підписка на зміни всієї таблиці записів платформи без фільтра.
  // Результат ніде не використовувався (стан оголошено як
  // `[, setBookedAppointments]`): слоти давно приходять із сервера.
  // Прибрано - і як витік особистих даних, і як зайве навантаження:
  // кожен запис у будь-якому салоні змушував кожну відкриту сторінку
  // салону перезавантажувати дані.

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
        show_in_storefront: t.show_in_storefront,
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
      rating: t.rating ?? null,
      reviewsCount: t.reviews_count ?? 0,
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

  const OTHER_CATEGORY = 'Інше';
  const serviceCategories = useMemo(() => {
    const seen: string[] = [];
    services.forEach((srv: any) => {
      const c = String(srv.category || '').trim() || OTHER_CATEGORY;
      if (!seen.includes(c)) seen.push(c);
    });
    // «Інше» - в кінці, решта в порядку послуг із кабінету
    return [...seen.filter(c => c !== OTHER_CATEGORY), ...seen.filter(c => c === OTHER_CATEGORY)];
  }, [services]);

  const processedServices = useMemo(() => {
    let result = [...services];
    if (selectedCategory) {
      result = result.filter((srv: any) => (String(srv.category || '').trim() || OTHER_CATEGORY) === selectedCategory);
    }
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(lowerQuery));
    }
    if (sortOrder === 'price_asc') result.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    else if (sortOrder === 'price_desc') result.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    else if (sortOrder === 'duration') result.sort((a, b) => (a.duration_minutes || 0) - (b.duration_minutes || 0));
    return result;
  }, [services, searchQuery, sortOrder, selectedCategory]);

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
          showToast(`Помилка входу: ${authErrorText(error.message)}`, 'error');
          return;
        }

        // Через бекенд: таблиці profiles у Supabase не існує.
        const loginToken = data.session?.access_token;
        const profile: any = loginToken ? await api.getMe(loginToken).catch(() => null) : null;

        const finalName = resolveDisplayName(profile, data.user as any);
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

        const pwProblem = passwordProblem(loginPassword);
        if (pwProblem) {
          showToast(pwProblem, 'error');
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: targetEmail,
          password: loginPassword,
          options: {
            data: { full_name: targetFullName },
            emailRedirectTo: typeof window !== 'undefined' ? window.location.href : undefined,
          }
        });

        if (error) {
          showToast(`Помилка реєстрації: ${authErrorText(error.message)}`, 'error');
          return;
        }

        if (!data?.session) {
          // Підтвердження пошти увімкнене: сесії ще немає, входити рано
          setIsLoginView(true);
          showToast(CONFIRM_EMAIL_NOTICE(targetEmail), 'info');
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

  const bookingBlockedText = (() => {
    const r = salon?.booking_settings || {};
    if (r.is_paused_emergency === true) return 'Заклад тимчасово не приймає онлайн-записи';
    if (r.is_active === false) return 'Онлайн-запис у цьому закладі вимкнено';
    return null;
  })();

  // «Зараз» - лише в браузері (на сервері час інший, і розмітка не збіглась би при гідратації); оновлюється щохвилини
  const [clientNow, setClientNow] = useState<Date | null>(null);
  useEffect(() => {
    setClientNow(new Date());
    const t = setInterval(() => setClientNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const salonOpenNow = useMemo(() => (clientNow ? openStatus(salon?.working_hours, clientNow) : null), [salon?.working_hours, clientNow]);
  const todayClosedPeriod = useMemo(() => {
    if (!clientNow) return null;
    const key = kyivNow(clientNow).key;
    const p = (salon?.booking_settings?.closed_periods || []).find((x: any) => x?.start && x?.end && x.start <= key && key <= x.end);
    if (!p) return null;
    const until = new Date(`${p.end}T00:00:00`).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
    return `Заклад закритий до ${until}${p.reason ? ` · ${p.reason}` : ''}`;
  }, [salon?.booking_settings?.closed_periods, clientNow]);

  const openModal = (service?: any) => {
    if (bookingBlockedText) { showToast(bookingBlockedText, 'info'); return; }
    const firstWorkingDate = getFirstAvailableWorkingDate(salon);

    setSelectedService(service || services[0] || null);
    setSelectedAddonIds([]);
    setPaymentMethod('on_site');
    setMarketingConsent(false);
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
    setPreferredTime(null);
    setPreferredMissed(null);
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
    } catch (err: any) {
      showToast(err.message || "Цей час щойно зайняли. Будь ласка, оберіть інший слот.", 'error');
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
    if (isPreview) {
      showToast('Це перегляд: запис не створюється', 'info');
      return;
    }
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
        marketing_consent: marketingConsent,
        // Додаткові послуги. Без них клієнт обирав послуг на 800 ₴,
        // а заклад бачив у календарі 500 ₴ і 45 хвилин замість 75 -
        // майстер не знав, що робити, і не встигав.
        addon_service_ids: selectedAddonIds.length > 0 ? selectedAddonIds : undefined,
      });

      setBookingSuccess(true);
      showToast('Запис успішно підтверджено!', 'success');
      setTimeout(() => void closeModal(), 2200);
    } catch (e: any) {
      showToast(e.message || "Помилка підтвердження бронювання.", 'error');
    }
  };

  // Відправка відгуку (без TS-помилок)

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

  // Карта: координати, інакше адреса; без адреси - без карти (lib/storefront-map.ts)
  const salonMap = useMemo(() => storefrontMap(salon), [salon]);

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
    const today = kyivToday();
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

    const today = kyivToday();

    const days = [];

    for (let i = 0; i < startOffset; i++) {
      days.push(<div key={`empty-modal-${i}`} className="cal-cell"></div>);
    }

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const cellDate = new Date(year, month, dayNum);
      const cellDateFormatted = fmtDate(cellDate);
      // минулі дні, вихідні, закриті періоди (відпустка) і дні за межею горизонту запису
      const isUnavailable = dayBlockedReason(cellDate, salon) !== null;
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

      {openMaster && (() => {
        const all = reviews.filter((r: any) => r.master_id && String(r.master_id) === String(openMaster.id));
        const score = (r: any) => Number(r.master_rating || r.rating || 0);
        const dist = [5, 4, 3, 2, 1].map(n => ({ n, c: all.filter(r => Math.round(score(r)) === n).length }));
        const maxC = Math.max(1, ...dist.map(d => d.c));
        const list = (masterOnlyComments ? all.filter((r: any) => (r.comment || '').trim()) : all);
        const shown = list.slice(0, masterShown);
        const withComments = all.filter((r: any) => (r.comment || '').trim()).length;
        const stars = (v: number) => '★★★★★'.slice(0, Math.round(v)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(v));
        return (
          <div onClick={() => setOpenMaster(null)} style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '520px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Шапка не прокручується: імʼя й закриття завжди під рукою */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', padding: '1.4rem 1.5rem 1rem' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', overflow: 'hidden', position: 'relative', background: '#f1f5f9', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {openMaster.photo ? <Image {...imageLoadProps(openMaster.photo)} src={openMaster.photo} alt={openMaster.name} fill sizes="52px" style={{ objectFit: 'cover' }} /> : <div style={{ width: 22, height: 22, color: '#86868B', display: 'flex' }}><Icons.User /></div>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1D1D1F', overflowWrap: 'anywhere' }}>{openMaster.name}</div>
                  <div style={{ fontSize: '0.85rem', color: '#86868B', marginTop: '2px' }}>{openMaster.role}</div>
                </div>
                <button type="button" onClick={() => setOpenMaster(null)} aria-label="Закрити" style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', fontSize: '1rem', color: '#475569', flex: 'none' }}>✕</button>
              </div>

              <div className="hide-scrollbar" style={{ overflowY: 'auto', padding: '0 1.5rem 1.5rem' }}>
                {openMaster.rating ? (
                  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', padding: '1rem 0 1.25rem', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ textAlign: 'center', flex: 'none' }}>
                      <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#1D1D1F', lineHeight: 1 }}>{Number(openMaster.rating).toFixed(1)}</div>
                      <div style={{ color: '#f59e0b', letterSpacing: '1px', fontSize: '0.95rem', marginTop: '4px' }}>{stars(openMaster.rating)}</div>
                      <div style={{ color: '#86868B', fontSize: '0.78rem', marginTop: '2px' }}>{openMaster.reviewsCount} {openMaster.reviewsCount === 1 ? 'оцінка' : openMaster.reviewsCount < 5 ? 'оцінки' : 'оцінок'}</div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {dist.map(d => (
                        <div key={d.n} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#64748b' }}>
                          <span style={{ width: 10, textAlign: 'right' }}>{d.n}</span>
                          <div style={{ flex: 1, height: 6, borderRadius: 999, background: '#f1f5f9', overflow: 'hidden' }}>
                            <div style={{ width: `${(d.c / maxC) * 100}%`, height: '100%', background: '#f59e0b', borderRadius: 999 }} />
                          </div>
                          <span style={{ width: 22 }}>{d.c}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '1.25rem 0', borderTop: '1px solid #f1f5f9', color: '#86868B', fontSize: '0.9rem' }}>Оцінок про цього майстра поки немає.</div>
                )}

                {all.length > 0 && (
                  <>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {[{ v: false, t: `Усі (${all.length})` }, { v: true, t: `З коментарем (${withComments})` }].map(o => (
                        <button key={String(o.v)} type="button" onClick={() => { setMasterOnlyComments(o.v); setMasterShown(5); }}
                          style={{ padding: '0.35rem 0.9rem', borderRadius: 999, border: `1px solid ${masterOnlyComments === o.v ? '#0f172a' : '#e2e8f0'}`, background: masterOnlyComments === o.v ? '#0f172a' : '#fff', color: masterOnlyComments === o.v ? '#fff' : '#475569', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {o.t}
                        </button>
                      ))}
                    </div>
                    {shown.map((r: any) => (
                      <div key={r.id} style={{ borderTop: '1px solid #f1f5f9', padding: '0.95rem 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'baseline' }}>
                          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1D1D1F' }}>{r.author_name || 'Клієнт'}</span>
                          <span style={{ fontSize: '0.75rem', color: '#a1a1a6', whiteSpace: 'nowrap' }}>{formatUtcDateKyiv(r.created_at)}</span>
                        </div>
                        <div style={{ color: '#f59e0b', fontSize: '0.85rem', letterSpacing: '1px', margin: '2px 0' }}>{stars(score(r))}</div>
                        {r.comment && <div style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{r.comment}</div>}
                        {r.business_reply && (
                          <div style={{ marginTop: '0.5rem', padding: '0.55rem 0.8rem', background: '#f8fafc', borderRadius: 10, fontSize: '0.82rem', color: '#64748b', lineHeight: 1.45 }}>
                            <b style={{ color: '#475569' }}>Відповідь закладу:</b> {r.business_reply}
                          </div>
                        )}
                      </div>
                    ))}
                    {list.length === 0 && <div style={{ color: '#94a3b8', fontSize: '0.88rem', padding: '1rem 0' }}>Відгуків із коментарем ще немає.</div>}
                    {list.length > masterShown && (
                      <button type="button" onClick={() => setMasterShown(n => n + 5)}
                        style={{ width: '100%', marginTop: '0.5rem', padding: '0.7rem', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', color: '#1D1D1F', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                        Показати ще ({list.length - masterShown})
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {isPreview && (
        <div style={{ position: 'fixed', left: '50%', bottom: '1.5rem', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 0.6rem 0.6rem 1.25rem', background: '#0f172a', color: '#fff', borderRadius: '999px', boxShadow: '0 12px 32px rgba(15,23,42,0.28)', fontSize: '0.88rem', maxWidth: 'calc(100vw - 2rem)' }}>
          <span style={{ whiteSpace: 'nowrap' }}>Режим перегляду · так бачать вас клієнти</span>
          <button
            type="button"
            onClick={() => router.push('/cabinet')}
            style={{ padding: '0.55rem 1.1rem', background: '#fff', color: '#0f172a', border: 'none', borderRadius: '999px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            ← До редактора
          </button>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .container { max-width: 1340px; margin: 0 auto; padding: 0 4rem; width: 100%; box-sizing: border-box; position: relative; z-index: 10; }
        .sl-hd-short, .sl-hd-find { display: none; }
        .sl-hd-find { width: 44px; height: 44px; align-items: center; justify-content: center; color: #111827; }
        /* ТЕЛЕФОН (лише до 860px, комп'ютер не змінюється) */
        .sl-more { display: none; }
        @media (max-width: 860px) {
          .container { padding: 0 1.25rem; }
          .sl-hd-logo { width: auto !important; }
          .sl-hd-logo div { font-size: 1.5rem !important; }
          .sl-hd-search, .sl-hd-biz, .sl-hd-name, .sl-hd-long { display: none !important; }
          .sl-hd-short { display: inline; }
          .sl-hd-find { display: inline-flex; }
          .sl-hd-right { width: auto !important; margin-left: auto; gap: 0.35rem !important; }
          .sl-gallery { grid-template-columns: minmax(0, 1fr) !important; height: 260px !important; border-radius: 18px; }
          .sl-gallery > div:nth-child(n+2) { display: none !important; }
          .sl-gallery > div:first-child { border-radius: 18px !important; }
          .sl-h1 { font-size: 1.85rem !important; }
          .sl-main { grid-template-columns: minmax(0, 1fr) !important; gap: 2rem !important; }
          .sl-stack { gap: 1.75rem !important; }
          .sl-sec { padding-top: 1.5rem !important; }
          .sl-empty { display: none; }
          .sl-about:not(.open) { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
          .sl-more { display: inline-block; margin-top: 0.5rem; padding: 0.5rem 0; border: none; background: none; font: inherit; font-weight: 600; font-size: 0.92rem; color: #1D1D1F; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
          .footer-grid { grid-template-columns: 1fr 1fr !important; gap: 2rem 1.5rem !important; margin-bottom: 2.5rem !important; }
          .footer-grid > div:first-child { grid-column: 1 / -1; }
          .footer-nav-link { padding: 0.25rem 0; }
          .clean-dark-footer { padding-top: 3rem !important; }
          .section-card { padding: 1.4rem !important; }
        }
        /* Вікно запису на телефоні - на весь екран, зручні відступи, у степері лише поточний крок підписаний */
        @media (max-width: 640px) {
          .apple-modal-overlay { padding: 0 !important; align-items: stretch !important; }
          .apple-modal-sheet { max-width: 100% !important; height: 100dvh; border-radius: 0 !important; }
          .apple-modal-sheet > div:first-child { padding: 1rem 1.1rem 0.8rem !important; }
          .apple-modal-sheet > div:first-child h2 { font-size: 1.1rem !important; }
          .apple-modal-sheet > div:nth-child(2) { padding: 0.7rem 1rem !important; }
          .apple-modal-sheet > .hide-scrollbar { flex: 1; min-height: 0 !important; max-height: none !important; padding: 1.1rem !important; }
          .apple-modal-sheet > div:last-child { padding-bottom: calc(0.9rem + env(safe-area-inset-bottom)) !important; }
          .bk-step-label:not(.is-active) { display: none; }
          .bk-two { grid-template-columns: minmax(0, 1fr) !important; gap: 1.25rem !important; }
        }
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
        
        /* --- Порядок послуг: як фільтр на головній --- */
        .sort-dd { position: relative; flex-shrink: 0; }
        .sort-dd-trigger {
          display: inline-flex; align-items: center; gap: 0.45rem;
          height: 36px; padding: 0 0.6rem; border-radius: 10px;
          border: none; background: transparent; color: #3A3A3C;
          font-family: inherit; font-size: 0.9rem; font-weight: 500; cursor: pointer;
          transition: background-color .2s ease, color .2s ease;
        }
        .sort-dd-trigger:hover, .sort-dd-trigger.open { background: #F5F5F7; color: #1D1D1F; }
        .sort-dd-ico { color: #86868B; }
        .sort-dd-chev { color: #AEAEB2; transition: transform .25s cubic-bezier(.16,1,.3,1); }
        .sort-dd-trigger.open .sort-dd-chev { transform: rotate(180deg); }
        .sort-dd-menu {
          position: absolute; top: calc(100% + 8px); right: 0; z-index: 60;
          width: 256px; padding: 6px; border-radius: 12px; background: #fff;
          box-shadow: 0 18px 40px -12px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.05);
          transform-origin: top right;
          opacity: 0; transform: translateY(-4px) scale(.97); pointer-events: none;
          transition: opacity .18s ease, transform .22s cubic-bezier(.16,1,.3,1);
        }
        .sort-dd-menu.open { opacity: 1; transform: none; pointer-events: auto; }
        .sort-dd-opt {
          width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
          padding: 0.6rem 0.75rem; border: none; border-radius: 8px; background: transparent;
          font-family: inherit; text-align: left; cursor: pointer; transition: background-color .15s ease;
        }
        .sort-dd-opt:hover { background: #F5F5F7; }
        .sort-dd-text { display: flex; flex-direction: column; gap: 1px; }
        .sort-dd-label { font-size: 0.9rem; font-weight: 500; color: #1D1D1F; }
        .sort-dd-opt.on .sort-dd-label { font-weight: 600; }
        .sort-dd-hint { font-size: 0.76rem; color: #86868B; }
        .sort-dd-check { color: #6F9273; flex-shrink: 0; }
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
      {isGiftOpen && salon && (
        <GiftCardModal
          businessId={salon.id}
          businessName={salon.name}
          onClose={() => setIsGiftOpen(false)}
          onNeedLogin={() => { setIsGiftOpen(false); setIsAuthModalOpen(true); }}
          showToast={showToast}
        />
      )}
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

          <div className="sl-hd-logo" style={{ width: '180px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#111827', letterSpacing: '-0.04em', transition: 'color 0.3s ease' }}>
                Book<span style={{ color: '#8fae92' }}>Era</span>
              </div>
            </Link>
          </div>

          <div className="sl-hd-search" style={{ flex: 1, display: 'flex', justifyContent: 'flex-start', marginLeft: '1rem' }}>
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

          <div className="sl-hd-right" style={{ width: '320px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1.5rem' }}>
            {/* Телефон: повний пошук у шапці не вміщається - лупа веде на головну, де великий пошук */}
            <Link href="/" className="sl-hd-find" aria-label="Пошук закладів">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            </Link>
            <Link
              href="/business"
              className="sl-hd-biz"
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
                  <span className="sl-hd-name" style={{
                    color: '#111827',
                    transition: 'color 0.2s ease',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    whiteSpace: 'nowrap'
                  }}>
                    {userName}
                  </span>

                  <Avatar name={userName} src={avatarUrl} size={36} />

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
                  <ProfileMenu
                    showCabinet={isBusinessRole(userRole)}
                    onLogout={handleLogout}
                    onNavigate={() => setIsProfileOpen(false)}
                  />
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
                <span className="sl-hd-long">Увійти / Зареєструватись</span>
                <span className="sl-hd-short">Увійти</span>
              </span>
            )}
          </div>
        </div>
      </header>

      {/* --- ОБКЛАДИНКА ТА ДЕТАЛІ ЗАЛАДУ --- */}
      <section className="container">
        {galleryPhotos.length > 0 && (
          <div className="sl-gallery" style={{ display: 'grid', gridTemplateColumns: galleryPhotos.length > 1 ? '2fr 1fr' : '1fr', gap: '1rem', width: '100%', height: '420px', marginBottom: '2.5rem' }}>
            <div style={{ borderRadius: '24px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.08)', position: 'relative' }}>
              <Image {...imageLoadProps(galleryPhotos[0])} priority src={galleryPhotos[0]} alt="Обкладинка закладу" fill sizes="(max-width: 768px) 100vw, 66vw" style={{ objectFit: 'cover' }} className="gallery-main" onClick={() => setCurrentImageIndex(0)} />
            </div>
            {galleryPhotos.length > 1 && (
              <div style={{ display: 'grid', gridTemplateRows: galleryPhotos.length > 2 ? 'repeat(2, 1fr)' : '1fr', gap: '1rem', height: '100%' }}>
                {galleryPhotos.slice(1, 3).map((photo, idx) => (
                  <div key={idx} style={{ borderRadius: '24px', overflow: 'hidden', boxShadow: '0 10px 20px rgba(0,0,0,0.05)', position: 'relative', height: '100%' }}>
                    <Image {...imageLoadProps(photo)} priority src={photo} alt={`Фото ${idx + 1}`} fill sizes="(max-width: 768px) 100vw, 33vw" style={{ objectFit: 'cover' }} className="gallery-main" onClick={() => setCurrentImageIndex(idx + 1)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {bookingBlockedText && (
          <div role="status" style={{ marginBottom: '1.5rem', padding: '0.9rem 1.2rem', borderRadius: '14px', background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', fontSize: '0.92rem', fontWeight: 600 }}>
            {bookingBlockedText}. Спробуйте пізніше або зв’яжіться із закладом.
          </div>
        )}
        {!bookingBlockedText && todayClosedPeriod && (
          <div role="status" style={{ marginBottom: '1.5rem', padding: '0.9rem 1.2rem', borderRadius: '14px', background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', fontSize: '0.92rem', fontWeight: 600 }}>
            {todayClosedPeriod}
          </div>
        )}

        {/* ШАПКА ЗАКЛАДУ */}
        <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
              <h1 className="sl-h1" style={{ fontSize: '2.5rem', fontWeight: '800', margin: 0, color: '#1D1D1F', letterSpacing: '-0.02em' }}>
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
              {salon ? [salon.address, salon.city].map((x: any) => String(x || '').trim()).filter(Boolean).join(', ') : "Адреса завантажується..."}
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
            {/* Подарункова картка цього закладу */}
            <button
              type="button"
              className="icon-btn anim"
              onClick={() => setIsGiftOpen(true)}
              title="Подарувати картку"
              aria-label="Подарувати картку"
              style={{ width: '42px', height: '42px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.08)', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#1D1D1F', transition: 'all 0.15s ease' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
                <path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" />
              </svg>
            </button>

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
        <div className="sl-main" style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '4rem' }}>
          <div className="sl-stack" style={{ display: 'flex', flexDirection: 'column', gap: '3.5rem' }}>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <h2 className="section-title">Послуги</h2>
                  <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 0 }}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input type="text" placeholder="Пошук послуги..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '0.95rem', padding: '0.4rem 0 0.4rem 1.8rem', width: '200px', backgroundColor: 'transparent' }} />
                  </div>
                </div>
                {/* Порядок послуг - та сама кнопка зі списком, що й на головній:
    ледь помітна в спокої, з поясненням під кожним варіантом. */}
                <div className="sort-dd" ref={sortRef} onKeyDown={e => { if (e.key === 'Escape') setIsSortOpen(false); }}>
                  <button
                    type="button"
                    className={`sort-dd-trigger ${isSortOpen ? 'open' : ''}`}
                    aria-haspopup="listbox"
                    aria-expanded={isSortOpen}
                    onClick={() => setIsSortOpen(o => !o)}
                  >
                    <svg className="sort-dd-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5" /></svg>
                    <span>{sortOptionsList.find(o => o.value === sortOrder)?.label}</span>
                    <svg className="sort-dd-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </button>
                  <div className={`sort-dd-menu ${isSortOpen ? 'open' : ''}`} role="listbox" aria-label="Порядок послуг">
                    {sortOptionsList.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        role="option"
                        aria-selected={sortOrder === opt.value}
                        className={`sort-dd-opt ${sortOrder === opt.value ? 'on' : ''}`}
                        onClick={() => { setSortOrder(opt.value); setIsSortOpen(false); }}
                      >
                        <span className="sort-dd-text">
                          <span className="sort-dd-label">{opt.label}</span>
                          <span className="sort-dd-hint">{opt.hint}</span>
                        </span>
                        {sortOrder === opt.value && (
                          <svg className="sort-dd-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {serviceCategories.length > 1 && (
                <div className="hide-scrollbar" role="tablist" aria-label="Категорії послуг" style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', marginBottom: '1.25rem', paddingBottom: '2px' }}>
                  {[null, ...serviceCategories].map(cat => {
                    const on = selectedCategory === cat;
                    return (
                      <button
                        key={cat ?? '__all'}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        onClick={() => setSelectedCategory(cat)}
                        style={{ padding: '0.45rem 1.1rem', borderRadius: '999px', border: `1px solid ${on ? '#0f172a' : '#e2e8f0'}`, background: on ? '#0f172a' : '#fff', color: on ? '#fff' : '#475569', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit' }}
                      >
                        {cat ?? 'Усі'}
                      </button>
                    );
                  })}
                </div>
              )}

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
                                  <div style={{ display: 'flex', width: '14px', height: '14px' }}><Icons.Clock /></div> {formatDuration(service.duration_minutes || service.duration || 60)}
                                </div>
                                {availText && (
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
                                )}
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
            {(() => {
              const about = salon?.description?.trim() || salon?.about?.trim() || '';
              return (
                <div className={`sl-sec${about ? '' : ' sl-empty'}`} style={{ borderTop: '1px solid #f1f5f9', paddingTop: '2.5rem' }}>
                  <h2 className="section-title" style={{ marginBottom: '1.25rem' }}>Про заклад</h2>
                  <p className={`sl-about${aboutOpen ? ' open' : ''}`} style={{ color: '#475569', lineHeight: '1.7', fontSize: '1rem', margin: 0, whiteSpace: 'pre-wrap', fontWeight: '400' }}>
                    {about || "Опис закладу наразі відсутній."}
                  </p>
                  {about.length > 200 && (
                    <button type="button" className="sl-more" onClick={() => setAboutOpen(o => !o)}>{aboutOpen ? 'Згорнути' : 'Показати більше'}</button>
                  )}
                </div>
              );
            })()}

            {/* ГРАФІК РОБОТИ - з тієї ж таблиці, що й календар у кабінеті */}
            {Array.isArray(salon?.working_hours) && salon.working_hours.length > 0 && (
              <div className="sl-sec" style={{ borderTop: '1px solid #f1f5f9', paddingTop: '2.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                  <h2 className="section-title" style={{ margin: 0 }}>Графік роботи</h2>
                  {salonOpenNow && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, padding: '3px 8.5px', borderRadius: '6px', color: salonOpenNow.open ? '#065F46' : '#86868B', background: salonOpenNow.open ? 'rgba(16, 185, 129, 0.08)' : '#f5f5f7' }}>
<span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: salonOpenNow.open ? '#10B981' : '#cbd5e1', flexShrink: 0 }} />
                      {salonOpenNow.text}
                    </span>
                  )}
                </div>
                <WorkingHours rows={salon.working_hours} now={clientNow} />
              </div>
            )}

            {/* ВІДГУКИ КЛІЄНТІВ ТА ВІДПОВІДІ */}
            <div className="sl-sec" style={{ borderTop: '1px solid #f1f5f9', paddingTop: '2.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 className="section-title">Відгуки клієнтів</h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className={`review-filter-btn ${reviewFilter === 'all' ? 'active' : ''}`} onClick={() => { setReviewFilter('all'); setCurrentReviewPage(1); }}>Всі</button>
                  <button className={`review-filter-btn ${reviewFilter === 'positive' ? 'active' : ''}`} onClick={() => { setReviewFilter('positive'); setCurrentReviewPage(1); }}>Позитивні</button>
                  <button className={`review-filter-btn ${reviewFilter === 'negative' ? 'active' : ''}`} onClick={() => { setReviewFilter('negative'); setCurrentReviewPage(1); }}>Негативні</button>
                </div>
              </div>

              {/* Відгук - прямо тут, але лише про справжній візит: сторінка
                  знаходить ваші завершені візити в цей заклад. Так рейтинг
                  не накрутити без запису, а оцінити не треба йти в профіль. */}
              {/* Пропозиція оцінити - лише ОДИН, найсвіжіший візит, який сервер справді
                  прийме, ще не оцінений, не старший за 14 днів і не відкладений.
                  Раніше тут висів список усіх візитів з кнопками, який не зникав. */}
              {(() => {
                const cutoff = Date.now() - 14 * 24 * 3600 * 1000;
                const v = (myVisitsHere || []).find((x: any) =>
                  x.can_review && !x.has_review && !dismissedReviewIds.includes(Number(x.id)) &&
                  new Date(x.start_time).getTime() >= cutoff);
                if (!v) return null;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', padding: '0.85rem 1.1rem', borderRadius: '16px', background: '#F4FAF5', border: '1px solid #E4EBE3', marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '0.92rem', color: '#1D1D1F' }}>
                      Як пройшов візит <b>{v.service_name || ''}</b>
                      <span style={{ color: '#6B756A' }}> · {new Date(v.start_time).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })}</span>?
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" onClick={() => setFeedbackVisit(v)}
                        style={{ height: '34px', padding: '0 1rem', borderRadius: '10px', border: 'none', background: '#1D1D1F', color: '#fff', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                        Оцінити
                      </button>
                      <button type="button" onClick={() => dismissReviewPrompt(Number(v.id))}
                        style={{ height: '34px', padding: '0 0.8rem', borderRadius: '10px', border: 'none', background: 'transparent', color: '#6B756A', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                        Не зараз
                      </button>
                    </div>
                  </div>
                );
              })()}

              {feedbackVisit && (
                <div onClick={() => setFeedbackVisit(null)}
                  style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem' }}>
                  <div onClick={ev => ev.stopPropagation()} role="dialog" aria-label="Оцінити візит"
                    style={{ position: 'relative', width: '100%', maxWidth: '460px', maxHeight: '92vh', overflowY: 'auto', background: '#fff', borderRadius: '20px', padding: '1.5rem 1.4rem 1.3rem' }}>
                    <button type="button" aria-label="Закрити" onClick={() => setFeedbackVisit(null)}
                      style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#f1f5f9', color: '#64748b', cursor: 'pointer' }}>✕</button>
                    <VisitFeedback compact appointmentId={Number(feedbackVisit.id)} token={feedbackVisit.manage_token}
                      onReviewed={() => { setVisitsNonce(n => n + 1); void refreshReviews(); }} />
                  </div>
                </div>
              )}

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

                        {/* Окремо майстер і заклад - якщо відгук нового зразка */}
                        {review.master_rating && review.salon_rating && review.master_rating !== review.salon_rating && (
                          <div style={{ display: 'flex', gap: '0.9rem', fontSize: '0.8rem', color: '#6B756A', margin: '-0.4rem 0 0.6rem' }}>
                            <span>Майстер <b style={{ color: '#1D1D1F' }}>{review.master_rating}★</b></span>
                            <span>Заклад <b style={{ color: '#1D1D1F' }}>{review.salon_rating}★</b></span>
                          </div>
                        )}
                        {review.comment && (
                          <p style={{ color: '#1D1D1F', margin: 0, fontSize: '0.95rem', lineHeight: '1.6', fontWeight: '400' }}>
                            {review.comment}
                          </p>
                        )}

                        {/* Ваш відгук - можна видалити (за вашим візитом) */}
                        {myTokenByAppointment.has(Number(review.appointment_id)) && (
                          confirmDeleteReview === review.id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.7rem', fontSize: '0.85rem', color: '#A83934', flexWrap: 'wrap' }}>
                              <span>Видалити ваш відгук?</span>
                              <button type="button" onClick={() => void deleteMyReview(review)}
                                style={{ height: '30px', padding: '0 0.8rem', borderRadius: '8px', border: 'none', background: '#A83934', color: '#fff', fontFamily: 'inherit', fontSize: '0.8rem', cursor: 'pointer' }}>Так, видалити</button>
                              <button type="button" onClick={() => setConfirmDeleteReview(null)}
                                style={{ height: '30px', padding: '0 0.8rem', borderRadius: '8px', border: '1px solid #E4EBE3', background: '#fff', fontFamily: 'inherit', fontSize: '0.8rem', cursor: 'pointer' }}>Ні</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => setConfirmDeleteReview(review.id)}
                              style={{ marginTop: '0.6rem', border: 'none', background: 'none', padding: 0, fontFamily: 'inherit', fontSize: '0.8rem', color: '#86868B', cursor: 'pointer' }}>
                              Ваш відгук · Видалити
                            </button>
                          )
                        )}

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
            <div ref={sideRef} style={{ position: 'sticky', top: `${sideTop}px`, alignSelf: 'start', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

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
                  {storefrontTeam.length > TEAM_PREVIEW && (
                    <button
                      type="button"
                      onClick={() => setTeamExpanded(v => !v)}
                      style={{ background: 'transparent', border: 'none', color: '#475569', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      {teamExpanded ? 'Згорнути' : `Показати всіх (${storefrontTeam.length})`}
                    </button>
                  )}
                </div>

                {/* Блок «Наша команда» бере activeTeam - список БЕЗ прихованих.
                    staffers тут не годиться: він для вибору майстра при бронюванні. */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: '1.25rem 0.75rem' }}>
                  {(teamExpanded ? storefrontTeam : storefrontTeam.slice(0, TEAM_PREVIEW)).map((staff: any) => (
                    <button
                      key={staff.id}
                      type="button"
                      onClick={() => openMasterCard(staff)}
                      title="Рейтинг і відгуки"
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', color: 'inherit' }}
                    >
                      <div className="team-avatar" style={{ width: '50px', height: '50px', borderRadius: '50%', marginBottom: '0.45rem', position: 'relative', flexShrink: 0, overflow: 'hidden', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {staff.photo ? (
                          <Image {...imageLoadProps(staff.photo)} src={staff.photo} alt={staff.name} fill sizes="50px" style={{ objectFit: 'cover' }} />
                        ) : (
                          <div style={{ display: 'flex', width: '22px', height: '22px', color: '#86868B' }}><Icons.User /></div>
                        )}
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1D1D1F', lineHeight: '1.25', width: '100%', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere', wordBreak: 'break-word' }} title={staff.name}>
                        {staff.name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#86868B', marginTop: '2px', lineHeight: 1.25, width: '100%', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere', wordBreak: 'break-word' }} title={staff.role}>
                        {staff.role}
                      </div>
                      {staff.rating ? (
                        <div style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '999px', background: '#f5f5f7', fontSize: '0.76rem', fontWeight: 700, color: '#1D1D1F' }}>
                          <span style={{ color: '#f59e0b', fontSize: '0.8rem' }}>★</span>{Number(staff.rating).toFixed(1)}
                          <span style={{ color: '#86868B', fontWeight: 500 }}>· {staff.reviewsCount}</span>
                        </div>
                      ) : (
                        <div style={{ marginTop: '6px', fontSize: '0.72rem', color: '#b0b0b6' }}>Без оцінок</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              )}

              {/* РОБОТИ МАЙСТРІВ - портфоліо, яке майстри додають у кабінеті.
                  Лише коли хтось щось додав: порожній блок нічого не каже. */}
              {portfolio.length > 0 && (
              <div className="section-card" style={{ padding: '1.75rem 2rem' }}>
                <h3 className="section-title" style={{ fontSize: '1.25rem', margin: '0 0 1.25rem' }}>Роботи майстрів</h3>
                {portfolio.map(m => (
                  <div key={m.user_id} style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.7rem' }}>
                      <span style={{ width: 30, height: 30, borderRadius: '50%', background: '#EEF1F6', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, position: 'relative' }}>
                        {m.avatar_url ? <SmartImage src={m.avatar_url} alt="" width={30} height={30} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : m.name.slice(0, 1)}
                      </span>
                      <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{m.name}</span>
                      <span style={{ fontSize: '0.8rem', color: '#86868B' }}>{m.items.length}</span>
                    </div>
                    <div className="hide-scrollbar" style={{ display: 'flex', gap: '0.6rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                      {m.items.map(it => (
                        <button key={it.id} type="button" onClick={() => setPortfolioOpen(it)}
                          style={{ flex: '0 0 auto', width: 150, aspectRatio: '4 / 5', borderRadius: 12, overflow: 'hidden', position: 'relative', border: 'none', padding: 0, cursor: 'zoom-in', background: '#F5F5F7' }}>
                          <SmartImage src={it.image_url} alt={it.caption || `Робота: ${m.name}`} fill sizes="150px" style={{ objectFit: 'cover' }} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              )}
              {portfolioOpen && (
                <div onClick={() => setPortfolioOpen(null)} role="dialog" aria-label="Робота майстра"
                  style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,.82)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', cursor: 'zoom-out' }}>
                  <SmartImage src={portfolioOpen.image_url} alt={portfolioOpen.caption || ''} width={1400} height={1750} sizes="90vw"
                    style={{ maxWidth: '90vw', maxHeight: '82vh', width: 'auto', height: 'auto', borderRadius: 14, objectFit: 'contain' }} />
                  {portfolioOpen.caption && <div style={{ color: '#fff', marginTop: '0.9rem', fontSize: '0.95rem' }}>{portfolioOpen.caption}</div>}
                </div>
              )}

              {/* КАРТА
                  showMap теж не перевірявся: власник вимикав карту
                  в редакторі, а клієнт її бачив. */}
              {salon?.layout_config?.showMap !== false && salonMap && (
              <div className="section-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ height: '200px', width: '100%', position: 'relative', overflow: 'hidden', borderRadius: '24px 24px 0 0', background: '#e2e8f0' }}>
                  <div style={{ position: 'absolute', top: '-160px', left: '-160px', width: 'calc(100% + 320px)', height: 'calc(100% + 320px)' }}>
                    <iframe
                      src={salonMap.embedUrl}
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
                    href={salonMap.link}
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

          <div className="footer-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: '3rem', marginBottom: '3.5rem' }}>

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
                <Link href="/business#features" className="footer-nav-link">Можливості для бізнесу</Link>
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

          <SmartImage width={1600} height={1200} sizes="88vw"
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
        <div className="apple-modal-overlay" onClick={closeModal} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', padding: '1rem', boxSizing: 'border-box' }}>
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
                          <span className={`bk-step-label ${isActive ? 'is-active' : ''}`} style={{ fontSize: '0.85rem', fontWeight: isActive ? 600 : 500, color: '#1D1D1F' }}>
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
                    Чекаємо на вас <strong>{fmtLongDate(selectedDate)}</strong> о <strong>{selectedTime}</strong>.
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
                                <span>{formatDuration(isSelected && selectedAddonIds.length > 0 ? totalCalculatedDuration : (srv.duration_minutes || srv.duration || 60))}</span>
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
                                            +{formatDuration(addon.duration_minutes)}
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
                              <Image {...imageLoadProps(staff.photo)} src={staff.photo} alt={staff.name} fill sizes="52px" style={{ objectFit: 'cover' }} />
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
                  <div className="bk-two" style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: '2.5rem' }}>

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
                          {fmtLongDate(selectedDate)}
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

                  <div className="bk-two" style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: '2rem' }}>
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
                            {fmtLongDate(selectedDate)} о {selectedTime}
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#86868B', fontSize: '0.88rem' }}>Тривалість</span>
                          <span style={{ fontWeight: '600', color: '#1D1D1F', fontSize: '0.92rem' }}>
                            ~{formatDuration(totalCalculatedDuration)}
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

                      <label style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start', marginTop: '1rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={marketingConsent}
                          onChange={(e) => setMarketingConsent(e.target.checked)}
                          style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: '#222222', flexShrink: 0 }}
                        />
                        <span style={{ fontSize: '0.8rem', lineHeight: 1.45, color: '#6E6E73' }}>
                          Хочу отримувати новини та пропозиції цього закладу на пошту. Відписатися можна в будь-який момент.
                        </span>
                      </label>
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