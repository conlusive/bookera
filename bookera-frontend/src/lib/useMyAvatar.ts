'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';

/**
 * Фото поточного користувача - одне джерело для всіх шапок і меню.
 *
 * Спершу миттєво з localStorage (перший кадр без миготіння), далі раз на вкладку
 * звіряється з сервером: фото могли змінити на іншому пристрої, а в кабінеті
 * localStorage міг бути порожнім. Зміни (завантаження/видалення в профілі)
 * доходять через подію `storage`, яку профіль уже розсилає.
 */
const KEY = 'userAvatar';
let synced = false;
let inflight: Promise<void> | null = null;

const read = () => { try { return localStorage.getItem(KEY) || null; } catch { return null; } };

async function syncFromServer() {
  if (synced) return;
  if (!inflight) {
    inflight = (async () => {
      try {
        const token = await getAuthToken();
        const me = await api.getMe(token);
        const url = me.avatar_url || null;
        if (url !== read()) {
          if (url) localStorage.setItem(KEY, url); else localStorage.removeItem(KEY);
          window.dispatchEvent(new Event('storage'));
        }
        synced = true;
      } catch { /* без мережі лишається те, що є в localStorage */ }
      finally { inflight = null; }
    })();
  }
  return inflight;
}

/** Після виходу з акаунта: наступний вхід має знову звірити фото з сервером. */
export function resetAvatarSync() { synced = false; }

export function useMyAvatar(enabled = true): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const apply = () => setUrl(read());
    apply();
    window.addEventListener('storage', apply);
    void syncFromServer();
    return () => window.removeEventListener('storage', apply);
  }, [enabled]);
  return url;
}
