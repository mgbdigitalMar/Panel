import { useMemo, useState } from 'react';
import {
  Building2, Car, Search, CalendarDays, Plus, Check, X, Trash2, CalendarPlus, Download, LayoutList, CalendarClock, Users, MapPin,
} from 'lucide-react';
import clsx from 'clsx';
import {
  Masthead, Ledger, Spotlight, SpotButton, TabStrip, Toolbar, ToolButton, FeedGroup, FeedItem, ItemAction, Fold,
  TouchEmpty, TouchButton, LeafIcon, TimeLead, STATUS,
} from '../components/Touch';
import { fmtDayShort, todayKey } from '../utils/format';
import ReservationsCalendar from './ReservationsCalendar';
import styles from './ReservationsTouch.module.scss';

const DAY_START = 8;
const DAY_END = 20;
const toH = (t) => { const [h, m] = String(t || '0:0').split(':').map(Number); return h + (m || 0) / 60; };
const pct = (h) => `${((Math.min(DAY_END, Math.max(DAY_START, h)) - DAY_START) / (DAY_END - DAY_START)) * 100}%`;
const active = (r) => r.status !== 'rejected' && r.status !== 'cancelled';
const byTime = (a, b) => (a.date + (a.timeStart || '')).localeCompare(b.date + (b.timeStart || ''));

