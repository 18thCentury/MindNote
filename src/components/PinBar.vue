<script setup lang="ts">
import { computed } from 'vue';
import { useMindmapStore } from '../stores/mindmapStore';
import { ElTag, ElButton } from 'element-plus';

const mindmapStore = useMindmapStore();

// Computed property for descendant nodes that are pinned
const otherPinnedNodes = computed(() => {
  if (!mindmapStore.rootNode) return [];

  return mindmapStore.pinnedNodeIds
    .filter(nodeId => nodeId !== mindmapStore.rootNode?.id)
    .map(nodeId => {
      const { node } = mindmapStore.findNodeAndParent(nodeId, mindmapStore.rootNode);
      return node ? { id: nodeId, text: node.text } : null;
    })
    .filter(Boolean) as { id: string; text: string }[];
});

const handlePinClick = (nodeId: string) => {
  mindmapStore.setViewRoot(nodeId); // Set the clicked pin as the view root
};

const handleClosePin = (nodeId: string) => {
  const wasCurrentViewRoot = mindmapStore.viewRootNodeId === nodeId;
  
  mindmapStore.togglePin(nodeId); // Remove Pin

  if (wasCurrentViewRoot && mindmapStore.rootNode) {
    mindmapStore.setViewRoot(mindmapStore.rootNode.id);
  }
};
</script>

<template>
  <div class="pin-bar-container">
    <!-- Permanent Root Node Pin -->
    <el-tag
      v-if="mindmapStore.rootNode"
      :key="mindmapStore.rootNode.id"
      :closable="false"
      @click="handlePinClick(mindmapStore.rootNode.id)"
      class="pin-tag"
      :type="mindmapStore.rootNode.id === mindmapStore.viewRootNodeId ? 'success' : 'info'"
      effect="light"
    >
      {{ mindmapStore.rootNode.text }}
    </el-tag>

    <!-- Other Closable Pins -->
    <el-tag
      v-for="pin in otherPinnedNodes"
      :key="pin.id"
      closable
      @click="handlePinClick(pin.id)"
      @close="handleClosePin(pin.id)"
      class="pin-tag"
      :type="pin.id === mindmapStore.viewRootNodeId ? 'success' : 'info'"
      effect="light"
    >
      {{ pin.text }}
    </el-tag>

    <!-- Pin Current Button -->
    <el-button
      v-if="mindmapStore.selectedNodeId && !mindmapStore.pinnedNodeIds.includes(mindmapStore.selectedNodeId) && mindmapStore.selectedNodeId !== mindmapStore.rootNode?.id"
      size="small"
      text
      @click="mindmapStore.togglePin(mindmapStore.selectedNodeId!)"
    >
      Pin Current
    </el-button>
  </div>
</template>

<style lang="scss" scoped>
.pin-bar-container {
  display: flex;
  gap: 8px;
  align-items: center;
}
.pin-tag {
  cursor: pointer;
}
</style>