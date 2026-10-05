'use client';

import { useEffect, useRef, useState } from 'react';
import { isStoredPointFresh, shouldAcceptFix } from '@/lib/geo';

/**
 * Місце людини для відстаней «дорогою до закладу».
 *
 * ПРАВИЛО: дозвіл просимо ОДИН раз. Далі місце береться саме й тихо.
 *
 * Джерело правди про дозвіл - сам браузер (Permissions API): людина
 * могла змінити його в налаштуваннях, і наш власний запис «дозволила»
 * розійшовся б із ним. Наша пам'ять - лише дві речі:
 *
 *   bookera_geo_asked  - ми вже показували людині вікно браузера.
 *                        Якщо вона його закрила, не відповівши, вікно
 *                        більше не вискакує саме: лише плашка, яку можна
 *                        пропустити, або вибір «Найближчі».
 *   bookera_last_point - останнє відоме місце. Показується одразу, без
 *                        очікування GPS, і лишається, поки браузер
 *                        «забув» дозвіл (Safari так робить): людина
 *                        вже дозволила, і питати вдруге не слід.
 *
 * Що відбувається при вході:
 *   granted - беремо місце мовчки, свіже підмінює збережене
 *   prompt  - уперше: вікно браузера; далі: збережене місце + плашка
 *   denied  - людина заборонила: збережене місце стираємо й не чіпаємо
 *
 * Поки сторінка відкрита, місце ОНОВЛЮЄТЬСЯ САМО (лише коли дозвіл уже є):
 *   - стеження за рухом: нове місце приймаємо, коли людина зрушила помітно
 *     більше за похибку GPS (дрібний «дрейф» відстані не змінює)
 *   - повернулись на вкладку або з'явилась мережа - одразу перевизначаємо
 *   - збережене місце старше кількох годин за «поточне» не вважаємо: людина
 *     могла поїхати в інше місто, а відстані від старої точки були б хибними
 */

export type GeoPoint = { lat: number; lng: number };

const LAST_POINT_KEY = 'bookera_last_point';
const ASKED_KEY = 'bookera_geo_asked';
// Збережене місце, якщо браузер не вміє казати, чи є дозвіл (Permissions API
// відсутнє): воно годиться на пару годин, далі визначаємо наново.
const UNKNOWN_STATE_TTL = 2 * 60 * 60 * 1000;
// Збережене місце на випадок збою визначення: тиждень - це вже інше
// місто, тож довше не тримаємо.
const FALLBACK_TTL = 7 * 24 * 60 * 60 * 1000;

type StoredPoint = GeoPoint & { at: number };

function readStored(): StoredPoint | null {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_POINT_KEY) || 'null');
    if (!saved || typeof saved.lat !== 'number' || typeof saved.lng !== 'number') return null;
    return { lat: saved.lat, lng: saved.lng, at: Number(saved.at) || 0 };
  } catch {
    return null;
  }
}
const writeStored = (p: GeoPoint) => {
  // Приватний режим не дає писати - не біда, наступного разу визначимо заново.
  try { localStorage.setItem(LAST_POINT_KEY, JSON.stringify({ ...p, at: Date.now() })); } catch { /* пропускаємо */ }
};
const clearStored = () => { try { localStorage.removeItem(LAST_POINT_KEY); } catch { /* пропускаємо */ } };
const wasAsked = () => { try { return localStorage.getItem(ASKED_KEY) === '1'; } catch { return false; } };
const markAsked = () => { try { localStorage.setItem(ASKED_KEY, '1'); } catch { /* пропускаємо */ } };

