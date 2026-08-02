'use client';
import { useSearchParams, usePathname } from 'next/navigation';
import { useEffect } from 'react';

export default function Tracker() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    const ref = searchParams.get('ref');

    if (ref === 'bookera') {
      localStorage.setItem('booking_source', 'BOOKERA_SEARCH');
    } else if (ref === 'widget') {
      localStorage.setItem('booking_source', 'WIDGET');
    } else if (ref === 'direct') {
      localStorage.setItem('booking_source', 'DIRECT');
    } else if (pathname === '/') {
      // 🟢 Якщо клієнт просто зайшов на головну сторінку каталогу - це наш лід!
      localStorage.setItem('booking_source', 'BOOKERA_SEARCH');
    }
  }, [searchParams, pathname]);

  return null;
}