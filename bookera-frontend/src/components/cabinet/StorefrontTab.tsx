'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';
import { useToast } from '@/context/ToastContext';

interface StorefrontTabProps {
  business: any;
  services: any[];
  team: any[];
  Icons: any;
  setActiveTab: (tab: string) => void;
}

export default function StorefrontTab({ business, services, team, Icons, setActiveTab }: StorefrontTabProps) {
  const { showToast } = useToast();
  const router = useRouter();
  const supabase = createClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [formData, setFormData] = useState({ name: '', category: '', address: '', description: '' });

  const [accentColor, setAccentColor] = useState('#0f172a');
  const [isSaving, setIsSaving] = useState(false);

  const [layoutConfig, setLayoutConfig] = useState({
    showTeam: true,
    showMap: true,
  });

  const [logo, setLogo] = useState<string | null>(null);
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null);
  const [workplacePhotos, setWorkplacePhotos] = useState<string[]>([]);

  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isDesignModalOpen, setIsDesignModalOpen] = useState(false);
  const [isAiExpanded, setIsAiExpanded] = useState(false);

  const MAX_WORKPLACE_PHOTOS = 6;

  useEffect(() => {
    if (business) {
      setFormData({
        name: business.name || '',
        category: business.category || '',
        address: business.address || '',
        description: business.description || '',
      });
      setAccentColor(business.accent_color || '#0f172a');
      setLogo(business.logo || null);
      setCoverPhoto(business.cover_photo || null);
      setWorkplacePhotos(business.workplace_photos || []);

      if (business.layout_config) {
        setLayoutConfig(business.layout_config);
      }
    }
  }, [business]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [formData.description]);

  const aiState = useMemo(() => {
    let score = 0;
    let hint = "";

    if (formData.name && formData.address) score += 20;
    if (logo) score += 15;
    if (coverPhoto) {
      score += 25;
    } else {
      hint = "Почніть з обкладинки! Це перше, що бачать клієнти.";
    }

    if ((formData.description || '').length > 80) {
      score += 20;
    } else if (!hint) {
      hint = "Ваш опис закороткий. Деталі про атмосферу продають найкраще!";
    }

    if (workplacePhotos.length > 0) {
      score += 20;
    } else if (!hint) {
      hint = "Додайте фото інтер'єру, щоб показати ваш простір.";
    }

    if (score === 100 && !hint) hint = "Виглядає розкішно! Ваш профіль готовий до залучення клієнтів.";

    return { score, hint };
  }, [formData.name, formData.address, formData.description, logo, coverPhoto, workplacePhotos.length]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveBusinessInfo = async () => {
    if (!business?.id) return;
    setIsSaving(true);

    try {
      const token = await getAuthToken();
      await api.updateBusiness(token, business.id, {
        name: formData.name,
        category: formData.category,
        address: formData.address,
        description: formData.description,
        accent_color: accentColor,
        layout_config: layoutConfig,
        logo: logo ?? undefined,
        cover_photo: coverPhoto ?? undefined,
        workplace_photos: workplacePhotos,
      });

      // Підтвердження показує сама кнопка (SaveButton) - тост тут зайвий.
    } catch (err: any) {
      console.error("Непередбачена помилка:", err);
      showToast(err?.message || 'Не вдалося зберегти зміни', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'cover' | 'workplace') => {
    const file = e.target.files?.[0];
    if (!file || !business?.id) return;

    // 1. ПЕРЕВІРКА ТИПУ ФАЙЛУ
    if (!file.type.startsWith('image/')) {
      showToast('Підтримуються лише зображення: JPG, PNG, WebP', 'error');
      return;
    }

    // 2. ОБМЕЖЕННЯ РОЗМІРУ (5 MB)
    const MAX_FILE_SIZE_MB = 5;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      showToast(`Файл завеликий. Максимум — ${MAX_FILE_SIZE_MB} МБ`, 'error');
      return;
    }

    if (type === 'workplace' && workplacePhotos.length >= MAX_WORKPLACE_PHOTOS) {
      showToast("Досягнуто ліміт фотографій інтер'єру", 'error');
      return;
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${business.id}-${type}-${Date.now()}.${fileExt}`;
    const filePath = `${type}s/${fileName}`;

    try {
      // 3. Завантажуємо файл у бакет 'business_media'
      const { error: uploadError } = await supabase.storage
        .from('business_media')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('business_media')
        .getPublicUrl(filePath);

      if (type === 'logo') setLogo(publicUrl);
      else if (type === 'cover') setCoverPhoto(publicUrl);
      else if (type === 'workplace') setWorkplacePhotos(prev => [...prev, publicUrl]);

    } catch (error: any) {
      console.error("Помилка завантаження фото:", error.message);
      showToast(error?.message || 'Не вдалося завантажити фотографію', 'error');
    }
  };

  // Функція для видалення фотографій
  const handleDeletePhoto = async (type: 'logo' | 'cover' | 'workplace', urlToRemove?: string) => {
    if (!urlToRemove) return;

    // 1. Оновлюємо UI миттєво (прибираємо з екрана)
    if (type === 'logo') setLogo(null);
    else if (type === 'cover') setCoverPhoto(null);
    else if (type === 'workplace') {
      setWorkplacePhotos(prev => prev.filter(url => url !== urlToRemove));
    }

    // 2. Фізично видаляємо файл із Supabase Storage
    try {
      // Витягуємо шлях до файлу з URL (все, що йде після назви бакета)
      const pathStartIndex = urlToRemove.indexOf('/business_media/');
      if (pathStartIndex !== -1) {
        const filePath = urlToRemove.substring(pathStartIndex + '/business_media/'.length);
        const { error } = await supabase.storage.from('business_media').remove([filePath]);
        if (error) console.error("Помилка видалення зі сховища:", error.message);
      }
    } catch (error) {
      console.error("Непередбачена помилка при видаленні:", error);
    }
  };

  const sortedServices = [...services].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes slideInUp { from { transform: translateY(50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeInBg { from { opacity: 0; } to { opacity: 1; } }
        
        .color-swatch { width: 36px; height: 36px; border-radius: 50%; cursor: pointer; border: 3px solid #ffffff; transition: all 0.2s ease; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .color-swatch:hover { transform: scale(1.1); }
        .color-swatch.active { outline: 2px solid var(--swatch-color); outline-offset: 2px; transform: scale(1.1); }

        .toggle-switch { width: 44px; height: 24px; background: #cbd5e1; border-radius: 999px; position: relative; cursor: pointer; transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .toggle-switch.active { background: var(--accent-color); }
        .toggle-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; background: white; border-radius: 50%; transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        .toggle-switch.active::after { transform: translateX(20px); }

        .media-delete-btn { position: absolute; top: 8px; right: 8px; width: 32px; height: 32px; background: rgba(239, 68, 68, 0.9); color: white; border: none; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; z-index: 10; backdrop-filter: blur(4px); }
        .media-delete-btn:hover { background: rgba(220, 38, 38, 1); transform: scale(1.1); }
        .media-upload-label { display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 16px; cursor: pointer; color: #64748b; transition: 0.2s; }
        .media-upload-label:hover { background: #e2e8f0; border-color: #94a3b8; color: #475569; }
      `}} />

      <div className="hide-scrollbar" style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#fafbfc', overflowY: 'auto', position: 'relative', '--accent-color': accentColor } as React.CSSProperties}>

        {/* Хедер */}
        <header style={{ padding: '1.5rem 3rem', borderBottom: '1px solid rgba(226, 232, 240, 0.6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', position: 'sticky', top: 0, zIndex: 50 }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>Редактор профілю закладу</h1>
          </div>
          <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>

            <button
              onClick={() => setIsDesignModalOpen(true)}
              style={{ padding: '0.5rem 1rem', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '8px', fontWeight: '600', color: '#334155', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              Вигляд та блоки
            </button>

            <div style={{ width: '1px', height: '24px', background: '#cbd5e1', margin: '0 0.5rem' }}></div>

            <button
              onClick={() => router.push(`/salon/${business?.id}`)}
              style={{ padding: '0.5rem 1rem', backgroundColor: 'transparent', border: 'none', borderRadius: '8px', fontWeight: '500', color: '#475569', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem' }}
            >
              <Icons.Globe style={{ width: '18px', height: '18px' }} /> Переглянути
            </button>

            <button
              onClick={handleSaveBusinessInfo}
              disabled={isSaving}
              style={{ padding: '0.5rem 1.25rem', backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', fontWeight: '500', color: '#ffffff', cursor: isSaving ? 'not-allowed' : 'pointer', transition: 'all 0.2s', opacity: isSaving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 4px 10px rgba(15, 23, 42, 0.1)', fontSize: '0.95rem' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              {isSaving ? 'Збереження...' : 'Зберегти зміни'}
            </button>
          </div>
        </header>

        {/* Основний контент */}
        <div style={{ padding: '2rem 3rem 5rem 3rem', flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: '1280px', display: 'flex', flexDirection: 'column', gap: '4rem' }}>

            {/* Менеджер фотографій (Відкриває модалку) */}
            <div className="editable-block" style={{ height: '450px', borderRadius: '24px', overflow: 'hidden', background: coverPhoto ? `url(${coverPhoto}) center/cover` : '#f1f5f9', display: 'flex', alignItems: 'flex-end', padding: '3rem', border: coverPhoto ? 'none' : '2px dashed #cbd5e1', position: 'relative', boxShadow: coverPhoto ? '0 20px 40px rgba(0,0,0,0.1)' : 'none' }}>
              {!coverPhoto && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#94a3b8', textAlign: 'center' }}>
                  <Icons.Image style={{ width: '48px', height: '48px', opacity: 0.5 }} />
                  <div style={{ fontWeight: '600', marginTop: '1rem', fontSize: '1.1rem' }}>Завантажте обкладинку</div>
                </div>
              )}
              <div style={{ width: '140px', height: '140px', borderRadius: '50%', background: logo ? `url(${logo}) center/cover` : '#ffffff', border: '6px solid #ffffff', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                {!logo && <div style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: '600' }}>Лого</div>}
              </div>
              <div className="edit-overlay" onClick={() => setIsPhotoModalOpen(true)}>
                <button className="edit-btn"><Icons.Camera /> Керувати медіафайлами</button>
              </div>
            </div>

            {/* Назва та Адреса */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, paddingRight: '2rem' }}>
                <input
                  name="name" value={formData.name} onChange={handleInputChange} className="inline-input"
                  style={{ fontSize: '3.5rem', fontWeight: '900', color: '#0f172a', width: '100%', padding: '0.2rem 0.5rem', marginLeft: '-0.5rem', letterSpacing: '-0.03em', marginBottom: '0.5rem', lineHeight: '1.1' }}
                  placeholder="Назва вашого закладу"
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#64748b', marginLeft: '0.1rem' }}>
                  <Icons.MapPin style={{ width: '20px', height: '20px', color: accentColor }} />
                  <input
                    name="address" value={formData.address} onChange={handleInputChange} className="inline-input"
                    style={{ fontSize: '1.25rem', color: '#64748b', fontWeight: '500', width: '100%', padding: '0.2rem 0.5rem' }}
                    placeholder="Місто, вулиця та номер будинку"
                  />
                </div>
              </div>
            </div>

            {/* Сітка 2 колонки */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1fr)', gap: '4rem', alignItems: 'start' }}>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4rem' }}>
                <div style={{ background: '#ffffff', borderRadius: '24px', padding: '3rem', border: '1px solid rgba(226, 232, 240, 0.6)', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
                  <h2 style={{ fontSize: '1.6rem', fontWeight: '800', marginBottom: '1.5rem', color: '#0f172a', letterSpacing: '-0.01em' }}>Про нас</h2>
                  <textarea
                    ref={textareaRef} name="description" value={formData.description || ''} onChange={handleInputChange} maxLength={1000} className="inline-input"
                    style={{ width: '100%', minHeight: '150px', fontSize: '1.1rem', color: '#475569', lineHeight: '1.8', padding: '1rem', marginLeft: '-1rem', resize: 'none', overflow: 'hidden' }}
                    placeholder="Розкажіть історію вашого закладу..."
                  />
                </div>

                <div className="editable-block" style={{ background: '#ffffff', borderRadius: '24px', padding: '3rem', border: '1px solid rgba(226, 232, 240, 0.6)', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
                  <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0f172a', marginBottom: '2rem', letterSpacing: '-0.01em' }}>Прайс-лист</h2>
                  {sortedServices.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {sortedServices.map(service => (
                        <div key={service.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderRadius: '16px', background: '#f8fafc' }}>
                          <div>
                            <div style={{ fontWeight: '700', fontSize: '1.2rem', color: '#0f172a', marginBottom: '0.4rem' }}>{service.name}</div>
                            <div style={{ color: '#64748b', fontSize: '0.95rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Icons.Clock style={{ width: '16px', height: '16px' }} /> {service.duration} хв</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                            <div style={{ fontSize: '1.3rem', fontWeight: '800', color: accentColor }}>{service.price} ₴</div>
                            <button style={{ padding: '0.5rem 1.25rem', backgroundColor: 'transparent', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: '600', color: '#64748b' }}>Вибрати</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '4rem 0', color: '#64748b', border: '2px dashed #e2e8f0', borderRadius: '16px' }}>Прайс-лист порожній</div>
                  )}
                  <div className="edit-overlay" style={{ borderRadius: '24px' }} onClick={() => setActiveTab('Services')}><button className="edit-btn"><Icons.Edit /> Редагувати послуги</button></div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem', position: 'sticky', top: '7rem' }}>
                {layoutConfig.showTeam && (
                  <div className="editable-block" style={{ background: '#ffffff', borderRadius: '24px', padding: '2rem', border: '1px solid rgba(226, 232, 240, 0.6)', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: '800', margin: '0 0 1.5rem 0', color: '#0f172a' }}>Наша команда</h3>
                    {team.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', textAlign: 'center' }}>
                        {team.map((staff, idx) => (
                          <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#f1f5f9', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                              {staff.avatar_url ? <img src={staff.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Avatar"/> : <Icons.User />}
                            </div>
                            <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0f172a' }}>{staff.name}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '1rem 0', color: '#94a3b8' }}>Команда не додана</div>
                    )}
                    <div className="edit-overlay" style={{ borderRadius: '24px' }} onClick={() => setActiveTab('Team')}><button className="edit-btn"><Icons.Edit /> Керувати командою</button></div>
                  </div>
                )}

                {layoutConfig.showMap && (
                  <div className="editable-block" style={{ background: '#ffffff', borderRadius: '24px', padding: 0, overflow: 'hidden', height: '300px', border: '1px solid rgba(226, 232, 240, 0.6)' }}>
                    <iframe key={formData.address} width="100%" height="100%" style={{ border: 0, pointerEvents: 'none' }} loading="lazy" src={`https://maps.google.com/maps?q=${encodeURIComponent(formData.address || 'Київ')}&t=&z=18&ie=UTF8&iwloc=&output=embed`}></iframe>
                    <div className="edit-overlay" style={{ borderRadius: '24px' }} onClick={() => document.querySelector('input[name="address"]')?.scrollIntoView()}><button className="edit-btn"><Icons.Edit /> Точне місцезнаходження</button></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* НОВЕ: МОДАЛЬНЕ ВІКНО КЕРУВАННЯ МЕДІА (ФОТОГРАФІЯМИ) */}
        {isPhotoModalOpen && (
          <div className="modal-overlay" onClick={() => setIsPhotoModalOpen(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 999, display: 'flex', justifyContent: 'center', alignItems: 'center', animation: 'fadeInBg 0.2s ease forwards' }}>
            <div onClick={e => e.stopPropagation()} className="hide-scrollbar" style={{ backgroundColor: '#ffffff', width: '100%', maxWidth: '800px', maxHeight: '85vh', borderRadius: '24px', padding: '2rem 2.5rem', display: 'flex', flexDirection: 'column', gap: '2.5rem', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', animation: 'slideInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.5rem 0' }}>Керування медіафайлами</h2>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>Завантажте логотип, обкладинку та фото інтер'єру. Не забудьте зберегти зміни після закриття вікна.</p>
                </div>
                <button onClick={() => setIsPhotoModalOpen(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '36px', height: '36px', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>

              {/* Логотип */}
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', marginBottom: '1rem' }}>Логотип</h3>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  {logo ? (
                    <div style={{ position: 'relative', width: '120px', height: '120px', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                      <img src={logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button className="media-delete-btn" onClick={() => handleDeletePhoto('logo', logo)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    </div>
                  ) : (
                    <label className="media-upload-label" style={{ width: '120px', height: '120px' }}>
                      <Icons.Camera style={{ marginBottom: '0.5rem' }} />
                      <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>Додати</span>
                      <input type="file" accept="image/*" hidden onChange={(e) => handlePhotoUpload(e, 'logo')} />
                    </label>
                  )}
                </div>
              </div>

              {/* Обкладинка */}
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', marginBottom: '1rem' }}>Обкладинка профілю</h3>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  {coverPhoto ? (
                    <div style={{ position: 'relative', width: '100%', maxWidth: '400px', height: '160px', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                      <img src={coverPhoto} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button className="media-delete-btn" onClick={() => handleDeletePhoto('cover', coverPhoto)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    </div>
                  ) : (
                    <label className="media-upload-label" style={{ width: '100%', maxWidth: '400px', height: '160px' }}>
                      <Icons.Image style={{ marginBottom: '0.5rem' }} />
                      <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>Завантажити обкладинку</span>
                      <input type="file" accept="image/*" hidden onChange={(e) => handlePhotoUpload(e, 'cover')} />
                    </label>
                  )}
                </div>
              </div>

              {/* Фото інтер'єру */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>Фото інтер'єру</h3>
                  <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>{workplacePhotos.length} / {MAX_WORKPLACE_PHOTOS}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
                  {workplacePhotos.map((url, idx) => (
                    <div key={idx} style={{ position: 'relative', width: '100%', height: '140px', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                      <img src={url} alt={`Workplace ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button className="media-delete-btn" onClick={() => handleDeletePhoto('workplace', url)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    </div>
                  ))}

                  {workplacePhotos.length < MAX_WORKPLACE_PHOTOS && (
                    <label className="media-upload-label" style={{ width: '100%', height: '140px' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '0.5rem' }}><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                      <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>Додати фото</span>
                      <input type="file" accept="image/*" hidden onChange={(e) => handlePhotoUpload(e, 'workplace')} />
                    </label>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* НОВЕ, КРАСИВЕ МОДАЛЬНЕ ВІКНО НАЛАШТУВАНЬ ВИГЛЯДУ (справа) */}
        {isDesignModalOpen && (
          <div className="modal-overlay" onClick={() => setIsDesignModalOpen(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.25)', backdropFilter: 'blur(4px)', zIndex: 999, display: 'flex', justifyContent: 'flex-end', animation: 'fadeInBg 0.3s ease forwards' }}>
            <div className="hide-scrollbar" onClick={e => e.stopPropagation()} style={{ backgroundColor: '#f8fafc', width: '100%', maxWidth: '400px', height: '100%', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '2.5rem', overflowY: 'auto', boxShadow: '-10px 0 40px rgba(0,0,0,0.1)', animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>Вигляд та блоки</h2>
                <button onClick={() => setIsDesignModalOpen(false)} style={{ background: '#ffffff', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', transition: '0.2s' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>

              <div>
                <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700', color: '#64748b', marginBottom: '16px' }}>Колір акцентів</h3>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {['#0f172a', '#d4af37', '#10b981', '#ef4444', '#f97316', '#8b5cf6', '#ec4899'].map(color => (
                    <div
                      key={color}
                      onClick={() => setAccentColor(color)}
                      className={`color-swatch ${accentColor === color ? 'active' : ''}`}
                      style={{ backgroundColor: color, '--swatch-color': color } as React.CSSProperties}
                    />
                  ))}
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700', color: '#64748b', marginBottom: '16px' }}>Конструктор сторінки</h3>
                <div style={{ background: '#ffffff', borderRadius: '16px', padding: '8px 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div>
                      <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.95rem' }}>Блок "Наша команда"</div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Показувати майстрів клієнтам</div>
                    </div>
                    <div className={`toggle-switch ${layoutConfig.showTeam ? 'active' : ''}`} onClick={() => setLayoutConfig({...layoutConfig, showTeam: !layoutConfig.showTeam})}></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0' }}>
                    <div>
                      <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.95rem' }}>Блок "Карта"</div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Відображати Google Maps</div>
                    </div>
                    <div className={`toggle-switch ${layoutConfig.showMap ? 'active' : ''}`} onClick={() => setLayoutConfig({...layoutConfig, showMap: !layoutConfig.showMap})}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ПЛАВАЮЧИЙ AI-АСИСТЕНТ (FAB) */}
        <div
          onMouseEnter={() => setIsAiExpanded(true)}
          onMouseLeave={() => setIsAiExpanded(false)}
          style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1rem' }}
        >
          {isAiExpanded && (
            <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', width: '320px', animation: 'fadeIn 0.2s ease-out', transformOrigin: 'bottom right' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#8b5cf6', fontWeight: '700', fontSize: '0.85rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg>
                AI ПОРАДА
              </div>
              <p style={{ margin: 0, fontSize: '0.95rem', color: '#334155', lineHeight: '1.5' }}>{aiState.hint}</p>
            </div>
          )}
          <div style={{ background: '#0f172a', color: '#fff', height: '56px', padding: '0 1.5rem', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer', boxShadow: '0 10px 25px rgba(15,23,42,0.2)', transition: '0.2s', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>Профіль: {aiState.score}%</span>
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: `conic-gradient(#8b5cf6 ${aiState.score}%, rgba(255,255,255,0.2) 0)` }}></div>
          </div>
        </div>

      </div>
    </>
  );
}