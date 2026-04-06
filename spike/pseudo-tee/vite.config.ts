import { defineConfig } from 'vite';

const rootDir = new URL('.', import.meta.url).pathname;

export default defineConfig({
  root: rootDir,
  publicDir: false,
  cacheDir: '../../node_modules/.vite/pseudo-tee',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
});
