import { createClient } from '@/lib/supabase/client';

/**
 * Дістає access_token поточної Supabase-сесії для авторизованих запитів
 * до FastAPI (Authorization: Bearer ...). Використовувати ТІЛЬКИ в Client
 * Components ('use client') - для Server Components є окремий
 * auth-token-server.ts, бо вони використовують різні Supabase-клієнти
 * (браузерний localStorage проти серверних cookies), і змішувати їх в
 * одному файлі ламає збірку (бандлер тягне next/headers у клієнтський код).
 */
export async function getAuthToken(): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    throw new Error('Сесія закінчилась, увійдіть знову');
  }

  return data.session.access_token;
}

/**
 * Те саме, що getAuthToken, але повертає null замість винятку.
 *
 * Потрібне там, де відсутність сесії - ЗВИЧАЙНИЙ стан, а не аварія:
 * людина просто не увійшла або сесія добігла кінця, поки вкладка була
 * відкрита. Виняток у такому місці лише засмічує консоль помилкою
 * «Сесія закінчилась», хоча насправді нічого не зламалось - і саме
 * тому вона зʼявлялась у вас на екрані.
 *
 * Там, де токен справді обовʼязковий (збереження даних), лишається
 * getAuthToken із винятком - тиха відмова там була б гіршою.
 */
export async function getAuthTokenOrNull(): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) return null;
  return data.session.access_token;
}
