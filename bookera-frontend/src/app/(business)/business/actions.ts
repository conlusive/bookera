'use server'

import { createClient } from '@/lib/supabase/server'

export async function signUpUser(formData: { email: string; password: string; fullName?: string } & any) {
  const supabase = await createClient()

  // 1. Реєстрація користувача в системі Supabase Auth
  const { data, error } = await supabase.auth.signUp({
  email: formData.email.trim().toLowerCase(), // прибере пробіли і зробить літери маленькими
  password: formData.password,
})

  if (error) {
    return { success: false, error: error.message }
  }

  // ПРИМІТКА: раніше тут одразу писався рядок у таблицю Supabase 'profiles' -
  // такої таблиці більше немає в новій схемі (замінена на 'users' на бекенді).
  // Запис у users створюється лише тоді, коли він реально потрібен - при
  // реєстрації бізнесу (api.registerBusiness) або прийнятті запрошення
  // (api.acceptStaffInvite). Просто зареєстрований відвідувач-клієнт власного
  // рядка в users поки не потребує - гостьове бронювання цього не вимагає.

  return { success: true }
}