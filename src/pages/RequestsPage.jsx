import { useState, useMemo, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth, useRequests, usePersonalDays, useDocuments, useNotifs } from '../context';
import { Modal, Input, Textarea, Button, ConfirmModal } from '../components/ui';
import { Check, X, FileText, Home, Briefcase, ShoppingCart, Calendar } from 'lucide-react';
import styles from './RequestsPage.module.scss';
import clsx from 'clsx';
import { fmtDate, fmtRange, fmtMoney, plural, todayKey } from '../utils/format';
import { useTouch } from '../components/Touch';
import RequestsTouch from './RequestsTouch';
import RequestsDesk from './RequestsDesk';

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
    if (!created || created.error) {
      // Keep the form so nothing typed is lost; say why it was refused
      setFormError(created?.error || 'No se pudo enviar la solicitud. Inténtalo de nuevo.');
      return;
    }
    setShowModal(false);
    setForm({ startDate: '', endDate: '', date: '', reason: '', item: '', amount: '', acceptedTerms: false });
    setFile(null);
    setFormError('');
    announce('✅', 'Solicitud enviada. Te avisaremos cuando se revise.');
  };

  // One review at a time per row: a double click used to send two updates and two notifications
  const [busyKey, setBusyKey] = useState(null);
  const inFlight = useRef(new Set());
  // Rejecting can't be undone from here and notifies the person: it asks first, as in the app
  const [toReject, setToReject] = useState(null);

  const changeStatus = async (r, status) => {
    const key = rowKey(r);
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    setBusyKey(key);
    const res = r.type === 'asuntos_propios'
      ? await updatePersonalDayStatus(r.id, status, user.id, r.employeeId)
      : await updateRequestStatus(r.id, status, user.id, r.employeeId);
    inFlight.current.delete(key);
    setBusyKey(null);
    // Failures are already announced by the data layer
    if (!res?.error) {
      const who = r.employeeId === user?.id ? '' : ` Se ha avisado a ${(r.employeeName || 'la persona').split(' ')[0]}.`;
      announce(status === 'approved' ? '✅' : '❌', `${status === 'approved' ? 'Solicitud aprobada' : 'Solicitud rechazada'}.${who}`);
    }
  };

  const typeLabelOf = (r) => (r.type === 'asuntos_propios' ? 'Asuntos propios' : r.type === 'remoto' ? 'Trabajo en remoto' : r.type === 'external' ? 'Trabajo externo' : 'Compra');
  const reviewLine = (r) => (r.status !== 'pending' && r.reviewerName
    ? `${r.status === 'approved' ? 'Aprobada' : 'Rechazada'} por ${r.reviewerName}${r.reviewedAt ? ` el ${fmtDate(r.reviewedAt)}` : ''}`
    : null);

  const touch = useTouch();

  return (
    <div className={styles.container}>
      {/* Phones and tablets: the web's touch composition */}
      {touch ? (
        <RequestsTouch
          allItems={allItems}
          user={user}
          requestDetail={requestDetail}
          rowKey={rowKey}
          onExport={exportRequestsCSV}
          onNew={(type) => { if (type) setReqType(type); setShowModal(true); }}
          onApprove={(r) => changeStatus(r, 'approved')}
          onReject={(r) => setToReject(r)}
          onDelete={(r) => setItemToDelete({ id: r.id, type: r.type })}
          busyKey={busyKey}
          reviewLine={reviewLine}
        />
      ) : (
        <RequestsDesk
          allItems={allItems}
          user={user}
          requestDetail={requestDetail}
          rowKey={rowKey}
          onExport={exportRequestsCSV}
          onNew={(type) => { if (type) setReqType(type); setShowModal(true); }}
          onApprove={(r) => changeStatus(r, 'approved')}
          onReject={(r) => setToReject(r)}
          onDelete={(r) => setItemToDelete({ id: r.id, type: r.type })}
          busyKey={busyKey}
          reviewLine={reviewLine}
        />
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
              type="button"
              onClick={() => setReqType(rt.id)}
              className={clsx(styles.typeBtn, { [styles.typeBtnActive]: reqType === rt.id })}
              aria-pressed={reqType === rt.id}
            >
              <rt.icon size={17} className={styles.typeBtnIcon} aria-hidden="true" />
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
                  aria-label="Adjuntar documentación justificativa (opcional)"
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

      <ConfirmModal
        isOpen={!!toReject}
        onClose={() => setToReject(null)}
        onConfirm={() => changeStatus(toReject, 'rejected')}
        icon={X}
        title="Rechazar solicitud"
        message={toReject ? `${typeLabelOf(toReject)} de ${toReject.employeeName || 'empleado'} · ${requestDetail(toReject)}. Se le avisará de que ha sido rechazada.` : ''}
        confirmText="Rechazar"
      />
    </div>
  );
}
