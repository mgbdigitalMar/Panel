import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth, useData } from '../context';
import { MOCK_ROOMS, MOCK_VEHICLES } from '../data/mockData';
import { Avatar, Badge, Modal, Input, Select, Button, Card, ConfirmModal } from '../components/ui';
import { Search, Plus, Edit2, Trash2, Eye, EyeOff, Building, Car, FileText, Send, Clock, CheckCircle, Check, PenTool, Upload, X, Timer, Download } from 'lucide-react';
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
  const { rooms, vehicles, documents, sendDocument, uploadDocumentFile, deleteDocument, hourCompensations = [], updateHourCompensationStatus, deleteHourCompensation, deleteEmployeeData, refresh } = useData();

  // Admin Bolsa Horas filters
  const [hoursFilterFrom, setHoursFilterFrom] = useState('');
  const [hoursFilterTo,   setHoursFilterTo]   = useState('');
  const [hoursFilterEmp,  setHoursFilterEmp]  = useState('');

  const filteredHours = useMemo(() => (hourCompensations || [])
    .filter(h => h.type === 'bolsa')
    .filter(h => !hoursFilterEmp || h.employeeId === hoursFilterEmp)
    .filter(h => !hoursFilterFrom || h.date >= hoursFilterFrom)
    .filter(h => !hoursFilterTo   || h.date <= hoursFilterTo), 
    [hourCompensations, hoursFilterEmp, hoursFilterFrom, hoursFilterTo]
  );

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
  const [deleteConfirm, setDeleteConfirm] = useState(null);
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
  
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [onboardingFile, setOnboardingFile] = useState(null);
  const [onboardingUploading, setOnboardingUploading] = useState(false);
  const [onboardingUploadStatus, setOnboardingUploadStatus] = useState('');

  const handleUpdateOnboarding = async () => {
    if (!onboardingFile) return;
    setOnboardingUploading(true);
    setOnboardingUploadStatus('⏳ Subiendo archivo al servidor...');
    const { url, error } = await uploadDocumentFile(onboardingFile);
    if (error || !url) {
      setOnboardingUploadStatus('❌ Error al subir: ' + (error || 'Desconocido'));
      setOnboardingUploading(false);
      return;
    }
    
    // Guardar en la tabla documents
    const { error: dbError } = await supabase.from('documents').insert([{
      title: '__ONBOARDING_DOC__',
      description: 'Documento de inicio dinámico',
      file_url: url,
      sender_id: user.id,
      recipient_id: null,
      status: 'completed',
    }]);
    
    if (dbError) {
      setOnboardingUploadStatus('❌ Error guardando configuración: ' + dbError.message);
    } else {
      setOnboardingUploadStatus('✅ Documento actualizado correctamente');
      setTimeout(() => {
        refresh();
        setShowOnboardingModal(false);
        setOnboardingFile(null);
        setOnboardingUploadStatus('');
      }, 1500);
    }
    setOnboardingUploading(false);
  };


  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'employee', dept: 'Sin asignar', position: '', phone: '', birthdate: '', workMode: 'office' });
  const [resForm, setResForm] = useState({ id: null, name: '', capacity: '', floor: '', equipment: '', model: '', plate: '', year: '', type: 'Turismo' });
  const [editingRes, setEditingRes] = useState(false);



  const filtered = useMemo(() => employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase())
  ), [employees, search]);
  const depts = useMemo(() => [...new Set(employees.map(e => e.dept))], [employees]);

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
        setForm({ name: '', email: '', password: '', role: 'employee', dept: 'Sin asignar', position: '', phone: '', birthdate: '', workMode: 'Office' });
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
      workMode: emp.workMode || 'Office'
    }); 
    setShowModal(true); 
  };
  
  const handleDelete = (id) => {
    setDeleteConfirm({
      title: 'Eliminar empleado',
      message: '¿Estás seguro de que deseas eliminar este empleado y todos sus archivos asociados? Esta acción no se puede deshacer.',
      action: async () => {
        await deleteEmployeeData(id);
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (!error) {
          setEmployees(employees.filter(e => e.id !== id));
        } else {
          alert('Error al eliminar empleado: ' + error.message);
        }
      }
    });
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

    // No file size limit checked in frontend anymore

    setDocSending(true);
    setDocUploadStatus(docFile ? '⏳ Subiendo archivo...' : '');

    let fileUrl = null;
    if (docFile) {
      const uploadRes = await uploadDocumentFile(docFile);
      if (uploadRes.error || !uploadRes.url) {
        setDocUploadStatus(uploadRes.error ? `❌ ${uploadRes.error}` : '❌ Error al subir el archivo. Inténtalo de nuevo.');
        setDocSending(false);
        return;
      }
      fileUrl = uploadRes.url;
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
    if (result && result.error) {
      setDocUploadStatus(`❌ Error en base de datos: ${result.error.message || 'Error desconocido'}`);
    } else if (result && result.data) {
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
          <Button icon={Plus} onClick={() => { setEditEmp(null); setForm({ name: '', email: '', password: '', role: 'employee', dept: '', position: '', phone: '', birthdate: '', workMode: 'Office' }); setShowModal(true); }}>
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
          <div className={styles.headerRight}>
            <Button icon={Upload} variant="ghost" onClick={() => setShowOnboardingModal(true)}>
              Actualizar doc. inicio
            </Button>
            <Button icon={Send} onClick={() => setShowDocModal(true)}>
              Enviar documento
            </Button>
          </div>
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
          <Card className={styles.tableCard}>
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
              <table className="table">
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
                      <td data-label="Usuario">
                        <div className={styles.userCell}>
                          <Avatar initials={emp.avatar} size={42} />
                          <div>
                            <div className={styles.userNameContainer}>
                              <p className={styles.userName}>{emp.name}</p>
                              {emp.role === 'admin' && <Badge status="admin" />}
                            </div>
                            <p className={styles.userPhone}>{emp.phone || 'Sin teléfono'}</p>
                          </div>
                        </div>
                      </td>

                      <td data-label="Puesto">
                        <p className={styles.positionTitle}>{emp.position || 'Sin cargo'}</p>
                        <p className={styles.positionDept}>{emp.dept}</p>
                      </td>

                      <td data-label="Contacto">
                        <div className={styles.contactWrapper}>
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
                                className={clsx(styles.contactLink, isMe ? styles.contactLinkMe : styles.contactLinkOther)}
                              >
                                {emp.email}
                              </a>
                            ) : (
                              <span className={clsx(styles.contactEmailText, isMe ? styles.contactEmailMe : styles.contactEmailOther)}>
                                {emp.email}
                              </span>
                            );
                          })()}
                        </div>
                      </td>

                      <td data-label="Modalidad">
                        {(() => {
                          const mode = (emp.workMode || 'office').toLowerCase();
                          const isOffice = mode === 'office' || mode === 'oficina';
                          const isRemote = mode === 'remote' || mode === 'remoto';
                          
                          return (
                            <span className={clsx(styles.workModeBadge, isOffice ? styles.workModeOffice : isRemote ? styles.workModeRemote : styles.workModeExternal)}>
                              {isOffice ? 'OFICINA' : isRemote ? 'REMOTO' : 'EXTERNO'}
                            </span>
                          );
                        })()}
                      </td>

                      <td data-label="Acciones">
                        <div className={styles.actionsCell}>
                          <Button variant="action" iconOnly icon={Edit2} onClick={() => handleEdit(emp)} title="Editar empleado" />
                          <Button variant="action-danger" iconOnly icon={Trash2} onClick={() => handleDelete(emp.id)} title="Dar de baja" />
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
                  <div className={clsx(styles.resourceIcon, styles.iconAccent)}>
                    <Building size={22} />
                  </div>
                  <div className={clsx(styles.actionsCell, styles.actionsCellRight)}>
                    <Button variant="action" iconOnly icon={Edit2} onClick={() => {
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
                    }} title="Editar" />
                    <Button variant="action-danger" iconOnly icon={Trash2} onClick={() => {
                      setDeleteConfirm({
                        title: 'Eliminar sala',
                        message: '¿Estás seguro de que deseas eliminar esta sala? Esta acción no se puede deshacer.',
                        action: async () => {
                          const { error } = await supabase.from('rooms').delete().eq('id', room.id);
                          if (!error) refresh();
                        }
                      });
                    }} title="Eliminar" />
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
                  <div className={clsx(styles.resourceIcon, styles.iconWarning)}>
                    <Car size={22} />
                  </div>
                  <div className={clsx(styles.actionsCell, styles.actionsCellRight)}>
                    <Button variant="action" iconOnly icon={Edit2} onClick={() => {
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
                    }} title="Editar" />
                    <Button variant="action-danger" iconOnly icon={Trash2} onClick={() => {
                      setDeleteConfirm({
                        title: 'Eliminar vehículo',
                        message: '¿Estás seguro de que deseas eliminar este vehículo? Esta acción no se puede deshacer.',
                        action: async () => {
                          const { error } = await supabase.from('vehicles').delete().eq('id', v.id);
                          if (!error) refresh();
                        }
                      });
                    }} title="Eliminar" />
                  </div>
                </div>
                <h4 className={styles.resourceTitle}>{v.model}</h4>
                <p className={styles.resourceMeta}>Matrícula: <strong>{v.plate}</strong></p>
                <p className={clsx(styles.resourceMeta, styles.resourceMetaNoMargin)}>{v.type} · {v.year}</p>
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
          <Card className={styles.tableCard}>
            <div className={clsx(styles.tableHeaderSection, styles.tableHeaderPadding)}>
              <p className={styles.documentTableHeaderTitle}>
                Documentos enviados
              </p>
              <span className={styles.documentTableHeaderCount}>
                {(documents || []).filter(d => d.title !== '__ONBOARDING_DOC__').length} documento(s)
              </span>
            </div>
            {(!documents || documents.filter(d => d.title !== '__ONBOARDING_DOC__').length === 0) ? (
              <div className={styles.documentEmptyState}>
                <FileText size={40} strokeWidth={1} className={styles.emptyStateIcon} />
                <p className={styles.emptyStateText}>No se ha enviado ningún documento</p>
              </div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className="table">
                  <thead>
                    <tr>
                      {['Documento', 'Destinatario', 'Estado', 'Fecha', 'Acciones'].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(documents || []).filter(d => d.title !== '__ONBOARDING_DOC__').map(doc => {
                      const recipient = employees.find(e => String(e.id) === String(doc.recipientId));
                      const recipName   = recipient?.name   || doc.recipientName || '—';
                      const recipAvatar = recipient?.avatar  || recipName.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase();
                      return (
                        <tr key={doc.id}>
                          <td data-label="Documento">
                            <div className={styles.flexCenterGap10}>
                              <div className={styles.docIconWrapper}>
                                <FileText size={16} />
                              </div>
                              <div>
                                <p className={styles.docTitleText}>{doc.title}</p>
                                {doc.description && (
                                  <p className={styles.docDescText}>{doc.description}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td data-label="Destinatario">
                            <div className={styles.flexCenterGap8}>
                              <Avatar initials={recipAvatar} size={28} />
                              <div>
                                <span className={styles.recipName}>{recipName}</span>
                                {recipient?.dept && <span className={styles.recipDept}>{recipient.dept}</span>}
                              </div>
                            </div>
                          </td>
                          <td data-label="Estado">
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
                          <td data-label="Fecha" className={styles.docDate}>
                            {new Date(doc.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td data-label="Acciones">
                            <div className={styles.actionsCell}>
                              {doc.fileUrl && (
                                <Button
                                  variant="action-download" iconOnly icon={Download}
                                  href={doc.fileUrl}
                                  download={doc.title || "documento"}
                                  title="Descargar archivo"
                                />
                              )}
                              <Button
                                variant="action-danger" iconOnly icon={Trash2}
                                onClick={() => {
                                  setDeleteConfirm({
                                    title: 'Eliminar documento',
                                    message: '¿Estás seguro de que deseas eliminar este documento?',
                                    action: async () => {
                                      await deleteDocument(doc.id);
                                    }
                                  });
                                }}
                                title="Eliminar documento"
                              />
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
          <Card className={styles.tableCard}>
            {/* Filters */}
            <div className={styles.filtersHeader}>
              <div className={styles.filterField}>
                <label className={styles.filterLabel}>Empleado</label>
                <select
                  value={hoursFilterEmp}
                  onChange={e => setHoursFilterEmp(e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="">Todos</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className={styles.filterField}>
                <label className={styles.filterLabel}>Desde</label>
                <input type="date" value={hoursFilterFrom} onChange={e => setHoursFilterFrom(e.target.value)}
                  className={styles.filterDateInput} />
              </div>
              <div className={styles.filterField}>
                <label className={styles.filterLabel}>Hasta</label>
                <input type="date" value={hoursFilterTo} onChange={e => setHoursFilterTo(e.target.value)}
                  className={styles.filterDateInput} />
              </div>
              {(hoursFilterEmp || hoursFilterFrom || hoursFilterTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setHoursFilterEmp(''); setHoursFilterFrom(''); setHoursFilterTo(''); }}
                >
                  Limpiar
                </Button>
              )}
              <span className={styles.filterSummaryText}>
                {filteredHours.length} solicitud{filteredHours.length !== 1 ? 'es' : ''} &bull; {filteredHours.reduce((s, h) => s + (h.status === 'approved' ? h.hours : 0), 0).toFixed(1)}h aprobadas
              </span>
            </div>

            {filteredHours.length === 0 ? (
              <div className={styles.documentEmptyState}>
                <Timer size={40} strokeWidth={1} className={styles.emptyStateIcon} />
                <p className={styles.emptyStateText}>No hay solicitudes de bolsa con los filtros aplicados</p>
              </div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className="table">
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
                          <td data-label="Empleado">
                            <div className={styles.flexCenterGap8}>
                              <Avatar initials={empAvatar} size={30} />
                              <div>
                                <span className={styles.recipName}>{empName}</span>
                                {emp?.dept && <span className={styles.recipDept}>{emp.dept}</span>}
                              </div>
                            </div>
                          </td>
                          <td data-label="Fecha" className={styles.boldDateCell}>
                            {new Date(h.date + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td data-label="Motivo" className={styles.reasonCell}>
                            {h.reason}
                          </td>
                          <td data-label="Horas">
                            <span className={styles.hoursPill}>
                              {h.hours}h
                            </span>
                          </td>
                          <td data-label="Estado">
                            <span className={clsx(styles.docStatusBadge, {
                              [styles.statusPending]:   h.status === 'pending',
                              [styles.statusApproved]:  h.status === 'approved',
                              [styles.statusRejected]:  h.status === 'rejected',
                            })}>
                              {h.status === 'pending'  && <><Clock size={11} /> Pendiente</>}
                              {h.status === 'approved' && <><CheckCircle size={11} /> Aprobada</>}
                              {h.status === 'rejected' && <><X size={11} /> Rechazada</>}
                            </span>
                          </td>
                          <td data-label="Acciones">
                            <div className={styles.actionsCell}>
                              {h.status === 'pending' ? (
                                <>
                                  <Button
                                    variant="action-success" iconOnly icon={Check}
                                    onClick={() => updateHourCompensationStatus(h.id, 'approved', user?.id, h.employeeId)}
                                    title="Aprobar"
                                  />
                                  <Button
                                    variant="action-danger" iconOnly icon={X}
                                    onClick={() => updateHourCompensationStatus(h.id, 'rejected', user?.id, h.employeeId)}
                                    title="Rechazar"
                                  />
                                </>
                              ) : (
                                <span className={styles.reviewerNameText}>
                                  {h.reviewerName ? `por ${h.reviewerName}` : '—'}
                                </span>
                              )}
                              <Button
                                variant="action-danger" iconOnly icon={Trash2}
                                onClick={() => {
                                  setDeleteConfirm({
                                    title: 'Eliminar registro',
                                    message: '¿Estás seguro de que deseas eliminar este registro de horas extras?',
                                    action: async () => {
                                      await deleteHourCompensation(h.id);
                                    }
                                  });
                                }}
                                title="Eliminar registro"
                              />
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
              { value: 'Office', label: 'Oficina' },
              { value: 'remoto', label: 'Remoto' },
              { value: 'externo', label: 'Externo' }
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

      <ConfirmModal 
        isOpen={!!deleteConfirm} 
        onClose={() => setDeleteConfirm(null)} 
        onConfirm={async () => {
          if (deleteConfirm && deleteConfirm.action) {
            await deleteConfirm.action();
            setDeleteConfirm(null);
          }
        }} 
        title={deleteConfirm?.title || ''}
        message={deleteConfirm?.message || ''}
      />

      {/* Resources modal */}
      <Modal open={showResModal} onClose={() => { setShowResModal(false); setEditingRes(false); }} title={editingRes ? 'Editar' : 'Nuevo ' + (resType === 'room' ? 'sala' : 'vehículo')}>
        {resType === 'room' ? (
          <>
            <Input label="Nombre de la sala" value={resForm.name} onChange={v => setResForm({ ...resForm, name: v })} required />
            <div className={clsx(styles.modalGrid, styles.modalGridMarginTop)}>
              <Input label="Capacidad (personas)" value={resForm.capacity} onChange={v => setResForm({ ...resForm, capacity: v })} type="number" required />
              <Input label="Planta" value={resForm.floor} onChange={v => setResForm({ ...resForm, floor: v })} type="number" required />
            </div>
            <Input 
              label="Equipamiento (separado por comas)" 
              value={resForm.equipment} 
              onChange={v => setResForm({ ...resForm, equipment: v })} 
            />
          </>
        ) : (
          <>
            <Input label="Modelo del vehículo" value={resForm.model} onChange={v => setResForm({ ...resForm, model: v })} required />
            <Input label="Matrícula" value={resForm.plate} onChange={v => setResForm({ ...resForm, plate: v })} required />
            <div className={clsx(styles.modalGrid, styles.modalGridMarginTop)}>
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
            const equipmentArray = resForm.equipment ? resForm.equipment.split(',').map(item => item.trim()).filter(Boolean) : [];
            let err = null;
            if (resType === 'room') {
              if (editingRes && resForm.id) {
                // Update room
                const { error } = await supabase.from('rooms').update({ 
                  name: resForm.name, 
                  capacity: parseInt(resForm.capacity), 
                  floor: parseInt(resForm.floor), 
                  equipment: equipmentArray
                }).eq('id', resForm.id);
                err = error;
              } else {
                // Create room
                const { data, error } = await supabase.from('rooms').insert([{ 
                  name: resForm.name, 
                  capacity: parseInt(resForm.capacity), 
                  floor: parseInt(resForm.floor), 
                  equipment: equipmentArray 
                }]).select().single();
                err = error;
              }
              if (!err) refresh();
            } else {
              if (editingRes && resForm.id) {
                // Update vehicle
                const { error } = await supabase.from('vehicles').update({ 
                  model: resForm.model, 
                  plate: resForm.plate, 
                  year: parseInt(resForm.year) || null, 
                  type: resForm.type 
                }).eq('id', resForm.id);
                err = error;
              } else {
                // Create vehicle
                const { data, error } = await supabase.from('vehicles').insert([{ 
                  model: resForm.model, 
                  plate: resForm.plate, 
                  year: parseInt(resForm.year), 
                  type: resForm.type 
                }]).select().single();
                err = error;
              }
              if (!err) refresh();
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
        <div className={styles.modalFlexColGap18}>
          <Input
            label="Título del documento"
            value={docForm.title}
            onChange={v => setDocForm({ ...docForm, title: v })}
            required
          />
          <Input
            label="Descripción (opcional)"
            value={docForm.description}
            onChange={v => setDocForm({ ...docForm, description: v })}
          />

          {/* ── File Upload Zone ── */}
          <div>
            <label className={styles.uploadLabel}>
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
                accept="*/*"
                className={styles.hiddenInput}
                onChange={e => { if (e.target.files[0]) setDocFile(e.target.files[0]); }}
              />
              {docFile ? (
                <div className={styles.filePreview}>
                  <FileText size={22} className={styles.filePreviewIcon} />
                  <div className={styles.fileInfo}>
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
                  <Upload size={28} className={styles.uploadIcon} />
                  <p className={styles.filePromptTitle}>Arrastra un archivo aquí</p>
                  <p className={styles.filePromptSub}>o haz clic para seleccionar</p>
                  <p className={styles.filePromptDesc}>Cualquier formato de archivo permitido &bull; Sin límite de tamaño</p>
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
          <p className={clsx(styles.uploadStatusText, {
            [styles.statusTextDanger]: docUploadStatus.startsWith('❌') || docUploadStatus.startsWith('⚠️'),
            [styles.statusTextSuccess]: docUploadStatus.startsWith('✅'),
            [styles.statusTextNeutral]: !docUploadStatus.startsWith('❌') && !docUploadStatus.startsWith('⚠️') && !docUploadStatus.startsWith('✅')
          })}>
            {docUploadStatus}
          </p>
        )}
      </Modal>

      {/* Onboarding Modal */}
      <Modal open={showOnboardingModal} onClose={() => { setShowOnboardingModal(false); setOnboardingFile(null); setOnboardingUploadStatus(''); }} title="Actualizar Documento de Inicio">
        <div className={styles.onboardingContainer}>
          <p className={styles.onboardingInfo}>
            El documento que subas aquí será mostrado a los usuarios cuando inicien sesión por primera vez y deban aceptar las políticas de la empresa.
          </p>
          <div
            className={styles.onboardingDropzone}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'application/pdf';
              input.onchange = e => { if (e.target.files[0]) setOnboardingFile(e.target.files[0]); };
              input.click();
            }}
          >
            {onboardingFile ? (
              <div className={styles.onboardingFilePreview}>
                <FileText size={24} />
                <div className={styles.onboardingFileText}>
                  <p className={styles.onboardingFileName}>{onboardingFile.name}</p>
                  <p className={styles.onboardingFileSize}>{(onboardingFile.size / 1024).toFixed(0)} KB</p>
                </div>
              </div>
            ) : (
              <div>
                <Upload size={28} className={styles.onboardingUploadIcon} />
                <p className={styles.onboardingUploadPrompt}>Haz clic para seleccionar un PDF</p>
              </div>
            )}
          </div>
        </div>
        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={() => { setShowOnboardingModal(false); setOnboardingFile(null); setOnboardingUploadStatus(''); }}>Cancelar</Button>
          <Button icon={Upload} onClick={handleUpdateOnboarding} loading={onboardingUploading} disabled={!onboardingFile || onboardingUploading}>
            Actualizar Documento
          </Button>
        </div>
        {onboardingUploadStatus && (
          <p className={clsx(styles.onboardingStatusText, {
            [styles.statusTextDanger]: onboardingUploadStatus.startsWith('❌'),
            [styles.statusTextSuccess]: !onboardingUploadStatus.startsWith('❌')
          })}>
            {onboardingUploadStatus}
          </p>
        )}
      </Modal>
    </div>
  );
}
