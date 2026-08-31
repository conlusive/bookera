import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import SalonClient from './SalonClient';

export const revalidate = 60; // Кешуємо на 60 секунд для швидкості

export default async function SalonPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  const supabase = await createClient();

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

  // Отримуємо все паралельно НА СЕРВЕРІ
  const [bizRes, servicesRes, staffRes, reviewsRes] = await Promise.all([
    supabase.from('businesses').select('*').eq(isUUID ? 'id' : 'slug', slug).maybeSingle(),
    supabase.from('services').select('*').eq(isUUID ? 'business_id' : 'business_id', isUUID ? slug : undefined).order('price', { ascending: true }),
    supabase.from('users').select('*').eq('role', 'master'), // Спрощено для MVP
    supabase.from('reviews').select('*').order('created_at', { ascending: false })
  ]);

  if (!bizRes.data) {
    notFound();
  }

  // Для послуг і відгуків, якщо шукали по slug, треба відфільтрувати по id знайденого бізнесу
  const bizId = bizRes.data.id;
  const filteredServices = isUUID ? servicesRes.data : (servicesRes.data?.filter(s => s.business_id === bizId) || []);
  const filteredStaff = staffRes.data?.filter(s => s.business_id === bizId) || [];
  const filteredReviews = reviewsRes.data?.filter(r => r.business_id === bizId) || [];

  return (
    <SalonClient
      initialSalon={bizRes.data}
      initialServices={filteredServices || []}
      initialTeam={filteredStaff}
      initialReviews={filteredReviews}
    />
  );
}