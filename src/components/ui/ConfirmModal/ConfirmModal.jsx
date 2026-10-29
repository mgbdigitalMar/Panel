import { useEffect, useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Modal } from '../Modal/Modal';
import { Button } from '../Button/Button';
import styles from './ConfirmModal.module.scss';

/**
 * Asks before an action that can't be undone. While `onConfirm` runs (it may be async) the dialog
 * stays open with the button busy: no second press, and the person sees it working.
 */
export function ConfirmModal({ isOpen, onClose, onConfirm, title = 'Confirmar eliminación', message = '¿Estás seguro de que deseas eliminar este elemento? Esta acción no se puede deshacer.', confirmText = 'Eliminar', isDanger = true, icon: Icon }) {
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!isOpen) setBusy(false); }, [isOpen]);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm?.();
    } finally {
      setBusy(false);
      onClose?.();
    }
  };

  const Mark = Icon || (isDanger ? Trash2 : AlertTriangle);
  return (
    // Liquid glass sheet (the same material as the dock and the app's confirmations), no header bar
    <Modal open={isOpen} onClose={busy ? undefined : onClose} title="" ariaLabel={title} className={styles.liquid} bare>
      <div className={styles.confirmContainer} data-tone={isDanger ? 'danger' : 'warning'}>
        <div className={styles.iconWrapper} aria-hidden="true">
          <Mark size={26} />
        </div>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.message}>{message}</p>

        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button variant={isDanger ? "danger" : "primary"} onClick={confirm} loading={busy}>
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
