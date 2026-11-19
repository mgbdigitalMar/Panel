import { lazy, Suspense, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import inputStyles from '../Input/Input.module.scss';
import styles from './Select.module.scss';
import { toKey } from './selectKeys';

// react-aria joins the page right after it paints (as DateInput and the tooltips do), so the field
// costs the page nothing while it renders
const SelectMenu = lazy(() => import('./SelectMenu'));

/**
 * A dropdown field. `options`: [{ value, label, disabled? }]; `onChange` receives the value.
 * `variant="pill"`: the compact filter of the computer pages (DeskSelect). Without `label`, pass
 * `aria-label`.
 */
export function Select({ id: idProp, ...props }) {
  const autoId = useId();
  const id = idProp || autoId;
  return (
    <Suspense fallback={<StaticSelect id={id} {...props} />}>
      <SelectMenu id={id} {...props} />
    </Suspense>
  );
}

/** The closed field while the dropdown loads: the same box, label and value */
function StaticSelect({ label, value, options, required, className, variant, placeholder = 'Seleccionar…' }) {
  const pill = variant === 'pill';
  const current = options.find((o) => toKey(o.value) === toKey(value));
  return (
    <div className={clsx(pill ? styles.pillField : inputStyles.container, className)}>
      {label && (
        <span className={inputStyles.label}>
          {label} {required && <span className={inputStyles.asterisk} aria-hidden="true">*</span>}
        </span>
      )}
      <div className={clsx(pill ? styles.pill : inputStyles.input, styles.trigger)} aria-hidden="true">
        <span className={styles.value} data-placeholder={current ? undefined : true}>{current ? current.label : placeholder}</span>
        <ChevronDown size={pill ? 14 : 16} className={styles.chevron} />
      </div>
    </div>
  );
}
