import { notFound } from 'next/navigation';
import SalonClient from './SalonClient';
import { api } from '@/lib/api';

export const revalidate = 60; // Кешуємо на 60 секунд для швидкості

export default async function SalonPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;

  // Раніше цей файл читав таблиці НАПРЯМУ через Supabase - і сторінка
  // завжди давала 404, бо RLS не пускає анонімний доступ до таблиць.
  // Тепер через FastAPI: він сам розрізняє slug і числовий id, а список
  // майстрів віддає лише з безпечними полями (без телефонів/email
  // персоналу, які раніше тягнулись у браузер кожного відвідувача
  // запитом select('*') по таблиці users).
  // Браузер сам просить /favicon.ico, /apple-touch-icon.png тощо. Якщо
  // таких файлів немає в public/, запит доходить сюди - і ми марно йшли
  // в базу шукати «заклад» із назвою icon-192x192.png, засмічуючи логи.
  // Слаг ніколи не містить крапки, тому це надійна ознака запиту файлу.
  if (slug.includes('.')) notFound();

  let salon;
  try {
    salon = await api.getBusiness(slug);
  } catch (error) {
    console.error('Салон не знайдено:', slug, error);
    notFound();
  }

  const [services, team, reviews] = await Promise.all([
    api.getBusinessServices(salon.id).catch(() => []),
    api.listPublicMasters(salon.id).catch(() => []),
    api.listReviews(salon.id).catch(() => []),
  ]);

  return (
    <SalonClient
      initialSalon={salon}
      initialServices={services}
      initialTeam={team.map(m => ({ ...m, name: m.full_name }))}
      initialReviews={reviews}
    />
  );
}
