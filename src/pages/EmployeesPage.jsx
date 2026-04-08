import { useState } from 'react';
import { useAuth } from '../context';
import { Avatar, Badge, Card } from '../components/ui';
import { Home, Building2, MapPin } from 'lucide-react';
import styles from './EmployeesPage.module.scss';
import clsx from 'clsx';
import { supabase } from '../utils/supabase';

const WORK_MODES = {
  office: { label: 'Oficina',   icon: Building2, color: 'var(--accent)',  bg: 'var(--accent-bg)'  },
  remote: { label: 'Remoto',    icon: Home,       color: 'var(--success)', bg: 'var(--success-bg)' },
  field:  { label: 'Externo',   icon: MapPin,     color: 'var(--warning)', bg: 'var(--warning-bg)' },
};

function WorkModeBadge({ mode }) {
  const m = WORK_MODES[mode] || WORK_MODES.office;
  const Icon = m.icon;
  return (
    <span className={styles.workBadge} style={{ background: m.bg, color: m.color }}>
      <Icon size={12} />
      {m.label}
    </span>
  );
}

export default function EmployeesPage() {
  const { user, employees, setEmployees } = useAuth();
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('grid');

  const depts = ['all', ...new Set(employees.map(e => e.dept))];

  const filtered = employees.filter(e =>
    filter === 'all' ? true : e.dept === filter
  );

  const handleWorkModeChange = async (empId, mode) => {
    // Optimistic local update
    setEmployees(employees.map(e => e.id === empId ? { ...e, workMode: mode } : e));
    // Persist to Supabase
    await supabase.from('profiles').update({ work_mode: mode }).eq('id', empId);
  };

  const summary = Object.entries(WORK_MODES).map(([key, meta]) => ({
    key, ...meta,
    count: employees.filter(e => e.workMode === key).length,
  }));

  return (
    <div className={styles.container}>
      {/* Summary row */}
      <div className={styles.summaryRow}>
        {summary.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.key} className={styles.summaryCard} style={{ '--c': s.color, '--cbg': s.bg }}>
              <div className={styles.summaryIcon}><Icon size={18} /></div>
              <div>
                <p className={styles.summaryCount}>{s.count}</p>
                <p className={styles.summaryLabel}>{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters + view toggle */}
      <div className={styles.toolbar}>
        <div className={styles.deptTabs}>
          {depts.map(d => (
            <button
              key={d}
              onClick={() => setFilter(d)}
              className={clsx(styles.deptTab, { [styles.deptTabActive]: filter === d })}
            >
              {d === 'all' ? 'Todos' : d}
              <span className={styles.deptCount}>
                {d === 'all' ? employees.length : employees.filter(e => e.dept === d).length}
              </span>
            </button>
          ))}
        </div>
        <div className={styles.viewToggle}>
          <button onClick={() => setView('grid')} className={clsx(styles.viewBtn, { [styles.viewBtnActive]: view === 'grid' })}>⊞</button>
          <button onClick={() => setView('list')} className={clsx(styles.viewBtn, { [styles.viewBtnActive]: view === 'list' })}>☰</button>
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
                  <span className={styles.metaItem}>{emp.phone}</span>
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
            <table className={styles.table}>
              <thead>
                <tr>
                  {['Empleado', 'Departamento', 'Cargo', 'Modo trabajo', 'Rol', 'Teléfono'].map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map(emp => {
                  const canEdit = user.role === 'admin' || user.id === emp.id;
                  return (
                    <tr key={emp.id}>
                      <td>
                        <div className={styles.tableUser}>
                          <Avatar initials={emp.avatar} size={32} />
                          <span className={styles.tableUserName}>{emp.name}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-sec)' }}>{emp.dept}</td>
                      <td style={{ color: 'var(--text-sec)' }}>{emp.position}</td>
                      <td>
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
                      <td><Badge status={emp.role} /></td>
                      <td style={{ color: 'var(--text-mut)', fontSize: 13 }}>{emp.phone}</td>
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
