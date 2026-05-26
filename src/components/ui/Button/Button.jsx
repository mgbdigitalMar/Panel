import { motion } from 'framer-motion';
import clsx from 'clsx';
import styles from './Button.module.scss';
import { Loader2 } from 'lucide-react';

export function Button({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'md', 
  icon: IconComponent, 
  disabled,
  loading = false,
  className,
  type = 'button',
  iconOnly = false,
  title,
  ...props
}) {
  const Component = props.href ? motion.a : motion.button;

  return (
    <Component
      type={props.href ? undefined : type}
      title={title}
      whileHover={!disabled && !loading ? { scale: 1.02 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
      onClick={onClick}
      disabled={disabled || loading}
      {...props}
      className={clsx(
        styles.button,
        styles[`variant-${variant}`],
        styles[`size-${size}`],
        iconOnly && styles.iconOnly,
        className
      )}
    >
      {loading ? (
        <Loader2 className={styles.spinner} size={16} />
      ) : IconComponent ? (
        <IconComponent size={16} />
      ) : null}
      
      {children && !iconOnly && <span>{children}</span>}
    </Component>
  );
}
