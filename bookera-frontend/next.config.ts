import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 1. Увімкнення компресії (Brotli/Gzip) для моментального завантаження сторінок
  compress: true,

  // 2. Видалення console.log у продакшені (зменшує розмір бандлу та прискорює JS)
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Іконки з великих пакетів підтягуємо поштучно, а не весь пакет:
  // iconsax-react має сотні іконок, а потрібно кілька.
  experimental: {
    optimizePackageImports: ['iconsax-react'],
  },

  // 3. Автоматична оптимізація фотографій у сучасні формати (AVIF та WebP)
  images: {
    // Лише WebP. AVIF на ~20% менший, але кодується в кілька разів
    // довше - і Next.js робить це при першому запиті кожного фото. Із
    // AVIF першим фото помітно затримувались саме тоді, коли людина
    // відкривала сторінку вперше.
    formats: ['image/webp'],
    minimumCacheTTL: 86400, // Кешування фото у браузері на 24 години
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co', // Швидке завантаження обкладинок з Supabase Storage
      },
      {
        // Запасні фото карток і каруселі порад. Без цього дозволу
        // next/image відмовився б їх оптимізувати.
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },

  // 4. Standalone-режим для ізольованого та максимального швидкого запуску на сервері
  output: 'standalone',

  // 5. Кешування статики - ТІЛЬКИ у продакшні.
  //
  // 'immutable' каже браузеру: цей файл ніколи не змінюється, не питай
  // сервер. У продакшні це правильно (Next.js додає хеш у назву файлу
  // при кожній збірці). У розробці - руйнівно: код змінюється, а браузер
  // уперто віддає версію, завантажену першою, і навіть Cmd+Shift+R не
  // завжди це пробиває. Саме через це зміни могли «не доходити» до
  // екрана попри перезбірку.
  //
  // Next.js прямо попереджає про це в консолі:
  // "Setting a custom Cache-Control header can break Next.js development behavior."
  async headers() {
    // Заголовки безпеки - для всіх сторінок, у розробці теж (вони нічого не ламають).
    // geolocation=(self): головна визначає місце людини; камера/мікрофон/платежі не потрібні нікому.
    // CSP свідомо не ставимо «наосліп»: сторінка тягне Supabase, Nominatim, CDN відео й Unsplash,
    // а Next і styled-jsx використовують inline-скрипти й стилі - її треба налаштовувати окремо.
    const security = [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=(), payment=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          ...(process.env.NODE_ENV === 'production'
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
            : []),
        ],
      },
    ];

    if (process.env.NODE_ENV !== 'production') return security;

    return [
      ...security,
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;