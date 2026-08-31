import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * Те саме, що auth-token-client.ts, але для Server Components / Server
 * Actions - використовує cookies() замість localStorage браузера.
 * 'server-only' на першому рядку - якщо якийсь Client Component випадково
 * імпортує цей файл, збірка впаде одразу з зрозумілою помилкою, а не
 * мовчки протягне next/headers у браузерний бандл (саме так стався
 * попередній баг збірки).
 */
export async function getAuthTokenServer(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    throw new Error('Сесія закінчилась, увійдіть знову');
  }

  return data.session.access_token;
}
