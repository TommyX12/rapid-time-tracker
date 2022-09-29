import {
  ChangeEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { MainContext } from './Main';
import { ActionTree } from './ActionTree';
import styles from './Explorer.module.css';
import classNames from 'classnames';
import { Button, HTMLSelect } from '@blueprintjs/core';

import { DateRangeInput2 } from '@blueprintjs/datetime2';
import { DateRange } from '@blueprintjs/datetime';
import { Time } from '../utils/time';
import { Counter, firstGeq, prettyNumber, useNotifier } from '../utils/utils';
import { ActionID } from '../data/data-model';
import { Action, DataState, ROOT_ACTION_ID } from '../data/data-state';
import { BarVisualizer } from './BarVisualizer';
import Color from 'color';

const RELOAD_REGION_MS = 60000;
const DATE_RANGE_NUM_OPTIONS = 10;
const DATE_RANGE_OPTION_OFFSETS = (() => {
  const result: number[] = [];
  for (let i = 0; i < DATE_RANGE_NUM_OPTIONS; ++i) {
    result.push(-DATE_RANGE_NUM_OPTIONS + 1 + i);
  }
  return result;
})();

const DURATION_HEAT_COLOR = Color('rgba(0,165,255,0.43)');

interface UnitOption {
  label: string;
  period?: number;
  isPercentage?: boolean;
}

const UNIT_OPTIONS: UnitOption[] = [
  { label: 'Total' },
  { label: 'Percentage', isPercentage: true },
  { label: 'Per day', period: 1 },
  { label: 'Per week', period: 7 },
  { label: 'Per month', period: 30 },
  { label: 'Per year', period: 365 },
];

interface DateRangeOption {
  displayName: string;
  dateRange: DateRange;
}

interface RegionMode {
  name: string;
  enableCustomDateRange?: boolean;
  dateRangeFn?: () => DateRangeOption[] | undefined;
  defaultDateRangeFn?: () => DateRange | undefined;
  showZeroDurationCount?: boolean;
}

function clampToToday(time: Time) {
  const today = Time.now().floorToDays();
  if (today.lessThan(time)) {
    return today;
  }
  return time;
}

const REGION_MODES: RegionMode[] = [
  {
    name: 'All',
    dateRangeFn: () => undefined,
    showZeroDurationCount: true,
  },
  {
    name: 'Day',
    dateRangeFn: () =>
      DATE_RANGE_OPTION_OFFSETS.map((i) => {
        const start = Time.now().floorToDays().addDays(i);
        return {
          displayName: start.toMMDDString(),
          dateRange: [start.toDate(), clampToToday(start).toDate()],
        };
      }),
  },
  {
    name: 'Week',
    dateRangeFn: () =>
      DATE_RANGE_OPTION_OFFSETS.map((i) => {
        const start = Time.now()
          .floorToDays()
          .startOfMondayWeek()
          .addDays(i * 7);
        return {
          displayName: start.toMMDDString(),
          dateRange: [start.toDate(), clampToToday(start.addDays(6)).toDate()],
        };
      }),
  },
  {
    name: 'Month',
    dateRangeFn: () =>
      DATE_RANGE_OPTION_OFFSETS.map((i) => {
        const start = Time.now().floorToDays().startOfMonth().addMonths(i);
        return {
          displayName: start.toMMString(),
          dateRange: [
            start.toDate(),
            clampToToday(start.addMonths(1).addDays(-1)).toDate(),
          ],
        };
      }),
  },
  {
    name: 'Year',
    dateRangeFn: () =>
      DATE_RANGE_OPTION_OFFSETS.map((i) => {
        const start = Time.now().floorToDays().startOfYear().addYears(i);
        return {
          displayName: start.toYYYYString(),
          dateRange: [
            start.toDate(),
            clampToToday(start.addYears(1).addDays(-1)).toDate(),
          ],
        };
      }),
  },
  {
    name: 'Custom',
    enableCustomDateRange: true,
    defaultDateRangeFn: () => [
      Time.now().floorToDays().startOfMondayWeek().toDate(),
      Time.now().floorToDays().toDate(),
    ],
  },
];

function getCountingIndices(state: DataState, dateRange?: DateRange) {
  if (state.records.length === 0) return [undefined, undefined];
  let startTime: Time | undefined = undefined;
  let endTime: Time | undefined = undefined;
  let startIndex = 0;
  // Exclusive.
  let endIndex = state.records.length;
  if (dateRange !== undefined) {
    if (dateRange[0]) {
      startTime = Time.fromDate(dateRange[0]).floorToDays();
    }
    if (dateRange[1]) {
      endTime = Time.fromDate(dateRange[1]).floorToDays().addDays(1);
    }
  }
  if (startTime !== undefined) {
    startIndex = Math.max(
      startIndex,
      firstGeq(
        state.records,
        startTime,
        (a, b) => a.lessThan(b),
        (record) => record.model.time
      )
    );
  }
  if (endTime !== undefined) {
    endIndex = Math.min(
      endIndex,
      firstGeq(
        state.records,
        endTime,
        (a, b) => a.lessThan(b),
        (record) => record.model.time
      )
    );
  }
  return [startIndex, endIndex];
}

function getCounter(state: DataState, dateRange?: DateRange) {
  const result = new Counter<ActionID>();
  const [startIndex, endIndex] = getCountingIndices(state, dateRange);

  if (startIndex === undefined || endIndex === undefined) return result;

  for (let i = startIndex; i < endIndex; ++i) {
    const record = state.records[i];
    result.add(record.model.actionID, record.model.duration);
  }
  // Add children result to parent
  const dfs = (action: Action) => {
    let total = 0;

    for (const childID of action.childIDs) {
      const child = state.actions.get(childID);
      if (child !== undefined) {
        dfs(child);
        total += result.get(childID);
      }
    }

    result.add(action.model.id, total);
  };
  dfs(state.rootAction);
  return result;
}

function getTotal(state: DataState, dateRange?: DateRange) {
  let total = 0;
  const [startIndex, endIndex] = getCountingIndices(state, dateRange);

  if (startIndex === undefined || endIndex === undefined) return 0;

  for (let i = startIndex; i < endIndex; ++i) {
    const record = state.records[i];
    total += record.model.duration;
  }
  return total;
}

function getUnitMultiplier(
  unitOption: UnitOption,
  dateRange: [Date | null, Date | null] | undefined
) {
  return unitOption.period && dateRange && dateRange[0] && dateRange[1]
    ? unitOption.period /
        Time.fromDate(dateRange[0]).daysTo(
          Time.fromDate(dateRange[1]).addDays(1)
        )
    : 1;
}

export function Explorer() {
  const { state, updateState } = useContext(MainContext);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [regionMode, setRegionModeRaw] = useState<RegionMode>(REGION_MODES[0]);
  const [dateRangeOptions, setDateRangeOptions] = useState<
    DateRangeOption[] | undefined
  >(undefined);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);

  const handleDateRangeChange = useCallback((range: DateRange) => {
    setDateRange(range);
  }, []);

  const [unitOptionIndex, setUnitOptionIndex] = useState(0);

  const [updateHeightNotifier, notifyUpdateHeight] = useNotifier();

  const unitOption = useMemo(
    () => UNIT_OPTIONS[unitOptionIndex],
    [unitOptionIndex]
  );

  const onUnitOptionChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      setUnitOptionIndex(parseInt(e.target.value, 10));
    },
    []
  );

  const setSelectedOption = useCallback(
    (index: number) => {
      if (dateRangeOptions !== undefined && dateRangeOptions.length > 0) {
        setSelectedOptionIndex(index);
        setDateRange(dateRangeOptions[index].dateRange);
      }
    },
    [dateRangeOptions]
  );

  const loadRegionMode = useCallback(
    (newMode?: RegionMode) => {
      const mode = newMode === undefined ? regionMode : newMode;
      if (mode.dateRangeFn) {
        const options = mode.dateRangeFn();
        setDateRangeOptions(options);
        if (options !== undefined && options.length > 0) {
          const index = options.length - 1;
          setSelectedOptionIndex(index);
          setDateRange(options[index].dateRange);
        } else {
          setDateRange(undefined);
        }
      } else {
        setDateRangeOptions(undefined);
        if (dateRange === undefined) {
          setDateRange(mode.defaultDateRangeFn?.());
        }
      }

      notifyUpdateHeight();
    },
    [dateRange, notifyUpdateHeight, regionMode]
  );

  const setRegionMode = useCallback(
    (mode: RegionMode) => {
      setRegionModeRaw(mode);
      loadRegionMode(mode);
    },
    [loadRegionMode]
  );

  useEffect(() => {
    loadRegionMode();
    // We explicitly only want this to happen at the start
  }, []);

  useEffect(() => {
    const handle = setInterval(() => {
      // Re-load region mode if we are on the latest day
      // TODO: make a better method to always re-load region mode
      if (
        dateRangeOptions !== undefined &&
        selectedOptionIndex === dateRangeOptions.length - 1
      ) {
        loadRegionMode();
      }
    }, RELOAD_REGION_MS);
    return () => {
      clearInterval(handle);
    };
  }, [dateRangeOptions, loadRegionMode, selectedOptionIndex]);

  const durationCounter = useMemo(() => {
    return getCounter(state, dateRange);
  }, [dateRange, state]);

  const totalDuration = useMemo(() => {
    return durationCounter.get(ROOT_ACTION_ID);
  }, [durationCounter]);

  const unitMultiplier = useMemo(() => {
    if (unitOption.isPercentage) {
      return 1 / Math.max(totalDuration, 1e-5);
    }
    return getUnitMultiplier(unitOption, dateRange);
  }, [dateRange, totalDuration, unitOption]);

  const dateRangeOptionCounters = useMemo(() => {
    const byOption =
      dateRangeOptions === undefined
        ? []
        : dateRangeOptions.map((option) => getTotal(state, option.dateRange));
    return {
      total:
        byOption === undefined || byOption.length === 0
          ? 0
          : Math.max.apply(null, byOption),
      byOption,
    };
  }, [dateRangeOptions, state]);

  useEffect(() => {
    if (unitOption.period && !(dateRange && dateRange[0] && dateRange[1])) {
      setUnitOptionIndex(0);
    }
  }, [dateRange, unitOption.period]);

  return (
    <div className={classNames(styles.container, 'column')}>
      <div className={classNames('row', 'fill-width', 'bottom-margin')}>
        {REGION_MODES.map((mode) => (
          <Button
            key={mode.name}
            minimal
            active={regionMode.name === mode.name}
            className={classNames(styles.button, {
              [styles.inactiveButton]: regionMode.name !== mode.name,
            })}
            onClick={() => {
              setRegionMode(mode);
            }}
          >
            {mode.name}
          </Button>
        ))}
        <HTMLSelect
          options={UNIT_OPTIONS.map((option, index) => ({
            value: index,
            ...option,
          }))}
          minimal
          className={styles.unitOptions}
          value={unitOptionIndex}
          onChange={onUnitOptionChange}
        ></HTMLSelect>
      </div>
      {regionMode.enableCustomDateRange && (
        <div
          className={classNames(
            'row',
            'fill-width',
            'bottom-margin',
            styles.flexWrap
          )}
        >
          <DateRangeInput2
            disabled={!regionMode.enableCustomDateRange}
            className={styles.dateInput}
            popoverProps={{ placement: 'bottom-end' }}
            shortcuts
            allowSingleDayRange
            formatDate={(date) => {
              return Time.fromDate(date).toDateString();
            }}
            parseDate={(str) => {
              const time = Time.fromDateString(str);
              return time === undefined ? new Date() : time.toDate();
            }}
            closeOnSelection={false}
            value={dateRange}
            onChange={handleDateRangeChange}
          />
        </div>
      )}
      {dateRangeOptions && (
        <div
          className={classNames(
            'row',
            'fill-width',
            'bottom-margin',
            styles.flexWrap
          )}
        >
          {dateRangeOptions.map((option, index) => (
            <div
              className={classNames(
                styles.dateRangeOption,
                {
                  [styles.dateRangeOptionSelected]:
                    index === selectedOptionIndex,
                },
                'column'
              )}
              key={index}
              onClick={() => {
                setSelectedOption(index);
              }}
              style={{
                backgroundColor: DURATION_HEAT_COLOR.fade(
                  1.0 -
                    dateRangeOptionCounters.byOption[index] /
                      dateRangeOptionCounters.total
                ).toString(),
              }}
            >
              <div className={styles.dateRangeOptionName}>
                {option.displayName}
              </div>
              <div className={styles.dateRangeOptionSmallText}>
                {prettyNumber(
                  dateRangeOptionCounters.byOption[index] *
                    getUnitMultiplier(unitOption, option.dateRange)
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className={classNames('fill-width', 'simple-flex', 'top-margin')}>
        <div className={classNames('fill-height', 'simple-flex', 'row')}>
          <ActionTree
            durationCounter={durationCounter}
            showZeroDurationCount={regionMode.showZeroDurationCount}
            unitMultiplier={unitMultiplier}
            isPercentage={unitOption.isPercentage}
            updateHeightNotifier={updateHeightNotifier}
          />
          <div className={classNames('fill-height', styles.barVisualizer)}>
            {durationCounter && (
              <BarVisualizer
                durationCounter={durationCounter}
                unitMultiplier={unitMultiplier}
                isPercentage={unitOption.isPercentage}
              ></BarVisualizer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
