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
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'pinia'],
          'editor': ['@toast-ui/editor', '@toast-ui/editor-plugin-table-merged-cell'],
          'vue-flow': [
            '@vue-flow/core',
            '@vue-flow/background',
            '@vue-flow/controls',
            '@vue-flow/minimap',
            '@vue-flow/node-resizer',
          ],
          'element-plus': ['element-plus', '@element-plus/icons-vue'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
});
