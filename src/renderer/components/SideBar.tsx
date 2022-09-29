import styles from './SideBar.module.css';
import { Timeline } from './Timeline';
import { Button, Dialog } from '@blueprintjs/core';
import { useCallback, useState } from 'react';
import { RecordDialog } from './RecordDialog';
import { useGlobalShortcutKey } from '../utils/utils';

export function SideBar() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const onAddDialogClose = useCallback(() => {
    setAddDialogOpen(false);
  }, []);

  const quickAdd = useCallback(() => {
    setAddDialogOpen(true);
  }, []);

  useGlobalShortcutKey('a', quickAdd);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerText}>Timeline</div>
        <div className="hfill" />
        <Button icon="plus" minimal onClick={quickAdd}>
          Add <span className={styles.keyHint}>(a)</span>
        </Button>
        <Dialog
          isOpen={addDialogOpen}
          onClose={onAddDialogClose}
          title="Add record"
          style={{ width: '600px' }}
        >
          <RecordDialog
            isOpen={addDialogOpen}
            onDone={onAddDialogClose}
          ></RecordDialog>
        </Dialog>
      </div>
      <div className={styles.content}>
        <Timeline />
      </div>
    </div>
  );
}
