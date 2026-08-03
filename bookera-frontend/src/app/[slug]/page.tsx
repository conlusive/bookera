'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/utils/supabase/client';
import { Icons } from '@/components/shared';

// === 1. СТАТИЧНІ ДАНІ, КОНСТАНТИ ТА ХЕЛПЕРИ ===
const SERVICES_PER_PAGE = 5;
const REVIEWS_PER_PAGE = 5;
const REVIEW_MAX_LENGTH = 500;
const LOCK_TIMEOUT_MINUTES = 10;

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

const parseTime = (timeStr: string) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

const formatTime = (mins: number) => {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const isTimeOverlapping = (reqStart: number, reqEnd: number, bStart: number, bEnd: number) => {
  return reqStart < bEnd && bStart < reqEnd;
};

// =======================================================

export default function SalonProfile() {
  const { slug } = useParams();
  const router = useRouter();
  const supabase = createClient();

  // --- Стейт даних ---
  const [salon, setSalon] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [bookedAppointments, setBookedAppointments] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // --- Стейт юзера ---
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [initials, setInitials] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('client');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // --- Стейт авторизації (Модалка) ---
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLoginView, setIsLoginView] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');

  // --- Стейт для хедера (Локальний пошук) ---
  const [headerSearchWhat, setHeaderSearchWhat] = useState('');
  const [headerSearchWhere, setHeaderSearchWhere] = useState('Львів');
  const [headerSearchDate, setHeaderSearchDate] = useState('');
  const [searchTime, setSearchTime] = useState(''); // 🔥 Додано стейт для часу як на головній
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

  // --- Відгуки ---
  const [reviewFilter, setReviewFilter] = useState('all');
  const [currentReviewPage, setCurrentReviewPage] = useState(1);
  const [expandedReviews, setExpandedReviews] = useState<Record<string, boolean>>({});
  const [reviewRating, setReviewRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // --- Бронювання (Модальне вікно) ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bookingStage, setBookingStage] = useState<'selection' | 'confirmation'>('selection');
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const [selectedMasterId, setSelectedMasterId] = useState<number | string>(0);
  const [pendingBookingId, setPendingBookingId] = useState<number | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // --- Календар та дні ---
  const calendarDays = useMemo(() => {
    const days = [];
    const today = new Date();
    const dayNames = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const daysOff = salon?.days_off || [];

    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);

      if (!daysOff.includes(d.getDay())) {
        days.push({
          date: fmtDate(d),
          dayNum: String(d.getDate()),
          dayName: dayNames[d.getDay()]
        });
      }
    }
    return days;
  }, [salon]);

  const galleryPhotos = useMemo(() => {
    if (!salon) return [];
    const photos = [];
    if (salon.cover_photo) photos.push(salon.cover_photo);
    if (salon.workplace_photos && Array.isArray(salon.workplace_photos)) photos.push(...salon.workplace_photos);
    return Array.from(new Set(photos));
  }, [salon]);

  // --- Ефекти ---
  useEffect(() => {
    setVisibleServicesCount(SERVICES_PER_PAGE);
  }, [searchQuery, sortOrder]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedName = localStorage.getItem('userName');
      const storedRole = localStorage.getItem('userRole') || 'client';
      if (storedName) {
        setIsLoggedIn(true);
        setUserName(storedName);
        setUserRole(storedRole);
        const nameParts = storedName.split(' ');
        const init = nameParts.length > 1 ? nameParts[0][0] + nameParts[1][0] : nameParts[0][0];
        setInitials(init.toUpperCase());
      }
    }
    if (slug) void loadDataFromSupabase();
  }, [slug]);

  const fetchBookings = async (bizId: number) => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('business_id', bizId)
      .neq('status', 'cancelled');

    if (error) {
      console.error("Помилка оновлення розкладу:", error);
      return;
    }

    if (data) {
      const now = Date.now();
      const validBookings = data.filter((b: any) => {
        if (b.status === 'blocked' && b.created_at) {
          const lockTime = new Date(b.created_at).getTime();
          if (now - lockTime > LOCK_TIMEOUT_MINUTES * 60000) return false;
        }
        return true;
      });
      setBookedAppointments(validBookings);
    }
  };

  // 🔥 Виправлений useEffect для Realtime (БЕЗ синтаксичних помилок)
  useEffect(() => {
    if (!salon?.id) return;

    const channel = supabase
      .channel(`room_${salon.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        (payload: any) => { // Додано : any
          const newRecord = payload.new;
          const oldRecord = payload.old;

          if (
            (newRecord && newRecord.business_id === salon.id) ||
            (oldRecord && oldRecord.business_id === salon.id) ||
            (!newRecord?.business_id && !oldRecord?.business_id)
          ) {
             fetchBookings(salon.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [salon?.id]);


  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (pendingBookingId && !bookingSuccess) {
        const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/bookings?id=eq.${pendingBookingId}&status=eq.blocked`;
        fetch(url, {
          method: 'DELETE',
          headers: {
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
          },
          keepalive: true
        }).catch(console.error);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (pendingBookingId && !bookingSuccess) {
        supabase.from('bookings').delete().eq('id', pendingBookingId).eq('status', 'blocked').then();
      }
    };
  }, [pendingBookingId, bookingSuccess]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileRef.current && !profileRef.current.contains(target)) setIsProfileOpen(false);
      if (sortRef.current && !sortRef.current.contains(target)) setIsSortOpen(false);
      if (headerDateRef.current && !headerDateRef.current.contains(target)) setIsDateOpen(false);
    };
    const handleScrollClose = () => {
      if (isProfileOpen) setIsProfileOpen(false);
      if (isSortOpen) setIsSortOpen(false);
      if (isDateOpen) setIsDateOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollClose, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollClose);
    };
  }, [isProfileOpen, isSortOpen, isDateOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
        setCurrentImageIndex(null);
      }
      if (currentImageIndex !== null) {
        if (e.key === 'ArrowRight') setCurrentImageIndex(prev => prev === galleryPhotos.length - 1 ? 0 : (prev || 0) + 1);
        if (e.key === 'ArrowLeft') setCurrentImageIndex(prev => prev === 0 ? galleryPhotos.length - 1 : (prev || 0) - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentImageIndex, galleryPhotos.length]);

  const handleHeaderSearch = () => {
    const params = new URLSearchParams();
    if (headerSearchWhat) params.append('what', headerSearchWhat);
    if (headerSearchWhere) params.append('where', headerSearchWhere);
    if (headerSearchDate) params.append('date', headerSearchDate);
    if (searchTime) params.append('time', searchTime);

    // Перекидаємо на головну з усіма параметрами в URL
    router.push(`/?${params.toString()}`);
  };

  // --- Завантаження початкових даних ---
  const loadDataFromSupabase = async () => {
    if (!salon) setLoading(true);

    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug as string);
      let query = supabase.from('businesses').select('*');
      if (isUUID) {
        query = query.eq('id', slug);
      } else {
        query = query.eq('slug', slug);
      }

      const { data: bizData, error: bizErr } = await query.single();

      if (bizErr || !bizData) {
        console.error("Салон не знайдено або помилка:", bizErr);
        setNotFound(true);
        setLoading(false);
        return;
      }

      if (bizData) {
        if (isUUID && bizData.slug) {
          router.replace(`/${bizData.slug}`);
          return;
        }

        setSalon(bizData);

        const [srvRes, staffRes, revRes] = await Promise.all([
          supabase.from('services').select('*').eq('business_id', bizData.id).order('order_index', { ascending: true }),
          supabase.from('staff').select('*').eq('business_id', bizData.id),
          supabase.from('reviews').select('*').eq('business_id', bizData.id).order('created_at', { ascending: false })
        ]);

        if (srvRes.data) setServices(srvRes.data);
        if (staffRes.data) setTeam(staffRes.data);
        if (revRes.data) setReviews(revRes.data);

        await fetchBookings(bizData.id);
      }
    } catch (error) {
      console.error("Непередбачена помилка:", error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  // --- Обчислювальні дані ---
  const activeTeam = useMemo(() => team.filter(staff => staff.provides_services !== false), [team]);
  const staffers = useMemo(() => {
    const list: any[] = [{ id: 0, name: "Будь-хто", role: "Без переваг", photo: null }];
    activeTeam.forEach((t) => list.push({ id: t.id, name: t.name, role: t.role || "Майстер", photo: t.photo || t.avatar_url || null }));
    return list;
  }, [activeTeam]);

  const allAvailableHours = useMemo(() => {
    if (!salon) return [];
    const slots = [];
    const openTimeStr = salon.open_time || '10:00';
    const closeTimeStr = salon.close_time || '20:00';
    const startHour = parseInt(openTimeStr.split(':')[0], 10);
    const endHour = parseInt(closeTimeStr.split(':')[0], 10);

    for (let h = startHour; h <= endHour; h++) {
      for (let m = 0; m < 60; m += 15) {
        if (h === endHour && m > 0) continue;
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    return slots;
  }, [salon]);

  const getAvailableMasterForSlot = (date: string, reqStart: number, reqEnd: number, specificMasterId: string | number) => {
    const daysBookings = bookedAppointments.filter((b: any) => b.booking_date === date);

    if (specificMasterId !== 0 && specificMasterId !== '0') {
      const isBusy = daysBookings.some((b: any) => {
        if (String(b.staff_id) !== String(specificMasterId)) return false;
        const bStart = parseTime(b.start_time.substring(0, 5));
        const bEnd = parseTime(b.end_time.substring(0, 5));
        return isTimeOverlapping(reqStart, reqEnd, bStart, bEnd);
      });
      return isBusy ? null : specificMasterId;
    } else {
      if (activeTeam.length === 0) return 0;
      for (let master of activeTeam) {
        const isBusy = daysBookings.some((b: any) => {
          if (String(b.staff_id) !== String(master.id)) return false;
          const bStart = parseTime(b.start_time.substring(0, 5));
          const bEnd = parseTime(b.end_time.substring(0, 5));
          return isTimeOverlapping(reqStart, reqEnd, bStart, bEnd);
        });
        if (!isBusy) return master.id;
      }
      return null;
    }
  };

  const checkSlotAvailability = (date: string, timeStr: string, durationMins: number, specificMasterId: number | string = 0) => {
    const reqStart = parseTime(timeStr);
    const reqEnd = reqStart + durationMins;
    const availableMaster = getAvailableMasterForSlot(date, reqStart, reqEnd, specificMasterId);
    return availableMaster !== null;
  };

  const getServiceAvailabilityText = (service: any) => {
    const duration = service.duration || service.duration_minutes || 60;
    const freeSlots = [];
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const todayStr = fmtDate(now);

    for (const day of calendarDays) {
      if (freeSlots.length >= 2) break;
      for (const time of allAvailableHours) {
        if (freeSlots.length >= 2) break;
        if (day.date === todayStr && parseTime(time) <= currentMins) continue;
        if (checkSlotAvailability(day.date, time, duration, 0)) {
          freeSlots.push({ date: day.date, time: time, dayName: day.dayName, dayNum: day.dayNum });
        }
      }
    }

    if (freeSlots.length === 0) return "Немає вільних годин найближчим часом";
    const first = freeSlots[0];
    const second = freeSlots[1];
    const isToday = first.date === todayStr;
    const isTomorrow = first.date === calendarDays[1]?.date;

    let textPrefix = "";
    if (isToday) textPrefix = "Є час сьогодні:";
    else if (isTomorrow) textPrefix = "Найближчий час на завтра:";
    else textPrefix = `Найближчий запис ${first.dayNum} ${first.dayName.toLowerCase()}:`;

    let timesText = first.time;
    if (second && second.date === first.date) timesText += `, ${second.time}`;
    return `${textPrefix} ${timesText}`;
  };

  const processedServices = useMemo(() => {
    let result = [...services];
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(lowerQuery));
    }
    if (sortOrder === 'price_asc') result.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    else if (sortOrder === 'price_desc') result.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    else if (sortOrder === 'duration') result.sort((a, b) => (a.duration || a.duration_minutes || 0) - (b.duration || b.duration_minutes || 0));
    return result;
  }, [services, searchQuery, sortOrder]);

  const displayedServices = useMemo(() => {
    return processedServices.slice(0, visibleServicesCount);
  }, [processedServices, visibleServicesCount]);

  const filteredReviews = useMemo(() => {
    let filtered = [...reviews];
    if (reviewFilter === 'positive') filtered = filtered.filter(r => r.rating >= 4);
    if (reviewFilter === 'negative') filtered = filtered.filter(r => r.rating <= 3);
    return filtered;
  }, [reviews, reviewFilter]);

  const paginatedReviews = useMemo(() => {
    const start = (currentReviewPage - 1) * REVIEWS_PER_PAGE;
    return filteredReviews.slice(start, start + REVIEWS_PER_PAGE);
  }, [filteredReviews, currentReviewPage]);

  const totalReviewPages = Math.ceil(filteredReviews.length / REVIEWS_PER_PAGE);

  // --- Функції Модалки Авторизації ---
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

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', data.user.id)
          .single();

        const metadataName = data.user?.user_metadata?.full_name || data.user?.user_metadata?.name;
        let finalName = profile?.full_name || metadataName || 'Гість';

        if (finalName.includes('@')) {
          finalName = 'Користувач';
        }

        const finalRole = profile?.role || 'client';

        localStorage.setItem('userName', finalName);
        localStorage.setItem('userRole', finalRole);
        localStorage.setItem('userId', data.user.id);

        setUserName(finalName);
        setUserRole(finalRole);
        const nameParts = finalName.split(' ');
        const init = nameParts.length > 1 ? nameParts[0][0] + nameParts[1][0] : nameParts[0][0];
        setInitials(init.toUpperCase());

        setIsLoggedIn(true);
        setIsAuthModalOpen(false);

        if (finalRole === 'vendor') {
          router.push('/cabinet');
        }
      } else {
        const targetEmail = loginEmail.trim().toLowerCase();
        const targetFullName = `${regFirstName} ${regLastName}`.trim();

        const { data, error } = await supabase.auth.signUp({
          email: targetEmail,
          password: loginPassword,
          options: {
            data: { full_name: targetFullName }
          }
        });

        if (error) {
          alert(`Помилка реєстрації: ${error.message}`);
          return;
        }

        localStorage.setItem('userName', targetFullName);
        localStorage.setItem('userRole', 'client');
        if (data?.session?.user) {
          localStorage.setItem('userId', data.session.user.id);
        }

        setUserName(targetFullName);
        setUserRole('client');
        setInitials((regFirstName[0] + (regLastName[0] || '')).toUpperCase());

        setIsLoggedIn(true);
        setIsAuthModalOpen(false);
      }
    } catch (error) {
      alert("Відбулася непередбачувана помилка при з'єднанні з сервером.");
    }
  };

  // --- Обробники подій модалки бронювання ---
  const openModal = (service: any) => {
    setSelectedService(service);
    setBookingStage('selection');
    setSelectedTime(null);
    if (calendarDays.length > 0) setSelectedDate(calendarDays[0].date);
    setIsModalOpen(true);
  };

  const closeModal = async () => {
    setIsModalOpen(false);

    if (pendingBookingId && !bookingSuccess) {
      await supabase.from('bookings').delete().eq('id', pendingBookingId).eq('status', 'blocked');
    }

    setTimeout(() => {
      setBookingStage('selection');
      setBookingSuccess(false);
      setPendingBookingId(null);
    }, 300);
  };

  const handleNextStep = async () => {
    if (!selectedTime) return alert("Оберіть час!");
    if (!isLoggedIn) {
       setIsAuthModalOpen(true);
       return;
    }

    const duration = selectedService?.duration || selectedService?.duration_minutes || 60;
    const reqStart = parseTime(selectedTime!);
    const reqEnd = reqStart + duration;

    const { data: doubleCheckData } = await supabase.from('bookings')
      .select('*')
      .eq('business_id', salon.id)
      .eq('booking_date', selectedDate);

    if (doubleCheckData) {
        const now = Date.now();
        const conflict = doubleCheckData.some(b => {
           if (b.status === 'cancelled') return false;
           if (b.status === 'blocked' && b.created_at) {
              if (now - new Date(b.created_at).getTime() > LOCK_TIMEOUT_MINUTES * 60000) return false;
           }
           if (String(b.staff_id) !== String(selectedMasterId) && selectedMasterId !== 0 && selectedMasterId !== '0') return false;

           const bStart = parseTime(b.start_time.substring(0, 5));
           const bEnd = parseTime(b.end_time.substring(0, 5));
           return isTimeOverlapping(reqStart, reqEnd, bStart, bEnd);
        });

        if (conflict) {
           alert("Вибачте, цей час щойно зайняв інший користувач. Будь ласка, оберіть інший.");
           fetchBookings(salon.id);
           return;
        }
    }

    const finalMasterId = getAvailableMasterForSlot(selectedDate, reqStart, reqEnd, selectedMasterId);
    if (finalMasterId === null) {
      alert("Вибачте, цей час щойно зайняли. Будь ласка, оберіть інший.");
      return;
    }

    const endTimeStr = formatTime(reqEnd) + ':00';

    const { data, error } = await supabase.from('bookings').insert([{
      business_id: salon.id,
      service_id: selectedService.id,
      staff_id: finalMasterId,
      client_name: userName || 'Клієнт BookEra',
      client_phone: '+380000000000',
      booking_date: selectedDate,
      start_time: `${selectedTime}:00`,
      end_time: endTimeStr,
      status: 'blocked',
      source: 'DIRECT'
    }]).select().single();

    if (error) {
      console.error("Помилка блокування:", error);
      alert("Цей час щойно почав бронювати інший клієнт. Будь ласка, оберіть інший час.");
      void fetchBookings(salon.id);
      return;
    }

    setPendingBookingId(data.id);
    setSelectedMasterId(finalMasterId);
    setBookingStage('confirmation');
  };

  const handleConfirmBooking = async () => {
    try {
      const bookingSource = localStorage.getItem('booking_source') || 'DIRECT';

      const { error } = await supabase.from('bookings')
        .update({
          status: 'confirmed',
          source: bookingSource
        })
        .eq('id', pendingBookingId);

      if (error) {
        console.error("Помилка підтвердження:", error);
        alert("Помилка бронювання: " + error.message);
        return;
      }

      localStorage.removeItem('booking_source');

      setBookingSuccess(true);
      void fetchBookings(salon.id);
      setTimeout(() => {
        closeModal();
      }, 2500);
    } catch (e: any) {
      console.error(e);
      alert("Непередбачена помилка: " + e.message);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) {
       setIsAuthModalOpen(true);
       return;
    }
    if (reviewRating === 0) return alert("Будь ласка, оберіть кількість зірок.");

    setIsSubmittingReview(true);
    try {
      const newReview = {
        id: Date.now().toString(),
        business_id: salon.id,
        client_name: userName || 'Гість',
        rating: reviewRating,
        comment: reviewText,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase.from('reviews').insert([newReview]);

      if (error) {
        console.error(error);
        alert('Сталася помилка при відправці відгуку.');
        setIsSubmittingReview(false);
        return;
      }

      setReviews([newReview, ...reviews]);
      setReviewRating(0);
      setHoverRating(0);
      setReviewText('');
      setReviewFilter('all');
      setCurrentReviewPage(1);
    } catch (err: any) {
      console.error(err);
      alert('Непередбачена помилка при відправці відгуку.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    setIsLoggedIn(false);
    setIsProfileOpen(false);
    setUserName(null);
    setUserRole('client');
    router.push('/');
  };

  const handleShare = () => {
    const cleanUrl = salon?.slug ? `${window.location.origin}/${salon.slug}` : window.location.href;
    void navigator.clipboard.writeText(cleanUrl);
    alert('Посилання скопійовано в буфер обміну!');
  };

  const mapQuery = encodeURIComponent(salon?.address || 'Львів');
  const mapIframeUrl = `https://maps.google.com/maps?q=${mapQuery}&t=&z=18&ie=UTF8&iwloc=&output=embed`;
  const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return salon?.reviews_rank ? parseFloat(salon.reviews_rank) : 0;
    const total = reviews.reduce((acc, r) => acc + r.rating, 0);
    return total / reviews.length;
  }, [reviews, salon]);
  const totalReviewsCount = reviews.length > 0 ? reviews.length : (salon?.reviews_count ? parseInt(salon.reviews_count) : 0);

  const getDisplayDateTime = () => {
    if (!headerSearchDate && !searchTime) return 'Будь-коли';
    const datePart = headerSearchDate ? new Date(headerSearchDate).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }) : 'Будь-який день';
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

    for (let i = 0; i < startDay; i++) days.push(<div key={`empty-${i}`} style={{ padding: '0.4rem' }}></div>);

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
            if (!isPast) {
              setHeaderSearchDate(isSelected ? '' : dateStr);
            }
          }}
          style={{
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isPast ? 'default' : 'pointer',
            borderRadius: '12px',
            backgroundColor: isSelected ? '#111827' : 'transparent',
            color: isSelected ? '#ffffff' : (isPast ? '#cbd5e1' : '#111827'),
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

  if (notFound) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: '900', color: '#111827' }}>404</h1>
        <p style={{ fontSize: '1.2rem', color: '#64748b', marginTop: '1rem', marginBottom: '2rem' }}>Салон не знайдено.</p>
        <button onClick={() => router.push('/')} className="btn-dark" style={{ padding: '1rem 2rem', borderRadius: '12px' }}>На головну</button>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: '#ffffff',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#222222',
      '--dynamic-accent': salon?.accent_color || '#e83e8c'
    } as React.CSSProperties}>

      <style dangerouslySetInnerHTML={{ __html: `
        .container { max-width: 1340px; margin: 0 auto; padding: 0 4rem; width: 100%; box-sizing: border-box; }
        .anim { transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1); }
        .btn-dark { background-color: #222222 !important; color: #ffffff !important; font-weight: 700; border: none; cursor: pointer; transition: 0.2s; }
        .btn-dark:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(34, 34, 34, 0.15); }
        
        /* 🔥 ХОВЕР ДЛЯ ЛІНКУ "ДЛЯ БІЗНЕСУ" ТА ІНШИХ */
        .header-link { color: #475569; font-weight: 600; font-size: 0.95rem; text-decoration: none; transition: 0.2s; }
        .header-link:hover, .nav-link:hover { color: #8fae92 !important; }
        
        .header-user-wrapper { cursor: pointer; display: flex; align-items: center; gap: 0.6rem; transition: 0.2s; }
        .header-user-name { color: #222222; font-weight: 700; font-size: 0.95rem; transition: 0.2s; }
        .header-user-wrapper:hover .header-user-name { color: #8fae92; }
        .section-card { background-color: #ffffff; border-radius: 24px; padding: 2.5rem; box-shadow: 0 4px 20px rgba(0,0,0,0.03); border: 1px solid #f1f5f9; }
        .section-title { font-size: 1.5rem; font-weight: 800; color: #222222; margin: 0; letter-spacing: -0.02em; }
        .service-pill { background-color: transparent; border-bottom: 1px solid #f1f5f9; padding: 1.5rem 0; display: flex; flex-direction: column; gap: 0.8rem; transition: all 0.2s ease; }
        .service-pill:last-child { border-bottom: none; }
        .service-pill-top { display: flex; justify-content: space-between; align-items: center; width: 100%; }
        .service-availability { display: flex; align-items: center; gap: 0.4rem; color: var(--dynamic-accent); font-size: 0.85rem; font-weight: 700; background: #f8fafc; padding: 0.4rem 0.8rem; border-radius: 8px; width: fit-content; }
        .service-availability.no-slots { background: #fef2f2; color: #ef4444; }
        .service-btn { background: #222222; border: 1px solid #222222; color: #ffffff; padding: 0.5rem 1.25rem; border-radius: 10px; font-weight: 700; font-size: 0.95rem; cursor: pointer; transition: all 0.2s ease; }
        .service-btn:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 4px 12px rgba(34, 34, 34, 0.15); }
        .load-more-btn { width: 100%; background: transparent; border: 1px dashed #cbd5e1; color: #475569; padding: 1rem; border-radius: 16px; font-weight: 600; font-size: 0.95rem; cursor: pointer; transition: all 0.2s ease; display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin-top: 1rem; }
        .load-more-btn:hover { background: #f8fafc; border-color: #94a3b8; color: #222222; }
        .review-filter-btn { background: transparent; border: 1px solid #e2e8f0; color: #64748b; padding: 0.4rem 1rem; border-radius: 99px; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: 0.2s; }
        .review-filter-btn:hover { border-color: #cbd5e1; color: #222222; }
        .review-filter-btn.active { background: #222222; color: #ffffff; border-color: #222222; }
        .page-btn { width: 36px; height: 36px; border-radius: 10px; background: transparent; border: 1px solid #e2e8f0; color: #64748b; font-weight: 700; cursor: pointer; transition: 0.2s; display: flex; justify-content: center; align-items: center; }
        .page-btn:hover { border-color: #cbd5e1; color: #222222; }
        .page-btn.active { background: #222222; color: #ffffff; border-color: #222222; }
        .star-btn { background: transparent; border: none; cursor: pointer; font-size: 1.8rem; line-height: 1; padding: 0 2px; transition: 0.2s; color: #e2e8f0; outline: none; }
        .star-btn.active { color: #f59e0b; }
        .review-textarea { width: 100%; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem 1rem 2rem 1rem; font-size: 0.95rem; font-family: inherit; resize: vertical; min-height: 100px; max-height: 200px; outline: none; transition: 0.2s; background: #ffffff; box-sizing: border-box; }
        .review-textarea:focus { border-color: #222222; box-shadow: 0 0 0 3px rgba(34,34,34,0.05); }
        .review-expand-btn { background: none; border: none; padding: 0; color: #222222; font-weight: 700; font-size: 0.95rem; cursor: pointer; margin-left: 6px; }
        .review-expand-btn:hover { text-decoration: underline; }
        .sort-trigger { display: flex; align-items: center; gap: 0.4rem; background: transparent; border: none; font-size: 0.95rem; color: #64748b; cursor: pointer; padding: 0.5rem 0; transition: color 0.2s; font-family: inherit; font-weight: 500; }
        .sort-trigger:hover { color: #222222; }
        .sort-trigger span { color: #222222; font-weight: 700; }
        .search-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 220px; background: #ffffff; border-radius: 16px; box-shadow: 0 16px 40px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; z-index: 50; max-height: 280px; overflow-y: auto; padding: 0.5rem; }
        .search-dropdown-item { padding: 0.6rem 0.75rem; cursor: pointer; border-radius: 8px; font-size: 0.9rem; color: #334155; transition: background 0.2s; display: flex; justify-content: space-between; align-items: center; text-align: left; width: 100%; border: none; background: transparent; }
        .search-dropdown-item:hover { background: #f8fafc; color: #222222; font-weight: 600; }
        .action-btn { display: flex; align-items: center; gap: 0.4rem; background: #ffffff; border: 1px solid #e2e8f0; color: #222222; padding: 0.6rem 1.2rem; border-radius: 12px; font-weight: 700; font-size: 0.95rem; cursor: pointer; transition: all 0.2s ease; }
        .action-btn:hover { background: #f8fafc; border-color: #cbd5e1; transform: translateY(-1px); }
        .icon-btn:hover { background: #f8fafc !important; border-color: #cbd5e1 !important; transform: translateY(-1px); }
        .team-avatar { width: 50px; height: 50px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #64748b; margin-bottom: 0.75rem; overflow: hidden; background: #f1f5f9; transition: 0.2s; }
        .gallery-main { width: 100%; height: 100%; object-fit: cover; cursor: pointer; transition: 0.3s; }
        .gallery-main:hover { filter: brightness(0.95); }
        .gallery-nav-btn { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.15); border: none; color: white; width: 56px; height: 56px; border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; transition: 0.2s; backdrop-filter: blur(4px); font-size: 2rem; z-index: 2010; font-weight: 300; padding-bottom: 4px; }
        .gallery-nav-btn:hover { background: rgba(255,255,255,0.3); transform: translateY(-50%) scale(1.1); }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @media (max-width: 900px) { .search-loc, .search-date, .search-divider-responsive { display: none !important; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalEntrance { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .modal-backdrop { animation: fadeIn 0.25s ease-out forwards; }
        .modal-content { animation: modalEntrance 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .modal-label { font-size: 0.65rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.75rem; display: block; }
        .master-card { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0.8rem 0.5rem; border-radius: 16px; border: 1.5px solid transparent; background: #f8fafc; cursor: pointer; transition: all 0.2s ease; min-width: 85px; flex-shrink: 0; }
        .master-card:hover:not(.active) { background: #f1f5f9; }
        .master-card.active { border-color: #222222; background-color: #222222; }
        .master-card.active .master-name { color: #ffffff !important; }
        .master-card.active .team-avatar { background-color: #333 !important; color: #fff !important; }
        .date-card { padding: 0.8rem 0.5rem; border-radius: 16px; border: 1.5px solid transparent; background: #f8fafc; cursor: pointer; text-align: center; min-width: 65px; transition: all 0.2s ease; flex-shrink: 0; }
        .date-card:hover:not(.active) { background: #f1f5f9; }
        .date-card.active { background-color: #222222; color: #ffffff !important; border-color: #222222; box-shadow: 0 6px 16px rgba(34, 34, 34, 0.15); }
        .date-card.active .date-name { opacity: 1 !important; color: #ffffff !important; }
        .time-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; max-height: 200px; overflow-y: auto; padding-right: 4px; padding-bottom: 8px; }
        .time-pill { border: none; background-color: #f8fafc; padding: 0.6rem 0.2rem; border-radius: 12px; cursor: pointer; font-size: 0.9rem; font-weight: 700; transition: all 0.2s; color: #475569; width: 100%; border: 1px dashed transparent; }
        .time-pill:hover:not(.busy):not(.active) { background-color: #f1f5f9; border-color: #cbd5e1; }
        .time-pill.active { background-color: #222222 !important; color: #ffffff !important; box-shadow: 0 4px 12px rgba(34, 34, 34, 0.15); border-color: #222222; }
        .time-pill.busy { background-color: transparent !important; color: #cbd5e1 !important; cursor: not-allowed !important; border: 1px dashed #e2e8f0; text-decoration: line-through; }
        .details-row { display: flex; align-items: flex-end; margin-bottom: 1rem; }
        .details-label { color: #64748b; font-size: 0.85rem; padding-right: 8px; font-weight: 600; }
        .details-value { color: #222222; font-size: 0.95rem; font-weight: 800; text-align: right; padding-left: 8px; }
        .details-dots { flex-grow: 1; border-bottom: 1px dashed #cbd5e1; margin-bottom: 4px; opacity: 0.6; }
        .success-circle { width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #ffffff; margin: 0 auto; border: 2px solid #e2e8f0; }
        .success-svg { width: 32px; height: 32px; }
        .success-check { stroke: var(--dynamic-accent); stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 40; stroke-dashoffset: 40; animation: drawCheck 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards; }
        @keyframes drawCheck { to { stroke-dashoffset: 0; } }
        
        .modal-input { width: 100%; padding: 0.85rem 1rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.95rem; box-sizing: border-box; margin-bottom: 1rem; transition: 0.2s; }
        .modal-input:focus { outline: none; border-color: #222222; box-shadow: 0 0 0 3px rgba(34, 34, 34, 0.1); }
        
        .social-btn { display: flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; padding: 0.85rem; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; font-weight: 600; color: #475569; cursor: pointer; transition: 0.2s; font-size: 0.95rem; }
        .social-btn:hover { background-color: #f8fafc; border-color: #cbd5e1; color: #0f172a; }
      `}} />

      {/* 🔥 МОДАЛКА ЛОГІНУ/РЕЄСТРАЦІЇ (як на головній) */}
      {isAuthModalOpen && (
        <div onClick={() => setIsAuthModalOpen(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(17, 24, 39, 0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
          <div className="anim" onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#ffffff', width: '100%', maxWidth: '420px', borderRadius: '24px', padding: '2.5rem', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <button onClick={() => { setIsAuthModalOpen(false); setIsLoginView(true); }} style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', fontSize: '1.2rem', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' }}>×</button>
            <h2 style={{ fontSize: '1.8rem', fontWeight: '800', textAlign: 'center', marginBottom: '0.5rem', color: '#111827', letterSpacing: '-0.02em' }}>{isLoginView ? 'З поверненням' : 'Почати роботу'}</h2>
            <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: '1.4' }}>{isLoginView ? 'Увійдіть, щоб керувати розкладом.' : 'Створіть акаунт для бронювання.'}</p>
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
            <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0', color: '#94a3b8', fontSize: '0.85rem' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }}></div>
              <span style={{ padding: '0 1rem' }}>АБО</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#e2e8f0' }}></div>
            </div>
            <button className="social-btn" onClick={() => alert('Ця функція з\'явиться пізніше')}>Google</button>
            <p style={{ textAlign: 'center', fontSize: '0.9rem', color: '#64748b', marginTop: '1.5rem' }}>{isLoginView ? (<>Немає акаунту? <span onClick={() => setIsLoginView(false)} style={{ color: '#111827', fontWeight: '700', cursor: 'pointer' }}>Створити</span></>) : (<>Вже маєте акаунт? <span onClick={() => setIsLoginView(true)} style={{ color: '#111827', fontWeight: '700', cursor: 'pointer' }}>Увійти</span></>)}</p>
          </div>
        </div>
      )}

      {/* --- HEADER --- */}
      <header style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '72px', backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(16px)', borderBottom: '1px solid #f1f5f9', zIndex: 100, display: 'flex', alignItems: 'center' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', height: '100%', gap: '1rem' }}>

          <div style={{ width: '180px', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#111827', letterSpacing: '-0.04em', transition: 'color 0.3s ease' }}>
                Book<span style={{ color: '#8fae92' }}>Era</span>
              </div>
            </Link>
          </div>

          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start', marginLeft: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.06)', width: '100%', maxWidth: '650px', position: 'relative', height: '42px' }}>
              <div style={{ flex: 1.3, position: 'relative', display: 'flex', alignItems: 'center', padding: '0 0.5rem 0 1rem', height: '100%' }}>
                <div style={{ width: '16px', height: '16px', color: '#94a3b8', marginRight: '0.6rem', flexShrink: 0, display: 'flex' }}><Icons.Search /></div>
                <input type="text" placeholder="Послуга, бренд або салон" value={headerSearchWhat} onChange={(e) => setHeaderSearchWhat(e.target.value)} style={{ width: '100%', border: 'none', outline: 'none', color: '#222222', fontSize: '0.95rem', backgroundColor: 'transparent' }} />
              </div>
              <div style={{ width: '1px', height: '28px', backgroundColor: '#e2e8f0' }}></div>
              <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', padding: '0 0.5rem', height: '100%' }}>
                <div style={{ width: '16px', height: '16px', color: '#94a3b8', marginRight: '0.6rem', flexShrink: 0, display: 'flex' }}><Icons.MapPin /></div>
                <input type="text" placeholder="Місто" value={headerSearchWhere} onChange={(e) => setHeaderSearchWhere(e.target.value)} style={{ width: '100%', border: 'none', outline: 'none', color: '#222222', fontSize: '0.95rem', fontWeight: '600', backgroundColor: 'transparent' }} />
              </div>
              <div style={{ width: '1px', height: '28px', backgroundColor: '#e2e8f0' }}></div>
              <div ref={headerDateRef} onClick={() => setIsDateOpen(!isDateOpen)} style={{ flex: 0.8, position: 'relative', display: 'flex', alignItems: 'center', padding: '0 1.25rem 0 0.5rem', height: '100%', cursor: 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.6rem', flexShrink: 0 }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                <span style={{ color: headerSearchDate || searchTime ? '#222222' : '#64748b', fontSize: '0.95rem', fontWeight: headerSearchDate || searchTime ? '600' : '400', flexGrow: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {getDisplayDateTime()}
                </span>

                {isDateOpen && (
                  <div className="search-dropdown anim" style={{ position: 'absolute', maxHeight: 'none', overflowY: 'visible', padding: '1.5rem', width: '360px', right: 0, left: 'auto', top: 'calc(100% + 14px)', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 24px 50px rgba(0,0,0,0.1)', background: '#fff' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', color: '#64748b', transition: '0.2s' }} onMouseOver={e=>e.currentTarget.style.background='#f8fafc'} onMouseOut={e=>e.currentTarget.style.background='#fff'}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg></button>
                      <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '1rem', textTransform: 'capitalize' }}>{currentMonth.toLocaleString('uk-UA', { month: 'long', year: 'numeric' })}</div>
                      <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', color: '#64748b', transition: '0.2s' }} onMouseOver={e=>e.currentTarget.style.background='#f8fafc'} onMouseOut={e=>e.currentTarget.style.background='#fff'}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg></button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8', fontWeight: '700', marginBottom: '0.5rem', textTransform: 'uppercase' }}><div>Пн</div><div>Вт</div><div>Ср</div><div>Чт</div><div>Пт</div><div>Сб</div><div>Нд</div></div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '1.25rem' }}>{renderCalendarDays()}</div>

                    {/* 🔥 Блок часу як на головній */}
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
              <button onClick={handleHeaderSearch} style={{ width: '34px', height: '34px', borderRadius: '18px', backgroundColor: '#111827', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '8px', marginRight: '4px', flexShrink: 0, transition: '0.2s' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='#334155'} onMouseOut={e=>e.currentTarget.style.backgroundColor='#111827'}>
                <div style={{ display: 'flex', width: '16px', height: '16px', color: '#ffffff' }}><Icons.Search /></div>
              </button>
            </div>
          </div>

          <div style={{ width: '280px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1.5rem' }}>
            <Link href={userRole === 'vendor' ? "/cabinet" : "/business"} className="nav-link" style={{ whiteSpace: 'nowrap', color: '#475569', fontWeight: '600', textDecoration: 'none' }}>Для бізнесу</Link>

            {isLoggedIn ? (
              <div style={{ position: 'relative' }} ref={profileRef}>
                <div onClick={() => setIsProfileOpen(!isProfileOpen)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem', userSelect: 'none', padding: '0.3rem', borderRadius: '20px', transition: '0.2s' }}>
                  <span style={{ color: '#111827', transition: '0.2s', fontSize: '0.95rem', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }}>{userName}</span>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111827', fontWeight: '800', fontSize: '0.9rem', transition: '0.2s', flexShrink: 0 }}>{initials}</div>
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: isProfileOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0 }}><path d="M1 1L5 5L9 1" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: '0.2s' }}/></svg>
                </div>

                {isProfileOpen && (
                  <div className="anim" style={{ position: 'absolute', top: '150%', right: 0, width: '230px', background: '#ffffff', borderRadius: '16px', boxShadow: '0 16px 40px rgba(0,0,0,0.08)', padding: '0.5rem', zIndex: 1001, border: '1px solid #e2e8f0' }}>
                    <div style={{ padding: '0.5rem 1rem 0.75rem 1rem', borderBottom: '1px solid #e2e8f0', marginBottom: '0.5rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Акаунт</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#222222', marginTop: '2px', wordWrap: 'break-word' }}>{userName}</div>
                    </div>
                    <Link href="/profile" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '8px', color: '#334155', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '500', transition: 'all 0.2s ease' }} onClick={() => setIsProfileOpen(false)}>Мій профіль</Link>
                    {userRole === 'vendor' && (<Link href="/cabinet" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '8px', color: '#334155', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '500', transition: 'all 0.2s ease' }} onClick={() => setIsProfileOpen(false)}>Бізнес-кабінет</Link>)}
                    <Link href="/settings" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '8px', color: '#334155', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '500', transition: 'all 0.2s ease' }} onClick={() => setIsProfileOpen(false)}>Налаштування</Link>
                    <button onClick={handleLogout} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.75rem 1rem', borderRadius: '8px', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '500', transition: 'all 0.2s ease', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', borderTop: '1px solid #e2e8f0', marginTop: '4px', paddingTop: '0.85rem' }}>Вийти з акаунту</button>
                  </div>
                )}
              </div>
            ) : (
              <span onClick={() => { setIsLoginView(true); setIsAuthModalOpen(true); }} className="anim" style={{ color: '#111827', cursor: 'pointer', transition: 'color 0.2s ease', fontWeight: '600', fontSize: '0.95rem', whiteSpace: 'nowrap' }} onMouseOver={e=>e.currentTarget.style.color='#8fae92'} onMouseOut={e=>e.currentTarget.style.color='#111827'}>Увійти / Зареєструватись</span>
            )}
          </div>
        </div>
      </header>

      {/* --- ОБКЛАДИНКА ТА ІНФО --- */}
      <section className="container" style={{ marginTop: '110px' }}>
        {galleryPhotos.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: galleryPhotos.length > 1 ? '2fr 1fr' : '1fr', gap: '1rem', width: '100%', height: '420px', marginBottom: '2.5rem' }}>
            <div style={{ borderRadius: '24px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.08)', position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,0.3) 100%)', zIndex: 1, pointerEvents: 'none' }}></div>
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

        <div style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '2.6rem', fontWeight: '800', margin: 0, color: '#222222', letterSpacing: '-0.02em' }}>{salon ? salon.name : "Завантаження..."}</h1>
              {averageRating > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '6px' }}>
                  <span style={{ color: '#f59e0b', fontSize: '1.5rem' }}>★</span>
                  <span style={{ fontSize: '1.8rem', fontWeight: '900', color: '#222222' }}>{averageRating.toFixed(1)}</span>
                  <span style={{ color: '#94a3b8', fontSize: '0.95rem', fontWeight: '600' }}>({totalReviewsCount} відгуків)</span>
                </div>
              ) : (
                <span style={{ marginTop: '8px', padding: '0.4rem 0.8rem', background: '#f1f5f9', color: '#64748b', borderRadius: '10px', fontWeight: '700', fontSize: '0.9rem' }}>Новий заклад</span>
              )}
            </div>
            <div style={{ color: '#64748b', fontSize: '0.95rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <div style={{ display: 'flex', width: '16px', height: '16px', color: '#94a3b8' }}><Icons.MapPin /></div> {salon ? salon.address : "Адреса завантажується..."}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '6px' }}>
            <button className="action-btn" onClick={handleShare}>
              <svg fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{width: '18px', height: '18px'}}><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
              Поділитися
            </button>
            <button className="icon-btn anim" onClick={() => setIsFavorite(!isFavorite)} style={{ width: '42px', height: '42px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <svg fill={isFavorite ? "#ef4444" : "none"} stroke={isFavorite ? "#ef4444" : "#222222"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{width: '20px', height: '20px', transition: '0.2s'}}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>
          </div>
        </div>
      </section>

      {/* --- ОСНОВНИЙ КОНТЕНТ --- */}
      <main className="container main-content-wrapper" style={{ paddingBottom: '6rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '4rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3.5rem' }}>

            {/* СПИСОК ПОСЛУГ */}
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
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
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
                {loading ? (
                  <div style={{ color: '#94a3b8', padding: '1rem 0', fontSize: '1rem', fontWeight: '600' }}>Завантаження послуг...</div>
                ) : processedServices.length === 0 ? (
                  <div style={{ color: '#94a3b8', padding: '2rem 0', fontSize: '1rem', textAlign: 'center', background: '#f8fafc', borderRadius: '16px', fontWeight: '600' }}>За вашим запитом послуг не знайдено.</div>
                ) : (
                  <>
                    {displayedServices.map((service) => {
                      const availText = getServiceAvailabilityText(service);
                      return (
                        <div key={service.id} className="service-pill">
                          <div className="service-pill-top">
                            <div>
                              <div style={{ fontWeight: '800', fontSize: '1.15rem', color: '#222222', marginBottom: '0.3rem' }}>{service.name}</div>
                              <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                 <div style={{ display: 'flex', width: '14px', height: '14px' }}><Icons.Clock /></div> {service.duration || service.duration_minutes || 60} хв
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                              <div style={{ fontWeight: '900', color: 'var(--dynamic-accent)', fontSize: '1.25rem' }}>{service.price} ₴</div>
                              <button className="service-btn" onClick={() => openModal(service)}>Вибрати</button>
                            </div>
                          </div>
                          <div className={`service-availability ${availText === "Немає вільних годин найближчим часом" ? 'no-slots' : ''}`}>
                            {availText === "Немає вільних годин найближчим часом" ? (
                               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                            ) : (
                               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            )}
                            <span>{availText}</span>
                          </div>
                        </div>
                      );
                    })}
                    {processedServices.length > visibleServicesCount && (
                      <button className="load-more-btn anim" onClick={() => setVisibleServicesCount(prev => prev + SERVICES_PER_PAGE)}>
                        Показати ще послуги ({processedServices.length - visibleServicesCount})
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ПРО ЗАКЛАД ТА ВІДГУКИ */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '2.5rem' }}>
              <h2 className="section-title" style={{ marginBottom: '1.5rem' }}>Про заклад</h2>
              <p style={{ color: '#475569', lineHeight: '1.7', fontSize: '1.05rem', margin: 0, whiteSpace: 'pre-wrap', fontWeight: '500' }}>
                {salon?.description || "Сучасний простір краси, де кожен клієнт отримує індивідуальний підхід."}
              </p>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '2.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 className="section-title">Відгуки клієнтів</h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className={`review-filter-btn ${reviewFilter === 'all' ? 'active' : ''}`} onClick={() => {setReviewFilter('all'); setCurrentReviewPage(1);}}>Всі</button>
                  <button className={`review-filter-btn ${reviewFilter === 'positive' ? 'active' : ''}`} onClick={() => {setReviewFilter('positive'); setCurrentReviewPage(1);}}>Позитивні</button>
                  <button className={`review-filter-btn ${reviewFilter === 'negative' ? 'active' : ''}`} onClick={() => {setReviewFilter('negative'); setCurrentReviewPage(1);}}>Негативні</button>
                </div>
              </div>

              <div style={{ padding: '1.5rem', borderRadius: '20px', border: '1px solid #e2e8f0', background: '#f8fafc', marginBottom: '2rem' }}>
                {!isLoggedIn ? (
                  <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                    <p style={{ color: '#475569', fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}>Увійдіть, щоб поділитися враженнями</p>
                    <button onClick={() => setIsAuthModalOpen(true)} className="btn-dark" style={{ padding: '0.7rem 2rem', borderRadius: '12px' }}>Увійти в акаунт</button>
                  </div>
                ) : (
                  <form onSubmit={handleReviewSubmit}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                      <div style={{ fontWeight: '700', color: '#222222', fontSize: '1.05rem' }}>Залишити відгук як <span style={{color: '#C2D8C4', marginLeft: '4px', fontWeight: '800'}}>{userName}</span></div>
                      <div style={{ display: 'flex', gap: '2px' }} onMouseLeave={() => setHoverRating(0)}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button key={star} type="button" className={`star-btn ${(hoverRating || reviewRating) >= star ? 'active' : ''}`} onMouseEnter={() => setHoverRating(star)} onClick={() => setReviewRating(star)}>★</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <textarea className="review-textarea" placeholder="Напишіть ваші враження..." value={reviewText} onChange={(e) => setReviewText(e.target.value)} maxLength={REVIEW_MAX_LENGTH} required></textarea>
                      <span style={{ position: 'absolute', bottom: '12px', right: '15px', fontSize: '0.75rem', color: '#94a3b8', fontWeight: '700' }}>{reviewText.length}/{REVIEW_MAX_LENGTH}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                      <button type="submit" disabled={isSubmittingReview} className="btn-dark" style={{ padding: '0.7rem 2rem', borderRadius: '12px' }}>{isSubmittingReview ? 'Відправка...' : 'Надіслати відгук'}</button>
                    </div>
                  </form>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {paginatedReviews.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8', fontSize: '0.95rem', fontWeight: '600' }}>Ще немає відгуків.</div>
                ) : (
                  paginatedReviews.map(review => {
                    const isExpanded = expandedReviews[review.id];
                    const shouldTruncate = review.comment && review.comment.length > 160;
                    const displayedText = (shouldTruncate && !isExpanded) ? review.comment.slice(0, 160) + '...' : review.comment;
                    return (
                      <div key={review.id} style={{ padding: '1.5rem', borderRadius: '20px', border: '1px solid #f1f5f9', background: '#fff', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <div style={{ fontWeight: '800', color: '#222222', fontSize: '1rem' }}>{review.client_name}</div>
                          <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600' }}>{new Date(review.created_at).toLocaleDateString('uk-UA')}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '3px', marginBottom: '0.75rem' }}>
                          {[...Array(5)].map((_, i) => <span key={i} style={{ color: i < review.rating ? '#f59e0b' : '#e2e8f0', fontSize: '1.1rem' }}>★</span>)}
                        </div>
                        <p style={{ color: '#475569', margin: 0, fontSize: '0.95rem', lineHeight: '1.6', fontWeight: '500' }}>
                          {displayedText}
                          {shouldTruncate && <button className="review-expand-btn anim" onClick={() => setExpandedReviews(prev => ({ ...prev, [review.id]: !prev[review.id] }))}>{isExpanded ? 'Згорнути' : 'Показати більше'}</button>}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              {totalReviewPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem' }}>
                  {Array.from({ length: totalReviewPages }).map((_, i) => (
                    <button key={i} onClick={() => setCurrentReviewPage(i + 1)} className={`page-btn ${currentReviewPage === i + 1 ? 'active' : ''}`}>{i + 1}</button>
                  ))}
                </div>
              )}

            </div>
          </div>

          {/* ПРАВА КОЛОНКА */}
          <div>
            <div style={{ position: 'sticky', top: '100px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

              {/* Команда */}
              <div className="section-card" style={{ padding: '2rem' }}>
                <h3 className="section-title" style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Наша команда</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
                  {staffers.slice(1).slice(0, 4).map((staff, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                      <div className="team-avatar" style={{ margin: '0 auto 0.5rem auto', position: 'relative', width: '50px', height: '50px' }}>
                        {staff.photo ? <Image src={staff.photo} alt={staff.name} fill sizes="50px" style={{ objectFit: 'cover' }} /> : <div style={{ display: 'flex', width: '20px', height: '20px' }}><Icons.User /></div>}
                      </div>
                      <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#222222', marginBottom: '0.2rem', textAlign: 'center' }}>{staff.name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '600', textAlign: 'center' }}>{staff.role}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Карта */}
              <div className="section-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: '220px', width: '100%', backgroundColor: '#e2e8f0', position: 'relative', overflow: 'hidden', borderRadius: '24px 24px 0 0' }}>
                   <div style={{ position: 'absolute', top: '-150px', left: '-150px', width: 'calc(100% + 300px)', height: 'calc(100% + 300px)' }}>
                     <iframe src={mapIframeUrl} style={{ width: '100%', height: '100%', border: 0, pointerEvents: 'none' }} allowFullScreen={false} loading="lazy" referrerPolicy="no-referrer-when-downgrade"></iframe>
                   </div>
                </div>
                <div style={{ padding: '1.2rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ color: '#475569', fontSize: '0.95rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', lineHeight: '1.3' }}>
                     <div style={{ display: 'flex', width: '18px', flexShrink: 0, color: '#94a3b8' }}><Icons.MapPin /></div>
                     <span>{salon?.address || "Адреса не вказана"}</span>
                  </div>
                  <a href={googleMapsLink} target="_blank" rel="noopener noreferrer" className="anim" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#222222', fontWeight: '800', fontSize: '0.85rem', padding: '0.5rem 1rem', borderRadius: '10px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    Відкрити
                  </a>
                </div>
              </div>

              {/* Зручності */}
              <div className="section-card" style={{ padding: '2rem' }}>
                <h3 className="section-title" style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Зручності</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#475569', fontSize: '0.85rem', fontWeight: '600' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>Паркування</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#475569', fontSize: '0.85rem', fontWeight: '600' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>Оплата карткою</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#475569', fontSize: '0.85rem', fontWeight: '600' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>Доступність</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#475569', fontSize: '0.85rem', fontWeight: '600' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"/><path d="M12 8a5 5 0 0 0-5 5v3h10v-3a5 5 0 0 0-5-5Z"/><path d="M8 16v6"/><path d="M16 16v6"/></svg>Можна з дітьми</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#475569', fontSize: '0.85rem', fontWeight: '600', gridColumn: 'span 2' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg>Wi-Fi</div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>

      {/* --- ГАЛЕРЕЯ (З ПОВЕРНЕНИМИ СТРІЛКАМИ) --- */}
      {currentImageIndex !== null && galleryPhotos.length > 0 && (
        <div onClick={() => setCurrentImageIndex(null)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)' }}>
           <button style={{ position: 'absolute', top: '2rem', right: '2rem', background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', width: '48px', height: '48px', borderRadius: '50%', cursor: 'pointer', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2010 }} onClick={() => setCurrentImageIndex(null)}>✕</button>
           <button className="gallery-nav-btn" style={{ left: '2rem' }} onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => prev === 0 ? galleryPhotos.length - 1 : (prev || 0) - 1); }}>‹</button>
           <img src={galleryPhotos[currentImageIndex]} alt="Gallery fullscreen view" style={{ maxWidth: '85%', maxHeight: '85%', objectFit: 'contain', borderRadius: '16px', zIndex: 2005 }} onClick={e => e.stopPropagation()} />
           <button className="gallery-nav-btn" style={{ right: '2rem' }} onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => prev === galleryPhotos.length - 1 ? 0 : (prev || 0) + 1); }}>›</button>
        </div>
      )}

      {/* --- МОДАЛЬНЕ ВІКНО БРОНЮВАННЯ --- */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={closeModal} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(34, 34, 34, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ backgroundColor: '#ffffff', borderRadius: '28px', width: '92%', maxWidth: '420px', padding: '2rem', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>

            {/* Кнопка закриття */}
            {!bookingSuccess && (
              <button style={{ background: 'transparent', color: '#94a3b8', border: 'none', cursor: 'pointer', position: 'absolute', top: '1.5rem', right: '1.5rem', padding: '0', display: 'flex', transition: '0.2s', zIndex: 10 }} onMouseOver={e => e.currentTarget.style.color = '#222222'} onMouseOut={e => e.currentTarget.style.color = '#94a3b8'} onClick={closeModal}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            )}

            {bookingSuccess ? (

              // КРОК 3: УСПІХ
              <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                <div className="success-circle">
                  <svg viewBox="0 0 52 52" className="success-svg">
                    <path className="success-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                  </svg>
                </div>
                <h2 style={{ color: '#222222', fontWeight: '900', fontSize: '1.75rem', margin: '1.5rem 0 0.5rem 0', letterSpacing: '-0.02em' }}>Готово!</h2>
                <p style={{ color: '#64748b', fontSize: '1rem', margin: 0, fontWeight: '600' }}>Ваш запис успішно підтверджено.</p>
              </div>

            ) : bookingStage === 'confirmation' ? (

              // КРОК 2: ПЕРЕВІРКА ДЕТАЛЕЙ
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.75rem', height: '24px' }}>
                  <button onClick={() => setBookingStage('selection')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: 0, color: '#94a3b8' }}>
                     <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  </button>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '900', color: '#222222', margin: 0, letterSpacing: '-0.01em' }}>Перевірте деталі</h2>
                </div>

                <div style={{ marginBottom: '2.5rem' }}>
                   <div className="details-row">
                     <span className="details-label">Послуга</span>
                     <div className="details-dots"></div>
                     <span className="details-value">{selectedService?.name}</span>
                   </div>
                   <div className="details-row">
                     <span className="details-label">Майстер</span>
                     <div className="details-dots"></div>
                     <span className="details-value">
                       {selectedMasterId === 0 || selectedMasterId === '0' ? 'Будь-хто' : staffers.find(s => s.id === selectedMasterId)?.name}
                     </span>
                   </div>
                   <div className="details-row">
                     <span className="details-label">Дата та Час</span>
                     <div className="details-dots"></div>
                     <span className="details-value">
                       {selectedDate.split('-').reverse().join('.')} о {selectedTime}
                     </span>
                   </div>
                   <div className="details-row" style={{ marginTop: '2rem', alignItems: 'center' }}>
                     <span className="details-label" style={{ fontWeight: '800', color: '#222222', fontSize: '1.05rem' }}>До сплати</span>
                     <div className="details-dots" style={{ borderBottomColor: 'transparent' }}></div>
                     <span className="details-value" style={{ color: 'var(--dynamic-accent)', fontSize: '1.3rem', fontWeight: '900' }}>{selectedService?.price} ₴</span>
                   </div>
                </div>

                <button onClick={handleConfirmBooking} className="btn-dark anim" style={{ width: '100%', padding: '1.1rem', borderRadius: '16px', fontSize: '1.05rem' }}>
                  Підтвердити запис
                </button>
              </>
            ) : (

              // КРОК 1: ВИБІР ЧАСУ ТА ДАТИ
              <>
                <h2 style={{ fontSize: '1.35rem', fontWeight: '900', color: '#222222', marginBottom: '1.25rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', height: '24px' }}>Бронювання</h2>

                {/* Блок інформації про послугу */}
                <div style={{ background: '#f8fafc', borderRadius: '18px', padding: '1.2rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', border: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                    <div style={{ fontWeight: '800', color: '#222222', fontSize: '1.05rem' }}>{selectedService?.name}</div>
                    <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '600' }}>{selectedService?.duration || selectedService?.duration_minutes || 60} хв</div>
                  </div>
                  <div style={{ fontWeight: '900', color: 'var(--dynamic-accent)', fontSize: '1.2rem' }}>{selectedService?.price} ₴</div>
                </div>

                {/* 1. МАЙСТЕР */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label className="modal-label">1. МАЙСТЕР</label>
                  <div className="hide-scrollbar" style={{ display: 'flex', gap: '0.6rem', overflowX: 'auto', paddingBottom: '4px' }}>
                    {staffers.map((staff) => (
                      <div key={staff.id} onClick={() => { setSelectedMasterId(staff.id); setSelectedTime(null); }} className={`master-card ${selectedMasterId === staff.id ? 'active' : ''}`}>
                        <div className="team-avatar" style={{ margin: '0 auto 0.4rem auto', width: '42px', height: '42px', backgroundColor: selectedMasterId === staff.id ? '#ffffff' : '#f8fafc', color: selectedMasterId === staff.id ? '#222222' : '#64748b' }}>
                          {staff.photo ? <Image src={staff.photo} alt={staff.name} fill sizes="42px" style={{ objectFit: 'cover' }} /> : <div style={{ display: 'flex', width: '18px', height: '18px' }}><Icons.User /></div>}
                        </div>
                        <div className="master-name" style={{ fontSize: '0.85rem', fontWeight: '800', textAlign: 'center', color: '#222222' }}>{staff.name.split(' ')[0]}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. ДАТА */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label className="modal-label">2. ДАТА</label>
                  <div className="hide-scrollbar" style={{ display: 'flex', gap: '0.6rem', overflowX: 'auto', paddingBottom: '4px' }}>
                    {calendarDays.length > 0 ? calendarDays.map((day) => (
                      <div key={day.date} onClick={() => { setSelectedDate(day.date); setSelectedTime(null); }} className={`date-card ${selectedDate === day.date ? 'active' : ''}`}>
                        <div className="date-name" style={{ fontSize: '0.75rem', fontWeight: '800', marginBottom: '0.2rem', textTransform: 'uppercase', opacity: selectedDate === day.date ? 1 : 0.5 }}>{day.dayName}</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '900' }}>{day.dayNum}</div>
                      </div>
                    )) : <div style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: '600' }}>Немає доступних дат</div>}
                  </div>
                </div>

                {/* 3. ЧАС */}
                <div style={{ marginBottom: '2.5rem' }}>
                  <label className="modal-label">3. ЧАС</label>
                  <div className="hide-scrollbar time-grid">
                    {allAvailableHours.map((time) => {
                      const duration = selectedService?.duration || selectedService?.duration_minutes || 60;
                      const busy = !checkSlotAvailability(selectedDate, time, duration, selectedMasterId);
                      const now = new Date();
                      if (selectedDate === fmtDate(now) && parseTime(time) <= (now.getHours() * 60 + now.getMinutes())) return null;
                      return (
                        <button key={time} disabled={busy} onClick={() => setSelectedTime(time)} className={`time-pill ${busy ? 'busy' : ''} ${selectedTime === time ? 'active' : ''}`}>
                          {time}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button onClick={handleNextStep} className="btn-dark anim" style={{ width: '100%', padding: '1.1rem', borderRadius: '16px', fontSize: '1.05rem' }}>
                  Далі
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}