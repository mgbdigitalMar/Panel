// 12 · Nueva solicitud (modal "Nueva solicitud" of the web RequestsPage)
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FileText } from 'lucide-react-native';
import { toUserMessage } from '@shared/utils/errors.js';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { Screen } from '../components/common/Screen';
import { ModalHeader } from '../components/common/Header';
import { GlassCard } from '../components/common/GlassCard';
import { GlassInput, DateField } from '../components/common/GlassInput';
import { GlassButton } from '../components/common/GlassButton';
import { PressScale } from '../components/common/Pressable';
import { FileField } from '../components/common/FileField';
import { T } from '../components/common/Text';
import { Banner, Checkbox } from '../components/common/UI';
import { uploadPickedFile } from '../services/files';
import { personalDaysSummary } from '../utils/domain';
import { requestIcon } from '../utils/icons';
import { daysBetween, todayISO } from '../utils/format';

const TYPES = [
  { id: 'asuntos_propios', label: 'Asuntos', fullLabel: 'Asuntos propios' },
  { id: 'remoto', label: 'Remoto', fullLabel: 'Trabajo remoto' },
  { id: 'external', label: 'Externo', fullLabel: 'Trabajo externo' },
  { id: 'purchase', label: 'Compras', fullLabel: 'Compras' },
];

// Same conditions text as the web modal.
const CONDITIONS = {
  remoto: {
    title: 'Condiciones de remoto',
    sections: [
      ['1. He sido informado/a de las condiciones aplicables', ['Comunicación previa a rrhh@margube.com, con traslado a Dirección para su aprobación.']],
      ['2. Normas durante el trabajo remoto', ['Avisar cambios.', 'Mantener horario presencial.', 'Control horario con ubicación activada.', 'Teams conectado todo el día.', 'Reflejar en calendario corporativo.', 'Registrar horas en Cinegia.']],
      ['3. Modificación de días', ['Podrán ser modificados por la dirección.']],
      ['4. Consecuencias del incumplimiento', ['Pérdida del derecho a solicitar remoto.']],
    ],
  },
  external: {
    title: 'Condiciones de trabajo externo',
    sections: [
      ['1. He sido informado/a de las condiciones aplicables', ['Comunicación previa. Máximo 4 solicitudes/año. Máximo 20 días anuales.']],
      ['2. Normas durante el trabajo externo', ['Avisar cambios.', 'Mantener horario.', 'Control horario con ubicación.', 'Teams conectado.', 'Reflejar en calendario.', 'Registrar horas en Cinegia.']],
      ['3. Consecuencias del incumplimiento', ['Pérdida del derecho a solicitar trabajo externo.']],
    ],
  },
};

const TYPE_ICONS = Object.fromEntries(TYPES.map((t) => [t.id, requestIcon(t.id)]));

function TypeTile({ type, active, onPress }) {
  const { colors } = useTheme();
  const Icon = TYPE_ICONS[type.id];
  return (
    <PressScale
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      accessibilityLabel={type.fullLabel || type.label}
      style={{
        flex: 1,
        minWidth: 0,
        height: 78,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 4,
        backgroundColor: colors.glass,
        borderWidth: active ? 1.5 : 1,
        borderColor: active ? colors.accentBorder : colors.glassBorder,
      }}
    >
      <View style={{ position: 'relative' }}>
        <Icon size={22} color={active ? colors.accent : colors.text3} strokeWidth={active ? 2.2 : 1.8} />
      </View>
      <T
        size={11.5}
        weight={active ? 'bold' : 'medium'}
        color={active ? colors.accent : colors.text}
        numberOfLines={1}
        align="center"
        adjustsFontSizeToFit
        style={{ maxWidth: '100%' }}
      >
        {type.label}
      </T>
    </PressScale>
  );
}

