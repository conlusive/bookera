'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';

interface SettingsTabProps {
  business: any;
  Icons?: any;
}

// ВЕКТОРНІ ІКОНКИ
const SvgIcon = ({ d, size = 24, color = "currentColor", children, strokeWidth = 2, ...props }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>{d && <path d={d} />}{children}</svg>
);
const SvgChevronLeft = (p:any) => <SvgIcon {...p}><polyline points="15 18 9 12 15 6"></polyline></SvgIcon>;
const SvgSearch = (p:any) => <SvgIcon {...p}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></SvgIcon>;
const SvgCrown = (p:any) => <SvgIcon {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></SvgIcon>;
const SvgCheck = (p:any) => <SvgIcon strokeWidth="3" {...p}><polyline points="20 6 9 17 4 12"></polyline></SvgIcon>;
const SvgAlertCircle = (p:any) => <SvgIcon {...p}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></SvgIcon>;
const SvgGlobe = (p:any) => <SvgIcon {...p}><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></SvgIcon>;
const SvgCreditCard = (p:any) => <SvgIcon {...p}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></SvgIcon>;
const SvgBell = (p:any) => <SvgIcon {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></SvgIcon>;
const SvgShieldCheck = (p:any) => <SvgIcon {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></SvgIcon>;
const SvgLock = (p:any) => <SvgIcon {...p}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></SvgIcon>;
const SvgHelpCircle = (p:any) => <SvgIcon {...p}><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></SvgIcon>;
const SvgWand = (p:any) => <SvgIcon {...p}><path d="M2.7 15.3l16.6-16.6a2.4 2.4 0 0 1 3.4 3.4L6.1 18.7M19 13l2.4-2.4a2.4 2.4 0 0 0-3.4-3.4L15.6 9.6M2 22l3.5-3.5"></path></SvgIcon>;
const SvgDownload = (p:any) => <SvgIcon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></SvgIcon>;
const SvgGift = (p:any) => <SvgIcon {...p}><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></SvgIcon>;
const SvgCreditCardPlus = (p:any) => <SvgIcon {...p}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line><line x1="12" y1="15" x2="12" y2="19"></line><line x1="10" y1="17" x2="14" y2="17"></line></SvgIcon>;

const businessSettingsCards = [
  { id: 'booking', title: 'Онлайн-бронювання', desc: 'Правила сітки, зупинка запису та скасування.', icon: SvgGlobe, color: '#3b82f6', bg: '#eff6ff' },
  { id: 'security', title: 'Безпека та Чорний список', desc: 'Захист від фейкових записів та спаму.', icon: SvgLock, color: '#ef4444', bg: '#fef2f2' },
  { id: 'payments', title: 'Платежі та Каса', desc: 'Депозити, передоплата та валюта.', icon: SvgCreditCard, color: '#10b981', bg: '#ecfdf5' },
  { id: 'notifications', title: 'Системні сповіщення', desc: 'SMS-нагадування, підтвердження та пуші.', icon: SvgBell, color: '#f59e0b', bg: '#fffbeb' },
  { id: 'billing', title: 'Підписка та Білінг', desc: 'Поточний тариф, ліміти та методи оплати.', icon: SvgShieldCheck, color: '#8b5cf6', bg: '#f5f3ff' },
];

export default function SettingsTab({ business }: SettingsTabProps) {
  const supabase = createClient();
  const [settingsView, setSettingsView] = useState<'main' | 'payments' | 'billing' | 'notifications' | 'booking' | 'security'>('main');
  const [searchQuery, setSearchQuery] = useState('');

  const [isSettingsSaving, setIsSettingsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // СТАНИ НАЛАШТУВАНЬ
  const [bookingSettings, setBookingSettings] = useState({
    is_active: true, is_paused_emergency: false, min_advance_hours: 2, max_advance_days: 30, time_step: 30,
    cancellation_policy: 'Скасування можливе не пізніше ніж за 24 години до візиту.'
  });

  const [showPlansView, setShowPlansView] = useState(false);

  const [notificationSettings, setNotificationSettings] = useState({
    auto_approve: true, notify_client_booking: true, notify_client_reminder_sms: true, notify_staff_booking: true
  });

  const [securitySettings, setSecuritySettings] = useState({
    block_no_shows: true, require_phone_verification: false,
  });

  const [isEditingCard, setIsEditingCard] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const [paymentsSettings, setPaymentsSettings] = useState({
    currency: 'UAH', require_deposit: false, deposit_amount: 100, deposit_type: 'fixed'
  });

  useEffect(() => {
    if (business) {
      if (business.booking_settings) setBookingSettings(prev => ({ ...prev, ...business.booking_settings }));
      if (business.notification_settings) setNotificationSettings(prev => ({ ...prev, ...business.notification_settings }));
      if (business.payments_settings) setPaymentsSettings(prev => ({ ...prev, ...business.payments_settings }));
      if (business.security_settings) setSecuritySettings(prev => ({ ...prev, ...business.security_settings }));
    }
  }, [business]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const saveSettingsToDB = async (column: string, data: any, successMsg: string) => {
    if (!business) return;
    setIsSettingsSaving(true);
    try {
      const token = await getAuthToken();
      await api.updateBusiness(token, business.id, { [column]: data });
      showToast(successMsg);
    } catch(e: any) {
      console.warn(`Помилка оновлення ${column}:`, e.message || e);
      showToast(e?.message || 'Помилка збереження');
    } finally {
      setIsSettingsSaving(false);
    }
  };

  // РЕАЛЬНИЙ АЛГОРИТМ АНАЛІЗУ ПОСЛУГ
  const handleAIRecommendation = async () => {
    if (!business) return;
    setIsAnalyzing(true);

    try {
      const { data: services, error } = await supabase
        .from('services')
        .select('duration, price')
        .eq('business_id', business.id);

      if (error) throw error;

      if (!services || services.length === 0) {
        showToast('Помилка: У вас ще немає послуг для аналізу.');
        setIsAnalyzing(false);
        return;
      }

      const durations = services.map(s => s.duration).filter(d => d && d > 0);
      let calculatedTimeStep = 30;

      if (durations.length > 0) {
        const minDuration = Math.min(...durations);
        const needs15MinStep = durations.some(d => d % 30 !== 0);
        const canUse60MinStep = durations.every(d => d % 60 === 0);

        if (needs15MinStep || minDuration <= 15) {
          calculatedTimeStep = 15;
        } else if (canUse60MinStep && minDuration >= 60) {
          calculatedTimeStep = 60;
        } else {
          calculatedTimeStep = 30;
        }
      }

      const validPrices = services.map(s => s.price).filter(p => p && p > 0);
      const avgPrice = validPrices.length > 0 ? validPrices.reduce((a, b) => a + b, 0) / validPrices.length : 0;

      let calculatedPolicy = 'Скасування або перенесення візиту можливе не пізніше ніж за 24 години до початку.';
      let suggestDeposit = false;

      if (avgPrice > 1000) {
        suggestDeposit = true;
        calculatedPolicy = 'Зверніть увагу: скасування без штрафу можливе за 24 години. У разі пізнього скасування або неявки, передоплата (депозит) не повертається, оскільки ми бронюємо час майстра під складні послуги.';
      }

      setBookingSettings(prev => ({
        ...prev,
        time_step: calculatedTimeStep,
        min_advance_hours: 1,
        cancellation_policy: calculatedPolicy
      }));

      if (suggestDeposit) {
        setPaymentsSettings(prev => ({
          ...prev,
          require_deposit: true,
          deposit_type: 'percent',
          deposit_amount: 20
        }));
        showToast(`Проаналізовано! Крок сітки: ${calculatedTimeStep}хв. Додано вимогу депозиту через високий середній чек.`);
      } else {
        showToast(`Проаналізовано! Найкращий крок для ваших послуг: ${calculatedTimeStep} хв.`);
      }

    } catch (err) {
      console.warn("AI Algorithmic Error:", err);
      showToast('Не вдалося проаналізувати послуги.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleHeaderSave = () => {
    if (settingsView === 'booking') saveSettingsToDB('booking_settings', bookingSettings, 'Налаштування бронювання збережено');
    else if (settingsView === 'security') saveSettingsToDB('security_settings', securitySettings, 'Безпеку збережено');
    else if (settingsView === 'notifications') saveSettingsToDB('notification_settings', notificationSettings, 'Сповіщення збережено');
    else if (settingsView === 'payments') saveSettingsToDB('payments_settings', paymentsSettings, 'Платежі збережено');
  };

  const filteredCards = businessSettingsCards.filter(card =>
    String(card?.title ?? '').toLowerCase().includes(String(searchQuery ?? '').toLowerCase()) ||
    String(card?.desc ?? '').toLowerCase().includes(String(searchQuery ?? '').toLowerCase())
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        
        @keyframes slideUpRightFade { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        
        .settings-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.5rem; cursor: pointer; display: flex; align-items: flex-start; gap: 1.25rem; transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
        .settings-card:hover { border-color: #cbd5e1; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.04); transform: translateY(-3px); }
        .settings-icon-wrapper { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: 0.2s; }
        
        .clean-panel { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; margin-bottom: 2rem; box-shadow: 0 2px 10px rgba(0,0,0,0.01); overflow: hidden; }
        .panel-title { font-size: 1.1rem; font-weight: 800; color: #0f172a; padding: 1.5rem 2rem 0.5rem 2rem; margin: 0; }
        .panel-subtitle { font-size: 0.9rem; color: #64748b; padding: 0 2rem 1rem 2rem; margin: 0; border-bottom: 1px solid #f1f5f9; }
        
        .list-row { padding: 1.5rem 2rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s; }
        .list-row:hover { background: #fcfcfd; }
        .list-row:last-child { border-bottom: none; }
        .list-row-info h4 { margin: 0 0 0.3rem 0; font-size: 1rem; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 8px; }
        .list-row-info p { margin: 0; font-size: 0.85rem; color: #64748b; line-height: 1.5; max-width: 90%; }
        .badge { background: #f1f5f9; color: #64748b; padding: 2px 8px; border-radius: 6px; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #e2e8f0;}

        .setting-input { width: 100%; padding: 0.85rem 1rem; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 0.95rem; color: #0f172a; transition: 0.2s; outline: none; background: #ffffff; }
        .setting-input:hover:not(:disabled) { border-color: #cbd5e1; }
        .setting-input:focus:not(:disabled) { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
        .setting-input:disabled { background: #f8fafc; color: #94a3b8; cursor: not-allowed; }
        
        .setting-label { font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 0.5rem; display: flex; align-items: center; }
        
        .custom-select { appearance: none; -webkit-appearance: none; background-image: url('data:image/svg+xml;utf8,<svg viewBox="0 0 24 24" fill="none" stroke="%2364748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><polyline points="6 9 12 15 18 9"></polyline></svg>'); background-repeat: no-repeat; background-position: right 1rem center; background-size: 18px; padding-right: 2.5rem; cursor: pointer; }
        .custom-select:disabled { opacity: 0.7; }

        .tooltip-wrap { position: relative; display: inline-flex; align-items: center; gap: 6px; cursor: help; }
        .tooltip-icon { color: #94a3b8; transition: 0.2s; }
        .tooltip-wrap:hover .tooltip-icon { color: #3b82f6; }
        .tooltip-content {
          visibility: hidden; opacity: 0; position: absolute; bottom: 130%; left: 50%; transform: translateX(-50%) translateY(5px);
          background: #1e293b; color: #fff; padding: 0.6rem 0.8rem; border-radius: 8px; font-size: 0.75rem; font-weight: 500;
          white-space: normal; width: 220px; text-align: center; z-index: 10; transition: all 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.15); pointer-events: none;
        }
        .tooltip-wrap:hover .tooltip-content { visibility: visible; opacity: 1; transform: translateX(-50%) translateY(0); }
        .tooltip-content::after { content: ''; position: absolute; top: 100%; left: 50%; margin-left: -5px; border-width: 5px; border-style: solid; border-color: #1e293b transparent transparent transparent; }

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

      <div style={{ padding: '2rem 3rem', flex: 1, display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '1000px', fontFamily: 'Inter, -apple-system, sans-serif' }}>

        {/* ГОЛОВНЕ МЕНЮ НАЛАШТУВАНЬ */}
        {settingsView === 'main' && (
          <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem' }}>
              <div>
                <h2 style={{ fontSize: '2.4rem', fontWeight: '900', color: '#0f172a', margin: '0 0 0.5rem 0', letterSpacing: '-0.03em' }}>Налаштування</h2>
                <p style={{ color: '#64748b', fontSize: '1rem', margin: 0 }}>Системні параметри, безпека та правила вашого закладу.</p>
              </div>

              <div style={{ position: 'relative', width: '320px', marginTop: '0.5rem' }}>
                <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex' }}><SvgSearch size={18} /></div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Пошук налаштувань..."
                  className="setting-input"
                  style={{ paddingLeft: '2.6rem', background: '#f8fafc', borderRadius: '12px' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
              {filteredCards.map(card => {
                const IconComponent = card.icon;
                return (
                  <div key={card.id} onClick={() => setSettingsView(card.id as any)} className="settings-card">
                    <div className="settings-icon-wrapper" style={{ background: card.bg, color: card.color }}>
                       <IconComponent />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', margin: '0 0 0.4rem 0' }}>{card.title}</h3>
                      <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0, lineHeight: '1.4' }}>{card.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ШАПКА ДЛЯ ПІДМЕНЮ */}
        {settingsView !== 'main' && (
          <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', animation: 'fadeIn 0.2s ease-out', maxWidth: '850px' }}>

            {/* Ліва частина: Назад + Заголовок */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  if (settingsView === 'billing' && showPlansView) {
                    setShowPlansView(false);
                  } else {
                    setSettingsView('main');
                    setShowPlansView(false);
                  }
                }}
                style={{ background: 'transparent', border: 'none', color: '#1d1d1f', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.4rem' }}
              >
                <SvgChevronLeft size={24} />
              </button>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#1d1d1f', margin: 0, letterSpacing: '-0.02em' }}>
                {showPlansView && settingsView === 'billing' ? 'Перегляд планів' : businessSettingsCards.find(c => c.id === settingsView)?.title}
              </h2>
            </div>

            {/* Права частина: Кнопка збереження (Apple Style) */}
            {['booking', 'security', 'notifications', 'payments'].includes(settingsView) && (
              <button
                onClick={handleHeaderSave}
                disabled={isSettingsSaving}
                className="save-btn"
                style={{ padding: '0.6rem 1.4rem', fontSize: '0.9rem', borderRadius: '10px' }}
              >
                {isSettingsSaving ? 'Збереження...' : 'Зберегти зміни'}
              </button>
            )}

          </div>
        )}

        {/* ========================================= */}
        {/* 1. БРОНЮВАННЯ ТА КАЛЕНДАР                 */}
        {/* ========================================= */}
        {settingsView === 'booking' && (
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '850px', animation: 'fadeIn 0.3s ease-out' }}>

            <div className="clean-panel" style={{ border: '1px solid #fecaca', background: '#fef2f2' }}>
              <div className="list-row" style={{ background: 'transparent' }}>
                <div className="list-row-info">
                  <h4 style={{ color: '#b91c1c' }}><SvgAlertCircle size={18} /> Тимчасово призупинити запис</h4>
                  <p style={{ color: '#991b1b' }}>Клієнти побачать повідомлення "Заклад тимчасово не приймає онлайн-записи". Ви та ваші майстри зможете додавати записи вручну.</p>
                </div>
                <label className="ios-toggle">
                  <input type="checkbox" checked={bookingSettings.is_paused_emergency} onChange={e => setBookingSettings({...bookingSettings, is_paused_emergency: e.target.checked})} />
                  <span className="ios-slider" style={{ backgroundColor: bookingSettings.is_paused_emergency ? '#ef4444' : '#cbd5e1' }}></span>
                </label>
              </div>
            </div>

            <div className="clean-panel" style={{ opacity: bookingSettings.is_paused_emergency ? 0.6 : 1, pointerEvents: bookingSettings.is_paused_emergency ? 'none' : 'auto' }}>
              <div className="list-row">
                <div className="list-row-info">
                  <h4>Приймати онлайн-записи <span className="badge">Базове</span></h4>
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

              <div style={{ margin: '1.5rem 2rem 0 2rem', background: 'linear-gradient(to right, #eff6ff, #e0e7ff)', border: '1px dashed #818cf8', borderRadius: '12px', padding: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                 <div>
                   <h4 style={{ margin: '0 0 0.3rem 0', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}>
                     <SvgWand size={16} /> Алгоритмічний підбір
                   </h4>
                   <p style={{ margin: 0, fontSize: '0.85rem', color: '#3b82f6' }}>Система проаналізує вашу базу послуг та розрахує ідеальну сітку часу.</p>
                 </div>
                 <button onClick={handleAIRecommendation} disabled={isAnalyzing} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', transition: '0.2s', opacity: isAnalyzing ? 0.7 : 1 }}>
                   {isAnalyzing ? 'Аналізуємо БД...' : 'Підібрати автоматично'}
                 </button>
              </div>

              <div style={{ padding: '1.5rem 2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>

                <div>
                  <label className="setting-label">
                    <div className="tooltip-wrap">
                      Інтервал часу
                      <SvgHelpCircle size={14} className="tooltip-icon" />
                      <div className="tooltip-content">Час, який пропонується клієнту на вибір. Визначає щільність записів.</div>
                    </div>
                  </label>
                  <select className="setting-input custom-select" value={bookingSettings.time_step} onChange={e => setBookingSettings({...bookingSettings, time_step: Number(e.target.value)})}>
                    <option value={15}>Кожні 15 хвилин</option>
                    <option value={30}>Кожні 30 хвилин</option>
                    <option value={60}>Кожну годину</option>
                  </select>
                </div>

                <div>
                  <label className="setting-label">
                    <div className="tooltip-wrap">
                      Мінімум часу до візиту
                      <SvgHelpCircle size={14} className="tooltip-icon" />
                      <div className="tooltip-content">Забороняє клієнтам бронювати візит "в останню секунду", даючи майстру час на підготовку.</div>
                    </div>
                  </label>
                  <select className="setting-input custom-select" value={bookingSettings.min_advance_hours} onChange={e => setBookingSettings({...bookingSettings, min_advance_hours: Number(e.target.value)})}>
                    <option value={0}>Можна записуватись одразу</option>
                    <option value={1}>Мінімум за 1 годину</option>
                    <option value={2}>Мінімум за 2 години</option>
                    <option value={24}>Мінімум за 24 години</option>
                  </select>
                </div>

                <div>
                  <label className="setting-label">
                    <div className="tooltip-wrap">
                      Горизонт планування
                      <SvgHelpCircle size={14} className="tooltip-icon" />
                      <div className="tooltip-content">На скільки днів вперед клієнти можуть гортати календар.</div>
                    </div>
                  </label>
                  <select className="setting-input custom-select" value={bookingSettings.max_advance_days} onChange={e => setBookingSettings({...bookingSettings, max_advance_days: Number(e.target.value)})}>
                    <option value={7}>На 1 тиждень</option>
                    <option value={14}>На 2 тижні</option>
                    <option value={30}>На 1 місяць</option>
                    <option value={90}>На 3 місяці</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="clean-panel">
              <h3 className="panel-title">Умови скасування</h3>
              <p className="panel-subtitle">Клієнт побачить цей текст перед підтвердженням.</p>
              <div style={{ padding: '1.5rem 2rem' }}>
                <textarea
                  value={bookingSettings.cancellation_policy}
                  onChange={e => setBookingSettings({...bookingSettings, cancellation_policy: e.target.value})}
                  className="setting-input"
                  style={{ minHeight: '100px', resize: 'none' }}
                  placeholder="Наприклад: Скасування можливе не пізніше ніж за 24 години до візиту."
                />
              </div>
            </div>

          </div>
        )}

        {/* ========================================= */}
        {/* 2. БЕЗПЕКА ТА ЧОРНИЙ СПИСОК               */}
        {/* ========================================= */}
        {settingsView === 'security' && (
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '850px', animation: 'fadeIn 0.3s ease-out' }}>
            <div className="clean-panel">
              <h3 className="panel-title">Захист від фейків</h3>
              <p className="panel-subtitle">Запобігайте спаму та порожнім записам.</p>

              <div className="list-row">
                <div className="list-row-info">
                  <h4>Верифікація номеру (OTP) <span className="badge" style={{color: '#f59e0b', borderColor: '#fde68a', background: '#fffbeb'}}>В розробці</span></h4>
                  <p>Клієнти повинні підтвердити свій телефон по SMS перед записом.</p>
                </div>
                <label className="ios-toggle"><input type="checkbox" disabled checked={securitySettings.require_phone_verification} onChange={e => setSecuritySettings({...securitySettings, require_phone_verification: e.target.checked})} /><span className="ios-slider"></span></label>
              </div>

              <div className="list-row">
                <div className="list-row-info">
                  <h4>Авто-блокування неявок <span className="badge">Рекомендовано</span></h4>
                  <p>Система заборонить онлайн-запис клієнтам, які мають 2+ неявки.</p>
                </div>
                <label className="ios-toggle"><input type="checkbox" checked={securitySettings.block_no_shows} onChange={e => setSecuritySettings({...securitySettings, block_no_shows: e.target.checked})} /><span className="ios-slider"></span></label>
              </div>
            </div>
          </div>
        )}

        {/* ========================================= */}
        {/* 3. СИСТЕМНІ СПОВІЩЕННЯ                    */}
        {/* ========================================= */}
        {settingsView === 'notifications' && (
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '850px', animation: 'fadeIn 0.3s ease-out' }}>
            <div className="clean-panel">
              <h3 className="panel-title">Робота з клієнтами</h3>
              <p className="panel-subtitle">Автоматичні повідомлення для збільшення явки.</p>
              <div className="list-row">
                <div className="list-row-info">
                  <h4>Авто-підтвердження записів <span className="badge">Система</span></h4>
                  <p>Нові записи з онлайну будуть автоматично підтверджені.</p>
                </div>
                <label className="ios-toggle"><input type="checkbox" checked={notificationSettings.auto_approve} onChange={e => setNotificationSettings({...notificationSettings, auto_approve: e.target.checked})} /><span className="ios-slider"></span></label>
              </div>
              <div className="list-row">
                <div className="list-row-info">
                  <h4>Підтвердження візиту (SMS)</h4>
                  <p>Відправляти повідомлення з деталями одразу після бронювання.</p>
                </div>
                <label className="ios-toggle"><input type="checkbox" checked={notificationSettings.notify_client_booking} onChange={e => setNotificationSettings({...notificationSettings, notify_client_booking: e.target.checked})} /><span className="ios-slider"></span></label>
              </div>
              <div className="list-row">
                <div className="list-row-info">
                  <h4>Нагадування за 24 години (SMS) <span className="badge">Конверсія</span></h4>
                  <p>Автоматична відправка нагадування. Зменшує кількість неявок.</p>
                </div>
                <label className="ios-toggle"><input type="checkbox" checked={notificationSettings.notify_client_reminder_sms} onChange={e => setNotificationSettings({...notificationSettings, notify_client_reminder_sms: e.target.checked})} /><span className="ios-slider"></span></label>
              </div>
            </div>
            <div className="clean-panel">
              <h3 className="panel-title">Сповіщення команди</h3>
              <div className="list-row">
                <div className="list-row-info">
                  <h4>Сповіщати майстра про новий запис</h4>
                  <p>Майстер отримає Push-сповіщення у додатку або SMS.</p>
                </div>
                <label className="ios-toggle"><input type="checkbox" checked={notificationSettings.notify_staff_booking} onChange={e => setNotificationSettings({...notificationSettings, notify_staff_booking: e.target.checked})} /><span className="ios-slider"></span></label>
              </div>
            </div>
          </div>
        )}

        {/* ========================================= */}
        {/* 4. ПЛАТЕЖІ ТА КАСА                        */}
        {/* ========================================= */}
        {settingsView === 'payments' && (
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '850px', animation: 'fadeIn 0.3s ease-out' }}>
            <div className="clean-panel">
              <h3 className="panel-title">Фінансові налаштування</h3>
              <div style={{ padding: '1.5rem 2rem' }}>
                <label className="setting-label">Базова валюта закладу</label>
                <div style={{ maxWidth: '300px' }}>
                  <select className="setting-input custom-select" value={paymentsSettings.currency} onChange={e => setPaymentsSettings({...paymentsSettings, currency: e.target.value})}>
                    <option value="UAH">Гривня (₴)</option>
                    <option value="USD">Долар ($)</option>
                    <option value="EUR">Євро (€)</option>
                    <option value="PLN">Злотий (zł)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="clean-panel">
              <h3 className="panel-title">Захист від неявок (Онлайн-оплата)</h3>
              <div className="list-row" style={{ background: paymentsSettings.require_deposit ? '#f8fafc' : '#fff' }}>
                <div className="list-row-info">
                  <h4>Брати передоплату (Депозит)</h4>
                  <p>Клієнти повинні будуть оплатити частину вартості онлайн.</p>
                </div>
                <label className="ios-toggle"><input type="checkbox" checked={paymentsSettings.require_deposit} onChange={e => setPaymentsSettings({...paymentsSettings, require_deposit: e.target.checked})} /><span className="ios-slider"></span></label>
              </div>

              {paymentsSettings.require_deposit && (
                <div style={{ padding: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', borderTop: '1px solid #e2e8f0', background: '#fafafa' }}>
                  <div>
                    <label className="setting-label">Тип депозиту</label>
                    <select className="setting-input custom-select" value={paymentsSettings.deposit_type} onChange={e => setPaymentsSettings({...paymentsSettings, deposit_type: e.target.value})}>
                      <option value="fixed">Фіксована сума</option>
                      <option value="percent">Відсоток від вартості</option>
                    </select>
                  </div>
                  <div>
                    <label className="setting-label">Сума / Відсоток</label>
                    <div style={{ position: 'relative' }}>
                      <input type="number" className="setting-input" value={paymentsSettings.deposit_amount} onChange={e => setPaymentsSettings({...paymentsSettings, deposit_amount: Number(e.target.value)})} />
                      <span style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontWeight: '800' }}>
                        {paymentsSettings.deposit_type === 'percent' ? '%' : paymentsSettings.currency}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================= */}
        {/* 5. ПІДПИСКА ТА БІЛІНГ                     */}
        {/* ========================================= */}
        {settingsView === 'billing' && (() => {

          const createdAt = business?.created_at ? new Date(business.created_at) : new Date();
          const trialEndDate = new Date(createdAt);
          trialEndDate.setDate(trialEndDate.getDate() + 90);

          const isTrialActive = !business?.subscription?.active && (new Date() < trialEndDate);

          const planName = isTrialActive ? 'Безкоштовний період' : (business?.subscription?.plan_name || 'Базовий');

          const baseMonthlyPrice = business?.subscription?.price || 15;
          const baseYearlyPrice = baseMonthlyPrice * 12 * 0.8;

          const planPrice = isTrialActive ? 0 : baseMonthlyPrice;

          const nextDateRaw = business?.subscription?.next_billing_date;
          const nextBillingDate = isTrialActive
            ? trialEndDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })
            : (nextDateRaw ? new Date(nextDateRaw).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }) : '-');

          const paymentMethod = business?.payment_methods?.[0] || { brand: 'VISA', last4: '4242', exp: '12/28' };
          const invoices = business?.invoices || [];

          if (showPlansView) {

            const currentProPrice = billingCycle === 'monthly' ? baseMonthlyPrice : (baseYearlyPrice / 12);
            const currentProLabel = billingCycle === 'monthly' ? '/ міс' : '/ міс (рахується щорічно)';

            return (
              <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '850px', animation: 'fadeIn 0.2s ease-out' }}>
                <p style={{ color: '#86868b', fontSize: '0.95rem', margin: '0 0 1.5rem 0', textAlign: 'center' }}>Оберіть тариф, який найкраще підходить для вашого бізнесу.</p>

                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2.5rem' }}>
                  <div style={{ background: '#f5f5f7', padding: '4px', borderRadius: '12px', display: 'inline-flex', gap: '4px' }}>
                    <button
                      onClick={() => setBillingCycle('monthly')}
                      style={{ padding: '0.5rem 1.5rem', background: billingCycle === 'monthly' ? '#fff' : 'transparent', color: billingCycle === 'monthly' ? '#1d1d1f' : '#86868b', border: 'none', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', boxShadow: billingCycle === 'monthly' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none', transition: '0.2s' }}>
                      Щомісяця
                    </button>
                    <button
                      onClick={() => setBillingCycle('yearly')}
                      style={{ padding: '0.5rem 1.5rem', background: billingCycle === 'yearly' ? '#fff' : 'transparent', color: billingCycle === 'yearly' ? '#1d1d1f' : '#86868b', border: 'none', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', boxShadow: billingCycle === 'yearly' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none', transition: '0.2s' }}>
                      Щорічно <span style={{ color: '#34c759', marginLeft: '4px' }}>-20%</span>
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>

                  <div style={{ background: '#ffffff', border: '2px solid #007aff', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 15px rgba(0, 122, 255, 0.08)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#007aff', color: '#fff', padding: '0.2rem 0.8rem', borderRadius: '12px', fontSize: '0.65rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Рекомендовано
                    </div>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#1d1d1f', margin: '0.5rem 0 0.3rem 0' }}>Pro Business</h4>
                    <p style={{ color: '#86868b', margin: '0 0 1rem 0', fontSize: '0.85rem' }}>Повний доступ до всіх функцій.</p>

                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#1d1d1f', letterSpacing: '-1px', marginBottom: '0.2rem', transition: '0.3s' }}>
                      ${currentProPrice.toFixed(0)} <span style={{ fontSize: '0.85rem', color: '#86868b', fontWeight: '500', letterSpacing: '0' }}>{currentProLabel}</span>
                    </div>
                    {billingCycle === 'yearly' && (
                      <div style={{ fontSize: '0.8rem', color: '#34c759', fontWeight: '600', marginBottom: '1.5rem' }}>Списання ${baseYearlyPrice.toFixed(0)} раз на рік</div>
                    )}
                    {billingCycle === 'monthly' && <div style={{ marginBottom: '1.5rem' }}></div>}

                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.8rem', flex: 1 }}>
                      <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1d1d1f', fontSize: '0.85rem', fontWeight: '500' }}><SvgCheck size={16} color="#007aff" /> Онлайн-бронювання</li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1d1d1f', fontSize: '0.85rem', fontWeight: '500' }}><SvgCheck size={16} color="#007aff" /> Необмежені майстри</li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1d1d1f', fontSize: '0.85rem', fontWeight: '500' }}><SvgCheck size={16} color="#007aff" /> SMS-нагадування</li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1d1d1f', fontSize: '0.85rem', fontWeight: '500' }}><SvgCheck size={16} color="#007aff" /> Аналітика</li>
                    </ul>
                    <button onClick={() => { showToast('План обрано'); setShowPlansView(false); }} style={{ width: '100%', padding: '0.8rem', background: '#007aff', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '700', cursor: 'pointer', transition: '0.2s' }}>
                      Обрати тариф
                    </button>
                  </div>

                  <div style={{ background: '#f5f5f7', border: '1px solid #e5e5ea', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', opacity: 0.7 }}>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#1d1d1f', margin: '0.5rem 0 0.3rem 0' }}>Premium</h4>
                    <p style={{ color: '#86868b', margin: '0 0 1rem 0', fontSize: '0.85rem' }}>Для великих мереж.</p>
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#86868b', letterSpacing: '-1px', marginBottom: '1.5rem' }}>
                      ???
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.8rem', flex: 1 }}>
                      <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#86868b', fontSize: '0.85rem', fontWeight: '500' }}><SvgCheck size={16} color="#86868b" /> Індивідуальна розробка</li>
                      <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#86868b', fontSize: '0.85rem', fontWeight: '500' }}><SvgCheck size={16} color="#86868b" /> Персональний менеджер</li>
                    </ul>
                    <button disabled style={{ width: '100%', padding: '0.8rem', background: '#e5e5ea', color: '#86868b', border: 'none', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '700', cursor: 'not-allowed' }}>
                      Скоро
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '850px', animation: 'fadeIn 0.2s ease-out' }}>

              <div style={{ background: '#ffffff', border: '1px solid #e5e5ea', borderRadius: '16px', padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)' }}>
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: isTrialActive ? '#ff9500' : '#34c759', fontSize: '0.65rem', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    {isTrialActive ? <SvgGift size={14} strokeWidth={2.5} /> : <SvgCheck size={14} strokeWidth={3} />}
                    {isTrialActive ? 'Промо-період' : 'Активний тариф'}
                  </div>
                  <h3 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '0 0 0.3rem 0', letterSpacing: '-0.5px', color: '#1d1d1f' }}>
                    {planName}
                  </h3>
                  <p style={{ color: '#86868b', margin: 0, fontSize: '0.9rem', fontWeight: '500' }}>
                    {isTrialActive ? 'Безкоштовно до:' : 'Наступне списання:'} <b style={{color: '#1d1d1f', fontWeight: '600'}}>{nextBillingDate}</b>
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                   <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#1d1d1f', letterSpacing: '-0.5px' }}>
                     ${planPrice.toFixed(2)} <span style={{ fontSize: '0.9rem', color: '#86868b', fontWeight: '500' }}>/ міс</span>
                   </div>
                   <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                     <button onClick={() => setShowPlansView(true)} style={{ padding: '0.6rem 1.2rem', background: '#007aff', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', transition: '0.2s' }}>
                       Переглянути план
                     </button>
                     {!isTrialActive && (
                       <button onClick={() => showToast('Запит на скасування')} style={{ padding: '0.6rem 1.2rem', background: '#f5f5f7', color: '#ff3b30', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', transition: '0.2s' }}>
                         Скасувати
                       </button>
                     )}
                   </div>
                </div>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #e5e5ea', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
                    <div style={{ width: '50px', height: '34px', background: '#f5f5f7', border: '1px solid #e5e5ea', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d1d1f' }}>
                       <span style={{ fontWeight: '800', fontStyle: 'italic', fontSize: '0.75rem' }}>{paymentMethod.brand}</span>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 0.1rem 0', fontWeight: '600', color: '#1d1d1f', fontSize: '0.95rem' }}>•••• •••• •••• {paymentMethod.last4}</p>
                      <p style={{ margin: 0, color: '#86868b', fontSize: '0.8rem', fontWeight: '500' }}>Термін дії до {paymentMethod.exp}</p>
                    </div>
                  </div>
                  <button onClick={() => setIsEditingCard(!isEditingCard)} style={{ background: 'none', border: 'none', color: '#007aff', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}>
                    {isEditingCard ? 'Скасувати' : 'Змінити картку'}
                  </button>
                </div>

                {isEditingCard && (
                  <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e5ea', animation: 'fadeIn 0.2s ease-out', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 200px' }}>
                      <label className="setting-label">Номер картки</label>
                      <input type="text" placeholder="0000 0000 0000 0000" className="setting-input" />
                    </div>
                    <div style={{ width: '100px' }}>
                      <label className="setting-label">Термін</label>
                      <input type="text" placeholder="ММ/РР" className="setting-input" />
                    </div>
                    <div style={{ width: '100px' }}>
                      <label className="setting-label">CVV</label>
                      <input type="password" placeholder="***" className="setting-input" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <button
                        onClick={() => { showToast('Картку оновлено!'); setIsEditingCard(false); }}
                        style={{ height: '42px', padding: '0 1.5rem', background: '#007aff', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer' }}
                      >
                        Зберегти
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #e5e5ea', borderRadius: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', padding: '1.5rem 2rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#1d1d1f', margin: '0 0 1.5rem 0' }}>Історія інвойсів</h3>

                {invoices.length > 0 ? (
                  <div style={{ width: '100%', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr>
                          <th style={{ paddingBottom: '0.8rem', borderBottom: '1px solid #e5e5ea', fontSize: '0.7rem', textTransform: 'uppercase', color: '#86868b', fontWeight: '600' }}>Дата</th>
                          <th style={{ paddingBottom: '0.8rem', borderBottom: '1px solid #e5e5ea', fontSize: '0.7rem', textTransform: 'uppercase', color: '#86868b', fontWeight: '600' }}>Сума</th>
                          <th style={{ paddingBottom: '0.8rem', borderBottom: '1px solid #e5e5ea', fontSize: '0.7rem', textTransform: 'uppercase', color: '#86868b', fontWeight: '600' }}>Тариф</th>
                          <th style={{ paddingBottom: '0.8rem', borderBottom: '1px solid #e5e5ea', fontSize: '0.7rem', textTransform: 'uppercase', color: '#86868b', fontWeight: '600' }}>Статус</th>
                          <th style={{ paddingBottom: '0.8rem', borderBottom: '1px solid #e5e5ea', fontSize: '0.7rem', textTransform: 'uppercase', color: '#86868b', fontWeight: '600', textAlign: 'right' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((invoice: any) => (
                          <tr key={invoice.id}>
                            <td style={{ padding: '1rem 0', borderBottom: '1px solid #f5f5f7', fontSize: '0.85rem', color: '#1d1d1f', fontWeight: '500' }}>{invoice.date}</td>
                            <td style={{ padding: '1rem 0', borderBottom: '1px solid #f5f5f7', fontSize: '0.85rem', color: '#1d1d1f', fontWeight: '600' }}>${invoice.amount.toFixed(2)}</td>
                            <td style={{ padding: '1rem 0', borderBottom: '1px solid #f5f5f7', fontSize: '0.85rem', color: '#86868b' }}>{invoice.plan}</td>
                            <td style={{ padding: '1rem 0', borderBottom: '1px solid #f5f5f7' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#34c759', fontSize: '0.75rem', fontWeight: '600' }}>
                                <SvgCheck size={14} strokeWidth={3} /> {invoice.status}
                              </span>
                            </td>
                            <td style={{ padding: '1rem 0', borderBottom: '1px solid #f5f5f7', textAlign: 'right' }}>
                              <button onClick={() => showToast('Завантаження квитанції...')} style={{ background: 'none', border: 'none', color: '#007aff', cursor: 'pointer', padding: '0.2rem' }}>
                                <SvgDownload size={18} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', background: '#fcfcfd', borderRadius: '12px', border: '1px dashed #e5e5ea' }}>
                    <p style={{ color: '#1d1d1f', fontWeight: '600', fontSize: '0.9rem', margin: '0 0 0.3rem 0' }}>Інвойсів ще немає</p>
                    <p style={{ color: '#86868b', fontSize: '0.8rem', margin: 0 }}>Перший платіж з'явиться тут після завершення тріалу.</p>
                  </div>
                )}
              </div>

            </div>
          );
        })()}

        {/* Generic Тоасти (Переміщено в правий нижній кут) */}
        {toastMessage && (
          <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', background: '#0f172a', color: '#fff', padding: '0.8rem 1.2rem', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem', zIndex: 3000, animation: 'slideUpRightFade 0.2s ease-out', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)' }}>
            <SvgCheck /> {toastMessage}
          </div>
        )}

      </div>
    </>
  );
}