'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';

/**
 * FormModal - єдиний шаблон модального вікна для заповнення форм у кабінеті.
 *
 * Однаково скрізь:
 *   - шапка: заголовок, підзаголовок, хрестик
 *   - тіло прокручується, шапка й низ - на місці
 *   - низ: головна дія праворуч, «Скасувати» поруч, небезпечна дія
 *     (видалити) ліворуч - з підтвердженням прямо в кнопці, без
 *     системного confirm(), який виглядає чужим і блокує сторінку
 *   - Esc і клік поза вікном закривають (крім моменту збереження)
 *   - Ctrl/⌘ + Enter - зберегти
 *   - сторінка під вікном не прокручується
 *
 * Поля - через <FormSection> і <Field>, стилі інпутів - клас fm-input.
 */

type Action = { label: string; onClick: () => void; loading?: boolean; disabled?: boolean; danger?: boolean };

export default function FormModal({
  open, onClose, title, subtitle, children, primary, secondary, danger, width = 640,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  primary: Action;
  secondary?: { label: string; onClick: () => void };
  danger?: { label: string; confirmLabel?: string; onClick: () => void };
  width?: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const busy = !!primary.loading;
  const primaryRef = useRef(primary);
  primaryRef.current = primary;

  useEffect(() => {
    if (!open) { setConfirming(false); return; }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !primaryRef.current.loading) onClose();
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        const p = primaryRef.current;
        if (!p.loading && !p.disabled) p.onClick();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fm-overlay" onMouseDown={() => !busy && onClose()}>
      <div className="fm" role="dialog" aria-modal="true" aria-label={title} style={{ maxWidth: width }} onMouseDown={e => e.stopPropagation()}>
        <header className="fm-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="fm-x" aria-label="Закрити" onClick={() => !busy && onClose()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </header>

        <div className="fm-body">{children}</div>

        <footer className="fm-foot">
          {danger ? (
            confirming ? (
              <span className="fm-confirm">
                <span>{danger.confirmLabel || 'Точно видалити?'}</span>
                <button type="button" className="fm-btn danger" onClick={danger.onClick}>Так, видалити</button>
                <button type="button" className="fm-btn ghost" onClick={() => setConfirming(false)}>Ні</button>
              </span>
            ) : (
              <button type="button" className="fm-btn link-danger" onClick={() => setConfirming(true)}>{danger.label}</button>
            )
          ) : <span />}
          {!confirming && (
            <span className="fm-actions">
              <button type="button" className="fm-btn ghost" onClick={secondary?.onClick || onClose} disabled={busy}>{secondary?.label || 'Скасувати'}</button>
              <button type="button" className={`fm-btn ${primary.danger ? 'danger' : 'primary'}`} onClick={primary.onClick} disabled={busy || primary.disabled}>
                {busy ? 'Зберігаємо…' : primary.label}
              </button>
            </span>
          )}
        </footer>
      </div>

      <style jsx global>{`
        .fm-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(15,23,42,.45); backdrop-filter: blur(3px);
          display: flex; align-items: center; justify-content: center; padding: 1.25rem; animation: fmFade .18s ease; }
        .fm { width: 100%; max-height: min(92vh, 900px); background: #fff; border-radius: 20px; display: flex; flex-direction: column;
          box-shadow: 0 30px 80px -20px rgba(15,23,42,.45); animation: fmIn .24s cubic-bezier(.16,1,.3,1); overflow: hidden; }
        .fm-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; padding: 1.4rem 1.6rem 1rem; border-bottom: 1px solid #f1f5f9; }
        .fm-head h2 { font-size: 1.3rem; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: -0.02em; }
        .fm-head p { font-size: 0.875rem; color: #64748b; margin: 0.3rem 0 0; }
        .fm-x { width: 34px; height: 34px; border-radius: 50%; border: none; background: #f1f5f9; color: #64748b; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        .fm-x:hover { background: #e2e8f0; color: #0f172a; }
        .fm-body { padding: 1.25rem 1.6rem 1.5rem; overflow-y: auto; display: flex; flex-direction: column; gap: 1.5rem; }
        .fm-foot { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 1rem 1.6rem; border-top: 1px solid #f1f5f9; background: #fff; }
        .fm-actions, .fm-confirm { display: flex; align-items: center; gap: 0.5rem; }
        .fm-confirm span { font-size: 0.875rem; font-weight: 600; color: #dc2626; margin-right: 0.25rem; }
        .fm-btn { height: 40px; padding: 0 1.15rem; border-radius: 10px; border: none; font-family: inherit; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: background-color .15s, opacity .15s; }
        .fm-btn:disabled { opacity: .45; cursor: default; }
        .fm-btn.primary { background: #0f172a; color: #fff; }
        .fm-btn.primary:hover:not(:disabled) { background: #1e293b; }
        .fm-btn.ghost { background: #fff; color: #0f172a; border: 1px solid #e2e8f0; }
        .fm-btn.ghost:hover:not(:disabled) { background: #f8fafc; }
        .fm-btn.danger { background: #dc2626; color: #fff; }
        .fm-btn.link-danger { background: none; color: #dc2626; padding: 0 0.25rem; }
        .fm-btn.link-danger:hover { text-decoration: underline; }

        .fm-section { display: flex; flex-direction: column; gap: 0.9rem; }
        .fm-section-head h3 { font-size: 0.95rem; font-weight: 700; color: #0f172a; margin: 0; }
        .fm-section-head p { font-size: 0.8rem; color: #64748b; margin: 0.2rem 0 0; }
        .fm-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; }
        .fm-field { display: flex; flex-direction: column; gap: 0.4rem; min-width: 0; }
        .fm-label { font-size: 0.8rem; font-weight: 600; color: #334155; }
        .fm-label em { font-style: normal; color: #dc2626; margin-left: 2px; }
        .fm-hint { font-size: 0.75rem; color: #64748b; }
        .fm-error { font-size: 0.75rem; color: #dc2626; }
        .fm-input { width: 100%; box-sizing: border-box; height: 42px; padding: 0 0.85rem; border-radius: 10px; border: 1px solid #e2e8f0; background: #fff;
          font-family: inherit; font-size: 0.925rem; color: #0f172a; outline: none; transition: border-color .15s, box-shadow .15s; }
        /* Опис - фіксованої висоти: поле не розтягується й не ламає вікно */
        textarea.fm-input { height: 96px; padding: 0.7rem 0.85rem; resize: none; line-height: 1.5; overflow-y: auto; }
        /* Без стрілочок браузера в числових полях */
        .fm-input[type='number']::-webkit-outer-spin-button, .fm-input[type='number']::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .fm-input[type='number'] { -moz-appearance: textfield; }
        .fm-counter { font-size: 0.72rem; color: #94a3b8; text-align: right; margin-top: -0.2rem; }
        .fm-chips { display: flex; flex-wrap: wrap; gap: 0.35rem; }
        .fm-chip { height: 30px; padding: 0 0.75rem; border-radius: 999px; border: 1px solid #e2e8f0; background: #fff; font-family: inherit; font-size: 0.8rem; color: #334155; cursor: pointer; transition: all .15s; }
        .fm-chip:hover { border-color: #cbd5e1; background: #f8fafc; }
        .fm-chip.on { background: #0f172a; border-color: #0f172a; color: #fff; }
        .fm-check { appearance: none; -webkit-appearance: none; width: 18px; height: 18px; border-radius: 6px; border: 1.5px solid #cbd5e1; background: #fff; cursor: pointer; flex-shrink: 0; display: inline-grid; place-content: center; transition: all .15s; margin: 0; }
        .fm-check:checked { background: #0f172a; border-color: #0f172a; }
        .fm-check:checked::after { content: ''; width: 9px; height: 5px; border-left: 2px solid #fff; border-bottom: 2px solid #fff; transform: rotate(-45deg) translate(1px, -1px); }

        /* Розгортний блок - для необовʼязкових розділів форми */
        .fm-disc { border: 1px solid #e2e8f0; border-radius: 14px; background: #fff; }
        .fm-disc > button { width: 100%; display: flex; align-items: center; gap: 0.75rem; padding: 0.9rem 1rem; border: none; background: none; cursor: pointer; font-family: inherit; text-align: left; border-radius: 14px; }
        .fm-disc > button:hover { background: #f8fafc; }
        .fm-disc-ico { width: 34px; height: 34px; border-radius: 10px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; color: #0f172a; flex-shrink: 0; }
        .fm-disc-text { flex: 1; min-width: 0; }
        .fm-disc-text b { display: block; font-size: 0.9rem; font-weight: 700; color: #0f172a; }
        .fm-disc-text small { display: block; font-size: 0.78rem; color: #64748b; margin-top: 1px; }
        .fm-disc-chev { color: #94a3b8; transition: transform .2s; }
        .fm-disc.open .fm-disc-chev { transform: rotate(180deg); }
        .fm-disc-body { padding: 0 1rem 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
        .fm-input:focus { border-color: #0f172a; box-shadow: 0 0 0 3px rgba(15,23,42,.08); }
        .fm-input.invalid { border-color: #dc2626; }
        .fm-affix { position: relative; }
        .fm-affix .fm-input { padding-right: 2.2rem; }
        .fm-affix span { position: absolute; right: 0.85rem; top: 50%; transform: translateY(-50%); color: #64748b; font-size: 0.9rem; pointer-events: none; }

        @keyframes fmFade { from { opacity: 0; } }
        @keyframes fmIn { from { opacity: 0; transform: translateY(10px) scale(.985); } }
        @media (max-width: 640px) {
          .fm-overlay { padding: 0; align-items: flex-end; }
          .fm { max-height: 94vh; border-radius: 20px 20px 0 0; }
          .fm-row { grid-template-columns: 1fr; }
          .fm-foot { flex-wrap: wrap; }
        }
      `}</style>
    </div>
  );
}

export function FormSection({ title, hint, children }: { title?: string; hint?: string; children: ReactNode }) {
  return (
    <section className="fm-section">
      {(title || hint) && <div className="fm-section-head">{title && <h3>{title}</h3>}{hint && <p>{hint}</p>}</div>}
      {children}
    </section>
  );
}

export function Field({ label, required, hint, error, children }: { label: string; required?: boolean; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="fm-field">
      <span className="fm-label">{label}{required && <em>*</em>}</span>
      {children}
      {error ? <span className="fm-error">{error}</span> : hint ? <span className="fm-hint">{hint}</span> : null}
    </label>
  );
}


/**
 * Розгортний блок для необовʼязкових розділів форми (додаткові послуги,
 * матеріали): згорнутий показує підсумок, щоб вікно не було перевантажене.
 */
export function FormDisclosure({ title, summary, icon, defaultOpen = false, children }: {
  title: string; summary?: string; icon?: ReactNode; defaultOpen?: boolean; children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`fm-disc ${open ? 'open' : ''}`}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {icon && <span className="fm-disc-ico">{icon}</span>}
        <span className="fm-disc-text"><b>{title}</b>{summary && <small>{summary}</small>}</span>
        <svg className="fm-disc-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && <div className="fm-disc-body">{children}</div>}
    </div>
  );
}
