import { useNavigate } from 'react-router-dom';
import {
  UsersRound, Newspaper, Settings, SlidersHorizontal, LogOut, ChevronRight,
} from 'lucide-react';
import { useAuth, useTheme, useNews, useHours } from '../context';
import { Avatar } from '../components/ui';
import { PhoneHeader, Segmented, IconDisc, PhoneSectionTitle, usePhoneApp } from '../components/PhoneKit';
import styles from './MorePage.module.scss';

/**
 * "Más" (phones, glass): the app's Más tab — profile, the sections that are not in the dock,
 * the theme and the account. Opened from the dock; it works at any width.
 */
export default function MorePage() {
  const navigate = useNavigate();
  const phone = usePhoneApp();
  const { user, employees = [], logout } = useAuth();
  const { mode, setMode } = useTheme();
  const { news = [] } = useNews() || {};
  const { hourCompensations = [] } = useHours() || {};

  const adminPending = hourCompensations.filter((h) => h.status === 'pending').length;

  const links = [
    { id: 'employees', icon: UsersRound, tone: 'accent', label: 'Equipo', sub: `${employees.length} ${employees.length === 1 ? 'persona' : 'personas'}` },
    { id: 'news', icon: Newspaper, tone: 'amber', label: 'Noticias', sub: news.length ? 'Comunicados y eventos' : 'Sin comunicados todavía' },
    ...(user?.role === 'admin'
      ? [{ id: 'admin', icon: Settings, tone: 'purple', label: 'Administración', sub: 'Empleados, recursos y horas', badge: adminPending }]
      : []),
  ];

  return (
    <div className={styles.page}>
      {/* Wider screens get the title from Layout */}
      {phone && <PhoneHeader title="Más" />}

      <button type="button" className={styles.me} onClick={() => navigate('/profile')} aria-label={`${user?.name || 'Mi perfil'}. Ver mi perfil`}>
        <Avatar initials={user?.avatar || '??'} src={user?.avatarUrl} size={52} />
        <span className={styles.text}>
          <strong>{user?.name}</strong>
          <span>{[user?.dept, user?.email].filter(Boolean).join(' · ')}</span>
        </span>
        <ChevronRight size={18} className={styles.chev} aria-hidden="true" />
      </button>

      <section className={styles.section} aria-labelledby="mas-links">
        <span id="mas-links"><PhoneSectionTitle upper>Accesos rápidos</PhoneSectionTitle></span>
        <div className={styles.grid}>
          {links.map((l) => (
            <button key={l.id} type="button" className={styles.tile} onClick={() => navigate(`/${l.id}`)}>
              <IconDisc icon={l.icon} tone={l.tone} size={40} />
              <span className={styles.text}>
                <strong>{l.label}</strong>
                <span>{l.sub}</span>
              </span>
              {l.badge > 0 && <span className={styles.badge} aria-label={`${l.badge} pendientes`}>{l.badge > 9 ? '9+' : l.badge}</span>}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="mas-prefs">
        <span id="mas-prefs"><PhoneSectionTitle upper>Preferencias</PhoneSectionTitle></span>
        <div className={styles.list}>
          <div className={styles.item}>
            <span className={styles.itemLabel}>Apariencia</span>
            <Segmented
              label="Apariencia"
              value={mode}
              onChange={setMode}
              options={[{ value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }, { value: 'system', label: 'Auto' }]}
            />
          </div>
          <button type="button" className={styles.link} onClick={() => navigate('/settings')}>
            <SlidersHorizontal size={18} aria-hidden="true" />
            <span>Ajustes</span>
            <ChevronRight size={16} className={styles.chev} aria-hidden="true" />
          </button>
          <button type="button" className={`${styles.link} ${styles.danger}`} onClick={() => logout()}>
            <LogOut size={18} aria-hidden="true" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </section>
    </div>
  );
}
