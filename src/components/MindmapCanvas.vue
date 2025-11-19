<script setup lang="ts">
import {
    computed,
    onMounted,
    onBeforeUnmount,
    ref,
    nextTick,
    watch,
} from "vue";
import {
    VueFlow,
    useVueFlow,
    Node,
    NodeDragEvent,
    XYPosition,
} from "@vue-flow/core";
import {
    ElMessage,
    ElDropdown,
    ElDropdownMenu,
    ElDropdownItem,
} from "element-plus";
import { useMindmapStore } from "../stores/mindmapStore";
import { useFileStore } from "../stores/fileStore";
import { useEditorStore } from "../stores/editorStore";
import { ipcRenderer } from "../utils/ipcRenderer";
import { IPC_EVENTS } from "../types/shared_types";
import MindmapCustomNode from "./MindmapCustomNode.vue";
import type { MindmapNode } from "../types/shared_types";

import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";

// Define types for drag and drop actions
type DropAction =
    | {
          type: "reorder"; // For reordering within the same parent (deprecated by reparent-and-reorder)
          targetNodeId: string;
          position: "before" | "after";
      }
    | {
          type: "parent"; // For making dragged node a child of target node
          targetNodeId: string;
      }
    | {
          type: "reparent-and-reorder"; // For moving to a new parent and reordering as sibling
          targetNodeId: string;
          position: "before" | "after";
      }
    | null;

const props = defineProps<{
    nodes: MindmapNode[];
    selectedNodeId: string | null;
}>();

const emit = defineEmits(["node-selected"]);

const { onNodeClick, onNodeContextMenu, getNodes, fitView, viewport, project } =
    useVueFlow();
const mindmapStore = useMindmapStore();
const fileStore = useFileStore();
const editorStore = useEditorStore();

// --- State for Drag and Drop ---
const draggedNodeInfo = ref<{
    id: string;
    initialPosition: XYPosition;
} | null>(null);
const dropAction = ref<DropAction>(null);

// --- State for Context Menu ---
const contextMenuVisible = ref(false);
const contextMenuPosition = ref({ x: 0, y: 0 });
const contextMenuNodeId = ref<string | null>(null);
const dropdownRef = ref<InstanceType<typeof ElDropdown> | null>(null);

// --- Computed Properties ---
const isInteractive = computed(() => !editorStore.isTextInputActive);

const layoutElements = computed(() => {
    const nodes: Node[] = [];
    const edges = [];
    const startNode = mindmapStore.viewRootNodeId
        ? mindmapStore.findNodeAndParent(
              mindmapStore.viewRootNodeId,
              mindmapStore.rootNode,
          ).node
        : mindmapStore.rootNode;

    if (!startNode) return { nodes, edges };

    const traverse = (node: MindmapNode, parentId: string | null = null) => {
        const position = node.position || { x: 0, y: 0 };
        nodes.push({
            id: node.id,
            position: position,
            type: "mindmap",
            data: { ...node },
            selected: node.id === props.selectedNodeId,
            draggable: node.draggable ?? true,
        });
        if (parentId) {
            edges.push({
                id: `e-${parentId}-${node.id}`,
                source: parentId,
                target: node.id,
            });
        }
        if (mindmapStore.collapsedNodeIds.includes(node.id)) return;
        for (const child of node.children) {
            traverse(child, node.id);
        }
    };

    traverse(startNode);
    return { nodes, edges };
});

const flowNodes = computed(() => layoutElements.value.nodes);
const flowEdges = computed(() => layoutElements.value.edges);

const dropIndicatorStyle = computed(() => {
    if (
        !dropAction.value ||
        (dropAction.value.type !== "reorder" &&
            dropAction.value.type !== "reparent-and-reorder")
    )
        return { display: "none" };
    const targetNode = getNodes.value.find(
        (n) => n.id === dropAction.value?.targetNodeId,
    );
    if (!targetNode) return { display: "none" };

    // Convert node coordinates to screen coordinates
    const scaledX =
        targetNode.position.x * viewport.value.zoom + viewport.value.x;
    const scaledY =
        targetNode.position.y * viewport.value.zoom + viewport.value.y;
    const scaledWidth = targetNode.dimensions.width * viewport.value.zoom;
    // const scaledHeight = targetNode.dimensions.height * viewport.value.zoom; // Not used for indicator height

    const top =
        dropAction.value.position === "before"
            ? scaledY
            : scaledY + targetNode.dimensions.height * viewport.value.zoom;
    return {
        display: "block",
        left: `${scaledX}px`,
        top: `${top}px`,
        width: `${scaledWidth}px`,
    };
});

// --- Event Handlers ---

onNodeClick((event) => {
    emit("node-selected", event.node.id);
    if (contextMenuVisible.value) dropdownRef.value?.handleClose();
});

