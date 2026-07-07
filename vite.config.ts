import { defineConfig } from 'vite';

// GitHub Pages currently publishes from repo root, so the built site lives under /docs/.
// If Pages is switched to "main /docs", change this to '/Classics_MsPacman/'.
const repoBase = '/Classics_MsPacman/docs/';

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? repoBase : '/',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
}));
