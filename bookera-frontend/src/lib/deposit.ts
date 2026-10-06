/**
 * Завдаток за налаштуваннями закладу (payments_settings) - лише для показу людині ДО запису.
 * Справжню суму вираховує й вимагає сервер (app/services/booking_rules.deposit_for): тут те саме правило.
 */
export type PaymentsSettings = { require_deposit?: boolean; deposit_type?: string; deposit_amount?: number | string } | null | undefined;

export function depositFor(settings: PaymentsSettings, price: number): number {
  if (!settings || settings.require_deposit !== true) return 0;
  const amount = Number(settings.deposit_amount);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const due = settings.deposit_type === 'percent'
    ? Math.round(price * Math.min(amount, 100)) / 100
    : Math.min(amount, price);
  return due > 0 ? Math.round(due * 100) / 100 : 0;
}
