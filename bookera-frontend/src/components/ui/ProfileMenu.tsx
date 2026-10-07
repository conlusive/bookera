'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { clearWorkplacesCache, useMyWorkplacesState } from '@/lib/useMyWorkplaces';

/**
 * Меню акаунта - ОДНЕ на всіх сторінках: головна, бізнес-лендінг, сторінка закладу,
 * профіль і кабінет салону. Раніше кожне місце мало своє, з різним складом і різним
 * виглядом (у кабінеті «Налаштування» взагалі вели на неіснуючий /profile).
 *
 * Склад - лише необхідне: профіль, візити, налаштування, робота й панель салону (якщо є),
 * перемикач «Для бізнесу / Для клієнтів» і вихід. Улюблені й бонуси - вкладки самого профілю.
 *   site     - сторінки для клієнтів
 *   business - бізнес-лендінг: замість «Для бізнесу» - «Для клієнтів»
 *   cabinet  - кабінет салону: «Головна сторінка» замість розділів клієнта
 */
export type MenuContext = 'site' | 'business' | 'cabinet';

const ico = (d: ReactNode) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
);
const I = {
  user: ico(<><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c.9-3.6 3.7-5.4 7.5-5.4s6.6 1.8 7.5 5.4" /></>),
  calendar: ico(<><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>),
  gear: ico(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>),
  work: ico(<><rect x="3" y="7" width="18" height="13" rx="3" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></>),
  panel: ico(<><rect x="3.5" y="3.5" width="7" height="9" rx="2" /><rect x="13.5" y="3.5" width="7" height="5" rx="2" /><rect x="13.5" y="11.5" width="7" height="9" rx="2" /><rect x="3.5" y="15.5" width="7" height="5" rx="2" /></>),
  building: ico(<><path d="M4 21V7l8-4 8 4v14" /><path d="M9 21v-6h6v6M8.5 10h.01M15.5 10h.01M12 10h.01" /></>),
  home: ico(<><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v10h13V10" /></>),
  logout: ico(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>),
};

export default function ProfileMenu({
  showCabinet,
  context = 'site',
  onLogout,
  onNavigate,
  style,
}: {
  /** Пункт «Панель салону» - лише власнику чи персоналу закладу. */
  showCabinet: boolean;
  context?: MenuContext;
  onLogout: () => void;
  /** Закрити меню після переходу. */
  onNavigate?: () => void;
  /** Своє розташування (у кабінеті меню відкривається вгору й убік). */
  style?: CSSProperties;
}) {
  const { list: workplaces, ready } = useMyWorkplacesState(true);
  // «Моя робота» - лише тим, хто працює в салоні; у самому кабінеті - лише якщо салонів кілька
  const showWork = context === 'cabinet' ? workplaces.length > 1 : workplaces.length > 0;
  const hasCabinet = showCabinet || workplaces.length > 0;

  const item = (href: string, icon: ReactNode, label: string, key?: string) => (
    <Link key={key || href + label} href={href} className="um-item" role="menuitem" onClick={onNavigate}>{icon}<span>{label}</span></Link>
  );
  const sep = (k: string) => <div key={k} className="um-sep" />;

  return (
    <div className="um" role="menu" aria-busy={!ready} style={style}>
      {!ready ? (
        // Поки не відомо, де людина працює, склад меню неповний: замість «спершу два пункти, потім решта» - рівні заглушки
        [0, 1, 2, 3].map(i => <div key={i} className="um-skel" style={{ width: `${70 - i * 8}%` }} />)
      ) : context !== 'cabinet' ? (
        <>
          {item('/account/profile', I.user, 'Мій профіль')}
          {item('/account/profile?tab=appointments', I.calendar, 'Мої візити')}
          {item('/account/profile?tab=settings', I.gear, 'Налаштування')}
          {hasCabinet && sep('s1')}
          {hasCabinet && item('/cabinet', I.panel, 'Мій кабінет')}
          {workplaces.length > 1 && item('/account/profile?tab=work', I.work, 'Моя робота')}
        </>
      ) : (
        <>
          {item('/', I.home, 'Головна сторінка')}
          {item('/account/profile', I.user, 'Мій профіль')}
          {showWork && item('/account/profile?tab=work', I.work, 'Моя робота')}
        </>
      )}

      {ready && sep('s3')}
      {!ready && <div className="um-sep" />}
      <button type="button" className="um-item um-out" role="menuitem" onClick={() => { clearWorkplacesCache(); onLogout(); }}>{I.logout}<span>Вийти</span></button>

      <style jsx global>{`
        .um { position: absolute; top: calc(100% + 6px); right: .5rem; width: 212px; padding: .3rem; z-index: 1001; background: #fff; border-radius: 14px; border: 1px solid #eef0f3; box-shadow: 0 18px 44px -14px rgba(15, 23, 42, .22); animation: umIn .14s ease-out; font-family: inherit; text-align: left; }
        @keyframes umIn { from { opacity: 0; transform: translateY(-4px) scale(.98); } to { opacity: 1; transform: none; } }
        .um-item { display: flex; align-items: center; gap: .6rem; width: 100%; box-sizing: border-box; padding: .44rem .6rem; border: none; border-radius: 9px; background: transparent; color: #334155; font-family: inherit; font-size: .85rem; font-weight: 500; text-decoration: none; cursor: pointer; text-align: left; transition: background .12s ease, color .12s ease; }
        .um-item svg { flex: none; color: #94a3b8; transition: color .12s ease; }
        .um-item:hover { background: #f4f6f8; color: #0f172a; }
        .um-item:hover svg { color: #475569; }
        .um-skel { height: 16px; border-radius: 6px; background: linear-gradient(90deg, #f1f5f9, #e8edf3, #f1f5f9); background-size: 200% 100%; animation: umSk 1.1s linear infinite; margin: .62rem .6rem; }
        @keyframes umSk { from { background-position: 100% 0; } to { background-position: -100% 0; } }
        .um-sep { height: 1px; background: #f1f5f9; margin: .25rem .3rem; }
        .um-out { color: #dc2626; }
        .um-out svg { color: #f08a8a; }
        .um-out:hover { background: #fef2f2; color: #b91c1c; }
        .um-out:hover svg { color: #dc2626; }
      `}</style>
    </div>
  );
}
