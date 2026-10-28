import { useMemo, useState } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie } from 'recharts';
import {
  Users, Calendar, Inbox, Newspaper, Pin, Car, DoorOpen, Building, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight,
  PartyPopper, CalendarPlus, FilePlus2, Mail, FileText, TrendingUp, TrendingDown, Clock, BarChart3,
} from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { Avatar, Badge, StatCard, Card, Button } from '../components/ui';
import { TodayPanel } from '../components/TodayPanel';
import { LEAF_PATH, VEIN_PATH } from '../components/ui/Loader/Loader';
import { fmtDate, fmtDayShort, fmtRange } from '../utils/format';
import { localISODate } from '../../shared/services/workMode.js';
import styles from './DashboardGlass.module.scss';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const RANGES = [
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mes' },
  { id: 'year', label: 'Año' },
];

const newestFirst = (a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt);

const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));

/** Index of the calendar week (Sem 1, Sem 2…) that contains day `dayNum`, same split as buildReservationsByWeek. */
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

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tip}>
      {label && <p className={styles.tipLabel}>{label}</p>}
      {payload.map((p) => (
        <p key={p.dataKey} className={styles.tipRow}>
          <span style={{ background: p.payload?.[`${p.dataKey}Color`] || p.payload?.fill || p.color || 'var(--accent)' }} />
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

/** Workday ring (the "goals" ring of the design). */
function Ring({ value, size = 108, children }) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  return (
    <div className={styles.ring} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className={styles.ringTrack} strokeWidth="9" fill="none" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="9" strokeLinecap="round"
          stroke="url(#glassRing)" strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - value / 100) }}
          transition={{ duration: 1, ease: [0.23, 1, 0.32, 1], delay: 0.2 }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <defs>
          <linearGradient id="glassRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--warning)" />
            <stop offset="1" stopColor="#FF8A3D" />
          </linearGradient>
        </defs>
      </svg>
      <div className={styles.ringCenter}>{children}</div>
    </div>
  );
}

/**
 * Dashboard of the glass appearance: greeting, pinned news in front, KPIs with trend lines, a large
 * activity chart with Semana / Mes / Año, a "Hoy" column, workday, team, birthdays and the rest. Same data as the classic
 * dashboard: DashboardPage computes it and passes it in `d`.
 */
