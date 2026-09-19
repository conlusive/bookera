'use client';

import { useEffect, useState } from 'react';

/**
 * Пропозиція показати найближчі заклади.
 *
 * Зʼявляється ПІСЛЯ того, як людина обрала послугу - не раніше.
 *
 * Запит геолокації на першій секунді виглядає як стеження: людина
 * ще не знає, що це за сайт, а він уже питає, де вона. Після вибору
 * послуги питання стає зрозумілим: «показати, де це поруч».
 *
 * Відповідь памʼятаємо, щоб не питати щоразу: людина вже вирішила,
 * і повторне питання читається як тиск.
 */

const STORAGE_KEY = 'bookera_geo_choice';

export type GeoPoint = { lat: number; lng: number };

export function useNearbyPrompt(isReadyToAsk: boolean) {
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReadyToAsk) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    const saved = localStorage.getItem(STORAGE_KEY);

    // Уже відмовлялась - не питаємо знову.
    if (saved === 'declined') return;

    // Питаємо БРАУЗЕР одразу, без власного вікна.
    //
    // Раніше ми показували свою плашку «Показати найближчі?», людина
    // тиснула «Показати», і лише тоді зʼявлявся запит браузера. Два
    // кліки замість одного, і другий виглядав як дубль першого.
    //
    // Браузер і так питає дозволу - це і є те саме питання. Своє
    // вікно тут зайве.
    void locate();
  }, [isReadyToAsk]);

  const locate = () =>
    new Promise<void>(resolve => {
      setIsLocating(true);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        pos => {
          setPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          localStorage.setItem(STORAGE_KEY, 'granted');
          setIsVisible(false);
          setIsLocating(false);
          resolve();
        },
        err => {
          // Відмова в браузері - те саме, що відмова в нас: більше
          // не питаємо. Інакше вікно зʼявлятиметься щоразу, а людина
          // вже сказала «ні».
          if (err.code === err.PERMISSION_DENIED) {
            // Відмовили - запамʼятовуємо й більше не турбуємо.
            // Просити знову після «ні» - тиск.
            localStorage.setItem(STORAGE_KEY, 'declined');
            setIsVisible(false);
          } else {
            // Не дозвіл, а збій: немає сигналу, вийшов час. Тут
            // повторна спроба має сенс, тому показуємо кнопку.
            setError('Не вдалося визначити місце');
            setIsVisible(true);
          }
          setIsLocating(false);
          resolve();
        },
        {
          // Достатня точність - квартал. Висока вмикає GPS і тримає
          // людину в очікуванні кілька секунд заради метрів, які
          // тут нічого не змінюють.
          enableHighAccuracy: false,
          timeout: 8000,
          // Місце п'ятихвилинної давності цілком годиться: людина
          // не могла перетнути місто за цей час.
          maximumAge: 300000,
        },
      );
    });

  const decline = () => {
    localStorage.setItem(STORAGE_KEY, 'declined');
    setIsVisible(false);
  };

  return { point, isVisible, isLocating, error, locate, decline };
}

export default function NearbyPrompt({
  isVisible,
  isLocating,
  error,
  onAccept,
  onDecline,
}: {
  isVisible: boolean;
  isLocating: boolean;
  error: string | null;
  onAccept: () => void;
  onDecline: () => void;
}) {
  if (!isVisible) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.9rem',
        flexWrap: 'wrap',
        padding: '0.85rem 1.1rem',
        marginBottom: '1.25rem',
        borderRadius: '14px',
        background: '#F4FAF5',
        border: '1px solid rgba(111, 146, 115, 0.2)',
      }}
    >
      {/* Плашка зʼявляється лише після ЗБОЮ визначення місця -
          немає сигналу, вийшов час. Дозвіл питає сам браузер, і
          дублювати його своїм вікном означало б два кліки замість
          одного. */}
      <span style={{ fontSize: '0.9rem', color: '#2E3A30', flex: 1, minWidth: '220px' }}>
        {error || 'Не вдалося визначити ваше місце'}
      </span>

      <button
        onClick={onAccept}
        disabled={isLocating}
        style={{
          height: '34px', padding: '0 1rem', borderRadius: '10px',
          border: 'none', background: '#1D1D1F', color: '#fff',
          fontSize: '0.85rem', fontWeight: 500, fontFamily: 'inherit',
          cursor: isLocating ? 'wait' : 'pointer', opacity: isLocating ? 0.6 : 1,
        }}
      >
        {isLocating ? 'Визначаємо…' : 'Спробувати ще'}
      </button>

      <button
        onClick={onDecline}
        style={{
          height: '34px', padding: '0 0.75rem', borderRadius: '10px',
          border: 'none', background: 'transparent', color: '#5C6B5E',
          fontSize: '0.85rem', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
        }}
      >
        Пропустити
      </button>
    </div>
  );
}
