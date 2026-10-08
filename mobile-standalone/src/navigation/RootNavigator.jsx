import { useEffect, useRef, useState } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { supabase } from '../lib/supabase';
import { Notifications, notificationIdFromResponse } from '../services/pushNotifications';
import { openNotificationTarget } from './notificationTarget';
import BottomTabs from './BottomTabs';

import LoginScreen from '../screens/LoginScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import PolicyScreen from '../screens/PolicyScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ResourceCalendarScreen from '../screens/ResourceCalendarScreen';
import MyReservationsScreen from '../screens/MyReservationsScreen';
import NewRequestScreen from '../screens/NewRequestScreen';
import RequestDetailScreen from '../screens/RequestDetailScreen';
import NewHoursScreen from '../screens/NewHoursScreen';
import EmployeesScreen from '../screens/EmployeesScreen';
import EmployeeDetailScreen from '../screens/EmployeeDetailScreen';
import NewsScreen from '../screens/NewsScreen';
import NewsEditorScreen from '../screens/NewsEditorScreen';
import ProfileScreen from '../screens/ProfileScreen';
import DocumentsScreen from '../screens/DocumentsScreen';
import DocumentViewerScreen from '../screens/DocumentViewerScreen';
import AdminScreen from '../screens/AdminScreen';
import AdminUsersScreen from '../screens/admin/AdminUsersScreen';
import UserFormScreen from '../screens/admin/UserFormScreen';
import AdminResourcesScreen from '../screens/admin/AdminResourcesScreen';
import AdminDocumentsScreen from '../screens/admin/AdminDocumentsScreen';
import SendDocumentScreen from '../screens/admin/SendDocumentScreen';
import AdminHoursScreen from '../screens/admin/AdminHoursScreen';
import HoursUserHistoryScreen from '../screens/admin/HoursUserHistoryScreen';

const Stack = createNativeStackNavigator();
export const navigationRef = createNavigationContainerRef();

const linking = {
  prefixes: [Linking.createURL('/'), 'margube://'],
  config: {
    screens: {
      Main: { screens: { Dashboard: 'inicio', Reservations: 'reservas', Requests: 'solicitudes', Horas: 'horas', Settings: 'mas' } },
      Notifications: 'notificaciones/:id?',
      Documents: 'documentos',
      News: 'noticias',
    },
  },
};

/** Opens the target of a tapped push: marks it read and navigates to its section. */
function usePushRouting(ready) {
  const { user } = useAuth();
  const { markNotifRead } = useData();
  const handled = useRef(new Set());

  useEffect(() => {
    if (!ready || !user?.id) return undefined;

    const handle = async (response) => {
      const id = notificationIdFromResponse(response);
      const key = response?.notification?.request?.identifier || id;
      if (!id || handled.current.has(key)) return;
      handled.current.add(key);
      const { data } = await supabase.from('notifications').select('*').eq('id', id).maybeSingle();
      if (!data || data.user_id !== user.id) {
        navigationRef.navigate('Notifications');
        return;
      }
      markNotifRead(data.id);
      openNotificationTarget(navigationRef, data, user);
    };

    const last = Notifications.getLastNotificationResponse();
    if (last) handle(last);
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [ready, user, markNotifRead]);
}

export default function RootNavigator({ onReady }) {
  const { colors, theme } = useTheme();
  const { user, needsPasswordChange, needsPolicy } = useAuth();
  const [navReady, setNavReady] = useState(false);
  const isAdmin = user?.role === 'admin';
  usePushRouting(navReady);

  const navTheme = {
    ...(theme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.bg,
      card: colors.bg,
      text: colors.text,
      border: colors.divider,
      primary: colors.accent,
    },
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      linking={linking}
      onReady={() => { setNavReady(true); onReady?.(); }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.bg } }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade' }} />
        ) : needsPasswordChange ? (
          <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ animation: 'fade' }} />
        ) : needsPolicy ? (
          <Stack.Screen name="Policy" component={PolicyScreen} options={{ animation: 'fade' }} />
        ) : (
          <>
            <Stack.Screen name="Main" component={BottomTabs} options={{ animation: 'fade' }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="ResourceCalendar" component={ResourceCalendarScreen} />
            <Stack.Screen name="MyReservations" component={MyReservationsScreen} />
            <Stack.Screen name="NewRequest" component={NewRequestScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="RequestDetail" component={RequestDetailScreen} />
            <Stack.Screen name="NewHours" component={NewHoursScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="Employees" component={EmployeesScreen} />
            <Stack.Screen name="EmployeeDetail" component={EmployeeDetailScreen} />
            <Stack.Screen name="News" component={NewsScreen} />
            <Stack.Screen name="NewsEditor" component={NewsEditorScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Documents" component={DocumentsScreen} />
            <Stack.Screen name="DocumentViewer" component={DocumentViewerScreen} options={{ animation: 'slide_from_bottom' }} />
            {isAdmin ? (
              <>
                <Stack.Screen name="Admin" component={AdminScreen} />
                <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
                <Stack.Screen name="UserForm" component={UserFormScreen} options={{ animation: 'slide_from_bottom' }} />
                <Stack.Screen name="AdminResources" component={AdminResourcesScreen} />
                <Stack.Screen name="AdminDocuments" component={AdminDocumentsScreen} />
                <Stack.Screen name="SendDocument" component={SendDocumentScreen} options={{ animation: 'slide_from_bottom' }} />
                <Stack.Screen name="AdminHours" component={AdminHoursScreen} />
                <Stack.Screen name="HoursUserHistory" component={HoursUserHistoryScreen} />
              </>
            ) : null}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
