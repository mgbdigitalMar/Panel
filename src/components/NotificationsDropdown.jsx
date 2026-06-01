import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Bell, CheckCircle, XCircle } from 'lucide-react';
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
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className={clsx(styles.dropdown, styles.notiDropdown)}
          role="dialog"
          aria-label="Panel de notificaciones"
        >
          <div className={styles.dropdownHeader}>
            <p>Notificaciones</p>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
                Marcar todo leído
              </Button>
            )}
          </div>

          <div className={styles.notiList} role="list">
            {notifications.length === 0 ? (
              <div className={styles.emptyNoti}>
                <p>No hay notificaciones recientes</p>
              </div>
            ) : (
              notifications.map(n => {
                const typeIcon = n.type === 'success' ? <CheckCircle size={13} /> : n.type === 'error' ? <XCircle size={13} /> : <Bell size={13} />;
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
                      <strong>{n.title}</strong>
                      {n.body && <span>{n.body}</span>}
                      <span style={{ fontSize: 10, color: 'var(--text-mut)', marginTop: 2 }}>
                        {new Date(n.created_at).toLocaleString('es-ES', {
                          day: '2-digit', month: 'short',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {!n.read && <span className={styles.unreadDot} aria-label="No leída" />}
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