function dayTitle(iso, today) {
  const d = new Date(`${iso}T00:00`);
  const t = new Date(`${today}T00:00`);
  const diff = Math.round((d - t) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Bookings grouped by day, in the order given. */
function byDay(rows) {
  const groups = [];
  rows.forEach((r) => {
    const last = groups[groups.length - 1];
    if (last && last.date === r.date) last.rows.push(r);
    else groups.push({ date: r.date, rows: [r] });
  });
  return groups;
}

/** Today from 8:00 to 20:00 with the booked stretches and the current time. */
function DayStrip({ bookings, now }) {
  const nowH = now.getHours() + now.getMinutes() / 60;
  const label = bookings.length
    ? `Hoy ocupado ${bookings.map((b) => `de ${b.timeStart} a ${b.timeEnd}`).join(', ')}`
    : 'Hoy sin reservas';
  return (
    <div className={styles.strip} role="img" aria-label={label}>
      <div className={styles.stripTrack}>
        {bookings.map((b) => (
          <i key={b.id} data-pending={b.status === 'pending' || undefined}
            style={{ left: pct(toH(b.timeStart)), width: `calc(${pct(toH(b.timeEnd))} - ${pct(toH(b.timeStart))})` }} />
        ))}
        {nowH >= DAY_START && nowH <= DAY_END && <b style={{ left: pct(nowH) }} />}
      </div>
      <div className={styles.stripScale} aria-hidden="true">
        <span>8:00</span><span>14:00</span><span>20:00</span>
      </div>
    </div>
  );
}

/**
 * Reservas on phones and tablets: your next booking as a ticket on the brand panel, then three
 * views — the resources with what is free and how today is booked, the agenda of bookings by day
 * (with filters, approvals and CSV) and the calendar. The form and the delete confirmation stay in
 * ReservationsPage.
 */
export default function ReservationsTouch({
  rooms, vehicles, reservations, user, busyUntil, initialView = 'resources',
  onBook, onNew, onApprove, onReject, onDelete, onAddToCalendar, onExport,
}) {
  const [view, setView] = useState(initialView);
  const [kind, setKind] = useState('room');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState(initialView === 'agenda' ? 'mine' : 'all');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const today = todayKey();
  const now = new Date();
  const isAdmin = user?.role === 'admin';

  const mineUpcoming = useMemo(() => reservations
    .filter((r) => r.employeeId === user?.id && active(r) && r.date >= today)
    .sort(byTime), [reservations, user?.id, today]);
  const next = mineUpcoming[0];
  const toApprove = reservations.filter((r) => r.status === 'pending').length;

  const freeRooms = rooms.filter((r) => !busyUntil('room', r.name)).length;
  const freeVehicles = vehicles.filter((v) => !busyUntil('vehicle', v.model)).length;

  // Resources of the chosen kind, with today's bookings of each
  const q = query.trim().toLowerCase();
  const resources = (kind === 'vehicle'
    ? vehicles.map((v) => ({
      id: v.id, type: 'vehicle', name: v.model, until: busyUntil('vehicle', v.model),
      meta: [v.type, v.year].filter(Boolean).join(' · '), tags: [], plate: v.plate,
    }))
    : rooms.map((r) => ({
      id: r.id, type: 'room', name: r.name, until: busyUntil('room', r.name),
      meta: [r.floor && `Planta ${r.floor}`, r.capacity && `${r.capacity} personas`].filter(Boolean).join(' · '),
      tags: Array.isArray(r.equipment) ? r.equipment : [],
    })))
    .map((res) => ({
      ...res,
      today: reservations
        .filter((b) => b.type === res.type && b.date === today && active(b)
          && (res.type === 'vehicle' ? (b.vehicleId ?? null) === res.id || (b.vehicleId == null && b.resourceName === res.name)
            : (b.roomId ?? null) === res.id || (b.roomId == null && b.resourceName === res.name)))
        .sort(byTime),
    }));
  const shown = q ? resources.filter((r) => [r.name, r.meta, r.plate, ...r.tags].filter(Boolean).join(' ').toLowerCase().includes(q)) : resources;

  // Agenda: every booking the person can see, filtered; upcoming ascending, past most recent first
  const agenda = reservations.filter((r) => (scope === 'all' || r.employeeId === user?.id)
    && (type === 'all' || r.type === type) && (status === 'all' || r.status === status));
  const upcoming = byDay(agenda.filter((r) => r.date >= today).sort(byTime));
  const past = byDay(agenda.filter((r) => r.date < today).sort((a, b) => byTime(b, a)));
  const countStatus = (s) => reservations.filter((r) => (scope === 'all' || r.employeeId === user?.id) && (type === 'all' || r.type === type) && (s === 'all' || r.status === s)).length;

  const openAgenda = (opts = {}) => {
    setView('agenda');
    if (opts.scope) setScope(opts.scope);
    if (opts.status) setStatus(opts.status);
  };

  const bookingItem = (r) => {
    const mine = r.employeeId === user?.id;
    const canCalendar = mine && active(r);
    const canDelete = isAdmin || mine;
    const canReview = isAdmin && r.status === 'pending';
    return (
      <FeedItem
        key={r.id}
        tone={r.type === 'vehicle' ? 'info' : 'accent'}
        lead={<TimeLead start={r.timeStart} end={r.timeEnd} />}
        title={r.resourceName}
        meta={[mine ? 'Tú' : r.employeeName, r.purpose].filter(Boolean).join(' · ')}
        status={STATUS[r.status]}
        details={[
          { label: 'Tipo', value: r.type === 'vehicle' ? 'Vehículo' : 'Sala' },
          { label: 'Solicitante', value: r.employeeName || '—' },
          { label: 'Fecha', value: fmtDayShort(r.date) },
          { label: 'Horario', value: `${r.timeStart}–${r.timeEnd}` },
          { label: 'Propósito', value: r.purpose, wide: true },
        ]}
        actions={(canReview || canCalendar || canDelete) ? (
          <>
            {canReview && <ItemAction icon={Check} tone="success" onClick={() => onApprove(r.id)}>Aprobar</ItemAction>}
            {canReview && <ItemAction icon={X} tone="danger" onClick={() => onReject(r.id)}>Rechazar</ItemAction>}
            {canCalendar && <ItemAction icon={CalendarPlus} tone="accent" onClick={() => onAddToCalendar(r)}>Añadir a mi calendario</ItemAction>}
            {canDelete && <ItemAction icon={Trash2} tone="danger" onClick={() => onDelete(r.id)}>Eliminar</ItemAction>}
          </>
        ) : undefined}
      />
    );
  };

  return (
    <div className={styles.page}>
      <Masthead
        icon={CalendarDays}
        eyebrow="Reservas"
        title="Salas y vehículos"
        desc="Mira qué está libre ahora, cómo va el día y reserva en segundos."
        aside={(
          <Ledger label="Disponibilidad ahora" items={[
            { label: 'Salas', value: `${freeRooms}/${rooms.length}`, tone: freeRooms ? 'success' : 'warning', hint: 'libres',
              onClick: () => { setView('resources'); setKind('room'); }, actionLabel: `${freeRooms} de ${rooms.length} salas libres. Ver salas` },
            { label: 'Vehículos', value: `${freeVehicles}/${vehicles.length}`, tone: freeVehicles ? 'success' : 'warning', hint: 'libres',
              onClick: () => { setView('resources'); setKind('vehicle'); }, actionLabel: `${freeVehicles} de ${vehicles.length} vehículos libres. Ver vehículos` },
            isAdmin
              ? { label: 'Pendientes', value: toApprove, tone: toApprove ? 'warning' : undefined, hint: 'por aprobar', onClick: () => openAgenda({ scope: 'all', status: 'pending' }), actionLabel: `${toApprove} reservas por aprobar. Ver agenda` }
              : { label: 'Tuyas', value: mineUpcoming.length, hint: 'próximas', onClick: () => openAgenda({ scope: 'mine' }), actionLabel: `${mineUpcoming.length} reservas próximas. Ver agenda` },
          ]} />
        )}
      />

      {/* Your next booking, as a ticket */}
      <Spotlight
        icon={CalendarClock}
        label={next ? (next.date === today ? 'Tu próxima reserva · hoy' : 'Tu próxima reserva') : 'Tus reservas'}
        ticket={!!next}
        className={styles.ticket}
        foot={next ? (
          <div className={styles.ticketFoot}>
            <span>{next.purpose || (next.type === 'vehicle' ? 'Uso de vehículo' : 'Reserva de sala')}</span>
            <span className={styles.ticketState} data-tone={STATUS[next.status]?.tone}>{STATUS[next.status]?.text}</span>
          </div>
        ) : undefined}
        actions={next ? (
          <>
            <SpotButton primary icon={CalendarPlus} onClick={() => onAddToCalendar(next)}>Añadir a mi calendario</SpotButton>
            <SpotButton icon={LayoutList} label="Ver mis reservas" onClick={() => openAgenda({ scope: 'mine' })} />
          </>
        ) : (
          <SpotButton primary icon={Plus} onClick={onNew}>Nueva reserva</SpotButton>
        )}
      >
        {next ? (
          <div className={styles.ticketBody}>
            <span className={styles.ticketIcon} aria-hidden="true">{next.type === 'vehicle' ? <Car size={20} /> : <Building2 size={20} />}</span>
            <div>
              <p className={styles.ticketName}>{next.resourceName}</p>
              <p className={styles.ticketWhen}>
                <strong>{next.timeStart}–{next.timeEnd}</strong>
                <span>{next.date === today ? 'Hoy' : dayTitle(next.date, today)}</span>
              </p>
            </div>
          </div>
        ) : (
          <p className={styles.ticketNone}>No tienes reservas próximas. Elige una sala o un vehículo libre y resérvalo en un momento.</p>
        )}
      </Spotlight>

      <TabStrip label="Vista" value={view} onChange={setView} className={styles.views} options={[
        { value: 'resources', label: 'Recursos', icon: Building2 },
        { value: 'agenda', label: 'Agenda', icon: LayoutList, count: isAdmin && toApprove ? toApprove : undefined },
        { value: 'calendar', label: 'Calendario', icon: CalendarDays },
      ]} />

      {view === 'resources' && (
        <section className={styles.view} aria-label="Recursos">
          {/* Rooms or vehicles, each with how many are free right now */}
          <div className={styles.kinds} role="group" aria-label="Tipo de recurso">
            {[
              { value: 'room', icon: Building2, label: 'Salas', free: freeRooms, total: rooms.length },
              { value: 'vehicle', icon: Car, label: 'Vehículos', free: freeVehicles, total: vehicles.length },
            ].map((k) => (
              <button key={k.value} type="button" aria-pressed={kind === k.value}
                className={clsx(styles.kind, kind === k.value && styles.kindOn)} onClick={() => { setKind(k.value); setQuery(''); }}>
                <LeafIcon icon={k.icon} tone={k.value === 'vehicle' ? 'info' : 'accent'} size={38} />
                <span>
                  <strong>{k.label}</strong>
                  <span>{k.total ? `${k.free} de ${k.total} libres` : 'Ninguno todavía'}</span>
                </span>
              </button>
            ))}
          </div>

          <Toolbar
            search={{ label: 'Buscar recurso', icon: Search, value: query, onChange: setQuery,
              placeholder: kind === 'vehicle' ? 'Modelo o matrícula' : 'Nombre o equipamiento' }}
            tools={<ToolButton icon={Plus} label="Nueva reserva" onClick={onNew} />}
          />

          {shown.length === 0 ? (
            <TouchEmpty icon={Search}
              title={q ? 'Sin resultados' : kind === 'vehicle' ? 'No hay vehículos' : 'No hay salas'}
              text={q ? `Nada coincide con «${query.trim()}». Prueba con otro nombre.` : 'Administración todavía no ha añadido ninguno.'}
              action={q ? <TouchButton onClick={() => setQuery('')}>Borrar búsqueda</TouchButton> : undefined} />
          ) : (
            <div className={styles.resources}>
              {shown.map((res) => (
                <article key={`${res.type}-${res.id}`} className={styles.resource}>
                  <div className={styles.resHead}>
                    <div className={styles.resName}>
                      <h3>{res.name}</h3>
                      <p>
                        {res.type === 'vehicle' ? <Car size={13} aria-hidden="true" /> : <MapPin size={13} aria-hidden="true" />}
                        {res.meta || (res.type === 'vehicle' ? 'Vehículo' : 'Sala')}
                      </p>
                    </div>
                    <span className={styles.avail} data-busy={res.until ? true : undefined}>
                      {res.until ? `En uso hasta ${res.until}` : 'Libre ahora'}
                    </span>
                  </div>

                  <DayStrip bookings={res.today} now={now} />

                  {(res.tags.length > 0 || res.plate) && (
                    <div className={styles.tags}>
                      {res.plate && <span className={styles.plate}>{res.plate}</span>}
                      {res.tags.map((t) => <span key={t}>{t}</span>)}
                    </div>
                  )}

                  <div className={styles.resActions}>
                    <span className={styles.resCount}>
                      <Users size={14} aria-hidden="true" />
                      {res.today.length ? `${res.today.length} ${res.today.length === 1 ? 'reserva' : 'reservas'} hoy` : 'Sin reservas hoy'}
                    </span>
                    <button type="button" className={styles.bookBtn} onClick={() => onBook(res.type, res.id)}
                      aria-label={`Reservar ${res.name}`}>
                      <Plus size={16} aria-hidden="true" /> Reservar
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {view === 'agenda' && (
        <section className={styles.view} aria-label="Agenda de reservas">
          <Toolbar
            groups={[
              { id: 'scope', label: 'De quién', value: scope, all: 'all', onChange: setScope, options: [
                { value: 'all', label: 'Todas' }, { value: 'mine', label: 'Mis reservas' },
              ] },
              { id: 'type', label: 'Recurso', value: type, all: 'all', onChange: setType, options: [
                { value: 'all', label: 'Salas y vehículos' }, { value: 'room', label: 'Salas' }, { value: 'vehicle', label: 'Vehículos' },
              ] },
              { id: 'status', label: 'Estado', value: status, all: 'all', onChange: setStatus, options: [
                { value: 'all', label: 'Todos', count: countStatus('all') },
                { value: 'pending', label: 'Pendientes', count: countStatus('pending') },
                { value: 'confirmed', label: 'Confirmadas', count: countStatus('confirmed') },
                { value: 'cancelled', label: 'Canceladas', count: countStatus('cancelled') },
              ] },
            ]}
            tools={agenda.length > 0 ? <ToolButton icon={Download} label="Descargar Excel" onClick={() => onExport(agenda)} /> : undefined}
          />

          {agenda.length === 0 ? (
            <TouchEmpty icon={CalendarDays} title="No hay reservas"
              text={scope === 'mine' && type === 'all' && status === 'all' ? 'Todavía no has reservado nada.' : 'Ninguna reserva coincide con estos filtros.'}
              action={<TouchButton primary icon={Plus} onClick={onNew}>Nueva reserva</TouchButton>} />
          ) : (
            <>
              {upcoming.length === 0 && (
                <TouchEmpty compact icon={CalendarDays} title="Nada por delante" text="No hay reservas próximas con estos filtros." />
              )}
              {upcoming.map((g) => (
                <FeedGroup key={g.date} title={dayTitle(g.date, today)} meta={`${g.rows.length} ${g.rows.length === 1 ? 'reserva' : 'reservas'}`}>
                  {g.rows.map(bookingItem)}
                </FeedGroup>
              ))}
              {past.length > 0 && (
                <Fold icon={CalendarClock} tone="neutral" title="Anteriores"
                  meta={`${past.reduce((s, g) => s + g.rows.length, 0)} reservas pasadas`}>
                  <div className={styles.pastGroups}>
                    {past.map((g) => (
                      <FeedGroup key={g.date} title={dayTitle(g.date, today)}>
                        {g.rows.map(bookingItem)}
                      </FeedGroup>
                    ))}
                  </div>
                </Fold>
              )}
            </>
          )}
        </section>
      )}

      {view === 'calendar' && (
        <section className={clsx(styles.view, styles.calendar)} aria-label="Calendario de reservas">
          <ReservationsCalendar />
        </section>
      )}
    </div>
  );
}
