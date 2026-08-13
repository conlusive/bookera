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

  // 5. Заголовки агресивного кешування статичних ресурсів (CSS, JS, шрифти)
  async headers() {
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