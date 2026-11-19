// react-aria item ids cannot be empty: an option whose value is '' («Seleccionar empleado…») gets
// this key instead
const EMPTY = '__empty__';

export const toKey = (value) => (value === '' || value == null ? EMPTY : String(value));
