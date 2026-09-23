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

  /**
   * Останнє відоме місце.
   *
   * Визначення координат іноді просто не встигає: macOS звертається
   * до Wi-Fi-мережі й це буває повільно. Людина бачить «не вдалося»,
   * хоча хвилину тому все працювало.
   *
   * Памʼятаємо останню вдалу відповідь: місто за годину людина не
   * змінить, а показати заклади поруч важливіше за точність до
   * метра. Свіжість перевіряємо - тижневі координати могли б
   * показати заклади в іншому місті.
   */
  const LAST_POINT_KEY = 'bookera_last_point';
  const LAST_POINT_TTL = 12 * 60 * 60 * 1000;

  const readLastPoint = (): GeoPoint | null => {
    try {
      const raw = localStorage.getItem(LAST_POINT_KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      if (Date.now() - saved.at > LAST_POINT_TTL) return null;
      return { lat: saved.lat, lng: saved.lng };
    } catch {
      return null;
    }
  };

  /**
   * fromUser - чи людина сама щойно натиснула щось, що потребує місця
   * (наприклад, «Спочатку найближчі»).
   *
   * Лише тоді показуємо плашку при невдачі. Автоматичний запит при
   * вході на сайт не показує нічого власного: питає браузер своїм
   * вікном, а якщо не вийшло - сторінка просто працює без відстаней.
   * Людина нічого від нас не просила, і плашка з помилкою була б
   * нав'язливою.
   */
  const locate = (fromUser = false) =>
    new Promise<void>(resolve => {
      setIsLocating(true);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        pos => {
          const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setPoint(next);
          try {
            localStorage.setItem(LAST_POINT_KEY, JSON.stringify({ ...next, at: Date.now() }));
          } catch {
            // Приватний режим не дає писати - не біда, просто
            // наступного разу визначимо заново.
          }
          setIsVisible(false);
          setIsLocating(false);
          resolve();
        },
        err => {
          // Заборона - показуємо, де її зняти: людина сама не здогадається
          // шукати це в налаштуваннях сайту.
          if (err.code === err.PERMISSION_DENIED) {
            setError('denied');
            // Пояснення, де зняти заборону, - лише якщо людина сама
            // щойно попросила найближчі. Автоматично не турбуємо.
            if (fromUser) setIsVisible(true);
          } else {
            // Не відмова, а збій: не встигли, немає сигналу.
            // Беремо останнє відоме місце - воно краще за нічого.
            const last = readLastPoint();
            if (last) {
              setPoint(last);
              setIsVisible(false);
            } else {
              setError('failed');
              if (fromUser) setIsVisible(true);
            }
          }
          setIsLocating(false);
          resolve();
        },
        {
          // Точності до кварталу досить. Висока вмикає GPS і тримає
          // людину в очікуванні кілька секунд заради метрів, які тут
          // нічого не змінюють.
          // Висока точність: на телефоні вмикає GPS замість вишок і Wi-Fi.
          // У низькій точності похибка сягала сотень метрів - і заклад
          // за 300 м міг показатись за 700. Повільніше на кілька секунд,
          // але останнє відоме місце показується одразу, тож людина
          // не чекає.
          enableHighAccuracy: true,
          // 20 секунд: macOS звертається до Wi-Fi-мережі, і 10 секунд
          // не завжди вистачає. Краще зачекати довше, ніж показати
          // «не вдалося» там, де все працює.
          timeout: 20000,
          // Місце пʼятихвилинної давності годиться: людина не могла
          // перетнути місто за цей час.
          // Хвилина, а не пʼять: за пʼять хвилин людина проходить
          // кількасот метрів, і відстань застаріла б.
          maximumAge: 60000,
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
          // Людина вже сказала «ні» браузеру. Не нагадуємо про це
          // на кожному вході - сторінка працює й без відстаней.
          setError('denied');
          return;
        }

        if (status.state === 'granted') {
          // Показуємо останнє відоме місце ОДРАЗУ, не чекаючи на
          // визначення: список поруч зʼявляється в першому кадрі,
          // а свіжі координати підмінять його за секунду-дві.
          const last = readLastPoint();
          if (last) setPoint(last);

          void locate();
          return;
        }

        // status.state === 'prompt': браузер ще не питав.
        //
        // Просимо одразу - браузер покаже своє вікно дозволу. Людина
        // відповідає ОДИН раз: браузер запамʼятовує відповідь, і на
        // наступних входах ми потрапляємо в гілку granted вище й
        // беремо координати мовчки.
        //
        // Раніше тут показувалась наша плашка «Показати заклади,
        // найближчі до вас?» - через хибне припущення, що Safari не
        // питає без кліку. Насправді тоді геолокацію для Safari було
        // вимкнено в налаштуваннях macOS. Зайвий крок прибрано.
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

  // Назовні locate викликається лише з дій людини (кнопки,
  // вибір сортування), тож fromUser = true.
  return { point, isVisible, isLocating, error, locate: () => locate(true), decline };
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
          ? 'Розташування недоступне. Перевірте: Системні налаштування → Конфіденційність і безпека → Служби геолокації → Safari'
          : error === 'failed'
            ? 'Не вдалося визначити ваше місце'
            : 'Показати заклади, найближчі до вас?'}
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
        {isLocating ? 'Визначаємо…' : error ? 'Спробувати ще' : 'Показати'}
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
