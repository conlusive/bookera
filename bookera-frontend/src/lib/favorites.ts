import { api } from '@/lib/api';

/**
 * Улюблені заклади - одна логіка для всіх сторінок.
 *
 * Коли людина увійшла, ДЖЕРЕЛО ПРАВДИ - СЕРВЕР. Раніше головна читала
 * улюблені лише з localStorage: на сервер записувала, а при завантаженні
 * не читала ніколи. В іншому браузері сховище порожнє - і сердечка
 * порожні, хоча на сервері все збережено.
 *
 * Два ключі, і різниця між ними важлива:
 *
 *   GUEST_KEY - обране ДО входу. Лише його дописуємо на сервер після
 *               входу, а потім очищаємо.
 *   CACHE_KEY - копія останнього відомого стану, щоб сердечка
 *               зʼявлялись одразу, до відповіді сервера. На сервер НЕ
 *               пишеться ніколи.
 *
 * Раніше на сервер дописувався весь кеш - і виходило воскресіння:
 * прибрали заклад в одному браузері, а інший зі старим кешем повертав
 * його назад.
 */
const GUEST_KEY = 'bookera_favs_guest';
const CACHE_KEY = 'bookera_favs';

function read(key: string): number[] {
  try {
    const raw = localStorage.getItem(key);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}

function write(key: string, ids: number[]) {
  try { localStorage.setItem(key, JSON.stringify(ids)); } catch { /* приватний режим */ }
}

/** Миттєвий стан із кешу - для першого кадру, до відповіді сервера. */
export function cachedFavoriteIds(): number[] {
  if (typeof window === 'undefined') return [];
  // Гість: його улюблені живуть лише тут. Старі версії писали в CACHE_KEY.
  const guest = read(GUEST_KEY);
  return guest.length ? guest : read(CACHE_KEY);
}

/**
 * Справжній список. Із токеном - з сервера, плюс переносимо туди
 * обране до входу. Без токена - обране гостем.
 */
export async function loadFavorites(token: string | null): Promise<{ ids: number[]; businesses: any[] }> {
  if (!token) {
    const ids = cachedFavoriteIds();
    return { ids, businesses: [] };
  }

  const guest = read(GUEST_KEY);
  let businesses: any[] = await api.listMyFavorites(token);
  const onServer = new Set(businesses.map((b: any) => Number(b.id)));

  const toUpload = guest.filter(id => !onServer.has(id));
  if (toUpload.length > 0) {
    await Promise.all(toUpload.map(id => api.addFavorite(token, id).catch(() => null)));
    businesses = await api.listMyFavorites(token);
  }
  try { localStorage.removeItem(GUEST_KEY); } catch { /* */ }

  const ids = businesses.map((b: any) => Number(b.id));
  write(CACHE_KEY, ids);
  return { ids, businesses };
}

/**
 * Перемкнути улюблене. Із токеном - на сервері; без - у гостьовому
 * списку. Кидає помилку, якщо сервер не прийняв: викликач має
 * повернути сердечко як було, а не показувати неправду.
 */
export async function setFavorite(bizId: number, makeFavorite: boolean, token: string | null, current: number[]): Promise<number[]> {
  const next = makeFavorite ? Array.from(new Set([...current, bizId])) : current.filter(id => id !== bizId);

  if (token) {
    if (makeFavorite) await api.addFavorite(token, bizId);
    else await api.removeFavorite(token, bizId);
  } else {
    write(GUEST_KEY, next);
  }
  write(CACHE_KEY, next);
  return next;
}