function Conditions({ type, onRead }) {
  const { colors } = useTheme();
  const cfg = CONDITIONS[type];
  const [boxH, setBoxH] = useState(0);
  return (
    <GlassCard padding={14} style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <FileText size={20} color={colors.accentFg} />
        <View style={{ flex: 1 }}>
          <T size={15} weight="semibold">{cfg.title}</T>
          <T size={12.5} color={colors.text3}>Léelas hasta el final para poder aceptarlas</T>
        </View>
      </View>
      <ScrollView
        nestedScrollEnabled
        style={{ maxHeight: 190, borderRadius: 12, backgroundColor: colors.inputBg }}
        contentContainerStyle={{ padding: 12, gap: 10 }}
        onLayout={(e) => setBoxH(e.nativeEvent.layout.height)}
        onContentSizeChange={(_w, h) => { if (boxH && h <= boxH + 5) onRead(); }}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          if (contentSize.height - contentOffset.y <= layoutMeasurement.height + 8) onRead();
        }}
        scrollEventThrottle={64}
      >
        {cfg.sections.map(([title, lines]) => (
          <View key={title} style={{ gap: 4 }}>
            <T size={13.5} weight="semibold">{title}</T>
            {lines.map((l) => <T key={l} size={13} color={colors.text2}>{lines.length > 1 ? `• ${l}` : l}</T>)}
          </View>
        ))}
      </ScrollView>
    </GlassCard>
  );
}

