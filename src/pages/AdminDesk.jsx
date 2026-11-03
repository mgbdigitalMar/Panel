import { useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  UsersRound, Building, Car, FileText, Timer, Plus, Send, Upload, Download, Pencil, Trash2,
  Check, X, Clock, PenLine, ClipboardCheck, KeyRound, Layers, ShieldCheck
} from 'lucide-react';
import { Avatar, Button } from '../components/ui';
import {
  DeskHeader, DeskTabs, DeskMetrics, DeskPanel, DeskSearch, DeskSelect,
  DeskTable, CellStack, TypeTile, StatusPill, RowAction, RowActions, DeskEmpty, ShowMore, optionalCol,
} from '../components/Desk';
import { policyStatus, formatSignedAt } from '../../shared/services/policy.js';
import { TELEWORK_WEEKDAYS } from '../../shared/services/workMode.js';
import { fmtDate, plural } from '../utils/format';
import styles from './AdminDesk.module.scss';

const PAGE = 50;
const MODE = {
  office:  { label: 'Oficina', tone: 'accent' },
  remoto:  { label: 'Remoto',  tone: 'success' },
  externo: { label: 'Externo', tone: 'warning' },
};
// Rows may carry older spellings (Office, remote, field): one key per mode
const modeKey = (m) => {
  const v = String(m || 'office').toLowerCase();
  if (v === 'remoto' || v === 'remote') return 'remoto';
  if (v === 'externo' || v === 'field') return 'externo';
  return 'office';
};
const POLICY = {
  signed:  { tone: 'success', icon: PenLine, label: 'Firmadas' },
  manual:  { tone: 'accent',  icon: Check,   label: 'Sin firma' },
  pending: { tone: 'warning', icon: Clock,   label: 'Pendiente' },
};
const DOC = {
  pending:   { tone: 'warning', label: 'Pendiente' },
  signed:    { tone: 'success', label: 'Firmado' },
  completed: { tone: 'success', label: 'Completado' },
};
const HOURS = {
  pending:  { tone: 'warning', label: 'Pendiente' },
  approved: { tone: 'success', label: 'Aprobada' },
  rejected: { tone: 'danger',  label: 'Rechazada' },
};
const isFirstAccess = (e) => e.firstLogin === true || e.firstLogin === 'true';
const initialsOf = (name) => (name || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
const fold = (v) => String(v || '').toLocaleLowerCase('es');

/**
 * Administración on a computer, in the same composition as the other sections: the five areas as
 * a side list with what waits for RRHH on the brand panel, each area's figures as filters, and one
 * table per area with its search and row actions. The data, the saves, the forms and the
 * confirmations stay in AdminPage (shared with AdminTouch on phones and tablets).
 */
export default function AdminDesk({
  tab, setTab, user, employees, rooms, vehicles, documents, hours, lastSignature, policyCounts, signaturesFailed,
  onNewEmployee, onEditEmployee, onDeleteEmployee, onResetPassword, onOpenPolicy, onExportSignatures,
  onNewResource, onEditResource, onDeleteResource,
  onSendDocument, onUpdateOnboarding, onDeleteDocument,
  onApproveHours, onRejectHours, onDeleteHours, onExportHours, hoursBusy,
}) {
  const pendingHours = hours.filter((h) => h.status === 'pending').length;
  const firstAccess = employees.filter(isFirstAccess).length;

  // Employees: department, rules and access filters, search
  const [query, setQuery] = useState('');
  const [dept, setDept] = useState('all');
  const [policy, setPolicy] = useState('all');
  const [limit, setLimit] = useState(PAGE);
  // Documents and hours
  const [docStatus, setDocStatus] = useState('all');
  const [hoursStatus, setHoursStatus] = useState('all');
  const [hoursEmp, setHoursEmp] = useState('');
  const [hoursFrom, setHoursFrom] = useState('');
  const [hoursTo, setHoursTo] = useState('');

  const depts = useMemo(() => [...new Set(employees.map((e) => e.dept).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')), [employees]);
  const statusOf = (e) => policyStatus(e, lastSignature[e.id]);

  const people = useMemo(() => {
    const q = fold(query.trim());
    return employees
      .filter((e) => dept === 'all' || e.dept === dept)
      .filter((e) => policy === 'all' || (policy === 'first' ? isFirstAccess(e) : statusOf(e) === policy))
      .filter((e) => !q || [e.name, e.email, e.position, e.dept].some((v) => fold(v).includes(q)))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'));
    // statusOf reads lastSignature
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees, dept, policy, query, lastSignature]);

  const docs = documents.filter((d) => docStatus === 'all' || d.status === docStatus);
  const hourRows = hours
    .filter((h) => hoursStatus === 'all' || h.status === hoursStatus)
    .filter((h) => !hoursEmp || String(h.employeeId) === String(hoursEmp))
    .filter((h) => !hoursFrom || h.date >= hoursFrom)
    .filter((h) => !hoursTo || h.date <= hoursTo)
    // What waits for a decision first, then the newest
    .sort((a, b) => (b.status === 'pending') - (a.status === 'pending') || String(b.date).localeCompare(String(a.date)));
  const hoursFiltering = hoursStatus !== 'all' || hoursEmp || hoursFrom || hoursTo;
  const approvedHours = hourRows.reduce((s, h) => s + (h.status === 'approved' ? Number(h.hours) || 0 : 0), 0);

  const toggle = (set, cur, v) => set(cur === v ? 'all' : v);
  const goTodo = (go, filter) => { setTab(go); if (filter) { setPolicy(filter); setLimit(PAGE); } };
  const clearPeople = () => { setQuery(''); setDept('all'); setPolicy('all'); };
  const clearHours = () => { setHoursStatus('all'); setHoursEmp(''); setHoursFrom(''); setHoursTo(''); };
  const personOf = (id, fallback) => {
    const emp = employees.find((e) => String(e.id) === String(id));
    const name = emp?.name || fallback || '—';
    return { name, avatar: emp?.avatar || initialsOf(name), dept: emp?.dept };
  };

  const actions = {
    employees: (
      <>
        <Button variant="ghost" icon={Download} onClick={onExportSignatures} disabled={signaturesFailed}>Registro de firmas</Button>
        <Button icon={Plus} onClick={onNewEmployee}>Nuevo empleado</Button>
      </>
    ),
    rooms: <Button icon={Plus} onClick={() => onNewResource('room')}>Nueva sala</Button>,
    vehicles: <Button icon={Plus} onClick={() => onNewResource('vehicle')}>Nuevo vehículo</Button>,
    documents: (
      <>
        <Button variant="ghost" icon={Upload} onClick={onUpdateOnboarding}>Documento de inicio</Button>
        <Button icon={Send} onClick={onSendDocument}>Enviar documento</Button>
      </>
    ),
    bolsahoras: hourRows.length > 0 && <Button variant="ghost" icon={Download} onClick={() => onExportHours(hourRows)}>Descargar Excel</Button>,
  }[tab];

  const todo = [
    { key: 'hours', label: 'Horas por aprobar', value: pendingHours, icon: Timer, go: () => { goTodo('bolsahoras'); setHoursStatus('pending'); } },
    { key: 'policy', label: 'Normas sin firmar', value: policyCounts.pending, icon: ClipboardCheck, go: () => goTodo('employees', 'pending') },
    { key: 'first', label: 'Primer acceso pendiente', value: firstAccess, icon: KeyRound, go: () => goTodo('employees', 'first') },
  ];

  return (
    <div className={styles.page}>
      <DeskHeader icon={ShieldCheck} kicker="Gestión de RRHH" title="Administración"
        desc="Empleados, salas, vehículos, documentos y bolsa de horas: todo lo que gestiona RRHH, en un sitio."
        actions={actions} />

      {/* Sections as tabs (a dot when hours wait for a decision) */}
      <DeskTabs label="Secciones de administración" value={tab} onChange={setTab} items={[
        { value: 'employees', label: 'Empleados', icon: UsersRound, count: employees.length },
        { value: 'rooms', label: 'Salas', icon: Building, count: rooms.length },
        { value: 'vehicles', label: 'Vehículos', icon: Car, count: vehicles.length },
        { value: 'documents', label: 'Documentos', icon: FileText, count: documents.length },
        { value: 'bolsahoras', label: 'Bolsa de horas', icon: Timer, count: pendingHours, alert: pendingHours > 0 },
      ]} />

      {/* What waits for RRHH, one click from any section */}
      <section className={styles.todoBar} aria-label="Para revisar">
        <span className={styles.todoTitle}><ClipboardCheck size={16} aria-hidden="true" /> Para revisar</span>
        <ul className={styles.todo}>
          {todo.map((t) => (
            <li key={t.key}>
              <button type="button" onClick={t.go} data-zero={t.value === 0 || undefined}>
                <t.icon size={15} aria-hidden="true" />
                <span>{t.label}</span>
                <strong>{t.value}</strong>
              </button>
            </li>
          ))}
        </ul>
      </section>

        {tab === 'employees' && (
          <>
            <DeskMetrics label="Normas internas y accesos (pulsa para filtrar)" items={[
              { label: 'Normas firmadas', value: policyCounts.signed, tone: 'success', hint: `De ${plural(employees.length, 'persona', 'personas')}`, onClick: () => toggle(setPolicy, policy, 'signed'), active: policy === 'signed' },
              { label: 'Aceptadas sin firma', value: policyCounts.manual, tone: 'accent', hint: 'En papel o a mano', onClick: () => toggle(setPolicy, policy, 'manual'), active: policy === 'manual' },
              { label: 'Firma pendiente', value: policyCounts.pending, tone: 'warning', hint: policyCounts.pending ? 'Se les pide al entrar' : 'Nadie pendiente', onClick: () => toggle(setPolicy, policy, 'pending'), active: policy === 'pending' },
              { label: 'Primer acceso', value: firstAccess, tone: 'info', hint: firstAccess ? 'Aún no han entrado' : 'Todos han entrado', onClick: () => toggle(setPolicy, policy, 'first'), active: policy === 'first' },
            ]} />
            {signaturesFailed && (
              <p className={styles.notice} role="status">
                <Clock size={15} aria-hidden="true" /> No se han podido cargar las firmas. Los estados de las normas pueden no estar al día.
              </p>
            )}

            <DeskPanel flush
              title={dept === 'all' ? 'Empleados' : dept}
              sub={`${plural(people.length, 'persona', 'personas')}${policy !== 'all' ? ' con este filtro' : ''}`}
              tools={(
                <>
                  <DeskSearch value={query} onChange={(v) => { setQuery(v); setLimit(PAGE); }} label="Buscar empleados" placeholder="Nombre, email o puesto" />
                  <DeskSelect label="Departamento" value={dept} onChange={(v) => { setDept(v); setLimit(PAGE); }} options={[
                    { value: 'all', label: 'Todos los departamentos' },
                    ...depts.map((d) => ({ value: d, label: d })),
                  ]} />
                </>
              )}
            >
              {people.length === 0 ? (
                <DeskEmpty icon={UsersRound}
                  title={employees.length === 0 ? 'Aún no hay empleados' : 'Nadie con estos filtros'}
                  text={employees.length === 0 ? 'Da de alta a la primera persona del equipo.' : query ? `Nadie coincide con «${query}».` : 'Cambia el departamento o quita el filtro.'}
                  action={employees.length === 0
                    ? <Button icon={Plus} onClick={onNewEmployee}>Nuevo empleado</Button>
                    : <Button variant="secondary" onClick={clearPeople}>Quitar filtros</Button>} />
              ) : (
                <>
                  <DeskTable label="Empleados" head={[
                    { label: 'Persona' }, { label: 'Puesto' }, { label: 'Modalidad' },
                    { label: 'Normas' }, { label: 'DNI', optional: true }, { label: 'Acciones', end: true },
                  ]}>
                    {people.slice(0, limit).map((emp) => {
                      const sig = lastSignature[emp.id];
                      const st = statusOf(emp);
                      const p = POLICY[st];
                      const mode = MODE[modeKey(emp.workMode)];
                      const days = TELEWORK_WEEKDAYS.filter((w) => emp.teleworkDays?.includes(w.day)).map((w) => w.short);
                      const first = isFirstAccess(emp);
                      return (
                        <tr key={emp.id} data-attention={st === 'pending' || first || undefined}>
                          <td className={styles.person}>
                            <CellStack lead={<Avatar initials={emp.avatar} size={34} />}
                              title={<>{emp.name}{emp.id === user?.id && <em className={styles.you}> (tú)</em>}{emp.role === 'admin' && <span className={styles.adminTag}>Admin</span>}{first && <span className={styles.firstTag}>Primer acceso</span>}</>}
                              sub={emp.email ? <a className={styles.mail} href={`mailto:${emp.email}`}>{emp.email}</a> : null} />
                          </td>
                          <td><CellStack title={emp.position || 'Sin cargo'} sub={emp.dept || 'Sin departamento'} /></td>
                          <td>
                            <StatusPill tone={mode.tone}>{mode.label}</StatusPill>
                            {days.length > 0 && <span className={styles.subline}>Teletrabajo {days.join(' · ')}</span>}
                          </td>
                          <td>
                            <button type="button" className={styles.policy} data-tone={p.tone} onClick={() => onOpenPolicy(emp.id)}
                              aria-haspopup="dialog" aria-label={`Normas internas de ${emp.name}: ${p.label.toLowerCase()}. Ver detalle`}>
                              <p.icon size={13} aria-hidden="true" />
                              {p.label}
                              {st === 'signed' && sig?.signedAt && <span className={styles.policyDate}>{formatSignedAt(sig.signedAt).slice(0, 10)}</span>}
                            </button>
                          </td>
                          <td className={clsx(styles.mono, optionalCol)}>{emp.phone || <span className={styles.muted}>—</span>}</td>
                          <td>
                            <RowActions>
                              <RowAction iconOnly icon={Pencil} onClick={() => onEditEmployee(emp)} label={`Editar a ${emp.name}`} />
                              {emp.id !== user?.id && (
                                <RowAction iconOnly icon={KeyRound} tone="accent" onClick={() => onResetPassword(emp)} label={`Restablecer la contraseña de ${emp.name}`} />
                              )}
                              <RowAction iconOnly icon={Trash2} onClick={() => onDeleteEmployee(emp.id)} label={`Dar de baja a ${emp.name}`} />
                            </RowActions>
                          </td>
                        </tr>
                      );
                    })}
                  </DeskTable>
                  <ShowMore shown={Math.min(limit, people.length)} total={people.length} onMore={() => setLimit((l) => l + PAGE)} noun="personas" />
                </>
              )}
            </DeskPanel>
          </>
        )}

        {tab === 'rooms' && (
          <DeskPanel flush title="Salas" sub={`${plural(rooms.length, 'sala', 'salas')} · espacios que el equipo puede reservar`}>
            {rooms.length === 0 ? (
              <DeskEmpty icon={Building} title="Aún no hay salas" text="Añade la primera sala para que el equipo pueda reservarla."
                action={<Button icon={Plus} onClick={() => onNewResource('room')}>Nueva sala</Button>} />
            ) : (
              <DeskTable label="Salas" head={[
                { label: 'Sala' }, { label: 'Capacidad' }, { label: 'Equipamiento' }, { label: 'Disponibilidad' }, { label: 'Acciones', end: true },
              ]}>
                {rooms.map((room) => (
                  <tr key={room.id}>
                    <td><CellStack lead={<TypeTile icon={Building} tone="info" />} title={room.name} sub={`Planta ${room.floor ?? 0}`} /></td>
                    <td className={styles.nowrap}>{plural(Number(room.capacity) || 0, 'persona', 'personas')}</td>
                    <td>{room.equipment?.length ? <span className={styles.tags}>{room.equipment.map((eq) => <span key={eq}>{eq}</span>)}</span> : <span className={styles.muted}>—</span>}</td>
                    <td>{room.isActive === false ? <StatusPill tone="neutral">Oculta al equipo</StatusPill> : <StatusPill tone="success">Disponible</StatusPill>}</td>
                    <td>
                      <RowActions>
                        <RowAction iconOnly icon={Pencil} onClick={() => onEditResource('room', room)} label={`Editar ${room.name}`} />
                        <RowAction iconOnly icon={Trash2} onClick={() => onDeleteResource('room', room)} label={`Eliminar ${room.name}`} />
                      </RowActions>
                    </td>
                  </tr>
                ))}
              </DeskTable>
            )}
          </DeskPanel>
        )}

        {tab === 'vehicles' && (
          <DeskPanel flush title="Vehículos" sub={`${plural(vehicles.length, 'vehículo', 'vehículos')} · flota de empresa para reservar`}>
            {vehicles.length === 0 ? (
              <DeskEmpty icon={Car} title="Aún no hay vehículos" text="Añade el primer vehículo de la flota para que el equipo pueda reservarlo."
                action={<Button icon={Plus} onClick={() => onNewResource('vehicle')}>Nuevo vehículo</Button>} />
            ) : (
              <DeskTable label="Vehículos" head={[
                { label: 'Vehículo' }, { label: 'Matrícula' }, { label: 'Tipo' }, { label: 'Disponibilidad' }, { label: 'Acciones', end: true },
              ]}>
                {vehicles.map((v) => (
                  <tr key={v.id}>
                    <td><CellStack lead={<TypeTile icon={Car} tone="warning" />} title={v.model} sub={v.year ? String(v.year) : undefined} /></td>
                    <td className={styles.mono}>{v.plate}</td>
                    <td>{v.type || '—'}</td>
                    <td>{v.isActive === false ? <StatusPill tone="neutral">Oculto al equipo</StatusPill> : <StatusPill tone="success">Disponible</StatusPill>}</td>
                    <td>
                      <RowActions>
                        <RowAction iconOnly icon={Pencil} onClick={() => onEditResource('vehicle', v)} label={`Editar ${v.model} ${v.plate}`} />
                        <RowAction iconOnly icon={Trash2} onClick={() => onDeleteResource('vehicle', v)} label={`Eliminar ${v.model} ${v.plate}`} />
                      </RowActions>
                    </td>
                  </tr>
                ))}
              </DeskTable>
            )}
          </DeskPanel>
        )}

        {tab === 'documents' && (
          <>
            <DeskMetrics label="Documentos por estado (pulsa para filtrar)" items={Object.entries(DOC).map(([k, d]) => ({
              label: k === 'pending' ? 'Pendientes' : k === 'signed' ? 'Firmados' : 'Completados',
              value: documents.filter((x) => x.status === k).length,
              tone: k === 'pending' ? 'warning' : 'success',
              hint: k === 'pending' ? 'Esperan a la persona' : 'En total',
              onClick: () => toggle(setDocStatus, docStatus, k),
              active: docStatus === k,
            }))} />
            <DeskPanel flush title="Documentos enviados" sub={`${plural(docs.length, 'documento', 'documentos')}${docStatus !== 'all' ? ' con este filtro' : ''}`}>
              {docs.length === 0 ? (
                <DeskEmpty icon={FileText}
                  title={documents.length === 0 ? 'Aún no has enviado documentos' : 'Nada con este filtro'}
                  text={documents.length === 0 ? 'Envía un documento para que una persona lo firme o lo complete y sigue aquí su estado.' : 'Quita el filtro para ver todos los documentos.'}
                  action={documents.length === 0
                    ? <Button icon={Send} onClick={onSendDocument}>Enviar documento</Button>
                    : <Button variant="secondary" onClick={() => setDocStatus('all')}>Quitar filtro</Button>} />
              ) : (
                <DeskTable label="Documentos enviados" head={[
                  { label: 'Documento' }, { label: 'Para' }, { label: 'Estado' }, { label: 'Enviado', optional: true }, { label: 'Acciones', end: true },
                ]}>
                  {docs.map((doc) => {
                    const to = personOf(doc.recipientId, doc.recipientName);
                    const st = DOC[doc.status] || DOC.pending;
                    return (
                      <tr key={doc.id}>
                        <td><CellStack lead={<TypeTile icon={FileText} tone="purple" />} title={doc.title} sub={doc.description} clamp /></td>
                        <td><CellStack lead={<Avatar initials={to.avatar} size={28} />} title={to.name} sub={to.dept} /></td>
                        <td><StatusPill tone={st.tone}>{st.label}</StatusPill></td>
                        <td className={clsx(styles.nowrap, optionalCol)}>{doc.createdAt ? fmtDate(doc.createdAt) : '—'}</td>
                        <td>
                          <RowActions>
                            {doc.fileUrl && <RowAction iconOnly icon={Download} tone="accent" href={doc.fileUrl} download={doc.title || 'documento'} label={`Descargar ${doc.title}`} />}
                            <RowAction iconOnly icon={Trash2} onClick={() => onDeleteDocument(doc)} label={`Eliminar ${doc.title}`} />
                          </RowActions>
                        </td>
                      </tr>
                    );
                  })}
                </DeskTable>
              )}
            </DeskPanel>
          </>
        )}

        {tab === 'bolsahoras' && (
          <>
            <DeskMetrics label="Bolsa de horas por estado (pulsa para filtrar)" items={Object.entries(HOURS).map(([k, s]) => ({
              label: k === 'pending' ? 'Pendientes' : k === 'approved' ? 'Aprobadas' : 'Rechazadas',
              value: hours.filter((h) => h.status === k).length,
              tone: s.tone,
              hint: k === 'pending' ? (pendingHours ? 'Esperan tu decisión' : 'Todo revisado') : 'En total',
              onClick: () => toggle(setHoursStatus, hoursStatus, k),
              active: hoursStatus === k,
            }))} />
            <DeskPanel flush
              title="Bolsa de horas"
              sub={`${plural(hourRows.length, 'registro', 'registros')} · ${approvedHours.toFixed(1).replace('.', ',')} h aprobadas`}
              tools={(
                <>
                  <DeskSelect label="Empleado" value={hoursEmp} onChange={setHoursEmp} options={[
                    { value: '', label: 'Todo el equipo' },
                    ...[...employees].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es')).map((e) => ({ value: String(e.id), label: e.name })),
                  ]} />
                  <label className={styles.date}>
                    <span>Desde</span>
                    <input type="date" value={hoursFrom} max={hoursTo || undefined} onChange={(e) => setHoursFrom(e.target.value)} />
                  </label>
                  <label className={styles.date}>
                    <span>Hasta</span>
                    <input type="date" value={hoursTo} min={hoursFrom || undefined} onChange={(e) => setHoursTo(e.target.value)} />
                  </label>
                  {hoursFiltering && <RowAction icon={X} onClick={clearHours}>Limpiar</RowAction>}
                </>
              )}
            >
              {hourRows.length === 0 ? (
                <DeskEmpty icon={Timer}
                  title={hours.length === 0 ? 'Aún no hay horas registradas' : 'Nada con estos filtros'}
                  text={hours.length === 0 ? 'Cuando alguien registre horas para su bolsa, aparecerán aquí para que las apruebes.' : 'Cambia la persona, las fechas o el estado.'}
                  action={hours.length > 0 && <Button variant="secondary" onClick={clearHours}>Quitar filtros</Button>} />
              ) : (
                <DeskTable label="Bolsa de horas" head={[
                  { label: 'Persona' }, { label: 'Fecha' }, { label: 'Motivo' }, { label: 'Horas' }, { label: 'Estado' }, { label: 'Acciones', end: true },
                ]}>
                  {hourRows.map((h) => {
                    const who = personOf(h.employeeId, h.employeeName);
                    const st = HOURS[h.status] || HOURS.pending;
                    const busy = hoursBusy === h.id;
                    const review = h.status === 'pending';
                    return (
                      <tr key={h.id} data-attention={review || undefined}>
                        <td><CellStack lead={<Avatar initials={who.avatar} size={30} />} title={who.name} sub={who.dept} /></td>
                        <td className={styles.nowrap}>{h.date ? fmtDate(h.date) : '—'}</td>
                        <td><span className={styles.reason} title={h.reason || undefined}>{h.reason || '—'}</span></td>
                        <td className={styles.hours}>{String(h.hours).replace('.', ',')} h</td>
                        <td>
                          <StatusPill tone={st.tone}>{st.label}</StatusPill>
                          {!review && h.reviewerName && <span className={styles.subline}>por {h.reviewerName}</span>}
                        </td>
                        <td>
                          <RowActions>
                            {review && (
                              <>
                                <RowAction icon={Check} tone="success" onClick={() => onApproveHours(h)} disabled={busy}
                                  aria-label={`Aprobar ${h.hours} h de ${who.name}`}>{busy ? 'Guardando…' : 'Aprobar'}</RowAction>
                                <RowAction icon={X} tone="danger" onClick={() => onRejectHours(h)} disabled={busy}
                                  aria-label={`Rechazar ${h.hours} h de ${who.name}`}>Rechazar</RowAction>
                              </>
                            )}
                            <RowAction iconOnly icon={Trash2} onClick={() => onDeleteHours(h)} label={`Eliminar el registro de ${who.name}`} />
                          </RowActions>
                        </td>
                      </tr>
                    );
                  })}
                </DeskTable>
              )}
            </DeskPanel>
          </>
        )}
    </div>
  );
}
