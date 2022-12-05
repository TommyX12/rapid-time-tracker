import { useCallback } from 'react';
import { DateInput2 } from '@blueprintjs/datetime2';
import { Time } from '../utils/time';
import styles from './DateTimeInput.module.css';
import { TimePrecision } from '@blueprintjs/datetime';

const MIN_DATE = new Date(0);
const MAX_DATE = new Date(9999, 0, 1);

export function DateTimeInput({
  value,
  onValueChange,
}: {
  value: Time;
  onValueChange: (value: Time) => void;
}) {
  // This is ISO string
  const handleDateChange = useCallback(
    (newDate: string | null) => {
      const time =
        newDate === null
          ? Time.now().floorToDays()
          : Time.fromDate(new Date(Date.parse(newDate))).floorToDays();
      onValueChange(time);
    },
    [onValueChange]
  );

  return (
    <DateInput2
      className={styles.dateInput}
      popoverProps={{ placement: 'bottom-end' }}
      showTimezoneSelect={false}
      timePickerProps={{
        showArrowButtons: false,
        useAmPm: false,
        disabled: true,
      }}
      timePrecision={TimePrecision.SECOND}
      showActionsBar
      formatDate={(date) => {
        return Time.fromDate(date).toDateString();
      }}
      parseDate={(str) => {
        const time = Time.fromDateString(str);
        return time === undefined ? new Date() : time.toDate();
      }}
      closeOnSelection={false}
      value={value.toDate().toISOString()}
      onChange={handleDateChange}
      maxDate={MAX_DATE}
      minDate={MIN_DATE}
    />
  );
}
