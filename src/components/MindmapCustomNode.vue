<script setup lang="ts">
import { computed, ref, nextTick, onMounted, onBeforeUnmount } from "vue";
import { Handle, Position } from "@vue-flow/core";
import { useMindmapStore } from "../stores/mindmapStore";
import { useFileStore } from "../stores/fileStore";

import { useEditorStore } from "../stores/editorStore";
import { useUIStore } from "../stores/uiStore"; // Import uiStore
import { useSettingsStore } from "../stores/settingsStore"; // Import settingsStore
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
const settingsStore = useSettingsStore();



const isEditing = ref(false);
const editText = ref("");
const nodeEl = ref<HTMLElement | null>(null);

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
    if (nodeEl.value) {
        resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                mindmapStore.setNodeDimensions(props.data.id, {
                    width,
                    height,
                });
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
    // Check if this node's ID is in the selectedNodeIds array
    if (mindmapStore.selectedNodeIds.includes(props.data.id)) {
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
    console.log("toggleCollapse clicked for node:", props.data.id);
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


const customStyle = computed(() => {
    const style = props.selected 
        ? settingsStore.settings.selectedNodeStyle 
        : settingsStore.settings.nodeStyle;
        
    return {
        backgroundColor: style.backgroundColor,
        borderColor: style.borderColor,
        borderWidth: `${style.borderWidth}px`,
        // Use borderRadius from normal style if not present in selected style (though we added it to interface, let's be safe or just use normal style's radius for consistency if not in selected)
        // Actually, SelectedNodeStyle doesn't have borderRadius in my definition above, so I'll use the normal one.
        borderRadius: `${settingsStore.settings.nodeStyle.borderRadius}px`, 
        color: style.textColor,
    };
});
</script>


<template>
    <div :class="nodeClass" @dblclick="startEditing" ref="nodeEl" :style="customStyle">
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
            @dblclick.stop
            class="collapse-button nodrag"
        >
            <span class="icon">{{ isCollapsed ? "+" : "−" }}</span>
        </button>
    </div>
</template>

<style scoped>
/* ... existing styles ... */
.custom-node {
    padding: 8px 12px;
    min-width: 80px;
    text-align: center;
    position: relative;
    background-color: var(--el-color-white);
    border: 1px solid var(--el-border-color);
    border-radius: 6px; /* Slightly more rounded */
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); /* Softer shadow */
    cursor: pointer;
    transition:
        box-shadow 0.2s ease-in-out,
        border-color 0.2s ease-in-out,
        transform 0.1s ease;
}

/* ... */
.custom-node.selected-node {
    border-color: var(--el-color-primary);
    background-color: var(--el-color-primary-light-9);
    box-shadow:
        0 0 0 2px var(--el-color-primary-light-5),
        0 4px 12px rgba(var(--el-color-primary-rgb), 0.2);
    z-index: 5;
}

.custom-node.drop-target-node {
    border: 2px dashed var(--el-color-success);
    background-color: var(--el-color-success-light-9);
    box-shadow:
        0 0 0 4px var(--el-color-success-light-5),
        0 4px 12px rgba(var(--el-color-success-rgb), 0.2);
    transform: scale(1.02);
    z-index: 10;
}

.custom-node.root-node {
    background-color: var(--el-color-primary-light-9); /* Distinct background */
    padding: 12px 24px; /* Larger size */
    font-size: 16px;
    font-weight: bold; /* Bold text */
    border-color: var(--el-color-primary);
    border-width: 2px;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
}

.collapse-button {
    position: absolute;
    right: -12px; /* Slightly further out */
    top: 50%;
    transform: translateY(-50%);
    width: 16px; /* Larger touch target */
    height: 16px;
    border-radius: 50%;
    border: 1px solid var(--el-border-color-lighter);
    background-color: var(--el-color-white);
    color: var(--el-text-color-secondary);
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 12px;
    line-height: 1;
    z-index: 10;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
    padding: 0;
}

.node-input {
    width: 100%;
    border: none;
    outline: none;
    background: transparent;
    background-color: transparent;
    text-align: center;
    font-family: inherit;
    font-size: inherit;
    font-weight: inherit;
    color: inherit;
    padding: 0;
    margin: 0;
    box-shadow: none;
    line-height: inherit;
}

.node-input:focus {
    outline: none;
    border: none;
    box-shadow: none;
}

.collapse-button:hover {
    background-color: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
    border-color: var(--el-color-primary-light-5);
    transform: translateY(-50%) scale(1.1);
}

.collapse-button .icon {
    position: relative;
    top: -0.5px; /* Optical alignment */
    font-weight: bold;
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
