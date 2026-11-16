import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Reanimated, { interpolate, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { LinearGradient } from 'expo-linear-gradient';
import { DOCK_STYLE, DOCK_GAP, DOCK_HOLD_MS, DOCK_PADDING, dockCellWidth, dockIndexAt, dockIndicatorX, dockPointInside } from '@shared/config/dock';
import { useReduceMotion } from '../components/common/AuthBackdrop';
import { SPRING } from '../theme/motion';

// The lens is a capsule wider than its tab (8 px each side), as on iOS
const LENS_PAD = 8;
const LENS_LIFT = { duration: 120 };
const LENS_SETTLE = { damping: 26, stiffness: 320, mass: 1 };
const LENS_GLIDE = { damping: 30, stiffness: 380, mass: 0.9 };

/**
 * The dock's selection. At rest it is a capsule of Margube-blue glass behind the open tab. While a
 * finger holds and drags along the bar, or taps another tab, it lifts into a clear lens above the
 * tabs: it grows past the bar, rides under the finger (or glides to the tapped tab, with a little
 * overshoot) and settles back into the capsule on the new tab.
 *
 * The lens magnifies what is under it: it holds `lensContent`, a still copy of the tabs laid out
 * like the real ones and kept aligned with them, so when the lens scales up its content scales with
 * it around the lens's centre. Runs entirely on the UI thread (Reanimated).
 *
 * `pressedRef`: set to true by a tab's onPress, so only a switch made on the dock lifts the lens.
 */
export function DockScrubber({ activeIndex, count, onSelect, backdrop, lensContent, pressedRef, palette, children, style }) {
  const tone = palette || { selection: DOCK_STYLE.selection, selectionEdge: DOCK_STYLE.selectionEdge, lens: '#1B2433', lensEdge: DOCK_STYLE.lensEdge };
  const reduce = useReduceMotion();
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const dragging = useSharedValue(false);
  const x = useSharedValue(0);
  const selected = useSharedValue(activeIndex);
  const lift = useSharedValue(0); // 0 at rest (capsule), 1 lifted (lens)
  const interrupted = useSharedValue(false);

  const commit = (index) => {
    if (onSelect(index) === false) {
      selected.set(activeIndex);
      const target = activeIndex * (dockCellWidth(width.get(), count) + DOCK_GAP);
      x.set(reduce ? target : withSpring(target, { duration: 400, dampingRatio: 1 }));
    }
  };

  // A tap glides the selection to the new tab and lifts the lens for the trip; a navigation from
  // elsewhere glides the capsule only. The first placement and a change in the number of tabs
  // set it directly.
  const placed = useRef(false);
  const lastCount = useRef(count);
  useEffect(() => {
    const tapped = Boolean(pressedRef?.current);
    if (pressedRef) pressedRef.current = false;
    if (dragging.get()) return;
    selected.set(activeIndex);
    const target = activeIndex * (dockCellWidth(width.get(), count) + DOCK_GAP);
    const glide = placed.current && lastCount.current === count && width.get() > 0 && !reduce;
    x.set(glide ? withSpring(target, tapped ? LENS_GLIDE : SPRING.indicator) : target);
    if (glide && tapped) lift.set(withSequence(withTiming(1, LENS_LIFT), withDelay(100, withSpring(0, LENS_SETTLE))));
    placed.current = width.get() > 0;
    lastCount.current = count;
  }, [activeIndex, count, dragging, selected, width, x, lift, reduce, pressedRef]);

  const gesture = usePanGesture({
    activateAfterLongPress: DOCK_HOLD_MS,
    minDistance: 0,
    maxPointers: 1,
    cancelsJSResponder: true,
    shouldCancelWhenOutside: false,
    onBegin: () => { interrupted.set(false); },
    onActivate: (event) => {
      dragging.set(true);
      if (!reduce) lift.set(withTiming(1, LENS_LIFT));
      selected.set(dockIndexAt(event.x, width.get(), count));
      x.set(dockIndicatorX(event.x, width.get(), count));
    },
    onUpdate: (event) => {
      if (event.numberOfPointers !== 1) interrupted.set(true);
      const inside = dockPointInside(event.x, event.y, width.get(), height.get());
      selected.set(inside ? dockIndexAt(event.x, width.get(), count) : -1);
      x.set(dockIndicatorX(event.x, width.get(), count));
    },
    onDeactivate: (event) => {
      const inside = !event.canceled && !interrupted.get() && dockPointInside(event.x, event.y, width.get(), height.get());
      const index = inside ? dockIndexAt(event.x, width.get(), count) : activeIndex;
      selected.set(index);
      const target = index * (dockCellWidth(width.get(), count) + DOCK_GAP);
      x.set(reduce ? target : withSpring(target, { ...LENS_GLIDE, velocity: event.velocityX }));
      if (inside) scheduleOnRN(commit, index);
    },
    onFinalize: () => {
      dragging.set(false);
      lift.set(reduce ? 0 : withDelay(80, withSpring(0, LENS_SETTLE)));
    },
  });

  // The capsule behind the open tab: fades as the lens takes over
  const capsule = useAnimatedStyle(() => ({
    width: dockCellWidth(width.get(), count),
    opacity: width.get() ? (selected.get() < 0 ? 0.4 : 1) * (1 - Math.min(1, lift.get() * 4)) : 0,
    transform: [{ translateX: x.get() }],
  }));

  // The lens above the tabs: wider than a tab, grows to lensScale as it lifts
  const lens = useAnimatedStyle(() => ({
    width: dockCellWidth(width.get(), count) + LENS_PAD * 2,
    opacity: width.get() ? Math.min(1, lift.get() * 8) : 0,
    transform: [{ translateX: x.get() }, { scale: interpolate(lift.get(), [0, 1], [1, DOCK_STYLE.lensScale]) }],
  }));

  // The copy inside the lens, held where the real tabs are
  const copy = useAnimatedStyle(() => ({
    width: width.get(),
    transform: [{ translateX: -(DOCK_PADDING - LENS_PAD + x.get()) }],
  }));

  const radius = (DOCK_STYLE.height - DOCK_PADDING * 2) / 2;
  return (
    <GestureDetector gesture={gesture}>
      <Reanimated.View accessibilityRole="tablist" style={style}
        onLayout={(event) => {
          width.set(event.nativeEvent.layout.width);
          height.set(event.nativeEvent.layout.height);
          if (!dragging.get()) x.set(activeIndex * (dockCellWidth(event.nativeEvent.layout.width, count) + DOCK_GAP));
          placed.current = event.nativeEvent.layout.width > 0;
        }}>
        {backdrop}
        <Reanimated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={[{ position: 'absolute', left: DOCK_PADDING, top: DOCK_PADDING, bottom: DOCK_PADDING,
            borderRadius: radius, backgroundColor: tone.selection, borderWidth: 1, borderColor: tone.selectionEdge,
            borderTopColor: 'rgba(255,255,255,0.34)' }, capsule]} />
        {children}
        {lensContent ? (
          <Reanimated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
            style={[{ position: 'absolute', left: DOCK_PADDING - LENS_PAD, top: DOCK_PADDING, bottom: DOCK_PADDING, overflow: 'hidden',
              borderRadius: radius, backgroundColor: tone.lens, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
              borderTopColor: tone.lensEdge, boxShadow: `0 10px 24px -10px ${DOCK_STYLE.lensShadow}` }, lens]}>
            <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.03)']} locations={[0, 0.6]}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <Reanimated.View style={[{ position: 'absolute', left: -1, top: -DOCK_PADDING - 1, height: DOCK_STYLE.height }, copy]}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: DOCK_GAP, paddingHorizontal: DOCK_PADDING }}>
                {lensContent}
              </View>
            </Reanimated.View>
          </Reanimated.View>
        ) : null}
      </Reanimated.View>
    </GestureDetector>
  );
}
