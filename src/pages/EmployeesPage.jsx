import { useState, useMemo } from 'react';
import { useAuth } from '../context';
import { Avatar, Badge, Card, StatCard } from '../components/ui';
import { Home, Building2, MapPin, LayoutGrid, List } from 'lucide-react';
import styles from './EmployeesPage.module.scss';
import clsx from 'clsx';
import { supabase } from '../utils/supabase';

const WORK_MODES = {
  Office: { label: 'Oficina',   icon: Building2, color: 'var(--accent)',  bg: 'var(--accent-bg)'  },
  remoto: { label: 'Remoto',    icon: Home,       color: 'var(--success)', bg: 'var(--success-bg)' },
  externo:  { label: 'Externo',   icon: MapPin,     color: 'var(--warning)', bg: 'var(--warning-bg)' },
};

function WorkModeBadge({ mode }) {
  const safeMode = mode || 'Office';
  const m = WORK_MODES[safeMode] || WORK_MODES.Office;
  const Icon = m.icon;
  return (
    <span className={styles.workBadge} style={{ background: m.bg, color: m.color }}>
      <Icon size={12} />
      {m.label}
    </span>
  );
}

export default function EmployeesPage() {
  const { user, employees, setEmployees, setCurrentUser } = useAuth();
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('grid');

  const depts = useMemo(() => ['all', ...new Set(employees.map(e => e.dept))], [employees]);

  const filtered = useMemo(() => employees.filter(e =>
    filter === 'all' ? true : e.dept === filter
  ), [employees, filter]);

  const handleWorkModeChange = async (empId, mode) => {
    try {
      // Optimistic local update
      setEmployees(employees.map(e => e.id === empId ? { ...e, workMode: mode } : e));
      if (empId === user?.id) {
        await setCurrentUser({ id: empId, workMode: mode });
      } else {
        // Persist to Supabase with confirmation
        const { error } = await supabase
          .from('profiles')
          .update({ work_mode: mode })
          .eq('id', empId);
        if (error) throw error;
      }
      console.log('Work mode updated successfully');
    } catch (err) {
      console.error('Failed to update work_mode:', err);
      // Revert on error
      setEmployees(prev => prev.map(e => e.id === empId ? { ...e, workMode: 'Office' } : e));
      alert(`Error: ${err.message}`);
    }
  };

  const officeCount = useMemo(() => employees.filter(e => (e.workMode || 'office').toLowerCase() === 'office').length, [employees]);
  const remoteCount = useMemo(() => employees.filter(e => (e.workMode || '').toLowerCase() === 'remoto').length, [employees]);
  const fieldCount  = useMemo(() => employees.filter(e => (e.workMode || '').toLowerCase() === 'externo' || (e.workMode || '').toLowerCase() === 'field').length, [employees]);

  return (
    <div className={styles.container}>
      {/* Stats */}
      <div className={styles.statsGrid}>
        <StatCard
          label="En oficina"
          value={officeCount}
          icon="Building"
          color="var(--accent)"
          sub="Presencial en sede"
        />
        <StatCard
          label="En remoto"
          value={remoteCount}
          icon="Home"
          color="var(--success)"
          sub="Teletrabajo activo"
        />
        <StatCard
          label="Trabajo externo"
          value={fieldCount}
          icon="MapPin"
          color="var(--warning)"
          sub="Clientes y ruta"
        />
      </div>

      {/* Filters + view toggle */}
      <div className={styles.pageControls}>
        <div className={styles.tabsRow}>
          {depts.map(d => (
            <button
              key={d}
              onClick={() => setFilter(d)}
              className={clsx(styles.tabBtn, { [styles.tabBtnActive]: filter === d })}
            >
              {d === 'all' ? 'Todos' : d}
              <span className={styles.tabCount}>
                {d === 'all' ? employees.length : employees.filter(e => e.dept === d).length}
              </span>
            </button>
          ))}
        </div>
        <div className={styles.controlsRight}>
          <div className={styles.viewToggle}>
            <button
              onClick={() => setView('grid')}
              className={clsx(styles.viewBtn, { [styles.viewBtnActive]: view === 'grid' })}
              title="Vista cuadrícula"
              aria-label="Vista cuadrícula"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setView('list')}
              className={clsx(styles.viewBtn, { [styles.viewBtnActive]: view === 'list' })}
              title="Vista tabla"
              aria-label="Vista tabla"
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Grid view */}
      {view === 'grid' && (
        <div className={styles.grid}>
          {filtered.map(emp => {
            const canEdit = user.role === 'admin' || user.id === emp.id;
            return (
              <Card key={emp.id} className={styles.empCard}>
                <div className={styles.cardTop}>
                  <Avatar initials={emp.avatar} size={52} />
                  <WorkModeBadge mode={emp.workMode} />
                </div>
                <div className={styles.empInfo}>
                  <h3 className={styles.empName}>{emp.name}</h3>
                  <p className={styles.empPosition}>{emp.position}</p>
                  <p className={styles.empDept}>{emp.dept}</p>
                </div>
                <div className={styles.empMeta}>
                <span className={styles.metaItem}>{emp.phone || '---'}</span>
                  <Badge status={emp.role} />
                </div>
                {canEdit && (
                  <div className={styles.modeSelector}>
                    {Object.entries(WORK_MODES).map(([key, meta]) => {
                      const Icon = meta.icon;
                      return (
                        <button
                          key={key}
                          onClick={() => handleWorkModeChange(emp.id, key)}
                          className={clsx(styles.modeBtn, { [styles.modeBtnActive]: emp.workMode === key })}
                          style={emp.workMode === key ? { background: meta.bg, color: meta.color, borderColor: meta.color } : {}}
                          title={meta.label}
                        >
                          <Icon size={14} />
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* List view */}
      {view === 'list' && (
        <Card>
          <div className={styles.tableWrap}>
            <table className="table">
              <thead>
                <tr>
                {['Empleado', 'Departamento', 'Cargo', 'Modo trabajo', 'Rol', 'DNI'].map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map(emp => {
                  const canEdit = user.role === 'admin' || user.id === emp.id;
                  return (
                    <tr key={emp.id}>
                      <td data-label="Empleado">
                        <div className={styles.tableUser}>
                          <Avatar initials={emp.avatar} size={32} />
                          <span className={styles.tableUserName}>{emp.name}</span>
                        </div>
                      </td>
                      <td data-label="Departamento" style={{ color: 'var(--text-sec)' }}>{emp.dept}</td>
                      <td data-label="Cargo" style={{ color: 'var(--text-sec)' }}>{emp.position}</td>
                      <td data-label="Modo trabajo">
                        {canEdit ? (
                          <select
                            value={emp.workMode}
                            onChange={e => handleWorkModeChange(emp.id, e.target.value)}
                            className={styles.modeSelect}
                          >
                            {Object.entries(WORK_MODES).map(([k, m]) => (
                              <option key={k} value={k}>{m.label}</option>
                            ))}
                          </select>
                        ) : (
                          <WorkModeBadge mode={emp.workMode} />
                        )}
                      </td>
                      <td data-label="Rol"><Badge status={emp.role} /></td>
                      <td data-label="DNI" style={{ color: 'var(--text-mut)', fontSize: 13 }}>{emp.phone || '---'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
