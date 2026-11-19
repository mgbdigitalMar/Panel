import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { LEAF_PATH, VEIN_PATH } from './ui/Loader/Loader';
import { useTheme } from '../context';
import { startWallpaperGlass } from '../glass/wallpaperGlass';
import { supportsLiquidRefraction } from '../glass/liquidRefraction';
import styles from './Wallpaper.module.scss';

// The room the glass panes hang in: public/wallpaper.webp (1920 px wide, WebP at about quality 80:
// 167 kB where the JPEG was 299 kB). Replace the file to change the room; index.html and
// styles/global.scss paint the same file before the app starts. Without it the backdrop falls back
// to the painted scene in Margube colours.
const PHOTO_URL = '/wallpaper.webp';
let photoCheck; // one request per page load
let photoKnown = false; // later mounts (page changes, login → app) paint the photo at once
let photoImage = null; // the decoded photo, which the Liquid Glass canvas samples

function usePhoto() {
  const [ok, setOk] = useState(photoKnown);
  useEffect(() => {
    if (photoKnown) return undefined;
    photoCheck ||= new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { photoImage = img; resolve(img.naturalWidth > 0); };
      img.onerror = () => resolve(false);
      img.src = PHOTO_URL;
    });
    let alive = true;
    photoCheck.then((found) => { photoKnown = found; if (alive) setOk(found); });
    return () => { alive = false; };
  }, []);
  return ok;
}

/**
 * Starts the WebGL Liquid Glass over the room when the glass level asks for it: «Intenso» gives
 * every card its glass (and the chrome too in browsers without the SVG refraction, which Chromium
 * draws for the chrome itself, liquidRefraction.js). In browsers without the SVG filter,
 * «Normal» also bends the wallpaper behind the chrome and «Suave» does so only at the dock.
 * «Sin efecto», "reduce transparency" and forced colours none.
 */
function useWallpaperGlass(ref, photo) {
  const { theme, glassIntensity } = useTheme();
  const [plain, setPlain] = useState(() => matchMedia('(prefers-reduced-transparency: reduce), (forced-colors: active)').matches);
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-transparency: reduce), (forced-colors: active)');
    const sync = () => setPlain(mq.matches);
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);
  useEffect(() => {
    if (!photo || !photoImage || plain || glassIntensity === 'off') return undefined;
    const svg = supportsLiquidRefraction();
    const strong = glassIntensity === 'strong';
    return startWallpaperGlass({
      host: ref.current,
      photo: photoImage,
      theme,
      panes: strong,
      chrome: svg ? null : glassIntensity !== 'soft' ? '[data-liquid]:not([data-liquid="dense"])' : '[data-liquid="dock"]',
    });
  }, [ref, photo, theme, glassIntensity, plain]);
}

/** Backdrop of the glass appearance (app and login): the room photograph under a veil, or the
 * painted scene with the brand leaf while it loads or when there is no photograph. Never animated. */
export function Wallpaper() {
  const photo = usePhoto();
  const glassRef = useRef(null);
  useWallpaperGlass(glassRef, photo);
  return createPortal(
    <div className={styles.wallpaper} aria-hidden="true">
      <div className={styles.scene} />
      {!photo && (
        <>
          <div className={styles.dots} />
          <svg className={styles.leaf} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
            <path d={LEAF_PATH} />
            <path d={VEIN_PATH} />
          </svg>
        </>
      )}
      {/* Fades in over the scene once decoded, so there is no flash of the fallback */}
      <div className={clsx(styles.photo, photo && styles.photoOn)} style={photo ? { backgroundImage: `url("${PHOTO_URL}")` } : undefined} />
      <div className={clsx(styles.veil, photo && styles.veilPhoto)} />
      {/* The transparent canvas refracts the room only under glass surfaces. */}
      <div ref={glassRef} className={styles.glass} />
    </div>,
    document.body,
  );
}
