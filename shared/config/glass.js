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
  // Separate surface opacity from blur: a dense fill otherwise hides the stronger optics.
  const density = {
    off: { card: 1, chrome: 1, popover: 1, native: 1, blur: 0 },
    soft: { card: 0.92, chrome: 0.9, popover: 0.97, native: 0.64, blur: 20 },
    normal: { card: 0.78, chrome: 0.74, popover: 0.92, native: 0.3, blur: 45 },
    // Preserve the original full-strength material at the last slider stop.
    strong: { card: dark ? 0.58 : 0.68, chrome: dark ? 0.66 : 0.75, popover: 0.88, blur: 100 },
  }[level];
  return {
    strength,
    blur: strength === 0 ? 0 : Math.round(12 + strength * 20),
    blurIntensity: density.blur,
    nativeStyle: level === 'off' ? 'none' : 'regular',
    nativeTint: level === 'strong' ? undefined : fill(density.native),
    card: fill(density.card),
    chrome: fill(density.chrome),
    popover: fill(density.popover),
    sheen: strength * (dark ? 0.12 : 0.4),
  };
}
