import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/Classics_MsPacman/' : '/',
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
}));
