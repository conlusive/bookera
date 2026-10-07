'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';
import { Icons } from '@/components/shared';
import HelpTip from '@/components/ui/HelpTip';
import { notify } from '@/lib/feedback';
import FormModal, { Field, FormSection } from '@/components/ui/FormModal';
import BirthdayInput from '@/components/ui/BirthdayInput';
import ClientImportModal from '@/components/cabinet/ClientImportModal';
import ClientDuplicatesModal from '@/components/cabinet/ClientDuplicatesModal';

export default function ClientsTab({ business, clientsList, setClientsList, fetchClientsFromDB, onBookAgain, onRemind }: any) {
  const supabase = createClient();

  // --- СТАНИ ---
  const [viewingClient, setViewingClient] = useState<any>(null);
  const [activeCardTab, setActiveCardTab] = useState<'info' | 'medical' | 'timeline' | 'gallery'>('info');
  // Історія візитів відкритого клієнта - з сервера, при відкритті вкладки
  const [history, setHistory] = useState<any[] | null>(null);
  useEffect(() => {
    if (!viewingClient?.id || activeCardTab !== 'timeline') return;
    let alive = true;
    setHistory(null);
    void getAuthToken().then(t => api.getClientHistory(t, Number(viewingClient.id))).then(r => { if (alive) setHistory(r); }).catch(() => { if (alive) setHistory([]); });
    return () => { alive = false; };
  }, [viewingClient?.id, activeCardTab]);

  const [clientSearch, setClientSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeSegment, setActiveSegment] = useState<string>('all');
  // «Не були понад N днів» - довільний поріг для нагадування (0 - вимкнено)
  const [lapseDays, setLapseDays] = useState(0);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'recent', direction: 'desc' });

  // Дані для редагування
  const [editingClientNotes, setEditingClientNotes] = useState('');
  const [editingClientAllergies, setEditingClientAllergies] = useState('');
  const [editingFormulas, setEditingFormulas] = useState('');
  const [consents, setConsents] = useState({ photo: false, procedure: false, marketing: false });

  // НОВЕ: Стани для редагування контактів прямо з картки
  const [editingInstagram, setEditingInstagram] = useState('');
  const [editingBirthday, setEditingBirthday] = useState('');

  const [newTagInput, setNewTagInput] = useState('');

  const [clientCurrentPage, setClientCurrentPage] = useState(1);
  const clientsPerPage = 12;

  // Модалки
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ name: '', phone: '+380', email: '', birthday: '', marketing: false });

  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [balanceOperation, setBalanceOperation] = useState<'add' | 'subtract'>('add');
  const [balanceAmount, setBalanceAmount] = useState('');

  // Сім'я та PDF
  const [isFamilyModalOpen, setIsFamilyModalOpen] = useState(false);
  const [familySearch, setFamilySearch] = useState('');
  const [isUploadingPDF, setIsUploadingPDF] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- КАСТОМНИЙ UI ---
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, title: string, text: string, onConfirm: () => void } | null>(null);

  // Відгук на місці замість сповіщень (lib/feedback.ts)
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success', opts?: { field?: string }) => notify(msg, type, opts);

  useEffect(() => {
    if (typeof window !== 'undefined' && clientsList && clientsList.length > 0 && !viewingClient) {
      const savedId = sessionStorage.getItem('openedClientId');
      if (savedId) {
        const client = clientsList.find((c: any) => c.id === savedId);
        if (client) openViewingClient(client, false);
      }
    }
  }, [clientsList]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(clientSearch), 300);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  const getUserInitials = (name: string) => {
    if (!name) return 'В';
    const parts = name.trim().split(' ');
    return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0][0].toUpperCase();
  };

  const getBadgeClass = (tag: string) => {
    const t = tag.toLowerCase();
    if (t.includes('vip') || t.includes('постійний')) return 'vip';
    if (t.includes('новий') || t.includes('імпорт')) return 'new';
    if (t.includes('проблемний') || t.includes('алергія') || t.includes('чорний')) return 'problem';
    return 'default';
  };

  const handleSortClick = (key: string) => {
    setSortConfig(prev => {
      if (prev.key === key) return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      return { key, direction: key === 'name' ? 'asc' : 'desc' };
    });
  };

  // 9 цифр після +380 з будь-якого запису номера
  const phoneDigits = (v: string) => String(v || '').replace(/\D/g, '').replace(/^380/, '').slice(-9);
  // Хто в якому сегменті - одне правило і для фільтра, і для лічильників
  const DAY = 86400000;
  // Групи клієнтів, як у Booksy. Межі дзеркалять app/services/client_groups.py: за ними ж формується аудиторія
  // розсилки, тож число біля групи дорівнює числу тих, кому піде нагадування.
  const NEW_DAYS = 30, LOST_DAYS = 60, REGULAR_VISITS = 3, REGULAR_WINDOW = 90, MONTH = 30, QUARTER = 90, YEAR = 365;
  const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const daysSince = (iso?: string | null) => {
    if (!iso) return null;
    const d = new Date(iso); d.setHours(0, 0, 0, 0);
    return Math.round((startOfToday() - d.getTime()) / DAY);
  };
  const GROUPS: { id: string; label: string; short: string; hint: string; remind: boolean; tone: string }[] = [
    { id: 'regular', label: 'Ходять регулярно', short: '3+ візити, ходять досі', hint: 'Три й більше візитів, останній не давніше 90 днів.', remind: false, tone: '#10b981' },
    { id: 'new', label: 'Новоприбулі', short: 'Додані за 30 днів', hint: 'Додані за останні 30 днів, не більше одного візиту.', remind: false, tone: '#3b82f6' },
    { id: 'lapsed1m', label: 'Не були місяць', short: '30–89 днів без візиту', hint: 'Останній візит 30–89 днів тому й немає запису наперед.', remind: true, tone: '#f59e0b' },
    { id: 'lapsed3m', label: 'Не були три місяці', short: '90–364 дні без візиту', hint: 'Останній візит 90–364 дні тому й немає запису наперед.', remind: true, tone: '#f97316' },
    { id: 'lost', label: 'Втрачені', short: 'Один візит і не повернулись', hint: 'Були лише раз, понад 60 днів тому, і більше не приходили.', remind: true, tone: '#ef4444' },
    { id: 'lapsed1y', label: 'Не було понад рік', short: 'Рік і більше без візиту', hint: 'Останній візит рік і більше тому.', remind: true, tone: '#94a3b8' },
  ];
  const activeGroup = GROUPS.find(g => g.id === activeSegment);
  const segmentOf = (seg: string, c: any) => {
    const visits = c.visits_count || 0;
    const since = daysSince(c.last_visit_at);
    const upcoming = !!c.next_visit_at;
    if (seg === 'new') return visits <= 1 && !!c.created_at && (startOfToday() - new Date(c.created_at).setHours(0, 0, 0, 0)) / DAY <= NEW_DAYS;
    if (seg === 'regular') return visits >= REGULAR_VISITS && (upcoming || (since !== null && since <= REGULAR_WINDOW));
    if (seg === 'lost') return visits === 1 && !upcoming && since !== null && since >= LOST_DAYS;
    if (seg === 'lapsed1m') return !upcoming && since !== null && since >= MONTH && since < QUARTER;
    if (seg === 'lapsed3m') return !upcoming && since !== null && since >= QUARTER && since < YEAR;
    if (seg === 'lapsed1y') return !upcoming && since !== null && since >= YEAR;
    if (seg.startsWith('away_')) return !upcoming && since !== null && since >= Number(seg.slice(5));
    if (seg === 'vip') return (c.tags || []).some((t: string) => String(t).toLowerCase().includes('vip'));
    if (seg === 'blacklist') return !!c.is_blacklisted;
    return true;
  };
  const segmentCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const s of ['all', 'vip', 'blacklist', ...GROUPS.map(g => g.id)]) out[s] = clientsList.filter((c: any) => segmentOf(s, c)).length;
    out.away = clientsList.filter((c: any) => segmentOf(`away_${MONTH}`, c)).length;
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientsList]);

  // Бічна колонка: гроші й найближчі дні народження
  const sideStats = useMemo(() => {
    let spent = 0, visits = 0, deposits = 0, newThis = 0, newPrev = 0, visited = 0, returned = 0;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const birthdays: { client: any; days: number; label: string }[] = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (const cl of clientsList as any[]) {
      spent += Number(cl.total_spent || 0);
      visits += Number(cl.visits_count || 0);
      if (Number(cl.balance) > 0) deposits += Number(cl.balance);
      const created = cl.created_at ? new Date(cl.created_at).getTime() : 0;
      if (created >= monthStart) newThis += 1;
      else if (created >= prevStart) newPrev += 1;
      if ((cl.visits_count || 0) >= 1) { visited += 1; if ((cl.visits_count || 0) >= 2) returned += 1; }
      const m = /^\d{4}-(\d{2})-(\d{2})/.exec(cl.birthday || '');
      if (m) {
        const next = new Date(today.getFullYear(), Number(m[1]) - 1, Number(m[2]));
        if (next < today) next.setFullYear(today.getFullYear() + 1);
        const days = Math.round((next.getTime() - today.getTime()) / DAY);
        if (days <= 7) birthdays.push({ client: cl, days, label: days === 0 ? 'сьогодні' : days === 1 ? 'завтра' : next.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }) });
      }
    }
    birthdays.sort((a, b) => a.days - b.days);
    return { spent, avgCheck: visits ? spent / visits : 0, deposits, birthdays, newThis, newPrev,
             returnPct: visited ? Math.round((returned / visited) * 100) : null, visited, returned };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientsList]);

  const filteredAndSortedClients = useMemo(() => {
    let filtered = clientsList.filter((c: any) => {
      const searchLower = String(debouncedSearch ?? '').toLowerCase();
      return (c.name || '').toLowerCase().includes(searchLower) || (c.phone || '').includes(debouncedSearch);
    });

    // Сегменти - із даних, порахованих на сервері із записів.
    // Раніше «Давно не були» зараховував усіх без жодного візиту (щойно
    // доданий клієнт одразу ставав «втраченим»), а «Нові» - за місяцем
    // останнього візиту, тож торішній візит у тому ж місяці теж давав «нового».
    filtered = filtered.filter((c: any) => segmentOf(lapseDays > 0 ? `away_${lapseDays}` : activeSegment, c));

    return filtered.sort((a: any, b: any) => {
      const { key, direction } = sortConfig;
      const modifier = direction === 'asc' ? 1 : -1;
      if (key === 'name') return modifier * (a.name || '').localeCompare(b.name || '');
      if (key === 'recent') return modifier * (new Date(a.last_visit_at || 0).getTime() - new Date(b.last_visit_at || 0).getTime());
      if (key === 'visits') return modifier * ((a.visits_count || 0) - (b.visits_count || 0));
      if (key === 'spent') return modifier * ((a.total_spent || 0) - (b.total_spent || 0));
      if (key === 'balance') return modifier * ((a.balance || 0) - (b.balance || 0));
      return 0;
    });
  }, [clientsList, debouncedSearch, sortConfig, activeSegment, lapseDays]);

  useEffect(() => { setClientCurrentPage(1); }, [debouncedSearch, sortConfig, activeSegment, lapseDays]);

  // Автозаповнення за поштою: клієнт уже в базі - кажемо; людина вже була в
  // закладі й має акаунт - підставляємо імʼя, телефон, дату народження в
  // ПОРОЖНІ поля (введене вручну не перетираємо).
  const [lookupNote, setLookupNote] = useState('');
  useEffect(() => {
    setLookupNote('');
    const email = newClientForm.email.trim();
    if (!isAddClientModalOpen || !business?.id || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return;
    const t = setTimeout(async () => {
      try {
        const r = await api.lookupClient(await getAuthToken(), Number(business.id), email);
        if (r.existing_client) {
          showToast(`Цей клієнт уже є в базі: ${r.existing_client.name}`, 'error', { field: 'client-email' });
        } else if (r.shared) {
          setNewClientForm(f => ({
            ...f,
            name: f.name.trim() ? f.name : (r.name || ''),
            phone: phoneDigits(f.phone) ? f.phone : (r.phone ? '+380' + phoneDigits(r.phone) : f.phone),
            birthday: f.birthday || r.birthday || '',
          }));
          setLookupNote('✓ Дані підтягнуто з акаунта BookEra');
        } else if (r.found) {
          setLookupNote('Є акаунт BookEra — дані зʼявляться після першого запису у ваш заклад');
        }
      } catch { /* пошук необовʼязковий */ }
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newClientForm.email, isAddClientModalOpen]);

  // Імпорт / експорт / дублі - лише з доступом до всієї бази (власник,
  // адміністратор; майстрові - якщо власник відкрив)
  const [canManageBase, setCanManageBase] = useState(false);
  const [dupCount, setDupCount] = useState(0);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDupOpen, setIsDupOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const refreshDuplicates = useCallback(async () => {
    if (!business?.id) return;
    try {
      const t = await getAuthToken();
      const acc = await api.getMyAccess(t, Number(business.id));
      const ok = !!acc.sections?.clients;
      setCanManageBase(ok);
      setDupCount(ok ? (await api.getClientDuplicates(t, Number(business.id))).length : 0);
    } catch { setCanManageBase(false); }
  }, [business?.id]);
  useEffect(() => { void refreshDuplicates(); }, [refreshDuplicates, clientsList.length]);

  // Підказка - що зараз найкорисніше зробити з базою
  const sideHint = (() => {
    if (clientsList.length === 0) return { title: 'База порожня', text: 'Імпортуйте клієнтів з Excel чи іншої системи — так нагадування й розсилки запрацюють одразу.', action: canManageBase ? { label: 'Імпортувати', run: () => setIsImportOpen(true) } : null };
    if (canManageBase && dupCount > 0) return { title: `${dupCount} ${dupCount === 1 ? 'група дублів' : 'групи дублів'}`, text: 'Один клієнт у кількох картках — його візити й витрати розкидані. Обʼєднайте, щоб бачити правду.', action: { label: 'Обʼєднати', run: () => setIsDupOpen(true) } };
    if (segmentCounts.away > 0) return { title: `${segmentCounts.away} давно не були`, text: 'Понад 30 днів без візиту й без запису наперед. Коротке повідомлення зараз часто повертає людину.', action: { label: 'Показати', run: () => { setActiveSegment('all'); setLapseDays(30); } } };
    if (sideStats.birthdays.length > 0) return { title: 'Скоро дні народження', text: 'Привітання з невеликим подарунком — найтепліший привід запросити клієнта.', action: null };
    return { title: 'База в порядку', text: 'Дублів немає, давно втрачених клієнтів теж. Так тримати.', action: null };
  })();

  const handleExport = async () => {
    setIsExporting(true);
    try { await api.exportClients(await getAuthToken(), Number(business.id)); }
    catch (e: any) { showToast(e?.message || 'Не вдалося вивантажити базу', 'error'); }
    finally { setIsExporting(false); }
  };

  const handleSaveNewClient = async () => {
    if (!newClientForm.name.trim()) return showToast("Вкажіть імʼя клієнта", 'error', { field: 'client-name' });
    let finalPhone = '';
    const digits = phoneDigits(newClientForm.phone);
    if (digits) {
      if (digits.length !== 9) return showToast('Ще кілька цифр: потрібно 9 після +380', 'error', { field: 'client-phone' });
      finalPhone = '+380' + digits;
      // Той самий номер - той самий клієнт (сервер теж перевіряє)
      const same = clientsList.find((c: any) => phoneDigits(c.phone || '') === digits);
      if (same) return showToast(`Такий клієнт уже є: ${same.name}`, 'error', { field: 'client-phone' });
    }
    const email = newClientForm.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return showToast('Перевірте адресу пошти', 'error', { field: 'client-email' });
    }

    setIsSavingClient(true);

    try {
      const created = await api.createClient(await getAuthToken(), {
        business_id: business.id,
        name: newClientForm.name.trim(),
        phone: finalPhone,
        email: email || undefined,
        birthday: newClientForm.birthday || undefined,
        marketing_consent: newClientForm.marketing,
        tags: ['Новий'],
      });

      setClientsList((prev: any) => [...prev, created]);
      setIsAddClientModalOpen(false);
      setNewClientForm({ name: '', phone: '+380', email: '', birthday: '', marketing: false });
    } catch (err: any) {
      const msg = err?.message || 'Не вдалося додати клієнта';
      showToast(msg, 'error', /номер/i.test(msg) ? { field: 'client-phone' } : undefined);
    } finally {
      setIsSavingClient(false);
    }
  };

  const executeDeleteClient = async (clientId: string) => {
    setConfirmDialog(null);
    try {
      await api.deleteClient(await getAuthToken(), Number(clientId));
      setClientsList((prev: any) => prev.filter((c: any) => c.id !== clientId));
      closeViewingClient();
      showToast("Клієнта видалено", 'info');
    } catch (err: any) {
      // Бекенд свідомо забороняє видаляти клієнтів з історією бронювань
      // або нарахованими балами (409) - показуємо причину, а не спільну помилку.
      showToast(err?.message || "Не вдалося видалити клієнта.", 'error');
    }
  };

  // --- ЗБЕРЕЖЕННЯ ДАНИХ КЛІЄНТА (ВКЛЮЧНО З ІНСТА ТА ДН) ---
  const handleSaveData = async () => {
    if (!viewingClient) return;

    const optimisticUpdatedClient = {
      ...viewingClient,
      notes: editingClientNotes,
      allergies: editingClientAllergies,
      formulas: editingFormulas,
      consent_photo: consents.photo,
      consent_procedure: consents.procedure,
      marketing_consent: consents.marketing,
      instagram: editingInstagram,
      birthday: editingBirthday || null
    };

    setViewingClient(optimisticUpdatedClient);
    setClientsList(clientsList.map((c: any) => c.id === viewingClient.id ? optimisticUpdatedClient : c));

    try {
      await api.updateClient(await getAuthToken(), viewingClient.id, {
        notes: editingClientNotes,
        allergies: editingClientAllergies,
        formulas: editingFormulas,
        consent_photo: consents.photo,
        consent_procedure: consents.procedure,
        marketing_consent: consents.marketing,
        instagram: editingInstagram,
        birthday: editingBirthday || undefined,
      });
      showToast("Дані успішно збережено", 'success');
    } catch (err: any) {
      showToast(err?.message || "Помилка збереження бази", 'error');
    }
  };

  const handleLinkClient = async (targetClientId: string) => {
    if (!viewingClient) return;

    const currentLinked = viewingClient.linked_client_ids || [];
    if (currentLinked.includes(Number(targetClientId))) return showToast("Вже додано до сім'ї", "error");

    try {
      const updated = await api.linkClients(await getAuthToken(), viewingClient.id, Number(targetClientId));
      setViewingClient(updated);
      setClientsList(clientsList.map((c: any) => (c.id === updated.id ? updated : c)));
      showToast("Профілі успішно об'єднані", "success");
      setIsFamilyModalOpen(false);
      setFamilySearch('');
    } catch (error: any) {
      showToast(error?.message || "Помилка зв'язування", "error");
    }
  };

  const handleUnlinkClient = async (targetClientId: string) => {
    try {
      const updated = await api.unlinkClients(await getAuthToken(), viewingClient.id, Number(targetClientId));
      setViewingClient(updated);
      setClientsList(clientsList.map((c: any) => (c.id === updated.id ? updated : c)));
      showToast("Зв'язок розірвано", "info");
    } catch (error: any) {
      showToast(error?.message || "Помилка видалення", "error");
    }
  };

  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !viewingClient) return;

    setIsUploadingPDF(true);
    try {
      // Файл - у Supabase Storage (це файлове сховище, не структуровані дані
      // бізнесу - залишається окремим від FastAPI, як і має бути).
      const fileExt = file.name.split('.').pop();
      const fileName = `medical_consent_${viewingClient.id}_${Date.now()}.${fileExt}`;
      const filePath = `${business?.id || 'general'}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);

      // А посилання на файл - вже структуровані дані клієнта, йде через FastAPI.
      await api.updateClient(await getAuthToken(), viewingClient.id, { medical_pdf_url: publicUrl });

      setViewingClient({ ...viewingClient, medical_pdf_url: publicUrl });
      setClientsList(clientsList.map((c: any) => c.id === viewingClient.id ? { ...c, medical_pdf_url: publicUrl } : c));

      showToast("PDF успішно завантажено", "success");
    } catch (err) {
      showToast("Помилка. Перевірте чи створено Bucket 'documents' в Supabase", "error");
    } finally {
      setIsUploadingPDF(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  const handleRemovePDF = async () => {
     try {
       await api.updateClient(await getAuthToken(), viewingClient.id, { medical_pdf_url: undefined });
       setViewingClient({ ...viewingClient, medical_pdf_url: null });
       setClientsList(clientsList.map((c: any) => c.id === viewingClient.id ? { ...c, medical_pdf_url: null } : c));
       showToast("Файл видалено", "info");
     } catch (err: any) { showToast(err?.message || "Помилка видалення", "error"); }
  };

  const handleToggleBlacklist = async () => {
    if (!viewingClient) return;
    const newStatus = !viewingClient.is_blacklisted;
    setViewingClient({ ...viewingClient, is_blacklisted: newStatus });
    setClientsList(clientsList.map((c: any) => c.id === viewingClient.id ? { ...c, is_blacklisted: newStatus } : c));
    showToast(newStatus ? "Додано до чорного списку" : "Видалено з чорного списку", 'success');
    try {
      await api.updateClient(await getAuthToken(), viewingClient.id, { is_blacklisted: newStatus });
    } catch (error: any) { showToast(error?.message || "Помилка сервера", 'error'); }
  };

  const handleUpdateBalance = async () => {
     const amount = parseFloat(balanceAmount);
     if (isNaN(amount) || amount <= 0) return showToast("Введіть коректну суму", 'error', { field: 'balance-amount' });

     const currentBalance = viewingClient.balance || 0;
     const newBalance = balanceOperation === 'add' ? currentBalance + amount : currentBalance - amount;

     try {
        await api.updateClient(await getAuthToken(), viewingClient.id, { balance: newBalance });
        setViewingClient({ ...viewingClient, balance: newBalance });
        setClientsList(clientsList.map((c: any) => c.id === viewingClient.id ? { ...c, balance: newBalance } : c));
        showToast(`Баланс ${balanceOperation === 'add' ? 'поповнено' : 'зменшено'}`, 'success');
        setIsBalanceModalOpen(false);
        setBalanceAmount('');
     } catch (err) { showToast("Не вдалося оновити баланс", 'error'); }
  };

  const openViewingClient = (client: any, saveToStorage = true) => {
    setViewingClient(client);
    setEditingClientNotes(client.notes || '');
    setEditingClientAllergies(client.allergies || '');
    setEditingFormulas(client.formulas || '');
    setEditingInstagram(client.instagram || '');
    setEditingBirthday(client.birthday || '');
    setConsents({ photo: client.consent_photo || false, procedure: client.consent_procedure || false, marketing: client.marketing_consent === true });
    setNewTagInput('');
    setActiveCardTab('info');
    if (saveToStorage && typeof window !== 'undefined') sessionStorage.setItem('openedClientId', client.id);
  };

  const closeViewingClient = () => {
    setViewingClient(null);
    if (typeof window !== 'undefined') sessionStorage.removeItem('openedClientId');
  };


  const handleRemoveTag = async (tagToRemove: string) => {
     const updatedTags = viewingClient.tags.filter((t: string) => t !== tagToRemove);
     try {
        await api.updateClient(await getAuthToken(), viewingClient.id, { tags: updatedTags });
        setClientsList(clientsList.map((c: any) => c.id === viewingClient.id ? { ...c, tags: updatedTags } : c));
        setViewingClient({ ...viewingClient, tags: updatedTags });
     } catch(err: any) { showToast(err?.message || "Помилка", 'error'); }
  };

  const isBirthdaySoon = (birthdayString: string) => {
    if (!birthdayString) return false;
    const bd = new Date(birthdayString);
    const today = new Date();
    return bd.getMonth() === today.getMonth();
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey) return <span style={{ opacity: 0.3, marginLeft: '4px' }}>↕</span>;
    return <span style={{ color: '#0f172a', marginLeft: '4px', fontWeight: 'bold' }}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  const loyaltyTarget = 10;
  const loyaltyProgress = viewingClient ? Math.min((viewingClient.visits_count || 0) / loyaltyTarget, 1) : 0;
  const isClientLost = !!viewingClient && segmentOf(`away_${MONTH}`, viewingClient);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%', background: '#fff' }}>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .page-transition { animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .toast-animate { animation: fadeIn 0.3s ease forwards; }

        .light-input { width: 100%; padding: 0.65rem 0.9rem; border-radius: 10px; border: 1px solid #e2e8f0; background: #fafafa; font-size: 0.9rem; color: #0f172a; outline: none; transition: all 0.2s; }
        .light-input:focus { background: #fff; border-color: #0f172a; box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.05); }

        .light-btn { background: #0f172a; color: #fff; border: none; padding: 0.55rem 1.1rem; border-radius: 10px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; }
        .light-btn:hover { background: #1e293b; }
        
        .light-btn-sec { background: #f8fafc; color: #0f172a; border: 1px solid #e2e8f0; padding: 0.55rem 1.1rem; border-radius: 10px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; }
        .light-btn-sec:hover { background: #f1f5f9; border-color: #cbd5e1; }

        .action-circle-btn { width: 38px; height: 38px; border-radius: 50%; background: #f1f5f9; border: none; display: flex; align-items: center; justify-content: center; color: #475569; cursor: pointer; transition: 0.2s; font-size: 1rem; }
        .action-circle-btn:hover { background: #e2e8f0; transform: scale(1.05); color: #0f172a; }
        .action-circle-btn.insta:hover { background: #fce7f3; color: #db2777; }
        .action-circle-btn.tg:hover { background: #e0f2fe; color: #0284c7; }

        .seg-tab { padding: 0.4rem 0.9rem; border-radius: 8px; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: 0.2s; border: none; background: transparent; color: #64748b; }
        .seg-tab:hover { color: #0f172a; }
        .seg-tab.active { background: #fff; color: #0f172a; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }

        .smart-badge { background: linear-gradient(135deg, #e0e7ff 0%, #f3e8ff 100%); border: 1px solid #c7d2fe; padding: 1rem 1.5rem; border-radius: 16px; display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }

        .apple-switch { position: relative; width: 44px; height: 24px; background: #cbd5e1; border-radius: 12px; cursor: pointer; transition: 0.3s; }
        .apple-switch.on { background: #10b981; }
        .apple-switch-knob { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; background: #fff; border-radius: 50%; transition: 0.3s; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .apple-switch.on .apple-switch-knob { transform: translateX(20px); }

        .minimal-table { width: 100%; border-collapse: collapse; }
        .minimal-table th { text-align: left; padding: 1.2rem 0.5rem 0.8rem 0.5rem; color: #86868b; font-weight: 600; font-size: 0.75rem; border-bottom: 1px solid #e2e8f0; text-transform: uppercase; }
        .minimal-table td { padding: 1.2rem 0.5rem; color: #1d1d1f; font-size: 0.95rem; border-bottom: 1px solid #f1f5f9; }
        .minimal-table tr { cursor: pointer; transition: 0.15s; }
        .minimal-table tr:hover td { background: #f8fafc; }
        
        .tag-pill { padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 0.7rem; font-weight: 600; display: inline-block; }
        .tag-pill.vip { background: #fef3c7; color: #92400e; }
        .tag-pill.new { background: #dcfce7; color: #166534; }
        .tag-pill.problem { background: #fee2e2; color: #991b1b; }
        .tag-pill.default { background: #f1f5f9; color: #475569; }

        .allergy-alert-box { background: #fff5f5; border: 1.5px dashed #feb2b2; padding: 1rem; border-radius: 12px; display: flex; gap: 0.8rem; align-items: flex-start; }

        .timeline-wrapper { position: relative; padding-left: 20px; border-left: 2px solid #e2e8f0; margin-left: 10px; display: flex; flex-direction: column; gap: 2rem; }
        .timeline-item { position: relative; }
        .timeline-dot { position: absolute; left: -27px; top: 2px; width: 12px; height: 12px; border-radius: 50%; background: #fff; border: 2px solid #cbd5e1; box-shadow: 0 0 0 4px #fff; }
        .timeline-dot.success { border-color: #10b981; background: #d1fae5; }
        .timeline-dot.system { border-color: #6F9273; background: #E4EEE3; }

        .gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1rem; margin-top: 1.5rem; }
        .gallery-placeholder { aspect-ratio: 1; background: #f8fafc; border: 2px dashed #e2e8f0; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; color: #94a3b8; cursor: pointer; transition: 0.2s; }
        .gallery-placeholder:hover { background: #f1f5f9; border-color: #cbd5e1; color: #64748b; }
      
        /* ---- Стиль «Послуг»: ті самі кнопки, пошук, пігулки й таблиця ---- */
        .clean-input { width: 100%; padding: 0.5rem 0.8rem; border-radius: 8px; border: 1px solid #e2e8f0; background: #fafafa; font-size: 0.85rem; color: #0f172a; outline: none; transition: all 0.2s; }
        .clean-input:focus { border-color: #436b49; background: #fff; }
        .clean-btn { background: #0f172a; color: #fff; border: none; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; }
        .clean-btn:hover { background: #1e293b; }
        .clean-btn-ghost { background: transparent; color: #64748b; border: 1px solid #e2e8f0; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; }
        .clean-btn-ghost:hover { background: #f8fafc; color: #0f172a; }
        .category-pill { padding: 0.4rem 1.2rem; border-radius: 999px; background: #fff; border: 1px solid #e2e8f0; color: #64748b; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: 0.2s; white-space: nowrap; flex-shrink: 0; }
        .category-pill:hover { background: #f8fafc; color: #0f172a; }
        .category-pill.active { background: #0f172a; color: #fff; border-color: #0f172a; }
        /* Таблиця з м'якими заокругленими рядками без гострих кутів */
        .service-table { 
          width: 100%; 
          border-collapse: separate; 
          border-spacing: 0 4px; 
          text-align: left; 
        }
        .service-table th { 
          padding: 0.75rem 1rem; 
          color: #94a3b8; 
          font-size: 0.7rem; 
          font-weight: 700; 
          text-transform: uppercase; 
          letter-spacing: 0.05em; 
          border-bottom: 1px solid #f1f5f9; 
          position: sticky; 
          top: 0; 
          background: #fff; 
          z-index: 10; 
          transition: color 0.2s; 
        }
        .service-table th.sortable:hover { color: #0f172a; cursor: pointer; }
        
        .service-table td { 
          padding: 0.95rem 1rem; 
          border-bottom: 1px solid #f8fafc; 
          border-top: 1px solid transparent;
          vertical-align: middle; 
          transition: background 0.15s ease; 
        }
        .service-table tr { cursor: pointer; transition: 0.15s; }
        .service-table tr.service-row:hover td { background: #f8fafc; }

        /* Плавні заокруглення лівого та правого краю рядка */
        .service-table tr.service-row td:first-child {
          border-top-left-radius: 12px;
          border-bottom-left-radius: 12px;
          padding-left: 1.25rem;
        }
        .service-table tr.service-row td:last-child {
          border-top-right-radius: 12px;
          border-bottom-right-radius: 12px;
          padding-right: 1.25rem;
        }
        .clean-btn-ghost:disabled { cursor: progress; }
        .service-table td { color: #0f172a; }
        .service-table th { color: #64748b; }
        .cl-cake { display: inline-flex; vertical-align: -2px; margin-left: 0.35rem; color: #f59e0b; }
        .cl-groups { display: flex; gap: 0.6rem; overflow-x: auto; padding: 1rem 2rem 0.25rem; }
        .cl-group { flex: 1 1 0; min-width: 152px; display: flex; flex-direction: column; align-items: flex-start; gap: 0.15rem; padding: 0.75rem 0.9rem 0.8rem; border: 1px solid #eef1f4; background: #fff; border-radius: 14px; cursor: pointer; text-align: left; font-family: inherit; transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s; }
        .cl-group:hover { border-color: #cbd5e1; }
        .cl-group.on { border-color: #0f172a; box-shadow: 0 0 0 1px #0f172a; }
        .cl-group-n { font-size: 1.5rem; font-weight: 800; color: #0f172a; line-height: 1.1; font-variant-numeric: tabular-nums; }
        .cl-group-t { display: inline-flex; align-items: flex-start; gap: 0.4rem; font-size: 0.84rem; font-weight: 700; color: #0f172a; margin-top: 0.15rem; line-height: 1.25; }
        .cl-group-t i { width: 8px; height: 8px; border-radius: 50%; display: block; flex-shrink: 0; margin-top: 0.3rem; }
        .cl-group-s { font-size: 0.74rem; color: #94a3b8; line-height: 1.3; }
        .cl-context { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.9rem 2rem 0.25rem; flex-wrap: wrap; }
        .cl-context-text { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .cl-context-text b { font-size: 1.05rem; color: #0f172a; }
        .cl-context-text span { font-size: 0.82rem; color: #64748b; }
        .cl-context-actions { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
        .cl-lapse-wrap { display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: #64748b; }
        .cl-lapse { width: auto; min-width: 110px; cursor: pointer; padding-top: 0.45rem; padding-bottom: 0.45rem; }
        .cl-actions-top { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; justify-content: flex-end; }
        .cl-actions-top .clean-btn-ghost, .cl-actions-top .clean-btn { display: inline-flex; align-items: center; gap: 0.4rem; }
        .cl-dup { color: #b45309 !important; border-color: #fcd34d !important; background: #fffbeb !important; }
        .cl-dup span { font-weight: 700; }
        .cl-acts { white-space: nowrap; padding-left: 0 !important; }
        .cl-acts > span { display: inline-flex; gap: 0.25rem; opacity: 0; transition: opacity .15s; }
        .service-row:hover .cl-acts > span, .cl-acts > span:focus-within { opacity: 1; }
        .cl-acts a, .cl-acts button { width: 32px; height: 32px; border-radius: 9px; border: 1px solid #e2e8f0; background: #fff; color: #475569; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all .15s; padding: 0; }
        .cl-acts a:hover, .cl-acts button:hover { color: #0f172a; border-color: #cbd5e1; background: #f8fafc; }
        @media (hover: none) { .cl-acts > span { opacity: 1; } }
        .cl-grid { display: grid; grid-template-columns: 1fr 300px; flex: 1; min-height: 0; overflow: hidden; }
        .cl-main { overflow-y: auto; border-right: 1px solid #f1f5f9; display: flex; justify-content: center; }
        .cl-main-inner { width: 100%; max-width: 1200px; padding: 0 1.25rem 1rem; box-sizing: border-box; }
        .cl-side { padding: 1.2rem; overflow-y: auto; background: #fff; }
        .widget-card { background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 12px; padding: 1.2rem; margin-bottom: 0.8rem; }
        .widget-title { font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.6rem; }
        .cl-side-row { display: flex; justify-content: space-between; align-items: center; gap: 0.6rem; width: 100%; padding: 0.4rem 0.5rem; margin: 0 -0.5rem; width: calc(100% + 1rem); border: none; background: none; border-radius: 8px; font-family: inherit; text-align: left; cursor: pointer; transition: background-color .15s; box-sizing: border-box; }
        .cl-side-row:hover:not(.static), .cl-side-row.on { background: #eef2f6; }
        .cl-side-row.static { cursor: default; }
        .cl-side-row span { color: #475569; font-size: 0.8rem; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cl-side-row b { font-weight: 700; color: #0f172a; font-size: 0.85rem; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .cl-side-bd { display: inline-flex; align-items: center; gap: 0.35rem; }
        .cl-side-bd .cl-cake { margin-left: 0; }
        .cl-hint { background: #f5f3ff; border: 1px dashed #c4b5fd; border-radius: 12px; padding: 1rem; }
        .cl-hint-t svg { width: 14px; height: 14px; }
        .cl-hint-t { display: flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: #7c3aed; margin-bottom: 0.6rem; }
        .cl-hint b { display: block; font-weight: 700; color: #5b21b6; font-size: 0.85rem; margin-bottom: 0.3rem; }
        .cl-hint p { font-size: 0.75rem; color: #6d28d9; line-height: 1.45; margin: 0; }
        .cl-hint button { margin-top: 0.6rem; border: none; background: none; padding: 0; font-family: inherit; font-size: 0.78rem; font-weight: 700; color: #7c3aed; cursor: pointer; }
        @media (max-width: 1100px) { .cl-grid { grid-template-columns: 1fr; } .cl-side { display: none; } .cl-main { border-right: none; } }
        @media (max-width: 860px) {
          .cl-toolbar { padding: 0.75rem 1rem 0 !important; flex-direction: column; align-items: stretch !important; gap: 0.6rem !important; }
          .cl-search { width: 100% !important; }
          .cl-groups { padding: 0.75rem 1rem 0.25rem !important; }
          .cl-group { flex: 0 0 148px; }
          .cl-context { padding: 0.75rem 1rem 0 !important; }
          .cl-context-actions { width: 100%; flex-wrap: nowrap; }
          .cl-lapse-wrap { flex: 1 1 0; min-width: 0; }
          .cl-lapse { width: 100%; min-width: 0; }
          .cl-remind { white-space: nowrap; flex-shrink: 0; }
          .cl-lapse { font-size: 16px; }
          .cl-search .clean-input { font-size: 16px; padding-top: 0.65rem; padding-bottom: 0.65rem; }
          .cl-actions-top { justify-content: stretch; flex-wrap: nowrap; }
          .cl-actions-top > button { flex: 1 1 0; min-width: 0; padding-left: 0.5rem; padding-right: 0.5rem; white-space: nowrap; }
          .cl-pills { padding: 0.75rem 1rem !important; }
          .category-pill { padding: 0.55rem 1.1rem; }
          .cl-main-inner { padding: 0 1rem 1rem !important; }
          .service-table, .service-table tbody { display: block; }
          .service-table thead { display: none; }
          .service-table tr.service-row { display: grid; grid-template-columns: 1fr auto; column-gap: 0.75rem; row-gap: 0.35rem; align-items: center; padding: 0.8rem 0.9rem; margin-bottom: 0.5rem; border: 1px solid #f1f5f9; border-radius: 14px; }
          .service-table tr.service-row td { display: block; padding: 0 !important; border: none !important; border-radius: 0 !important; background: transparent !important; text-align: left !important; }
          .service-table tr.service-row td:nth-child(1) { grid-column: 1 / -1; }
          .service-table tr.service-row td:nth-child(2) { grid-column: 1; }
          .service-table tr.service-row td:nth-child(3) { grid-column: 2; grid-row: 2; }
          .service-table tr.service-row td:nth-child(3)::before { content: 'Візитів: '; font-weight: 500; color: #94a3b8; font-size: 0.78rem; }
          .service-table tr.service-row td:nth-child(4), .service-table tr.service-row td:nth-child(5) { display: none; }
          .cl-acts { grid-column: 1 / -1 !important; }
          .cl-acts > span { opacity: 1; }
          .cl-acts a, .cl-acts button { width: 40px; height: 40px; }
        }
        .cl-toolbar { padding: 0.8rem 2rem 0; display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
        .cl-search { position: relative; width: 280px; max-width: 100%; }
        .cl-search-ico { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; display: flex; pointer-events: none; }
        .cl-search .clean-input { padding-left: 2.2rem; }
        .cl-pills { display: flex; gap: 8px; overflow-x: auto; padding: 1rem 2rem; border-bottom: 1px solid #f1f5f9; }
        .cl-count { margin-left: 0.35rem; font-size: 0.72rem; opacity: .6; font-variant-numeric: tabular-nums; }
        .cl-who { display: flex; align-items: center; gap: 0.75rem; min-width: 0; }
        .cl-who b { display: block; font-size: 0.9rem; font-weight: 600; color: #0f172a; }
        .cl-who small { display: block; font-size: 0.78rem; color: #94a3b8; margin-top: 1px; }
        .cl-ava { width: 34px; height: 34px; border-radius: 50%; background: #f1f5f9; color: #475569; display: flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 700; flex-shrink: 0; }
        .cl-ava.bad { background: #fef2f2; color: #dc2626; }
        .cl-date { font-size: 0.875rem; color: #334155; }
        .cl-next { display: block; font-size: 0.72rem; color: #059669; font-weight: 600; margin-top: 1px; }
        .cl-pager { padding: 1rem 0; display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: #64748b; }
        .cl-pager div { display: flex; gap: 0.4rem; }
        .cl-empty { text-align: center; padding: 5rem 2rem; color: #64748b; display: flex; flex-direction: column; gap: 0.4rem; }
        .cl-empty b { font-size: 1.05rem; color: #0f172a; }
        .cl-empty span { font-size: 0.9rem; }
        .cl-hist { display: flex; flex-direction: column; }
        .cl-hist-empty { padding: 2rem 0; text-align: center; color: #94a3b8; font-size: 0.9rem; }
        .cl-hist-row { display: grid; grid-template-columns: 10px 1fr auto; gap: 0.8rem; padding: 0.85rem 0; border-top: 1px solid #f1f5f9; align-items: start; }
        .cl-hist-row:first-child { border-top: none; }
        .cl-hist-dot { width: 9px; height: 9px; border-radius: 50%; margin-top: 6px; }
        .cl-hist-top { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
        .cl-hist-top b { font-size: 0.92rem; color: #0f172a; }
        .cl-hist-chip { font-size: 0.68rem; font-weight: 700; padding: 1px 8px; border-radius: 999px; }
        .cl-hist-meta { font-size: 0.8rem; color: #64748b; margin-top: 2px; }
        .cl-hist-review { font-size: 0.8rem; color: #475569; margin-top: 4px; }
        .cl-hist-review span { color: #f59e0b; letter-spacing: 1px; }
        .cl-hist-review i { font-style: normal; color: #e2e8f0; }
        .cl-hist-sum { text-align: right; }
        .cl-hist-sum b { display: block; font-size: 0.9rem; color: #0f172a; font-variant-numeric: tabular-nums; }
        .cl-hist-sum small { display: block; font-size: 0.72rem; color: #059669; font-weight: 600; }
        .cl-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
        .cl-stat { display: flex; flex-direction: column; align-items: flex-start; gap: 0.2rem; padding: 1rem 1.1rem; border-radius: 14px; background: #f8fafc; border: 1px solid #eef2f6; text-align: left; font-family: inherit; min-height: 104px; box-sizing: border-box; }
        .cl-stat-btn { cursor: pointer; transition: background-color .15s, border-color .15s; }
        .cl-stat-btn:hover { background: #f1f5f9; border-color: #e2e8f0; }
        .cl-stat-l { font-size: 0.7rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
        .cl-stat-v { font-size: 1.45rem; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; line-height: 1.2; }
        .cl-stat-s { font-size: 0.75rem; color: #64748b; margin-top: auto; }
        .cl-stat-btn .cl-stat-s { color: #436b49; font-weight: 600; }
        .cl-stat-bar { display: block; width: 100%; height: 4px; border-radius: 2px; background: #e2e8f0; overflow: hidden; margin-top: 0.3rem; }
        .cl-stat-bar em { display: block; height: 100%; background: #10b981; border-radius: 2px; transition: width .6s ease; }
        /* Телефон із префіксом +380 у вікні нового клієнта */
        .cl-phone { display: flex; align-items: stretch; height: 42px; box-sizing: border-box; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; overflow: hidden; transition: border-color .15s, box-shadow .15s; }
        .cl-phone:focus-within { border-color: #0f172a; box-shadow: 0 0 0 3px rgba(15,23,42,.08); }
        .cl-phone b { display: flex; align-items: center; padding: 0 0.75rem; color: #64748b; font-weight: 600; font-size: 0.925rem; background: #f8fafc; border-right: 1px solid #e2e8f0; }
        .cl-phone .fm-input { border: none !important; box-shadow: none !important; border-radius: 0; height: 100% !important; min-width: 0; flex: 1; }
      `}</style>

      {viewingClient ? (
        <div className="page-transition custom-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%', maxWidth: '1180px', alignSelf: 'center', padding: '2rem 3rem', boxSizing: 'border-box', overflowY: 'auto', height: '100%' }}>

           {/* Навігація */}
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={closeViewingClient} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', fontWeight: '600', padding: 0 }}>
                 ← Назад до списку
              </button>

              <div style={{ display: 'flex', gap: '0.6rem' }}>
                 <button onClick={() => setConfirmDialog({ isOpen: true, title: 'Видалити клієнта?', text: 'Усі дані та історія візитів будуть видалені назавжди.', onConfirm: () => executeDeleteClient(viewingClient.id) })} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', padding: '0 1rem' }}>
                    Видалити
                 </button>
                 <button onClick={handleSaveData} className="light-btn-sec">
                    Зберегти зміни
                 </button>
                 <button onClick={() => onBookAgain(viewingClient)} className="light-btn">
                    <Icons.Calendar /> Записати на візит
                 </button>
              </div>
           </div>

           {/* Шапка профілю з Quick Actions */}
           <div style={{ background: '#fff', padding: '1.5rem 2rem', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                 <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: viewingClient.is_blacklisted ? '#fee2e2' : '#f1f5f9', color: viewingClient.is_blacklisted ? '#ef4444' : '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '1.6rem', position: 'relative' }}>
                    {viewingClient.is_blacklisted ? <Icons.XCircle /> : getUserInitials(viewingClient.name)}
                    {loyaltyProgress === 1 && (
                      <div style={{ position: 'absolute', bottom: '-4px', right: '-4px', background: '#fbbf24', color: '#fff', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>⭐</div>
                    )}
                 </div>

                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                       <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                          {viewingClient.name} {isBirthdaySoon(viewingClient.birthday) && <span className="cl-cake" title="Скоро день народження"><Icons.Cake size={15} /></span>}
                       </h1>
                       <div style={{ display: 'flex', gap: '0.3rem' }}>
                         {viewingClient.tags?.map((tag: string, idx: number) => (
                           <span key={idx} className={`tag-pill ${getBadgeClass(tag)}`} onClick={() => handleRemoveTag(tag)} style={{ cursor: 'pointer' }}>{tag} ✕</span>
                         ))}
                       </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.3rem' }}>
                       {viewingClient.phone && (
                         <>
                           <button className="action-circle-btn" title="Подзвонити" onClick={() => window.location.href = `tel:${viewingClient.phone}`}><Icons.Phone /></button>
                           <button className="action-circle-btn" title="SMS / Viber" onClick={() => window.location.href = `sms:${viewingClient.phone}`}><Icons.Chat /></button>
                           <button className="action-circle-btn tg" title="Telegram" onClick={() => window.open(`https://t.me/${viewingClient.phone.replace('+','')}`, '_blank')}><Icons.Telegram /></button>
                         </>
                       )}
                       {viewingClient.instagram && (
                          <button className="action-circle-btn insta" title="Instagram" onClick={() => window.open(`https://instagram.com/${viewingClient.instagram.replace('@', '')}`, '_blank')}><Icons.Instagram /></button>
                       )}
                    </div>
                 </div>
              </div>

              <div style={{ background: '#f1f5f9', padding: '4px', borderRadius: '12px', display: 'flex', gap: '2px' }}>
                 <button className={`seg-tab ${activeCardTab === 'info' ? 'active' : ''}`} onClick={() => setActiveCardTab('info')}>Головна</button>
                 <button className={`seg-tab ${activeCardTab === 'medical' ? 'active' : ''}`} onClick={() => setActiveCardTab('medical')}>Медична картка</button>
                 <button className={`seg-tab ${activeCardTab === 'timeline' ? 'active' : ''}`} onClick={() => setActiveCardTab('timeline')}>Історія візитів</button>
                 <button className={`seg-tab ${activeCardTab === 'gallery' ? 'active' : ''}`} onClick={() => setActiveCardTab('gallery')}>Галерея</button>
              </div>
           </div>

           {activeCardTab === 'info' && isClientLost && (
             <div className="smart-badge">
               <div style={{ fontSize: '1.8rem' }}>💡</div>
               <div>
                 <div style={{ fontWeight: '700', color: '#3730a3', fontSize: '0.95rem' }}>Клієнт давно не був</div>
                 <div style={{ color: '#4338ca', fontSize: '0.85rem', marginTop: '0.2rem' }}>Минуло більше 30 днів з останнього візиту. Зателефонуйте або нагадайте про себе листом: група «Не були місяць» у списку клієнтів.</div>
               </div>
               {viewingClient?.phone && <a className="light-btn" style={{ marginLeft: 'auto', background: '#4f46e5', textDecoration: 'none' }} href={`tel:${String(viewingClient.phone).replace(/[^\d+]/g, '')}`}>Зателефонувати</a>}
             </div>
           )}

           {activeCardTab === 'info' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1.5rem' }}>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                       <div style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '1.2rem' }}>Контакти</div>

                       <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.9rem', color: '#0f172a', fontWeight: '500', marginBottom: '1.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                             <span style={{ color: '#94a3b8' }}><Icons.Phone /></span>
                             {viewingClient.phone || 'Не вказано'}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                             <span style={{ color: '#94a3b8' }}><Icons.Mail /></span>
                             {viewingClient.email || 'Не вказано'}
                          </div>

                          {/* Інтерактивне поле Instagram */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                             <span style={{ color: '#94a3b8' }}><Icons.Instagram /></span>
                             <span style={{ color: '#94a3b8' }}>@</span>
                             <input
                                type="text"
                                value={editingInstagram}
                                onChange={e => setEditingInstagram(e.target.value)}
                                placeholder="додати нікнейм"
                                style={{ border: 'none', borderBottom: '1px dashed #cbd5e1', background: 'transparent', outline: 'none', color: '#0f172a', fontWeight: '500', width: '100%' }}
                             />
                          </div>

                          {/* Інтерактивне поле День народження */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                             <span style={{ color: '#94a3b8', display: 'flex' }}><Icons.Cake size={18} /></span>
                             <BirthdayInput value={editingBirthday || ''} onChange={v => setEditingBirthday(v)}
                                style={{ border: 'none', borderBottom: '1px dashed #cbd5e1', background: 'transparent', outline: 'none', color: '#0f172a', fontWeight: '500', width: '100%', fontFamily: 'inherit', padding: '2px 0' }} />
                          </div>
                       </div>

                       <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.2rem' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '0.8rem' }}>Сім'я / Зв'язки</div>

                          {viewingClient.linked_client_ids && viewingClient.linked_client_ids.length > 0 && (
                             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                                {viewingClient.linked_client_ids.map((id: string) => {
                                   const linked = clientsList.find((c: any) => c.id === id);
                                   if (!linked) return null;
                                   return (
                                      <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                         <span onClick={() => openViewingClient(linked)} style={{ cursor: 'pointer', color: '#0f172a', fontWeight: '600', fontSize: '0.85rem' }}>
                                            {linked.name}
                                         </span>
                                         <button onClick={() => handleUnlinkClient(id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }} title="Розірвати зв'язок">
                                            <Icons.TrashSmall />
                                         </button>
                                      </div>
                                   );
                                })}
                             </div>
                          )}

                          <button className="light-btn-sec" style={{ width: '100%' }} onClick={() => setIsFamilyModalOpen(true)}>
                             + Додати члена сім'ї
                          </button>
                       </div>
                    </div>

                    {/* Три однакові блоки: підпис, число, пояснення. Раніше «Візити» були
                        зверстані інакше, ніж «LTV» і «Депозит», тож не вирівнювались, а білі
                        плашки зливались із білим тлом. */}
                    <div className="cl-stats">
                      <div className="cl-stat">
                        <span className="cl-stat-l">Візити</span>
                        <b className="cl-stat-v">{viewingClient.visits_count || 0}</b>
                        <span className="cl-stat-s">
                          {(viewingClient.visits_count || 0) >= loyaltyTarget ? 'VIP-клієнт' : `ще ${loyaltyTarget - (viewingClient.visits_count || 0)} до VIP`}
                        </span>
                        <i className="cl-stat-bar"><em style={{ width: `${Math.round(loyaltyProgress * 100)}%` }} /></i>
                      </div>
                      <div className="cl-stat">
                        <span className="cl-stat-l">Витратили</span>
                        <b className="cl-stat-v">{Math.round(viewingClient.total_spent || 0).toLocaleString('uk-UA')} ₴</b>
                        <span className="cl-stat-s">
                          {(viewingClient.visits_count || 0) > 0 ? `у середньому ${Math.round((viewingClient.total_spent || 0) / viewingClient.visits_count).toLocaleString('uk-UA')} ₴ за візит` : 'ще не було візитів'}
                        </span>
                      </div>
                      <button type="button" className="cl-stat cl-stat-btn" onClick={() => setIsBalanceModalOpen(true)} title="Поповнити чи списати депозит">
                        <span className="cl-stat-l">Депозит</span>
                        <b className="cl-stat-v" style={{ color: (viewingClient.balance || 0) < 0 ? '#dc2626' : (viewingClient.balance || 0) > 0 ? '#059669' : '#0f172a' }}>{viewingClient.balance || 0} ₴</b>
                        <span className="cl-stat-s">Змінити →</span>
                      </button>
                    </div>

                    <div style={{ background: viewingClient.is_blacklisted ? '#fff5f5' : '#fff', padding: '1.2rem 1.5rem', borderRadius: '16px', border: '1px solid', borderColor: viewingClient.is_blacklisted ? '#feb2b2' : '#e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: '700', color: viewingClient.is_blacklisted ? '#b91c1c' : '#0f172a' }}>Чорний список</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Заблокувати онлайн-запис</div>
                       </div>
                       <div onClick={handleToggleBlacklist} className={`apple-switch ${viewingClient.is_blacklisted ? 'on' : ''}`} style={{ background: viewingClient.is_blacklisted ? '#ef4444' : '#cbd5e1' }}>
                          <div className="apple-switch-knob"></div>
                       </div>
                    </div>
                 </div>

                 <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em' }}>Особисті нотатки</div>
                       </div>
                       <textarea
                          value={editingClientNotes}
                          onChange={e => setEditingClientNotes(e.target.value)}
                          placeholder="Наприклад: любить каву з молоком, завжди запізнюється..."
                          className="light-input custom-scroll"
                          style={{ flex: 1, minHeight: '140px', resize: 'none' }}
                       />
                       {editingClientAllergies && (
                         <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.8rem 1rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '600', display: 'flex', gap: '0.5rem' }}>
                            <Icons.AlertCircle /> Увага: {editingClientAllergies}
                         </div>
                       )}
                    </div>
                 </div>

              </div>
           )}

           {activeCardTab === 'medical' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem' }}>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="allergy-alert-box" style={{ flexDirection: 'column' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#ef4444', marginBottom: '0.8rem' }}>
                          <Icons.AlertCircle /> <span style={{ fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Алергії та протипоказання</span>
                       </div>
                       <input type="text" value={editingClientAllergies} onChange={e => setEditingClientAllergies(e.target.value)} placeholder="Наприклад: алергія на латекс..." style={{ width: '100%', background: 'rgba(255,255,255,0.5)', border: '1px solid #feb2b2', borderRadius: '8px', padding: '0.8rem', fontSize: '0.9rem', color: '#7f1d1d', outline: 'none', fontWeight: '600' }} />
                    </div>

                    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
                       <div style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em' }}>Схеми, Формули (Конфіденційно)</div>
                       <textarea
                          value={editingFormulas}
                          onChange={e => setEditingFormulas(e.target.value)}
                          placeholder="Наприклад: Фарбування коріння 5.0 + 6%..."
                          className="light-input custom-scroll"
                          style={{ flex: 1, minHeight: '200px', resize: 'none', background: '#f8fafc', border: '1px solid #cbd5e1' }}
                       />
                    </div>
                 </div>

                 <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                       <div style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '1.5rem' }}>Згоди (Privacy)</div>

                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9', marginBottom: '1rem' }}>
                          <div>
                             <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0f172a' }}>Згода на фото/відео</div>
                             <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>Для публікації в соцмережах</div>
                          </div>
                          <div onClick={() => setConsents({...consents, photo: !consents.photo})} className={`apple-switch ${consents.photo ? 'on' : ''}`}>
                             <div className="apple-switch-knob"></div>
                          </div>
                       </div>

                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9', marginBottom: '1rem' }}>
                          <div>
                             <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0f172a' }}>Медична згода</div>
                             <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>Згода на проведення процедур</div>
                          </div>
                          <div onClick={() => setConsents({...consents, procedure: !consents.procedure})} className={`apple-switch ${consents.procedure ? 'on' : ''}`}>
                             <div className="apple-switch-knob"></div>
                          </div>
                       </div>

                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                             <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0f172a' }}>Розсилки на пошту</div>
                             <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>Новини й пропозиції закладу</div>
                          </div>
                          <div onClick={() => setConsents({...consents, marketing: !consents.marketing})} className={`apple-switch ${consents.marketing ? 'on' : ''}`}>
                             <div className="apple-switch-knob"></div>
                          </div>
                       </div>

                       <div style={{ marginTop: '1.5rem' }}>
                          <input type="file" accept="application/pdf" hidden ref={pdfInputRef} onChange={handlePDFUpload} />

                          {viewingClient.medical_pdf_url ? (
                             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f1f5f9', padding: '0.6rem 1rem', borderRadius: '10px' }}>
                                <a href={viewingClient.medical_pdf_url} target="_blank" rel="noreferrer" style={{ color: '#6F9273', fontSize: '0.85rem', fontWeight: '600', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                   <Icons.Paperclip /> Переглянути PDF
                                </a>
                                <button onClick={handleRemovePDF} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }} title="Видалити файл"><Icons.TrashSmall /></button>
                             </div>
                          ) : (
                             <button className="light-btn-sec" style={{ width: '100%' }} onClick={() => pdfInputRef.current?.click()} disabled={isUploadingPDF}>
                                {isUploadingPDF ? 'Завантаження...' : <><Icons.Paperclip /> Прикріпити підписаний PDF</>}
                             </button>
                          )}
                       </div>

                    </div>
                 </div>
              </div>
           )}

           {/* Справжня історія з сервера. Раніше тут була заготовка «Візит успішно
               завершено. Послуга виконана. Оплачено» без жодних даних. */}
           {activeCardTab === 'timeline' && (
             <div className="cl-hist">
               {history === null ? (
                 <div className="cl-hist-empty">Завантаження…</div>
               ) : history.length === 0 ? (
                 <div className="cl-hist-empty">Візитів ще не було.</div>
               ) : history.map(h => {
                 const st = ({
                   completed: ['Завершено', '#059669', '#ecfdf5'], confirmed: ['Заплановано', '#2563eb', '#eff6ff'],
                   pending_approval: ['Чекає підтвердження', '#b45309', '#fffbeb'], 'no-show': ['Не прийшов', '#dc2626', '#fef2f2'],
                   cancelled: ['Скасовано', '#64748b', '#f1f5f9'], late: ['Запізнився', '#b45309', '#fffbeb'],
                 } as Record<string, string[]>)[h.status] || [h.status, '#64748b', '#f1f5f9'];
                 return (
                   <div key={h.id} className="cl-hist-row">
                     <span className="cl-hist-dot" style={{ background: st[1] }} />
                     <div className="cl-hist-main">
                       <div className="cl-hist-top">
                         <b>{h.service || 'Візит'}</b>
                         <span className="cl-hist-chip" style={{ color: st[1], background: st[2] }}>{st[0]}</span>
                       </div>
                       <div className="cl-hist-meta">
                         {new Date(h.start_time).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })}, {new Date(h.start_time).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                         {h.master ? ` · ${h.master}` : ''}
                       </div>
                       {h.rating ? <div className="cl-hist-review"><span>{'★'.repeat(h.rating)}<i>{'★'.repeat(5 - h.rating)}</i></span>{h.comment ? ` «${h.comment}»` : ''}</div> : null}
                     </div>
                     <div className="cl-hist-sum">
                       {h.price != null && <b>{Math.round(h.price).toLocaleString('uk-UA')} ₴</b>}
                       {h.tip ? <small>+ {Math.round(h.tip)} ₴ чайові</small> : null}
                     </div>
                   </div>
                 );
               })}
             </div>
           )}


           {activeCardTab === 'gallery' && (
              <div style={{ background: '#fff', padding: '2rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                       <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>Фото робіт</h3>
                       <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.2rem', marginBottom: 0 }}>Зберігайте результати "До/Після".</p>
                    </div>

                    <input type="file" accept="image/*" multiple hidden ref={fileInputRef} onChange={(e) => showToast("Демо завантаження фото", "info")} />
                    <button onClick={() => fileInputRef.current?.click()} className="light-btn-sec">
                       + Завантажити фото
                    </button>
                 </div>

                 <div className="gallery-grid">
                    <div className="gallery-placeholder" onClick={() => fileInputRef.current?.click()}>
                       <div style={{ fontSize: '1.5rem' }}>+</div>
                       <div style={{ fontSize: '0.75rem', fontWeight: '600' }}>Додати</div>
                    </div>
                 </div>
              </div>
           )}

        </div>
      ) : (
        <div className="page-transition" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
           {/* Панель - як у «Послугах»: пошук ліворуч, дія праворуч */}
           <div className="cl-toolbar">
              <div className="cl-search">
                 <span className="cl-search-ico"><Icons.Search /></span>
                 <input type="text" className="clean-input" value={clientSearch} onChange={e => setClientSearch(e.target.value)} placeholder="Імʼя чи телефон…" />
              </div>
              <div className="cl-actions-top">
                 {canManageBase && dupCount > 0 && (
                   <button type="button" className="clean-btn-ghost cl-dup" onClick={() => setIsDupOpen(true)} title="Картки з тим самим номером чи поштою">
                     <Icons.Duplicates /> Дублі <span>{dupCount}</span>
                   </button>
                 )}
                 {canManageBase && (
                   <>
                     <button type="button" className="clean-btn-ghost" onClick={() => setIsImportOpen(true)} title="Додати клієнтів з Excel чи CSV"><Icons.Import /> Імпорт</button>
                     <button type="button" className="clean-btn-ghost" disabled={isExporting} onClick={() => void handleExport()} title="Уся база в Excel">
                       <Icons.Export /> {isExporting ? 'Готуємо…' : 'Експорт'}
                     </button>
                   </>
                 )}
                 <button type="button" onClick={() => setIsAddClientModalOpen(true)} className="clean-btn"><Icons.Plus /> Додати</button>
              </div>
           </div>

           {/* Сегменти - із лічильниками, щоб одразу було видно, скільки кого */}
           {/* Групи: картки з числом і поясненням - одразу видно, кого скільки й що це означає */}
           <div className="cl-groups hide-scrollbar">
              {[
                { id: 'all', label: 'Усі клієнти', short: 'Уся база закладу', tone: '#0f172a' },
                ...GROUPS,
                ...(segmentCounts.vip > 0 || activeSegment === 'vip' ? [{ id: 'vip', label: 'VIP', short: 'З тегом VIP', tone: '#8b5cf6' }] : []),
                ...(segmentCounts.blacklist > 0 || activeSegment === 'blacklist' ? [{ id: 'blacklist', label: 'Чорний список', short: 'Без онлайн-запису', tone: '#64748b' }] : []),
              ].map(g => {
                const on = activeSegment === g.id && lapseDays === 0;
                return (
                  <button key={g.id} type="button" className={`cl-group ${on ? 'on' : ''}`} onClick={() => { setActiveSegment(g.id); setLapseDays(0); }}>
                    <span className="cl-group-n">{segmentCounts[g.id] || 0}</span>
                    <span className="cl-group-t"><i style={{ background: g.tone }} />{g.label}</span>
                    <span className="cl-group-s">{g.short}</span>
                  </button>
                );
              })}
           </div>

           {/* Що зараз показано й що з цим можна зробити */}
           <div className="cl-context">
              <div className="cl-context-text">
                <b>{lapseDays > 0 ? `Не були понад ${({ 30: 'місяць', 60: '2 місяці', 90: '3 місяці', 180: 'пів року', 365: 'рік' } as Record<number, string>)[lapseDays] || `${lapseDays} днів`}` : (activeGroup?.label || (activeSegment === 'vip' ? 'VIP' : activeSegment === 'blacklist' ? 'Чорний список' : 'Усі клієнти'))}</b>
                <span>{filteredAndSortedClients.length} {(() => { const n = filteredAndSortedClients.length; return n % 10 === 1 && n % 100 !== 11 ? 'клієнт' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'клієнти' : 'клієнтів'; })()}{lapseDays > 0 ? ' · без візиту й без запису наперед' : activeGroup ? ` · ${activeGroup.hint}` : ' · оберіть групу вище або знайдіть тих, хто давно не був'}</span>
              </div>
              <div className="cl-context-actions">
                 <label className="cl-lapse-wrap">
                    <select className="clean-input cl-lapse" value={lapseDays} onChange={e => { const v = Number(e.target.value); setLapseDays(v); if (v > 0) setActiveSegment('all'); }} aria-label="Не були давно">
                       <option value={0}>Не були понад…</option>
                       <option value={30}>Не були понад місяць</option>
                       <option value={60}>Не були понад 2 місяці</option>
                       <option value={90}>Не були понад 3 місяці</option>
                       <option value={180}>Не були понад пів року</option>
                       <option value={365}>Не були понад рік</option>
                    </select>
                 </label>
                 {onRemind && (lapseDays > 0 || !!activeGroup?.remind) && filteredAndSortedClients.length > 0 && (
                   <button type="button" className="clean-btn cl-remind" onClick={() => onRemind(lapseDays > 0 ? `away_${lapseDays}` : activeSegment)} title="Відкрити розсилку з цією групою">
                     Нагадати листом
                   </button>
                 )}
              </div>
           </div>

           <div className="cl-grid">
             <div className="custom-scroll cl-main">
               <div className="cl-main-inner">
              {(() => {
                const indexOfLastClient = clientCurrentPage * clientsPerPage;
                const indexOfFirstClient = indexOfLastClient - clientsPerPage;
                const currentClients = filteredAndSortedClients.slice(indexOfFirstClient, indexOfLastClient);
                const totalClientPages = Math.ceil(filteredAndSortedClients.length / clientsPerPage);
                const fmtDate = (d: string) => new Date(d).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });

                return currentClients.length > 0 ? (
                  <>
                    <table className="service-table">
                      <thead>
                        <tr>
                          <th className="sortable" onClick={() => handleSortClick('name')}>Клієнт <SortIcon columnKey="name" /></th>
                          <th className="sortable" onClick={() => handleSortClick('recent')}>Останній візит <SortIcon columnKey="recent" /></th>
                          <th className="sortable" onClick={() => handleSortClick('visits')} style={{ textAlign: 'right' }}>Візити <SortIcon columnKey="visits" /></th>
                          <th className="sortable" onClick={() => handleSortClick('spent')} style={{ textAlign: 'right' }}>Витратили <SortIcon columnKey="spent" /></th>
                          <th className="sortable" onClick={() => handleSortClick('balance')} style={{ textAlign: 'right' }}>Депозит <SortIcon columnKey="balance" /></th>
                          <th aria-label="Дії" style={{ width: 1 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {currentClients.map((client: any) => (
                          <tr key={client.id} className="service-row" onClick={() => openViewingClient(client)} style={{ opacity: client.is_blacklisted ? 0.55 : 1 }}>
                            <td>
                              <div className="cl-who">
                                <span className={`cl-ava ${client.is_blacklisted ? 'bad' : ''}`}>{client.is_blacklisted ? '✕' : getUserInitials(client.name)}</span>
                                <span>
                                  <b>{client.name}{isBirthdaySoon(client.birthday) && <span className="cl-cake" title="Скоро день народження"><Icons.Cake size={15} /></span>}</b>
                                  <small>{client.phone || client.email || 'без контактів'}</small>
                                </span>
                              </div>
                            </td>
                            <td>
                              <span className="cl-date">{client.last_visit_at ? fmtDate(client.last_visit_at) : '—'}</span>
                              {client.next_visit_at && <small className="cl-next">наступний {fmtDate(client.next_visit_at)}</small>}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{client.visits_count || 0}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{Math.round(client.total_spent || 0).toLocaleString('uk-UA')} ₴</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: (client.balance || 0) > 0 ? '#059669' : (client.balance || 0) < 0 ? '#dc2626' : '#94a3b8' }}>{client.balance || 0} ₴</td>
                            {/* Швидкі дії без відкриття картки; натиск на них картку не відкриває */}
                            <td className="cl-acts" onClick={e => e.stopPropagation()}>
                              <span>
                                {client.phone && <a href={`tel:${client.phone}`} title={`Подзвонити ${client.phone}`} aria-label="Подзвонити"><Icons.Phone /></a>}
                                {client.phone && <a href={`sms:${client.phone}`} title="Написати SMS" aria-label="Написати"><Icons.Chat /></a>}
                                {!client.is_blacklisted && onBookAgain && (
                                  <button type="button" title="Записати" aria-label="Записати" onClick={() => onBookAgain(client)}><Icons.Calendar /></button>
                                )}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {totalClientPages > 1 && (
                      <div className="cl-pager">
                        <span>Сторінка {clientCurrentPage} з {totalClientPages}</span>
                        <div>
                          <button type="button" className="clean-btn-ghost" onClick={() => setClientCurrentPage(prev => Math.max(prev - 1, 1))} disabled={clientCurrentPage === 1}>Назад</button>
                          <button type="button" className="clean-btn-ghost" onClick={() => setClientCurrentPage(prev => Math.min(prev + 1, totalClientPages))} disabled={clientCurrentPage === totalClientPages}>Далі</button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="cl-empty">
                    <b>{clientsList.length === 0 ? 'Клієнтів ще немає' : 'Нікого не знайдено'}</b>
                    <span>{clientsList.length === 0 ? 'Вони зʼявляться тут після першого запису - або додайте вручну.' : 'Змініть запит або оберіть інший сегмент.'}</span>
                  </div>
                );
              })()}
               </div>
             </div>

             {/* Бічна колонка - як у «Послугах»: стан бази, гроші, дні народження, підказка */}
             <aside className="custom-scroll cl-side">
               <div className="widget-card">
                 <div className="widget-title">Гроші</div>
                 <div className="cl-side-row static"><span>Витратили разом</span><b>{Math.round(sideStats.spent).toLocaleString('uk-UA')} ₴</b></div>
                 <div className="cl-side-row static"><span>Середній чек</span><b>{sideStats.avgCheck ? `${Math.round(sideStats.avgCheck).toLocaleString('uk-UA')} ₴` : '—'}</b></div>
                 <div className="cl-side-row static"><span>Депозити клієнтів</span><b style={{ color: sideStats.deposits > 0 ? '#10b981' : '#0f172a' }}>{Math.round(sideStats.deposits).toLocaleString('uk-UA')} ₴</b></div>
               </div>

               {sideStats.birthdays.length > 0 && (
                 <div className="widget-card">
                   <div className="widget-title">Дні народження тиждень</div>
                   {sideStats.birthdays.slice(0, 6).map((b: any) => (
                     <button key={b.client.id} type="button" className="cl-side-row" onClick={() => openViewingClient(b.client)}>
                       <span className="cl-side-bd"><span className="cl-cake"><Icons.Cake size={14} /></span>{b.client.name}</span>
                       <b>{b.label}</b>
                     </button>
                   ))}
                 </div>
               )}

               <div className="cl-hint">
                 <div className="cl-hint-t"><Icons.Sparkles /> Підказка</div>
                 <b>{sideHint.title}</b>
                 <p>{sideHint.text}</p>
                 {sideHint.action && <button type="button" onClick={sideHint.action.run}>{sideHint.action.label} →</button>}
               </div>
             </aside>
           </div>
        </div>

      )}

      {/* МОДАЛКА БАЛАНСУ */}
      {isBalanceModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setIsBalanceModalOpen(false)}>
           <div className="toast-animate" onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px', padding: '2rem', width: '100%', maxWidth: '360px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                 <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>Керування депозитом <HelpTip>Передоплата саме цього клієнта: наприклад, вимагати її завжди, якщо він уже не приходив.</HelpTip></h3>
                 <button onClick={() => setIsBalanceModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
              </div>

              <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '1rem', textAlign: 'center', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
                 <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Поточний баланс</div>
                 <div style={{ fontSize: '1.8rem', fontWeight: '800', color: (viewingClient?.balance || 0) < 0 ? '#ef4444' : '#6F9273', marginTop: '0.2rem' }}>{viewingClient?.balance || 0} ₴</div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
                 <button onClick={() => setBalanceOperation('add')} className={`seg-tab ${balanceOperation === 'add' ? 'active' : ''}`} style={{ flex: 1 }}>Поповнити</button>
                 <button onClick={() => setBalanceOperation('subtract')} className={`seg-tab ${balanceOperation === 'subtract' ? 'active' : ''}`} style={{ flex: 1 }}>Списати</button>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                 <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '0.4rem' }}>Сума (₴)</label>
                 <input data-field="balance-amount" type="number" value={balanceAmount} onChange={e => setBalanceAmount(e.target.value)} className="light-input" placeholder="Наприклад: 500" style={{ fontSize: '1.1rem', padding: '0.8rem 1rem' }} autoFocus />
              </div>

              <button onClick={handleUpdateBalance} className="light-btn" style={{ width: '100%', padding: '0.8rem', fontSize: '0.95rem' }}>Підтвердити</button>
           </div>
        </div>
      )}

      {/* МОДАЛКА ПОШУКУ ТА ДОДАВАННЯ ДО СІМ'Ї */}
      {isFamilyModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setIsFamilyModalOpen(false)}>
           <div className="toast-animate" onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px', padding: '2rem', width: '100%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                 <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>Пошук клієнта</h3>
                 <button onClick={() => setIsFamilyModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
              </div>

              <input type="text" value={familySearch} onChange={e => setFamilySearch(e.target.value)} className="light-input" placeholder="Введіть ім'я..." style={{ marginBottom: '1rem' }} autoFocus />

              <div className="custom-scroll" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                 {clientsList.filter((c: any) =>
                     c.id !== viewingClient.id && // Не показувати себе
                     !(viewingClient.linked_client_ids || []).includes(c.id) && // Не показувати вже доданих
                     String(c?.name ?? '').toLowerCase().includes(String(familySearch ?? '').toLowerCase())
                 ).map((c: any) => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem', borderBottom: '1px solid #f1f5f9' }}>
                       <span style={{ fontWeight: '600', color: '#0f172a' }}>{c.name}</span>
                       <button className="light-btn-sec" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }} onClick={() => handleLinkClient(c.id)}>
                          Додати
                       </button>
                    </div>
                 ))}
                 {clientsList.filter((c: any) => c.id !== viewingClient.id && !(viewingClient.linked_client_ids || []).includes(c.id) && String(c?.name ?? '').toLowerCase().includes(String(familySearch ?? '').toLowerCase())).length === 0 && (
                     <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.9rem' }}>Нікого не знайдено</div>
                 )}
              </div>
           </div>
        </div>
      )}

      {business?.id && (
        <>
          <ClientImportModal open={isImportOpen} onClose={() => setIsImportOpen(false)} businessId={Number(business.id)}
            onDone={() => { fetchClientsFromDB?.(); void refreshDuplicates(); }} />
          <ClientDuplicatesModal open={isDupOpen} onClose={() => setIsDupOpen(false)} businessId={Number(business.id)}
            onChanged={() => { fetchClientsFromDB?.(); void refreshDuplicates(); }} />
        </>
      )}
      {/* Новий клієнт - той самий шаблон вікна, що в «Послугах» (FormModal):
          поля з рамкою, тож і червоне підсвічування помилки справді видно. */}
      <FormModal
        open={isAddClientModalOpen}
        onClose={() => setIsAddClientModalOpen(false)}
        title="Новий клієнт"
        subtitle="Візити з цим номером телефону підтягнуться в картку самі"
        primary={{ label: 'Додати клієнта', onClick: () => void handleSaveNewClient(), loading: isSavingClient }}
        width={520}
      >
        <FormSection>
          <Field label="Пошта" hint={lookupNote || 'Якщо в людини є акаунт BookEra, дані підтягнуться самі'}>
            <input className="fm-input" data-field="client-email" type="email" inputMode="email" autoFocus placeholder="maria@example.com"
              value={newClientForm.email} onChange={e => setNewClientForm({ ...newClientForm, email: e.target.value })} />
          </Field>
          <Field label="Імʼя та прізвище" required>
            <input className="fm-input" data-field="client-name" maxLength={80} placeholder="Марія Коваль"
              value={newClientForm.name} onChange={e => setNewClientForm({ ...newClientForm, name: e.target.value })} />
          </Field>
          <div className="fm-row">
            <Field label="Телефон">
              <span className="cl-phone" data-error-anchor>
                <b>+380</b>
                <input className="fm-input" data-field="client-phone" inputMode="numeric" placeholder="67 123 45 67"
                  value={phoneDigits(newClientForm.phone).replace(/(\d{2})(\d{0,3})(\d{0,2})(\d{0,2})/, (_m, a, b, c2, d) => [a, b, c2, d].filter(Boolean).join(' '))}
                  onChange={e => setNewClientForm({ ...newClientForm, phone: '+380' + phoneDigits(e.target.value) })} />
              </span>
            </Field>
            <Field label="День народження">
              <BirthdayInput className="fm-input" dataField="client-birthday" value={newClientForm.birthday}
          onChange={v => setNewClientForm({ ...newClientForm, birthday: v })} />
            </Field>
          </div>
          <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', marginTop: '0.9rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={newClientForm.marketing} onChange={e => setNewClientForm({ ...newClientForm, marketing: e.target.checked })}
              style={{ width: 18, height: 18, marginTop: 2, accentColor: '#222', flexShrink: 0 }} />
            <span style={{ fontSize: '0.82rem', lineHeight: 1.45, color: '#64748b' }}>Клієнт погодився отримувати розсилки на пошту</span>
          </label>
        </FormSection>
      </FormModal>


      {confirmDialog && (
         <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15,23,42,0.3)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }} onClick={() => setConfirmDialog(null)}>
            <div className="toast-animate" onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', maxWidth: '340px', textAlign: 'center', padding: '2rem', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
               <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.5rem 0' }}>{confirmDialog.title}</h3>
               <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: '1.4', marginBottom: '1.5rem' }}>{confirmDialog.text}</p>
               <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <button onClick={() => setConfirmDialog(null)} className="light-btn-sec" style={{ flex: 1 }}>Скасувати</button>
                  <button onClick={confirmDialog.onConfirm} className="light-btn" style={{ flex: 1, background: '#ef4444', justifyContent: 'center' }}>Видалити</button>
               </div>
            </div>
         </div>
      )}

    </div>
  );
}