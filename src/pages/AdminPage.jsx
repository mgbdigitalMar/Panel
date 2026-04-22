import { useState, useEffect } from 'react';
import { useAuth, useData } from '../context';
import { MOCK_ROOMS, MOCK_VEHICLES } from '../data/mockData';
import { Avatar, Badge, Modal, Input, Select, Button, Card } from '../components/ui';
import { Search, Plus, Edit2, Trash2, Eye, EyeOff, Building, Car } from 'lucide-react';
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
  
  const [tab, setTab]             = useState('employees');
  const [showModal, setShowModal] = useState(false);
  const [editEmp, setEditEmp]     = useState(null);
  const [showPassFor, setShowPassFor] = useState(null);
  const [search, setSearch]       = useState('');
  const { rooms, vehicles, refresh } = useData();
  const [showResModal, setShowResModal] = useState(false);
  const [resType, setResType]     = useState('room');

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

  return (
    <div className={styles.container}>
      {/* Page Controls */}
      <div className={styles.pageControls}>
        <div className={styles.tabsRow}>
          {tabBtn('employees', 'Empleados / Usuarios')}
          {tabBtn('rooms', 'Salas')}
          {tabBtn('vehicles', 'Vehículos')}
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
    </div>
  );
}
