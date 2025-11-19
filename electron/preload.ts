import { contextBridge, ipcRenderer } from 'electron';

// 暴露安全的 IPC 接口给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
  // 可以根据需要暴露更多 IPC 方法
});
