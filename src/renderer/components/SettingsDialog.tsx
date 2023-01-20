import { useCallback, useContext, useMemo, useState } from 'react';

import styles from './SettingsDialog.module.css';
import { MainContext } from './Main';
import classNames from 'classnames';
import { Button, Checkbox, NumericInput } from '@blueprintjs/core';

export const SettingsDialog = ({ onDone }: { onDone?: () => void }) => {
  const { state, updateState } = useContext(MainContext);

  const [done, setDone] = useState(false);

  const [defaultRecordUnits, setDefaultRecordUnits] = useState(
    state.settings.defaultRecordUnits
  );
  const [defaultRecordUnitsText, setDefaultRecordUnitsText] = useState(
    `${defaultRecordUnits}`
  );
  const [hoursPerUnit, setHoursPerUnit] = useState(state.settings.hoursPerUnit);
  const [hoursPerUnitText, setHoursPerUnitText] = useState(`${hoursPerUnit}`);

  const [shouldRescale, setShouldRescale] = useState(false);

  const hoursPerUnitChanged = useMemo(() => {
    return state.settings.hoursPerUnit !== hoursPerUnit;
  }, [hoursPerUnit, state.settings.hoursPerUnit]);

  const save = useCallback(() => {
    // Prevent double saving
    if (done) return;

    if (!Number.isFinite(defaultRecordUnits) || defaultRecordUnits <= 0) {
      alert('Invalid default units for new records');
      return;
    }

    if (!Number.isFinite(hoursPerUnit) || hoursPerUnit <= 0) {
      alert('Invalid hour(s) per unit');
      return;
    }

    const oldHoursPerUnit = state.settings.hoursPerUnit;

    let newState = state.updateSettings((draft) => {
      draft.defaultRecordUnits = defaultRecordUnits;
      draft.hoursPerUnit = hoursPerUnit;
    });

    if (shouldRescale) {
      newState = newState.rescaleAllRecords(oldHoursPerUnit, hoursPerUnit);
    }

    updateState(newState);

    setDone(true);
    onDone?.();
  }, [
    defaultRecordUnits,
    done,
    hoursPerUnit,
    onDone,
    shouldRescale,
    state,
    updateState,
  ]);

  const onSaveButtonClick = useCallback(() => {
    save();
  }, [save]);

  const handleHoursPerUnitChange = useCallback(
    (value: number, valueText: string) => {
      setHoursPerUnit(value);
      setHoursPerUnitText(valueText);
    },
    []
  );

  const handleDefaultRecordUnitsChange = useCallback(
    (value: number, valueText: string) => {
      setDefaultRecordUnits(value);
      setDefaultRecordUnitsText(valueText);
    },
    []
  );

  return (
    <div className={styles.container}>
      <div className={styles.row}>
        <div className={styles.labelText}>Default units for new records</div>
        <div className="hfill"></div>
        <NumericInput
          placeholder="Units"
          style={{ width: '100px' }}
          value={defaultRecordUnitsText}
          onValueChange={handleDefaultRecordUnitsChange}
          min={0}
        />
      </div>
      <div className={classNames(styles.row, styles.marginTop)}>
        <div className={styles.labelText}>Hour(s) per unit</div>
        <div className="hfill"></div>
        <NumericInput
          placeholder="Hours"
          style={{ width: '100px' }}
          value={hoursPerUnitText}
          onValueChange={handleHoursPerUnitChange}
          min={0}
        />
      </div>
      <div className={classNames(styles.row)}>
        <div className="hfill"></div>
        <Checkbox
          disabled={!hoursPerUnitChanged}
          checked={shouldRescale}
          label="Rescale database if unit changed"
          onChange={(e) => {
            setShouldRescale(e.currentTarget.checked);
          }}
        />
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
