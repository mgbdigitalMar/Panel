// 19 · Documentos y nóminas ("Mis Documentos" of the web ProfilePage)
import { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Lock, Eye, Download, PenTool, CheckCircle2, FileText, ShieldCheck } from 'lucide-react-native';
import { toUserMessage } from '@shared/utils/errors.js';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData, ONBOARDING_DOC_TITLE } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { Screen } from '../components/common/Screen';
import { Header } from '../components/common/Header';
import { GlassCard } from '../components/common/GlassCard';
import { GlassButton } from '../components/common/GlassButton';
import { PressScale } from '../components/common/Pressable';
import { StatusBadge } from '../components/common/StatusBadge';
import { T, Label } from '../components/common/Text';
import { EmptyState, Sheet } from '../components/common/UI';
import { downloadAndShare, extOf, openBundledPdf } from '../services/files';
import { fmtDate } from '../utils/format';

const BUNDLED_POLICY = require('../../assets/docs/normas-internas-2026.pdf');

function ExtBadge({ url }) {
  const { colors } = useTheme();
  const ext = (extOf(url) || 'doc').toUpperCase().slice(0, 4);
  return (
    <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' }}>
      {url ? <T size={11} weight="bold" color={colors.dangerFg}>{ext}</T> : <FileText size={18} color={colors.dangerFg} />}
    </View>
  );
}

