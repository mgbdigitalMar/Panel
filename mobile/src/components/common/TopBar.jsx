import { Image, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Bell, Search } from 'lucide-react-native';
import { useData } from '../../context/DataContext';
import { IconButton } from './GlassButton';

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
      <Pressable
        onPress={() => navigation.navigate('Main', { screen: 'Dashboard' })}
        accessibilityRole="button"
        accessibilityLabel="Margube, ir al inicio"
        hitSlop={6}
      >
        <Image source={LOGO} style={{ width: 38, height: 38, borderRadius: 10 }} />
      </Pressable>
      <IconButton icon={Search} onPress={() => navigation.navigate('Search')} accessibilityLabel="Buscar" />
      <View style={{ flex: 1 }} />
      <IconButton
        icon={Bell}
        badge={unreadCount}
        onPress={() => navigation.navigate('Notifications')}
        accessibilityLabel={unreadCount ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'}
      />
    </View>
  );
}
