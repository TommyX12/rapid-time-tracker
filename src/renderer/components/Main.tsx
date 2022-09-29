import classNames from 'classnames';
import { Button, FocusStyleManager } from '@blueprintjs/core';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import styles from './Main.module.css';
import { SideBar } from './SideBar';
import { MainPane } from './MainPane';
import { DataState } from '../data/data-state';
import {
  ActionModel,
  DataModel,
  DataModelReader,
  DataModelWriter,
  RecordModel,
} from '../data/data-model';
import { FsUtil } from '../utils/fs-util';
import { Time } from '../utils/time';

FocusStyleManager.onlyShowFocusOnTabs();

const METADATA_FILE_NAME = 'rapid-time-tracker-metadata.json';
const TEMP_FILE_SUFFIX_1 = '.tmp1';
const TEMP_FILE_SUFFIX_2 = '.tmp2';
const AUTO_SAVE_MS = 1000;
const MAX_UNDO_HISTORY = 50;

export interface Metadata {
  saveFilePath?: string;
  darkMode?: boolean;
}

const DEFAULT_METADATA: Metadata = {
  saveFilePath: undefined,
  darkMode: true,
};

// TODO debug
const initialDataState = (() => {
  const actionModels: ActionModel[] = [];
  const recordModels: RecordModel[] = [];
  /*
  for (let i = 1; i < 1000; ++i) {
    actionModels.push({
      id: i,
      name: `Hello ${i}`,
      parentID: i === 0 ? undefined : Math.floor(Math.random() * i),
      color: Color('#224488'),
    });
  }
  */
  // recordModels.push(
  //   {
  //     actionID: 1,
  //     time: Time.now().addHours(-1),
  //     duration: 1,
  //   },
  //   {
  //     actionID: 1,
  //     time: Time.now().addHours(0),
  //     duration: 2,
  //   },
  //   {
  //     actionID: 1,
  //     time: Time.now().addHours(1),
  //     duration: 42,
  //   }
  // );
  return DataState.fromModel({
    actions: actionModels,
    records: recordModels,
  });
})();

export const MainContext = createContext({
  state: DataState.createEmpty(),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  updateState: (state: DataState) => {},
  loadFromDisk: (path: string) => {},
  saveToDisk: () => {},
  lastSavedTime: undefined as Time | undefined,
  undoStack: [] as DataState[],
  redoStack: [] as DataState[],
  undo: () => {},
  redo: () => {},
  darkMode: true,
  setDarkMode: (value: boolean) => {},
});

export const ServiceContext = createContext({
  fsUtil: new FsUtil(),
});

function Header() {
  return <div className={styles.header} />;
}

export function WelcomeScreen() {
  const { loadFromDisk } = useContext(MainContext);
  const { fsUtil } = useContext(ServiceContext);

  const open = useCallback(async () => {
    const result = await fsUtil.readFilePath();
    const path = result.canceled ? undefined : result.filePaths[0];
    if (path !== undefined) {
      loadFromDisk(path);
    }
  }, [fsUtil, loadFromDisk]);

  return (
    <div className="fill-parent column">
      <h1 className={styles.bigTitle}>Welcome To Rapid Time Tracker</h1>
      <Button icon="folder-open" intent="primary" onClick={open}>
        Open File
      </Button>
    </div>
  );
}

