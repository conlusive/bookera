import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Tracker from '@/components/Tracker';
import { ToastProvider } from '@/context/ToastContext';

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

        {/* 🔴 Безпечна реєстрація Service Worker для PWA на серверному рівні */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(reg) { console.log('Service Worker зареєстровано!', reg); })
                    .catch(function(err) { console.log('Помилка SW', err); });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}