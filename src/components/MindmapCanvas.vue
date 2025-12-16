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
import ImageViewerModal from "./ImageViewerModal.vue"; // Import Modal
import type { MindmapNode } from "../types/shared_types";
import { useUIStore } from "../stores/uiStore"; // Import UI Store

import { Background } from "@vue-flow/background"; // Import Background
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";

import { useSettingsStore } from "../stores/settingsStore"; // Import settingsStore



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

const { onNodeClick, onNodeContextMenu, getNodes, fitView, viewport, project, setCenter, findNode } =
    useVueFlow();
const mindmapStore = useMindmapStore();
const fileStore = useFileStore();

const editorStore = useEditorStore();
const uiStore = useUIStore(); // Use UI Store
const settingsStore = useSettingsStore(); // Use settingsStore


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
                style: {
                    stroke: settingsStore.settings.lineStyle.stroke,
                    strokeWidth: settingsStore.settings.lineStyle.strokeWidth,
                },
                type: settingsStore.settings.lineStyle.type,
                animated: false,
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

// --- State for Selection Box ---
const selectionBox = ref<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    visible: boolean;
} | null>(null);

// --- Event Handlers ---

onNodeClick((event) => {
    const nodeId = event.node.id;
    const { event: mouseEvent } = event;

    if (mouseEvent.altKey) {
        mindmapStore.toggleNodeSelection(nodeId);
    } else if (mouseEvent.shiftKey) {
        mindmapStore.selectRange(nodeId);
    } else {
        // If clicking a node that is already selected, and no modifiers, do nothing (keep selection)
        // unless it's the ONLY selected node, then we just ensure it's selected.
        // Actually, standard behavior: click on unselected -> select only it.
        // Click on selected -> if multiple, keep them selected (for drag start), but if mouse up without drag, usually selects just that one.
        // For simplicity: if not dragging, click selects just this one.
        // But we need to handle this carefully with drag.
        // VueFlow's onNodeClick happens after drag check usually.
        
        // If the node is NOT in the current selection, select only it
        if (!mindmapStore.selectedNodeIds.includes(nodeId)) {
            mindmapStore.selectNode(nodeId);
        } else {
             // If it IS in the selection, and we just clicked it (no drag), we usually want to select JUST it,
             // unless we are preparing to drag multiple.
             // But onNodeClick fires after mouseup usually.
             // Let's stick to: Click without modifier = Select Single.
             // If the user wants to drag multiple, they press down and drag.
             // If they click and release, it selects just that one.
             mindmapStore.selectNode(nodeId);
        }
    }
    
    emit("node-selected", nodeId); // Keep emitting for other components if needed
    if (contextMenuVisible.value) dropdownRef.value?.handleClose();
});

const onNodeDragStart = ({ node }: NodeDragEvent) => {
    // If dragging a node that is NOT currently selected, select it (and deselect others)
    if (!mindmapStore.selectedNodeIds.includes(node.id)) {
        mindmapStore.selectNode(node.id);
    }
    // If dragging a node that IS selected, keep the current selection (allows multi-drag)
    
    emit("node-selected", node.id); // Update primary selection for UI
    
    draggedNodeInfo.value = {
        id: node.id,
        initialPosition: { ...node.position },
    };
    dropAction.value = null;
};

// --- Selection Box Logic ---
const onMouseDown = (event: MouseEvent) => {
    // Only trigger on right click (button 2)
    if (event.button === 2) {
        const target = event.target as HTMLElement;
        // Check if we clicked on a node or edge
        if (target.closest('.vue-flow__node') || target.closest('.vue-flow__edge')) {
            return; // Let VueFlow handle node context menu
        }

        event.preventDefault(); // Prevent default context menu on background
        
        let clientX = event.clientX;
        let clientY = event.clientY;

        if (canvasWrapperRef.value) {
            const rect = canvasWrapperRef.value.getBoundingClientRect();
            clientX -= rect.left;
            clientY -= rect.top;
        }

        selectionBox.value = {
            startX: clientX,
            startY: clientY,
            currentX: clientX,
            currentY: clientY,
            visible: true,
        };
    }
};

