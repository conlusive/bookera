'use client';

import { Suspense, useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';
import Avatar from '@/components/ui/Avatar';
import VisitsHeatmap from '@/components/profile/VisitsHeatmap';
import { getAuthToken } from '@/lib/auth-token-client';
import { useToast } from '@/context/ToastContext';
import {
  CalendarDays,
  MapPin,
  Clock,
  Loader2,
  RotateCcw,
  Gift,
  Coins,
  Heart,
  Settings,
  X,
  AlertTriangle,
  Camera,
  Trash2,
  CalendarPlus,
  Download,
  KeyRound,
  Mail,
  User,
  ShieldAlert,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import SmartImage from '@/components/ui/SmartImage';
import { loadFavorites, setFavorite } from '@/lib/favorites';
import BusinessCard, { BusinessCardStyles } from '@/components/ui/BusinessCard';
import { categoryTitles } from '@/lib/categories';
import WalletTab from '@/components/profile/WalletTab';


// Клієнтська компресія зображення через HTML5 Canvas (до 500x500 WebP)
const compressImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 500;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Помилка компресії зображення'));
          },
          'image/webp',
          0.85
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

function ProfileContent() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();

  // --- Стейт користувача та завантаження ---
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('client');
  const [profile, setProfile] = useState<any>(null);
  const [isHeaderProfileOpen, setIsHeaderProfileOpen] = useState(false);
  const headerProfileRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Активні вкладки ---
  // Вкладка з адреси: «Налаштування» в меню має відкривати саме їх,
  // а не загальний профіль, де їх ще треба знайти.
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams?.get('tab');
  const [activeTab, setActiveTab] = useState<'appointments' | 'favorites' | 'wallet' | 'settings'>(
    (tabFromUrl as any) || 'appointments'
  );
  const [appointmentFilter, setAppointmentFilter] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');

  // --- Дані з БД ---
  const [appointments, setAppointments] = useState<any[]>([]);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<any[]>([]);

  // --- Форма налаштувань ---
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('+380 ');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // --- Зміна Email ---
  const [newEmail, setNewEmail] = useState('');
  const [isChangingEmail, setIsChangingEmail] = useState(false);

  // --- Зміна пароля ---
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // --- Видалення акаунта ---
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // --- Модальні вікна ---
  const [cancelModalAppt, setCancelModalAppt] = useState<any | null>(null);
  const [rescheduleModalAppt, setRescheduleModalAppt] = useState<any | null>(null);
  const [newRescheduleDate, setNewRescheduleDate] = useState<string>('');
  const [newRescheduleTime, setNewRescheduleTime] = useState<string>('12:00');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isSlotsLoading, setIsSlotsLoading] = useState(false);

