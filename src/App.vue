<script setup lang="ts">
import { onMounted, watch, onBeforeUnmount } from "vue";
import { useSettingsStore } from "./stores/settingsStore";

const settingsStore = useSettingsStore();

onMounted(async () => {
    await settingsStore.loadSettings();
    applyTheme(settingsStore.settings.theme);
});

watch(
    () => settingsStore.settings.theme,
    (newTheme) => {
        applyTheme(newTheme);
    }
);

const applyTheme = (theme: string) => {
    const html = document.documentElement;
    if (theme === "dark") {
        html.classList.add("dark");
    } else if (theme === "light") {
        html.classList.remove("dark");
    } else {
        // System
        if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
            html.classList.add("dark");
        } else {
            html.classList.remove("dark");
        }
    }
};

import Header from "./components/Header.vue";
import MainView from "./views/MainView.vue";
import Footer from "./components/Footer.vue";
import { useFileStore } from "./stores/fileStore";
import { useMindmapStore } from "./stores/mindmapStore";

const fileStore = useFileStore();
const mindmapStore = useMindmapStore();

const updateSystemTheme = (e: MediaQueryListEvent) => {
    if (settingsStore.settings.theme === 'system') {
        applyTheme('system');
    }
};

onMounted(() => {
    // 可以在这里加载默认文件或显示欢迎界面
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateSystemTheme);
    }
});

onBeforeUnmount(() => {
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', updateSystemTheme);
    }
});
</script>

<template>
    <el-container class="common-layout">
        <el-header class="app-header">
            <Header />
        </el-header>
        <el-main class="app-main">
            <MainView />
        </el-main>
        <el-footer class="app-footer">
            <Footer />
        </el-footer>
    </el-container>
</template>

<style lang="scss">
@import "./assets/styles/index.scss"; // 引入全局样式

html,
body,
#app {
    margin: 0;
    padding: 0;
    height: 100%;
    overflow: hidden; // 防止滚动条
}

.common-layout {
    height: 100vh;
    display: flex;
    flex-direction: column;
}

.app-header {
    background-color: var(--panel-bg-color);
    color: var(--el-text-color-primary);
    height: 40px; /* Slightly taller for better touch targets */
    display: flex;
    align-items: center;
    padding: 0;
    box-shadow: var(--app-shadow-sm);
    z-index: 100;
    border-bottom: 1px solid var(--el-border-color);
}

.app-main {
    flex: 1;
    padding: 0;
    overflow: hidden;
    background-color: var(--app-bg-color);
}

.app-footer {
    background-color: var(--panel-bg-color);
    color: var(--el-text-color-secondary);
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    border-top: 1px solid var(--el-border-color);
    z-index: 100;
    font-size: 12px;
}
</style>
