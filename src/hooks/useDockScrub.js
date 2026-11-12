import { useEffect, useRef, useState } from 'react';
import { useMotionValue } from 'framer-motion';
import { DOCK_HOLD_MS, dockCellWidth, dockIndexAt, dockIndicatorX, dockPointInside } from '../../shared/config/dock';

export function useDockScrub({ count, onSelect }) {
  const ref = useRef(null);
  const pointer = useRef(null);
  const timer = useRef(null);
  const suppressClick = useRef(false);
  const [holding, setHolding] = useState(false);
  const [preview, setPreview] = useState(-1);
  const [cellWidth, setCellWidth] = useState(0);
  const x = useMotionValue(0);

  const cancel = () => {
    clearTimeout(timer.current);
    pointer.current = null;
    setHolding(false);
    setPreview(-1);
  };

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const onEscape = (event) => { if (event.key === 'Escape') cancel(); };
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', onEscape);
    window.addEventListener('resize', cancel);
    return () => {
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', onEscape);
      window.removeEventListener('resize', cancel);
    };
  }, []);

  const update = (event, drag) => {
    const localX = event.clientX - drag.rect.left;
    const localY = event.clientY - drag.rect.top;
    const inside = dockPointInside(localX, localY, drag.rect.width, drag.rect.height);
    drag.index = inside ? dockIndexAt(localX, drag.rect.width, count) : -1;
    x.set(dockIndicatorX(localX, drag.rect.width, count));
    if (drag.preview !== drag.index) {
      drag.preview = drag.index;
      setPreview(drag.index);
    }
  };

  const onPointerDown = (event) => {
    if (pointer.current || !event.isPrimary || event.button !== 0) { cancel(); return; }
    const button = event.target.closest('[data-dock-index]');
    if (!button) return;
    const drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX,
      lastY: event.clientY, index: Number(button.dataset.dockIndex), active: false, cancelled: false };
    pointer.current = drag;
    setHolding(true);
    ref.current.setPointerCapture(event.pointerId);
    timer.current = setTimeout(() => {
      if (pointer.current !== drag || drag.cancelled) return;
      drag.active = true;
      drag.rect = ref.current.getBoundingClientRect();
      setCellWidth(dockCellWidth(drag.rect.width, count));
      update({ clientX: drag.lastX, clientY: drag.lastY }, drag);
    }, DOCK_HOLD_MS);
  };

  const onPointerMove = (event) => {
    const drag = pointer.current;
    if (!drag || event.pointerId !== drag.id) return;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    if (!drag.active) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 10) {
        clearTimeout(timer.current);
        drag.cancelled = true;
      }
      return;
    }
    update(event, drag);
  };

  const onPointerUp = (event) => {
    const drag = pointer.current;
    if (!drag || event.pointerId !== drag.id) return;
    if (drag.active) update(event, drag);
    const selected = drag.cancelled ? -1 : drag.index;
    suppressClick.current = true;
    setTimeout(() => { suppressClick.current = false; }, 0);
    cancel();
    if (selected >= 0) onSelect(selected);
  };

  return { ref, holding, preview, cellWidth, x, handlers: {
    onPointerDown, onPointerMove, onPointerUp,
    onPointerCancel: cancel, onLostPointerCapture: cancel,
    onContextMenu: (event) => event.preventDefault(),
    onClickCapture: (event) => {
      if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); }
    },
  } };
}
