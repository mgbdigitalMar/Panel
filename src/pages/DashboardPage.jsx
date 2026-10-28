import { useState, useMemo, useCallback } from 'react';
import { useAuth, useReservations, useRequests, useNews, useHours, usePersonalDays, useDocuments, useTheme } from '../context';
import { useNavigate } from 'react-router-dom';
import { Avatar, Badge, StatCard, Card, Button } from '../components/ui';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import styles from './DashboardPage.module.scss';
import {
  Users, Calendar, Inbox, Newspaper, Pin, Car, Building, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight,
  PartyPopper, CalendarPlus, FilePlus2, Timer,
  DoorOpen, Mail, FileText, TrendingUp, TrendingDown,
} from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { TodayPanel } from '../components/TodayPanel';
import DashboardGlass from './DashboardGlass';
import { LEAF_PATH, VEIN_PATH } from '../components/ui/Loader/Loader';
import { fmtDate, fmtDayShort, fmtRange, todayKey } from '../utils/format';
import { workdayProgress, greetingFor } from '../utils/workday';

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

/** Requests per month of `year`, with all 12 months (0 when empty). */
function buildRequestsByMonth(requests, year) {
  const map = {};
  MONTHS.forEach((m, i) => { map[i] = { mes: m, aprobadas: 0, pendientes: 0, rechazadas: 0 }; });
  requests.forEach(r => {
    const d = new Date(r.createdAt);
    if (d.getFullYear() !== year) return;
    const m = d.getMonth();
    if (r.status === 'approved')  map[m].aprobadas++;
    if (r.status === 'pending')   map[m].pendientes++;
    if (r.status === 'rejected')  map[m].rechazadas++;
  });
  return Object.values(map);
}

