import HomePageClient from '@/components/home/HomePageClient';
import { api } from '@/lib/api';

// КЕШУВАННЯ: сторінка оновлюється у фоні раз на 60 секунд.
//
// Значення - просте число, не вираз. Next.js читає налаштування сторінки
// ще до виконання коду й розуміє лише літерали: умова тут проходила в
// режимі розробки, але валила продакшн-збірку.
//
// Окремий режим для розробки не потрібен: `next dev` і так рендерить
// сторінку заново на кожен запит.
export const revalidate = 60;

export default async function HomePage() {
  // Раніше цей файл читав таблицю businesses НАПРЯМУ через Supabase - тому
  // список був порожній: RLS справедливо не пускає анонімний доступ до
  // таблиці. Тепер через FastAPI, який сам вирішує, що показувати публічно
  // (лише is_active=true, з підняттям радар-бустів у топ).
  let businesses: Awaited<ReturnType<typeof api.listBusinesses>> = [];
  try {
    // Кеш 60 с - той самий, що й revalidate сторінки. Без нього запит
    // був без кешу, і сторінка рендерилась для кожного відвідувача.
    businesses = await api.listBusinesses(100, 0, 60);
  } catch (error) {
    console.error('Помилка завантаження салонів:', error);
  }

  // Правила позиції (ваги якості, відстані, вільних вікон і Радара) -
  // з сервера: вітрина не має власних копій, тож «що дає Радар» не розійдеться.
  let rankingRules: Awaited<ReturnType<typeof api.getRankingRules>> | null = null;
  try {
    rankingRules = await api.getRankingRules(60);
  } catch (error) {
    console.error('Не вдалося завантажити правила видачі:', error);
  }

  return <HomePageClient initialBusinesses={businesses} rankingRules={rankingRules} />;
}
