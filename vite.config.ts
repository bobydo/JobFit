import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import webExtension from 'vite-plugin-web-extension';
import path from 'path';
import { readFileSync, copyFileSync, mkdirSync, existsSync } from 'fs';

function copyPdfWorker() {
  return {
    name: 'copy-pdf-worker',
    closeBundle() {
      const src = path.resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
      const destDir = path.resolve(__dirname, 'dist/assets');
      const dest = path.join(destDir, 'pdf.worker.min.mjs');
      if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
      copyFileSync(src, dest);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      webExtension({
        manifest: () => {
          const base = JSON.parse(readFileSync('./manifest.json', 'utf-8'));
          base.oauth2.client_id = env.VITE_OAUTH_CLIENT_ID;
          if (env.VITE_EXTENSION_KEY) base.key = env.VITE_EXTENSION_KEY;
          return base;
        },
        watchFilePaths: ['src/**/*'],
        disableAutoLaunch: true,
      }),
      copyPdfWorker(),
    ],

    build: {
      sourcemap: true,
      outDir: 'dist',
      emptyOutDir: true,
    },

    resolve: {
      alias: {
        '@gmail': path.resolve(__dirname, 'src/gmail'),
        '@drive': path.resolve(__dirname, 'src/drive'),
        '@llm': path.resolve(__dirname, 'src/llm'),
        '@analyzer': path.resolve(__dirname, 'src/analyzer'),
        '@storage': path.resolve(__dirname, 'src/storage'),
        '@utils': path.resolve(__dirname, 'src/utils'),
        '@components': path.resolve(__dirname, 'src/popup/components'),
      },
    },
  };
});