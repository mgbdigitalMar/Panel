import { Image, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Bell, Plus, Search } from 'lucide-react-native';
import { useData } from '../../context/DataContext';
import { IconButton } from './GlassButton';
import { GlassFill, GlassGroup } from './LiquidGlass';
import { HapticPressable } from './Pressable';
import { NATIVE_TABS } from '../../navigation/tabBarMetrics';

const LOGO = require('../../../assets/logo.png');

/**
 * Top bar of the tab screens, the same as the web on a phone: the Margube leaf (back to Inicio),
 * search and notifications. Mi perfil is in Más.
 */
export function TopBar() {
  const navigation = useNavigation();
  const { unreadCount } = useData();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46 }}>
      {/* The leaf and the search sit side by side: one glass group (GlassEffectContainer on iOS 26) */}
      <GlassGroup spacing={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <HapticPressable
        onPress={() => navigation.navigate('Main', { screen: 'Dashboard' })}
        accessibilityRole="button"
        accessibilityLabel="Margube, ir al inicio"
        hitSlop={6}
        style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
      >
        <GlassFill radius={22} interactive />
        <View pointerEvents="none"><Image source={LOGO} style={{ width: 30, height: 30, borderRadius: 8 }} /></View>
      </HapticPressable>
      <IconButton icon={Search} onPress={() => navigation.navigate('Search')} accessibilityLabel="Buscar" />
      </GlassGroup>
      <View style={{ flex: 1 }} />
      <GlassGroup spacing={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {/* iOS: the system tab bar holds no action button, so «Nueva solicitud» lives here */}
        {NATIVE_TABS ? (
          <IconButton icon={Plus} onPress={() => navigation.navigate('NewRequest')} accessibilityLabel="Nueva solicitud" />
        ) : null}
        <IconButton
          icon={Bell}
          badge={unreadCount}
          onPress={() => navigation.navigate('Notifications')}
          accessibilityLabel={unreadCount ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'}
        />
      </GlassGroup>
    </View>
  );
}
