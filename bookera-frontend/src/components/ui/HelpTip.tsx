'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';

/**
 * HelpTip - кружечок «?» із поясненням. Стиль - ТОЧНО як у підказок, що
 * вже були в кабінеті («Доступність вікон для запису», «Аналітика»):
 * сіра бульбашка 220px над значком, 0.75rem, текст по центру, радіус 8px.
 *
 * Бульбашка лежить поруч зі значком (а не поверх сторінки), тож бере
 * шрифт того місця, де стоїть, - як і старі підказки.
 *
 * Понад старі: відкривається й дотиком на телефоні та з клавіатури
 * (Enter / пробіл), Esc і дотик поза нею закривають. Це span із роллю
 * кнопки - його можна ставити й усередину кнопок-перемикачів.
 */
export default function HelpTip({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const shown = open || hover;

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <span
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label="Пояснення"
      aria-expanded={shown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); } }}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 6, cursor: 'help', verticalAlign: 'middle', outline: 'none' }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={shown ? '#436b49' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transition: '0.2s' }}>
        <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span
        role="tooltip"
        style={{
          visibility: shown ? 'visible' : 'hidden', opacity: shown ? 1 : 0,
          position: 'absolute', bottom: '130%', left: '50%', transform: `translateX(-50%) translateY(${shown ? 0 : 5}px)`,
          background: '#334155', color: '#fff', padding: '0.6rem 0.8rem', borderRadius: 8, fontSize: '0.75rem', fontWeight: 500,
          lineHeight: 1.4, whiteSpace: 'normal', width: 220, textAlign: 'center', zIndex: 100, transition: 'all 0.2s',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', pointerEvents: 'none', textTransform: 'none', letterSpacing: 'normal',
        }}
      >
        {children}
        <span aria-hidden style={{ position: 'absolute', top: '100%', left: '50%', marginLeft: -5, borderWidth: 5, borderStyle: 'solid', borderColor: '#334155 transparent transparent transparent' }} />
      </span>
    </span>
  );
}
