'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Icons } from '@/components/shared';

export default function ClientsTab({ business, clientsList, setClientsList, fetchClientsFromDB, onBookAgain }: any) {
  const supabase = createClient();

  // --- СТАНИ ---
  const [viewingClient, setViewingClient] = useState<any>(null);
  const [activeCardTab, setActiveCardTab] = useState<'info' | 'medical' | 'timeline' | 'gallery'>('info');

  const [clientSearch, setClientSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeSegment, setActiveSegment] = useState<'all' | 'new' | 'vip' | 'lost'>('all');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'recent', direction: 'desc' });

  // Дані для редагування
  const [editingClientNotes, setEditingClientNotes] = useState('');
  const [editingClientAllergies, setEditingClientAllergies] = useState('');
  const [editingFormulas, setEditingFormulas] = useState('');
  const [consents, setConsents] = useState({ photo: false, procedure: false });

  // НОВЕ: Стани для редагування контактів прямо з картки
  const [editingInstagram, setEditingInstagram] = useState('');
  const [editingBirthday, setEditingBirthday] = useState('');

  const [isAddingTagInfo, setIsAddingTagInfo] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  const [clientCurrentPage, setClientCurrentPage] = useState(1);
  const clientsPerPage = 12;

  // Модалки
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ name: '', phone: '+380', email: '', birthday: '' });

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
  const [toast, setToast] = useState<{ show: boolean, msg: string, type: 'success' | 'error' | 'info' }>({ show: false, msg: '', type: 'success' });
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, title: string, text: string, onConfirm: () => void } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3500);
  };

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

  const filteredAndSortedClients = useMemo(() => {
    let filtered = clientsList.filter((c: any) => {
      const searchLower = debouncedSearch.toLowerCase();
      return (c.name || '').toLowerCase().includes(searchLower) || (c.phone || '').includes(debouncedSearch);
    });

    if (activeSegment === 'new') {
        const thisMonth = new Date().getMonth();
        filtered = filtered.filter((c: any) => c.last_visit && new Date(c.last_visit).getMonth() === thisMonth);
    } else if (activeSegment === 'vip') {
        filtered = filtered.filter((c: any) => c.tags?.some((t: string) => t.toLowerCase().includes('vip')));
    } else if (activeSegment === 'lost') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        filtered = filtered.filter((c: any) => !c.last_visit || new Date(c.last_visit) < thirtyDaysAgo);
    }

    return filtered.sort((a: any, b: any) => {
      const { key, direction } = sortConfig;
      const modifier = direction === 'asc' ? 1 : -1;
      if (key === 'name') return modifier * (a.name || '').localeCompare(b.name || '');
      if (key === 'recent') return modifier * (new Date(a.last_visit || 0).getTime() - new Date(b.last_visit || 0).getTime());
      if (key === 'visits') return modifier * ((a.visits || 0) - (b.visits || 0));
      if (key === 'spent') return modifier * ((a.spent || 0) - (b.spent || 0));
      if (key === 'balance') return modifier * ((a.balance || 0) - (b.balance || 0));
      return 0;
    });
  }, [clientsList, debouncedSearch, sortConfig, activeSegment]);

  useEffect(() => { setClientCurrentPage(1); }, [debouncedSearch, sortConfig, activeSegment]);

  const handleSaveNewClient = async () => {
    if (!newClientForm.name.trim()) return showToast("Введіть ім'я клієнта!", 'error');
    let finalPhone = '';

    if (newClientForm.phone && newClientForm.phone !== '+380') {
      const phoneStripped = newClientForm.phone.replace(/\D/g, '');
      if (phoneStripped.length !== 12) return showToast("Некоректний номер телефону!", 'error');
      finalPhone = '+' + phoneStripped;
    }

    setIsSavingClient(true);

    try {
      const safeDate = new Date().toISOString().split('T')[0];
      const newClientData = {
        business_id: business.id,
        name: newClientForm.name.trim(),
        phone: finalPhone,
        email: newClientForm.email.trim() || null,
        birthday: newClientForm.birthday || null,
        instagram: '',
        last_visit: safeDate,
        visits: 0,
        spent: 0,
        balance: 0,
        linked_clients: [],
        is_blacklisted: false,
        tags: ['Новий']
      };

      const { error: insertError } = await supabase.from('clients').insert([newClientData]);
      if (insertError) throw insertError;

      await fetchClientsFromDB(business.id);
      setIsAddClientModalOpen(false);
      setNewClientForm({ name: '', phone: '+380', email: '', birthday: '' });
      showToast("Клієнта додано", 'success');
    } catch (err) {
      showToast("Критична помилка сервера", 'error');
    } finally {
      setIsSavingClient(false);
    }
  };

  const executeDeleteClient = async (clientId: string) => {
    setConfirmDialog(null);
    try {
      await supabase.from('clients').delete().eq('id', clientId);
      setClientsList((prev: any) => prev.filter((c: any) => c.id !== clientId));
      closeViewingClient();
      showToast("Клієнта видалено", 'info');
    } catch (err) { showToast("Не вдалося видалити клієнта.", 'error'); }
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
      instagram: editingInstagram,
      birthday: editingBirthday || null
    };

    setViewingClient(optimisticUpdatedClient);
    setClientsList(clientsList.map((c: any) => c.id === viewingClient.id ? optimisticUpdatedClient : c));

    try {
      const { error } = await supabase.from('clients').update({
        notes: editingClientNotes,
        allergies: editingClientAllergies,
        formulas: editingFormulas,
        consent_photo: consents.photo,
        consent_procedure: consents.procedure,
        instagram: editingInstagram,
        birthday: editingBirthday || null
      }).eq('id', viewingClient.id);

      if (error) throw error;
      showToast("Дані успішно збережено", 'success');

    } catch (err) {
      try {
         await supabase.from('clients').update({
            notes: editingClientNotes,
            allergies: editingClientAllergies,
            birthday: editingBirthday || null
         }).eq('id', viewingClient.id);
         showToast("Частково збережено. Додайте колонку 'instagram' в БД", 'info');
      } catch (fallbackErr) { showToast("Помилка збереження бази", 'error'); }
    }
  };

  const handleLinkClient = async (targetClientId: string) => {
    if (!viewingClient) return;

    const currentLinked = viewingClient.linked_clients || [];
    if (currentLinked.includes(targetClientId)) return showToast("Вже додано до сім'ї", "error");

    const newLinkedForCurrent = [...currentLinked, targetClientId];
    const targetClient = clientsList.find((c: any) => c.id === targetClientId);
    const newLinkedForTarget = [...(targetClient?.linked_clients || []), viewingClient.id];

    try {
      await supabase.from('clients').update({ linked_clients: newLinkedForCurrent }).eq('id', viewingClient.id);
      await supabase.from('clients').update({ linked_clients: newLinkedForTarget }).eq('id', targetClientId);

      setViewingClient({ ...viewingClient, linked_clients: newLinkedForCurrent });
      setClientsList(clientsList.map((c: any) => {
         if (c.id === viewingClient.id) return { ...c, linked_clients: newLinkedForCurrent };
         if (c.id === targetClientId) return { ...c, linked_clients: newLinkedForTarget };
         return c;
      }));

      showToast("Профілі успішно об'єднані", "success");
      setIsFamilyModalOpen(false);
      setFamilySearch('');
    } catch (error) { showToast("Помилка зв'язування", "error"); }
  };

  const handleUnlinkClient = async (targetClientId: string) => {
    const newLinkedForCurrent = viewingClient.linked_clients.filter((id: string) => id !== targetClientId);
    const targetClient = clientsList.find((c: any) => c.id === targetClientId);
    const newLinkedForTarget = (targetClient?.linked_clients || []).filter((id: string) => id !== viewingClient.id);

    try {
      await supabase.from('clients').update({ linked_clients: newLinkedForCurrent }).eq('id', viewingClient.id);
      await supabase.from('clients').update({ linked_clients: newLinkedForTarget }).eq('id', targetClientId);

      setViewingClient({ ...viewingClient, linked_clients: newLinkedForCurrent });
      setClientsList(clientsList.map((c: any) => {
         if (c.id === viewingClient.id) return { ...c, linked_clients: newLinkedForCurrent };
         if (c.id === targetClientId) return { ...c, linked_clients: newLinkedForTarget };
         return c;
      }));
      showToast("Зв'язок розірвано", "info");
    } catch (error) { showToast("Помилка видалення", "error"); }
  };

  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !viewingClient) return;

    setIsUploadingPDF(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `medical_consent_${viewingClient.id}_${Date.now()}.${fileExt}`;
      const filePath = `${business?.id || 'general'}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(filePath);

      await supabase.from('clients').update({ medical_pdf_url: publicUrl }).eq('id', viewingClient.id);

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
       await supabase.from('clients').update({ medical_pdf_url: null }).eq('id', viewingClient.id);
       setViewingClient({ ...viewingClient, medical_pdf_url: null });
       setClientsList(clientsList.map((c: any) => c.id === viewingClient.id ? { ...c, medical_pdf_url: null } : c));
       showToast("Файл видалено", "info");
     } catch (err) { showToast("Помилка видалення", "error"); }
  };

  const handleToggleBlacklist = async () => {
    if (!viewingClient) return;
    const newStatus = !viewingClient.is_blacklisted;
    setViewingClient({ ...viewingClient, is_blacklisted: newStatus });
    setClientsList(clientsList.map((c: any) => c.id === viewingClient.id ? { ...c, is_blacklisted: newStatus } : c));
    showToast(newStatus ? "Додано до чорного списку" : "Видалено з чорного списку", newStatus ? 'error' : 'success');
    try { await supabase.from('clients').update({ is_blacklisted: newStatus }).eq('id', viewingClient.id); }
    catch (error) { showToast("Помилка сервера", 'error'); }
  };

  const handleUpdateBalance = async () => {
     const amount = parseFloat(balanceAmount);
     if (isNaN(amount) || amount <= 0) return showToast("Введіть коректну суму", 'error');

     const currentBalance = viewingClient.balance || 0;
     const newBalance = balanceOperation === 'add' ? currentBalance + amount : currentBalance - amount;

     try {
        await supabase.from('clients').update({ balance: newBalance }).eq('id', viewingClient.id);
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
    setConsents({ photo: client.consent_photo || false, procedure: client.consent_procedure || false });
    setIsAddingTagInfo(false);
    setNewTagInput('');
    setActiveCardTab('info');
    if (saveToStorage && typeof window !== 'undefined') sessionStorage.setItem('openedClientId', client.id);
  };

  const closeViewingClient = () => {
    setViewingClient(null);
    if (typeof window !== 'undefined') sessionStorage.removeItem('openedClientId');
  };

  const handleSaveInlineTag = async () => {
    if (!viewingClient || !newTagInput.trim()) { setIsAddingTagInfo(false); return; }
    const cleanTag = newTagInput.trim();
    const currentTags = viewingClient.tags || [];
    if (currentTags.includes(cleanTag)) return showToast("Такий тег вже існує", 'error');

    const updatedTags = [...currentTags, cleanTag];
    try {
      await supabase.from('clients').update({ tags: updatedTags }).eq('id', viewingClient.id);
      setClientsList(clientsList.map((c: any) => c.id === viewingClient.id ? { ...c, tags: updatedTags } : c));
      setViewingClient({ ...viewingClient, tags: updatedTags });
      setNewTagInput('');
      setIsAddingTagInfo(false);
    } catch (err) { showToast("Помилка додавання тегу", 'error'); }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
     const updatedTags = viewingClient.tags.filter((t: string) => t !== tagToRemove);
     try {
        await supabase.from('clients').update({ tags: updatedTags }).eq('id', viewingClient.id);
        setClientsList(clientsList.map((c: any) => c.id === viewingClient.id ? { ...c, tags: updatedTags } : c));
        setViewingClient({ ...viewingClient, tags: updatedTags });
     } catch(err) { showToast("Помилка", 'error'); }
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
  const loyaltyProgress = viewingClient ? Math.min((viewingClient.visits || 0) / loyaltyTarget, 1) : 0;
  const ringRadius = 20;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - loyaltyProgress * ringCircumference;
  const isClientLost = viewingClient?.last_visit && (new Date().getTime() - new Date(viewingClient.last_visit).getTime() > 30 * 24 * 60 * 60 * 1000);

  return (
    <div style={{ padding: '2rem 3rem', flex: 1, display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>

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
        .timeline-dot.system { border-color: #3b82f6; background: #dbeafe; }

        .gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1rem; margin-top: 1.5rem; }
        .gallery-placeholder { aspect-ratio: 1; background: #f8fafc; border: 2px dashed #e2e8f0; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; color: #94a3b8; cursor: pointer; transition: 0.2s; }
        .gallery-placeholder:hover { background: #f1f5f9; border-color: #cbd5e1; color: #64748b; }
      `}</style>

      {viewingClient ? (
        <div className="page-transition" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }}>

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
                          {viewingClient.name} {isBirthdaySoon(viewingClient.birthday) && '🎂'}
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
                 <div style={{ color: '#4338ca', fontSize: '0.85rem', marginTop: '0.2rem' }}>Минуло більше 30 днів з останнього візиту. Надіслати нагадування або запропонувати знижку 10%?</div>
               </div>
               <button className="light-btn" style={{ marginLeft: 'auto', background: '#4f46e5' }} onClick={() => showToast('Повідомлення надіслано!', 'success')}>Надіслати SMS</button>
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
                             <span style={{ color: '#94a3b8' }}>🎂</span>
                             <input
                                type="date"
                                value={editingBirthday}
                                onChange={e => setEditingBirthday(e.target.value)}
                                style={{ border: 'none', borderBottom: '1px dashed #cbd5e1', background: 'transparent', outline: 'none', color: '#0f172a', fontWeight: '500', width: '100%', fontFamily: 'inherit', cursor: 'pointer' }}
                             />
                          </div>
                       </div>

                       <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.2rem' }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '0.8rem' }}>Сім'я / Зв'язки</div>

                          {viewingClient.linked_clients && viewingClient.linked_clients.length > 0 && (
                             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                                {viewingClient.linked_clients.map((id: string) => {
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

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.8rem' }}>
                       <div style={{ background: '#fff', padding: '1.25rem 1rem', borderRadius: '16px', border: '1px solid #e2e8f0', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', position: 'absolute', top: '1rem', left: '1rem' }}>Візити</div>
                          <div style={{ position: 'relative', width: '60px', height: '60px', marginTop: '1rem' }}>
                             <svg width="60" height="60" style={{ transform: 'rotate(-90deg)' }}>
                                <circle cx="30" cy="30" r={ringRadius} stroke="#f1f5f9" strokeWidth="4" fill="none" />
                                <circle cx="30" cy="30" r={ringRadius} stroke="#10b981" strokeWidth="4" fill="none" strokeDasharray={ringCircumference} strokeDashoffset={ringOffset} style={{ transition: 'stroke-dashoffset 1s ease-out' }} strokeLinecap="round" />
                             </svg>
                             <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: '800', color: '#0f172a' }}>
                                {viewingClient.visits || 0}
                             </div>
                          </div>
                          <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.5rem' }}>{loyaltyTarget - (viewingClient.visits || 0)} до VIP</div>
                       </div>

                       <div style={{ background: '#fff', padding: '1.25rem 1rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.5rem' }}>LTV</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a' }}>{viewingClient.spent || 0}₴</div>
                       </div>

                       <div style={{ background: '#fff', padding: '1.25rem 1rem', borderRadius: '16px', border: '1px solid #e2e8f0', position: 'relative' }}>
                          <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Депозит</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: '800', color: (viewingClient.balance || 0) < 0 ? '#ef4444' : '#3b82f6' }}>
                             {viewingClient.balance || 0}₴
                          </div>
                          <button onClick={() => setIsBalanceModalOpen(true)} title="Керувати балансом" style={{ position: 'absolute', top: '0.8rem', right: '0.8rem', width: '28px', height: '28px', borderRadius: '50%', background: '#f1f5f9', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0f172a', fontSize: '1.2rem', paddingBottom: '2px' }}>
                             +
                          </button>
                       </div>
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

                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                             <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0f172a' }}>Медична згода</div>
                             <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>Згода на проведення процедур</div>
                          </div>
                          <div onClick={() => setConsents({...consents, procedure: !consents.procedure})} className={`apple-switch ${consents.procedure ? 'on' : ''}`}>
                             <div className="apple-switch-knob"></div>
                          </div>
                       </div>

                       <div style={{ marginTop: '1.5rem' }}>
                          <input type="file" accept="application/pdf" hidden ref={pdfInputRef} onChange={handlePDFUpload} />

                          {viewingClient.medical_pdf_url ? (
                             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f1f5f9', padding: '0.6rem 1rem', borderRadius: '10px' }}>
                                <a href={viewingClient.medical_pdf_url} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', fontSize: '0.85rem', fontWeight: '600', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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

           {activeCardTab === 'timeline' && (
              <div style={{ background: '#fff', padding: '2rem', borderRadius: '16px', border: '1px solid #e2e8f0', maxWidth: '800px' }}>
                 <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', marginBottom: '2rem' }}>Хронологія подій</div>

                 <div className="timeline-wrapper">
                    {viewingClient.last_visit && (
                       <div className="timeline-item">
                          <div className="timeline-dot success"></div>
                          <div>
                             <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.2rem' }}>
                                {new Date(viewingClient.last_visit).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })}
                             </div>
                             <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '0.5rem' }}>
                                <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#0f172a' }}>Візит успішно завершено</div>
                                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.3rem' }}>Послуга виконана.</div>
                                <div style={{ display: 'inline-block', marginTop: '0.8rem', padding: '0.2rem 0.6rem', background: '#d1fae5', color: '#065f46', fontSize: '0.75rem', fontWeight: '600', borderRadius: '6px' }}>
                                   Оплачено
                                </div>
                             </div>
                          </div>
                       </div>
                    )}

                    <div className="timeline-item">
                       <div className="timeline-dot system"></div>
                       <div>
                          <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#0f172a' }}>Створення профілю</div>
                          <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.2rem' }}>Клієнт доданий до бази CRM</div>
                       </div>
                    </div>
                 </div>
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
        <div className="page-transition" style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ background: '#f1f5f9', padding: '3px', borderRadius: '10px', display: 'flex', gap: '2px' }}>
                 <button className={`seg-tab ${activeSegment === 'all' ? 'active' : ''}`} onClick={() => setActiveSegment('all')}>Усі</button>
                 <button className={`seg-tab ${activeSegment === 'new' ? 'active' : ''}`} onClick={() => setActiveSegment('new')}>Нові</button>
                 <button className={`seg-tab ${activeSegment === 'vip' ? 'active' : ''}`} onClick={() => setActiveSegment('vip')}>VIP</button>
                 <button className={`seg-tab ${activeSegment === 'lost' ? 'active' : ''}`} onClick={() => setActiveSegment('lost')}>Втрачені</button>
              </div>

              <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                 <div style={{ width: '240px' }}>
                    <input type="text" value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="light-input" placeholder="Пошук клієнта..." />
                 </div>
                 <button onClick={() => setIsAddClientModalOpen(true)} className="light-btn">
                    <Icons.Plus /> Додати
                 </button>
              </div>
           </div>

           <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scroll">
              {(() => {
                const indexOfLastClient = clientCurrentPage * clientsPerPage;
                const indexOfFirstClient = indexOfLastClient - clientsPerPage;
                const currentClients = filteredAndSortedClients.slice(indexOfFirstClient, indexOfLastClient);
                const totalClientPages = Math.ceil(filteredAndSortedClients.length / clientsPerPage);

                return currentClients.length > 0 ? (
                  <>
                    <table className="minimal-table">
                      <thead style={{ position: 'sticky', top: 0, background: '#fafafa', zIndex: 10 }}>
                        <tr>
                          <th className="sortable" onClick={() => handleSortClick('name')}>Клієнт <SortIcon columnKey="name" /></th>
                          <th>Контакти</th>
                          <th className="sortable" onClick={() => handleSortClick('recent')}>Останній візит <SortIcon columnKey="recent" /></th>
                          <th className="sortable" onClick={() => handleSortClick('balance')}>Депозит <SortIcon columnKey="balance" /></th>
                          <th className="sortable" onClick={() => handleSortClick('visits')}>Візити <SortIcon columnKey="visits" /></th>
                          <th className="sortable" onClick={() => handleSortClick('spent')}>Дохід <SortIcon columnKey="spent" /></th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentClients.map((client: any) => (
                          <tr key={client.id} onClick={() => openViewingClient(client)} style={{ opacity: client.is_blacklisted ? 0.5 : 1 }}>
                            <td data-label="Клієнт">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: client.is_blacklisted ? '#fee2e2' : '#f1f5f9', color: client.is_blacklisted ? '#ef4444' : '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.75rem' }}>
                                   {client.is_blacklisted ? <Icons.XCircle /> : getUserInitials(client.name)}
                                </div>
                                <span style={{ fontWeight: '600', color: client.is_blacklisted ? '#ef4444' : '#0f172a' }}>
                                   {client.name} {isBirthdaySoon(client.birthday) && '🎂'}
                                </span>
                              </div>
                            </td>
                            <td style={{ color: '#64748b' }}>{client.phone || '—'}</td>
                            <td style={{ color: '#64748b' }}>{client.last_visit ? new Date(client.last_visit).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' }) : '—'}</td>
                            <td style={{ fontWeight: '700', color: (client.balance || 0) < 0 ? '#ef4444' : (client.balance > 0 ? '#3b82f6' : '#64748b') }}>{client.balance || 0} ₴</td>
                            <td><span style={{ fontWeight: '600' }}>{client.visits || 0}</span></td>
                            <td style={{ fontWeight: '700', color: '#0f172a' }}>{client.spent || 0} ₴</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {totalClientPages > 1 && (
                      <div style={{ padding: '1rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Сторінка {clientCurrentPage} з {totalClientPages}</span>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button onClick={() => setClientCurrentPage(prev => Math.max(prev - 1, 1))} disabled={clientCurrentPage === 1} className="light-btn-sec" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>Назад</button>
                          <button onClick={() => setClientCurrentPage(prev => Math.min(prev + 1, totalClientPages))} disabled={clientCurrentPage === totalClientPages} className="light-btn-sec" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>Вперед</button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '5rem 2rem', color: '#64748b', margin: 'auto' }}>
                     <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.3rem' }}>Клієнтів не знайдено</h3>
                     <p style={{ fontSize: '0.9rem' }}>Спробуйте змінити запит у пошуку.</p>
                  </div>
                );
              })()}
           </div>
        </div>
      )}

      {/* МОДАЛКА БАЛАНСУ */}
      {isBalanceModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setIsBalanceModalOpen(false)}>
           <div className="toast-animate" onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px', padding: '2rem', width: '100%', maxWidth: '360px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                 <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>Керування депозитом</h3>
                 <button onClick={() => setIsBalanceModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
              </div>

              <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '1rem', textAlign: 'center', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
                 <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Поточний баланс</div>
                 <div style={{ fontSize: '1.8rem', fontWeight: '800', color: (viewingClient?.balance || 0) < 0 ? '#ef4444' : '#3b82f6', marginTop: '0.2rem' }}>{viewingClient?.balance || 0} ₴</div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
                 <button onClick={() => setBalanceOperation('add')} className={`seg-tab ${balanceOperation === 'add' ? 'active' : ''}`} style={{ flex: 1 }}>Поповнити</button>
                 <button onClick={() => setBalanceOperation('subtract')} className={`seg-tab ${balanceOperation === 'subtract' ? 'active' : ''}`} style={{ flex: 1 }}>Списати</button>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                 <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '0.4rem' }}>Сума (₴)</label>
                 <input type="number" value={balanceAmount} onChange={e => setBalanceAmount(e.target.value)} className="light-input" placeholder="Наприклад: 500" style={{ fontSize: '1.1rem', padding: '0.8rem 1rem' }} autoFocus />
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
                     !(viewingClient.linked_clients || []).includes(c.id) && // Не показувати вже доданих
                     c.name.toLowerCase().includes(familySearch.toLowerCase())
                 ).map((c: any) => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem', borderBottom: '1px solid #f1f5f9' }}>
                       <span style={{ fontWeight: '600', color: '#0f172a' }}>{c.name}</span>
                       <button className="light-btn-sec" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }} onClick={() => handleLinkClient(c.id)}>
                          Додати
                       </button>
                    </div>
                 ))}
                 {clientsList.filter((c: any) => c.id !== viewingClient.id && !(viewingClient.linked_clients || []).includes(c.id) && c.name.toLowerCase().includes(familySearch.toLowerCase())).length === 0 && (
                     <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.9rem' }}>Нікого не знайдено</div>
                 )}
              </div>
           </div>
        </div>
      )}

      {isAddClientModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15,23,42,0.3)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setIsAddClientModalOpen(false)}>
           <div className="toast-animate custom-scroll" onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '400px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                 <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>Новий клієнт</h3>
                 <button onClick={() => setIsAddClientModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                 <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '0.3rem' }}>Ім'я та прізвище *</label>
                    <input type="text" value={newClientForm.name} onChange={e => setNewClientForm({...newClientForm, name: e.target.value})} className="light-input" placeholder="Олена Коваленко" autoFocus />
                 </div>
                 <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '0.3rem' }}>Телефон</label>
                    <input type="text" value={newClientForm.phone} onChange={e => setNewClientForm({...newClientForm, phone: e.target.value})} className="light-input" placeholder="+380..." />
                 </div>
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                    <div>
                       <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '0.3rem' }}>Email</label>
                       <input type="email" value={newClientForm.email} onChange={e => setNewClientForm({...newClientForm, email: e.target.value})} className="light-input" placeholder="mail@..." />
                    </div>
                    <div>
                       <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '0.3rem' }}>День народження</label>
                       <input type="date" value={newClientForm.birthday} onChange={e => setNewClientForm({...newClientForm, birthday: e.target.value})} className="light-input" />
                    </div>
                 </div>
              </div>

              <button onClick={handleSaveNewClient} disabled={isSavingClient} className="light-btn" style={{ width: '100%', justifyContent: 'center', padding: '0.7rem' }}>
                 {isSavingClient ? 'Збереження...' : 'Зберегти клієнта'}
              </button>

           </div>
        </div>
      )}

      {toast.show && (
        <div className="toast-animate" style={{ position: 'fixed', bottom: '2rem', right: '2rem', background: toast.type === 'error' ? '#ef4444' : '#0f172a', color: '#fff', padding: '0.7rem 1.2rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.6rem', boxShadow: '0 8px 20px rgba(0,0,0,0.15)', zIndex: 9999, fontWeight: '600', fontSize: '0.85rem' }}>
           {toast.type === 'error' ? <Icons.AlertCircle /> : <Icons.CheckCircle />}
           {toast.msg}
        </div>
      )}

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