<script setup lang="ts">
import { onMounted, watch } from "vue";
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

onMounted(() => {
    // 可以在这里加载默认文件或显示欢迎界面
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
    background-color: var(--el-color-primary-light-9);
    color: var(--el-text-color-primary);
    height: 30px;
    display: flex;
    align-items: center;
    padding: 0; /* Let the Header component manage its own padding */
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
    z-index: 100;
}

.app-main {
    flex: 1;
    padding: 0; // MainView 内部控制 padding
    overflow: hidden; // 确保内部组件可以处理自己的滚动
}

.app-footer {
    background-color: var(--el-color-info-light-9);
    color: var(--el-text-color-secondary);
    height: 25px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    border-top: 1px solid var(--el-border-color-light);
    z-index: 100;
}
</style>
