// Service Worker: офлайн-запасний варіант для двох сторінок бізнесу.
//
// Раніше сторінки віддавались із кешу ЗАВЖДИ (cache-first, версія v1 без
// очищення) - відвідувачі, які вже заходили, не бачили жодних оновлень
// після релізу. Тепер спершу мережа: свіжа сторінка завжди в пріоритеті й
// заодно оновлює кеш, а кеш потрібен лише коли зв'язку немає.
const CACHE_NAME = 'bookera-cache-v2';
const OFFLINE_PAGES = ['/business', '/business/register'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_PAGES)));
});

self.addEventListener('activate', (e) => {
  // Старі версії кешу (v1) більше не потрібні
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || !OFFLINE_PAGES.includes(url.pathname)) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
