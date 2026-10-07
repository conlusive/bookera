'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';
import { useToast } from '@/context/ToastContext';
import AppSelect from '@/components/ui/AppSelect';
import LocationPicker from '@/components/ui/LocationPicker';
import { categoryTitle } from '@/lib/categories';
import HelpTip from '@/components/ui/HelpTip';
import SubscriptionPanel from '@/components/cabinet/SubscriptionPanel';
import FinancePanel from '@/components/cabinet/FinancePanel';

interface SettingsTabProps {
  onNavigate?: (tab: string) => void;
  initialView?: string;
  onTargetUsed?: () => void;
  business: any;
  Icons?: any;
}

// ВЕКТОРНІ ІКОНКИ
const SvgIcon = ({ d, size = 24, color = "currentColor", children, strokeWidth = 2, ...props }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>{d && <path d={d} />}{children}</svg>
);
const SvgChevronLeft = (p:any) => <SvgIcon {...p}><polyline points="15 18 9 12 15 6"></polyline></SvgIcon>;
const SvgAlertCircle = (p:any) => <SvgIcon {...p}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></SvgIcon>;

const SvgStorefront = (p:any) => <SvgIcon {...p}><path d="M3 9l1.5-5h15L21 9"></path><path d="M3 9h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9z"></path><path d="M8 21v-7h8v7"></path></SvgIcon>;
const SvgGlobe = (p:any) => <SvgIcon {...p}><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></SvgIcon>;
const SvgCreditCard = (p:any) => <SvgIcon {...p}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></SvgIcon>;
const SvgBell = (p:any) => <SvgIcon {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></SvgIcon>;
const SvgShieldCheck = (p:any) => <SvgIcon {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></SvgIcon>;
const SvgLock = (p:any) => <SvgIcon {...p}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></SvgIcon>;


const SETTINGS_CARDS: Record<string, { id: string; title: string; desc: string; icon: any; color: string; bg: string }> = {
  profile: { id: 'profile', title: 'Профіль закладу', desc: 'Назва, контакти, адреса й тип бізнесу.', icon: SvgStorefront, color: '#3b82f6', bg: '#eff6ff' },
  booking: { id: 'booking', title: 'Правила бронювання', desc: 'Підтвердження записів, сітка, відпустки, мінімум часу до візиту.', icon: SvgGlobe, color: '#16a34a', bg: '#f0fdf4' },
  payments: { id: 'payments', title: 'Передоплата', desc: 'Завдаток за візит: сума або відсоток.', icon: SvgCreditCard, color: '#ec4899', bg: '#fdf2f8' },
  security: { id: 'security', title: 'Захист від неявок', desc: 'Автоблокування онлайн-запису для порушників.', icon: SvgLock, color: '#ef4444', bg: '#fef2f2' },
  notifications: { id: 'notifications', title: 'Листи й сповіщення', desc: 'Листи клієнтам, нагадування, сповіщення команді.', icon: SvgBell, color: '#f59e0b', bg: '#fffbeb' },
  finance: { id: 'finance', title: 'Фінанси та виплати', desc: 'Завдатки, комісія, реквізити й виплати.', icon: SvgCreditCard, color: '#0ea5e9', bg: '#f0f9ff' },
  billing: { id: 'billing', title: 'Підписка', desc: 'Скільки діє доступ, оплата й історія.', icon: SvgShieldCheck, color: '#8b5cf6', bg: '#f5f3ff' },
};
// Порядок карток: про заклад, правила запису, сповіщення, гроші
const SETTINGS_ORDER = ['profile', 'booking', 'payments', 'security', 'notifications', 'finance', 'billing'];
const businessSettingsCards = Object.values(SETTINGS_CARDS);

export default function SettingsTab({ business, onNavigate, initialView, onTargetUsed }: SettingsTabProps) {
  const { showToast } = useToast();

  // 🟢 Відновлення активного розділу при перезавантаженні сторінки
  const [settingsView, setSettingsView] = useState<'main' | 'profile' | 'payments' | 'finance' | 'billing' | 'notifications' | 'booking' | 'security'>('main');
  // Стан автозбереження - щоб було видно, що зміна дійшла до сервера
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isReady, setIsReady] = useState(false);
  const [showPlansView, setShowPlansView] = useState(false);

  // СТАНИ НАЛАШТУВАНЬ
  const [bookingSettings, setBookingSettings] = useState({
    is_active: true, is_paused_emergency: false, min_advance_hours: 2, max_advance_days: 30, time_step: 30,
    default_duration: 60, buffer_minutes: 0, closed_periods: [] as { start: string; end: string; reason?: string }[],
    cancel_before_hours: 24,
    cancellation_policy: ''
  });

  const [notificationSettings, setNotificationSettings] = useState({
    auto_approve: true, notify_client_booking: true, notify_client_reminder_sms: true, notify_staff_booking: true
  });

  const [securitySettings, setSecuritySettings] = useState({
    block_no_shows: true, require_phone_verification: false,
  });

  const [paymentsSettings, setPaymentsSettings] = useState({
    currency: 'UAH', require_deposit: false, deposit_amount: 100, deposit_type: 'fixed'
  });

  const [newPeriod, setNewPeriod] = useState({ start: '', end: '', reason: '' });
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const [profileSettings, setProfileSettings] = useState({
    category: 'other', business_type: 'company', workspace_type: 'my_place',
  });
  // Мапа згорнута, поки координати знайшлись самі: розгорнута мапа
  // на весь блок каже «зроби щось», хоча робити нічого не треба.
  const [isMapOpen, setIsMapOpen] = useState(false);

  const [contactSettings, setContactSettings] = useState({
    name: '', city: '', address: '', phone: '', email: '', show_phone_publicly: true,
    latitude: null as number | null, longitude: null as number | null,
  });

  // Розділ відкривається лише коли його попросили явно (наприклад, перехід «до оплати» з іншої вкладки).
  // Інакше завжди починаємо із загального списку категорій: вийшли з налаштувань і повернулись - знову він.
  useEffect(() => {
    if (initialView && initialView !== 'main' && ['profile', 'payments', 'finance', 'billing', 'notifications', 'booking', 'security'].includes(initialView)) {
      setSettingsView(initialView as any);
      onTargetUsed?.();  // розділ відкрито - наступного разу знову почнемо із загального списку
    }
    try { localStorage.removeItem('bookera_settings_view'); } catch {}
    setIsReady(true);
  }, [initialView]);

  // 🟢 3. Завантаження даних бізнесу (залежить лише від business?.id, щоб не скидати змінені поля)
  const hasCoords = contactSettings.latitude != null && contactSettings.longitude != null;

  // «Знайти за адресою» - для закладів, де автоматичний пошук колись
  // не вдався або ще не запускався (створені до появи геокодування).
  const [isGeocoding, setIsGeocoding] = useState(false);
  const retryGeocode = async () => {
    setIsGeocoding(true);
    try {
      const token = await getAuthToken();
      const found = await api.geocodeBusiness(token, Number(business.id));
      setContactSettings(prev => ({ ...prev, latitude: found.latitude, longitude: found.longitude }));
      showToast('Точку знайдено за адресою', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Адресу не знайдено - поставте мітку вручну', 'error');
    } finally {
      setIsGeocoding(false);
    }
  };

  const canAutoSave = useRef(false);
  useEffect(() => {
    if (!business) return;
    setContactSettings({
      name: business.name || '',
      city: business.city || '',
      address: (business as any).address || '',
      phone: (business as any).phone || '',
      email: (business as any).email || '',
      show_phone_publicly: (business as any).show_phone_publicly !== false,
      latitude: (business as any).latitude != null ? Number((business as any).latitude) : null,
      longitude: (business as any).longitude != null ? Number((business as any).longitude) : null,
    });
    setProfileSettings({
      category: (business as any).category || 'other',
      business_type: (business as any).business_type || 'company',
      workspace_type: (business as any).workspace_type || 'my_place',
    });
    if (business.booking_settings) setBookingSettings(prev => ({ ...prev, ...business.booking_settings }));
    if (business.notification_settings) setNotificationSettings(prev => ({ ...prev, ...business.notification_settings }));
    if (business.payments_settings) setPaymentsSettings(prev => ({ ...prev, ...business.payments_settings }));
    if (business.security_settings) setSecuritySettings(prev => ({ ...prev, ...business.security_settings }));

    setTimeout(() => { canAutoSave.current = true; }, 50);
  }, [business?.id]);

  // 🟢 4. Швидке й надійне автозбереження
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const autoSave = useCallback((column: string, data: any) => {
    if (!business?.id) return;
    if (business) {
      business[column] = data;
    }
    clearTimeout(saveTimers.current[column]);
    setSaveState('saving');
    saveTimers.current[column] = setTimeout(async () => {
      try {
        const token = await getAuthToken();
        await api.updateBusiness(token, business.id, { [column]: data });
        setSaveState('saved');
      } catch (err: any) {
        setSaveState('error');
        showToast(err?.message || 'Не вдалося зберегти зміни', 'error');
      }
    }, 300);
  }, [business, showToast]);

  useEffect(() => {
    if (!canAutoSave.current) return;
    autoSave('booking_settings', bookingSettings);
  }, [bookingSettings, autoSave]);

  useEffect(() => {
    if (!canAutoSave.current) return;
    autoSave('security_settings', securitySettings);
  }, [securitySettings, autoSave]);

  useEffect(() => {
    if (!canAutoSave.current || !business?.id) return;
    if (business) {
      business.business_type = profileSettings.business_type;
      business.workspace_type = profileSettings.workspace_type;
    }
    clearTimeout(saveTimers.current['profile']);
    setSaveState('saving');
    saveTimers.current['profile'] = setTimeout(async () => {
      try {
        const token = await getAuthToken();
        await api.updateBusiness(token, business.id, {
          business_type: profileSettings.business_type,
          workspace_type: profileSettings.workspace_type,
        });
        setSaveState('saved');
      } catch (err: any) {
        setSaveState('error');
        showToast(err?.message || 'Не вдалося зберегти профіль', 'error');
      }
    }, 300);
  }, [profileSettings.business_type, profileSettings.workspace_type, business, showToast]);

  useEffect(() => {
    if (!canAutoSave.current) return;
    autoSave('notification_settings', notificationSettings);
  }, [notificationSettings, autoSave]);

  // Контакти й адреса зберігаються автоматично. Точку на мапі шукає сервер за
  // адресою: тому координати НЕ надсилаємо, поки власник сам не пересунув мітку.
  // Раніше разом з адресою їхали старі координати, сервер вважав їх ручними
  // і не шукав нову точку - адресу доводилось міняти ще й у блоці «Точка на мапі».
  const pinMoved = useRef(false);
  const lastSavedContacts = useRef('');
  const contactsKey = (c: typeof contactSettings) =>
    JSON.stringify([c.name, c.city.trim(), c.address.trim(), c.phone, c.email, c.show_phone_publicly]);
  useEffect(() => {
    if (business?.id) lastSavedContacts.current = contactsKey(contactSettings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.id]);

  const [isLocating, setIsLocating] = useState(false);
  useEffect(() => {
    if (!canAutoSave.current || !business?.id || !contactSettings.name.trim()) return;
    const key = contactsKey(contactSettings);
    if (key === lastSavedContacts.current && !pinMoved.current) return;
    const addressChanged = (() => {
      try {
        const prev = JSON.parse(lastSavedContacts.current || '[]');
        return prev[1] !== contactSettings.city.trim() || prev[2] !== contactSettings.address.trim();
      } catch { return false; }
    })();
    if (business) {
      const { latitude: _la, longitude: _lo, ...rest } = contactSettings;
      Object.assign(business, rest);
    }
    clearTimeout(saveTimers.current['contacts']);
    setSaveState('saving');
    if (addressChanged) setIsLocating(true);
    // Адресу даємо дописати: пошук точки - це запит до зовнішнього сервісу, не на кожну літеру
    saveTimers.current['contacts'] = setTimeout(async () => {
      try {
        const token = await getAuthToken();
        const { latitude, longitude, ...fields } = contactSettings;
        const sendPin = pinMoved.current && !addressChanged;
        const saved = await api.updateBusiness(token, business.id, sendPin ? { ...fields, latitude, longitude } : fields);
        pinMoved.current = false;
        lastSavedContacts.current = key;
        const lat = saved?.latitude != null ? Number(saved.latitude) : null;
        const lng = saved?.longitude != null ? Number(saved.longitude) : null;
        business.latitude = lat;
        business.longitude = lng;
        setContactSettings(prev => (prev.latitude === lat && prev.longitude === lng ? prev : { ...prev, latitude: lat, longitude: lng }));
        setSaveState('saved');
        if (addressChanged && fields.address) {
          if (lat == null) showToast('Точку за цією адресою не знайдено - уточніть адресу або поставте мітку вручну', 'info');
        }
      } catch (err: any) {
        setSaveState('error');
        showToast(err?.message || 'Не вдалося зберегти контакти', 'error');
      } finally {
        setIsLocating(false);
      }
    }, addressChanged ? 1200 : 500);
  }, [contactSettings, business, showToast]);

  useEffect(() => {
    if (!canAutoSave.current) return;
    autoSave('payments_settings', paymentsSettings);
  }, [paymentsSettings, autoSave]);

  const current = businessSettingsCards.find(c => c.id === settingsView) || businessSettingsCards[0];

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUpRightFade { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        
        .sx-shell { display: flex; flex: 1; min-height: 0; width: 100%; background: #fff; font-family: Inter, -apple-system, sans-serif; }
        .sx-main { flex: 1; min-width: 0; overflow-y: auto; }
        .sx-inner { padding: 2rem 3rem 3rem; max-width: 950px; box-sizing: border-box; }
        .sx-head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
        .sx-head h2 { margin: 0; font-size: 1.4rem; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
        .sx-back { background: transparent; border: none; color: #1d1d1f; cursor: pointer; display: flex; align-items: center; padding: 0.4rem; margin-right: 0.4rem; }
        .sx-save { font-size: 0.78rem; color: #94a3b8; white-space: nowrap; } .sx-save.saved { color: #059669; } .sx-save.error { color: #dc2626; font-weight: 600; } .sx-save.saving { color: #64748b; }
        .settings-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.5rem; cursor: pointer; display: flex; align-items: flex-start; gap: 1.25rem; transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
        .settings-card:hover { border-color: #cbd5e1; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.04); transform: translateY(-3px); }
        .settings-icon-wrapper { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        @media (max-width: 900px) { .sx-inner { padding: 1.2rem 1rem 2rem; } }

        /* Розділи без карток: лише тонкі лінії між блоками */
        .sx-inner .clean-panel { background: transparent; border: none; border-radius: 0; box-shadow: none; padding: 0 0 2rem; margin: 0 0 2rem; border-bottom: 1px solid #f1f5f9; position: relative; }
        .sx-inner .clean-panel:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .panel-title { font-size: 1.05rem; font-weight: 800; color: #0f172a; padding: 0; margin: 0 0 0.3rem; }
        .panel-subtitle { font-size: 0.88rem; color: #64748b; padding: 0; margin: 0 0 1rem; line-height: 1.5; max-width: 680px; }
        .list-row { padding: 0.9rem 0; display: flex; justify-content: space-between; align-items: center; gap: 2rem; min-height: 64px; }
        .list-row + .list-row { border-top: 1px solid #f1f5f9; }
        .list-row-info { flex: 1; min-width: 0; }
        .list-row > .ios-toggle, .list-row > button { flex: none; }
        .danger-zone { background: #fff1f2; border: 1px dashed #fca5a5; border-radius: 12px; padding: 0.5rem 1.5rem; margin: 2rem 0 0; }
        .sx-inner .danger-zone:first-child { margin-top: 0; margin-bottom: 2rem; }
        .danger-zone .list-row { padding: 0.9rem 0; border-top: none; }
        .danger-zone h4, .danger-zone p { color: #991b1b; } .danger-zone p { opacity: 0.9; }
        .list-row-info h4 { margin: 0 0 0.3rem 0; font-size: 1rem; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 8px; }
        .list-row-info p { margin: 0; font-size: 0.85rem; color: #64748b; line-height: 1.5; max-width: 640px; }
        .badge { background: #f1f5f9; color: #64748b; padding: 2px 8px; border-radius: 6px; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #e2e8f0;}

        .setting-input { width: 100%; height: 44px; box-sizing: border-box; padding: 0 1rem; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 0.95rem; color: #0f172a; transition: 0.2s; outline: none; background: #ffffff; }
        .setting-input:hover:not(:disabled) { border-color: #cbd5e1; }
        .setting-input:focus:not(:disabled) { border-color: #436b49; box-shadow: 0 0 0 3px rgba(67, 107, 73, 0.12); }
        input[type=number].setting-input { -moz-appearance: textfield; appearance: textfield; padding-right: 2.5rem; }
        input[type=number].setting-input::-webkit-outer-spin-button, input[type=number].setting-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        textarea.setting-input { height: auto; padding: 0.75rem 1rem; line-height: 1.5; }
        .setting-input:disabled { background: #f8fafc; color: #94a3b8; cursor: not-allowed; }
        
        .setting-label {
          font-size: 0.85rem; font-weight: 700; color: #334155;
          margin-bottom: 0.5rem; display: flex; align-items: flex-start; gap: 0.35rem;
          line-height: 1.3;
        }
        
        .custom-select { appearance: none; -webkit-appearance: none; background-image: url('data:image/svg+xml;utf8,<svg viewBox="0 0 24 24" fill="none" stroke="%2364748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><polyline points="6 9 12 15 18 9"></polyline></svg>'); background-repeat: no-repeat; background-position: right 1rem center; background-size: 18px; padding-right: 2.5rem; cursor: pointer; }
        .custom-select:disabled { opacity: 0.7; }

        .sx-modes { display: flex; flex-direction: column; gap: 0.6rem; margin-top: 0.4rem; }
        .sx-mode { display: flex; align-items: flex-start; gap: 0.8rem; text-align: left; border: 1px solid #e2e8f0; background: #fff; border-radius: 12px; padding: 0.9rem 1rem; cursor: pointer; font-family: inherit; transition: border-color .15s; }
        .sx-mode:hover { border-color: #cbd5e1; }
        .sx-mode.on { border-color: #0f172a; box-shadow: 0 0 0 1px #0f172a; }
        .sx-mode i { width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid #cbd5e1; flex-shrink: 0; margin-top: 2px; position: relative; }
        .sx-mode.on i { border-color: #0f172a; }
        .sx-mode.on i::after { content: ''; position: absolute; inset: 3px; border-radius: 50%; background: #0f172a; }
        .sx-mode span { display: flex; flex-direction: column; gap: 0.2rem; }
        .sx-mode b { font-size: 0.92rem; color: #0f172a; }
        .sx-mode small { font-size: 0.8rem; color: #64748b; line-height: 1.45; }
        .sx-warn { margin: 0.8rem 0 0; font-size: 0.8rem; color: #b45309; background: #fffaf0; border: 1px solid #fcd9a1; border-radius: 10px; padding: 0.6rem 0.8rem; }
        .ios-toggle { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
        .ios-toggle input { opacity: 0; width: 0; height: 0; }
        .ios-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #e2e8f0; transition: .3s; border-radius: 34px; }
        .ios-slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 2px; bottom: 2px; background-color: white; transition: .3s; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.15); }
        .ios-toggle input:checked + .ios-slider { background-color: #10b981; }
        .ios-toggle input:checked + .ios-slider:before { transform: translateX(20px); box-shadow: -2px 2px 5px rgba(0,0,0,0.1); }
        .ios-toggle input:disabled + .ios-slider { opacity: 0.5; cursor: not-allowed; }

        .save-btn { padding: 0.9rem 2rem; background: #0f172a; color: #fff; border: none; border-radius: 12px; font-weight: 700; font-size: 0.95rem; cursor: pointer; transition: 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; }
        .save-btn:hover:not(:disabled) { background: #1e293b; transform: translateY(-1px); box-shadow: 0 6px 15px rgba(15, 23, 42, 0.15); }
        .save-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; box-shadow: none; }
      `}} />

      <div className="sx-shell">
        <div className="custom-scroll sx-main">
          <div className="sx-inner">
            {settingsView === 'main' ? (
              <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <div style={{ marginBottom: '2rem' }}>
                  <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.35rem', letterSpacing: '-0.03em' }}>Налаштування</h2>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>Системні параметри, безпека та правила вашого закладу.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
                  {SETTINGS_ORDER.map(id => {
                    const card = SETTINGS_CARDS[id];
                    const IconComponent = card.icon;
                    return (
                      <div key={card.id} onClick={() => setSettingsView(card.id as any)} className="settings-card">
                        <div className="settings-icon-wrapper" style={{ background: card.bg, color: card.color }}><IconComponent /></div>
                        <div>
                          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.4rem' }}>{card.title}</h3>
                          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0, lineHeight: 1.4 }}>{card.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <header className="sx-head">
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button type="button" className="sx-back" onClick={() => { if (settingsView === 'billing' && showPlansView) setShowPlansView(false); else setSettingsView('main'); }} aria-label="Назад до налаштувань"><SvgChevronLeft size={24} /></button>
                  <h2>{settingsView === 'billing' && showPlansView ? 'Перегляд планів' : current.title}</h2>
                </div>
                {settingsView !== 'billing' && (
                  <span className={`sx-save ${saveState}`} role="status">
                    {saveState === 'saving' ? 'Зберігаємо…' : saveState === 'error' ? 'Не збережено' : saveState === 'saved' ? 'Збережено ✓' : 'Зміни зберігаються автоматично'}
                  </span>
                )}
              </header>
            )}

        {/* 1. БРОНЮВАННЯ ТА КАЛЕНДАР */}
        {settingsView === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="clean-panel">
              <h3 className="panel-title">Чим ви займаєтесь</h3>
              <p className="panel-subtitle">
                Тип бізнесу й спосіб роботи. Разом із напрямом із «Вітрини» вони визначають типові
                значення: крок сітки, тривалість візиту й запас часу до запису.
              </p>
              <div style={{ padding: '1rem 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                <div>
                  <label className="setting-label">Напрям <HelpTip>Основна категорія закладу - за нею вас знаходять у пошуку.</HelpTip></label>
                  <div style={{
                    height: '44px', padding: '0 0.9rem', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', gap: '0.5rem',
                    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px',
                    fontSize: '0.9rem', color: '#475569',
                  }}>
                    <span>{profileSettings.category ? categoryTitle(profileSettings.category) : '—'}</span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', flexShrink: 0 }}>
                      змінюється у «Вітрині»
                    </span>
                  </div>
                </div>
                <div>
                  <label className="setting-label">Тип бізнесу</label>
                  <AppSelect
                    value={profileSettings.business_type}
                    onChange={v => setProfileSettings({ ...profileSettings, business_type: String(v) })}
                    options={[
                      { value: 'individual', label: 'Приватний майстер' },
                      { value: 'company', label: 'Заклад із командою' },
                    ]}
                  />
                </div>
                <div>
                  <label className="setting-label">Де приймаєте <HelpTip>У закладі - клієнти приходять до вас. Виїзд - ви їдете до клієнта, і час на дорогу враховується в записі.</HelpTip></label>
                  <AppSelect
                    value={profileSettings.workspace_type}
                    onChange={v => setProfileSettings({ ...profileSettings, workspace_type: String(v) })}
                    options={[
                      { value: 'my_place', label: 'У себе' },
                      { value: 'client_place', label: 'Виїзд до клієнта' },
                    ]}
                  />
                </div>
              </div>
            </div>

            <div className="clean-panel">
              <h3 className="panel-title">Назва, адреса й контакти</h3>
              <p className="panel-subtitle">Ці дані бачать клієнти на сторінці закладу та в листах.</p>
              <div style={{ padding: '1rem 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="setting-label">Назва закладу</label>
                  <input
                    type="text" className="setting-input"
                    value={contactSettings.name}
                    onChange={e => setContactSettings({ ...contactSettings, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="setting-label">Місто</label>
                  <input
                    type="text" className="setting-input"
                    value={contactSettings.city}
                    onChange={e => setContactSettings({ ...contactSettings, city: e.target.value })}
                  />
                </div>
                <div>
                  <label className="setting-label">Вулиця й номер</label>
                  <input
                    type="text" className="setting-input"
                    value={contactSettings.address}
                    placeholder="Дорошенка 10"
                    onChange={e => setContactSettings({ ...contactSettings, address: e.target.value })}
                  />
                </div>
                <div>
                  <label className="setting-label">Телефон</label>
                  <input
                    type="tel" className="setting-input"
                    value={contactSettings.phone}
                    onChange={e => setContactSettings({ ...contactSettings, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="setting-label">Пошта закладу</label>
                  <input
                    type="email" className="setting-input"
                    value={contactSettings.email}
                    placeholder="salon@example.com"
                    onChange={e => setContactSettings({ ...contactSettings, email: e.target.value })}
                  />
                  <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.4rem 0 0', lineHeight: 1.45 }}>
                    На неї приходять сповіщення про нові записи.
                  </p>
                </div>
              </div>
              <div className="list-row" style={{ borderTop: '1px solid #f1f5f9', marginTop: '0.5rem' }}>
                <div className="list-row-info">
                  <h4>Показувати телефон клієнтам</h4>
                  <p>Номер буде видно на сторінці закладу. Вимкніть, якщо клієнти мають записуватись лише онлайн.</p>
                </div>
                <label className="ios-toggle">
                  <input type="checkbox" checked={contactSettings.show_phone_publicly !== false} onChange={e => setContactSettings({ ...contactSettings, show_phone_publicly: e.target.checked })} />
                  <span className="ios-slider"></span>
                </label>
              </div>
            </div>

            {/* Мітка на мапі.
                Окремою карткою, а не полем у контактах: мапа велика
                й потребує уваги, а серед полів вона виглядала б
                випадковим блоком. */}
            {/* Мапа - СТРАХОВКА, а не обовʼязок.
                Координати шукаються автоматично за адресою. Мапа
                зʼявляється розгорнутою лише коли не знайшлось, або
                коли власник сам захотів уточнити вхід. */}
            <div className="clean-panel">
              <h3 className="panel-title">
                {isLocating ? 'Шукаємо адресу на мапі…' : hasCoords ? 'Точка на мапі' : 'Не вдалося знайти адресу на мапі'}
              </h3>
              <p className="panel-subtitle">
                {isLocating
                  ? 'Точка оновиться сама, щойно ви допишете адресу.'
                  : hasCoords
                  ? 'Ставиться сама за вашою адресою. Відкрийте мапу, якщо вхід не з фасаду.'
                  : 'Поставте мітку вручну — без неї заклад не потрапляє в пошук «поруч зі мною».'}
              </p>

              {hasCoords && !isMapOpen ? (
                <div style={{ padding: '1rem 0' }}>
                  <button
                    onClick={() => setIsMapOpen(true)}
                    style={{
                      height: '36px', padding: '0 1rem', borderRadius: '10px',
                      border: '1px solid #E8E8ED', background: '#fff', color: '#1D1D1F',
                      fontSize: '0.875rem', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
                    }}
                  >
                    Уточнити на мапі
                  </button>
                </div>
              ) : (
              <div style={{ padding: '1rem 0' }}>
                {/* Коли точки немає - спершу пропонуємо знайти її ще раз за
                    адресою. Пошук тепер розумніший (прибирає офіс, поверх,
                    розгортає «вул.»), і для багатьох адрес, що не знайшлись
                    раніше, це спрацює без ручної мітки. */}
                {!hasCoords && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    <button
                      type="button"
                      onClick={() => void retryGeocode()}
                      disabled={isGeocoding || !contactSettings.address || !contactSettings.city}
                      style={{
                        height: '36px', padding: '0 1rem', borderRadius: '10px', border: 'none',
                        background: '#1D1D1F', color: '#fff', fontSize: '0.875rem', fontWeight: 500,
                        fontFamily: 'inherit', cursor: 'pointer',
                        opacity: isGeocoding || !contactSettings.address || !contactSettings.city ? 0.4 : 1,
                      }}
                    >
                      {isGeocoding ? 'Шукаємо…' : 'Знайти за адресою'}
                    </button>
                    <span style={{ fontSize: '0.8125rem', color: '#86868B' }}>
                      {contactSettings.address ? `${contactSettings.address}, ${contactSettings.city}` : 'Спершу вкажіть адресу вище й збережіть'}
                    </span>
                  </div>
                )}
                <LocationPicker
                  city={contactSettings.city}
                  value={
                    contactSettings.latitude != null && contactSettings.longitude != null
                      ? { lat: Number(contactSettings.latitude), lng: Number(contactSettings.longitude) }
                      : null
                  }
                  onChange={({ lat, lng }) => {
                    pinMoved.current = true;
                    setContactSettings(prev => ({ ...prev, latitude: lat, longitude: lng }));
                  }}
                />
              </div>
              )}
            </div>

            <div className="clean-panel">
              <div className="list-row">
                <div className="list-row-info">
                  <h4>Типові значення для вашого напряму <HelpTip>Крок сітки, тривалість візиту, буфер і межі запису, які система підбирає за типом бізнесу й способом роботи. Поточні значення видно й міняються в розділі «Онлайн-запис».</HelpTip></h4>
                  <p>Скинути крок сітки, тривалість, буфер і межі запису до рекомендованих для вашого напряму.</p>
                </div>
                <button
                  onClick={async () => {
                    if (!business?.id) return;
                    if (!confirm('Замінити крок сітки, тривалість, буфер і межі запису на типові для вашого напряму?')) return;
                    try {
                      if (typeof api.applyProfileDefaults !== 'function') {
                        showToast('Оновіть застосунок: не вистачає частини коду (api.ts)', 'error');
                        return;
                      }
                      const token = await getAuthToken();
                      const res = await api.applyProfileDefaults(token, business.id);
                      setBookingSettings(prev => ({ ...prev, ...res.booking_settings }));
                      showToast('Типові значення застосовано', 'info');
                    } catch (err: any) {
                      showToast(err?.message || 'Не вдалося оновити значення', 'error');
                    }
                  }}
                  style={{
                    whiteSpace: 'nowrap', height: '38px', padding: '0 1rem',
                    borderRadius: '10px', border: '1px solid rgba(34,34,34,0.16)', background: '#fff',
                    color: '#222222', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                  }}
                >
                  Оновити за напрямом
                </button>
              </div>
            </div>

            {/* Видалення закладу */}
            <div className="danger-zone">
              <div className="list-row" style={{ alignItems: isDeleting ? 'flex-start' : 'center' }}>
                <div className="list-row-info">
                  <h4><SvgAlertCircle size={18} /> Видалити заклад</h4>
                  <p>Разом із закладом зникнуть записи, клієнти, послуги й історія. Дію не можна скасувати.</p>
                </div>
                {!isDeleting ? (
                  <button
                    onClick={() => setIsDeleting(true)}
                    style={{
                      height: '38px', padding: '0 1rem', borderRadius: '10px',
                      border: '1px solid rgba(168,57,52,0.25)', background: '#FBF0EF',
                      color: '#A83934', fontSize: '0.85rem', fontWeight: 600,
                      fontFamily: 'inherit', cursor: 'pointer',
                    }}
                  >
                    Видалити заклад
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '420px' }}>
                    <p style={{ fontSize: '0.875rem', color: '#0f172a', margin: 0, lineHeight: 1.5 }}>
                      Щоб підтвердити, введіть назву закладу:{' '}
                      <b>{business?.name}</b>
                    </p>
                    <input
                      type="text"
                      className="setting-input"
                      value={deleteConfirm}
                      onChange={e => setDeleteConfirm(e.target.value)}
                      placeholder={business?.name || ''}
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={async () => {
                          if (!business?.id) return;
                          try {
                            if (typeof api.deleteBusiness !== 'function') {
                              showToast('Оновіть застосунок: не вистачає частини коду (api.ts)', 'error');
                              return;
                            }
                            const token = await getAuthToken();
                            await api.deleteBusiness(token, business.id, deleteConfirm.trim());
                            window.location.href = '/business';
                          } catch (err: any) {
                            showToast(err?.message || 'Не вдалося видалити заклад', 'error');
                          }
                        }}
                        disabled={deleteConfirm.trim() !== (business?.name || '').trim()}
                        style={{
                          height: '38px', padding: '0 1rem', borderRadius: '10px', border: 'none',
                          background: '#A83934', color: '#fff', fontSize: '0.85rem', fontWeight: 600,
                          fontFamily: 'inherit',
                          cursor: deleteConfirm.trim() === (business?.name || '').trim() ? 'pointer' : 'not-allowed',
                          opacity: deleteConfirm.trim() === (business?.name || '').trim() ? 1 : 0.45,
                        }}
                      >
                        Видалити назавжди
                      </button>
                      <button
                        onClick={() => { setIsDeleting(false); setDeleteConfirm(''); }}
                        style={{
                          height: '38px', padding: '0 1rem', borderRadius: '10px',
                          border: '1px solid #e2e8f0', background: '#fff', color: '#475569',
                          fontSize: '0.85rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                        }}
                      >
                        Скасувати
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. ОНЛАЙН-БРОНЮВАННЯ */}
        {settingsView === 'booking' && (
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '100%', animation: 'fadeIn 0.3s ease-out' }}>

            <div className="clean-panel">
              <h3 className="panel-title">Підтвердження записів</h3>
              <p className="panel-subtitle">Що відбувається, коли клієнт записується онлайн.</p>
              <div className="sx-modes">
                {([
                  [true, 'Автоматично', 'Запис одразу підтверджується. Клієнт отримує лист-підтвердження.'],
                  [false, 'Після вашого підтвердження', 'Запис чекає вашої відповіді й тримає час. Клієнт отримує лист «запит отримано», а потім — підтверджено чи ні. Підтвердити можна в календарі.'],
                ] as [boolean, string, string][]).map(([val, title, text]) => (
                  <button key={String(val)} type="button" className={`sx-mode ${notificationSettings.auto_approve === val ? 'on' : ''}`} onClick={() => setNotificationSettings({ ...notificationSettings, auto_approve: val })}>
                    <i />
                    <span><b>{title}</b><small>{text}</small></span>
                  </button>
                ))}
              </div>
              {!notificationSettings.notify_client_booking && (
                <p className="sx-warn">Листи клієнтам вимкнено («Листи й сповіщення»): клієнт не дізнається про підтвердження чи відмову. Увімкніть їх, якщо підтверджуєте вручну.</p>
              )}
            </div>

            <div className="danger-zone">
              <div className="list-row">
                <div className="list-row-info">
                  <h4><SvgAlertCircle size={18} /> Тимчасово призупинити запис</h4>
                  <p>Клієнти побачать повідомлення "Заклад тимчасово не приймає онлайн-записи". Ви та ваші майстри зможете додавати записи вручну.</p>
                </div>
                <label className="ios-toggle">
                  <input type="checkbox" checked={bookingSettings.is_paused_emergency} onChange={e => setBookingSettings({...bookingSettings, is_paused_emergency: e.target.checked})} />
                  <span className="ios-slider" style={{ backgroundColor: bookingSettings.is_paused_emergency ? '#ef4444' : '#cbd5e1' }}></span>
                </label>
              </div>
            </div>

            <div className="clean-panel">
              <div className="list-row">
                <div className="list-row-info">
                  <h4>Посилання для запису</h4>
                  <p>Вставте його в Instagram, Telegram чи Google-карти: клієнт одразу потрапить на вашу сторінку запису.</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const url = `${window.location.origin}/${business?.slug || business?.id}`;
                    try { await navigator.clipboard.writeText(url); showToast('Посилання скопійовано', 'success'); }
                    catch { showToast(url, 'success'); }
                  }}
                  style={{ height: '38px', padding: '0 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#0f172a', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Скопіювати посилання
                </button>
              </div>
            </div>

            <div className="clean-panel" style={{ opacity: bookingSettings.is_paused_emergency ? 0.6 : 1, pointerEvents: bookingSettings.is_paused_emergency ? 'none' : 'auto' }}>
              <div className="list-row">
                <div className="list-row-info">
                  <h4>Приймати онлайн-записи</h4>
                  <p>Дозвольте клієнтам самостійно бронювати вільний час через вашу сторінку або віджет.</p>
                </div>
                <label className="ios-toggle">
                  <input type="checkbox" checked={bookingSettings.is_active} disabled={bookingSettings.is_paused_emergency} onChange={e => setBookingSettings({...bookingSettings, is_active: e.target.checked})} />
                  <span className="ios-slider"></span>
                </label>
              </div>
            </div>

            <div className="clean-panel" style={{ opacity: bookingSettings.is_paused_emergency ? 0.6 : 1, pointerEvents: bookingSettings.is_paused_emergency ? 'none' : 'auto' }}>
              <h3 className="panel-title">Доступність вікон для запису</h3>
              <p className="panel-subtitle">Ці налаштування визначають, які саме слоти часу клієнти бачитимуть у віджеті.</p>

              <div style={{ padding: '1rem 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                <div>
                  <label className="setting-label">
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>Інтервал часу <HelpTip>Час, який пропонується клієнту на вибір. Визначає щільність записів.</HelpTip></span>
                  </label>
                  <AppSelect
                    value={bookingSettings.time_step}
                    onChange={v => setBookingSettings({ ...bookingSettings, time_step: Number(v) })}
                    options={[
                      { value: 5, label: 'Кожні 5 хвилин' },
                      { value: 10, label: 'Кожні 10 хвилин' },
                      { value: 15, label: 'Кожні 15 хвилин' },
                      { value: 20, label: 'Кожні 20 хвилин' },
                      { value: 30, label: 'Кожні 30 хвилин' },
                      { value: 45, label: 'Кожні 45 хвилин' },
                      { value: 60, label: 'Кожну годину' },
                    ]}
                  />
                </div>

                <div>
                  <label className="setting-label">
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>Буфер після візиту <HelpTip>Час на прибирання й підготовку між клієнтами.</HelpTip></span>
                  </label>
                  <AppSelect
                    value={bookingSettings.buffer_minutes}
                    onChange={v => setBookingSettings({ ...bookingSettings, buffer_minutes: Number(v) })}
                    options={[
                      { value: 0, label: 'Без буфера' },
                      { value: 5, label: '5 хвилин' },
                      { value: 10, label: '10 хвилин' },
                      { value: 15, label: '15 хвилин' },
                      { value: 20, label: '20 хвилин' },
                      { value: 30, label: '30 хвилин' },
                      { value: 45, label: '45 хвилин' },
                      { value: 60, label: '1 година' },
                    ]}
                  />
                </div>

                <div>
                  <label className="setting-label">
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>Тривалість візиту <HelpTip>Значення за замовчуванням. Підставляється при створенні нової послуги.</HelpTip></span>
                  </label>
                  <AppSelect
                    value={bookingSettings.default_duration}
                    onChange={v => setBookingSettings({ ...bookingSettings, default_duration: Number(v) })}
                    options={[
                      { value: 15, label: '15 хвилин' },
                      { value: 20, label: '20 хвилин' },
                      { value: 30, label: '30 хвилин' },
                      { value: 45, label: '45 хвилин' },
                      { value: 60, label: '1 година' },
                      { value: 90, label: '1.5 години' },
                      { value: 120, label: '2 години' },
                      { value: 150, label: '2.5 години' },
                      { value: 180, label: '3 години' },
                      { value: 240, label: '4 години' },
                    ]}
                  />
                </div>

                <div>
                  <label className="setting-label">
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>Мінімум часу до візиту <HelpTip>Забороняє клієнтам бронювати візит "в останню секунду".</HelpTip></span>
                  </label>
                  <AppSelect
                    value={bookingSettings.min_advance_hours}
                    onChange={v => setBookingSettings({ ...bookingSettings, min_advance_hours: Number(v) })}
                    options={[
                      { value: 0, label: 'Можна записуватись одразу' },
                      { value: 1, label: 'Мінімум за 1 годину' },
                      { value: 2, label: 'Мінімум за 2 години' },
                      { value: 3, label: 'Мінімум за 3 години' },
                      { value: 6, label: 'Мінімум за 6 годин' },
                      { value: 12, label: 'Мінімум за 12 годин' },
                      { value: 24, label: 'Мінімум за добу' },
                      { value: 48, label: 'Мінімум за 2 доби' },
                    ]}
                  />
                </div>

                <div>
                  <label className="setting-label">
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>Горизонт планування <HelpTip>На скільки днів вперед клієнти можуть гортати календар.</HelpTip></span>
                  </label>
                  <AppSelect
                    value={bookingSettings.max_advance_days}
                    onChange={v => setBookingSettings({ ...bookingSettings, max_advance_days: Number(v) })}
                    options={[
                      { value: 7, label: 'На 1 тиждень' },
                      { value: 14, label: 'На 2 тижні' },
                      { value: 30, label: 'На 1 місяць' },
                      { value: 60, label: 'На 2 місяці' },
                      { value: 90, label: 'На 3 місяці' },
                      { value: 180, label: 'На пів року' },
                      { value: 365, label: 'На рік' },
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* Закриті періоди */}
            <div className="clean-panel">
              <h3 className="panel-title">Закриті періоди</h3>
              <p className="panel-subtitle">Відпустка, санітарні дні, ремонт. У ці дати клієнти не зможуть записатись.</p>
              <div style={{ padding: '1rem 0' }}>
                {(bookingSettings.closed_periods || []).length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                    {bookingSettings.closed_periods.map((period: any, idx: number) => (
                      <div key={idx} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                        padding: '0.7rem 0.9rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px',
                      }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>
                            {period.start} — {period.end}
                          </div>
                          {period.reason && (
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>{period.reason}</div>
                          )}
                        </div>
                        <button
                          onClick={() => setBookingSettings({
                            ...bookingSettings,
                            closed_periods: bookingSettings.closed_periods.filter((_: any, i: number) => i !== idx),
                          })}
                          style={{ background: 'transparent', border: 'none', color: '#A83934', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, flexShrink: 0 }}
                        >
                          Прибрати
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: '1 1 130px' }}>
                    <label className="setting-label" style={{ fontSize: '0.8rem' }}>Від</label>
                    <input data-field="period-start" type="date" className="setting-input" value={newPeriod.start}
                      onChange={e => setNewPeriod({ ...newPeriod, start: e.target.value })} />
                  </div>
                  <div style={{ flex: '1 1 130px' }}>
                    <label className="setting-label" style={{ fontSize: '0.8rem' }}>До</label>
                    <input data-field="period-end" type="date" className="setting-input" value={newPeriod.end}
                      onChange={e => setNewPeriod({ ...newPeriod, end: e.target.value })} />
                  </div>
                  <div style={{ flex: '2 1 180px' }}>
                    <label className="setting-label" style={{ fontSize: '0.8rem' }}>Причина (необовʼязково)</label>
                    <input type="text" className="setting-input" value={newPeriod.reason}
                      placeholder="Відпустка"
                      onChange={e => setNewPeriod({ ...newPeriod, reason: e.target.value })} />
                  </div>
                  <button
                    onClick={() => {
                      if (!newPeriod.start || !newPeriod.end) return showToast('Вкажіть обидві дати', 'error', { field: !newPeriod.start ? 'period-start' : 'period-end' });
                      if (newPeriod.end < newPeriod.start) return showToast('Дата «до» раніша за «від»', 'error');
                      setBookingSettings({
                        ...bookingSettings,
                        closed_periods: [...(bookingSettings.closed_periods || []), { ...newPeriod }],
                      });
                      setNewPeriod({ start: '', end: '', reason: '' });
                    }}
                    style={{ height: '44px', padding: '0 1.1rem', borderRadius: '10px', border: 'none', background: '#222222', color: '#fff', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
                  >
                    Додати
                  </button>
                </div>
              </div>
            </div>

            <div className="clean-panel">
              <h3 className="panel-title">Умови скасування</h3>
              <p className="panel-subtitle">Це правило діє на сторінці керування записом: після цього часу клієнт уже не скасує запис онлайн, а лише за дзвінком. Ви та майстри можете скасувати будь-коли.</p>
              <div style={{ padding: '0.5rem 0 1rem', maxWidth: '420px' }}>
                <label className="setting-label" style={{ minHeight: 'auto' }}>Клієнт може скасувати онлайн</label>
                <AppSelect
                  value={bookingSettings.cancel_before_hours}
                  onChange={v => setBookingSettings({ ...bookingSettings, cancel_before_hours: Number(v) })}
                  options={[
                    { value: 0, label: 'Будь-коли до візиту' },
                    { value: 2, label: 'Не пізніше ніж за 2 години' },
                    { value: 6, label: 'Не пізніше ніж за 6 годин' },
                    { value: 12, label: 'Не пізніше ніж за 12 годин' },
                    { value: 24, label: 'Не пізніше ніж за 24 години' },
                    { value: 48, label: 'Не пізніше ніж за 2 доби' },
                    { value: 72, label: 'Не пізніше ніж за 3 доби' },
                  ]}
                />
              </div>
              <label className="setting-label" style={{ minHeight: 'auto' }}>Пояснення для клієнта <span style={{ color: '#94a3b8', fontWeight: 500 }}>(необов’язково)</span></label>
              <textarea
                value={bookingSettings.cancellation_policy}
                onChange={e => setBookingSettings({...bookingSettings, cancellation_policy: e.target.value})}
                className="setting-input"
                style={{ minHeight: '90px', resize: 'none' }}
                placeholder="Наприклад: передоплата за пізнє скасування не повертається."
              />
            </div>

          </div>
        )}

        {/* 3. БЕЗПЕКА ТА ЧОРНИЙ СПИСОК */}
        {settingsView === 'security' && (
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '100%', animation: 'fadeIn 0.3s ease-out' }}>
            <div className="clean-panel">
              <div className="list-row">
                <div className="list-row-info">
                  <h4>Блокувати за неявки</h4>
                  <p>Онлайн-запис для номера, за яким відмічено 3 і більше неявок, буде закрито. Записати такого клієнта зможете лише ви вручну.</p>
                </div>
                <label className="ios-toggle"><input type="checkbox" checked={securitySettings.block_no_shows} onChange={e => setSecuritySettings({...securitySettings, block_no_shows: e.target.checked})} /><span className="ios-slider"></span></label>
              </div>
            </div>
          </div>
        )}

        {/* 4. СИСТЕМНІ СПОВІЩЕННЯ */}
        {settingsView === 'notifications' && (
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '100%', animation: 'fadeIn 0.3s ease-out' }}>
            <div className="clean-panel">
              <h3 className="panel-title">Клієнти</h3>
              <p className="panel-subtitle">Листи, які клієнт отримує автоматично.</p>
              <div className="list-row">
                <div className="list-row-info">
                  <h4>Листи клієнту про запис</h4>
                  <p>Лист при записі (або «запит отримано», якщо ви підтверджуєте вручну) і лист із вашою відповіддю: підтверджено чи ні. У листі є посилання, щоб перенести чи скасувати візит.</p>
                </div>
                <label className="ios-toggle"><input type="checkbox" checked={notificationSettings.notify_client_booking} onChange={e => setNotificationSettings({...notificationSettings, notify_client_booking: e.target.checked})} /><span className="ios-slider"></span></label>
              </div>
              <div className="list-row">
                <div className="list-row-info">
                  <h4>Нагадування за 24 години (лист)</h4>
                  <p>За добу до візиту клієнт отримує лист-нагадування.</p>
                </div>
                <label className="ios-toggle"><input type="checkbox" checked={notificationSettings.notify_client_reminder_sms} onChange={e => setNotificationSettings({...notificationSettings, notify_client_reminder_sms: e.target.checked})} /><span className="ios-slider"></span></label>
              </div>
            </div>
            <div className="clean-panel">
              <h3 className="panel-title">Команда</h3>
              <div className="list-row">
                <div className="list-row-info">
                  <h4>Листи про нові записи</h4>
                  <p>Заклад (і майстер, якщо в нього є своя пошта) отримує лист про кожен новий запис.</p>
                </div>
                <label className="ios-toggle"><input type="checkbox" checked={notificationSettings.notify_staff_booking} onChange={e => setNotificationSettings({...notificationSettings, notify_staff_booking: e.target.checked})} /><span className="ios-slider"></span></label>
              </div>
            </div>
          </div>
        )}

        {/* 5. ПЛАТЕЖІ ТА КАСА */}
        {settingsView === 'payments' && (
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '100%', animation: 'fadeIn 0.3s ease-out' }}>
            <div className="clean-panel">
              <p className="panel-subtitle">Сума, яку клієнт сплачує карткою онлайн при записі. Платформа тримає завдаток до візиту й виплачує його вам, автоматично вирахувавши комісію за нових клієнтів з вітрини (див. «Фінанси та виплати»). Скасував клієнт — завдаток повертається, не прийшов — лишається вам.</p>
              <div className="list-row">
                <div className="list-row-info">
                  <h4>Вказувати передоплату в записі</h4>
                  <p>Кожен онлайн-запис отримає суму передоплати за правилами нижче.</p>
                </div>
                <label className="ios-toggle"><input type="checkbox" checked={paymentsSettings.require_deposit} onChange={e => setPaymentsSettings({...paymentsSettings, require_deposit: e.target.checked})} /><span className="ios-slider"></span></label>
              </div>

              {paymentsSettings.require_deposit && (
                <div style={{ padding: '1.25rem 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', borderTop: '1px solid #f1f5f9' }}>
                  <div>
                    <label className="setting-label" style={{ minHeight: "auto" }}>Тип депозиту <HelpTip>Фіксована сума (наприклад, 200 ₴) або відсоток від вартості послуги. Передоплата не буває більшою за саму послугу.</HelpTip></label>
                    <AppSelect
                      value={paymentsSettings.deposit_type}
                      onChange={v => setPaymentsSettings({ ...paymentsSettings, deposit_type: String(v) })}
                      options={[
                        { value: 'fixed', label: 'Фіксована сума' },
                        { value: 'percent', label: 'Відсоток від вартості' },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="setting-label" style={{ minHeight: "auto" }}>Сума / Відсоток</label>
                    <div style={{ position: 'relative' }}>
                      <input type="number" className="setting-input" value={paymentsSettings.deposit_amount ? paymentsSettings.deposit_amount : ''} placeholder="0" inputMode="decimal" min={0} max={paymentsSettings.deposit_type === 'percent' ? 100 : undefined} onChange={e => setPaymentsSettings({...paymentsSettings, deposit_amount: Math.max(0, paymentsSettings.deposit_type === 'percent' ? Math.min(100, Number(e.target.value) || 0) : Number(e.target.value) || 0)})} />
                      <span style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontWeight: '800' }}>
                        {paymentsSettings.deposit_type === 'percent' ? '%' : '₴'}
                      </span>
                    </div>
                  </div>
                  <p style={{ gridColumn: '1 / -1', margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                    Приклад: послуга за 1 000 ₴ → передоплата{' '}
                    <b style={{ color: '#0f172a' }}>
                      {Math.round(paymentsSettings.deposit_type === 'percent' ? 1000 * Math.min(paymentsSettings.deposit_amount || 0, 100) / 100 : Math.min(paymentsSettings.deposit_amount || 0, 1000)).toLocaleString('uk-UA')} ₴
                    </b>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 6. ПІДПИСКА - справжні дані з сервера */}
        {settingsView === 'finance' && <FinancePanel businessId={Number(business?.id)} />}

        {settingsView === 'billing' && <SubscriptionPanel businessId={Number(business?.id)} showPlans={showPlansView} onShowPlans={setShowPlansView} />}

          </div>
        </div>
      </div>
    </>
  );
}
