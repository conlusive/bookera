'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
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

const FAVS_PER_PAGE = 4;

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

export default function ClientProfilePage() {
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
  const [activeTab, setActiveTab] = useState<'appointments' | 'balance' | 'vouchers' | 'favorites' | 'settings'>('appointments');
  const [appointmentFilter, setAppointmentFilter] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');

  // --- Дані з БД ---
  const [appointments, setAppointments] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [currentFavPage, setCurrentFavPage] = useState(1);

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

  // Гарантоване завантаження улюблених закладів
  const fetchFavorites = useCallback(async (uid?: string) => {
    try {
      let targetUserId = uid;
      if (!targetUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        targetUserId = user?.id;
      }
      if (!targetUserId) {
        setFavorites([]);
        return;
      }

      const { data: favRows, error: favErr } = await supabase
        .from('favorites')
        .select('business_id')
        .eq('user_id', targetUserId);

      if (favErr || !favRows || favRows.length === 0) {
        setFavorites([]);
        return;
      }

      const rawIds = favRows.map((f: any) => f.business_id).filter(Boolean);
      if (rawIds.length === 0) {
        setFavorites([]);
        return;
      }

      const formattedIds = rawIds.map((id: any) => (isNaN(Number(id)) ? id : Number(id)));

      const { data: bizData, error: bizErr } = await supabase
        .from('businesses')
        .select('*')
        .in('id', formattedIds);

      if (bizErr) {
        console.error("Помилка businesses:", bizErr.message || bizErr);
        setFavorites([]);
      } else {
        setFavorites(bizData || []);
      }
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
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

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
        const { data: apptsData } = await supabase
          .from('appointments')
          .select(`
            id,
            start_time,
            end_time,
            status,
            price,
            businesses ( id, name, address, city, cover_photo, logo, slug, rating ),
            services ( id, name, price, duration_minutes )
          `)
          .or(`user_id.eq.${user.id},client_id.eq.${user.id}`)
          .order('start_time', { ascending: false });

        if (apptsData) {
          setAppointments(apptsData);
        }
      } catch (err) {
        console.error("Помилка завантаження бронювань:", err);
      }

      // 3. Улюблені заклади
      await fetchFavorites(user.id);

      setLoading(false);
    }

    void loadData();
  }, [supabase, router, fetchFavorites]);

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

      const { error: dbError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (dbError) throw dbError;

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
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id);

      if (error) throw error;

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
  const handleRemoveFavorite = async (businessId: string | number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const targetBizId = isNaN(Number(businessId)) ? businessId : Number(businessId);

    try {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('business_id', targetBizId);

      if (error) throw error;

      setFavorites(prev => prev.filter(b => String(b.id) !== String(businessId)));
      showToast('Заклад видалено з улюблених', 'info');
    } catch {
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

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        phone: phoneToSave
      })
      .eq('id', user.id);

    setIsSaving(false);

    if (error) {
      showToast(`Помилка: ${error.message}`, 'error');
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

  // Перенесення візиту
  const confirmRescheduleAppointment = async () => {
    if (!rescheduleModalAppt || !newRescheduleDate) {
      showToast('Оберіть нову дату!', 'error');
      return;
    }
    setIsSubmittingAction(true);

    try {
      await supabase
        .from('appointments')
        .update({
          date: newRescheduleDate,
          time: newRescheduleTime + ':00',
          status: 'confirmed'
        })
        .eq('id', rescheduleModalAppt.id);

      setAppointments(prev => prev.map(a => a.id === rescheduleModalAppt.id ? {
        ...a,
        date: newRescheduleDate,
        time: newRescheduleTime + ':00',
        status: 'confirmed'
      } : a));

      setRescheduleModalAppt(null);
      showToast('Час візиту успішно змінено', 'success');
    } catch {
      showToast('Помилка при зміні часу', 'error');
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
    return appointments.filter(app => {
      const appDateIso = app.start_time || app.date || '';
      const isUpcoming = appDateIso >= nowIso && app.status !== 'cancelled';
      const isCompleted = appDateIso < nowIso && app.status !== 'cancelled';
      const isCancelled = app.status === 'cancelled';

      if (appointmentFilter === 'upcoming') return isUpcoming;
      if (appointmentFilter === 'completed') return isCompleted;
      if (appointmentFilter === 'cancelled') return isCancelled;
      return true;
    });
  }, [appointments, appointmentFilter, nowIso]);

  const upcomingCount = appointments.filter(app => {
    const appDateIso = app.start_time || app.date || '';
    return appDateIso >= nowIso && app.status !== 'cancelled';
  }).length;
  const displayName = fullName || profile?.full_name || 'Користувач';
  const nameParts = displayName.split(' ');
  const initials = nameParts.length > 1 ? nameParts[0][0] + nameParts[1][0] : nameParts[0][0];

  const timeSlots = ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30', '18:00', '19:30'];

  // Пагінація улюблених
  const totalFavPages = Math.ceil(favorites.length / FAVS_PER_PAGE);
  const paginatedFavorites = useMemo(() => {
    const start = (currentFavPage - 1) * FAVS_PER_PAGE;
    return favorites.slice(start, start + FAVS_PER_PAGE);
  }, [favorites, currentFavPage]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }}>
        <Loader2 className="w-7 h-7 animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#fafbfc', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, sans-serif', color: '#111827', letterSpacing: '-0.015em' }}>

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

        /* Картки улюблених закладів */
        .tour-card { 
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
                  <img
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
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#C2D8C4',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111827',
                    fontWeight: '800', fontSize: '0.95rem', flexShrink: 0
                  }}>
                    {initials.toUpperCase()}
                  </div>
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

              <button onClick={() => setActiveTab('balance')} className={`nav-item anim ${activeTab === 'balance' ? 'active' : ''}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <Coins className="w-4 h-4 text-slate-400" />
                  <span>Бонуси</span>
                </div>
              </button>

              <button onClick={() => setActiveTab('vouchers')} className={`nav-item anim ${activeTab === 'vouchers' ? 'active' : ''}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <Gift className="w-4 h-4 text-slate-400" />
                  <span>Сертифікати</span>
                </div>
              </button>

              <button onClick={() => setActiveTab('favorites')} className={`nav-item anim ${activeTab === 'favorites' ? 'active' : ''}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <Heart className="w-4 h-4 text-slate-400" />
                  <span>Улюблені ({favorites.length})</span>
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
                      {filteredAppointments.map((app) => {
                        const isUpcoming = app.date >= today && app.status !== 'cancelled';
                        const isCancelled = app.status === 'cancelled';
                        const dateObj = new Date(app.date);

                        return (
                          <div key={app.id} className="clean-card anim" style={{ padding: '1.25rem 1.5rem', opacity: isCancelled ? 0.6 : 1 }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.25rem' }}>

                              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <img
                                  src={app.businesses?.cover_photo || app.businesses?.logo || "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=400&q=80"}
                                  alt={app.businesses?.name || 'Салон'}
                                  style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'cover' }}
                                />
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
                                    <h3 style={{ fontSize: '1.05rem', fontWeight: '700', margin: 0 }}>
                                      {app.services?.name || 'Послуга'}
                                    </h3>
                                    {isUpcoming && getRelativeDateBadge(app.date)}
                                    {isCancelled && (
                                      <span style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: '600' }}>(Скасовано)</span>
                                    )}
                                  </div>

                                  {/* Клікабельна адреса */}
                                  <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${app.businesses?.name || ''} ${app.businesses?.city || ''} ${app.businesses?.address || ''}`)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#6b7280', fontSize: '0.85rem', textDecoration: 'none' }}
                                    className="anim"
                                    onMouseOver={e => e.currentTarget.style.color = '#111827'}
                                    onMouseOut={e => e.currentTarget.style.color = '#6b7280'}
                                  >
                                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                    <span>{app.businesses?.name} • {app.businesses?.city || 'Львів'}, {app.businesses?.address || ''}</span>
                                  </a>

                                  <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.35rem', fontSize: '0.8rem', color: '#4b5563', fontWeight: '600' }}>
                                    <span>{dateObj.toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                                    <span>•</span>
                                    <span>{app.time?.substring(0, 5)}</span>
                                    <span>•</span>
                                    <span style={{ color: '#111827' }}>{app.price || app.services?.price || 0} ₴</span>
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                {isUpcoming ? (
                                  <>
                                    {/* Google Calendar */}
                                    <a
                                      href={getGoogleCalendarUrl(app)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="Google Календар"
                                      className="btn-subtle anim"
                                      style={{ padding: '0.5rem 0.65rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', textDecoration: 'none' }}
                                    >
                                      <CalendarPlus className="w-3.5 h-3.5 text-slate-600" />
                                      <span>Google</span>
                                    </a>

                                    {/* Apple Calendar (.ics) */}
                                    <button
                                      onClick={() => downloadAppleIcs(app)}
                                      title="Apple / iCal (.ics)"
                                      className="btn-subtle anim"
                                      style={{ padding: '0.5rem 0.65rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
                                    >
                                      <Download className="w-3.5 h-3.5 text-slate-600" />
                                      <span>iCal</span>
                                    </button>

                                    <button
                                      onClick={() => { setRescheduleModalAppt(app); setNewRescheduleDate(app.date); }}
                                      className="btn-subtle anim"
                                      style={{ padding: '0.5rem 0.85rem', borderRadius: '8px', fontSize: '0.82rem' }}
                                    >
                                      Перенести
                                    </button>
                                    <button
                                      onClick={() => setCancelModalAppt(app)}
                                      className="btn-danger-subtle anim"
                                      style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.82rem' }}
                                    >
                                      Скасувати
                                    </button>
                                  </>
                                ) : (
                                  <Link href={`/${app.businesses?.slug || app.businesses?.id}`} style={{ textDecoration: 'none' }}>
                                    <button className="btn-subtle anim" style={{ padding: '0.5rem 0.9rem', borderRadius: '8px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                      <RotateCcw className="w-3 h-3" /> Повторити
                                    </button>
                                  </Link>
                                )}
                              </div>

                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 2. ВКЛАДКА: БОНУСИ */}
              {activeTab === 'balance' && (
                <div className="clean-card anim" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#f8fafc', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                    <Coins className="w-6 h-6" />
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '0.25rem' }}>Бонуси та баланс</div>
                  <p style={{ color: '#6b7280', fontSize: '0.85rem', maxWidth: '320px', margin: '0 auto' }}>
                    Розділ бонусного балансу наразі знаходиться <strong>в розробці</strong>.
                  </p>
                </div>
              )}

              {/* 3. ВКЛАДКА: СЕРТИФІКАТИ */}
              {activeTab === 'vouchers' && (
                <div className="clean-card anim" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#f8fafc', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                    <Gift className="w-6 h-6" />
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '0.25rem' }}>Сертифікати та промокоди</div>
                  <p style={{ color: '#6b7280', fontSize: '0.85rem', maxWidth: '320px', margin: '0 auto' }}>
                    Функціонал подарункових карток наразі знаходиться <strong>в розробці</strong>.
                  </p>
                </div>
              )}

              {/* 4. ВКЛАДКА: УЛЮБЛЕНІ ЗАКЛАДИ */}
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
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '1.5rem' }}>
                        {paginatedFavorites.map(item => {
                          const rank = parseFloat(item.rating);
                          const hasRating = !isNaN(rank) && rank > 0;
                          const displayRank = hasRating ? rank.toFixed(1) : '-';
                          const reviewCount = parseInt(item.reviews_count) || 0;
                          const bgImage = item.cover_photo || item.logo || "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80";
                          const category = item.category || 'Салон краси';

                          return (
                            <Link key={item.id} href={`/${item.slug || item.id}`} className="tour-card anim">
                              {/* Фото + Топ вибір + Кнопка видалення */}
                              <div className="tour-card-img-wrapper">
                                <img src={bgImage} alt={item.name} loading="lazy" decoding="async" className="tour-card-bg" />
                                {hasRating && rank >= 4.8 && (
                                  <div className="tour-badge-top">
                                    <span className="star">★</span> Топ Вибір
                                  </div>
                                )}

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    void handleRemoveFavorite(item.id);
                                  }}
                                  title="Видалити з улюблених"
                                  style={{
                                    position: 'absolute',
                                    top: '10px',
                                    right: '10px',
                                    background: '#ffffff',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '32px',
                                    height: '32px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                    zIndex: 10
                                  }}
                                  className="anim"
                                >
                                  <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                                </button>
                              </div>

                              {/* Контент картки */}
                              <div className="tour-card-content">
                                <h3 className="tour-title">{item.name}</h3>
                                <p className="tour-desc">
                                  {item.city ? `${item.city}, ` : ''}{item.address || 'Комфортна атмосфера, професійні майстри та індивідуальний підхід до кожного клієнта.'}
                                </p>

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
                                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60px' }}>{category}</span>
                                  </div>
                                </div>

                                {(() => {
                                  const cardTags = Array.isArray(item.tags) ? item.tags : [];
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

                                <button type="button" className="tour-book-btn">Записатись</button>
                              </div>
                            </Link>
                          );
                        })}
                      </div>

                      {/* Пагінація */}
                      {totalFavPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem', marginTop: '2rem' }}>
                          <button
                            onClick={() => setCurrentFavPage(p => Math.max(1, p - 1))}
                            disabled={currentFavPage === 1}
                            className="page-btn anim"
                            style={{ opacity: currentFavPage === 1 ? 0.4 : 1 }}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>

                          {Array.from({ length: totalFavPages }).map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setCurrentFavPage(i + 1)}
                              className={`page-btn anim ${currentFavPage === i + 1 ? 'active' : ''}`}
                            >
                              {i + 1}
                            </button>
                          ))}

                          <button
                            onClick={() => setCurrentFavPage(p => Math.min(totalFavPages, p + 1))}
                            disabled={currentFavPage === totalFavPages}
                            className="page-btn anim"
                            style={{ opacity: currentFavPage === totalFavPages ? 0.4 : 1 }}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
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
                          <img
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
          <div className="modal-window anim" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setRescheduleModalAppt(null)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: '#f3f4f6', border: 'none', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X className="w-3.5 h-3.5 text-slate-500" />
            </button>

            <div style={{ fontSize: '1.15rem', fontWeight: '700', color: '#111827', marginBottom: '0.2rem' }}>
              Зміна часу візиту
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
              {rescheduleModalAppt.services?.name} • {rescheduleModalAppt.businesses?.name}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', color: '#4b5563', marginBottom: '0.35rem' }}>Нова дата</label>
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
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', color: '#4b5563', marginBottom: '0.45rem' }}>Оберіть час</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {timeSlots.map(t => (
                    <div
                      key={t}
                      onClick={() => setNewRescheduleTime(t)}
                      className={`time-pill anim ${newRescheduleTime === t ? 'selected' : ''}`}
                    >
                      {t}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={confirmRescheduleAppointment}
              disabled={isSubmittingAction}
              className="btn-dark anim"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', fontSize: '0.88rem' }}
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