export default function DocumentsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const toast = useToast();
  const { user, employees } = useAuth();
  const { documents, updateDocumentStatus, onboardingDocUrl, refresh } = useData();
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const mine = documents.filter((d) => String(d.recipientId) === String(user?.id) && d.title !== ONBOARDING_DOC_TITLE);
  const pending = mine.filter((d) => d.status === 'pending');
  const done = mine.filter((d) => d.status !== 'pending');
  const featured = pending[0] || mine[0];
  const senderName = (d) => employees.find((e) => String(e.id) === String(d.senderId))?.name || d.senderName || 'Administración';

  const view = (d) => navigation.navigate('DocumentViewer', { url: d.fileUrl, title: d.title });
  const download = async (d) => {
    setBusy(`dl${d.id}`);
    try { await downloadAndShare(d.fileUrl, d.title); } catch (e) { toast.error(toUserMessage(e)); }
    setBusy('');
  };
  const setStatus = async (d, status) => {
    setBusy(status);
    const { error } = await updateDocumentStatus(d.id, status);
    setBusy('');
    if (error) toast.error(toUserMessage(error));
    else { toast.success(status === 'signed' ? 'Documento firmado' : 'Documento completado'); setOpen(null); }
  };

  const rowFor = (d) => (
    <PressScale key={d.id} onPress={() => setOpen(d)} accessibilityRole="button" accessibilityLabel={`${d.title}, ${d.status}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder }}>
      <ExtBadge url={d.fileUrl} />
      <View style={{ flex: 1, gap: 2 }}>
        <T size={15} weight="semibold" numberOfLines={1}>{d.title}</T>
        <T size={12.5} color={colors.text3} numberOfLines={1}>{senderName(d)} · {fmtDate(d.createdAt, { year: false })}</T>
      </View>
      <StatusBadge status={d.status} small />
    </PressScale>
  );

  return (
    <Screen onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }} refreshing={refreshing}>
      <Header back title="Documentos" right={(
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.glassStrong }}>
          <Lock size={13} color={colors.text2} />
          <T size={12.5} weight="semibold" color={colors.text2}>Privado</T>
        </View>
      )} />

      {featured ? (
        <GlassCard radius={26} padding={18} strong style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T size={13} color={colors.text3}>{featured.status === 'pending' ? 'Pendiente de revisar' : 'Último documento'}</T>
              <T size={20} weight="semibold">{featured.title}</T>
              {featured.description ? <T size={13.5} color={colors.text2}>{featured.description}</T> : null}
            </View>
            {featured.status === 'pending' ? (
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.accentSoft }}>
                <T size={11} weight="bold" color={colors.accentFg}>NUEVO</T>
              </View>
            ) : null}
          </View>
          <T size={12.5} color={colors.text3}>Enviado por {senderName(featured)} el {fmtDate(featured.createdAt)}</T>
          {featured.fileUrl ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <GlassButton title="Ver" icon={Eye} variant="glass" style={{ flex: 1 }} onPress={() => view(featured)} />
              <GlassButton title="Descargar" icon={Download} style={{ flex: 1 }} loading={busy === `dl${featured.id}`} onPress={() => download(featured)} />
            </View>
          ) : null}
          {featured.status === 'pending' ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <GlassButton title="Firmar" icon={PenTool} variant="glass" size="sm" style={{ flex: 1 }} loading={busy === 'signed'} onPress={() => setStatus(featured, 'signed')} />
              <GlassButton title="Completar" icon={CheckCircle2} variant="success" size="sm" style={{ flex: 1 }} loading={busy === 'completed'} onPress={() => setStatus(featured, 'completed')} />
            </View>
          ) : null}
        </GlassCard>
      ) : (
        <EmptyState icon={FileText} title="No tienes documentos asignados" message="Cuando RRHH te envíe un documento lo verás aquí y te avisaremos." />
      )}

      {pending.length > 1 ? (
        <View style={{ gap: 8 }}>
          <Label>Pendientes</Label>
          {pending.slice(1).map(rowFor)}
        </View>
      ) : null}

      {done.filter((d) => d !== featured).length ? (
        <View style={{ gap: 8 }}>
          <Label>Revisados</Label>
          {done.filter((d) => d !== featured).map(rowFor)}
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <Label>Empresa y cumplimiento</Label>
        <PressScale
          onPress={() => (onboardingDocUrl
            ? navigation.navigate('DocumentViewer', { url: onboardingDocUrl, title: 'Normas internas 2026' })
            : openBundledPdf(BUNDLED_POLICY, 'Procedimiento normas internas 2026').catch((e) => toast.error(toUserMessage(e))))}
          accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassBorder }}
        >
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={18} color={colors.accentFg} />
          </View>
          <View style={{ flex: 1 }}>
            <T size={15} weight="semibold">Procedimiento de normas internas 2026</T>
            <T size={12.5} color={colors.text3}>{user?.policyAccepted ? 'Lectura confirmada' : 'Lectura obligatoria'}</T>
          </View>
        </PressScale>
      </View>

      <Sheet visible={!!open} onClose={() => setOpen(null)} title={open?.title || ''}
        footer={open ? (
          <>
            {open.fileUrl ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <GlassButton title="Ver" icon={Eye} variant="glass" style={{ flex: 1 }} onPress={() => { const d = open; setOpen(null); view(d); }} />
                <GlassButton title="Descargar" icon={Download} variant="glass" style={{ flex: 1 }} loading={busy === `dl${open.id}`} onPress={() => download(open)} />
              </View>
            ) : null}
            {open.status === 'pending' ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <GlassButton title="Firmar" icon={PenTool} variant="glass" style={{ flex: 1 }} loading={busy === 'signed'} onPress={() => setStatus(open, 'signed')} />
                <GlassButton title="Completar" icon={CheckCircle2} style={{ flex: 1 }} loading={busy === 'completed'} onPress={() => setStatus(open, 'completed')} />
              </View>
            ) : null}
          </>
        ) : null}
      >
        {open ? (
          <>
            <StatusBadge status={open.status} />
            {open.description ? <T size={15} color={colors.text2}>{open.description}</T> : null}
            <T size={13} color={colors.text3}>Enviado por {senderName(open)} el {fmtDate(open.createdAt)}</T>
            {!open.fileUrl ? <T size={13} color={colors.text3}>Este aviso no tiene archivo adjunto.</T> : null}
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
