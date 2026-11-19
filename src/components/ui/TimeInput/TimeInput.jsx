import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, DialogTrigger, ListBox, ListBoxItem, Popover } from 'react-aria-components';
import { Clock } from 'lucide-react';
import clsx from 'clsx';
import styles from './TimeInput.module.scss';

const pad = (n) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, h) => pad(h));
const STEP_MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5));
const DEFAULT_HOUR = '09';

/** "HH:MM" → [hour, minute] as two-digit strings, or [null, null] */
function parse(value) {
  const m = /^(\d{1,2}):(\d{2})/.exec(value || '');
  return m ? [pad(Number(m[1])), m[2]] : [null, null];
}

/**
 * Time field: the intranet's field style, and a glass popover with two scrolling columns (hours,
 * minutes in steps of five) instead of the browser's own time input, which looks different in
 * every browser. Choosing the hour keeps it open, choosing the minutes closes it. Keyboard: arrows
 * within a column, Tab to the other one, Enter to choose, Escape to close. `value` and `onChange`
 * use "HH:MM", like <input type="time">.
 */
export function TimeInput({
  id, value, onChange, disabled, placeholder = 'Elegir hora', triggerClassName,
  'aria-labelledby': ariaLabelledBy, 'aria-label': ariaLabel, 'aria-describedby': ariaDescribedBy, 'aria-invalid': ariaInvalid,
}) {
  const [open, setOpen] = useState(false);
  const [hour, minute] = parse(value);
  // A minute off the five-minute grid (an old booking at 09:07) is still listed and shown chosen
  const minutes = minute && !STEP_MINUTES.includes(minute) ? [...STEP_MINUTES, minute].sort() : STEP_MINUTES;
  const panel = useRef(null);

  // The chosen hour and minute start in the middle of their columns; with no time yet, the hours
  // open on the start of the working day
  useEffect(() => {
    if (!open) return undefined;
    const raf = requestAnimationFrame(() => {
      const lists = panel.current?.querySelectorAll('[role=listbox]') || [];
      lists.forEach((list, i) => {
        const target = list.querySelector('[data-selected]') || (i === 0 ? list.querySelector(`[data-key="${DEFAULT_HOUR}"]`) : null);
        if (target) list.scrollTop = target.offsetTop - (list.clientHeight - target.offsetHeight) / 2;
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const pick = (h, m, close) => {
    onChange(`${h}:${m}`);
    if (close) setOpen(false);
  };

  return (
    <DialogTrigger isOpen={open} onOpenChange={setOpen}>
      <Button
        id={id}
        isDisabled={disabled}
        className={clsx(triggerClassName, styles.trigger)}
        aria-labelledby={ariaLabelledBy}
        aria-label={ariaLabelledBy ? undefined : ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid || undefined}
        data-empty={value ? undefined : true}
      >
        <Clock size={16} className={styles.icon} aria-hidden="true" />
        <span className={styles.value}>{value ? `${hour}:${minute}` : placeholder}</span>
      </Button>
      <Popover className={clsx(styles.popover, 't-pop-aria')} placement="bottom start" offset={6}>
        <Dialog className={styles.dialog} aria-label="Elegir hora">
          <div ref={panel} className={styles.columns}>
            <div className={styles.column}>
              <span className={styles.head} aria-hidden="true">Hora</span>
              <ListBox
                aria-label="Hora"
                className={styles.list}
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={hour ? [hour] : []}
                onSelectionChange={(keys) => { const [h] = keys; if (h) pick(h, minute || '00', false); }}
                // Opening puts the keyboard on the chosen hour; with none yet, Tab enters the column
                autoFocus={Boolean(hour)}
              >
                {HOURS.map((h) => <ListBoxItem key={h} id={h} className={styles.cell} textValue={h}>{h}</ListBoxItem>)}
              </ListBox>
            </div>
            <span className={styles.colon} aria-hidden="true">:</span>
            <div className={styles.column}>
              <span className={styles.head} aria-hidden="true">Min</span>
              <ListBox
                aria-label="Minutos"
                className={styles.list}
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={minute ? [minute] : []}
                onSelectionChange={(keys) => { const [m] = keys; if (m) pick(hour || DEFAULT_HOUR, m, true); }}
              >
                {minutes.map((m) => <ListBoxItem key={m} id={m} className={styles.cell} textValue={m}>{m}</ListBoxItem>)}
              </ListBox>
            </div>
          </div>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
