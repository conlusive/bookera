'use client';

/**
 * Заголовок секції на головній.
 *
 * Один ритм для всіх зон: надпис, заголовок, підзаголовок - завжди
 * з тими самими інтервалами й кеглями.
 *
 * Раніше кожна секція мала свої: 2.2rem проти 1.75, відступи 1.75
 * проти 2.5. Око читає це як недбалість, навіть коли не може назвати
 * причину.
 */
export default function SectionHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  /** Надпис над заголовком - категорія або контекст. */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Дія праворуч: посилання «усі», стрілки каруселі. */
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: '2rem',
        marginBottom: '2rem',
      }}
    >
      <div style={{ minWidth: 0 }}>
        {eyebrow && (
          <div
            style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#6F9273',
              letterSpacing: '0.01em',
              marginBottom: '0.5rem',
            }}
          >
            {eyebrow}
          </div>
        )}

        <h2
          style={{
            // 2rem на всіх секціях. Різні кеглі створюють ієрархію,
            // якої тут немає: зони рівнозначні.
            fontSize: 'clamp(1.5rem, 3vw, 2rem)',
            fontWeight: 700,
            color: '#1D1D1F',
            margin: 0,
            letterSpacing: '-0.025em',
            lineHeight: 1.15,
          }}
        >
          {title}
        </h2>

        {subtitle && (
          <p
            style={{
              fontSize: '1rem',
              color: '#86868B',
              margin: '0.5rem 0 0',
              lineHeight: 1.5,
              maxWidth: '560px',
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
