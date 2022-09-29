import { Button, ButtonGroup, Divider } from '@blueprintjs/core';
import { Explorer } from './Explorer';
import { MainContext, ServiceContext } from './Main';
import { useCallback, useContext } from 'react';

import styles from './MainPane.module.css';
import classNames from 'classnames';
import { Tooltip2 } from '@blueprintjs/popover2';

const tabs = [{ id: 'explorer', title: 'Explorer', panel: Explorer }];

export function MainPane() {
  const {
    state,
    loadFromDisk,
    saveToDisk,
    lastSavedTime,
    undo,
    redo,
    undoStack,
    redoStack,
    darkMode,
    setDarkMode,
  } = useContext(MainContext);
  const { fsUtil } = useContext(ServiceContext);

  const toggleDarkMode = useCallback(() => {
    setDarkMode(!darkMode);
  }, [darkMode, setDarkMode]);

  const open = useCallback(async () => {
    const result = await fsUtil.readFilePath();
    const path = result.canceled ? undefined : result.filePaths[0];
    if (path !== undefined) {
      loadFromDisk(path);
    }
  }, [fsUtil, loadFromDisk]);

  const reload = useCallback(() => {
    const path = state.filePath;
    if (path !== undefined) {
      loadFromDisk(path);
    }
  }, [loadFromDisk, state.filePath]);

  const save = useCallback(() => {
    saveToDisk();
  }, [saveToDisk]);

  return (
    <div className="fill-parent column">
      <div className="row fill-width bottom-margin">
        <ButtonGroup minimal>
          <Tooltip2 content="Toggle dark mode" position="bottom">
            <Button icon="moon" onClick={toggleDarkMode} />
          </Tooltip2>
          <Divider />
          <Button
            icon="undo"
            onClick={undo}
            disabled={undoStack.length === 0}
          />
          <Button
            icon="redo"
            onClick={redo}
            disabled={redoStack.length === 0}
          />
        </ButtonGroup>
        <div className="hfill"></div>
        <div className={classNames('no-wrap', styles.pathText)}>
          {state.filePath}
        </div>
        <ButtonGroup minimal className={styles.mainButtonGroup}>
          <Button icon="folder-open" onClick={open}>
            Open
          </Button>
          <Tooltip2 content="Reload" position="bottom">
            <Button icon="refresh" onClick={reload}></Button>
          </Tooltip2>
          <Tooltip2
            content={
              lastSavedTime === undefined
                ? 'Save'
                : `Last saved on ${lastSavedTime.toString()}`
            }
            position="bottom"
          >
            <Button icon="floppy-disk" onClick={save}></Button>
          </Tooltip2>
        </ButtonGroup>
      </div>
      <div
        className={classNames(
          'simple-flex',
          styles.explorer,
          'fill-width',
          'top-margin'
        )}
      >
        <Explorer></Explorer>
      </div>
    </div>
  );
}

/*
<Tabs
  id="TabsExample"
  renderActiveTabPanelOnly
  defaultSelectedTabId={tabs[0].id}
  className={classNames(
    'simple-flex',
    'fill-width',
    styles.tabsContainer
  )}
>
  {tabs.map((item) => {
    const Panel = item.panel;
    return (
      <Tab
        key={item.id}
        id={item.id}
        title={item.title}
        panel={<Panel />}
        panelClassName="simple-flex"
      />
    );
  })}
  <Tabs.Expander />
</Tabs>
*/
