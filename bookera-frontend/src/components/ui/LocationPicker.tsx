'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Вибір точки закладу на мапі.
 *
 * Заклад ставить мітку сам, а не ми геокодуємо адресу. Точніше:
 * вхід буває з двору, будинок довгий, а «Дорошенка 10» може вказати
 * на протилежний бік кварталу. Клієнт потім іде саме туди, куди
 * показує мітка.
 *
 * OpenStreetMap через Leaflet, а не Google Maps: Google вимагає ключ
 * і рахує кожне завантаження мапи. Для одноразової дії при реєстрації
 * платити за це немає сенсу.
 *
 * Leaflet вантажиться з CDN, а не як пакет: він важить 150 КБ і
 * потрібен на одному екрані з усього продукту. Тягнути його в збірку
 * означає сповільнити кожну сторінку заради цієї однієї.
 */

interface Props {
  /** Початкова точка - якщо заклад уже ставив мітку. */
  value?: { lat: number; lng: number } | null;
  onChange: (coords: { lat: number; lng: number }) => void;
  /** Місто - щоб мапа відкрилась там, а не посеред океану. */
  city?: string | null;
  height?: number;
}

/** Центри найбільших міст - щоб не питати геокодер заради першого кадру. */
const CITY_CENTERS: Record<string, [number, number]> = {
  'київ': [50.4501, 30.5234],
  'львів': [49.8397, 24.0297],
  'одеса': [46.4825, 30.7233],
  'харків': [49.9935, 36.2304],
  'дніпро': [48.4647, 35.0462],
  'запоріжжя': [47.8388, 35.1396],
  'вінниця': [49.2331, 28.4682],
  'івано-франківськ': [48.9226, 24.7111],
  'тернопіль': [49.5535, 25.5948],
  'ужгород': [48.6208, 22.2879],
};

const DEFAULT_CENTER: [number, number] = CITY_CENTERS['київ'];

export default function LocationPicker({ value, onChange, city, height = 320 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Скрипт і стилі вантажимо один раз: повторний тег дублює
      // обробники, і мітка починає стрибати від одного кліку.
      if (!(window as any).L) {
        await new Promise<void>((resolve, reject) => {
          const css = document.createElement('link');
          css.rel = 'stylesheet';
          css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(css);

          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Не вдалося завантажити мапу'));
          document.head.appendChild(script);
        });
      }

      if (cancelled || !containerRef.current || mapRef.current) return;

      const L = (window as any).L;
      const cityKey = (city || '').trim().toLowerCase();
      const center: [number, number] = value
        ? [value.lat, value.lng]
        : CITY_CENTERS[cityKey] || DEFAULT_CENTER;

      const map = L.map(containerRef.current, {
        center,
        // Наближення 16 - видно вулиці й будинки. На 13 людина
        // ставить мітку «десь у тому кварталі», і точність втрачається.
        zoom: value ? 17 : 16,
        // Прокручування колесом вимкнене: мапа посеред форми
        // перехоплювала б прокрутку сторінки, і людина не могла б
        // проїхати повз неї.
        scrollWheelZoom: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      const setMarker = (lat: number, lng: number) => {
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
          markerRef.current.on('dragend', () => {
            const p = markerRef.current.getLatLng();
            onChange({ lat: +p.lat.toFixed(7), lng: +p.lng.toFixed(7) });
          });
        }
        onChange({ lat: +lat.toFixed(7), lng: +lng.toFixed(7) });
      };

      if (value) setMarker(value.lat, value.lng);

      // Клік ставить мітку, перетягування уточнює. Два способи, бо
      // перший швидкий, другий точний.
      map.on('click', (e: any) => setMarker(e.latlng.lat, e.latlng.lng));

      mapRef.current = map;
      setIsReady(true);
    }

    void init();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // Навмисно не стежимо за value: мапа керує собою сама після
    // ініціалізації, і перестворення на кожну зміну координат
    // скидало б наближення при кожному кліку.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  return (
    <div>
      <div
        ref={containerRef}
        style={{
          height: `${height}px`,
          width: '100%',
          borderRadius: '14px',
          overflow: 'hidden',
          border: '1px solid #E5E5EA',
          background: '#F5F5F7',
        }}
      />

      <p style={{
        fontSize: '0.8125rem', color: '#86868B',
        margin: '0.6rem 0 0', lineHeight: 1.45,
      }}>
        {value
          ? 'Мітку поставлено. Перетягніть її, якщо треба уточнити вхід.'
          : isReady
            ? 'Натисніть на мапі там, де вхід до закладу.'
            : 'Завантажуємо мапу…'}
      </p>
    </div>
  );
}
