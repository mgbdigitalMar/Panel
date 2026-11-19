import { Button, Label, ListBox, ListBoxItem, Popover, Select as AriaSelect, SelectValue } from 'react-aria-components';
import { Check, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import inputStyles from '../Input/Input.module.scss';
import styles from './Select.module.scss';
import { toKey } from './selectKeys';

/**
 * The dropdown itself (react-aria): a listbox anchored under the field on every screen size, never
 * the operating system's full-screen picker. Keyboard, typeahead, screen readers and the hidden
 * <select> for forms come from react-aria; the open/close motion is .t-pop-aria
 * (_transitions.scss). Loaded by Select.jsx right after the page paints.
 */
export default function SelectMenu({
  label, value, onChange, options, required, className, loading, disabled, id, variant,
  placeholder = 'Seleccionar…', 'aria-label': ariaLabel, name,
}) {
  const pill = variant === 'pill';
  const disabledKeys = options.filter((o) => o.disabled).map((o) => toKey(o.value));
  return (
    <AriaSelect
      id={id}
      name={name}
      className={clsx(pill ? styles.pillField : inputStyles.container, className)}
      selectedKey={toKey(value)}
      onSelectionChange={(key) => {
        const option = options.find((o) => toKey(o.value) === key);
        if (option && option.value !== value) onChange(option.value);
      }}
      disabledKeys={disabledKeys}
      isDisabled={disabled || loading}
      isRequired={required}
      placeholder={placeholder}
      aria-label={label ? undefined : ariaLabel}
    >
      {label && (
        <Label className={inputStyles.label}>
          {label} {required && <span className={inputStyles.asterisk} aria-hidden="true">*</span>}
          {/* A button cannot carry aria-required: the label says it to screen readers instead */}
          {required && <span className="sr-only"> (obligatorio)</span>}
        </Label>
      )}
      <Button className={clsx(pill ? styles.pill : inputStyles.input, styles.trigger)} aria-busy={loading || undefined}>
        {/* Only the option's text: its whole content would bring the hidden tick along */}
        <SelectValue className={styles.value}>
          {({ selectedText, isPlaceholder }) => (isPlaceholder ? placeholder : selectedText)}
        </SelectValue>
        <ChevronDown size={pill ? 14 : 16} className={styles.chevron} aria-hidden="true" />
      </Button>
      <Popover className={clsx(styles.popover, 't-pop-aria')} placement="bottom start" offset={6}>
        <ListBox className={styles.list}>
          {options.map((o) => (
            <ListBoxItem key={toKey(o.value)} id={toKey(o.value)} textValue={String(o.label)} className={styles.option}>
              <span className={styles.optionLabel}>{o.label}</span>
              <Check size={15} strokeWidth={2.4} className={styles.check} aria-hidden="true" />
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}
