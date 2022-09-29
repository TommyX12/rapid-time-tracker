import { Counter, prettyNumber } from '../utils/utils';
import { ActionID } from '../data/data-model';
import classNames from 'classnames';
import { useContext, useMemo } from 'react';
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
}: {
  action: Action;
  state: DataState;
  durationCounter: Counter<ActionID>;
  unitMultiplier?: number;
  isPercentage?: boolean;
}) => {
  const children: { height: string; bar: JSX.Element }[] = [];
  const selfDuration = durationCounter.get(action.model.id);
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
              />
            ),
          });
        }
      }
    }
  }
  const canonicalName = useMemo(() => action.getCanonicalName(state), [action]);
  return (
    <div className={classNames('fill-parent', 'row')}>
      {action.isRoot ? undefined : (
        <Tooltip2
          content={`(${prettyNumber(
            selfDuration * unitMultiplier,
            isPercentage
          )}) ${canonicalName}`}
          className={classNames('fill-height', styles.selfBox)}
          position="left-top"
        >
          <div
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
}: {
  durationCounter: Counter<ActionID>;
  unitMultiplier?: number;
  isPercentage?: boolean;
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
      />
    ),
    [durationCounter, isPercentage, state, unitMultiplier]
  );

  return <div className={classNames('fill-parent')}>{child}</div>;
};
