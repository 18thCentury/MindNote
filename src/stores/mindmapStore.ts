import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import debounce from "lodash.debounce";
import { generateUuid } from "../utils/uuid"; // Import uuid generator
import { useFileStore } from "./fileStore"; // Import fileStore

import { useEditorStore } from "./editorStore";
import { useSettingsStore } from "./settingsStore";



import { MindmapNode, MindmapEdge } from "../types/shared_types";
import { ElMessage } from "element-plus";

export const useMindmapStore = defineStore("mindmap", () => {
  const rootNode = ref<MindmapNode | null>(null); // 当前思维导图的实际根节点
  const selectedNodeIds = ref<string[]>([]); // 当前选中的节点ID列表
  const pinnedNodeIds = ref<string[]>([]); // Pin 的节点ID列表
  const viewRootNodeId = ref<string | null>(null); // 当前视图的根节点ID (用于局部显示)
  const collapsedNodeIds = ref<string[]>([]); // 新增：用于存储折叠的节点ID
  const panTargetNodeId = ref<string | null>(null); // 用于触发平移到节点的事件
  const nodeDimensions = ref<Map<string, { width: number; height: number }>>(
    new Map(),
  );
  const isDragging = ref(false); // Flag to skip layout during drag operations

  // --- O(1) Node Lookup ---
  // Map for instant node lookup by ID
  const nodeMap = ref<Map<string, MindmapNode>>(new Map());

  // Rebuild the nodeMap from the tree structure
  const buildNodeMap = () => {
    nodeMap.value.clear();
    if (!rootNode.value) return;
    const traverse = (node: MindmapNode) => {
      nodeMap.value.set(node.id, node);
      node.children.forEach(traverse);
    };
    traverse(rootNode.value);
  };

  // O(1) node lookup by ID
  const getNodeById = (id: string): MindmapNode | null => {
    return nodeMap.value.get(id) || null;
  };

  // O(1) parent lookup using parentNodeId
  const getParentNode = (nodeId: string): MindmapNode | null => {
    const node = getNodeById(nodeId);
    if (!node || !node.parentNodeId) return null;
    return getNodeById(node.parentNodeId);
  };

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
      const restoredNode = JSON.parse(previousState) as MindmapNode;
      // Rebuild parentNodeIds after JSON restore (JSON doesn't preserve them properly)
      const rebuildParentIds = (node: MindmapNode, parentId: string | null) => {
        node.parentNodeId = parentId;
        node.children.forEach(child => rebuildParentIds(child, node.id));
      };
      rebuildParentIds(restoredNode, null);
      rootNode.value = restoredNode;
      buildNodeMap();
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
      const restoredNode = JSON.parse(nextState) as MindmapNode;
      // Rebuild parentNodeIds after JSON restore
      const rebuildParentIds = (node: MindmapNode, parentId: string | null) => {
        node.parentNodeId = parentId;
        node.children.forEach(child => rebuildParentIds(child, node.id));
      };
      rebuildParentIds(restoredNode, null);
      rootNode.value = restoredNode;
      buildNodeMap();
      debouncedApplyLayout(); // Re-apply layout
      const fileStore = useFileStore();
      fileStore.markAsUnsaved();
    }
  };

  // Constants for estimated node sizes
  const ESTIMATED_NODE_WIDTH = 150;
  const ESTIMATED_NODE_HEIGHT = 40;


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

  // Getter: 获取当前选中的节点对象列表
  const selectedNodes = computed(() => {
    if (selectedNodeIds.value.length === 0 || !rootNode.value) return [];
    return selectedNodeIds.value
      .map((id) => findNodeAndParent(id, rootNode.value).node)
      .filter((n): n is MindmapNode => n !== null);
  });

  // Getter: 获取主要选中的节点（通常是最后一个选中的，用于单节点操作）
  const primarySelectedNodeId = computed(() => {
    if (selectedNodeIds.value.length === 0) return null;
    return selectedNodeIds.value[selectedNodeIds.value.length - 1];
  });

  // Getter: 获取当前选中的单个节点 (兼容旧代码)
  const selectedNode = computed(() => {
    if (!primarySelectedNodeId.value || !rootNode.value) return null;
    const { node } = findNodeAndParent(primarySelectedNodeId.value, rootNode.value);
    return node;
  });

  // Getter for the path from the view root to the primary selected node
  const currentNodePath = computed(() => {
    if (!primarySelectedNodeId.value || !rootNode.value) return [];

    // 1. Find the full path from the actual root to the selected node
    const fullPath: MindmapNode[] = [];
    let currentId = primarySelectedNodeId.value;
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
  const setMindmapData = (data: MindmapNode | null) => {
    rootNode.value = data; // Direct assignment for initial load
    past.value = []; // Clear history on load
    future.value = [];

    if (data) {
      // Rebuild parentNodeId for each node (handles legacy files without parentNodeId)
      const rebuildParentIds = (node: MindmapNode, parentId: string | null) => {
        node.parentNodeId = parentId;
        node.children.forEach(child => rebuildParentIds(child, node.id));
      };
      rebuildParentIds(data, null);

      // Build the nodeMap for O(1) lookups
      buildNodeMap();

      debouncedApplyLayout(); // Apply layout immediately on initial data load
      selectedNodeIds.value = [data.id]; // 默认选中根节点
      viewRootNodeId.value = data.id; // 默认视图根节点也是实际根节点

      // 如果 pinnedNodeIds 为空，则默认 pin 实际根节点
      if (pinnedNodeIds.value.length === 0 && data.id) {
        pinnedNodeIds.value.push(data.id);
      }
    } else {
      selectedNodeIds.value = [];
      viewRootNodeId.value = null;
      pinnedNodeIds.value = [];
      nodeDimensions.value.clear();
      nodeMap.value.clear();
    }
  };

  // Action: 选中单一节点 (Clear others)
  const selectNode = (nodeId: string) => {
    selectedNodeIds.value = [nodeId];
  };

  // Action: 切换节点选中状态 (Alt/Ctrl click)
  const toggleNodeSelection = (nodeId: string) => {
    const index = selectedNodeIds.value.indexOf(nodeId);
    if (index > -1) {
      selectedNodeIds.value.splice(index, 1);
    } else {
      selectedNodeIds.value.push(nodeId);
    }
  };

  // Action: 添加节点到选中列表
  const addNodeToSelection = (nodeId: string) => {
    if (!selectedNodeIds.value.includes(nodeId)) {
      selectedNodeIds.value.push(nodeId);
    }
  };

  // Action: 清除所有选中
  const clearSelection = () => {
    selectedNodeIds.value = [];
  };

  // Action: 范围选择 (Shift click) - Select siblings between last selected and current
  const selectRange = (targetNodeId: string) => {
    if (!rootNode.value || selectedNodeIds.value.length === 0) {
      selectNode(targetNodeId);
      return;
    }

    const lastSelectedId = selectedNodeIds.value[selectedNodeIds.value.length - 1];
    if (lastSelectedId === targetNodeId) return;

    const { parent: targetParent } = findNodeAndParent(targetNodeId, rootNode.value);
    const { parent: lastParent } = findNodeAndParent(lastSelectedId, rootNode.value);

    // Only support range selection for siblings under the same parent
    if (targetParent && lastParent && targetParent.id === lastParent.id) {
      const siblings = targetParent.children;
      const index1 = siblings.findIndex(n => n.id === lastSelectedId);
      const index2 = siblings.findIndex(n => n.id === targetNodeId);

      if (index1 !== -1 && index2 !== -1) {
        const start = Math.min(index1, index2);
        const end = Math.max(index1, index2);

        // Add all nodes in range to selection
        for (let i = start; i <= end; i++) {
          addNodeToSelection(siblings[i].id);
        }
      } else {
        // Fallback if indices weird
        addNodeToSelection(targetNodeId);
      }
    } else {
      // If not siblings, just add the target node
      addNodeToSelection(targetNodeId);
    }
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

    const settingsStore = useSettingsStore();
    const HORIZONTAL_GAP = settingsStore.settings.layoutStyle.horizontalGap;
    const VERTICAL_GAP = settingsStore.settings.layoutStyle.verticalGap;

    const subtreeHeightCache = new Map<string, number>();

    // 1. Calculate subtree heights (Read-only traversal)
    const getSubtreeHeight = (node: MindmapNode): number => {
      if (subtreeHeightCache.has(node.id)) {
        return subtreeHeightCache.get(node.id)!;
      }

      const mySize = nodeDimensions.value.get(node.id) || {
        width: 150,
        height: 40,
      };
      if (
        collapsedNodeIds.value.includes(node.id) ||
        node.children.length === 0
      ) {
        const height = mySize.height + VERTICAL_GAP;
        subtreeHeightCache.set(node.id, height);
        return height;
      }
      let childrenHeight = 0;
      for (const child of node.children) {
        childrenHeight += getSubtreeHeight(child);
      }
      const height = Math.max(mySize.height + VERTICAL_GAP, childrenHeight);
      subtreeHeightCache.set(node.id, height);
      return height;
    };

    // Calculate all heights first
    getSubtreeHeight(rootNode.value);

    // 2. Calculate positions (Read-only traversal with Position Map)
    const nodePositions = new Map<string, { x: number; y: number }>();

    const calculatePositions = (
      node: MindmapNode,
      level: number,
      startY: number,
      parent: MindmapNode | null
    ) => {
      const mySize = nodeDimensions.value.get(node.id) || {
        width: 150,
        height: 40,
      };
      const parentSize = parent
        ? nodeDimensions.value.get(parent.id) || { width: 150, height: 40 }
        : { width: 0 };

      // Get parent position from map (calculated in previous recursive step)
      const parentPos = parent ? nodePositions.get(parent.id) : null;
      const parentX = parentPos ? parentPos.x : -HORIZONTAL_GAP;

      const mySubtreeHeight = subtreeHeightCache.get(node.id) || 0;
      const myY = startY + mySubtreeHeight / 2 - mySize.height / 2;
      const myX = parentX + parentSize.width + HORIZONTAL_GAP;

      // Store calculated position
      nodePositions.set(node.id, { x: myX, y: myY });

      if (!collapsedNodeIds.value.includes(node.id)) {
        let childrenTotalHeight = 0;
        for (const child of node.children) {
          childrenTotalHeight += subtreeHeightCache.get(child.id) || 0;
        }

        let cumulativeChildY = startY + (mySubtreeHeight - childrenTotalHeight) / 2;

        for (const child of node.children) {
          calculatePositions(child, level + 1, cumulativeChildY, node);
          cumulativeChildY += subtreeHeightCache.get(child.id) || 0;
        }
      }
    };

    calculatePositions(rootNode.value, 0, 0, null);

    // 3. Normalize Y positions so the root node's Y is 0
    const rootPos = nodePositions.get(rootNode.value.id);
    const yOffset = rootPos ? rootPos.y : 0;

    // 4. Apply positions to actual nodes in place (Write phase)
    // We traverse the tree one last time to apply updates
    const applyToNodes = (node: MindmapNode) => {
      const newPos = nodePositions.get(node.id);
      if (newPos) {
        const adjustedPos = { x: newPos.x, y: newPos.y - yOffset };

        // Only update if position has actually changed to minimize reactivity triggers
        if (
          !node.position ||
          Math.abs(node.position.x - adjustedPos.x) > 0.1 ||
          Math.abs(node.position.y - adjustedPos.y) > 0.1
        ) {
          node.position = adjustedPos;
        }
      }
      if (!collapsedNodeIds.value.includes(node.id)) {
        node.children.forEach(applyToNodes);
      }
    };

    applyToNodes(rootNode.value);
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
      // Skip layout during drag - VueFlow handles visual updates
      if (!isDragging.value) {
        debouncedApplyLayout();
      }
    }
  };

  // Action to set dragging state (called from MindmapCanvas)
  const setDragging = (dragging: boolean) => {
    isDragging.value = dragging;
    // When drag ends, apply any pending layout
    if (!dragging) {
      debouncedApplyLayout();
    }
  };

  // Watch for layout setting changes and re-apply layout
  const settingsStore = useSettingsStore();
  watch(
    () => settingsStore.settings.layoutStyle,
    () => {
      debouncedApplyLayout();
    },
    { deep: true }
  );

  // Action: 添加子节点
  const addChildNode = (parentNodeId: string, text: string = "新子节点") => {
    if (!rootNode.value) return;

    pushState(); // Save state before modification

    const settingsStore = useSettingsStore();
    const HORIZONTAL_GAP = settingsStore.settings.layoutStyle.horizontalGap;
    const VERTICAL_GAP = settingsStore.settings.layoutStyle.verticalGap;

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
        parentNodeId: parentNodeId, // O(1) parent lookup
        text: text,
        children: [],
        markdown: `${generateUuid()}.md`, // Assign a new markdown file
        images: [],
        position: { x: initialX, y: initialY }, // Rough initial position
      };
      parentNode.children.push(newNode); // Direct modification
      nodeMap.value.set(newNode.id, newNode); // Add to nodeMap
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

    const settingsStore = useSettingsStore();
    const HORIZONTAL_GAP = settingsStore.settings.layoutStyle.horizontalGap;
    const VERTICAL_GAP = settingsStore.settings.layoutStyle.verticalGap;

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
        parentNodeId: parentNode.id, // O(1) parent lookup
        text: text,
        children: [],
        markdown: `${generateUuid()}.md`,
        images: [],
        position: { x: initialX, y: initialY }, // Rough initial position
      };

      const index = parentNode.children.findIndex((n) => n.id === node.id);
      if (index !== -1) {
        parentNode.children.splice(index + 1, 0, newNode); // Direct modification
        nodeMap.value.set(newNode.id, newNode); // Add to nodeMap
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

    const settingsStore = useSettingsStore();
    const HORIZONTAL_GAP = settingsStore.settings.layoutStyle.horizontalGap;
    const VERTICAL_GAP = settingsStore.settings.layoutStyle.verticalGap;

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
        parentNodeId: parentNodeId, // O(1) parent lookup
        text: text,
        children: [],
        markdown: `${generateUuid()}.md`,
        images: [imageName],
        position: { x: initialX, y: initialY },
      };
      parentNode.children.push(newNode);
      nodeMap.value.set(newNode.id, newNode); // Add to nodeMap
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

    const settingsStore = useSettingsStore();
    const HORIZONTAL_GAP = settingsStore.settings.layoutStyle.horizontalGap;
    const VERTICAL_GAP = settingsStore.settings.layoutStyle.verticalGap;

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
        parentNodeId: parentNode.id, // O(1) parent lookup
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
        nodeMap.value.set(newNode.id, newNode); // Add to nodeMap
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

  // Action: 删除节点 (支持批量删除)
  const deleteNode = (nodeId?: string) => {
    if (!rootNode.value) return;

    // If a specific node is requested (e.g. from context menu), delete only that one
    // Otherwise, delete all selected nodes
    const nodesToDeleteIds = nodeId ? [nodeId] : [...selectedNodeIds.value];

    if (nodesToDeleteIds.length === 0) return;

    // Filter out root node if attempted to delete
    const validIdsToDelete = nodesToDeleteIds.filter(id => id !== rootNode.value?.id);

    if (validIdsToDelete.length === 0) {
      console.warn("Cannot delete the root node or no valid nodes to delete.");
      return;
    }

    pushState(); // Save state before modification

    const fileStore = useFileStore();
    const currentRoot = rootNode.value;
    let parentOfLastDeleted: MindmapNode | null = null;

    // Helper to delete a single node
    const deleteSingleNode = (targetId: string) => {
      const nodesToDelete: MindmapNode[] = [];

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
            parentOfLastDeleted = parent;
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

      if (findAndCollect(currentRoot, targetId, null)) {
        // 3. 遍历所有被删除的节点，清理它们的资源
        for (const node of nodesToDelete) {
          // a. Remove from nodeMap
          nodeMap.value.delete(node.id);
          // b. 清理 Markdown 内容
          if (node.markdown) {
            fileStore.deleteMarkdownContent(node.markdown);
            fileStore.deleteTempFile(`text/${node.markdown}`);
          }
          // c. 清理图片文件
          if (node.images && node.images.length > 0) {
            for (const imageName of node.images) {
              fileStore.deleteTempFile(`images/${imageName}`);
            }
          }
        }
      }
    };

    // Execute deletion for all targets
    // Sort by depth or process carefully to avoid issues if deleting parent and child together
    // Actually, if we delete a parent, the child is gone too. 
    // So we should check if a node still exists before trying to delete it.
    for (const id of validIdsToDelete) {
      console.log(`Attempting to delete node: ${id}`);
      // Check if node still exists (it might have been deleted as a child of a previous node)
      const { node } = findNodeAndParent(id, currentRoot);
      if (node) {
        console.log(`Node ${id} found, deleting...`);
        deleteSingleNode(id);
      } else {
        console.log(`Node ${id} not found (already deleted?)`);
      }
    }

    debouncedApplyLayout(); // Apply layout after deleting
    fileStore.markAsUnsaved();

    // Update selection
    // If we deleted the selected nodes, try to select the parent of the last deleted node
    // or clear selection if nothing makes sense
    const remainingSelected = selectedNodeIds.value.filter(id => {
      const { node } = findNodeAndParent(id, currentRoot);
      return !!node;
    });

    if (remainingSelected.length > 0) {
      selectedNodeIds.value = remainingSelected;
    } else if (parentOfLastDeleted) {
      selectNode((parentOfLastDeleted as any).id);
    } else {
      selectedNodeIds.value = [];
    }

    // If the deleted node was the temporary view root, reset to the actual root
    // Check if viewRoot still exists
    if (viewRootNodeId.value) {
      const { node } = findNodeAndParent(viewRootNodeId.value, currentRoot);
      if (!node && rootNode.value) {
        setViewRoot(rootNode.value.id);
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

      // Update parentNodeId for O(1) lookup
      movedNode.parentNodeId = newParentId;

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

  // --- Clipboard Operations ---
  const clipboard = ref<{
    nodeId: string;
    action: "copy" | "cut";
  } | null>(null);

  const copyNode = async () => {
    if (!primarySelectedNodeId.value || !rootNode.value) return;
    const { node } = findNodeAndParent(primarySelectedNodeId.value, rootNode.value);
    if (node) {
      clipboard.value = { nodeId: node.id, action: "copy" };
      try {
        await navigator.clipboard.writeText(node.text);
      } catch (err) {
        console.error("Failed to copy to system clipboard", err);
      }
      ElMessage.success("Node copied");
    }
  };

  const cutNode = async () => {
    if (!primarySelectedNodeId.value || !rootNode.value) return;
    // Don't cut root
    if (primarySelectedNodeId.value === rootNode.value.id) {
      ElMessage.warning("Cannot cut root node");
      return;
    }

    const { node } = findNodeAndParent(primarySelectedNodeId.value, rootNode.value);
    if (node) {
      clipboard.value = { nodeId: node.id, action: "cut" };
      try {
        await navigator.clipboard.writeText(node.text);
      } catch (err) {
        console.error("Failed to copy to system clipboard", err);
      }
      ElMessage.success("Node cut");
    }
  };

  const pasteClipboard = async () => {
    if (!rootNode.value) return;
    const targetId = primarySelectedNodeId.value || rootNode.value.id;
    const { node: targetNode } = findNodeAndParent(targetId, rootNode.value);
    if (!targetNode) return;

    try {
      const fileStore = useFileStore();

      // 1. Check for Image Items first (System Clipboard)
      // Accessing clipboard items for images
      try {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
          if (item.types.some(type => type.startsWith('image/'))) {
            const blob = await item.getType(item.types.find(t => t.startsWith('image/'))!);
            const reader = new FileReader();
            reader.onload = async (e) => {
              const base64 = e.target?.result as string;
              if (base64) {
                const imageName = await fileStore.handleImagePaste(base64, targetId);
                // Need to add child node with this image OR add to current node?
                // Requirement: "新建图片子节点" (Create new image child node)
                addChildNodeWithImage(targetId, imageName, "Pasted Image");
              }
            };
            reader.readAsDataURL(blob);
            return; // Priority to image
          }
        }
      } catch (e) {
        // Firefox or some envs might not support read() fully or permission denied
        // Fallback to text
      }

      // 2. Check Text (System Clipboard)
      const text = await navigator.clipboard.readText();
      if (!text) return;

      // 3. Internal Node Paste Check
      // If clboard state exists AND its text matches system clipboard, prioritize internal paste
      let handledInternal = false;
      if (clipboard.value) {
        const { node: sourceNode } = findNodeAndParent(clipboard.value.nodeId, rootNode.value);
        // If source node still exists (might have been deleted)
        if (sourceNode && sourceNode.text === text) {
          handledInternal = true;
          pushState();

          if (clipboard.value.action === 'copy') {
            // Deep clone
            const cloneNode = (n: MindmapNode): MindmapNode => {
              return {
                ...n,
                id: generateUuid(),
                children: n.children.map(cloneNode),
                // We should probably duplicate markdown content too? 
                // For now, new UUID means empty markdown unless we copy content.
                // Let's copy content if we can.
                markdown: `${generateUuid()}.md`
                // Images? They are references. Keeping them is fine.
              };
            };

            // Helper to copy markdown content for the cloned tree
            const copyContentRec = (original: MindmapNode, cloned: MindmapNode) => {
              const content = fileStore.getMarkdownContent(original.markdown);
              if (content) {
                fileStore.setMarkdownContent(cloned.markdown, content);
              }
              for (let i = 0; i < original.children.length; i++) {
                copyContentRec(original.children[i], cloned.children[i]);
              }
            };

            const newData = cloneNode(sourceNode);
            copyContentRec(sourceNode, newData);

            // Reset position (will be handled by layout)
            // Insert as child
            targetNode.children.push(newData);
            debouncedApplyLayout();
            selectAndPanToNode(newData.id);
            fileStore.markAsUnsaved();

          } else if (clipboard.value.action === 'cut') {
            // Move
            // Validate circular
            if (isAncestor(sourceNode.id, targetNode.id, rootNode.value)) {
              ElMessage.error("Cannot move node into its own descendant");
              return;
            }
            reparentNode(sourceNode.id, targetNode.id);
            clipboard.value = null; // Clear after cut-paste
          }
        }
      }

      if (handledInternal) return;

      // 4. Text Paste Parsing
      pushState();

      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');

      // Helper to count indentation level (tabs or 4 spaces?)
      // Requirement: "if starts with tab, make it child of previous"
      // Let's assume strict tab or standard indentation logic.

      // Stack to track parents at each level. index 0 = targetNode.
      const parentStack: { node: MindmapNode, level: number }[] = [{ node: targetNode, level: -1 }];

      lines.forEach((line) => {
        // Calculate level
        let level = 0;
        const match = line.match(/^(\t+)/);
        if (match) {
          level = match[1].length;
        } else {
          // If spaces? Requirement said "if starts with tab".
          // But let's check for 4 spaces = 1 tab fallback if desired? 
          // Strict compliance: check tabs.
        }

        const trimmedText = line.trim();
        if (!trimmedText) return;

        // Find valid parent from stack
        // We want parent with level = currentLevel - 1
        // If currentLevel > lastLevel + 1, it's just a child of lastLevel anyway (skip levels).

        // Basic logic:
        // if level > currentStackTop.level: push new item as child of stackTop
        // if level <= currentStackTop.level: pop stack until finding parent with level < currentLevel

        // Wait, standard indentation logic:
        // Root (0)
        //   Child (1)

        // Our starting point is TargetNode (Level -1 effectively, as base)
        // Input line level 0 (no tabs) -> Child of Target
        // Input line level 1 (1 tab) -> Child of previous line

        // Adjust stack logic:
        // We maintain a stack of the *last added node* at each level.
        // Stack[0] = targetNode (base)

        // Actually simpler:
        // We keep a `lastNode` reference?
        // "if starts with tab, make it child of previous" -> only 1 level deeper?
        // "recurse"?
        // Let's support multi-level indents.

        // Example:
        // A
        // \t B
        // \t C
        // \t\t D
        // E

        // Stack:
        // -1: Target

        // Line A (0): Parent Stack item where level < 0? No, parent is stack top if stack top level < 0.
        // Let's strictly enforce: Parent for Level N is the last node at Level N-1.

        // Normalize level: Ensure we have a parent.
        // If stack top level >= current level, pop.
        while (parentStack.length > 1 && parentStack[parentStack.length - 1].level >= level) {
          parentStack.pop();
        }

        const parent = parentStack[parentStack.length - 1].node;

        const newNode: MindmapNode = {
          id: generateUuid(),
          parentNodeId: parent.id, // O(1) parent lookup
          text: trimmedText,
          children: [],
          markdown: `${generateUuid()}.md`,
          images: [],
          position: { x: 0, y: 0 } // Layout will fix
        };

        parent.children.push(newNode);
        nodeMap.value.set(newNode.id, newNode); // Add to nodeMap
        fileStore.setMarkdownContent(newNode.markdown, "");

        // Push to stack as potential parent for next level (Level + 1 candidate)
        // But wait, the level in stack should correspond to the node's level?
        // Yes.
        parentStack.push({ node: newNode, level: level });
      });

      debouncedApplyLayout();
      fileStore.markAsUnsaved();
      ElMessage.success("Text pasted");

    } catch (err) {
      console.error("Paste failed", err);
    }
  };

  return {
    // State
    rootNode,
    selectedNodeId: primarySelectedNodeId, // Backward compatibility alias if needed, or just use primary
    selectedNodeIds,
    pinnedNodeIds,
    viewRootNodeId,
    collapsedNodeIds,
    panTargetNodeId,
    nodeDimensions,

    // Getters
    allNodes,
    selectedNode,
    selectedNodes,
    currentNodePath,

    past,
    future,
    setMindmapData,
    selectNode,
    toggleNodeSelection,
    addNodeToSelection,
    clearSelection,
    selectRange,
    selectAndPanToNode,
    setViewRoot,
    applyLayout,
    debouncedApplyLayout,
    setNodeDimensions,
    addChildNode,
    addSiblingNode,
    addChildNodeWithImage,
    addSiblingNodeWithImage, // Ensure this is exported
    addImageToNode, // Exported
    updateNodeText,
    deleteNode,
    undo,
    redo,
    togglePin,
    findNodeAndParent,
    cutNode,
    copyNode, // Added copyNode
    pasteClipboard,
    toggleNodeCollapse, // Added
    setNodeDraggable,   // Added
    // Drag and Drop / Utils
    getAllDescendants,
    reparentNode,
    reorderNode,
    setNodePosition,
    setDragging, // Optimization: skip layout during drag
    // O(1) lookup helpers
    getNodeById,
    getParentNode,
    nodeMap, // Expose for debugging/external use if needed
  };
});
