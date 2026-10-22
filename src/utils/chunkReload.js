import { lazy } from 'react';

/**
 * After a deploy, the hashed files of the previous build are gone. A tab that
 * was opened before the deploy still asks for them and the import fails
 * ("Failed to fetch dynamically imported module"). Reloading the page loads
 * the new index.html, which points at the new files.
 */

const KEY = 'margube-chunk-reload-at';
// If the reload itself did not fix it, stop: let the error screen show
// instead of reloading forever.
const MIN_INTERVAL_MS = 10_000;

export function isChunkLoadError(error) {
  const msg = String(error?.message || error || '');
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError|Loading chunk .* failed|Expected a JavaScript.*module script/i.test(msg);
}

/** Reloads the page once. Returns false if a reload just happened (avoids a loop). */
export function reloadForNewVersion() {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < MIN_INTERVAL_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch { /* storage blocked: reload anyway, once per page load */ }
  window.location.reload();
  return true;
}

/** React.lazy that reloads into the new version when the chunk is gone. */
export function lazyWithReload(factory) {
  return lazy(() =>
    factory().catch((error) => {
      // Never resolves: the page is reloading, keep showing the Suspense fallback
      if (isChunkLoadError(error) && reloadForNewVersion()) return new Promise(() => {});
      throw error;
    })
  );
}
