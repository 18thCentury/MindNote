<script setup lang="ts">
import { useFileStore } from "../stores/fileStore";
import { ElMessage } from "element-plus";
// 确保这些图标已从 Element Plus 导入
import { Minus, CopyDocument, Close, Document, FolderOpened, Box, Setting } from "@element-plus/icons-vue";
import { ipcRenderer } from "../utils/ipcRenderer";
import SettingsModal from "./SettingsModal.vue"; // Import SettingsModal
import { ref, computed } from "vue";

const settingsModalVisible = ref(false);


const fileStore = useFileStore();

const currentFileName = computed(() => {
    if (!fileStore.currentFilePath) return "";
    // Handle both Windows and Unix paths
    const path = fileStore.currentFilePath.replace(/\\/g, "/");
    return path.split("/").pop() || "";
});

const handleNewFile = async () => {
    await fileStore.createNewFile();
};

const handleOpenFile = async () => {
    try {
        await fileStore.openMnFile();
    } catch (error) {
        ElMessage.error("Failed to open file.");
        console.error("Open file error:", error);
    }
};

const handleSaveFile = async () => {
    try {
        await fileStore.saveCurrentFile();
        ElMessage.success("File saved successfully!");
    } catch (error) {
        ElMessage.error("Failed to save file.");
        console.error("Save file error:", error);
    }
};

const handleSaveFileAs = async () => {
    try {
        await fileStore.saveCurrentFileAs();
        ElMessage.success("File saved to a new location!");
    } catch (error) {
        ElMessage.error("Failed to save file.");
        console.error("Save As error:", error);
    }
};

const handleCloseFile = async () => {
    await fileStore.closeCurrentFile();
};

const handleOpenSettings = () => {
    settingsModalVisible.value = true;
};


// 实际的窗口控制函数
const handleMinimize = () => {
    ipcRenderer.minimizeWindow();
};
const handleMaximize = () => {
    ipcRenderer.maximizeWindow();
};
const handleClose = () => {
    ipcRenderer.closeWindow();
};
</script>

<template>
    <div class="header-content">
        <div class="left-section">
            <div class="app-title">MindNote</div>
            <el-menu mode="horizontal" :ellipsis="false" class="header-menu">
                <el-sub-menu index="1">
                    <template #title>File</template>
                    <el-menu-item index="1-1" @click="handleNewFile">
                        <el-icon><Document /></el-icon>New
                    </el-menu-item>
                    <el-menu-item index="1-2" @click="handleOpenFile">
                        <el-icon><FolderOpened /></el-icon>Open
                    </el-menu-item>
                    <el-menu-item
                        index="1-3"
                        @click="handleSaveFile"
                        :disabled="!fileStore.currentFilePath"
                    >
                        <el-icon><Box /></el-icon>Save
                    </el-menu-item>
                    <el-menu-item
                        index="1-4"
                        @click="handleSaveFileAs"
                        :disabled="!fileStore.currentFilePath"
                    >
                        <el-icon><Box /></el-icon>Save As
                    </el-menu-item>
                    <el-menu-item
                        index="1-5"
                        @click="handleCloseFile"
                        :disabled="!fileStore.currentFilePath"
                    >
                        <el-icon><Close /></el-icon>Close
                    </el-menu-item>
                </el-sub-menu>
                <el-menu-item index="2" @click="handleOpenSettings">
                    <el-icon><Setting /></el-icon>Settings
                </el-menu-item>
            </el-menu>
        </div>

        <SettingsModal v-model="settingsModalVisible" />


        <div class="drag-spacer"></div>
        
        <div class="file-name" v-if="currentFileName">
            {{ currentFileName }}
        </div>

        <div class="drag-spacer"></div>

        <div class="window-controls">
            <el-icon
                class="control-icon minimize-icon"
                @click="handleMinimize"
                title="Minimize"
            >
                <Minus />
            </el-icon>
            <el-icon
                class="control-icon maximize-icon"
                @click="handleMaximize"
                title="Maximize/Restore"
            >
                <CopyDocument />
            </el-icon>
            <el-icon
                class="control-icon close-icon"
                @click="handleClose"
                title="Close"
            >
                <Close />
            </el-icon>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.header-content {
    display: flex;
    align-items: center;
    width: 100%;
    height: 100%;
}

.left-section {
    display: flex;
    align-items: center;
    padding-left: 20px;
    -webkit-app-region: no-drag;
}

.app-title {
    font-size: 1em;
    font-weight: bold;
    margin-right: 20px;
}

.header-menu {
    height: 30px;
    border-bottom: none;
    background-color: transparent;
}

.drag-spacer {
    flex-grow: 1;
    height: 100%;
    -webkit-app-region: drag;
}

.window-controls {
    display: flex;
    align-items: center;
    height: 100%;
    padding-right: 2px;
    -webkit-app-region: no-drag;
}

.control-icon {
    font-size: 16px;
    cursor: pointer;
    padding: 0 10px;
    height: 30px;
    line-height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--el-text-color-primary);
    transition: background-color 0.2s;

    &:hover {
        background-color: var(--el-color-primary-light-9);
        color: var(--el-color-primary);
    }
}

:deep(.el-menu-item),
:deep(.el-sub-menu__title) {
    -webkit-app-region: no-drag;
}

.file-name {
    font-size: 0.9em;
    color: var(--el-text-color-regular);
    -webkit-app-region: drag;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 300px;
}
</style>
