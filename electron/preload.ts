import { contextBridge, ipcRenderer } from 'electron';

// 暴露安全的 IPC 接口给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void) =>
    ipcRenderer.on(channel, listener),
  off: (channel: string, listener: (event: Electron.IpcRendererEvent, ...args: any[]) => void) =>
    ipcRenderer.removeListener(channel, listener),
});
