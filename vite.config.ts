import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Modes:
//   (default)    local app, everything saved in the browser.
//   embed        one JS/CSS bundle with relative paths; scripts/build-embed.mjs
//                inlines it into a single HTML file for the claude.ai preview.
//   hostinger    the app for the live website: served from /app/, cloud sync
//                through the PHP API at /api/ (scripts/build-hostinger.mjs).
//   cloud        local development against the PHP API (php -S 127.0.0.1:8099 -t server).
export default defineConfig(({ mode }) => {
  const withApi = mode === 'hostinger' || mode === 'cloud';
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: { '/api': 'http://127.0.0.1:8099' },
    },
    base: mode === 'embed' ? './' : mode === 'hostinger' ? '/app/' : '/',
    define: {
      ...(mode === 'embed' ? { 'import.meta.env.VITE_EMBED': JSON.stringify('1') } : {}),
      ...(withApi ? { 'import.meta.env.VITE_API_BASE': JSON.stringify('/api/') } : {}),
    },
    build:
      mode === 'embed'
        ? { outDir: 'dist-embed', cssCodeSplit: false, rollupOptions: { output: { inlineDynamicImports: true } } }
        : mode === 'hostinger'
          ? { outDir: 'dist-hostinger/app', emptyOutDir: true }
          : {},
  };
});
