<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
import MindmapCanvas from "../components/MindmapCanvas.vue";
import MarkdownEditor from "./MarkdownEditor.vue";
import { useMindmapStore } from "../stores/mindmapStore";
import { useEditorStore } from "../stores/editorStore";
import { useFileStore } from "../stores/fileStore";
import { ipcRenderer } from "../utils/ipcRenderer";

const mindmapStore = useMindmapStore();
const editorStore = useEditorStore();
const fileStore = useFileStore();

// Splitter state
const asideWidth = ref("50%");
const isDragging = ref(false);

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
    () => mindmapStore.selectedNode,
    (newNode) => {
        if (newNode && newNode.markdown) {
            const content = fileStore.getMarkdownContent(newNode.markdown);
            editorStore.setMarkdownContent(content, newNode.id);
        } else {
            editorStore.setMarkdownContent("", "");
        }
    },
    { immediate: true },
); // 立即执行一次，加载初始节点

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
    console.log("Node selected event received:", nodeId);
};

// 模拟 MarkdownEditor 内容变化事件
const handleEditorContentChanged = (content: string) => {
    editorStore.updateMarkdownContent(content);
};

onBeforeUnmount(() => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
});
</script>

<template>
    <el-container class="main-view-container">
        <el-aside :style="{ width: asideWidth }" class="mindmap-area">
            <MindmapCanvas
                :nodes="mindmapStore.allNodes"
                @node-selected="handleNodeSelected"
                :selectedNodeId="mindmapStore.selectedNodeId"
            />
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
    border-top: 1px solid var(--el-border-color-light);
}

.mindmap-area {
    padding: 0px;
    overflow: hidden; // vue-flow 内部处理滚动
    position: relative; // For splitter
}

.splitter {
    width: 5px;
    cursor: col-resize;
    background-color: var(--el-border-color-lighter);
    flex-shrink: 0;
    z-index: 10;
    &:hover {
        background-color: var(--el-color-primary);
    }
}

.markdown-editor-area {
    padding: 0px;
    overflow: hidden; // toast-ui 内部处理滚动
    flex-grow: 1;
}
</style>
