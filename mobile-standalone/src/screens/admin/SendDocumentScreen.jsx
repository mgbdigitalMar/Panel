// Enviar documento a un empleado ("Enviar documento" modal of the web AdminPage)
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Check, Search } from 'lucide-react-native';
import { toUserMessage } from '@shared/utils/errors.js';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { Screen } from '../../components/common/Screen';
import { ModalHeader } from '../../components/common/Header';
import { GlassInput } from '../../components/common/GlassInput';
import { GlassButton } from '../../components/common/GlassButton';
import { FileField } from '../../components/common/FileField';
import { T } from '../../components/common/Text';
import { Avatar } from '../../components/common/UI';
import { FONTS } from '../../theme/tokens';
import { uploadPickedFile } from '../../services/files';

export default function SendDocumentScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const toast = useToast();
  const { user, employees } = useAuth();
  const { sendDocument } = useData();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [recipientId, setRecipientId] = useState(null);
  const [q, setQ] = useState('');
  const [step, setStep] = useState('');

  const people = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return employees.filter((e) => e.id !== user?.id && (!needle || `${e.name} ${e.dept || ''}`.toLowerCase().includes(needle)));
  }, [employees, user?.id, q]);

  const send = async () => {
    if (!title.trim() || !recipientId) return;
    try {
      let fileUrl = null;
      if (file) {
        setStep('Subiendo archivo…');
        fileUrl = await uploadPickedFile(file);
      }
      setStep('Enviando…');
      const res = await sendDocument({ title: title.trim(), description: description.trim(), fileUrl, recipientId });
      if (res?.error) throw res.error;
      toast.success('Documento enviado', 'El empleado recibirá un aviso.');
      navigation.goBack();
    } catch (e) {
      toast.error(toUserMessage(e));
    } finally {
      setStep('');
    }
  };

  return (
    <Screen glow={false} footer={<GlassButton title={step || 'Enviar documento'} size="lg" loading={!!step} disabled={!title.trim() || !recipientId} onPress={send} />}>
      <ModalHeader title="Enviar documento" />
      <GlassInput label="Título del documento" value={title} onChangeText={setTitle} required placeholder="Ej.: Nómina octubre 2026" />
      <GlassInput label="Descripción (opcional)" value={description} onChangeText={setDescription} multiline rows={2} />
      <FileField label="Archivo adjunto" value={file} onChange={setFile} />

      <View style={{ gap: 8 }}>
        <T size={13} weight="medium" color={colors.text2}>Destinatario <T size={13} color={colors.dangerFg}>*</T></T>
        <View style={{ justifyContent: 'center' }}>
          <Search size={18} color={colors.text3} style={{ position: 'absolute', left: 14, zIndex: 1 }} />
          <TextInput value={q} onChangeText={setQ} placeholder="Buscar empleado" placeholderTextColor={colors.muted} accessibilityLabel="Buscar empleado"
            style={{ height: 44, borderRadius: 14, borderWidth: 1, borderColor: colors.glassBorderStrong, backgroundColor: colors.inputBg, color: colors.text, fontFamily: FONTS.regular, fontSize: 15, paddingLeft: 42, paddingRight: 14 }} />
        </View>
        <View style={{ gap: 6 }}>
          {people.slice(0, 30).map((e) => {
            const on = e.id === recipientId;
            return (
              <Pressable key={e.id} onPress={() => setRecipientId(e.id)} accessibilityRole="radio" accessibilityState={{ checked: on }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, backgroundColor: on ? colors.accentSoft : colors.glass, borderWidth: 1, borderColor: on ? colors.accentBorder : colors.glassBorder }}>
                <Avatar name={e.name} initials={e.avatar} size={34} />
                <View style={{ flex: 1 }}>
                  <T size={14.5} weight="semibold">{e.name}</T>
                  <T size={12.5} color={colors.text3}>{e.dept || 'Sin asignar'}</T>
                </View>
                {on ? <Check size={20} color={colors.accentFg} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}
