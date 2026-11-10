// Margube Adaptive Glass, native side — the same identity as the web (src/styles/variables.scss):
// smoked grey glass over the room, Margube blue for the one highlight and the actions.
// The materials are built for React Native: the room is blurred once, ahead of time
// (assets/room.jpg), and the panes over it are translucent fills with a hairline edge and a bright
// top rim — no blur per card, so long lists scroll smoothly on mid-range phones. Only the
// floating controls (tab bar, round buttons, tabs) use real glass (components/common/LiquidGlass).
// Each palette is the same shape so components never branch on the theme name.

// Headings in Poppins (the wordmark's face), body in Inter — same pairing as the web.
// Geist Mono stays for small figures (times, codes) where columns must line up.
export const FONTS = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  // Light Poppins for large figures and display names ("164:30 h")
  headingLight: 'Poppins_300Light',
  headingMedium: 'Poppins_500Medium',
  heading: 'Poppins_600SemiBold',
  headingBold: 'Poppins_700Bold',
  mono: 'GeistMono_500Medium',
  monoBold: 'GeistMono_600SemiBold',
};

// Corner radii: soft, generous cards; calendar cells and tiles a step tighter.
export const RADIUS = { card: 28, tile: 24, cell: 14 };

// Brand colours shared by both themes. `navy` is the ink used on white controls.
export const BRAND = {
  navy: '#11141B',
  navyDeep: '#0D1016',
  blue: '#2F5BEA',
  blueLight: '#5B7CFF',
  blueDeep: '#16276B',
  // Shade pooled in the corner of a blue-glass panel, for depth
  glow: '#12297F',
  // Primary call-to-action gradient (--gradient-cta)
  cta: ['#2F5BEA', '#3F67F2', '#5B7CFF'],
};

const dark = {
  name: 'dark',
  bg: '#0B0B0F',
  bg2: '#131318',
  card: 'rgba(28,27,33,0.64)',
  raised: '#1A1A20',
  // Text on smoked glass: a step brighter than on solid surfaces, so it holds over the room
  text: '#FFFFFF',
  text2: '#D3D6DE',
  text3: '#B3B8C3',
  muted: '#9AA0AC',
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
  tealSoft: 'rgba(94,224,213,0.16)',
  purpleFg: '#B49BFF',
  purpleSoft: 'rgba(180,155,255,0.16)',
  neutralSoft: 'rgba(255,255,255,0.08)',
  // Liquid glass: translucent fill, hairline edge and a brighter top rim (specular light).
  glass: 'rgba(28,27,33,0.64)',
  glassStrong: 'rgba(255,255,255,0.07)',
  glassBorder: 'rgba(255,255,255,0.1)',
  glassBorderStrong: 'rgba(255,255,255,0.18)',
  glassRim: 'rgba(255,255,255,0.22)',
  glassFill: 'rgba(22,22,28,0.8)',
  glassSheen: 0.09,
  glassTint: 'systemThinMaterialDark',
  inputBg: 'rgba(10,10,14,0.6)',
  inputBorder: 'rgba(255,255,255,0.15)',
  divider: 'rgba(255,255,255,0.1)',
  segTrack: 'rgba(255,255,255,0.09)',
  segOn: 'rgba(255,255,255,0.14)',
  segOnText: '#FFFFFF',
  // The open tab of a segmented control or a filter rail: a solid chip, white on smoked glass
  tabOn: '#FFFFFF',
  tabOnText: '#11141B',
  // The room behind every screen, and the veil that keeps text readable over it (top → bottom)
  veil: ['rgba(9,10,16,0.74)', 'rgba(9,10,16,0.56)', 'rgba(9,10,16,0.62)'],
  wash: ['rgba(47,91,234,0.55)', 'rgba(47,91,234,0.16)', 'rgba(47,91,234,0)'],
  ringTrack: 'rgba(255,255,255,0.12)',
  chipOnBg: '#7AA2FF',
  chipOnText: '#0A0C10',
  navBg: 'rgba(18,18,24,0.92)',
  navBorder: 'rgba(255,255,255,0.1)',
  navBorderTop: 'rgba(255,255,255,0.14)',
  navActive: '#7AA2FF',
  navActiveIcon: '#0A0C10',
  sheetBg: '#17171C',
  overlay: 'rgba(0,0,0,0.65)',
  plateBg: '#F5F6F8',
  plateText: '#0A0C10',
  // The brand panel is Margube blue glass (web: @mixin brand-panel), white type in both themes
  brandBg: 'rgba(47,91,234,0.9)',
  brandBorder: 'rgba(255,255,255,0.3)',
  glowA: '#7AA2FF',
  glowAOpacity: 0.42,
  glowB: '#0E9F9A',
  glowBOpacity: 0.26,
  dots: 'rgba(240,244,255,0.13)',
  // Calendar cells, diagonal hatching for days that don't count, capsule-bar tracks
  cell: 'rgba(255,255,255,0.05)',
  cellBorder: 'rgba(255,255,255,0.07)',
  hatch: 'rgba(255,255,255,0.09)',
  capsule: 'rgba(255,255,255,0.09)',
  shadow: '#000000',
  shadowOpacity: 0.4,
  statusBar: 'light',
};

