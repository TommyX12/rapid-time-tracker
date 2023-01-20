import {
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Action, DataState } from '../data/data-state';

import styles from './QuickAddActionDialog.module.css';
import { MainContext } from './Main';
import classNames from 'classnames';
import { Button } from '@blueprintjs/core';
import { generateColor } from '../utils/utils';

export const QuickAddActionDialog = ({
  isOpen,
  parent,
  chain,
  onDone,
}: {
  isOpen: boolean;
  parent: Action;
  chain: string[];
  onDone?: () => void;
}) => {
  const { state, updateState } = useContext(MainContext);

  const dialogRef = useRef<HTMLDivElement | null>(null);

  const [done, setDone] = useState(false);

  const parentName = useMemo(() => {
    return parent.getCanonicalName(state);
  }, [parent, state]);

  const chainName = useMemo(() => {
    return chain.join(': ');
  }, [chain]);

  const confirm = useCallback(() => {
    // Prevent double saving
    if (done) return;

    for (const childName of chain) {
      if (!DataState.validateActionName(childName.trim())) {
        alert(`Invalid action name: ${childName}`);
        return;
      }
    }
    let s = state;
    let parentID = parent.model.id;
    for (const childName of chain) {
      const nextParentID = s.nextActionID;
      s = s.addAction({
        color: generateColor(),
        name: childName.trim(),
        parentID,
      });
      parentID = nextParentID;
    }
    updateState(s);
    setDone(true);
    onDone?.();
  }, [chain, done, onDone, parent.model.id, state, updateState]);

  useLayoutEffect(() => {
    const ref = dialogRef.current;
    if (!ref) return undefined;
    setTimeout(() => {
      ref.focus();
    }, 0);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        confirm();
      }
    };
    ref.addEventListener('keydown', onKeyDown);
    return () => ref.removeEventListener('keydown', onKeyDown);
  }, [confirm]);

  const onConfirmButtonClick = useCallback(() => {
    confirm();
  }, [confirm]);

  return (
    <div className={styles.container} ref={dialogRef} tabIndex={0}>
      <div className={styles.row}>
        <div className={styles.labelText}>Parent:</div>
        <div className="hfill"></div>
        <div className={styles.parentNameText}>{parentName}</div>
      </div>
      <div className={classNames(styles.row, styles.marginTop)}>
        <div className={styles.labelText}>New:</div>
        <div className="hfill"></div>
        <div className={styles.newNameText}>{chainName}</div>
      </div>
      <div className={classNames(styles.row, styles.largeMarginTop)}>
        <div className="hfill"></div>
        <Button
          intent="primary"
          icon="tick"
          onClick={onConfirmButtonClick}
          type="button"
        >
          Confirm
        </Button>
      </div>
    </div>
  );
};
