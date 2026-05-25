import { motion } from 'framer-motion';
import clsx from 'clsx';
import styles from './Button.module.scss';
import { Loader2 } from 'lucide-react';
import { buttonPress } from '../../../utils/motion';

export function Button({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'md', 
  icon: IconComponent, 
  disabled,
  loading = false,
  className,
  type = 'button'
}) {
  return (
    <motion.button
      type={type}
      variants={buttonPress}
      initial="rest"
      whileHover={!disabled && !loading ? "hover" : "rest"}
      whileTap={!disabled && !loading ? "tap" : "rest"}
      onClick={onClick}
      disabled={disabled || loading}
      className={clsx(
        styles.button,
        styles[`variant-${variant}`],
        styles[`size-${size}`],
        className
      )}
    >
      {loading ? (
        <Loader2 className={styles.spinner} size={16} />
      ) : IconComponent ? (
        <IconComponent size={16} />
      ) : null}
      
      {children && <span>{children}</span>}
    </motion.button>
  );
}
