import { useEffect, useState } from 'react';
import { LEAF_PATH, VEIN_PATH } from './ui/Loader/Loader';
import styles from './Wallpaper.module.scss';

// Optional photo: drop an image at public/wallpaper.jpg and the glass appearance uses it
const PHOTO_URL = '/wallpaper.jpg';
let photoCheck; // one request per page load

function usePhoto() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    photoCheck ||= new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth > 0);
      img.onerror = () => resolve(false);
      img.src = PHOTO_URL;
    });
    let alive = true;
    photoCheck.then((found) => { if (alive) setOk(found); });
    return () => { alive = false; };
  }, []);
  return ok;
}

/** Backdrop of the glass appearance (app and login): Margube colours with the brand leaf, or the photo. */
export function Wallpaper() {
  const photo = usePhoto();
  return (
    <div className={styles.wallpaper} aria-hidden="true">
      {photo ? (
        <div className={styles.photo} style={{ backgroundImage: `url("${PHOTO_URL}")` }} />
      ) : (
        <>
          <div className={styles.scene} />
          <div className={styles.dots} />
          <svg className={styles.leaf} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
            <path d={LEAF_PATH} />
            <path d={VEIN_PATH} />
          </svg>
        </>
      )}
      <div className={styles.veil} />
    </div>
  );
}
