'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';

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
  const setMarkerRef = useRef<((lat: number, lng: number) => void) | null>(null);

  // --- Пошук із підказками ---
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<{ title: string; subtitle: string; lat: number; lng: number }[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [noResults, setNoResults] = useState(false);

  // Підказки - через 350 мс після останньої літери, а не на кожну:
  // інакше «Городоцька 45» - це 14 запитів замість одного.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) { setSuggestions([]); setNoResults(false); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      setIsSearching(true);
      try {
        const token = await getAuthToken();
        // Ближчі до поточного центру мапи - вище: людина шукає у своєму місті.
        const c0 = mapRef.current?.getCenter?.();
        const list = await api.geoSuggest(token, q, c0?.lat, c0?.lng);
        if (!cancelled) { setSuggestions(list); setActiveIdx(-1); setNoResults(list.length === 0); }
      } catch {
        if (!cancelled) { setSuggestions([]); setNoResults(true); }
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  const pick = (s: { title: string; lat: number; lng: number }) => {
    // Мапа підлітає до адреси, мітка стає на місце - тим самим шляхом,
    // що й клік, тож далі її так само можна перетягнути.
    mapRef.current?.flyTo([s.lat, s.lng], 18, { duration: 0.8 });
    setMarkerRef.current?.(s.lat, s.lng);
    setQuery(s.title);
    setSuggestions([]);
    setNoResults(false);
  };

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => (i + 1) % suggestions.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => (i <= 0 ? suggestions.length - 1 : i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(suggestions[Math.max(0, activeIdx)]); }
    else if (e.key === 'Escape') { setSuggestions([]); }
  };

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
        // Мапа й мітка керуються звідси; ref - щоб пошук над мапою міг
        // поставити мітку тим самим шляхом, що й клік.
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
      setMarkerRef.current = setMarker;
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

  // Координати змінились ззовні (наприклад, «Знайти за адресою») -
  // переносимо мітку й мапу туди ж. Раніше мапа їх ігнорувала.
  useEffect(() => {
    if (!isReady || !value) return;
    const m = markerRef.current?.getLatLng?.();
    if (m && Math.abs(m.lat - value.lat) < 1e-7 && Math.abs(m.lng - value.lng) < 1e-7) return;
    setMarkerRef.current?.(value.lat, value.lng);
    mapRef.current?.flyTo([value.lat, value.lng], 17, { duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, value?.lat, value?.lng]);

  return (
    <div>
      {/* Пошук над мапою - як у звичайних мапах: почали вводити адресу,
          обрали підказку, мітка стала на місце. */}
      <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#86868B" strokeWidth="2.2" strokeLinecap="round"
          style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <circle cx="11" cy="11" r="7" /><path d="M16.5 16.5 21 21" />
        </svg>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onSearchKey}
          placeholder="Пошук адреси: вулиця й номер будинку"
          aria-label="Пошук адреси"
          aria-autocomplete="list"
          aria-expanded={suggestions.length > 0}
          style={{
            width: '100%', boxSizing: 'border-box', height: '44px', padding: '0 2.5rem 0 2.4rem',
            borderRadius: '12px', border: '1px solid #E5E5EA', background: '#fff',
            fontFamily: 'inherit', fontSize: '0.9375rem', color: '#1D1D1F', outline: 'none',
          }}
        />
        {isSearching && (
          <span style={{ position: 'absolute', right: '0.9rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: '#AEAEB2' }}>…</span>
        )}

        {suggestions.length > 0 && (
          <div role="listbox" style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 1000,
            background: '#fff', borderRadius: '12px', padding: '6px',
            boxShadow: '0 18px 40px -12px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.05)',
          }}>
            {suggestions.map((s, i) => (
              <button
                key={`${s.lat},${s.lng}`}
                type="button"
                role="option"
                aria-selected={i === activeIdx}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseDown={e => { e.preventDefault(); pick(s); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '0.7rem', textAlign: 'left',
                  padding: '0.6rem 0.7rem', border: 'none', borderRadius: '8px', cursor: 'pointer',
                  background: i === activeIdx ? '#F5F5F7' : 'transparent', fontFamily: 'inherit',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6F9273" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" />
                </svg>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, color: '#1D1D1F', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</span>
                  {s.subtitle && <span style={{ display: 'block', fontSize: '0.78rem', color: '#86868B' }}>{s.subtitle}</span>}
                </span>
              </button>
            ))}
          </div>
        )}
        {noResults && !isSearching && query.trim().length >= 3 && (
          <div style={{ fontSize: '0.8125rem', color: '#86868B', marginTop: '0.45rem' }}>
            Нічого не знайдено - натисніть на мапі там, де вхід до закладу.
          </div>
        )}
      </div>

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
            ? 'Знайдіть адресу в пошуку або натисніть на мапі там, де вхід до закладу.'
            : 'Завантажуємо мапу…'}
      </p>
    </div>
  );
}
