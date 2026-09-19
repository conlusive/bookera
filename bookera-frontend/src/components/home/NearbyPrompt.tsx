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

export type GeoPoint = { lat: number; lng: number };

/**
 * Координати людини для пошуку «поблизу».
 *
 * ДЖЕРЕЛО ПРАВДИ - САМ БРАУЗЕР, а не наше сховище.
 *
 * Раніше ми тримали власний запис «людина відмовилась» у localStorage.
 * Він розійшовся з браузером: людина зняла заборону в налаштуваннях,
 * браузер став готовий питати (prompt), а ми його не питали, бо наш
 * запис і далі казав «відмовилась». Два джерела правди про одне й те
 * саме завжди розходяться.
 *
 * Тепер логіка проста:
 *   granted - беремо координати мовчки, вікна не буде
 *   prompt  - просимо, браузер сам покаже своє вікно
 *   denied  - не чіпаємо; показуємо пояснення, де зняти заборону
 */
export function useNearbyPrompt(isEnabled: boolean) {
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locate = () =>
    new Promise<void>(resolve => {
      setIsLocating(true);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        pos => {
          setPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setIsVisible(false);
          setIsLocating(false);
          resolve();
        },
        err => {
          // Заборона - показуємо, де її зняти: людина сама не здогадається
          // шукати це в налаштуваннях сайту.
          setError(err.code === err.PERMISSION_DENIED ? 'denied' : 'failed');
          setIsVisible(true);
          setIsLocating(false);
          resolve();
        },
        {
          // Точності до кварталу досить. Висока вмикає GPS і тримає
          // людину в очікуванні кілька секунд заради метрів, які тут
          // нічого не змінюють.
          enableHighAccuracy: false,
          timeout: 10000,
          // Місце пʼятихвилинної давності годиться: людина не могла
          // перетнути місто за цей час.
          maximumAge: 300000,
        },
      );
    });

  useEffect(() => {
    if (!isEnabled) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    let cancelled = false;

    // navigator.permissions є не скрізь (Safari додав пізно). Без нього
    // просто просимо координати - браузер сам вирішить, питати чи ні.
    if (!navigator.permissions) {
      void locate();
      return;
    }

    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then(status => {
        if (cancelled) return;

        if (status.state === 'denied') {
          setError('denied');
          setIsVisible(true);
          return;
        }

        // granted і prompt обидва ведуть до запиту: у першому випадку
        // браузер віддасть координати мовчки, у другому покаже вікно.
        void locate();

        // Людина зняла заборону в налаштуваннях і повернулась на
        // вкладку - пробуємо знову без перезавантаження.
        status.onchange = () => {
          if (status.state !== 'denied') {
            setError(null);
            void locate();
          }
        };
      })
      .catch(() => {
        if (!cancelled) void locate();
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled]);

  const decline = () => setIsVisible(false);

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
        {error === 'denied'
          ? 'Доступ до місця заборонено в налаштуваннях браузера — увімкніть його, щоб бачити найближчі заклади'
          : (error || 'Не вдалося визначити ваше місце')}
      </span>

      {error !== 'denied' && (
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
      )}

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
