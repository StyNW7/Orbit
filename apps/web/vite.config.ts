import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // Read VITE_* variables from the monorepo root .env (server secrets are never prefixed with VITE_).
  envDir: '../../',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'demo/sample-cv-raka-pratama.pdf'],
      manifest: {
        name: 'Orbit — Build Your Path. Become Career-Ready.',
        short_name: 'Orbit',
        description: 'Agentic career & personal growth platform.',
        theme_color: '#0AB46A',
        background_color: '#F8FAF9',
        display: 'standalone',
        start_url: '/app',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173 },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router'],
          graph: ['sigma', 'graphology', 'graphology-layout-forceatlas2', 'graphology-layout'],
          flow: ['@xyflow/react'],
          charts: ['recharts'],
          motion: ['motion'],
        },
      },
    },
  },
});