export default function NewRequestScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const toast = useToast();
  const { user } = useAuth();
  const { personalDays, createPersonalDay, createRequest } = useData();

  const [type, setType] = useState(route.params?.type || 'asuntos_propios');
  const [form, setForm] = useState({ date: '', startDate: '', endDate: '', reason: '', item: '', amount: '' });
  const [file, setFile] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [conditionsRead, setConditionsRead] = useState(false);
  const [sending, setSending] = useState(false);
  const [step, setStep] = useState('');

  const changeType = (t) => {
    setType(t);
    setAccepted(false);
    setConditionsRead(false);
  };

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const days = personalDaysSummary(personalDays, user?.id);
  const rangeDays = form.startDate && form.endDate ? daysBetween(form.startDate, form.endDate) : 0;
  const rawAmount = String(form.amount).trim();
  // "1.250,50" (Spanish) or "1250.50" are both accepted.
  const amount = parseFloat(rawAmount.includes(',') ? rawAmount.replace(/\./g, '').replace(',', '.') : rawAmount);

  let error = '';
  let valid = false;
  if (type === 'asuntos_propios') {
    valid = !!form.date && !!form.reason.trim() && accepted;
  } else if (type === 'purchase') {
    if (form.amount && (Number.isNaN(amount) || amount <= 0)) error = 'Introduce un importe válido.';
    valid = !!form.item.trim() && !Number.isNaN(amount) && amount > 0;
  } else {
    if (form.startDate && form.endDate && form.endDate < form.startDate) error = 'La fecha de fin no puede ser anterior a la de inicio.';
    valid = !!form.startDate && !!form.endDate && !error && accepted;
  }

  const submit = async () => {
    if (!valid || sending) return;
    setSending(true);
    try {
      let res;
      if (type === 'asuntos_propios') {
        let fileUrl = null;
        if (file) {
          setStep('Subiendo justificante…');
          fileUrl = await uploadPickedFile(file);
        }
        setStep('Enviando…');
        res = await createPersonalDay({ date: form.date, reason: form.reason.trim(), fileUrl });
      } else if (type === 'purchase') {
        res = await createRequest({ type: 'purchase', item: form.item.trim(), amount, reason: form.reason.trim() });
      } else {
        res = await createRequest({ type, start_date: form.startDate, end_date: form.endDate, days: rangeDays, reason: form.reason.trim() });
      }
      if (res?.error) throw res.error;
      toast.success('Solicitud enviada', 'Te avisaremos cuando se revise.');
      navigation.goBack();
    } catch (e) {
      toast.error(toUserMessage(e));
    } finally {
      setSending(false);
      setStep('');
    }
  };

  return (
    <Screen
      glow={false}
      footer={<GlassButton title={step || 'Enviar solicitud'} size="lg" onPress={submit} loading={sending} disabled={!valid} />}
    >
      <ModalHeader title="Nueva solicitud" />

      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 8 }}>
        {TYPES.map((t) => (
          <TypeTile key={t.id} type={t} active={type === t.id} onPress={() => changeType(t.id)} />
        ))}
      </View>

      {type === 'asuntos_propios' ? (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 16, backgroundColor: colors.accentSoft }}>
            <T size={14} color={colors.text2} style={{ flex: 1 }}>Te quedan {days.left} de {days.total} días. Esta solicitud usa</T>
            <T mono weight="semibold" size={15} color={colors.accentFg}>1 día</T>
          </View>
          {days.left === 0 ? <Banner tone="amber">Ya has usado todos tus días de este año. RRHH revisará la solicitud igualmente.</Banner> : null}
          <DateField label="Día solicitado" value={form.date} onChange={set('date')} required minimumDate={new Date()} />
          <GlassInput label="Motivo de la solicitud" value={form.reason} onChangeText={set('reason')} multiline rows={3} required
            placeholder="Describe brevemente el motivo…" />
          <FileField label="Documentación justificativa (opcional)" value={file} onChange={setFile} />
          <Checkbox
            checked={accepted}
            onChange={setAccepted}
            label="Declaro que el motivo indicado corresponde a un asunto personal que no puede realizarse fuera de la jornada laboral."
          />
        </>
      ) : null}

      {type === 'remoto' || type === 'external' ? (
        <>
          <Conditions type={type} onRead={() => setConditionsRead(true)} />
          <Checkbox
            checked={accepted}
            onChange={setAccepted}
            disabled={!conditionsRead}
            label={conditionsRead
              ? 'En conformidad con lo anterior, firmo el presente documento como muestra de mi aceptación y compromiso.'
              : 'Debes leer las condiciones hasta el final para poder aceptar.'}
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <DateField label="Desde" value={form.startDate} onChange={(v) => setForm((f) => ({ ...f, startDate: v, endDate: f.endDate && f.endDate < v ? v : f.endDate || v }))} required style={{ flex: 1 }} minimumDate={new Date()} />
            <DateField label="Hasta" value={form.endDate} onChange={set('endDate')} required style={{ flex: 1 }} minimumDate={form.startDate ? new Date(`${form.startDate}T00:00:00`) : new Date()} />
          </View>
          {rangeDays > 0 && !error ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderRadius: 16, backgroundColor: colors.tealSoft }}>
              <T size={14} color={colors.text2}>{type === 'remoto' ? 'Días de teletrabajo' : 'Jornadas fuera de la oficina'}</T>
              <T mono weight="semibold" size={15} color={colors.tealFg}>{rangeDays} día{rangeDays === 1 ? '' : 's'}</T>
            </View>
          ) : null}
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <GlassInput label="Motivo" value={form.reason} onChangeText={set('reason')} multiline rows={3}
            placeholder={type === 'external' ? 'Explica el lugar y motivo del trabajo externo…' : 'Comentario para RRHH (opcional)'} />
        </>
      ) : null}

      {type === 'purchase' ? (
        <>
          <GlassInput label="Artículo o servicio" value={form.item} onChangeText={set('item')} required placeholder="Ej.: licencia de software, material de oficina…" />
          <GlassInput label="Importe estimado (€)" value={form.amount} onChangeText={set('amount')} keyboardType="decimal-pad" required placeholder="0,00" error={error} />
          <GlassInput label="Justificación" value={form.reason} onChangeText={set('reason')} multiline rows={3} placeholder="Explica para qué se necesita y su impacto…" />
        </>
      ) : null}

      {type !== 'purchase' && (form.date || form.startDate) && (form.date || form.startDate) < todayISO() ? (
        <Banner tone="amber">La fecha elegida ya ha pasado.</Banner>
      ) : null}
    </Screen>
  );
}
