import { I18nProvider } from 'react-aria-components';
import { parseDate } from '@internationalized/date';
import { DatePicker } from '@/components/base/date-picker/date-picker';

const toDate = (value) => {
  if (!value) return null;
  try { return parseDate(value); } catch { return null; }
};

/**
 * BoardUI date picker that speaks the intranet's date format: value and onChange use
 * 'YYYY-MM-DD' strings ('' for none), and min / max work like on <input type="date">.
 * Calendar in Spanish, weeks starting on Monday (es-ES).
 */
export function DateInput({
  id, value, onChange, min, max, disabled, placeholder = 'Elegir fecha', triggerClassName, className,
  'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, 'aria-describedby': ariaDescribedBy, 'aria-invalid': ariaInvalid,
}) {
  return (
    <I18nProvider locale="es-ES">
        <DatePicker
          id={id}
          value={toDate(value)}
          onChange={(date) => onChange?.(date ? date.toString() : '')}
          minValue={toDate(min)}
          maxValue={toDate(max)}
          isDisabled={disabled}
          placeholder={placeholder}
          cancelLabel="Cancelar"
          applyLabel="Aplicar"
          chipLabel="Fecha (dd/mm/aaaa)"
          aria-label={ariaLabel || 'Fecha'}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          triggerClassName={triggerClassName}
          className={className}
        />
    </I18nProvider>
  );
}
