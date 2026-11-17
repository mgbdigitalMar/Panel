import { readFileSync } from 'node:fs';
import {
  SHEET_SPRING, projectDistance, rubberband, sheetDragOffset, shouldDismissSheet,
} from '../shared/config/sheet.js';

export async function runSheetGestureTests() {
  let passed = 0;
  let failed = 0;
  const check = (description, condition) => {
    if (condition) passed++;
    else { failed++; console.error(`FAIL sheet: ${description}`); }
  };
  const H = 600;

  check('projection follows the decay formula', Math.abs(projectDistance(1000) - 499) < 0.001);
  check('no velocity, no projection', projectDistance(0) === 0);
  check('dragging down tracks 1:1', sheetDragOffset(120, H) === 120);
  check('pulling up resists', sheetDragOffset(-200, H) > -200 && sheetDragOffset(-200, H) < 0);
  check('resistance grows with distance', Math.abs(sheetDragOffset(-400, H)) - Math.abs(sheetDragOffset(-200, H)) < 200);
  check('rubber band never stops dead', rubberband(-2000, H) < rubberband(-1000, H));
  check('unmeasured sheet does not move up', rubberband(-50, 0) === 0);
  check('slow drag past half closes', shouldDismissSheet(320, 0, H));
  check('slow drag short of half stays', !shouldDismissSheet(250, 0, H));
  check('a slow release short of half stays', !shouldDismissSheet(150, 200, H));
  check('a flick closes from a short drag', shouldDismissSheet(60, 1200, H));
  check('a flick back up keeps it open', !shouldDismissSheet(400, -300, H));
  check('unmeasured sheet never closes', !shouldDismissSheet(400, 3000, 0));
  check('tapped open and close do not overshoot', SHEET_SPRING.open.dampingRatio === 1 && SHEET_SPRING.close.dampingRatio === 1);
  check('a thrown sheet may overshoot a little', SHEET_SPRING.settle.dampingRatio < 1 && SHEET_SPRING.settle.dampingRatio >= 0.75);

  // Both platforms run the same physics
  const web = readFileSync(new URL('../src/components/ui/Modal/Modal.jsx', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../mobile/src/components/common/UI.jsx', import.meta.url), 'utf8');
  check('web sheet uses shared physics', web.includes('shared/config/sheet') && web.includes('shouldDismissSheet'));
  check('app sheet uses shared physics', app.includes('@shared/config/sheet') && app.includes('shouldDismissSheet'));
  check('app sheet no longer uses the fixed system slide', !/animationType="slide"/.test(app));
  return { passed, failed };
}
