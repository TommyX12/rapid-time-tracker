import { Button, InputGroup } from '@blueprintjs/core';
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import styles from './ActionDialog.module.css';
import {
  ActionFinder,
  ActionFinderQueryResultEntry,
  ActionFinderRef,
} from './ActionFinder';
import { MainContext } from './Main';
import { Action, DataState, ROOT_ACTION_ID } from '../data/data-state';
import classNames from 'classnames';
import { ActionID } from '../data/data-model';
import { generateColor } from '../utils/utils';
import { Popover2 } from '@blueprintjs/popover2';
import { SketchPicker } from 'react-color';
import Color from 'color';

export interface EditActionProps {
  actionID: number;
}

export function ActionDialog({
  isOpen,
  editProps,
  parentID,
  onDone,
}: {
  isOpen: boolean;
  editProps?: EditActionProps;
  parentID?: ActionID;
  onDone?: () => void;
}) {
  const { state, updateState } = useContext(MainContext);

  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const parentInputRef = useRef<HTMLInputElement | null>(null);
  const actionFinderRef = useRef<ActionFinderRef | null>(null);

  const [done, setDone] = useState(false);

  const [nameString, setNameString] = useState('');

  const [color, setColor] = useState(generateColor());

  const [parentNameString, setParentNameString] = useState('');
  const selectedEntry = useRef<ActionFinderQueryResultEntry | undefined>(
    undefined
  );
  const [selectedParent, setSelectedParent] = useState<Action | undefined>(
    undefined
  );

  useEffect(() => {
    if (editProps === undefined) {
      return;
    }

    // Close dialog if there's nothing to edit
    if (!state.actions.has(editProps.actionID)) {
      onDone?.();
    }
  }, [state, editProps, onDone]);

  useEffect(() => {
    if (editProps === undefined) {
      return;
    }

    // Load from edit props
    const editAction = state.actions.get(editProps.actionID);
    if (editAction === undefined) return;
    setNameString(editAction.model.name);
    setColor(editAction.model.color);
    let parentName = '';
    if (editAction.model.parentID !== undefined) {
      const parentAction = state.actions.get(editAction.model.parentID);
      if (parentAction !== undefined) {
        parentName = parentAction.getCanonicalName(state);
      }
    }
    setParentNameString(parentName);
    // We only want this to happen when editProps change.
  }, [editProps]);

  useEffect(() => {
    if (parentID === undefined) {
      return;
    }

    // Load from edit props
    const parentAction = state.actions.get(parentID);
    if (parentAction === undefined) return;
    setParentNameString(parentAction.getCanonicalName(state));
    // We only want this to happen when parentID change.
  }, [parentID]);

  const prohibitedParentIDs = useMemo(() => {
    if (editProps === undefined) return undefined;

    const editAction = state.actions.get(editProps.actionID);
    if (editAction === undefined) return undefined;

    const result = new Set<ActionID>();

    const dfs = (action: Action) => {
      result.add(action.model.id);

      for (const childID of action.childIDs) {
        const child = state.actions.get(childID);
        if (child !== undefined) {
          dfs(child);
        }
      }
    };

    dfs(editAction);
    return result;
  }, [editProps, state]);

  useLayoutEffect(() => {
    nameInputRef.current?.focus();
    // This selects the texts
    setTimeout(() => {
      nameInputRef.current?.select();
    }, 0);
  }, []);

  const completeEntry = useCallback((entry: ActionFinderQueryResultEntry) => {
    const newString = entry.entry.canonicalName;
    setParentNameString(newString);
  }, []);

  const autocomplete = useCallback(() => {
    if (selectedEntry.current !== undefined) {
      completeEntry(selectedEntry.current);
    }
  }, [completeEntry]);

  const onFinderDoubleClick = useCallback(() => {
    autocomplete();
  }, [autocomplete]);

  const save = useCallback(() => {
    // Prevent double saving
    if (done) return;
    setDone(true);

    const editAction =
      editProps === undefined
        ? undefined
        : state.actions.get(editProps.actionID);
    const name = nameString.trim();
    if (!DataState.validateActionName(name)) {
      alert(`Invalid action name: ${name}`);
      return;
    }
    const parentID =
      selectedParent === undefined ? ROOT_ACTION_ID : selectedParent.model.id;
    if (editAction !== undefined) {
      updateState(
        state.updateAction({
          color,
          id: editAction.model.id,
          name,
          parentID,
        })
      );
    } else {
      updateState(
        state.addAction({
          color,
          name,
          parentID,
        })
      );
    }
    onDone?.();
  }, [
    done,
    editProps,
    state,
    nameString,
    selectedParent,
    onDone,
    updateState,
    color,
  ]);

  useEffect(() => {
    const actionInput = parentInputRef.current;
    if (!actionInput) return undefined;
    const onActionInputKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        autocomplete();
        e.preventDefault();
        actionInput.focus();
      } else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'k')) {
        actionFinderRef.current?.prevSelection();
      } else if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'j')) {
        actionFinderRef.current?.nextSelection();
      }
    };
    actionInput.addEventListener('keydown', onActionInputKeyDown);
    return () =>
      actionInput.removeEventListener('keydown', onActionInputKeyDown);
  }, [autocomplete]);

  const onSelectedEntryChanged = useCallback(
    (entry: ActionFinderQueryResultEntry | undefined) => {
      selectedEntry.current = entry;
      setSelectedParent(entry?.entry.action);
    },
    []
  );

  const canSave = useMemo(() => {
    // TODO
    return (
      nameString.trim().length > 0 &&
      (parentNameString.trim().length === 0 || selectedParent)
    );
  }, [nameString, parentNameString, selectedParent]);

  const clearParent = useCallback(() => {
    setParentNameString('');
  }, []);

  return (
    <div className={styles.container}>
      <div className={classNames(styles.row, 'bottom-margin')}>
        <div className={styles.label}>Name:</div>
        <div className="simple-flex">
          <InputGroup
            placeholder="Enter name ..."
            type="text"
            inputRef={nameInputRef}
            value={nameString}
            onChange={(event) => {
              setNameString(event.target.value);
            }}
          />
        </div>
      </div>
      <div className={classNames('row', 'bottom-margin')}>
        <div className={styles.label}>Color:</div>
        <div className="hfill" />
        <Popover2
          content={
            <SketchPicker
              color={color.hexa()}
              onChange={(e) => {
                setColor(Color(e.hex));
              }}
              disableAlpha
            />
          }
        >
          <div
            className={styles.colorBox}
            style={{ backgroundColor: color.toString() }}
          />
        </Popover2>
      </div>
      <div className={classNames(styles.row, 'bottom-margin')}>
        <div className={styles.label}>Parent:</div>
        <div className="simple-flex">
          <InputGroup
            placeholder="Search for parent ..."
            type="text"
            inputRef={parentInputRef}
            value={parentNameString}
            onChange={(event) => {
              setParentNameString(event.target.value);
            }}
            rightElement={<Button icon="cross" onClick={clearParent}></Button>}
          />
        </div>
      </div>
      <div className={classNames(styles.actionFinder, 'bottom-margin')}>
        <ActionFinder
          ref={actionFinderRef}
          queryString={parentNameString}
          onSelectedEntryChanged={onSelectedEntryChanged}
          onDoubleClick={onFinderDoubleClick}
          specialText={
            parentNameString.trim().length === 0 ? '(No parent)' : undefined
          }
          allowEmptyQueryString={false}
          prohibitedIDs={prohibitedParentIDs}
        />
      </div>
      <div className={classNames(styles.row, 'top-margin')}>
        <div className="hfill"></div>
        <div className={styles.leftMargin}>
          <Button
            intent="primary"
            icon="tick"
            onClick={save}
            disabled={!canSave}
          >
            {editProps === undefined ? 'Add' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
