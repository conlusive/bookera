/**
 * Тексти помилок входу й реєстрації українською + перевірка пароля.
 *
 * Supabase повертає англійські повідомлення; людина не повинна бачити
 * «Email not confirmed» чи «User already registered».
 */

export function authErrorText(message: string | undefined | null): string {
  const m = (message || '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'Невірна пошта або пароль';
  if (m.includes('email not confirmed')) return 'Пошту ще не підтверджено. Відкрийте лист від BookEra та натисніть посилання в ньому.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Акаунт із такою поштою вже є. Спробуйте увійти.';
  if (m.includes('password') && (m.includes('weak') || m.includes('at least') || m.includes('should contain'))) {
    return 'Пароль надто простий: потрібно щонайменше 8 символів, латинські літери та цифри.';
  }
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes')) return 'Забагато спроб. Зачекайте хвилину й повторіть.';
  if (m.includes('invalid email') || m.includes('unable to validate email')) return 'Некоректна пошта';
  if (m.includes('signup') && m.includes('disabled')) return 'Реєстрацію тимчасово вимкнено';
  if (m.includes('network') || m.includes('failed to fetch')) return 'Немає звʼязку з сервером. Спробуйте ще раз.';
  return message || 'Щось пішло не так. Спробуйте ще раз.';
}

/** Правило пароля для реєстрації; null - пароль підходить. Те саме значення має стояти в налаштуваннях Supabase. */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'Пароль має містити щонайменше 8 символів';
  // Supabase вимагає латинську літеру й цифру (налаштування проєкту), тож перевіряємо те саме
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'У паролі мають бути латинські літери та цифри';
  return null;
}

/** Лист підтвердження надіслано, а сесії ще немає (Supabase вимагає підтвердити пошту). */
export const CONFIRM_EMAIL_NOTICE = (email: string) =>
  `Ми надіслали лист на ${email}. Підтвердьте пошту за посиланням у листі, а потім увійдіть.`;
