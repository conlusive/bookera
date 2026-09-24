import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Suspense } from 'react';
import Tracker from '@/components/Tracker';
import { ToastProvider } from '@/context/ToastContext';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'BookEra',
  description: 'Платформа для онлайн-запису',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="uk"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Раннє зʼєднання з доменом відео на головній.
          Браузер робить DNS-запит і рукостискання TLS ще поки парсить
          HTML, а не коли доходить до тега <video>. Це економить
          100-300 мс до першого кадру - саме той час, коли людина
          бачить порожні заглушки. */}
      <head>
        <link rel="preconnect" href="https://d8j0ntlcm91z4.cloudfront.net" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://d8j0ntlcm91z4.cloudfront.net" />
      </head>
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          {/* 🟢 Наш трекер для рефералок */}
          {/* Tracker читає параметри адреси (реферальні мітки). Без
              Suspense це змушувало б КОЖНУ сторінку сайту рендеритись
              лише в браузері - і продакшн-збірка падала. */}
          <Suspense fallback={null}>
            <Tracker />
          </Suspense>

          {children}
        </ToastProvider>

        {/* Реєстрація Service Worker - у клієнтському компоненті, а не
            інлайновим <script>: той ламав гідратацію (сервер віддавав
            <script>, клієнт малював інше), і React перемальовував
            усю сторінку заново. */}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}