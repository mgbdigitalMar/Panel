// Signature drawn with the finger (SignaturePad on the web). Points are kept in the shared
// 1000 x 400 box, the stored format of policy_signatures, so the web draws them the same way.
import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Eraser } from 'lucide-react-native';
import { SIGNATURE_BOX, normalizeStrokes, strokesToPath } from '@shared/services/policy.js';
import { useTheme } from '../context/ThemeContext';
import { T } from './common/Text';

const INK = '#11141B';

/** `onDrawingChange(true|false)` lets the parent stop scrolling while the finger draws. */
export function SignaturePad({ onChange, onDrawingChange, disabled }) {
  const { colors } = useTheme();
  const size = useRef({ w: 1, h: 1 });
  const strokes = useRef([]);
  const [path, setPath] = useState('');

  // Gesture responder props of the pad (event handlers, so they may read the refs)
  const toBox = (e) => [
    (e.nativeEvent.locationX / size.current.w) * SIGNATURE_BOX.width,
    (e.nativeEvent.locationY / size.current.h) * SIGNATURE_BOX.height,
  ];
  const end = () => {
    onDrawingChange?.(false);
    onChange?.(normalizeStrokes(strokes.current, SIGNATURE_BOX.width, SIGNATURE_BOX.height));
  };
  const responder = {
    onStartShouldSetResponder: () => !disabled,
    onMoveShouldSetResponder: () => !disabled,
    // A vertical stroke must not be taken over by the screen's scroll
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e) => {
      onDrawingChange?.(true);
      strokes.current.push([toBox(e)]);
      setPath(strokesToPath(strokes.current));
    },
    onResponderMove: (e) => {
      strokes.current[strokes.current.length - 1].push(toBox(e));
      setPath(strokesToPath(strokes.current));
    },
    onResponderRelease: end,
    onResponderTerminate: end,
  };

  const clear = () => {
    Haptics.selectionAsync().catch(() => {});
    strokes.current = [];
    setPath('');
    onChange?.([]);
  };

  return (
    <View style={{ gap: 8 }}>
      <View
        {...responder}
        onLayout={(e) => { size.current = { w: e.nativeEvent.layout.width || 1, h: e.nativeEvent.layout.height || 1 }; }}
        accessible
        accessibilityLabel="Recuadro de firma. Firma con el dedo."
        style={{ width: '100%', aspectRatio: 5 / 2, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.glassBorderStrong, backgroundColor: '#FFFFFF', overflow: 'hidden' }}
      >
        {/* pointerEvents none: touches land on the container, so locationX/Y are relative to it */}
        <Svg width="100%" height="100%" viewBox={`0 0 ${SIGNATURE_BOX.width} ${SIGNATURE_BOX.height}`} pointerEvents="none">
          <Path d="M80 312 L920 312" stroke="#D5D9E2" strokeWidth={2.5} />
          {path ? <Path d={path} stroke={INK} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
        </Svg>
        {!path ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: '8%', bottom: '24%' }}>
            <T size={13} color="#8D95A3">Firma aquí</T>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <T size={12.5} color={colors.text3} style={{ flex: 1 }}>Firma con el dedo dentro del recuadro.</T>
        <Pressable
          onPress={clear}
          disabled={!path || disabled}
          accessibilityRole="button"
          accessibilityLabel="Borrar firma"
          hitSlop={8}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18,
            backgroundColor: pressed ? colors.segTrack : colors.glassStrong, borderWidth: 1, borderColor: colors.glassBorder,
            opacity: !path || disabled ? 0.5 : 1,
          })}
        >
          <Eraser size={15} color={colors.text2} />
          <T size={13} weight="semibold" color={colors.text2}>Borrar</T>
        </Pressable>
      </View>
    </View>
  );
}

/** A stored signature, drawn from its strokes (admin users, documents). */
export function SignatureView({ strokes, label }) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label || 'Firma'}
      style={{ width: '100%', aspectRatio: 5 / 2, borderRadius: 14, borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: '#FFFFFF', overflow: 'hidden' }}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${SIGNATURE_BOX.width} ${SIGNATURE_BOX.height}`}>
        <Path d={strokesToPath(strokes)} stroke={INK} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    </View>
  );
}
