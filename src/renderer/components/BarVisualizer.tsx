import { Counter, prettyNumber } from '../utils/utils';
import { ActionID } from '../data/data-model';
import classNames from 'classnames';
import { useContext, useLayoutEffect, useMemo, useRef } from 'react';
import { MainContext } from './Main';
import { Action, DataState } from '../data/data-state';

import styles from './BarVisualizer.module.css';
import { Tooltip2 } from '@blueprintjs/popover2';

const Bar = ({
  action,
  state,
  durationCounter,
  unitMultiplier = 1,
  isPercentage = false,
  onMouseEnter,
  onMouseLeave,
  highlightID,
  shouldHighlight,
}: {
  action: Action;
  state: DataState;
  durationCounter: Counter<ActionID>;
  unitMultiplier?: number;
  isPercentage?: boolean;
  onMouseEnter?: (id: ActionID) => void;
  onMouseLeave?: (id: ActionID) => void;
  highlightID?: ActionID;
  shouldHighlight: boolean;
}) => {
  const selfBlockRef = useRef<HTMLDivElement>(null);
  const children: { height: string; bar: JSX.Element }[] = [];
  const selfDuration = durationCounter.get(action.model.id);
  const highlight =
    shouldHighlight ||
    highlightID === undefined ||
    highlightID === action.model.id;
  if (selfDuration > 0) {
    for (const childID of action.childIDs) {
      const child = state.actions.get(childID);
      if (child !== undefined) {
        const duration = durationCounter.get(childID);
        if (duration > 0) {
          children.push({
            height: `${(duration / selfDuration) * 100}%`,
            bar: (
              <Bar
                action={child}
                state={state}
                durationCounter={durationCounter}
                isPercentage={isPercentage}
                unitMultiplier={unitMultiplier}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                highlightID={highlightID}
                shouldHighlight={highlight}
              />
            ),
          });
        }
      }
    }
  }
  const canonicalName = useMemo(() => action.getCanonicalName(state), [action]);

  useLayoutEffect(() => {
    const ref = selfBlockRef.current;
    if (!ref) return undefined;
    const onEnter = () => {
      onMouseEnter?.(action.model.id);
      // console.log('entering ' + action.model.id);
    };
    const onLeave = () => {
      onMouseLeave?.(action.model.id);
      // console.log('leaving ' + action.model.id);
    };
    ref.addEventListener('mouseenter', onEnter);
    ref.addEventListener('mouseleave', onLeave);
    return () => {
      ref.removeEventListener('mouseenter', onEnter);
      ref.removeEventListener('mouseleave', onLeave);
    };
  }, [action.model.id, canonicalName, onMouseEnter, onMouseLeave]);

  return (
    <div className={classNames('fill-parent', 'row')}>
      {action.isRoot ? undefined : (
        <Tooltip2
          content={`(${prettyNumber(
            selfDuration * unitMultiplier,
            isPercentage
          )}) ${canonicalName}`}
          className={classNames('fill-height', styles.selfBox, {
            [styles.dim]: !highlight,
          })}
          position="left-top"
        >
          <div
            ref={selfBlockRef}
            style={{ backgroundColor: action.model.color.toString() }}
            className="fill-parent"
          />
        </Tooltip2>
      )}
      {children.length > 0 ? (
        <div className={classNames(styles.childBox, 'fill-height')}>
          {children.map(({ bar, height }, index) => (
            <div
              key={index}
              className={classNames('fill-width')}
              style={{ height }}
            >
              {bar}
            </div>
          ))}
        </div>
      ) : undefined}
    </div>
  );
};

export const BarVisualizer = ({
  durationCounter,
  unitMultiplier = 1,
  isPercentage = false,
  onMouseEnter,
  onMouseLeave,
  highlightID,
}: {
  durationCounter: Counter<ActionID>;
  unitMultiplier?: number;
  isPercentage?: boolean;
  onMouseEnter?: (id: ActionID) => void;
  onMouseLeave?: (id: ActionID) => void;
  highlightID?: ActionID;
}) => {
  const { state } = useContext(MainContext);

  const child = useMemo(
    () => (
      <Bar
        state={state}
        action={state.rootAction}
        durationCounter={durationCounter}
        unitMultiplier={unitMultiplier}
        isPercentage={isPercentage}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        highlightID={highlightID}
        shouldHighlight={false}
      />
    ),
    [
      durationCounter,
      highlightID,
      isPercentage,
      onMouseEnter,
      onMouseLeave,
      state,
      unitMultiplier,
    ]
  );

  return <div className={classNames('fill-parent')}>{child}</div>;
};
