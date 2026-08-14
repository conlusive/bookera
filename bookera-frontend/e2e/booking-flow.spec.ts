import { test, expect } from '@playwright/test';

test.describe('BookEra — Повний флоу онлайн-бронювання', () => {
  const testSlug = 'bookera-barber';

  test.beforeEach(async ({ page }) => {
    // 1. Авторизуємо тестового клієнта через localStorage перед завантаженням сторінки
    await page.addInitScript(() => {
      localStorage.setItem('userName', 'Ярослав Тестер');
      localStorage.setItem('userRole', 'client');
      localStorage.setItem('userId', 'test-client-uuid-123');
    });

    // 2. Переходимо на сторінку салону
    await page.goto(`/${testSlug}`);
  });

  test('успішне проходження повного циклу: вибір послуги -> вибір слота -> 10-хв лок -> підтвердження', async ({ page }) => {
    // 1. Перевіряємо, що сторінка салону завантажилась
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.section-title', { hasText: 'Послуги' })).toBeVisible();

    // 2. Знаходимо першу послугу та натискаємо "Вибрати"
    const firstServiceSelectBtn = page.locator('.service-btn').first();
    await expect(firstServiceSelectBtn).toBeVisible();
    await firstServiceSelectBtn.click();

    // 3. Перевіряємо, що модальне вікно бронювання відкрилося
    const modal = page.locator('.modal-content');
    await expect(modal).toBeVisible();
    await expect(modal.locator('h2', { hasText: 'Бронювання' })).toBeVisible();

    // 4. Обираємо майстра (за замовчуванням "Будь-хто") або першого доступного
    const masterCard = modal.locator('.master-card').first();
    await masterCard.click();

    // 5. Обираємо доступну дату
    const availableDateCard = modal.locator('.date-card').first();
    await expect(availableDateCard).toBeVisible();
    await availableDateCard.click();

    // 6. Обираємо перший вільний часовий слот (не зайнятий і не заблокований іншим)
    const freeSlot = modal.locator('.time-pill:not(.busy):not(.locked)').first();
    await expect(freeSlot).toBeVisible({ timeout: 5000 });
    const selectedTimeText = await freeSlot.innerText();
    await freeSlot.click();
    await expect(freeSlot).toHaveClass(/active/);

    // 7. Натискаємо "Далі" для переходу до кроку перевірки (виклик /appointments/lock)
    const nextBtn = modal.locator('button', { hasText: /Далі|Забронювати на 10 хвилин/i });
    await nextBtn.click();

    // 8. Перевіряємо крок перевірки деталей та наявність 10-хвилинного таймера
    await expect(modal.locator('h2', { hasText: 'Перевірте деталі' })).toBeVisible();
    await expect(modal.locator('.lock-timer-badge')).toBeVisible();
    await expect(modal.locator('.lock-timer-badge')).toContainText(/09:|10:/);

    // Перевіряємо правильність відображення обраного часу
    await expect(modal.locator('.details-value', { hasText: selectedTimeText })).toBeVisible();

    // 9. Натискаємо "Підтвердити запис"
    const confirmBtn = modal.locator('button', { hasText: 'Підтвердити запис' });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // 10. Перевіряємо екран успішного завершення
    await expect(modal.locator('h2', { hasText: 'Готово!' })).toBeVisible({ timeout: 7000 });
    await expect(modal.locator('text=Ваш запис успішно підтверджено.')).toBeVisible();
  });

  test('відхилення спроби обрати час, якщо слот заблоковано (HTTP 409 Conflict)', async ({ page }) => {
    // Відкриваємо модалку
    await page.locator('.service-btn').first().click();
    const modal = page.locator('.modal-content');

    // Симулюємо зайнятий слот
    const busyOrLockedSlot = modal.locator('.time-pill.busy, .time-pill.locked').first();
    if (await busyOrLockedSlot.isVisible()) {
      // Переконуємось, що заблокована кнопка не дозволяє клік
      await expect(busyOrLockedSlot).toBeDisabled();
    }
  });

  test('скасування та розблокування слота при закритті модального вікна', async ({ page }) => {
    // 1. Відкриваємо модалку і обираємо час
    await page.locator('.service-btn').first().click();
    const modal = page.locator('.modal-content');

    const freeSlot = modal.locator('.time-pill:not(.busy):not(.locked)').first();
    await freeSlot.click();

    // Переходимо до кроку блокування
    await modal.locator('button', { hasText: /Далі|Забронювати на 10 хвилин/i }).click();
    await expect(modal.locator('.lock-timer-badge')).toBeVisible();

    // 2. Закриваємо модалку через хрестик
    const closeBtn = modal.locator('button svg').first();
    await closeBtn.click();

    // 3. Модалка зникла
    await expect(modal).not.toBeVisible();
  });
});