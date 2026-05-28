import { useState, useMemo, useCallback } from 'react';
import { useAuth, useApp, useData } from '../context';
import { Avatar, Badge, StatCard, Card, Button } from '../components/ui';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import styles from './DashboardPage.module.scss';
import { Users, Calendar, Inbox, Newspaper, Pin, Gift, Car, Building, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'framer-motion';

// ── Chart data helpers ────────────────────────────────────
const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

/**
 * Groups requests by month for a given year.
 * Returns all 12 months (shows 0 for months with no data).
 */
function buildRequestsByMonth(requests, year) {
  const map = {};
  MONTHS.forEach((m, i) => { map[i] = { mes: m, aprobadas: 0, pendientes: 0, rechazadas: 0 }; });
  requests.forEach(r => {
    const d = new Date(r.createdAt);
    if (d.getFullYear() !== year) return;   // only this year
    const m = d.getMonth();
    if (r.status === 'approved')  map[m].aprobadas++;
    if (r.status === 'pending')   map[m].pendientes++;
    if (r.status === 'rejected')  map[m].rechazadas++;
  });
  return Object.values(map);
}

/**
 * Splits reservations of a given year/month into their calendar weeks.
 * @param {Array}  reservations  - full reservations array
 * @param {number} year
 * @param {number} month         - 0-indexed
 */
function buildReservationsByWeek(reservations, year, month) {
  // Get all days in the month
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build week buckets: each bucket = one Mon-Sun span that overlaps the month
  const weeks = [];
  let weekNum = 1;
  let d = 1;

  while (d <= daysInMonth) {
    // Find the Sunday that ends this week (or end of month)
    const startDate = new Date(year, month, d);
    const dayOfWeek = startDate.getDay(); // 0 Sun, 1 Mon...
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

const CHART_COLORS = {
  accent:  '#635BFF',
  success: '#059669',
  warning: '#D97706',
  danger:  '#DC2626',
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
};

export default function DashboardPage() {
  const { user, employees } = useAuth();
  const { navigate } = useApp();
  const { reservations, requests, news } = useData();

  // Month navigator — starts on the current real month
  const today = new Date();
  const currentYear = today.getFullYear();

  const [chartMonth, setChartMonth] = useState(() => ({
    year:  currentYear,
    month: today.getMonth(), // 0-indexed
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

  // Year navigator for requests chart — starts on current year
  const [requestsYear, setRequestsYear] = useState(currentYear);
  const prevYear = useCallback(() => setRequestsYear(y => y - 1), []);
  const nextYear = useCallback(() => setRequestsYear(y => Math.min(y + 1, currentYear)), [currentYear]);
  const isCurrentYear = requestsYear === currentYear;
  const upcomingBirthdays = useMemo(() => 
    employees
      .map(e => {
        const bd = new Date(e.birthdate);
        const thisYear = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
        if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1);
        const diff = Math.ceil((thisYear - today) / (1000 * 60 * 60 * 24));
        return { ...e, daysLeft: diff, bdDisplay: thisYear.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 4)
  , [employees]);

  const pendingCount = useMemo(() => requests.filter(r => r.status === 'pending').length, [requests]);
  const requestsByMonth = useMemo(() => buildRequestsByMonth(requests, requestsYear), [requests, requestsYear]);
  const reservationsByWeek = useMemo(
    () => buildReservationsByWeek(reservations, chartMonth.year, chartMonth.month),
    [reservations, chartMonth]
  );

  // Label for the chart subtitle
  const chartMonthLabel = useMemo(() => {
    const d = new Date(chartMonth.year, chartMonth.month, 1);
    return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
      .replace(/^./, c => c.toUpperCase()); // capitalize first letter
  }, [chartMonth]);

  // Is it already the current month? (disable next button)
  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return chartMonth.year === now.getFullYear() && chartMonth.month === now.getMonth();
  }, [chartMonth]);
  
  const resourceTypePie = useMemo(() => [
    { name: 'Salas',     value: reservations.filter(r => r.type === 'room').length,    fill: CHART_COLORS.accent   },
    { name: 'Vehículos', value: reservations.filter(r => r.type === 'vehicle').length, fill: CHART_COLORS.warning  },
  ], [reservations, CHART_COLORS]);

  const hour = today.getHours();
  const greeting = hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  const emoji    = hour < 13 ? '☀️' : hour < 20 ? '🌤️' : '🌙';
  const todayStr = today.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  // Calculate workday progress
  const currentMinutes = hour * 60 + today.getMinutes();
  const dayOfWeek = today.getDay(); // 0: Sunday, 6: Saturday
  let workdayProgress = 0;
  
  if (dayOfWeek !== 0 && dayOfWeek !== 6) {
    const workdayStart = 8 * 60; // 08:00
    const workdayEnd = dayOfWeek === 5 ? (14 * 60 + 30) : (17 * 60); // 14:30 on Friday, 17:00 otherwise
    if (currentMinutes >= workdayStart && currentMinutes <= workdayEnd) {
      workdayProgress = ((currentMinutes - workdayStart) / (workdayEnd - workdayStart)) * 100;
    } else if (currentMinutes > workdayEnd) {
      workdayProgress = 100;
    }
  }

const tooltipStyle = {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    boxShadow: 'var(--shadow-md)',
    color: 'var(--text)',
    fontSize: 12,
    padding: '8px 12px',
  };

  return (
    <motion.div
      className={styles.page}
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* ── Welcome Banner ──────────────────────── */}
      <motion.div variants={item} className={styles.welcomeBanner}>
        <div className={styles.welcomeLeft}>
          <span className={styles.welcomeEmoji}>{emoji}</span>
          <div className={styles.welcomeText}>
            <h2 className={styles.welcomeTitle}>
              {greeting}, {user?.name?.split(' ')[0]}
            </h2>
            <p className={styles.welcomeSub}>
              {todayStr.charAt(0).toUpperCase() + todayStr.slice(1)} · Todo bajo control en Margube
            </p>
            {/* Workday Progress Bar */}
            <div className={styles.progressContainer}>
              <div className={styles.progressText}>
                <span>Progreso de jornada laboral</span>
                <span>{Math.round(workdayProgress)}%</span>
              </div>
              <div className={styles.progressTrack}>
                <div className={styles.progressBar} style={{ width: `${workdayProgress}%` }} />
              </div>
            </div>
          </div>
        </div>
        <div className={styles.welcomeActions}>
          <Button variant="primary" onClick={() => navigate('reservations')} icon={Calendar}>
            Nueva reserva
          </Button>
          <Button variant="secondary" onClick={() => navigate('requests')} icon={Inbox}>
            Ver solicitudes
          </Button>
        </div>
      </motion.div>

      {/* ── KPI Cards ───────────────────────────────── */}
      <motion.div variants={item} className={styles.gridCards}>
        <StatCard
          label="Empleados activos"
          value={employees.length}
          icon="Users"
          color="var(--accent)"
          sub="Total en plantilla"
          trend="+2 este mes"
          trendUp={true}
        />
        <StatCard
          label="Reservas hoy"
          value={reservations.filter(r => r.date === '2025-01-20').length}
          icon="Calendar"
          color="var(--success)"
          sub="Salas y vehículos"
          trend="+15%"
          trendUp={true}
        />
        <StatCard
          label="Solicitudes pendientes"
          value={pendingCount}
          icon="Inbox"
          color="var(--warning)"
          sub="Requieren revisión"
          trend={pendingCount > 3 ? "Requiere atención" : "Bajo control"}
          trendUp={pendingCount <= 3}
        />
        <StatCard
          label="Noticias activas"
          value={news.length}
          icon="Newspaper"
          color="#EC4899"
          sub="Publicadas este mes"
          trend="Actualizado"
          trendUp={true}
        />
      </motion.div>

      {/* ── Charts ──────────────────────────────── */}
      <motion.div variants={item} className={styles.chartsRow}>
        {/* Bar chart */}
        <Card className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <div>
              <h3 className={styles.chartTitle}>Solicitudes por mes</h3>
              <span className={styles.chartSub}>{requestsYear}</span>
            </div>
            <div className={styles.chartHeaderActions}>
              <div className={styles.chartLegend}>
                <span className={styles.legendDot} style={{ '--dot-bg': CHART_COLORS.success }} />Aprobadas
                <span className={styles.legendDot} style={{ '--dot-bg': CHART_COLORS.warning }} />Pendientes
                <span className={styles.legendDot} style={{ '--dot-bg': CHART_COLORS.danger }}  />Rechazadas
              </div>
              <div className={styles.monthNav}>
                <Button
                  variant="ghost" size="sm" iconOnly icon={ChevronLeft}
                  onClick={prevYear}
                  aria-label="Año anterior"
                  title="Año anterior"
                />
                <Button
                  variant="ghost" size="sm" iconOnly icon={ChevronRight}
                  onClick={nextYear}
                  disabled={isCurrentYear}
                  aria-label="Año siguiente"
                  title="Año siguiente"
                />
              </div>
            </div>
          </div>
          <div className={styles.chartBody}>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={requestsByMonth} barSize={9} barGap={3} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--text-mut)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-mut)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--bg-3)' }} />
                <Bar dataKey="aprobadas"  fill={CHART_COLORS.success} radius={[4, 4, 0, 0]} />
                <Bar dataKey="pendientes" fill={CHART_COLORS.warning} radius={[4, 4, 0, 0]} />
                <Bar dataKey="rechazadas" fill={CHART_COLORS.danger}  radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Donut */}
        <Card className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <div>
              <h3 className={styles.chartTitle}>Uso de recursos</h3>
              <span className={styles.chartSub}>Salas vs Vehículos</span>
            </div>
          </div>
          <div className={clsx(styles.chartBody, styles.donutBody)}>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie
                  data={resourceTypePie}
                  cx="50%" cy="50%"
                  innerRadius={44} outerRadius={66}
                  paddingAngle={4} dataKey="value"
                >
                  {resourceTypePie.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
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

        {/* Line chart */}
        <Card className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <div>
              <h3 className={styles.chartTitle}>Reservas semanales</h3>
              <span className={styles.chartSub}>{chartMonthLabel}</span>
            </div>
            <div className={styles.monthNav}>
              <Button
                variant="ghost" size="sm" iconOnly icon={ChevronLeft}
                onClick={prevMonth}
                aria-label="Mes anterior"
                title="Mes anterior"
              />
              <Button
                variant="ghost" size="sm" iconOnly icon={ChevronRight}
                onClick={nextMonth}
                disabled={isCurrentMonth}
                aria-label="Mes siguiente"
                title="Mes siguiente"
              />
            </div>
          </div>
          <div className={styles.chartBody}>
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={reservationsByWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="semana" tick={{ fontSize: 11, fill: 'var(--text-mut)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-mut)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone" dataKey="reservas"
                  stroke={CHART_COLORS.accent} strokeWidth={2.5}
                  dot={{ r: 4, fill: CHART_COLORS.accent, strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: CHART_COLORS.accent }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </motion.div>

      {/* ── Content row ─────────────────────────── */}
      <motion.div variants={item} className={styles.gridContent}>
        {/* News feed */}
        <Card>
          <div className={styles.cardPad}>
            <div className={styles.cardHeader}>
              <h3 className={styles.sectionTitle}>Noticias y Eventos</h3>
              <Button variant="ghost" size="sm" onClick={() => navigate('news')}>
                Ver todo <ArrowRight size={14} />
              </Button>
            </div>
            <div className={styles.feedList}>
              {news.slice(0, 4).map(n => (
                <div key={n.id} className={styles.feedItem}>
                  <div className={clsx(styles.feedIcon, n.type === 'event' ? styles.feedIconEvent : styles.feedIconNews)}>
                    {n.type === 'event' ? <Calendar size={15} /> : <Newspaper size={15} />}
                  </div>
                  <div className={styles.feedContent}>
                    <div className={styles.feedTitleRow}>
                      {n.pinned && <Pin size={10} color="var(--accent)" />}
                      <p className={styles.feedTitle}>{n.title}</p>
                    </div>
                    <p className={styles.feedMeta}>{n.date} · {n.authorName}</p>
                  </div>
                  <Badge status={n.type} />
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Birthdays */}
        <Card>
          <div className={styles.cardPad}>
            <div className={clsx(styles.cardHeader)}>
              <div className={styles.birthdayHeader}>
                <Gift size={15} className={styles.birthdayIcon} />
                <h3 className={styles.sectionTitle}>Próximos cumpleaños</h3>
              </div>
            </div>
            <div className={styles.feedList}>
              {upcomingBirthdays.map(e => (
                <div key={e.id} className={clsx(styles.feedItem, styles.feedItemCentered)}>
                  <Avatar initials={e.avatar} size={34} />
                  <div className={styles.feedContent}>
                    <p className={styles.feedTitle}>{e.name}</p>
                    <p className={styles.feedMeta}>{e.bdDisplay} · {e.dept}</p>
                  </div>
                  <span className={clsx(styles.daysChip, e.daysLeft <= 7 ? styles.daysChipUrgent : styles.daysChipNormal)}>
                    {e.daysLeft === 0 ? '¡Hoy! 🎉' : `en ${e.daysLeft}d`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ── Recent reservations table ─────────── */}
      <motion.div variants={item}>
        <Card>
          <div className={styles.cardPad}>
            <div className={styles.cardHeader}>
              <h3 className={styles.sectionTitle}>Reservas recientes</h3>
              <Button variant="ghost" size="sm" onClick={() => navigate('reservations')}>
                Ver todo <ArrowRight size={14} />
              </Button>
            </div>
          </div>
          <div className={styles.tableWrapper}>
            <table className="table">
              <thead>
                <tr>
                  {['Recurso', 'Tipo', 'Solicitante', 'Fecha', 'Horario', 'Estado'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reservations.slice(0, 6).map(r => (
                  <tr key={r.id}>
                    <td data-label="Recurso" className={styles.tdBold}>{r.resourceName}</td>
                    <td data-label="Tipo">
                      <span className={clsx(styles.typeBadge, r.type === 'vehicle' ? styles.typeBadgeVehicle : styles.typeBadgeRoom)}>
                        {r.type === 'vehicle' ? <Car size={13} /> : <Building size={13} />}
                        {r.type === 'vehicle' ? 'Vehículo' : 'Sala'}
                      </span>
                    </td>
                    <td data-label="Solicitante">{r.employeeName}</td>
                    <td data-label="Fecha">{r.date}</td>
                    <td data-label="Horario">{r.timeStart}–{r.timeEnd}</td>
                    <td data-label="Estado"><Badge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
