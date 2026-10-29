import { useMemo, useState } from 'react';
import {
  Settings, UsersRound, Building, Car, FileText, Timer, Search, Plus, Send, Upload, Download, Edit2, Trash2,
  ShieldCheck, Check, X,
} from 'lucide-react';
import { Avatar } from '../components/ui';
import {
  Masthead, Ledger, TabStrip, Toolbar, ToolButton, FeedGroup, FeedItem, ItemAction, TouchEmpty, TouchButton,
  LeafIcon, DateStamp, STATUS,
} from '../components/Touch';
import { policyStatus, formatSignedAt } from '../../shared/services/policy.js';
import { TELEWORK_WEEKDAYS } from '../../shared/services/workMode.js';
import { fmtDate, fmtHM, plural, todayKey } from '../utils/format';
import styles from './AdminTouch.module.scss';

const MODE_LABEL = { office: 'Oficina', oficina: 'Oficina', remoto: 'Remoto', remote: 'Remoto', externo: 'Externo', field: 'Externo' };
const POLICY_TEXT = { signed: 'Firmadas', manual: 'Aceptadas sin firma', pending: 'Sin firmar' };
const DOC_STATUS = {
  pending:   { tone: 'warning', text: 'Pendiente' },
  signed:    { tone: 'success', text: 'Firmado' },
  completed: { tone: 'success', text: 'Completado' },
};
const isFirstAccess = (e) => e.firstLogin === true || e.firstLogin === 'true';
const monthKey = (iso) => String(iso || '').slice(0, 7);
const monthTitle = (key) => new Date(`${key}-01T00:00`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

/** Rows in groups by month (newest first), from the date `dateOf` gives. */
function byMonth(rows, dateOf) {
  const out = [];
  [...rows].sort((a, b) => String(dateOf(b)).localeCompare(String(dateOf(a)))).forEach((r) => {
    const key = monthKey(dateOf(r));
    const last = out[out.length - 1];
    if (last && last.key === key) last.rows.push(r);
    else out.push({ key, rows: [r] });
  });
  return out;
}

/** What a section holds, on the left, and its one way to add something, on the right. */
function SectionBar({ meta, action }) {
  return (
    <div className={styles.sectionBar}>
      <p>{meta}</p>
      {action}
    </div>
  );
}

/**
 * Administración on phones and tablets: what is waiting for RRHH as figures that filter (hours to
 * approve, rules to sign, first accesses), the five sections in tabs, and each section as a list
 * where every row opens in place with its details and actions. Forms, confirmations and the rules
 * sheet stay in AdminPage, which also owns the data and the saves.
 */
export default function AdminTouch({
  tab, setTab, user, employees, rooms, vehicles, reservations, documents, hours, lastSignature, policyCounts, signaturesFailed,
  onNewEmployee, onEditEmployee, onDeleteEmployee, onOpenPolicy, onExportSignatures,
  onNewResource, onEditResource, onDeleteResource,
  onSendDocument, onUpdateOnboarding, onDeleteDocument,
  onApproveHours, onRejectHours, onDeleteHours, onExportHours, hoursBusy,
}) {
  const [query, setQuery] = useState('');
  const [dept, setDept] = useState('all');
  const [empState, setEmpState] = useState('all');
  const [docState, setDocState] = useState('all');
  const [hourState, setHourState] = useState('all');
  const [hourPerson, setHourPerson] = useState('all');

  const today = todayKey();
  const pendingHours = hours.filter((h) => h.status === 'pending').length;
  const firstAccess = employees.filter(isFirstAccess).length;
  const nameOf = (id, fallback) => employees.find((e) => String(e.id) === String(id))?.name || fallback || '—';

  /* Employees */
  const depts = useMemo(() => [...new Set(employees.map((e) => e.dept).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')), [employees]);
  const people = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('es');
    return employees
      .filter((e) => dept === 'all' || e.dept === dept)
      .filter((e) => empState === 'all'
        || (empState === 'policy' && policyStatus(e, lastSignature[e.id]) === 'pending')
        || (empState === 'first' && isFirstAccess(e))
        || (empState === 'admin' && e.role === 'admin'))
      .filter((e) => !q || [e.name, e.email, e.position, e.dept].some((v) => (v || '').toLocaleLowerCase('es').includes(q)))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'));
  }, [employees, dept, empState, query, lastSignature]);

  /* Documents and hours */
  const docs = documents.filter((d) => docState === 'all' || d.status === docState);
  const hourRows = hours
    .filter((h) => hourState === 'all' || h.status === hourState)
    .filter((h) => hourPerson === 'all' || String(h.employeeId) === hourPerson);
  const hourPeople = [...new Set(hours.map((h) => String(h.employeeId)))]
    .map((id) => ({ id, name: nameOf(id, hours.find((h) => String(h.employeeId) === id)?.employeeName) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const approvedHours = hours.filter((h) => h.status === 'approved').reduce((s, h) => s + (Number(h.hours) || 0), 0);

  // The figures of the masthead open their section with its filter (and close it on a second tap)
  const shortcut = (section, isOn, apply, clear) => () => {
    if (isOn) { clear(); return; }
    setTab(section);
    apply();
  };
  const hoursOn = tab === 'bolsahoras' && hourState === 'pending';
  const policyOn = tab === 'employees' && empState === 'policy';
  const firstOn = tab === 'employees' && empState === 'first';

  const resourceUse = (type, id) => reservations.filter((r) => String(type === 'room' ? r.roomId : r.vehicleId) === String(id)
    && r.date >= today && r.status !== 'rejected' && r.status !== 'cancelled');

  const resourceRows = (type) => {
    const isRoom = type === 'room';
    const list = isRoom ? rooms : vehicles;
    if (list.length === 0) {
      return (
        <TouchEmpty compact icon={isRoom ? Building : Car}
          title={isRoom ? 'Aún no hay salas' : 'Aún no hay vehículos'}
          text={isRoom ? 'Da de alta las salas que el equipo puede reservar.' : 'Da de alta los coches y furgonetas de la empresa.'} />
      );
    }
    return (
      <FeedGroup>
        {list.map((item) => {
          const upcoming = resourceUse(type, item.id);
          const hidden = item.isActive === false;
          return (
            <FeedItem key={item.id}
              lead={<LeafIcon icon={isRoom ? Building : Car} tone={hidden ? 'neutral' : isRoom ? 'info' : 'warning'} />}
              title={isRoom ? item.name : item.model}
              meta={isRoom
                ? `Planta ${item.floor ?? 0} · ${plural(item.capacity || 0, 'persona', 'personas')}`
                : [item.plate, item.type, item.year].filter(Boolean).join(' · ')}
              status={hidden ? { tone: 'neutral', text: isRoom ? 'Oculta' : 'Oculto' } : undefined}
              details={[
                ...(isRoom
                  ? [{ label: 'Equipamiento', value: item.equipment?.length ? item.equipment.join(', ') : 'Sin equipamiento', wide: true }]
                  : [{ label: 'Matrícula', value: item.plate }, { label: 'Tipo', value: item.type }]),
                { label: 'Reservas hoy', value: String(upcoming.filter((r) => r.date === today).length) },
                { label: 'Próximas', value: String(upcoming.length) },
              ]}
              actions={(
                <>
                  <ItemAction icon={Edit2} tone="accent" onClick={() => onEditResource(type, item)}>Editar</ItemAction>
                  <ItemAction icon={Trash2} tone="danger" onClick={() => onDeleteResource(type, item)}>Eliminar</ItemAction>
                </>
              )}
            />
          );
        })}
      </FeedGroup>
    );
  };

  const activeRooms = rooms.filter((r) => r.isActive !== false).length;
  const activeVehicles = vehicles.filter((v) => v.isActive !== false).length;
  const pendingDocs = documents.filter((d) => d.status === 'pending').length;
  const pendingHourRows = hourRows.filter((h) => h.status === 'pending');

  const hourItem = (h) => {
    const emp = employees.find((e) => String(e.id) === String(h.employeeId));
    const name = emp?.name || h.employeeName || 'Empleado';
    const busy = hoursBusy === h.id;
    const pending = h.status === 'pending';
    return (
      <FeedItem key={h.id}
        tone={pending ? 'warning' : undefined}
        lead={<DateStamp iso={h.date} tone={pending ? 'warning' : h.status === 'rejected' ? 'danger' : 'success'} />}
        title={name}
        meta={`${fmtHM(h.hours)} h · ${h.reason || 'Sin motivo'}`}
        status={STATUS[h.status]}
        details={[
          { label: 'Persona', value: name },
          { label: 'Departamento', value: emp?.dept || '—' },
          { label: 'Fecha', value: fmtDate(h.date, { year: true }) },
          { label: 'Horas', value: `${fmtHM(h.hours)} h` },
          { label: 'Revisión', value: pending ? 'Espera tu decisión' : h.reviewerName ? `Por ${h.reviewerName}` : '—', wide: true },
          { label: 'Motivo', value: h.reason, wide: true },
        ]}
        actions={(
          <>
            {pending && <ItemAction icon={Check} tone="success" onClick={() => onApproveHours(h)} disabled={busy}>{busy ? 'Guardando…' : 'Aprobar'}</ItemAction>}
            {pending && <ItemAction icon={X} tone="danger" onClick={() => onRejectHours(h)} disabled={busy}>Rechazar</ItemAction>}
            <ItemAction icon={Trash2} tone="danger" onClick={() => onDeleteHours(h)}>Eliminar</ItemAction>
          </>
        )}
      />
    );
  };

  return (
    <div className={styles.page}>
      <Masthead
        icon={Settings}
        title="Administración"
        desc="Empleados, salas, vehículos, documentos y bolsa de horas: todo lo que gestiona RRHH."
      />

      <div className={styles.body}>
        {/* Under the title, not beside it: «Administración» needs the whole width on tablets */}
        <Ledger label="Para revisar" items={[
          { label: 'Horas', value: pendingHours, hint: 'por aprobar', tone: pendingHours ? 'warning' : undefined, toggle: true, active: hoursOn,
            onClick: shortcut('bolsahoras', hoursOn, () => setHourState('pending'), () => setHourState('all')) },
          { label: 'Normas', value: policyCounts.pending, hint: 'sin firmar', tone: policyCounts.pending ? 'warning' : undefined, toggle: true, active: policyOn,
            onClick: shortcut('employees', policyOn, () => setEmpState('policy'), () => setEmpState('all')) },
          { label: 'Accesos', value: firstAccess, hint: 'primer acceso', tone: firstAccess ? 'warning' : undefined, toggle: true, active: firstOn,
            onClick: shortcut('employees', firstOn, () => setEmpState('first'), () => setEmpState('all')) },
        ]} />
        <TabStrip stacked label="Secciones de administración" value={tab} onChange={setTab} options={[
          { value: 'employees', label: 'Empleados', icon: UsersRound, count: employees.length },
          { value: 'rooms', label: 'Salas', icon: Building, count: rooms.length },
          { value: 'vehicles', label: 'Vehículos', icon: Car, count: vehicles.length },
          { value: 'documents', label: 'Documentos', icon: FileText, count: documents.length },
          { value: 'bolsahoras', label: 'Horas', icon: Timer, count: hours.length },
        ]} />

        {tab === 'employees' && (
          <>
            <SectionBar
              meta={signaturesFailed
                ? <span className={styles.warn}>No se han podido cargar las firmas</span>
                : `${policyCounts.signed + policyCounts.manual} de ${employees.length} con las normas aceptadas`}
              action={<TouchButton primary icon={Plus} onClick={onNewEmployee}>Nuevo empleado</TouchButton>} />
            <Toolbar
              search={{ label: 'Buscar empleados', icon: Search, value: query, onChange: setQuery, placeholder: 'Buscar empleado' }}
              groups={[
                { id: 'state', label: 'Estado', value: empState, all: 'all', onChange: setEmpState, options: [
                  { value: 'all', label: 'Todos', count: employees.length },
                  { value: 'policy', label: 'Normas sin firmar', count: policyCounts.pending },
                  { value: 'first', label: 'Primer acceso pendiente', count: firstAccess },
                  { value: 'admin', label: 'Administradores', count: employees.filter((e) => e.role === 'admin').length },
                ] },
                { id: 'dept', label: 'Departamento', value: dept, all: 'all', onChange: setDept, options: [
                  { value: 'all', label: 'Todos' },
                  ...depts.map((d) => ({ value: d, label: d, count: employees.filter((e) => e.dept === d).length })),
                ] },
              ]}
              tools={!signaturesFailed ? <ToolButton icon={Download} label="Registro de firmas (CSV)" onClick={onExportSignatures} /> : undefined}
            />
            {people.length === 0 ? (
              <TouchEmpty compact icon={Search} title="Nadie con estos filtros"
                text={query ? `Ningún empleado coincide con «${query.trim()}».` : 'Cambia o quita los filtros para ver a más personas.'}
                action={<TouchButton onClick={() => { setQuery(''); setDept('all'); setEmpState('all'); }}>Quitar filtros</TouchButton>} />
            ) : (
              <FeedGroup>
                {people.map((emp) => {
                  const sig = lastSignature[emp.id];
                  const st = policyStatus(emp, sig);
                  const first = isFirstAccess(emp);
                  const isMe = emp.id === user?.id;
                  const mode = MODE_LABEL[(emp.workMode || 'office').toLowerCase()] || 'Oficina';
                  const telework = emp.teleworkDays?.length
                    ? ` · teletrabajo ${TELEWORK_WEEKDAYS.filter((w) => emp.teleworkDays.includes(w.day)).map((w) => w.short).join(' ')}` : '';
                  return (
                    <FeedItem key={emp.id}
                      tone={first || st === 'pending' ? 'warning' : undefined}
                      lead={<Avatar initials={emp.avatar} src={emp.avatarUrl} size={42} />}
                      title={isMe ? `${emp.name} (tú)` : emp.name}
                      meta={[emp.position || 'Sin cargo', emp.dept].filter(Boolean).join(' · ')}
                      status={first ? { tone: 'warning', text: 'Primer acceso' }
                        : st === 'pending' ? { tone: 'warning', text: 'Sin firmar' }
                        : emp.role === 'admin' ? { tone: 'purple', text: 'Admin' } : undefined}
                      details={[
                        { label: 'Email', value: emp.email, wide: true },
                        { label: 'DNI', value: emp.phone || '—' },
                        { label: 'Rol', value: emp.role === 'admin' ? 'Administración' : 'Empleado' },
                        { label: 'Modalidad', value: `${mode}${telework}` },
                        { label: 'Acceso', value: first ? 'Primer acceso pendiente' : 'Activo' },
                        { label: 'Normas internas', value: st === 'signed' ? `Firmadas el ${formatSignedAt(sig.signedAt)}` : POLICY_TEXT[st], wide: true },
                      ]}
                      actions={(
                        <>
                          <ItemAction icon={Edit2} tone="accent" onClick={() => onEditEmployee(emp)}>Editar</ItemAction>
                          <ItemAction icon={ShieldCheck} onClick={() => onOpenPolicy(emp.id)}>Normas</ItemAction>
                          {!isMe && <ItemAction icon={Trash2} tone="danger" onClick={() => onDeleteEmployee(emp.id)}>Dar de baja</ItemAction>}
                        </>
                      )}
                    />
                  );
                })}
              </FeedGroup>
            )}
          </>
        )}

        {tab === 'rooms' && (
          <>
            <SectionBar meta={`${activeRooms} de ${plural(rooms.length, 'sala', 'salas')} se pueden reservar`}
              action={<TouchButton primary icon={Plus} onClick={() => onNewResource('room')}>Nueva sala</TouchButton>} />
            {resourceRows('room')}
          </>
        )}

        {tab === 'vehicles' && (
          <>
            <SectionBar meta={`${activeVehicles} de ${plural(vehicles.length, 'vehículo', 'vehículos')} se pueden reservar`}
              action={<TouchButton primary icon={Plus} onClick={() => onNewResource('vehicle')}>Nuevo vehículo</TouchButton>} />
            {resourceRows('vehicle')}
          </>
        )}

        {tab === 'documents' && (
          <>
            <SectionBar
              meta={documents.length === 0 ? 'Ningún envío todavía' : pendingDocs ? `${plural(pendingDocs, 'documento espera', 'documentos esperan')} respuesta` : 'Todos los envíos tienen respuesta'}
              action={<TouchButton primary icon={Send} onClick={onSendDocument}>Enviar documento</TouchButton>} />
            {documents.length > 0 && (
              <Toolbar
                groups={[{ id: 'state', label: 'Estado', value: docState, all: 'all', onChange: setDocState, options: [
                  { value: 'all', label: 'Todos', count: documents.length },
                  ...Object.entries(DOC_STATUS).map(([value, s]) => ({ value, label: `${s.text}s`, count: documents.filter((d) => d.status === value).length })),
                ] }]}
              />
            )}
            {docs.length === 0 ? (
              <TouchEmpty compact icon={FileText}
                title={documents.length === 0 ? 'Aún no has enviado documentos' : 'Nada con este estado'}
                text={documents.length === 0 ? 'Envía contratos, nóminas o protocolos para que el equipo los firme o complete.' : 'Cambia el filtro para ver el resto de envíos.'} />
            ) : byMonth(docs, (d) => d.createdAt).map((g) => (
              <FeedGroup key={g.key} title={monthTitle(g.key)} meta={plural(g.rows.length, 'envío', 'envíos')}>
                {g.rows.map((doc) => {
                  const recipient = employees.find((e) => String(e.id) === String(doc.recipientId));
                  const to = recipient?.name || doc.recipientName || '—';
                  return (
                    <FeedItem key={doc.id}
                      tone={doc.status === 'pending' ? 'warning' : undefined}
                      lead={<LeafIcon icon={FileText} tone="purple" />}
                      title={doc.title}
                      meta={`Para ${to} · ${fmtDate(doc.createdAt)}`}
                      status={DOC_STATUS[doc.status]}
                      details={[
                        { label: 'Destinatario', value: to },
                        { label: 'Departamento', value: recipient?.dept || '—' },
                        { label: 'Enviado', value: fmtDate(doc.createdAt, { year: true }) },
                        { label: 'Archivo', value: doc.fileUrl ? 'Adjunto' : 'Sin archivo' },
                        { label: 'Descripción', value: doc.description, wide: true },
                      ]}
                      actions={(
                        <>
                          {doc.fileUrl && <ItemAction icon={Download} tone="accent" href={doc.fileUrl} download={doc.title || 'documento'}>Descargar</ItemAction>}
                          <ItemAction icon={Trash2} tone="danger" onClick={() => onDeleteDocument(doc)}>Eliminar</ItemAction>
                        </>
                      )}
                    />
                  );
                })}
              </FeedGroup>
            ))}
            <FeedGroup title="Documento de inicio">
              <FeedItem
                lead={<LeafIcon icon={ShieldCheck} tone="accent" />}
                title="Normas internas"
                meta="Lo que cada persona lee y firma al entrar por primera vez"
                trailing={<Upload size={17} className={styles.rowGo} aria-hidden="true" />}
                onClick={onUpdateOnboarding}
              />
            </FeedGroup>
          </>
        )}

        {tab === 'bolsahoras' && (
          <>
            <SectionBar meta={`${fmtHM(approvedHours)} h aprobadas en la bolsa del equipo`} />
            <Toolbar
              groups={[
                { id: 'state', label: 'Estado', value: hourState, all: 'all', onChange: setHourState, options: [
                  { value: 'all', label: 'Todas', count: hours.length },
                  { value: 'pending', label: 'Por aprobar', count: pendingHours },
                  { value: 'approved', label: 'Aprobadas', count: hours.filter((h) => h.status === 'approved').length },
                  { value: 'rejected', label: 'Rechazadas', count: hours.filter((h) => h.status === 'rejected').length },
                ] },
                { id: 'person', label: 'Persona', value: hourPerson, all: 'all', onChange: setHourPerson, options: [
                  { value: 'all', label: 'Todo el equipo' },
                  ...hourPeople.map((p) => ({ value: p.id, label: p.name, count: hours.filter((h) => String(h.employeeId) === p.id).length })),
                ] },
              ]}
              tools={hourRows.length > 0 ? <ToolButton icon={Download} label="Descargar Excel" onClick={() => onExportHours(hourRows)} /> : undefined}
            />
            {hourRows.length === 0 ? (
              <TouchEmpty compact icon={hours.length === 0 ? Timer : Check}
                title={hours.length === 0 ? 'Aún no hay horas en la bolsa' : hourState === 'pending' ? 'Nada por aprobar' : 'Nada con estos filtros'}
                text={hours.length === 0 ? 'Cuando alguien acumule horas para compensar más adelante, las aprobarás aquí.' : 'Cambia los filtros para ver el resto de registros.'} />
            ) : (
              <>
                {pendingHourRows.length > 0 && (
                  <FeedGroup title="Por aprobar" meta={plural(pendingHourRows.length, 'registro', 'registros')}>
                    {pendingHourRows.map((h) => hourItem(h))}
                  </FeedGroup>
                )}
                {byMonth(hourRows.filter((h) => h.status !== 'pending'), (h) => h.date).map((g) => (
                  <FeedGroup key={g.key} title={monthTitle(g.key)} meta={plural(g.rows.length, 'registro', 'registros')}>
                    {g.rows.map((h) => hourItem(h))}
                  </FeedGroup>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );

}
