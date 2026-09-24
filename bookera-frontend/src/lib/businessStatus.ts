/**
 * Статус закладу просто зараз.
 *
 * Раніше на кожній картці стояло «Відкрито» - незалежно від часу
 * й графіка. О третій ночі теж.
 *
 * Три різні стани, і вони означають різне:
 *   open   - працює за графіком
 *   closed - зачинено за графіком: сьогодні вихідний або вже пізно
 *   paused - заклад сам зупинив запис (ремонт, хвороба майстра).
 *            Це тимчасово, і сказати «зачинено» було б неточно:
 *            людина вирішила б, що заклад не працює взагалі.
 */
export function getOpenStatus(biz: any): { state: 'open' | 'closed' | 'paused'; label: string } {
  if (biz.booking_settings?.is_paused_emergency) {
    return { state: 'paused', label: 'Запис тимчасово зупинено' };
  }

  const hours = biz.working_hours;
  if (!Array.isArray(hours) || hours.length === 0) {
    // Графік не заповнений - не стверджуємо нічого. «Відкрито»
    // без даних було б вигадкою, «Зачинено» - наклепом.
    return { state: 'open', label: '' };
  }

  const now = new Date();
  // weekday у базі: 0 = понеділок. getDay(): 0 = неділя.
  const weekday = (now.getDay() + 6) % 7;
  const today = hours.find((h: any) => Number(h.weekday) === weekday);

  if (!today || !today.is_open) {
    return { state: 'closed', label: 'Сьогодні зачинено' };
  }

  const toMinutes = (t?: string | null) => {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const open = toMinutes(today.open_time);
  const close = toMinutes(today.close_time);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  if (open == null || close == null) return { state: 'open', label: 'Відкрито' };

  if (nowMinutes < open) {
    return { state: 'closed', label: `Відчиниться о ${today.open_time}` };
  }
  if (nowMinutes >= close) {
    return { state: 'closed', label: 'Зачинено' };
  }

  // Попередження за годину до закриття: людина не встигне
  // записатись, і краще дізнатись про це зараз.
  if (close - nowMinutes <= 60) {
    return { state: 'open', label: `Зачиниться о ${today.close_time}` };
  }

  return { state: 'open', label: 'Відкрито' };
}