export function Main() {
  // TODO debug
  const [dataState, _setDataState] = useState(initialDataState);
  const setDataState = useCallback((newState: DataState) => {
    // console.log(newState);
    _setDataState(newState);
  }, []);

  const [undoStack, setUndoStack] = useState([] as DataState[]);
  const [redoStack, setRedoStack] = useState([] as DataState[]);

  const [darkMode, setDarkMode] = useState(true);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const newUndoStack = undoStack.slice();
    const newRedoStack = redoStack.slice();
    newRedoStack.push(dataState);
    setDataState(newUndoStack.pop()!);
    setUndoStack(newUndoStack);
    setRedoStack(newRedoStack);
  }, [dataState, redoStack, setDataState, undoStack]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const newUndoStack = undoStack.slice();
    const newRedoStack = redoStack.slice();
    newUndoStack.push(dataState);
    setDataState(newRedoStack.pop()!);
    setUndoStack(newUndoStack);
    setRedoStack(newRedoStack);
  }, [dataState, redoStack, setDataState, undoStack]);

  const [lastSavedTime, setLastSavedTime] = useState<Time | undefined>(
    undefined
  );

  const metadataLoaded = useRef(false);

  const services = useMemo(
    () => ({
      fsUtil: new FsUtil(),
    }),
    []
  );

  const { fsUtil } = services;

  const metadataPath = useMemo(() => {
    return fsUtil.path.join(fsUtil.homeDir(), METADATA_FILE_NAME);
  }, [fsUtil]);

  const saveToDisk = useCallback(() => {
    let outputPath = dataState.filePath;
    if (outputPath === undefined) return;

    const model = dataState.toModel();
    const text = new DataModelWriter().write(model);

    fsUtil.safeWriteFileSync(
      outputPath,
      text,
      outputPath + TEMP_FILE_SUFFIX_1,
      outputPath + TEMP_FILE_SUFFIX_2
    );

    // Save metadata

    const metadata: Metadata = {
      saveFilePath: outputPath,
      darkMode,
    };

    fsUtil.safeWriteFileSync(
      metadataPath,
      JSON.stringify(metadata),
      metadataPath + TEMP_FILE_SUFFIX_1,
      metadataPath + TEMP_FILE_SUFFIX_2
    );

    setLastSavedTime(Time.now());
  }, [darkMode, dataState, fsUtil, metadataPath]);

  const autosaveTimeout = useRef<any>(undefined);

  const updateState = useCallback(
    (state: DataState) => {
      const newUndoStack = undoStack.slice();
      newUndoStack.push(dataState);
      if (newUndoStack.length > MAX_UNDO_HISTORY) {
        newUndoStack.splice(0, 1);
      }
      setUndoStack(newUndoStack);
      setRedoStack([]);
      setDataState(state);
    },
    [dataState, setDataState, undoStack]
  );

  const loadFromDisk = useCallback(
    (filePath: string) => {
      // TODO
      let newState: DataState;
      if (fsUtil.isPathExistSync(filePath)) {
        let fileText: string;
        try {
          const text = fsUtil.readFileTextSync(filePath);
          if (text === undefined) {
            alert(`Failed to read file`);
            return false;
          }
          fileText = text;
        } catch (e) {
          alert(`Failed to read file: ${e}`);
          return false;
        }

        let dataModel: DataModel;
        try {
          dataModel = new DataModelReader().read(fileText);
        } catch (e) {
          alert(`Failed to parse data model: ${e}`);
          return false;
        }

        try {
          newState = DataState.fromModel(dataModel, filePath);
        } catch (e) {
          alert(`Failed to parse data state: ${e}`);
          return false;
        }
      } else {
        newState = DataState.createEmpty(filePath);
      }
      updateState(newState);
      setUndoStack([]);
      setRedoStack([]);
      return true;
    },
    [fsUtil, updateState]
  );

  const context = useMemo(
    () => ({
      state: dataState,
      updateState,
      loadFromDisk,
      saveToDisk,
      lastSavedTime,
      undoStack,
      redoStack,
      undo,
      redo,
      darkMode,
      setDarkMode,
    }),
    [
      darkMode,
      dataState,
      lastSavedTime,
      loadFromDisk,
      redo,
      redoStack,
      saveToDisk,
      undo,
      undoStack,
      updateState,
    ]
  );

  useEffect(() => {
    autosaveTimeout.current = setTimeout(saveToDisk, AUTO_SAVE_MS);
    return () => {
      if (autosaveTimeout.current !== undefined) {
        clearTimeout(autosaveTimeout.current);
      }
    };
  }, [dataState, saveToDisk]);

  // Load metadata
  const onInit = useCallback(async () => {
    let savePath: string | undefined = undefined;
    if (!metadataLoaded.current) {
      metadataLoaded.current = true;

      const metadataText = fsUtil.readFileTextSync(metadataPath);
      let metadata: Metadata | undefined;
      if (metadataText !== undefined) {
        try {
          metadata = JSON.parse(metadataText);
        } catch (e) {
          alert(`Failed to parse metadata: ${e}`);
        }
      }
      if (metadata !== undefined) {
        try {
          savePath = metadata.saveFilePath;
          setDarkMode(!!metadata.darkMode);
          if (savePath !== undefined) {
            savePath = `${savePath}`;
          }
        } catch (e) {
          alert(`Failed to parse save file path from metadata: ${e}`);
        }
      }

      if (savePath) {
        loadFromDisk(savePath);
      }
    }
  }, [fsUtil, loadFromDisk, metadataPath]);

  useEffect(() => {
    // Initialize only once.
    onInit();
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('bp4-dark');
    } else {
      document.body.classList.remove('bp4-dark');
    }
  }, [darkMode]);

  return (
    <MainContext.Provider value={context}>
      <ServiceContext.Provider value={services}>
        <div
          className={classNames(styles.container, {
            [styles.dark]: darkMode,
          })}
        >
          {dataState.filePath ? (
            <>
              <Header />
              <div className={styles.content}>
                <div className={styles.sideBar}>
                  <SideBar />
                </div>
                <div className={styles.mainPane}>
                  <MainPane />
                </div>
              </div>
            </>
          ) : (
            <WelcomeScreen></WelcomeScreen>
          )}
        </div>
      </ServiceContext.Provider>
    </MainContext.Provider>
  );
}
