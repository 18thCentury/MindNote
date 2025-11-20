// E:\Project\JS\mindnote\todo\shared_types.ts

/**
 * Represents a single node in the Mindmap.
 */
export interface MindmapNode {
  id: string; // Unique identifier for the node (UUID)
  text: string; // Display text of the node
  children: MindmapNode[]; // Array of child nodes
  markdown: string; // File name of the associated Markdown content (e.g., "uuid.md")
  images: string[]; // Array of image file names associated with the node (e.g., "img1.png")
  // Add properties for node styling (e.g., color, shape, size)
  // These will be used by vue-flow for rendering and can be customized.
  style?: {
    backgroundColor?: string;
    borderColor?: string;
    borderRadius?: number;
    // Add more styling properties as needed
  };
  position?: {
    x: number;
    y: number;
  };
  type?: string; // e.g., 'root', 'default', 'child' for custom node types
}

/**
 * Represents the overall structure of a Mindmap, including its nodes and metadata.
 */
export interface MindmapData {
  rootNode: MindmapNode;
  // Potentially add other mindmap-level metadata here, e.g.,
  // lastModified: string;
  // version: number;
}

/**
 * Defines the structure for the .mn file format's map.json.
 */
export interface MapJsonSchema {
  mindmap: MindmapData;
  // Other properties that might be in map.json
  // e.g., editorSettings: { ... }
}

/**
 * Defines the IPC event channels used for communication between
 * the Electron main process and renderer process.
 */
export enum IPC_EVENTS {
  // File operations
  FILE_OPEN = "file:open",
  FILE_SAVE = "file:save",
  FILE_SAVE_AS = "file:save-as",
  FILE_NEW = "file:new",
  FILE_CLOSE = "file:close",
  // Image handling
  IMAGE_SAVE = "image:save", // For saving pasted images
  // UI/State updates from main to renderer
  UPDATE_FILE_STATUS = "update:file-status",
  UPDATE_CURRENT_FILE_PATH = "update:current-file-path",
  // Other potential events
  OPEN_IMAGE_DIALOG = "dialog:open-image",
  DELETE_TEMP_FILE = "delete:temp-file",
  GET_APP_VERSION = "get:app-version",
  // Window controls
  WINDOW_MINIMIZE = "window:minimize",
  WINDOW_MAXIMIZE = "window:maximize",
  WINDOW_CLOSE = "window:close",
}

/**
 * The payload for the FILE_SAVE IPC event.
 */
export interface FileSavePayload {
  filePath: string;
  tempDir: string;
  mindmapData: MindmapData;
  markdownContents: Record<string, string>; // A map of { nodeId: markdownContent }
}

/**
 * Represents the saving status of the current file.
 */
export enum FileStatus {
  SAVED = "已保存",
  UNSAVED = "未保存",
  SAVING = "保存中",
  ERROR = "保存失败",
  NONE = "无文件",
}

/**
 * Represents the state of the application's file information.
 */
export interface FileState {
  currentFilePath: string | null;
  currentFileName: string | null;
  fileStatus: FileStatus;
  isDirty: boolean; // Indicates if there are unsaved changes
}

/**
 * Represents the state of the application's UI.
 */
export interface UIState {
  selectedNodeId: string | null;
  pinnedNodeIds: string[]; // Array of node IDs that are pinned
  imageViewer: {
    visible: boolean;
    imageUrl: string | null;
  };
  // Add other UI-related states here
}

