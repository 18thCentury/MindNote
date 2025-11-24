import { app, BrowserWindow, ipcMain, dialog, protocol } from "electron";
import path from "node:path";
import fs from "fs/promises";
import * as fsStandard from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import * as fileOperations from "./fileOperations.js";
import {
  IPC_EVENTS,
  MindmapNode,
  FileSavePayload,
} from "../src/types/shared_types.js"; // Import IPC_EVENTS

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null;
let activeTempDir: string | null = null;

async function cleanupActiveTempDir() {
  if (activeTempDir) {
    try {
      await fs.rm(activeTempDir, { recursive: true, force: true });
      //console.log(`Cleaned up temp directory: ${activeTempDir}`);
    } catch (error) {
      console.error(
        `Failed to clean up temp directory: ${activeTempDir}`,
        error,
      );
    }
    activeTempDir = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false, // Set to false to remove the default window frame
    titleBarStyle: "hidden", // Hide the title bar but keep traffic light controls on macOS
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Sandbox must be false to use node fs in preload
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  protocol.handle("mn-asset", (request) => {
    if (!activeTempDir) {
      console.error("Protocol 'mn-asset': activeTempDir is not set.");
      return new Response("Error: Temporary directory not available.", {
        status: 500,
      });
    }
    const url = request.url.slice("mn-asset://".length);
    const filePath = path.join(activeTempDir, url);

    // Security check: Ensure the requested path is within the active temp directory
    if (!filePath.startsWith(activeTempDir)) {
      console.error(
        `Protocol 'mn-asset': Security violation. Attempted to access path outside of temp dir: ${filePath}`,
      );
      return new Response("Error: Access denied.", { status: 403 });
    }

    try {
      // Use a file URL for the response to handle special characters in the path
      return new Response(fsStandard.createReadStream(filePath));
    } catch (error) {
      console.error(
        `Protocol 'mn-asset': Failed to read file at ${filePath}`,
        error,
      );
      return new Response("Error: File not found.", { status: 404 });
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on("will-quit", async (event) => {
  event.preventDefault();
  await cleanupActiveTempDir();
  app.exit();
});

// --- IPC Main Handlers ---

// Corresponds to FILE_OPEN
ipcMain.handle(IPC_EVENTS.FILE_OPEN, async (event) => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openFile"],
      filters: [{ name: "MindNote Files", extensions: ["mn"] }],
    });
    if (canceled || filePaths.length === 0) {
      return null; // User canceled the dialog
    }
    const finalFilePath = filePaths[0];

    // Clean up previous session's temp dir before opening a new one
    await cleanupActiveTempDir();

    const { tempDirPath, mindmapData, markdownFiles } =
      await fileOperations.unpackMnFile(finalFilePath);

    // Track the new temp directory
    activeTempDir = tempDirPath;

    return { filePath: finalFilePath, tempDirPath, mindmapData, markdownFiles };
  } catch (error) {
    console.error("Main process: Failed to open .mn file", error);
    // If opening fails, ensure we don't leave a new temp dir hanging
    await cleanupActiveTempDir();
    throw error;
  }
});

// Corresponds to FILE_SAVE
ipcMain.handle(
  IPC_EVENTS.FILE_SAVE,
  async (event, payload: FileSavePayload) => {
    const { filePath, tempDir, mindmapData, markdownContents } = payload;
    try {
      await fileOperations.packMnFile(
        filePath,
        tempDir,
        mindmapData, // 直接传递 mindmapData，因为 packMnFile 现在期望 MindmapData 类型
        markdownContents,
      );
      return { success: true };
    } catch (error) {
      console.error("x Failed to save file:", error);
      throw error;
    }
  },
);

// Corresponds to IMAGE_SAVE
ipcMain.handle(
  IPC_EVENTS.IMAGE_SAVE,
  async (event, tempDirPath: string, base64Data: string) => {
    try {
      const imageName = await fileOperations.saveImage(tempDirPath, base64Data);
      return imageName;
    } catch (error) {
      console.error("Main process: Failed to save image", error);
      throw error;
    }
  },
);

// Placeholder for FILE_SAVE_AS
ipcMain.handle(
  IPC_EVENTS.FILE_SAVE_AS,
  async (
    event,
    tempDir: string,
    mindmapData: any,
    markdownFiles: Record<string, string>,
  ) => {
    try {
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow!, {
        filters: [{ name: "MindNote Files", extensions: ["mn"] }],
      });

      if (canceled || !filePath) {
        return null; // User canceled
      }

      // await fileOperations.packMnFile(
      //   filePath,
      //   tempDir,
      //   mindmapData,
      //   markdownFiles,
      // );
      return { success: true, filePath };
    } catch (error) {
      console.error("Failed to save file as:", error);
      throw error;
    }
  },
);

