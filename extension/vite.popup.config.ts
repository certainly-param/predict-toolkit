import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: 'manifest.json', dest: '.' },
        { src: 'icons/*', dest: 'icons' },
      ],
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: false, // Don't clear dist between builds
    rollupOptions: {
      input: resolve(__dirname, 'src/popup/index.html'),
      output: {
        entryFileNames: 'popup.js',
        chunkFileNames: 'popup-[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.html')) {
            return 'popup.html';
          }
          return '[name].[ext]';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
