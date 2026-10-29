import { useMemo } from 'react';
import { Download, Plus, ChevronLeft, UsersRound, Inbox, CheckCircle, TrendingDown, Timer, CalendarRange, Search, History } from 'lucide-react';
import clsx from 'clsx';
import { Avatar } from '../components/ui';
import {
  Masthead, Spotlight, SpotButton, Toolbar, ToolButton, FeedGroup, FeedItem, ItemAction, Fold, TouchEmpty, TouchButton, DateStamp,
} from '../components/Touch';
import { fmtHM } from '../utils/format';
import styles from './HorasTouch.module.scss';

const TYPE = {
  ya:    { label: 'Inmediata', icon: CheckCircle,  tone: 'success' },
  bolsa: { label: 'Bolsa',     icon: Inbox,        tone: 'accent' },
  debe:  { label: 'Debo',      icon: TrendingDown, tone: 'danger' },
};
const STATE = { approved: 'Aprobada', rejected: 'Rechazada', pending: 'En revisión' };
const monthTitle = (iso) => new Date(`${String(iso).slice(0, 7)}-01T00:00`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
const dayText = (iso) => new Date(`${iso}T00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

/**
 * Heading of Tiempo a compensar on phones and tablets: the masthead and, on the records, your
 * balance on the brand panel with what was earned, owed and is in review. The form and the
 * team view get the masthead with the way back.
 */
export function HorasTouchHeader({ tab, setTab, isAdmin, rows, onExport, onExportTeam, canExportTeam, balance = 0, creditHours = 0, debtHours = 0, pendingHours = 0 }) {
  if (tab === 'nueva' || tab === 'usuarios') {
    const back = <TouchButton icon={ChevronLeft} onClick={() => setTab('bolsa')}>Mis horas</TouchButton>;
    return (
      <Masthead
        icon={Timer}
        eyebrow="Tiempo a compensar"
        title={tab === 'nueva' ? 'Registrar horas' : 'Saldo del equipo'}
        desc={tab === 'nueva' ? 'Compénsalas ya, acumúlalas en tu bolsa o registra las que debes.' : 'Horas a favor, pendientes y en deuda de cada persona.'}
        aside={(
          <div className={styles.headTools}>
            {back}
            {tab === 'usuarios' && canExportTeam && <ToolButton icon={Download} label="Descargar Excel completo" onClick={onExportTeam} />}
          </div>
        )}
      />
    );
  }
  const total = creditHours + debtHours + pendingHours;
  const share = (h) => (total > 0 ? h / total : 0);
  return (
    <>
      <Masthead
        icon={Timer}
        eyebrow="Tiempo a compensar"
        title="Tus horas"
        desc="Registra las horas que compensas, acumulas o debes y consulta tu saldo con la empresa."
      />
      <Spotlight icon={Timer} label="Tu saldo" className={styles.spot}
        foot={(
          <dl className={styles.parts}>
            <div><dt><i data-tone="success" />Ganadas</dt><dd>{fmtHM(creditHours, true)}</dd></div>
            <div><dt><i data-tone="danger" />Debo</dt><dd>{debtHours ? `−${fmtHM(debtHours)}` : '0:00'}</dd></div>
            <div><dt><i data-tone="warning" />En revisión</dt><dd>{fmtHM(pendingHours)}</dd></div>
          </dl>
        )}
        actions={(
          <>
            <SpotButton primary icon={Plus} onClick={() => setTab('nueva')}>Registrar horas</SpotButton>
            {isAdmin && <SpotButton icon={UsersRound} label="Saldo del equipo" onClick={() => setTab('usuarios')} />}
            {rows.length > 0 && <SpotButton icon={Download} label="Descargar Excel" onClick={onExport} />}
          </>
        )}>
        <p className={clsx(styles.balance, balance < 0 && styles.balanceNeg)}>
          {fmtHM(balance, true)}<small> h</small>
        </p>
        <p className={styles.balanceSub}>{balance < 0 ? 'Debes horas a la empresa.' : 'Saldo aprobado a tu favor.'}</p>
        <span className={styles.mix} aria-hidden="true">
          {total > 0 && (
            <>
              <i style={{ flex: share(creditHours) }} data-tone="success" />
              <i style={{ flex: share(debtHours) }} data-tone="danger" />
              <i style={{ flex: share(pendingHours) }} data-tone="warning" />
            </>
          )}
        </span>
      </Spotlight>
    </>
  );
}

/** Your records by month; each one opens with its details. A fold narrows them to a period. */
export function HorasTouchRecords({ rows, onRegister, from, to, setFrom, setTo }) {
  const groups = useMemo(() => {
    const out = [];
    rows.forEach((h) => {
      const key = String(h.date || '').slice(0, 7);
      const last = out[out.length - 1];
      if (last && last.key === key) last.rows.push(h);
      else out.push({ key, rows: [h] });
    });
    return out;
  }, [rows]);
  const filtering = !!(from || to);

  return (
    <div className={styles.records}>
      <Fold icon={CalendarRange} tone="neutral" title="Periodo" defaultOpen={filtering}
        meta={filtering ? `${from || 'inicio'} → ${to || 'hoy'}` : 'Todos tus registros'}>
        <div className={styles.period}>
          <label>
            <span>Desde</span>
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            <span>Hasta</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </label>
          {filtering && <TouchButton onClick={() => { setFrom(''); setTo(''); }}>Quitar</TouchButton>}
        </div>
      </Fold>

      {rows.length === 0 ? (
        <TouchEmpty icon={Timer}
          title={filtering ? 'Nada en este periodo' : 'Sin registros'}
          text={filtering ? 'No hay horas registradas entre esas fechas.' : 'Registra las horas que compensas, acumulas o debes.'}
          action={!filtering && <TouchButton primary icon={Plus} onClick={onRegister}>Registrar horas</TouchButton>} />
      ) : groups.map((g) => {
        const net = g.rows.reduce((s, h) => s + (h.type === 'debe' ? -h.hours : h.status === 'approved' ? h.hours : 0), 0);
        return (
          <FeedGroup key={g.key} title={monthTitle(g.key)} meta={`${fmtHM(net, true)} h`}>
            {g.rows.map((h) => {
              const t = TYPE[h.type] || TYPE.bolsa;
              const owed = h.type === 'debe';
              return (
                <FeedItem key={h.id}
                  tone={h.status === 'pending' ? 'warning' : undefined}
                  lead={<DateStamp iso={h.date} tone={t.tone} />}
                  title={h.reason || t.label}
                  meta={`${t.label} · ${STATE[h.status] || 'En revisión'}`}
                  trailing={<span className={owed ? styles.neg : styles.pos}>{owed ? '−' : '+'}{fmtHM(h.hours)}</span>}
                  details={[
                    { label: 'Tipo', value: t.label },
                    { label: 'Estado', value: STATE[h.status] || 'En revisión' },
                    { label: 'Día', value: h.date ? dayText(h.date) : '—' },
                    { label: 'Horas', value: `${owed ? '−' : '+'}${fmtHM(h.hours)} h` },
                    { label: 'Motivo', value: h.reason, wide: true },
                  ]}
                />
              );
            })}
          </FeedGroup>
        );
      })}
    </div>
  );
}

/** Admins: one row per person with the net balance; it opens with the split and the history. */
export function HorasTouchTeam({ stats, query, setQuery, onHistory }) {
  return (
    <div className={styles.records}>
      <Toolbar search={{ label: 'Buscar empleado', icon: Search, value: query, onChange: setQuery, placeholder: 'Empleado o departamento' }} />
      {stats.length === 0 ? (
        <TouchEmpty icon={UsersRound} title="No se encontraron empleados" text="Prueba con otro nombre o departamento." />
      ) : (
        <FeedGroup title="Por persona" meta={`${stats.length} ${stats.length === 1 ? 'persona' : 'personas'}`}>
          {stats.map((s) => {
            const initials = s.employee.avatar || s.employee.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
            return (
              <FeedItem key={s.employee.id}
                tone={s.pending > 0 ? 'warning' : undefined}
                lead={<Avatar initials={initials} src={s.employee.avatarUrl} size={40} />}
                title={s.employee.name}
                meta={s.employee.dept || 'Sin departamento'}
                trailing={<span className={s.balance < 0 ? styles.neg : styles.pos}>{fmtHM(s.balance, true)}</span>}
                details={[
                  { label: 'En bolsa', value: `${fmtHM(s.bolsa)} h` },
                  { label: 'Pendiente', value: `${fmtHM(s.pending)} h` },
                  { label: 'Debo', value: `${fmtHM(s.debe)} h` },
                  { label: 'Compensado', value: `${fmtHM(s.ya)} h` },
                ]}
                actions={<ItemAction icon={History} tone="accent" onClick={() => onHistory(s)}>Ver historial</ItemAction>}
              />
            );
          })}
        </FeedGroup>
      )}
    </div>
  );
}
