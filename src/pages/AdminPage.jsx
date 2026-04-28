import { useState, useEffect, useRef } from 'react';
import { useAuth, useData } from '../context';
import { MOCK_ROOMS, MOCK_VEHICLES } from '../data/mockData';
import { Avatar, Badge, Modal, Input, Select, Button, Card } from '../components/ui';
import { Search, Plus, Edit2, Trash2, Eye, EyeOff, Building, Car, FileText, Send, Clock, CheckCircle, PenTool, Upload, X, Timer, Download } from 'lucide-react';
import styles from './AdminPage.module.scss';
import clsx from 'clsx';
import bcrypt from 'bcryptjs';
import { supabase } from '../utils/supabase';
import { motion, AnimatePresence } from 'framer-motion';

const DEPARTMENTS = [
  { value: 'Administración - RRHH', label: 'Administración - RRHH' },
  { value: 'Comercial - HEF', label: 'Comercial - HEF' },
  { value: 'Formación', label: 'Formación' },
  { value: 'Verificación (CAE)', label: 'Verificación (CAE)' },
  { value: 'Planificación', label: 'Planificación' },
  { value: 'Técnico', label: 'Técnico' },
  { value: 'Comunicación - marketing', label: 'Comunicación - marketing' },
  { value: 'Marketing - diseño', label: 'Marketing - diseño' },
  { value: 'Sin asignar', label: 'Sin asignar' },
];

