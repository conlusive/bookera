'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, PromotionRow } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';
import { notify } from '@/lib/feedback';

/**
 * Соцмережі: картинка для посту чи сторіс - готова до публікації.
 * Обираєте формат і стиль, пишете заголовок (чи беретеся з акції), за бажанням додаєте своє фото -
 * малюємо картинку з назвою закладу й підписом BookEra. Публікуєте самі в Instagram, Facebook чи Telegram:
 * завантажте картинку або поділіться нею з телефона. Нічого не надсилається назовні й нікуди не зберігається.
 */

type FormatId = 'post' | 'story';
const FORMATS: Record<FormatId, { label: string; w: number; h: number; hint: string }> = {
  post: { label: 'Пост', w: 1080, h: 1350, hint: '4:5 - Instagram, Facebook' },
  story: { label: 'Сторіс', w: 1080, h: 1920, hint: '9:16 - Stories, Reels, Telegram' },
};

type Style = { id: string; label: string; bg: [string, string]; ink: string; soft: string; accent: string };
const STYLES: Style[] = [
  { id: 'sage', label: 'М’який', bg: ['#EEF4EF', '#DCE8DE'], ink: '#1d2a20', soft: '#516355', accent: '#5E7A61' },
  { id: 'night', label: 'Темний', bg: ['#14181d', '#232a33'], ink: '#ffffff', soft: '#b6bfcb', accent: '#C8E0CB' },
  { id: 'sand', label: 'Теплий', bg: ['#FBF3E8', '#F3E2CC'], ink: '#3a2a17', soft: '#7d6648', accent: '#B57C3A' },
  { id: 'rose', label: 'Рожевий', bg: ['#FCEFF2', '#F7D9E1'], ink: '#4a1f2b', soft: '#8a5565', accent: '#C2557A' },
];

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; } else line = test;
    }
    lines.push(line);
  }
  return lines;
}

