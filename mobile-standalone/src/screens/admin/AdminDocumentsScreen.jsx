// Documentos enviados (AdminPage > Documentos on the web) + documento de inicio
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Send, Upload, FileText, Eye, Trash2 } from 'lucide-react-native';
import { toUserMessage } from '@shared/utils/errors.js';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useData, ONBOARDING_DOC_TITLE } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { Screen } from '../../components/common/Screen';
import { Header } from '../../components/common/Header';
import { GlassCard } from '../../components/common/GlassCard';
import { GlassButton } from '../../components/common/GlassButton';
import { FileField } from '../../components/common/FileField';
import { StatusBadge } from '../../components/common/StatusBadge';
import { T } from '../../components/common/Text';
import { Avatar, ChipRail, EmptyState, Sheet } from '../../components/common/UI';
import { uploadPickedFile } from '../../services/files';
import { fmtDate } from '../../utils/format';

export default function AdminDocumentsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const toast = useToast();
  const { employees } = useAuth();
  const { documents, deleteDocument, setOnboardingDocument, onboardingDocUrl, refresh } = useData();
  const [status, setStatus] = useState('all');
  const [onboarding, setOnboarding] = useState(false);
  const [pdf, setPdf] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const sent = documents.filter((d) => d.title !== ONBOARDING_DOC_TITLE && (status === 'all' || d.status === status));
  const recipient = (d) => employees.find((e) => String(e.id) === String(d.recipientId));

  const remove = (d) => Alert.alert('Eliminar documento', `¿Seguro que quieres eliminar «${d.title}»?`, [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: 'Eliminar',
      style: 'destructive',
      onPress: async () => {
        const { error } = await deleteDocument(d);
        if (error) toast.error(toUserMessage(error));
        else toast.success('Documento eliminado');
      },
    },
  ]);

  const uploadOnboarding = async () => {
    if (!pdf) return;
    setUploading(true);
    try {
      const url = await uploadPickedFile(pdf);
      const { error } = await setOnboardingDocument(url);
      if (error) throw error;
      toast.success('Documento de inicio actualizado');
      setOnboarding(false);
      setPdf(null);
    } catch (e) {
      toast.error(toUserMessage(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Screen onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }} refreshing={refreshing}>
      <Header back title="Documentos" subtitle={`${documents.filter((d) => d.title !== ONBOARDING_DOC_TITLE).length} enviados`}
        right={<GlassButton title="Enviar" icon={Send} size="sm" onPress={() => navigation.navigate('SendDocument')} />} />

      <GlassCard onPress={() => setOnboarding(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Upload size={18} color={colors.accentFg} />
        </View>
        <View style={{ flex: 1 }}>
          <T size={15} weight="semibold">Documento de inicio</T>
          <T size={12.5} color={colors.text3}>{onboardingDocUrl ? 'Personalizado · toca para sustituirlo' : 'Se usa el PDF de normas internas por defecto'}</T>
        </View>
      </GlassCard>

      <ChipRail value={status} onChange={setStatus} options={[
        { value: 'all', label: 'Todos' }, { value: 'pending', label: 'Pendientes' }, { value: 'signed', label: 'Firmados' }, { value: 'completed', label: 'Completados' },
      ]} />

      <View style={{ gap: 8 }}>
        {sent.length === 0 ? <EmptyState icon={FileText} title="No se ha enviado ningún documento" /> : sent.map((d) => {
          const r = recipient(d);
          const name = r?.name || d.recipientName || '—';
          return (
            <GlassCard key={d.id} padding={14} style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <Avatar name={name} initials={r?.avatar} size={36} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T size={15} weight="semibold" numberOfLines={1}>{d.title}</T>
                  <T size={12.5} color={colors.text3} numberOfLines={1}>Para {name} · {fmtDate(d.createdAt)}</T>
                </View>
                <StatusBadge status={d.status} small />
              </View>
              {d.description ? <T size={13} color={colors.text2}>{d.description}</T> : null}
              <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                {d.fileUrl ? <GlassButton title="Ver" icon={Eye} variant="glass" size="sm" onPress={() => navigation.navigate('DocumentViewer', { url: d.fileUrl, title: d.title })} /> : null}
                <GlassButton icon={Trash2} variant="danger" size="sm" accessibilityLabel="Eliminar documento" onPress={() => remove(d)} />
              </View>
            </GlassCard>
          );
        })}
      </View>

      <Sheet visible={onboarding} onClose={() => { setOnboarding(false); setPdf(null); }} title="Documento de inicio"
        footer={<GlassButton title="Actualizar documento" icon={Upload} size="lg" loading={uploading} disabled={!pdf} onPress={uploadOnboarding} />}>
        <T size={14} color={colors.text2}>
          Se mostrará a los usuarios cuando inicien sesión por primera vez y deban aceptar las normas de la empresa (en la web y en la app).
        </T>
        <FileField label="PDF (máx. 15 MB)" value={pdf} onChange={setPdf} kind="pdf" camera={false} hint="Solo PDF" />
      </Sheet>
    </Screen>
  );
}