const onNodeDragStart = ({ node }: NodeDragEvent) => {
    if (node.id !== props.selectedNodeId) {
        emit("node-selected", node.id);
    }
    draggedNodeInfo.value = {
        id: node.id,
        initialPosition: { ...node.position },
    };
    dropAction.value = null;
};

const onNodeDrag = ({ node: draggedNode, event }: NodeDragEvent) => {
    if (!draggedNode) return;
    dropAction.value = null; // Reset on each drag event

    const { x: cursorX, y: cursorY } = project({
        x: event.clientX,
        y: event.clientY,
    });

    const otherNodes = getNodes.value.filter((n) => n.id !== draggedNode.id);
    let bestTarget: { action: DropAction; distance: number } | null = null;

    for (const targetNode of otherNodes) {
        const { x, y } = targetNode.position;
        const { width, height } = targetNode.dimensions;

        // Define hot zones in canvas coordinates
        const topZone = { x, y, width, height: height * 0.25 };
        const bottomZone = {
            x,
            y: y + height * 0.75,
            width,
            height: height * 0.25,
        };
        const rightZone = { x: x + width, y, width: 50, height }; // 50px area to the right

        const isOverTop =
            cursorX >= topZone.x &&
            cursorX <= topZone.x + topZone.width &&
            cursorY >= topZone.y &&
            cursorY <= topZone.y + topZone.height;
        const isOverBottom =
            cursorX >= bottomZone.x &&
            cursorX <= bottomZone.x + bottomZone.width &&
            cursorY >= bottomZone.y &&
            cursorY <= bottomZone.y + bottomZone.height;
        const isOverRight =
            cursorX >= rightZone.x &&
            cursorX <= rightZone.x + rightZone.width &&
            cursorY >= rightZone.y &&
            cursorY <= rightZone.y + rightZone.height;

        const { node: targetMindmapNode } = mindmapStore.findNodeAndParent(
            targetNode.id,
            mindmapStore.rootNode,
        );
        const isTargetLeaf = targetMindmapNode?.children.length === 0;

        // Check for circular dependency
        const isCircular = mindmapStore
            .getAllDescendants(draggedNode.id)
            .some((desc) => desc.id === targetNode.id);
        if (isCircular) continue;

        const updateBestTarget = (action: DropAction, distance: number) => {
            if (!bestTarget || distance < bestTarget.distance) {
                bestTarget = { action, distance };
            }
        };

        if (isOverTop) {
            updateBestTarget(
                {
                    type: "reparent-and-reorder",
                    targetNodeId: targetNode.id,
                    position: "before",
                },
                Math.abs(cursorY - topZone.y),
            );
        } else if (isOverBottom) {
            updateBestTarget(
                {
                    type: "reparent-and-reorder",
                    targetNodeId: targetNode.id,
                    position: "after",
                },
                Math.abs(cursorY - (bottomZone.y + bottomZone.height)),
            );
        } else if (isOverRight && isTargetLeaf) {
            updateBestTarget(
                { type: "parent", targetNodeId: targetNode.id },
                Math.abs(cursorX - rightZone.x),
            );
        }
    }

    dropAction.value = bestTarget?.action ?? null;
};

const onNodeDragStop = ({ node }: NodeDragEvent) => {
    if (dropAction.value) {
        const { type, targetNodeId } = dropAction.value;
        if (type === "parent") {
            mindmapStore.reparentNode(node.id, targetNodeId);
        } else if (type === "reparent-and-reorder") {
            const { position } = dropAction.value;
            const { parent: targetParent } = mindmapStore.findNodeAndParent(
                targetNodeId,
                mindmapStore.rootNode,
            );
            const { parent: draggedParent } = mindmapStore.findNodeAndParent(
                node.id,
                mindmapStore.rootNode,
            );

            if (
                targetParent &&
                draggedParent &&
                targetParent.id !== draggedParent.id
            ) {
                // If parents are different, first reparent
                mindmapStore.reparentNode(node.id, targetParent.id);
            }
            // Then reorder within the (potentially new) parent
            mindmapStore.reorderNode(node.id, targetNodeId, position);
        }
    } else if (draggedNodeInfo.value) {
        // No valid drop, revert position
        mindmapStore.setNodePosition(
            draggedNodeInfo.value.id,
            draggedNodeInfo.value.initialPosition,
        );
    }

    // Cleanup
    draggedNodeInfo.value = null;
    dropAction.value = null;
};

onNodeContextMenu((event) => {
    event.event.preventDefault();
    contextMenuNodeId.value = event.node.id;
    showContextMenu(event.event);
});

