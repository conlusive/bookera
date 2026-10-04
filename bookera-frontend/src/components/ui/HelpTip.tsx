'use client';

import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const WIDTH = 220;
const GAP = 10;
const EDGE = 8;

/**
 * HelpTip - кружечок «?» із поясненням. Стиль - ТОЧНО як у підказок, що
 * вже були в кабінеті («Доступність вікон для запису», «Аналітика»):
 * сіра бульбашка 220px над значком, 0.75rem, текст по центру, радіус 8px.
 *
 * Бульбашка виноситься на рівень сторінки (portal, position: fixed), а не
 * лежить усередині таблиці чи блока: інакше її обрізав би контейнер із
 * прокруткою (так зникала підказка в заголовку таблиці складу). Над значком
 * їй не вистачає місця - перевертається вниз; від країв екрана не вилазить.
 *
 * Відкривається й дотиком на телефоні та з клавіатури (Enter / пробіл),
 * Esc і дотик поза нею закривають. Це span із роллю кнопки - його можна
 * ставити й усередину кнопок-перемикачів.
 */
export default function HelpTip({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean; arrow: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const shown = open || hover;

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  // Місце підказки рахуємо від значка, поки вона відкрита (і при прокрутці / зміні вікна)
  useLayoutEffect(() => {
    if (!shown) { setPos(null); return; }
    const place = () => {
      const icon = ref.current?.getBoundingClientRect();
      const tip = tipRef.current;
      if (!icon || !tip) return;
      const h = tip.offsetHeight;
      const center = icon.left + icon.width / 2;
      const left = Math.min(Math.max(center - WIDTH / 2, EDGE), window.innerWidth - WIDTH - EDGE);
      const below = icon.top - GAP - h < EDGE;
      const top = below ? icon.bottom + GAP : icon.top - GAP - h;
      setPos({ left, top, below, arrow: Math.min(Math.max(center - left, 14), WIDTH - 14) });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
  }, [shown]);

  const font = ref.current && typeof window !== 'undefined' ? getComputedStyle(ref.current).fontFamily : 'inherit';

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
      {shown && typeof document !== 'undefined' && createPortal(
        <span
          ref={tipRef}
          role="tooltip"
          style={{
            position: 'fixed', left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden',
            background: '#334155', color: '#fff', padding: '0.6rem 0.8rem', borderRadius: 8, fontSize: '0.75rem', fontWeight: 500,
            fontFamily: font, lineHeight: 1.4, whiteSpace: 'normal', width: WIDTH, boxSizing: 'border-box', textAlign: 'center', zIndex: 10000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)', pointerEvents: 'none', textTransform: 'none', letterSpacing: 'normal',
          }}
        >
          {children}
          <span aria-hidden style={{
            position: 'absolute', left: pos?.arrow ?? WIDTH / 2, marginLeft: -5, borderWidth: 5, borderStyle: 'solid',
            ...(pos?.below
              ? { bottom: '100%', borderColor: 'transparent transparent #334155 transparent' }
              : { top: '100%', borderColor: '#334155 transparent transparent transparent' }),
          }} />
        </span>,
        document.body,
      )}
    </span>
  );
}
