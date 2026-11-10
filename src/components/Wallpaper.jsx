import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { LEAF_PATH, VEIN_PATH } from './ui/Loader/Loader';
import styles from './Wallpaper.module.scss';

// The room the glass panes hang in: public/wallpaper.jpg. Replace the file to change the room;
// without it the backdrop falls back to the painted scene in Margube colours.
const PHOTO_URL = '/wallpaper.jpg';
let photoCheck; // one request per page load
let photoKnown = false; // later mounts (page changes, login → app) paint the photo at once

function usePhoto() {
  const [ok, setOk] = useState(photoKnown);
  useEffect(() => {
    if (photoKnown) return undefined;
    photoCheck ||= new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth > 0);
      img.onerror = () => resolve(false);
      img.src = PHOTO_URL;
    });
    let alive = true;
    photoCheck.then((found) => { photoKnown = found; if (alive) setOk(found); });
    return () => { alive = false; };
  }, []);
  return ok;
}

/** Backdrop of the glass appearance (app and login): the room photograph under a veil, or the
 * painted scene with the brand leaf while it loads or when there is no photograph. Never animated. */
export function Wallpaper() {
  const photo = usePhoto();
  return (
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
    </div>
  );
}
