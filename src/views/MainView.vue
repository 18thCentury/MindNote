<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import MindmapCanvas from "../components/MindmapCanvas.vue";
import MarkdownEditor from "./MarkdownEditor.vue";
import WebDavBrowser from "../components/WebDavBrowser.vue";
import { useMindmapStore } from "../stores/mindmapStore";
import { useEditorStore } from "../stores/editorStore";
import { useFileStore } from "../stores/fileStore";
import { ipcRenderer } from "../utils/ipcRenderer";
import { IPC_EVENTS } from "../types/shared_types";
import { Document, FolderOpened, Cloudy } from "@element-plus/icons-vue";

const mindmapStore = useMindmapStore();
const editorStore = useEditorStore();
const fileStore = useFileStore();

// WebDAV Dialog
const webDavBrowserVisible = ref(false);

// Splitter state
const asideWidth = ref("50%");
const isDragging = ref(false);

// Editor lifecycle control (Hard Reset)
// Removed renderEditor ref as we want to reuse the instance

const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    isDragging.value = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
};

const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.value) return;
    const newWidth = (e.clientX / window.innerWidth) * 100;
    if (newWidth > 10 && newWidth < 90) {
        // Constrain width
        asideWidth.value = `${newWidth}%`;
    }
};

const handleMouseUp = () => {
    isDragging.value = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
};

// 监听选中的节点，加载对应的 Markdown
watch(
    () => mindmapStore.primarySelectedNodeId,
    async (newNodeId) => {
        // No more hard reset (renderEditor = false)
        // Just update the store content, which propagates to the Editor via props
        
        if (newNodeId) {
            const node = mindmapStore.getNodeById(newNodeId);
            if (node && node.markdown) {
                const content = fileStore.getMarkdownContent(node.markdown);
                editorStore.setMarkdownContent(content, node.id);
            } else {
                editorStore.setMarkdownContent("", "");
            }
        } else {
            editorStore.setMarkdownContent("", "");
        }
    },
    { immediate: true },
);

// 监听编辑器内容变化，标记为未保存
watch(
    () => editorStore.currentMarkdownContent,
    () => {
        fileStore.markAsUnsaved();
    },
);

// 模拟 MindmapCanvas 节点选中事件
const handleNodeSelected = (nodeId: string) => {
    // mindmapStore.selectNode(nodeId); // Removed to prevent overriding multi-selection logic in MindmapCanvas
    //console.log("Node selected event received:", nodeId);
};

// 模拟 MarkdownEditor 内容变化事件
const handleEditorContentChanged = (content: string, nodeId: string) => {
    editorStore.updateMarkdownContent(content, nodeId);
};

import { useGlobalKeyboard } from "../composables/useGlobalKeyboard";

const handleGlobalKeydown = (e: KeyboardEvent) => {
    // Composable handles guards
    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'n') {
            e.preventDefault();
            fileStore.createNewFile();
        }
        if (e.key === 'o') {
            e.preventDefault();
             if (e.shiftKey) {
                 // Open WebDAV?
                 webDavBrowserVisible.value = true;
            } else {
                fileStore.openMnFile();
            }
        }
        if (e.key === 's') {
            e.preventDefault();
            if (e.shiftKey) {
                fileStore.saveCurrentFileAs();
            } else {
                fileStore.saveCurrentFile();
            }
        }
    }
};

// Allow input (e.g. Ctrl+S in editor), but block modals
useGlobalKeyboard(handleGlobalKeydown, { ignoreInput: false, ignoreModal: true });

onMounted(() => {
    // window.addEventListener('keydown', handleGlobalKeydown); // Removed

    // Listen for file opened from main process (e.g. double click .mn file)
    ipcRenderer.on(IPC_EVENTS.FILE_OPENED, (event: any, data: any) => {
        //console.log("Received FILE_OPENED event", data);
        if (data && data.filePath) {
            fileStore.setFileData(data);
        }
    });
});

onBeforeUnmount(() => {
    // window.removeEventListener('keydown', handleGlobalKeydown); // Removed
    // ipcRenderer.off(IPC_EVENTS.FILE_OPENED, ...); // Clean up if listener was named
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
});
</script>

<template>
    <el-container class="main-view-container">
        <WebDavBrowser v-model="webDavBrowserVisible" />
        <el-aside :style="{ width: asideWidth }" class="mindmap-area">
            <MindmapCanvas
                :nodes="mindmapStore.allNodes"
                @node-selected="handleNodeSelected"
                :selectedNodeId="mindmapStore.selectedNodeId"
            />
            <div v-if="!fileStore.isFileOpen" class="welcome-overlay">
                <div class="welcome-content">
                    <h1>MindNote</h1>
                    <div class="actions">
                        <el-button type="primary" size="large" @click="fileStore.createNewFile">
                            <el-icon class="el-icon--left"><Document /></el-icon> New MindNote (Ctrl+N)
                        </el-button>
                        <el-button size="large" @click="fileStore.openMnFile">
                            <el-icon class="el-icon--left"><FolderOpened /></el-icon> Open Local (Ctrl+O)
                        </el-button>
                        <el-button size="large" @click="webDavBrowserVisible = true">
                            <el-icon class="el-icon--left"><Cloudy /></el-icon> WebDAV
                        </el-button>
                    </div>
                </div>
            </div>
        </el-aside>
        <div class="splitter" @mousedown="handleMouseDown"></div>
        <el-main class="markdown-editor-area">
            <MarkdownEditor
                :initialContent="editorStore.currentMarkdownContent"
                @content-changed="handleEditorContentChanged"
                :currentNodeId="editorStore.currentMarkdownNodeId"
            />
        </el-main>
    </el-container>
</template>

<style lang="scss" scoped>
.main-view-container {
    height: 100%;
    display: flex;
    /* border-top removed as it's handled by header border-bottom */
}

.mindmap-area {
    padding: 0px;
    overflow: hidden;
    position: relative;
    background-color: var(--app-bg-color);
}

.welcome-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: var(--app-bg-color);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 100;
}

.welcome-content {
    text-align: center;
    z-index: 1001;
    h1 {
        font-size: 2.5em;
        color: var(--el-text-color-primary);
        margin-bottom: 40px;
        font-weight: 600;
        letter-spacing: 2px;
    }

    .actions {
        display: flex;
        gap: 20px;
        justify-content: center;
    }
}

.splitter {
    width: 1px; /* Thinner, more modern splitter */
    cursor: col-resize;
    background-color: var(--el-border-color);
    flex-shrink: 0;
    z-index: 10;
    transition: background-color 0.2s, width 0.2s;
    position: relative;
    
    /* Invisible hit area for easier grabbing */
    &::after {
        content: '';
        position: absolute;
        left: -4px;
        right: -4px;
        top: 0;
        bottom: 0;
        z-index: 1;
    }

    &:hover, &:active {
        background-color: var(--el-color-primary);
        width: 2px; /* Visual feedback */
    }
}

.markdown-editor-area {
    padding: 0px;
    overflow: hidden; // toast-ui 内部处理滚动
    flex-grow: 1;
}
</style>
