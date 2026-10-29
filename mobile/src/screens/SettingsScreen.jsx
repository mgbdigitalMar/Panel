// 23 · Más y ajustes (SettingsPage + section menu)
import { useEffect, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import { UsersRound, Newspaper, FileText, Bell, BellRing, ChevronRight, ShieldCheck, Building2, Send, Timer, LogOut, UserCog, Moon, Sun, SunMoon, Lock } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { Screen } from '../components/common/Screen';
import { Header } from '../components/common/Header';
import { TopBar } from '../components/common/TopBar';
import { GlassCard } from '../components/common/GlassCard';
import { GlassButton } from '../components/common/GlassButton';
import { PressScale } from '../components/common/Pressable';
import { T, Label } from '../components/common/Text';
import { ActionGrid, Avatar, Segmented, SwitchRow, IconTile } from '../components/common/UI';
import { BrandPanel, ON_BRAND } from '../components/common/Brand';
import { usePendingApprovals } from '../hooks/usePendingApprovals';
import { biometricSupport, authenticate } from '../services/biometrics';
import { Notifications, isAndroidExpoGo, lastPushRegistration } from '../services/pushNotifications';

function MenuRow({ icon, tone = 'accent', label, value, valueColor, badge, onPress, last, children }) {
  const { colors } = useTheme();
  const body = (
    <>
      {icon ? <IconTile icon={icon} tone={tone} size={34} /> : null}
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <T size={15} weight="medium" numberOfLines={1}>{label}</T>
        {value ? <T size={12.5} color={valueColor || colors.text3} numberOfLines={1}>{value}</T> : null}
      </View>
      {children}
      {badge ? (
        <View style={{ minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
          <T size={12} weight="bold" color="#FFFFFF" style={{ lineHeight: 14 }}>{badge}</T>
        </View>
      ) : null}
      {onPress ? <ChevronRight size={18} color={colors.text3} /> : null}
    </>
  );
  const style = { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.divider };
  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={value ? `${label}, ${value}` : label} scaleTo={0.985} style={style}>
      {body}
    </PressScale>
  );
}

export default function SettingsScreen() {
  const { colors, mode, setMode } = useTheme();
  const navigation = useNavigation();
  const toast = useToast();
  const confirm = useConfirm();
  const { user, employees, logout, biometric, setBiometricEnabled } = useAuth();
  const { unreadCount, documents } = useData();
  const pendingDocs = documents.filter((d) => String(d.recipientId) === String(user?.id) && d.status === 'pending').length;
  const pending = usePendingApprovals();
  const [bio, setBio] = useState({ available: false, label: 'biometría' });
  const [pushStatus, setPushStatus] = useState('undetermined');
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    biometricSupport().then(setBio);
    Notifications.getPermissionsAsync().then((p) => setPushStatus(p.status)).catch(() => {});
  }, []);

  const toggleBio = async (on) => {
    if (on) {
      const ok = await authenticate(`Activar desbloqueo con ${bio.label}`);
      if (!ok) return;
    }
    await setBiometricEnabled(on);
    toast.success(on ? `Desbloqueo con ${bio.label} activado` : 'Desbloqueo biométrico desactivado');
  };

  const confirmLogout = async () => {
    if (await confirm({ title: 'Cerrar sesión', message: '¿Quieres cerrar la sesión en este dispositivo?', confirmText: 'Cerrar sesión', icon: LogOut })) logout();
  };

  const handlePushPress = () => {
    if (isAndroidExpoGo) {
      Alert.alert(
        'Notificaciones push',
        'En Expo Go (Android) las notificaciones push remotas no están disponibles desde el SDK 53. Para probar avisos push en este dispositivo, utiliza una compilación de desarrollo (development build / APK).',
        [{ text: 'Entendido' }]
      );
      return;
    }
    Linking.openSettings();
  };

  const pushLabel = isAndroidExpoGo
    ? 'No disponible en Expo Go'
    : pushStatus === 'granted'
      ? (lastPushRegistration && !lastPushRegistration.ok
        ? (lastPushRegistration.reason === 'no-project-id' ? 'Falta el proyecto EAS' : 'Dispositivo sin registrar')
        : 'Activadas')
      : pushStatus === 'denied'
        ? 'Bloqueadas en el sistema'
        : 'Sin configurar';

  return (
    <Screen tabBarSpace>
      <TopBar />
      <Header title="Más" />

      <PressScale onPress={() => navigation.navigate('Profile')} accessibilityRole="button" accessibilityLabel={`Mi perfil, ${user?.name || ''}`} scaleTo={0.98}>
        <BrandPanel padding={16} radius={24} rings={false} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar name={user?.name} initials={user?.avatar} src={user?.avatarUrl} size={54} />
          <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
            <T size={17} weight="semibold" color={ON_BRAND.text} numberOfLines={1}>{user?.name}</T>
            <T size={13} color={ON_BRAND.text2} numberOfLines={1}>{[user?.dept, user?.email].filter(Boolean).join(' · ')}</T>
          </View>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronRight size={18} color="#FFFFFF" />
          </View>
        </BrandPanel>
      </PressScale>

      <View style={{ gap: 10 }}>
        <Label>Accesos rápidos</Label>
        <ActionGrid
          items={[
            { key: 'team', icon: UsersRound, tone: 'accent', label: 'Equipo', sub: employees.length ? `${employees.length} personas` : 'Directorio', onPress: () => navigation.navigate('Employees') },
            { key: 'news', icon: Newspaper, tone: 'purple', label: 'Noticias', sub: 'Comunicados y eventos', onPress: () => navigation.navigate('News') },
            { key: 'notif', icon: Bell, tone: 'amber', label: 'Avisos', sub: unreadCount ? `${unreadCount} sin leer` : 'Todo al día', badge: unreadCount || null, onPress: () => navigation.navigate('Notifications') },
            { key: 'docs', icon: FileText, tone: 'teal', label: 'Documentos', sub: pendingDocs ? `${pendingDocs} por revisar` : 'Nóminas y contratos', badge: pendingDocs || null, onPress: () => navigation.navigate('Documents') },
          ]}
        />
      </View>

      {isAdmin ? (
        <View style={{ gap: 10 }}>
          <Label>Administración</Label>
          <GlassCard padding={0}>
            <MenuRow icon={ShieldCheck} label="Aprobar" value="Solicitudes, reservas y horas" badge={pending.length || null} onPress={() => navigation.navigate('Admin')} />
            <MenuRow icon={UserCog} tone="purple" label="Usuarios" onPress={() => navigation.navigate('AdminUsers')} />
            <MenuRow icon={Building2} tone="teal" label="Salas y flota" onPress={() => navigation.navigate('AdminResources')} />
            <MenuRow icon={Send} tone="amber" label="Documentos enviados" onPress={() => navigation.navigate('AdminDocuments')} />
            <MenuRow icon={Timer} tone="green" label="Horas del equipo" onPress={() => navigation.navigate('AdminHours')} last />
          </GlassCard>
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        <Label>Preferencias</Label>
        <GlassCard padding={0}>
          <View style={{ paddingVertical: 12, paddingHorizontal: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconTile icon={mode === 'dark' ? Moon : mode === 'light' ? Sun : SunMoon} tone="neutral" size={34} />
              <T size={15} weight="medium" style={{ flex: 1 }}>Apariencia</T>
            </View>
            <Segmented value={mode} onChange={setMode} height={40}
              options={[{ value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }, { value: 'system', label: 'Auto' }]} />
          </View>
          {bio.available ? (
            <View style={{ borderBottomWidth: 1, borderBottomColor: colors.divider }}>
              <SwitchRow title={`Desbloqueo con ${bio.label}`} subtitle="Para reanudar la sesión y entrar sin contraseña"
                value={!!(biometric.enabled && biometric.userId === user?.id)} onValueChange={toggleBio} />
            </View>
          ) : null}
          <MenuRow icon={BellRing} tone="neutral" label="Notificaciones push" value={pushLabel}
            valueColor={pushStatus === 'denied' ? colors.dangerFg : undefined} onPress={handlePushPress} />
          <MenuRow icon={Lock} tone="neutral" label="Pausar sesión por inactividad" last>
            <T mono weight="semibold" size={14} color={colors.text2}>30 min</T>
          </MenuRow>
        </GlassCard>
      </View>

      <GlassButton title="Cerrar sesión" icon={LogOut} variant="danger" size="lg" onPress={confirmLogout} />
      <T size={12} color={colors.muted} align="center">Margube · versión {Constants.expoConfig?.version || '1.0.0'}</T>
    </Screen>
  );
}
