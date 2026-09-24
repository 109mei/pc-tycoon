import { defineConfig, devices } from '@playwright/test';

/** e2e：390×844 のスマホ縦画面で、公開用のビルドを動かして確かめる */
const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  testMatch: /.*\.spec\.ts/,
  testIgnore: /screens\.spec\.ts/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}/pc-tycoon/`,
    ...devices['Pixel 7'],
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
    locale: 'ja-JP',
    colorScheme: 'light',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium-390x844' }],
  webServer: {
    command: `npx vite build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/pc-tycoon/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
