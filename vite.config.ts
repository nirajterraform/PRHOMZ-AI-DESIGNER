import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), tailwindcss()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // Additive: build the real app (index.html) AND the backend-free design
        // mock (preview.html) so the mock is reachable at /preview.html on a
        // Firebase preview channel. Does not change the main app entry.
        rollupOptions: {
          input: {
            main: path.resolve(__dirname, 'index.html'),
            preview: path.resolve(__dirname, 'preview.html'),
          },
        },
      },
    };
});
