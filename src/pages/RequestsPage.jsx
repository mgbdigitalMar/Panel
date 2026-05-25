import { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth, useData } from '../context';
import { Avatar, Badge, Modal, Input, Textarea, Button, Card, StatCard } from '../components/ui';
import { Plus, Check, X, FileText, ExternalLink, Download } from 'lucide-react';
import styles from './RequestsPage.module.scss';
import clsx from 'clsx';

export default function RequestsPage() {
  const { user, employees } = useAuth();
  const { requests, createRequest, updateRequestStatus, personalDays, createPersonalDay, updatePersonalDayStatus, uploadDocumentFile } = useData();
  
  const [tab, setTab]             = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [reqType, setReqType]     = useState('asuntos_propios');
  const [loading, setLoading]     = useState(false);
  const [form, setForm]           = useState({ startDate: '', endDate: '', date: '', reason: '', item: '', amount: '', acceptedTerms: false });
  const [file, setFile]           = useState(null);
  
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
      if (file) fileUrl = await uploadDocumentFile(file);
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

  const tabBtn = (id, label) => (
    <button 
      key={id} 
      onClick={() => setTab(id)}
      className={clsx(styles.tabBtn, { [styles.tabBtnActive]: tab === id })}
    >
      {label}
    </button>
  );

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
        <div style={{ display: 'flex', gap: 12 }}>
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
            <div className="icon-box icon-box--lg icon-box--accent empty-state__icon" style={{ opacity: 1 }}>
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
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td data-label="Empleado">
                      <div className={styles.userCell}>
                        <Avatar initials={(r.employeeName || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()} size={32} />
                        <span className={styles.userName}>{r.employeeName || '—'}</span>
                      </div>
                    </td>
                    <td data-label="Tipo">
                      <Badge status={r.type} label={r.type === 'asuntos_propios' ? 'Asuntos Propios' : r.type === 'remoto' ? 'Remoto' : r.type === 'external' ? 'Trabajo Externo' : 'Compra'} />
                    </td>
                    <td data-label="Detalle" style={{ color: 'var(--text-sec)' }}>
                      {r.type === 'asuntos_propios'
                        ? `${r.date} (1 día)`
                        : r.type === 'external' || r.type === 'remoto'
                        ? `${r.startDate} → ${r.endDate} (${r.days || '?'} días)`
                        : `${r.item} — ${r.amount}€`}
                      {r.fileUrl && (
                        <a href={r.fileUrl} download="justificante" style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 8, color: 'var(--accent)', verticalAlign: 'middle' }} title="Descargar justificante">
                          <Download size={14} />
                        </a>
                      )}
                    </td>
                    <td data-label="Fecha solicitud" style={{ color: 'var(--text-mut)' }}>{r.createdAt}</td>
                    <td data-label="Estado"><Badge status={r.status} /></td>
                    {user.role === 'admin' && (
                      <td data-label="Acciones">
                        {r.status === 'pending' && (
                          <div className={styles.actionsCell}>
                            <button className={clsx(styles.actionBtn, styles.approveBtn)} onClick={() => changeStatus(r.id, 'approved', r.employeeId, r.type)} title="Aprobar">
                              <Check size={16} />
                            </button>
                            <button className={clsx(styles.actionBtn, styles.rejectBtn)} onClick={() => changeStatus(r.id, 'rejected', r.employeeId, r.type)} title="Rechazar">
                              <X size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* New request modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nueva solicitud">
        <div className={styles.typeButtons}>
          {[{ id: 'asuntos_propios', label: '📝 Asuntos Propios' }, { id: 'purchase', label: '🛒 Compra' }, { id: 'remoto', label: '🏠 Remoto' }, { id: 'external', label: '📍 Trabajo Externo' }].map(rt => (
            <button 
              key={rt.id} 
              onClick={() => setReqType(rt.id)}
              className={clsx(styles.typeBtn, { [styles.typeBtnActive]: reqType === rt.id })}
            >
              {rt.label}
            </button>
          ))}
        </div>

        {reqType === 'external' || reqType === 'remoto' ? (
          <>
            <div style={{ 
              background: 'var(--accent-bg)', 
              padding: '16px', 
              borderRadius: 'var(--radius-md)', 
              marginBottom: '20px',
              border: '1px solid var(--accent-border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ 
                  width: '36px', height: '36px', borderRadius: '8px', 
                  background: 'var(--accent)', color: 'white', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center' 
                }}>
                  <FileText size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
                    {reqType === 'external' ? 'Condiciones de Trabajo Externo' : 'Condiciones de Remoto'}
                  </h4>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-sec)' }}>Lee y acepta las siguientes condiciones</p>
                </div>
              </div>

              <div
                ref={conditionsRef}
                onScroll={handleScrollConditions}
                style={{
                background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px',
                maxHeight: '200px', overflowY: 'auto', fontSize: '13px', color: 'var(--text-sec)', marginBottom: '16px',
                display: 'flex', flexDirection: 'column', gap: '12px'
              }}>
                {reqType === 'remoto' && (
                  <>
                    <div><h5 style={{ margin: '0 0 4px 0', color: 'var(--text)' }}>1. He sido informado/a de las condiciones aplicables:</h5><p style={{ margin: 0 }}>Comunicación previa a rrhh@margube.com, con traslado a Dirección para su aprobación.</p></div>
                    <div><h5 style={{ margin: '0 0 4px 0', color: 'var(--text)' }}>2. Normas durante el trabajo remoto:</h5><ul style={{ margin: 0, paddingLeft: '20px' }}><li>Avisar cambios.</li><li>Mantener horario presencial.</li><li>Control horario con ubicación activada.</li><li>Teams conectado todo el día.</li><li>Reflejar en calendario corporativo.</li><li>Registrar horas en Cinegia.</li></ul></div>
                    <div><h5 style={{ margin: '0 0 4px 0', color: 'var(--text)' }}>3. Modificación de días</h5><p style={{ margin: 0 }}>Podrán ser modificados por la dirección.</p></div>
                    <div><h5 style={{ margin: '0 0 4px 0', color: 'var(--text)' }}>4. Consecuencias del incumplimiento</h5><p style={{ margin: 0 }}>Pérdida del derecho a solicitar remoto.</p></div>
                  </>
                )}
                {reqType === 'external' && (
                  <>
                    <div><h5 style={{ margin: '0 0 4px 0', color: 'var(--text)' }}>1. He sido informado/a de las condiciones aplicables:</h5><p style={{ margin: 0 }}>Comunicación previa. Máximo 4 solicitudes/año. Máximo 20 días anuales.</p></div>
                    <div><h5 style={{ margin: '0 0 4px 0', color: 'var(--text)' }}>2. Normas durante el trabajo externo:</h5><ul style={{ margin: 0, paddingLeft: '20px' }}><li>Avisar cambios.</li><li>Mantener horario.</li><li>Control horario con ubicación.</li><li>Teams conectado.</li><li>Reflejar en calendario.</li><li>Registrar horas en Cinegia.</li></ul></div>
                    <div><h5 style={{ margin: '0 0 4px 0', color: 'var(--text)' }}>3. Consecuencias del incumplimiento</h5><p style={{ margin: 0 }}>Pérdida del derecho a solicitar trabajo externo.</p></div>
                  </>
                )}
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: conditionsRead ? 'pointer' : 'not-allowed', userSelect: 'none', opacity: conditionsRead ? 1 : 0.6 }}>
                <div style={{ position: 'relative', width: 22, height: 22, flexShrink: 0 }}>
                  <input 
                    type="checkbox" 
                    disabled={!conditionsRead} 
                    checked={form.acceptedTerms} 
                    onChange={e => setForm({ ...form, acceptedTerms: e.target.checked })} 
                    style={{ position: 'absolute', opacity: 0, cursor: conditionsRead ? 'pointer' : 'not-allowed', width: '100%', height: '100%', margin: 0, zIndex: 2 }} 
                  />
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: form.acceptedTerms ? 'var(--accent)' : 'var(--bg)',
                    border: form.acceptedTerms ? '2px solid var(--accent)' : '2px solid var(--border)',
                    borderRadius: '6px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s',
                    boxShadow: form.acceptedTerms ? '0 2px 8px rgba(34,81,255,0.3)' : 'none',
                    zIndex: 1
                  }}>
                    <Check size={14} color="#fff" strokeWidth={3} style={{ opacity: form.acceptedTerms ? 1 : 0, transform: form.acceptedTerms ? 'scale(1)' : 'scale(0.5)', transition: 'all 0.2s' }} />
                  </div>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 500, color: form.acceptedTerms ? 'var(--text)' : 'var(--text-sec)', transition: 'color 0.2s' }}>
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
            <div style={{ 
              background: 'var(--warning-bg)', 
              padding: '16px', 
              borderRadius: 'var(--radius-md)', 
              marginBottom: '20px',
              border: '1px solid var(--warning)'
            }}>
              <h4 style={{ margin: '0 0 8px 0', color: 'var(--warning)', fontSize: 14 }}>Solicitud de Día de Asuntos Propios</h4>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-sec)', lineHeight: 1.5 }}>
                Rellena la fecha y el motivo. Puedes adjuntar documentación justificativa si procede.
              </p>
            </div>
            <Input label="Día solicitado" value={form.date} onChange={v => setForm({ ...form, date: v })} type="date" required />
            <Textarea label="Motivo de la solicitud" value={form.reason} onChange={v => setForm({ ...form, reason: v })} placeholder="Describir brevemente el motivo..." required />
            
            <div style={{ marginTop: '16px', marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-mut)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Documentación justificativa aportada (Opcional)
              </label>
              <div style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                background: 'var(--bg)',
                border: '1px dashed var(--border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  background: 'var(--accent-bg)',
                  color: 'var(--accent)',
                  borderRadius: '8px'
                }}>
                  <FileText size={20} />
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {file ? file.name : 'Haz clic o arrastra un archivo aquí'}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-mut)' }}>
                    {file ? `${(file.size / 1024).toFixed(1)} KB` : 'PDF, JPG, PNG (máx. 5MB)'}
                  </p>
                </div>
                <input 
                  type="file" 
                  title=""
                  onChange={e => setFile(e.target.files[0])} 
                  style={{ 
                    position: 'absolute', 
                    top: 0, left: 0, right: 0, bottom: 0, 
                    opacity: 0, 
                    color: 'transparent',
                    cursor: 'pointer',
                    width: '100%',
                    height: '100%',
                    zIndex: 1
                  }} 
                />
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', userSelect: 'none', background: 'var(--bg)', padding: '12px', borderRadius: '8px', border: form.acceptedTerms ? '1px solid var(--accent)' : '1px solid var(--border)', transition: 'border-color 0.2s' }}>
              <div style={{ position: 'relative', width: 22, height: 22, flexShrink: 0 }}>
                <input 
                  type="checkbox" 
                  checked={form.acceptedTerms} 
                  onChange={e => setForm({ ...form, acceptedTerms: e.target.checked })} 
                  style={{ position: 'absolute', opacity: 0, cursor: 'pointer', width: '100%', height: '100%', margin: 0, zIndex: 2 }} 
                />
                <div style={{
                  position: 'absolute', inset: 0,
                  background: form.acceptedTerms ? 'var(--accent)' : 'var(--bg)',
                  border: form.acceptedTerms ? '2px solid var(--accent)' : '2px solid var(--border)',
                  borderRadius: '6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                  boxShadow: form.acceptedTerms ? '0 2px 8px rgba(34,81,255,0.3)' : 'none',
                  zIndex: 1
                }}>
                  <Check size={14} color="#fff" strokeWidth={3} style={{ opacity: form.acceptedTerms ? 1 : 0, transform: form.acceptedTerms ? 'scale(1)' : 'scale(0.5)', transition: 'all 0.2s' }} />
                </div>
              </div>
              <span style={{ fontSize: '13px', fontWeight: 500, color: form.acceptedTerms ? 'var(--text)' : 'var(--text-sec)', lineHeight: '1.4', transition: 'color 0.2s' }}>
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
    </div>
  );
}
