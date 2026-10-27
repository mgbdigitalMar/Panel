import { useEffect, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';
import { SIGNATURE_BOX, normalizeStrokes, strokesToPath } from '../../shared/services/policy.js';
import styles from './SignaturePad.module.scss';

const INK = '#11141B';

/**
 * Signature drawn with mouse, finger or pen. Points are kept in the shared 1000 x 400 box
 * (the pad has that aspect ratio), so `onChange` receives what gets stored.
 */
export function SignaturePad({ onChange, disabled, labelledBy }) {
  const canvasRef = useRef(null);
  const strokes = useRef([]);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  const toBox = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return [
      ((e.clientX - rect.left) / rect.width) * SIGNATURE_BOX.width,
      ((e.clientY - rect.top) / rect.height) * SIGNATURE_BOX.height,
    ];
  };

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(canvas.width / SIGNATURE_BOX.width, canvas.height / SIGNATURE_BOX.height);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(new Path2D(strokesToPath(strokes.current)));
  };

  // Sharp on high-density screens and after the window is resized
  useEffect(() => {
    const canvas = canvasRef.current;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      redraw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  const emit = () => {
    const clean = normalizeStrokes(strokes.current, SIGNATURE_BOX.width, SIGNATURE_BOX.height);
    setEmpty(clean.length === 0);
    onChange?.(clean);
  };

  const down = (e) => {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    // Keeps receiving the stroke outside the pad; never worth losing the stroke over
    try { canvasRef.current.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    drawing.current = true;
    strokes.current.push([toBox(e)]);
    redraw();
  };

  const move = (e) => {
    if (!drawing.current) return;
    // Coalesced events keep fast strokes smooth; some browsers return an empty list
    const coalesced = e.nativeEvent.getCoalescedEvents?.();
    const events = coalesced?.length ? coalesced : [e.nativeEvent];
    const stroke = strokes.current[strokes.current.length - 1];
    events.forEach((ev) => stroke.push(toBox(ev)));
    redraw();
  };

  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    emit();
  };

  const clear = () => {
    strokes.current = [];
    redraw();
    emit();
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.paper}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          role="img"
          aria-labelledby={labelledBy}
          aria-describedby="signature-help"
        />
        <span className={styles.line} aria-hidden="true" />
        {empty && <span className={styles.placeholder} aria-hidden="true">Firma aquí</span>}
      </div>
      <div className={styles.bar}>
        <span id="signature-help" className={styles.help}>Firma con el ratón, el dedo o un lápiz digital.</span>
        <button type="button" className={styles.clear} onClick={clear} disabled={empty || disabled}>
          <Eraser size={14} aria-hidden="true" /> Borrar
        </button>
      </div>
    </div>
  );
}

/** A stored signature, drawn from its strokes (admin register, own profile). */
export function SignatureView({ strokes, label, className }) {
  return (
    <svg
      viewBox={`0 0 ${SIGNATURE_BOX.width} ${SIGNATURE_BOX.height}`}
      className={className || styles.view}
      role="img"
      aria-label={label || 'Firma'}
    >
      <path d={strokesToPath(strokes)} fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
