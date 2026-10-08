// "Margube Glass" tokens, taken from the design file (Fundamentos · tokens y componentes).
// Each palette is the same shape so components never branch on the theme name.

export const FONTS = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semibold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
  mono: 'GeistMono_500Medium',
  monoBold: 'GeistMono_600SemiBold',
};

export const RADII = { sm: 12, md: 16, lg: 20, xl: 26, pill: 999 };

const dark = {
  name: 'dark',
  bg: '#0A0C10',
  bg2: '#11141B',
  card: '#15181F',
  text: '#F5F6F8',
  text2: '#B8BEC9',
  text3: '#8D95A3',
  muted: '#8D95A3',
  accent: '#7AA2FF',
  onAccent: '#0A0C10',
  accentFg: '#7AA2FF',
  accentSoft: 'rgba(122,162,255,0.14)',
  accentBorder: 'rgba(122,162,255,0.4)',
  danger: '#FB7185',
  dangerFg: '#FB7185',
  dangerSoft: 'rgba(251,113,133,0.16)',
  dangerBorder: 'rgba(251,113,133,0.35)',
  success: '#34D399',
  successFg: '#34D399',
  successSoft: 'rgba(52,211,153,0.16)',
  warning: '#F5B544',
  warningFg: '#F5B544',
  warningSoft: 'rgba(245,181,68,0.16)',
  tealFg: '#5EE0D5',
  tealSoft: 'rgba(94,224,213,0.18)',
  purpleFg: '#B49BFF',
  purpleSoft: 'rgba(180,155,255,0.18)',
  glass: 'rgba(21,24,31,0.75)',
  glassStrong: 'rgba(21,24,31,0.92)',
  glassBorder: 'rgba(255,255,255,0.13)',
  glassBorderStrong: 'rgba(255,255,255,0.22)',
  inputBg: 'rgba(17,20,27,0.85)',
  inputBorder: 'rgba(255,255,255,0.15)',
  divider: 'rgba(255,255,255,0.1)',
  segTrack: 'rgba(255,255,255,0.06)',
  segOn: '#7AA2FF',
  segOnText: '#0A0C10',
  chipOnBg: '#7AA2FF',
  chipOnText: '#0A0C10',
  navBg: 'rgba(12,15,22,0.78)',
  navBorder: 'rgba(255,255,255,0.14)',
  navBorderTop: 'rgba(255,255,255,0.25)',
  navActive: 'rgba(122,162,255,0.2)',
  sheetBg: '#15181F',
  overlay: 'rgba(0,0,0,0.65)',
  plateBg: '#F5F6F8',
  plateText: '#0A0C10',
  glowA: '#7AA2FF',
  glowAOpacity: 0.5,
  glowB: '#0E9F9A',
  glowBOpacity: 0.35,
  shadow: 'rgba(0,0,0,0.5)',
  statusBar: 'light',
};

const light = {
  name: 'light',
  bg: '#F2F4F8',
  bg2: '#FFFFFF',
  card: '#FFFFFF',
  text: '#11141B',
  text2: '#4A5263',
  text3: '#8D95A3',
  muted: '#8D95A3',
  accent: '#2F5BEA',
  onAccent: '#FFFFFF',
  accentFg: '#2F5BEA',
  accentSoft: 'rgba(47,91,234,0.08)',
  accentBorder: 'rgba(47,91,234,0.3)',
  danger: '#E11D48',
  dangerFg: '#E11D48',
  dangerSoft: 'rgba(225,29,72,0.09)',
  dangerBorder: 'rgba(225,29,72,0.25)',
  success: '#059669',
  successFg: '#059669',
  successSoft: 'rgba(5,150,105,0.1)',
  warning: '#D97706',
  warningFg: '#D97706',
  warningSoft: 'rgba(217,119,6,0.12)',
  tealFg: '#0284C7',
  tealSoft: 'rgba(2,132,199,0.1)',
  purpleFg: '#7C3AED',
  purpleSoft: 'rgba(124,58,237,0.1)',
  glass: 'rgba(255,255,255,0.85)',
  glassStrong: 'rgba(255,255,255,0.95)',
  glassBorder: 'rgba(227,230,236,0.9)',
  glassBorderStrong: 'rgba(201,206,215,0.9)',
  inputBg: '#FFFFFF',
  inputBorder: 'rgba(227,230,236,0.95)',
  divider: 'rgba(227,230,236,0.7)',
  segTrack: 'rgba(231,234,240,0.85)',
  segOn: '#FFFFFF',
  segOnText: '#11141B',
  chipOnBg: '#2F5BEA',
  chipOnText: '#FFFFFF',
  navBg: 'rgba(255,255,255,0.82)',
  navBorder: 'rgba(215,222,235,0.85)',
  navBorderTop: 'rgba(255,255,255,0.95)',
  navActive: 'rgba(47,91,234,0.12)',
  sheetBg: '#FFFFFF',
  overlay: 'rgba(17,20,27,0.4)',
  plateBg: '#11141B',
  plateText: '#FFFFFF',
  glowA: '#5B7CFF',
  glowAOpacity: 0.35,
  glowB: '#0EA5E9',
  glowBOpacity: 0.25,
  shadow: 'rgba(17,20,27,0.08)',
  statusBar: 'dark',
};

export const PALETTES = { dark, light };

/** Tone triplets used by pills and icon tiles: [background, foreground]. */
export function tone(c, name) {
  switch (name) {
    case 'pending': case 'warning': case 'amber': return [c.warningSoft, c.warningFg];
    case 'approved': case 'confirmed': case 'success': case 'green': case 'completed': case 'signed': return [c.successSoft, c.successFg];
    case 'rejected': case 'danger': case 'rose': return [c.dangerSoft, c.dangerFg];
    case 'accent': case 'blue': return [c.accentSoft, c.accentFg];
    case 'teal': return [c.tealSoft, c.tealFg];
    case 'purple': return [c.purpleSoft, c.purpleFg];
    default: return [c.glassStrong, c.text2];
  }
}