export default function DashboardGlass({ d }) {
  const {
    user, employees, navigate, reservations, requests, news, todayStr,
    greeting, dateLine, motivation, progress, pendingCount, todayResCount, newsThisMonth,
    myUpcoming, myRequests, hours, upcomingBirthdays, resourceTypePie,
    requestsByMonth, requestsYear, prevYear, nextYear, isCurrentYear,
    reservationsByWeek, chartMonthLabel, prevMonth, nextMonth, isCurrentMonth, chartMonth,
    onboardingDocUrl, REQUEST_LABELS, STATUS_LABELS,
  } = d;
  const [range, setRange] = useState('week');
  const today = new Date();

  // KPI trend lines: the last 7 days / 6 months, oldest first
  const sparks = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => localISODate(addDays(today, i - 6)));
    const months = Array.from({ length: 6 }, (_, i) => new Date(today.getFullYear(), today.getMonth() - 5 + i, 1));
    const sameMonth = (iso, m) => { const x = new Date(iso); return x.getFullYear() === m.getFullYear() && x.getMonth() === m.getMonth(); };
    return {
      reservations: days.map((day) => reservations.filter((r) => r.date === day).length),
      requests: days.map((day) => requests.filter((r) => (r.createdAt || '').slice(0, 10) === day).length),
      news: months.map((m) => news.filter((n) => sameMonth(n.date || n.createdAt, m)).length),
    };
  }, [reservations, requests, news, todayStr]); // eslint-disable-line react-hooks/exhaustive-deps

  // Semana: reservations per day of this week, today highlighted; and the change against last week
  const week = useMemo(() => {
    const mon = mondayOf(today);
    const data = WEEKDAYS.map((label, i) => {
      const iso = localISODate(addDays(mon, i));
      return { label, reservas: reservations.filter((r) => r.date === iso).length, today: iso === todayStr };
    });
    const lastMon = addDays(mon, -7);
    const lastWeek = reservations.filter((r) => r.date >= localISODate(lastMon) && r.date < localISODate(mon)).length;
    const thisWeek = data.reduce((s, x) => s + x.reservas, 0);
    return { data, thisWeek, lastWeek };
  }, [reservations, todayStr]); // eslint-disable-line react-hooks/exhaustive-deps

  const monthHighlight = isCurrentMonth ? weekIndexOf(chartMonth.year, chartMonth.month, today.getDate()) : -1;
  const delta = week.thisWeek - week.lastWeek;

  const chart = {
    week: {
      title: 'Reservas de la semana',
      sub: `${week.thisWeek} ${week.thisWeek === 1 ? 'reserva' : 'reservas'} esta semana`,
      data: week.data.map((x) => ({ ...x, reservasColor: x.today ? 'var(--accent)' : null })),
      bars: [{ key: 'reservas', name: 'Reservas' }],
      highlight: (x) => x.today,
    },
    month: {
      title: 'Reservas semanales',
      sub: chartMonthLabel,
      data: reservationsByWeek.map((x, i) => ({ ...x, label: x.semana, idx: i })),
      bars: [{ key: 'reservas', name: 'Reservas' }],
      highlight: (x) => x.idx === monthHighlight,
      nav: { prev: prevMonth, next: nextMonth, nextDisabled: isCurrentMonth, prevLabel: 'Mes anterior', nextLabel: 'Mes siguiente' },
    },
    year: {
      title: 'Solicitudes por mes',
      sub: String(requestsYear),
      data: requestsByMonth.map((x) => ({ ...x, label: x.mes })),
      bars: [
        { key: 'aprobadas', name: 'Aprobadas', color: 'var(--success)' },
        { key: 'pendientes', name: 'Pendientes', color: 'var(--warning)' },
        { key: 'rechazadas', name: 'Rechazadas', color: 'var(--danger)' },
      ],
      nav: { prev: prevYear, next: nextYear, nextDisabled: isCurrentYear, prevLabel: 'Año anterior', nextLabel: 'Año siguiente' },
    },
  }[range];

  const firstName = user?.name?.split(' ')[0];
  const chartEmpty = chart.data.every((x) => chart.bars.every((b) => !x[b.key]));
  const emptyText = {
    week: 'Todavía no hay reservas esta semana.',
    month: `Sin reservas en ${chartMonthLabel.toLowerCase()}.`,
    year: `Sin solicitudes en ${requestsYear}.`,
  }[range];

  // Pinned news lead the page; "Noticias recientes" lists the rest, so nothing shows twice
  const pinnedNews = useMemo(() => news.filter((n) => n.pinned).sort(newestFirst).slice(0, 3), [news]);
  const recentNews = useMemo(() => news.filter((n) => !n.pinned).sort(newestFirst).slice(0, 4), [news]);

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.date}>{dateLine}</p>
          <h1 className={styles.greeting}>{greeting}, {firstName}</h1>
          <p className={styles.meta}>{motivation}</p>
        </div>
        <div className={styles.heroActions}>
          <Button variant="secondary" icon={FilePlus2} onClick={() => navigate('/requests?nueva=1')}>Nueva solicitud</Button>
          <Button variant="primary" icon={CalendarPlus} onClick={() => navigate('/reservations?nueva=1')}>Nueva reserva</Button>
        </div>
      </header>

      {pinnedNews.length > 0 && (
        <section
          className={clsx(styles.pinned, pinnedNews.length === 1 && styles.pinnedOne, pinnedNews.length === 3 && styles.pinnedThree)}
          aria-label="Noticias fijadas"
        >
          {pinnedNews.map((n, i) => (
            <article key={n.id} className={clsx(styles.pinCard, i === 0 && styles.pinLead)}>
              <svg className={styles.pinLeaf} viewBox="0 0 48 48" aria-hidden="true">
                <path d={LEAF_PATH} />
                <path d={VEIN_PATH} />
              </svg>
              <div className={styles.pinTags}>
                <span className={styles.pinBadge}><Pin size={11} aria-hidden="true" /> Fijada</span>
                <span>{n.type === 'event' ? 'Evento' : 'Noticia'}</span>
                {n.category && <span>{n.category}</span>}
              </div>
              <h2 className={styles.pinTitle}>{n.title}</h2>
              {n.content && <p className={styles.pinText}>{n.content}</p>}
              <div className={styles.pinFoot}>
                <span className={styles.pinAuthor}>
                  <Avatar initials={n.authorAvatar} size={26} />
                  {n.authorName}
                </span>
                <time dateTime={n.date}>{fmtDate(n.date || n.createdAt)}</time>
                <button type="button" className={styles.pinMore} onClick={() => navigate('/news')}>
                  Leer <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      <div className={clsx(styles.kpis, 'stagger-quick')}>
        <StatCard label="Empleados activos" value={employees.length} icon={Users} color="var(--accent)" sub="Total en plantilla"
          onClick={() => navigate('/employees')} actionLabel={`${employees.length} empleados activos. Ver equipo`} />
        <StatCard label="Reservas hoy" value={todayResCount} icon={Calendar} color="var(--success)" sub="Salas y vehículos" spark={sparks.reservations}
          onClick={() => navigate('/reservations')} actionLabel={`${todayResCount} reservas hoy. Ver reservas`} />
        <StatCard label="Solicitudes pendientes" value={pendingCount} icon={Inbox} color="var(--warning)" sub={pendingCount === 0 ? 'Todo revisado' : 'Requieren revisión'} spark={sparks.requests}
          onClick={() => navigate('/requests')} actionLabel={`${pendingCount} solicitudes pendientes. Ver solicitudes`} />
        <StatCard label="Noticias publicadas" value={news.length} icon={Newspaper} color="var(--info)" sub={newsThisMonth === 0 ? 'Ninguna este mes' : `${newsThisMonth} este mes`} spark={sparks.news}
          onClick={() => navigate('/news')} actionLabel={`${news.length} noticias publicadas. Ver noticias`} />
      </div>

      <div className={styles.grid}>
        {/* Activity chart */}
        <Card className={clsx(styles.panel, styles.chartPanel)}>
          <div className={styles.panelHead}>
            <div>
              <h2 className={styles.panelTitle}>{chart.title}</h2>
              <p className={styles.panelSub}>{chart.sub}</p>
            </div>
            <div className={styles.chartTools}>
              {range === 'week' && (week.thisWeek > 0 || week.lastWeek > 0) && (
                <span className={clsx(styles.delta, delta < 0 && styles.deltaDown)}>
                  {delta >= 0 ? <TrendingUp size={13} aria-hidden="true" /> : <TrendingDown size={13} aria-hidden="true" />}
                  {delta >= 0 ? '+' : ''}{delta} vs semana pasada
                </span>
              )}
              {chart.nav && (
                <span className={styles.chartNav}>
                  <button type="button" onClick={chart.nav.prev} aria-label={chart.nav.prevLabel}><ChevronLeft size={16} aria-hidden="true" /></button>
                  <button type="button" onClick={chart.nav.next} disabled={chart.nav.nextDisabled} aria-label={chart.nav.nextLabel}><ChevronRight size={16} aria-hidden="true" /></button>
                </span>
              )}
              <div className={styles.segmented} role="tablist" aria-label="Periodo">
                {RANGES.map((r) => (
                  <button key={r.id} type="button" role="tab" aria-selected={range === r.id}
                    className={clsx(range === r.id && styles.segOn)} onClick={() => setRange(r.id)}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {chart.bars.length > 1 && !chartEmpty && (
            <div className={styles.legend}>
              {chart.bars.map((b) => <span key={b.key}><i style={{ background: b.color }} />{b.name}</span>)}
            </div>
          )}
          <div className={clsx(styles.chartBody, chartEmpty && styles.chartBodyEmpty)}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart.data} barCategoryGap={chart.bars.length > 1 ? '22%' : '28%'} barGap={3} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text-sec)' }} axisLine={false} tickLine={false} interval={0} />
                {/* Hidden, but recharts 3 needs it to scale the bars */}
                <YAxis hide allowDecimals={false} domain={[0, 'auto']} />
                {!chartEmpty && <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(var(--text-rgb), 0.05)', radius: 12 }} />}
                {!chartEmpty && chart.bars.map((b) => (
                  <Bar key={b.key} dataKey={b.key} name={b.name} radius={chart.bars.length > 1 ? [6, 6, 6, 6] : [14, 14, 14, 14]} maxBarSize={chart.bars.length > 1 ? 14 : 64}
                    fill={b.color || 'rgba(var(--text-rgb), 0.2)'} minPointSize={chart.bars.length > 1 ? 0 : 4}>
                    {chart.bars.length === 1 && chart.data.map((x, i) => (
                      <Cell key={i} fill={chart.highlight(x) ? 'var(--accent)' : 'rgba(var(--text-rgb), 0.2)'}
                        className={chart.highlight(x) ? styles.barGlow : undefined} />
                    ))}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
            {chartEmpty && (
              <div className={styles.chartEmpty} role="status">
                <BarChart3 size={22} aria-hidden="true" />
                <p>{emptyText}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Today: own reservations and requests (the hero already has the date and the create buttons) */}
        <Card className={clsx(styles.panel, styles.todayPanel)}>
          <div className={styles.panelHead}>
            <div>
              <h2 className={styles.panelTitle}>Hoy</h2>
              <p className={styles.panelSub}>Tus próximas reservas y solicitudes</p>
            </div>
            <button type="button" className={styles.iconLink} onClick={() => navigate('/reservations')} aria-label="Ver mis reservas">
              <ArrowUpRight size={16} aria-hidden="true" />
            </button>
          </div>
          {myUpcoming.length === 0 ? (
            <p className={styles.emptyLine}><Calendar size={15} aria-hidden="true" /> No tienes reservas próximas.</p>
          ) : (
            <ul className={styles.agenda}>
              {myUpcoming.map((r) => (
                <li key={r.id} data-type={r.type}>
                  <span className={styles.agendaIcon} aria-hidden="true">{r.type === 'vehicle' ? <Car size={14} /> : <DoorOpen size={14} />}</span>
                  <span className={styles.agendaText}>
                    <strong>{r.resourceName}</strong>
                    <span><Clock size={12} aria-hidden="true" /> {r.date === todayStr ? 'Hoy' : fmtDayShort(r.date)} · {r.timeStart}–{r.timeEnd}</span>
                  </span>
                  {r.status === 'pending' && <span className={styles.pending}>Pendiente</span>}
                </li>
              ))}
            </ul>
          )}

          <div className={styles.subHead}>
            <span>Tus solicitudes</span>
            <button type="button" onClick={() => navigate('/requests')}>Ver todas <ArrowRight size={13} aria-hidden="true" /></button>
          </div>
          {myRequests.length === 0 ? (
            <p className={styles.emptyLine}><Inbox size={15} aria-hidden="true" /> No has enviado solicitudes.</p>
          ) : (
            <ul className={styles.list}>
              {myRequests.map((r) => (
                <li key={`${r.type === 'asuntos_propios' ? 'pd' : 'rq'}-${r.id}`}>
                  <span className={styles.statusDot} data-status={r.status} aria-hidden="true" />
                  <span className={styles.listText}>
                    <strong>{REQUEST_LABELS[r.type] || 'Solicitud'}</strong>
                    <span>{r.startDate ? fmtRange(r.startDate, r.endDate) : r.item || fmtDate(r.createdAt)} · {STATUS_LABELS[r.status] || r.status}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Workday ring + hours balance (the only place the workday is shown in full) */}
        <Card className={clsx(styles.panel, styles.third)}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Tu jornada</h2>
            <button type="button" className={styles.iconLink} onClick={() => navigate('/horas')} aria-label="Ver tiempo a compensar">
              <ArrowUpRight size={16} aria-hidden="true" />
            </button>
          </div>
          <div className={styles.goalsBody}>
            <Ring value={progress}>
              <strong>{Math.round(progress)}%</strong>
              <span>jornada</span>
            </Ring>
            <div className={styles.goalsText}>
              <span className={styles.goalsLabel}>Tiempo a compensar</span>
              <span className={clsx(styles.balance, hours.balance < 0 && styles.balanceNeg)}>
                {hours.balance >= 0 ? '+' : ''}{hours.balance.toLocaleString('es-ES', { maximumFractionDigits: 1 })} h
              </span>
              <span className={styles.goalsHint}>{hours.balance >= 0 ? 'Saldo a favor' : 'Saldo deudor'}</span>
              {hours.pending > 0 && (
                <span className={styles.goalsPending}>{hours.pending.toLocaleString('es-ES', { maximumFractionDigits: 1 })} h pendientes de aprobar</span>
              )}
            </div>
          </div>
        </Card>

        {/* Team: who is away today */}
        <div className={clsx(styles.third, styles.teamPanel)}>
          <TodayPanel />
        </div>

        {/* Birthdays */}
        <Card className={clsx(styles.panel, styles.third, styles.birthdays)}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Cumpleaños</h2>
            <PartyPopper size={17} className={styles.headIcon} aria-hidden="true" />
          </div>
          {upcomingBirthdays.length === 0 ? (
            <p className={styles.emptyLine}>Nadie ha añadido su fecha de nacimiento todavía.</p>
          ) : (
            <ul className={styles.list}>
              {upcomingBirthdays.slice(0, 4).map((e) => (
                <li key={e.id}>
                  <Avatar initials={e.avatar} src={e.avatarUrl} size={30} />
                  <span className={styles.listText}>
                    <strong>{e.name}</strong>
                    <span>{e.bdDisplay}</span>
                  </span>
                  <span className={clsx(styles.days, e.daysLeft <= 7 && styles.daysSoon)}>
                    {e.daysLeft === 0 ? '¡Hoy!' : `en ${e.daysLeft} d`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Recent news (the pinned ones are at the top) */}
        <Card className={clsx(styles.panel, styles.newsPanel)}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>{pinnedNews.length ? 'Más noticias' : 'Noticias recientes'}</h2>
            <button type="button" className={styles.textLink} onClick={() => navigate('/news')}>Ver todas <ArrowRight size={13} aria-hidden="true" /></button>
          </div>
          {recentNews.length === 0 ? (
            <p className={styles.emptyLine}>
              <Newspaper size={15} aria-hidden="true" />
              {pinnedNews.length ? 'No hay más noticias aparte de las fijadas.' : 'Todavía no hay noticias publicadas.'}
            </p>
          ) : (
            <ul className={styles.list}>
              {recentNews.map((n) => (
                <li key={n.id}>
                  <button type="button" className={styles.newsRow} onClick={() => navigate('/news')}>
                    <span className={clsx(styles.newsDate, n.type === 'event' && styles.newsDateEvent)}>
                      <strong>{new Date(n.date || n.createdAt).getDate()}</strong>
                      <span>{new Date(n.date || n.createdAt).toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')}</span>
                    </span>
                    <span className={styles.listText}>
                      <strong>{n.title}</strong>
                      <span>{n.type === 'event' ? 'Evento' : 'Noticia'}{n.category ? ` · ${n.category}` : ''} · {n.authorName}</span>
                    </span>
                    <ArrowRight size={15} className={styles.newsGo} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Resource usage */}
        <Card className={clsx(styles.panel, styles.resources)}>
          <div className={styles.panelHead}>
            <div>
              <h2 className={styles.panelTitle}>Uso de recursos</h2>
              <p className={styles.panelSub}>Salas vs vehículos</p>
            </div>
          </div>
          <div className={styles.donut}>
            {/* Fixed size: a ResponsiveContainer measures 0 in a narrow flex row and draws nothing */}
            <PieChart width={120} height={120}>
              <Pie data={resourceTypePie} cx="50%" cy="50%" innerRadius={38} outerRadius={56} paddingAngle={4} dataKey="value" stroke="none">
                {resourceTypePie.map((p) => <Cell key={p.name} fill={p.fill} />)}
              </Pie>
              <Tooltip content={<ChartTip />} />
            </PieChart>
            <ul className={styles.donutLegend}>
              {resourceTypePie.map((p) => (
                <li key={p.name}>
                  <i style={{ background: p.fill }} />
                  {p.name === 'Salas' ? <Building size={14} aria-hidden="true" /> : <Car size={14} aria-hidden="true" />}
                  <span>{p.name}</span>
                  <strong>{p.value}</strong>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        {/* Help */}
        <Card className={clsx(styles.panel, styles.help)}>
          <h2 className={styles.panelTitle}>¿Necesitas ayuda?</h2>
          <p className={styles.panelSub}>RRHH resuelve dudas de acceso, nóminas, permisos y documentos.</p>
          <div className={styles.helpActions}>
            <a className={styles.helpPrimary} href="mailto:rrhh@margube.com?subject=Consulta%20desde%20la%20intranet">
              <Mail size={16} aria-hidden="true" /> Contactar con RRHH
            </a>
            {onboardingDocUrl && (
              <a className={styles.textLink} href={onboardingDocUrl} target="_blank" rel="noopener noreferrer">
                <FileText size={15} aria-hidden="true" /> Normas internas <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            )}
          </div>
        </Card>

        {/* Recent reservations */}
        <Card className={clsx(styles.panel, styles.tablePanel)}>
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Reservas recientes</h2>
            <button type="button" className={styles.textLink} onClick={() => navigate('/reservations')}>Ver todas <ArrowRight size={13} aria-hidden="true" /></button>
          </div>
          <div className={styles.tableWrap}>
            <table className="table">
              <thead>
                <tr>{['Recurso', 'Tipo', 'Solicitante', 'Fecha', 'Horario', 'Estado'].map((h) => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {reservations.slice(0, 6).map((r) => (
                  <tr key={r.id}>
                    <td data-label="Recurso" className={styles.tdBold}>
                      {r.resourceName}{r.date === todayStr && <span className={styles.todayChip}>hoy</span>}
                    </td>
                    <td data-label="Tipo">{r.type === 'vehicle' ? 'Vehículo' : 'Sala'}</td>
                    <td data-label="Solicitante">{r.employeeName}</td>
                    <td data-label="Fecha">{fmtDayShort(r.date)}</td>
                    <td data-label="Horario">{r.timeStart}–{r.timeEnd}</td>
                    <td data-label="Estado"><Badge status={r.status} /></td>
                  </tr>
                ))}
                {reservations.length === 0 && (
                  <tr><td colSpan={6} className={styles.tableEmpty}>Todavía no hay reservas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Phones: one compact row per reservation instead of the table */}
          <ul className={clsx(styles.agenda, styles.recentList)}>
            {reservations.slice(0, 6).map((r) => (
              <li key={r.id} data-type={r.type}>
                <span className={styles.agendaIcon} aria-hidden="true">{r.type === 'vehicle' ? <Car size={14} /> : <DoorOpen size={14} />}</span>
                <span className={styles.agendaText}>
                  <strong>{r.resourceName}{r.date === todayStr && <span className={styles.todayChip}>hoy</span>}</strong>
                  <span>{fmtDayShort(r.date)} · {r.timeStart}–{r.timeEnd} · {r.employeeName}</span>
                </span>
                <Badge status={r.status} />
              </li>
            ))}
            {reservations.length === 0 && <li className={styles.tableEmpty}>Todavía no hay reservas.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
