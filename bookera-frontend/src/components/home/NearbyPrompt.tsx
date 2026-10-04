'use client';

import { useEffect, useState } from 'react';

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
          setPoint(next);
          writeStored(next);
          setIsVisible(false);
          setIsLocating(false);
          resolve();
        },
        err => {
          if (err.code === err.PERMISSION_DENIED) {
            // Людина відмовила: збережене місце стираємо, воно більше не наше.
            clearStored();
            setPoint(null);
            setError('denied');
            // Пояснення, де зняти заборону, - лише якщо людина сама просила.
            if (fromUser) setIsVisible(true);
          } else {
            // Не відмова, а збій (немає сигналу, не встигли): беремо
            // останнє відоме місце - воно краще за нічого.
            const last = readStored();
            if (last && Date.now() - last.at < FALLBACK_TTL) {
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
            setPoint(null);
            setError('denied');
            return;
          }
          setError(null);

          if (st.state === 'granted') {
            // Збережене місце - одразу (список поруч у першому кадрі),
            // свіже підмінить його за секунду-дві.
            if (stored) setPoint({ lat: stored.lat, lng: stored.lng });
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
            // або браузер забув дозвіл. Якщо місце було - користуємось ним.
            if (stored) setPoint({ lat: stored.lat, lng: stored.lng });
            else setIsVisible(true); // плашка «Показати?» - її можна пропустити
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
