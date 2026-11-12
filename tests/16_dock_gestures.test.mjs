import { DOCK_STYLE, DOCK_WEB_VARIABLES, dockTint, dockCellWidth, dockIndexAt, dockIndicatorX, dockPointInside } from '../shared/config/dock.js';

export async function runDockGestureTests() {
  let passed = 0;
  let failed = 0;
  const check = (description, condition) => {
    if (condition) passed++;
    else { failed++; console.error(`FAIL dock: ${description}`); }
  };
  for (const width of [240, 310, 350, 600]) {
    const cell = dockCellWidth(width, 5);
    for (let index = 0; index < 5; index++) {
      const center = 5 + index * (cell + 2) + cell / 2;
      check(`center ${index} at ${width}`, dockIndexAt(center, width, 5) === index);
      check(`marker ${index} at ${width}`, Math.abs(dockIndicatorX(center, width, 5) - index * (cell + 2)) < 0.001);
    }
    check(`left clamp ${width}`, dockIndexAt(-1000, width, 5) === 0 && dockIndicatorX(-1000, width, 5) === 0);
    check(`right clamp ${width}`, dockIndexAt(1000, width, 5) === 4 && dockIndicatorX(1000, width, 5) <= width - 10 - cell);
  }
  check('empty dock cannot navigate', dockIndexAt(40, 200, 0) === -1);
  check('unmeasured dock cannot navigate', dockIndexAt(40, 0, 5) === -1 && !dockPointInside(0, 0, 0, 64));
  check('thumb can drift slightly', dockPointInside(80, -20, 310, 64));
  check('dragging far above cancels', !dockPointInside(80, -60, 310, 64));
  check('dragging far below cancels', !dockPointInside(80, 120, 310, 64));
  check('dragging far beyond either edge cancels', !dockPointInside(-50, 30, 310, 64) && !dockPointInside(370, 30, 310, 64));
  check('web and app share dock height', DOCK_WEB_VARIABLES['--dock-height'] === `${DOCK_STYLE.height}px`);
  check('web and app share action size', DOCK_WEB_VARIABLES['--dock-action-size'] === `${DOCK_STYLE.actionSize}px`);
  check('off material is opaque', dockTint(0) === 'rgba(17,24,34,1)');
  check('intense material uses the same tint', dockTint(1) === 'rgba(17,24,34,0.72)');
  return { passed, failed };
}