const onContextMenu = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    // If it's a node or edge, let the specific handler (or default) deal with it
    // But we have onNodeContextMenu for nodes.
    if (target.closest('.vue-flow__node') || target.closest('.vue-flow__edge')) {
        return;
    }
    // Otherwise, prevent default context menu on background
    event.preventDefault();
};

const onMouseMove = (event: MouseEvent) => {
    if (selectionBox.value && selectionBox.value.visible) {
        let clientX = event.clientX;
        let clientY = event.clientY;

        if (canvasWrapperRef.value) {
            const rect = canvasWrapperRef.value.getBoundingClientRect();
            clientX -= rect.left;
            clientY -= rect.top;
        }

        selectionBox.value.currentX = clientX;
        selectionBox.value.currentY = clientY;
    }
};

// Flag to prevent context menu after selection drag
const blockNextContextMenu = ref(false);

const onMouseUp = (event: MouseEvent) => {
    if (selectionBox.value && selectionBox.value.visible) {
        // Finalize selection
        const box = selectionBox.value;
        const x = Math.min(box.startX, box.currentX);
        const y = Math.min(box.startY, box.currentY);
        const width = Math.abs(box.currentX - box.startX);
        const height = Math.abs(box.currentY - box.startY);

        // If it was a tiny drag (click), treat as context menu or ignore
        if (width < 5 && height < 5) {
             selectionBox.value = null;
             return;
        }

        // It was a valid drag, so we should block the next context menu
        blockNextContextMenu.value = true;
        // Reset flag after a short delay to be safe, though usually the event fires immediately
        setTimeout(() => {
            blockNextContextMenu.value = false;
        }, 100);

        // Calculate intersection with nodes
        // We need to convert screen/container coordinates to flow coordinates if needed, 
        // OR convert flow nodes to container coordinates.
        // Easier to convert flow nodes to container coordinates using viewport.
        
        const nodes = getNodes.value;
        const selectedIds: string[] = [];

        nodes.forEach(node => {
            // Node position is in flow coordinates
            const nodeX = node.position.x * viewport.value.zoom + viewport.value.x;
            const nodeY = node.position.y * viewport.value.zoom + viewport.value.y;
            // Assuming node dimensions are available or estimated. 
            // The `node.dimensions` from vue-flow might be 0 if not measured yet, but we have `nodeDimensions` in store or we can try to use what's available.
            // VueFlow nodes usually have width/height if rendered.
            const nodeW = node.dimensions.width || 150; 
            const nodeH = node.dimensions.height || 40;

            // Check intersection
            if (
                nodeX < x + width &&
                nodeX + nodeW > x &&
                nodeY < y + height &&
                nodeY + nodeH > y
            ) {
                selectedIds.push(node.id);
            }
        });

        // Update store selection
        // If Shift is held, add to selection? Requirement didn't specify, but standard is replace.
        // Let's replace selection for now as per "Rectangle selection" usually implies new selection.
        if (selectedIds.length > 0) {
            // If modifier keys needed, we can check event.
            // For now, just set selection.
            mindmapStore.selectedNodeIds = selectedIds;
        } else {
            mindmapStore.clearSelection();
        }

        selectionBox.value = null;
    }
};


// --- Helper for Drop Target Calculation ---
const calculateDropTarget = (
    cursorX: number,
    cursorY: number,
    draggedNodeId: string | null, // null for external files
): DropAction => {
    // If dragging multiple nodes, we calculate target based on the PRIMARY dragged node (the one under cursor)
    // But we must ensure we don't drop onto any of the selected nodes or their descendants.
    
    const draggedIds = draggedNodeId ? mindmapStore.selectedNodeIds : [];
    // If draggedNodeId is not in selectedNodeIds (shouldn't happen due to dragStart logic), fallback
    if (draggedNodeId && !draggedIds.includes(draggedNodeId)) {
        draggedIds.push(draggedNodeId);
    }

    const otherNodes = getNodes.value.filter((n) => !draggedIds.includes(n.id));
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

        // Check for circular dependency (only for internal node drag)
        if (draggedNodeId) {
            // Check if target is descendant of ANY dragged node
            const isCircular = draggedIds.some(id => {
                 return mindmapStore.getAllDescendants(id).some((desc) => desc.id === targetNode.id);
            });
            if (isCircular) continue;
        }

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

    return bestTarget?.action ?? null;
};

