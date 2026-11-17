import fs from 'node:fs';
import path from 'node:path';

// The app has two materials and no third: real glass (GlassFill / GlassCard) for cards, panels and
// controls on the wallpaper, and the row surface (tokens.js rowSurface) for list items and sections
// inside a sheet. Both follow the glass level, «Sin efecto» and "Reduce transparency".
export async function runAppGlassConsistencyTests() {
  let passed = 0;
  let failed = 0;
  const check = (description, condition) => {
    if (condition) passed++;
    else { failed++; console.error(`FAIL cristal app: ${description}`); }
  };
  const root = new URL('../mobile/src/', import.meta.url);
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(jsx?|tsx?)$/.test(entry.name)) files.push(full);
    }
  };
  walk(root.pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  const read = (rel) => fs.readFileSync(new URL(rel, root), 'utf8');

  // The static colour ignores the glass level: no surface may be painted with it
  const offenders = files.filter((f) => /colors\.glass\b/.test(fs.readFileSync(f, 'utf8').replace(/^\s*\*.*$/gm, '')));
  check(`ninguna superficie usa el color fijo colors.glass (${offenders.map((f) => path.basename(f)).join(', ')})`, offenders.length === 0);

  // Rows and chips on the wallpaper are glass like the cards; inside glass, the dense row surface
  const glass = read('components/common/LiquidGlass.jsx');
  const ui = read('components/common/UI.jsx');
  check('filas y chips usan ListFill (cristal sobre el fondo, superficie densa dentro de cristal)',
    /export const ListFill/.test(glass) && /if \(!inside\) return <GlassFill[^>]*blur=\{false\}/.test(glass)
    && /<ListFill corners=/.test(ui) && !/rowSurface\(colors\)/.test(ui));
  check('las tarjetas y la hoja inferior avisan de que son cristal',
    read('components/common/GlassCard.jsx').includes('<InsideGlassContext.Provider value>') && ui.includes('<InsideGlassContext.Provider value>'));
  // The dense surface is only for what sits inside glass: no row on the wallpaper paints it by hand
  const denseOnWallpaper = files.filter((f) => /backgroundColor: [^,}]*\? colors\.(accentSoft|chipOnBg) : colors\.(glassStrong|card)/.test(fs.readFileSync(f, 'utf8')));
  check(`sin elementos seleccionables con fondo denso a mano (${denseOnWallpaper.map((f) => path.basename(f)).join(', ')})`, denseOnWallpaper.length === 0);
  // At the stronger glass levels the dense popover fill read as dark blocks among the glass
  check('glassStrong sigue siendo un tinte sutil (no el relleno denso)', !/glassStrong:\s*material\./.test(read('context/ThemeContext.js')));
  const denseFields = files.filter((f) => !/ThemeContext\.js$|tokens\.js$/.test(f) && /colors\.inputBg/.test(fs.readFileSync(f, 'utf8')));
  check(`ningún campo ni burbuja pinta el relleno denso (${denseFields.map((f) => path.basename(f)).join(', ')})`, denseFields.length === 0);
  check('en iOS el cristal solo sale del componente nativo', !files.some((f) => !f.endsWith('LiquidGlass.jsx') && /<(BlurView|GlassView)\b/.test(fs.readFileSync(f, 'utf8'))));

  // Every screen that paints its own wallpaper hands it to the glass (Android blur), as Screen does
  const ownWallpaper = files.filter((f) => /<Wallpaper\b/.test(fs.readFileSync(f, 'utf8')) && !/common[\\/](Screen|Wallpaper)\.jsx$/.test(f));
  check('las pantallas con fondo propio comparten el desenfoque con su cristal',
    ownWallpaper.every((f) => { const s = fs.readFileSync(f, 'utf8'); return /<Wallpaper targetRef=/.test(s) && s.includes('BlurTargetContext.Provider'); }));

  const calendar = read('screens/ResourceCalendarScreen.jsx');
  check('el calendario usa cristal real en sus paneles y botones redondos', (calendar.match(/<GlassFill radius=\{22\} \/>/g) || []).length === 2 && calendar.includes('accessibilityLabel="Semana anterior"') && /<IconButton\s+icon=\{ChevronLeft\}/.test(calendar));
  return { passed, failed };
}
