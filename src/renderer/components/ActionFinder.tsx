import {
  CSSProperties,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { MainContext } from './Main';

import styles from './ActionFinder.module.css';
import { Action, DataState, ROOT_ACTION_ID } from '../data/data-state';
import {
  VirtualScroller,
  VirtualScrollerContext,
} from '../utils/VirtualScroller';
import classNames from 'classnames';
import { ActionID } from '../data/data-model';
import { Time } from '../utils/time';
import { clampedLinearMap, lerp } from '../utils/utils';

const ITEM_HEIGHT = 27;
const RECENCY_DAYS = 14;
const RECENCY_STRENGTH = 0.1;
const RECENCY_PARENT_DECAY = 0.1;

export function sanitizesQueryString(queryString: string) {
  return queryString
    .toLowerCase()
    .split(':')
    .map((part) => part.trim())
    .join(': ');
}

interface ActionFinderEntry {
  key: string;
  canonicalName: string;
  action: Action;
}

export interface ActionFinderQueryResultEntry {
  score: number;
  entry: ActionFinderEntry;
}

class ActionFinderIndex {
  entries: ActionFinderEntry[] = [];
  recencyPriors = new Map<ActionID, number>();

  constructor(state: DataState) {
    state.actions.forEach((action) => {
      if (action.isRoot) return;
      const canonicalName = action.getCanonicalName(state);
      const key = canonicalName.toLowerCase();
      this.entries.push({ key, canonicalName, action });
    });
    this.entries.sort((a, b) => a.key.localeCompare(b.key));

    // Recency bonus
    const recencyStart = Time.now().addDays(-RECENCY_DAYS);
    const recencyEnd = Time.now();
    const records = state.getRecordsInRange(recencyStart, recencyEnd);
    records.forEach(({ record }) => {
      const bonus = clampedLinearMap(
        recencyStart.seconds,
        recencyEnd.seconds,
        0,
        RECENCY_STRENGTH,
        record.model.time.seconds
      );
      this.recencyPriors.set(record.model.actionID, 1 + bonus);
    });
    // Propagate to parents
    state.dfs(ROOT_ACTION_ID, {
      postOrder: (action, level) => {
        let prior = this.recencyPriors.get(action.model.id) || 1;
        for (const childID of action.childIDs) {
          prior = Math.max(
            prior,
            lerp(this.recencyPriors.get(childID) || 1, 1, RECENCY_PARENT_DECAY)
          );
        }
        this.recencyPriors.set(action.model.id, prior);
      },
    });
  }

  query(
    rawQueryString: string,
    maxEntries: number = -1,
    prohibitedIDs?: Set<ActionID>
  ) {
    // Process query string.
    const queryString = sanitizesQueryString(rawQueryString);
    const parentPathLength = queryString.lastIndexOf(':');
    const parentPath =
      parentPathLength >= 0
        ? queryString.substring(0, parentPathLength + 1)
        : undefined;
    const patternIndex = parentPathLength >= 0 ? parentPathLength + 2 : 0;
    const queryStringLen = queryString.length;

    const results: ActionFinderQueryResultEntry[] = [];
    const n = this.entries.length;
    for (let i = 0; i < n; ++i) {
      const entry = this.entries[i];
      const { key } = entry;

      // Filter the entry.
      if (
        prohibitedIDs !== undefined &&
        prohibitedIDs.has(entry.action.model.id)
      ) {
        continue;
      }
      if (parentPath !== undefined && !key.startsWith(parentPath)) {
        continue;
      }

      // Score the entry.

      const keyLen = key.length;

      let forwardScore = 0;
      let a = patternIndex;
      let b = patternIndex;
      let lastMatchedB = -1;
      while (a < queryStringLen && b < keyLen) {
        if (queryString.charAt(a) === key.charAt(b)) {
          ++a;
          if (lastMatchedB === -1) {
            forwardScore += 2.0;
          } else {
            forwardScore += 1.0 + 1.0 / (b - lastMatchedB);
          }
          /*
          if (keyLen - patternIndex > 0) {
            forwardScore += 1.0 - (b - patternIndex) / (keyLen - patternIndex);
          }
          */
          lastMatchedB = b;
        }
        ++b;
      }
      if (a !== queryStringLen) continue; // No match
      // Normalize
      forwardScore /= 2.0 * (queryStringLen - patternIndex + 1e-5);

      let backwardScore = 0;
      a = queryStringLen - 1;
      b = keyLen - 1;
      lastMatchedB = keyLen;
      while (a >= patternIndex && b >= patternIndex) {
        if (queryString.charAt(a) === key.charAt(b)) {
          --a;
          if (lastMatchedB === -1) {
            backwardScore += 2.0;
          } else {
            backwardScore += 1.0 + 1.0 / (lastMatchedB - b);
          }
          /*
          if (keyLen - patternIndex > 0) {
            backwardScore += (b - patternIndex) / (keyLen - patternIndex);
          }
          */
          lastMatchedB = b;
        }
        --b;
      }
      // Normalize
      backwardScore /= 2.0 * (queryStringLen - patternIndex + 1e-5);

      /*
      const lengthScore =
        (queryStringLen - patternIndex) / (keyLen - patternIndex);
      */
      // Adding a small number allow a "0" score to also benefit from score multiplier.
      let score = backwardScore + 1e-5;
      // score += Math.max(forwardScore, backwardScore);

      const prior = this.recencyPriors.get(entry.action.model.id) || 1;
      score *= prior;

      if (a === b && queryStringLen === keyLen) {
        // Exact match
        score += 1000000;
      }

      results.push({ score, entry });
    }

    results.sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }
      return a.entry.key.localeCompare(b.entry.key);
    });

    if (maxEntries <= 0) {
      return results;
    }
    return results.slice(0, maxEntries);
  }
}

