import { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth, useData } from '../context';
import { Avatar, Badge, Modal, Input, Textarea, Button, Card, StatCard, ConfirmModal } from '../components/ui';
import { Plus, Check, X, FileText, ExternalLink, Download, Trash2, Home, Briefcase, ShoppingCart, Calendar } from 'lucide-react';
import styles from './RequestsPage.module.scss';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

export default function RequestsPage() {
  const { user, employees } = useAuth();
  const { requests, createRequest, updateRequestStatus, deleteRequest, personalDays, createPersonalDay, updatePersonalDayStatus, uploadDocumentFile } = useData();
  
  const [tab, setTab]             = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [reqType, setReqType]     = useState('asuntos_propios');
  const [loading, setLoading]     = useState(false);
  const [form, setForm]           = useState({ startDate: '', endDate: '', date: '', reason: '', item: '', amount: '', acceptedTerms: false });
  const [file, setFile]           = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  
  const [conditionsRead, setConditionsRead] = useState(false);
  const conditionsRef = useRef(null);

  useEffect(() => {
    if (showModal && (reqType === 'external' || reqType === 'remoto')) {
      setConditionsRead(false);
      setForm(f => ({ ...f, acceptedTerms: false }));
      
      setTimeout(() => {
        if (conditionsRef.current) {
          const { scrollHeight, clientHeight } = conditionsRef.current;
          if (scrollHeight <= clientHeight + 5) {
            setConditionsRead(true);
          }
        }
      }, 100);
    }
  }, [reqType, showModal]);

  const handleScrollConditions = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop <= clientHeight + 5) {
      setConditionsRead(true);
    }
  };

  const allItems = useMemo(() => [
    ...requests,
    ...(personalDays || []).map(p => ({
      ...p,
      type: 'asuntos_propios',
      employeeName: p.employeeName || employees?.find(e => e.id === p.employeeId)?.name,
      startDate: p.date,
      endDate: p.date,
      days: 1
    }))
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [requests, personalDays, employees]);

  const filtered = useMemo(() => {
    if (tab === 'all') return allItems;
    if (tab === 'mine') return allItems.filter(r => r.employeeId === user?.id);
    return allItems.filter(r => r.type === tab);
  }, [allItems, tab, user?.id]);

  const exportRequestsCSV = (rows) => {
    const headers = ['Empleado', 'Tipo', 'Detalle', 'Estado', 'Fecha solicitud'];
    const lines = [
      headers.join(';'),
      ...rows.map(r => {
        const typeLabel = r.type === 'asuntos_propios' ? 'Asuntos Propios' : r.type === 'remoto' ? 'Remoto' : r.type === 'external' ? 'Trabajo Externo' : 'Compra';
        const detail = r.type === 'asuntos_propios'
          ? `${r.date} (1 día)`
          : r.type === 'external' || r.type === 'remoto'
          ? `${r.startDate} a ${r.endDate} (${r.days || '?'} días)`
          : `${r.item} - ${r.amount}€`;
        const status = r.status === 'approved' ? 'Aprobada' : r.status === 'rejected' ? 'Rechazada' : 'Pendiente';
        return [
          r.employeeName || '—',
          typeLabel,
          `"${detail.replace(/"/g, '""')}"`,
          status,
          r.createdAt
        ].join(';');
      }),
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `solicitudes-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleCreate = async () => {
    setLoading(true);
    if (reqType === 'asuntos_propios') {
      let fileUrl = null;
      if (file) {
        const uploadRes = await uploadDocumentFile(file);
        if (uploadRes && !uploadRes.error) {
          fileUrl = uploadRes.url;
        } else if (uploadRes?.error) {
          alert(`Error al subir el archivo: ${uploadRes.error}`);
          setLoading(false);
          return;
        }
      }
      await createPersonalDay({ employeeId: user.id, date: form.date, reason: form.reason, fileUrl });
    } else {
      let payload;
      if (reqType === 'external') {
        payload = { type: 'external', start_date: form.startDate, end_date: form.endDate, reason: form.reason };
      } else if (reqType === 'remoto') {
        payload = { type: 'remoto', start_date: form.startDate, end_date: form.endDate, reason: form.reason };
      } else {
        payload = { type: 'purchase', item: form.item, amount: parseFloat(form.amount) || 0, reason: form.reason };
      }
      await createRequest(user.id, payload);
    }
    setLoading(false);
    setShowModal(false);
    setForm({ startDate: '', endDate: '', date: '', reason: '', item: '', amount: '', acceptedTerms: false });
    setFile(null);
  };

  const changeStatus = async (id, status, employeeId, type) => {
    if (type === 'asuntos_propios') {
      await updatePersonalDayStatus(id, status, user.id, employeeId);
    } else {
      await updateRequestStatus(id, status, user.id, employeeId);
    }
  };

  const tabBtn = (id, label) => {
    const count = id === 'all' ? allItems.length
      : id === 'mine' ? allItems.filter(r => r.employeeId === user?.id).length
      : allItems.filter(r => r.type === id).length;
    const pending = id === 'all' ? allItems.filter(r => r.status === 'pending').length
      : id === 'mine' ? allItems.filter(r => r.employeeId === user?.id && r.status === 'pending').length
      : 0;
    return (
    <button 
      key={id} 
      onClick={() => setTab(id)}
      className={clsx(styles.tabBtn, { [styles.tabBtnActive]: tab === id })}
    >
      {label}
      {count > 0 && <span className={styles.tabCount}>{count}</span>}
      {pending > 0 && id !== tab && <span className={styles.tabPending}>{pending}</span>}
    </button>
    );
  };

  return (
    <div className={styles.container}>
      {/* Controls */}
      <div className={styles.pageControls}>
        <div className={styles.tabsRow}>
          {tabBtn('all', 'Todas')}
          {tabBtn('mine', 'Mis solicitudes')}
          {tabBtn('asuntos_propios', 'Asuntos Propios')}
          {tabBtn('purchase', 'Compras')}
          {tabBtn('remoto', 'Remoto')}
          {tabBtn('external', 'Trabajo Externo')}
        </div>
        <div className={styles.controlsRight}>
          {filtered.length > 0 && (
            <Button icon={Download} variant="ghost" onClick={() => exportRequestsCSV(filtered)}>
              Descargar Excel
            </Button>
          )}
          <Button icon={Plus} onClick={() => setShowModal(true)}>Nueva solicitud</Button>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <StatCard label="Pendientes" value={allItems.filter(r => r.status === 'pending').length}  color="var(--warning)" icon="Clock" sub="Esperando revisión" />
        <StatCard label="Aprobadas"  value={allItems.filter(r => r.status === 'approved').length} color="var(--success)" icon="CheckCircle" sub="Este periodo" />
        <StatCard label="Rechazadas" value={allItems.filter(r => r.status === 'rejected').length} color="var(--danger)"  icon="XCircle" sub="Sin acción" />
      </div>

      {/* Table */}
      <Card>
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className={clsx("icon-box icon-box--lg icon-box--accent empty-state__icon", styles.opaqueIcon)}>
              <FileText size={24} />
            </div>
            <h3 className="empty-state__title">No hay solicitudes</h3>
            <p className="empty-state__sub">No se han encontrado solicitudes en esta categoría.</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className="table">
              <thead>
                <tr>
                  {['Empleado', 'Tipo', 'Detalle', 'Fecha solicitud', 'Estado', user.role === 'admin' ? 'Acciones' : null].filter(Boolean).map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="sync">
                {filtered.map((r, i) => (
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.22, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
                    className={clsx({ [styles.rowPending]: r.status === 'pending' })}
                  >
                    <td data-label="Empleado">
                      <div className={styles.userCell}>
                        <Avatar initials={(r.employeeName || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()} size={32} />
                        <span className={styles.userName}>{r.employeeName || '—'}</span>
                      </div>
                    </td>
                    <td data-label="Tipo">
                      <Badge status={r.type} label={r.type === 'asuntos_propios' ? 'Asuntos Propios' : r.type === 'remoto' ? 'Remoto' : r.type === 'external' ? 'Trabajo Externo' : 'Compra'} />
                    </td>
                    <td data-label="Detalle" className={styles.detailCell}>
                      {r.type === 'asuntos_propios'
                        ? `${r.date} (1 día)`
                        : r.type === 'external' || r.type === 'remoto'
                        ? `${r.startDate} → ${r.endDate} (${r.days || '?'} días)`
                        : `${r.item} — ${r.amount}€`}
                      {r.fileUrl && (
                        <a href={r.fileUrl} download="justificante" className={styles.downloadLink} title="Descargar justificante">
                          <Download size={14} />
                        </a>
                      )}
                    </td>
                    <td data-label="Fecha solicitud" className={styles.dateCell}>{r.createdAt}</td>
                    <td data-label="Estado"><Badge status={r.status} /></td>
                    {user.role === 'admin' && (
                      <td data-label="Acciones">
                        <div className={styles.actionsCell}>
                          {r.status === 'pending' && (
                            <>
                              <Button variant="action-success" iconOnly icon={Check} onClick={() => changeStatus(r.id, 'approved', r.employeeId, r.type)} title="Aprobar" />
                              <Button variant="action-danger" iconOnly icon={X} onClick={() => changeStatus(r.id, 'rejected', r.employeeId, r.type)} title="Rechazar" />
                            </>
                          )}
                          <Button variant="action-danger" iconOnly icon={Trash2} onClick={() => setItemToDelete({ id: r.id, type: r.type })} title="Eliminar" />
                        </div>
                      </td>
                    )}
                  </motion.tr>
                ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* New request modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nueva solicitud">
        <div className={styles.typeButtons}>
          {[
            { id: 'asuntos_propios', label: 'Asuntos Propios', icon: Calendar, desc: 'Día personal' },
            { id: 'purchase',        label: 'Compra',          icon: ShoppingCart, desc: 'Artículo o servicio' },
            { id: 'remoto',          label: 'Remoto',          icon: Home,         desc: 'Trabajo desde casa' },
            { id: 'external',        label: 'Externo',         icon: Briefcase,    desc: 'Trabajo fuera de oficina' },
          ].map(rt => (
            <button 
              key={rt.id} 
              onClick={() => setReqType(rt.id)}
              className={clsx(styles.typeBtn, { [styles.typeBtnActive]: reqType === rt.id })}
            >
              <rt.icon size={16} className={styles.typeBtnIcon} />
              <span className={styles.typeBtnLabel}>{rt.label}</span>
              <span className={styles.typeBtnDesc}>{rt.desc}</span>
            </button>
          ))}
        </div>

        {reqType === 'external' || reqType === 'remoto' ? (
          <>
            <div className={styles.modalAlert}>
              <div className={styles.modalAlertHeader}>
                <div className={styles.modalAlertIcon}>
                  <FileText size={20} />
                </div>
                <div>
                  <h4 className={styles.modalAlertTitle}>
                    {reqType === 'external' ? 'Condiciones de Trabajo Externo' : 'Condiciones de Remoto'}
                  </h4>
                  <p className={styles.modalAlertSubtitle}>Lee y acepta las siguientes condiciones</p>
                </div>
              </div>

              <div
                ref={conditionsRef}
                onScroll={handleScrollConditions}
                className={styles.conditionsBox}
              >
                {reqType === 'remoto' && (
                  <>
                    <div><h5 className={styles.conditionTitle}>1. He sido informado/a de las condiciones aplicables:</h5><p>Comunicación previa a rrhh@margube.com, con traslado a Dirección para su aprobación.</p></div>
                    <div><h5 className={styles.conditionTitle}>2. Normas durante el trabajo remoto:</h5><ul className={styles.conditionList}><li>Avisar cambios.</li><li>Mantener horario presencial.</li><li>Control horario con ubicación activada.</li><li>Teams conectado todo el día.</li><li>Reflejar en calendario corporativo.</li><li>Registrar horas en Cinegia.</li></ul></div>
                    <div><h5 className={styles.conditionTitle}>3. Modificación de días</h5><p>Podrán ser modificados por la dirección.</p></div>
                    <div><h5 className={styles.conditionTitle}>4. Consecuencias del incumplimiento</h5><p>Pérdida del derecho a solicitar remoto.</p></div>
                  </>
                )}
                {reqType === 'external' && (
                  <>
                    <div><h5 className={styles.conditionTitle}>1. He sido informado/a de las condiciones aplicables:</h5><p>Comunicación previa. Máximo 4 solicitudes/año. Máximo 20 días anuales.</p></div>
                    <div><h5 className={styles.conditionTitle}>2. Normas durante el trabajo externo:</h5><ul className={styles.conditionList}><li>Avisar cambios.</li><li>Mantener horario.</li><li>Control horario con ubicación.</li><li>Teams conectado.</li><li>Reflejar en calendario.</li><li>Registrar horas en Cinegia.</li></ul></div>
                    <div><h5 className={styles.conditionTitle}>3. Consecuencias del incumplimiento</h5><p>Pérdida del derecho a solicitar trabajo externo.</p></div>
                  </>
                )}
              </div>

              <label className={clsx(styles.checkboxLabel, conditionsRead ? styles.checkboxLabelEnabled : styles.checkboxLabelDisabled)}>
                <div className={styles.checkboxContainer}>
                  <input 
                    type="checkbox" 
                    disabled={!conditionsRead} 
                    checked={form.acceptedTerms} 
                    onChange={e => setForm({ ...form, acceptedTerms: e.target.checked })} 
                    className={styles.checkboxInput} 
                  />
                  <div className={clsx(styles.checkboxVisual, { [styles.checkboxVisualChecked]: form.acceptedTerms })}>
                    <Check size={14} color="#fff" strokeWidth={3} className={styles.checkboxCheckIcon} style={{ opacity: form.acceptedTerms ? 1 : 0, transform: form.acceptedTerms ? 'scale(1)' : 'scale(0.5)' }} />
                  </div>
                </div>
                <span className={clsx(styles.checkboxText, { [styles.checkboxTextChecked]: form.acceptedTerms })}>
                  {conditionsRead ? 'En conformidad con lo anterior, firmo el presente documento como muestra de mi aceptación y compromiso.' : 'Debes leer las condiciones hasta el final para poder aceptar.'}
                </span>
              </label>
            </div>
            <div className={styles.modalGrid}>
              <Input label="Fecha inicio" value={form.startDate} onChange={v => setForm({ ...form, startDate: v })} type="date" required />
              <Input label="Fecha fin"    value={form.endDate}   onChange={v => setForm({ ...form, endDate: v })}   type="date" required />
            </div>
            <Textarea label="Motivo" value={form.reason} onChange={v => setForm({ ...form, reason: v })} placeholder="Explica el lugar y motivo del trabajo externo..." />
          </>
        ) : reqType === 'asuntos_propios' ? (
          <>
            <div className={styles.modalWarningAlert}>
              <h4 className={styles.modalWarningTitle}>Solicitud de Día de Asuntos Propios</h4>
              <p className={styles.modalWarningSubtitle}>
                Rellena la fecha y el motivo. Puedes adjuntar documentación justificativa si procede.
              </p>
            </div>
            <Input label="Día solicitado" value={form.date} onChange={v => setForm({ ...form, date: v })} type="date" required />
            <Textarea label="Motivo de la solicitud" value={form.reason} onChange={v => setForm({ ...form, reason: v })} placeholder="Describir brevemente el motivo..." required />
            
            <div className={styles.uploadGroup}>
              <label className={styles.uploadLabel}>
                Documentación justificativa aportada (Opcional)
              </label>
              <div className={styles.uploadDropzone}>
                <div className={styles.uploadIconContainer}>
                  <FileText size={20} />
                </div>
                <div className={styles.uploadTextContainer}>
                  <p className={styles.uploadFileName}>
                    {file ? file.name : 'Haz clic o arrastra un archivo aquí'}
                  </p>
                  <p className={styles.uploadFileSpecs}>
                    {file ? `${(file.size / 1024).toFixed(1)} KB` : 'PDF, JPG, PNG (máx. 5MB)'}
                  </p>
                </div>
                <input 
                  type="file" 
                  title=""
                  onChange={e => setFile(e.target.files[0])} 
                  className={styles.uploadInput}
                />
              </div>
            </div>

            <label className={clsx(styles.declarationLabel, { [styles.declarationLabelChecked]: form.acceptedTerms })}>
              <div className={styles.checkboxContainer}>
                <input 
                  type="checkbox" 
                  checked={form.acceptedTerms} 
                  onChange={e => setForm({ ...form, acceptedTerms: e.target.checked })} 
                  className={styles.checkboxInput}
                />
                <div className={clsx(styles.checkboxVisual, { [styles.checkboxVisualChecked]: form.acceptedTerms })}>
                  <Check size={14} color="#fff" strokeWidth={3} className={styles.checkboxCheckIcon} style={{ opacity: form.acceptedTerms ? 1 : 0, transform: form.acceptedTerms ? 'scale(1)' : 'scale(0.5)' }} />
                </div>
              </div>
              <span className={clsx(styles.checkboxText, { [styles.checkboxTextChecked]: form.acceptedTerms })}>
                Declaro que el motivo indicado corresponde a un asunto personal que no puede realizarse fuera de la jornada laboral.
              </span>
            </label>
          </>
        ) : (
          <>
            <Input label="Artículo / servicio" value={form.item} onChange={v => setForm({ ...form, item: v })} placeholder="Ej: Licencia software, material de oficina..." required />
            <Input label="Importe estimado (€)" value={form.amount} onChange={v => setForm({ ...form, amount: v })} type="number" required />
            <Textarea label="Justificación" value={form.reason} onChange={v => setForm({ ...form, reason: v })} placeholder="Explica para qué se necesita y su impacto..." />
          </>
        )}

        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={() => setShowModal(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={loading || ((reqType === 'external' || reqType === 'remoto' || reqType === 'asuntos_propios') && !form.acceptedTerms)}>{loading ? 'Enviando...' : 'Enviar solicitud'}</Button>
        </div>
      </Modal>

      <ConfirmModal 
        isOpen={!!itemToDelete} 
        onClose={() => setItemToDelete(null)} 
        onConfirm={async () => {
          if (itemToDelete) {
            await deleteRequest(itemToDelete.id, itemToDelete.type);
            setItemToDelete(null);
          }
        }} 
        title="Eliminar solicitud"
        message="¿Estás seguro de que deseas eliminar esta solicitud? Esta acción no se puede deshacer."
      />
    </div>
  );
}
