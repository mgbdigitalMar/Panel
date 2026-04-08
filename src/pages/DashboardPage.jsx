import { useState } from 'react';
import { useAuth, useApp, useData } from '../context';
import { MOCK_NEWS } from '../data/mockData';
import { Avatar, Badge, StatCard, Card } from '../components/ui';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import styles from './DashboardPage.module.scss';
import { Users, Calendar, Inbox, Newspaper, Pin, Gift, Car, Building } from 'lucide-react';
import clsx from 'clsx';

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
  return Object.values(map).slice(0, 6); // first 6 months
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
  accent:  '#8B5CF6',  // violet
  success: '#10B981',
  warning: '#F59E0B',
  danger:  '#EF4444',
};

export default function DashboardPage() {
  const { employees } = useAuth();
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
    { name: 'Salas',     value: reservations.filter(r => r.type === 'room').length,    fill: CHART_COLORS.accent  },
    { name: 'Vehículos', value: reservations.filter(r => r.type === 'vehicle').length, fill: CHART_COLORS.warning },
  ];

  const hourQuery = new Date().toLocaleDateString('es-ES', { hour: '2-digit', minute: '2-digit' }).split(' ')[2];
  const greetings = ['¡Buenos días', '¡Buenas tardes', '¡Buenas noches'];
  const hour = today.getHours();
  const greeting = hour < 13 ? greetings[0] : hour < 20 ? greetings[1] : greetings[2];

  const tooltipStyle = {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    color: 'var(--text)',
    fontSize: 12,
  };

  return (
    <div className={styles.page}>
      {/* Stat cards */}
      <div className={styles.gridCards}>
        <StatCard label="Empleados activos"      value={employees.length}   icon="Users"     color="var(--accent)"  sub="Total en plantilla"  />
        <StatCard label="Reservas hoy"           value={reservations.filter(r => r.date === '2025-01-20').length} icon="Calendar" color="var(--success)" sub="Salas y vehículos"  />
        <StatCard label="Solicitudes pendientes" value={pendingCount}        icon="Inbox"     color="var(--warning)" sub="Requieren revisión"  />
        <StatCard label="Noticias activas"       value={news.length}         icon="Newspaper" color="#EC4899"        sub="Publicadas este mes" />
      </div>

      {/* Charts row */}
      <div className={styles.chartsRow}>
        {/* Bar chart: Solicitudes por mes */}
        <Card className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Solicitudes por mes</h3>
            <span className={styles.chartSub}>Aprobadas · Pendientes · Rechazadas</span>
          </div>
          <div className={styles.chartBody}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={requestsByMonth} barSize={10} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--text-mut)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-mut)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="aprobadas"  fill={CHART_COLORS.success} radius={[4, 4, 0, 0]} />
                <Bar dataKey="pendientes" fill={CHART_COLORS.warning} radius={[4, 4, 0, 0]} />
                <Bar dataKey="rechazadas" fill={CHART_COLORS.danger}  radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Donut: Tipos de recurso */}
        <Card className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Uso de recursos</h3>
            <span className={styles.chartSub}>Salas vs Vehículos</span>
          </div>
          <div className={clsx(styles.chartBody, styles.donutBody)}>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={resourceTypePie} cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={4} dataKey="value">
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

        {/* Line chart: Reservas por semana */}
        <Card className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Reservas semanales</h3>
            <span className={styles.chartSub}>Enero 2025</span>
          </div>
          <div className={styles.chartBody}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={reservationsByWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="semana" tick={{ fontSize: 11, fill: 'var(--text-mut)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-mut)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="reservas" stroke={CHART_COLORS.accent} strokeWidth={2.5} dot={{ r: 4, fill: CHART_COLORS.accent }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Content row */}
      <div className={styles.gridContent}>
        {/* News feed */}
        <Card>
          <div style={{ padding: '18px 22px' }}>
            <div className={styles.cardHeader}>
              <h3 className={styles.feedTitle}>Noticias y Eventos</h3>
              <button onClick={() => navigate('news')} className={styles.viewAllBtn}>Ver todo</button>
            </div>
            <div className={styles.feedList}>
              {news.slice(0, 4).map(n => (
                <div key={n.id} className={styles.feedItem}>
                  <div className={styles.feedIcon} style={{
                    background: n.type === 'event' ? 'var(--warning-bg)' : 'var(--accent-bg)',
                    color: n.type === 'event' ? 'var(--warning)' : 'var(--accent)'
                  }}>
                    {n.type === 'event' ? <Calendar size={16} /> : <Newspaper size={16} />}
                  </div>
                  <div className={styles.feedContent}>
                    <div className={styles.feedTitleRow}>
                      {n.pinned && <Pin size={11} color="var(--accent)" />}
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
          <div style={{ padding: '18px 22px' }}>
            <div className={clsx(styles.cardHeader, styles.feedTitleRow)} style={{ marginBottom: 16 }}>
              <Gift size={16} color="#EC4899" />
              <h3 className={styles.feedTitle} style={{ margin: 0 }}>Próximos cumpleaños</h3>
            </div>
            <div className={styles.feedList}>
              {upcomingBirthdays.map(e => (
                <div key={e.id} className={styles.feedItem} style={{ alignItems: 'center' }}>
                  <Avatar initials={e.avatar} size={36} />
                  <div className={styles.feedContent}>
                    <p className={styles.feedTitle}>{e.name}</p>
                    <p className={styles.feedMeta}>{e.bdDisplay} · {e.dept}</p>
                  </div>
                  <span className={styles.daysChip} style={{
                    background: e.daysLeft <= 7 ? '#EC498920' : 'var(--accent-bg)',
                    color: e.daysLeft <= 7 ? '#EC4899' : 'var(--accent)',
                  }}>
                    {e.daysLeft === 0 ? '¡Hoy!' : `${e.daysLeft}d`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Recent reservations */}
      <Card>
        <div style={{ padding: '18px 22px' }}>
          <div className={styles.cardHeader}>
            <h3 className={styles.feedTitle}>Reservas recientes</h3>
            <button onClick={() => navigate('reservations')} className={styles.viewAllBtn}>Ver todo</button>
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
                {reservations.slice(0, 5).map(r => (
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
        </div>
      </Card>
    </div>
  );
}
