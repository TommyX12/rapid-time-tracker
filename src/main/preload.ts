import {
  contextBridge,
  ipcRenderer,
  IpcRendererEvent,
  OpenDialogOptions,
  OpenDialogSyncOptions,
  SaveDialogOptions,
} from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export type Channels = 'ipc-example';

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    sendMessage(channel: Channels, args: unknown[]) {
      ipcRenderer.send(channel, args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => ipcRenderer.removeListener(channel, subscription);
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
  },
  fs,
  os,
  path,
  dialog: {
    showOpenDialogSync: (params: OpenDialogSyncOptions) =>
      ipcRenderer.invoke('showOpenDialogSync', params),
    showOpenDialog: (params: OpenDialogOptions) =>
      ipcRenderer.invoke('showOpenDialog', params),
    showSaveDialog: (params: SaveDialogOptions) =>
      ipcRenderer.invoke('showSaveDialog', params),
  },
});
