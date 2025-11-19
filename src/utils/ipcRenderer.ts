// src/utils/ipcRenderer.ts
// 渲染进程调用主进程的封装
import { IPC_EVENTS } from '../types/shared_types';

interface ElectronAPI {
  invoke: (channel: string, ...args: any[]) => Promise<any>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export const ipcRenderer = (() => {
  if (window.electronAPI) {
    return {
      ...window.electronAPI,
      minimizeWindow: () => window.electronAPI.invoke(IPC_EVENTS.WINDOW_MINIMIZE),
      maximizeWindow: () => window.electronAPI.invoke(IPC_EVENTS.WINDOW_MAXIMIZE),
      closeWindow: () => window.electronAPI.invoke(IPC_EVENTS.WINDOW_CLOSE),
    };
  } else {
    console.error('Electron API not exposed on window.electronAPI. Are you running in a non-Electron environment or is preload.js failing?');
    // Return a mock object to prevent errors in renderer process
    return {
      invoke: (channel: string, ...args: any[]) => {
        console.error(`Attempted to invoke IPC channel '${channel}' but Electron API is not available.`);
        return Promise.reject(new Error('Electron API not available'));
      },
      minimizeWindow: () => { console.warn('minimizeWindow called in non-Electron environment'); return Promise.resolve(); },
      maximizeWindow: () => { console.warn('maximizeWindow called in non-Electron environment'); return Promise.resolve(); },
      closeWindow: () => { console.warn('closeWindow called in non-Electron environment'); return Promise.resolve(); },
    };
  }
})();

