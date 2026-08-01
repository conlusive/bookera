'use client';

import { useState, useRef, useEffect } from 'react';

interface SmartSlot {
  id: string;
  date: string;
  time: string;
  type: 'urgent' | 'lull' | 'gap';
  title: string;
  insight: string;
  suggestedPromo: number;
  audience: string;
}

interface MarketingTabProps {
  business: any;
  clientsList: any[];
  Icons?: any;
  marketingStats?: {
    income: number;
    incomeTrend: number;
    returnedClients: number;
    returnedTrend: number;
    openRate: number;
    openRateTrend: number;
  };
  availableSlots?: SmartSlot[];
  averageTicketPrice?: number;
}

// 🎨 ІКОНКИ
const SvgIcon = ({ d, size = 24, color = "currentColor", children, strokeWidth = 2, ...props }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>{d && <path d={d} />}{children}</svg>
);

const SvgLink = (p:any) => <SvgIcon {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></SvgIcon>;
const SvgTrash = (p:any) => <SvgIcon {...p}><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></SvgIcon>;
const SvgEdit = (p:any) => <SvgIcon {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></SvgIcon>;
const SvgRadar = (p:any) => <SvgIcon {...p}><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle><line x1="12" y1="12" x2="18" y2="6"></line></SvgIcon>;
const SvgMessage = (p:any) => <SvgIcon {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></SvgIcon>;
const SvgGift = (p:any) => <SvgIcon {...p}><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></SvgIcon>;
const SvgTrending = (p:any) => <SvgIcon {...p}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></SvgIcon>;
const SvgUsers = (p:any) => <SvgIcon {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></SvgIcon>;
const SvgChevronLeft = (p:any) => <SvgIcon {...p}><polyline points="15 18 9 12 15 6"></polyline></SvgIcon>;
const SvgTag = (p:any) => <SvgIcon {...p}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></SvgIcon>;
const SvgPlus = (p:any) => <SvgIcon {...p}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></SvgIcon>;
const SvgSend = (p:any) => <SvgIcon {...p}><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></SvgIcon>;
const SvgInfo = (p:any) => <SvgIcon {...p}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></SvgIcon>;
const SvgSparkles = (p:any) => <SvgIcon {...p}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path></SvgIcon>;
const SvgX = (p:any) => <SvgIcon {...p}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></SvgIcon>;
const SvgZap = (p:any) => <SvgIcon {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></SvgIcon>;
const SvgCheck = (p:any) => <SvgIcon strokeWidth="3" {...p}><polyline points="20 6 9 17 4 12"></polyline></SvgIcon>;
const SvgClock = (p:any) => <SvgIcon {...p}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></SvgIcon>;
const SvgCalendarLimit = (p:any) => <SvgIcon {...p}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></SvgIcon>;
const SvgUsersLimit = (p:any) => <SvgIcon {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></SvgIcon>;
const SvgInstagram = (p:any) => <SvgIcon {...p}><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></SvgIcon>;
const SvgCode = (p:any) => <SvgIcon {...p}><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></SvgIcon>;
const SvgDownload = (p:any) => <SvgIcon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></SvgIcon>;
const SvgCopy = (p:any) => <SvgIcon {...p}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></SvgIcon>;
const SvgShare = (p:any) => <SvgIcon {...p}><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></SvgIcon>;

export default function MarketingTab({
  business,
  clientsList = [],
  marketingStats,
  availableSlots = [],
  averageTicketPrice = 500
}: MarketingTabProps) {

  const [marketingView, setMarketingView] = useState<'overview' | 'campaigns' | 'promotions' | 'radar' | 'smm'>('overview');
  const [campaignTab, setCampaignTab] = useState<'automated' | 'mass'>('automated');

  const [automations, setAutomations] = useState({ welcome: true, birthday: false, lost: true, reviews: true });
  const [activePromos, setActivePromos] = useState<any[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const [toastMessage, setToastMessage] = useState('');
  const [marketingForm, setMarketingForm] = useState({ type: 'sms', audience: 'all', message: '' });
  const [selectedPromoForMessage, setSelectedPromoForMessage] = useState('');
  const [isSendingPromo, setIsSendingPromo] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [comingSoonModal, setComingSoonModal] = useState<{ isOpen: boolean, title: string, desc: string }>({ isOpen: false, title: '', desc: '' });

  const [customDiscounts, setCustomDiscounts] = useState<Record<string, number>>({});

  // 🟢 СТАН ДЛЯ ІНСТРАГРАМ-МОДАЛКИ
  const [activeSmmModal, setActiveSmmModal] = useState<'none' | 'instagram'>('none');

  useEffect(() => {
    if (business?.id) {
      const savedPromos = localStorage.getItem(`bookera_promos_${business.id}`);
      if (savedPromos) try { setActivePromos(JSON.parse(savedPromos)); } catch (e) {}

      const savedAuto = localStorage.getItem(`bookera_automations_${business.id}`);
      if (savedAuto) try { setAutomations(JSON.parse(savedAuto)); } catch (e) {}
    }
    setIsDataLoaded(true);
  }, [business?.id]);

  useEffect(() => {
    if (isDataLoaded && business?.id) {
      localStorage.setItem(`bookera_promos_${business.id}`, JSON.stringify(activePromos));
      localStorage.setItem(`bookera_automations_${business.id}`, JSON.stringify(automations));
    }
  }, [activePromos, automations, isDataLoaded, business?.id]);

  const freeSlotsCount = availableSlots.length;
  const isRadarEmpty = freeSlotsCount <= 0;
  const lostProfitAmount = freeSlotsCount * averageTicketPrice;

  const stats = {
    income: marketingStats?.income || 0,
    incomeTrend: marketingStats?.incomeTrend || 0,
    returnedClients: marketingStats?.returnedClients || 0,
    returnedTrend: marketingStats?.returnedTrend || 0,
    openRate: marketingStats?.openRate || 0,
    openRateTrend: marketingStats?.openRateTrend || 0,
  };

  const formatCurrency = (num: number) => num >= 1000 ? (num / 1000).toFixed(1) + 'k ₴' : num + ' ₴';

  const renderTrend = (val: number, label: string) => {
    if (val === 0) return <span style={{ color: '#94a3b8' }}>Недостатньо даних</span>;
    return val > 0 ? <><SvgPlus size={16}/>+{val}% <span style={{ color: '#94a3b8', fontWeight: '500' }}>{label}</span></> : <>{val}% <span style={{ color: '#94a3b8', fontWeight: '500' }}>{label}</span></>;
  };

  const generateSlug = (name: string) => {
    if (!name) return 'booking';
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  };
  const businessLink = `bookera.app/${generateSlug(business?.name)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=https://${businessLink}`;

  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [editingPromoId, setEditingPromoId] = useState<number | null>(null);
  const [newPromo, setNewPromo] = useState({ code: '', discount: '', maxUses: '', validUntil: '' });

  const [isPromoDatePickerOpen, setIsPromoDatePickerOpen] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState(new Date());
  const datePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) setIsPromoDatePickerOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const generateCalendarDays = () => {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    let startDayIndex = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < startDayIndex; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  };

  const handleCalendarDayClick = (day: number) => {
    const y = calendarViewDate.getFullYear();
    const m = String(calendarViewDate.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    setNewPromo({ ...newPromo, validUntil: `${y}-${m}-${d}` });
    setIsPromoDatePickerOpen(false);
  };

  const handleOpenCreatePromo = () => {
    setEditingPromoId(null);
    setNewPromo({ code: '', discount: '', maxUses: '', validUntil: '' });
    setCalendarViewDate(new Date());
    setIsPromoModalOpen(true);
  };

  const handleOpenEditPromo = (promo: any) => {
    setEditingPromoId(promo.id);
    setNewPromo({
      code: promo.code, discount: promo.discount.replace('%', ''),
      maxUses: promo.maxUses ? String(promo.maxUses) : '', validUntil: promo.validUntil || ''
    });
    setCalendarViewDate(promo.validUntil ? new Date(promo.validUntil) : new Date());
    setIsPromoModalOpen(true);
  };

  const handleSavePromo = () => {
    if (!newPromo.code || !newPromo.discount) return alert('Заповніть код та відсоток знижки');
    const formattedDiscount = newPromo.discount.includes('%') ? newPromo.discount : `${newPromo.discount}%`;
    const cleanCode = newPromo.code.toUpperCase().replace(/\s+/g, '');
    const maxUsesVal = newPromo.maxUses ? parseInt(newPromo.maxUses) : null;
    const validUntilVal = newPromo.validUntil || null;

    if (editingPromoId) {
      setActivePromos(activePromos.map(p => p.id === editingPromoId ? { ...p, code: cleanCode, discount: formattedDiscount, maxUses: maxUsesVal, validUntil: validUntilVal } : p));
      showToast('Промокод успішно оновлено');
    } else {
      setActivePromos([{ id: Date.now(), code: cleanCode, discount: formattedDiscount, uses: 0, status: 'active', maxUses: maxUsesVal, validUntil: validUntilVal }, ...activePromos]);
      showToast('Промокод успішно створено');
    }
    setIsPromoModalOpen(false);
  };

  const handleDeletePromo = (id: number) => {
    if(confirm('Ви впевнені, що хочете видалити цей промокод?')) {
      setActivePromos(activePromos.filter(p => p.id !== id));
      if (selectedPromoForMessage && activePromos.find(p => p.id === id)?.code === selectedPromoForMessage) setSelectedPromoForMessage('');
      showToast('Промокод видалено');
    }
  };

  const handleToggleAutomation = (id: string, currentValue: boolean) => {
    setAutomations({ ...automations, [id]: !currentValue });
    showToast('Налаштування збережено');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleSendMarketing = async () => {
    if (!marketingForm.message || marketingForm.message.trim() === '') return showToast('Введіть текст перед відправкою.');
    if (clientsList?.length === 0) return showToast('У вас ще немає клієнтів.');

    setIsSendingPromo(true);
    setTimeout(() => {
      setIsSendingPromo(false);
      showToast('Розсилку відправлено 🚀');
      setMarketingForm({ audience: 'all', message: '', type: 'sms' });
      setSelectedPromoForMessage('');
    }, 1500);
  };

  const handleAIGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      let baseMsg = "";
      const promoText = selectedPromoForMessage ? ` Ваш промокод: ${selectedPromoForMessage}.` : "";
      if (marketingForm.audience === 'all') baseMsg = `Скучили за вами! Знижка на всі послуги до кінця тижня.${promoText} Запис: ${businessLink}`;
      if (marketingForm.audience === 'vip') baseMsg = `Тільки для своїх. Отримайте преміум-догляд безкоштовно.${promoText} Забронюйте час: ${businessLink}`;
      if (marketingForm.audience === 'lost') baseMsg = `Давно не бачились! Даруємо знижку на наступне відвідування.${promoText} Чекаємо вас: ${businessLink}`;
      setMarketingForm({ ...marketingForm, message: baseMsg });
      setIsGenerating(false);
    }, 800);
  };

  const handleLaunchSmartCampaign = (slot: SmartSlot) => {
    let codeToUse = "";
    const finalPromoValue = customDiscounts[slot.id] !== undefined ? customDiscounts[slot.id] : slot.suggestedPromo;

    if (finalPromoValue > 0) {
      const parts = slot.id.split('-');
      const rawDate = parts.length >= 4 ? `${parts[1]}-${parts[2]}-${parts[3]}` : '';
      let aiMaxUses = null, codePrefix = 'SMART';
      if (slot.type === 'gap') { aiMaxUses = 1; codePrefix = 'GAP'; }
      if (slot.type === 'lull') { aiMaxUses = 3; codePrefix = 'LULL'; }
      if (slot.type === 'urgent') { aiMaxUses = 5; codePrefix = 'HOT'; }
      const newCode = `${codePrefix}${finalPromoValue}`;
      const existingPromo = activePromos.find(p => p.code === newCode);

      if (existingPromo) codeToUse = existingPromo.code;
      else {
        setActivePromos(prev => [{ id: Date.now(), code: newCode, discount: `${finalPromoValue}%`, uses: 0, status: 'active', maxUses: aiMaxUses, validUntil: rawDate }, ...prev]);
        codeToUse = newCode;
        showToast(`Створено лімітований промокод: ${newCode}`);
      }
    }

    setMarketingView('campaigns');
    setCampaignTab('mass');

    let generatedMessage = "";
    const promoStr = codeToUse ? ` Промокод: ${codeToUse}.` : "";

    if (slot.type === 'urgent') generatedMessage = `Гарячі години! Тільки на ${slot.date} (${slot.time}) даруємо знижку ${finalPromoValue}% на всі послуги.${promoStr} Запис: ${businessLink}`;
    else if (slot.type === 'lull') generatedMessage = `Щасливі ранкові години! Запишіться ${slot.date} (${slot.time}) та отримайте знижку ${finalPromoValue}%.${promoStr} Запис: ${businessLink}`;
    else if (slot.type === 'gap') generatedMessage = `Звільнилося зручне вікно ${slot.date} о ${slot.time}! Ідеально для швидкого візиту.${promoStr} Забронювати: ${businessLink}`;

    setSelectedPromoForMessage(codeToUse);
    setMarketingForm({ ...marketingForm, audience: slot.audience, message: generatedMessage });
  };

  const handlePromoSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    setSelectedPromoForMessage(code);
    if (code && !marketingForm.message.includes(code)) {
      const newLine = marketingForm.message.length > 0 ? '\n' : '';
      setMarketingForm({...marketingForm, message: marketingForm.message + `${newLine}Використайте промокод: ${code}`});
    }
  };

  // 🟢 ДОПОМІЖНІ ФУНКЦІЇ ДЛЯ SMM
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Скопійовано в буфер обміну');
  };

  const downloadQR = async () => {
    try {
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${generateSlug(business?.name)}-qrcode.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('QR-код успішно завантажено');
    } catch(e) { showToast('Помилка завантаження QR-коду'); }
  };

  const handleShare = async () => {
    const shareData = { title: `Запис до ${business?.name}`, text: 'Швидкий онлайн-запис!', url: `https://${businessLink}` };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch (err) {}
    } else {
      copyToClipboard(`https://${businessLink}`);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUpFade { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        
        .static-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.02); }

        .primary-btn { background: #0f172a; color: #ffffff; border: none; padding: 0.55rem 1.1rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: background 0.2s; display: flex; align-items: center; gap: 0.4rem; justify-content: center; }
        .primary-btn:hover:not(:disabled) { background: #1e293b; }
        .primary-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        
        .secondary-btn { background: #f8fafc; color: #0f172a; border: 1px solid #e2e8f0; padding: 0.55rem 1.1rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 0.4rem; justify-content: center; }
        .secondary-btn:hover { background: #f1f5f9; border-color: #cbd5e1; }
        
        /* 🟢 МІНІ-КНОПКИ */
        .mini-action-btn { background: #f1f5f9; color: #475569; padding: 6px 12px; border-radius: 8px; font-size: 0.8rem; font-weight: 600; border: none; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: 0.2s; white-space: nowrap; }
        .mini-action-btn:hover { background: #e2e8f0; color: #0f172a; }

        .tab-btn { background: transparent; border: none; padding: 0.8rem 1.5rem; font-size: 0.95rem; font-weight: 600; color: #64748b; cursor: pointer; border-bottom: 2px solid transparent; transition: 0.2s; }
        .tab-btn.active { color: #2563eb; border-bottom-color: #2563eb; }
        
        .form-input { width: 100%; padding: 0.8rem 1rem; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 0.95rem; outline: none; transition: border 0.2s; background: #ffffff; color: #0f172a; appearance: none; cursor: pointer; }
        .form-input:focus { border-color: #3b82f6; }
        
        .editable-discount { width: 44px; padding: 0.2rem 0; border: none; border-bottom: 1px dashed #10b981; background: transparent; color: #10b981; font-weight: 800; font-size: 1rem; text-align: center; outline: none; transition: 0.2s; }
        .editable-discount:hover { background: #ecfdf5; border-radius: 4px; border-bottom: 1px solid transparent; }
        .editable-discount:focus { background: #d1fae5; border-radius: 4px; border-bottom: 1px solid transparent; }
        .editable-discount::-webkit-inner-spin-button, .editable-discount::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }

        .select-wrapper { position: relative; width: 100%; }
        .select-wrapper::after { content: ''; position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); width: 20px; height: 20px; background-image: url('data:image/svg+xml;utf8,<svg viewBox="0 0 24 24" fill="none" stroke="%2364748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><polyline points="6 9 12 15 18 9"></polyline></svg>'); background-repeat: no-repeat; background-position: center; pointer-events: none; }

        .custom-toggle { width: 44px; height: 24px; border-radius: 12px; background: #e2e8f0; position: relative; cursor: pointer; transition: 0.3s; }
        .custom-toggle.active { background: #10b981; }
        .custom-toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; background: #fff; border-radius: 50%; transition: 0.3s; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .custom-toggle.active::after { transform: translateX(20px); }

        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.2s ease-out; }
        .modal-content { background: #ffffff; padding: 2rem; border-radius: 20px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1); width: 100%; max-width: 450px; animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; position: relative; max-height: 90vh; overflow-y: auto; }
        
        .radar-banner { background: #ffffff; transition: 0.2s; }
        .radar-banner:hover { border-color: #cbd5e1; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05); }
        .radar-banner.has-slots { background: linear-gradient(90deg, #eff6ff 0%, #ffffff 100%); border-left: 4px solid #3b82f6; }
        
        .row-icon-btn { background: #ffffff; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04); cursor: pointer; transition: transform 0.2s; border: 1px solid transparent; }
        .row-icon-btn:hover { transform: translateY(-1px); border-color: #e2e8f0; }
        
        .radar-banner .icon-container { width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
        
        .row-badge { padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700; display: inline-flex; align-items: center; gap: 0.3rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .row-badge.urgent { background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; }
        .row-badge.lull { background: #eff6ff; color: #3b82f6; border: 1px solid #bfdbfe; }
        .row-badge.gap { background: #fdf4ff; color: #d946ef; border: 1px solid #f5d0fe; }
        .row-badge.active { background: #f8fafc; color: #64748b; }
        
        .stats-trend { display: flex; gap: 0.3rem; font-size: 0.85rem; font-weight: 700; margin-top: 0.5rem; align-items: center; }
        .stats-trend.up { color: #10b981; }
        .stats-trend.down { color: #ef4444; }
        
        .dark-stats-card { background: #0f172a; color: #ffffff; border: none; border-radius: 16px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); }
      `}} />

      <div style={{ padding: '2rem 3rem', flex: 1, display: 'flex', flexDirection: 'column', maxWidth: '1200px', margin: '0 auto', width: '100%', height: '100%', fontFamily: 'Inter, -apple-system, sans-serif', backgroundColor: '#ffffff' }}>

        {/* 🔴 ОГЛЯД МАРКЕТИНГУ */}
        {marketingView === 'overview' && (
          <div style={{ animation: 'fadeIn 0.2s ease', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1 style={{ fontSize: '2.4rem', fontWeight: '900', color: '#0f172a', margin: '0 0 0.4rem 0', letterSpacing: '-0.04em' }}>Залучай. Утримуй. Зростай.</h1>
                <p style={{ fontSize: '1rem', color: '#64748b', margin: 0 }}>Керуйте комунікаціями та збільшуйте дохід, заповнюючи порожні вікна.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <button onClick={handleShare} className="secondary-btn">
                  <SvgShare size={16} /> Поділитися
                </button>
                <button onClick={() => setMarketingView('campaigns')} className="primary-btn">
                  <SvgZap size={16} /> Нова розсилка
                </button>
              </div>
            </div>

            {/* 📡 РАДАР ОГЛЯД */}
            <div
              onClick={() => setMarketingView('radar')}
              className={`radar-banner static-card ${!isRadarEmpty ? 'has-slots' : ''}`}
              style={{ padding: '1.2rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: '1rem', borderTop: 'none', borderRight: 'none', borderBottom: 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
                {!isRadarEmpty && (
                  <>
                    <div className="icon-container" style={{ color: '#3b82f6' }}><SvgRadar size={24} /></div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.3rem' }}>
                        <h3 style={{ fontWeight: '800', fontSize: '1.15rem', margin: 0, color: '#0f172a' }}>Знайдено {freeSlotsCount} інсайти в розкладі</h3>
                        <span className="row-badge urgent">Потрібна дія</span>
                      </div>
                      <div style={{ fontSize: '0.95rem', color: '#475569' }}>
                        Ризик втрати прибутку: <span style={{ color: '#0f172a', fontWeight: '700' }}>~{formatCurrency(lostProfitAmount)}</span>. AI підготував стратегії.
                      </div>
                    </div>
                  </>
                )}

                {isRadarEmpty && (
                  <>
                    <div className="icon-container" style={{ color: '#64748b' }}><SvgRadar size={24} /></div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.3rem' }}>
                        <h3 style={{ fontWeight: '800', fontSize: '1.15rem', margin: 0, color: '#0f172a' }}>BookEra Radar</h3>
                        <span className="row-badge active">Активно</span>
                      </div>
                      <div style={{ fontSize: '0.95rem', color: '#64748b' }}>Система проаналізувала розклад. На найближчі дні все чудово!</div>
                    </div>
                  </>
                )}
              </div>
              <div className="row-icon-btn" style={{ width: '40px', height: '40px', color: '#0f172a' }}><SvgChevronLeft size={20} style={{ transform: 'rotate(180deg)' }} /></div>
            </div>

            {/* 📊 СТАТИСТИКА */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
              <div className="static-card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase' }}>Дохід з маркетингу</div>
                  <div style={{ background: '#dcfce7', color: '#16a34a', padding: '0.5rem', borderRadius: '10px' }}><SvgTrending size={20} /></div>
                </div>
                <div style={{ fontSize: '2.2rem', fontWeight: '800', color: '#0f172a' }}>{formatCurrency(stats.income)}</div>
                <div className={`stats-trend ${stats.incomeTrend >= 0 ? 'up' : 'down'}`}>
                  {renderTrend(stats.incomeTrend, 'за місяць')}
                </div>
              </div>

              <div className="static-card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase' }}>Повернуто клієнтів</div>
                  <div style={{ background: '#e0f2fe', color: '#2563eb', padding: '0.5rem', borderRadius: '10px' }}><SvgUsers size={20} /></div>
                </div>
                <div style={{ fontSize: '2.2rem', fontWeight: '800', color: '#0f172a' }}>{stats.returnedClients}</div>
                <div className={`stats-trend ${stats.returnedTrend >= 0 ? 'up' : 'down'}`}>
                  {renderTrend(stats.returnedTrend, 'через авто-сценарії')}
                </div>
              </div>

              <div className="dark-stats-card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div style={{ color: '#a1a1aa', fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase' }}>Контактна база</div>
                  <div style={{ background: '#3f3f46', color: '#ffffff', padding: '0.5rem', borderRadius: '10px' }}><SvgMessage size={20} /></div>
                </div>
                <div style={{ fontSize: '2.2rem', fontWeight: '800', color: '#ffffff' }}>{stats.openRate}%</div>
                <div className="stats-trend" style={{ color: '#94a3b8', fontWeight: '500' }}>
                  {stats.openRateTrend} клієнтів з номером телефону
                </div>
              </div>
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a', margin: '0.5rem 0 0 0' }}>Інструменти залучення</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
              {[
                { icon: SvgLink, color: '#f59e0b', bg: '#fef3c7', title: 'Онлайн-запис & SMM', desc: 'Ваше посилання та інструменти', action: () => setMarketingView('smm') },
                { icon: SvgTag, color: '#ec4899', bg: '#fce7f3', title: 'Промокоди', desc: 'Створення купонів на знижку', action: () => setMarketingView('promotions') },
                { icon: SvgGift, color: '#0ea5e9', bg: '#dbeafe', title: 'Програми лояльності', desc: 'Приведи друга & Бонуси', action: () => setComingSoonModal({ isOpen: true, title: 'Програма лояльності', desc: 'Кешбек та реферальні посилання з\'являться у наступному оновленні.' }) }
              ].map((item, i) => (
                <div key={i} onClick={item.action} className="static-card" style={{ padding: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
                  <div style={{ width: '48px', height: '48px', background: item.bg, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color }}><item.icon size={24} /></div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 0.1rem 0', fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>{item.title}</h4>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>{item.desc}</p>
                  </div>
                   <div style={{ color: '#cbd5e1' }}><SvgChevronLeft size={20} style={{ transform: 'rotate(180deg)' }} /></div>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* 🔴 РОЗУМНИЙ РАДАР */}
        {marketingView === 'radar' && (
          <div style={{ animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '850px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <button onClick={() => setMarketingView('overview')} style={{ background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', cursor: 'pointer', padding: 0 }}><SvgChevronLeft size={28} /></button>
              <div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>BookEra Radar</h2>
                <p style={{ color: '#64748b', fontSize: '0.95rem', margin: 0 }}>AI-аналітика вашого розкладу. Система знаходить слабкі місця та пропонує рішення.</p>
              </div>
            </div>

            {isRadarEmpty ? (
              <div className="static-card" style={{ textAlign: 'center', padding: '4rem 0', color: '#64748b' }}>
                <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
                  <div style={{ background: '#dcfce7', padding: '1rem', borderRadius: '50%', color: '#16a34a' }}><SvgRadar size={28} /></div>
                </div>
                <h3 style={{ fontSize: '1.1rem', color: '#0f172a', margin: '0 0 0.5rem 0', fontWeight: '700' }}>Аномалій не знайдено</h3>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>Ваш розклад на найближчі дні виглядає чудово. Щойно з'являться серйозні прогалини, ми підготуємо стратегію.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {availableSlots.map((slot) => {
                  const currentDiscount = customDiscounts[slot.id] !== undefined ? customDiscounts[slot.id] : slot.suggestedPromo;

                  return (
                    <div key={slot.id} className="static-card" style={{ overflow: 'hidden' }}>
                      <div style={{
                        padding: '1rem 1.5rem',
                        background: slot.type === 'urgent' ? '#fef2f2' : slot.type === 'lull' ? '#eff6ff' : '#fdf4ff',
                        borderBottom: `1px solid ${slot.type === 'urgent' ? '#fecaca' : slot.type === 'lull' ? '#bfdbfe' : '#f5d0fe'}`,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                          <span className={`row-badge ${slot.type}`}>
                            {slot.type === 'urgent' && <SvgZap size={14}/>}
                            {slot.type === 'lull' && <SvgTrending size={14}/>}
                            {slot.type === 'gap' && <SvgClock size={14}/>}
                            {slot.title}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0f172a' }}>{slot.date} | {slot.time}</div>
                      </div>

                      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                        <p style={{ margin: 0, fontSize: '0.95rem', color: '#334155', lineHeight: '1.5' }}>{slot.insight}</p>

                        <div style={{ display: 'flex', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', marginBottom: '0.3rem' }}>Кому відправити:</div>
                            <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#0f172a' }}>
                              {slot.audience === 'lost' ? 'Втрачені клієнти (>30 днів)' : slot.audience === 'vip' ? 'Тільки VIP база' : 'Вся база клієнтів'}
                            </div>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', marginBottom: '0.3rem' }}>Пропозиція AI:</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              {currentDiscount > 0 ? (
                                <>
                                  <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#10b981' }}>Знижка</span>
                                  <input type="number" value={currentDiscount} onChange={e => setCustomDiscounts({...customDiscounts, [slot.id]: Number(e.target.value)})} className="editable-discount" min="0" max="100" />
                                  <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#10b981' }}>%</span>
                                </>
                              ) : (
                                <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#64748b' }}>Без знижки (Нагадування)</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button onClick={() => handleLaunchSmartCampaign(slot)} className="primary-btn" style={{ padding: '0.8rem 1.5rem', fontSize: '0.95rem' }}>
                            <SvgSparkles size={16} /> Згенерувати розсилку
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* 🔴 ОНЛАЙН-ЗАПИС & SMM (ОНОВЛЕНО ЗА БАЖАННЯМ) */}
        {marketingView === 'smm' && (
          <div style={{ animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '850px' }}>

            {/* ШАПКА */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
              <button onClick={() => setMarketingView('overview')} style={{ background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', cursor: 'pointer', padding: 0 }}><SvgChevronLeft size={28} /></button>
              <div>
                 <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>Онлайн-запис & SMM</h2>
                 <p style={{ color: '#64748b', fontSize: '0.95rem', margin: '0.2rem 0 0 0' }}>Інструменти для залучення клієнтів з соцмереж та інтернету.</p>
              </div>
            </div>

            {/* 1. БАЗОВЕ ПОСИЛАННЯ ТА QR (Ідеально вирівняний блок) */}
            <div className="static-card" style={{ display: 'flex', overflow: 'hidden' }}>
              <div style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                   <div style={{ background: '#fef3c7', color: '#f59e0b', padding: '0.8rem', borderRadius: '12px' }}><SvgLink size={20} /></div>
                   <div>
                      <h3 style={{ margin: '0 0 0.2rem 0', fontSize: '1.1rem', fontWeight: '700', color: '#0f172a' }}>Smart Link для шапки профілю</h3>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Єдине посилання для Instagram, TikTok чи Telegram.</p>
                   </div>
                </div>

                {/* 🟢 ОНОВЛЕНІ ЛЕГКІ КНОПКИ */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.6rem 0.6rem 0.6rem 1rem', borderRadius: '10px' }}>
                  <div style={{ flex: 1, fontSize: '0.95rem', color: '#0f172a', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {businessLink}
                  </div>
                  <button onClick={() => copyToClipboard(`https://${businessLink}`)} className="mini-action-btn">
                    <SvgCopy size={14} /> Скопіювати
                  </button>
                  <button onClick={handleShare} className="mini-action-btn">
                    <SvgShare size={14} /> Поділитися
                  </button>
                </div>
              </div>

              {/* Блок з QR-кодом справа */}
              <div style={{ width: '220px', background: '#f8fafc', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid #e2e8f0', flexShrink: 0 }}>
                 <div style={{ width: '110px', height: '110px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', overflow: 'hidden', padding: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                   <img src={qrCodeUrl} alt="QR Code" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                 </div>
                 <button onClick={downloadQR} className="mini-action-btn" style={{ width: '100%', justifyContent: 'center', background: '#fff', border: '1px solid #e2e8f0' }}>
                   <SvgDownload size={14} /> Завантажити QR
                 </button>
              </div>
            </div>

            {/* 2. НОВА ВЕЛИКА ЗАГЛУШКА ДЛЯ SMM СТУДІЇ */}
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', margin: '0.5rem 0 0 0' }}>SMM Студія</h3>
            <div style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
              border: '1px dashed #cbd5e1',
              borderRadius: '16px',
              padding: '3rem 2rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
               <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '50%', marginBottom: '1.5rem', boxShadow: '0 4px 10px rgba(0,0,0,0.05)', color: '#3b82f6' }}>
                 <SvgSparkles size={32} />
               </div>
               <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem', fontWeight: '800', color: '#0f172a' }}>
                 Повноцінна SMM-Студія у розробці 🚀
               </h4>
               <p style={{ margin: '0 0 2rem 0', fontSize: '0.95rem', color: '#475569', maxWidth: '600px', lineHeight: '1.5' }}>
                 Ми готуємо для вас потужний окремий розділ! Тут буде справжній AI-контент менеджер, який аналізує вашу специфіку, генерує ідеї для Reels, створює готові колажі "До/Після", шаблони відгуків та автоматизує ваші соцмережі.
               </p>
               <button onClick={() => showToast('Дякуємо! Ми повідомимо вас першими при релізі.')} className="primary-btn" style={{ padding: '0.8rem 2rem', fontSize: '1rem' }}>
                 Сповістити мене про запуск
               </button>
            </div>

            {/* 3. ІНТЕГРАЦІЇ (ОПУЩЕНО ВНИЗ) */}
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', margin: '0.5rem 0 0 0' }}>Інтеграції на сторонні платформи</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

              <div className="static-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                   <div style={{ color: '#e1306c', background: '#fdf2f8', padding: '0.8rem', borderRadius: '12px' }}><SvgInstagram size={20} /></div>
                   <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>Кнопка в Instagram</h4>
                 </div>
                 <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem', flex: 1, lineHeight: '1.5' }}>Додайте офіційну кнопку "Забронювати" (Book Now) у ваш бізнес-профіль Instagram.</p>
                 <button onClick={() => setActiveSmmModal('instagram')} className="secondary-btn" style={{ width: '100%', justifyContent: 'center' }}>Як підключити?</button>
              </div>

              {/* Акуратний віджет сайту */}
              <div className="static-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                   <div style={{ color: '#0ea5e9', background: '#e0f2fe', padding: '0.8rem', borderRadius: '12px' }}><SvgCode size={20} /></div>
                   <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>Віджет для сайту</h4>
                 </div>
                 <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem', flex: 1, lineHeight: '1.5' }}>Вбудуйте форму онлайн-запису на власний вебсайт (Wix, WordPress тощо).</p>
                 <button onClick={() => { copyToClipboard(`<iframe src="https://${businessLink}" width="100%" height="600" frameborder="0"></iframe>`); }} className="secondary-btn" style={{ width: '100%', justifyContent: 'center' }}>
                   <SvgCopy size={16}/> Скопіювати iframe код
                 </button>
              </div>
            </div>

          </div>
        )}

        {/* 🔴 ПРОМОКОДИ */}
        {marketingView === 'promotions' && (
          <div style={{ animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '800px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button onClick={() => setMarketingView('overview')} style={{ background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', cursor: 'pointer', padding: 0 }}><SvgChevronLeft size={28} /></button>
                <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>Промокоди</h2>
              </div>
              <button onClick={handleOpenCreatePromo} className="primary-btn">
                <SvgPlus size={16} /> Створити промокод
              </button>
            </div>

            {activePromos.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {activePromos.map(promo => (
                  <div key={promo.id} className="static-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: '0.2s' }} onMouseOver={e=>e.currentTarget.style.borderColor='#cbd5e1'} onMouseOut={e=>e.currentTarget.style.borderColor='#e2e8f0'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a', background: '#f8fafc', padding: '0.6rem 1rem', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>{promo.code}</div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                          <span style={{ fontSize: '0.95rem', color: '#0f172a', fontWeight: '600' }}>Знижка: {promo.discount}</span>
                          <span className="row-badge active" style={{ border: 'none' }}>Активно</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.4rem' }}>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <SvgUsersLimit size={12} /> Використано: {promo.uses} {promo.maxUses ? `/ ${promo.maxUses}` : ''}
                          </div>
                          {promo.validUntil && (
                            <div style={{ fontSize: '0.8rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '600' }}>
                              <SvgCalendarLimit size={12} /> Діє до: {new Date(promo.validUntil).toLocaleDateString('uk-UA')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => handleOpenEditPromo(promo)} className="row-icon-btn" style={{ color: '#0ea5e9' }}>
                        <SvgEdit size={16} />
                      </button>
                      <button onClick={() => handleDeletePromo(promo.id)} className="row-icon-btn" style={{ color: '#ef4444' }}>
                        <SvgTrash size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
               <div className="static-card" style={{ textAlign: 'center', padding: '4rem 0', color: '#64748b', borderStyle: 'dashed' }}>
                 <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
                   <div style={{ background: '#f1f5f9', padding: '1rem', borderRadius: '50%', color: '#94a3b8' }}><SvgTag size={28} /></div>
                 </div>
                 <h3 style={{ fontSize: '1.1rem', color: '#0f172a', margin: '0 0 0.5rem 0', fontWeight: '700' }}>Немає активних промокодів</h3>
                 <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.9rem' }}>Створіть знижку, щоб стимулювати клієнтів записатись.</p>
                 <button onClick={handleOpenCreatePromo} className="primary-btn" style={{ margin: '0 auto' }}>Створити перший промокод</button>
               </div>
            )}
          </div>
        )}

        {/* 🔴 КАМПАНІЇ */}
        {marketingView === 'campaigns' && (
          <div style={{ animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '800px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <button onClick={() => setMarketingView('overview')} style={{ background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', cursor: 'pointer', padding: 0 }}><SvgChevronLeft size={28} /></button>
              <div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>Кампанії та Розсилки</h2>
                <p style={{ color: '#64748b', fontSize: '0.95rem', margin: '0.2rem 0 0 0' }}>Налаштуйте автоматизацію або надішліть масове повідомлення.</p>
              </div>
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
              <button className={`tab-btn ${campaignTab === 'automated' ? 'active' : ''}`} onClick={() => setCampaignTab('automated')}>Авто-сценарії</button>
              <button className={`tab-btn ${campaignTab === 'mass' ? 'active' : ''}`} onClick={() => setCampaignTab('mass')}>Власна розсилка</button>
            </div>

            {campaignTab === 'automated' && (
              <div className="static-card" style={{ overflow: 'hidden' }}>
                {[
                  { id: 'welcome', title: 'Привітання нового клієнта', desc: 'Надсилається через 2 години після першого візиту з подякою.', badge: 'Лояльність' },
                  { id: 'birthday', title: 'Привітання з Днем Народження', desc: 'Знижка за 3 дні до свята клієнта.', badge: 'Конверсія' },
                  { id: 'lost', title: 'Повернення втрачених клієнтів', desc: 'Для тих, хто не був понад 45 днів.', badge: 'Top ROI' },
                ].map((item, idx) => {
                  const isActive = (automations as any)[item.id];
                  return (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', borderBottom: idx !== 2 ? '1px solid #f1f5f9' : 'none' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.3rem' }}>
                          <h4 style={{ fontSize: '1rem', fontWeight: '600', margin: 0, color: '#0f172a' }}>{item.title}</h4>
                          <span className={item.id === 'lost' || item.id === 'birthday' ? "row-badge lull" : "row-badge active"} style={{border: 'none'}}>{item.badge}</span>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>{item.desc}</p>
                      </div>
                      <div className={`custom-toggle ${isActive ? 'active' : ''}`} onClick={() => handleToggleAutomation(item.id, isActive)}></div>
                    </div>
                  )
                })}
              </div>
            )}

            {campaignTab === 'mass' && (
              <div className="static-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <div className="select-wrapper">
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '0.5rem' }}>Аудиторія ({clientsList?.length || 0} клієнтів)</label>
                    <select className="form-input" value={marketingForm.audience} onChange={e => setMarketingForm({...marketingForm, audience: e.target.value})}>
                      <option value="all">Вся база клієнтів</option>
                      <option value="vip">Тільки VIP-клієнти</option>
                      <option value="lost">Втрачені (більше 30 днів)</option>
                    </select>
                  </div>
                  <div className="select-wrapper">
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '0.5rem' }}>Прикріпити промокод</label>
                    <select className="form-input" value={selectedPromoForMessage} onChange={handlePromoSelect}>
                      <option value="">Без промокоду</option>
                      {activePromos.map(p => (
                        <option key={p.id} value={p.code}>{p.code} (-{p.discount})</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569' }}>Текст повідомлення</label>
                    <button onClick={handleAIGenerate} disabled={isGenerating} style={{ background: 'transparent', color: '#2563eb', border: 'none', fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', borderRadius: '8px' }}>
                      <SvgSparkles size={16} /> {isGenerating ? 'AI працює...' : 'Згенерувати з AI'}
                    </button>
                  </div>
                  <textarea className="form-input" value={marketingForm.message} onChange={e => setMarketingForm({...marketingForm, message: e.target.value})} style={{ minHeight: '140px', resize: 'vertical', fontSize: '1rem', lineHeight: '1.5' }} placeholder="Напишіть текст розсилки..." />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                  <button onClick={handleSendMarketing} disabled={isSendingPromo || clientsList?.length === 0} className="primary-btn" style={{ padding: '0.8rem 1.5rem', fontSize: '1rem' }}>
                    <SvgSend size={18} /> {isSendingPromo ? 'Відправка...' : 'Відправити розсилку'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* 🔴 ВСІ МОДАЛЬНІ ВІКНА */}
        {/* ========================================================= */}

        {/* Модалка: ПРОМОКОДИ */}
        {isPromoModalOpen && (
          <div className="modal-overlay" onClick={() => setIsPromoModalOpen(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>{editingPromoId ? 'Редагувати промокод' : 'Новий промокод'}</h2>
                <button onClick={() => setIsPromoModalOpen(false)} style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer' }}><SvgX size={18} /></button>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.3rem' }}>Унікальний код</label>
                <input type="text" className="form-input" style={{ textTransform: 'uppercase', letterSpacing: '1px' }} value={newPromo.code} onChange={e => setNewPromo({...newPromo, code: e.target.value.toUpperCase().replace(/\s+/g, '')})} placeholder="Напр. SUMMER20" />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.3rem' }}>Знижка (%)</label>
                <input type="number" className="form-input" value={newPromo.discount} onChange={e => setNewPromo({...newPromo, discount: e.target.value})} placeholder="15" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem', padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: '#64748b', marginBottom: '0.4rem' }}>Ліміт (разів)</label>
                  <input type="number" className="form-input" style={{ padding: '0.6rem', fontSize: '0.9rem' }} value={newPromo.maxUses} onChange={e => setNewPromo({...newPromo, maxUses: e.target.value})} placeholder="Без ліміту" />
                </div>
                <div style={{ position: 'relative' }} ref={datePickerRef}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: '#64748b', marginBottom: '0.4rem' }}>Діє до дати</label>
                  <div onClick={() => setIsPromoDatePickerOpen(!isPromoDatePickerOpen)} style={{ padding: '0.6rem', fontSize: '0.9rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: newPromo.validUntil ? '#0f172a' : '#94a3b8', transition: '0.2s' }}>
                    {newPromo.validUntil ? new Date(newPromo.validUntil).toLocaleDateString('uk-UA') : 'Оберіть дату'} <SvgCalendarLimit size={16} />
                  </div>
                  {isPromoDatePickerOpen && (
                    <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: '8px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1.25rem', boxShadow: '0 -10px 40px rgba(0,0,0,0.1)', zIndex: 2000, width: '280px', cursor: 'default' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                         <strong style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: '600', textTransform: 'capitalize' }}>{calendarViewDate.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' })}</strong>
                         <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1))} style={{ border: 'none', background: '#f8fafc', borderRadius: '6px', cursor: 'pointer', color: '#64748b', padding: '4px 8px', fontSize: '1rem' }}>&lt;</button>
                            <button onClick={() => setCalendarViewDate(new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1))} style={{ border: 'none', background: '#f8fafc', borderRadius: '6px', cursor: 'pointer', color: '#64748b', padding: '4px 8px', fontSize: '1rem' }}>&gt;</button>
                         </div>
                       </div>
                       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px 0', textAlign: 'center' }}>
                         {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map(d => ( <div key={d} style={{ fontSize: '0.7rem', fontWeight: '700', color: '#94a3b8', marginBottom: '8px' }}>{d}</div> ))}
                         {generateCalendarDays().map((day, idx) => {
                           const currentDateStr = day ? `${calendarViewDate.getFullYear()}-${String(calendarViewDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
                           const isSelected = newPromo.validUntil === currentDateStr;
                           return (
                             <div key={idx} style={{ height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                               <button onClick={() => day && handleCalendarDayClick(day)} disabled={!day} style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: isSelected ? '#0f172a' : 'transparent', color: isSelected ? '#fff' : (day ? '#0f172a' : 'transparent'), fontSize: '0.85rem', fontWeight: isSelected ? '700' : '500', cursor: day ? 'pointer' : 'default', transition: '0.2s' }}>{day || ''}</button>
                             </div>
                           )
                         })}
                       </div>
                       <button onClick={() => { setNewPromo({...newPromo, validUntil: ''}); setIsPromoDatePickerOpen(false); }} style={{ width: '100%', marginTop: '1rem', padding: '8px', background: '#fef2f2', border: 'none', borderRadius: '8px', color: '#ef4444', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer' }}>Без ліміту дати</button>
                    </div>
                  )}
                </div>
              </div>
              <button onClick={handleSavePromo} className="primary-btn" style={{ width: '100%', justifyContent: 'center', padding: '0.8rem 1.5rem' }}>{editingPromoId ? 'Зберегти зміни' : 'Створити'}</button>
            </div>
          </div>
        )}

        {/* 🟢 МОДАЛКА: ІНСТРАКЦІЯ INSTAGRAM */}
        {activeSmmModal === 'instagram' && (
          <div className="modal-overlay" onClick={() => setActiveSmmModal('none')}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  <div style={{ color: '#e1306c' }}><SvgInstagram size={24} /></div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>Кнопка в Instagram</h2>
                </div>
                <button onClick={() => setActiveSmmModal('none')} style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer' }}><SvgX size={18} /></button>
              </div>

              <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: '1.5', marginBottom: '1.5rem' }}>
                Щоб додати кнопку <b>«Забронювати»</b> у свій профіль, виконайте ці кроки в додатку Instagram:
              </p>

              <ol style={{ paddingLeft: '1.2rem', margin: 0, fontSize: '0.9rem', color: '#0f172a', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                 <li>Перейдіть у свій профіль і натисніть <b>«Редагувати профіль»</b>.</li>
                 <li>Знайдіть розділ <b>«Посилання»</b> (Links) і виберіть <b>«Додати зовнішнє посилання»</b>.</li>
                 <li>Вставте посилання на ваш запис у поле URL:
                    <div style={{ background: '#f1f5f9', padding: '0.6rem 0.8rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', fontWeight: '500' }}>
                       <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{businessLink}</span>
                       <button onClick={() => copyToClipboard(`https://${businessLink}`)} style={{ background: 'transparent', border: 'none', color: '#3b82f6', fontWeight: '700', cursor: 'pointer', padding: 0 }}>Копіювати</button>
                    </div>
                 </li>
                 <li>У полі «Назва» (Title) напишіть: <b>Запис онлайн</b>.</li>
                 <li>Натисніть «Готово» (✓) у правому верхньому куті.</li>
              </ol>

              <button onClick={() => setActiveSmmModal('none')} className="primary-btn" style={{ width: '100%', justifyContent: 'center', padding: '0.8rem 1.5rem', marginTop: '2rem' }}>Зрозуміло</button>
            </div>
          </div>
        )}

        {comingSoonModal.isOpen && (
          <div className="modal-overlay" onClick={() => setComingSoonModal({ isOpen: false, title: '', desc: '' })}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f8fafc', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}><SvgInfo size={24} /></div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.5rem' }}>{comingSoonModal.title}</h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>{comingSoonModal.desc}</p>
              <button onClick={() => setComingSoonModal({ isOpen: false, title: '', desc: '' })} className="primary-btn" style={{ width: '100%', justifyContent: 'center', padding: '0.8rem 1.5rem' }}>Зрозуміло</button>
            </div>
          </div>
        )}

        {toastMessage && (
          <div style={{ position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', background: '#0f172a', color: '#fff', padding: '0.8rem 1.2rem', borderRadius: '10px', fontSize: '0.9rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem', zIndex: 3000, animation: 'slideUpFade 0.2s ease-out', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)' }}>
            <SvgCheck /> {toastMessage}
          </div>
        )}
      </div>
    </>
  );
}