export default function AdminPage() {
  const { user, employees, setEmployees } = useAuth();
  const { rooms, vehicles, documents, sendDocument, uploadDocumentFile, hourCompensations = [], updateHourCompensationStatus, refresh } = useData();

  // Admin Bolsa Horas filters
  const [hoursFilterFrom, setHoursFilterFrom] = useState('');
  const [hoursFilterTo,   setHoursFilterTo]   = useState('');
  const [hoursFilterEmp,  setHoursFilterEmp]  = useState('');

  const filteredHours = (hourCompensations || [])
    .filter(h => h.type === 'bolsa')
    .filter(h => !hoursFilterEmp || h.employeeId === hoursFilterEmp)
    .filter(h => !hoursFilterFrom || h.date >= hoursFilterFrom)
    .filter(h => !hoursFilterTo   || h.date <= hoursFilterTo);

  const exportHoursCSV = (rows) => {
    const headers = ['Empleado', 'Fecha', 'Motivo', 'Horas', 'Estado', 'Revisado por', 'Fecha solicitud'];
    const lines = [
      headers.join(';'),
      ...rows.map(h => [
        h.employeeName,
        h.date,
        `"${(h.reason || '').replace(/"/g, '""')}"`,
        String(h.hours).replace('.', ','),
        h.status === 'approved' ? 'Aprobada' : h.status === 'rejected' ? 'Rechazada' : 'Pendiente',
        h.reviewerName || '—',
        new Date(h.createdAt).toLocaleDateString('es-ES'),
      ].join(';')),
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `bolsa-horas-admin-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };
  
  const [tab, setTab]             = useState('employees');
  const [showModal, setShowModal] = useState(false);
  const [editEmp, setEditEmp]     = useState(null);
  const [showPassFor, setShowPassFor] = useState(null);
  const [search, setSearch]       = useState('');
  const [showResModal, setShowResModal] = useState(false);
  const [resType, setResType]     = useState('room');
  const [showDocModal, setShowDocModal] = useState(false);
  const [docSending, setDocSending]   = useState(false);
  const [docForm, setDocForm] = useState({ title: '', description: '', recipientId: '' });
  const [docFile, setDocFile] = useState(null);   // the actual File object
  const [docDrag, setDocDrag] = useState(false);  // drag-over state
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'employee', dept: 'Sin asignar', position: '', phone: '', birthdate: '', workMode: 'office' });
  const [resForm, setResForm] = useState({ id: null, name: '', capacity: '', floor: '', equipment: '', model: '', plate: '', year: '', type: 'Turismo' });
  const [editingRes, setEditingRes] = useState(false);



  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase())
  );
  const depts = [...new Set(employees.map(e => e.dept))];

  const handleSaveEmployee = async () => {
    if (!form.name || !form.email) return;
    if (!form.password && !editEmp) return alert('Contraseña requerida para nuevos empleados');
    
    const avatar = form.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    if (editEmp) {
      const updateData = {
        name: form.name,
        email: form.email,
        role: form.role,
        department: form.dept,
        position: form.position,
        phone: form.phone,
        birthdate: form.birthdate || null,
        work_mode: form.workMode,
        avatar_initials: avatar
      };
      if (form.password) {
        // Hash en frontend — el trigger de Postgres fue eliminado
        updateData.password_hash = await bcrypt.hash(form.password, 10);
        updateData.first_login = true; // Fuerza re-login con nueva contraseña
      }
      const { data, error } = await supabase.from('profiles').update(updateData).eq('id', editEmp.id).select().single();
      
      if (!error && data) {
         setEmployees(employees.map(e => e.id === editEmp.id ? { ...e, ...form, avatar } : e));
      } else { console.error("Error al actualizar", error); return; }
    } else {
      // Hash en frontend antes de insertar — el trigger de Postgres fue eliminado
      const hashedPwd = await bcrypt.hash(form.password, 10);
      const { data, error } = await supabase.from('profiles').insert([{
        name: form.name,
        email: form.email,
        password_hash: hashedPwd,
        role: form.role,
        department: form.dept,
        position: form.position,
        phone: form.phone,
        birthdate: form.birthdate || null,
        first_login: true,
        avatar_initials: avatar
      }]).select().single();

      if (!error && data) {
         setEmployees([...employees, { id: data.id, ...form, avatar, joinDate: data.join_date, firstLogin: true }]);
      } else { console.error("Error al crear empleado", error); return; }
    }
    setShowModal(false);
    setEditEmp(null);
        setForm({ name: '', email: '', password: '', role: 'employee', dept: 'Sin asignar', position: '', phone: '', birthdate: '', workMode: 'office' });
  };

  const handleEdit = emp => { 
    setEditEmp(emp); 
    setForm({ 
      name: emp.name, 
      email: emp.email, 
      password: '', 
      role: emp.role, 
      dept: emp.dept, 
      position: emp.position, 
      phone: emp.phone, 
      birthdate: emp.birthdate,
      workMode: emp.workMode || 'office'
    }); 
    setShowModal(true); 
  };
  
  const handleDelete = async (id) => {
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (!error) setEmployees(employees.filter(e => e.id !== id));
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

  const [docUploadStatus, setDocUploadStatus] = useState(''); // upload feedback

  const handleSendDoc = async () => {
    if (!docForm.title || !docForm.recipientId) return;

    // Validate file size (max 10 MB for base64 fallback)
    if (docFile && docFile.size > 10 * 1024 * 1024) {
      setDocUploadStatus('⚠️ El archivo es demasiado grande (máx. 10 MB). Configura Supabase Storage para archivos más grandes.');
      return;
    }

    setDocSending(true);
    setDocUploadStatus(docFile ? '⏳ Subiendo archivo...' : '');

    let fileUrl = null;
    if (docFile) {
      fileUrl = await uploadDocumentFile(docFile);
      if (!fileUrl) {
        setDocUploadStatus('❌ Error al subir el archivo. Inténtalo de nuevo.');
        setDocSending(false);
        return;
      }
      setDocUploadStatus('✅ Archivo subido correctamente');
    }

    const result = await sendDocument({
      title: docForm.title,
      description: docForm.description,
      fileUrl,
      senderId: user.id,
      recipientId: docForm.recipientId,
    });

    setDocSending(false);
    if (result) {
      setShowDocModal(false);
      setDocForm({ title: '', description: '', recipientId: '' });
      setDocFile(null);
      setDocUploadStatus('');
    } else {
      setDocUploadStatus('❌ Error al guardar el documento en la base de datos.');
    }
  };

  return (
    <div className={styles.container}>
      {/* Page Controls */}
      <div className={styles.pageControls}>
        <div className={styles.tabsRow}>
          {tabBtn('employees', 'Empleados / Usuarios')}
          {tabBtn('rooms', 'Salas')}
          {tabBtn('vehicles', 'Vehículos')}
          {tabBtn('documents', 'Documentos')}
          {tabBtn('bolsahoras', 'Bolsa Horas')}
        </div>
        
        {tab === 'employees' && (
          <Button icon={Plus} onClick={() => { setEditEmp(null); setForm({ name: '', email: '', password: '', role: 'employee', dept: '', position: '', phone: '', birthdate: '', workMode: 'office' }); setShowModal(true); }}>
            Nuevo empleado
          </Button>
        )}
        {tab === 'rooms' && (
          <Button icon={Plus} onClick={() => { setResType('room'); setResForm({ id: null, name: '', capacity: '', floor: '', equipment: '' }); setEditingRes(false); setShowResModal(true); }}>
            Nueva sala
          </Button>
        )}
        {tab === 'vehicles' && (
          <Button icon={Plus} onClick={() => { setResType('vehicle'); setResForm({ id: null, model: '', plate: '', year: '', type: 'Turismo' }); setEditingRes(false); setShowResModal(true); }}>
            Nuevo vehículo
          </Button>
        )}
        {tab === 'documents' && (
          <Button icon={Send} onClick={() => setShowDocModal(true)}>
            Enviar documento
          </Button>
        )}
        {tab === 'bolsahoras' && filteredHours.length > 0 && (
          <Button icon={Download} variant="ghost" onClick={() => exportHoursCSV(filteredHours)}>
            Descargar Excel
          </Button>
        )}
      </div>

      {/* ── EMPLOYEES ── */}
      <AnimatePresence mode="wait">
      {tab === 'employees' && (
        <motion.div 
          key="employees"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div className={styles.tableHeaderSection}>
              <div className={styles.searchWrapper}>
                <Search className={styles.searchIcon} size={16} />
                <input 
                  className={styles.searchInput}
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                  placeholder="Buscar empleado por nombre o email..."
                />
              </div>
              <div className={styles.deptStats}>
                {depts.slice(0, 5).map(d => (
                  <div key={d} className={styles.deptBadge} title={d}>
                    <span>{d.includes('-') ? d.split('-')[0].trim() : d}</span>
                    <span>{employees.filter(e => e.dept === d).length}</span>
                  </div>
                ))}
                {depts.length > 5 && (
                  <div className={styles.deptBadge}>
                    <span>Otros</span>
                    <span>{employees.filter(e => !depts.slice(0,5).includes(e.dept)).length}</span>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {['Usuario', 'Puesto', 'Contacto', 'Modalidad', 'Acciones'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(emp => (
                    <tr key={emp.id}>
                      {/* 1. Usuario */}
                      <td>
                        <div className={styles.userCell}>
                          <Avatar initials={emp.avatar} size={42} />
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <p className={styles.userName}>{emp.name}</p>
                              {emp.role === 'admin' && <Badge status="admin" />}
                            </div>
                            <p className={styles.userPhone} style={{ letterSpacing: 0 }}>{emp.phone || 'Sin teléfono'}</p>
                          </div>
                        </div>
                      </td>

                      {/* 2. Puesto */}
                      <td>
                        <p style={{ margin: '0 0 4px', fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>{emp.position || 'Sin cargo'}</p>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-sec)' }}>{emp.dept}</p>
                      </td>

                      {/* 3. Contacto */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                          <Badge 
                            status="neutral" 
                            label={emp.firstLogin ? 'Primer acceso pendiente' : 'Activo'} 
                            className={emp.firstLogin ? 'variant-warning' : 'variant-success'}
                          />
                          {(() => {
                            const mode = (emp.workMode || 'office').toLowerCase();
                            const isExterno = mode === 'externo' || mode === 'field';
                            const isMe = emp.id === user?.id;
                            
                            return isExterno ? (
                              <a 
                                href={`mailto:${emp.email}`} 
                                style={{ 
                                  color: isMe ? 'var(--accent)' : 'var(--text)', 
                                  textDecoration: 'none',
                                  fontWeight: 500,
                                  fontSize: 13
                                }}
                              >
                                {emp.email}
                              </a>
                            ) : (
                              <span style={{ 
                                color: isMe ? 'var(--accent)' : 'var(--text-sec)',
                                fontSize: 13
                              }}>
                                {emp.email}
                              </span>
                            );
                          })()}
                        </div>
                      </td>

                      {/* 4. Modalidad */}
                      <td>
                        {(() => {
                          const mode = (emp.workMode || 'office').toLowerCase();
                          const isOffice = mode === 'office' || mode === 'oficina';
                          const isRemote = mode === 'remote' || mode === 'remoto';
                          
                          return (
                            <span className="work-mode-badge" style={{
                              background: isOffice ? 'var(--accent-bg)' : isRemote ? 'var(--success-bg)' : 'var(--warning-bg)',
                              color: isOffice ? 'var(--accent)' : isRemote ? 'var(--success)' : 'var(--warning)',
                              padding: '4px 10px',
                              borderRadius: 'var(--radius-full)',
                              fontSize: '11px',
                              fontWeight: '700',
                              letterSpacing: '0.02em',
                              display: 'inline-block'
                            }}>
                              {isOffice ? 'OFICINA' : isRemote ? 'REMOTO' : 'EXTERNO'}
                            </span>
                          );
                        })()}
                      </td>

                      {/* 5. Acciones */}
                      <td>
                        <div className={styles.actionsCell}>
                          <button className={clsx(styles.actionBtn, styles.edit)} onClick={() => handleEdit(emp)} title="Editar empleado">
                            <Edit2 size={16} />
                          </button>
                          <button className={clsx(styles.actionBtn, styles.delete)} onClick={() => handleDelete(emp.id)} title="Dar de baja">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ── ROOMS ── */}
      {tab === 'rooms' && (
        <motion.div 
          key="rooms"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >

          <div className={styles.grid}>
            {rooms.map(room => (
              <Card key={room.id} className={styles.resourceCard}>
                <div className={styles.resourceHeader}>
                  <div className={styles.resourceIcon} style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                    <Building size={22} />
                  </div>
                  <div className={clsx(styles.actionsCell)} style={{ marginLeft: 'auto', gap: 4 }}>
                    <button className={clsx(styles.actionBtn, styles.edit)} onClick={() => {
                      setResType('room');
                      setResForm({ 
                        id: room.id, 
                        name: room.name, 
                        capacity: room.capacity, 
                        floor: room.floor, 
                        equipment: (room.equipment || []).join(', ') 
                      });
                      setEditingRes(true);
                      setShowResModal(true);
                    }} title="Editar">
                      <Edit2 size={14} />
                    </button>
                    <button className={clsx(styles.actionBtn, styles.delete)} onClick={async () => {
                      const { error } = await supabase.from('rooms').delete().eq('id', room.id);
                      if (!error) refresh();
                    }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <h4 className={styles.resourceTitle}>{room.name}</h4>
                <p className={styles.resourceMeta}>Planta {room.floor} · Capacidad: {room.capacity} personas</p>
                <div className={styles.tagList}>
                  {room.equipment.map(eq => <span key={eq} className={styles.tag}>{eq}</span>)}
                </div>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── VEHICLES ── */}
      {tab === 'vehicles' && (
        <motion.div 
          key="vehicles"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >

          <div className={styles.grid}>
            {vehicles.map(v => (
              <Card key={v.id} className={styles.resourceCard}>
                <div className={styles.resourceHeader}>
                  <div className={styles.resourceIcon} style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                    <Car size={22} />
                  </div>
                  <div className={clsx(styles.actionsCell)} style={{ marginLeft: 'auto', gap: 4 }}>
                    <button className={clsx(styles.actionBtn, styles.edit)} onClick={() => {
                      setResType('vehicle');
                      setResForm({ 
                        id: v.id,
                        model: v.model, 
                        plate: v.plate, 
                        year: v.year || '', 
                        type: v.type 
                      });
                      setEditingRes(true);
                      setShowResModal(true);
                    }} title="Editar">
                      <Edit2 size={14} />
                    </button>
                    <button className={clsx(styles.actionBtn, styles.delete)} onClick={async () => {
                      const { error } = await supabase.from('vehicles').delete().eq('id', v.id);
                      if (!error) refresh();
                    }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <h4 className={styles.resourceTitle}>{v.model}</h4>
                <p className={styles.resourceMeta}>Matrícula: <strong>{v.plate}</strong></p>
                <p className={styles.resourceMeta} style={{ margin: 0 }}>{v.type} · {v.year}</p>
              </Card>
            ))}
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* ── DOCUMENTS ── */}
      <AnimatePresence mode="wait">
      {tab === 'documents' && (
        <motion.div
          key="documents"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div className={styles.tableHeaderSection} style={{ padding: '16px 20px' }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>
                Documentos enviados
              </p>
              <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-mut)' }}>
                {(documents || []).length} documento{(documents || []).length !== 1 ? 's' : ''}
              </span>
            </div>
            {(!documents || documents.length === 0) ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-mut)' }}>
                <FileText size={40} strokeWidth={1} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.35 }} />
                <p style={{ margin: 0, fontSize: 14 }}>No se han enviado documentos todavía</p>
              </div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {['Documento', 'Destinatario', 'Estado', 'Fecha', 'Acciones'].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(documents || []).map(doc => {
                      const recipient = employees.find(e => String(e.id) === String(doc.recipientId));
                      const recipName   = recipient?.name   || doc.recipientName || '—';
                      const recipAvatar = recipient?.avatar  || recipName.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
                      return (
                        <tr key={doc.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--accent-bg)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <FileText size={16} />
                              </div>
                              <div>
                                <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{doc.title}</p>
                                {doc.description && (
                                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-sec)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.description}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Avatar initials={recipAvatar} size={28} />
                              <div>
                                <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, display: 'block' }}>{recipName}</span>
                                {recipient?.dept && <span style={{ fontSize: 11, color: 'var(--text-mut)' }}>{recipient.dept}</span>}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={clsx(styles.docStatusBadge, {
                              [styles.docStatusPending]:   doc.status === 'pending',
                              [styles.docStatusSigned]:    doc.status === 'signed',
                              [styles.docStatusCompleted]: doc.status === 'completed',
                            })}>
                              {doc.status === 'pending'   && <><Clock size={11} /> Pendiente</>}
                              {doc.status === 'signed'    && <><PenTool size={11} /> Firmado</>}
                              {doc.status === 'completed' && <><CheckCircle size={11} /> Completado</>}
                            </span>
                          </td>
                          <td style={{ fontSize: 13, color: 'var(--text-sec)' }}>
                            {new Date(doc.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td>
                            <div className={styles.actionsCell}>
                              {doc.fileUrl && (
                                <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                                  className={clsx(styles.actionBtn, styles.edit)}
                                  title="Ver archivo"
                                >
                                  <FileText size={14} />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </motion.div>
      )}
      </AnimatePresence>

      {/* ── BOLSA HORAS ── */}
      <AnimatePresence mode="wait">
      {tab === 'bolsahoras' && (
        <motion.div
          key="bolsahoras"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {/* Filters */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-mut)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Empleado</label>
                <select
                  value={hoursFilterEmp}
                  onChange={e => setHoursFilterEmp(e.target.value)}
                  style={{ padding: '7px 10px', background: 'var(--bg)', border: '1px solid var(--input-border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 13, outline: 'none' }}
                >
                  <option value="">Todos</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-mut)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Desde</label>
                <input type="date" value={hoursFilterFrom} onChange={e => setHoursFilterFrom(e.target.value)}
                  style={{ padding: '7px 10px', background: 'var(--bg)', border: '1px solid var(--input-border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 13, outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-mut)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hasta</label>
                <input type="date" value={hoursFilterTo} onChange={e => setHoursFilterTo(e.target.value)}
                  style={{ padding: '7px 10px', background: 'var(--bg)', border: '1px solid var(--input-border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 13, outline: 'none' }} />
              </div>
              {(hoursFilterEmp || hoursFilterFrom || hoursFilterTo) && (
                <button
                  onClick={() => { setHoursFilterEmp(''); setHoursFilterFrom(''); setHoursFilterTo(''); }}
                  style={{ padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--text-sec)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Limpiar
                </button>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-mut)', alignSelf: 'flex-end', paddingBottom: 8 }}>
                {filteredHours.length} solicitud{filteredHours.length !== 1 ? 'es' : ''} &bull; {filteredHours.reduce((s, h) => s + (h.status === 'approved' ? h.hours : 0), 0).toFixed(1)}h aprobadas
              </span>
            </div>

            {filteredHours.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-mut)' }}>
                <Timer size={40} strokeWidth={1} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.35 }} />
                <p style={{ margin: 0, fontSize: 14 }}>No hay solicitudes de bolsa con los filtros aplicados</p>
              </div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {['Empleado', 'Fecha', 'Motivo', 'Horas', 'Estado', 'Acciones'].map(h => <th key={h}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHours.map(h => {
                      const emp = employees.find(e => String(e.id) === String(h.employeeId));
                      const empName = emp?.name || h.employeeName || 'Empleado';
                      const empAvatar = emp?.avatar || empName.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
                      return (
                        <tr key={h.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Avatar initials={empAvatar} size={30} />
                              <div>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'block' }}>{empName}</span>
                                {emp?.dept && <span style={{ fontSize: 11, color: 'var(--text-mut)' }}>{emp.dept}</span>}
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                            {new Date(h.date + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td style={{ fontSize: 13, color: 'var(--text-sec)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {h.reason}
                          </td>
                          <td>
                            <span style={{ background: 'var(--accent-bg)', color: 'var(--accent)', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999 }}>
                              {h.hours}h
                            </span>
                          </td>
                          <td>
                            <span className={clsx(styles.docStatusBadge, {
                              [styles.docStatusPending]:   h.status === 'pending',
                              [styles.docStatusCompleted]: h.status === 'approved',
                              [styles.docStatusSigned]:    h.status === 'rejected',
                            })} style={h.status === 'rejected' ? { background: 'var(--danger-bg)', color: 'var(--danger)' } : {}}>
                              {h.status === 'pending'  && <><Clock size={11} /> Pendiente</>}
                              {h.status === 'approved' && <><CheckCircle size={11} /> Aprobada</>}
                              {h.status === 'rejected' && <><X size={11} /> Rechazada</>}
                            </span>
                          </td>
                          <td>
                            {h.status === 'pending' ? (
                              <div className={styles.actionsCell}>
                                <button
                                  className={clsx(styles.actionBtn)}
                                  style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid rgba(22,163,74,0.2)', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                  onClick={() => updateHourCompensationStatus(h.id, 'approved', user?.id)}
                                >
                                  <CheckCircle size={13} /> Aprobar
                                </button>
                                <button
                                  className={clsx(styles.actionBtn)}
                                  style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                  onClick={() => updateHourCompensationStatus(h.id, 'rejected', user?.id)}
                                >
                                  <X size={13} /> Rechazar
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--text-mut)' }}>
                                {h.reviewerName ? `por ${h.reviewerName}` : '—'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Employee modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setEditEmp(null); }} title={editEmp ? 'Editar empleado' : 'Nuevo empleado'}>
        <div className={styles.modalGrid}>
          <div className={styles.fullWidth}>
            <Input label="Nombre completo" value={form.name} onChange={v => setForm({ ...form, name: v })} required />
          </div>
          <Input label="Email corporativo" value={form.email} onChange={v => setForm({ ...form, email: v })} type="email" required />
          <Input label="Contraseña inicial" value={form.password} onChange={v => setForm({ ...form, password: v })} required />
          <Select 
            label="Departamento" 
            value={form.dept} 
            onChange={v => setForm({ ...form, dept: v })}
            options={DEPARTMENTS} 
          />
          <Input label="Cargo / Posición" value={form.position} onChange={v => setForm({ ...form, position: v })} />
          <Input label="DNI" value={form.phone} onChange={v => setForm({ ...form, phone: v })} />
          <Input label="Fecha nacimiento" value={form.birthdate} onChange={v => setForm({ ...form, birthdate: v })} type="date" />
          <div className={styles.fullWidth}>
          <Select 
            label="Rol" 
            value={form.role} 
            onChange={v => setForm({ ...form, role: v })}
            options={[{ value: 'employee', label: 'Empleado' }, { value: 'admin', label: 'Administrador' }]} 
          />
          <Select 
            label="Modo de trabajo" 
            value={form.workMode} 
            onChange={v => setForm({ ...form, workMode: v })}
            options={[
              { value: 'office', label: 'Oficina' },
              { value: 'remote', label: 'Remoto' },
              { value: 'field', label: 'Externo' }
            ]} 
          />
          </div>
        </div>
        {!editEmp && (
          <div className={styles.warningBox}>
            El empleado deberá cambiar esta contraseña en su primer inicio de sesión.
          </div>
        )}
        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={() => { setShowModal(false); setEditEmp(null); }}>Cancelar</Button>
          <Button onClick={handleSaveEmployee}>{editEmp ? 'Guardar cambios' : 'Crear empleado'}</Button>
        </div>
      </Modal>

      {/* Resources modal */}
      <Modal open={showResModal} onClose={() => { setShowResModal(false); setEditingRes(false); }} title={editingRes ? 'Editar' : 'Nuevo ' + (resType === 'room' ? 'sala' : 'vehículo')}>
{resType === 'room' ? (
          <>
            <Input label="Nombre de la sala" value={resForm.name} onChange={v => setResForm({ ...resForm, name: v })} required />
            <div className={styles.modalGrid} style={{ marginTop: 16 }}>
              <Input label="Capacidad (personas)" value={resForm.capacity} onChange={v => setResForm({ ...resForm, capacity: v })} type="number" required />
              <Input label="Planta" value={resForm.floor} onChange={v => setResForm({ ...resForm, floor: v })} type="number" required />
            </div>
            <Input 
              label="Equipamiento (separado por comas)" 
              value={resForm.equipment} 
              onChange={v => setResForm({ ...resForm, equipment: v })} 
              placeholder="Proyector, TV, Videoconferencia, Pizarra digital, Audio..."
            />
          </>
        ) : (
          <>
            <Input label="Modelo del vehículo" value={resForm.model} onChange={v => setResForm({ ...resForm, model: v })} required />
            <Input label="Matrícula" value={resForm.plate} onChange={v => setResForm({ ...resForm, plate: v })} required />
            <div className={styles.modalGrid} style={{ marginTop: 16 }}>
              <Input label="Año" value={resForm.year} onChange={v => setResForm({ ...resForm, year: v })} type="number" />
              <Select 
                label="Tipo" 
                value={resForm.type} 
                onChange={v => setResForm({ ...resForm, type: v })}
                options={[{ value: 'Turismo', label: 'Turismo' }, { value: 'Furgoneta', label: 'Furgoneta' }, { value: 'SUV', label: 'SUV' }]} 
              />
            </div>
          </>
        )}
        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={() => setShowResModal(false)}>Cancelar</Button>
          <Button onClick={async () => {
            const equipmentArray = resForm.equipment.split(',').map(item => item.trim()).filter(Boolean);
            if (resType === 'room') {
              if (editingRes && resForm.id) {
                // Update room
                const { error } = await supabase.from('rooms').update({ 
                  name: resForm.name, 
                  capacity: parseInt(resForm.capacity), 
                  floor: parseInt(resForm.floor), 
                  equipment: equipmentArray.length ? equipmentArray : []
                }).eq('id', resForm.id);
              } else {
                // Create room
                const { data, error } = await supabase.from('rooms').insert([{ 
                  name: resForm.name, 
                  capacity: parseInt(resForm.capacity), 
                  floor: parseInt(resForm.floor), 
                  equipment: equipmentArray.length ? equipmentArray : [] 
                }]).select().single();
              }
              if (!error) refresh();
            } else {
              if (editingRes && resForm.id) {
                // Update vehicle
                const { error } = await supabase.from('vehicles').update({ 
                  model: resForm.model, 
                  plate: resForm.plate, 
                  year: parseInt(resForm.year) || null, 
                  type: resForm.type 
                }).eq('id', resForm.id);
              } else {
                // Create vehicle
                const { data, error } = await supabase.from('vehicles').insert([{ 
                  model: resForm.model, 
                  plate: resForm.plate, 
                  year: parseInt(resForm.year), 
                  type: resForm.type 
                }]).select().single();
              }
              if (!error) refresh();
            }
            setShowResModal(false);
            setEditingRes(false);
          }}>
            {editingRes ? 'Actualizar' : 'Crear'}
          </Button>
        </div>
      </Modal>

      {/* Send Document modal */}
      <Modal
        open={showDocModal}
        onClose={() => { setShowDocModal(false); setDocForm({ title: '', description: '', recipientId: '' }); setDocFile(null); }}
        title="Enviar documento"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Input
            label="Título del documento"
            value={docForm.title}
            onChange={v => setDocForm({ ...docForm, title: v })}
            placeholder="Ej: Contrato 2025, NDA Proyecto X..."
            required
          />
          <Input
            label="Descripción (opcional)"
            value={docForm.description}
            onChange={v => setDocForm({ ...docForm, description: v })}
            placeholder="Instrucciones o descripción breve"
          />

          {/* ── File Upload Zone ── */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-mut)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>
              Archivo adjunto
            </label>
            <div
              className={clsx(styles.fileZone, { [styles.fileZoneDrag]: docDrag, [styles.fileZoneHasFile]: !!docFile })}
              onDragOver={e => { e.preventDefault(); setDocDrag(true); }}
              onDragLeave={() => setDocDrag(false)}
              onDrop={e => {
                e.preventDefault();
                setDocDrag(false);
                const f = e.dataTransfer.files[0];
                if (f) setDocFile(f);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.zip"
                style={{ display: 'none' }}
                onChange={e => { if (e.target.files[0]) setDocFile(e.target.files[0]); }}
              />
              {docFile ? (
                <div className={styles.filePreview}>
                  <FileText size={22} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className={styles.fileName}>{docFile.name}</p>
                    <p className={styles.fileSize}>{(docFile.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button
                    className={styles.fileRemove}
                    onClick={e => { e.stopPropagation(); setDocFile(null); }}
                    title="Quitar archivo"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className={styles.filePrompt}>
                  <Upload size={28} style={{ color: 'var(--text-mut)', marginBottom: 8 }} />
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: 'var(--text-sec)' }}>Arrastra un archivo aquí</p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-mut)' }}>o haz clic para seleccionar</p>
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-mut)' }}>PDF, Word, Excel, imágenes, ZIP &bull; Máx 50 MB</p>
                </div>
              )}
            </div>
          </div>

          <Select
            label="Destinatario"
            value={docForm.recipientId}
            onChange={v => setDocForm({ ...docForm, recipientId: v })}
            options={[
              { value: '', label: 'Seleccionar empleado...' },
              ...employees.filter(e => e.id !== user?.id).map(e => ({ value: e.id, label: e.name }))
            ]}
          />
        </div>
        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={() => { setShowDocModal(false); setDocFile(null); setDocUploadStatus(''); }}>Cancelar</Button>
          <Button
            icon={Send}
            onClick={handleSendDoc}
            loading={docSending}
            disabled={!docForm.title || !docForm.recipientId || docSending}
          >
            Enviar documento
          </Button>
        </div>
        {docUploadStatus && (
          <p style={{
            margin: '8px 0 0',
            fontSize: 13,
            fontWeight: 600,
            color: docUploadStatus.startsWith('❌') || docUploadStatus.startsWith('⚠️')
              ? 'var(--danger)'
              : docUploadStatus.startsWith('✅') ? 'var(--success)' : 'var(--text-sec)',
          }}>
            {docUploadStatus}
          </p>
        )}
      </Modal>
    </div>
  );
}
