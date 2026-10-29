import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { UsersRound, Building2, Home, MapPin, LayoutGrid, List, CalendarDays, Mail, Layers, ShieldCheck, UserRound, ArrowLeft } from 'lucide-react';
import { Avatar, Button } from '../components/ui';
import {
  DeskHeader, DeskLayout, DeskRail, DeskMetrics, DeskPanel, DeskSpotlight, DeskSearch, DeskSegmented,
  DeskTable, CellStack, StatusPill, DeskEmpty, ShowMore,
} from '../components/Desk';
import { TeamWeek } from '../components/TeamWeek';
import styles from './EmployeesDesk.module.scss';

export const WORK_MODES = {
  Office:  { label: 'Oficina', icon: Building2, tone: 'accent' },
  remoto:  { label: 'Remoto',  icon: Home,      tone: 'success' },
  externo: { label: 'Externo', icon: MapPin,    tone: 'warning' },
};
// Rows may carry older spellings (office, remote, field): one key per mode
const modeKey = (m) => {
  const v = String(m || 'Office').toLowerCase();
  if (v === 'remoto' || v === 'remote') return 'remoto';
  if (v === 'externo' || v === 'field') return 'externo';
  return 'Office';
};
const PAGE = 48;

/** Three named options; the one on is filled. Disabled when the person can't pick it (no approved request). */
function ModeChoice({ value, onChange, allowed, name, compact }) {
  return (
    <div className={compact ? styles.modesCompact : styles.modes} role="radiogroup" aria-label={`Modo de trabajo de ${name}`}>
      {Object.entries(WORK_MODES).map(([key, m]) => {
        const Icon = m.icon;
        const on = value === key;
        return (
          <button key={key} type="button" role="radio" aria-checked={on} data-tone={m.tone}
            className={on ? styles.modeOn : undefined}
            disabled={!on && !allowed(key)} onClick={() => onChange(key)}
            title={!on && !allowed(key) ? 'Necesitas una solicitud aprobada para este modo' : m.label}>
            <Icon size={14} aria-hidden="true" />
            <span>{m.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Equipo on a computer: departments as a side list, your own work mode on the brand panel (the
 * change people make every day), where everyone works today as figures that filter, and the
 * directory as cards, a table or the week. Filters combine: department, mode and search.
 */
export default function EmployeesDesk({ employees, user, query, setQuery, canSeeDni, modeAllowed, onModeChange, view, setView }) {
  const isAdmin = user?.role === 'admin';
  const [dept, setDept] = useState('all');
  const [mode, setMode] = useState('all');
  const [limit, setLimit] = useState(PAGE);

  const depts = useMemo(() => [...new Set(employees.map((e) => e.dept).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')), [employees]);
  const inDept = employees.filter((e) => dept === 'all' || e.dept === dept);
  const countMode = (k) => inDept.filter((e) => modeKey(e.workMode) === k).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('es');
    return inDept
      .filter((e) => mode === 'all' || modeKey(e.workMode) === mode)
      .filter((e) => !q || [e.name, e.dept, e.position, e.email].some((v) => (v || '').toLocaleLowerCase('es').includes(q)))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'));
  }, [inDept, mode, query]);

  const me = employees.find((e) => e.id === user?.id) || user;
  const toggleMode = (k) => { setMode((cur) => (cur === k ? 'all' : k)); setLimit(PAGE); };
  const clearFilters = () => { setDept('all'); setMode('all'); setQuery(''); };
  const canEdit = (emp) => isAdmin || user?.id === emp.id;

  return (
    <div className={styles.page}>
      <DeskHeader
        icon={UsersRound}
        title="Equipo"
        desc="Directorio del equipo y dónde trabaja cada persona, hoy y durante la semana."
      />

      <DeskLayout
        sideLabel="Tu modo de trabajo y departamentos"
        side={(
          <>
            {me && (
              <DeskSpotlight icon={modeKey(me.workMode) === 'Office' ? Building2 : modeKey(me.workMode) === 'remoto' ? Home : MapPin} label="Tú, hoy">
                <div className={styles.meHead}>
                  <Avatar initials={me.avatar} size={44} />
                  <span>
                    <strong>{me.name}</strong>
                    <small>{[me.position, me.dept].filter(Boolean).join(' · ')}</small>
                  </span>
                </div>
                <p className={styles.meLine}>Trabajas en <strong>{WORK_MODES[modeKey(me.workMode)].label.toLowerCase()}</strong>. Cámbialo si hoy es distinto.</p>
                <ModeChoice value={modeKey(me.workMode)} onChange={(k) => onModeChange(me.id, k)} allowed={(k) => modeAllowed(me, k)} name="ti" />
              </DeskSpotlight>
            )}

            <DeskRail title="Departamentos" asFilter value={dept} onChange={(v) => { setDept(v); setLimit(PAGE); }} items={[
              { value: 'all', label: 'Todo el equipo', icon: Layers, tone: 'neutral', count: employees.length },
              ...depts.map((d) => ({ value: d, label: d, count: employees.filter((e) => e.dept === d).length })),
            ]} />
          </>
        )}
      >
        <DeskMetrics label="Dónde trabaja hoy (pulsa para filtrar)" items={Object.entries(WORK_MODES).map(([k, m]) => ({
          label: k === 'Office' ? 'En oficina' : k === 'remoto' ? 'En remoto' : 'Trabajo externo',
          value: countMode(k),
          tone: m.tone,
          hint: k === 'Office' ? 'Presencial en sede' : k === 'remoto' ? 'Teletrabajo' : 'Clientes y ruta',
          onClick: () => toggleMode(k),
          active: mode === k,
        }))} />

        <DeskPanel flush
          title={dept === 'all' ? 'Directorio' : dept}
          sub={`${filtered.length} ${filtered.length === 1 ? 'persona' : 'personas'}${mode !== 'all' ? ` · ${WORK_MODES[mode].label.toLowerCase()}` : ''}`}
          tools={(
            <>
              <DeskSearch value={query} onChange={(v) => { setQuery(v); setLimit(PAGE); }} label="Buscar en el equipo" placeholder="Buscar por nombre, puesto, email o departamento" />
              <DeskSegmented label="Vista" value={view} onChange={setView} options={[
                { value: 'grid', icon: LayoutGrid, label: 'Tarjetas' },
                { value: 'list', icon: List, label: 'Tabla' },
                { value: 'week', icon: CalendarDays, label: 'Semana', title: 'Dónde trabaja cada persona cada día' },
              ]} />
            </>
          )}
        >
          {filtered.length === 0 ? (
            <DeskEmpty icon={UsersRound}
              title="Nadie con estos filtros"
              text={query ? `Nadie del equipo coincide con «${query}». Prueba con otro nombre o departamento.` : 'Cambia el departamento o el modo de trabajo.'}
              action={<Button variant="secondary" onClick={clearFilters}>Quitar filtros</Button>} />
          ) : view === 'week' ? (
            <div className={styles.weekWrap}><TeamWeek employees={filtered} isAdmin={isAdmin} /></div>
          ) : view === 'list' ? (
            <DeskTable label="Equipo" head={[
              { label: 'Persona' }, { label: 'Puesto' }, { label: 'Modo de trabajo hoy' }, { label: 'Rol' }, ...(isAdmin ? [{ label: 'DNI' }] : []),
            ]}>
              {filtered.slice(0, limit).map((emp) => (
                <tr key={emp.id}>
                  <td>
                    <CellStack lead={<Avatar initials={emp.avatar} size={34} />} title={<>{emp.name}{emp.id === user?.id && <em className={styles.you}> (tú)</em>}</>}
                      sub={emp.email ? <a className={styles.mail} href={`mailto:${emp.email}`}>{emp.email}</a> : null} />
                  </td>
                  <td><CellStack title={emp.position || 'Sin cargo'} sub={emp.dept} /></td>
                  <td>
                    {/* Your own mode is changed on the panel at the side */}
                    {canEdit(emp) && emp.id !== user?.id
                      ? <ModeChoice compact value={modeKey(emp.workMode)} onChange={(k) => onModeChange(emp.id, k)} allowed={(k) => modeAllowed(emp, k)} name={emp.name} />
                      : <StatusPill tone={WORK_MODES[modeKey(emp.workMode)].tone}>{WORK_MODES[modeKey(emp.workMode)].label}</StatusPill>}
                  </td>
                  <td>{emp.role === 'admin' ? <StatusPill tone="purple">Administración</StatusPill> : <span className={styles.muted}>Empleado</span>}</td>
                  {isAdmin && <td className={styles.muted}>{emp.phone || '—'}</td>}
                </tr>
              ))}
            </DeskTable>
          ) : (
            <ul className={styles.grid}>
              {filtered.slice(0, limit).map((emp) => {
                const m = WORK_MODES[modeKey(emp.workMode)];
                const isMe = emp.id === user?.id;
                return (
                  <li key={emp.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <Avatar initials={emp.avatar} size={52} />
                      <StatusPill tone={m.tone}>{m.label}</StatusPill>
                    </div>
                    <div className={styles.cardText}>
                      <h3>{emp.name}{isMe && <em className={styles.you}> (tú)</em>}</h3>
                      <p>{emp.position || 'Sin cargo'}</p>
                      <p className={styles.muted}>{emp.dept || 'Sin departamento'}</p>
                      {canSeeDni(emp) && <p className={styles.dni}>DNI {emp.phone || '—'}</p>}
                    </div>
                    {/* Pinned to the bottom, so the cards of a row line up */}
                    <div className={styles.cardFoot}>
                      <div className={styles.cardMeta}>
                        {isMe ? (
                          <Link className={styles.mailBtn} to="/profile"><UserRound size={14} aria-hidden="true" /> Mi perfil</Link>
                        ) : emp.email && (
                          <a className={styles.mailBtn} href={`mailto:${emp.email}`} aria-label={`Escribir a ${emp.name}`} title={emp.email}>
                            <Mail size={14} aria-hidden="true" /> Escribir
                          </a>
                        )}
                        {emp.role === 'admin' && <span className={styles.adminTag}><ShieldCheck size={13} aria-hidden="true" /> Administración</span>}
                      </div>
                      {/* Admins change the mode here; their own is changed on the panel at the side */}
                      {isAdmin && (isMe ? (
                        <div className={styles.modesCompact}>
                          <p className={styles.modeNote}><ArrowLeft size={14} aria-hidden="true" /> Tu modo se cambia en «Tú, hoy»</p>
                        </div>
                      ) : canEdit(emp) && (
                        <ModeChoice compact value={modeKey(emp.workMode)} onChange={(k) => onModeChange(emp.id, k)} allowed={(k) => modeAllowed(emp, k)} name={emp.name} />
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {view !== 'week' && <ShowMore shown={Math.min(limit, filtered.length)} total={filtered.length} onMore={() => setLimit((l) => l + PAGE)} noun="personas" />}
        </DeskPanel>
      </DeskLayout>
    </div>
  );
}
