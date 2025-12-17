import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '#/': path.resolve(__dirname, './src/'),
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        deps: {
            inline: ['element-plus'],
        },
    },
});
