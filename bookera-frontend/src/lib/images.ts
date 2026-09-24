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
