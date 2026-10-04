import { test, expect } from '@playwright/test';

// Публічна вітрина: працює без входу. Тести навмисно не залежать від
// наявності закладів у базі - сторінки мають рендеритись і при порожньому
// списку, і коли бекенд недоступний.

test.describe('Головна сторінка', () => {
  test('відкривається без помилок у консолі', async ({ page, isMobile }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/BookEra/);
    await expect(page.getByText('BookEra').first()).toBeVisible();
    // На мобільному пошук згорнутий в іконки - поля вводу видно лише на десктопі.
    if (!isMobile) {
      await expect(page.locator('input[placeholder="Послуга, бренд або салон"]:visible').first()).toBeVisible();
    }

    expect(errors).toEqual([]);
  });

  test('є поле вводу міста і воно приймає текст', async ({ page, isMobile }) => {
    test.skip(isMobile, 'на мобільному поле міста згорнуте');
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const city = page.locator('input[placeholder="Місто"]:visible, input[placeholder="Де шукаємо?"]:visible').first();
    await expect(city).toBeVisible();
    await city.fill('Київ');
    await expect(city).toHaveValue('Київ');
  });

  test('на мобільному немає горизонтального скролу', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe('Сторінка закладу', () => {
  test('неіснуючий slug дає 404', async ({ page }) => {
    const response = await page.goto('/this-salon-does-not-exist-e2e', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(404);
  });

  test('запит файлу (slug з крапкою) дає 404, а не пошук у базі', async ({ page }) => {
    const response = await page.goto('/icon-192x192.png.map', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(404);
  });
});
