import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '#/': path.resolve(__dirname, './src/'),
    },
  },
  base: './', // Ensure assets are referenced correctly in production
  build: {
    outDir: 'dist', // Output to 'dist' for the renderer
  },
});
