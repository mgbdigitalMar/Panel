// Equipo → Semana: who works where each day (TeamWeek on the web, same shared calculation).
// A phone has no room for a 5-column table, so it shows one day at a time.
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { ChevronLeft, ChevronRight, Building2, Home, MapPin, Sun, Info } from 'lucide-react-native';
import { AVAILABILITY, weekDates, teamWeek, dayCounts } from '@shared/services/availability.js';
import { localISODate } from '@shared/services/workMode.js';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';
import { GlassCard } from './common/GlassCard';
import { IconButton } from './common/GlassButton';
import { PressScale } from './common/Pressable';
import { T } from './common/Text';
import { Avatar, IconTile, Pill } from './common/UI';

// Same icons and tones as the work mode of the directory
const LOOK = {
  office:          { icon: Building2, tone: 'accent' },
  remoto:          { icon: Home,      tone: 'green' },
  externo:         { icon: MapPin,    tone: 'amber' },
  asuntos_propios: { icon: Sun,       tone: 'teal' },
};

const SOURCE_NOTE = {
  live: 'Ahora mismo',
  personal_day: 'Día aprobado',
  request: 'Solicitud aprobada',
  schedule: 'Según su horario',
};

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const dayNum = (iso) => Number(iso.slice(8, 10));
const monthOf = (iso) => MONTHS[Number(iso.slice(5, 7)) - 1];

/** `employees` is the directory list after search and department filters. */
export function TeamWeek({ employees, isAdmin, shortDept }) {
  const { colors } = useTheme();
  const { requests = [], personalDays = [] } = useData();
  const today = localISODate();
  const [offset, setOffset] = useState(0);
  const dates = useMemo(() => weekDates(offset, today), [offset, today]);
  const [picked, setPicked] = useState(null);
  // Today when it is in the week shown (weekdays), otherwise Monday
  const selected = dates.includes(picked) ? picked : (dates.includes(today) ? today : dates[0]);

  const rows = useMemo(
    () => teamWeek(employees, dates, { requests, personalDays, today }),
    [employees, dates, requests, personalDays, today],
  );

  const groups = Object.keys(AVAILABILITY).map((status) => ({
    status,
    people: rows
      .map((r) => ({ employee: r.employee, day: r.days.find((d) => d.date === selected) }))
      .filter((p) => p.day?.status === status),
  })).filter((g) => g.people.length);

  const weekLabel = offset === 0 ? 'Esta semana' : offset === 1 ? 'Próxima semana' : offset === -1 ? 'Semana pasada'
    : `${dayNum(dates[0])} ${monthOf(dates[0])} – ${dayNum(dates[4])} ${monthOf(dates[4])}`;
  const selIndex = dates.indexOf(selected);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconButton icon={ChevronLeft} size={40} accessibilityLabel="Semana anterior" onPress={() => { setOffset((o) => o - 1); setPicked(null); }} />
        <View style={{ flex: 1, alignItems: 'center' }} accessibilityLiveRegion="polite">
          <T size={15} weight="semibold">{weekLabel}</T>
          <T size={12.5} color={colors.text3}>{dayNum(dates[0])} {monthOf(dates[0])} – {dayNum(dates[4])} {monthOf(dates[4])}</T>
        </View>
        <IconButton icon={ChevronRight} size={40} accessibilityLabel="Semana siguiente" onPress={() => { setOffset((o) => o + 1); setPicked(null); }} />
      </View>

      <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole="tablist">
        {dates.map((d, i) => {
          const on = d === selected;
          const inOffice = dayCounts(rows, d).office;
          return (
            <PressScale
              key={d}
              onPress={() => setPicked(d)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${WEEKDAYS[i]} ${dayNum(d)}${d === today ? ', hoy' : ''}: ${inOffice} de ${rows.length} en la oficina`}
              style={{
                flex: 1, minHeight: 64, borderRadius: 16, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', gap: 2,
                backgroundColor: on ? colors.accentSoft : colors.glassStrong,
                borderWidth: 1, borderColor: on ? colors.accent : colors.glassBorder,
                opacity: d < today && !on ? 0.6 : 1,
              }}
            >
              <T size={11.5} weight="semibold" color={on || d === today ? colors.accentFg : colors.text3}>{WEEKDAYS[i].slice(0, 3)}</T>
              <T size={17} weight="semibold" mono>{dayNum(d)}</T>
              <T size={10.5} color={colors.text3} mono>{inOffice}/{rows.length}</T>
            </PressScale>
          );
        })}
      </View>

      <T size={13} color={colors.text3}>
        {WEEKDAYS[selIndex]} {dayNum(selected)} {monthOf(selected)}{selected === today ? ' · hoy' : ''} · número = personas en la oficina
      </T>

      {groups.map(({ status, people }) => {
        const look = LOOK[status];
        return (
          <GlassCard key={status} padding={12} style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <IconTile icon={look.icon} tone={look.tone} size={32} />
              <T size={15} weight="semibold" accessibilityRole="header" style={{ flex: 1 }}>{AVAILABILITY[status].label}</T>
              <Pill label={String(people.length)} tone={look.tone} mono />
            </View>
            {people.map(({ employee, day }) => (
              <View key={employee.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                accessible accessibilityLabel={`${employee.name}, ${AVAILABILITY[status].label}, ${SOURCE_NOTE[day.source].toLowerCase()}`}>
                <Avatar name={employee.name} initials={employee.avatar} size={34} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T size={14.5} weight="medium" numberOfLines={1}>{employee.name}</T>
                  <T size={12} color={colors.text3} numberOfLines={1}>{shortDept(employee.dept)} · {SOURCE_NOTE[day.source]}</T>
                </View>
              </View>
            ))}
          </GlassCard>
        );
      })}

      {!isAdmin ? (
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4 }}>
          <Info size={14} color={colors.text3} style={{ marginTop: 2 }} />
          <T size={12.5} color={colors.text3} style={{ flex: 1, lineHeight: 18 }}>
            Hoy ves dónde está cada persona ahora. Para el resto de días de tus compañeros se usa su horario de teletrabajo: sus solicitudes y asuntos propios solo los ven ellos y RRHH.
          </T>
        </View>
      ) : null}
    </View>
  );
}
