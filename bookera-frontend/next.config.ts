import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 1. Увімкнення компресії (Brotli/Gzip) для моментального завантаження сторінок
  compress: true,

  // 2. Видалення console.log у продакшені (зменшує розмір бандлу та прискорює JS)
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // 3. Автоматична оптимізація фотографій у сучасні формати (AVIF та WebP)
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400, // Кешування фото у браузері на 24 години
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co', // Швидке завантаження обкладинок з Supabase Storage
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
    if (process.env.NODE_ENV !== 'production') return [];

    return [
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