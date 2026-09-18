import React from 'react';

/**
 * Зручності закладу - СПІЛЬНИЙ список.
 *
 * Раніше він був визначений двічі: у вітрині CRM і на сторінці салону.
 * Два списки з тими самими ключами неминуче розходяться - виправлення
 * іконки в одному місці не доходило до другого, і власник бачив у себе
 * одне, а клієнт на сторінці інше.
 */
export const ALL_AMENITIES = [
  {
    id: 'parking',
    label: 'Паркування',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
        <circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>
      </svg>
    )
  },
  {
    id: 'card_payment',
    label: 'Оплата карткою',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
      </svg>
    )
  },
  {
    id: 'wifi',
    label: 'Wi-Fi',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>
      </svg>
    )
  },
  {
    id: 'accessibility',
    label: 'Доступність',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/>
      </svg>
    )
  },
  {
    id: 'coffee_tea',
    label: 'Кава та чай',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
      </svg>
    )
  },
  {
    id: 'ac',
    label: 'Кондиціонер',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12h20"/><path d="M7 16l-3-4 3-4"/><path d="M17 16l3-4-3-4"/><path d="M12 2v20"/>
      </svg>
    )
  },
  {
    id: 'pet_friendly',
    label: 'Pet friendly',
    // Лапка залита, а не обведена: на 18 пікселях контурні кола
    // зливаються в порожні кільця й не читаються як слід лапи.
    // Подушечки трохи різного розміру - рівні кружки виглядають
    // як схема, а не як відбиток.
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <ellipse cx="12" cy="16" rx="4.2" ry="3.6" />
        <ellipse cx="6.4" cy="11" rx="2.1" ry="2.5" />
        <ellipse cx="17.6" cy="11" rx="2.1" ry="2.5" />
        <ellipse cx="9.4" cy="6.6" rx="2" ry="2.4" />
        <ellipse cx="14.6" cy="6.6" rx="2" ry="2.4" />
      </svg>
    )
  },
  {
    id: 'generator',
    label: 'Світло є завжди (генератор)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    )
  },
  {
    id: 'kids_friendly',
    label: 'Дитяча зона',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4.5"/><path d="M20 21a8 8 0 1 0-16 0"/>
      </svg>
    )
  }
];
