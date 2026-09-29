import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `vite build --mode embed` makes a single JS/CSS bundle (no lazy chunks) with
// relative paths, which scripts/build-embed.mjs inlines into one HTML file.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: { port: 5173 },
  base: mode === 'embed' ? './' : '/',
  define: mode === 'embed' ? { 'import.meta.env.VITE_EMBED': JSON.stringify('1') } : {},
  build:
    mode === 'embed'
      ? { outDir: 'dist-embed', cssCodeSplit: false, rollupOptions: { output: { inlineDynamicImports: true } } }
      : {},
}));
