import {
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  WheelEvent,
} from 'react';
import classNames from 'classnames';
import styles from './Timeline.module.css';
import { MainContext } from './Main';
import { DataState, Record, RecordWithIndex } from '../data/data-state';
import { Time } from '../utils/time';
import { linearMap } from '../utils/utils';
import { Popover2, Tooltip2 } from '@blueprintjs/popover2';
import {
  Button,
  ButtonGroup,
  Dialog,
  Icon,
  Menu,
  MenuItem,
  Position,
} from '@blueprintjs/core';
import { EditRecordProps, RecordDialog } from './RecordDialog';
import { DateInput2 } from '@blueprintjs/datetime2';
import { TimePrecision } from '@blueprintjs/datetime';

const MAX_NUM_PARTS = 3;
const VIEW_BOUNDARY_BUFFER = 2;
const LOAD_REGION_BUFFER = 3;
const WHEEL_TO_TIME_FACTOR = 0.001;
const DEFAULT_DAYS_TOP = 0.45;
const DEFAULT_DAYS_BOTTOM = 0.15;
const AUTO_TODAY_MS = 60000;

enum MarkerType {
  HOUR,
  DAY,
  YEAR,
}

interface Marker {
  time: Time;
  type: MarkerType;
}

export function TimelineObject({
  endTime,
  startTime,
  time,
  children,
  verticalCenter = false,
}: {
  startTime: Time;
  endTime: Time;
  time: Time;
  children: ReactNode;
  verticalCenter?: boolean;
}) {
  const bottom = linearMap(
    startTime.seconds,
    endTime.seconds,
    1,
    0,
    time.seconds
  );
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: verticalCenter
          ? `calc(${bottom * 100}% - 0.5em)`
          : `${bottom * 100}%`,
      }}
    >
      {children}
    </div>
  );
}

export function TimelineMarker({ marker }: { marker: Marker }) {
  let text = '';
  let extraStyle: any;
  if (marker.type === MarkerType.DAY) {
    text = `${marker.time.dateTime.month + 1}-${marker.time.dateTime.day}`;
    extraStyle = styles.dayMarker;
  } else if (marker.type === MarkerType.YEAR) {
    text = `${marker.time.dateTime.year.toString(10).padStart(4, '0')}`;
    extraStyle = styles.yearMarker;
  } else {
    // hour
    text = `${marker.time.dateTime.hours.toString(10)}`;
    extraStyle = styles.hourMarker;
  }
  return <div className={classNames(styles.marker, extraStyle)}>{text}</div>;
}

export function TimelineTick({ marker }: { marker: Marker }) {
  let extraStyle: any;
  if (marker.type === MarkerType.DAY) {
    extraStyle = styles.dayTick;
  } else if (marker.type === MarkerType.YEAR) {
    extraStyle = styles.yearTick;
  } else {
    // hour
    extraStyle = styles.hourTick;
  }
  return <div className={classNames(styles.tick, extraStyle)}></div>;
}

export function TimelineCurrentTick() {
  return <div className={classNames(styles.currentTick)}></div>;
}

export function TimelineAddIndicatorTick() {
  return (
    <div className={classNames(styles.addIndicatorTick)}>
      <Icon icon="plus" className={styles.addIndicatorTickIcon}></Icon>
    </div>
  );
}

export function TimelineRecord({
  state,
  record,
  index,
  editRecord,
  deleteRecord,
}: {
  state: DataState;
  record: Record;
  index: number;
  editRecord: (index: number) => void;
  deleteRecord: (index: number) => void;
}) {
  const action = state.actions.get(record.model.actionID);
  if (!action) return null;

  const canonicalName = useMemo(() => {
    return action.getCanonicalName(state, MAX_NUM_PARTS);
  }, [action, state]);

  const onEditClick = useCallback(() => {
    editRecord(index);
  }, [editRecord, index]);

  const onDeleteClick = useCallback(() => {
    deleteRecord(index);
  }, [deleteRecord, index]);

  return (
    <Popover2
      content={
        <Menu>
          <MenuItem icon="edit" text="Edit" onClick={onEditClick} />
          <MenuItem
            icon="cross"
            text="Delete"
            intent="danger"
            onClick={onDeleteClick}
          />
        </Menu>
      }
      position={Position.TOP}
      className="fill-parent"
    >
      <div
        className={styles.record}
        style={{
          backgroundColor: action.model.color.alpha(0.2).toString(),
          borderColor: action.model.color.alpha(0.5).toString(),
          borderLeftColor: action.model.color.alpha(1).toString(),
        }}
      >
        <div className={styles.recordNameText}>{canonicalName}</div>
        <div className={styles.recordDurationText}>{record.model.duration}</div>
      </div>
    </Popover2>
  );
}

