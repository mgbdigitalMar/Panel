// 16 · Directorio (EmployeesPage on the web)
import { useMemo, useState } from 'react';
import { Linking, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Search, Mail, Building2, Home, MapPin, UsersRound } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Screen } from '../components/common/Screen';
import { Header } from '../components/common/Header';
import { GlassCard } from '../components/common/GlassCard';
import { PressScale } from '../components/common/Pressable';
import { T } from '../components/common/Text';
import { Avatar, ChipRail, EmptyState } from '../components/common/UI';
import { FONTS } from '../theme/tokens';

export const WORK_MODES = {
  Office: { label: 'Oficina', icon: Building2, tone: 'accent' },
  remoto: { label: 'Remoto', icon: Home, tone: 'green' },
  externo: { label: 'Externo', icon: MapPin, tone: 'amber' },
};
export const workModeOf = (m) => WORK_MODES[m] || WORK_MODES.Office;

export const shortDept = (d) => {
  const str = (d || '').trim();
  if (!str || str === 'Sin asignar') return 'Sin asignar';
  return str.includes('-') ? str.split('-')[0].trim() : str;
};

export default function EmployeesScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { employees, refreshEmployees } = useAuth();
  const { refresh } = useData();
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const depts = useMemo(() => {
    const set = new Set();
    employees.forEach((e) => {
      const d = (e.dept || 'Sin asignar').trim();
      if (d) set.add(d);
    });
    return Array.from(set).sort((a, b) => {
      if (a === 'Sin asignar') return 1;
      if (b === 'Sin asignar') return -1;
      return a.localeCompare(b, 'es');
    });
  }, [employees]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return employees.filter((e) => {
      const empDept = (e.dept || 'Sin asignar').trim();
      const matchDept = dept === 'all' || empDept === dept;
      if (!matchDept) return false;
      if (!needle) return true;
      const haystack = `${e.name || ''} ${e.position || ''} ${e.email || ''} ${empDept} ${e.phone || ''} ${e.role === 'admin' ? 'admin administrador administración' : 'empleado'}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [employees, q, dept]);

  const summary = Object.entries(WORK_MODES).map(([k, m]) => ({ key: k, ...m, count: employees.filter((e) => (e.workMode || 'Office') === k).length }));

  return (
    <Screen onRefresh={async () => { setRefreshing(true); await Promise.all([refresh(), refreshEmployees()]); setRefreshing(false); }} refreshing={refreshing}>
      <Header back title="Equipo" subtitle={`${employees.length} personas`} />

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {summary.map((s) => {
          const Icon = s.icon;
          const fg = s.tone === 'green' ? colors.successFg : s.tone === 'amber' ? colors.warningFg : colors.accentFg;
          return (
            <GlassCard key={s.key} padding={12} style={{ flex: 1, gap: 6 }}>
              <Icon size={18} color={fg} />
              <T mono weight="semibold" size={22}>{s.count}</T>
              <T size={12} color={colors.text3}>{s.label}</T>
            </GlassCard>
          );
        })}
      </View>

      <View style={{ justifyContent: 'center' }}>
        <Search size={18} color={colors.text3} style={{ position: 'absolute', left: 14, zIndex: 1 }} />
        <TextInput value={q} onChangeText={setQ} placeholder="Nombre, puesto o correo" placeholderTextColor={colors.muted} accessibilityLabel="Buscar persona"
          style={{ height: 44, borderRadius: 14, borderWidth: 1, borderColor: colors.glassBorderStrong, backgroundColor: colors.inputBg, color: colors.text, fontFamily: FONTS.regular, fontSize: 15, paddingLeft: 42, paddingRight: 14 }} />
      </View>

      <ChipRail value={dept} onChange={setDept}
        options={[{ value: 'all', label: 'Todos' }, ...depts.map((d) => ({ value: d, label: shortDept(d), count: employees.filter((e) => (e.dept || 'Sin asignar').trim() === d).length }))]} />

      <View style={{ gap: 8 }}>
        {list.length === 0 ? (
          <EmptyState icon={UsersRound} title="Sin resultados" message="Prueba con otro nombre o departamento." />
        ) : (
          list.map((e) => {
            const wm = workModeOf(e.workMode);
            const wmColor = wm.tone === 'green' ? colors.success : wm.tone === 'amber' ? colors.warning : colors.accent;
            const empPosition = e.position?.trim() || (e.role === 'admin' ? 'Administrador' : 'Empleado');
            const empDept = shortDept(e.dept);

            return (
              <GlassCard key={e.id} padding={12} style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <PressScale
                    onPress={() => navigation.navigate('EmployeeDetail', { id: e.id })}
                    accessibilityRole="button"
                    accessibilityLabel={`${e.name}, ${empPosition}`}
                    style={{ position: 'relative' }}
                  >
                    <Avatar name={e.name} initials={e.avatar} size={46} />
                    <View
                      style={{
                        position: 'absolute',
                        right: -1,
                        bottom: -1,
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        backgroundColor: wmColor,
                        borderWidth: 2,
                        borderColor: colors.bg,
                      }}
                    />
                  </PressScale>

                  <PressScale
                    onPress={() => navigation.navigate('EmployeeDetail', { id: e.id })}
                    accessibilityRole="button"
                    accessibilityLabel={`${e.name}, ${empPosition}`}
                    style={{ flex: 1, gap: 3 }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <T size={15.5} weight="semibold" numberOfLines={1} style={{ flexShrink: 1 }}>
                        {e.name}
                      </T>
                      {e.role === 'admin' ? (
                        <View style={{ paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6, backgroundColor: colors.purpleSoft }}>
                          <T size={10} weight="bold" color={colors.purpleFg}>ADMIN</T>
                        </View>
                      ) : null}
                    </View>
                    <T size={13} color={colors.text2} numberOfLines={1}>
                      {empPosition}
                    </T>
                  </PressScale>

                  {e.email ? (
                    <PressScale
                      onPress={() => Linking.openURL(`mailto:${e.email}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`Enviar correo a ${e.name}`}
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.glassStrong,
                        borderWidth: 1,
                        borderColor: colors.glassBorderStrong,
                      }}
                    >
                      <Mail size={17} color={colors.text} />
                    </PressScale>
                  ) : null}
                </View>

                <PressScale
                  onPress={() => navigation.navigate('EmployeeDetail', { id: e.id })}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: 8,
                    borderTopWidth: 1,
                    borderTopColor: colors.glassBorder,
                    gap: 8,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 7, backgroundColor: colors.glassStrong }}>
                      <T size={11.5} weight="semibold" color={colors.accentFg} numberOfLines={1}>
                        {empDept}
                      </T>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: 7, backgroundColor: colors.segTrack }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: wmColor }} />
                      <T size={11} weight="medium" color={colors.text3}>
                        {wm.label}
                      </T>
                    </View>
                  </View>
                  {e.email ? (
                    <T size={12} color={colors.text3} numberOfLines={1} style={{ flexShrink: 1, textAlign: 'right' }}>
                      {e.email}
                    </T>
                  ) : null}
                </PressScale>
              </GlassCard>
            );
          })
        )}
      </View>
    </Screen>
  );
}
