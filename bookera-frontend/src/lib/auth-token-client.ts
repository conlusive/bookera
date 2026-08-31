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
