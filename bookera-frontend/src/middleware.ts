import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Захист кабінету бізнесу.
  // Перевіряємо ЛИШЕ наявність сесії. Раніше тут звірялась роль з
  // user_metadata Supabase - але туди при реєстрації записується 'client'
  // (людина реєструється як звичайний користувач ДО того, як створить
  // салон), а справжня роль живе в таблиці users на бекенді. Через це
  // власника викидало з власного кабінету.
  //
  // Робити тут запит до бекенду не варто: middleware виконується на
  // КОЖЕН запит, включно зі статикою, і мережевий виклик відчутно
  // сповільнив би весь сайт. Справжня перевірка прав усе одно
  // відбувається на бекенді при кожному зверненні до /crm/* - middleware
  // тут лише зручність (не показувати кабінет незалогіненому), а не
  // межа безпеки.
  if (pathname.startsWith('/cabinet')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/business';
      return NextResponse.redirect(url);
    }
  }

  // Захист особистого кабінету клієнта
  if (pathname.startsWith('/account/profile')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};