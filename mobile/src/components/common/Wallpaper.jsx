import { memo } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';

const ROOM = require('../../../assets/room.jpg');

/** The web's room backdrop, already blurred in the bundled asset to keep scrolling cheap. */
export const Wallpaper = memo(function Wallpaper() {
  const { theme, colors, reduceTransparency } = useTheme();
  const { height } = useWindowDimensions();
  const dark = theme === 'dark';
  return (
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg, overflow: 'hidden' }]}>
      {!reduceTransparency ? <Image source={ROOM} resizeMode="cover" style={StyleSheet.absoluteFill} /> : null}
      <LinearGradient
        colors={dark
          ? ['rgba(9,10,16,0.88)', 'rgba(9,10,16,0.68)', 'rgba(9,10,16,0.64)']
          : ['rgba(240,243,250,0.9)', 'rgba(240,243,250,0.7)', 'rgba(240,243,250,0.64)']}
        locations={[0, Math.min(240 / height, 0.8), 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
});