// Гарантоване завантаження улюблених закладів
  const fetchFavorites = useCallback(async () => {
    try {
      const token = await getAuthToken().catch(() => null);

      // Спільна логіка з головною: сервер - джерело правди.
      //
      // Раніше, якщо на сервері було порожньо, профіль брав список із
      // localStorage, читав заклади НАПРЯМУ з Supabase (правила доступу
      // таке блокують) і дописував їх назад на сервер. Прибрали всі
      // улюблені в одному браузері - інший повертав їх зі свого кешу.
      const { businesses } = await loadFavorites(token);
      const list: any[] = businesses;

      setFavorites(list);
    } catch (err) {
      console.error("Загальна помилка favorites:", err);
      setFavorites([]);
    }
  }, [supabase]);

  // Завантаження профілю та бронювань
  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/');
        return;
      }

      setEmail(user.email || '');

      // 1. Профіль
      // Через бекенд: таблиці profiles у Supabase не існує, дані
      // користувачів живуть у users на сервері.
      const meToken = await getAuthToken().catch(() => null);
      const profileData: any = meToken ? await api.getMe(meToken).catch(() => null) : null;

      if (profileData) {
        setProfile(profileData);
        setFullName(profileData.full_name || '');
        setUserRole(profileData.role || 'client');
        setAvatarUrl(profileData.avatar_url || null);

        if (profileData.avatar_url) {
          localStorage.setItem('userAvatar', profileData.avatar_url);
        }

        if (profileData.phone) {
          const rawDigits = profileData.phone.replace(/^\+380/, '').replace(/\D/g, '');
          setPhone(`+380 ${rawDigits}`);
        }
      } else {
        const storedName = localStorage.getItem('userName') || user.user_metadata?.full_name || 'Користувач';
        setFullName(storedName);
      }

      // 2. Бронювання
      try {
        // Раніше тут був прямий запит до Supabase із умовою
        // `user_id.eq.{id}` або `client_id.eq.{id}`. Обидві хибні:
        // поля user_id в записах немає взагалі, а client_id посилається
        // на клієнта ЗАКЛАДУ - це інший ідентифікатор, ніж обліковий
        // запис. Тому список був порожній завжди.
        //
        // Тепер через API: він шукає за поштою й телефоном - єдиним,
        // що повʼязує акаунт із візитом.
        const token = await getAuthToken();
        const apptsData = await api.listMyAppointments(token);
        setAppointments(apptsData || []);
      } catch (err: any) {
        console.error("Помилка завантаження бронювань:", err);
        // Порожній список і помилка виглядають однаково, але означають
        // різне. Кажемо прямо, інакше людина вважатиме, що записів немає.
        setAppointmentsError(err?.message || 'Не вдалося завантажити записи');
      }

      // 3. Улюблені заклади
      await fetchFavorites();

      setLoading(false);
    }

    void loadData();
  }, [supabase, router, fetchFavorites]);

   // Отримання точного графіку салону, послуги та майстра через реальний API
  useEffect(() => {
    if (!rescheduleModalAppt || !newRescheduleDate) return;

    let isMounted = true;
    async function fetchSlots() {
      setIsSlotsLoading(true);
      setAvailableSlots([]);

      try {
        const bizId = rescheduleModalAppt.business_id || rescheduleModalAppt.businesses?.id;
        const srvId = rescheduleModalAppt.service_id || rescheduleModalAppt.services?.id;
        const mstId = rescheduleModalAppt.master_id || rescheduleModalAppt.staff_id || rescheduleModalAppt.master?.id;

        if (!bizId || !srvId) {
          if (isMounted) setAvailableSlots([]);
          return;
        }

        // 1. Отримуємо слоти для майстра
        const data = await api.getAvailableSlots({
          business_id: Number(bizId),
          service_id: Number(srvId),
          target_date: newRescheduleDate,
          master_id: mstId ? String(mstId) : '0',
        });

        let free = (data.slots || [])
          .filter((s: any) => s.status === 'available')
          .map((s: any) => s.time.substring(0, 5));

        // 2. Якщо саме цей майстер вихідний або зайнятий, перевіряємо вільні вікна інших майстрів закладу
        if (free.length === 0 && mstId && String(mstId) !== '0') {
          try {
            const fallbackData = await api.getAvailableSlots({
              business_id: Number(bizId),
              service_id: Number(srvId),
              target_date: newRescheduleDate,
              master_id: '0',
            });
            free = (fallbackData.slots || [])
              .filter((s: any) => s.status === 'available')
              .map((s: any) => s.time.substring(0, 5));
          } catch {}
        }

        if (isMounted) {
          setAvailableSlots(free);
          if (free.length > 0) {
            setNewRescheduleTime(prev => free.includes(prev) ? prev : free[0]);
          } else {
            setNewRescheduleTime('');
          }
        }
      } catch (err) {
        console.error('Помилка отримання слотів:', err);
        if (isMounted) setAvailableSlots([]);
      } finally {
        if (isMounted) setIsSlotsLoading(false);
      }
    }

    void fetchSlots();
    return () => { isMounted = false; };
  }, [rescheduleModalAppt, newRescheduleDate]);

  // Оновлення списку улюблених при переході на вкладку
  useEffect(() => {
    if (activeTab === 'favorites') {
      void fetchFavorites();
    }
  }, [activeTab, fetchFavorites]);

  // Закриття випадаючого списку профілю
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (headerProfileRef.current && !headerProfileRef.current.contains(event.target as Node)) {
        setIsHeaderProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userAvatar');
    router.push('/');
  };

  // Завантаження та стиснення фото
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsUploadingAvatar(false);
      return;
    }

    try {
      const compressedBlob = await compressImage(file);
      const filePath = `${user.id}/${Date.now()}.webp`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, compressedBlob, {
          contentType: 'image/webp',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      const token = await getAuthToken();
      await api.updateMe(token, { avatar_url: publicUrl });

      setAvatarUrl(publicUrl);
      localStorage.setItem('userAvatar', publicUrl);
      window.dispatchEvent(new Event('storage'));
      showToast('Аватарку оптимізовано та збережено', 'success');
    } catch (err: any) {
      showToast(`Помилка завантаження: ${err.message}`, 'error');
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Видалення фото
  const handleAvatarDelete = async () => {
    if (!confirm('Видалити фото профілю?')) return;
    setIsUploadingAvatar(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsUploadingAvatar(false);
      return;
    }

    try {
      const token = await getAuthToken();
      await api.updateMe(token, { avatar_url: null });

      setAvatarUrl(null);
      localStorage.removeItem('userAvatar');
      window.dispatchEvent(new Event('storage'));
      showToast('Аватарку видалено', 'info');
    } catch (err: any) {
      showToast(`Не вдалося видалити: ${err.message}`, 'error');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

// Видалення салону з улюблених
  /**
   * Файл календаря (.ics) для майбутнього візиту.
   *
   * Відкривається календарем телефона чи компʼютера з уже заповненим
   * записом і нагадуванням за годину. Жодних дозволів і підключень -
   * звичайний файл, який розуміє будь-який календар.
   */
  const downloadIcs = (app: any) => {
    const start = new Date(app.start_time);
    const end = app.end_time ? new Date(app.end_time) : new Date(start.getTime() + 60 * 60000);
    const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const esc = (s: string) => String(s || '').replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
    const title = [app.service_name, app.business_name].filter(Boolean).join(' · ') || 'Візит';
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BookEra//UK', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:bookera-${app.id}@bookera.com.ua`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${esc(title)}`,
      app.business_address ? `LOCATION:${esc(app.business_address)}` : '',
      app.master_name ? `DESCRIPTION:${esc('Майстер: ' + app.master_name)}` : '',
      'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');

    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookera-${app.id}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const walletToken = useCallback(() => getAuthToken().catch(() => null), []);

  // --- Відгук ---
  const [reviewAppt, setReviewAppt] = useState<any | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isSendingReview, setIsSendingReview] = useState(false);
  // Оцінені в цій сесії - щоб кнопка зникла одразу, без перезавантаження.
  const [reviewedIds, setReviewedIds] = useState<number[]>([]);

  const submitReview = async () => {
    if (!reviewAppt || reviewRating < 1) return;
    if (!reviewAppt.manage_token) {
      showToast('Не вдалося надіслати відгук', 'error');
      return;
    }
    setIsSendingReview(true);
    try {
      await api.createVisitReview(reviewAppt.id, reviewAppt.manage_token, reviewRating, reviewText.trim() || undefined);
      setReviewedIds(prev => [...prev, reviewAppt.id]);
      setReviewAppt(null);
      showToast('Дякуємо за відгук!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Не вдалося надіслати відгук', 'error');
    } finally {
      setIsSendingReview(false);
    }
  };

  /**
   * «Час повторити» - на основі вашого ж ритму.
   *
   * Для кожної пари «заклад + послуга» з двома й більше завершеними
   * візитами беремо звичний інтервал (медіану між візитами). Якщо з
   * останнього минуло більше - пропонуємо записатись.
   *
   * Лише за власною історією, без вигаданих норм на кшталт «стрижка
   * раз на місяць»: у кожного свій ритм. Не нагадуємо, якщо запис уже
   * є, і якщо інтервал коротший за тиждень - це не ритм, а збіг.
   */
  const repeatSuggestions = useMemo(() => {
    const now = Date.now();
    const DAY = 86400000;
    const groups = new Map<string, any[]>();
    const upcomingKeys = new Set<string>();

    for (const a of appointments as any[]) {
      if (!a.business_id || !a.service_id || !a.start_time) continue;
      const key = `${a.business_id}:${a.service_id}`;
      const t = new Date(a.start_time).getTime();
      if (a.status === 'completed') {
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(a);
      } else if (a.status !== 'cancelled' && a.status !== 'no-show' && t > now) {
        upcomingKeys.add(key);
      }
    }

    const out: { app: any; usualDays: number; sinceDays: number }[] = [];
    for (const [key, visits] of groups) {
      if (visits.length < 2 || upcomingKeys.has(key)) continue;
      const times = visits.map(v => new Date(v.start_time).getTime()).sort((x, y) => x - y);
      const gaps = times.slice(1).map((t, i) => (t - times[i]) / DAY).sort((x, y) => x - y);
      const usual = gaps[Math.floor(gaps.length / 2)];
      if (usual < 7) continue;
      const since = (now - times[times.length - 1]) / DAY;
      if (since >= usual) {
        const last = visits.reduce((x, y) => (new Date(x.start_time) > new Date(y.start_time) ? x : y));
        out.push({ app: last, usualDays: Math.round(usual), sinceDays: Math.round(since) });
      }
    }
    // Спершу ті, що прострочені найбільше відносно свого ритму.
    return out.sort((x, y) => y.sinceDays / y.usualDays - x.sinceDays / x.usualDays).slice(0, 2);
  }, [appointments]);

  // «4 тижні», «2 місяці» - як сказала б людина, а не «28 днів».
  const humanDays = (d: number) =>
    d < 14 ? `${d} дн.` : d < 60 ? `${Math.round(d / 7)} тиж.` : `${Math.round(d / 30)} міс.`;

  const handleRemoveFavorite = async (businessId: string | number) => {
    const targetBizId = Number(businessId);
    const before = favorites;
    setFavorites(prev => prev.filter(b => Number(b.id) !== targetBizId));

    try {
      const token = await getAuthToken().catch(() => null);
      await setFavorite(targetBizId, false, token, before.map((b: any) => Number(b.id)));
      showToast('Заклад видалено з улюблених', 'info');
    } catch {
      // Сервер не прийняв - повертаємо картку: інакше вона зникла б тут,
      // а в іншому браузері лишилась би.
      setFavorites(before);
      showToast('Не вдалося оновити улюблені', 'error');
    }
  };

  // Зміна Email
  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const formattedEmail = newEmail.trim().toLowerCase();

    if (!formattedEmail || !formattedEmail.includes('@')) {
      showToast('Введіть коректну адресу Email', 'error');
      return;
    }
    if (formattedEmail === email.toLowerCase()) {
      showToast('Цей Email вже використовується вашим акаунтом', 'info');
      return;
    }

    setIsChangingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: formattedEmail });
    setIsChangingEmail(false);

    if (error) {
      showToast(`Помилка: ${error.message}`, 'error');
    } else {
      showToast('Лист із підтвердженням надіслано на вашу пошту', 'success');
      setNewEmail('');
    }
  };

  // Зміна пароля
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast('Пароль повинен містити щонайменше 6 символів', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Паролі не співпадають', 'error');
      return;
    }

    setIsChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsChangingPassword(false);

    if (error) {
      showToast(`Помилка: ${error.message}`, 'error');
    } else {
      showToast('Пароль успішно оновлено', 'success');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  // Повне видалення акаунта
  // Повне видалення акаунта через RPC
  const handleDeleteAccount = async () => {
    if (deleteConfirmInput !== 'ВИДАЛИТИ') {
      showToast('Введіть слово ВИДАЛИТИ для підтвердження', 'error');
      return;
    }

    setIsDeletingAccount(true);

    try {
      // Викликаємо захищену функцію в Supabase
      const { error } = await supabase.rpc('delete_user');

      if (error) throw error;

      await supabase.auth.signOut();
      localStorage.clear();
      showToast('Ваш обліковий запис повністю видалено', 'info');
      router.push('/');
    } catch (err: any) {
      showToast(`Помилка видалення: ${err.message}`, 'error');
      setIsDeletingAccount(false);
    }
  };

  // Введення телефону з перманентним +380
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (!val.startsWith('+380')) {
      val = '+380 ' + val.replace(/^\+?380\s?/, '');
    }
    const digitsOnly = val.slice(4).replace(/\D/g, '').slice(0, 9);
    setPhone(`+380 ${digitsOnly}`);
  };

  // Збереження особистих даних
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const cleanPhone = phone.replace(/\s+/g, '');
    const phoneToSave = cleanPhone.length > 4 ? cleanPhone : null;

    let error: string | null = null;
    try {
      const token = await getAuthToken();
      await api.updateMe(token, { full_name: fullName.trim(), phone: phoneToSave });
    } catch (err: any) {
      error = err?.message || 'Не вдалося зберегти';
    }

    setIsSaving(false);

    if (error) {
      showToast(`Помилка: ${error}`, 'error');
    } else {
      showToast('Дані успішно збережено', 'success');
      localStorage.setItem('userName', fullName.trim());
      window.dispatchEvent(new Event('storage'));
    }
  };

  // Скасування візиту
  const confirmCancelAppointment = async () => {
    if (!cancelModalAppt) return;
    setIsSubmittingAction(true);

    try {
      await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', cancelModalAppt.id);

      setAppointments(prev => prev.map(a => a.id === cancelModalAppt.id ? { ...a, status: 'cancelled' } : a));
      setCancelModalAppt(null);
      showToast('Візит скасовано', 'info');
    } catch {
      showToast('Не вдалося скасувати візит', 'error');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const confirmRescheduleAppointment = async () => {
    if (!rescheduleModalAppt || !newRescheduleDate) {
      showToast('Оберіть нову дату!', 'error');
      return;
    }
    if (!newRescheduleTime) {
      showToast('Оберіть вільний час!', 'error');
      return;
    }
    setIsSubmittingAction(true);

    try {
      const durationMin = (rescheduleModalAppt.start_time && rescheduleModalAppt.end_time)
        ? Math.round((new Date(rescheduleModalAppt.end_time).getTime() - new Date(rescheduleModalAppt.start_time).getTime()) / 60000)
        : (rescheduleModalAppt.services?.duration_minutes || 60);

      const startDt = new Date(`${newRescheduleDate}T${newRescheduleTime}:00`);
      const endDt = new Date(startDt.getTime() + durationMin * 60000);
      const pad = (n: number) => String(n).padStart(2, '0');

      const startStr = `${newRescheduleDate}T${newRescheduleTime}:00`;
      const endStr = `${endDt.getFullYear()}-${pad(endDt.getMonth() + 1)}-${pad(endDt.getDate())}T${pad(endDt.getHours())}:${pad(endDt.getMinutes())}:00`;

      // 1. Оновлюємо безпосередньо в базі даних через API
      const token = await getAuthToken();
      let updatedApp: any = null;

      try {
        updatedApp = await api.rescheduleAppointment(token, Number(rescheduleModalAppt.id), startStr);
      } catch (apiErr) {
        console.warn('api.rescheduleAppointment помилка, резервне оновлення через Supabase:', apiErr);
        const { error: supaErr } = await supabase
          .from('appointments')
          .update({
            start_time: startStr,
            end_time: endStr,
            status: 'confirmed'
          })
          .eq('id', Number(rescheduleModalAppt.id));

        if (supaErr) throw supaErr;
      }

      // 2. Оновлюємо стейт інтерфейсу
      setAppointments(prev => prev.map(a => a.id === rescheduleModalAppt.id ? {
        ...a,
        ...(updatedApp || {}),
        start_time: startStr,
        end_time: endStr,
        status: 'confirmed'
      } : a));

      setRescheduleModalAppt(null);
      showToast('Час візиту успішно змінено', 'success');
    } catch (err: any) {
      console.error('Помилка при зміні часу:', err);
      showToast(err?.message || 'Помилка при зміні часу', 'error');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Google Calendar URL
  const getGoogleCalendarUrl = (app: any) => {
    const title = encodeURIComponent(`${app.services?.name || 'Візит'} — ${app.businesses?.name || 'Салон'}`);
    const location = encodeURIComponent(`${app.businesses?.city || ''}, ${app.businesses?.address || ''}`);
    const dateFormatted = app.date.replace(/-/g, '');
    const timeFormatted = (app.time?.substring(0, 5) || '12:00').replace(/:/g, '') + '00';

    const duration = app.services?.duration_minutes || 60;
    const startHour = parseInt(app.time?.substring(0, 2) || '12');
    const startMin = parseInt(app.time?.substring(3, 5) || '00');
    const endMinutesTotal = startHour * 60 + startMin + duration;
    const endHour = String(Math.floor(endMinutesTotal / 60)).padStart(2, '0');
    const endMin = String(endMinutesTotal % 60).padStart(2, '0');
    const endTimeFormatted = `${endHour}${endMin}00`;

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateFormatted}T${timeFormatted}/${dateFormatted}T${endTimeFormatted}&location=${location}`;
  };

  // Apple Calendar (.ics)
  const downloadAppleIcs = (app: any) => {
    const dateFormatted = app.date.replace(/-/g, '');
    const timeFormatted = (app.time?.substring(0, 5) || '12:00').replace(/:/g, '') + '00';
    const duration = app.services?.duration_minutes || 60;
    const startHour = parseInt(app.time?.substring(0, 2) || '12');
    const startMin = parseInt(app.time?.substring(3, 5) || '00');
    const endMinutesTotal = startHour * 60 + startMin + duration;
    const endHour = String(Math.floor(endMinutesTotal / 60)).padStart(2, '0');
    const endMin = String(endMinutesTotal % 60).padStart(2, '0');
    const endTimeFormatted = `${endHour}${endMin}00`;

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//BookEra Inc//Booking//UA',
      'BEGIN:VEVENT',
      `SUMMARY:${app.services?.name || 'Візит'} — ${app.businesses?.name || 'Салон'}`,
      `LOCATION:${app.businesses?.city || ''}, ${app.businesses?.address || ''}`,
      `DTSTART:${dateFormatted}T${timeFormatted}`,
      `DTEND:${dateFormatted}T${endTimeFormatted}`,
      'DESCRIPTION:Бронювання через сервіс BookEra',
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `visit-${app.date}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Календарний файл .ics завантажено', 'success');
  };

  // Відносні бейджі
  const getRelativeDateBadge = (dateStr: string) => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const targetDate = new Date(dateStr);
    targetDate.setHours(0, 0, 0, 0);

    const diffDays = Math.round((targetDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return <span style={{ backgroundColor: '#f0fdf4', color: '#166534', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700' }}>Сьогодні</span>;
    if (diffDays === 1) return <span style={{ backgroundColor: '#eff6ff', color: '#1e40af', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700' }}>Завтра</span>;
    if (diffDays > 1 && diffDays <= 7) return <span style={{ backgroundColor: '#f8fafc', color: '#475569', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700' }}>Через {diffDays} дн.</span>;
    return null;
  };

  const today = new Date().toISOString().split('T')[0];
  const nowIso = new Date().toISOString();
  const filteredAppointments = useMemo(() => {
    // Порівнюємо ДАТИ, а не рядки.
    //
    // Раніше тут було `appDateIso >= nowIso` - порівняння ISO-рядків.
    // Воно працює лише поки формат у обох однаковий; варто одному
    // прийти без мілісекунд або з іншою зоною - і візит опиняється
    // не в тій вкладці.
    const now = new Date();

    return appointments.filter(app => {
      const start = app.start_time ? new Date(app.start_time) : null;
      if (!start) return false;

      if (appointmentFilter === 'cancelled') {
        return app.status === 'cancelled' || app.status === 'no-show';
      }
      if (app.status === 'cancelled' || app.status === 'no-show') return false;

      // «Майбутні» - ті, що ще не почались і не позначені завершеними.
      // Статус важливіший за час: майстер міг завершити візит достроково.
      if (appointmentFilter === 'upcoming') {
        return start >= now && app.status !== 'completed';
      }

      // «Минулі» - завершені АБО ті, чий час уже минув.
      return app.status === 'completed' || start < now;
    });
  }, [appointments, appointmentFilter]);

  /**
   * Скільки візитів показувати.
   *
   * Порційно, а не сторінками: люди не шукають візит на третій
   * сторінці, вони гортають. Кнопка «Показати ще» дешевша за
   * нумерацію і не вимагає тримати в голові, де ти зараз.
   */
  const PAGE_SIZE = 3;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Зміна вкладки починає показ спочатку: лишити 40 видимих записів
  // після переходу на «Скасовані» означало б показати порожнечу
  // з кнопкою «Показати ще».
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [appointmentFilter]);

  /**
   * Візити, згруповані за місяцями.
   *
   * Суцільний список із двадцяти карток читається як стрічка без
   * орієнтирів. Місяць - природний крок, за яким людина памʼятає
   * свої візити.
   */
  const groupedAppointments = useMemo(() => {
    const visible = filteredAppointments.slice(0, visibleCount);
    const groups: { label: string; items: any[] }[] = [];

    for (const app of visible) {
      const d = app.start_time ? new Date(app.start_time) : null;
      const label = d
        ? d.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' })
        : 'Без дати';
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(app);
      else groups.push({ label, items: [app] });
    }
    return groups;
  }, [filteredAppointments, visibleCount]);

  // Підсумок історії: скільки візитів і в скількох закладах.
  const historySummary = useMemo(() => {
    const done = appointments.filter(a => a.status === 'completed');
    const places = new Set(done.map(a => a.business_id));
    return { visits: done.length, places: places.size };
  }, [appointments]);

  /**
   * Стиль кнопки дії у візиті.
   *
   * Усі три рівнозначні - перенести, скасувати, повторити. Раніше
   * вони були різної ваги й стояли врозтіч: око шукало головну,
   * хоча головної немає, вибір залежить від наміру людини.
   */
  const visitActionStyle: React.CSSProperties = {
    // 34px замість 30 і світліша рамка: дрібні кнопки з темним
    // контуром читаються як елементи форми. Тут вони - тихі дії,
    // до яких звертаються зрідка.
    height: '34px',
    padding: '0 1rem',
    borderRadius: '10px',
    border: '1px solid #E8E8ED',
    background: '#fff',
    color: '#1D1D1F',
    fontSize: '0.875rem',
    fontWeight: 500,
    fontFamily: 'inherit',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
  };

  const upcomingCount = appointments.filter(app => {
    if (!app.start_time) return false;
    if (app.status === 'cancelled' || app.status === 'no-show' || app.status === 'completed') return false;
    return new Date(app.start_time) >= new Date();
  }).length;
  const displayName = fullName || profile?.full_name || 'Користувач';
  const nameParts = displayName.split(' ');
  const initials = nameParts.length > 1 ? nameParts[0][0] + nameParts[1][0] : nameParts[0][0];

  // Пагінація улюблених
  // Категорії серед улюблених - для фільтра.
  const [favCategory, setFavCategory] = useState('all');
  const favCategories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const b of favorites) {
      const slug = String(b.category || '');
      if (slug && !seen.has(slug)) seen.set(slug, categoryTitles[slug] || slug);
    }
    return Array.from(seen, ([slug, title]) => ({ slug, title }));
  }, [favorites]);
  const visibleFavorites = useMemo(
    () => favCategory === 'all' ? favorites : favorites.filter((b: any) => String(b.category) === favCategory),
    [favorites, favCategory],
  );

  // Вільні години сьогодні - для всіх улюблених одним запитом.
  const [favSlots, setFavSlots] = useState<Record<number, string[]>>({});
  const favIdsKey = favorites.map((b: any) => b.id).join(',');
  useEffect(() => {
    if (!favIdsKey) return;
    let cancelled = false;
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    void api.getTodaySlots(favIdsKey.split(',').map(Number), today)
      .then(data => {
        if (cancelled) return;
        const map: Record<number, string[]> = {};
        for (const [id, times] of Object.entries(data)) map[Number(id)] = times;
        setFavSlots(map);
      })
      .catch(() => { /* без годин картка просто показує «Швидкий запис» */ });
    return () => { cancelled = true; };
  }, [favIdsKey]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }}>
        <Loader2 className="w-7 h-7 animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#fafbfc', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, sans-serif', color: '#111827', letterSpacing: '-0.015em' }}>
      <BusinessCardStyles />

      {/* Вікно оцінки візиту */}
      {reviewAppt && (
        <div
          onClick={() => !isSendingReview && setReviewAppt(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem' }}
        >
          <div onClick={e => e.stopPropagation()} role="dialog" aria-label="Оцінити візит"
            style={{ width: '100%', maxWidth: '420px', background: '#fff', borderRadius: '20px', padding: '1.75rem', boxShadow: '0 30px 60px -20px rgba(0,0,0,.35)' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1D1D1F', letterSpacing: '-0.02em' }}>Як усе пройшло?</div>
            <div style={{ fontSize: '0.9rem', color: '#86868B', marginTop: '0.3rem' }}>
              {reviewAppt.service_name || 'Візит'} · {reviewAppt.business_name}
            </div>

            <div style={{ display: 'flex', gap: '0.35rem', margin: '1.25rem 0 1rem' }} role="radiogroup" aria-label="Оцінка">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" role="radio" aria-checked={reviewRating === n} aria-label={`${n} з 5`}
                  onClick={() => setReviewRating(n)}
                  style={{ fontSize: '2rem', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '0.1rem', color: n <= reviewRating ? '#F5A623' : '#E5E5EA', transition: 'color .15s ease, transform .15s ease', transform: n <= reviewRating ? 'scale(1.05)' : 'none' }}>
                  ★
                </button>
              ))}
            </div>

            <textarea
              value={reviewText}
              onChange={e => setReviewText(e.target.value.slice(0, 1000))}
              placeholder="Що сподобалось? Необовʼязково"
              rows={3}
              style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 0.85rem', borderRadius: '12px', border: '1px solid #E5E5EA', fontFamily: 'inherit', fontSize: '0.9rem', resize: 'vertical', outline: 'none' }}
            />

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.1rem' }}>
              <button type="button" onClick={() => setReviewAppt(null)} disabled={isSendingReview}
                style={{ height: '40px', padding: '0 1rem', borderRadius: '10px', border: 'none', background: '#F5F5F7', color: '#1D1D1F', fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 500, cursor: 'pointer' }}>
                Скасувати
              </button>
              <button type="button" onClick={() => void submitReview()} disabled={reviewRating < 1 || isSendingReview}
                style={{ height: '40px', padding: '0 1.2rem', borderRadius: '10px', border: 'none', background: '#1D1D1F', color: '#fff', fontFamily: 'inherit', fontSize: '0.9rem', fontWeight: 600, cursor: reviewRating < 1 ? 'default' : 'pointer', opacity: reviewRating < 1 || isSendingReview ? 0.4 : 1 }}>
                {isSendingReview ? 'Надсилаємо…' : 'Надіслати'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .container { max-width: 1340px; margin: 0 auto; padding: 0 4rem; width: 100%; box-sizing: border-box; }
        @media (max-width: 768px) { .container { padding: 0 1.25rem; } }

        .anim { transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); }

        /* Кнопки */
        .btn-theme { background-color: #C2D8C4 !important; color: #111827 !important; font-weight: 600; border: none; cursor: pointer; }
        .btn-theme:hover { background-color: #b5cdb7 !important; }

        .btn-dark { background-color: #111827; color: #ffffff; font-weight: 600; border: none; cursor: pointer; transition: all 0.2s ease; }
        .btn-dark:hover { background-color: #1f2937; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(17, 24, 39, 0.12); }

        .btn-subtle { background: #ffffff; color: #4b5563; border: 1px solid #e5e7eb; font-weight: 600; cursor: pointer; }
        .btn-subtle:hover { background: #f9fafb; color: #111827; border-color: #d1d5db; }

        .btn-danger-subtle { background: #ffffff; color: #dc2626; border: 1px solid #fee2e2; font-weight: 600; cursor: pointer; }
        .btn-danger-subtle:hover { background: #fef2f2; border-color: #fca5a5; }

        /* Червона кнопка для небезпечної зони */
        .btn-danger-primary { background-color: #ef4444; color: #ffffff; font-weight: 600; border: none; cursor: pointer; transition: all 0.2s ease; }
        .btn-danger-primary:hover { background-color: #dc2626; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2); }

        .nav-item {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.7rem 0.95rem; border-radius: 12px; color: #6b7280; font-weight: 550;
          font-size: 0.92rem; cursor: pointer; border: none; background: transparent; width: 100%; text-align: left;
        }
        .nav-item:hover { background-color: #f1f5f9; color: #111827; }
        .nav-item.active { background-color: #ffffff; color: #111827; font-weight: 650; box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02); }

        .segmented-tabs {
          background-color: #f1f5f9; padding: 3px; border-radius: 10px; display: inline-flex; gap: 3px;
        }
        .segmented-btn {
          padding: 0.4rem 0.9rem; border-radius: 7px; font-size: 0.82rem; font-weight: 600;
          cursor: pointer; border: none; background: transparent; color: #6b7280;
        }
        .segmented-btn.active { background: #ffffff; color: #111827; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }

        .clean-card {
          background: #ffffff; border-radius: 20px; border: 1px solid #f0f0f2;
          box-shadow: 0 1px 3px rgba(0,0,0,0.015);
        }
        .clean-card:hover { border-color: #e5e7eb; box-shadow: 0 4px 16px rgba(0,0,0,0.03); }

        .page-btn { width: 34px; height: 34px; border-radius: 8px; background: #ffffff; border: 1px solid #e2e8f0; color: #475569; font-weight: 700; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .page-btn:hover { border-color: #cbd5e1; color: #111827; }
        .page-btn.active { background: #111827; color: #ffffff; border-color: #111827; }

        .modal-overlay {
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1.25rem;
        }
        .modal-window {
          background: #ffffff; border-radius: 20px; padding: 1.75rem; width: 100%; max-width: 420px;
          box-shadow: 0 20px 40px -8px rgba(0,0,0,0.12); border: 1px solid #f3f4f6; position: relative;
        }

        .clean-input {
          width: 100%; padding: 0.75rem 1rem; border: 1px solid #e5e7eb; border-radius: 12px;
          font-size: 0.9rem; box-sizing: border-box; outline: none; background: #fafafa; transition: all 0.2s ease;
        }
        .clean-input:focus { border-color: #111827; background: #ffffff; box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.04); }

        .time-pill {
          padding: 0.5rem; border-radius: 8px; font-size: 0.82rem; font-weight: 600;
          text-align: center; cursor: pointer; border: 1px solid #e5e7eb; background: #ffffff; color: #4b5563;
        }
        .time-pill.selected { background: #111827; color: #ffffff; border-color: #111827; }
        .time-pill:hover:not(.selected) { background: #f9fafb; }
      `}</style>

      {/* ==================== ХЕДЕР ==================== */}
      <header style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid #f0f0f2', position: 'sticky', top: 0, zIndex: 100 }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '72px' }}>

          {/* ЛОГОТИП */}
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#111827', letterSpacing: '-0.04em' }}>
              Book<span style={{ color: '#8fae92' }}>Era</span>
            </div>
          </Link>

          {/* ПРАВА ЧАСТИНА */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>

            {/* ПРОФІЛЬНИЙ ПІЛЛ */}
            <div style={{ position: 'relative' }} ref={headerProfileRef}>
              <div
                onClick={() => setIsHeaderProfileOpen(!isHeaderProfileOpen)}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.65rem', userSelect: 'none', padding: '0.35rem 0.5rem', borderRadius: '20px', transition: '0.2s' }}
                className="anim"
              >
                <span style={{ color: '#111827', fontSize: '0.95rem', fontWeight: '600', whiteSpace: 'nowrap' }}>
                  {displayName}
                </span>

                {avatarUrl ? (
                  <SmartImage width={36} height={36}
                    src={avatarUrl}
                    alt={displayName}
                    style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#f1f5f9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111827',
                    fontWeight: '800', fontSize: '0.9rem', flexShrink: 0
                  }}>
                    {initials.toUpperCase()}
                  </div>
                )}

                <svg
                  width="10"
                  height="6"
                  viewBox="0 0 10 6"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ transform: isHeaderProfileOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0 }}
                >
                  <path d="M1 1L5 5L9 1" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              {isHeaderProfileOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '210px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 16px 40px rgba(0,0,0,0.08)', padding: '0.4rem', zIndex: 1001 }}>
                  <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600' }}>Акаунт</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                  </div>
                  {userRole === 'vendor' && (
                    <Link href="/cabinet" style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: '8px', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '550', color: '#334155' }}>Панель салону</Link>
                  )}
                  <button onClick={() => { setActiveTab('settings'); setIsHeaderProfileOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: '8px', border: 'none', background: 'transparent', fontSize: '0.85rem', fontWeight: '550', color: '#334155', cursor: 'pointer' }}>Налаштування</button>
                  <button onClick={handleLogout} style={{ width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: '8px', border: 'none', background: 'transparent', fontSize: '0.85rem', fontWeight: '550', color: '#ef4444', cursor: 'pointer', borderTop: '1px solid #f1f5f9', marginTop: '2px' }}>Вийти з акаунту</button>
                </div>
              )}
            </div>

          </div>

        </div>
      </header>

      {/* ==================== ОСНОВНИЙ КОНТЕНТ ==================== */}
      <main style={{ padding: '2.5rem 0 5rem 0' }}>
        <div className="container">

          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '2.5rem', alignItems: 'start' }}>

            {/* ЛІВА КОЛОНКА (НАВІГАЦІЯ) */}
            <aside style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>

              {/* Віджет користувача */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0.25rem 1rem 0.25rem', borderBottom: '1px solid #f1f5f9', marginBottom: '0.5rem' }}>
                {avatarUrl ? (
                  <SmartImage width={40} height={40}
                    src={avatarUrl}
                    alt={displayName}
                    style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <Avatar name={fullName} size={40} />
                )}
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: '700', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayName}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {email}
                  </div>
                </div>
              </div>

              <button onClick={() => setActiveTab('appointments')} className={`nav-item anim ${activeTab === 'appointments' ? 'active' : ''}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <CalendarDays className="w-4 h-4 text-slate-400" />
                  <span>Мої візити</span>
                </div>
                {upcomingCount > 0 && (
                  <span style={{ backgroundColor: '#f1f5f9', color: '#111827', fontSize: '0.75rem', fontWeight: '700', padding: '1px 7px', borderRadius: '99px' }}>
                    {upcomingCount}
                  </span>
                )}
              </button>



              {/* «Бонуси» й «Подарункові картки» прибрано: обидві були
                  заглушками «в розробці». Порожня обіцянка в профілі
                  підточує довіру сильніше, ніж відсутність розділу. */}
              <button onClick={() => setActiveTab('favorites')} className={`nav-item anim ${activeTab === 'favorites' ? 'active' : ''}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <Heart className="w-4 h-4 text-slate-400" />
                  <span>Улюблені</span>
                </div>
                {favorites.length > 0 && (
                  <span style={{ backgroundColor: '#f1f5f9', color: '#111827', fontSize: '0.75rem', fontWeight: '700', padding: '1px 7px', borderRadius: '99px' }}>
                    {favorites.length}
                  </span>
                )}
              </button>
              <button onClick={() => setActiveTab('wallet')} className={`nav-item anim ${activeTab === 'wallet' ? 'active' : ''}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <Gift className="w-4 h-4 text-slate-400" />
                  <span>Бонуси та картки</span>
                </div>
              </button>

              <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '0.4rem 0' }}></div>

              <button onClick={() => setActiveTab('settings')} className={`nav-item anim ${activeTab === 'settings' ? 'active' : ''}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span>Налаштування</span>
                </div>
              </button>
            </aside>

            {/* ПРАВА КОЛОНКА (КОНТЕНТ) */}
            <div style={{ minHeight: '380px', width: '100%' }}>

              {/* 1. ВКЛАДКА: ВІЗИТИ */}
              {activeTab === 'appointments' && (
                <div>
                  {repeatSuggestions.length > 0 && (
                    <div style={{ marginBottom: '1.75rem', padding: '1.25rem 1.4rem', borderRadius: '18px', background: '#F4FAF5' }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#5C7A61', marginBottom: '0.75rem' }}>
                        Час повторити
                      </div>
                      {repeatSuggestions.map(({ app, usualDays, sinceDays }) => (
                        <div key={`${app.business_id}:${app.service_id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.55rem 0', flexWrap: 'wrap' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.975rem', fontWeight: 600, color: '#1D1D1F' }}>
                              {app.service_name || 'Візит'} · {app.business_name}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#5C6B5E', marginTop: '2px' }}>
                              Зазвичай раз на {humanDays(usualDays)} · минуло {humanDays(sinceDays)}
                            </div>
                          </div>
                          {app.business_slug && (
                            <Link
                              href={`/${app.business_slug}?service=${app.service_id}${app.master_id ? `&master=${app.master_id}` : ''}`}
                              style={{ height: '36px', padding: '0 1.1rem', borderRadius: '10px', background: '#1D1D1F', color: '#fff', fontSize: '0.875rem', fontWeight: 500, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
                            >
                              Записатися
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div className="segmented-tabs">
                      <button onClick={() => setAppointmentFilter('upcoming')} className={`segmented-btn anim ${appointmentFilter === 'upcoming' ? 'active' : ''}`}>
                        Майбутні
                      </button>
                      <button onClick={() => setAppointmentFilter('completed')} className={`segmented-btn anim ${appointmentFilter === 'completed' ? 'active' : ''}`}>
                        Завершені
                      </button>
                      <button onClick={() => setAppointmentFilter('cancelled')} className={`segmented-btn anim ${appointmentFilter === 'cancelled' ? 'active' : ''}`}>
                        Скасовані
                      </button>
                    </div>
                  </div>

                  {filteredAppointments.length === 0 ? (
                    <div className="clean-card anim" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#f8fafc', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                        <CalendarDays className="w-5 h-5" />
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.25rem' }}>У вас немає таких візитів</div>
                      <p style={{ color: '#6b7280', fontSize: '0.85rem', maxWidth: '320px', margin: '0 auto 1.25rem auto' }}>
                        Оберіть потрібного майстра чи салон та забронюйте візит онлайн.
                      </p>
                      <Link href="/">
                        <button className="btn-theme anim" style={{ padding: '0.65rem 1.5rem', borderRadius: '999px', fontSize: '0.85rem' }}>
                          Знайти послугу
                        </button>
                      </Link>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

                      {/* Підсумок історії - маленький рядок, який дає
                          відчуття накопиченого, без окремого екрана. */}
                      {appointmentFilter === 'completed' && historySummary.visits > 0 && (
                        <div style={{
                          fontSize: '0.82rem', color: '#8E8E93', marginBottom: '0.9rem',
                          paddingLeft: '0.2rem',
                        }}>
                          {historySummary.visits} візит{historySummary.visits >= 5 ? 'ів' : historySummary.visits > 1 ? 'и' : ''}
                          {' у '}
                          {historySummary.places} заклад{historySummary.places >= 5 ? 'ах' : historySummary.places > 1 ? 'ах' : 'і'}
                        </div>
                      )}

                      {groupedAppointments.map((group) => (
                        <div key={group.label}>
                          {/* Заголовок місяця: суцільний список із двадцяти
                              карток читається як стрічка без орієнтирів. */}
                          <div style={{
                            fontSize: '0.78rem', fontWeight: 600, color: '#8E8E93',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                            // Повітря перед групою: місяць має відділяти
                            // блоки, а не тулитись до попереднього.
                            margin: '2.25rem 0 0.75rem 0.25rem',
                          }}>
                            {group.label}
                          </div>

                          {/* Група - ОДНА картка з рядками всередині.
                              Раніше кожен візит був окремим прямокутником
                              із рамкою: у списку з десяти це десять
                              прямокутників, які око читає як стіну.
                              Тонкі лінії між рядками спокійніші. */}
                          <div style={{
                            background: '#fff',
                            // Світліша рамка й більше заокруглення: 14px на
                            // великому блоці виглядає різко, 18 - спокійно.
                            border: '1px solid #EDEDF0',
                            borderRadius: '18px',
                            padding: '0.25rem 1.75rem',
                          }}>
                            {group.items.map((app, itemIdx) => {
                              const start = app.start_time ? new Date(app.start_time) : null;
                              const end = app.end_time ? new Date(app.end_time) : null;
                              const isCancelled = app.status === 'cancelled' || app.status === 'no-show';
                              const isDone = app.status === 'completed';
                              const isUpcoming = !isCancelled && !isDone && start && start >= new Date();

                              // Форматування дати: день, місяць і день тижня
                              const dateDayMonth = start
                                ? start.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
                                : '';
                              const weekday = start
                                ? start.toLocaleDateString('uk-UA', { weekday: 'short' })
                                : '';

                              const timeLabel = start
                                ? start.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
                                : '';

                              const minutes = start && end
                                ? Math.round((end.getTime() - start.getTime()) / 60000)
                                : null;
                              const durationLabel = !minutes ? null
                                : minutes < 60 ? `${minutes} хв`
                                : minutes % 60 === 0 ? `${minutes / 60} год`
                                : `${Math.floor(minutes / 60)} год ${minutes % 60} хв`;

                              const days = start ? Math.ceil((start.getTime() - Date.now()) / 86400000) : null;
                              const countdown = !isUpcoming || days === null ? null
                                : days <= 0 ? 'сьогодні'
                                : days === 1 ? 'завтра'
                                : days <= 7 ? `через ${days} дні${days >= 5 ? 'в' : ''}`
                                : null;

                              const allServices = [app.service_name, ...(app.addon_names || [])]
                                .filter(Boolean).join(', ');

                              const placeAndMaster = [app.business_name, app.master_name]
                                .filter(Boolean).join(', ');

                              const hasActions = isUpcoming || isDone;

                              return (
                                <div
                                  key={app.id}
                                  style={{
                                    padding: hasActions ? '1.75rem 0 1.5rem' : '1.75rem 0',
                                    borderBottom: itemIdx < group.items.length - 1 ? '1px solid #F5F5F7' : 'none',
                                    opacity: isCancelled ? 0.45 : 1,
                                  }}
                                >
                                  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>

                                    {/* Ліва колонка: Лише час і тривалість візиту */}
                                    <div style={{ flexShrink: 0, width: '68px', paddingTop: '1px' }}>
                                      <div style={{
                                        fontSize: '1.125rem', fontWeight: 600,
                                        color: isUpcoming ? '#1D1D1F' : '#86868B',
                                        fontVariantNumeric: 'tabular-nums',
                                        letterSpacing: '-0.01em', lineHeight: 1.2,
                                      }}>
                                        {timeLabel}
                                      </div>
                                      {durationLabel && (
                                        <div style={{
                                          fontSize: '0.8125rem', color: '#AEAEB2',
                                          marginTop: '0.25rem', fontVariantNumeric: 'tabular-nums',
                                        }}>
                                          {durationLabel}
                                        </div>
                                      )}
                                    </div>

                                    {/* Середня колонка: Назва послуг, заклад і майстер */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{
                                        fontSize: '1.0625rem', fontWeight: 600, color: '#1D1D1F',
                                        letterSpacing: '-0.01em', lineHeight: 1.4,
                                        textDecoration: isCancelled ? 'line-through' : 'none',
                                      }}>
                                        {allServices || 'Візит'}
                                      </div>

                                      <div style={{
                                        fontSize: '0.9375rem', color: '#86868B',
                                        marginTop: '0.375rem', lineHeight: 1.45,
                                      }}>
                                        {placeAndMaster}
                                      </div>
                                    </div>

                                    {/* Права колонка: Ціна, дата та статус */}
                                    <div style={{ flexShrink: 0, textAlign: 'right', paddingTop: '1px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                      {app.price ? (
                                        <div style={{
                                          fontSize: '1.0625rem', fontWeight: 600, color: '#1D1D1F',
                                          letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums',
                                          lineHeight: 1.3,
                                        }}>
                                          {Number(app.price).toLocaleString('uk-UA')} ₴
                                        </div>
                                      ) : null}

                                      {dateDayMonth && (
                                        <div style={{
                                          fontSize: '0.8125rem', fontWeight: 500,
                                          color: '#86868B', lineHeight: 1.3,
                                          textTransform: 'capitalize',
                                        }}>
                                          {dateDayMonth}{weekday && `, ${weekday}`}
                                        </div>
                                      )}

                                      {countdown && (
                                        <div style={{ fontSize: '0.78rem', color: '#6F9273', fontWeight: 600, marginTop: '2px' }}>
                                          {countdown}
                                        </div>
                                      )}
                                      {isCancelled && (
                                        <div style={{ fontSize: '0.78rem', color: '#AEAEB2', marginTop: '2px' }}>
                                          Скасовано
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Кнопки дій: ідеально починаються на одній лінії з текстом послуги */}
                                  {hasActions && (
                                    <div style={{
                                      display: 'flex', gap: '0.5rem',
                                      marginTop: '1.125rem', paddingLeft: 'calc(68px + 1.5rem)',
                                      flexWrap: 'wrap',
                                    }}>
                                      {isUpcoming && (
                                        <>
                                          <button
                                            onClick={() => {
                                              const rawDate = app.start_time ? String(app.start_time).split('T')[0] : today;
                                              const initialDate = rawDate >= today ? rawDate : today;
                                              setRescheduleModalAppt(app);
                                              setNewRescheduleDate(initialDate);
                                              const rawTime = app.start_time && String(app.start_time).includes('T')
                                                ? String(app.start_time).split('T')[1].substring(0, 5)
                                                : '';
                                              setNewRescheduleTime(rawTime);
                                            }}
                                            style={visitActionStyle}
                                          >
                                            Перенести
                                          </button>
                                          <button onClick={() => setCancelModalAppt(app)} style={visitActionStyle}>
                                            Скасувати
                                          </button>
                                          {/* Файл .ics відкриває календар телефона чи
                                              компʼютера з уже заповненим записом. */}
                                          <button onClick={() => downloadIcs(app)} style={visitActionStyle}>
                                            У календар
                                          </button>
                                        </>
                                      )}
                                      {isDone && !app.has_review && !reviewedIds.includes(app.id) && (
                                        <button
                                          onClick={() => { setReviewAppt(app); setReviewRating(0); setReviewText(''); }}
                                          style={{ ...visitActionStyle, background: '#1D1D1F', color: '#fff', borderColor: '#1D1D1F' }}
                                        >
                                          Оцінити
                                        </button>
                                      )}
                                      {app.business_slug && app.service_id && (
                                        <Link
                                          href={`/${app.business_slug}?service=${app.service_id}${app.master_id ? `&master=${app.master_id}` : ''}`}
                                          style={{ ...visitActionStyle, textDecoration: 'none' }}
                                        >
                                          {isUpcoming ? 'Записатись ще' : 'Повторити'}
                                        </Link>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      {/* «Показати ще» замість нумерації сторінок: люди не
                          шукають візит на третій сторінці, вони гортають. */}
                      {filteredAppointments.length > visibleCount && (
                        <button
                          onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
                          style={{
                            width: '100%', height: '44px', marginTop: '1rem',
                            borderRadius: '12px', border: '1px solid #E5E5EA',
                            background: '#fff', color: '#111827',
                            fontSize: '0.875rem', fontWeight: 600,
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          Показати ще {Math.min(PAGE_SIZE, filteredAppointments.length - visibleCount)}
                        </button>
                      )}

                      {/* Теплова карта - лише в історії візитів.
                          У «Майбутніх» вона показувала б минуле поруч
                          зі списком того, що попереду: два різні часи
                          на одному екрані плутають. */}
                      <VisitsHeatmap appointments={appointments} />
                    </div>
                  )}
                </div>
              )}

              {/* 2. ВКЛАДКА: БОНУСИ */}

              {/* 3. ВКЛАДКА: СЕРТИФІКАТИ */}

              {/* 4. ВКЛАДКА: УЛЮБЛЕНІ ЗАКЛАДИ */}
              {activeTab === 'wallet' && (
                <WalletTab getToken={walletToken} />
              )}

              {activeTab === 'favorites' && (
                <div>
                  {favorites.length === 0 ? (
                    <div className="clean-card anim" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#f8fafc', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                        <Heart className="w-5 h-5" />
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.25rem' }}>У вас немає збережених закладів</div>
                      <p style={{ color: '#6b7280', fontSize: '0.85rem', maxWidth: '320px', margin: '0 auto 1.25rem auto' }}>
                        Додавайте улюблені салони під час перегляду, щоб мати швидкий доступ.
                      </p>
                      <Link href="/">
                        <button className="btn-theme anim" style={{ padding: '0.65rem 1.5rem', borderRadius: '999px', fontSize: '0.85rem' }}>
                          Переглянути заклади
                        </button>
                      </Link>
                    </div>
                  ) : (
                    <>
                      {/* Фільтр категорій - лише коли улюблених понад шість.
                          Менше - фільтрувати нема що, і рядок кнопок лише
                          відсуває самі заклади. */}
                      {favCategories.length > 1 && favorites.length > 6 && (
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                          {[{ slug: 'all', title: 'Усі' }, ...favCategories].map(cat => (
                            <button
                              key={cat.slug}
                              type="button"
                              onClick={() => setFavCategory(cat.slug)}
                              style={{
                                height: '34px', padding: '0 0.9rem', borderRadius: '10px', border: 'none',
                                background: favCategory === cat.slug ? '#1D1D1F' : '#F5F5F7',
                                color: favCategory === cat.slug ? '#fff' : '#3A3A3C',
                                fontSize: '0.85rem', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
                                transition: 'background-color .2s ease, color .2s ease',
                              }}
                            >
                              {cat.title}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Усі улюблені одразу, сіткою як на головній. Раніше -
                          по чотири на сторінку: шість закладів уже вимагали
                          гортати сторінки.

                          На кожній картці - вільні години сьогодні: улюблене
                          зберігають, щоб туди повернутись, і найкоротший шлях
                          до цього - один клік по годині. */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem' }}>
                        {visibleFavorites.map(item => (
                          <BusinessCard
                            key={item.id}
                            biz={item}
                            // Усе в цьому списку - улюблене; зняти сердечко означає прибрати звідси.
                            isFavorite
                            onToggleFavorite={id => void handleRemoveFavorite(id)}
                            showTimeSlots
                            slots={favSlots[item.id]}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* 5. ВКЛАДКА: НАЛАШТУВАННЯ (ГАРМОНІЙНО ВИРІВНЯНІ ПОЛЯ ТА КНОПКИ) */}
              {activeTab === 'settings' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>

                  {/* Секція 1: Персональні дані */}
                  <div className="clean-card" style={{ padding: '2rem', width: '100%', boxSizing: 'border-box' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <User className="w-4 h-4 text-slate-700" />
                      <div style={{ fontSize: '1.15rem', fontWeight: '700' }}>Персональні дані</div>
                    </div>
                    <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0 0 1.5rem 0' }}>
                      Контактна інформація, що використовується при бронюванні
                    </p>

                    {/* Аватарка */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ position: 'relative' }}>
                        {avatarUrl ? (
                          <SmartImage width={64} height={64}
                            src={avatarUrl}
                            alt="Аватарка"
                            style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', fontWeight: '800', color: '#111827' }}>
                            {initials.toUpperCase()}
                          </div>
                        )}

                        {isUploadingAvatar && (
                          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Loader2 className="w-5 h-5 animate-spin text-slate-700" />
                          </div>
                        )}
                      </div>

                      <div>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleAvatarUpload}
                          accept="image/png, image/jpeg, image/webp"
                          style={{ display: 'none' }}
                        />
                        <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '0.35rem' }}>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploadingAvatar}
                            className="btn-subtle anim"
                            style={{ padding: '0.5rem 0.9rem', borderRadius: '8px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <Camera className="w-3.5 h-3.5" /> Змінити фото
                          </button>

                          {avatarUrl && (
                            <button
                              type="button"
                              onClick={handleAvatarDelete}
                              disabled={isUploadingAvatar}
                              className="btn-danger-subtle anim"
                              style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Видалити
                            </button>
                          )}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>JPG, PNG або WEBP до 3 МБ</div>
                      </div>
                    </div>

                    <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#374151', marginBottom: '0.4rem' }}>
                            Ім'я та Прізвище
                          </label>
                          <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Введіть ваше ім'я"
                            className="clean-input anim"
                            required
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#374151', marginBottom: '0.4rem' }}>
                            Номер телефону
                          </label>
                          <input
                            type="tel"
                            value={phone}
                            onChange={handlePhoneChange}
                            placeholder="+380 97 123 4567"
                            className="clean-input anim"
                          />
                        </div>
                      </div>

                      <div>
                        <button
                          type="submit"
                          disabled={isSaving}
                          className="btn-dark anim"
                          style={{
                            padding: '0.65rem 1.35rem',
                            borderRadius: '10px',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                          {isSaving ? 'Збереження...' : 'Зберегти зміни'}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Секція 2: Електронна пошта */}
                  <div className="clean-card" style={{ padding: '2rem', width: '100%', boxSizing: 'border-box' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <Mail className="w-4 h-4 text-slate-700" />
                      <div style={{ fontSize: '1.15rem', fontWeight: '700' }}>Електронна пошта</div>
                    </div>
                    <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0 0 1.25rem 0' }}>
                      Поточний Email: <strong style={{ color: '#111827' }}>{email}</strong>
                    </p>

                    <form onSubmit={handleEmailChange} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
                      <div style={{ maxWidth: '420px' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#374151', marginBottom: '0.4rem' }}>
                          Нова адреса Email
                        </label>
                        <input
                          type="email"
                          value={newEmail}
                          onChange={e => setNewEmail(e.target.value)}
                          placeholder="new-email@example.com"
                          className="clean-input anim"
                          required
                        />
                      </div>

                      <div>
                        <button
                          type="submit"
                          disabled={isChangingEmail}
                          className="btn-dark anim"
                          style={{
                            padding: '0.65rem 1.35rem',
                            borderRadius: '10px',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          {isChangingEmail && <Loader2 className="w-4 h-4 animate-spin" />}
                          {isChangingEmail ? 'Відправка...' : 'Оновити Email'}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Секція 3: Безпека та пароль */}
                  <div className="clean-card" style={{ padding: '2rem', width: '100%', boxSizing: 'border-box' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <KeyRound className="w-4 h-4 text-slate-700" />
                      <div style={{ fontSize: '1.15rem', fontWeight: '700' }}>Безпека та пароль</div>
                    </div>
                    <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0 0 1.25rem 0' }}>
                      Оновіть пароль для входу до вашого облікового запису
                    </p>

                    <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#374151', marginBottom: '0.4rem' }}>
                            Новий пароль
                          </label>
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Мінімум 6 символів"
                            className="clean-input anim"
                            required
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#374151', marginBottom: '0.4rem' }}>
                            Підтвердження пароля
                          </label>
                          <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Повторіть новий пароль"
                            className="clean-input anim"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <button
                          type="submit"
                          disabled={isChangingPassword}
                          className="btn-dark anim"
                          style={{
                            padding: '0.65rem 1.35rem',
                            borderRadius: '10px',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          {isChangingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
                          {isChangingPassword ? 'Оновлення...' : 'Змінити пароль'}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Секція 4: Небезпечна зона */}
                  <div style={{
                    border: '1.5px dashed #fca5a5',
                    borderRadius: '20px',
                    backgroundColor: '#fef2f2',
                    padding: '1.5rem 1.75rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1.5rem',
                    flexWrap: 'wrap',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}>
                    <div>
                      <div style={{ fontSize: '1.05rem', fontWeight: '700', color: '#dc2626', marginBottom: '0.25rem' }}>
                        Видалення акаунта
                      </div>
                      <p style={{ color: '#4b5563', fontSize: '0.85rem', margin: 0, lineHeight: '1.5', maxWidth: '520px' }}>
                        Назавжди видалити цей обліковий запис. Історія візитів та збережені заклади будуть втрачені без можливості відновлення.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsDeleteModalOpen(true)}
                      className="btn-danger-primary anim"
                      style={{
                        padding: '0.65rem 1.35rem',
                        borderRadius: '10px',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Видалити акаунт
                    </button>
                  </div>

                </div>
              )}

            </div>
          </div>

        </div>
      </main>

      {/* ==================== МОДАЛКА: СКАСУВАННЯ ВІЗИТУ ==================== */}
      {cancelModalAppt && (
        <div className="modal-overlay" onClick={() => setCancelModalAppt(null)}>
          <div className="modal-window anim" onClick={e => e.stopPropagation()}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem auto' }}>
              <AlertTriangle className="w-5 h-5" />
            </div>

            <div style={{ fontSize: '1.15rem', fontWeight: '700', textAlign: 'center', color: '#111827', marginBottom: '0.35rem' }}>
              Скасувати візит?
            </div>
            <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.85rem', margin: '0 0 1.25rem 0', lineHeight: '1.4' }}>
              Ви впевнені, що хочете скасувати візит на <strong>{cancelModalAppt.services?.name}</strong> в <strong>{cancelModalAppt.businesses?.name}</strong>?
            </p>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setCancelModalAppt(null)}
                className="btn-subtle anim"
                style={{ flex: 1, padding: '0.65rem', borderRadius: '10px', fontSize: '0.85rem' }}
              >
                Залишити
              </button>
              <button
                onClick={confirmCancelAppointment}
                disabled={isSubmittingAction}
                className="btn-danger-subtle anim"
                style={{ flex: 1, padding: '0.65rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '700' }}
              >
                {isSubmittingAction ? '...' : 'Скасувати'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== МОДАЛКА: ПЕРЕНЕСЕННЯ ВІЗИТУ ==================== */}
      {rescheduleModalAppt && (
        <div className="modal-overlay" onClick={() => setRescheduleModalAppt(null)}>
          <div className="modal-window anim" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <button
              onClick={() => setRescheduleModalAppt(null)}
              style={{ position: 'absolute', top: '1.1rem', right: '1.1rem', background: '#f8fafc', border: 'none', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>

            <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#111827', marginBottom: '0.25rem' }}>
              Зміна часу візиту
            </div>

            <div style={{ color: '#6b7280', fontSize: '0.84rem', marginBottom: '1.25rem', lineHeight: '1.4' }}>
              <span style={{ color: '#111827', fontWeight: '600' }}>
                {rescheduleModalAppt.service_name || rescheduleModalAppt.services?.name || 'Візит'}
              </span>
              <br />
              {[rescheduleModalAppt.business_name || rescheduleModalAppt.businesses?.name, rescheduleModalAppt.master_name].filter(Boolean).join(' • ')}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#374151', marginBottom: '0.4rem' }}>
                  Оберіть нову дату
                </label>
                <input
                  type="date"
                  value={newRescheduleDate}
                  min={today}
                  onChange={(e) => setNewRescheduleDate(e.target.value)}
                  className="clean-input anim"
                  required
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#374151' }}>
                    Вільний час
                  </label>
                  {isSlotsLoading && (
                    <span style={{ fontSize: '0.75rem', color: '#86868B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Loader2 className="w-3 h-3 animate-spin" /> завантаження графіка...
                    </span>
                  )}
                </div>

                {isSlotsLoading ? (
                  <div style={{ padding: '2rem 0', display: 'flex', justifyContent: 'center' }}>
                    <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div style={{
                    padding: '1.25rem', borderRadius: '12px', background: '#f8fafc',
                    border: '1px dashed #e2e8f0', textAlign: 'center', color: '#64748b', fontSize: '0.82rem'
                  }}>
                    На обрану дату немає вільних місць у закладі. Оберіть інший день.
                  </div>
                ) : (
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px',
                    maxHeight: '190px', overflowY: 'auto', paddingRight: '2px'
                  }}>
                    {availableSlots.map(t => (
                      <div
                        key={t}
                        onClick={() => setNewRescheduleTime(t)}
                        className={`time-pill anim ${newRescheduleTime === t ? 'selected' : ''}`}
                        style={{ padding: '0.55rem 0', fontWeight: 600, fontSize: '0.86rem' }}
                      >
                        {t}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={confirmRescheduleAppointment}
              disabled={isSubmittingAction || isSlotsLoading || !newRescheduleTime}
              className="btn-dark anim"
              style={{
                width: '100%', padding: '0.75rem', borderRadius: '12px', fontSize: '0.88rem',
                opacity: (isSubmittingAction || isSlotsLoading || !newRescheduleTime) ? 0.4 : 1,
                cursor: (isSubmittingAction || isSlotsLoading || !newRescheduleTime) ? 'not-allowed' : 'pointer'
              }}
            >
              {isSubmittingAction ? 'Збереження...' : 'Підтвердити зміну'}
            </button>
          </div>
        </div>
      )}

      {/* ==================== МОДАЛКА: ВИДАЛЕННЯ АКАУНТА ==================== */}
      {isDeleteModalOpen && (
        <div className="modal-overlay" onClick={() => setIsDeleteModalOpen(false)}>
          <div className="modal-window anim" onClick={e => e.stopPropagation()} style={{ borderColor: '#fee2e2' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem auto' }}>
              <ShieldAlert className="w-5 h-5" />
            </div>

            <div style={{ fontSize: '1.2rem', fontWeight: '700', textAlign: 'center', color: '#111827', marginBottom: '0.35rem' }}>
              Видалити акаунт назавжди?
            </div>
            <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.85rem', margin: '0 0 1.25rem 0', lineHeight: '1.5' }}>
              Ця дія є незворотною. Для підтвердження введіть слово <strong style={{ color: '#dc2626' }}>ВИДАЛИТИ</strong> в поле нижче:
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <input
                type="text"
                value={deleteConfirmInput}
                onChange={e => setDeleteConfirmInput(e.target.value)}
                className="clean-input anim"
                style={{ textAlign: 'center', fontWeight: '700', letterSpacing: '0.05em' }}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => { setIsDeleteModalOpen(false); setDeleteConfirmInput(''); }}
                className="btn-subtle anim"
                style={{ flex: 1, padding: '0.65rem', borderRadius: '10px', fontSize: '0.85rem' }}
              >
                Скасувати
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmInput !== 'ВИДАЛИТИ' || isDeletingAccount}
                className="btn-danger-primary anim"
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  opacity: deleteConfirmInput === 'ВИДАЛИТИ' ? 1 : 0.4,
                  cursor: deleteConfirmInput === 'ВИДАЛИТИ' ? 'pointer' : 'not-allowed'
                }}
              >
                {isDeletingAccount ? 'Видалення...' : 'Видалити'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


/**
 * Обгортка Suspense.
 *
 * useSearchParams() у App Router вимагає межі Suspense: без неї
 * збірка сторінки падає, і вона віддає 404. Саме це й сталось,
 * коли я додав читання ?tab=settings для переходу з меню.
 *
 * Запасний вміст - порожнє тло тієї ж висоти, а не спінер:
 * сторінка з'являється миттєво, і блимання індикатором лише
 * створює відчуття повільності.
 */
export default function ClientProfilePage() {
  return (
    <Suspense fallback={
      // Заглушка мусить збігатися з тим, що компонент малює під час
      // завантаження. Раніше тут було інше тло - сервер віддавав одну
      // розмітку, клієнт малював іншу, і React скаржився на розбіжність
      // гідратації та перемальовував усе дерево.
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }} />
    }>
      <ProfileContent />
    </Suspense>
  );
}
