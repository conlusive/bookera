'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Секція категорій на головній.
 *
 * Замінює відео-банер: три великі картки, кожна з власним відео,
 * вертикальною назвою та кнопкою переходу.
 *
 * Чому це працює краще за один банер: людина одразу бачить, що саме
 * тут можна знайти, і кожна картка - це вже початок дії, а не просто
 * заставка з текстом.
 */

interface Category {
  /** Ключ для фільтра каталогу - те, що піде в пошук. */
  slug: string;
  name: string;
  video: string;
}

const CATEGORIES: Category[] = [
  {
    slug: 'face',
    name: 'обличчя',
    video: 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260518_203023_87a26602-2898-4acc-a396-c7a2b5ad84fd.mp4',
  },
  {
    slug: 'hair',
    name: 'волосся',
    video: 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260518_203415_b86e3f19-2aec-46cd-9a86-b64c40118e38.mp4',
  },
  {
    slug: 'body',
    name: 'тіло',
    video: 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260518_203051_85fee398-ea01-4aa0-972b-137a74213be5.mp4',
  },
];

/**
 * Поява при прокручуванні - одноразова.
 *
 * Після першого показу спостерігач відключається: анімація, яка
 * повторюється щоразу при прокручуванні вгору-вниз, дратує на
 * другому проході.
 */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
}

export default function CategoriesSection() {
  const router = useRouter();
  const { ref, isVisible } = useInView(0.1);

  return (
    <section style={{ width: '100%', background: '#fff' }}>
      <div
        ref={ref}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0)' : 'translateY(3rem)',
          transition: 'opacity 1s ease-out, transform 1s ease-out',
        }}
      >
        {CATEGORIES.map((category, index) => (
          <CategoryCard
            key={category.slug}
            category={category}
            index={index}
            onOpen={() => router.push(`/?category=${category.slug}`)}
          />
        ))}
      </div>
    </section>
  );
}

function CategoryCard({
  category,
  index,
  onOpen,
}: {
  category: Category;
  index: number;
  onOpen: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        minHeight: 'min(70vh, 640px)',
        padding: 'clamp(1.5rem, 4vw, 3rem)',
        overflow: 'hidden',
        cursor: 'pointer',
        // Картки зʼявляються по черзі: одночасна поява трьох великих
        // блоків читається як стрибок, послідовна - як рух.
        transitionDelay: `${index * 150}ms`,
      }}
      onClick={onOpen}
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        src={category.video}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: isHovered ? 'scale(1.05)' : 'scale(1)',
          transition: 'transform 0.7s ease',
        }}
      />

      {/* Затемнення: без нього білий текст губиться на світлих кадрах
          відео. Посилюється при наведенні, щоб кнопка читалась. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: isHovered ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.16)',
          transition: 'background-color 0.5s ease',
        }}
      />

      <h2
        style={{
          position: 'relative',
          zIndex: 10,
          margin: 0,
          fontSize: 'clamp(3rem, 7vw, 5.5rem)',
          fontWeight: 500,
          color: '#fff',
          letterSpacing: '-0.02em',
          // Вертикальний текст знизу вгору: writing-mode кладе його
          // в колонку, поворот на 180° розвертає напрямок читання.
          writingMode: 'vertical-lr',
          transform: `rotate(180deg) translateY(${isHovered ? '0.5rem' : '0'})`,
          transition: 'transform 0.5s ease',
        }}
      >
        {category.name}
      </h2>

      <button
        type="button"
        className="btn-primary"
        style={{
          position: 'relative',
          zIndex: 10,
          marginTop: 'auto',
          padding: '0.75rem 2rem',
          background: '#fff',
          color: '#000',
          border: 'none',
          borderRadius: '999px',
          fontSize: '0.875rem',
          fontWeight: 500,
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        Обрати {category.name}
      </button>
    </div>
  );
}
