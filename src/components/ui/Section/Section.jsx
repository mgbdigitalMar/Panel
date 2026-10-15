import { useId } from 'react';
import clsx from 'clsx';
import styles from './Section.module.scss';

/**
 * A titled block of a page: the heading sits on the panel, the content
 * (usually cards) below it. `action` renders on the right of the heading.
 */
export function Section({ title, description, action, children, className, id }) {
  const autoId = useId();
  const headingId = id || autoId;
  return (
    <section className={clsx(styles.section, className)} aria-labelledby={title ? headingId : undefined}>
      {(title || action) && (
        <div className={styles.head}>
          <div className={styles.text}>
            {title && <h2 id={headingId} className={styles.title}>{title}</h2>}
            {description && <p className={styles.desc}>{description}</p>}
          </div>
          {action && <div className={styles.action}>{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
