import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import styles from './ErrorState.module.scss';
import { Button } from '../Button/Button';

export function ErrorState({
  title = 'Algo salió mal',
  description = 'Ocurrió un error inesperado. Por favor, intenta de nuevo.',
  action,
  actionText = 'Reintentar',
  icon: Icon,
  className,
  size = 'md'
}) {
  const IconComponent = Icon || AlertCircle;

  return (
    <motion.div
      className={clsx(styles.errorState, styles[`size-${size}`], className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className={styles.iconWrapper}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <IconComponent size={56} className={styles.icon} />
      </motion.div>

      {title && <h3 className={styles.title}>{title}</h3>}
      {description && <p className={styles.description}>{description}</p>}

      {action && (
        <motion.div
          className={styles.actions}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Button variant="primary" onClick={action}>
            {actionText}
          </Button>
          <Button variant="ghost" onClick={() => window.history.back()}>
            Volver
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}
