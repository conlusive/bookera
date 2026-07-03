'use server'

import { createClient } from '@/utils/supabase/server'

export async function signUpUser(formData: { email: string; password: username } & any) {
  const supabase = createClient()

  // 1. Реєстрація користувача в системі Supabase Auth
  const { data, error } = await supabase.auth.signUp({
  email: formData.email.trim().toLowerCase(), // прибере пробіли і зробить літери маленькими
  password: formData.password,
})

  if (error) {
    return { success: false, error: error.message }
  }

  if (data.user) {
    // 2. Створення запису у нашій таблиці profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: data.user.id,
          full_name: formData.fullName,
          role: 'client',
        },
      ])

    if (profileError) {
      return { success: false, error: profileError.message }
    }
  }

  return { success: true }
}