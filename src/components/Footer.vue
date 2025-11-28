<script setup lang="ts">
import { computed } from "vue";
import { useFileStore } from "../stores/fileStore";
import { useMindmapStore } from "../stores/mindmapStore";
import PinBar from "./PinBar.vue";
import type { MindmapNode } from "../types/shared_types";

const fileStore = useFileStore();
const mindmapStore = useMindmapStore();

const saveStatusText = computed(() => {
    switch (fileStore.saveStatus) {
        case "saved":
            return "已保存";
        case "unsaved":
            return "未保存";
        case "saving":
            return "保存中...";
        case "error":
            return "保存失败";
        default:
            return "";
    }
});

const pathNodes = computed(() => mindmapStore.currentNodePath);

const handlePathClick = (nodeId: string) => {
    mindmapStore.selectAndPanToNode(nodeId);
};
</script>

<template>
    <div class="footer-content">
        <PinBar />
        <div class="status-info">
            <span class="path-container">
                <span>路径: </span>
                <template v-for="(node, index) in pathNodes" :key="node.id">
                    <span
                        @click="handlePathClick(node.id)"
                        class="path-segment"
                        >{{ node.text }}</span
                    >
                    <span
                        v-if="index < pathNodes.length - 1"
                        class="path-separator"
                    >
                        >
                    </span>
                </template>
            </span>
            <el-divider direction="vertical" />
            <span>状态: {{ saveStatusText }}</span>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.footer-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: 100%;
}
.status-info {
    display: flex;
    align-items: center;
    font-size: 0.9em;
    color: var(--el-text-color-secondary);
}
.path-container {
    display: flex;
    align-items: center;
}
.path-segment {
    cursor: pointer;
    padding: 0 2px;
    border-radius: 2px;
    &:hover {
        background-color: var(--el-color-primary-light-9);
        color: var(--el-color-primary);
    }
}
.path-separator {
    margin: 0 2px;
}
</style>
