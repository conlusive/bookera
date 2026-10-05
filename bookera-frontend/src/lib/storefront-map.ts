/**
 * Карта на сторінці закладу - одне місце для вітрини й редактора.
 *
 * Раніше обидва будували запит самі і, якщо адреси не було, підставляли
 * «Львів» - заклад із Києва без адреси показував карту Львова. Тепер:
 * точні координати (їх шукає «Налаштування → Профіль»), інакше адреса з
 * містом, інакше карти немає взагалі.
 */
export interface StorefrontMap {
  embedUrl: string;
  link: string;
}

export function storefrontMap(b: {
  address?: string | null;
  city?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
} | null | undefined): StorefrontMap | null {
  if (!b) return null;
  const lat = Number(b.latitude);
  const lng = Number(b.longitude);
  let query: string;
  if (b.latitude != null && b.longitude != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    query = `${lat},${lng}`;
  } else {
    const parts = [b.address, b.city].map(p => (p || '').trim()).filter(Boolean);
    if (parts.length === 0) return null;
    query = [...parts, 'Україна'].join(', ');
  }
  const q = encodeURIComponent(query);
  return {
    embedUrl: `https://maps.google.com/maps?q=${q}&t=m&z=17&ie=UTF8&iwloc=&output=embed`,
    link: `https://www.google.com/maps/search/?api=1&query=${q}`,
  };
}