const canvasWrapperRef = ref<HTMLElement | null>(null);

const onNodeDrag = ({ node: draggedNode, event }: NodeDragEvent) => {
    if (!draggedNode) return;
    dropAction.value = null; // Reset on each drag event

    let clientX = event.clientX;
    let clientY = event.clientY;

    if (canvasWrapperRef.value) {
        const rect = canvasWrapperRef.value.getBoundingClientRect();
        clientX -= rect.left;
        clientY -= rect.top;
    }

    const { x: cursorX, y: cursorY } = project({
        x: clientX,
        y: clientY,
    });

    dropAction.value = calculateDropTarget(cursorX, cursorY, draggedNode.id);
};

// --- External File Drag and Drop ---
const onExternalDragOver = (event: DragEvent) => {
    if (!event.dataTransfer) return;
    // Check if dragging files
    if (
        event.dataTransfer.types.includes("Files")
    ) {
        event.dataTransfer.dropEffect = "copy";

        let clientX = event.clientX;
        let clientY = event.clientY;

        if (canvasWrapperRef.value) {
            const rect = canvasWrapperRef.value.getBoundingClientRect();
            clientX -= rect.left;
            clientY -= rect.top;
        }

        const { x: cursorX, y: cursorY } = project({
            x: clientX,
            y: clientY,
        });
        dropAction.value = calculateDropTarget(cursorX, cursorY, null);
    }
};

const onExternalDrop = async (event: DragEvent) => {
    if (!event.dataTransfer) return;
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith("image/")) {
            try {
                const imageName = await fileStore.saveDroppedImage(file);
                if (dropAction.value) {
                    const { type, targetNodeId } = dropAction.value;
                    if (type === "parent") {
                        mindmapStore.addChildNodeWithImage(
                            targetNodeId,
                            imageName,
                            file.name,
                        );
                    } else if (type === "reparent-and-reorder") {
                        const { position } = dropAction.value;
                        mindmapStore.addSiblingNodeWithImage(
                            targetNodeId,
                            imageName,
                            position,
                            file.name,
                        );
                    }
                }
            } catch (error) {
                ElMessage.error("Failed to save dropped image.");
                console.error(error);
            }
        }
    }
    dropAction.value = null;
};

