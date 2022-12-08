import { Button, Dialog, InputGroup, NumericInput } from '@blueprintjs/core';
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import styles from './RecordDialog.module.css';
import {
  ActionFinder,
  ActionFinderQueryResultEntry,
  ActionFinderRef,
} from './ActionFinder';
import { MainContext } from './Main';
import { Time } from '../utils/time';
import { Action, RecordReferenceSignature } from '../data/data-state';
import { QuickAddActionDialog } from './QuickAddActionDialog';
import { RecordModel } from '../data/data-model';
import { DateInput2 } from '@blueprintjs/datetime2';
import { TimePrecision } from '@blueprintjs/datetime';
import classNames from 'classnames';

export interface EditRecordProps {
  recordReferenceSignature: RecordReferenceSignature;
  recordIndex: number;
}

export function RecordDialog({
  editProps,
  defaultTime,
  onDone,
}: {
  editProps?: EditRecordProps;
  defaultTime?: Time;
  onDone?: () => void;
}) {
  const { state, updateState } = useContext(MainContext);

  const actionInputRef = useRef<HTMLInputElement | null>(null);
  const durationInputRef = useRef<HTMLInputElement | null>(null);
  const actionFinderRef = useRef<ActionFinderRef | null>(null);

  const [actionNameString, setActionNameString] = useState('');
  const selectedEntry = useRef<ActionFinderQueryResultEntry | undefined>(
    undefined
  );
  const [selectedAction, setSelectedAction] = useState<Action | undefined>(
    undefined
  );

  const [done, setDone] = useState(false);

  const [duration, setDuration] = useState(1);

  // This is ISO string
  const [date, setDate] = useState<string | null>(
    (defaultTime || Time.now()).toDate().toISOString()
  );

  useEffect(() => {
    if (editProps === undefined) {
      return;
    }

    // Close dialog if record index is not compatible anymore
    if (editProps.recordReferenceSignature !== state.recordReferenceSignature) {
      onDone?.();
      return;
    }

    const record = state.records[editProps.recordIndex];
    if (record === undefined) {
      throw new Error('Record is undefined');
    }

    const action = state.actions.get(record.model.actionID);
    if (action === undefined) {
      throw new Error('Action is undefined');
    }

    setActionNameString(action.getCanonicalName(state));
    setDuration(record.model.duration);
    setDate(record.model.time.toDate().toISOString());
    // By testing state.records, we make sure that if we quick-add new actions while editing a record, we will not reload or close the dialog.
    // We explicitly only want the following here.
  }, [state.recordReferenceSignature, editProps]);

  const [quickAddActionDialogOpen, setQuickAddActionDialogOpen] =
    useState(false);

  const onQuickActionDialogClose = useCallback(() => {
    setQuickAddActionDialogOpen(false);
  }, []);

  const [quickAddActionParent, setQuickAddActionParent] = useState<
    Action | undefined
  >(undefined);

  const [quickAddActionChain, setQuickAddActionChain] = useState<string[]>([]);

  useLayoutEffect(() => {
    actionInputRef.current?.focus();
    // This selects the texts
    setTimeout(() => {
      actionInputRef.current?.select();
    }, 0);
  }, []);

  const completeEntry = useCallback((entry: ActionFinderQueryResultEntry) => {
    let canProceed = true;
    let newString = entry.entry.canonicalName;
    if (entry.entry.action.isGroup) {
      newString += ': ';
      canProceed = false;
    }
    setActionNameString(newString);
    return canProceed;
  }, []);

  const autocomplete = useCallback(() => {
    let canProceed = true;
    if (selectedEntry.current !== undefined) {
      canProceed = completeEntry(selectedEntry.current);
    } else {
      canProceed = false;
    }
    return canProceed;
  }, [completeEntry]);

  const onFinderDoubleClick = useCallback(() => {
    autocomplete();
  }, [autocomplete]);

  const forceCreate = useCallback(() => {
    const queryParts = actionNameString
      .split(':')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    if (queryParts.length === 0) {
      return;
    }

    let action = state.rootAction;
    let i = 0;
    for (i = 0; i < queryParts.length; ++i) {
      const queryPart = queryParts[i].toLowerCase();
      let found = false;
      for (const childID of action.childIDs) {
        const child = state.actions.get(childID);
        if (child === undefined) continue;
        if (child.model.name.trim().toLowerCase() === queryPart) {
          action = child;
          found = true;
          break;
        }
      }
      if (!found) {
        break;
      }
    }

    if (i < queryParts.length) {
      setQuickAddActionParent(action);
      setQuickAddActionChain(queryParts.slice(i));
      setQuickAddActionDialogOpen(true);
    }
  }, [actionNameString, state]);

  const saveSelected = useCallback(() => {
    // Prevent double saving
    if (done) return;
    setDone(true);

    // TODO: input for time
    if (selectedEntry.current) {
      const newModel: RecordModel = {
        actionID: selectedEntry.current.entry.action.model.id,
        duration,
        time:
          date === null
            ? Time.now()
            : Time.fromDate(new Date(Date.parse(date))),
      };
      updateState(
        editProps === undefined
          ? state.addRecord(newModel)
          : state.updateRecord(editProps.recordIndex, newModel)
      );
      onDone?.();
    }
  }, [date, duration, editProps, done, onDone, state, updateState]);

  useEffect(() => {
    const actionInput = actionInputRef.current;
    if (!actionInput) return undefined;
    const onActionInputKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        autocomplete();
        e.preventDefault();
        actionInput.focus();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        if (autocomplete()) {
          durationInputRef.current?.focus();
        }
      } else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'k')) {
        actionFinderRef.current?.prevSelection();
      } else if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'j')) {
        actionFinderRef.current?.nextSelection();
      } else if (e.key === 'Enter' && e.shiftKey) {
        forceCreate();
        e.preventDefault();
        e.stopPropagation();
      }
    };
    actionInput.addEventListener('keydown', onActionInputKeyDown);
    return () =>
      actionInput.removeEventListener('keydown', onActionInputKeyDown);
  }, [autocomplete, forceCreate]);

  useEffect(() => {
    const durationInput = durationInputRef.current;
    if (!durationInput) return undefined;
    const onDurationInputKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        saveSelected();
      }
    };
    durationInput.addEventListener('keydown', onDurationInputKeyDown);
    return () => {
      durationInput.removeEventListener('keydown', onDurationInputKeyDown);
    };
  }, [saveSelected]);

  const onDurationInputChange = useCallback((value: number) => {
    setDuration(value);
  }, []);

  const onSelectedEntryChanged = useCallback(
    (entry: ActionFinderQueryResultEntry | undefined) => {
      selectedEntry.current = entry;
      setSelectedAction(entry?.entry.action);
    },
    []
  );

  const canSaveSelected = useMemo(() => {
    return selectedAction && selectedAction.isLeaf;
  }, [selectedAction]);

  const handleDateChange = useCallback((newDate: string | null) => {
    setDate(newDate);
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.row}>
        <div className="simple-flex">
          <InputGroup
            placeholder="Search or create action..."
            type="text"
            inputRef={actionInputRef}
            value={actionNameString}
            onChange={(event) => {
              setActionNameString(event.target.value);
            }}
            rightElement={
              actionNameString.length > 0 ? (
                <Button icon="plus" onClick={forceCreate}>
                  Create
                </Button>
              ) : undefined
            }
          />
        </div>
        <div className={styles.leftMargin}>
          <NumericInput
            leftIcon="time"
            placeholder="Duration"
            style={{ width: '100px' }}
            value={duration}
            onValueChange={onDurationInputChange}
            inputRef={durationInputRef}
            min={0}
          />
        </div>
      </div>
      <div className={classNames(styles.keyHintRow)}>
        <div className={styles.keyHintContainer}>
          <div className={styles.keyHint}>enter</div>
          <div className={styles.keyHintText}>Confirm</div>
        </div>
        <div
          className={classNames(styles.keyHintContainer, {
            [styles.disabledKeyHint]: actionNameString.length === 0,
          })}
        >
          <div className={styles.keyHint}>shift + enter</div>
          <div className={styles.keyHintText}>Create</div>
        </div>
        <div className={styles.keyHintContainer}>
          <div className={styles.keyHint}>tab</div>
          <div className={styles.keyHintText}>Insert</div>
        </div>
        <div className={styles.keyHintContainer}>
          <div className={styles.keyHint}>up / ctrl+k</div>
          <div className={styles.keyHintText}>Previous</div>
        </div>
        <div className={styles.keyHintContainer}>
          <div className={styles.keyHint}>down / ctrl+j</div>
          <div className={styles.keyHintText}>Next</div>
        </div>
      </div>
      <div className={styles.actionFinder}>
        <ActionFinder
          ref={actionFinderRef}
          queryString={actionNameString}
          onSelectedEntryChanged={onSelectedEntryChanged}
          onDoubleClick={onFinderDoubleClick}
          allowEmptyQueryString
        />
      </div>
      <div className={styles.row}>
        <DateInput2
          popoverProps={{ placement: 'top' }}
          timePrecision={TimePrecision.SECOND}
          timePickerProps={{ showArrowButtons: true, useAmPm: false }}
          showTimezoneSelect={false}
          showActionsBar
          formatDate={(date) => {
            return Time.fromDate(date).toString();
          }}
          parseDate={(str) => {
            const time = Time.fromString(str);
            return time === undefined ? new Date() : time.toDate();
          }}
          closeOnSelection={false}
          value={date}
          onChange={handleDateChange}
        />
        <div className="hfill"></div>
        <div className={styles.leftMargin}>
          <Button
            intent="primary"
            icon="tick"
            onClick={saveSelected}
            disabled={!canSaveSelected}
          >
            {editProps === undefined ? 'Add' : 'Save'}
          </Button>
        </div>
      </div>
      <Dialog
        isOpen={quickAddActionDialogOpen}
        onClose={onQuickActionDialogClose}
        title="Create action"
        style={{ width: '500px' }}
      >
        {quickAddActionParent && (
          <QuickAddActionDialog
            isOpen={quickAddActionDialogOpen}
            parent={quickAddActionParent}
            chain={quickAddActionChain}
            onDone={onQuickActionDialogClose}
          />
        )}
      </Dialog>
    </div>
  );
}
