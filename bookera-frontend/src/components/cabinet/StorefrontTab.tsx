'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';
import { useToast } from '@/context/ToastContext';
import { ALL_AMENITIES } from '@/lib/amenities';

interface StorefrontTabProps {
  onNavigate?: (tab: string, view?: string) => void;
  business: any;
  services: any[];
  team: any[];
  Icons: any;
  setActiveTab: (tab: string) => void;
}

// Список усіх доступних зручностей для салону з покращеними SVG-іконками

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
    showAmenities: true,
  });

  const [teamOrder, setTeamOrder] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<string[]>([
    'parking', 'card_payment', 'wifi', 'accessibility', 'coffee_tea'
  ]);

  const [coverPhoto, setCoverPhoto] = useState<string | null>(null);
  const [workplacePhotos, setWorkplacePhotos] = useState<string[]>([]);

  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isDesignModalOpen, setIsDesignModalOpen] = useState(false);
  const [isTeamOrderModalOpen, setIsTeamOrderModalOpen] = useState(false);

  const MAX_WORKPLACE_PHOTOS = 6;
  const canAutoSave = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
      setCoverPhoto(business.cover_photo || null);
      setWorkplacePhotos(business.workplace_photos || []);

      let cfg = business.layout_config;
      if (typeof cfg === 'string') {
        try { cfg = JSON.parse(cfg); } catch { cfg = null; }
      }

      if (cfg && typeof cfg === 'object') {
        setLayoutConfig(prev => ({ ...prev, ...cfg }));
        if (Array.isArray(cfg.amenities)) {
          setAmenities(cfg.amenities);
        }
        if (Array.isArray(cfg.team_order) && cfg.team_order.length > 0) {
          setTeamOrder(cfg.team_order.map(String));
        } else if (team && team.length > 0) {
          setTeamOrder(team.map((t: any) => String(t.id)));
        }
      } else {
        if (Array.isArray(business.amenities) && business.amenities.length > 0) {
          setAmenities(business.amenities);
        }
        if (team && team.length > 0) {
          setTeamOrder(team.map((t: any) => String(t.id)));
        }
      }

      setTimeout(() => { canAutoSave.current = true; }, 100);
    }
  }, [business, team]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [formData.description]);

  const allGalleryPhotos = useMemo(() => {
    const list: string[] = [];
    if (coverPhoto) list.push(coverPhoto);
    if (Array.isArray(workplacePhotos)) {
      list.push(...workplacePhotos.filter(Boolean));
    }
    return Array.from(new Set(list));
  }, [coverPhoto, workplacePhotos]);

  // Впорядкована команда для відображення
  const orderedTeam = useMemo(() => {
    if (!team || team.length === 0) return [];
    const copy = [...team];
    if (!teamOrder || teamOrder.length === 0) return copy;
    return copy.sort((a, b) => {
      const idxA = teamOrder.indexOf(String(a.id));
      const idxB = teamOrder.indexOf(String(b.id));
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return 0;
    });
  }, [team, teamOrder]);

  const moveStaff = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= orderedTeam.length) return;
    const currentIds = orderedTeam.map((t: any) => String(t.id));
    const [moved] = currentIds.splice(index, 1);
    currentIds.splice(targetIndex, 0, moved);
    setTeamOrder(currentIds);
  };

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

  useEffect(() => {
    if (!canAutoSave.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void handleSaveBusinessInfo(true); }, 700);
  }, [formData.name, formData.description, formData.category, accentColor,
      layoutConfig, coverPhoto, workplacePhotos, amenities, teamOrder]);

  const handleSaveBusinessInfo = async (silent = false) => {
    if (!business?.id) return;
    setIsSaving(true);

    try {
      const token = await getAuthToken();
      const updatedLayoutConfig = {
        ...layoutConfig,
        amenities: amenities,
        team_order: teamOrder,
      };

      await api.updateBusiness(token, business.id, {
        name: formData.name,
        category: formData.category,
        description: formData.description,
        accent_color: accentColor,
        layout_config: updatedLayoutConfig,
        cover_photo: coverPhoto ?? undefined,
        logo: coverPhoto ?? null,
        workplace_photos: workplacePhotos,
        amenities: amenities,
      } as any);

      business.name = formData.name;
      business.category = formData.category;
      business.description = formData.description;
      business.layout_config = updatedLayoutConfig;
      business.amenities = amenities;
      business.cover_photo = coverPhoto;
      business.workplace_photos = workplacePhotos;
    } catch (err: any) {
      console.error("Помилка збереження:", err);
      showToast(err?.message || 'Не вдалося зберегти зміни', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'cover' | 'workplace') => {
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

      if (type === 'cover') setCoverPhoto(publicUrl);
      else if (type === 'workplace') setWorkplacePhotos(prev => [...prev, publicUrl]);

    } catch (error: any) {
      console.error("Помилка завантаження фото:", error.message);
      showToast(error?.message || 'Не вдалося завантажити фотографію', 'error');
    }
  };

  const handleDeletePhoto = async (type: 'cover' | 'workplace', urlToRemove?: string) => {
    if (!urlToRemove) return;

    if (type === 'cover') setCoverPhoto(null);
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

  const toggleAmenity = (id: string) => {
    setAmenities(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const formatRole = (role?: string) => {
    if (!role) return 'Спеціаліст';
    if (role === 'business_owner' || role === 'owner' || role === 'vendor') return 'Власник';
    if (role === 'admin') return 'Адміністратор';
    if (role === 'master') return 'Спеціаліст';
    return role;
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

  const activeAmenitiesList = useMemo(() => {
    return ALL_AMENITIES.filter(a => amenities.includes(a.id));
  }, [amenities]);

  const mapIframeUrl = useMemo(() => {
    const mapQuery = encodeURIComponent(`${fullAddress || 'Львів'}, Україна`);
    return `https://maps.google.com/maps?q=${mapQuery}&t=m&z=17&ie=UTF8&iwloc=&output=embed`;
  }, [fullAddress]);

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes slideInUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeInBg { from { opacity: 0; } to { opacity: 1; } }

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
              onClick={() => router.push(`/${business?.slug || business?.id}`)}
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
          <div style={{ width: '100%', maxWidth: '1280px', display: 'flex', flexDirection: 'column', gap: '3rem' }}>

            {/* Галерея: головна обкладинка + фото інтер'єру */}
            <div className="editable-block" style={{ borderRadius: '24px', position: 'relative' }}>
              {allGalleryPhotos.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: allGalleryPhotos.length > 1 ? '2fr 1fr' : '1fr', gap: '1rem', width: '100%', height: '420px', borderRadius: '24px', overflow: 'hidden' }}>
                  <div style={{ borderRadius: '24px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.06)', position: 'relative', background: '#f1f5f9' }}>
                    <img src={allGalleryPhotos[0]} alt="Головна обкладинка" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  {allGalleryPhotos.length > 1 && (
                    <div style={{ display: 'grid', gridTemplateRows: allGalleryPhotos.length > 2 ? 'repeat(2, 1fr)' : '1fr', gap: '1rem', height: '100%' }}>
                      {allGalleryPhotos.slice(1, 3).map((photo, idx) => (
                        <div key={idx} style={{ borderRadius: '24px', overflow: 'hidden', boxShadow: '0 4px 14px rgba(0,0,0,0.04)', position: 'relative', background: '#f1f5f9' }}>
                          <img src={photo} alt={`Фото ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ height: '420px', borderRadius: '24px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #cbd5e1', position: 'relative' }}>
                  <div style={{ color: '#94a3b8', textAlign: 'center' }}>
                    <Icons.Image style={{ width: '48px', height: '48px', opacity: 0.5 }} />
                    <div style={{ fontWeight: '600', marginTop: '1rem', fontSize: '1.1rem' }}>Завантажте головну обкладинку та фото інтер'єру</div>
                  </div>
                </div>
              )}

              <div className="edit-overlay" onClick={() => setIsPhotoModalOpen(true)}>
                <button className="edit-btn"><Icons.Camera /> Змінити обкладинку та фото ({allGalleryPhotos.length})</button>
              </div>
            </div>

            {/* Назва та адреса закладу */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
              <div style={{ flex: 1, minWidth: '300px' }}>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="inline-input"
                  placeholder="Назва вашого закладу"
                  style={{ fontSize: '2.5rem', fontWeight: '800', color: '#1D1D1F', lineHeight: 1.15, letterSpacing: '-0.02em', width: 'auto', minWidth: '240px' }}
                />

                <div className="editable-block" style={{ marginTop: '0.5rem', borderRadius: '12px', padding: '0.4rem 0.6rem', marginLeft: '-0.6rem', width: 'fit-content' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#86868B', fontSize: '0.92rem', fontWeight: '500' }}>
                    <Icons.MapPin style={{ width: '16px', height: '16px', color: '#86868B' }} />
                    <span>{fullAddress || 'Адресу не вказано'}</span>
                  </div>

                  {formData.phone && (business as any)?.show_phone_publicly !== false && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#86868B', marginTop: '0.35rem', fontSize: '0.88rem' }}>
                      <Icons.Phone style={{ width: '15px', height: '15px', color: '#86868B' }} />
                      <span>{formData.phone}</span>
                    </div>
                  )}

                  <div className="edit-overlay" style={{ borderRadius: '10px' }} onClick={() => onNavigate?.('Settings', 'profile')}>
                    <button
                      className="edit-btn"
                      style={{
                        padding: '0.3rem 0.75rem',
                        fontSize: '0.78rem',
                        fontWeight: '600',
                        borderRadius: '6px',
                        gap: '0.35rem',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)'
                      }}
                    >
                      <Icons.Edit style={{ width: '13px', height: '13px' }} /> Змінити
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Сітка 2 колонки: Основний вміст та Правий сайдбар */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(0, 1fr)', gap: '4rem', alignItems: 'start' }}>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '3.5rem' }}>

                {/* ПРАЙС-ЛИСТ */}
                <div className="editable-block" style={{ background: '#ffffff', borderRadius: '24px', padding: '2rem', border: '1px solid rgba(226, 232, 240, 0.7)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#1D1D1F', margin: 0, letterSpacing: '-0.02em' }}>
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
                              padding: '1.25rem 0',
                              borderBottom: idx !== sortedServices.length - 1 ? '1px solid #f1f5f9' : 'none',
                              gap: '1.5rem'
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0, paddingRight: '1rem' }}>
                              <div style={{ fontWeight: '700', fontSize: '1.1rem', color: '#1D1D1F', marginBottom: '0.35rem' }}>
                                {service.name}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', color: '#64748b' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}>
                                  <Icons.Clock style={{ width: '14px', height: '14px', color: '#94a3b8' }} />
                                  {formatServiceDuration(durationVal)}
                                </span>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  color: '#065F46',
                                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: '600'
                                }}>
                                  <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#10B981' }}></span>
                                  Є вільні слоти
                                </span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexShrink: 0 }}>
                              <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1D1D1F' }}>
                                {Number(service.price || 0).toLocaleString('uk-UA')} ₴
                              </div>
                              <button
                                type="button"
                                style={{
                                  padding: '0.6rem 1.4rem',
                                  backgroundColor: '#000000',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '14px',
                                  fontWeight: '600',
                                  fontSize: '0.92rem',
                                  cursor: 'pointer'
                                }}
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

                {/* Блок Про нас */}
                <div style={{ background: '#ffffff', borderRadius: '24px', padding: '2rem', border: '1px solid rgba(226, 232, 240, 0.6)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '1rem', color: '#1D1D1F', letterSpacing: '-0.01em' }}>Про заклад</h2>
                  <textarea
                    ref={textareaRef}
                    name="description"
                    value={formData.description || ''}
                    onChange={handleInputChange}
                    maxLength={1000}
                    className="inline-input"
                    style={{ width: '100%', minHeight: '100px', fontSize: '1rem', color: '#475569', lineHeight: '1.7', padding: '0.5rem 0', resize: 'none', overflow: 'hidden' }}
                    placeholder="Розкажіть історію вашого закладу..."
                  />
                </div>
              </div>

              {/* Сайдбар (Команда, Карта та Зручності) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', position: 'sticky', top: '90px' }}>

                {/* Блок Команда (Свайп та пряме відкриття вікна черги) */}
                {layoutConfig.showTeam && (
                  <div className="editable-block" style={{ background: '#ffffff', borderRadius: '24px', padding: '2rem', border: '1px solid rgba(226, 232, 240, 0.6)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: '#1D1D1F' }}>Наша команда</h3>
                      <button
                        type="button"
                        onClick={() => setIsTeamOrderModalOpen(true)}
                        style={{ background: 'transparent', border: 'none', color: '#86868B', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Впорядкувати ⇅
                      </button>
                    </div>

                    {orderedTeam.length > 0 ? (
                      <div className="hide-scrollbar" style={{ display: 'flex', gap: '1.25rem', overflowX: 'auto', paddingBottom: '0.25rem', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}>
                        {orderedTeam.map((staff, idx) => (
                          <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '76px', textAlign: 'center', flexShrink: 0, scrollSnapAlign: 'start' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#f1f5f9', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                              {staff.avatar_url ? (
                                <img src={staff.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={staff.name || 'Avatar'} />
                              ) : (
                                <div style={{ display: 'flex', width: '20px', height: '20px', color: '#86868B' }}><Icons.User /></div>
                              )}
                            </div>
                            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1D1D1F', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={staff.name}>
                              {staff.name}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#86868B', marginTop: '2px', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={formatRole(staff.role)}>
                              {formatRole(staff.role)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '1rem 0', color: '#94a3b8' }}>Команда не додана</div>
                    )}

                    <div className="edit-overlay" style={{ borderRadius: '24px' }} onClick={() => setIsTeamOrderModalOpen(true)}>
                      <button className="edit-btn"><Icons.Edit /> Впорядкувати чергу майстрів</button>
                    </div>
                  </div>
                )}

                {/* Блок Карта */}
                {layoutConfig.showMap && (
                  <div className="editable-block" style={{ background: '#ffffff', borderRadius: '24px', padding: 0, overflow: 'hidden', border: '1px solid rgba(226, 232, 240, 0.6)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                    <div style={{ height: '200px', width: '100%', position: 'relative', overflow: 'hidden', background: '#e2e8f0' }}>
                      <div style={{ position: 'absolute', top: '-160px', left: '-160px', width: 'calc(100% + 320px)', height: 'calc(100% + 320px)' }}>
                        <iframe
                          key={fullAddress}
                          src={mapIframeUrl}
                          style={{
                            width: '100%',
                            height: '100%',
                            border: 0,
                            pointerEvents: 'none'
                          }}
                          allowFullScreen={false}
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                      </div>
                    </div>
                    <div style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                      <span style={{ color: '#1D1D1F', fontSize: '0.88rem', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {fullAddress || 'Адреса закладу'}
                      </span>
                      <button
                        type="button"
                        onClick={() => onNavigate?.('Settings', 'profile')}
                        style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem', fontWeight: 600, background: '#F5F5F7', border: 'none', borderRadius: '10px', cursor: 'pointer', color: '#1D1D1F' }}
                      >
                        Карта ↗
                      </button>
                    </div>
                    <div className="edit-overlay" style={{ borderRadius: '24px' }} onClick={() => onNavigate?.('Settings', 'profile')}>
                      <button className="edit-btn"><Icons.Edit /> Змінити адресу</button>
                    </div>
                  </div>
                )}

                {/* БЛОК ЗРУЧНОСТІ ПІД КАРТОЮ */}
                {layoutConfig.showAmenities && (
                  <div className="editable-block" style={{ background: '#ffffff', borderRadius: '24px', padding: '2rem', border: '1px solid rgba(226, 232, 240, 0.6)', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                    {/* Кнопку «Налаштувати ⚙» прибрано: блок редагується
                        при наведенні, як решта на цій сторінці. Окрема
                        кнопка біля одного заголовка виглядала винятком
                        і змагалась із самим заголовком за увагу. */}
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: '0 0 1.25rem', color: '#1D1D1F' }}>Зручності</h3>

                    {activeAmenitiesList.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.1rem' }}>
                        {activeAmenitiesList.map(item => (
                          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: '#1D1D1F', fontSize: '0.86rem', fontWeight: '500' }}>
                            <span style={{ color: '#86868B', display: 'flex', alignItems: 'center' }}>{item.icon}</span>
                            <span>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#94a3b8', fontSize: '0.88rem' }}>
                        Зручності не обрано. Натисніть, щоб додати.
                      </div>
                    )}

                    <div className="edit-overlay" style={{ borderRadius: '24px' }} onClick={() => setIsDesignModalOpen(true)}>
                      <button className="edit-btn"><Icons.Edit /> Редагувати зручності</button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>

        {/* 🟢 ОКРЕМЕ МОДАЛЬНЕ ВІКНО ДЛЯ ВПОРЯДКУВАННЯ МАЙСТРІВ */}
        {isTeamOrderModalOpen && (
          <div className="modal-overlay" onClick={() => setIsTeamOrderModalOpen(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', animation: 'fadeInBg 0.2s ease forwards' }}>
            <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#ffffff', width: '100%', maxWidth: '440px', borderRadius: '20px', padding: '1.75rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', boxShadow: '0 20px 45px rgba(0,0,0,0.18)', animation: 'slideInUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.85rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>Порядок майстрів</h3>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '2px 0 0 0' }}>Налаштуйте черговість відображення на сторінці</p>
                </div>
                <button onClick={() => setIsTeamOrderModalOpen(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ✕
                </button>
              </div>

              <div className="custom-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '50vh', overflowY: 'auto', paddingRight: '2px' }}>
                {orderedTeam.length > 0 ? (
                  orderedTeam.map((staff, idx) => (
                    <div
                      key={staff.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: '#f8fafc',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#94a3b8', width: '18px' }}>
                          #{idx + 1}
                        </span>
                        <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#e2e8f0', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {staff.avatar_url ? (
                            <img src={staff.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                          ) : (
                            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{staff.name?.[0] || 'М'}</span>
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {staff.name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#86868B' }}>
                            {formatRole(staff.role)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveStaff(idx, -1)}
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            cursor: idx === 0 ? 'not-allowed' : 'pointer',
                            opacity: idx === 0 ? 0.35 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            color: '#0f172a',
                          }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={idx === orderedTeam.length - 1}
                          onClick={() => moveStaff(idx, 1)}
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            cursor: idx === orderedTeam.length - 1 ? 'not-allowed' : 'pointer',
                            opacity: idx === orderedTeam.length - 1 ? 0.35 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            color: '#0f172a',
                          }}
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#94a3b8', fontSize: '0.9rem' }}>
                    Співробітників не знайдено
                  </div>
                )}
              </div>

              {orderedTeam.length <= 1 && (
                <div style={{ padding: '0.75rem 1rem', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '10px', fontSize: '0.78rem', color: '#0369A1' }}>
                  Додайте більше співробітників у вкладці «Команда», щоб міняти їх місцями стрілками ↑ ↓.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    void handleSaveBusinessInfo();
                    setIsTeamOrderModalOpen(false);
                    showToast('Порядок майстрів збережено!', 'success');
                  }}
                  style={{ padding: '0.65rem 1.4rem', backgroundColor: '#0f172a', color: '#fff', borderRadius: '10px', fontWeight: 600, fontSize: '0.88rem', border: 'none', cursor: 'pointer' }}
                >
                  Готово
                </button>
              </div>
            </div>
          </div>
        )}

        {/* МОДАЛЬНЕ ВІКНО КЕРУВАННЯ МЕДІА */}
        {isPhotoModalOpen && (
          <div className="modal-overlay" onClick={() => setIsPhotoModalOpen(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 999, display: 'flex', justifyContent: 'center', alignItems: 'center', animation: 'fadeInBg 0.2s ease forwards' }}>
            <div onClick={e => e.stopPropagation()} className="hide-scrollbar" style={{ backgroundColor: '#ffffff', width: '100%', maxWidth: '800px', maxHeight: '85vh', borderRadius: '24px', padding: '2rem 2.5rem', display: 'flex', flexDirection: 'column', gap: '2.5rem', overflowY: 'auto', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', animation: 'slideInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.5rem 0' }}>Керування медіафайлами</h2>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>Завантажте головну обкладинку профілю та додаткові фотографії інтер'єру.</p>
                </div>
                <button onClick={() => setIsPhotoModalOpen(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '36px', height: '36px', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>

              {/* Обкладинка */}
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', marginBottom: '1rem' }}>Головна обкладинка профілю</h3>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  {coverPhoto ? (
                    <div style={{ position: 'relative', width: '100%', maxWidth: '440px', height: '180px', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                      <img src={coverPhoto} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button className="media-delete-btn" onClick={() => handleDeletePhoto('cover', coverPhoto)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    </div>
                  ) : (
                    <label className="media-upload-label" style={{ width: '100%', maxWidth: '440px', height: '180px' }}>
                      <Icons.Image style={{ marginBottom: '0.5rem' }} />
                      <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>Завантажити головне фото</span>
                      <input type="file" accept="image/*" hidden onChange={(e) => handlePhotoUpload(e, 'cover')} />
                    </label>
                  )}
                </div>
              </div>

              {/* Фото інтер'єру */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', margin: 0 }}>Додаткові фото (інтер'єр, роботи)</h3>
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

        {/* БІЧНА ПАНЕЛЬ НАЛАШТУВАНЬ ВИГЛЯДУ, БЛОКІВ ТА ЗРУЧНОСТЕЙ */}
        {isDesignModalOpen && (
          <div className="modal-overlay" onClick={() => setIsDesignModalOpen(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.25)', backdropFilter: 'blur(4px)', zIndex: 999, display: 'flex', justifyContent: 'flex-end', animation: 'fadeInBg 0.3s ease forwards' }}>
            <div className="hide-scrollbar" onClick={e => e.stopPropagation()} style={{ backgroundColor: '#ffffff', width: '100%', maxWidth: '420px', height: '100%', padding: '24px 28px 4.5rem 28px', display: 'flex', flexDirection: 'column', gap: '2rem', overflowY: 'auto', boxShadow: '-10px 0 40px rgba(0,0,0,0.1)', animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>Вигляд та блоки</h2>
                <button onClick={() => setIsDesignModalOpen(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '34px', height: '34px', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>

              {/* Відображення блоків на сторінці */}
              <div>
                <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700', color: '#64748b', marginBottom: '12px' }}>Відображення блоків</h3>
                <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '6px 18px', border: '1px solid #e2e8f0' }}>

                  {/* Тогл Команда */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.92rem' }}>Блок "Наша команда"</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Показувати майстрів клієнтам</div>
                    </div>
                    <div
                      onClick={() => setLayoutConfig(prev => ({ ...prev, showTeam: !prev.showTeam }))}
                      style={{
                        width: '44px',
                        height: '24px',
                        backgroundColor: layoutConfig.showTeam ? '#6F9273' : '#cbd5e1',
                        borderRadius: '999px',
                        position: 'relative',
                        cursor: 'pointer',
                        transition: 'background-color 0.25s ease',
                        flexShrink: 0
                      }}
                    >
                      <div style={{ position: 'absolute', top: '2px', left: '2px', width: '20px', height: '20px', backgroundColor: '#ffffff', borderRadius: '50%', transition: 'transform 0.25s', transform: layoutConfig.showTeam ? 'translateX(20px)' : 'translateX(0px)', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }} />
                    </div>
                  </div>

                  {/* Кнопка впорядкування команди у сайдбарі */}
                  {layoutConfig.showTeam && (
                    <div style={{ padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsDesignModalOpen(false);
                          setIsTeamOrderModalOpen(true);
                        }}
                        style={{
                          width: '100%',
                          padding: '0.55rem 0.8rem',
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          color: '#0f172a',
                          fontWeight: 600,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>Порядок майстрів ({orderedTeam.length})</span>
                        <span>⇅</span>
                      </button>
                    </div>
                  )}

                  {/* Тогл Карта */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.92rem' }}>Блок "Карта"</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Інтерактивна Google Карта</div>
                    </div>
                    <div
                      onClick={() => setLayoutConfig(prev => ({ ...prev, showMap: !prev.showMap }))}
                      style={{
                        width: '44px',
                        height: '24px',
                        backgroundColor: layoutConfig.showMap ? '#6F9273' : '#cbd5e1',
                        borderRadius: '999px',
                        position: 'relative',
                        cursor: 'pointer',
                        transition: 'background-color 0.25s ease',
                        flexShrink: 0
                      }}
                    >
                      <div style={{ position: 'absolute', top: '2px', left: '2px', width: '20px', height: '20px', backgroundColor: '#ffffff', borderRadius: '50%', transition: 'transform 0.25s', transform: layoutConfig.showMap ? 'translateX(20px)' : 'translateX(0px)', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }} />
                    </div>
                  </div>

                  {/* Тогл Зручності */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0' }}>
                    <div>
                      <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '0.92rem' }}>Блок "Зручності"</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Wi-Fi, паркування, кава тощо</div>
                    </div>
                    <div
                      onClick={() => setLayoutConfig(prev => ({ ...prev, showAmenities: !prev.showAmenities }))}
                      style={{
                        width: '44px',
                        height: '24px',
                        backgroundColor: layoutConfig.showAmenities ? '#6F9273' : '#cbd5e1',
                        borderRadius: '999px',
                        position: 'relative',
                        cursor: 'pointer',
                        transition: 'background-color 0.25s ease',
                        flexShrink: 0
                      }}
                    >
                      <div style={{ position: 'absolute', top: '2px', left: '2px', width: '20px', height: '20px', backgroundColor: '#ffffff', borderRadius: '50%', transition: 'transform 0.25s', transform: layoutConfig.showAmenities ? 'translateX(20px)' : 'translateX(0px)', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }} />
                    </div>
                  </div>

                </div>
              </div>

              {/* ВИБІР ЗРУЧНОСТЕЙ ДЛЯ САЛОНУ */}
              <div style={{ paddingBottom: '2rem' }}>
                <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700', color: '#64748b', marginBottom: '12px' }}>
                  Зручності закладу
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {ALL_AMENITIES.map(item => {
                    const isChecked = amenities.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => toggleAmenity(item.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          borderRadius: '14px',
                          border: `1px solid ${isChecked ? '#10b981' : '#e2e8f0'}`,
                          backgroundColor: isChecked ? '#f0fdf4' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: isChecked ? '0 2px 6px rgba(16, 185, 129, 0.08)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ color: isChecked ? '#166534' : '#64748b', display: 'flex', alignItems: 'center' }}>
                            {item.icon}
                          </span>
                          <span style={{ fontSize: '0.92rem', fontWeight: isChecked ? 600 : 500, color: '#0f172a' }}>
                            {item.label}
                          </span>
                        </div>
                        <div style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '6px',
                          border: isChecked ? 'none' : '1.5px solid #cbd5e1',
                          backgroundColor: isChecked ? '#10b981' : '#ffffff',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          transition: 'all 0.15s ease'
                        }}>
                          {isChecked && '✓'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </>
  );
}