// Placeholder for FILE_NEW
ipcMain.handle(IPC_EVENTS.FILE_NEW, async () => {
  if (!mainWindow) return null;
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "Create New Mindmap",
      defaultPath: "MyMindmap.mn",
      filters: [{ name: "MindNote Files", extensions: ["mn"] }],
    });

    if (canceled || !filePath) {
      return null;
    }

    // Clean up previous session's temp dir
    await cleanupActiveTempDir();

    const { mindmapData, markdownFiles } =
      await fileOperations.createDefaultMindmapData();

    const tempPackDir = await fs.mkdtemp(
      path.join(app.getPath("temp"), "mindnote_pack-"),
    );

    try {
      await fileOperations.packMnFile(
        filePath,
        tempPackDir,
        mindmapData,
        markdownFiles,
      );
    } finally {
      await fs.rm(tempPackDir, { recursive: true, force: true });
    }

    const openedFileData = await fileOperations.unpackMnFile(filePath);

    // Track the new temp directory for the newly created and opened file
    activeTempDir = openedFileData.tempDirPath;

    return { success: true, filePath, ...openedFileData };
  } catch (error) {
    console.error("Failed to create new file:", error);
    await cleanupActiveTempDir(); // Clean up if something went wrong
    throw error;
  }
});

// Placeholder for FILE_CLOSE
ipcMain.handle(IPC_EVENTS.FILE_CLOSE, async () => {
  // Logic to handle closing a file, e.g., checking for unsaved changes
  //console.log("Handling FILE_CLOSE");
  await cleanupActiveTempDir();
  return { success: true };
});

// Corresponds to DELETE_TEMP_FILE
ipcMain.handle(
  IPC_EVENTS.DELETE_TEMP_FILE,
  async (event, relativeFilePath: string) => {
    if (!activeTempDir) {
      throw new Error("Cannot delete file: No active temporary directory.");
    }

    // Security check: ensure the path is confined within the temp directory
    const fullPath = path.join(activeTempDir, relativeFilePath);
    if (!fullPath.startsWith(activeTempDir)) {
      throw new Error(
        "Security violation: Attempted to delete a file outside the temporary directory.",
      );
    }

    try {
      await fs.rm(fullPath, { force: true });
      return { success: true };
    } catch (error) {
      console.error(`Failed to delete temp file: ${fullPath}`, error);
      throw error;
    }
  },
);

// Placeholder for GET_APP_VERSION
ipcMain.handle(IPC_EVENTS.GET_APP_VERSION, () => {
  return app.getVersion();
});

// Corresponds to OPEN_IMAGE_DIALOG
ipcMain.handle(IPC_EVENTS.OPEN_IMAGE_DIALOG, async (event, tempDir: string) => {
  if (!mainWindow) return null;
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif"] }],
    });

    if (canceled || filePaths.length === 0) {
      return null;
    }

    const sourcePath = filePaths[0];
    const fileName = path.basename(sourcePath);
    const imagesDir = path.join(tempDir, "images");
    const destPath = path.join(imagesDir, fileName);

    // Ensure the images directory exists
    await fs.mkdir(imagesDir, { recursive: true });

    // Copy the file
    await fs.copyFile(sourcePath, destPath);

    // Return the filename to be stored in the mindmap node
    return fileName;
  } catch (error) {
    console.error("Failed to open and copy image:", error);
    throw error;
  }
});

// Window control IPC handlers
ipcMain.handle(IPC_EVENTS.WINDOW_MINIMIZE, () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle(IPC_EVENTS.WINDOW_MAXIMIZE, () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle(IPC_EVENTS.WINDOW_CLOSE, () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

// --- Settings IPC Handlers ---

ipcMain.handle(IPC_EVENTS.SETTINGS_READ, async () => {
  const settingsPath = path.join(app.getPath("userData"), "settings.json");
  try {
    const data = await fs.readFile(settingsPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist or error, return null (renderer will use defaults)
    return null;
  }
});

ipcMain.handle(IPC_EVENTS.SETTINGS_WRITE, async (event, settings: any) => {
  const settingsPath = path.join(app.getPath("userData"), "settings.json");
  try {
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
    return { success: true };
  } catch (error) {
    console.error("Failed to save settings:", error);
    throw error;
  }
});

// Test that the main process can receive messages from the renderer process
ipcMain.on("ping", () => console.log("pong"));

