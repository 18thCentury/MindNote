// src/stores/editorStore.ts
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useFileStore } from "./fileStore";
import { useMindmapStore } from "./mindmapStore";

export const useEditorStore = defineStore("editor", () => {
  const currentMarkdownContent = ref<string>(""); // 当前编辑器的 Markdown 内容
  const currentMarkdownNodeId = ref<string | null>(null); // 当前 Markdown 关联的节点ID
  const isTextInputActive = ref(false); // 是否有任何文本输入区域处于激活状态

  // Getter: 判断编辑器内容是否为空
  const isEmpty = computed(() => currentMarkdownContent.value.trim() === "");

  // Action: 设置是否有文本输入激活
  const setTextInputActive = (active: boolean) => {
    isTextInputActive.value = active;
  };

  // Action: 设置 Markdown 内容
  const setMarkdownContent = (content: string, nodeId: string) => {
    currentMarkdownContent.value = content;
    currentMarkdownNodeId.value = nodeId;
  };

  // Action: 更新 Markdown 内容（用户输入）
  const updateMarkdownContent = (content: string) => {
    currentMarkdownContent.value = content;

    try {
      // 触发文件保存状态更新
      const fileStore = useFileStore();
      if (currentMarkdownNodeId.value) {
        const mindmapStore = useMindmapStore();
        const node = mindmapStore.allNodes.find(
          (n) => n.id === currentMarkdownNodeId.value,
        );
        if (node) {
          fileStore.setMarkdownContent(node.markdown, content);
        }
      }
    } catch (error) {
      console.error("Failed to updateMarkdownContent:", error);
      throw error;
    }
  };

  return {
    currentMarkdownContent,
    currentMarkdownNodeId,
    isTextInputActive,
    isEmpty,
    setMarkdownContent,
    updateMarkdownContent,
    setTextInputActive,
  };
});