const handleContextMenuCommand = async (command: string) => {
    if (!contextMenuNodeId.value) return;
    switch (command) {
        case "delete-node":
            mindmapStore.deleteNode(contextMenuNodeId.value);
            ElMessage.success("Node deleted");
            break;
        case "add-image":
            await addImageToNode(contextMenuNodeId.value);
            break;
        case "pin-node":
            mindmapStore.togglePin(contextMenuNodeId.value);
            break;
    }
    contextMenuNodeId.value = null;
};

const addImageToNode = async (nodeId: string) => {
    if (!fileStore.tempDir) {
        ElMessage.error("File not saved yet. Please save the file first.");
        return;
    }
    const imagePath = await ipcRenderer.invoke(
        IPC_EVENTS.OPEN_IMAGE_DIALOG,
        fileStore.tempDir,
    );
    if (imagePath) {
        const fileName = imagePath.split("\\").pop();
        if (fileName) {
            mindmapStore.addImageToNode(nodeId, fileName);
            ElMessage.success(`Image added to node.`);
        }
    }
};

const handleKeyDown = (event: KeyboardEvent) => {
    if (!props.selectedNodeId || editorStore.isTextInputActive) return;
    if (event.key === "Tab") {
        event.preventDefault();
        mindmapStore.addChildNode(props.selectedNodeId);
    }
    if (event.key === "Enter") {
        event.preventDefault();
        mindmapStore.addSiblingNode(props.selectedNodeId);
    }
};

const showContextMenu = async (event: MouseEvent) => {
    contextMenuPosition.value = { x: event.clientX, y: event.clientY };
    await nextTick();
    dropdownRef.value?.handleOpen();
};

// --- Lifecycle Hooks ---
onMounted(() => {
    window.addEventListener("keydown", handleKeyDown);
});

onBeforeUnmount(() => {
    window.removeEventListener("keydown", handleKeyDown);
});

// --- Watchers for automatic view adjustments ---
watch(
    () => mindmapStore.viewRootNodeId,
    (newId) => {
        if (newId) {
            nextTick(() =>
                fitView({
                    nodes: [newId],
                    duration: 300,
                    maxZoom: viewport.value.zoom,
                    minZoom: viewport.value.zoom,
                }),
            );
        }
    },
);

watch(
    () => mindmapStore.panTargetNodeId,
    (newId) => {
        if (newId) {
            nextTick(() => {
                fitView({
                    nodes: [newId],
                    duration: 300,
                    maxZoom: viewport.value.zoom,
                    minZoom: viewport.value.zoom,
                });
                mindmapStore.panTargetNodeId = null;
            });
        }
    },
);
</script>

<template>
    <div class="mindmap-canvas-wrapper" @click="dropdownRef?.handleClose()">
        <VueFlow
            :nodes="flowNodes"
            :edges="flowEdges"
            :fit-view-on-init="false"
            :pan-on-drag="isInteractive"
            :zoom-on-scroll="isInteractive"
            :zoom-on-double-click="false"
            :nodes-draggable="isInteractive"
            :elements-selectable="isInteractive"
            @node-drag-start="onNodeDragStart"
            @node-drag="onNodeDrag"
            @node-drag-stop="onNodeDragStop"
        >
            <template #node-mindmap="{ data, selected }">
                <MindmapCustomNode
                    :data="data"
                    :selected="selected"
                    :is-drop-target="
                        dropAction?.type === 'parent' &&
                        dropAction?.targetNodeId === data.id
                    "
                />
            </template>
        </VueFlow>

        <div class="drop-indicator" :style="dropIndicatorStyle"></div>

        <el-dropdown
            ref="dropdownRef"
            trigger="click"
            :style="{
                position: 'fixed',
                left: `${contextMenuPosition.x}px`,
                top: `${contextMenuPosition.y}px`,
            }"
            @command="handleContextMenuCommand"
            @visible-change="(visible) => (contextMenuVisible = visible)"
        >
            <div style="height: 1px; width: 1px"></div>
            <!-- Invisible trigger -->
            <template #dropdown>
                <el-dropdown-menu>
                    <el-dropdown-item command="add-image"
                        >Add Image</el-dropdown-item
                    >
                    <el-dropdown-item command="delete-node" divided
                        >Delete Node</el-dropdown-item
                    >
                    <el-dropdown-item command="pin-node" divided
                        >Pin Node</el-dropdown-item
                    >
                </el-dropdown-menu>
            </template>
        </el-dropdown>
    </div>
</template>

<style lang="scss">
.mindmap-canvas-wrapper {
    width: 100%;
    height: 100%;
    position: relative;
}

.drop-indicator {
    position: absolute;
    height: 4px;
    background-color: var(--el-color-primary);
    border-radius: 2px;
    z-index: 100;
    pointer-events: none;
    display: none;
    box-shadow: 0 0 10px var(--el-color-primary);
}
</style>
