import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarPlus, Car, DoorOpen, Home, Briefcase, Sun } from 'lucide-react';
import { useAuth, useRequests, useReservations, usePersonalDays } from '../context';
import { Avatar, Button, Card } from './ui';
import { downloadReservationIcs, localDateKey } from '../utils/ics';
import styles from './TodayPanel.module.scss';

const AWAY_KINDS = {
  remoto:          { label: 'En remoto',        icon: Home,      tone: 'info' },
  external:        { label: 'Trabajo externo',  icon: Briefcase, tone: 'accent' },
  asuntos_propios: { label: 'Asuntos propios',  icon: Sun,       tone: 'warning' },
};

/**
 * "Hoy en Margube" — who is working away from the office today
 * and the signed-in person's own bookings for the day.
 */
export function TodayPanel() {
  const navigate = useNavigate();
  const { user, employees = [] } = useAuth();
  const { requests = [] } = useRequests() || {};
  const { reservations = [] } = useReservations() || {};
  const { personalDays = [] } = usePersonalDays() || {};
  const today = localDateKey();

  const avatarFor = (id, name) =>
    employees.find(e => e.id === id)?.avatar ||
    (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const away = useMemo(() => {
    const fromRequests = requests
      .filter(r => r.status === 'approved' && (r.type === 'remoto' || r.type === 'external'))
      .filter(r => r.startDate && r.startDate <= today && (r.endDate || r.startDate) >= today)
      .map(r => ({ id: `r-${r.id}`, employeeId: r.employeeId, name: r.employeeName, kind: r.type }));
    const fromPersonal = personalDays
      .filter(p => p.status === 'approved' && p.date === today)
      .map(p => ({ id: `p-${p.id}`, employeeId: p.employeeId, name: p.employeeName, kind: 'asuntos_propios' }));
    // One row per person — a personal day outranks remote/external
    const byPerson = new Map();
    [...fromRequests, ...fromPersonal].forEach(a => byPerson.set(a.employeeId || a.id, a));
    return [...byPerson.values()].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'));
  }, [requests, personalDays, today]);

  const myToday = useMemo(() =>
    reservations
      .filter(r => r.employeeId === user?.id && r.date === today && r.status !== 'rejected')
      .sort((a, b) => (a.timeStart || '').localeCompare(b.timeStart || '')),
  [reservations, user?.id, today]);

  return (
    <Card className={styles.panel}>
      <section className={styles.col} aria-labelledby="today-away">
        <header className={styles.head}>
          <h3 id="today-away" className={styles.title}>Fuera de la oficina hoy</h3>
          <span className={styles.count}>{away.length}</span>
        </header>
        {away.length === 0 ? (
          <p className={styles.empty}>Todo el equipo trabaja hoy desde la oficina.</p>
        ) : (
          <ul className={`${styles.list} stagger-in`}>
            {away.map(a => {
              const kind = AWAY_KINDS[a.kind];
              const Icon = kind.icon;
              return (
                <li key={a.id} className={styles.person}>
                  <Avatar initials={avatarFor(a.employeeId, a.name)} size={30} />
                  <span className={styles.name}>{a.name || 'Empleado'}</span>
                  <span className={`status-chip status-chip--${kind.tone} ${styles.chip}`}>
                    <Icon size={12} aria-hidden="true" />{kind.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={styles.col} aria-labelledby="today-mine">
        <header className={styles.head}>
          <h3 id="today-mine" className={styles.title}>Tu agenda de hoy</h3>
          <span className={styles.count}>{myToday.length}</span>
        </header>
        {myToday.length === 0 ? (
          <div className={styles.emptyRow}>
            <p className={styles.empty}>No tienes salas ni vehículos reservados para hoy.</p>
            <Button variant="secondary" size="sm" onClick={() => navigate('/reservations?nueva=1')}>
              Reservar
            </Button>
          </div>
        ) : (
          <ul className={`${styles.list} stagger-in`}>
            {myToday.map(r => {
              const Icon = r.type === 'vehicle' ? Car : DoorOpen;
              return (
                <li key={r.id} className={styles.booking}>
                  <span className={styles.time}>{r.timeStart}<span>{r.timeEnd}</span></span>
                  <span className={styles.bookingBody}>
                    <span className={styles.name}><Icon size={14} aria-hidden="true" /> {r.resourceName}</span>
                    {r.purpose && <span className={styles.purpose}>{r.purpose}</span>}
                  </span>
                  <Button
                    variant="action-download"
                    size="sm"
                    iconOnly
                    icon={CalendarPlus}
                    onClick={() => downloadReservationIcs(r)}
                    title="Añadir a mi calendario"
                    aria-label={`Añadir ${r.resourceName} a mi calendario`}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Card>
  );
}
