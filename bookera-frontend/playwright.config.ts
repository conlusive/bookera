import { defineConfig, devices } from '@playwright/test';

// Порт відмінний від 3000, щоб не конфліктувати з запущеним `npm run dev`.
const PORT = Number(process.env.E2E_PORT || 3100);
const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  // `next dev` компілює кожну сторінку при першому запиті - це довго.
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    // Сторінки тягнуть відео та зовнішні картинки, тому подія `load` може
    // не настати. Для вітрини достатньо готового DOM.
    navigationTimeout: 45_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // Мобільний вигляд окремо: вітрина - це здебільшого телефони.
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  // Якщо задано E2E_BASE_URL - тестуємо вже запущений сервер (staging),
  // а свій не піднімаємо.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next dev -p ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
