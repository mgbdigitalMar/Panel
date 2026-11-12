import { useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Building2, CalendarDays, Car, ChevronRight, Plus } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { GlassCard } from './common/GlassCard';
import { T } from './common/Text';
import { SectionHead } from './common/UI';
import { fmtDate } from '../utils/format';

export function UpcomingBookings({ reservations, today, onView, onCreate }) {
  const { colors, material } = useTheme();
  const { width } = useWindowDimensions();
  // Full width, edge to edge like the news cards: the section's own width once laid out
  // (the window estimate only until then). Several bookings swipe one per snap, with dots.
  const [boxWidth, setBoxWidth] = useState(0);
  const cardWidth = boxWidth || Math.min(width, 680) - 40;
  const [current, setCurrent] = useState(0);
  const onScroll = (e) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / (cardWidth + 12));
    if (index !== current) {
      setCurrent(index);
      Haptics.selectionAsync().catch(() => {});
    }
  };
  return (
    <View style={{ gap: 10 }} onLayout={(e) => setBoxWidth(Math.round(e.nativeEvent.layout.width))}>
      <SectionHead title="Tus próximas reservas" action="Ver todas" onAction={onView} />
      {reservations.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + 12} decelerationRate="fast" disableIntervalMomentum
          onScroll={onScroll} scrollEventThrottle={32}
          contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }} style={{ marginHorizontal: -20 }}>
          {reservations.map((r, i) => {
            const featured = i === 0;
            const ink = featured ? '#FFFFFF' : colors.text;
            const secondary = featured ? 'rgba(255,255,255,0.9)' : colors.text2;
            const Icon = r.type === 'vehicle' ? Car : Building2;
            return (
              <GlassCard key={r.id} onPress={onView} radius={22} padding={20} strong={featured}
                tint={featured ? `rgba(25,56,154,${1 - material.strength * 0.22})` : undefined} sheen={!featured}
                accessibilityLabel={`${r.resourceName}, ${fmtDate(r.date)}, ${r.timeStart} a ${r.timeEnd}. Ver reserva`}
                style={{ width: cardWidth, minHeight: 184, gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <T size={13} color={secondary}>{r.date === today ? 'Hoy' : fmtDate(r.date)}</T>
                  <ChevronRight size={18} color={ink} />
                </View>
                <T size={25} weight="medium" color={ink}>{r.timeStart} – {r.timeEnd}</T>
                <View style={{ marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon size={19} color={ink} />
                  <T size={15} weight="semibold" color={ink} style={{ flex: 1 }}>{r.resourceName}</T>
                </View>
                <T size={12} color={secondary}>{r.status === 'pending' ? 'Pendiente de confirmar' : 'Confirmada'}{r.purpose ? ` · ${r.purpose}` : ''}</T>
              </GlassCard>
            );
          })}
        </ScrollView>
      ) : null}
      {reservations.length > 1 && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {reservations.map((r, i) => (
            <View key={r.id} style={{ width: i === current ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === current ? colors.accent : colors.muted, opacity: i === current ? 0.9 : 0.35 }} />
          ))}
        </View>
      )}
      {reservations.length ? null : (
        <GlassCard onPress={onCreate} padding={20} radius={22} accessibilityLabel="Crear una nueva reserva"
          style={{ minHeight: 116, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <CalendarDays size={24} color={colors.accentFg} />
          <View style={{ flex: 1, gap: 5 }}><T size={15} weight="semibold">Tu próxima reserva empieza aquí</T><T size={12} color={colors.text2}>Encuentra una sala o un vehículo disponible.</T></View>
          <Plus size={20} color={colors.accentFg} />
        </GlassCard>
      )}
    </View>
  );
}
