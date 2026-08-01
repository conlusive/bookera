import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ваші інші налаштування (якщо були)...

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co', // Дозволяє завантажувати фото з вашого Supabase
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com', // Для тестових фото (наприклад, з нашого коду)
      }
    ],
  },
};

export default nextConfig;