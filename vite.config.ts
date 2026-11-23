import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {fileURLToPath} from 'url';
import { readFileSync } from 'node:fs';

const appVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;

export default defineConfig(() => {
    return {
      server: {
        port: 5173,
        host: '127.0.0.1',
        base: '',
        strictPort: true,
        allowedHosts: ['localhost', '127.0.0.1', 'tangyou-pro.alphathought.org'],
        proxy: { '/api': { target: `http://127.0.0.1:${process.env.BACKEND_PORT || process.env.AI_PORT || 8787}`, changeOrigin: true } }
      },
      base: '',
      define: { __APP_VERSION__: JSON.stringify(appVersion) },
      plugins: [react(), tailwindcss()],
      build: {rollupOptions:{input:{app:fileURLToPath(new URL('./index.html',import.meta.url)),admin:fileURLToPath(new URL('./admin.html',import.meta.url))}}},
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
