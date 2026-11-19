// Apart from wallpaperGlass.js so the theme can ask without loading the WebGL renderer, which
// Wallpaper.jsx only downloads when the glass level and the browser need it

let webgl;
/** WebGL2 is all the renderer needs. Checked once per page load. */
export function supportsWebGLGlass() {
  if (webgl !== undefined) return webgl;
  if (typeof document === 'undefined') return false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    webgl = Boolean(gl);
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webgl = false;
  }
  return webgl;
}
