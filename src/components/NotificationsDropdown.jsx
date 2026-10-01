import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Bell, CheckCircle, XCircle, CheckCheck, Clock, ChevronRight } from 'lucide-react';
import { Button } from './ui';
import styles from './Layout.module.scss';

export function NotificationsDropdown({
  notiMenu,
  setNotiMenu,
  unreadCount,
  notifications,
  handleMarkAllRead,
  markNotifRead,
  navigate,
  user
}) {
  return (
    <AnimatePresence>
      {notiMenu && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className={clsx(styles.dropdown, styles.notiDropdown)}
          role="dialog"
          aria-label="Panel de notificaciones"
        >
          <div className={styles.dropdownHeader}>
            <div className={styles.dropdownHeaderTitle}>
              <p>Notificaciones</p>
              {unreadCount > 0 ? (
                <span className={styles.notiBadgePill}>
                  {unreadCount} {unreadCount === 1 ? 'nueva' : 'nuevas'}
                </span>
              ) : (
                <span className={styles.notiBadgePillRead}>
                  Al día
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                className={styles.markAllBtn}
                icon={CheckCheck}
              >
                Marcar todo leído
              </Button>
            )}
          </div>

          <div className={styles.notiList} role="list">
            {notifications.length === 0 ? (
              <div className={styles.emptyNoti}>
                <div className={styles.emptyNotiIcon}>
                  <Bell size={26} />
                </div>
                <p className={styles.emptyNotiTitle}>Estás al día</p>
                <span className={styles.emptyNotiSub}>No tienes notificaciones pendientes en este momento</span>
              </div>
            ) : (
              notifications.map(n => {
                const typeIcon = n.type === 'success' ? <CheckCircle size={14} /> : n.type === 'error' ? <XCircle size={14} /> : <Bell size={14} />;
                const typeStyle = n.type === 'success' ? styles.notiSuccess : n.type === 'error' ? styles.notiWarning : styles.notiAccent;
                let entityNav = n.entity_type === 'request' ? 'requests' : n.entity_type === 'document' ? 'profile' : n.entity_type === 'hour_compensation' ? 'horas' : n.entity_type === 'reservation' ? 'reservations' : 'dashboard';
                if (user?.role === 'admin' && n.entity_type === 'hour_compensation') entityNav = 'admin';

                return (
                  <div
                    key={n.id}
                    role="button"
                    className={clsx(styles.notiItem, { [styles.notiItemRead]: n.read })}
                    onClick={() => { markNotifRead?.(n.id); navigate('/' + entityNav); setNotiMenu(false); }}
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        markNotifRead?.(n.id);
                        navigate('/' + entityNav);
                        setNotiMenu(false);
                      }
                    }}
                  >
                    <div className={clsx(styles.notiIcon, typeStyle)} aria-hidden="true">
                      {typeIcon}
                    </div>
                    <div className={styles.notiText}>
                      <div className={styles.notiTitleRow}>
                        <strong>{n.title}</strong>
                        {!n.read && <span className={styles.unreadDot} aria-label="No leída" />}
                      </div>
                      {n.body && <span className={styles.notiBody}>{n.body}</span>}
                      <span className={styles.notiTime}>
                        <Clock size={11} aria-hidden="true" />
                        {new Date(n.created_at).toLocaleString('es-ES', {
                          day: '2-digit', month: 'short',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <ChevronRight size={14} className={styles.notiChevron} aria-hidden="true" />
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
