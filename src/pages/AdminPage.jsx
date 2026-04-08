import { useState } from 'react';
import { useAuth } from '../context';
import { MOCK_ROOMS, MOCK_VEHICLES } from '../data/mockData';
import { Avatar, Badge, Modal, Input, Select, Button, Card } from '../components/ui';
import { Search, Plus, Edit2, Trash2, Eye, EyeOff, Building, Car } from 'lucide-react';
import styles from './AdminPage.module.scss';
import clsx from 'clsx';

export default function AdminPage() {
  const { employees, setEmployees } = useAuth();
  
  const [tab, setTab]             = useState('employees');
  const [showModal, setShowModal] = useState(false);
  const [editEmp, setEditEmp]     = useState(null);
  const [showPassFor, setShowPassFor] = useState(null);
  const [search, setSearch]       = useState('');
  const [rooms, setRooms]         = useState(MOCK_ROOMS);
  const [vehicles, setVehicles]   = useState(MOCK_VEHICLES);
  const [showResModal, setShowResModal] = useState(false);
  const [resType, setResType]     = useState('room');

  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'employee', dept: '', position: '', phone: '', birthdate: '' });
  const [resForm, setResForm] = useState({ name: '', capacity: '', floor: '', model: '', plate: '', year: '', type: 'Turismo' });

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase())
  );
  const depts = [...new Set(employees.map(e => e.dept))];

  const handleSaveEmployee = () => {
    if (!form.name || !form.email || !form.password) return;
    if (editEmp) {
      setEmployees(employees.map(e => e.id === editEmp.id ? { ...e, ...form } : e));
    } else {
      const avatar = form.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
      setEmployees([...employees, { id: Date.now(), ...form, avatar, joinDate: new Date().toISOString().split('T')[0], firstLogin: true }]);
    }
    setShowModal(false);
    setEditEmp(null);
    setForm({ name: '', email: '', password: '', role: 'employee', dept: '', position: '', phone: '', birthdate: '' });
  };

  const handleEdit = emp => { 
    setEditEmp(emp); 
    setForm({ name: emp.name, email: emp.email, password: emp.password, role: emp.role, dept: emp.dept, position: emp.position, phone: emp.phone, birthdate: emp.birthdate }); 
    setShowModal(true); 
  };
  
  const handleDelete = id => setEmployees(employees.filter(e => e.id !== id));

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
      {/* Tabs */}
      <div className={styles.tabs}>
        {tabBtn('employees', 'Empleados / Usuarios')}
        {tabBtn('rooms', 'Salas')}
        {tabBtn('vehicles', 'Vehículos')}
      </div>

      {/* ── EMPLOYEES ── */}
      {tab === 'employees' && (
        <>
          <div className={styles.actionsBar}>
            <div className={styles.searchWrapper}>
              <Search className={styles.searchIcon} size={16} />
              <input 
                className={styles.searchInput}
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                placeholder="Buscar empleado..."
              />
            </div>
            <Button 
              icon={Plus} 
              onClick={() => { 
                setEditEmp(null); 
                setForm({ name: '', email: '', password: '', role: 'employee', dept: '', position: '', phone: '', birthdate: '' }); 
                setShowModal(true); 
              }}
            >
              Nuevo empleado
            </Button>
          </div>

          <div className={styles.deptStats}>
            {depts.map(d => (
              <div key={d} className={styles.deptBadge}>
                <span>{d}</span>
                <span>{employees.filter(e => e.dept === d).length}</span>
              </div>
            ))}
          </div>

          <Card>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {['Empleado', 'Departamento', 'Cargo', 'Email', 'Contraseña', 'Rol', 'Estado', 'Acciones'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(emp => (
                    <tr key={emp.id}>
                      <td>
                        <div className={styles.userCell}>
                          <Avatar initials={emp.avatar} size={36} />
                          <div>
                            <p className={styles.userName}>{emp.name}</p>
                            <p className={styles.userPhone}>{emp.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-sec)' }}>{emp.dept}</td>
                      <td style={{ color: 'var(--text-sec)' }}>{emp.position}</td>
                      <td style={{ color: 'var(--text-sec)' }}>{emp.email}</td>
                      <td>
                        <div className={styles.passWrapper}>
                          <span className={styles.passText}>
                            {showPassFor === emp.id ? emp.password : '••••••••••'}
                          </span>
                          <button 
                            className={styles.iconBtn}
                            onClick={() => setShowPassFor(showPassFor === emp.id ? null : emp.id)}
                          >
                            {showPassFor === emp.id ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </td>
                      <td><Badge status={emp.role} /></td>
                      <td>
                        <Badge 
                          status="neutral" 
                          label={emp.firstLogin ? '1er acceso' : 'Activo'} 
                          className={emp.firstLogin ? 'variant-warning' : 'variant-success'}
                        />
                      </td>
                      <td>
                        <div className={styles.actionsCell}>
                          <button className={clsx(styles.actionBtn, styles.edit)} onClick={() => handleEdit(emp)}>
                            <Edit2 size={14} />
                          </button>
                          <button className={clsx(styles.actionBtn, styles.delete)} onClick={() => handleDelete(emp.id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ── ROOMS ── */}
      {tab === 'rooms' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <Button icon={Plus} onClick={() => { setResType('room'); setResForm({ name: '', capacity: '', floor: '' }); setShowResModal(true); }}>
              Nueva sala
            </Button>
          </div>
          <div className={styles.grid}>
            {rooms.map(room => (
              <Card key={room.id} className={styles.resourceCard}>
                <div className={styles.resourceHeader}>
                  <div className={styles.resourceIcon} style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                    <Building size={22} />
                  </div>
                  <button className={clsx(styles.actionBtn, styles.delete)} onClick={() => setRooms(rooms.filter(r => r.id !== room.id))}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <h4 className={styles.resourceTitle}>{room.name}</h4>
                <p className={styles.resourceMeta}>Planta {room.floor} · Capacidad: {room.capacity} personas</p>
                <div className={styles.tagList}>
                  {room.equipment.map(eq => <span key={eq} className={styles.tag}>{eq}</span>)}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ── VEHICLES ── */}
      {tab === 'vehicles' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <Button icon={Plus} onClick={() => { setResType('vehicle'); setResForm({ model: '', plate: '', year: '', type: 'Turismo' }); setShowResModal(true); }}>
              Nuevo vehículo
            </Button>
          </div>
          <div className={styles.grid}>
            {vehicles.map(v => (
              <Card key={v.id} className={styles.resourceCard}>
                <div className={styles.resourceHeader}>
                  <div className={styles.resourceIcon} style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                    <Car size={22} />
                  </div>
                  <button className={clsx(styles.actionBtn, styles.delete)} onClick={() => setVehicles(vehicles.filter(vh => vh.id !== v.id))}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <h4 className={styles.resourceTitle}>{v.model}</h4>
                <p className={styles.resourceMeta}>Matrícula: <strong>{v.plate}</strong></p>
                <p className={styles.resourceMeta} style={{ margin: 0 }}>{v.type} · {v.year}</p>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Employee modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setEditEmp(null); }} title={editEmp ? 'Editar empleado' : 'Nuevo empleado'}>
        <div className={styles.modalGrid}>
          <div className={styles.fullWidth}>
            <Input label="Nombre completo" value={form.name} onChange={v => setForm({ ...form, name: v })} required />
          </div>
          <Input label="Email corporativo" value={form.email} onChange={v => setForm({ ...form, email: v })} type="email" required />
          <Input label="Contraseña inicial" value={form.password} onChange={v => setForm({ ...form, password: v })} required />
          <Input label="Departamento" value={form.dept} onChange={v => setForm({ ...form, dept: v })} />
          <Input label="Cargo / Posición" value={form.position} onChange={v => setForm({ ...form, position: v })} />
          <Input label="Teléfono" value={form.phone} onChange={v => setForm({ ...form, phone: v })} />
          <Input label="Fecha nacimiento" value={form.birthdate} onChange={v => setForm({ ...form, birthdate: v })} type="date" />
          <div className={styles.fullWidth}>
            <Select 
              label="Rol" 
              value={form.role} 
              onChange={v => setForm({ ...form, role: v })}
              options={[{ value: 'employee', label: 'Empleado' }, { value: 'admin', label: 'Administrador' }]} 
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
      <Modal open={showResModal} onClose={() => setShowResModal(false)} title={resType === 'room' ? 'Nueva sala' : 'Nuevo vehículo'}>
        {resType === 'room' ? (
          <>
            <Input label="Nombre de la sala" value={resForm.name} onChange={v => setResForm({ ...resForm, name: v })} required />
            <div className={styles.modalGrid} style={{ marginTop: 16 }}>
              <Input label="Capacidad (personas)" value={resForm.capacity} onChange={v => setResForm({ ...resForm, capacity: v })} type="number" required />
              <Input label="Planta" value={resForm.floor} onChange={v => setResForm({ ...resForm, floor: v })} type="number" required />
            </div>
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
          <Button onClick={() => {
            if (resType === 'room') {
              setRooms([...rooms, { id: Date.now(), name: resForm.name, capacity: parseInt(resForm.capacity), floor: parseInt(resForm.floor), equipment: [] }]);
            } else {
              setVehicles([...vehicles, { id: Date.now(), model: resForm.model, plate: resForm.plate, year: parseInt(resForm.year), type: resForm.type }]);
            }
            setShowResModal(false);
          }}>Crear</Button>
        </div>
      </Modal>
    </div>
  );
}