export default function SocialPanel({ business, directUrl }: { business: any; directUrl?: string }) {
  const [format, setFormat] = useState<FormatId>('post');
  const [styleId, setStyleId] = useState('sage');
  const [headline, setHeadline] = useState('');
  const [sub, setSub] = useState('');
  const [footer, setFooter] = useState('Запис онлайн');
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [promos, setPromos] = useState<PromotionRow[]>([]);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bid = Number(business?.id);
  const name = business?.name || 'Ваш заклад';

  useEffect(() => {
    if (!bid) return;
    void (async () => { try { setPromos((await api.listPromotions(await getAuthToken(), bid)).filter(p => p.is_active)); } catch { /* без акцій - вручну */ } })();
  }, [bid]);

  const fillFromPromo = (p: PromotionRow) => {
    setHeadline(`−${p.discount_percent}%`);
    setSub(`${p.name}\n${p.label.replace(/^−\d+%\s*/, '') || 'у нас'}`);
  };

  const style = STYLES.find(s => s.id === styleId) || STYLES[0];

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h } = FORMATS[format];
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const font = '"Inter", "SF Pro Display", system-ui, -apple-system, "Segoe UI", sans-serif';

    // фон: градієнт або фото з затемненням
    if (photo) {
      const r = Math.max(w / photo.width, h / photo.height);
      const pw = photo.width * r, ph = photo.height * r;
      ctx.drawImage(photo, (w - pw) / 2, (h - ph) / 2, pw, ph);
      const shade = ctx.createLinearGradient(0, 0, 0, h);
      shade.addColorStop(0, 'rgba(0,0,0,0.25)'); shade.addColorStop(0.5, 'rgba(0,0,0,0.35)'); shade.addColorStop(1, 'rgba(0,0,0,0.7)');
      ctx.fillStyle = shade; ctx.fillRect(0, 0, w, h);
    } else {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, style.bg[0]); g.addColorStop(1, style.bg[1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = style.accent; ctx.globalAlpha = 0.1;
      ctx.beginPath(); ctx.arc(w * 0.9, h * 0.12, w * 0.38, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(w * 0.05, h * 0.95, w * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    const ink = photo ? '#ffffff' : style.ink;
    const soft = photo ? 'rgba(255,255,255,0.85)' : style.soft;
    const accent = photo ? '#ffffff' : style.accent;
    const pad = 88;
    const maxW = w - pad * 2;

    // назва закладу зверху
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = soft; ctx.font = `600 40px ${font}`;
    ctx.fillText(name.toUpperCase().slice(0, 36), pad, pad + 40);
    ctx.fillStyle = accent; ctx.fillRect(pad, pad + 70, 72, 6);

    // заголовок - великий, підбираємо розмір під ширину
    const head = headline.trim() || 'Ваш заголовок';
    let size = format === 'story' ? 220 : 190;
    for (; size > 70; size -= 6) { ctx.font = `800 ${size}px ${font}`; if (wrap(ctx, head, maxW).length <= 3 && wrap(ctx, head, maxW).every(l => ctx.measureText(l).width <= maxW)) break; }
    ctx.font = `800 ${size}px ${font}`;
    const headLines = wrap(ctx, head, maxW);
    const blockH = headLines.length * size * 1.04;
    let y = h / 2 - blockH / 2 + size * 0.85 - (format === 'story' ? 60 : 30);
    ctx.fillStyle = ink;
    for (const line of headLines) { ctx.fillText(line, pad, y); y += size * 1.04; }

    // підпис
    const text = sub.trim();
    if (text) {
      ctx.font = `500 ${format === 'story' ? 58 : 52}px ${font}`;
      ctx.fillStyle = soft;
      y += 24;
      for (const line of wrap(ctx, text, maxW)) { ctx.fillText(line, pad, y); y += (format === 'story' ? 76 : 68); }
    }

    // низ: заклик і BookEra
    ctx.font = `700 46px ${font}`; ctx.fillStyle = ink;
    ctx.fillText(footer.trim() || 'Запис онлайн', pad, h - pad - 70);
    ctx.font = `800 52px ${font}`;
    ctx.fillStyle = photo ? '#ffffff' : '#222222'; ctx.fillText('Book', pad, h - pad);
    const bw = ctx.measureText('Book').width;
    ctx.fillStyle = photo ? '#C8E0CB' : '#8fae92'; ctx.fillText('Era', pad + bw, h - pad);
  }, [format, style, headline, sub, footer, photo, name]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => { void document.fonts?.ready.then(draw); }, [draw]);

  const onPhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return notify('Оберіть зображення', 'error');
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setPhoto(img); URL.revokeObjectURL(url); };
    img.onerror = () => notify('Не вдалося відкрити фото', 'error');
    img.src = url;
  };

  const toBlob = () => new Promise<Blob | null>(res => canvasRef.current?.toBlob(b => res(b), 'image/png'));
  const download = async () => {
    const blob = await toBlob();
    if (!blob) return notify('Не вдалося зберегти картинку', 'error');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${business?.slug || 'post'}-${format}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const share = async () => {
    const blob = await toBlob();
    if (!blob) return;
    const file = new File([blob], `${business?.slug || 'post'}-${format}.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], text: caption }); } catch { /* закрили вікно */ }
    } else void download();
  };

  const caption = useMemo(() => {
    const lines = [headline.trim(), sub.trim().replace(/\n/g, ' · '), directUrl ? `Запис онлайн: ${directUrl}` : ''].filter(Boolean);
    return lines.join('\n');
  }, [headline, sub, directUrl]);

  const canShare = typeof navigator !== 'undefined' && !!navigator.canShare;

  return (
    <div className="sp">
      <div className="sp-form">
        <div className="sp-head">
          <h2>Соцмережі</h2>
          <p>Створіть картинку для посту чи сторіс і опублікуйте у своєму Instagram, Facebook чи Telegram. Внизу буде назва закладу й BookEra.</p>
        </div>

        <label className="sp-lbl">Формат</label>
        <div className="sp-chips">
          {(Object.keys(FORMATS) as FormatId[]).map(f => (
            <button key={f} type="button" className={format === f ? 'on' : ''} onClick={() => setFormat(f)} title={FORMATS[f].hint}>{FORMATS[f].label}</button>
          ))}
        </div>

        {promos.length > 0 && (
          <>
            <label className="sp-lbl">Взяти з акції</label>
            <div className="sp-chips">
              {promos.slice(0, 5).map(p => <button key={p.id} type="button" onClick={() => fillFromPromo(p)}>−{p.discount_percent}% · {p.name}</button>)}
            </div>
          </>
        )}

        <label className="sp-lbl">Заголовок</label>
        <input className="clean-input" maxLength={40} value={headline} placeholder="Наприклад: −50% на манікюр" onChange={e => setHeadline(e.target.value)} />
        <label className="sp-lbl">Підпис</label>
        <textarea className="clean-input sp-text" maxLength={120} value={sub} placeholder={'Щодня з 8:00 до 10:00\nЗапишіться онлайн'} onChange={e => setSub(e.target.value)} />
        <label className="sp-lbl">Заклик знизу</label>
        <input className="clean-input" maxLength={40} value={footer} onChange={e => setFooter(e.target.value)} />

        <label className="sp-lbl">Фон</label>
        <div className="sp-chips">
          {STYLES.map(s => (
            <button key={s.id} type="button" className={!photo && styleId === s.id ? 'on' : ''} onClick={() => { setStyleId(s.id); setPhoto(null); }}>
              <i style={{ background: `linear-gradient(135deg, ${s.bg[0]}, ${s.bg[1]})`, borderColor: s.accent }} />{s.label}
            </button>
          ))}
          <button type="button" className={photo ? 'on' : ''} onClick={() => fileRef.current?.click()}>{photo ? 'Змінити фото' : 'Своє фото'}</button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        <p className="sp-note">Фото лишається у вашому браузері й нікуди не завантажується.</p>
      </div>

      <div className="sp-out">
        <div className={`sp-canvas ${format}`}><canvas ref={canvasRef} aria-label="Попередній перегляд картинки" /></div>
        <div className="sp-actions">
          <button type="button" className="clean-btn" onClick={() => void download()}>Завантажити PNG</button>
          {canShare && <button type="button" className="clean-btn-ghost" onClick={() => void share()}>Поділитися</button>}
          <button type="button" className="clean-btn-ghost" disabled={!caption} onClick={() => { void navigator.clipboard?.writeText(caption); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>{copied ? 'Скопійовано ✓' : 'Копіювати текст до посту'}</button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .sp { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 420px); gap: 2.2rem; align-items: start; }
        .sp-head h2 { margin: 0 0 0.2rem; font-size: 1.25rem; font-weight: 800; color: #0f172a; }
        .sp-head p { margin: 0 0 0.6rem; font-size: 0.88rem; color: #64748b; line-height: 1.45; max-width: 520px; }
        .sp-form { display: flex; flex-direction: column; gap: 0.35rem; }
        .sp-lbl { font-size: 0.78rem; font-weight: 600; color: #475569; margin-top: 0.7rem; }
        .sp-chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
        .sp-chips button { display: inline-flex; align-items: center; gap: 0.45rem; height: 34px; padding: 0 0.9rem; border-radius: 999px; border: 1px solid #e2e8f0; background: #fff; color: #334155; font-family: inherit; font-size: 0.84rem; font-weight: 600; cursor: pointer; }
        .sp-chips button.on { background: #0f172a; border-color: #0f172a; color: #fff; }
        .sp-chips i { width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid; display: block; }
        .sp-text { min-height: 74px; resize: vertical; line-height: 1.45; }
        .sp-note { margin: 0.2rem 0 0; font-size: 0.75rem; color: #94a3b8; }
        .sp-out { position: sticky; top: 0.5rem; display: flex; flex-direction: column; gap: 0.9rem; }
        .sp-canvas { border-radius: 14px; overflow: hidden; border: 1px solid #e8ecf0; background: #f8fafc; }
        .sp-canvas canvas { display: block; width: 100%; height: auto; }
        .sp-canvas.story { max-width: 300px; }
        .sp-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        @media (max-width: 980px) { .sp { grid-template-columns: 1fr; } .sp-out { position: static; } .sp-canvas.story { max-width: 260px; } }
      ` }} />
    </div>
  );
}
