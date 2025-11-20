import { defineStore } from "pinia";
import { ref, computed } from "vue";
import debounce from "lodash.debounce";
import { generateUuid } from "../utils/uuid"; // Import uuid generator
import { useFileStore } from "./fileStore"; // Import fileStore

import { useEditorStore } from "./editorStore";

import { MindmapNode, MindmapEdge } from "../types/shared";

export const useMindmapStore = defineStore("mindmap", () => {
  const rootNode = ref<MindmapNode | null>(null); // 当前思维导图的实际根节点
  const selectedNodeId = ref<string | null>(null); // 当前选中的节点ID
  const pinnedNodeIds = ref<string[]>([]); // Pin 的节点ID列表
  const viewRootNodeId = ref<string | null>(null); // 当前视图的根节点ID (用于局部显示)
  const collapsedNodeIds = ref<string[]>([]); // 新增：用于存储折叠的节点ID
  const panTargetNodeId = ref<string | null>(null); // 用于触发平移到节点的事件
  const nodeDimensions = ref<Map<string, { width: number; height: number }>>(
    new Map(),
  );

  // --- Undo/Redo State ---
  const past = ref<string[]>([]); // Stack of past states (serialized rootNode)
  const future = ref<string[]>([]); // Stack of future states (serialized rootNode)

  const pushState = () => {
    if (rootNode.value) {
      past.value.push(JSON.stringify(rootNode.value));
      future.value = []; // Clear future when a new action is taken
    }
  };

  const undo = () => {
    if (past.value.length === 0 || !rootNode.value) return;

    // Push current state to future
    future.value.push(JSON.stringify(rootNode.value));

    // Pop from past and restore
    const previousState = past.value.pop();
    if (previousState) {
      rootNode.value = JSON.parse(previousState);
      debouncedApplyLayout(); // Re-apply layout
      const fileStore = useFileStore();
      fileStore.markAsUnsaved();
    }
  };

  const redo = () => {
    if (future.value.length === 0 || !rootNode.value) return;

    // Push current state to past
    past.value.push(JSON.stringify(rootNode.value));

    // Pop from future and restore
    const nextState = future.value.pop();
    if (nextState) {
      rootNode.value = JSON.parse(nextState);
      debouncedApplyLayout(); // Re-apply layout
      const fileStore = useFileStore();
      fileStore.markAsUnsaved();
    }
  };

  // Constants for layout and estimated node sizes
  const ESTIMATED_NODE_WIDTH = 150;
  const ESTIMATED_NODE_HEIGHT = 40;
  const HORIZONTAL_GAP = 100;
  const VERTICAL_GAP = 20;

  // Helper to find a node and its parent recursively
  const findNodeAndParent = (
    targetId: string,
    currentNode: MindmapNode | null,
    parentNode: MindmapNode | null = null,
  ): { node: MindmapNode | null; parent: MindmapNode | null } => {
    if (!currentNode) {
      return { node: null, parent: null };
    }
    if (currentNode.id === targetId) {
      return { node: currentNode, parent: parentNode };
    }
    for (const child of currentNode.children) {
      const found = findNodeAndParent(targetId, child, currentNode);
      if (found.node) {
        return found;
      }
    }
    return { node: null, parent: null };
  };

  // Helper to check if a node is an ancestor of another node
  const isAncestor = (
    ancestorId: string,
    descendantId: string,
    currentNode: MindmapNode | null,
  ): boolean => {
    if (!currentNode) return false;
    if (currentNode.id === ancestorId) {
      // If the ancestor is the current node, check its children for the descendant
      const checkChildren = (node: MindmapNode): boolean => {
        if (node.id === descendantId) return true;
        for (const child of node.children) {
          if (checkChildren(child)) return true;
        }
        return false;
      };
      return checkChildren(currentNode);
    }
    for (const child of currentNode.children) {
      if (isAncestor(ancestorId, descendantId, child)) return true;
    }
    return false;
  };

  // Getter: 获取所有节点（扁平化），从当前 viewRootNodeId 开始遍历
  const allNodes = computed(() => {
    const nodes: MindmapNode[] = [];
    const currentViewRoot = viewRootNodeId.value
      ? findNodeAndParent(viewRootNodeId.value, rootNode.value).node
      : rootNode.value;

    const traverse = (node: MindmapNode) => {
      nodes.push(node);
      // If the node is not collapsed, traverse its children
      if (!collapsedNodeIds.value.includes(node.id)) {
        node.children.forEach(traverse);
      }
    };

    if (currentViewRoot) {
      traverse(currentViewRoot);
    }
    return nodes;
  });

  // Getter: 获取当前选中的节点对象 (从整个 mindmap 中查找)
  const selectedNode = computed(() => {
    if (!selectedNodeId.value || !rootNode.value) return null;
    return findNodeAndParent(selectedNodeId.value, rootNode.value).node;
  });

  // Getter for the path from the view root to the selected node
  const currentNodePath = computed(() => {
    if (!selectedNodeId.value || !rootNode.value) return [];

    // 1. Find the full path from the actual root to the selected node
    const fullPath: MindmapNode[] = [];
    let currentId = selectedNodeId.value;
    while (currentId) {
      const { node, parent } = findNodeAndParent(currentId, rootNode.value);
      if (node) {
        fullPath.unshift(node);
      }
      currentId = parent ? parent.id : "";
    }

    // 2. Find the index of the viewRootNode in this path
    const viewRootIndex = viewRootNodeId.value
      ? fullPath.findIndex((node) => node.id === viewRootNodeId.value)
      : 0;

    // 3. Slice the path to start from the view root
    if (viewRootIndex !== -1) {
      return fullPath.slice(viewRootIndex);
    }

    // Fallback to the full path if view root isn't in the ancestry
    return fullPath;
  });

  // Action: 设置思维导图数据
  const setMindmapData = (data: MindmapNode) => {
    rootNode.value = data; // Direct assignment for initial load
    past.value = []; // Clear history on load
    future.value = [];
    applyLayout(); // Apply layout immediately on initial data load
    applyLayout(); // Apply layout immediately on initial data load
    selectedNodeId.value = data.id; // 默认选中根节点
    viewRootNodeId.value = data.id; // 默认视图根节点也是实际根节点

    // 如果 pinnedNodeIds 为空，则默认 pin 实际根节点
    if (pinnedNodeIds.value.length === 0 && data.id) {
      pinnedNodeIds.value.push(data.id);
    }
  };

  // Action: 选中节点
  const selectNode = (nodeId: string) => {
    selectedNodeId.value = nodeId;
  };

  // Action: Selects a node and triggers the pan event
  const selectAndPanToNode = (nodeId: string) => {
    selectNode(nodeId);
    panTargetNodeId.value = nodeId;
  };

  // Action: 设置当前视图的根节点
  const setViewRoot = (nodeId: string | null) => {
    viewRootNodeId.value = nodeId;
    // 如果设置了新的视图根节点，也选中它
    if (nodeId) {
      selectNode(nodeId);
    } else if (rootNode.value) {
      // 如果清除了视图根节点，则选中实际根节点
      selectNode(rootNode.value.id);
    }
  };

  const applyLayout = () => {
    if (!rootNode.value) return;

    const HORIZONTAL_GAP = 100;
    const VERTICAL_GAP = 20;
    const tempRoot = JSON.parse(JSON.stringify(rootNode.value));

    const getSubtreeHeight = (node: MindmapNode): number => {
      const mySize = nodeDimensions.value.get(node.id) || {
        width: 150,
        height: 40,
      };
      if (
        collapsedNodeIds.value.includes(node.id) ||
        node.children.length === 0
      ) {
        return mySize.height + VERTICAL_GAP;
      }
      let childrenHeight = 0;
      for (const child of node.children) {
        childrenHeight += getSubtreeHeight(child);
      }
      return Math.max(mySize.height + VERTICAL_GAP, childrenHeight);
    };

    const positionNodes = (
      node: MindmapNode,
      level: number,
      startY: number,
    ) => {
      const mySize = nodeDimensions.value.get(node.id) || {
        width: 150,
        height: 40,
      };
      const parent = findNodeAndParent(node.id, tempRoot).parent;
      const parentSize = parent
        ? nodeDimensions.value.get(parent.id) || { width: 150, height: 40 }
        : { width: 0 };
      const parentX = parent ? parent.position.x : -HORIZONTAL_GAP;

      const mySubtreeHeight = getSubtreeHeight(node);
      const myY = startY + mySubtreeHeight / 2 - mySize.height / 2;
      const myX = parentX + parentSize.width + HORIZONTAL_GAP;

      node.position = { x: myX, y: myY };

      let cumulativeChildY = startY;
      if (!collapsedNodeIds.value.includes(node.id)) {
        for (const child of node.children) {
          positionNodes(child, level + 1, cumulativeChildY);
          cumulativeChildY += getSubtreeHeight(child);
        }
      }
    };

    positionNodes(tempRoot, 0, 0);

    // Normalize Y positions so the root node's Y is 0
    const yOffset = tempRoot.position.y;
    const allTempNodes: MindmapNode[] = [];
    const traverse = (node: MindmapNode) => {
      allTempNodes.push(node);
      node.children.forEach(traverse);
    };
    traverse(tempRoot);

    allTempNodes.forEach((node) => {
      if (node.position) {
        node.position.y -= yOffset;
      }
    });

    // Update positions in place on the reactive rootNode.value
    const updatePositionsInPlace = (
      originalNode: MindmapNode,
      calculatedNode: MindmapNode,
    ) => {
      if (
        originalNode &&
        calculatedNode &&
        originalNode.id === calculatedNode.id
      ) {
        // Only update if position has actually changed to avoid unnecessary reactivity triggers
        if (
          !originalNode.position ||
          originalNode.position.x !== calculatedNode.position.x ||
          originalNode.position.y !== calculatedNode.position.y
        ) {
          originalNode.position = { ...calculatedNode.position }; // Create new object to ensure reactivity
        }
        for (let i = 0; i < originalNode.children.length; i++) {
          updatePositionsInPlace(
            originalNode.children[i],
            calculatedNode.children[i],
          );
        }
      }
    };

    if (rootNode.value && tempRoot) {
      updatePositionsInPlace(rootNode.value, tempRoot);
    }
  };

  // Create a debounced version of the layout function
  const debouncedApplyLayout = debounce(applyLayout, 100);

  // Action to be called from components to report their dimensions
  const setNodeDimensions = (
    nodeId: string,
    dimensions: { width: number; height: number },
  ) => {
    const currentDimensions = nodeDimensions.value.get(nodeId);
    if (
      !currentDimensions ||
      currentDimensions.width !== dimensions.width ||
      currentDimensions.height !== dimensions.height
    ) {
      nodeDimensions.value.set(nodeId, dimensions);
      debouncedApplyLayout();
    }
  };

  // Action: 添加子节点
  const addChildNode = (parentNodeId: string, text: string = "新子节点") => {
    if (!rootNode.value) return;

    pushState(); // Save state before modification

    const { node: parentNode } = findNodeAndParent(
      parentNodeId,
      rootNode.value,
    );

    if (parentNode) {
      const parentSize = nodeDimensions.value.get(parentNodeId) || {
        width: ESTIMATED_NODE_WIDTH,
        height: ESTIMATED_NODE_HEIGHT,
      };
      const initialX =
        (parentNode.position?.x || 0) + parentSize.width + HORIZONTAL_GAP;
      let initialY = parentNode.position?.y || 0;

      // If parent has children, position new child below the last child
      if (parentNode.children.length > 0) {
        const lastChild = parentNode.children[parentNode.children.length - 1];
        const lastChildSize = nodeDimensions.value.get(lastChild.id) || {
          width: ESTIMATED_NODE_WIDTH,
          height: ESTIMATED_NODE_HEIGHT,
        };
        initialY =
          (lastChild.position?.y || 0) + lastChildSize.height + VERTICAL_GAP;
      }

      const newNode: MindmapNode = {
        id: generateUuid(),
        text: text,
        children: [],
        markdown: `${generateUuid()}.md`, // Assign a new markdown file
        images: [],
        position: { x: initialX, y: initialY }, // Rough initial position
      };
      parentNode.children.push(newNode); // Direct modification
      debouncedApplyLayout(); // Apply layout after adding
      selectAndPanToNode(newNode.id); // Select and pan to the new node

      // Initialize markdown content for the new node in fileStore
      const fileStore = useFileStore();
      fileStore.setMarkdownContent(newNode.markdown, "");
    }
  };

  // Action: 添加兄弟节点
  const addSiblingNode = (nodeId: string, text: string = "新兄弟节点") => {
    if (!rootNode.value) return;

    pushState(); // Save state before modification

    const { node, parent: parentNode } = findNodeAndParent(
      nodeId,
      rootNode.value,
    );

    if (node && parentNode) {
      const nodeSize = nodeDimensions.value.get(nodeId) || {
        width: ESTIMATED_NODE_WIDTH,
        height: ESTIMATED_NODE_HEIGHT,
      };
      const parentSize = nodeDimensions.value.get(parentNode.id) || {
        width: ESTIMATED_NODE_WIDTH,
        height: ESTIMATED_NODE_HEIGHT,
      };
      const initialX =
        (parentNode.position?.x || 0) + parentSize.width + HORIZONTAL_GAP; // Align with other siblings
      const initialY = (node.position?.y || 0) + nodeSize.height + VERTICAL_GAP;

      const newNode: MindmapNode = {
        id: generateUuid(),
        text: text,
        children: [],
        markdown: `${generateUuid()}.md`,
        images: [],
        position: { x: initialX, y: initialY }, // Rough initial position
      };

      const index = parentNode.children.findIndex((n) => n.id === node.id);
      if (index !== -1) {
        parentNode.children.splice(index + 1, 0, newNode); // Direct modification
        debouncedApplyLayout(); // Apply layout after adding
        selectAndPanToNode(newNode.id); // Select and pan to the new node

        // Initialize markdown content for the new node in fileStore
        const fileStore = useFileStore();
        fileStore.setMarkdownContent(newNode.markdown, "");
      }
    } else if (node && !parentNode) {
      // If the selected node is the root and has no parent, we can't add a sibling in the current structure.
      console.warn("Cannot add sibling to root node without a parent.");
    }
  };

  // Action: 添加带图片的子节点
  const addChildNodeWithImage = (
    parentNodeId: string,
    imageName: string,
    text: string = "New Image",
  ) => {
    if (!rootNode.value) return;

    pushState();

    const { node: parentNode } = findNodeAndParent(
      parentNodeId,
      rootNode.value,
    );

    if (parentNode) {
      const parentSize = nodeDimensions.value.get(parentNodeId) || {
        width: ESTIMATED_NODE_WIDTH,
        height: ESTIMATED_NODE_HEIGHT,
      };
      const initialX =
        (parentNode.position?.x || 0) + parentSize.width + HORIZONTAL_GAP;
      let initialY = parentNode.position?.y || 0;

      if (parentNode.children.length > 0) {
        const lastChild = parentNode.children[parentNode.children.length - 1];
        const lastChildSize = nodeDimensions.value.get(lastChild.id) || {
          width: ESTIMATED_NODE_WIDTH,
          height: ESTIMATED_NODE_HEIGHT,
        };
        initialY =
          (lastChild.position?.y || 0) + lastChildSize.height + VERTICAL_GAP;
      }

      const newNode: MindmapNode = {
        id: generateUuid(),
        text: text,
        children: [],
        markdown: `${generateUuid()}.md`,
        images: [imageName],
        position: { x: initialX, y: initialY },
      };
      parentNode.children.push(newNode);
      debouncedApplyLayout();
      selectAndPanToNode(newNode.id);
      const fileStore = useFileStore();
      fileStore.setMarkdownContent(newNode.markdown, "");
      fileStore.markAsUnsaved();
    }
  };

  // Action: 添加带图片的兄弟节点
  const addSiblingNodeWithImage = (
    nodeId: string,
    imageName: string,
    position: "before" | "after",
    text: string = "New Image",
  ) => {
    if (!rootNode.value) return;

    pushState();

    const { node, parent: parentNode } = findNodeAndParent(
      nodeId,
      rootNode.value,
    );

    if (node && parentNode) {
      const nodeSize = nodeDimensions.value.get(nodeId) || {
        width: ESTIMATED_NODE_WIDTH,
        height: ESTIMATED_NODE_HEIGHT,
      };
      const parentSize = nodeDimensions.value.get(parentNode.id) || {
        width: ESTIMATED_NODE_WIDTH,
        height: ESTIMATED_NODE_HEIGHT,
      };
      const initialX =
        (parentNode.position?.x || 0) + parentSize.width + HORIZONTAL_GAP;
      const initialY = (node.position?.y || 0) + nodeSize.height + VERTICAL_GAP;

      const newNode: MindmapNode = {
        id: generateUuid(),
        text: text,
        children: [],
        markdown: `${generateUuid()}.md`,
        images: [imageName],
        position: { x: initialX, y: initialY },
      };

      const index = parentNode.children.findIndex((n) => n.id === node.id);
      if (index !== -1) {
        const insertIndex = position === "before" ? index : index + 1;
        parentNode.children.splice(insertIndex, 0, newNode);
        debouncedApplyLayout();
        selectAndPanToNode(newNode.id);
        const fileStore = useFileStore();
        fileStore.setMarkdownContent(newNode.markdown, "");
        fileStore.markAsUnsaved();
      }
    }
  };

  // Action: 更新节点文本
  const updateNodeText = (nodeId: string, newText: string) => {
    if (!rootNode.value) return;
    const { node } = findNodeAndParent(nodeId, rootNode.value);
    if (node) {
      // Only push state if text actually changed
      if (node.text !== newText) {
        pushState();
        node.text = newText;
        const fileStore = useFileStore();
        fileStore.markAsUnsaved();
      }
    }
  };

  // Action: 删除节点
  const deleteNode = (nodeId: string) => {
    if (!rootNode.value) return;
    if (nodeId === rootNode.value.id) {
      console.warn("Cannot delete the root node.");
      return;
    }

    pushState(); // Save state before modification

    const fileStore = useFileStore();
    const nodesToDelete: MindmapNode[] = [];
    const currentRoot = rootNode.value; // Work directly on the reactive root

    // 1. 递归查找函数：找到要删除的节点及其所有子孙节点
    const findAndCollect = (
      node: MindmapNode,
      targetId: string,
      parent: MindmapNode | null,
    ): boolean => {
      if (node.id === targetId) {
        // 找到节点，收集它和它的所有子孙
        collectAllChildren(node, nodesToDelete);
        // 从父节点的 children 数组中移除
        if (parent) {
          parent.children = parent.children.filter(
            (child) => child.id !== targetId,
          );
        }
        return true;
      }
      for (const child of node.children) {
        if (findAndCollect(child, targetId, node)) {
          return true;
        }
      }
      return false;
    };

    const collectAllChildren = (
      node: MindmapNode,
      collection: MindmapNode[],
    ) => {
      collection.push(node);
      for (const child of node.children) {
        collectAllChildren(child, collection);
      }
    };

    // 2. 执行查找、收集和状态更新
    const parentOfDeleted = findNodeAndParent(nodeId, currentRoot).parent;
    if (findAndCollect(currentRoot, nodeId, null)) {
      // No need to call _updateRootNode, changes are made directly
      debouncedApplyLayout(); // Apply layout after deleting

      // 3. 遍历所有被删除的节点，清理它们的资源
      for (const node of nodesToDelete) {
        // a. 清理 Markdown 内容
        if (node.markdown) {
          fileStore.deleteMarkdownContent(node.markdown);
        }
        // b. 清理图片文件
        if (node.images && node.images.length > 0) {
          for (const imageName of node.images) {
            fileStore.deleteTempFile(`images/${imageName}`);
          }
        }
      }

      // 4. 标记为未保存
      fileStore.markAsUnsaved();

      // 5. 如果删除的节点是当前选中的，则将选中移到其父节点
      if (selectedNodeId.value === nodeId && parentOfDeleted) {
        selectNode(parentOfDeleted.id);
      }

      // If the deleted node was the temporary view root, reset to the actual root
      if (viewRootNodeId.value === nodeId) {
        if (rootNode.value) {
          setViewRoot(rootNode.value.id);
        }
      }
    }
  };

  // Action: 重新父化节点 (拖放)
  const reparentNode = (nodeId: string, newParentId: string) => {
    if (!rootNode.value || nodeId === newParentId) {
      console.warn("Cannot reparent node to itself or if root is null.");
      return;
    }
    if (nodeId === rootNode.value.id) {
      console.warn("Cannot reparent the root node.");
      return;
    }
    // Prevent reparenting to a descendant (circular dependency)
    // Needs to check against the current rootNode.value, not tempRoot
    if (isAncestor(nodeId, newParentId, rootNode.value)) {
      console.warn("Cannot reparent node to its own descendant.");
      return;
    }

    pushState(); // Save state before modification

    const currentRoot = rootNode.value; // Work directly on the reactive root
    const { node: movedNode, parent: oldParentNode } = findNodeAndParent(
      nodeId,
      currentRoot,
    );
    const { node: newParentNode } = findNodeAndParent(newParentId, currentRoot);

    if (movedNode && oldParentNode && newParentNode) {
      // Remove from old parent
      const index = oldParentNode.children.findIndex(
        (n) => n.id === movedNode.id,
      );
      if (index !== -1) {
        oldParentNode.children.splice(index, 1);
      }

      // Add to new parent
      newParentNode.children.push(movedNode); // Direct modification
      debouncedApplyLayout(); // Apply layout after reparenting
      selectNode(movedNode.id); // Select the moved node
    }
  };

  // Action: 切换 Pin 状态
  const togglePin = (nodeId: string) => {
    const tempPinned = [...pinnedNodeIds.value]; // Create a copy for reactivity
    // Prevent unpinning the actual root node if it's the only pinned node
    if (
      rootNode.value &&
      nodeId === rootNode.value.id &&
      tempPinned.length === 1
    ) {
      console.warn(
        "Cannot unpin the main root node if it's the only pinned item.",
      );
      return;
    }

    const index = tempPinned.indexOf(nodeId);
    if (index > -1) {
      tempPinned.splice(index, 1);
    } else {
      tempPinned.push(nodeId);
    }
    pinnedNodeIds.value = tempPinned; // Reassign the ref
  };

  // Action: 切换节点的折叠/展开状态
  const toggleNodeCollapse = (nodeId: string) => {
    const index = collapsedNodeIds.value.indexOf(nodeId);
    if (index > -1) {
      // If already collapsed, expand it
      collapsedNodeIds.value.splice(index, 1);
    } else {
      // If not collapsed, collapse it
      collapsedNodeIds.value.push(nodeId);
    }
    applyLayout(); // Re-apply layout immediately when collapsing/expanding
  };

  // Action: 添加图片到节点
  const addImageToNode = (nodeId: string, imageName: string) => {
    if (!rootNode.value) return;
    const { node } = findNodeAndParent(nodeId, rootNode.value);
    if (node) {
      pushState(); // Save state before modification
      if (!node.images) {
        node.images = [];
      }
      node.images.push(imageName);
    }
  };

  // Action: 更新节点位置
  const updateNodePosition = (
    nodeId: string,
    newPosition: { x: number; y: number },
  ) => {
    if (!rootNode.value) return;
    const { node } = findNodeAndParent(nodeId, rootNode.value);
    if (node) {
      // Only push state if position actually changed significantly (optional optimization, but good for now)
      // For drag-end, we assume it's a valid move worth saving
      pushState();
      node.position = newPosition;
      const fileStore = useFileStore();
      fileStore.markAsUnsaved();
    }
  };

  // Action: Set node draggable state
  const setNodeDraggable = (nodeId: string, draggable: boolean) => {
    if (!rootNode.value) return;
    const { node } = findNodeAndParent(nodeId, rootNode.value);
    if (node) {
      node.draggable = draggable;
    }
  };

  // Helper to get all descendant nodes of a given node
  const getAllDescendants = (nodeId: string): MindmapNode[] => {
    if (!rootNode.value) return [];
    const { node: startNode } = findNodeAndParent(nodeId, rootNode.value);
    if (!startNode) return [];

    const descendants: MindmapNode[] = [];
    const traverse = (node: MindmapNode) => {
      for (const child of node.children) {
        descendants.push(child);
        traverse(child);
      }
    };
    traverse(startNode);
    return descendants;
  };

  // Action: Reorder a node relative to a sibling
  const reorderNode = (
    draggedNodeId: string,
    targetNodeId: string,
    position: "before" | "after",
  ) => {
    if (!rootNode.value || draggedNodeId === targetNodeId) return;

    const { parent: draggedParent } = findNodeAndParent(
      draggedNodeId,
      rootNode.value,
    );
    const { parent: targetParent } = findNodeAndParent(
      targetNodeId,
      rootNode.value,
    );

    pushState(); // Save state before modification

    // Ensure both nodes are siblings
    if (draggedParent && targetParent && draggedParent.id === targetParent.id) {
      const siblings = draggedParent.children;
      const draggedNode = siblings.find((n) => n.id === draggedNodeId);
      if (!draggedNode) return;

      // Calculate targetIndex BEFORE removing draggedNode
      let targetIndex = siblings.findIndex((n) => n.id === targetNodeId);
      if (targetIndex === -1) return; // Target node not found, cannot reorder

      // Remove the dragged node from its current position
      const oldIndex = siblings.findIndex((n) => n.id === draggedNodeId);
      if (oldIndex > -1) {
        siblings.splice(oldIndex, 1);
        // Adjust targetIndex if the removed node was before the target node
        if (oldIndex < targetIndex) {
          targetIndex--;
        }
      }

      // Re-insert the node at the new position
      if (position === "before") {
        siblings.splice(targetIndex, 0, draggedNode);
      } else {
        // 'after'
        siblings.splice(targetIndex + 1, 0, draggedNode);
      }

      debouncedApplyLayout();
      const fileStore = useFileStore();

      fileStore.markAsUnsaved();
    }
  };

  // Action: 更新节点位置 (无痕)
  const setNodePosition = (
    nodeId: string,
    newPosition: { x: number; y: number },
  ) => {
    if (!rootNode.value) return;
    const { node } = findNodeAndParent(nodeId, rootNode.value);
    if (node) {
      node.position = newPosition;
    }
  };

  return {
    rootNode,
    selectedNodeId,
    pinnedNodeIds,
    viewRootNodeId, // Expose new state
    panTargetNodeId,
    allNodes,
    selectedNode,
    currentNodePath,
    setMindmapData,
    selectNode,
    selectAndPanToNode,
    setViewRoot, // Expose new action
    addChildNode,
    addChildNodeWithImage, // Expose new action
    addSiblingNode,
    addSiblingNodeWithImage, // Expose new action
    updateNodeText,
    updateNodePosition, // Expose new action
    deleteNode, // Expose new action
    reparentNode, // Expose new action
    togglePin,
    collapsedNodeIds, // Expose collapsed state
    toggleNodeCollapse, // Expose collapse action
    addImageToNode, // Expose add image action
    findNodeAndParent, // Expose helper function
    setNodeDraggable, // Expose draggable action
    setNodeDimensions, // Expose dimensions setter
    // For Drag and Drop
    getAllDescendants,
    reorderNode,
    setNodePosition,
    undo,
    redo,
  };
});
