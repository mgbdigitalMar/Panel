// 13 · Detalle con decisión
import { useMemo, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Check, X, Trash2, Eye, Mail, RotateCcw, FileSearch, Clock, CheckCircle2, XCircle } from 'lucide-react-native';
import { toUserMessage } from '@shared/utils/errors.js';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { Screen } from '../components/common/Screen';
import { Header } from '../components/common/Header';
import { GlassCard } from '../components/common/GlassCard';
import { GlassButton } from '../components/common/GlassButton';
import { tone } from '../theme/tokens';
import { T, Label } from '../components/common/Text';
import { Avatar, EmptyState, InfoLine } from '../components/common/UI';
import { buildRequestItems, requestDetail, requestTypeLabel } from '../utils/domain';
import { fmtDate, fmtTime, fmtMoney, fmtDayLong } from '../utils/format';

function Step({ title, subtitle, tone, last }) {
  const { colors } = useTheme();
  const dot = tone === 'approved' ? colors.success : tone === 'rejected' ? colors.danger : tone === 'pending' ? colors.warning : colors.accent;
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ alignItems: 'center', width: 14 }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: dot, marginTop: 4 }} />
        {!last ? <View style={{ flex: 1, width: 2, backgroundColor: colors.divider, marginVertical: 2 }} /> : null}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : 16, gap: 2 }}>
        <T size={15} weight="semibold">{title}</T>
        {subtitle ? <T size={13} color={colors.text3}>{subtitle}</T> : null}
      </View>
    </View>
  );
}

