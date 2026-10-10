import { defineConfig, type Plugin, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

/**
 * Fails the build when two chunks statically import each other. Circular chunks evaluate in the
 * wrong order in the browser (e.g. "Cannot set properties of undefined (setting 'Activity')").
 */
const noCircularChunks: Plugin = {
  name: 'orbit:no-circular-chunks',
  apply: 'build',
  generateBundle(_options, bundle) {
    const imports = new Map<string, string[]>();
    for (const file of Object.values(bundle)) if (file.type === 'chunk') imports.set(file.fileName, file.imports);
    const state = new Map<string, 'visiting' | 'done'>();
    const visit = (name: string, path: string[]): void => {
      if (state.get(name) === 'done') return;
      if (state.get(name) === 'visiting') this.error(`Circular chunk imports: ${[...path.slice(path.indexOf(name)), name].join(' -> ')}`);
      state.set(name, 'visiting');
      for (const dep of imports.get(name) ?? []) visit(dep, [...path, name]);
      state.set(name, 'done');
    };
    for (const name of imports.keys()) visit(name, []);
  },
};

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
    noCircularChunks,
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
        // Keep vendor groups self-contained: a group that shares CommonJS helpers with `react`
        // (e.g. Radix) can make the chunks import each other and crash React at startup.
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
} satisfies UserConfig;
