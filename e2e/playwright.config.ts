import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.test.ts',
  timeout: 60_000,
  use: {
    headless: false, // Chrome extension APIs require headed mode
  },
});
