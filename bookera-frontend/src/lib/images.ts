/**
 * Чи можна оптимізувати зображення через next/image.
 *
 * Лише хости, дозволені в next.config (Supabase, Unsplash). Власник
 * міг вказати фото з будь-якого сайту, а при завантаженні файлу адреса
 * взагалі blob: чи data: - для таких next/image без дозволу впав би
 * з помилкою й зламав сторінку. Тоді показуємо як є.
 */
const OPTIMIZABLE_HOSTS = [/\.supabase\.co$/, /^images\.unsplash\.com$/];

export function canOptimize(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' && OPTIMIZABLE_HOSTS.some(r => r.test(hostname));
  } catch {
    return false;
  }
}

/**
 * Unsplash має власний CDN, що сам віддає фото потрібного розміру й
 * формату. Пускати їх через локальний оптимізатор Next.js означало
 * зайвий перехід і повторне кодування - фото вантажились повільніше,
 * ніж напряму. Цей завантажувач просто підставляє потрібну ширину в
 * адресу Unsplash.
 */
export function isUnsplash(url: string | null | undefined): boolean {
  if (!url) return false;
  try { return new URL(url).hostname === 'images.unsplash.com'; } catch { return false; }
}

export function unsplashLoader({ src, width, quality }: { src: string; width: number; quality?: number }): string {
  const u = new URL(src);
  u.searchParams.set('w', String(width));
  u.searchParams.set('q', String(quality ?? 75));
  u.searchParams.set('auto', 'format');
  if (!u.searchParams.has('fit')) u.searchParams.set('fit', 'crop');
  return u.toString();
}

/**
 * Як показувати зображення:
 *   Unsplash  - напряму з їхнього CDN, потрібного розміру
 *   Supabase  - через оптимізатор Next.js (Supabase без платного плану
 *               розміри не змінює)
 *   решта     - як є
 */
export function imageLoadProps(url: string | null | undefined) {
  if (isUnsplash(url)) return { loader: unsplashLoader, unoptimized: false };
  return { unoptimized: !canOptimize(url) };
}
