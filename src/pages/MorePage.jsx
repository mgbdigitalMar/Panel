import { useNavigate } from 'react-router-dom';
import {
  UsersRound, Newspaper, Settings, SlidersHorizontal, LogOut, ChevronRight, LayoutGrid, Building2, Home, Briefcase, ShieldCheck,
} from 'lucide-react';
import { useAuth, useNews, useHours } from '../context';
import { Avatar } from '../components/ui';
import { Masthead, Spotlight, SpotButton, ActionTiles, BlockHead, LeafIcon } from '../components/Touch';
import styles from './MorePage.module.scss';

const MODE = {
  Office: { label: 'En la oficina', icon: Building2 },
  oficina: { label: 'En la oficina', icon: Building2 },
  Remote: { label: 'En remoto', icon: Home },
  remoto: { label: 'En remoto', icon: Home },
  External: { label: 'Trabajo externo', icon: Briefcase },
  externo: { label: 'Trabajo externo', icon: Briefcase },
};

/**
 * "Más", opened from the phone dock: your Margube pass on the brand panel (the way to your profile),
 * the sections that are not in the dock as tiles, and the account (settings, which hold the theme,
 * and signing out). Each destination appears once.
 */
export default function MorePage() {
  const navigate = useNavigate();
  const { user, employees = [], logout } = useAuth();
  const { news = [] } = useNews() || {};
  const { hourCompensations = [] } = useHours() || {};

  const adminPending = hourCompensations.filter((h) => h.status === 'pending').length;
  const work = MODE[user?.workMode] || MODE.Office;
  const WorkIcon = work.icon;

  const links = [
    { icon: UsersRound, tone: 'accent', label: 'Equipo', hint: `${employees.length} ${employees.length === 1 ? 'persona' : 'personas'}`, onClick: () => navigate('/employees') },
    { icon: Newspaper, tone: 'warning', label: 'Noticias', hint: news.length ? 'Comunicados y eventos' : 'Sin comunicados todavía', onClick: () => navigate('/news') },
    ...(user?.role === 'admin'
      ? [{ icon: Settings, tone: 'purple', label: 'Administración', hint: 'Empleados, recursos y horas', badge: adminPending, onClick: () => navigate('/admin') }]
      : []),
  ];

  return (
    <div className={styles.page}>
      <Masthead icon={LayoutGrid} title="Tu cuenta" desc="Tu perfil, el resto de secciones y tus ajustes." />

      {/* Your Margube pass: the one way to your profile */}
      <Spotlight className={styles.pass} label="Tu tarjeta"
        actions={<SpotButton primary icon={ChevronRight} onClick={() => navigate('/profile')}>Ver mi perfil</SpotButton>}>
        <div className={styles.passBody}>
          <span className={styles.passAvatar}><Avatar initials={user?.avatar || '??'} src={user?.avatarUrl} size={64} /></span>
          <div className={styles.passText}>
            <strong>{user?.name || 'Mi cuenta'}</strong>
            <span>{[user?.position, user?.dept].filter(Boolean).join(' · ') || user?.email}</span>
          </div>
        </div>
        <div className={styles.passTags}>
          <span><WorkIcon size={13} aria-hidden="true" />{work.label}</span>
          {user?.role === 'admin' && <span><ShieldCheck size={13} aria-hidden="true" />Administrador</span>}
          {user?.email && <span className={styles.passMail}>{user.email}</span>}
        </div>
      </Spotlight>

      <section aria-labelledby="mas-links">
        <span id="mas-links"><BlockHead title="Accesos rápidos" /></span>
        <ActionTiles className={styles.tiles} items={links} />
      </section>

      <section aria-label="Ajustes y sesión">
        <div className={styles.list}>
          <button type="button" className={styles.link} onClick={() => navigate('/settings')}>
            <LeafIcon icon={SlidersHorizontal} tone="neutral" size={36} />
            <span className={styles.linkText}><strong>Ajustes</strong><span>Apariencia, notificaciones y sonidos</span></span>
            <ChevronRight size={18} className={styles.chev} aria-hidden="true" />
          </button>
          <button type="button" className={`${styles.link} ${styles.danger}`} onClick={() => logout()}>
            <LeafIcon icon={LogOut} tone="danger" size={36} />
            <span className={styles.linkText}><strong>Cerrar sesión</strong><span>Salir de la intranet en este dispositivo</span></span>
          </button>
        </div>
      </section>
    </div>
  );
}
