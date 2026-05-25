import clsx from 'clsx';
import styles from './Skeleton.module.scss';
import { motion } from 'framer-motion';

export function Skeleton({ className, ...props }) {
  return (
    <motion.div
      className={clsx(styles.skeleton, className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      {...props}
    />
  );
}
