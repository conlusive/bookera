'use server'

import { revalidatePath } from 'next/cache'

/**
 * Скидає кеш публічних сторінок після змін у вітрині закладу.
 *
 * Головна й сторінка закладу кешуються на 60 с (ISR), тож нове фото чи назва
 * з'являлись би там із запізненням. Дані тут не секретні й нічого не змінюють -
 * лише змушують наступний візит перебудувати сторінку, тому перевірки прав не потрібно.
 */
export async function revalidateStorefront(slug?: string | null) {
  revalidatePath('/')
  if (slug && /^[a-z0-9-_]+$/i.test(slug)) revalidatePath(`/${slug}`)
}
