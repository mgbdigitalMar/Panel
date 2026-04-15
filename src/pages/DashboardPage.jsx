import { useState } from 'react';
import { useAuth, useApp, useData } from '../context';
import { MOCK_NEWS } from '../data/mockData';
import { Avatar, Badge, StatCard, Card } from '../components/ui';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import styles from './DashboardPage.module.scss';
import { Users, Calendar, Inbox, Newspaper, Pin, Gift, Car, Building, ArrowRight } from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'framer-motion';

// ── Chart data helpers ────────────────────────────────────
const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function buildRequestsByMonth(requests) {
  const map = {};
  MONTHS.forEach((m, i) => { map[i] = { mes: m, aprobadas: 0, pendientes: 0, rechazadas: 0 }; });
  requests.forEach(r => {
    const m = new Date(r.createdAt).getMonth();
    if (r.status === 'approved')  map[m].aprobadas++;
    if (r.status === 'pending')   map[m].pendientes++;
    if (r.status === 'rejected')  map[m].rechazadas++;
  });
  return Object.values(map).slice(0, 6);
}

function buildReservationsByWeek(reservations) {
  return [
    { semana: 'Sem 1', reservas: reservations.filter(r => r.date <= '2025-01-07').length },
    { semana: 'Sem 2', reservas: reservations.filter(r => r.date > '2025-01-07' && r.date <= '2025-01-14').length },
    { semana: 'Sem 3', reservas: reservations.filter(r => r.date > '2025-01-14' && r.date <= '2025-01-21').length },
    { semana: 'Sem 4', reservas: reservations.filter(r => r.date > '2025-01-21').length },
  ];
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
  const { reservations, requests } = useData();
  const [news] = useState(MOCK_NEWS);

  const today = new Date();
  const upcomingBirthdays = employees
    .map(e => {
      const bd = new Date(e.birthdate);
      const thisYear = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
      if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1);
      const diff = Math.ceil((thisYear - today) / (1000 * 60 * 60 * 24));
      return { ...e, daysLeft: diff, bdDisplay: thisYear.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 4);

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const requestsByMonth = buildRequestsByMonth(requests);
  const reservationsByWeek = buildReservationsByWeek(reservations);

  const resourceTypePie = [
    { name: 'Salas',     value: reservations.filter(r => r.type === 'room').length,    fill: CHART_COLORS.accent   },
    { name: 'Vehículos', value: reservations.filter(r => r.type === 'vehicle').length, fill: CHART_COLORS.warning  },
  ];

  const hour = today.getHours();
  const greeting = hour < 13 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  const emoji    = hour < 13 ? '☀️' : hour < 20 ? '🌤️' : '🌙';
  const todayStr = today.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

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
          <div>
            <h2 className={styles.welcomeTitle}>
              {greeting}, {user?.name?.split(' ')[0]}
            </h2>
            <p className={styles.welcomeSub}>
              {todayStr.charAt(0).toUpperCase() + todayStr.slice(1)} · Todo bajo control en Margube
            </p>
          </div>
        </div>
        <div className={styles.welcomeActions}>
          <button className={styles.bannerBtn} onClick={() => navigate('reservations')}>
            <Calendar size={14} /> Nueva reserva
          </button>
          <button className={styles.bannerBtnSecondary} onClick={() => navigate('requests')}>
            <Inbox size={14} /> Ver solicitudes
          </button>
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
              <span className={styles.chartSub}>Ene – Jun 2025</span>
            </div>
            <div className={styles.chartLegend}>
              <span className={styles.legendDot} style={{ background: CHART_COLORS.success }} />Aprobadas
              <span className={styles.legendDot} style={{ background: CHART_COLORS.warning }} />Pendientes
              <span className={styles.legendDot} style={{ background: CHART_COLORS.danger }}  />Rechazadas
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
                  <span className={styles.pieColor} style={{ background: p.fill }} />
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
              <span className={styles.chartSub}>Enero 2025</span>
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
              <button onClick={() => navigate('news')} className={styles.viewAllBtn}>
                Ver todo <ArrowRight size={12} />
              </button>
            </div>
            <div className={styles.feedList}>
              {news.slice(0, 4).map(n => (
                <div key={n.id} className={styles.feedItem}>
                  <div className={styles.feedIcon} style={{
                    background: n.type === 'event' ? 'var(--warning-bg)' : 'var(--accent-bg)',
                    color: n.type === 'event' ? 'var(--warning)' : 'var(--accent)'
                  }}>
                    {n.type === 'event' ? <Calendar size={15} /> : <Newspaper size={15} />}
                  </div>
                  <div className={styles.feedContent}>
                    <div className={styles.feedTitleRow}>
                      {n.pinned && <Pin size={10} color="var(--accent)" />}
                      <p className={styles.feedTitle}>{n.title}</p>
                    </div>
                    <p className={styles.feedMeta}>{n.date} · {n.author}</p>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Gift size={15} color="#EC4899" />
                <h3 className={styles.sectionTitle} style={{ margin: 0 }}>Próximos cumpleaños</h3>
              </div>
            </div>
            <div className={styles.feedList}>
              {upcomingBirthdays.map(e => (
                <div key={e.id} className={styles.feedItem} style={{ alignItems: 'center' }}>
                  <Avatar initials={e.avatar} size={34} />
                  <div className={styles.feedContent}>
                    <p className={styles.feedTitle}>{e.name}</p>
                    <p className={styles.feedMeta}>{e.bdDisplay} · {e.dept}</p>
                  </div>
                  <span className={styles.daysChip} style={{
                    background: e.daysLeft <= 7 ? '#EC498918' : 'var(--accent-bg)',
                    color: e.daysLeft <= 7 ? '#EC4899' : 'var(--accent)',
                  }}>
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
              <button onClick={() => navigate('reservations')} className={styles.viewAllBtn}>
                Ver todo <ArrowRight size={12} />
              </button>
            </div>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
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
                    <td className={styles.tdBold}>{r.resourceName}</td>
                    <td>
                      <span className={styles.typeBadge} style={{ color: r.type === 'vehicle' ? 'var(--warning)' : 'var(--accent)' }}>
                        {r.type === 'vehicle' ? <Car size={13} /> : <Building size={13} />}
                        {r.type === 'vehicle' ? 'Vehículo' : 'Sala'}
                      </span>
                    </td>
                    <td>{r.employeeName}</td>
                    <td>{r.date}</td>
                    <td>{r.timeStart}–{r.timeEnd}</td>
                    <td><Badge status={r.status} /></td>
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
