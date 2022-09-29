import { Channels } from 'main/preload';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { dialog } from 'electron';

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        sendMessage(channel: Channels, args: unknown[]): void;
        on(
          channel: string,
          func: (...args: unknown[]) => void
        ): (() => void) | undefined;
        once(channel: string, func: (...args: unknown[]) => void): void;
      };
      fs: typeof fs;
      os: typeof os;
      path: typeof path;
      dialog: typeof dialog;
    };
  }
}

export {};
