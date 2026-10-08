// Where a notification leads. Same mapping as the web (ENTITY_NAV_MAP / _ADMIN),
// but opening the specific item when the app has a screen for it.
import { ENTITY_NAV_MAP, ENTITY_NAV_MAP_ADMIN } from '@shared/config/constants.js';

export function openNotificationTarget(navigation, notif, user) {
  if (!notif || !navigation) return;
  const type = notif.entity_type;
  const id = notif.entity_id;
  const isAdmin = user?.role === 'admin';
  const section = (isAdmin ? ENTITY_NAV_MAP_ADMIN : ENTITY_NAV_MAP)[type];

  if ((type === 'request' || type === 'personal_day') && id) {
    navigation.navigate('RequestDetail', { id: String(id), kind: type === 'personal_day' ? 'asuntos_propios' : 'request' });
    return;
  }
  switch (section) {
    case 'reservations':
      navigation.navigate('MyReservations', { scope: isAdmin ? 'pending' : 'mine' });
      return;
    case 'horas':
      navigation.navigate('Main', { screen: 'Horas' });
      return;
    case 'admin':
      navigation.navigate(type === 'hour_compensation' ? 'AdminHours' : 'Admin');
      return;
    case 'profile':
      navigation.navigate('Documents');
      return;
    case 'requests':
      navigation.navigate('Main', { screen: 'Requests' });
      return;
    default:
      navigation.navigate('Notifications');
  }
}