export default function RequestDetailScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { params } = useRoute();
  const toast = useToast();
  const { user, employees } = useAuth();
  const { requests, personalDays, setRequestStatus, deleteRequest } = useData();
  const [busy, setBusy] = useState('');

  const item = useMemo(() => buildRequestItems(requests, personalDays, employees).find((r) => String(r.id) === String(params?.id)
    && (params?.kind === 'asuntos_propios' ? r.type === 'asuntos_propios' : r.type !== 'asuntos_propios')),
  [requests, personalDays, employees, params]);

  if (!item) {
    return (
      <Screen>
        <Header title="Solicitud" back />
        <EmptyState icon={FileSearch} title="Solicitud no disponible" message="Puede que se haya eliminado." />
      </Screen>
    );
  }

  const isAdmin = user?.role === 'admin';
  const isMine = item.employeeId === user?.id;
  const reviewer = employees.find((e) => e.id === item.reviewerId);
  const reviewerName = item.reviewerName || reviewer?.name;
  const StatusIcon = item.status === 'approved' ? CheckCircle2 : item.status === 'rejected' ? XCircle : Clock;
  const [statusBg, statusFg] = tone(colors, item.status);

  const decide = (status) => {
    const verb = status === 'approved' ? 'aprobar' : 'rechazar';
    Alert.alert(`¿${verb[0].toUpperCase()}${verb.slice(1)} solicitud?`, `${requestTypeLabel(item.type)} de ${item.employeeName || 'empleado'}`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: status === 'approved' ? 'Aprobar' : 'Rechazar',
        style: status === 'approved' ? 'default' : 'destructive',
        onPress: async () => {
          setBusy(status);
          const { error } = await setRequestStatus(item, status);
          setBusy('');
          if (error) toast.error(toUserMessage(error));
          else toast.success(status === 'approved' ? 'Solicitud aprobada' : 'Solicitud rechazada');
        },
      },
    ]);
  };

  const remove = () => {
    Alert.alert('Eliminar solicitud', '¿Seguro que quieres eliminarla? Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setBusy('delete');
          const { error } = await deleteRequest(item);
          setBusy('');
          if (error) toast.error(toUserMessage(error));
          else { toast.success('Solicitud eliminada'); navigation.goBack(); }
        },
      },
    ]);
  };

  const footer = (
    <>
      {isAdmin && item.status === 'pending' ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <GlassButton title="Rechazar" icon={X} variant="danger" size="lg" style={{ flex: 1 }} loading={busy === 'rejected'} onPress={() => decide('rejected')} />
          <GlassButton title="Aprobar" icon={Check} size="lg" style={{ flex: 1 }} loading={busy === 'approved'} onPress={() => decide('approved')} />
        </View>
      ) : null}
      {isMine && item.status === 'rejected' ? (
        <GlassButton title="Volver a solicitar" icon={RotateCcw} size="lg" onPress={() => navigation.navigate('NewRequest', { type: item.type })} />
      ) : null}
      {reviewer?.email && !isAdmin ? (
        <GlassButton title={`Escribir a ${reviewerName.split(' ')[0]}`} icon={Mail} variant="glass" size="md"
          onPress={() => Linking.openURL(`mailto:${reviewer.email}?subject=${encodeURIComponent(`Solicitud: ${requestTypeLabel(item.type)}`)}`)} />
      ) : null}
    </>
  );
  const hasFooter = (isAdmin && item.status === 'pending') || (isMine && item.status === 'rejected') || (reviewer?.email && !isAdmin);

  return (
    <Screen footer={hasFooter ? footer : null}>
      <Header
        back
        right={isAdmin ? <GlassButton icon={Trash2} variant="danger" size="sm" title="Eliminar" loading={busy === 'delete'} onPress={remove} /> : null}
        title={requestTypeLabel(item.type)}
        subtitle={item.type === 'asuntos_propios' ? `${fmtDayLong(item.date)} · 1 día` : requestDetail(item)}
      />
      <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: statusBg }}>
        <StatusIcon size={14} color={statusFg} />
        <T size={13} weight="semibold" color={statusFg}>
          {item.status === 'approved' ? 'Aprobada' : item.status === 'rejected' ? 'Rechazada' : 'Pendiente de revisión'}
        </T>
      </View>

      <GlassCard padding={0}>
        {!isMine ? <InfoLine label="Empleado" value={item.employeeName} /> : null}
        {item.type === 'purchase' ? (
          <>
            <InfoLine label="Artículo" value={item.item} />
            <InfoLine label="Importe" value={fmtMoney(item.amount)} mono />
          </>
        ) : item.type === 'asuntos_propios' ? (
          <InfoLine label="Día" value={fmtDate(item.date)} />
        ) : (
          <>
            <InfoLine label="Desde" value={fmtDate(item.startDate)} />
            <InfoLine label="Hasta" value={fmtDate(item.endDate)} />
          </>
        )}
        <InfoLine label="Enviada" value={`${fmtDate(item.createdAt)} · ${fmtTime(item.createdAt)}`} last={!item.reason} />
        {item.reason ? (
          <View style={{ padding: 16, gap: 6 }}>
            <T size={14} color={colors.text3}>{item.type === 'purchase' ? 'Justificación' : 'Motivo'}</T>
            <T size={15}>{item.reason}</T>
          </View>
        ) : null}
      </GlassCard>

      {item.fileUrl ? (
        <GlassButton title="Ver justificante" icon={Eye} variant="glass" onPress={() => navigation.navigate('DocumentViewer', { url: item.fileUrl, title: 'Justificante' })} />
      ) : null}

      {item.status !== 'pending' && reviewerName ? (
        <GlassCard style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar name={reviewerName} initials={reviewer?.avatar} size={40} />
            <View style={{ flex: 1 }}>
              <T size={15} weight="semibold">{reviewerName}</T>
              <T size={13} color={colors.text3}>{reviewer?.dept ? `${reviewer.dept} · ` : ''}{item.reviewedAt ? `${fmtDate(item.reviewedAt, { year: false })}, ${fmtTime(item.reviewedAt)}` : ''}</T>
            </View>
          </View>
          <T size={14} color={colors.text2}>{item.status === 'approved' ? 'Ha aprobado la solicitud.' : 'Ha rechazado la solicitud.'}</T>
        </GlassCard>
      ) : null}

      <View style={{ gap: 12 }}>
        <Label>Historial</Label>
        <GlassCard>
          <Step title="Enviada" subtitle={`${fmtDate(item.createdAt, { year: false })}, ${fmtTime(item.createdAt)}`} tone="accent" />
          <Step title="En revisión" subtitle={item.status === 'pending' ? 'Esperando la decisión de un administrador' : null} tone="pending" last={item.status === 'pending'} />
          {item.status !== 'pending' ? (
            <Step
              title={item.status === 'approved' ? 'Aprobada' : 'Rechazada'}
              subtitle={item.reviewedAt ? `${fmtDate(item.reviewedAt, { year: false })}, ${fmtTime(item.reviewedAt)}${item.type === 'asuntos_propios' && item.status === 'rejected' ? ' · día devuelto a tu saldo' : ''}` : null}
              tone={item.status}
              last
            />
          ) : null}
        </GlassCard>
      </View>
    </Screen>
  );
}