export function useNearbyPrompt(isEnabled: boolean) {
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Дозвіл уже є (був успішний вимір): лише тоді можна стежити за рухом, не питаючи вдруге
  const [tracking, setTracking] = useState(false);
  const pointRef = useRef<GeoPoint | null>(null);
  const lastFixAt = useRef(0);

  /** Нове місце: оновлюємо стан, пам'ять і час останнього виміру. */
  const commitPoint = (next: GeoPoint) => {
    pointRef.current = next;
    lastFixAt.current = Date.now();
    setPoint(next);
    writeStored(next);
  };

  /**
   * fromUser - людина сама щойно натиснула щось, що потребує місця
   * («Показати», «Найближчі»). Лише тоді при невдачі з'являється плашка:
   * автоматичний запит при вході нічого власного не показує.
   */
  const locate = (fromUser = false) =>
    new Promise<void>(resolve => {
      setIsLocating(true);
      setError(null);
      markAsked();

      navigator.geolocation.getCurrentPosition(
        pos => {
          const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          // Звичайне визначення (вхід, кнопка) приймаємо завжди; дрейф відсікає лише стеження нижче
          commitPoint(next);
          setTracking(true);
          setIsVisible(false);
          setIsLocating(false);
          resolve();
        },
        err => {
          if (err.code === err.PERMISSION_DENIED) {
            // Людина відмовила: збережене місце стираємо, воно більше не наше.
            clearStored();
            pointRef.current = null;
            setTracking(false);
            setPoint(null);
            setError('denied');
            // Пояснення, де зняти заборону, - лише якщо людина сама просила.
            if (fromUser) setIsVisible(true);
          } else {
            // Не відмова, а збій (немає сигналу, не встигли): беремо
            // останнє відоме місце - воно краще за нічого.
            const last = readStored();
            if (last && Date.now() - last.at < FALLBACK_TTL) {
              pointRef.current = { lat: last.lat, lng: last.lng };
              setPoint({ lat: last.lat, lng: last.lng });
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
          // Висока точність: на телефоні вмикає GPS замість вишок і Wi-Fi.
          // У низькій похибка сягала сотень метрів - і заклад за 300 м міг
          // показатись за 700. Збережене місце показується одразу, тож
          // людина не чекає.
          enableHighAccuracy: true,
          // macOS звертається до Wi-Fi-мережі, і 10 секунд не завжди
          // вистачає: краще зачекати, ніж показати «не вдалося» там, де
          // все працює.
          timeout: 20000,
          // Хвилина: за п'ять людина проходить кількасот метрів, і
          // відстань застаріла б.
          maximumAge: 60000,
        },
      );
    });

  useEffect(() => {
    if (!isEnabled) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    let cancelled = false;
    let status: PermissionStatus | null = null;
    const stored = readStored();

    // Без Permissions API (старі браузери) стан дозволу невідомий.
    if (!navigator.permissions) {
      if (!wasAsked()) {
        void locate();
      } else if (stored && Date.now() - stored.at < UNKNOWN_STATE_TTL) {
        pointRef.current = { lat: stored.lat, lng: stored.lng };
        setPoint({ lat: stored.lat, lng: stored.lng });
      } else {
        void locate();
      }
      return;
    }

    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then(st => {
        if (cancelled) return;
        status = st;

        const apply = () => {
          if (st.state === 'denied') {
            // Людина заборонила браузеру. Збережене місце стираємо, не
            // нагадуємо: сторінка працює й без відстаней.
            clearStored();
            pointRef.current = null;
            setTracking(false);
            setPoint(null);
            setError('denied');
            return;
          }
          setError(null);

          if (st.state === 'granted') {
            // Збережене місце - одразу (список поруч у першому кадрі), але лише поки воно
            // свіже: стару точку (людина могла поїхати) не показуємо - чекаємо вимір.
            if (stored && isStoredPointFresh(stored.at)) {
              pointRef.current = { lat: stored.lat, lng: stored.lng };
              setPoint({ lat: stored.lat, lng: stored.lng });
            }
            void locate();
            return;
          }

          // 'prompt': браузер зараз не має дозволу.
          if (!wasAsked()) {
            // Уперше. Браузер покаже своє вікно, відповідь запам'ятає, і
            // з наступного входу ми потрапимо в 'granted' вище.
            void locate();
          } else {
            // Питали вже. Не вискакуємо вдруге: людина або закрила вікно,
            // або браузер забув дозвіл. Свіже місце використовуємо; застаріле - ні
            // (відстані від старої точки в іншому місті були б хибними), тоді плашка.
            if (stored && isStoredPointFresh(stored.at)) {
              pointRef.current = { lat: stored.lat, lng: stored.lng };
              setPoint({ lat: stored.lat, lng: stored.lng });
            } else {
              setIsVisible(true); // плашка «Показати?» - її можна пропустити
            }
          }
        };

        apply();
        // Дозвіл змінили в налаштуваннях - реагуємо без перезавантаження.
        st.onchange = () => { if (!cancelled) apply(); };
      })
      .catch(() => {
        if (!cancelled && !wasAsked()) void locate();
      });

    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled]);

  // Стеження за зміною місця. Лише коли дозвіл уже є (tracking) - тож вікно браузера
  // не з'являється вдруге. Поки вкладка прихована, не стежимо (батарея).
  useEffect(() => {
    if (!isEnabled || !tracking) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    const MIN_INTERVAL_MS = 15_000;      // не частіше: кожна зміна точки - запит відстаней
    const STALE_AFTER_MS = 90_000;       // повернулись на вкладку: старший за це вимір оновлюємо
    let watchId: number | null = null;

    const onFix = (pos: GeolocationPosition) => {
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (Date.now() - lastFixAt.current < MIN_INTERVAL_MS && pointRef.current) return;
      if (!shouldAcceptFix(pointRef.current, next, pos.coords.accuracy)) return;
      commitPoint(next);
    };
    const quiet = () => { /* збій стеження не показуємо: лишається останнє відоме місце */ };

    const startWatch = () => {
      if (watchId !== null) return;
      watchId = navigator.geolocation.watchPosition(onFix, quiet, { enableHighAccuracy: true, maximumAge: 30_000, timeout: 30_000 });
    };
    const stopWatch = () => {
      if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    };
    const refreshNow = () => {
      if (Date.now() - lastFixAt.current < STALE_AFTER_MS) return;
      navigator.geolocation.getCurrentPosition(onFix, quiet, { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 });
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') { refreshNow(); startWatch(); }
      else stopWatch();
    };
    if (document.visibilityState === 'visible') startWatch();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', refreshNow);
    window.addEventListener('focus', refreshNow);

    return () => {
      stopWatch();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', refreshNow);
      window.removeEventListener('focus', refreshNow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled, tracking]);

  const decline = () => setIsVisible(false);

  // Назовні locate викликається лише з дій людини (кнопки, вибір
  // сортування), тож fromUser = true.
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
