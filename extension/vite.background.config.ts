import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false, // Don't clear dist between builds
    rollupOptions: {
      input: resolve(__dirname, 'src/background/background.ts'),
      output: {
        entryFileNames: 'background.js',
        format: 'es',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});

