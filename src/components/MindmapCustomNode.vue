<script setup lang="ts">
import { computed, ref, nextTick, onMounted, onBeforeUnmount } from "vue";
import { Handle, Position } from "@vue-flow/core";
import { useMindmapStore } from "../stores/mindmapStore";
import { useFileStore } from "../stores/fileStore";

import { useEditorStore } from "../stores/editorStore";
import { useUIStore } from "../stores/uiStore"; // Import uiStore
import type { MindmapNode } from "../types/shared_types";

const props = defineProps({
    data: {
        type: Object as () => MindmapNode,
        required: true,
    },
    selected: {
        type: Boolean,
        default: false,
    },
    isDropTarget: {
        type: Boolean,
        default: false,
    },
});

const mindmapStore = useMindmapStore();
const fileStore = useFileStore();
const editorStore = useEditorStore();
const uiStore = useUIStore(); // Import uiStore

const isEditing = ref(false);
const editText = ref("");
const nodeEl = ref<HTMLElement | null>(null);

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (nodeEl.value) {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        mindmapStore.setNodeDimensions(props.data.id, { width, height });
      }
    });
    resizeObserver.observe(nodeEl.value);
  }
});

onBeforeUnmount(() => {
  if (resizeObserver && nodeEl.value) {
    resizeObserver.unobserve(nodeEl.value);
  }
  resizeObserver = null;
});


const nodeClass = computed(() => {
    const classes = ["custom-node"];
    if (props.selected) {
        classes.push("selected-node");
    }
    if (props.data.type === "root") {
        classes.push("root-node");
    }
    if (props.isDropTarget) {
        classes.push("drop-target-node");
    }
    return classes.join(" ");
});

const hasChildren = computed(
    () => props.data.children && props.data.children.length > 0,
);
const isCollapsed = computed(() =>
    mindmapStore.collapsedNodeIds.includes(props.data.id),
);

const firstImage = computed(() => {
    if (props.data.images && props.data.images.length > 0) {
        return props.data.images[0];
    }
    return null;
});

const getImageUrl = (imageName: string) => {
    if (fileStore.tempDir) {
        // IMPORTANT: Electron requires absolute paths with the file:// protocol for renderer access.
        // We also need to normalize path separators.
        const path = `${fileStore.tempDir.replace(/\\/g, "/")}/images/${imageName}`;
        return `file://${path}`;
    }
    return "";
};

const toggleCollapse = () => {
    mindmapStore.toggleNodeCollapse(props.data.id);
};

const vFocus = {
    mounted: (el: HTMLInputElement) => {
        nextTick(() => el.focus());
    },
};

const startEditing = () => {
    // Prevent dragging while editing
    mindmapStore.setNodeDraggable(props.data.id, false);
    editorStore.setTextInputActive(true); // Signal that editing has started
    isEditing.value = true;
    editText.value = props.data.text;
};

const finishEditing = () => {
    if (isEditing.value) {
        if (editText.value.trim() !== "") {
            mindmapStore.updateNodeText(props.data.id, editText.value);
        }
        isEditing.value = false;
        // Re-enable dragging after editing is finished
        mindmapStore.setNodeDraggable(props.data.id, true);
        editorStore.setTextInputActive(false); // Signal that editing has finished
    }
};


const openImage = (imageName: string) => {
    const url = getImageUrl(imageName);
    if (url) {
        uiStore.openImageViewer(url);
    }
};
</script>

<template>
    <div :class="nodeClass" @dblclick="startEditing" ref="nodeEl">
        <Handle type="target" :position="Position.Left" class="node-handle" />

        <div v-if="firstImage" class="node-thumbnail-wrapper">
            <img 
                :src="getImageUrl(firstImage)" 
                class="node-thumbnail" 
                @dblclick.stop="openImage(firstImage)"
            />
        </div>

        <div v-if="!isEditing">{{ data.text }}</div>
        <input
            v-else
            v-model="editText"
            @blur="finishEditing"
            @keydown.enter.stop="finishEditing"
            v-focus
            class="node-input"
        />
        <Handle type="source" :position="Position.Right" class="node-handle" />

        <button
            v-if="hasChildren"
            @click.stop="toggleCollapse"
            class="collapse-button"
        >
            {{ isCollapsed ? "+" : "-" }}
        </button>
    </div>
</template>

<style scoped>
.custom-node {
    padding: 8px 12px;
    min-width: 80px;
    text-align: center;
    position: relative;
    background-color: var(--el-color-white);
    border: 1px solid var(--el-border-color);
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    cursor: pointer;
    transition: box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out;
}

.custom-node.selected-node {
    border-color: var(--el-color-primary);
    box-shadow: 0 0 0 2px var(--el-color-primary-light-5);
}

.custom-node.drop-target-node {
  border: 2px dashed var(--el-color-success);
  box-shadow: 0 0 0 4px var(--el-color-success-light-5);
}

.custom-node.root-node {
    background-color: var(--el-color-primary-light-9); /* Distinct background */
    padding: 10px 20px; /* Larger size */
    font-weight: bold; /* Bold text */
    border-color: var(--el-color-primary);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.node-handle {
    width: 10px;
    height: 10px;
    background-color: var(--el-color-primary);
    border-radius: 50%;
    border: 1px solid var(--el-color-white);
    cursor: crosshair;
}

.node-handle.vue-flow__handle-left {
    left: -5px;
}

.node-handle.vue-flow__handle-right {
    right: -5px;
}

.node-input {
    width: 100%;
    border: none;
    outline: none;
    background-color: transparent;
    text-align: center;
    font-family: inherit;
    font-size: inherit;
    color: inherit;
    padding: 0;
    margin: 0;
}

.collapse-button {
    position: absolute;
    right: -10px;
    top: 50%;
    transform: translateY(-50%);
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1px solid var(--el-border-color);
    background-color: var(--el-color-info-light-8);
    color: white;
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 14px;
    line-height: 1;
    z-index: 10;
}

.collapse-button:hover {
    background-color: var(--el-color-info);
}

.node-thumbnail-wrapper {
    margin-bottom: 5px;
}

.node-thumbnail {
    max-width: 100px; /* Increased size for better visibility */
    max-height: 80px;
    border-radius: 4px;
    object-fit: cover;
}
</style>