const onNodeDragStop = ({ node }: NodeDragEvent) => {
    if (dropAction.value) {
        const { type, targetNodeId } = dropAction.value;
        
        // Execute move for ALL selected nodes
        // We need to be careful about order and validity.
        // For "parent" drop: reparent all selected nodes to target.
        // For "reorder" drop: reparent all to target's parent, and insert at position.
        
        const nodesToMove = [...mindmapStore.selectedNodeIds];
        // Ensure the dragged node is in the list (it should be)
        if (!nodesToMove.includes(node.id)) nodesToMove.push(node.id);

        if (type === "parent") {
            nodesToMove.forEach(id => mindmapStore.reparentNode(id, targetNodeId));
        } else if (type === "reparent-and-reorder") {
            const { position } = dropAction.value;
            const { parent: targetParent } = mindmapStore.findNodeAndParent(
                targetNodeId,
                mindmapStore.rootNode,
            );
            
            if (targetParent) {
                 // We want to insert ALL nodes before or after the target.
                 // If "after", we insert them one by one in reverse order so they end up in correct order?
                 // Or just insert them one by one.
                 // Let's say we have A, B selected. Target is T. Position After.
                 // Result: T, A, B.
                 // We should insert A after T, then B after A? Or B after T, then A after T?
                 // If we iterate nodesToMove:
                 // 1. Move A after T.
                 // 2. Move B after T (result T, B, A) -> Wrong if we want T, A, B.
                 
                 // If we want to maintain relative order of selected nodes, it's complex.
                 // Simple approach: Move them one by one.
                 // If "after": Insert first selected after target. Then next selected after that one.
                 // If "before": Insert last selected before target. Then previous selected before that one?
                 // Or: Insert A before T. Insert B before T (result B, A, T).
                 
                 // Let's simplify: Just move them.
                 // For "before": Iterate normally, insert each before target? No, that reverses order.
                 // Iterate reversed, insert each before target? Yes.
                 // For "after": Iterate reversed, insert each after target? No.
                 // Iterate normally, insert each after target? No, that reverses order (T, B, A).
                 
                 // Correct logic:
                 // "after": Insert A after T. Then insert B after A.
                 // "before": Insert A before T. Then insert B after A (but before T's original pos)?
                 
                 // Actually `reorderNode` takes (dragged, target, pos).
                 // If we use that:
                 // A after T -> T, A
                 // B after T -> T, B, A (Wrong)
                 // B after A -> T, A, B (Correct)
                 
                 let anchorNodeId = targetNodeId;
                 let insertPos = position;
                 
                 nodesToMove.forEach((id) => {
                     // First reparent if needed
                     const { parent: currentParent } = mindmapStore.findNodeAndParent(id, mindmapStore.rootNode);
                     if (currentParent?.id !== targetParent.id) {
                         mindmapStore.reparentNode(id, targetParent.id);
                     }
                     
                     // Then reorder
                     mindmapStore.reorderNode(id, anchorNodeId, insertPos);
                     
                     // Update anchor for next node to maintain order
                     anchorNodeId = id;
                     insertPos = "after"; // Subsequent nodes always after the previous one
                 });
            }
        }
    } else if (draggedNodeInfo.value) {
        // No valid drop, revert position
        // Revert for ALL selected nodes?
        // Since we didn't actually change the store structure during drag (only visual position in vue-flow),
        // and we only updated `draggedNodeInfo` for the primary node...
        // VueFlow handles the visual revert if we don't update the position in store.
        // But we might have updated the store position if we were doing real-time sync?
        // In this app, `onNodeDrag` doesn't update store, only `onNodeDragStop` does actions.
        // So we just need to reset the draggedNodeInfo.
        
        // However, we might want to force update to reset any visual glitches.
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
    // If we just finished a selection drag, don't show context menu
    if (blockNextContextMenu.value) {
        blockNextContextMenu.value = false;
        return;
    }

    // The `onNodeContextMenu` is only for nodes.
    event.event.preventDefault();
    contextMenuNodeId.value = event.node.id;
    showContextMenu(event.event);
});

