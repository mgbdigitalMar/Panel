import { useMemo, useState } from 'react';
import {
  Calendar, Car, DoorOpen, Timer, FilePlus2, CalendarPlus, Pin, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight,
  PartyPopper, Newspaper, BarChart3, Building, Mail, FileText, Home, Briefcase, ShoppingCart, Sun, LifeBuoy,
} from 'lucide-react';
import clsx from 'clsx';
import { Avatar } from '../components/ui';
import { TodayPanel } from '../components/TodayPanel';
import {
  Masthead, Ledger, Spotlight, SpotButton, ActionTiles, TabStrip, FeedGroup, FeedItem, Fold, BlockHead, TouchEmpty,
  TouchButton, LeafIcon, TimeLead, STATUS,
} from '../components/Touch';
import { fmtDate, fmtDayShort, fmtRange } from '../utils/format';
import { localISODate } from '../../shared/services/workMode.js';
import styles from './DashboardTouch.module.scss';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const REQUEST_ICON = {
  asuntos_propios: { icon: Sun, tone: 'warning' },
  remoto: { icon: Home, tone: 'info' },
  external: { icon: Briefcase, tone: 'purple' },
  purchase: { icon: ShoppingCart, tone: 'accent' },
  compra: { icon: ShoppingCart, tone: 'accent' },
};

const newestFirst = (a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt);
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));
const fmtHours = (h) => h.toLocaleString('es-ES', { maximumFractionDigits: 1 });

/** Index of the calendar week of the month that holds `dayNum` (same split as DashboardPage). */
function weekIndexOf(year, month, dayNum) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let d = 1;
  let i = 0;
  while (d <= daysInMonth) {
    const dow = new Date(year, month, d).getDay();
    const end = Math.min(d + (dow === 0 ? 0 : 7 - dow), daysInMonth);
    if (dayNum >= d && dayNum <= end) return i;
    d = end + 1;
    i++;
  }
  return -1;
}

