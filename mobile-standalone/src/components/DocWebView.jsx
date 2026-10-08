import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Download, FileText } from 'lucide-react-native';
import { toUserMessage } from '@shared/utils/errors.js';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { viewerUrl, downloadAndShare } from '../services/files';
import { T } from './common/Text';
import { GlassButton } from './common/GlassButton';

/** Renders a document inside the app, with a download fallback for unsupported types. */
export function DocWebView({ url, title, style }) {
  const { colors } = useTheme();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const src = viewerUrl(url);

  const download = async () => {
    setBusy(true);
    try {
      await downloadAndShare(url, title);
    } catch (e) {
      toast.error(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!src || failed) {
    return (
      <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }, style]}>
        <FileText size={40} color={colors.text3} strokeWidth={1.4} />
        <T size={15} color={colors.text2} style={{ textAlign: 'center' }}>
          {failed ? 'No se ha podido mostrar el documento aquí.' : 'Este tipo de archivo no se puede previsualizar.'}
        </T>
        <GlassButton title="Descargar o abrir con…" icon={Download} onPress={download} loading={busy} />
      </View>
    );
  }

  return (
    <View style={[{ flex: 1, backgroundColor: '#FFFFFF', overflow: 'hidden' }, style]}>
      <WebView
        source={{ uri: src }}
        onLoadEnd={() => setLoading(false)}
        onError={() => setFailed(true)}
        onHttpError={(e) => { if (e.nativeEvent.statusCode >= 400) setFailed(true); }}
        originWhitelist={['https://*', 'http://*', 'data:*']}
        setSupportMultipleWindows={false}
        startInLoadingState={false}
        style={{ flex: 1 }}
      />
      {loading ? (
        <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
          <ActivityIndicator color={colors.accent} />
          <T size={13} color={colors.text3} style={{ marginTop: 10 }}>Cargando documento…</T>
        </View>
      ) : null}
    </View>
  );
}
