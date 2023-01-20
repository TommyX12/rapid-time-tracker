import { Button, ButtonGroup, Dialog, Divider, Icon } from '@blueprintjs/core';
import { Explorer } from './Explorer';
import { MainContext, ServiceContext } from './Main';
import { useCallback, useContext, useState } from 'react';

import styles from './MainPane.module.css';
import classNames from 'classnames';
import { Tooltip2 } from '@blueprintjs/popover2';
import { Calendar } from './Calendar';
import { SettingsDialog } from './SettingsDialog';

const TABS = [
  { id: 'explorer', title: 'Explorer', panel: Explorer, icon: 'properties' },
  {
    id: 'calendar',
    title: 'Calendar',
    panel: Calendar,
    icon: 'timeline-bar-chart',
  },
];

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

  const openNew = useCallback(async () => {
    const result = await fsUtil.readNewFilePath();
    const path = result.canceled ? undefined : result.filePath;
    if (path !== undefined) {
      loadFromDisk(path);
    }
  }, [fsUtil, loadFromDisk]);

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

  const [selectedTabID, setSelectedTabID] = useState(TABS[0].id);

  const Panel = TABS.find((tab) => tab.id === selectedTabID)!.panel;

  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const onSettingsDialogClose = useCallback(() => {
    setSettingsDialogOpen(false);
  }, []);

  const openSettingsDialog = useCallback(() => {
    setSettingsDialogOpen(true);
  }, []);

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
          <Tooltip2 content="New" position="bottom">
            <Button icon="folder-new" onClick={openNew}></Button>
          </Tooltip2>
          <Tooltip2 content="Open" position="bottom">
            <Button icon="folder-open" onClick={open}></Button>
          </Tooltip2>
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
          <Button icon="more" onClick={openSettingsDialog}></Button>
        </ButtonGroup>
      </div>
      <div className={classNames('fill-width', 'top-margin', styles.tabBar)}>
        <ButtonGroup fill minimal>
          {TABS.map((tab) => (
            <Button
              key={tab.id}
              className={classNames({
                [styles.selectedTabButton]: tab.id === selectedTabID,
              })}
              onClick={() => setSelectedTabID(tab.id)}
            >
              <Icon icon={tab.icon as any}></Icon>
              <span className={styles.tabButtonText}>{tab.title}</span>
            </Button>
          ))}
        </ButtonGroup>
      </div>
      <div className={classNames('simple-flex', 'fill-width', 'top-margin')}>
        <Panel></Panel>
      </div>
      <Dialog
        isOpen={settingsDialogOpen}
        onClose={onSettingsDialogClose}
        title="Settings"
        style={{ width: '500px' }}
      >
        <SettingsDialog onDone={onSettingsDialogClose} />
      </Dialog>
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
