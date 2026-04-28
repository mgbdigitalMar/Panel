import { useState } from 'react';
import { useAuth, useData } from '../context';
import { Avatar, Badge, Modal, Input, Textarea, Button, Card, StatCard } from '../components/ui';
import { Plus, Check, X, FileText, ExternalLink } from 'lucide-react';
import styles from './RequestsPage.module.scss';
import clsx from 'clsx';

export default function RequestsPage() {
  const { user } = useAuth();
  const { requests, createRequest, updateRequestStatus } = useData();
  
  const [tab, setTab]             = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [reqType, setReqType]     = useState('vacation');
  const [loading, setLoading]     = useState(false);
  const [form, setForm]           = useState({ startDate: '', endDate: '', reason: '', item: '', amount: '', acceptedTerms: false });

  const filtered =
    tab === 'all'      ? requests :
    tab === 'mine'     ? requests.filter(r => r.employeeId === user.id) :
    requests.filter(r => r.type === tab);

  const handleCreate = async () => {
    setLoading(true);
    let payload;
    if (reqType === 'vacation') {
      payload = { type: 'vacation', start_date: form.startDate, end_date: form.endDate, reason: form.reason };
    } else if (reqType === 'external') {
      payload = { type: 'external', start_date: form.startDate, end_date: form.endDate, reason: form.reason };
    } else {
      payload = { type: 'purchase', item: form.item, amount: parseFloat(form.amount) || 0, reason: form.reason };
    }
    await createRequest(user.id, payload);
    setLoading(false);
    setShowModal(false);
    setForm({ startDate: '', endDate: '', reason: '', item: '', amount: '', acceptedTerms: false });
  };

  const changeStatus = async (id, status, employeeId) => {
    await updateRequestStatus(id, status, user.id, employeeId);
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
          {tabBtn('vacation', 'Vacaciones')}
          {tabBtn('purchase', 'Compras')}
          {tabBtn('external', 'Trabajo Externo')}
        </div>
        <Button icon={Plus} onClick={() => setShowModal(true)}>Nueva solicitud</Button>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <StatCard label="Pendientes" value={requests.filter(r => r.status === 'pending').length}  color="var(--warning)" icon="Clock" sub="Esperando revisión" />
        <StatCard label="Aprobadas"  value={requests.filter(r => r.status === 'approved').length} color="var(--success)" icon="CheckCircle" sub="Este periodo" />
        <StatCard label="Rechazadas" value={requests.filter(r => r.status === 'rejected').length} color="var(--danger)"  icon="XCircle" sub="Sin acción" />
      </div>

      {/* Table */}
      <Card>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
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
                  <td>
                    <div className={styles.userCell}>
                      <Avatar initials={(r.employeeName || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()} size={32} />
                      <span className={styles.userName}>{r.employeeName || '—'}</span>
                    </div>
                  </td>
                  <td>
                    <Badge status={r.type} label={r.type === 'vacation' ? 'Vacaciones' : r.type === 'external' ? 'Trabajo Externo' : 'Compra'} />
                  </td>
                  <td style={{ color: 'var(--text-sec)' }}>
                    {r.type === 'vacation' || r.type === 'external'
                      ? `${r.startDate} → ${r.endDate} (${r.days} días)`
                      : `${r.item} — ${r.amount}€`}
                  </td>
                  <td style={{ color: 'var(--text-mut)' }}>{r.createdAt}</td>
                  <td><Badge status={r.status} /></td>
                  {user.role === 'admin' && (
                    <td>
                      {r.status === 'pending' && (
                        <div className={styles.actionsCell}>
                          <button className={clsx(styles.actionBtn, styles.approveBtn)} onClick={() => changeStatus(r.id, 'approved', r.employeeId)}>
                            <Check size={14} /> Aprobar
                          </button>
                          <button className={clsx(styles.actionBtn, styles.rejectBtn)} onClick={() => changeStatus(r.id, 'rejected', r.employeeId)}>
                            <X size={14} /> Rechazar
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
      </Card>

      {/* New request modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nueva solicitud">
        <div className={styles.typeButtons}>
          {[{ id: 'vacation', label: '🌴 Vacaciones' }, { id: 'purchase', label: '🛒 Compra' }, { id: 'external', label: '📍 Trabajo Externo' }].map(rt => (
            <button 
              key={rt.id} 
              onClick={() => setReqType(rt.id)}
              className={clsx(styles.typeBtn, { [styles.typeBtnActive]: reqType === rt.id })}
            >
              {rt.label}
            </button>
          ))}
        </div>

        {reqType === 'vacation' || reqType === 'external' ? (
          <>
            {reqType === 'external' && (
              <div style={{ 
                background: 'var(--accent-bg)', 
                padding: '16px', 
                borderRadius: 'var(--radius-md)', 
                marginBottom: '20px',
                border: '1px solid var(--accent-border)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ 
                    width: '36px', height: '36px', borderRadius: '8px', 
                    background: 'var(--accent)', color: 'white', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center' 
                  }}>
                    <FileText size={20} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Condiciones de Trabajo Externo</h4>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-sec)' }}>Es obligatorio leer y aceptar el documento</p>
                  </div>
                  <a 
                    href="/Solicitud de Teletrabajo en Ubicaciones Distintas a la Vivienda Habitual.pdf" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ 
                      marginLeft: 'auto', 
                      padding: '8px 12px', 
                      borderRadius: '6px', 
                      background: 'var(--bg)', 
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                      fontSize: '12px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      textDecoration: 'none'
                    }}
                  >
                    Abrir PDF <ExternalLink size={14} />
                  </a>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                  <input 
                    type="checkbox" 
                    checked={form.acceptedTerms} 
                    onChange={e => setForm({ ...form, acceptedTerms: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>
                    He leído el PDF y acepto las condiciones para trabajar fuera de mi vivienda habitual
                  </span>
                </label>
              </div>
            )}
            <div className={styles.modalGrid}>
              <Input label="Fecha inicio" value={form.startDate} onChange={v => setForm({ ...form, startDate: v })} type="date" required />
              <Input label="Fecha fin"    value={form.endDate}   onChange={v => setForm({ ...form, endDate: v })}   type="date" required />
            </div>
            <Textarea label="Motivo" value={form.reason} onChange={v => setForm({ ...form, reason: v })} placeholder={reqType === 'vacation' ? "Describe el motivo de las vacaciones..." : "Explica el lugar y motivo del trabajo externo..."} />
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
          <Button onClick={handleCreate} disabled={loading || (reqType === 'external' && !form.acceptedTerms)}>{loading ? 'Enviando...' : 'Enviar solicitud'}</Button>
        </div>
      </Modal>
    </div>
  );
}
