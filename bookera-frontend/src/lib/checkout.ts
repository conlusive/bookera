/**
 * Перехід на сторінку оплати WayForPay.
 *
 * WayForPay відкриває оплату лише POST-формою з підписаними полями, а не
 * за посиланням. Сервер віддає { action, fields } - тут будуємо приховану
 * форму й надсилаємо її: браузер переходить на сторінку оплати.
 *
 * Повертає false, якщо оплата тестова (checkout немає) - тоді гроші вже
 * «зараховано» на сервері й переходити нікуди не треба.
 */
export function goToCheckout(res: { checkout?: { action: string; fields: Record<string, string> } | null; checkout_url?: string | null }): boolean {
  if (res.checkout?.action) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = res.checkout.action;
    form.acceptCharset = 'utf-8';
    form.style.display = 'none';
    Object.entries(res.checkout.fields).forEach(([name, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = String(value);
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
    return true;
  }
  if (res.checkout_url) {
    window.location.href = res.checkout_url;
    return true;
  }
  return false;
}
