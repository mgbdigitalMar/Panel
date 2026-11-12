export const DOCK_HOLD_MS = 250;
export const DOCK_CANCEL_MARGIN = 32;
export const DOCK_PADDING = 5;
export const DOCK_GAP = 2;

export const DOCK_STYLE = {
  height: 64,
  actionSize: 48,
  outerGutter: 16,
  bottomGap: 12,
  actionGap: 8,
  iconSize: 20,
  labelSize: 9.5,
  labelLineHeight: 13,
  shrink: 0.97,
  surface: '#111822',
  transparency: 0.28,
  active: '#FFFFFF',
  inactive: '#CBD2DF',
  selection: 'rgba(255,255,255,0.14)',
  selectionEdge: 'rgba(255,255,255,0.2)',
  action: '#2F5BEA',
  selectionScale: 1.06,
  actionPressScale: 0.92,
  pressDuration: 100,
};

export function dockTint(strength) {
  return `rgba(17,24,34,${1 - strength * DOCK_STYLE.transparency})`;
}

export const DOCK_WEB_VARIABLES = {
  '--dock-height': `${DOCK_STYLE.height}px`,
  '--dock-action-size': `${DOCK_STYLE.actionSize}px`,
  '--dock-gutter': `${DOCK_STYLE.outerGutter}px`,
  '--dock-bottom-gap': `${DOCK_STYLE.bottomGap}px`,
  '--dock-gap': `${DOCK_STYLE.actionGap}px`,
  '--dock-shrink': DOCK_STYLE.shrink,
  '--dock-padding': `${DOCK_PADDING}px`,
  '--dock-item-gap': `${DOCK_GAP}px`,
  '--dock-label-size': `${DOCK_STYLE.labelSize}px`,
  '--dock-label-leading': `${DOCK_STYLE.labelLineHeight}px`,
  '--dock-selection': DOCK_STYLE.selection,
  '--dock-selection-edge': DOCK_STYLE.selectionEdge,
  '--dock-active': DOCK_STYLE.active,
  '--dock-inactive': DOCK_STYLE.inactive,
  '--dock-action': DOCK_STYLE.action,
  '--dock-transparency': DOCK_STYLE.transparency,
  '--dock-action-scale': DOCK_STYLE.actionPressScale,
};

export function dockCellWidth(width, count) {
  'worklet';
  return count > 0 ? Math.max(0, (width - DOCK_PADDING * 2 - DOCK_GAP * (count - 1)) / count) : 0;
}

export function dockIndexAt(x, width, count) {
  'worklet';
  const cell = dockCellWidth(width, count);
  if (!cell) return -1;
  return Math.max(0, Math.min(count - 1, Math.floor((x - DOCK_PADDING + DOCK_GAP / 2) / (cell + DOCK_GAP))));
}

export function dockPointInside(x, y, width, height) {
  'worklet';
  return width > 0 && height > 0 && x >= -DOCK_CANCEL_MARGIN && x <= width + DOCK_CANCEL_MARGIN
    && y >= -DOCK_CANCEL_MARGIN && y <= height + DOCK_CANCEL_MARGIN;
}

export function dockIndicatorX(x, width, count) {
  'worklet';
  const cell = dockCellWidth(width, count);
  return Math.max(0, Math.min(Math.max(0, width - DOCK_PADDING * 2 - cell), x - DOCK_PADDING - cell / 2));
}
