import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  use: {
    headless: false, // Chrome extension APIs require headed mode
  },
});
