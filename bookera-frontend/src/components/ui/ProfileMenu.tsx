'use client';

import Link from 'next/link';

/**
 * Меню аватарки в хедері - ОДНЕ для головної й бізнес-лендінгу.
 *
 * Раніше кожна сторінка мала своє, і вони розійшлись: на головній
 * «Панель салону», на лендінгу «Бізнес-кабінет»; «Налаштування» на
 * головній відкривали вкладку налаштувань профілю, на лендінгу - просто
 * профіль. Тепер обидві сторінки малюють цей компонент.
 */
export default function ProfileMenu({
  userName,
  showCabinet,
  onLogout,
  onNavigate,
}: {
  userName: string | null;
  /** Пункт «Панель салону» - лише власнику чи персоналу закладу. */
  showCabinet: boolean;
  onLogout: () => void;
  /** Закрити меню після переходу. */
  onNavigate?: () => void;
}) {
  return (
    <div className="search-dropdown anim" role="menu" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '210px', padding: '0.4rem', zIndex: 1001, background: '#fff', borderRadius: '14px', border: '1px solid #f1f5f9', boxShadow: '0 18px 40px -12px rgba(0,0,0,.18)' }}>
          <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f1f5f9', marginBottom: '0.25rem' }}>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>Акаунт</div>
            <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#111827', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
          </div>
          <Link href="/account/profile" onClick={onNavigate} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: '8px', color: '#334155', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '550', boxSizing: 'border-box' }}>Мій профіль</Link>
          {showCabinet && (
            <Link href="/cabinet" onClick={onNavigate} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: '8px', color: '#334155', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '550', boxSizing: 'border-box' }}>Панель салону</Link>
          )}
          <Link href="/account/profile?tab=settings" onClick={onNavigate} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: '8px', color: '#334155', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '550', boxSizing: 'border-box' }}>Налаштування</Link>
          <button onClick={onLogout} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 0.75rem', borderRadius: '8px', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '550', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', borderTop: '1px solid #f1f5f9', marginTop: '2px', boxSizing: 'border-box' }}>Вийти з акаунту</button>
        </div>
  );
}
