import { View, Pressable } from 'react-native';
import { Paperclip, Camera, X, FileText } from 'lucide-react-native';
import { toUserMessage } from '@shared/utils/errors.js';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { pickDocument, takePhoto, extOf } from '../../services/files';
import { fmtBytes } from '../../utils/format';
import { GlassButton } from './GlassButton';
import { T } from './Text';

/**
 * Attachment picker: file from the device or a photo from the camera (max 15 MB).
 * value: PickedFile | null
 */
export function FileField({ label, value, onChange, kind = 'any', camera = true, hint = 'PDF, JPG, PNG, Word, Excel · máx. 15 MB' }) {
  const { colors } = useTheme();
  const toast = useToast();

  const run = async (fn) => {
    try {
      const f = await fn();
      if (f) onChange(f);
    } catch (e) {
      toast.error(toUserMessage(e));
    }
  };

  return (
    <View style={{ gap: 8 }}>
      {label ? <T size={13} weight="medium" color={colors.text2}>{label}</T> : null}
      {value ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder }}>
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' }}>
            {extOf(value.name) ? <T size={11} weight="bold" color={colors.dangerFg}>{extOf(value.name).toUpperCase().slice(0, 4)}</T> : <FileText size={18} color={colors.dangerFg} />}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T size={14} weight="semibold" numberOfLines={1}>{value.name}</T>
            <T size={12} color={colors.text3}>{fmtBytes(value.size)} de 15 MB</T>
          </View>
          <Pressable onPress={() => onChange(null)} accessibilityRole="button" accessibilityLabel="Quitar archivo" hitSlop={8}
            style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glassStrong }}>
            <X size={16} color={colors.text} />
          </Pressable>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <GlassButton title="Añadir archivo" icon={Paperclip} variant="glass" size="md" style={{ flex: 1 }} onPress={() => run(() => pickDocument(kind))} />
          {camera ? <GlassButton title="Foto" icon={Camera} variant="glass" size="md" onPress={() => run(takePhoto)} /> : null}
        </View>
      )}
      {!value && hint ? <T size={12.5} color={colors.text3}>{hint}</T> : null}
    </View>
  );
}
