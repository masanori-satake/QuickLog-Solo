import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.js/,
  use: {
    baseURL: 'http://localhost:8080/src/app.html',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
});
