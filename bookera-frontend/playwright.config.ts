import { defineConfig, devices } from '@playwright/test';

/**
 * Детальніше: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Вказуємо папку, де лежатимуть файли тестів (*.spec.ts)
  testDir: './e2e',

  // Таймаут для кожного тесту (30 секунд)
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },

  /* Запуск тестів у паралельному режимі */
  fullyParallel: true,

  /* Забороняємо test.only на CI серверах */
  forbidOnly: !!process.env.CI,

  /* Повторні спроби у разі падіння */
  retries: process.env.CI ? 2 : 0,

  /* Кількість потоків */
  workers: process.env.CI ? 1 : undefined,

  /* Звіт у форматі HTML */
  reporter: 'html',

  /* Загальні налаштування */
  use: {
    // 🟢 Вмикаємо базовий URL для спрощення навігації: page.goto('/slug')
    baseURL: 'http://localhost:3000',

    // Збираємо трасування при першій невдалій спробі
    trace: 'on-first-retry',

    // Робимо скріншот тільки у разі падіння тесту
    screenshot: 'only-on-failure',
  },

  /* Проєкти та браузери */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Для пришвидшення локальної розробки інші браузери можна розкоментувати за потреби:
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  /* Автоматичний запуск dev-сервера перед тестами (опціонально) */
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120 * 1000,
  // },
});