/** Reservations of a month (0-indexed) split into its calendar weeks. */
function buildReservationsByWeek(reservations, year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = [];
  let weekNum = 1;
  let d = 1;

  while (d <= daysInMonth) {
    const startDate = new Date(year, month, d);
    const dayOfWeek = startDate.getDay();
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const endDay = Math.min(d + daysUntilSunday, daysInMonth);

    const startStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const endStr   = `${year}-${String(month + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

    const count = reservations.filter(r => r.date >= startStr && r.date <= endStr).length;
    weeks.push({ semana: `Sem ${weekNum}`, reservas: count });

    weekNum++;
    d = endDay + 1;
  }

  return weeks;
}

// Theme tokens, so charts follow light/dark like the rest of the UI
const CHART_COLORS = {
  accent:  'var(--accent)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger:  'var(--danger)',
};

const REQUEST_LABELS = {
  asuntos_propios: 'Asuntos propios',
  remoto: 'Trabajo en remoto',
  external: 'Trabajo externo',
  purchase: 'Compra',
  compra: 'Compra',
};

const STATUS_LABELS = { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada' };

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className={styles.customTooltip}>
      {label && <p className={styles.tooltipLabel}>{label}</p>}
      {payload.map((entry, i) => (
        <div key={i} className={styles.tooltipRow}>
          <span className={styles.tooltipDot} style={{ background: entry.color }} />
          <span className={styles.tooltipName}>{entry.name}</span>
          <span className={styles.tooltipValue}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Section heading on the panel with an optional "Ver todo" link. */
function SectionHead({ id, title, action, onAction }) {
  return (
    <div className={styles.sectionHead}>
      <h2 id={id} className={styles.sectionTitle}>{title}</h2>
      {action && (
        <Button variant="ghost" size="sm" onClick={onAction}>
          {action} <ArrowRight size={14} aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

/** A small card in "Mis módulos": title row, hairline, content. */
function ModuleCard({ title, icon: Icon, tone, onOpen, openLabel, children }) {
  return (
    <Card className={styles.module} style={{ '--tone': tone }}>
      <div className={styles.moduleHead}>
        <span className={styles.moduleIcon} aria-hidden="true"><Icon size={16} /></span>
        <h3 className={styles.moduleTitle}>{title}</h3>
        {onOpen && (
          <button type="button" className={styles.moduleOpen} onClick={onOpen} aria-label={openLabel}>
            <ArrowUpRight size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className={styles.moduleBody}>{children}</div>
    </Card>
  );
}

export default function DashboardPage() {
  const { user, employees } = useAuth();
  const navigate = useNavigate();
  const { reservations } = useReservations();
  const { requests } = useRequests();
  const { news } = useNews();
  const { hourCompensations = [] } = useHours() || {};
  const { personalDays = [] } = usePersonalDays() || {};
  const { onboardingDocUrl } = useDocuments() || {};
  const { appearance } = useTheme() || {};

  const today = new Date();
  const currentYear = today.getFullYear();
  const todayStr = todayKey(today);

  const [chartMonth, setChartMonth] = useState(() => ({
    year:  currentYear,
    month: today.getMonth(),
  }));

  const prevMonth = useCallback(() => {
    setChartMonth(prev => {
      const d = new Date(prev.year, prev.month - 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }, []);

  const nextMonth = useCallback(() => {
    setChartMonth(prev => {
      const d = new Date(prev.year, prev.month + 1, 1);
      const now = new Date();
      if (d.getFullYear() > now.getFullYear() || (d.getFullYear() === now.getFullYear() && d.getMonth() > now.getMonth())) return prev;
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }, []);

  const [requestsYear, setRequestsYear] = useState(currentYear);
  const prevYear = useCallback(() => setRequestsYear(y => y - 1), []);
  const nextYear = useCallback(() => setRequestsYear(y => Math.min(y + 1, currentYear)), [currentYear]);
  const isCurrentYear = requestsYear === currentYear;

  const upcomingBirthdays = useMemo(() =>
    employees
      .filter(e => e.birthdate && !isNaN(new Date(e.birthdate).getTime()))
      .map(e => {
        const bd = new Date(e.birthdate);
        const thisYear = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
        const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        if (thisYear < midnight) thisYear.setFullYear(today.getFullYear() + 1);
        const diff = Math.round((thisYear - midnight) / (1000 * 60 * 60 * 24));
        return { ...e, daysLeft: diff, bdDisplay: thisYear.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 4)
  , [employees]); // eslint-disable-line react-hooks/exhaustive-deps

  // Requests and personal days; an employee only counts their own (same as the nav badge)
  const pendingCount = useMemo(() => [...requests, ...personalDays]
    .filter(r => r.status === 'pending' && (user?.role === 'admin' || r.employeeId === user?.id)).length,
  [requests, personalDays, user?.role, user?.id]);
  const requestsByMonth = useMemo(() => buildRequestsByMonth(requests, requestsYear), [requests, requestsYear]);
  const reservationsByWeek = useMemo(
    () => buildReservationsByWeek(reservations, chartMonth.year, chartMonth.month),
    [reservations, chartMonth]
  );

  const chartMonthLabel = useMemo(() => {
    const d = new Date(chartMonth.year, chartMonth.month, 1);
    return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
      .replace(/^./, c => c.toUpperCase());
  }, [chartMonth]);

  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return chartMonth.year === now.getFullYear() && chartMonth.month === now.getMonth();
  }, [chartMonth]);

  const resourceTypePie = useMemo(() => [
    { name: 'Salas',     value: reservations.filter(r => r.type === 'room').length,    fill: CHART_COLORS.accent   },
    { name: 'Vehículos', value: reservations.filter(r => r.type === 'vehicle').length, fill: CHART_COLORS.warning  },
  ], [reservations]);

  const tooltipStyle = {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    boxShadow: 'var(--shadow-md)',
    color: 'var(--text)',
    fontSize: 12,
    padding: '8px 12px',
  };

  const hour = today.getHours();
  const greeting = greetingFor(today);
  const dateLine = today.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    .replace(/^./, c => c.toUpperCase());
  const progress = workdayProgress(today);
  const motivations = hour < 13
    ? ['¡Buena jornada por delante!', 'Empieza el día con energía', 'El equipo te espera']
    : hour < 17
    ? ['Sigue así, ¡casi lo tienes!', 'La tarde avanza bien', '¡Gran trabajo hoy!']
    : ['El día fue productivo', '¡Buen trabajo hoy!', 'Descansa y recarga'];
  const motivation = motivations[today.getDate() % motivations.length];

  // KPI figures (StatCard animates the count itself)
  const todayResCount = reservations.filter(r => r.date === todayStr).length;
  const newsThisMonth = news.filter(n => {
    const d = new Date(n.date || n.createdAt);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
  }).length;

  const myUpcoming = useMemo(() =>
    reservations
      .filter(r => r.employeeId === user?.id && r.date >= todayStr && r.status !== 'rejected' && r.status !== 'cancelled')
      .sort((a, b) => (a.date + (a.timeStart || '')).localeCompare(b.date + (b.timeStart || '')))
      .slice(0, 3),
  [reservations, user?.id, todayStr]);

  const myRequests = useMemo(() => [
    ...requests.filter(r => r.employeeId === user?.id),
    ...personalDays.filter(p => p.employeeId === user?.id).map(p => ({ ...p, type: 'asuntos_propios', startDate: p.date, endDate: p.date })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3),
  [requests, personalDays, user?.id]);

  const hours = useMemo(() => {
    const mine = hourCompensations.filter(h => String(h.employeeId) === String(user?.id));
    const credit = mine.filter(h => (h.type === 'bolsa' || h.type === 'ya') && h.status === 'approved').reduce((s, h) => s + (Number(h.hours) || 0), 0);
    const pending = mine.filter(h => (h.type === 'bolsa' || h.type === 'ya') && h.status === 'pending').reduce((s, h) => s + (Number(h.hours) || 0), 0);
    const debt = mine.filter(h => h.type === 'debe').reduce((s, h) => s + (Number(h.hours) || 0), 0);
    return { balance: credit - debt, pending };
  }, [hourCompensations, user?.id]);

  const sortedNews = useMemo(() =>
    [...news].sort((a, b) => (b.pinned === true) - (a.pinned === true) || new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)),
  [news]);
  const featured = sortedNews[0];
  const moreNews = sortedNews.slice(1, 4);

  // Glass appearance: same data, laid out like the glass design (DashboardGlass)
  if (appearance === 'glass') {
    return (
      <DashboardGlass d={{
        user, employees, navigate, reservations, requests, news, todayStr,
        greeting, dateLine, motivation, progress, pendingCount, todayResCount, newsThisMonth,
        featured, moreNews, myUpcoming, myRequests, hours, upcomingBirthdays, resourceTypePie,
        requestsByMonth, requestsYear, prevYear, nextYear, isCurrentYear,
        reservationsByWeek, chartMonthLabel, prevMonth, nextMonth, isCurrentMonth, chartMonth,
        onboardingDocUrl, REQUEST_LABELS, STATUS_LABELS,
      }} />
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.heroDate}>{dateLine}</p>
          <h1 className={styles.heroTitle}>{greeting}, {user?.name?.split(' ')[0]}</h1>
          <div className={styles.heroMeta}>
            <span>{motivation}</span>
            <span className={styles.heroDot} aria-hidden="true" />
            <span className={styles.workday}>
              Jornada
              <span
                className={styles.workdayTrack}
                role="progressbar"
                aria-label="Progreso de jornada laboral"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
              >
                <motion.span
                  className={styles.workdayBar}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: progress / 100 }}
                  transition={{ duration: 0.9, ease: [0.23, 1, 0.32, 1], delay: 0.15 }}
                />
              </span>
              <strong>{Math.round(progress)}%</strong>
            </span>
          </div>
        </div>
        <div className={styles.heroActions}>
          <Button variant="secondary" icon={FilePlus2} onClick={() => navigate('/requests?nueva=1')}>
            Nueva solicitud
          </Button>
          <Button variant="primary" icon={CalendarPlus} onClick={() => navigate('/reservations?nueva=1')}>
            Nueva reserva
          </Button>
        </div>
      </header>

      <div className={clsx(styles.gridCards, 'stagger-quick')}>
        <StatCard
          label="Empleados activos"
          value={employees.length}
          icon={Users}
          color="var(--accent)"
          sub="Total en plantilla"
          onClick={() => navigate('/employees')}
          actionLabel={`${employees.length} empleados activos. Ver equipo`}
        />
        <StatCard
          label="Reservas hoy"
          value={todayResCount}
          icon={Calendar}
          color="var(--success)"
          sub="Salas y vehículos"
          onClick={() => navigate('/reservations')}
          actionLabel={`${todayResCount} reservas hoy. Ver reservas`}
        />
        <StatCard
          label="Solicitudes pendientes"
          value={pendingCount}
          icon={Inbox}
          color="var(--warning)"
          sub={pendingCount === 0 ? 'Todo revisado' : 'Requieren revisión'}
          onClick={() => navigate('/requests')}
          actionLabel={`${pendingCount} solicitudes pendientes. Ver solicitudes`}
        />
        <StatCard
          label="Noticias publicadas"
          value={news.length}
          icon={Newspaper}
          color="var(--info)"
          sub={newsThisMonth === 0 ? 'Ninguna este mes' : `${newsThisMonth} este mes`}
          onClick={() => navigate('/news')}
          actionLabel={`${news.length} noticias publicadas. Ver noticias`}
        />
      </div>

      {/* News + today */}
      <div className={styles.mainGrid}>
        <div className={styles.mainCol}>
          <section aria-labelledby="news-title">
            <SectionHead id="news-title" title="Noticias de hoy" action="Ver todas" onAction={() => navigate('/news')} />

            {featured ? (
              <article className={styles.featured}>
                <svg className={styles.featuredLeaf} viewBox="0 0 48 48" aria-hidden="true">
                  <motion.path
                    d={LEAF_PATH}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.8, ease: [0.65, 0, 0.35, 1], delay: 0.3 }}
                  />
                  <motion.path
                    d={VEIN_PATH}
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1, ease: [0.65, 0, 0.35, 1], delay: 1.4 }}
                  />
                </svg>
                <div className={styles.featuredBody}>
                  <div className={styles.featuredTags}>
                    <span className={styles.featuredTag}>{featured.type === 'event' ? 'Evento' : 'Noticia'}</span>
                    {featured.category && <span className={styles.featuredTag}>{featured.category}</span>}
                    {featured.pinned && <span className={styles.featuredTag}><Pin size={11} aria-hidden="true" /> Fijado</span>}
                  </div>
                  <h3 className={styles.featuredTitle}>{featured.title}</h3>
                  {featured.content && <p className={styles.featuredText}>{featured.content}</p>}
                  <div className={styles.featuredFoot}>
                    <span className={styles.featuredAuthor}>
                      <Avatar initials={featured.authorAvatar} size={26} />
                      {featured.authorName}
                    </span>
                    <time dateTime={featured.date}>{fmtDate(featured.date || featured.createdAt)}</time>
                    <button type="button" className={styles.featuredMore} onClick={() => navigate('/news')}>
                      Leer <ArrowRight size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            ) : (
              <Card className={styles.emptyCard}>
                <Newspaper size={20} aria-hidden="true" />
                <p>Todavía no hay noticias publicadas.</p>
              </Card>
            )}

            {moreNews.length > 0 && (
              <ul className={styles.newsList}>
                {moreNews.map(n => (
                  <li key={n.id}>
                    <button type="button" className={styles.newsRow} onClick={() => navigate('/news')}>
                      <span className={clsx(styles.newsDate, n.type === 'event' && styles.newsDateEvent)}>
                        <strong>{new Date(n.date || n.createdAt).getDate()}</strong>
                        <span>{new Date(n.date || n.createdAt).toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')}</span>
                      </span>
                      <span className={styles.newsRowText}>
                        <span className={styles.newsRowTitle}>
                          {n.pinned && <Pin size={11} aria-hidden="true" />} {n.title}
                        </span>
                        <span className={styles.newsRowMeta}>{n.type === 'event' ? 'Evento' : 'Noticia'} · {n.authorName}</span>
                      </span>
                      <ArrowRight size={15} className={styles.newsRowGo} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="modules-title">
            <SectionHead id="modules-title" title="Mis módulos" />
            <div className={clsx(styles.modules, 'stagger-quick')}>
              <ModuleCard title="Mis reservas" icon={Calendar} tone="var(--accent)" onOpen={() => navigate('/reservations')} openLabel="Ver mis reservas">
                {myUpcoming.length === 0 ? (
                  <div className={styles.moduleEmpty}>
                    <p>No tienes reservas próximas.</p>
                    <Button size="sm" variant="secondary" icon={CalendarPlus} onClick={() => navigate('/reservations?nueva=1')}>Reservar</Button>
                  </div>
                ) : (
                  <ul className={styles.moduleList}>
                    {myUpcoming.map(r => (
                      <li key={r.id}>
                        <span className={styles.rowIcon} data-type={r.type} aria-hidden="true">
                          {r.type === 'vehicle' ? <Car size={13} /> : <DoorOpen size={13} />}
                        </span>
                        <span className={styles.rowText}>
                          <span className={styles.rowTitle}>{r.resourceName}</span>
                          <span className={styles.rowMeta}>{r.date === todayStr ? 'Hoy' : fmtDayShort(r.date)} · {r.timeStart}–{r.timeEnd}</span>
                        </span>
                        {r.status === 'pending' && <span className={styles.statusDot} data-status="pending" title="Pendiente" />}
                      </li>
                    ))}
                  </ul>
                )}
              </ModuleCard>

              <ModuleCard title="Mis solicitudes" icon={Inbox} tone="var(--success)" onOpen={() => navigate('/requests')} openLabel="Ver mis solicitudes">
                {myRequests.length === 0 ? (
                  <div className={styles.moduleEmpty}>
                    <p>No has enviado solicitudes.</p>
                    <Button size="sm" variant="secondary" icon={FilePlus2} onClick={() => navigate('/requests?nueva=1')}>Nueva solicitud</Button>
                  </div>
                ) : (
                  <ul className={styles.moduleList}>
                    {myRequests.map(r => (
                      <li key={`${r.type === 'asuntos_propios' ? 'pd' : 'rq'}-${r.id}`}>
                        <span className={styles.statusDot} data-status={r.status} aria-hidden="true" />
                        <span className={styles.rowText}>
                          <span className={styles.rowTitle}>{REQUEST_LABELS[r.type] || 'Solicitud'}</span>
                          <span className={styles.rowMeta}>
                            {r.startDate ? fmtRange(r.startDate, r.endDate) : r.item || fmtDate(r.createdAt)} · {STATUS_LABELS[r.status] || r.status}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </ModuleCard>

              <ModuleCard title="Tiempo a compensar" icon={Timer} tone="var(--warning)" onOpen={() => navigate('/horas')} openLabel="Ver tiempo a compensar">
                <div className={styles.balance}>
                  <span className={clsx(styles.balanceValue, hours.balance < 0 && styles.balanceNegative)}>
                    {hours.balance >= 0 ? <TrendingUp size={18} aria-hidden="true" /> : <TrendingDown size={18} aria-hidden="true" />}
                    {hours.balance >= 0 ? '+' : ''}{hours.balance.toLocaleString('es-ES', { maximumFractionDigits: 1 })} h
                  </span>
                  <span className={styles.rowMeta}>{hours.balance >= 0 ? 'Saldo a favor' : 'Saldo deudor'}</span>
                  {hours.pending > 0 && (
                    <span className={styles.balancePending}>
                      {hours.pending.toLocaleString('es-ES', { maximumFractionDigits: 1 })} h pendientes de aprobar
                    </span>
                  )}
                </div>
              </ModuleCard>

              <ModuleCard title="Próximos cumpleaños" icon={PartyPopper} tone="var(--danger)">
                {upcomingBirthdays.length === 0 ? (
                  <p className={styles.moduleEmptyText}>Nadie ha añadido su fecha de nacimiento todavía.</p>
                ) : (
                  <ul className={styles.moduleList}>
                    {upcomingBirthdays.slice(0, 3).map(e => (
                      <li key={e.id}>
                        <Avatar initials={e.avatar} src={e.avatarUrl} size={28} />
                        <span className={styles.rowText}>
                          <span className={styles.rowTitle}>{e.name}</span>
                          <span className={styles.rowMeta}>{e.bdDisplay} · {e.dept}</span>
                        </span>
                        <span className={clsx(styles.daysChip, e.daysLeft <= 7 && styles.daysChipSoon)}>
                          {e.daysLeft === 0 ? <><PartyPopper size={12} aria-hidden="true" /> ¡Hoy!</> : `en ${e.daysLeft} d`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </ModuleCard>
            </div>
          </section>
        </div>

        {/* Right column */}
        <aside className={styles.sideCol} aria-label="Hoy en Margube">
          <SectionHead title="Hoy en Margube" />
          <TodayPanel />

          <Card className={styles.helpCard}>
            <h3 className={styles.helpTitle}>¿Necesitas ayuda?</h3>
            <p className={styles.helpText}>RRHH resuelve dudas de acceso, nóminas, permisos y documentos.</p>
            <a className={styles.helpAction} href="mailto:rrhh@margube.com?subject=Consulta%20desde%20la%20intranet">
              <Mail size={16} aria-hidden="true" /> Contactar con RRHH
            </a>
            {onboardingDocUrl && (
              <a className={styles.helpLink} href={onboardingDocUrl} target="_blank" rel="noopener noreferrer">
                <FileText size={16} aria-hidden="true" />
                <span>Normas internas de la empresa</span>
                <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            )}
          </Card>
        </aside>
      </div>

      <section aria-labelledby="activity-title">
        <SectionHead id="activity-title" title="Actividad" />
        <div className={styles.chartsRow}>
          <Card className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <div>
                <h3 className={styles.chartTitle}>Solicitudes por mes</h3>
                <span className={styles.chartSub}>{requestsYear}</span>
              </div>
              <div className={styles.monthNav}>
                <Button variant="ghost" size="sm" iconOnly icon={ChevronLeft} onClick={prevYear} title="Año anterior" />
                <Button variant="ghost" size="sm" iconOnly icon={ChevronRight} onClick={nextYear} disabled={isCurrentYear} title="Año siguiente" />
              </div>
            </div>
            <div className={styles.chartLegend}>
              <span className={styles.legendDot} style={{ '--dot-bg': CHART_COLORS.success }} />Aprobadas
              <span className={styles.legendDot} style={{ '--dot-bg': CHART_COLORS.warning }} />Pendientes
              <span className={styles.legendDot} style={{ '--dot-bg': CHART_COLORS.danger }}  />Rechazadas
            </div>
            <div className={styles.chartBody}>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={requestsByMonth} barSize={9} barGap={3} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--text-mut)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-mut)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(var(--accent-rgb), 0.06)' }} />
                  <Bar dataKey="aprobadas"  fill={CHART_COLORS.success} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pendientes" fill={CHART_COLORS.warning} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="rechazadas" fill={CHART_COLORS.danger}  radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <div>
                <h3 className={styles.chartTitle}>Uso de recursos</h3>
                <span className={styles.chartSub}>Salas vs vehículos</span>
              </div>
            </div>
            <div className={clsx(styles.chartBody, styles.donutBody)}>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={resourceTypePie} cx="50%" cy="50%" innerRadius={46} outerRadius={68} paddingAngle={4} dataKey="value">
                    {resourceTypePie.map((entry, i) => <Cell key={i} fill={entry.fill} stroke="none" />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className={styles.pieLegend}>
                {resourceTypePie.map(p => (
                  <div key={p.name} className={styles.pieLegendItem}>
                    <span className={styles.pieColor} style={{ '--dot-bg': p.fill }} />
                    <span>{p.name}</span>
                    <strong>{p.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <div>
                <h3 className={styles.chartTitle}>Reservas semanales</h3>
                <span className={styles.chartSub}>{chartMonthLabel}</span>
              </div>
              <div className={styles.monthNav}>
                <Button variant="ghost" size="sm" iconOnly icon={ChevronLeft} onClick={prevMonth} title="Mes anterior" />
                <Button variant="ghost" size="sm" iconOnly icon={ChevronRight} onClick={nextMonth} disabled={isCurrentMonth} title="Mes siguiente" />
              </div>
            </div>
            <div className={styles.chartBody}>
              <ResponsiveContainer width="100%" height={190}>
                <LineChart data={reservationsByWeek}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="semana" tick={{ fontSize: 11, fill: 'var(--text-mut)' }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-mut)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone" dataKey="reservas"
                    stroke={CHART_COLORS.accent} strokeWidth={2.5}
                    dot={{ r: 4, fill: CHART_COLORS.accent, strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: CHART_COLORS.accent, stroke: 'var(--card)', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </section>

      <section aria-labelledby="recent-title">
        <SectionHead id="recent-title" title="Reservas recientes" action="Ver todas" onAction={() => navigate('/reservations')} />
        <Card>
          <div className={styles.tableWrapper}>
            <table className="table">
              <thead>
                <tr>
                  {['Recurso', 'Tipo', 'Solicitante', 'Fecha', 'Horario', 'Estado'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="stagger-quick">
                {reservations.slice(0, 6).map(r => {
                  const isToday = r.date === todayStr;
                  return (
                    <tr key={r.id} className={clsx({ [styles.rowToday]: isToday })}>
                      <td data-label="Recurso" className={styles.tdBold}>
                        {r.resourceName}
                        {isToday && <span className={styles.todayBadge}>hoy</span>}
                      </td>
                      <td data-label="Tipo">
                        <span className={clsx(styles.typeBadge, r.type === 'vehicle' ? styles.typeBadgeVehicle : styles.typeBadgeRoom)}>
                          {r.type === 'vehicle' ? <Car size={13} /> : <Building size={13} />}
                          {r.type === 'vehicle' ? 'Vehículo' : 'Sala'}
                        </span>
                      </td>
                      <td data-label="Solicitante">{r.employeeName}</td>
                      <td data-label="Fecha" className={styles.nowrap}>{fmtDayShort(r.date)}</td>
                      <td data-label="Horario" className={styles.nowrap}>{r.timeStart}–{r.timeEnd}</td>
                      <td data-label="Estado"><Badge status={r.status} /></td>
                    </tr>
                  );
                })}
                {reservations.length === 0 && (
                  <tr><td colSpan={6} className={styles.tableEmpty}>Todavía no hay reservas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}
