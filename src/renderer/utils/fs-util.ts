import { ElectronService } from './electron.service';

export class FsUtil {
  private get els() {
    return ElectronService.current;
  }

  get path() {
    return this.els.path;
  }

  homeDir() {
    return this.els.os.homedir();
  }

  readDirPathSync(defaultPath?: string) {
    const p = this.els.dialog.showOpenDialogSync({
      defaultPath,
      properties: ['openDirectory'],
    });
    if (p === undefined) return undefined;
    return p[0];
  }

  readFilePath(defaultPath?: string) {
    return this.els.dialog.showOpenDialog({
      defaultPath,
      properties: ['openFile', 'promptToCreate'],
      filters: [{ name: 'Data File', extensions: ['txt'] }],
    });
  }

  ensureParentDirExistsSync(filePath: string) {
    this.els.fs.mkdirSync(this.els.path.dirname(filePath), {
      recursive: true,
    });
  }

  readFileTextSync(filePath: string): string | undefined {
    if (this.els.fs.existsSync(filePath)) {
      return this.els.fs.readFileSync(filePath, { encoding: 'utf8' });
    }
    return undefined;
  }

  isPathExistSync(filePath: string) {
    return this.els.fs.existsSync(filePath);
  }

  safeWriteFileSync(
    filePath: string,
    text: string,
    tempFilePath1: string,
    tempFilePath2: string
  ) {
    this.ensureParentDirExistsSync(filePath);
    if (this.els.fs.existsSync(filePath)) {
      // const dir = this.els.path.dirname(filePath);
      if (this.els.fs.existsSync(tempFilePath1)) {
        alert(
          `Unable to write file: temp file (${tempFilePath1}) already exists`
        );
      }
      if (this.els.fs.existsSync(tempFilePath2)) {
        alert(
          `Unable to write file: temp file (${tempFilePath2}) already exists`
        );
      }
      this.els.fs.writeFileSync(tempFilePath1, text);
      this.els.fs.renameSync(filePath, tempFilePath2);
      this.els.fs.renameSync(tempFilePath1, filePath);
      this.els.fs.unlinkSync(tempFilePath2);
    } else {
      this.els.fs.writeFileSync(filePath, text);
    }
  }
}
