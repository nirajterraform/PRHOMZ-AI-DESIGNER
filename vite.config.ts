import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        tailwindcss(),
        // PWA: installable app + offline shell. autoUpdate keeps the SW in lock-step
        // with the no-cache index.html (new deploy → SW updates on next load, no stale
        // bundle). Only same-origin static build assets are precached; Firebase Auth /
        // Firestore / Storage / GenAI calls are cross-origin and pass straight through
        // (no runtimeCaching configured), so the SW never touches auth or API traffic.
        VitePWA({
          registerType: 'autoUpdate',
          injectRegister: 'auto',
          includeAssets: [
            'favicon-16x16.png',
            'favicon-32x32.png',
            'apple-touch-icon.png',
          ],
          workbox: {
            globPatterns: ['**/*.{js,css,html,png,jpg,jpeg,webp,woff2}'],
            navigateFallback: '/index.html',
            // Don't hijack the backend-free mock or any Firebase auth-handler routes.
            navigateFallbackDenylist: [/^\/preview\.html$/, /^\/__\//],
            cleanupOutdatedCaches: true,
            clientsClaim: true,
            skipWaiting: true,
          },
          manifest: {
            name: 'PRHOMZ AI Designer',
            short_name: 'PRHOMZ AI',
            description: 'AI-powered interior design — redesign any room in seconds.',
            id: '/',
            start_url: '/',
            scope: '/',
            display: 'standalone',
            background_color: '#121212',
            theme_color: '#04080f',
            categories: ['lifestyle', 'productivity', 'shopping'],
            icons: [
              { src: '/favicon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
              { src: '/favicon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
              { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            ],
          },
        }),
      ],
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
