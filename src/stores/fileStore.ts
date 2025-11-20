// src/stores/fileStore.ts
import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { ipcRenderer } from "../utils/ipcRenderer"; // 封装的 IPC 通信
import { useMindmapStore } from "./mindmapStore";
import { useEditorStore } from "./editorStore";
import { IPC_EVENTS, FileSavePayload } from "@/types/shared_types";
import { ElMessage } from "element-plus";
import { generateUuid } from "../utils/uuid"; // Import uuid generator

export type SaveStatus = "saved" | "unsaved" | "saving" | "error";

export const useFileStore = defineStore("file", () => {
  const currentFilePath = ref<string | null>(null); // 当前打开的 .mn 文件路径
  const saveStatus = ref<SaveStatus>("saved"); // 文件保存状态
  const tempDir = ref<string | null>(null); // 解压后的临时目录路径
  const allMarkdownContents = ref<Record<string, string>>({}); // 所有加载的 Markdown 内容

  // Getter: 判断文件是否已打开
  const isFileOpen = computed(() => currentFilePath.value !== null);

  // Getter: 根据文件名获取 Markdown 内容
  const getAllMarkdownContent = () => {
    return allMarkdownContents.value;
  };
  const setAllMarkdownContent = (contents: Record<string, string>) => {
    allMarkdownContents.value = contents;
  };

  // Getter: 根据文件名获取 Markdown 内容
  const getMarkdownContent = (filename: string) => {
    return allMarkdownContents.value[filename] || "";
  };
  const setMarkdownContent = (filename: string, value: string) => {
    allMarkdownContents.value[filename] = value;
  };
  const deleteMarkdownContent = (filename: string) => {
    delete allMarkdownContents.value[filename];
  };

  // Action: 打开 .mn 文件
  const openMnFile = async () => {
    saveStatus.value = "saving"; // 模拟加载状态
    try {
      const { filePath, tempDirPath, mindmapData, markdownFiles } =
        await ipcRenderer.invoke(IPC_EVENTS.FILE_OPEN);
      tempDir.value = tempDirPath;
      currentFilePath.value = filePath;
      allMarkdownContents.value = markdownFiles; // Store all markdown contents

      // 将 mindmapData 设置到 mindmapStore
      const mindmapStore = useMindmapStore();
      mindmapStore.setMindmapData(mindmapData.rootNode);
      saveStatus.value = "saved";
    } catch (error) {
      console.error("Failed to open .mn file:", error);
      saveStatus.value = "error";
      throw error;
    }
  };

  // Action: 保存当前文件
  const saveCurrentFile = async () => {
    if (!currentFilePath.value || !tempDir.value) return;
    saveStatus.value = "saving";
    try {
      const mindmapStore = useMindmapStore();
      const editorStore = useEditorStore();

      // 1. 确保最新的编辑器内容被同步到 allMarkdownContents
      //
      if (editorStore.currentMarkdownNodeId) {
        const node = mindmapStore.allNodes.find(
          (n) => n.id === editorStore.currentMarkdownNodeId,
        );
        if (node) {
          allMarkdownContents.value[node.markdown] =
            editorStore.currentMarkdownContent;
        }
      }

      // 2. 构建 FileSavePayload (确保符合接口定义)
      const payload: FileSavePayload = {
        filePath: currentFilePath.value,
        tempDir: tempDir.value,
        mindmapData: {
          // 关键修复点：符合 MindmapData 接口
          rootNode: JSON.parse(JSON.stringify(mindmapStore.rootNode!)),
        },
        markdownContents: JSON.parse(JSON.stringify(allMarkdownContents.value)),
      };

      // 3. 调用 IPC 并传递单个 payload 对象
      await ipcRenderer.invoke(IPC_EVENTS.FILE_SAVE, payload);

      saveStatus.value = "saved";
    } catch (error) {
      console.error("Failed to save .mn file:", error);
      saveStatus.value = "error";
      throw error;
    }
  };

  // Action: 标记为未保存
  const markAsUnsaved = () => {
    if (saveStatus.value === "saved") {
      saveStatus.value = "unsaved";
    }
  };

  // Action: 处理图片粘贴
  const handleImagePaste = async (base64Data: string, nodeId: string) => {
    if (!tempDir.value) return;
    try {
      const imageName = await ipcRenderer.invoke(
        IPC_EVENTS.IMAGE_SAVE,
        tempDir.value,
        base64Data,
      );
      // 更新 mindmapStore 中对应节点的 images 列表
      const mindmapStore = useMindmapStore();
      const node = mindmapStore.allNodes.find((n) => n.id === nodeId);
      if (node) {
        node.images.push(imageName);
      }
      markAsUnsaved();
      return imageName; // 返回图片文件名，供编辑器使用
    } catch (error) {
      console.error("Failed to save pasted image:", error);
      throw error;
    }
  };

  // Action: 保存拖放的图片
  const saveDroppedImage = async (file: File): Promise<string> => {
    if (!tempDir.value) throw new Error("No file open");
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64Data = e.target?.result as string;
          const imageName = await ipcRenderer.invoke(
            IPC_EVENTS.IMAGE_SAVE,
            tempDir.value,
            base64Data,
          );
          resolve(imageName);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  // Action: 创建新文件
  const createNewFile = async () => {
    try {
      const result = await ipcRenderer.invoke(IPC_EVENTS.FILE_NEW);

      // If user cancels the save dialog, result will be null
      if (!result) {
        return;
      }

      if (result.success) {
        // This logic is now very similar to opening a file
        currentFilePath.value = result.filePath;
        tempDir.value = result.tempDirPath;
        allMarkdownContents.value = result.markdownFiles;

        const mindmapStore = useMindmapStore();
        mindmapStore.setMindmapData(result.mindmapData.rootNode);

        const editorStore = useEditorStore();
        editorStore.setMarkdownContent(
          result.markdownFiles[result.mindmapData.markdown],
          result.mindmapData.id,
        );

        saveStatus.value = "saved"; // The file is saved on creation
        ElMessage.success(`New mindmap created at ${result.filePath}`);
      } else {
        throw new Error("Failed to get new file data from main process.");
      }
    } catch (error) {
      console.error("Failed to create new file:", error);
      ElMessage.error("Failed to create new mindmap.");
      throw error;
    }
  };

  // Action: 另存为
  const saveCurrentFileAs = async () => {
    if (!tempDir.value) return; // Cannot save as if no file is open
    saveStatus.value = "saving";
    try {
      const mindmapStore = useMindmapStore();
      const editorStore = useEditorStore();

      if (editorStore.currentMarkdownNodeId) {
        const node = mindmapStore.allNodes.find(
          (n) => n.id === editorStore.currentMarkdownNodeId,
        );
        if (node) {
          allMarkdownContents.value[node.markdown] =
            editorStore.currentMarkdownContent;
        }
      }

      const result = await ipcRenderer.invoke(
        IPC_EVENTS.FILE_SAVE_AS,
        tempDir.value,
        JSON.parse(JSON.stringify(mindmapStore.rootNode)),
        JSON.parse(JSON.stringify(allMarkdownContents.value)),
      );

      if (result && result.success && result.filePath) {
        currentFilePath.value = result.filePath; // Update to the new file path
        saveStatus.value = "saved";
      } else {
        // User cancelled Save As dialog
        saveStatus.value = "unsaved"; // Revert status
      }
    } catch (error) {
      console.error("Failed to save file as:", error);
      saveStatus.value = "error";
      throw error;
    }
  };

  // Action: 删除临时目录中的文件
  const deleteTempFile = async (relativeFilePath: string) => {
    if (!tempDir.value) return;
    try {
      await ipcRenderer.invoke(IPC_EVENTS.DELETE_TEMP_FILE, relativeFilePath);
    } catch (error) {
      console.error(`Failed to request deletion of temp file: ${relativeFilePath}`, error);
      // Do not throw error up, as this is a cleanup task, not critical for user flow
      ElMessage.error(`Could not delete associated file: ${relativeFilePath}`);
    }
  };

  return {
    currentFilePath,
    saveStatus,
    tempDir,
    isFileOpen,
    openMnFile,
    saveCurrentFile,
    saveCurrentFileAs, // Expose new action
    markAsUnsaved,
    handleImagePaste,
    createNewFile,
    getMarkdownContent, // Expose the getter
    setMarkdownContent,
    deleteMarkdownContent,
    getAllMarkdownContent,
    deleteTempFile, // Expose the new action
    saveDroppedImage, // Expose new action
  };
});
