import { useMemo, useState } from 'react';
import {
  Building2, Car, CalendarDays, CalendarPlus, CalendarClock, Download, Plus, Check, X, Trash2, Clock, ListChecks, LayoutList, Users,
} from 'lucide-react';
import { Button } from '../components/ui';
import {
  DeskHeader, DeskLayout, DeskRail, DeskMetrics, DeskPanel, DeskSpotlight, SpotAction, DeskSearch, DeskSegmented, DeskSelect,
  DeskTable, CellStack, TypeTile, StatusPill, RowAction, RowActions, DeskEmpty, ShowMore,
} from '../components/Desk';
import ReservationsCalendar from './ReservationsCalendar';
import { todayKey } from '../utils/format';
import styles from './ReservationsDesk.module.scss';

const STATUS = {
  pending:   { tone: 'warning', label: 'Pendiente' },
  confirmed: { tone: 'success', label: 'Confirmada' },
  cancelled: { tone: 'danger',  label: 'Cancelada' },
  rejected:  { tone: 'danger',  label: 'Rechazada' },
};
const DAY_START = 8;   // the timeline runs 08:00–20:00 (bookings outside are clamped to the edges)
const DAY_END = 20;
const TICKS = [8, 10, 12, 14, 16, 18, 20];
const PAGE = 30;
const active = (r) => r.status !== 'cancelled' && r.status !== 'rejected';
const byTime = (a, b) => (a.date + a.timeStart).localeCompare(b.date + b.timeStart);
const minutes = (hm) => { const [h, m] = String(hm || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
const pct = (mins) => Math.min(100, Math.max(0, ((mins - DAY_START * 60) / ((DAY_END - DAY_START) * 60)) * 100));
const dayLabel = (iso) => new Date(`${iso}T00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const dayShort = (iso) => new Date(`${iso}T00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');

/** Today of one resource on a 08:00–20:00 line: booked blocks, free gaps between them, and now. */
function DayLine({ bookings, nowMins, name }) {
  const showNow = nowMins >= DAY_START * 60 && nowMins <= DAY_END * 60;
  const summary = bookings.length
    ? `Hoy: ${bookings.map((b) => `${b.timeStart}–${b.timeEnd}${b.status === 'pending' ? ' (pendiente)' : ''}`).join(', ')}`
    : 'Hoy sin reservas';
  return (
    <div className={styles.line} role="img" aria-label={`${name}. ${summary}`}>
      {TICKS.slice(1, -1).map((h) => <i key={h} className={styles.tick} style={{ left: `${pct(h * 60)}%` }} aria-hidden="true" />)}
      {bookings.map((b) => (
        <span key={b.id} className={styles.block} data-status={b.status}
          style={{ left: `${pct(minutes(b.timeStart))}%`, width: `${Math.max(1.5, pct(minutes(b.timeEnd)) - pct(minutes(b.timeStart)))}%` }}
          title={`${b.timeStart}–${b.timeEnd} · ${b.employeeName || 'Reservado'}${b.status === 'pending' ? ' · pendiente' : ''}`} />
      ))}
      {showNow && <span className={styles.now} style={{ left: `${pct(nowMins)}%` }} aria-hidden="true" />}
    </div>
  );
}

/**
 * Reservas on a computer: your next booking on the brand panel, the views as a side list, and
 * either today's line of every room and vehicle (book from the row), the agenda as a table with
 * filters, or the calendar. The booking form and the confirmations stay in ReservationsPage.
 */
export default function ReservationsDesk({
  rooms, vehicles, reservations, user, busyUntil, initialView = 'resources',
  onBook, onNew, onApprove, onReject, onDelete, onAddToCalendar, onExport, busyId,
}) {
  const isAdmin = user?.role === 'admin';
  const [view, setView] = useState(initialView === 'agenda' ? 'agenda' : 'resources');
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState('all');
  const [scope, setScope] = useState(initialView === 'agenda' ? 'mine' : 'all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const now = new Date();
  const today = todayKey(now);
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const mineUpcoming = useMemo(() => reservations
    .filter((r) => r.employeeId === user?.id && active(r) && r.date >= today)
    .sort(byTime), [reservations, user?.id, today]);
  const next = mineUpcoming[0];
  const toReview = reservations.filter((r) => r.status === 'pending').length;
  const todayCount = reservations.filter((r) => r.date === today && active(r)).length;
  const bookableRooms = rooms.filter((r) => r.isActive !== false);
  const bookableVehicles = vehicles.filter((v) => v.isActive !== false);
  const freeRooms = bookableRooms.filter((r) => !busyUntil('room', r.id, r.name)).length;
  const freeVehicles = bookableVehicles.filter((v) => !busyUntil('vehicle', v.id, v.model)).length;

  // Rooms and vehicles with today's bookings of each (matched by id; the name only as a fallback)
  const q = query.trim().toLocaleLowerCase('es');
  const resources = (type) => (type === 'vehicle' ? vehicles : rooms)
    .map((x) => {
      const name = type === 'vehicle' ? x.model : x.name;
      return {
        ...x, type, name,
        meta: type === 'vehicle'
          ? [x.plate, x.type, x.year].filter(Boolean).join(' · ')
          : [x.floor != null && x.floor !== '' && `Planta ${x.floor}`, x.capacity && `${x.capacity} personas`].filter(Boolean).join(' · '),
        tags: type === 'room' && Array.isArray(x.equipment) ? x.equipment : [],
        until: busyUntil(type, x.id, name),
        today: reservations.filter((b) => b.type === type && b.date === today && active(b)
          && ((type === 'vehicle' ? b.vehicleId : b.roomId) != null
            ? String(type === 'vehicle' ? b.vehicleId : b.roomId) === String(x.id)
            : b.resourceName === name)).sort(byTime),
      };
    })
    .filter((x) => !q || [x.name, x.meta, ...x.tags].join(' ').toLocaleLowerCase('es').includes(q));

  // Agenda: upcoming first (soonest on top), then the past (most recent on top)
  const agendaScope = view === 'pending' ? 'all' : scope;
  const agendaStatus = view === 'pending' ? 'pending' : status;
  const agenda = useMemo(() => reservations.filter((r) => (agendaScope === 'all' || r.employeeId === user?.id)
    && (kind === 'all' || r.type === kind)
    && (agendaStatus === 'all' || r.status === agendaStatus)
    && (!q || [r.resourceName, r.employeeName, r.purpose].some((v) => String(v || '').toLocaleLowerCase('es').includes(q)))),
  [reservations, agendaScope, kind, agendaStatus, q, user?.id]);
  const upcoming = agenda.filter((r) => r.date >= today).sort(byTime);
  const past = agenda.filter((r) => r.date < today).sort((a, b) => byTime(b, a));
  const ordered = [...upcoming, ...past];
  const shown = ordered.slice(0, limit);

  const go = (v) => { setView(v); setLimit(PAGE); };
  const clearFilters = () => { setKind('all'); setStatus('all'); setScope('all'); setQuery(''); };

  const resourcePanel = (type) => {
    const list = resources(type);
    const all = type === 'vehicle' ? vehicles : rooms;
    return (
      <DeskPanel flush key={type}
        title={type === 'vehicle' ? 'Vehículos de empresa' : 'Salas de reuniones'}
        sub={type === 'vehicle'
          ? `${freeVehicles} de ${bookableVehicles.length} libres ahora · coches y furgonetas para visitas y obras`
          : `${freeRooms} de ${bookableRooms.length} libres ahora · pulsa «Reservar» o elige la hora en el formulario`}>
        {list.length === 0 ? (
          <DeskEmpty icon={type === 'vehicle' ? Car : Building2}
            title={q ? 'Sin resultados' : type === 'vehicle' ? 'No hay vehículos' : 'No hay salas'}
            text={q ? `Nada coincide con «${query.trim()}».` : all.length ? 'Ninguno disponible.' : 'Administración todavía no ha añadido ninguno.'} />
        ) : (
          <>
            <div className={styles.scale} aria-hidden="true">
              <span />
              <div>{TICKS.map((h) => <em key={h} style={{ left: `${pct(h * 60)}%` }}>{String(h).padStart(2, '0')}:00</em>)}</div>
              <span />
            </div>
            <ul className={styles.resources}>
              {list.map((x) => (
                <li key={`${type}-${x.id}`} className={styles.resource}>
                  <CellStack lead={<TypeTile icon={type === 'vehicle' ? Car : Building2} tone={type === 'vehicle' ? 'info' : 'accent'} />}
                    title={x.name} sub={x.meta || (type === 'vehicle' ? 'Vehículo' : 'Sala')} />
                  <DayLine bookings={x.today} nowMins={nowMins} name={x.name} />
                  <div className={styles.resEnd}>
                    {x.isActive === false
                      ? <StatusPill tone="neutral">Oculto a los empleados</StatusPill>
                      : x.until
                        ? <StatusPill tone="warning">En uso hasta {x.until}</StatusPill>
                        : <StatusPill tone="success">Libre ahora</StatusPill>}
                    <RowAction icon={Plus} tone="accent" onClick={() => onBook(type, x.id)} aria-label={`Reservar ${x.name}`}>Reservar</RowAction>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </DeskPanel>
    );
  };

  return (
    <div className={styles.page}>
      <DeskHeader
        icon={CalendarDays}
        title="Reservas"
        desc="Salas y vehículos de empresa: mira de un vistazo qué está libre hoy y reserva en segundos."
        actions={(
          <>
            <Button variant="ghost" icon={Download} onClick={() => onExport(ordered)} disabled={!ordered.length || view === 'resources' || view === 'calendar'}
              title={view === 'resources' || view === 'calendar' ? 'Abre la agenda para descargar las reservas filtradas' : undefined}>
              Descargar Excel
            </Button>
            <Button icon={Plus} onClick={onNew}>Nueva reserva</Button>
          </>
        )}
      />

      <DeskLayout
        sideLabel="Tu próxima reserva y vistas"
        side={(
          <>
            <DeskSpotlight icon={CalendarClock} label="Tu próxima reserva"
              actions={next
                ? <SpotAction primary icon={CalendarPlus} onClick={() => onAddToCalendar(next)}>Añadir a mi calendario</SpotAction>
                : <SpotAction primary icon={Plus} onClick={onNew}>Reservar</SpotAction>}>
              {next ? (
                <div className={styles.next}>
                  <strong>{next.resourceName}</strong>
                  <span className={styles.nextWhen}>{next.date === today ? 'Hoy' : dayLabel(next.date)}</span>
                  <span className={styles.nextTime}><Clock size={14} aria-hidden="true" /> {next.timeStart}–{next.timeEnd}</span>
                  {next.purpose && <span className={styles.nextPurpose}>{next.purpose}</span>}
                  <span className={styles.nextFoot}>
                    <StatusPill tone={next.status === 'confirmed' ? 'success' : 'warning'}>{STATUS[next.status]?.label || 'Pendiente'}</StatusPill>
                    {mineUpcoming.length > 1 && <span>y {mineUpcoming.length - 1} más</span>}
                  </span>
                </div>
              ) : (
                <p className={styles.nextEmpty}>No tienes reservas próximas. Elige una sala o un vehículo libre.</p>
              )}
            </DeskSpotlight>

            <DeskRail title="Vista" value={view} onChange={go} items={[
              { value: 'resources', label: 'Disponibilidad hoy', hint: 'Salas y vehículos', icon: LayoutList, tone: 'accent' },
              { value: 'agenda', label: 'Agenda', hint: 'Todas las reservas', icon: ListChecks, tone: 'info', count: mineUpcoming.length || undefined },
              ...(isAdmin ? [{ value: 'pending', label: 'Por revisar', hint: 'Confirma o rechaza', icon: Users, tone: 'warning', count: toReview, alert: toReview > 0 }] : []),
              { value: 'calendar', label: 'Calendario', hint: 'Mes y semana', icon: CalendarDays, tone: 'purple' },
            ]} />
          </>
        )}
      >
        {view !== 'calendar' && (
          <DeskMetrics label="Hoy" items={[
            { label: 'Salas libres ahora', value: `${freeRooms}/${bookableRooms.length}`, tone: 'accent', hint: 'Sin reserva en este momento' },
            { label: 'Vehículos libres ahora', value: `${freeVehicles}/${bookableVehicles.length}`, tone: 'info', hint: 'Disponibles para salir' },
            { label: 'Reservas hoy', value: todayCount, tone: 'success', hint: 'Salas y vehículos' },
            isAdmin
              ? { label: 'Por revisar', value: toReview, tone: 'warning', hint: toReview ? 'Esperan tu decisión' : 'Todo revisado', onClick: () => go(view === 'pending' ? 'agenda' : 'pending'), active: view === 'pending' }
              : { label: 'Tus próximas', value: mineUpcoming.length, tone: 'warning', hint: 'Reservas a tu nombre', onClick: () => { setScope('mine'); go('agenda'); }, active: view === 'agenda' && scope === 'mine' },
          ]} />
        )}

        {view === 'resources' && (
          <>
            <div className={styles.toolbar}>
              <DeskSearch value={query} onChange={setQuery} label="Buscar salas y vehículos" placeholder="Buscar sala, vehículo, matrícula o equipamiento" />
              <DeskSegmented label="Tipo de recurso" value={kind} onChange={setKind} options={[
                { value: 'all', label: 'Todo' }, { value: 'room', label: 'Salas', icon: Building2 }, { value: 'vehicle', label: 'Vehículos', icon: Car },
              ]} />
              <span className={styles.legend} aria-hidden="true">
                <i data-status="confirmed" /> Confirmada <i data-status="pending" /> Pendiente <i data-now /> Ahora
              </span>
            </div>
            {kind !== 'vehicle' && resourcePanel('room')}
            {kind !== 'room' && resourcePanel('vehicle')}
          </>
        )}

        {(view === 'agenda' || view === 'pending') && (
          <DeskPanel flush
            title={view === 'pending' ? 'Reservas por revisar' : 'Agenda'}
            sub={`${ordered.length} ${ordered.length === 1 ? 'reserva' : 'reservas'} · ${upcoming.length} próximas`}
            tools={(
              <>
                <DeskSearch value={query} onChange={(v) => { setQuery(v); setLimit(PAGE); }} label="Buscar reservas" placeholder="Buscar recurso, persona o propósito" />
                <DeskSegmented label="Tipo de recurso" value={kind} onChange={(v) => { setKind(v); setLimit(PAGE); }} options={[
                  { value: 'all', label: 'Todo' }, { value: 'room', label: 'Salas' }, { value: 'vehicle', label: 'Vehículos' },
                ]} />
                {view === 'agenda' && (
                  <>
                    <DeskSelect label="Estado" value={status} onChange={(v) => { setStatus(v); setLimit(PAGE); }} options={[
                      { value: 'all', label: 'Todos los estados' }, { value: 'pending', label: 'Pendientes' },
                      { value: 'confirmed', label: 'Confirmadas' }, { value: 'cancelled', label: 'Canceladas' },
                    ]} />
                    <DeskSegmented label="De quién" value={scope} onChange={(v) => { setScope(v); setLimit(PAGE); }} options={[
                      { value: 'all', label: 'Todas' }, { value: 'mine', label: 'Mías' },
                    ]} />
                  </>
                )}
              </>
            )}
          >
            {ordered.length === 0 ? (
              <DeskEmpty icon={view === 'pending' ? Check : CalendarDays}
                title={view === 'pending' ? 'Nada por revisar' : reservations.length ? 'Nada con estos filtros' : 'Aún no hay reservas'}
                text={view === 'pending' ? 'Todas las reservas tienen respuesta.' : reservations.length ? 'Cambia o quita los filtros para ver más reservas.' : 'Cuando alguien reserve una sala o un vehículo aparecerá aquí.'}
                action={view === 'pending' ? undefined : reservations.length
                  ? <Button variant="secondary" onClick={clearFilters}>Quitar filtros</Button>
                  : <Button icon={Plus} onClick={onNew}>Nueva reserva</Button>} />
            ) : (
              <>
                <DeskTable label="Reservas" head={[
                  { label: 'Cuándo' }, { label: 'Recurso' }, { label: 'Solicitante' }, { label: 'Propósito' }, { label: 'Estado' }, { label: 'Acciones', end: true },
                ]}>
                  {shown.map((r, i) => {
                    const mine = r.employeeId === user?.id;
                    const review = isAdmin && r.status === 'pending';
                    const busy = busyId === r.id;
                    const st = STATUS[r.status] || STATUS.pending;
                    const firstPast = r.date < today && (i === 0 || shown[i - 1].date >= today);
                    return [
                      firstPast && upcoming.length > 0 && (
                        <tr key={`past-${r.id}`} data-divider><td colSpan={6}>Anteriores</td></tr>
                      ),
                      <tr key={r.id} data-attention={review || undefined} className={r.date < today ? styles.pastRow : undefined}>
                        <td>
                          <CellStack title={r.date === today ? 'Hoy' : dayShort(r.date)} sub={`${r.timeStart}–${r.timeEnd}`} />
                        </td>
                        <td>
                          <CellStack lead={<TypeTile icon={r.type === 'vehicle' ? Car : Building2} tone={r.type === 'vehicle' ? 'info' : 'accent'} size={32} />}
                            title={r.resourceName} sub={r.type === 'vehicle' ? 'Vehículo' : 'Sala'} />
                        </td>
                        <td className={styles.who}>{r.employeeName || '—'}{mine && <em> (tú)</em>}</td>
                        <td><span className={styles.purpose} title={r.purpose || undefined}>{r.purpose || '—'}</span></td>
                        <td><StatusPill tone={st.tone}>{st.label}</StatusPill></td>
                        <td>
                          <RowActions>
                            {review && (
                              <>
                                <RowAction icon={Check} tone="success" onClick={() => onApprove(r.id)} disabled={busy}
                                  aria-label={`Confirmar reserva de ${r.resourceName} de ${r.employeeName || 'empleado'}`}>{busy ? 'Guardando…' : 'Confirmar'}</RowAction>
                                <RowAction icon={X} tone="danger" onClick={() => onReject(r.id)} disabled={busy}
                                  aria-label={`Rechazar reserva de ${r.resourceName} de ${r.employeeName || 'empleado'}`}>Rechazar</RowAction>
                              </>
                            )}
                            {mine && active(r) && r.date >= today && (
                              <RowAction iconOnly icon={CalendarPlus} tone="accent" onClick={() => onAddToCalendar(r)} label={`Añadir ${r.resourceName} a mi calendario`} />
                            )}
                            {(isAdmin || mine) && (
                              <RowAction iconOnly icon={Trash2} tone="neutral" onClick={() => onDelete(r.id)} label={`Eliminar reserva de ${r.resourceName} del ${dayShort(r.date)}`} />
                            )}
                          </RowActions>
                        </td>
                      </tr>,
                    ];
                  })}
                </DeskTable>
                <ShowMore shown={shown.length} total={ordered.length} onMore={() => setLimit((l) => l + PAGE)} noun="reservas" />
              </>
            )}
          </DeskPanel>
        )}

        {view === 'calendar' && (
          <DeskPanel title="Calendario" sub="Todas las reservas por mes o por semana">
            <ReservationsCalendar />
          </DeskPanel>
        )}
      </DeskLayout>
    </div>
  );
}
