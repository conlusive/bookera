import HomePageClient from '@/components/home/HomePageClient';
import { api } from '@/lib/api';

// КЕШУВАННЯ: сторінка оновлюється у фоні раз на 60 секунд.
//
// Це нормально для списку закладів, але збиває з пантелику одразу
// після змін у базі: додали координати - а сторінка ще хвилину
// віддає стару версію без них, і виглядає, ніби нічого не працює.
//
// У режимі розробки кеш вимкнений повністю: там важливо бачити
// зміни одразу, а навантаження на бекенд не має значення.
export const revalidate = process.env.NODE_ENV === 'development' ? 0 : 60;

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
