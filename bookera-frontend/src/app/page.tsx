import { createClient } from '@supabase/supabase-js';
import HomePageClient from './HomePageClient';

// КЕШУВАННЯ: Сторінка буде оновлюватися у фоні раз на 60 секунд.
export const revalidate = 60;

export default async function HomePage() {
  // Ініціалізуємо серверний клієнт Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // ВИПРАВЛЕНО: Запитуємо ТІЛЬКИ ті колонки, які реально існують у вашій БД
  const { data: businesses, error } = await supabase
    .from('businesses')
    .select('id, slug, name, category, description, address, cover_photo, logo')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error("Помилка завантаження бази на сервері:", error.message);
  }

  // Передаємо готові дані в клієнтський компонент
  return <HomePageClient initialBusinesses={businesses || []} />;
}