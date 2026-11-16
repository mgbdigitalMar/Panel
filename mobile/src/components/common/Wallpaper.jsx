import { memo } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurTargetView } from 'expo-blur';
import { useTheme } from '../../context/ThemeContext';
import { ANDROID_BLUR } from './BlurTarget';

const ROOM = require('../../../assets/office.jpg');

/** The same office photograph as the web, with a veil for readable text.
 * `targetRef`: on Android 12+ the photo is wrapped in a BlurTargetView, so the glass cards of the
 * screen can blur it (BlurTarget.jsx). */
export const Wallpaper = memo(function Wallpaper({ targetRef }) {
  const { theme, colors, reduceTransparency } = useTheme();
  const { height } = useWindowDimensions();
  const dark = theme === 'dark';
  const Layer = ANDROID_BLUR && targetRef ? BlurTargetView : View;
  return (
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg, overflow: 'hidden' }]}>
      <Layer ref={Layer === View ? undefined : targetRef} style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]}>
      {!reduceTransparency ? <Image source={ROOM} resizeMode="cover" style={StyleSheet.absoluteFill} /> : null}
      <LinearGradient
        colors={dark
          ? ['rgba(17,24,34,0.78)', 'rgba(17,24,34,0.7)', 'rgba(11,15,22,0.64)']
          : ['rgba(237,242,245,0.84)', 'rgba(237,242,245,0.68)', 'rgba(237,242,245,0.54)']}
        locations={[0, Math.min(240 / height, 0.8), 1]}
        style={StyleSheet.absoluteFill}
      />
      </Layer>
    </View>
  );
});
