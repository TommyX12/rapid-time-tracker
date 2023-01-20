import { useCallback, useContext, useState } from 'react';

import styles from './RescaleDialog.module.css';
import { MainContext } from './Main';
import classNames from 'classnames';
import { Button } from '@blueprintjs/core';

export const RescaleDialog = ({ onDone }: { onDone?: () => void }) => {
  const { state, updateState } = useContext(MainContext);

  const [done, setDone] = useState(false);

  const save = useCallback(() => {
    // Prevent double saving
    if (done) return;

    setDone(true);
    onDone?.();
  }, [done, onDone]);

  const onSaveButtonClick = useCallback(() => {
    save();
  }, [save]);

  return (
    <div className={styles.container}>
      <div className={styles.row}>
        <div className={styles.labelText}>Parent:</div>
        <div className="hfill"></div>
      </div>
      <div className={classNames(styles.row, styles.marginTop)}>
        <div className={styles.labelText}>New:</div>
        <div className="hfill"></div>
      </div>
      <div className={classNames(styles.row, styles.largeMarginTop)}>
        <div className="hfill"></div>
        <Button
          intent="primary"
          icon="tick"
          onClick={onSaveButtonClick}
          type="button"
        >
          Save
        </Button>
      </div>
    </div>
  );
};
