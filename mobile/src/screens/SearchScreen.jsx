// Buscar (the web's Ctrl K): people, news, your reservations and your requests in one list
import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Search, Newspaper, Building2, Car, UsersRound } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Screen } from '../components/common/Screen';
import { Header } from '../components/common/Header';
import { T } from '../components/common/Text';
import { Avatar, EmptyState, IconTile, Row } from '../components/common/UI';
import { StatusBadge } from '../components/common/StatusBadge';
import { buildRequestItems, requestTitle, requestDetail, REQUEST_TONE } from '../utils/domain';
import { requestIcon } from '../utils/icons';
import { fmtDate } from '../utils/format';
import { FONTS } from '../theme/tokens';

const LIMIT = 5;
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function Group({ title, children }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <T size={12.5} weight="semibold" color={colors.text3} upper>{title}</T>
      {children}
    </View>
  );
}

export default function SearchScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { user, employees = [] } = useAuth();
  const { news = [], reservations = [], requests = [], personalDays = [] } = useData();
  const [q, setQ] = useState('');

  const results = useMemo(() => {
    const term = norm(q.trim());
    if (!term) return null;
    const has = (...fields) => fields.some((f) => norm(f).includes(term));
    return {
      people: employees.filter((e) => has(e.name, e.email, e.position, e.dept)).slice(0, LIMIT),
      news: news.filter((n) => has(n.title, n.content, n.category)).slice(0, LIMIT),
      reservations: reservations
        .filter((r) => r.employeeId === user?.id && has(r.resourceName, r.purpose, r.date))
        .slice(0, LIMIT),
      requests: buildRequestItems(requests, personalDays, employees)
        .filter((r) => r.employeeId === user?.id && has(requestTitle(r), requestDetail(r), r.reason, r.item))
        .slice(0, LIMIT),
    };
  }, [q, employees, news, reservations, requests, personalDays, user?.id]);

  const total = results ? Object.values(results).reduce((s, list) => s + list.length, 0) : 0;

  return (
    <Screen>
      <Header back title="Buscar" />
      <View style={{ justifyContent: 'center' }}>
        <Search size={18} color={colors.text3} style={{ position: 'absolute', left: 14, zIndex: 1 }} />
        <TextInput
          value={q}
          onChangeText={setQ}
          autoFocus
          returnKeyType="search"
          placeholder="Personas, noticias, reservas, solicitudes…"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Buscar"
          style={{ height: 48, borderRadius: 16, borderWidth: 1, borderColor: colors.glassBorderStrong, backgroundColor: colors.inputBg, color: colors.text, fontFamily: FONTS.regular, fontSize: 16, paddingLeft: 42, paddingRight: 14 }}
        />
      </View>

      {!results ? (
        <EmptyState icon={Search} title="¿Qué buscas?" message="Escribe un nombre, una sala, una noticia o un tipo de solicitud." />
      ) : total === 0 ? (
        <EmptyState icon={Search} title="Sin resultados" message={`No hay nada que coincida con «${q.trim()}».`} />
      ) : (
        <View style={{ gap: 18 }}>
          {results.people.length > 0 && (
            <Group title="Personas">
              {results.people.map((e) => (
                <Row key={e.id} left={<Avatar name={e.name} initials={e.avatar} src={e.avatarUrl} size={40} />}
                  title={e.name} subtitle={[e.position, e.dept].filter(Boolean).join(' · ') || e.email}
                  onPress={() => navigation.navigate('EmployeeDetail', { id: e.id })} />
              ))}
            </Group>
          )}
          {results.news.length > 0 && (
            <Group title="Noticias">
              {results.news.map((n) => (
                <Row key={n.id} left={<IconTile icon={Newspaper} tone="amber" />}
                  title={n.title} subtitle={[n.type === 'event' ? 'Evento' : n.category || 'Noticia', fmtDate(n.date || n.createdAt)].join(' · ')}
                  onPress={() => navigation.navigate('News', { id: n.id })} />
              ))}
            </Group>
          )}
          {results.reservations.length > 0 && (
            <Group title="Tus reservas">
              {results.reservations.map((r) => (
                <Row key={r.id} left={<IconTile icon={r.type === 'vehicle' ? Car : Building2} tone={r.type === 'vehicle' ? 'teal' : 'accent'} />}
                  title={r.resourceName} subtitle={`${fmtDate(r.date)} · ${r.timeStart}–${r.timeEnd}`}
                  onPress={() => navigation.navigate('MyReservations', { scope: 'mine' })} />
              ))}
            </Group>
          )}
          {results.requests.length > 0 && (
            <Group title="Tus solicitudes">
              {results.requests.map((r) => (
                <Row key={`${r.type}-${r.id}`} left={<IconTile icon={requestIcon(r.type)} tone={REQUEST_TONE[r.type]} />}
                  title={requestTitle(r)} subtitle={requestDetail(r)} right={<StatusBadge status={r.status} />}
                  onPress={() => navigation.navigate('RequestDetail', { id: String(r.id), kind: r.type === 'asuntos_propios' ? 'asuntos_propios' : 'request' })} />
              ))}
            </Group>
          )}
          {employees.length > 0 && results.people.length === 0 && (
            <Row left={<IconTile icon={UsersRound} tone="neutral" />} title="Ver todo el equipo" onPress={() => navigation.navigate('Employees')} />
          )}
        </View>
      )}
    </Screen>
  );
}
