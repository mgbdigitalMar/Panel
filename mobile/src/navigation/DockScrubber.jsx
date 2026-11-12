import { useEffect } from 'react';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Reanimated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { DOCK_STYLE, DOCK_GAP, DOCK_HOLD_MS, DOCK_PADDING, dockCellWidth, dockIndexAt, dockIndicatorX, dockPointInside } from '@shared/config/dock';
import { useReduceMotion } from '../components/common/AuthBackdrop';

export function DockScrubber({ activeIndex, count, onSelect, backdrop, children, style }) {
  const reduce = useReduceMotion();
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const dragging = useSharedValue(false);
  const x = useSharedValue(0);
  const selected = useSharedValue(activeIndex);
  const scale = useSharedValue(1);
  const interrupted = useSharedValue(false);

  const commit = (index) => {
    if (onSelect(index) === false) {
      selected.set(activeIndex);
      const target = activeIndex * (dockCellWidth(width.get(), count) + DOCK_GAP);
      x.set(reduce ? target : withSpring(target, { duration: 400, dampingRatio: 1 }));
    }
  };

  useEffect(() => {
    if (!dragging.get()) {
      selected.set(activeIndex);
      x.set(activeIndex * (dockCellWidth(width.get(), count) + DOCK_GAP));
    }
  }, [activeIndex, count, dragging, selected, width, x]);

  const gesture = usePanGesture({
    activateAfterLongPress: DOCK_HOLD_MS,
    minDistance: 0,
    maxPointers: 1,
    cancelsJSResponder: true,
    shouldCancelWhenOutside: false,
    onBegin: () => { interrupted.set(false); },
    onActivate: (event) => {
      dragging.set(true);
      scale.set(reduce ? 1 : withTiming(DOCK_STYLE.selectionScale, { duration: DOCK_STYLE.pressDuration }));
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
      x.set(reduce ? target : withSpring(target, { duration: 400, dampingRatio: 0.8, overshootClamping: true, velocity: event.velocityX }));
      if (inside) scheduleOnRN(commit, index);
    },
    onFinalize: () => {
      dragging.set(false);
      scale.set(reduce ? 1 : withTiming(1, { duration: DOCK_STYLE.pressDuration }));
    },
  });

  const marker = useAnimatedStyle(() => ({
    width: dockCellWidth(width.get(), count),
    opacity: width.get() ? selected.get() < 0 ? 0.4 : 1 : 0,
    transform: [{ translateX: x.get() }, { scale: scale.get() }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Reanimated.View accessibilityRole="tablist" style={style}
        onLayout={(event) => {
          width.set(event.nativeEvent.layout.width);
          height.set(event.nativeEvent.layout.height);
          if (!dragging.get()) x.set(activeIndex * (dockCellWidth(event.nativeEvent.layout.width, count) + DOCK_GAP));
        }}>
        {backdrop}
        <Reanimated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={[{ position: 'absolute', left: DOCK_PADDING, top: DOCK_PADDING, bottom: DOCK_PADDING,
            borderRadius: DOCK_STYLE.height / 2, backgroundColor: DOCK_STYLE.selection, borderWidth: 1, borderColor: DOCK_STYLE.selectionEdge }, marker]} />
        {children}
      </Reanimated.View>
    </GestureDetector>
  );
}
