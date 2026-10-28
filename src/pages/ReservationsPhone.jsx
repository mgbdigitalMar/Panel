import { useMemo, useState } from 'react';
import { Building2, Car, Search, CalendarDays, Plus, ChevronLeft, Check, X, Trash2, CalendarPlus } from 'lucide-react';
import { Button } from '../components/ui';
import {
  PhoneHeader, PillButton, Segmented, IconDisc, StatusPill, Row, PhoneCard, PhoneSectionTitle,
  STATUS_TONE, STATUS_TEXT,
} from '../components/PhoneKit';
import { fmtDayShort, todayKey } from '../utils/format';
import ReservationsCalendar from './ReservationsCalendar';
import styles from './ReservationsPhone.module.scss';

/**
 * Reservas on phones (glass): the app's ReservationsScreen — rooms or vehicles, a search box and
 * one card per resource with its calendar and the booking button; "Mis reservas" lists yours.
 * The booking form and the delete confirmation stay in ReservationsPage.
 */
export default function ReservationsPhone({
  rooms, vehicles, reservations, user, busyUntil, initialView = 'room',
  onBook, onApprove, onReject, onDelete, onAddToCalendar,
}) {
  const [view, setView] = useState(initialView);
  const [query, setQuery] = useState('');
  const today = todayKey();
  const isAdmin = user?.role === 'admin';

  const mine = useMemo(() => reservations
    .filter((r) => r.employeeId === user?.id && r.status !== 'cancelled' && r.status !== 'rejected')
    .sort((a, b) => (a.date + (a.timeStart || '')).localeCompare(b.date + (b.timeStart || ''))), [reservations, user?.id]);
  const upcoming = mine.filter((r) => r.date >= today);
  const toApprove = isAdmin ? reservations.filter((r) => r.status === 'pending') : [];

  const q = query.trim().toLowerCase();
  const resources = view === 'vehicle'
    ? vehicles.map((v) => ({
      id: v.id, type: 'vehicle', name: v.model, until: busyUntil('vehicle', v.model),
      meta: [v.type, v.year].filter(Boolean).join(' · '), tags: [v.plate].filter(Boolean),
    }))
    : rooms.map((r) => ({
      id: r.id, type: 'room', name: r.name, until: busyUntil('room', r.name),
      meta: [r.floor && `Planta ${r.floor}`, r.capacity && `${r.capacity} personas`].filter(Boolean).join(' · '),
      tags: r.equipment || [],
    }));
  const shown = q ? resources.filter((r) => [r.name, r.meta, ...r.tags].join(' ').toLowerCase().includes(q)) : resources;

  const reservationRow = (r, admin) => (
    <Row
      key={r.id}
      left={<IconDisc icon={r.type === 'vehicle' ? Car : Building2} tone={r.type === 'vehicle' ? 'teal' : 'accent'} />}
      title={r.resourceName}
      subtitle={`${admin ? `${r.employeeName} · ` : ''}${r.date === today ? 'Hoy' : fmtDayShort(r.date)} · ${r.timeStart}–${r.timeEnd}`}
      right={<StatusPill tone={STATUS_TONE[r.status]}>{STATUS_TEXT[r.status] || r.status}</StatusPill>}
    >
      <span className={styles.actions}>
        {r.purpose && <span className={styles.purpose}>{r.purpose}</span>}
        {admin && r.status === 'pending' && (
          <>
            <Button variant="action-success" iconOnly icon={Check} onClick={() => onApprove(r.id)} title="Aprobar" />
            <Button variant="action-danger" iconOnly icon={X} onClick={() => onReject(r.id)} title="Rechazar" />
          </>
        )}
        {!admin && (
          <Button variant="action-download" iconOnly icon={CalendarPlus} onClick={() => onAddToCalendar(r)}
            title="Añadir a mi calendario" aria-label={`Añadir ${r.resourceName} a mi calendario`} />
        )}
        {(isAdmin || r.employeeId === user?.id) && (
          <Button variant="action-danger" iconOnly icon={Trash2} onClick={() => onDelete(r.id)} title="Eliminar" />
        )}
      </span>
    </Row>
  );

  if (view === 'calendar' || view === 'mine') {
    return (
      <div className={styles.page}>
        <PhoneHeader title={view === 'calendar' ? 'Calendario' : 'Mis reservas'}>
          <PillButton icon={ChevronLeft} onClick={() => setView('room')}>Recursos</PillButton>
        </PhoneHeader>
        {view === 'calendar' ? <ReservationsCalendar /> : (
          <>
            {toApprove.length > 0 && (
              <section className={styles.section}>
                <PhoneSectionTitle>Por aprobar</PhoneSectionTitle>
                {toApprove.map((r) => reservationRow(r, true))}
              </section>
            )}
            <section className={styles.section}>
              {toApprove.length > 0 && <PhoneSectionTitle>Tus reservas</PhoneSectionTitle>}
              {upcoming.length === 0 ? (
                <PhoneCard className={styles.empty}>
                  <IconDisc icon={CalendarDays} tone="neutral" size={46} />
                  <strong>Sin reservas próximas</strong>
                  <span>Reserva una sala o un vehículo desde Recursos.</span>
                </PhoneCard>
              ) : upcoming.map((r) => reservationRow(r, false))}
            </section>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <PhoneHeader title="Reservas">
        <PillButton icon={CalendarDays} onClick={() => setView('mine')}>
          Mis reservas ({upcoming.length}){toApprove.length > 0 && <span className={styles.dot} aria-label={`${toApprove.length} por aprobar`} />}
        </PillButton>
      </PhoneHeader>

      <Segmented label="Tipo de recurso" value={view} onChange={(v) => { setView(v); setQuery(''); }} options={[
        { value: 'room', label: `Salas · ${rooms.length}` },
        { value: 'vehicle', label: `Vehículos · ${vehicles.length}` },
      ]} />

      <label className={styles.search}>
        <span className={styles.srOnly}>Buscar recurso</span>
        <Search size={17} aria-hidden="true" />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder={view === 'vehicle' ? 'Buscar por modelo o matrícula' : 'Buscar por nombre o equipamiento'} />
      </label>

      {shown.length === 0 ? (
        <PhoneCard className={styles.empty}>
          <IconDisc icon={Search} tone="neutral" size={46} />
          <strong>{q ? 'Sin resultados' : view === 'vehicle' ? 'No hay vehículos' : 'No hay salas'}</strong>
          <span>{q ? 'Prueba con otro nombre.' : 'Administración todavía no ha añadido ninguno.'}</span>
        </PhoneCard>
      ) : shown.map((res) => (
        <PhoneCard key={`${res.type}-${res.id}`} className={styles.resource}>
          <div className={styles.resTop}>
            <IconDisc icon={res.type === 'vehicle' ? Car : Building2} tone={res.type === 'vehicle' ? 'teal' : 'accent'} />
            <div className={styles.resText}>
              <h2>{res.name}</h2>
              {res.meta && <p>{res.meta}</p>}
            </div>
            {res.until
              ? <StatusPill tone="amber">En uso · {res.until}</StatusPill>
              : <StatusPill tone="success">Libre</StatusPill>}
          </div>
          {res.tags.length > 0 && (
            <div className={styles.tags}>
              {res.tags.map((t) => <span key={t} className={res.type === 'vehicle' ? styles.plate : undefined}>{t}</span>)}
            </div>
          )}
          <div className={styles.resActions}>
            <PillButton onClick={() => setView('calendar')}>Ver calendario</PillButton>
            <PillButton primary icon={Plus} onClick={() => onBook(res.type, res.id)}>
              {res.type === 'vehicle' ? 'Reservar' : 'Reservar sala'}
            </PillButton>
          </div>
        </PhoneCard>
      ))}
    </div>
  );
}