const light = {
  name: 'light',
  bg: '#E6E9EF',
  bg2: '#FFFFFF',
  card: 'rgba(255,255,255,0.76)',
  raised: '#FFFFFF',
  text: '#0F1320',
  text2: '#333B4D',
  text3: '#4A5366',
  muted: '#6B7383',
  accent: '#2F5BEA',
  onAccent: '#FFFFFF',
  accentFg: '#2F5BEA',
  accentSoft: 'rgba(47,91,234,0.08)',
  accentBorder: 'rgba(47,91,234,0.3)',
  danger: '#E11D48',
  dangerFg: '#E11D48',
  dangerSoft: 'rgba(225,29,72,0.08)',
  dangerBorder: 'rgba(225,29,72,0.25)',
  success: '#059669',
  successFg: '#047857',
  successSoft: 'rgba(5,150,105,0.1)',
  warning: '#D97706',
  warningFg: '#B45309',
  warningSoft: 'rgba(217,119,6,0.12)',
  tealFg: '#0369A1',
  tealSoft: 'rgba(2,132,199,0.1)',
  purpleFg: '#6D28D9',
  purpleSoft: 'rgba(124,58,237,0.1)',
  neutralSoft: 'rgba(17,20,27,0.06)',
  glass: 'rgba(255,255,255,0.76)',
  glassStrong: 'rgba(17,20,29,0.06)',
  glassBorder: 'rgba(17,20,29,0.09)',
  glassBorderStrong: 'rgba(17,20,29,0.16)',
  glassRim: '#FFFFFF',
  glassFill: 'rgba(255,255,255,0.84)',
  glassSheen: 0.5,
  glassTint: 'systemThinMaterialLight',
  inputBg: 'rgba(255,255,255,0.86)',
  inputBorder: 'rgba(17,20,29,0.14)',
  divider: 'rgba(17,20,29,0.09)',
  segTrack: 'rgba(17,20,29,0.07)',
  segOn: '#FFFFFF',
  segOnText: '#0F1320',
  // Ink on light glass
  tabOn: '#0F1320',
  tabOnText: '#FFFFFF',
  veil: ['rgba(240,243,250,0.9)', 'rgba(240,243,250,0.74)', 'rgba(240,243,250,0.8)'],
  wash: ['rgba(47,91,234,0.22)', 'rgba(47,91,234,0.07)', 'rgba(47,91,234,0)'],
  ringTrack: 'rgba(17,20,27,0.1)',
  chipOnBg: '#2F5BEA',
  chipOnText: '#FFFFFF',
  navBg: 'rgba(255,255,255,0.92)',
  navBorder: 'rgba(17,20,27,0.08)',
  navBorderTop: '#FFFFFF',
  navActive: '#2F5BEA',
  navActiveIcon: '#FFFFFF',
  sheetBg: '#FFFFFF',
  overlay: 'rgba(17,20,27,0.4)',
  plateBg: '#11141B',
  plateText: '#FFFFFF',
  brandBg: 'rgba(47,91,234,0.92)',
  brandBorder: 'rgba(255,255,255,0.5)',
  glowA: '#2F5BEA',
  glowAOpacity: 0.2,
  glowB: '#0E9F9A',
  glowBOpacity: 0.12,
  dots: 'rgba(6,17,43,0.12)',
  cell: 'rgba(255,255,255,0.78)',
  cellBorder: 'rgba(17,20,27,0.05)',
  hatch: 'rgba(17,20,27,0.09)',
  capsule: '#FFFFFF',
  shadow: '#06112B',
  shadowOpacity: 0.08,
  statusBar: 'dark',
};

export const PALETTES = { dark, light };

/** Cheap glass surface for cards and rows: translucent fill, hairline edge, bright top rim. No shadow. */
export function glassSurface(c) {
  return {
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.glassBorder,
    borderTopColor: c.glassRim,
  };
}

/** Tone pairs used by pills and icon tiles: [background, foreground]. */
export function tone(c, name) {
  switch (name) {
    case 'pending': case 'warning': case 'amber': return [c.warningSoft, c.warningFg];
    case 'approved': case 'confirmed': case 'success': case 'green': case 'completed': case 'signed': return [c.successSoft, c.successFg];
    case 'rejected': case 'danger': case 'rose': return [c.dangerSoft, c.dangerFg];
    case 'accent': case 'blue': return [c.accentSoft, c.accentFg];
    case 'teal': return [c.tealSoft, c.tealFg];
    case 'purple': return [c.purpleSoft, c.purpleFg];
    default: return [c.neutralSoft, c.text2];
  }
}
