import clsx from 'clsx';
import styles from './Card.module.scss';
import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { hoverLift } from '../../../utils/motion';

export const Card = forwardRef(({ className, children, ...props }, ref) => (
  <motion.div 
    ref={ref} 
    className={clsx(styles.card, 'glass-panel', className)}
    variants={hoverLift}
    initial="rest"
    whileHover="hover"
    whileTap="tap"
    {...props}
  >
    {children}
  </motion.div>
));
Card.displayName = 'Card';

export const CardHeader = ({ className, children, ...props }) => (
  <div className={clsx(styles.header, className)} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ className, children, ...props }) => (
  <h3 className={clsx(styles.title, className)} {...props}>
    {children}
  </h3>
);

export const CardContent = ({ className, children, ...props }) => (
  <div className={clsx(styles.content, className)} {...props}>
    {children}
  </div>
);
