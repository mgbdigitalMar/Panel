import clsx from 'clsx';
import styles from './Badge.module.scss';

export function Badge({ status, label, className }) {
  const statusMap = {
    confirmed: { variant: 'success', text: 'Confirmado' },
    pending:   { variant: 'warning', text: 'Pendiente'  },
    approved:  { variant: 'success', text: 'Aprobado'   },
    rejected:  { variant: 'danger',  text: 'Rechazado'  },
    admin:     { variant: 'accent',  text: 'Admin'      },
    employee:  { variant: 'neutral', text: 'Empleado'   },
    news:      { variant: 'accent',  text: 'Noticia'    },
    event:     { variant: 'warning', text: 'Evento'     },
  };

  const s = statusMap[status] || { variant: 'neutral', text: label || status };

  return (
    <span className={clsx(styles.badge, styles[`variant-${s.variant}`], className)}>
      {label || s.text}
    </span>
  );
}
