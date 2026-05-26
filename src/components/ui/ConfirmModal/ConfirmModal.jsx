import { AlertTriangle, Trash2 } from 'lucide-react';
import { Modal } from '../Modal/Modal';
import { Button } from '../Button/Button';
import styles from './ConfirmModal.module.scss';

export function ConfirmModal({ isOpen, onClose, onConfirm, title = 'Confirmar eliminación', message = '¿Estás seguro de que deseas eliminar este elemento? Esta acción no se puede deshacer.', confirmText = 'Eliminar', isDanger = true }) {
  return (
    <Modal open={isOpen} onClose={onClose} title="">
      <div className={styles.confirmContainer}>
        <div className={styles.iconWrapper} style={{ color: isDanger ? 'var(--danger)' : 'var(--warning)', background: isDanger ? 'var(--danger-bg)' : 'var(--warning-bg)' }}>
          {isDanger ? <Trash2 size={24} /> : <AlertTriangle size={24} />}
        </div>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.message}>{message}</p>
        
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant={isDanger ? "danger" : "primary"} onClick={() => { onConfirm(); onClose(); }}>
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
