import { defineStore } from 'pinia';
import type { UIState } from '@/types/shared_types';

export const useUIStore = defineStore('ui', {
  state: (): UIState => ({
    selectedNodeId: null,
    pinnedNodeIds: [],
  }),

  actions: {
    setSelectedNode(nodeId: string | null) {
      this.selectedNodeId = nodeId;
    },

    addPinnedNode(nodeId: string) {
      if (!this.pinnedNodeIds.includes(nodeId)) {
        this.pinnedNodeIds.push(nodeId);
      }
    },

    removePinnedNode(nodeId: string) {
      this.pinnedNodeIds = this.pinnedNodeIds.filter(id => id !== nodeId);
    },

    togglePinnedNode(nodeId: string) {
        if (this.pinnedNodeIds.includes(nodeId)) {
            this.removePinnedNode(nodeId);
        } else {
            this.addPinnedNode(nodeId);
        }
    }
  },
});
