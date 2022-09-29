// If you import a module but never use any of the imported values other than
// as TypeScript types, the resulting javascript file will look as if you never
// imported the module at all.
import { dialog } from 'electron';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let global: ElectronService | undefined;

export class ElectronService {
  dialog: typeof dialog;
  fs: typeof fs;
  os: typeof os;
  path: typeof path;

  constructor() {
    this.dialog = window.electron.dialog;
    this.fs = window.electron.fs;
    this.os = window.electron.os;
    this.path = window.electron.path;
  }

  static get current() {
    if (global === undefined) {
      global = new ElectronService();
    }
    return global;
  }
}
