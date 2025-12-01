import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false, // Don't clear dist between builds
    rollupOptions: {
      input: resolve(__dirname, 'src/content/content.ts'),
      output: {
        entryFileNames: 'content.js',
        format: 'iife',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});

