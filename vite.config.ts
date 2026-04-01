import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';
import path from 'path';

export default defineConfig({
  plugins: [
    webExtension({
      manifest: 'manifest.json',
    }),
  ],
  resolve: {
    alias: {
      '@gmail': path.resolve(__dirname, 'src/gmail'),
      '@llm': path.resolve(__dirname, 'src/llm'),
      '@analyzer': path.resolve(__dirname, 'src/analyzer'),
      '@storage': path.resolve(__dirname, 'src/storage'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@components': path.resolve(__dirname, 'src/popup/components'),
    },
  },
});
