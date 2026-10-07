'use client';

import { ReactNode, useState } from 'react';

/**
 * Підказка в бічній колонці. За замовчуванням згорнута до одного рядка - не відволікає й не займає місце;
 * розгортається по дотику. Той самий вигляд у всіх розділах кабінету (Клієнти, Маркетинг, Склад, Аналітика, Журнал).
 */
export default function HintCard({ title, children, action, flush = false }: { title: string; children: ReactNode; action?: { label: string; run: () => void } | null; flush?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`hintcard ${open ? 'open' : ''} ${flush ? 'flush' : ''}`}>
      <button type="button" className="hintcard-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2l1.8 5.6L19.5 9l-5.7 1.4L12 16l-1.8-5.6L4.5 9l5.7-1.4L12 2zm6 11l.9 2.6 2.6.9-2.6.9L18 20l-.9-2.6-2.6-.9 2.6-.9L18 13z" /></svg> Підказка</span>
        <svg className="hintcard-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="hintcard-body">
          <b>{title}</b>
          <p>{children}</p>
          {action && <button type="button" className="hintcard-act" onClick={action.run}>{action.label} →</button>}
        </div>
      )}
      <style dangerouslySetInnerHTML={{ __html: `
        .hintcard { background: #f8f7ff; border: 1px solid #ece9fb; border-radius: 12px; margin-top: 0.8rem; }
        .hintcard.flush { margin: auto 1.2rem 1.2rem; }
        .hintcard-head { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0.6rem 0.85rem; border: none; background: none; font-family: inherit; font-size: 0.74rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #7c3aed; cursor: pointer; }
        .hintcard-head span { display: inline-flex; align-items: center; gap: 0.4rem; }
        .hintcard-chev { transition: transform 0.15s ease; }
        .hintcard.open .hintcard-chev { transform: rotate(180deg); }
        .hintcard-body { padding: 0 0.95rem 0.9rem; animation: hintcardIn 0.18s ease; }
        .hintcard-body b { display: block; font-size: 0.86rem; color: #5b21b6; margin-bottom: 0.25rem; }
        .hintcard-body p { margin: 0; font-size: 0.78rem; line-height: 1.5; color: #6d28d9; }
        .hintcard-act { margin-top: 0.55rem; border: none; background: none; padding: 0; font-family: inherit; font-size: 0.8rem; font-weight: 700; color: #7c3aed; cursor: pointer; }
        @keyframes hintcardIn { from { opacity: 0; transform: translateY(-2px); } to { opacity: 1; transform: none; } }
      ` }} />
    </div>
  );
}
