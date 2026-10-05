'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getAuthToken } from '@/lib/auth-token-client';

/**
 * Заклади, у яких людина працює, - для меню акаунта («Моя робота», «Панель салону»).
 * Один запит на вкладку браузера: результат кешується на кілька хвилин, щоб кожне
 * відкриття меню не ходило на сервер.
 */
type Workplace = Awaited<ReturnType<typeof api.listMyWorkplaces>>[number];
let cache: { at: number; data: Workplace[] } | null = null;
let inflight: Promise<Workplace[]> | null = null;
const TTL = 5 * 60 * 1000;

async function load(): Promise<Workplace[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.data;
  if (!inflight) {
    inflight = (async () => {
      try {
        const token = await getAuthToken();
        const data = await api.listMyWorkplaces(token);
        cache = { at: Date.now(), data: Array.isArray(data) ? data : [] };
        return cache.data;
      } catch {
        return [];
      } finally {
        inflight = null;
      }
    })();
  }
  return inflight;
}

export function clearWorkplacesCache() { cache = null; }

export function useMyWorkplaces(enabled = true): Workplace[] {
  const [list, setList] = useState<Workplace[]>(cache?.data ?? []);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void load().then(d => { if (alive) setList(d); });
    return () => { alive = false; };
  }, [enabled]);
  return list;
}
