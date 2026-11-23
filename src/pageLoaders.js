// Each page's code, loaded once and shared by whoever asks first: the router (App.tsx), the start-up
// preload (App.tsx) and the login, which fetches the dashboard while the person types.

const FACTORIES = {
  login:          () => import('./pages/LoginPage'),
  changePassword: () => import('./pages/ChangePasswordPage'),
  dashboard:      () => import('./pages/DashboardPage'),
  reservations:   () => import('./pages/ReservationsPage'),
  requests:       () => import('./pages/RequestsPage'),
  news:           () => import('./pages/NewsPage'),
  admin:          () => import('./pages/AdminPage'),
  employees:      () => import('./pages/EmployeesPage'),
  profile:        () => import('./pages/ProfilePage'),
  horas:          () => import('./pages/HorasPage'),
  fichaje:        () => import('./pages/FichajePage'),
  settings:       () => import('./pages/SettingsPage'),
  mas:            () => import('./pages/MorePage'),
  assistant:      () => import('./pages/AssistantPage'),
};

const pending = {};
const ready = {};

export const hasPage = (name) => Object.hasOwn(FACTORIES, name);

/** Starts (or joins) the download of a page's code */
export function loadPage(name) {
  pending[name] ||= FACTORIES[name]().then(
    (module) => { ready[name] = module.default; return module; },
    // A failed download (offline, a new deploy) may be retried by the next request
    (error) => { delete pending[name]; throw error; },
  );
  return pending[name];
}

/** The page's component once its code has arrived, or undefined */
export const readyPage = (name) => ready[name];
