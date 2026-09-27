'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';
import { createClient } from '@/lib/supabase/client';
import SmartImage from '@/components/ui/SmartImage';

/**
 * Портфоліо майстра - фото робіт. Клієнти бачать їх на сторінці салону,
 * коли обирають, до кого записатись.
 *
 * Фото вантажаться в той самий кошик Supabase, що й фото вітрини
 * (business_media), окремою папкою portfolio/.
 */

const C = { text: '#0f172a', sub: '#64748b', border: '#e2e8f0' };
const MAX_MB = 8;

export default function MasterPortfolio({ businessId, userId }: { businessId: number; userId: string }) {
  const supabase = createClient();
  const [items, setItems] = useState<any[] | null>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const t = await getAuthToken();
    setItems(await api.listMyPortfolio(t, businessId).catch(() => []));
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [businessId]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setError('');
    const list = Array.from(files).slice(0, 10);
    setUploading(list.length);
    const t = await getAuthToken();
    for (const file of list) {
      try {
        if (!file.type.startsWith('image/')) throw new Error('Лише фото');
        if (file.size > MAX_MB * 1024 * 1024) throw new Error(`Фото до ${MAX_MB} МБ`);
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `portfolio/${businessId}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error: upErr } = await supabase.storage.from('business_media').upload(path, file, { cacheControl: '3600', upsert: false });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from('business_media').getPublicUrl(path);
        await api.addPortfolioItem(t, { business_id: businessId, image_url: data.publicUrl });
      } catch (e: any) {
        setError(e?.message || 'Не вдалося завантажити фото');
      } finally {
        setUploading(n => Math.max(0, n - 1));
      }
    }
    if (fileRef.current) fileRef.current.value = '';
    await load();
  };

  const remove = async (id: number) => {
    const t = await getAuthToken();
    await api.deletePortfolioItem(t, id).catch(() => null);
    setItems(p => (p || []).filter(i => i.id !== id));
  };

  return (
    <div className="pf">
      <div className="pf-header">
        <div>
          <h2>Портфоліо</h2>
          <p>Клієнти бачать ці роботи на сторінці салону, коли обирають майстра.</p>
        </div>
        <button type="button" className="pf-btn" onClick={() => fileRef.current?.click()} disabled={uploading > 0}>
          {uploading > 0 ? `Завантажуємо… ${uploading}` : 'Додати фото'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => void upload(e.target.files)} />
      </div>
      {error && <div className="pf-err">{error}</div>}

      {items === null ? <div className="pf-empty">Завантаження…</div> : items.length === 0 ? (
        <button type="button" className="pf-drop" onClick={() => fileRef.current?.click()}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-8 8" /></svg>
          <b>Додайте перші роботи</b>
          <span>До, після, деталі — 6–12 найкращих фото переконують краще за будь-який опис.</span>
        </button>
      ) : (
        <div className="pf-grid">
          {items.map(i => (
            <figure key={i.id} className="pf-item">
              <div className="pf-img">
                <SmartImage src={i.image_url} alt={i.caption || 'Робота'} fill sizes="(max-width: 700px) 50vw, 240px" style={{ objectFit: 'cover' }} />
                <button type="button" className="pf-del" aria-label="Прибрати" onClick={() => void remove(i.id)}>×</button>
              </div>
              {i.caption && <figcaption>{i.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}

      <style jsx>{`
        .pf { padding: 1.5rem 3rem; background: #fff; min-height: 100vh; width: 100%; box-sizing: border-box; color: ${C.text}; }
        .pf-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin: 0.5rem 0 1.5rem; flex-wrap: wrap; }
        .pf-header h2 { font-size: 1.6rem; font-weight: 800; margin: 0; letter-spacing: -0.5px; }
        .pf-header p { margin: 0.35rem 0 0; color: ${C.sub}; font-size: 0.95rem; }
        .pf-btn { height: 40px; padding: 0 1.2rem; border-radius: 10px; border: none; background: ${C.text}; color: #fff; font-family: inherit; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
        .pf-btn:disabled { opacity: .5; }
        .pf-err { color: #d70015; font-size: 0.875rem; margin: -0.8rem 0 1rem; }
        .pf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
        .pf-item { margin: 0; }
        .pf-img { position: relative; aspect-ratio: 4 / 5; border-radius: 14px; overflow: hidden; background: #f1f5f9; }
        .pf-del { position: absolute; top: 8px; right: 8px; width: 30px; height: 30px; border-radius: 50%; border: none; background: rgba(255,255,255,.92); color: ${C.text}; font-size: 1.1rem; cursor: pointer; opacity: 0; transition: opacity .15s; }
        .pf-img:hover .pf-del { opacity: 1; }
        .pf-item figcaption { font-size: 0.85rem; color: ${C.sub}; margin-top: 0.4rem; }
        .pf-drop { width: 100%; max-width: 560px; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 3rem 2rem; border: 1.5px dashed ${C.border}; border-radius: 18px; background: #f8fafc; cursor: pointer; font-family: inherit; text-align: center; }
        .pf-drop b { font-size: 1rem; color: ${C.text}; }
        .pf-drop span { font-size: 0.875rem; color: ${C.sub}; max-width: 360px; line-height: 1.5; }
        .pf-empty { padding: 3rem 0; color: ${C.sub}; }
        @media (hover: none) { .pf-del { opacity: 1; } }
        @media (max-width: 700px) { .pf { padding: 1.25rem 1rem; } .pf-grid { grid-template-columns: repeat(2, 1fr); gap: 0.6rem; } }
      `}</style>
    </div>
  );
}
