import { useState } from 'react';
import { Calendar, Car, DoorOpen, Timer, ArrowUpRight, Plus } from 'lucide-react';
import { Avatar } from './ui';
import { fmtDayShort } from '../utils/format';
import styles from './MobileHome.module.scss';

export function MobileHome({ d }) {
  const { user, greeting, dateLine, myUpcoming, navigate, todayStr } = d;
  const [current, setCurrent] = useState(0);
  return (
    <>
      <header className={styles.welcome}>
        <h1 className="sr-only">Inicio</h1>
        <button type="button" className={styles.account} onClick={() => navigate('/profile')} aria-label="Abrir mi perfil">
          <Avatar initials={user?.avatar} src={user?.avatarUrl} size={42} />
          <span><small>{greeting}</small><strong>{user?.name?.split(' ')[0]}</strong></span>
        </button>
        <p>{dateLine}</p>
      </header>
      <section aria-labelledby="mobile-upcoming">
        <div className={styles.sectionHead}>
          <h2 id="mobile-upcoming">Tus próximas reservas</h2>
          <button type="button" onClick={() => navigate('/reservations?mias=1')}>Ver todas</button>
        </div>
        <div className={styles.bookings}
          onScroll={(e) => setCurrent(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}>
          {myUpcoming.length ? myUpcoming.map((r, i) => {
            const Icon = r.type === 'vehicle' ? Car : DoorOpen;
            return (
              <button type="button" key={r.id} className={styles.booking} data-featured={i === 0 || undefined} onClick={() => navigate('/reservations?mias=1')}>
                <span className={styles.bookingDate}>{r.date === todayStr ? 'Hoy' : fmtDayShort(r.date)}<ArrowUpRight size={17} aria-hidden="true" /></span>
                <strong>{r.timeStart} – {r.timeEnd}</strong>
                <span className={styles.resource}><Icon size={19} aria-hidden="true" /><span>{r.resourceName}</span></span>
                <small>{r.status === 'pending' ? 'Pendiente de confirmar' : 'Confirmada'}{r.purpose ? ` · ${r.purpose}` : ''}</small>
              </button>
            );
          }) : (
            <button type="button" className={styles.emptyBooking} onClick={() => navigate('/reservations?nueva=1')}>
              <Calendar size={24} aria-hidden="true" />
              <span><strong>Tu próxima reserva empieza aquí</strong><small>Encuentra una sala o un vehículo disponible.</small></span>
              <Plus size={20} aria-hidden="true" />
            </button>
          )}
        </div>
        {myUpcoming.length > 1 && (
          <div className={styles.bookingDots} aria-hidden="true">
            {myUpcoming.map((r, i) => <i key={r.id} data-on={i === current || undefined} />)}
          </div>
        )}
      </section>
    </>
  );
}

export function MobileOverview({ d }) {
  const { hours, progress, navigate } = d;
  const formatted = hours.balance.toLocaleString('es-ES', { maximumFractionDigits: 1 });
  return (
    <section aria-labelledby="mobile-overview">
      <div className={styles.sectionHead}><h2 id="mobile-overview">Tu resumen de hoy</h2></div>
      <div className={styles.overview}>
        <div className={styles.summary}>
          <span><Calendar size={16} aria-hidden="true" />Tu jornada</span>
          <strong>{Math.round(progress)}<small>%</small></strong>
          <div className={styles.progress} role="progressbar" aria-label="Jornada de hoy" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>
          <small>De tu horario de hoy</small>
        </div>
        <button type="button" className={styles.summary} onClick={() => navigate('/horas')}>
          <span><Timer size={16} aria-hidden="true" />Bolsa de horas</span>
          <strong>{formatted}<small>h</small></strong>
          <small>{hours.pending ? `${hours.pending.toLocaleString('es-ES')} h por aprobar` : hours.balance < 0 ? 'Saldo deudor' : 'Saldo a tu favor'}</small>
          <ArrowUpRight size={17} className={styles.summaryArrow} aria-hidden="true" />
        </button>
      </div>
      <button type="button" className={styles.register} onClick={() => navigate('/horas?nueva=1')}><Timer size={18} aria-hidden="true" /><span>Registrar tiempo a compensar</span><Plus size={18} aria-hidden="true" /></button>
    </section>
  );
}
