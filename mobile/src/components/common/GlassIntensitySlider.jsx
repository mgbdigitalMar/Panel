import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { GLASS_OPTIONS, normalizeGlass } from '@shared/config/glass';
import { useTheme } from '../../context/ThemeContext';
import { T } from './Text';

const MAX = GLASS_OPTIONS.length - 1;
const indexOf = (value) => GLASS_OPTIONS.findIndex((option) => option.value === normalizeGlass(value));
const stepOf = (value) => Math.max(0, Math.min(MAX, Math.round(value)));

/** Keep the system thumb and its touch response; preview only when crossing a detent. */
export function GlassIntensitySlider() {
  const { colors, glassIntensity, setGlassIntensity, previewGlassIntensity, reduceTransparency } = useTheme();
  const savedIndex = indexOf(glassIntensity);
  const current = useRef(savedIndex);
  const dragging = useRef(false);
  const [index, setIndex] = useState(savedIndex);
  const [resetKey, setResetKey] = useState(0);

  const cancel = useCallback(() => {
    dragging.current = false;
    previewGlassIntensity(null);
    current.current = savedIndex;
    setIndex(savedIndex);
    setResetKey((key) => key + 1);
  }, [previewGlassIntensity, savedIndex]);

  useEffect(() => {
    if (!dragging.current) {
      current.current = savedIndex;
      setIndex(savedIndex);
    }
  }, [savedIndex]);

  useFocusEffect(useCallback(() => {
    cancel();
    return () => {
      dragging.current = false;
      previewGlassIntensity(null);
    };
  }, [cancel, previewGlassIntensity]));

  const preview = (value) => {
    if (reduceTransparency) return;
    const next = stepOf(value);
    if (next === current.current) return;
    current.current = next;
    setIndex(next);
    previewGlassIntensity(GLASS_OPTIONS[next].value);
    Haptics.selectionAsync().catch(() => {});
  };

  const commit = (value) => {
    if (reduceTransparency) { cancel(); return; }
    preview(value);
    dragging.current = false;
    setGlassIntensity(GLASS_OPTIONS[stepOf(value)].value);
  };

  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <T size={15} weight="medium" style={{ flex: 1 }}>Intensidad de Liquid Glass</T>
        <T size={13} weight="semibold" color={colors.accent}>{GLASS_OPTIONS[index].label}</T>
      </View>
      <Slider
        key={resetKey}
        testID="glass-intensity-slider"
        style={{ width: '100%', height: 48 }}
        minimumValue={0}
        maximumValue={MAX}
        step={1}
        value={savedIndex}
        disabled={reduceTransparency}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.divider}
        tapToSeek
        onSlidingStart={() => { dragging.current = true; }}
        onValueChange={(value) => {
          if (dragging.current) preview(value);
          else commit(value);
        }}
        onSlidingComplete={commit}
        onTouchCancel={cancel}
        accessibilityLabel="Intensidad de Liquid Glass"
        accessibilityHint="Desliza para elegir sin efecto, suave, normal o intenso"
        accessibilityValue={{ min: 0, max: MAX, now: index, text: GLASS_OPTIONS[index].label }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={({ nativeEvent }) => {
          if (nativeEvent.actionName === 'increment') commit(current.current + 1);
          if (nativeEvent.actionName === 'decrement') commit(current.current - 1);
        }}
      />
      <View accessible={false} pointerEvents="none" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T size={12} color={colors.text3}>Sin efecto</T>
        <T size={12} color={colors.text3}>Intenso</T>
      </View>
    </View>
  );
}
