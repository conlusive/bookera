'use client';

import Link from 'next/link';

/**
 * Підвал сайту - ОДИН на головній і на бізнес-лендінгу (раніше кожна сторінка мала
 * свою копію, і вони розійшлись: на лендінгу бракувало колонок і посилань).
 */
export default function SiteFooter() {
  return (
      <footer className="clean-dark-footer" style={{ marginTop: 'auto', position: 'relative', overflow: 'hidden' }}>
        <div className="container">

          <div className="footer-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: '3rem', marginBottom: '3.5rem' }}>
            <div>
              <Link href="/" style={{ textDecoration: 'none', display: 'inline-block', marginBottom: '1rem' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: '900', color: '#ffffff', letterSpacing: '-0.04em' }}>
                  Book<span style={{ color: '#8fae92' }}>Era</span>
                </div>
              </Link>
              <p style={{ color: '#94A3B8', fontSize: '0.88rem', lineHeight: '1.6', margin: '0 0 1.25rem 0', maxWidth: '300px' }}>
                Простий та надійний онлайн-запис до перевірених майстрів і салонів краси у вашому місті.
              </p>
            </div>

            <div>
              <div className="footer-col-title">Можливості</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <Link href="/" className="footer-nav-link">Онлайн-запис</Link>
                <Link href="/" className="footer-nav-link">Пошук закладів</Link>
                <Link href="/" className="footer-nav-link">Подарункові сертифікати</Link>
                <Link href="/account/profile" className="footer-nav-link">Особистий кабінет</Link>
              </div>
            </div>

            <div>
              <div className="footer-col-title">Для бізнесу</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <Link href="/business" className="footer-nav-link" style={{ color: '#C2D8C4', fontWeight: 600 }}>BookEra Business</Link>
                <Link href="/business/register" className="footer-nav-link">Підключити салон</Link>
                <Link href="/cabinet" className="footer-nav-link">Панель керування CRM</Link>
                <Link href="/business#features" className="footer-nav-link">Можливості для бізнесу</Link>
              </div>
            </div>

            <div>
              <div className="footer-col-title">Підтримка</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <Link href="#" className="footer-nav-link">Служба турботи</Link>
                <Link href="/#faq" className="footer-nav-link">Поширені запитання</Link>
                <Link href="#" className="footer-nav-link">Безпека клієнтів</Link>
                <Link href="#" className="footer-nav-link">Контакти команди</Link>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                <Link href="#" className="footer-legal" style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', textDecoration: 'none', letterSpacing: '0.04em' }}>ПОЛІТИКА КОНФІДЕНЦІЙНОСТІ</Link>
                <Link href="#" className="footer-legal" style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', textDecoration: 'none', letterSpacing: '0.04em' }}>УМОВИ ВИКОРИСТАННЯ</Link>
                <Link href="#" className="footer-legal" style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', textDecoration: 'none', letterSpacing: '0.04em' }}>БЕЗПЕКА</Link>
              </div>

              <div style={{ color: '#64748B', fontSize: '0.78rem' }}>
                © 2026 BookEra. Платформа онлайн-запису до закладів краси в Україні.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', color: '#64748B', fontSize: '0.82rem', fontWeight: 500 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                SSL Захист
              </span>
              <span>•</span>
              <span>Україна • UA</span>
            </div>
          </div>

        </div>

        {/* ВЕСЕЛИЙ КОТИК В НИЗУ ФУТЕРА */}
        <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none', userSelect: 'none', zIndex: 12, lineHeight: 0 }}>
          <svg width="84" height="42" viewBox="0 0 100 50" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
            <path d="M20 50 C20 22, 80 22, 80 50 Z" fill="#1C1D22" stroke="#2D2F36" strokeWidth="1.5" />
            <polygon points="26,30 20,8 38,22" fill="#1C1D22" stroke="#2D2F36" strokeWidth="1.5" />
            <polygon points="27,27 23,13 35,21" fill="#FFB4C2" />
            <polygon points="74,30 80,8 62,22" fill="#1C1D22" stroke="#2D2F36" strokeWidth="1.5" />
            <polygon points="73,27 77,13 65,21" fill="#FFB4C2" />
            <ellipse cx="40" cy="34" rx="3.5" ry="4.5" fill="#C2D8C4" />
            <circle cx="41" cy="33" r="1.5" fill="#111" />
            <ellipse cx="60" cy="34" rx="3.5" ry="4.5" fill="#C2D8C4" />
            <circle cx="61" cy="33" r="1.5" fill="#111" />
            <polygon points="50,38 47,35 53,35" fill="#FFB4C2" />
            <line x1="33" y1="36" x2="18" y2="34" stroke="#64748B" strokeWidth="1" strokeLinecap="round" />
            <line x1="33" y1="38" x2="19" y2="39" stroke="#64748B" strokeWidth="1" strokeLinecap="round" />
            <line x1="67" y1="36" x2="82" y2="34" stroke="#64748B" strokeWidth="1" strokeLinecap="round" />
            <line x1="67" y1="38" x2="81" y2="39" stroke="#64748B" strokeWidth="1" strokeLinecap="round" />
            <ellipse cx="28" cy="48" rx="6" ry="4" fill="#2D2F36" stroke="#111" strokeWidth="1" />
            <ellipse cx="72" cy="48" rx="6" ry="4" fill="#2D2F36" stroke="#111" strokeWidth="1" />
          </svg>
        </div>
        <style jsx global>{`
        /* Телефон: колонки футера у дві, бренд на всю ширину, посилання з зручною зоною натискання */
        @media (max-width: 860px) {
          .footer-grid { grid-template-columns: 1fr 1fr !important; gap: 2rem 1.5rem !important; margin-bottom: 2.5rem !important; }
          .footer-grid > div:first-child { grid-column: 1 / -1; }
          .footer-nav-link { padding: 0.6rem 0; }
          .footer-legal { display: inline-block; padding: 0.5rem 0; }
          .clean-dark-footer { padding-top: 3rem !important; }
        }
        .clean-dark-footer {
          background-color: #111215;
          color: #ffffff;
          padding: 4.5rem 0 2.5rem 0;
          position: relative;
          z-index: 10;
        }
        .footer-col-title {
          color: #ffffff;
          font-size: 0.82rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 1.35rem;
        }
        .footer-nav-link {
          color: #94A3B8;
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 500;
          transition: color 0.15s ease, transform 0.15s ease;
          display: inline-block;
          line-height: 1.5;
        }
        .footer-nav-link:hover {
          color: #ffffff;
          transform: translateX(2px);
        }

        `}</style>
      </footer>
  );
}
