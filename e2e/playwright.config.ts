import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.test.ts',
  timeout: 60_000,
  workers: 1, // single Chrome profile — cannot run test files in parallel
  use: {
    headless: false, // Chrome extension APIs require headed mode
  },
});
