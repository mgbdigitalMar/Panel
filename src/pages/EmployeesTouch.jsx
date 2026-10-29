import { useMemo, useState } from 'react';
import { Home, Building2, MapPin, Search, CalendarDays, UsersRound, Mail, BookUser } from 'lucide-react';
import { Avatar } from '../components/ui';
import { TeamWeek } from '../components/TeamWeek';
import { Masthead, Ledger, TabStrip, Toolbar, FeedGroup, FeedItem, ItemAction, TouchEmpty, TouchButton } from '../components/Touch';
import styles from './EmployeesTouch.module.scss';

const MODES = {
  Office:  { label: 'Oficina', icon: Building2, tone: 'accent' },
  remoto:  { label: 'Remoto',  icon: Home,      tone: 'success' },
  externo: { label: 'Externo', icon: MapPin,    tone: 'warning' },
};
const modeOf = (e) => {
  const m = (e.workMode || 'Office').toLowerCase();
  return m === 'remoto' ? 'remoto' : m === 'externo' || m === 'field' ? 'externo' : 'Office';
};

/**
 * Equipo on phones and tablets: where people work today as figures that filter, a search with the
 * department and mode filters, and the directory by department — each person opens with their details,
 * a mail link and (for themselves or admins) the work mode. "Semana" shows the team week.
 * The data and the mode change come from EmployeesPage.
 */
export default function EmployeesTouch({ employees, user, query, setQuery, canSeeDni, modeAllowed, onModeChange, initialView }) {
  const isAdmin = user.role === 'admin';
  const [view, setView] = useState(initialView === 'week' ? 'week' : 'people');
  const [dept, setDept] = useState('all');
  const [mode, setMode] = useState('all');

  const depts = useMemo(() => [...new Set(employees.map((e) => e.dept).filter(Boolean))], [employees]);
  const count = (m) => employees.filter((e) => modeOf(e) === m).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('es');
    return employees
      .filter((e) => (dept === 'all' || e.dept === dept) && (mode === 'all' || modeOf(e) === mode)
        && (!q || [e.name, e.dept, e.position, e.email].some((v) => (v || '').toLocaleLowerCase('es').includes(q))))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'));
  }, [employees, dept, mode, query]);

  // The directory by department, each one in alphabetical order
  const byDept = useMemo(() => {
    const map = new Map();
    filtered.forEach((e) => {
      const key = e.dept || 'Sin departamento';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'es')).map(([name, rows]) => ({ name, rows }));
  }, [filtered]);

  const toggleMode = (m) => setMode((cur) => (cur === m ? 'all' : m));
  const clear = () => { setDept('all'); setMode('all'); setQuery(''); };

  return (
    <>
      <Masthead
        icon={UsersRound}
        eyebrow="Equipo"
        title="Equipo"
        desc="Quién es quién en Margube y dónde trabaja cada persona, hoy y durante la semana."
        aside={(
          <Ledger label="Dónde trabaja hoy el equipo" items={Object.entries(MODES).map(([key, m]) => ({
            label: m.label, value: count(key), tone: count(key) ? m.tone : undefined,
            hint: key === 'Office' ? 'en sede' : key === 'remoto' ? 'teletrabajo' : 'fuera',
            onClick: () => { setView('people'); toggleMode(key); }, active: mode === key, toggle: true,
          }))} />
        )}
      />

      <div className={styles.body}>
        <TabStrip label="Vista" value={view} onChange={setView} options={[
          { value: 'people', label: 'Directorio', icon: BookUser, count: filtered.length },
          { value: 'week', label: 'Semana', icon: CalendarDays },
        ]} />

        <Toolbar
          search={{ label: 'Buscar en el equipo', icon: Search, value: query, onChange: setQuery, placeholder: 'Nombre, puesto o departamento' }}
          groups={[
            { id: 'dept', label: 'Departamento', value: dept, all: 'all', onChange: setDept, options: [
              { value: 'all', label: 'Todos', count: employees.length },
              ...depts.map((d) => ({ value: d, label: d, count: employees.filter((e) => e.dept === d).length })),
            ] },
            { id: 'mode', label: 'Modo de trabajo', value: mode, all: 'all', onChange: setMode, options: [
              { value: 'all', label: 'Todos' }, ...Object.entries(MODES).map(([value, m]) => ({ value, label: m.label, count: count(value) })),
            ] },
          ]}
        />

        {filtered.length === 0 ? (
          <TouchEmpty icon={Search} title="Nadie coincide"
            text={query ? `Nadie del equipo coincide con «${query.trim()}». Prueba con otro nombre o departamento.` : 'No hay personas con estos filtros.'}
            action={<TouchButton onClick={clear}>Quitar filtros</TouchButton>} />
        ) : view === 'week' ? (
          <TeamWeek employees={filtered} isAdmin={isAdmin} />
        ) : byDept.map((g) => (
          <FeedGroup key={g.name} title={g.name} meta={`${g.rows.length} ${g.rows.length === 1 ? 'persona' : 'personas'}`}>
            {g.rows.map((emp) => {
              const m = MODES[modeOf(emp)];
              const canEdit = isAdmin || user.id === emp.id;
              return (
                <FeedItem key={emp.id}
                  lead={<Avatar initials={emp.avatar} src={emp.avatarUrl} size={42} />}
                  title={emp.id === user.id ? `${emp.name} (tú)` : emp.name}
                  meta={emp.position || emp.email}
                  status={{ tone: m.tone, text: m.label }}
                  details={[
                    { label: 'Puesto', value: emp.position || '—' },
                    { label: 'Departamento', value: emp.dept || '—' },
                    { label: 'Email', value: emp.email, wide: true },
                    { label: 'Rol', value: emp.role === 'admin' ? 'Administración' : 'Empleado' },
                    canSeeDni(emp) ? { label: 'DNI', value: emp.phone || '—' } : null,
                  ]}
                  actions={(
                    <>
                      {emp.email && emp.id !== user.id && <ItemAction icon={Mail} tone="accent" href={`mailto:${emp.email}`}>Escribir</ItemAction>}
                      {canEdit && Object.entries(MODES).map(([key, meta]) => (
                        <ItemAction key={key} icon={meta.icon} tone={meta.tone} pressed={modeOf(emp) === key}
                          disabled={modeOf(emp) !== key && !modeAllowed(emp, key)}
                          title={modeOf(emp) !== key && !modeAllowed(emp, key) ? 'Necesitas una solicitud aprobada para hoy' : `Cambiar a ${meta.label}`}
                          onClick={() => onModeChange(emp.id, key)}>
                          {meta.label}
                        </ItemAction>
                      ))}
                    </>
                  )}
                />
              );
            })}
          </FeedGroup>
        ))}
      </div>
    </>
  );
}
