'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
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
  AlertTriangle
} from "lucide-react";

export default function ClientProfilePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();

  // --- Стейт завантаження та користувача ---
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('client');
  const [profile, setProfile] = useState<any>(null);
  const [isHeaderProfileOpen, setIsHeaderProfileOpen] = useState(false);
  const headerProfileRef = useRef<HTMLDivElement>(null);

  // --- Активна вкладка ---
  const [activeTab, setActiveTab] = useState<'appointments' | 'balance' | 'vouchers' | 'favorites' | 'settings'>('appointments');
  const [appointmentFilter, setAppointmentFilter] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');

  // --- Реальні дані з БД ---
  const [appointments, setAppointments] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);

  // --- Стейт форми налаштувань ---
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('+380 ');
  const [email, setEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // --- Модальні вікна ---
  const [cancelModalAppt, setCancelModalAppt] = useState<any | null>(null);
  const [rescheduleModalAppt, setRescheduleModalAppt] = useState<any | null>(null);
  const [newRescheduleDate, setNewRescheduleDate] = useState<string>('');
  const [newRescheduleTime, setNewRescheduleTime] = useState<string>('12:00');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // --- Завантаження даних з Supabase ---
  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/');
        return;
      }

      setEmail(user.email || '');

      // 1. Профіль користувача
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setFullName(profileData.full_name || '');
        setUserRole(profileData.role || 'client');

        if (profileData.phone) {
          const rawDigits = profileData.phone.replace(/^\+380/, '').replace(/\D/g, '');
          setPhone(`+380 ${rawDigits}`);
        }
      } else {
        const storedName = localStorage.getItem('userName') || user.user_metadata?.full_name || 'Користувач';
        setFullName(storedName);
      }

      // 2. Реальні бронювання
      try {
        const { data: apptsData } = await supabase
          .from('appointments')
          .select(`
            id,
            date,
            time,
            status,
            price,
            businesses ( id, name, address, city, cover_photo, logo, slug, rating ),
            services ( id, name, price, duration_minutes )
          `)
          .eq('user_id', user.id)
          .order('date', { ascending: false });

        if (apptsData) {
          setAppointments(apptsData);
        }
      } catch (err) {
        console.error("Помилка завантаження бронювань:", err);
      }

      // 3. Реальні улюблені заклади
      try {
        const { data: favsData } = await supabase
          .from('favorites')
          .select(`
            id,
            business_id,
            businesses ( id, name, address, city, cover_photo, logo, slug, rating, category, reviews_count )
          `)
          .eq('user_id', user.id);

        if (favsData) {
          setFavorites(favsData.map(f => f.businesses).filter(Boolean));
        }
      } catch {
        setFavorites([]);
      }

      setLoading(false);
    }

    loadData();
  }, [supabase, router]);

  // Закриття меню профілю кліком поза межами
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
    router.push('/');
  };

  // Фіксований незмінний префікс +380
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (!val.startsWith('+380')) {
      val = '+380 ' + val.replace(/^\+?380\s?/, '');
    }
    const digitsOnly = val.slice(4).replace(/\D/g, '').slice(0, 9);
    setPhone(`+380 ${digitsOnly}`);
  };

  // Збереження профілю з викликом Toast
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
      showToast(`Помилка збереження: ${error.message}`, 'error');
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
      showToast('Помилка при зміні часу візиту', 'error');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const filteredAppointments = useMemo(() => {
    return appointments.filter(app => {
      const isUpcoming = app.date >= today && app.status !== 'cancelled';
      const isCompleted = app.date < today && app.status !== 'cancelled';
      const isCancelled = app.status === 'cancelled';

      if (appointmentFilter === 'upcoming') return isUpcoming;
      if (appointmentFilter === 'completed') return isCompleted;
      if (appointmentFilter === 'cancelled') return isCancelled;
      return true;
    });
  }, [appointments, appointmentFilter, today]);

  const upcomingCount = appointments.filter(app => app.date >= today && app.status !== 'cancelled').length;
  const displayName = fullName || profile?.full_name || 'Користувач';
  const nameParts = displayName.split(' ');
  const initials = nameParts.length > 1 ? nameParts[0][0] + nameParts[1][0] : nameParts[0][0];

  const timeSlots = ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30', '18:00', '19:30'];

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

        .btn-theme { background-color: #C2D8C4 !important; color: #111827 !important; font-weight: 600; border: none; cursor: pointer; }
        .btn-theme:hover { background-color: #b5cdb7 !important; }

        .btn-dark { background-color: #111827; color: #ffffff; font-weight: 600; border: none; cursor: pointer; }
        .btn-dark:hover { background-color: #1f2937; }

        .btn-subtle { background: #ffffff; color: #4b5563; border: 1px solid #e5e7eb; font-weight: 600; cursor: pointer; }
        .btn-subtle:hover { background: #f9fafb; color: #111827; border-color: #d1d5db; }

        .btn-danger-subtle { background: #ffffff; color: #dc2626; border: 1px solid #fee2e2; font-weight: 600; cursor: pointer; }
        .btn-danger-subtle:hover { background: #fef2f2; border-color: #fca5a5; }

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
          background: #ffffff; border-radius: 18px; border: 1px solid #f0f0f2;
          box-shadow: 0 1px 3px rgba(0,0,0,0.015);
        }
        .clean-card:hover { border-color: #e5e7eb; box-shadow: 0 4px 16px rgba(0,0,0,0.03); }

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
          width: 100%; padding: 0.85rem 1rem; border: 1px solid #e5e7eb; border-radius: 12px;
          font-size: 0.92rem; box-sizing: border-box; outline: none; background: #fafafa;
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

            {/* ПРОФІЛЬНИЙ ПІЛЛ З ІНІЦІАЛАМИ ТА ШЕВРОНОМ */}
            <div style={{ position: 'relative' }} ref={headerProfileRef}>
              <div
                onClick={() => setIsHeaderProfileOpen(!isHeaderProfileOpen)}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.65rem', userSelect: 'none', padding: '0.35rem 0.5rem', borderRadius: '20px', transition: '0.2s' }}
                className="anim"
              >
                <span style={{ color: '#111827', fontSize: '0.95rem', fontWeight: '600', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </span>

                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#f1f5f9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111827',
                  fontWeight: '800', fontSize: '0.9rem', flexShrink: 0
                }}>
                  {initials.toUpperCase()}
                </div>

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
                  <span>Улюблені</span>
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
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem' }}>
                                    <h3 style={{ fontSize: '1.05rem', fontWeight: '700', margin: 0 }}>
                                      {app.services?.name || 'Послуга'}
                                    </h3>
                                    {isCancelled && (
                                      <span style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: '600' }}>(Скасовано)</span>
                                    )}
                                  </div>
                                  <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                                    {app.businesses?.name} • {app.businesses?.city || 'Львів'}, {app.businesses?.address || ''}
                                  </div>
                                  <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.35rem', fontSize: '0.8rem', color: '#4b5563', fontWeight: '600' }}>
                                    <span>{dateObj.toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                                    <span>•</span>
                                    <span>{app.time?.substring(0, 5)}</span>
                                    <span>•</span>
                                    <span style={{ color: '#111827' }}>{app.price || app.services?.price || 0} ₴</span>
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                {isUpcoming ? (
                                  <>
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

              {/* 2. ВКЛАДКА: БОНУСИ (ЗАГЛУШКА) */}
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

              {/* 3. ВКЛАДКА: СЕРТИФІКАТИ (ЗАГЛУШКА) */}
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
                      {favorites.map(item => (
                        <div key={item.id} className="clean-card anim" style={{ overflow: 'hidden' }}>
                          <div style={{ height: '130px', position: 'relative' }}>
                            <img src={item.cover_photo || item.logo || "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=400&q=80"} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                          <div style={{ padding: '1rem' }}>
                            <div style={{ fontSize: '0.95rem', fontWeight: '700', margin: '0 0 0.15rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                            <div style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0 0 0.75rem 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.city}, {item.address}</div>
                            <Link href={`/${item.slug || item.id}`} style={{ textDecoration: 'none' }}>
                              <button className="btn-dark anim" style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', fontSize: '0.82rem' }}>
                                Записатись
                              </button>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 5. ВКЛАДКА: НАЛАШТУВАННЯ */}
              {activeTab === 'settings' && (
                <div className="clean-card" style={{ padding: '2.5rem', width: '100%', boxSizing: 'border-box' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.25rem' }}>Персональні дані</div>
                  <p style={{ color: '#6b7280', fontSize: '0.88rem', margin: '0 0 1.75rem 0' }}>
                    Ця контактна інформація автоматично підставляється при бронюванні візитів
                  </p>

                  <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>

                    {/* Ім'я та Прізвище */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#374151', marginBottom: '0.45rem' }}>
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

                    {/* Номер телефону з монолітним полем */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#374151', marginBottom: '0.45rem' }}>
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

                    {/* Email (тільки для читання) */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#374151', marginBottom: '0.45rem' }}>
                        Email (прив'язаний до акаунта)
                      </label>
                      <input
                        type="email"
                        value={email}
                        disabled
                        className="clean-input"
                        style={{ color: '#9ca3af', backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}
                      />
                    </div>

                    {/* Кнопка збереження */}
                    <div>
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="btn-dark anim"
                        style={{ padding: '0.85rem 2rem', borderRadius: '10px', marginTop: '0.5rem', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                      >
                        {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isSaving ? 'Збереження...' : 'Зберегти зміни'}
                      </button>
                    </div>

                  </form>
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

    </div>
  );
}