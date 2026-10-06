'use client';

import Link from 'next/link';

/** Тихий перехід для бізнесу: один рядок із двома посиланнями (ті самі адреси, що й були). */
export default function BusinessStrip() {
  return (
    <section className="bs">
      <div className="container bs-in">
        <div>
          <h2>Ви майстер чи власник салону?</h2>
          <p>Онлайн-запис, календар команди й клієнти в одному кабінеті.</p>
        </div>
        <div className="bs-cta">
          <Link href="/business" className="bs-btn">Створити профіль</Link>
          <Link href="/business#features" className="bs-link">Усі можливості</Link>
        </div>
      </div>
      <style jsx global>{`
        .bs { padding: 4rem 0 6rem; background: #fff; }
        .bs-in { display: flex; align-items: center; justify-content: space-between; gap: 2rem; flex-wrap: wrap; border-top: 1px solid #e8e8ed; padding-top: 3rem; }
        .bs-in h2 { margin: 0 0 .4rem; font-size: clamp(1.5rem, 2.8vw, 2.1rem); font-weight: 700; letter-spacing: -.03em; color: #1D1D1F; }
        .bs-in p { margin: 0; color: #6E6E73; font-size: 1.08rem; }
        .bs-cta { display: flex; align-items: center; gap: 1.6rem; }
        .bs-btn { background: #1D1D1F; color: #fff; font-weight: 700; padding: .95rem 2rem; border-radius: 999px; text-decoration: none; transition: transform .25s ease; }
        .bs-btn:hover { transform: scale(1.04); } .bs-btn:focus-visible, .bs-link:focus-visible { outline: 3px solid #1D1D1F; outline-offset: 3px; }
        .bs-link { color: #1D1D1F; font-weight: 600; text-decoration: underline; text-decoration-color: #8fae92; text-decoration-thickness: 2px; text-underline-offset: 5px; }
      `}</style>
    </section>
  );
}
