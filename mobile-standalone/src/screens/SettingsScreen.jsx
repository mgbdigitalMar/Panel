// 23 · Más y ajustes (SettingsPage + section menu)
import { useEffect, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import { UsersRound, Newspaper, FileText, Bell, ChevronRight, ShieldCheck, Building2, Send, Timer, LogOut, UserCog } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { Screen } from '../components/common/Screen';
import { Header } from '../components/common/Header';
import { GlassCard } from '../components/common/GlassCard';
import { GlassButton } from '../components/common/GlassButton';
import { PressScale } from '../components/common/Pressable';
import { T, Label } from '../components/common/Text';
import { Avatar, Segmented, SwitchRow, IconTile } from '../components/common/UI';
import { usePendingApprovals } from '../hooks/usePendingApprovals';
import { biometricSupport, authenticate } from '../services/biometrics';
import { Notifications, isAndroidExpoGo } from '../services/pushNotifications';

function Tile({ icon: Icon, label, badge, onPress }) {
  const { colors } = useTheme();
  return (
    <PressScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      style={{
        flex: 1,
        minWidth: 0,
        height: 78,
        borderRadius: 18,
        paddingVertical: 10,
        paddingHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: colors.glass,
        borderWidth: 1,
        borderColor: colors.glassBorder,
      }}
    >
      <View style={{ position: 'relative' }}>
        <Icon size={22} color={colors.accent} strokeWidth={1.9} />
        {badge ? (
          <View
            style={{
              position: 'absolute',
              top: -5,
              right: -9,
              minWidth: 16,
              height: 16,
              paddingHorizontal: 4,
              borderRadius: 8,
              backgroundColor: colors.danger,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <T size={9.5} weight="bold" color="#FFFFFF" style={{ lineHeight: 11 }}>
              {badge}
            </T>
          </View>
        ) : null}
      </View>
      <T size={11.5} weight="semibold" numberOfLines={1} align="center" adjustsFontSizeToFit style={{ maxWidth: '100%' }}>
        {label}
      </T>
    </PressScale>
  );
}

function MenuRow({ icon, label, badge, onPress, last }) {
  const { colors } = useTheme();
  return (
    <PressScale onPress={onPress} accessibilityRole="button" scaleTo={0.985}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.divider }}>
      <IconTile icon={icon} tone="accent" size={34} radius={10} />
      <T size={15} weight="medium" style={{ flex: 1 }}>{label}</T>
      {badge ? (
        <View style={{ minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
          <T size={12} weight="bold" color="#FFFFFF" style={{ lineHeight: 14 }}>{badge}</T>
        </View>
      ) : null}
      <ChevronRight size={18} color={colors.text3} />
    </PressScale>
  );
}

export default function SettingsScreen() {
  const { colors, mode, setMode } = useTheme();
  const navigation = useNavigation();
  const toast = useToast();
  const { user, logout, biometric, setBiometricEnabled } = useAuth();
  const { unreadCount } = useData();
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

  const confirmLogout = () => Alert.alert('Cerrar sesión', '¿Quieres cerrar la sesión en este dispositivo?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Cerrar sesión', style: 'destructive', onPress: logout },
  ]);

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
      ? 'Activadas'
      : pushStatus === 'denied'
        ? 'Bloqueadas en el sistema'
        : 'Sin configurar';

  return (
    <Screen tabBarSpace>
      <Header title="Más" />

      <GlassCard onPress={() => navigation.navigate('Profile')} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }} accessibilityLabel="Mi perfil">
        <Avatar name={user?.name} initials={user?.avatar} size={52} />
        <View style={{ flex: 1, gap: 2 }}>
          <T size={17} weight="semibold" numberOfLines={1}>{user?.name}</T>
          <T size={13} color={colors.text3} numberOfLines={1}>{[user?.dept, user?.email].filter(Boolean).join(' · ')}</T>
        </View>
        <ChevronRight size={20} color={colors.text3} />
      </GlassCard>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Tile icon={UsersRound} label="Equipo" onPress={() => navigation.navigate('Employees')} />
        <Tile icon={Newspaper} label="Noticias" onPress={() => navigation.navigate('News')} />
        <Tile icon={Bell} label="Avisos" badge={unreadCount || null} onPress={() => navigation.navigate('Notifications')} />
        <Tile icon={FileText} label="Documentos" onPress={() => navigation.navigate('Documents')} />
      </View>

      {isAdmin ? (
        <View style={{ gap: 10 }}>
          <Label>Administración</Label>
          <GlassCard padding={0}>
            <MenuRow icon={ShieldCheck} label="Aprobar" badge={pending.length || null} onPress={() => navigation.navigate('Admin')} />
            <MenuRow icon={UserCog} label="Usuarios" onPress={() => navigation.navigate('AdminUsers')} />
            <MenuRow icon={Building2} label="Salas y flota" onPress={() => navigation.navigate('AdminResources')} />
            <MenuRow icon={Send} label="Documentos enviados" onPress={() => navigation.navigate('AdminDocuments')} />
            <MenuRow icon={Timer} label="Horas del equipo" onPress={() => navigation.navigate('AdminHours')} last />
          </GlassCard>
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        <Label>Preferencias</Label>
        <GlassCard padding={14} style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <T size={15} style={{ minWidth: 44 }}>Tema</T>
            <Segmented value={mode} onChange={setMode} height={38} style={{ flex: 1, minWidth: 175, maxWidth: 220 }}
              options={[{ value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }, { value: 'system', label: 'Auto' }]} />
          </View>
          {bio.available ? (
            <SwitchRow title={`Desbloqueo con ${bio.label}`} subtitle="Para reanudar la sesión y entrar sin contraseña"
              value={!!(biometric.enabled && biometric.userId === user?.id)} onValueChange={toggleBio} />
          ) : null}
          <PressScale onPress={handlePushPress} accessibilityRole="button" scaleTo={0.985}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.glass }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T size={15}>Notificaciones push</T>
              <T size={12.5} color={pushStatus === 'denied' ? colors.dangerFg : colors.text3}>{pushLabel}</T>
            </View>
            <ChevronRight size={18} color={colors.text3} />
          </PressScale>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.glass }}>
            <T size={15}>Pausar sesión por inactividad</T>
            <T mono weight="semibold" size={14} color={colors.text2}>30 min</T>
          </View>
        </GlassCard>
      </View>

      <GlassButton title="Cerrar sesión" icon={LogOut} variant="danger" size="lg" onPress={confirmLogout} />
      <T size={12} color={colors.muted} style={{ textAlign: 'center' }}>Margube · versión {Constants.expoConfig?.version || '1.0.0'}</T>
    </Screen>
  );
}
