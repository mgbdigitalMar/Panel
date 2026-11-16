// Shared so the FAB and scroll padding clear the floating tab bar exactly.
import { Platform } from 'react-native';
import { DOCK_STYLE } from '@shared/config/dock';

/** iOS uses the system's own tab bar (UITabBar, Liquid Glass on iOS 26); Android the app's dock.
 * With the system bar, «Nueva solicitud» moves from beside the dock to the top bar (TopBar). */
export const NATIVE_TABS = Platform.OS === 'ios';

export const TAB_BAR_HEIGHT = DOCK_STYLE.height;
