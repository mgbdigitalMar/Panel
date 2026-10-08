// In-app document viewer (viewer modal of the web ProfilePage)
import { useState } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Share2 } from 'lucide-react-native';
import { toUserMessage } from '@shared/utils/errors.js';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { IconButton } from '../components/common/GlassButton';
import { T } from '../components/common/Text';
import { DocWebView } from '../components/DocWebView';
import { downloadAndShare } from '../services/files';

export default function DocumentViewerScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { params } = useRoute();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const share = async () => {
    if (busy) return;
    setBusy(true);
    try { await downloadAndShare(params?.url, params?.title); } catch (e) { toast.error(toUserMessage(e)); }
    setBusy(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
        <IconButton icon={X} onPress={() => navigation.goBack()} accessibilityLabel="Cerrar" />
        <T size={16} weight="semibold" style={{ flex: 1 }} numberOfLines={1}>{params?.title || 'Documento'}</T>
        <IconButton icon={Share2} onPress={share} accessibilityLabel="Descargar o compartir" />
      </View>
      <DocWebView url={params?.url} title={params?.title} style={{ marginBottom: insets.bottom }} />
    </View>
  );
}