/** Rows of thin horizontal bars: the label, the bar (stacked when there are several series), the total. */
function BarRows({ rows, series, label }) {
  const max = Math.max(1, ...rows.map((r) => series.reduce((s, k) => s + (r[k.key] || 0), 0)));
  return (
    <ul className={styles.bars} aria-label={label}>
      {rows.map((r) => {
        const total = series.reduce((s, k) => s + (r[k.key] || 0), 0);
        return (
          <li key={r.label} data-on={r.on || undefined}
            aria-label={`${r.label}: ${series.length > 1 ? series.map((k) => `${r[k.key] || 0} ${k.name.toLowerCase()}`).join(', ') : total}`}>
            <span className={styles.barLabel} aria-hidden="true">{r.label}</span>
            <span className={styles.barTrack} aria-hidden="true">
              {series.map((k) => (r[k.key] > 0 ? (
                <i key={k.key} style={{ width: `${(r[k.key] / max) * 100}%`, background: series.length > 1 ? k.color : undefined }} />
              ) : null))}
            </span>
            <strong aria-hidden="true">{total}</strong>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Inicio on phones and tablets: the greeting on the wallpaper, what you came to do in large tiles,
 * your agenda as a timeline, your balance and workday on the brand panel, the pinned story, the
 * company in figures, who is away, and the rest folded. Same data as DashboardGlass (DashboardPage).
 */
export default function DashboardTouch({ d }) {
  const {
    user, employees, navigate, reservations, news, todayStr,
    greeting, dateLine, motivation, progress, pendingCount, todayResCount, newsThisMonth,
    myUpcoming, myRequests, hours, upcomingBirthdays, resourceTypePie,
    requestsByMonth, requestsYear, prevYear, nextYear, isCurrentYear,
    reservationsByWeek, chartMonthLabel, prevMonth, nextMonth, isCurrentMonth, chartMonth,
    onboardingDocUrl, REQUEST_LABELS,
  } = d;
  const [range, setRange] = useState('week');
  const firstName = user?.name?.split(' ')[0];

  const pinnedNews = useMemo(() => news.filter((n) => n.pinned).sort(newestFirst).slice(0, 3), [news]);
  const recentNews = useMemo(() => news.filter((n) => !n.pinned).sort(newestFirst).slice(0, 4), [news]);

  const week = useMemo(() => {
    const mon = mondayOf(new Date());
    return WEEKDAYS.map((label, i) => {
      const iso = localISODate(addDays(mon, i));
      return { label, reservas: reservations.filter((r) => r.date === iso).length, on: iso === todayStr };
    });
  }, [reservations, todayStr]);

  const monthOn = isCurrentMonth ? weekIndexOf(chartMonth.year, chartMonth.month, new Date().getDate()) : -1;
  const activity = {
    week: { rows: week, series: [{ key: 'reservas', name: 'Reservas' }], sub: `${week.reduce((s, x) => s + x.reservas, 0)} reservas esta semana` },
    month: {
      rows: reservationsByWeek.map((x, i) => ({ ...x, label: x.semana, on: i === monthOn })),
      series: [{ key: 'reservas', name: 'Reservas' }],
      sub: chartMonthLabel,
      nav: { prev: prevMonth, next: nextMonth, nextDisabled: isCurrentMonth, prevLabel: 'Mes anterior', nextLabel: 'Mes siguiente' },
    },
    year: {
      rows: requestsByMonth.map((x) => ({ ...x, label: x.mes })),
      series: [
        { key: 'aprobadas', name: 'Aprobadas', color: 'var(--success)' },
        { key: 'pendientes', name: 'Pendientes', color: 'var(--warning)' },
        { key: 'rechazadas', name: 'Rechazadas', color: 'var(--danger)' },
      ],
      sub: `Solicitudes de ${requestsYear}`,
      nav: { prev: prevYear, next: nextYear, nextDisabled: isCurrentYear, prevLabel: 'Año anterior', nextLabel: 'Año siguiente' },
    },
  }[range];

  const totalUse = resourceTypePie.reduce((s, p) => s + p.value, 0);
  const lead = pinnedNews[0];
  const nextBirthday = upcomingBirthdays[0];

  return (
    <div className={styles.page}>
      <Masthead
        icon={Sun}
        eyebrow={dateLine}
        title={<>{greeting},<br />{firstName}</>}
        desc={motivation}
      />

      <ActionTiles className={styles.tiles} items={[
        { icon: FilePlus2, label: 'Nueva solicitud', hint: 'Días, remoto o compras', primary: true, onClick: () => navigate('/requests?nueva=1') },
        { icon: DoorOpen, label: 'Reservar sala', hint: 'Elige sala y horario', onClick: () => navigate('/reservations?nueva=1') },
        { icon: Car, label: 'Reservar vehículo', tone: 'info', hint: 'Coches y furgonetas', onClick: () => navigate('/reservations?nueva=1&tipo=vehicle') },
        { icon: Timer, label: 'Registrar horas', tone: 'warning', hint: 'Compensa o acumula', onClick: () => navigate('/horas?nueva=1') },
      ]} />

      <div className={styles.grid}>
        <div className={styles.colMain}>
          {/* Your agenda: next bookings as times, then your latest requests */}
          <section className={styles.agenda} aria-labelledby="touch-agenda">
            <span id="touch-agenda">
              <BlockHead title="Tu agenda" meta={myUpcoming.length ? `${myUpcoming.length} ${myUpcoming.length === 1 ? 'reserva próxima' : 'reservas próximas'}` : 'Sin reservas próximas'}
                action="Mis reservas" onAction={() => navigate('/reservations?mias=1')} />
            </span>
            {myUpcoming.length === 0 && myRequests.length === 0 ? (
              <TouchEmpty icon={Calendar} title="Agenda despejada" text="Cuando reserves una sala o envíes una solicitud aparecerá aquí."
                action={<TouchButton primary icon={CalendarPlus} onClick={() => navigate('/reservations?nueva=1')}>Reservar ahora</TouchButton>} />
            ) : (
              <>
                {myUpcoming.length > 0 && (
                  <FeedGroup title="Próximas reservas">
                    {myUpcoming.map((r) => (
                      <FeedItem key={r.id}
                        tone={r.type === 'vehicle' ? 'info' : 'accent'}
                        lead={<TimeLead start={r.timeStart} end={r.timeEnd} />}
                        title={r.resourceName}
                        meta={`${r.date === todayStr ? 'Hoy' : fmtDayShort(r.date)}${r.purpose ? ` · ${r.purpose}` : ''}`}
                        status={r.status === 'pending' ? STATUS.pending : undefined}
                        onClick={() => navigate('/reservations?mias=1')}
                      />
                    ))}
                  </FeedGroup>
                )}
                {myRequests.length > 0 && (
                  <FeedGroup title="Tus solicitudes" meta={<button type="button" className={styles.inlineLink} onClick={() => navigate('/requests')}>Ver todas</button>}>
                    {myRequests.map((r) => {
                      const t = REQUEST_ICON[r.type] || REQUEST_ICON.purchase;
                      return (
                        <FeedItem key={`${r.type === 'asuntos_propios' ? 'pd' : 'rq'}-${r.id}`}
                          lead={<LeafIcon icon={t.icon} tone={t.tone} />}
                          title={REQUEST_LABELS[r.type] || 'Solicitud'}
                          meta={r.startDate ? fmtRange(r.startDate, r.endDate) : r.item || fmtDate(r.createdAt)}
                          status={STATUS[r.status]}
                          onClick={() => navigate('/requests')}
                        />
                      );
                    })}
                  </FeedGroup>
                )}
              </>
            )}
          </section>

          {/* The pinned story leads; the other pinned ones are headlines under it */}
          {lead && (
            <section className={styles.pinned} aria-labelledby="touch-pinned">
              <span id="touch-pinned"><BlockHead title="Destacado" action="Noticias" onAction={() => navigate('/news')} /></span>
              <article className={styles.story}>
                <div className={styles.storyTags}>
                  <span className={styles.storyPin}><Pin size={11} aria-hidden="true" /> Fijada</span>
                  <span>{lead.type === 'event' ? 'Evento' : 'Noticia'}</span>
                  {lead.category && <span>{lead.category}</span>}
                </div>
                <h3>{lead.title}</h3>
                {lead.content && <p>{lead.content}</p>}
                <div className={styles.storyFoot}>
                  <span className={styles.storyAuthor}><Avatar initials={lead.authorAvatar} size={26} />{lead.authorName}</span>
                  <time dateTime={lead.date}>{fmtDate(lead.date || lead.createdAt)}</time>
                  <button type="button" onClick={() => navigate('/news')}>Leer <ArrowRight size={14} aria-hidden="true" /></button>
                </div>
              </article>
              {pinnedNews.slice(1).map((n) => (
                <button key={n.id} type="button" className={styles.headline} onClick={() => navigate('/news')}>
                  <Pin size={13} aria-hidden="true" />
                  <span>{n.title}</span>
                  <ArrowUpRight size={15} aria-hidden="true" />
                </button>
              ))}
            </section>
          )}
        </div>

        <div className={styles.colSide}>
          {/* Your balance with the company and the workday, on the brand panel */}
          <Spotlight icon={Timer} label="Tu tiempo" className={styles.spot}
            foot={(
              <div className={styles.meter}>
                <span>Jornada de hoy</span>
                <strong>{Math.round(progress)}%</strong>
                <span className={styles.meterTrack} aria-hidden="true"><i style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></span>
              </div>
            )}
            actions={<SpotButton primary icon={ArrowUpRight} onClick={() => navigate('/horas')}>Tiempo a compensar</SpotButton>}>
            <p className={clsx(styles.balance, hours.balance < 0 && styles.balanceNeg)}>
              {hours.balance >= 0 ? '+' : ''}{fmtHours(hours.balance)}<small> h</small>
            </p>
            <p className={styles.balanceSub}>
              {hours.balance >= 0 ? 'Saldo a tu favor' : 'Saldo deudor con la empresa'}
              {hours.pending > 0 && <> · <span>{fmtHours(hours.pending)} h por aprobar</span></>}
            </p>
          </Spotlight>

          <section className={styles.company} aria-labelledby="touch-company">
            <span id="touch-company"><BlockHead title="Margube hoy" /></span>
            <Ledger label="Margube hoy" items={[
              { label: 'Equipo', value: employees.length, hint: 'en plantilla', onClick: () => navigate('/employees'), actionLabel: `${employees.length} personas en plantilla. Ver equipo` },
              { label: 'Reservas', value: todayResCount, hint: 'para hoy', onClick: () => navigate('/reservations'), actionLabel: `${todayResCount} reservas hoy. Ver reservas` },
              { label: 'Pendientes', value: pendingCount, tone: pendingCount ? 'warning' : undefined, hint: pendingCount ? 'por revisar' : 'todo revisado', onClick: () => navigate('/requests'), actionLabel: `${pendingCount} solicitudes pendientes. Ver solicitudes` },
              { label: 'Noticias', value: news.length, hint: newsThisMonth ? `${newsThisMonth} este mes` : 'ninguna este mes', onClick: () => navigate('/news'), actionLabel: `${news.length} noticias. Ver noticias` },
            ]} />
          </section>

          <div className={styles.away}><TodayPanel /></div>
        </div>
      </div>

      {/* The rest, folded until it is wanted */}
      <div className={styles.folds}>
        <Fold icon={BarChart3} title="Actividad" meta={activity.sub}>
          <div className={styles.activityTools}>
            <TabStrip label="Periodo" value={range} onChange={setRange} options={[
              { value: 'week', label: 'Semana' }, { value: 'month', label: 'Mes' }, { value: 'year', label: 'Año' },
            ]} />
            {activity.nav && (
              <span className={styles.nav}>
                <button type="button" onClick={activity.nav.prev} aria-label={activity.nav.prevLabel}><ChevronLeft size={18} aria-hidden="true" /></button>
                <button type="button" onClick={activity.nav.next} disabled={activity.nav.nextDisabled} aria-label={activity.nav.nextLabel}><ChevronRight size={18} aria-hidden="true" /></button>
              </span>
            )}
          </div>
          {range === 'year' && (
            <p className={styles.legend}>
              {activity.series.map((k) => <span key={k.key}><i style={{ background: k.color }} />{k.name}</span>)}
            </p>
          )}
          <BarRows rows={activity.rows} series={activity.series} label={activity.sub} />
        </Fold>

        <Fold icon={PartyPopper} tone="warning" title="Cumpleaños"
          meta={nextBirthday ? `${nextBirthday.name} · ${nextBirthday.daysLeft === 0 ? '¡hoy!' : `en ${nextBirthday.daysLeft} días`}` : 'Sin fechas todavía'}>
          {upcomingBirthdays.length === 0 ? (
            <p className={styles.foldEmpty}>Nadie ha añadido su fecha de nacimiento todavía.</p>
          ) : (
            <ul className={styles.people}>
              {upcomingBirthdays.map((e) => (
                <li key={e.id}>
                  <Avatar initials={e.avatar} src={e.avatarUrl} size={34} />
                  <span><strong>{e.name}</strong><span>{e.bdDisplay}</span></span>
                  <em data-soon={e.daysLeft <= 7 || undefined}>{e.daysLeft === 0 ? '¡Hoy!' : `en ${e.daysLeft} d`}</em>
                </li>
              ))}
            </ul>
          )}
        </Fold>

        {recentNews.length > 0 && (
          <Fold icon={Newspaper} tone="info" title={pinnedNews.length ? 'Más noticias' : 'Noticias recientes'} meta={recentNews[0].title}>
            <ul className={styles.newsList}>
              {recentNews.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => navigate('/news')}>
                    <span className={styles.newsKind} data-event={n.type === 'event' || undefined}>{n.type === 'event' ? 'Evento' : 'Noticia'}</span>
                    <strong>{n.title}</strong>
                    <span>{fmtDate(n.date || n.createdAt)} · {n.authorName}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Fold>
        )}

        <Fold icon={Building} tone="purple" title="Uso de recursos"
          meta={resourceTypePie.map((p) => `${p.value} ${p.name.toLowerCase()}`).join(' · ')}>
          <div className={styles.split} aria-hidden="true">
            {totalUse > 0 && resourceTypePie.map((p) => <i key={p.name} style={{ flex: p.value, background: p.fill }} />)}
          </div>
          <ul className={styles.splitLegend}>
            {resourceTypePie.map((p) => (
              <li key={p.name}>
                <i style={{ background: p.fill }} />
                {p.name === 'Salas' ? <DoorOpen size={15} aria-hidden="true" /> : <Car size={15} aria-hidden="true" />}
                <span>{p.name}</span>
                <strong>{p.value}</strong>
                <em>{totalUse ? Math.round((p.value / totalUse) * 100) : 0}%</em>
              </li>
            ))}
          </ul>
        </Fold>

        <Fold icon={Calendar} title="Reservas recientes" meta={reservations.length ? `${reservations.length} en total` : 'Todavía no hay reservas'}>
          {reservations.length === 0 ? (
            <p className={styles.foldEmpty}>Todavía no hay reservas.</p>
          ) : (
            <ul className={styles.recent}>
              {reservations.slice(0, 6).map((r) => (
                <li key={r.id}>
                  {r.type === 'vehicle' ? <Car size={15} aria-hidden="true" /> : <DoorOpen size={15} aria-hidden="true" />}
                  <span>
                    <strong>{r.resourceName}{r.date === todayStr && <b className={styles.todayTag}>hoy</b>}</strong>
                    <span>{fmtDayShort(r.date)} · {r.timeStart}–{r.timeEnd} · {r.employeeName}</span>
                  </span>
                  <em data-tone={STATUS[r.status]?.tone}>{STATUS[r.status]?.text || r.status}</em>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className={styles.foldLink} onClick={() => navigate('/reservations')}>Ver todas las reservas <ArrowRight size={14} aria-hidden="true" /></button>
        </Fold>
      </div>

      {/* Help, as a line at the end */}
      <aside className={styles.help}>
        <LeafIcon icon={LifeBuoy} tone="neutral" size={38} />
        <span className={styles.helpText}>
          <strong>¿Necesitas ayuda?</strong>
          <span>RRHH resuelve dudas de acceso, nóminas, permisos y documentos.</span>
        </span>
        <span className={styles.helpActions}>
          <a href="mailto:rrhh@margube.com?subject=Consulta%20desde%20la%20intranet"><Mail size={16} aria-hidden="true" /> Contactar con RRHH</a>
          {onboardingDocUrl && (
            <a href={onboardingDocUrl} target="_blank" rel="noopener noreferrer" className={styles.helpGhost}>
              <FileText size={16} aria-hidden="true" /> Normas internas
            </a>
          )}
        </span>
      </aside>
    </div>
  );
}
