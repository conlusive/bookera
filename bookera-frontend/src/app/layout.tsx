import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
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
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          {/* 🟢 Наш трекер для рефералок */}
          <Tracker />

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