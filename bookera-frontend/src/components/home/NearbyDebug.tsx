'use client';

import { useEffect, useState } from 'react';

/**
 * Стан пошуку «поблизу» - видимий на сторінці.
 *
 * Панель показується ЛИШЕ в режимі розробки. Вона відповідає на одне
 * питання: чому відстані не рахуються.
 *
 * Причин рівно три, і всі вони поза кодом: браузер не дав дозволу,
 * у закладів немає координат, список прийшов із кешу. Шукати їх
 * у консолі означає щоразу відкривати інструменти розробника й
 * згадувати, що саме дивитись.
 */

interface Props {
  point: { lat: number; lng: number } | null;
  businesses: any[];
  distanceCount: number;
}

export default function NearbyDebug({ point, businesses, distanceCount }: Props) {
  const [permission, setPermission] = useState<string>('перевіряємо…');

  useEffect(() => {
    if (!navigator.permissions) {
      setPermission('браузер не показує стан');
      return;
    }
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then(r => {
        setPermission(r.state);
        // Стан може змінитись, поки сторінка відкрита: людина зняла
        // заборону в налаштуваннях і повернулась сюди.
        r.onchange = () => setPermission(r.state);
      })
      .catch(() => setPermission('невідомо'));
  }, []);

  if (process.env.NODE_ENV !== 'development') return null;

  const withCoords = businesses.filter(b => b.latitude != null).length;

  const problem =
    permission === 'denied'
      ? 'Доступ заборонено в браузері. Safari → Налаштування → Вебсайти → Розташування → localhost → «Запитувати».'
      : !point && permission === 'prompt'
        ? 'Браузер ще не питав дозволу або ви його не дали.'
        : withCoords === 0 && businesses.length > 0
          ? 'У закладів немає координат у списку. Спробуйте: rm -rf .next && npm run dev'
          : null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '16px',
        zIndex: 9999,
        maxWidth: '360px',
        padding: '0.9rem 1.1rem',
        borderRadius: '12px',
        background: problem ? '#FBF0EF' : '#F4FAF5',
        border: `1px solid ${problem ? 'rgba(168,57,52,0.25)' : 'rgba(111,146,115,0.25)'}`,
        fontSize: '0.8rem',
        lineHeight: 1.5,
        color: '#1D1D1F',
        fontFamily: 'system-ui, sans-serif',
        boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: '0.4rem' }}>Пошук «поблизу» — стан</div>

      <div style={{ color: '#5C6B5E' }}>
        Дозвіл браузера: <b>{permission}</b>
      </div>
      <div style={{ color: '#5C6B5E' }}>
        Ваші координати: <b>{point ? `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}` : 'немає'}</b>
      </div>
      <div style={{ color: '#5C6B5E' }}>
        Закладів: <b>{businesses.length}</b>, з координатами: <b>{withCoords}</b>
      </div>
      <div style={{ color: '#5C6B5E' }}>
        Пораховано відстаней: <b>{distanceCount}</b>
      </div>

      {problem && (
        <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(0,0,0,0.08)', color: '#8C2F2B' }}>
          {problem}
        </div>
      )}
    </div>
  );
}
