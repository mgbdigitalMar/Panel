import { useState, useMemo, useCallback } from 'react';
import { useAuth, useReservations, useRequests, useNews, useHours, usePersonalDays, useDocuments } from '../context';
import { useNavigate } from 'react-router-dom';
import DashboardGlass from './DashboardGlass';
import DashboardTouch from './DashboardTouch';
import { useTouch } from '../components/Touch';
import { todayKey } from '../utils/format';
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

export default function DashboardPage() {
  const { user, employees } = useAuth();
  const navigate = useNavigate();
  const { reservations } = useReservations();
  const { requests } = useRequests();
  const { news } = useNews();
  const { hourCompensations = [] } = useHours() || {};
  const { personalDays = [] } = usePersonalDays() || {};
  const { onboardingDocUrl } = useDocuments() || {};

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

  const touch = useTouch();

  // Computes the data here; DashboardGlass lays it out on computers, DashboardTouch on phones and tablets
  const Composition = touch ? DashboardTouch : DashboardGlass;
  return (
    <Composition d={{
      user, employees, navigate, reservations, requests, news, todayStr,
      greeting, dateLine, motivation, progress, pendingCount, todayResCount, newsThisMonth,
      myUpcoming, myRequests, hours, upcomingBirthdays, resourceTypePie,
      requestsByMonth, requestsYear, prevYear, nextYear, isCurrentYear,
      reservationsByWeek, chartMonthLabel, prevMonth, nextMonth, isCurrentMonth, chartMonth,
      onboardingDocUrl, REQUEST_LABELS, STATUS_LABELS,
    }} />
  );
}
