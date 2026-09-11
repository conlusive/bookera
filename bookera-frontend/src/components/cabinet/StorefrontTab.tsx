'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';
import { useToast } from '@/context/ToastContext';

interface StorefrontTabProps {
  onNavigate?: (tab: string, view?: string) => void;
  business: any;
  services: any[];
  team: any[];
  Icons: any;
  setActiveTab: (tab: string) => void;
}

export default function StorefrontTab({ business, services, team, Icons, setActiveTab, onNavigate }: StorefrontTabProps) {
  const { showToast } = useToast();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [formData, setFormData] = useState({ name: '', category: '', city: '', address: '', description: '', phone: '', email: '' });

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

  const MAX_WORKPLACE_PHOTOS = 6;

  useEffect(() => {
    if (business) {
      setFormData({
        name: business.name || '',
        city: business.city || '',
        category: business.category || '',
        address: business.address || '',
        description: business.description || '',
        phone: (business as any).phone || '',
        email: (business as any).email || '',
      });
      setAccentColor(business.accent_color || '#0f172a');
      setLogo(business.logo || null);
      setCoverPhoto(business.cover_photo || null);
      setWorkplacePhotos(business.workplace_photos || []);

      if (business.layout_config) {
        setLayoutConfig(business.layout_config);
      }

      setTimeout(() => { canAutoSave.current = true; }, 0);
    }
  }, [business]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [formData.description]);

  const fullAddress = (() => {
    const city = (formData.city || '').trim();
    const addr = (formData.address || '').trim();
    if (!addr) return city;
    if (!city) return addr;
    return addr.toLowerCase().startsWith(city.toLowerCase()) ? addr : `${city}, ${addr}`;
  })();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const canAutoSave = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!canAutoSave.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void handleSaveBusinessInfo(true); }, 700);
  }, [formData.name, formData.description, formData.category, accentColor,
      layoutConfig, logo, coverPhoto, workplacePhotos]);

  const handleSaveBusinessInfo = async (silent = false) => {
    if (!business?.id) return;
    setIsSaving(true);

    try {
      const token = await getAuthToken();
      await api.updateBusiness(token, business.id, {
        name: formData.name,
        category: formData.category,
        description: formData.description,
        accent_color: accentColor,
        layout_config: layoutConfig,
        logo: logo ?? undefined,
        cover_photo: coverPhoto ?? undefined,
        workplace_photos: workplacePhotos,
      });
    } catch (err: any) {
      console.error("Помилка збереження:", err);
      showToast(err?.message || 'Не вдалося зберегти зміни', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'cover' | 'workplace') => {
    const file = e.target.files?.[0];
    if (!file || !business?.id) return;

    if (!file.type.startsWith('image/')) {
      showToast('Підтримуються лише зображення: JPG, PNG, WebP', 'error');
      return;
    }

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

  const handleDeletePhoto = async (type: 'logo' | 'cover' | 'workplace', urlToRemove?: string) => {
    if (!urlToRemove) return;

    if (type === 'logo') setLogo(null);
    else if (type === 'cover') setCoverPhoto(null);
    else if (type === 'workplace') {
      setWorkplacePhotos(prev => prev.filter(url => url !== urlToRemove));
    }

    try {
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

  const sortedServices = useMemo(() => {
    return [...services]
      .filter(s => s.is_active !== false)
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
  }, [services]);

  const formatServiceDuration = (minutes?: number) => {
    if (!minutes) return '30 хв';
    if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60} год`;
    if (minutes > 60) return `${Math.floor(minutes / 60)} год ${minutes % 60} хв`;
    return `${minutes} хв`;
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes slideInUp { from { transform: translateY(50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeInBg { from { opacity: 0; } to { opacity: 1; } }
        
        .color-swatch-item {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          border: 3px solid #ffffff;
          box-sizing: border-box;
        }
        .color-swatch-item:hover {
          transform: scale(1.1);
        }

        .media-delete-btn { position: absolute; top: 8px; right: 8px; width: 32px; height: 32px; background: rgba(239, 68, 68, 0.9); color: white; border: none; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; z-index: 10; backdrop-filter: blur(4px); }
        .media-delete-btn:hover { background: rgba(220, 38, 38, 1); transform: scale(1.1); }
        .media-upload-label { display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 16px; cursor: pointer; color: #64748b; transition: 0.2s; }
        .media-upload-label:hover { background: #e2e8f0; border-color: #94a3b8; color: #475569; }
      `}} />

      <div className="hide-scrollbar" style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#fafbfc', overflowY: 'auto', position: 'relative' }}>

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

            {isSaving && (
              <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>
                Збереження…
              </span>
            )}
          </div>
        </header>

        {/* Основний контент */}
        <div style={{ padding: '2rem 3rem 5rem 3rem', flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: '1280px', display: 'flex', flexDirection: 'column', gap: '4rem' }}>

            {/* Менеджер фотографій */}
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

            {/* Назва та адреса */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, paddingRight: '2rem' }}>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="inline-input"
                  placeholder="Назва вашого закладу"
                  style={{ fontSize: '2.25rem', fontWeight: '800', color: '#0f172a', lineHeight: 1.15, width: '100%', letterSpacing: '-0.02em' }}
                />

                <div className="editable-block" style={{ marginTop: '0.75rem', borderRadius: '16px', padding: '0.5rem', marginLeft: '-0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#64748b' }}>
                    <Icons.MapPin style={{ width: '20px', height: '20px', color: accentColor, transition: 'color 0.2s ease' }} />
                    <span style={{ fontSize: '1.25rem', fontWeight: '500' }}>
                      {fullAddress || 'Адресу не вказано'}
                    </span>
                  </div>

                  {formData.phone && (business as any)?.show_phone_publicly !== false && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#64748b', marginTop: '0.5rem' }}>
                      <Icons.Phone style={{ width: '18px', height: '18px', color: accentColor, flexShrink: 0, transition: 'color 0.2s ease' }} />
                      <span style={{ fontSize: '1rem', fontWeight: '500' }}>{formData.phone}</span>
                    </div>
                  )}

                  <div className="edit-overlay" style={{ borderRadius: '16px' }} onClick={() => onNavigate?.('Settings', 'profile')}>
                    <button className="edit-btn"><Icons.Edit /> Адреса й контакти</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Сітка 2 колонки */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1fr)', gap: '4rem', alignItems: 'start' }}>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4rem' }}>
                {/* Блок Про нас */}
                <div style={{ background: '#ffffff', borderRadius: '24px', padding: '3rem', border: '1px solid rgba(226, 232, 240, 0.6)', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
                  <h2 style={{ fontSize: '1.6rem', fontWeight: '800', marginBottom: '1.5rem', color: '#0f172a', letterSpacing: '-0.01em' }}>Про нас</h2>
                  <textarea
                    ref={textareaRef} name="description" value={formData.description || ''} onChange={handleInputChange} maxLength={1000} className="inline-input"
                    style={{ width: '100%', minHeight: '150px', fontSize: '1.1rem', color: '#475569', lineHeight: '1.8', padding: '1rem', marginLeft: '-1rem', resize: 'none', overflow: 'hidden' }}
                    placeholder="Розкажіть історію вашого закладу..."
                  />
                </div>

                {/* 🟢 ПРАЙС-ЛИСТ (Преміальний вигляд із живим акцентним кольором) */}
                <div className="editable-block" style={{ background: '#ffffff', borderRadius: '24px', padding: '2.5rem', border: '1px solid rgba(226, 232, 240, 0.7)', boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                      Послуги
                    </h2>
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: '500' }}>
                      {sortedServices.length} {sortedServices.length === 1 ? 'позиція' : 'позицій'}
                    </span>
                  </div>

                  {sortedServices.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {sortedServices.map((service, idx) => {
                        const durationVal = service.duration_minutes ?? service.duration ?? 30;
                        return (
                          <div
                            key={service.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '1.15rem 0',
                              borderBottom: idx !== sortedServices.length - 1 ? '1px solid #f1f5f9' : 'none',
                              gap: '1.5rem'
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0, paddingRight: '1rem' }}>
                              <div style={{ fontWeight: '600', fontSize: '1.05rem', color: '#0f172a', marginBottom: '0.25rem' }}>
                                {service.name}
                              </div>

                              {service.description && (
                                <p style={{ margin: '0 0 0.4rem 0', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.4, maxWidth: '480px' }}>
                                  {service.description}
                                </p>
                              )}

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8rem', color: '#64748b' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}>
                                  <Icons.Clock style={{ width: '14px', height: '14px', color: '#94a3b8' }} />
                                  {formatServiceDuration(durationVal)}
                                </span>
                                <span style={{ color: '#cbd5e1' }}>·</span>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  color: '#166534',
                                  backgroundColor: '#f0fdf4',
                                  border: '1px solid #bbf7d0',
                                  padding: '1px 8px',
                                  borderRadius: '999px',
                                  fontSize: '0.72rem',
                                  fontWeight: '600'
                                }}>
                                  <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#22c55e' }}></span>
                                  Є час сьогодні
                                </span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexShrink: 0 }}>
                              <div style={{ fontSize: '1.15rem', fontWeight: '700', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                                {Number(service.price || 0).toLocaleString('uk-UA')} ₴
                              </div>
                              <button
                                type="button"
                                style={{
                                  padding: '0.55rem 1.3rem',
                                  backgroundColor: accentColor,
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '10px',
                                  fontWeight: '600',
                                  fontSize: '0.85rem',
                                  cursor: 'pointer',
                                  transition: 'background-color 0.2s ease, opacity 0.2s ease, transform 0.1s ease',
                                  whiteSpace: 'nowrap',
                                  boxShadow: `0 3px 10px ${accentColor}25`
                                }}
                                onMouseOver={e => e.currentTarget.style.opacity = '0.9'}
                                onMouseOut={e => e.currentTarget.style.opacity = '1'}
                              >
                                Вибрати
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '3.5rem 0', color: '#94a3b8', border: '1.5px dashed #e2e8f0', borderRadius: '16px' }}>
                      Прайс-лист порожній або всі послуги приховано
                    </div>
                  )}

                  <div className="edit-overlay" style={{ borderRadius: '24px' }} onClick={() => setActiveTab('Services')}>
                    <button className="edit-btn"><Icons.Edit /> Редагувати послуги</button>
                  </div>
                </div>
              </div>

              {/* Сайдбар */}
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
                    <div className="edit-overlay" style={{ borderRadius: '24px' }} onClick={() => setActiveTab('Team')}>
                      <button className="edit-btn"><Icons.Edit /> Керувати командою</button>
                    </div>
                  </div>
                )}

                {layoutConfig.showMap && (
                  <div className="editable-block" style={{ background: '#ffffff', borderRadius: '24px', padding: 0, overflow: 'hidden', height: '300px', border: '1px solid rgba(226, 232, 240, 0.6)' }}>
                    <iframe key={fullAddress} width="100%" height="100%" style={{ border: 0, pointerEvents: 'none' }} loading="lazy" src={`https://maps.google.com/maps?q=${encodeURIComponent(fullAddress || 'Київ')}&t=&z=18&ie=UTF8&iwloc=&output=embed`}></iframe>
                    <div className="edit-overlay" style={{ borderRadius: '24px' }} onClick={() => onNavigate?.('Settings', 'profile')}>
                      <button className="edit-btn"><Icons.Edit /> Точне місцезнаходження</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* МОДАЛЬНЕ ВІКНО КЕРУВАННЯ МЕДІА */}
        {isPhotoModalOpen && (
          <div className="modal-overlay" onClick={() => setIsPhotoModalOpen(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 999, display: 'flex', justifyContent: 'center', alignItems: 'center', animation: 'fadeInBg 0.2s ease forwards' }}>
            <div onClick={e => e.stopPropagation()} className="hide-scrollbar" style={{ backgroundColor: '#ffffff', width: '100%', maxWidth: '800px', maxHeight: '85vh', borderRadius: '24px', padding: '2rem 2.5rem', display: 'flex', flexDirection: 'column', gap: '2.5rem', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', animation: 'slideInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.5rem 0' }}>Керування медіафайлами</h2>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>Завантажте логотип, обкладинку та фото інтер'єру.</p>
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

        {/* 🟢 МОДАЛЬНЕ ВІКНО НАЛАШТУВАНЬ ВИГЛЯДУ З ЖИВИМИ ТОГЛАМИ ТА ПАЛІТРОЮ */}
        {isDesignModalOpen && (
          <div className="modal-overlay" onClick={() => setIsDesignModalOpen(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.25)', backdropFilter: 'blur(4px)', zIndex: 999, display: 'flex', justifyContent: 'flex-end', animation: 'fadeInBg 0.3s ease forwards' }}>
            <div className="hide-scrollbar" onClick={e => e.stopPropagation()} style={{ backgroundColor: '#ffffff', width: '100%', maxWidth: '400px', height: '100%', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '2.5rem', overflowY: 'auto', boxShadow: '-10px 0 40px rgba(0,0,0,0.1)', animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>Вигляд та блоки</h2>
                <button onClick={() => setIsDesignModalOpen(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '34px', height: '34px', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>

              {/* Палітра акцентних кольорів */}
              <div>
                <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700', color: '#64748b', marginBottom: '16px' }}>Колір акцентів</h3>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'navy', color: '#0f172a' },
                    { id: 'matcha', color: '#436b49' },
                    { id: 'emerald', color: '#10b981' },
                    { id: 'red', color: '#ef4444' },
                    { id: 'orange', color: '#f97316' },
                    { id: 'purple', color: '#8b5cf6' },
                    { id: 'pink', color: '#ec4899' }
                  ].map(item => {
                    const isSelected = accentColor === item.color;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setAccentColor(item.color)}
                        className="color-swatch-item"
                        style={{
                          backgroundColor: item.color,
                          boxShadow: isSelected ? `0 0 0 2px #ffffff, 0 0 0 4px ${item.color}` : '0 2px 5px rgba(0,0,0,0.12)',
                          transform: isSelected ? 'scale(1.1)' : 'scale(1)'
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Конструктор сторінки: живі тогли в кольорі акценту */}
              <div>
                <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700', color: '#64748b', marginBottom: '16px' }}>Конструктор сторінки</h3>
                <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '8px 20px', border: '1px solid #e2e8f0' }}>

                  {/* Тогл "Наша команда" */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.95rem' }}>Блок "Наша команда"</div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Показувати майстрів клієнтам</div>
                    </div>
                    <div
                      onClick={() => setLayoutConfig(prev => ({ ...prev, showTeam: !prev.showTeam }))}
                      style={{
                        width: '46px',
                        height: '26px',
                        backgroundColor: layoutConfig.showTeam ? accentColor : '#cbd5e1',
                        borderRadius: '999px',
                        position: 'relative',
                        cursor: 'pointer',
                        transition: 'background-color 0.25s ease',
                        flexShrink: 0
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: '3px',
                          left: '3px',
                          width: '20px',
                          height: '20px',
                          backgroundColor: '#ffffff',
                          borderRadius: '50%',
                          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                          transform: layoutConfig.showTeam ? 'translateX(20px)' : 'translateX(0px)',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.18)'
                        }}
                      />
                    </div>
                  </div>

                  {/* Тогл "Карта" */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0' }}>
                    <div>
                      <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.95rem' }}>Блок "Карта"</div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Відображати Google Maps</div>
                    </div>
                    <div
                      onClick={() => setLayoutConfig(prev => ({ ...prev, showMap: !prev.showMap }))}
                      style={{
                        width: '46px',
                        height: '26px',
                        backgroundColor: layoutConfig.showMap ? accentColor : '#cbd5e1',
                        borderRadius: '999px',
                        position: 'relative',
                        cursor: 'pointer',
                        transition: 'background-color 0.25s ease',
                        flexShrink: 0
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: '3px',
                          left: '3px',
                          width: '20px',
                          height: '20px',
                          backgroundColor: '#ffffff',
                          borderRadius: '50%',
                          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                          transform: layoutConfig.showMap ? 'translateX(20px)' : 'translateX(0px)',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.18)'
                        }}
                      />
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </>
  );
}