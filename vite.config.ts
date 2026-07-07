import { defineConfig } from 'vite';

const repoBase = '/Classics_MsPacman/';

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
