import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glassMaterial } from '../shared/config/glass.js';

const nativeRequire = createRequire(new URL('../mobile/package.json', import.meta.url));
const { transformSync } = nativeRequire('@babel/core');
const source = readFileSync(new URL('../mobile/src/components/common/LiquidGlass.jsx', import.meta.url), 'utf8');
const { code } = transformSync(source, {
  filename: 'LiquidGlass.jsx', babelrc: false, configFile: false,
  plugins: [
    [nativeRequire.resolve('@babel/plugin-transform-react-jsx'), { runtime: 'automatic' }],
    nativeRequire.resolve('@babel/plugin-transform-modules-commonjs'),
  ],
});

// Exercise the component's actual output without loading a native runtime on the test host.
function renderGlass(platform, native, dark, level, props = {}) {
  const material = glassMaterial(level, dark);
  const theme = {
    effectiveGlass: level, theme: dark ? 'dark' : 'light', material,
    colors: {
      raised: dark ? '#1A1A20' : '#FFFFFF', glassFill: material.chrome,
      glassSheen: material.sheen, glassTint: dark ? 'dark' : 'light',
    },
  };
  const mocks = {
    react: { memo: (component) => component },
    'react-native': { Platform: { OS: platform }, View: 'View' },
    'expo-glass-effect': {
      GlassView: 'GlassView', GlassContainer: 'GlassContainer',
      isLiquidGlassAvailable: () => native, isGlassEffectAPIAvailable: () => native,
    },
    'expo-blur': { BlurView: 'BlurView' },
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    '../../context/ThemeContext': { useTheme: () => theme },
    './Brand': { FILL: { position: 'absolute', inset: 0 } },
    './BlurTarget': { ANDROID_BLUR: true, useBlurTarget: () => ({ current: 'wallpaper' }) },
    'react/jsx-runtime': nativeRequire('react/jsx-runtime'),
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)((name) => {
    if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`);
    return mocks[name];
  }, module, module.exports);
  return module.exports.GlassFill(props);
}

const alpha = (color) => Number(color.match(/,([\d.]+)\)$/)[1]);

export async function runGlassIntensityTests() {
  let passed = 0;
  let failed = 0;
  const check = (description, condition) => {
    if (condition) passed++;
    else { failed++; console.error(`FAIL glass intensity: ${description}`); }
  };
  for (const dark of [false, true]) {
    const normal = glassMaterial('normal', dark);
    const strong = glassMaterial('strong', dark);
    check('strong restores the original full-strength tint', strong.chrome === (dark ? 'rgba(24,23,29,0.66)' : 'rgba(255,255,255,0.75)'));
    check('menus remain denser than cards', alpha(strong.popover) > alpha(strong.card));
    for (const props of [{}, { nativeTint: null, tint: 'rgba(22,26,34,0.4)' }]) {
      const a = renderGlass('ios', true, dark, 'normal', props);
      const b = renderGlass('ios', true, dark, 'strong', props);
      check('iOS renders both as native glass', a.type === 'GlassView' && b.type === 'GlassView');
      check('strong restores the original native card material', a.props.glassEffectStyle === 'regular' && b.props.glassEffectStyle === 'regular');
      check('strong removes the added native tint', alpha(a.props.tintColor) === 0.3 && b.props.tintColor === undefined);
    }
    const originalControl = renderGlass('ios', true, dark, 'strong', { interactive: true });
    check('strong restores clear interactive glass', originalControl.props.glassEffectStyle === 'clear' && originalControl.props.isInteractive && originalControl.props.tintColor === undefined);
    const androidNormal = renderGlass('android', false, dark, 'normal');
    const androidStrong = renderGlass('android', false, dark, 'strong');
    check('Android restores full-strength blur and original tint', androidNormal.props.children[0].props.intensity === 45
      && androidStrong.props.children[0].props.intensity === 100
      && androidStrong.props.children[1].props.style[1].backgroundColor === strong.chrome);
    const oldNormal = renderGlass('ios', false, dark, 'normal');
    const oldStrong = renderGlass('ios', false, dark, 'strong');
    check('fallback devices restore the original surface', oldNormal.type === 'View' && oldStrong.type === 'View'
      && oldStrong.props.style[1].backgroundColor === strong.chrome);
    for (const platform of ['ios', 'android']) {
      const solid = renderGlass(platform, true, dark, 'off');
      check('off never renders glass or blur', solid.type === 'View' && solid.props.style[1].backgroundColor.startsWith('#'));
    }
  }
  return { passed, failed };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { passed, failed } = await runGlassIntensityTests();
  console.log(`Glass intensity: ${passed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
}