interface ActionFinderSharedData {
  selectedIndex: number;
  setSelectedIndex: (value: number) => void;
  onDoubleClick?: (index: number) => void;
}

const ActionFinderItemView = ({
  index,
  data,
  style,
}: {
  index: number;
  data: VirtualScrollerContext<
    ActionFinderQueryResultEntry,
    ActionFinderSharedData
  >;
  style?: CSSProperties;
}) => {
  const entry = data.itemDataList[index];

  const onClick = useCallback(() => {
    data.sharedData.setSelectedIndex(index);
  }, [data.sharedData, index]);

  const onDoubleClick = useCallback(() => {
    data.sharedData.onDoubleClick?.(index);
  }, [data.sharedData, index]);

  return (
    <div style={style} className={styles.itemContainer}>
      <div
        className={classNames(styles.item, {
          [styles.internalItem]: entry.entry.action.isGroup,
          [styles.selectedItem]: data.sharedData.selectedIndex === index,
        })}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      >
        <div className={styles.itemText}>{entry.entry.canonicalName}</div>
      </div>
    </div>
  );
};

export interface ActionFinderRef {
  prevSelection: () => void;
  nextSelection: () => void;
}

export const ActionFinder = forwardRef(
  (
    {
      queryString,
      maxEntries = -1,
      onSelectedEntryChanged,
      onDoubleClick,
      specialText,
      allowEmptyQueryString,
      prohibitedIDs,
    }: {
      queryString: string;
      maxEntries?: number;
      onSelectedEntryChanged?: (
        entry: ActionFinderQueryResultEntry | undefined
      ) => void;
      onDoubleClick?: (index: number) => void;
      specialText?: string;
      allowEmptyQueryString?: boolean;
      prohibitedIDs?: Set<ActionID>;
    },
    ref
  ) => {
    const { state } = useContext(MainContext);

    const index = useMemo(() => new ActionFinderIndex(state), [state]);

    const results: ActionFinderQueryResultEntry[] = useMemo(() => {
      if (!allowEmptyQueryString && queryString.trim().length === 0) {
        return [];
      }
      return index.query(queryString, maxEntries, prohibitedIDs);
    }, [allowEmptyQueryString, index, maxEntries, prohibitedIDs, queryString]);

    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [results]);

    const sharedData = useMemo(() => {
      return {
        selectedIndex,
        setSelectedIndex,
        onDoubleClick,
      };
    }, [onDoubleClick, selectedIndex]);

    useEffect(() => {
      onSelectedEntryChanged?.(results[selectedIndex]);
    }, [selectedIndex, results, onSelectedEntryChanged]);

    useImperativeHandle(ref, () => ({
      prevSelection: () => {
        if (results.length !== 0) {
          let i = selectedIndex - 1;
          if (i < 0) i = results.length - 1;
          setSelectedIndex(i);
        }
      },
      nextSelection: () => {
        if (results.length !== 0) {
          let i = selectedIndex + 1;
          if (i >= results.length) i = 0;
          setSelectedIndex(i);
        }
      },
    }));

    return (
      <div className={styles.container}>
        {specialText === undefined ? (
          <VirtualScroller
            itemHeight={ITEM_HEIGHT}
            itemDataList={results}
            sharedData={sharedData}
            focusIndex={selectedIndex}
          >
            {ActionFinderItemView}
          </VirtualScroller>
        ) : (
          <div>{specialText}</div>
        )}
      </div>
    );
  }
);
