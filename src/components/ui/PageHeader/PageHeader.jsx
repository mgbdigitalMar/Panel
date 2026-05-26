import React from 'react';
import styles from './PageHeader.module.scss';

export function PageHeader({ title, subtitle, icon: Icon, children, bottomContent }) {
  return (
    <div className={styles.header}>
      <div className={styles.titleSection}>
        {Icon && (
          <div className={styles.iconWrapper}>
            <Icon size={24} />
          </div>
        )}
        <div className={styles.textWrapper}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          {bottomContent && <div className={styles.bottomContent}>{bottomContent}</div>}
        </div>
      </div>
      {children && (
        <div className={styles.actions}>
          {children}
        </div>
      )}
    </div>
  );
}
