import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/** npm run screens：主な画面のスクリーンショットを docs/screens/ に保存する（ラフと同じ 780×1688） */
export default defineConfig({
  ...base,
  testMatch: /screens\.spec\.ts/,
  testIgnore: undefined,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    ...base.use,
    deviceScaleFactor: 2,
  },
});
