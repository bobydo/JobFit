import { defineConfig } from 'vitest/config';
import path from 'path';

// Load .env into process.env for integration tests (Node 20.12+ built-in, no dotenv needed)
try { (process as NodeJS.Process & { loadEnvFile?: (p: string) => void }).loadEnvFile?.('.env'); } catch { /* .env optional */ }

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@utils': path.resolve(__dirname, 'src/utils'),
    },
  },
});
