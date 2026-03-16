import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html'),
        service_worker: resolve(__dirname, 'src/background/service-worker.ts'),
        linkedin: resolve(__dirname, 'src/content/linkedin.tsx'),
        smart_scrape: resolve(__dirname, 'src/content/smart-scrape.ts')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'service_worker') {
            return 'background/service-worker.js';
          }
          if (chunkInfo.name === 'linkedin') {
            return 'content/linkedin.js';
          }
          if (chunkInfo.name === 'smart_scrape') {
            return 'content/smart-scrape.js';
          }
          return 'assets/[name]-[hash].js';
        }
      }
    }
  }
});
