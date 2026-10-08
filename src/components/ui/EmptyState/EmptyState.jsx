import { motion } from 'framer-motion';
import clsx from 'clsx';
import styles from './EmptyState.module.scss';
import { Button } from '../Button/Button';

export function EmptyState({ icon: Icon, title, description, action, actionText, className, size = 'md' }) {
  return (
    <motion.div
      className={clsx(styles.emptyState, styles[`size-${size}`], className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {Icon && (
        <motion.div
          className={styles.iconWrapper}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <Icon size={Icon.displayName === 'Lucide' ? 48 : 64} className={styles.icon} />
        </motion.div>
      )}

      {title && <h3 className={styles.title}>{title}</h3>}
      {description && <p className={styles.description}>{description}</p>}

      {action && actionText && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Button variant="primary" onClick={action}>
            {actionText}
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}
