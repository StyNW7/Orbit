import { defineConfig, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ command }) => {
  // The monorepo root .env is shared with the API and sets NODE_ENV=development, which Vite would
  // honour and ship React's development build. Production builds always use production React.
  if (command === 'build' && process.env.VITE_USER_NODE_ENV === undefined) process.env.VITE_USER_NODE_ENV = '';
  return config;
});

const config = {
  // Read VITE_* variables from the monorepo root .env (server secrets are never prefixed with VITE_).
  envDir: '../../',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'demo/sample-cv-stanley-wijaya.pdf'],
      manifest: {
        name: 'Orbit — Build Your Path. Become Career-Ready.',
        short_name: 'Orbit',
        description: 'Agentic career & personal growth platform — English & Bahasa Indonesia.',
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
          react: ['react', 'react-dom', 'react-dom/client', 'react-router'],
          graph: ['sigma', 'graphology', 'graphology-layout-forceatlas2', 'graphology-layout'],
          flow: ['@xyflow/react'],
          charts: ['recharts'],
          motion: ['motion'],
          supabase: ['@supabase/supabase-js'],
          markdown: ['react-markdown', 'remark-gfm'],
          radix: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-progress',
            '@radix-ui/react-avatar',
          ],
          query: ['@tanstack/react-query', 'zustand'],
        },
      },
    },
  },
} satisfies UserConfig;
