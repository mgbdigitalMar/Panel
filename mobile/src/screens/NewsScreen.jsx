// 18 · Noticias y eventos (NewsPage on the web)
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Pin, Plus, Newspaper, Pencil, Trash2, CalendarDays } from 'lucide-react-native';
import { toUserMessage } from '@shared/utils/errors.js';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { Screen } from '../components/common/Screen';
import { Header } from '../components/common/Header';
import { GlassCard } from '../components/common/GlassCard';
import { GlassButton } from '../components/common/GlassButton';
import { Tag } from '../components/common/StatusBadge';
import { T } from '../components/common/Text';
import { Avatar, ChipRail, EmptyState, Sheet } from '../components/common/UI';
import { fmtDate, fmtRelative } from '../utils/format';

const CAT_TONE = { RRHH: ['#115E59', 'teal'], Empresa: ['#3B2A73', 'purple'], Formación: ['#6B4A0E', 'amber'], Otro: ['#1F2937', 'neutral'] };
const coverColor = (n) => (n.type === 'event' ? '#1E3A8A' : (CAT_TONE[n.category] || CAT_TONE.Otro)[0]);
const catTone = (n) => (n.type === 'event' ? 'accent' : (CAT_TONE[n.category] || CAT_TONE.Otro)[1]);

export function canPublish(user) {
  return user?.role === 'admin' || user?.dept === 'Comunicación - marketing';
}

export default function NewsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { params } = useRoute();
  const toast = useToast();
  const { user } = useAuth();
  const { news, deleteNews, refresh } = useData();
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(() => (params?.id ? news.find((n) => n.id === params.id) || null : null));
  const [refreshing, setRefreshing] = useState(false);
  const editor = canPublish(user);

  const visible = news.filter((n) => n.isActive !== false || editor);
  const filtered = useMemo(() => visible.filter((n) => filter === 'all'
    || (filter === 'news' && n.type === 'news') || (filter === 'event' && n.type === 'event') || n.category === filter), [visible, filter]);
  const pinned = filtered.filter((n) => n.pinned);
  const regular = filtered.filter((n) => !n.pinned);
  const categories = [...new Set(visible.map((n) => n.category).filter(Boolean))];

  const remove = (n) => Alert.alert('Eliminar publicación', '¿Seguro que quieres eliminar esta noticia o evento? Esta acción no se puede deshacer.', [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: 'Eliminar',
      style: 'destructive',
      onPress: async () => {
        const { error } = await deleteNews(n.id);
        if (error) toast.error(toUserMessage(error));
        else { setOpen(null); toast.success('Publicación eliminada'); }
      },
    },
  ]);

  return (
    <Screen onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }} refreshing={refreshing}>
      <Header back title="Noticias" subtitle={`${visible.length} publicaciones`}
        right={editor ? <GlassButton title="Publicar" icon={Plus} size="sm" onPress={() => navigation.navigate('NewsEditor', {})} /> : null} />

      <ChipRail value={filter} onChange={setFilter}
        options={[
          { value: 'all', label: 'Todas' },
          { value: 'event', label: 'Eventos' },
          { value: 'news', label: 'Noticias' },
          ...categories.map((c) => ({ value: c, label: c })),
        ]} />

      {filtered.length === 0 ? (
        <EmptyState icon={Newspaper} title="Sin publicaciones" message="No hay noticias ni eventos publicados aún."
          action={editor ? <GlassButton title="Publicar ahora" icon={Plus} onPress={() => navigation.navigate('NewsEditor', {})} /> : null} />
      ) : null}

      {pinned.map((n) => (
        <GlassCard key={n.id} padding={0} radius={24} onPress={() => setOpen(n)} style={{ overflow: 'hidden' }}>
          <View style={{ height: 120, backgroundColor: coverColor(n), padding: 14, justifyContent: 'flex-end' }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.9)' }}>
                <Pin size={12} color="#11141B" fill="#11141B" />
                <T size={11} weight="semibold" color="#11141B">Fijado</T>
              </View>
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.9)' }}>
                <T size={11} weight="semibold" color="#11141B">{n.type === 'event' ? 'Evento' : n.category || 'Noticia'}</T>
              </View>
            </View>
          </View>
          <View style={{ padding: 16, gap: 6 }}>
            <T size={18} weight="semibold">{n.title}</T>
            <T size={14} color={colors.text2} numberOfLines={3}>{n.content}</T>
            <T size={12.5} color={colors.text3}>{n.authorName} · {fmtRelative(n.date || n.createdAt)}</T>
          </View>
        </GlassCard>
      ))}

      <View style={{ gap: 8 }}>
        {regular.map((n) => (
          <GlassCard key={n.id} padding={12} radius={20} onPress={() => setOpen(n)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <View style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: coverColor(n), alignItems: 'center', justifyContent: 'center' }}>
              {n.type === 'event' ? <CalendarDays size={24} color="#FFFFFF" /> : <Newspaper size={24} color="#FFFFFF" />}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Tag label={n.type === 'event' ? 'Evento' : n.category || 'Noticia'} tone={catTone(n)} />
                <T size={12} color={colors.text3}>{fmtRelative(n.date || n.createdAt)}</T>
                {n.isActive === false ? <Tag label="Oculta" tone="neutral" /> : null}
              </View>
              <T size={15} weight="semibold" numberOfLines={2}>{n.title}</T>
            </View>
          </GlassCard>
        ))}
      </View>

      <Sheet
        visible={!!open}
        onClose={() => setOpen(null)}
        title={open?.type === 'event' ? 'Evento' : 'Noticia'}
        footer={editor && open ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <GlassButton title="Eliminar" icon={Trash2} variant="danger" style={{ flex: 1 }} onPress={() => remove(open)} />
            <GlassButton title="Editar" icon={Pencil} variant="glass" style={{ flex: 1 }} onPress={() => { const id = open.id; setOpen(null); navigation.navigate('NewsEditor', { id }); }} />
          </View>
        ) : null}
      >
        {open ? (
          <>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {open.pinned ? <Tag label="Fijado" tone="accent" /> : null}
              {open.category ? <Tag label={open.category} tone={catTone(open)} /> : null}
            </View>
            <T size={22} weight="semibold">{open.title}</T>
            <T size={15} color={colors.text2} style={{ lineHeight: 22 }} selectable>{open.content}</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar name={open.authorName} initials={open.authorAvatar} size={30} />
              <T size={13} color={colors.text3}>{open.authorName} · {fmtDate(open.date || open.createdAt)}</T>
            </View>
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
