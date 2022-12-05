import styles from './Calendar.module.css';

import { Button, ButtonGroup } from '@blueprintjs/core';
import classNames from 'classnames';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Time } from '../utils/time';
import { BarVisualizer } from './BarVisualizer';
import { Counter, prettyNumber } from '../utils/utils';
import { ActionID } from '../data/data-model';
import { getCounter } from './Explorer';
import { MainContext } from './Main';
import { ROOT_ACTION_ID } from '../data/data-state';
import { DateTimeInput } from './DateTimeInput';

enum DisplayMode {
  COLUMN,
  CALENDAR,
}

interface DisplayText {
  text: string;
  isBold?: boolean;
}

interface ScaleMode {
  name: string;
  displayMode: DisplayMode;
  // Start and end are both inclusive.
  getOffsetRange: (targetTime: Time) => [number, number];
  // Both dates are inclusive.
  getDateRange: (targetTime: Time, offset: number) => [Date, Date];
  getDisplayText: (dateRange: [Date, Date]) => DisplayText;
  moveDeltaTime: (targetTime: Time, delta: number) => Time;
}

const DEFAULT_NUM_OFFSETS = 12;
const SIMPLE_GET_OFFSET_RANGE = () =>
  [-DEFAULT_NUM_OFFSETS + 1, 0] as [number, number];

const CALENDAR_ROWS = [0, 1, 2, 3, 4];
const CALENDAR_COLUMNS = [0, 1, 2, 3, 4, 5, 6];

const SCALE_MODES: ScaleMode[] = [
  {
    name: 'Day',
    displayMode: DisplayMode.CALENDAR,
    getOffsetRange: (targetTime: Time) => {
      const start = -targetTime.dateTime.dayOfWeek - 28;
      return [start, start + 34];
    },
    getDateRange: (targetTime, offset) => {
      const start = targetTime.floorToDays().addDays(offset);
      return [start.toDate(), start.toDate()];
    },
    getDisplayText: (dateRange) => {
      const time = Time.fromDate(dateRange[0]);
      return {
        text: time.toMMDDString(),
        isBold: time.dateTime.day === 1,
      };
    },
    moveDeltaTime: (targetTime, delta) => {
      return targetTime.addDays(delta * 7);
    },
  },
  {
    name: 'Week',
    displayMode: DisplayMode.COLUMN,
    getOffsetRange: SIMPLE_GET_OFFSET_RANGE,
    getDateRange: (targetTime, offset) => {
      const start = targetTime
        .floorToDays()
        .startOfMondayWeek()
        .addDays(offset * 7);
      return [start.toDate(), start.addDays(6).toDate()];
    },
    getDisplayText: (dateRange) => {
      const time = Time.fromDate(dateRange[0]);
      return {
        text: time.toMMDDString(),
        isBold: time.dateTime.day < 8,
      };
    },
    moveDeltaTime: (targetTime, delta) => {
      return targetTime.addDays(delta * 7 * 3);
    },
  },
  {
    name: 'Month',
    displayMode: DisplayMode.COLUMN,
    getOffsetRange: SIMPLE_GET_OFFSET_RANGE,
    getDateRange: (targetTime, offset) => {
      const start = targetTime.floorToDays().startOfMonth().addMonths(offset);
      return [start.toDate(), start.addMonths(1).addDays(-1).toDate()];
    },
    getDisplayText: (dateRange) => {
      const time = Time.fromDate(dateRange[0]);
      return {
        text: time.toYYYYMMString(),
        isBold: time.dateTime.month === 0,
      };
    },
    moveDeltaTime: (targetTime, delta) => {
      const dateTime = targetTime.dateTime;
      return Time.fromParams(
        dateTime.year,
        dateTime.month + delta * 3,
        1,
        0,
        0,
        0
      );
    },
  },
  {
    name: 'Year',
    displayMode: DisplayMode.COLUMN,
    getOffsetRange: SIMPLE_GET_OFFSET_RANGE,
    getDateRange: (targetTime, offset) => {
      const start = targetTime.floorToDays().startOfYear().addYears(offset);
      return [start.toDate(), start.addYears(1).addDays(-1).toDate()];
    },
    getDisplayText: (dateRange) => {
      const time = Time.fromDate(dateRange[0]);
      return {
        text: time.toYYYYString(),
      };
    },
    moveDeltaTime: (targetTime, delta) => {
      const dateTime = targetTime.dateTime;
      return Time.fromParams(
        dateTime.year + delta * 3,
        dateTime.month,
        1,
        0,
        0,
        0
      );
    },
  },
];

