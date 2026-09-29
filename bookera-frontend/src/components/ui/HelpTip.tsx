'use client';

import { ReactNode, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * HelpTip - кружечок «?» з поясненням, що робить конкретна функція.
 *
 * Вигляд - той самий, що в «Налаштування -> Онлайн-бронювання ->
 * Доступність вікон для запису»: темна бульбашка зі стрілкою. Але та
 * підказка була лише CSS-наведенням: на телефоні й із клавіатури не
 * відкривалась, а в панелях з overflow: hidden обрізалась.
 *
 * Тут:
 *   - наведення (з невеликою затримкою, щоб не блимала), дотик на
 *     телефоні, фокус із клавіатури; Esc і дотик поза нею - закривають
 *   - бульбашка малюється поверх сторінки (portal), тож не обрізається
 *     краєм панелі; сама обирає зверху чи знизу й не виходить за екран
 *   - aria-describedby для читачів екрана
 *
 * Використання: <span>Інтервал часу <HelpTip>Пояснення…</HelpTip></span>
 */
export default function HelpTip({ children, size = 14, width = 260 }: { children: ReactNode; size?: number; width?: number }) {
  const id = useId();
  const btn = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; arrow: number; below: boolean } | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const show = useCallback(() => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(true), 120); }, []);
  const hide = useCallback(() => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), 80); }, []);

  // Позиція: над кружечком, якщо є місце, інакше під ним; по горизонталі -
  // по центру, але не ближче 8 px до краю екрана.
  useLayoutEffect(() => {
    if (!open || !btn.current || !bubble.current) return;
    const place = () => {
      if (!btn.current || !bubble.current) return;
      const r = btn.current.getBoundingClientRect();
      const b = bubble.current.getBoundingClientRect();
      const below = r.top - b.height - 12 < 8;
      const top = below ? r.bottom + 10 : r.top - b.height - 10;
      const center = r.left + r.width / 2;
      const left = Math.max(8, Math.min(center - b.width / 2, window.innerWidth - b.width - 8));
      setPos({ top, left, arrow: center - left, below });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
  }, [open]);

  // Esc і дотик поза підказкою - закрити
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e: PointerEvent) => {
      if (!btn.current?.contains(e.target as Node) && !bubble.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [open]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <>
      {/* span з роллю кнопки, а не <button>: підказку ставлять і всередину
          кнопок-перемикачів, а кнопка в кнопці ламає розмітку. */}
      <span
        ref={btn}
        role="button"
        tabIndex={0}
        aria-label="Пояснення"
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={() => setOpen(true)}
        onBlur={hide}
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); } }}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          width: size + 6, height: size + 6, margin: '0 0 0 4px', padding: 0, border: 'none', borderRadius: '50%',
          background: 'transparent', color: open ? '#436b49' : '#94a3b8', cursor: 'help', verticalAlign: 'middle',
          transition: 'color .2s', lineHeight: 0,
        }}
      >
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" />
        </svg>
      </span>
      {mounted && open && createPortal(
        <div
          ref={bubble}
          id={id}
          role="tooltip"
          onMouseEnter={show}
          onMouseLeave={hide}
          style={{
            position: 'fixed', zIndex: 3000, top: pos?.top ?? -9999, left: pos?.left ?? -9999, maxWidth: width, width: 'max-content',
            background: '#1e293b', color: '#fff', padding: '0.6rem 0.8rem', borderRadius: 10, fontSize: '0.8rem', lineHeight: 1.45,
            fontWeight: 500, textAlign: 'left', textTransform: 'none', letterSpacing: 0, whiteSpace: 'normal',
            boxShadow: '0 10px 30px -10px rgba(15,23,42,.45)', pointerEvents: 'auto',
            opacity: pos ? 1 : 0, transform: pos ? 'translateY(0)' : 'translateY(4px)', transition: 'opacity .15s, transform .15s',
          }}
        >
          {children}
          <span aria-hidden style={{
            position: 'absolute', left: (pos?.arrow ?? 0) - 5, [pos?.below ? 'bottom' : 'top']: '100%', width: 0, height: 0,
            borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
            ...(pos?.below ? { borderBottom: '5px solid #1e293b' } : { borderTop: '5px solid #1e293b' }),
          } as React.CSSProperties} />
        </div>,
        document.body,
      )}
    </>
  );
}