function generateMarkers(
  startTime: Time,
  endTime: Time,
  // Should be 1, 2, 3, 4, 6, 12, or 24
  intervalHours: number
) {
  const markers: Marker[] = [];
  let time = startTime.floorToDays();
  while (time.leq(endTime)) {
    markers.push({
      time,
      type:
        // eslint-disable-next-line no-nested-ternary
        time.dateTime.day === 1 &&
        time.dateTime.month === 0 &&
        time.dateTime.hours === 0
          ? MarkerType.YEAR
          : time.dateTime.hours === 0
          ? MarkerType.DAY
          : MarkerType.HOUR,
    });
    time = time.addHours(intervalHours);
  }
  return markers;
}

export function Timeline() {
  const { state, updateState, darkMode } = useContext(MainContext);

  const currentTime = Time.now();

  const [startTime, setStartTime] = useState(
    currentTime.addDays(-DEFAULT_DAYS_TOP)
  );
  const [endTime, setEndTime] = useState(
    currentTime.addDays(DEFAULT_DAYS_BOTTOM)
  );
  const [markers, setMarkers] = useState([] as Marker[]);
  const [recordItems, setRecordItems] = useState([] as RecordWithIndex[]);

  const [viewBoundary, setViewBoundary] = useState({
    startTime: undefined as Time | undefined,
    endTime: undefined as Time | undefined,
  });

  const [editRecordDialogOpen, setEditRecordDialogOpen] = useState(false);
  const [editRecordProps, setEditRecordProps] = useState<
    EditRecordProps | undefined
  >(undefined);

  const onEditRecordDialogClose = useCallback(() => {
    setEditRecordDialogOpen(false);
  }, []);

  const reload = useCallback(() => {
    const viewSeconds = startTime.secondsTo(endTime);
    const loadStartTime = startTime.addSeconds(
      -1 * LOAD_REGION_BUFFER * viewSeconds
    );
    const loadEndTime = endTime.addSeconds(LOAD_REGION_BUFFER * viewSeconds);
    const newViewBoundary = {
      startTime: startTime.addSeconds(-1 * VIEW_BOUNDARY_BUFFER * viewSeconds),
      endTime: endTime.addSeconds(VIEW_BOUNDARY_BUFFER * viewSeconds),
    };
    setRecordItems(state.getRecordsInRange(loadStartTime, loadEndTime));
    setViewBoundary(newViewBoundary);
    setMarkers(generateMarkers(loadStartTime, loadEndTime, 1));
  }, [endTime, startTime, state]);

  const editRecord = useCallback(
    (index: number) => {
      setEditRecordDialogOpen(true);
      setEditRecordProps({
        recordIndex: index,
        recordReferenceSignature: state.recordReferenceSignature,
      });
    },
    [state]
  );

  const deleteRecord = useCallback(
    (index: number) => {
      updateState(state.removeRecord(index));
    },
    [state, updateState]
  );

  useEffect(() => {
    if (
      viewBoundary.startTime === undefined ||
      startTime.lessThan(viewBoundary.startTime) ||
      viewBoundary.endTime === undefined ||
      endTime.greaterThan(viewBoundary.endTime)
    ) {
      reload();
    }
  }, [
    endTime,
    reload,
    startTime,
    viewBoundary.endTime,
    viewBoundary.startTime,
  ]);

  useEffect(() => {
    // We explicitly reload when state changes too.
    reload();
    // We only want to reload when state changes.
  }, [state]);

  const [addIndicatorTime, setAddIndicatorTime] = useState<Time | undefined>(
    undefined
  );

  const onWheel = useCallback(
    (e: WheelEvent<HTMLDivElement>) => {
      const deltaTime =
        WHEEL_TO_TIME_FACTOR * e.deltaY * startTime.secondsTo(endTime);
      setStartTime(startTime.addSeconds(deltaTime));
      setEndTime(endTime.addSeconds(deltaTime));
      setAddIndicatorTime(undefined);
    },
    [endTime, startTime]
  );

  // This is ISO string
  const handleDateChange = useCallback(
    (newDate: string | null) => {
      const time =
        newDate === null
          ? Time.now().addDays(-0.5)
          : Time.fromDate(new Date(Date.parse(newDate)));
      const viewSeconds = startTime.secondsTo(endTime);
      setStartTime(time);
      setEndTime(time.addSeconds(viewSeconds));
    },
    [endTime, startTime]
  );

  const gotoToday = useCallback(() => {
    setStartTime(Time.now().addDays(-DEFAULT_DAYS_TOP));
    setEndTime(Time.now().addDays(DEFAULT_DAYS_BOTTOM));
  }, []);

  // Automatically follow today
  const autotodayTimeout = useRef<any>(undefined);
  useEffect(() => {
    // This should trigger this effect again.
    autotodayTimeout.current = setTimeout(gotoToday, AUTO_TODAY_MS);
    return () => {
      if (autotodayTimeout.current !== undefined) {
        clearTimeout(autotodayTimeout.current);
      }
    };
    // Do this when start or end time changes
  }, [startTime, endTime, gotoToday]);

  const backgroundRef = useRef<HTMLDivElement>(null);

  const addRecordAtTime = useCallback(() => {
    setEditRecordProps(undefined);
    setEditRecordDialogOpen(true);
  }, []);

  useLayoutEffect(() => {
    const ref = backgroundRef.current;
    if (!ref) return undefined;
    const onMove = (e: MouseEvent) => {
      const bounds = ref.getBoundingClientRect();
      if (bounds.height === 0) {
        return;
      }
      setAddIndicatorTime(
        new Time(
          linearMap(
            0,
            bounds.height,
            startTime.seconds,
            endTime.seconds,
            e.clientY - bounds.top
          )
        )
      );
    };
    const onLeave = (e: MouseEvent) => {
      setAddIndicatorTime(undefined);
    };
    ref.addEventListener('mousemove', onMove);
    ref.addEventListener('mouseleave', onLeave);
    return () => {
      ref.removeEventListener('mousemove', onMove);
      ref.removeEventListener('mouseleave', onLeave);
    };
  }, [endTime, startTime]);

  return (
    <div className={styles.container} onWheel={onWheel}>
      <div className={classNames(styles.header, 'row')}>
        <DateInput2
          className={styles.dateInput}
          popoverProps={{ placement: 'bottom-end' }}
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
          value={startTime.toDate().toISOString()}
          onChange={handleDateChange}
        />
        <div className="hfill"></div>
        <ButtonGroup minimal>
          <Tooltip2 content="Today" position="bottom">
            <Button icon="calendar" onClick={gotoToday}></Button>
          </Tooltip2>
        </ButtonGroup>
      </div>
      <div className={styles.columns}>
        <div className={classNames(styles.column, styles.markerColumn)}>
          {markers.map((marker) => (
            <TimelineObject
              key={marker.time.seconds}
              startTime={startTime}
              endTime={endTime}
              time={marker.time}
              verticalCenter
            >
              <TimelineMarker marker={marker} />
            </TimelineObject>
          ))}
          <div
            className={styles.firstMarkerText}
            style={{ backgroundColor: darkMode ? '#333333' : 'white' }}
          >
            {`${startTime.dateTime.month + 1}-${startTime.dateTime.day}`}
          </div>
        </div>
        <div className={classNames(styles.column, styles.rulerColumn)}>
          {markers.map((marker) => (
            <TimelineObject
              key={marker.time.seconds}
              startTime={startTime}
              endTime={endTime}
              time={marker.time}
            >
              <TimelineTick marker={marker} />
            </TimelineObject>
          ))}
          <TimelineObject
            startTime={startTime}
            endTime={endTime}
            time={currentTime}
          >
            <TimelineCurrentTick />
          </TimelineObject>
          {addIndicatorTime && (
            <TimelineObject
              startTime={startTime}
              endTime={endTime}
              time={addIndicatorTime}
            >
              <TimelineAddIndicatorTick />
            </TimelineObject>
          )}
        </div>
        <div className={classNames(styles.column, styles.recordColumn)}>
          <div
            ref={backgroundRef}
            className={styles.background}
            onClick={() => addIndicatorTime !== undefined && addRecordAtTime()}
          />
          {recordItems.map(({ record, index }) => (
            <TimelineObject
              key={index}
              startTime={startTime}
              endTime={endTime}
              time={record.model.time}
            >
              <TimelineRecord
                state={state}
                record={record}
                index={index}
                editRecord={editRecord}
                deleteRecord={deleteRecord}
              />
            </TimelineObject>
          ))}
        </div>
      </div>
      <Dialog
        isOpen={editRecordDialogOpen}
        onClose={onEditRecordDialogClose}
        title={editRecordProps ? 'Edit record' : 'Add record at time'}
        style={{ width: '600px' }}
      >
        <RecordDialog
          editProps={editRecordProps}
          defaultTime={addIndicatorTime}
          onDone={onEditRecordDialogClose}
        />
      </Dialog>
    </div>
  );
}
