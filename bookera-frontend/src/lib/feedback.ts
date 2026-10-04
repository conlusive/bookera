/**
 * Відгук на дії - ПРЯМО НА МІСЦІ, без спливаючих сповіщень.
 *
 *   fieldError(поле, текст) - поле червоне, під ним текст, курсор у ньому.
 *                             Почали виправляти - червоне зникає само.
 *   actionError(текст)      - дія не вдалась: текст під кнопкою, яку
 *                             щойно натиснули (а не в кутку екрана).
 *   copied()                - маленька ✓ біля кнопки: без неї не видно,
 *                             чи скопіювалось.
 * Успіх в усьому іншому - тиша: результат і так видно на екрані.
 *
 * Працює з будь-якими наявними формами: поле знаходиться за
 * data-field / name / id, а «де щойно натиснули» - з глобального
 * відстеження останнього натиску й фокусу.
 */

let lastTarget: HTMLElement | null = null;
let installed = false;

function install() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  const remember = (e: Event) => {
    const el = e.target as HTMLElement | null;
    if (el && el.closest) lastTarget = (el.closest('button, a, input, select, textarea, [role="button"]') as HTMLElement) || el;
  };
  document.addEventListener('pointerdown', remember, true);
  document.addEventListener('focusin', remember, true);
  // Будь-який новий натиск прибирає старі повідомлення про невдалу дію
  document.addEventListener('pointerdown', e => {
    document.querySelectorAll('.bk-action-error').forEach(n => {
      if (!n.contains(e.target as Node)) n.remove();
    });
  }, true);
}
if (typeof window !== 'undefined') install();

const isField = (el: Element | null): boolean =>
  !!el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);

/** Де шукати поле: у відкритому вікні чи формі, де щойно працювали. */
function scope(): ParentNode {
  const from = lastTarget || (document.activeElement as HTMLElement | null);
  return (from?.closest('[role="dialog"], form, .modal, .modal-content, [class*="modal"]') as HTMLElement) || document;
}

function resolveField(field: string | HTMLElement | null | undefined): HTMLElement | null {
  if (!field) return isField(lastTarget) ? (lastTarget as HTMLElement) : null;
  if (typeof field !== 'string') return field;
  const sel = `[data-field="${field}"], [name="${field}"], #${CSS.escape(field)}`;
  return (scope().querySelector(sel) as HTMLElement) || (document.querySelector(sel) as HTMLElement);
}

/** Куди вставити текст помилки: після поля або після його обгортки (+380, ₴). */
function anchorOf(el: HTMLElement): HTMLElement {
  // fm-affix - поле з одиницею (₴, мл): помилка під усією обгорткою, інакше одиниця зсувається вниз
  const wrap = el.closest('[data-error-anchor], .fm-affix') as HTMLElement | null;
  if (wrap) return wrap;
  const parent = el.parentElement;
  // Поле в рядку з префіксом чи одиницею («+380 [   ]», «[   ] ₴») - під усім рядком
  if (parent && parent.children.length <= 3 && getComputedStyle(parent).display.includes('flex') && getComputedStyle(parent).flexDirection !== 'column') {
    return parent;
  }
  return el;
}

export function clearFieldError(el: HTMLElement) {
  el.classList.remove('bk-invalid');
  el.removeAttribute('aria-invalid');
  const a = anchorOf(el);
  if (a.nextElementSibling?.classList.contains('bk-field-error')) a.nextElementSibling.remove();
  a.classList.remove('bk-invalid-wrap');
}

/** Поле червоне, під ним текст, фокус у ньому. Повертає false, якщо поля не знайдено. */
export function fieldError(field: string | HTMLElement | null | undefined, message: string): boolean {
  if (typeof document === 'undefined') return false;
  const el = resolveField(field);
  if (!el) return false;
  const a = anchorOf(el);
  el.classList.add('bk-invalid');
  el.setAttribute('aria-invalid', 'true');
  if (a !== el) a.classList.add('bk-invalid-wrap');
  let msg = a.nextElementSibling as HTMLElement | null;
  if (!msg?.classList.contains('bk-field-error')) {
    msg = document.createElement('div');
    msg.className = 'bk-field-error';
    msg.setAttribute('role', 'alert');
    a.insertAdjacentElement('afterend', msg);
  }
  msg.textContent = message;
  // Струснути, щоб око помітило, і поставити курсор
  el.classList.remove('bk-shake'); void el.offsetWidth; el.classList.add('bk-shake');
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  try { (el as HTMLInputElement).focus({ preventScroll: true }); } catch { /* не фокусується */ }
  const clear = () => { clearFieldError(el); el.removeEventListener('input', clear); el.removeEventListener('change', clear); };
  el.addEventListener('input', clear);
  el.addEventListener('change', clear);
  return true;
}

/** Дія не вдалась - текст під кнопкою, яку щойно натиснули. */
export function actionError(message: string) {
  if (typeof document === 'undefined') return;
  const btn = lastTarget && document.contains(lastTarget) ? lastTarget : null;
  // Натискали в полі (Enter) - підсвічуємо саме поле
  if (btn && isField(btn)) { fieldError(btn, message); return; }
  const box = document.createElement('div');
  box.className = 'bk-action-error';
  box.setAttribute('role', 'alert');
  box.textContent = message;
  if (btn) {
    // Під рядком кнопок, а не між ними
    const row = btn.parentElement && getComputedStyle(btn.parentElement).display.includes('flex') && getComputedStyle(btn.parentElement).flexDirection !== 'column'
      ? btn.parentElement : btn;
    const next = row.nextElementSibling;
    if (next?.classList.contains('bk-action-error')) next.remove();
    row.insertAdjacentElement('afterend', box);
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } else {
    // Нема до чого привʼязати (помилка під час завантаження) - вгорі відкритого вікна чи сторінки
    const host = (document.querySelector('[role="dialog"]') as HTMLElement) || (document.querySelector('main') as HTMLElement) || document.body;
    host.prepend(box);
  }
  setTimeout(() => box.remove(), 8000);
}

/** ✓ біля кнопки - лише там, де інакше не видно результату (копіювання). */
export function copied(text = 'Скопійовано') {
  if (typeof document === 'undefined' || !lastTarget || !document.contains(lastTarget)) return;
  const r = lastTarget.getBoundingClientRect();
  const tick = document.createElement('div');
  tick.className = 'bk-copied';
  tick.textContent = `✓ ${text}`;
  tick.style.top = `${r.top + window.scrollY - 30}px`;
  tick.style.left = `${r.left + window.scrollX + r.width / 2}px`;
  document.body.appendChild(tick);
  setTimeout(() => tick.remove(), 1400);
}

/**
 * Сумісність зі старим showToast(текст, тип, { field }): помилки - на місці,
 * «скопійовано» - галочка, решта успіхів - тиша.
 */
export function notify(message: string, type: 'success' | 'error' | 'info' = 'success', opts?: { field?: string }) {
  if (type === 'error') {
    if (opts?.field && fieldError(opts.field, message)) return;
    actionError(message);
    return;
  }
  if (/скопійов|copied/i.test(message)) copied();
}
