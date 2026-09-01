import HomePageClient from '@/components/home/HomePageClient';
import { api } from '@/lib/api';

// КЕШУВАННЯ: Сторінка буде оновлюватися у фоні раз на 60 секунд.
export const revalidate = 60;

export default async function HomePage() {
  // Раніше цей файл читав таблицю businesses НАПРЯМУ через Supabase - тому
  // список був порожній: RLS справедливо не пускає анонімний доступ до
  // таблиці. Тепер через FastAPI, який сам вирішує, що показувати публічно
  // (лише is_active=true, з підняттям радар-бустів у топ).
  let businesses: Awaited<ReturnType<typeof api.listBusinesses>> = [];
  try {
    businesses = await api.listBusinesses(100);
  } catch (error) {
    console.error('Помилка завантаження салонів:', error);
  }

  return <HomePageClient initialBusinesses={businesses} />;
}
