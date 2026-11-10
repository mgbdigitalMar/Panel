export const GLASS_STORAGE_KEY = 'margube-glass-intensity';
export const GLASS_OPTIONS = [
  { value: 'off', label: 'Sin efecto' },
  { value: 'soft', label: 'Suave' },
  { value: 'normal', label: 'Normal' },
  { value: 'strong', label: 'Intenso' },
];

export function normalizeGlass(value) {
  return GLASS_OPTIONS.some((option) => option.value === value) ? value : 'normal';
}

export function glassMaterial(value, dark = false) {
  const level = normalizeGlass(value);
  const strength = { off: 0, soft: 0.35, normal: 0.65, strong: 1 }[level];
  const rgb = dark ? '24,23,29' : '255,255,255';
  const fill = (alpha) => `rgba(${rgb},${alpha})`;
  return {
    strength,
    blur: strength === 0 ? 0 : Math.round(12 + strength * 20),
    card: fill(1 - strength * (dark ? 0.42 : 0.32)),
    chrome: fill(1 - strength * (dark ? 0.34 : 0.25)),
    popover: fill(1 - strength * 0.12),
    sheen: strength * (dark ? 0.12 : 0.4),
  };
}
