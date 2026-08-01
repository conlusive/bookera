export function CabinetSkeleton() {
  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#fafafa', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
        .skeleton { background: #e2e8f0; animation: pulse 1.5s infinite ease-in-out; border-radius: 8px; }
      `}</style>

      {/* Сайдбар-скелетон */}
      <div style={{ width: '260px', borderRight: '1px solid #f1f5f9', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: '#fff' }}>
        <div className="skeleton" style={{ width: '140px', height: '32px' }}></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem' }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="skeleton" style={{ width: '100%', height: '40px' }}></div>
          ))}
        </div>
      </div>

      {/* Основна зона */}
      <div style={{ flex: 1, padding: '3rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div className="skeleton" style={{ width: '280px', height: '40px' }}></div>
        <div className="skeleton" style={{ width: '100%', height: '450px', borderRadius: '16px' }}></div>
      </div>
    </div>
  );
}