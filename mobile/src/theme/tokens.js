// "Margube Liquid" tokens — the web's brand system (src/styles/variables.scss) adapted for mobile,
// with translucent liquid-glass surfaces over the brand backdrop.
// Each palette is the same shape so components never branch on the theme name.

// Headings in Poppins (the wordmark's face), body in Inter — same pairing as the web.
// Geist Mono stays for small figures (times, codes) where columns must line up.
export const FONTS = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  headingMedium: 'Poppins_500Medium',
  heading: 'Poppins_600SemiBold',
  headingBold: 'Poppins_700Bold',
  mono: 'GeistMono_500Medium',
  monoBold: 'GeistMono_600SemiBold',
};

export const RADII = { sm: 12, md: 16, lg: 22, xl: 26, pill: 999 };

// The login's brand panel: navy in both themes, used for one highlight per screen.
export const BRAND = {
  navy: '#11141B',
  navyDeep: '#0D1016',
  blue: '#2F5BEA',
  blueLight: '#5B7CFF',
  glow: '#2F5BEA',
  // Primary call-to-action gradient (--gradient-cta)
  cta: ['#2F5BEA', '#3F67F2', '#5B7CFF'],
};

const dark = {
  name: 'dark',
  bg: '#0A0C10',
  bg2: '#11141B',
  card: 'rgba(30,34,45,0.55)',
  raised: '#181B23',
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
  tealSoft: 'rgba(94,224,213,0.16)',
  purpleFg: '#B49BFF',
  purpleSoft: 'rgba(180,155,255,0.16)',
  neutralSoft: 'rgba(255,255,255,0.08)',
  // Liquid glass: translucent fill, hairline edge and a brighter top rim (specular light).
  glass: 'rgba(30,34,45,0.55)',
  glassStrong: 'rgba(255,255,255,0.06)',
  glassBorder: 'rgba(255,255,255,0.08)',
  glassBorderStrong: 'rgba(255,255,255,0.14)',
  glassRim: 'rgba(255,255,255,0.2)',
  glassFill: 'rgba(34,38,50,0.72)',
  glassSheen: 0.1,
  glassTint: 'systemThinMaterialDark',
  inputBg: '#0E1116',
  inputBorder: 'rgba(255,255,255,0.13)',
  divider: 'rgba(255,255,255,0.08)',
  segTrack: 'rgba(255,255,255,0.08)',
  segOn: 'rgba(255,255,255,0.14)',
  segOnText: '#F5F6F8',
  wash: ['rgba(47,91,234,0.55)', 'rgba(47,91,234,0.16)', 'rgba(47,91,234,0)'],
  ringTrack: 'rgba(255,255,255,0.12)',
  chipOnBg: '#7AA2FF',
  chipOnText: '#0A0C10',
  navBg: 'rgba(19,22,29,0.92)',
  navBorder: 'rgba(255,255,255,0.1)',
  navBorderTop: 'rgba(255,255,255,0.14)',
  navActive: '#7AA2FF',
  navActiveIcon: '#0A0C10',
  sheetBg: '#13161D',
  overlay: 'rgba(0,0,0,0.65)',
  plateBg: '#F5F6F8',
  plateText: '#0A0C10',
  brandBg: BRAND.navyDeep,
  brandBorder: 'rgba(255,255,255,0.07)',
  glowA: '#7AA2FF',
  glowAOpacity: 0.42,
  glowB: '#0E9F9A',
  glowBOpacity: 0.26,
  dots: 'rgba(240,244,255,0.13)',
  shadow: '#000000',
  shadowOpacity: 0.4,
  statusBar: 'light',
};

const light = {
  name: 'light',
  bg: '#F2F4F8',
  bg2: '#FFFFFF',
  card: 'rgba(255,255,255,0.7)',
  raised: '#FFFFFF',
  text: '#11141B',
  text2: '#4A5263',
  text3: '#6B7383',
  muted: '#8D95A3',
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
  glass: 'rgba(255,255,255,0.7)',
  glassStrong: 'rgba(17,20,27,0.05)',
  glassBorder: 'rgba(17,20,27,0.08)',
  glassBorderStrong: 'rgba(17,20,27,0.14)',
  glassRim: '#FFFFFF',
  glassFill: 'rgba(255,255,255,0.74)',
  glassSheen: 0.55,
  glassTint: 'systemThinMaterialLight',
  inputBg: '#FFFFFF',
  inputBorder: '#DDE1EA',
  divider: '#E9ECF1',
  segTrack: '#E7EAF0',
  segOn: '#FFFFFF',
  segOnText: '#11141B',
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
  brandBg: BRAND.navy,
  brandBorder: 'transparent',
  glowA: '#2F5BEA',
  glowAOpacity: 0.2,
  glowB: '#0E9F9A',
  glowBOpacity: 0.12,
  dots: 'rgba(6,17,43,0.12)',
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