interface CellData {
  /**
   * Start and end are both inclusive.
   */
  dateRange: [Date, Date];
  durationCounter: Counter<ActionID>;
  totalCount: number;
  heightPercent: number;
  displayText: DisplayText;
  isToday: boolean;
}

export function Calendar() {
  const { state } = useContext(MainContext);

  const [scaleMode, setScaleMode] = useState(SCALE_MODES[0]);
  // Rounded to days.
  const [targetTime, setTargetTime] = useState(Time.now().floorToDays());

  const cellDataList = useMemo(() => {
    const result: CellData[] = [];
    const offsetRange = scaleMode.getOffsetRange(targetTime);
    let maxTotalCount = 0;
    const today = Time.now().floorToDays();
    for (let i = offsetRange[0]; i <= offsetRange[1]; ++i) {
      const dateRange = scaleMode.getDateRange(targetTime, i);
      const startTime = Time.fromDate(dateRange[0]).floorToDays();
      const endTime = Time.fromDate(dateRange[1]).floorToDays().addDays(1);
      const isToday = today.geq(startTime) && today.lessThan(endTime);
      const durationCounter = getCounter(state, dateRange);
      const totalCount = durationCounter.get(ROOT_ACTION_ID);
      maxTotalCount = Math.max(maxTotalCount, totalCount);
      result.push({
        dateRange,
        durationCounter,
        totalCount,
        heightPercent: 1,
        displayText: scaleMode.getDisplayText(dateRange),
        isToday,
      });
    }
    for (let i = 0; i < result.length; ++i) {
      result[i].heightPercent =
        maxTotalCount > 0 ? result[i].totalCount / maxTotalCount : 1;
    }
    return result;
  }, [scaleMode, state, targetTime]);

  const goLeft = useCallback(() => {
    setTargetTime(scaleMode.moveDeltaTime(targetTime, -1));
  }, [scaleMode, targetTime]);

  const goRight = useCallback(() => {
    setTargetTime(scaleMode.moveDeltaTime(targetTime, 1));
  }, [scaleMode, targetTime]);

  const goToday = useCallback(() => {
    setTargetTime(Time.now().floorToDays());
  }, []);

  const [highlightID, setHighlightID] = useState<ActionID | undefined>(
    undefined
  );

  useEffect(() => {
    setHighlightID(undefined);
    // Explicitly reset highlight ID on these changes.
  }, [state, scaleMode]);

  const onBarMouseEnter = useCallback((id: ActionID) => {
    setHighlightID(id);
  }, []);
  const onBarMouseLeave = useCallback(() => {
    setHighlightID(undefined);
  }, []);

  return (
    <div className="fill-parent column">
      <div className="fill-width row bottom-margin">
        {SCALE_MODES.map((mode) => (
          <Button
            key={mode.name}
            minimal
            active={scaleMode.name === mode.name}
            className={classNames(styles.button, {
              [styles.inactiveButton]: scaleMode.name !== mode.name,
            })}
            onClick={() => {
              setScaleMode(mode);
            }}
          >
            {mode.name}
          </Button>
        ))}
        <div className="hfill"></div>
        <ButtonGroup minimal className="right-margin">
          <Button icon="chevron-left" onClick={goLeft} />
          <Button icon="chevron-right" onClick={goRight} />
          <Button onClick={goToday}>Today</Button>
        </ButtonGroup>
        <DateTimeInput value={targetTime} onValueChange={setTargetTime} />
      </div>
      <div className="fill-width simple-flex">
        {scaleMode.displayMode === DisplayMode.CALENDAR ? (
          <div className={classNames('fill-parent', 'column')}>
            {CALENDAR_ROWS.map((row) => (
              <div
                key={row}
                className={classNames('fill-width', 'row', 'simple-flex')}
              >
                {CALENDAR_COLUMNS.map((column) => {
                  const idx = row * CALENDAR_COLUMNS.length + column;
                  if (idx >= cellDataList.length) return undefined;
                  const cellData = cellDataList[idx];
                  return (
                    <div
                      key={column}
                      className={classNames(
                        'fill-height',
                        'column',
                        'simple-flex',
                        styles.calendarCell,
                        {
                          [styles.boldBackground]: cellData.displayText.isBold,
                          [styles.todayBackground]: cellData.isToday,
                          [styles.calendarCellRightBorder]:
                            column === CALENDAR_COLUMNS.length - 1,
                          [styles.calendarCellBottomBorder]:
                            row === CALENDAR_ROWS.length - 1,
                        }
                      )}
                    >
                      <div
                        className={classNames(
                          'fill-width',
                          'row',
                          styles.calendarCellHeader
                        )}
                      >
                        <div
                          className={classNames(
                            'simple-flex',
                            'no-wrap',
                            styles.displayText,
                            {
                              [styles.boldDisplayText]:
                                cellData.displayText.isBold,
                              [styles.todayDisplayText]: cellData.isToday,
                            }
                          )}
                        >
                          {cellData.displayText.text}
                        </div>
                        <div className={classNames(styles.totalText)}>
                          {prettyNumber(cellData.totalCount)}
                        </div>
                      </div>
                      <div
                        className={classNames(
                          'fill-width',
                          'simple-flex',
                          'row',
                          styles.barOuterContainer
                        )}
                      >
                        <div
                          className={classNames(
                            'simple-flex',
                            'fill-height',
                            styles.barInnerContainer
                          )}
                        >
                          <div
                            className={classNames(styles.bar)}
                            style={{
                              top: `${(1 - cellData.heightPercent) * 100}%`,
                            }}
                          >
                            <BarVisualizer
                              durationCounter={cellData.durationCounter}
                              onMouseEnter={onBarMouseEnter}
                              onMouseLeave={onBarMouseLeave}
                              highlightID={highlightID}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          <div className="fill-parent row">
            {cellDataList.map((cellData, index) => (
              <div
                key={index}
                className={classNames(
                  'fill-height',
                  'simple-flex',
                  'column',
                  styles.column,
                  {
                    [styles.boldBackground]: cellData.displayText.isBold,
                    [styles.todayBackground]: cellData.isToday,
                  }
                )}
              >
                <div
                  className={classNames(
                    'fill-width',
                    'simple-flex',
                    'row',
                    styles.barOuterContainer
                  )}
                >
                  <div
                    className={classNames(
                      'simple-flex',
                      'fill-height',
                      styles.barInnerContainer
                    )}
                  >
                    <div
                      className={classNames(styles.bar)}
                      style={{ top: `${(1 - cellData.heightPercent) * 100}%` }}
                    >
                      <BarVisualizer
                        durationCounter={cellData.durationCounter}
                        onMouseEnter={onBarMouseEnter}
                        onMouseLeave={onBarMouseLeave}
                        highlightID={highlightID}
                      />
                    </div>
                  </div>
                </div>
                <div className={classNames(styles.totalText)}>
                  {prettyNumber(cellData.totalCount)}
                </div>
                <div
                  className={classNames(
                    'fill-width',
                    'row',
                    'top-margin',
                    styles.displayText,
                    {
                      [styles.boldDisplayText]: cellData.displayText.isBold,
                      [styles.todayDisplayText]: cellData.isToday,
                    }
                  )}
                >
                  {cellData.displayText.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
