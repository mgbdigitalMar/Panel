import { useEffect, useRef, useState } from 'react';
import { useMotionValue } from 'motion/react';
import { DOCK_HOLD_MS, dockCellWidth, dockIndexAt, dockIndicatorX, dockPointInside } from '../../shared/config/dock';
import { haptic } from '../utils/haptics';

export function useDockScrub({ count, onSelect }) {
  const ref = useRef(null);
  const pointer = useRef(null);
  const timer = useRef(null);
  const suppressClick = useRef(false);
  const [holding, setHolding] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(-1);
  const [cellWidth, setCellWidth] = useState(0);
  const x = useMotionValue(0);

  const cancel = () => {
    clearTimeout(timer.current);
    const drag = pointer.current;
    if (drag) suppressClick.current = true;
    pointer.current = null;
    if (drag && ref.current?.hasPointerCapture(drag.id)) ref.current.releasePointerCapture(drag.id);
    setDragging(false);
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
      // A tick for each tab the finger crosses while scrubbing (the first one marks the hold)
      if (drag.touch && drag.index >= 0) haptic('selection');
      drag.preview = drag.index;
      setPreview(drag.index);
    }
  };

  const onPointerDown = (event) => {
    if (pointer.current || !event.isPrimary || event.button !== 0) { cancel(); return; }
    suppressClick.current = false;
    const button = event.target.closest('[data-dock-index]');
    if (!button) return;
    const drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX,
      lastY: event.clientY, index: Number(button.dataset.dockIndex), active: false, cancelled: false,
      touch: event.pointerType === 'touch' };
    pointer.current = drag;
    setHolding(true);
    ref.current.setPointerCapture(event.pointerId);
    timer.current = setTimeout(() => {
      if (pointer.current !== drag || drag.cancelled) return;
      drag.active = true;
      setDragging(true);
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
    const rect = drag.rect || ref.current.getBoundingClientRect();
    const inside = dockPointInside(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height);
    const selected = drag.cancelled || !inside ? -1 : drag.index;
    suppressClick.current = true;
    setTimeout(() => { suppressClick.current = false; }, 0);
    cancel();
    // Pointer capture moves the click onto the <nav>, out of reach of the global tap haptic
    if (selected >= 0 && drag.touch && !drag.active) haptic('medium');
    if (selected >= 0) onSelect(selected);
  };

  return { ref, holding, dragging, preview, cellWidth, x, handlers: {
    onPointerDown, onPointerMove, onPointerUp,
    onPointerCancel: () => { suppressClick.current = true; cancel(); },
    onLostPointerCapture: () => { if (pointer.current) { suppressClick.current = true; cancel(); } },
    onContextMenu: (event) => event.preventDefault(),
    onClickCapture: (event) => {
      if (suppressClick.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); }
    },
  } };
}