const handleContextMenuCommand = async (command: string) => {
    if (!contextMenuNodeId.value) return;
    switch (command) {
        case "delete-node":
            // If the right-clicked node is part of the selection, delete all selected nodes
            if (mindmapStore.selectedNodeIds.includes(contextMenuNodeId.value)) {
                mindmapStore.deleteNode();
            } else {
                // Otherwise, delete only the right-clicked node
                mindmapStore.deleteNode(contextMenuNodeId.value);
            }
            ElMessage.success("Node(s) deleted");
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
    if (uiStore.activePanel !== 'mindmap') return;
    if (editorStore.isTextInputActive) return;
    
    // Delete Node
    if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        mindmapStore.deleteNode();
        return;
    }

    if (!props.selectedNodeId) return;

    if (event.key === "Tab") {
        event.preventDefault();
        mindmapStore.addChildNode(props.selectedNodeId);
    }
    if (event.key === "Enter") {
        event.preventDefault();
        mindmapStore.addSiblingNode(props.selectedNodeId);
    }
    if (event.code === "Space") {
        event.preventDefault();
        // enter editor mode
        if (props.selectedNodeId) {
            editorStore.setEditingNodeId(props.selectedNodeId);
        }
    }
    // Undo/Redo shortcuts
    if ((event.ctrlKey || event.metaKey) && event.key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
            mindmapStore.redo();
        } else {
            mindmapStore.undo();
        }
    }
    if ((event.ctrlKey || event.metaKey) && event.key === "y") {
        event.preventDefault();
        mindmapStore.redo();
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

// --- Viewport Management ---
const panToNode = (nodeId: string) => {
    const node = findNode(nodeId);
    if (!node || !canvasWrapperRef.value) return;

    const { width } = canvasWrapperRef.value.getBoundingClientRect();
    const zoom = viewport.value.zoom;

    // We want the node center to be at 38.2% of the screen width (Golden Ratio from left)
    // and 50% of the screen height.
    // Center of screen is 50% width.
    // Offset required: (0.5 - 0.382) * width = 0.118 * width (to the right of node)
    
    const nodeW = node.dimensions.width || 150;
    const nodeH = node.dimensions.height || 40;
    const nodeCenterX = node.position.x + nodeW / 2;
    const nodeCenterY = node.position.y + nodeH / 2;

    // Calculate the graph coordinate that should be at the center of the viewport
    const targetCenterX = nodeCenterX + (width * 0.118) / zoom;
    const targetCenterY = nodeCenterY;

    setCenter(targetCenterX, targetCenterY, { zoom, duration: 300 });
};

// --- Watchers for automatic view adjustments ---
watch(
    () => mindmapStore.viewRootNodeId,
    (newId) => {
        if (newId) {
            nextTick(() => panToNode(newId));
        } else if (mindmapStore.rootNode) {
             // If view root is cleared, go back to actual root
             nextTick(() => panToNode(mindmapStore.rootNode!.id));
        }
    },
);

watch(
    () => mindmapStore.panTargetNodeId,
    (newId) => {
        if (newId) {
            nextTick(() => {
                panToNode(newId);
                mindmapStore.panTargetNodeId = null;
            });
        }
    },
);

// Watch for root node change (e.g. file load)
watch(
    () => mindmapStore.rootNode,
    (newRoot) => {
        if (newRoot) {
            // On load, we might want to reset zoom or keep it?
            // Usually fitView is good for initial load, but user requested specific position.
            // Let's wait for nodes to be rendered (dimensions)
            nextTick(() => {
                // Small delay to ensure dimensions are ready
                setTimeout(() => {
                    panToNode(newRoot.id);
                }, 100);
            });
        }
    },
    { immediate: true } // Trigger if already loaded
);
</script>

<template>
    <div
        class="mindmap-canvas-wrapper"
        ref="canvasWrapperRef"
        @click="dropdownRef?.handleClose()"
        @dragover.prevent="onExternalDragOver"
        @drop.prevent="onExternalDrop"
        @mousedown.capture="(e) => { onMouseDown(e); uiStore.setActivePanel('mindmap'); }"
        @mousemove="onMouseMove"
        @mouseup="onMouseUp"
        @contextmenu="onContextMenu"
    >
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
            <Background 
                :pattern-color="settingsStore.settings.backgroundStyle.pattern === 'none' ? 'transparent' : 'var(--el-border-color-dark)'"
                :gap="20" 
                :size="1" 
                :variant="settingsStore.settings.backgroundStyle.pattern === 'dots' ? 'dots' : (settingsStore.settings.backgroundStyle.pattern === 'lines' ? 'lines' : 'dots')"
                :style="{ backgroundColor: settingsStore.settings.backgroundStyle.color }"
            />
        </VueFlow>


        <div class="drop-indicator" :style="dropIndicatorStyle"></div>
        
        <div 
            v-if="selectionBox && selectionBox.visible"
            class="selection-box"
            :style="{
                left: Math.min(selectionBox.startX, selectionBox.currentX) + 'px',
                top: Math.min(selectionBox.startY, selectionBox.currentY) + 'px',
                width: Math.abs(selectionBox.currentX - selectionBox.startX) + 'px',
                height: Math.abs(selectionBox.currentY - selectionBox.startY) + 'px',
            }"
        ></div>

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

        <ImageViewerModal
            :visible="uiStore.imageViewer.visible"
            :image-url="uiStore.imageViewer.imageUrl"
            @close="uiStore.closeImageViewer()"
        />
    </div>
</template>

<style lang="scss">
.mindmap-canvas-wrapper {
    width: 100%;
    height: 100%;
    position: relative;
    background-color: var(--app-bg-color);
    cursor: grab;

    &:active {
        cursor: grab;
    }
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

.selection-box {
    position: absolute;
    background-color: var(--el-color-primary-light-9);
    border: 1px solid var(--el-color-primary);
    opacity: 0.8; /* Ensure it's not too solid */
    pointer-events: none;
    z-index: 1000;
}
</style>
