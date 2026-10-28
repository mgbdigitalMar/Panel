import { useState, useMemo, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth, useRequests, usePersonalDays, useDocuments, useNotifs } from '../context';
import { Avatar, Badge, Modal, Input, Textarea, Button, Card, StatCard, ConfirmModal, Section } from '../components/ui';
import { Plus, Check, X, FileText, Download, Trash2, Home, Briefcase, ShoppingCart, Calendar } from 'lucide-react';
import styles from './RequestsPage.module.scss';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { fmtDate, fmtRange, fmtMoney, plural, todayKey } from '../utils/format';
import { usePhoneApp } from '../components/PhoneKit';
import RequestsPhone from './RequestsPhone';

/** Calendar days from start to end, both included (28 → 29 is 2 days) */
const daysInclusive = (start, end) =>
  Math.round((new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`)) / 86400000) + 1;

/** What was asked for: the day(s) for absences, the item and cost for purchases. */
function requestDetail(r) {
  if (r.type === 'asuntos_propios') return fmtDate(r.date || r.startDate);
  if (r.type === 'external' || r.type === 'remoto') {
    const range = fmtRange(r.startDate, r.endDate);
    return r.days ? `${range} · ${plural(r.days, 'día', 'días')}` : range;
  }
  return [r.item, r.amount != null && r.amount !== '' ? fmtMoney(r.amount) : null].filter(Boolean).join(' · ') || '—';
}

// Requests and personal days live in separate tables, so ids can repeat across them
const rowKey = (r) => `${r.type === 'asuntos_propios' ? 'pd' : 'rq'}-${r.id}`;

export default function RequestsPage() {
  const { user, employees } = useAuth();
  const { requests, createRequest, updateRequestStatus, deleteRequest } = useRequests();
  const { personalDays, createPersonalDay, updatePersonalDayStatus } = usePersonalDays();
  const { uploadDocumentFile } = useDocuments();
  const { announce } = useNotifs();
  
  const [tab, setTab]             = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [reqType, setReqType]     = useState('asuntos_propios');
  const [loading, setLoading]     = useState(false);
  const [form, setForm]           = useState({ startDate: '', endDate: '', date: '', reason: '', item: '', amount: '', acceptedTerms: false });
  const [file, setFile]           = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [formError, setFormError] = useState('');

  // ?nueva=1 (search, shortcuts) opens the request form straight away
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('nueva') === '1') {
      setShowModal(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const [conditionsRead, setConditionsRead] = useState(false);
  const conditionsRef = useRef(null);

  useEffect(() => {
    // The declaration / conditions accepted for one type don't carry over to another
    setForm(f => (f.acceptedTerms ? { ...f, acceptedTerms: false } : f));
    setFormError('');
    if (showModal && (reqType === 'external' || reqType === 'remoto')) {
      setConditionsRead(false);
      
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
        const detail = requestDetail(r);
        const status = r.status === 'approved' ? 'Aprobada' : r.status === 'rejected' ? 'Rechazada' : 'Pendiente';
        return [
          r.employeeName || '—',
          typeLabel,
          `"${detail.replace(/"/g, '""')}"`,
          status,
          r.createdAt ? new Date(r.createdAt).toLocaleDateString('es-ES') : ''
        ].join(';');
      }),
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `solicitudes-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // Required fields per type; null when the form can be sent
  const formProblem = () => {
    if (reqType === 'asuntos_propios') {
      if (!form.date) return 'Indica el día que solicitas.';
      if (form.date < todayKey()) return 'No puedes pedir asuntos propios para un día que ya ha pasado.';
      if (!form.reason.trim()) return 'Indica el motivo de la solicitud.';
    } else if (reqType === 'remoto' || reqType === 'external') {
      if (!form.startDate || !form.endDate) return 'Indica la fecha de inicio y la de fin.';
      if (form.endDate < form.startDate) return 'La fecha de fin no puede ser anterior a la de inicio.';
    } else {
      if (!form.item.trim()) return 'Indica el artículo o servicio.';
      if (!(parseFloat(form.amount) > 0)) return 'Indica un importe mayor que 0.';
    }
    return null;
  };

  const handleCreate = async () => {
    const problem = formProblem();
    if (problem) { setFormError(problem); return; }
    setFormError('');
    setLoading(true);
    let created;
    if (reqType === 'asuntos_propios') {
      let fileUrl = null;
      if (file) {
        if (file.size > 15 * 1024 * 1024) {
          setFormError('El archivo supera el tamaño máximo permitido (15 MB).');
          setLoading(false);
          return;
        }
        const uploadRes = await uploadDocumentFile(file);
        if (uploadRes && !uploadRes.error) {
          fileUrl = uploadRes.url;
        } else if (uploadRes?.error) {
          setFormError(`Error al subir el archivo: ${uploadRes.error}`);
          setLoading(false);
          return;
        }
      }
      created = await createPersonalDay({ employeeId: user.id, date: form.date, reason: form.reason, fileUrl });
    } else {
      let payload;
      if (reqType === 'external') {
        payload = { type: 'external', start_date: form.startDate, end_date: form.endDate, reason: form.reason };
      } else if (reqType === 'remoto') {
        payload = { type: 'remoto', start_date: form.startDate, end_date: form.endDate, reason: form.reason };
      } else {
        payload = { type: 'purchase', item: form.item, amount: parseFloat(form.amount) || 0, reason: form.reason };
      }
      created = await createRequest(user.id, payload);
    }
    setLoading(false);
    if (!created) {
      // Keep the form so nothing typed is lost
      setFormError('No se pudo enviar la solicitud. Revisa tu conexión e inténtalo de nuevo.');
      return;
    }
    setShowModal(false);
    setForm({ startDate: '', endDate: '', date: '', reason: '', item: '', amount: '', acceptedTerms: false });
    setFile(null);
    setFormError('');
    announce('✅', 'Solicitud enviada. Te avisaremos cuando se revise.');
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

  const phone = usePhoneApp();

  return (
    <div className={styles.container}>
      {/* Phones: the app's Solicitudes screen; new requests come from the dock's "+" */}
      {phone ? (
        <RequestsPhone
          allItems={allItems}
          user={user}
          requestDetail={requestDetail}
          rowKey={rowKey}
          onExport={exportRequestsCSV}
          onNewPersonalDay={() => { setReqType('asuntos_propios'); setShowModal(true); }}
          onApprove={(r) => changeStatus(r.id, 'approved', r.employeeId, r.type)}
          onReject={(r) => changeStatus(r.id, 'rejected', r.employeeId, r.type)}
          onDelete={(r) => setItemToDelete({ id: r.id, type: r.type })}
        />
      ) : (
      <>
      <div className={styles.pageControls}>
        <div className={styles.tabsRow}>
          {tabBtn('all', 'Todas')}
          {/* Employees only receive their own requests: "Todas" already is theirs */}
          {user?.role === 'admin' && tabBtn('mine', 'Mis solicitudes')}
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

      <div className={styles.statsGrid}>
        <StatCard label="Pendientes" value={allItems.filter(r => r.status === 'pending').length}  color="var(--warning)" icon="Clock" sub="Esperando revisión" />
        <StatCard label="Aprobadas"  value={allItems.filter(r => r.status === 'approved').length} color="var(--success)" icon="CheckCircle" sub="En total" />
        <StatCard label="Rechazadas" value={allItems.filter(r => r.status === 'rejected').length} color="var(--danger)"  icon="XCircle" sub="En total" />
      </div>

      <Section title="Historial de solicitudes" description={`${filtered.length} ${filtered.length === 1 ? 'solicitud' : 'solicitudes'}`}>
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
                    key={rowKey(r)}
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
                      {requestDetail(r)}
                      {r.fileUrl && (
                        <a href={r.fileUrl} download="justificante" className={styles.downloadLink} title="Descargar justificante">
                          <Download size={14} />
                        </a>
                      )}
                    </td>
                    <td data-label="Fecha solicitud" className={styles.dateCell}>
                      <time dateTime={r.createdAt}>{fmtDate(r.createdAt)}</time>
                    </td>
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
      </Section>
      </>
      )}

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
              <Input label="Fecha fin"    value={form.endDate}   onChange={v => setForm({ ...form, endDate: v })}   type="date" min={form.startDate || undefined} required />
            </div>
            {form.startDate && form.endDate && form.endDate >= form.startDate && (
              <p className={styles.modalWarningSubtitle}>{plural(daysInclusive(form.startDate, form.endDate), 'día', 'días')}</p>
            )}
            <Textarea label="Motivo" value={form.reason} onChange={v => setForm({ ...form, reason: v })}
              placeholder={reqType === 'remoto' ? 'Explica el motivo del trabajo en remoto...' : 'Explica el lugar y motivo del trabajo externo...'} />
          </>
        ) : reqType === 'asuntos_propios' ? (
          <>
            <div className={styles.modalWarningAlert}>
              <h4 className={styles.modalWarningTitle}>Solicitud de Día de Asuntos Propios</h4>
              <p className={styles.modalWarningSubtitle}>
                Rellena la fecha y el motivo. Puedes adjuntar documentación justificativa si procede.
              </p>
            </div>
            <Input label="Día solicitado" value={form.date} onChange={v => setForm({ ...form, date: v })} type="date" min={todayKey()} required />
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
                    {file ? `${(file.size / 1024).toFixed(1)} KB` : 'PDF, JPG, PNG (máx. 15MB)'}
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
            <Input label="Importe estimado (€)" value={form.amount} onChange={v => setForm({ ...form, amount: v })} type="number" min="0.01" step="0.01" required />
            <Textarea label="Justificación" value={form.reason} onChange={v => setForm({ ...form, reason: v })} placeholder="Explica para qué se necesita y su impacto..." />
          </>
        )}

        {formError && <div className={clsx(styles.errorAlert, 'appear')} role="alert">{formError}</div>}

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
