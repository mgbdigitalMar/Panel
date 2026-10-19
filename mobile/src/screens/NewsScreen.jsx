// 18 · Noticias y eventos (NewsPage on the web)
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Pin, Plus, Newspaper, Pencil, Trash2, ArrowRight, ChevronRight } from 'lucide-react-native';
import { toUserMessage } from '@shared/utils/errors.js';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { Screen } from '../components/common/Screen';
import { Header } from '../components/common/Header';
import { GlassButton } from '../components/common/GlassButton';
import { Tag } from '../components/common/StatusBadge';
import { T } from '../components/common/Text';
import { Avatar, ChipRail, EmptyState, Row, Sheet } from '../components/common/UI';
import { BrandPanel, BrandTag, ON_BRAND } from '../components/common/Brand';
import { PressScale } from '../components/common/Pressable';
import { fmtDate, fmtRelative, parseDate, MONTHS_SHORT } from '../utils/format';

const CAT_TONE = { RRHH: 'teal', Empresa: 'purple', Formación: 'amber', Otro: 'neutral' };
const catTone = (n) => (n.type === 'event' ? 'amber' : CAT_TONE[n.category] || 'accent');
const newsDate = (n) => n.date || n.createdAt;
const byPinnedThenDate = (a, b) => (b.pinned === true) - (a.pinned === true) || String(newsDate(b) || '').localeCompare(String(newsDate(a) || ''));

/** Date tile (web: newsDate) — amber for events, accent for news. */
function DateTile({ n }) {
  const { colors } = useTheme();
  const d = parseDate(newsDate(n));
  const event = n.type === 'event';
  const fg = event ? colors.warningFg : colors.accentFg;
  return (
    <View style={{ width: 48, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: event ? colors.warningSoft : colors.accentSoft }}>
      <T size={18} weight="semibold" heading color={fg} style={{ lineHeight: 20 }}>{d ? d.getDate() : '—'}</T>
      <T size={11.5} weight="semibold" color={fg}>{d ? MONTHS_SHORT[d.getMonth()] : ''}</T>
    </View>
  );
}

/** The featured post: the login's brand panel in miniature (web: .featured). */
function Featured({ n, onPress }) {
  return (
    <PressScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`Destacado: ${n.title}`} scaleTo={0.98}>
      <BrandPanel padding={20} style={{ gap: 12, minHeight: 210 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <BrandTag label={n.type === 'event' ? 'Evento' : 'Noticia'} />
          {n.category ? <BrandTag label={n.category} /> : null}
          {n.pinned ? <BrandTag label="Fijado" icon={Pin} /> : null}
        </View>
        <T size={22} weight="semibold" color={ON_BRAND.text} numberOfLines={3}>{n.title}</T>
        {n.content ? <T size={14} color={ON_BRAND.text2} numberOfLines={2} style={{ lineHeight: 21 }}>{n.content}</T> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 'auto', paddingTop: 4 }}>
          <Avatar name={n.authorName} initials={n.authorAvatar} size={28} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <T size={13} weight="medium" color={ON_BRAND.text} numberOfLines={1}>{n.authorName}</T>
            <T size={12} color={ON_BRAND.text3} numberOfLines={1}>{fmtDate(newsDate(n))}</T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 16, borderRadius: 18, backgroundColor: '#FFFFFF' }}>
            <T size={13} weight="semibold" color="#11141B">Leer</T>
            <ArrowRight size={14} color="#11141B" />
          </View>
        </View>
      </BrandPanel>
    </PressScale>
  );
}

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
  // The open post is kept as an id and looked up, so it appears once news loads and closes if deleted.
  const [openId, setOpenId] = useState(params?.id ?? null);
  const [seenParam, setSeenParam] = useState(params?.id);
  if (params?.id !== seenParam) {
    // A link (dashboard, push) pointed at a post while this screen was already open
    setSeenParam(params?.id);
    if (params?.id != null) setOpenId(params.id);
  }
  const open = openId != null ? news.find((n) => String(n.id) === String(openId)) || null : null;
  const close = () => {
    setOpenId(null);
    if (params?.id != null) navigation.setParams({ id: undefined });
  };
  const [refreshing, setRefreshing] = useState(false);
  const editor = canPublish(user);

  const visible = news.filter((n) => n.isActive !== false || editor);
  const filtered = useMemo(() => visible.filter((n) => filter === 'all'
    || (filter === 'news' && n.type === 'news') || (filter === 'event' && n.type === 'event') || n.category === filter), [visible, filter]);
  const sorted = useMemo(() => [...filtered].sort(byPinnedThenDate), [filtered]);
  const featured = sorted[0];
  const rest = sorted.slice(1);

  const categories = [...new Set(visible.map((n) => n.category).filter(Boolean))];

  const remove = (n) => Alert.alert('Eliminar publicación', '¿Seguro que quieres eliminar esta noticia o evento? Esta acción no se puede deshacer.', [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: 'Eliminar',
      style: 'destructive',
      onPress: async () => {
        const { error } = await deleteNews(n.id);
        if (error) toast.error(toUserMessage(error));
        else { close(); toast.success('Publicación eliminada'); }
      },
    },
  ]);

  return (
    <Screen onRefresh={async () => { setRefreshing(true); try { await refresh(); } finally { setRefreshing(false); } }} refreshing={refreshing}>
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

      {featured ? <Featured n={featured} onPress={() => setOpenId(featured.id)} /> : null}

      {rest.length ? (
        <View style={{ gap: 2 }}>
          {rest.map((n, i) => (
            <Row
              key={n.id}
              first={i === 0}
              last={i === rest.length - 1}
              onPress={() => setOpenId(n.id)}
              accessibilityLabel={n.title}
              left={<DateTile n={n} />}
              title={(
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {n.pinned ? <Pin size={13} color={colors.accentFg} fill={colors.accentFg} /> : null}
                  <T size={15} weight="semibold" numberOfLines={2} style={{ flex: 1 }}>{n.title}</T>
                </View>
              )}
              subtitle={(
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <Tag label={n.type === 'event' ? 'Evento' : n.category || 'Noticia'} tone={catTone(n)} />
                  {n.isActive === false ? <Tag label="Oculta" tone="neutral" /> : null}
                  <T size={12} color={colors.text3} numberOfLines={1} style={{ flexShrink: 1 }}>{fmtRelative(newsDate(n))}</T>
                </View>
              )}
              right={<ChevronRight size={18} color={colors.text3} />}
            />
          ))}
        </View>
      ) : null}

      <Sheet
        visible={!!open}
        onClose={close}
        title={open?.type === 'event' ? 'Evento' : 'Noticia'}
        footer={editor && open ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <GlassButton title="Eliminar" icon={Trash2} variant="danger" style={{ flex: 1 }} onPress={() => remove(open)} />
            <GlassButton title="Editar" icon={Pencil} variant="glass" style={{ flex: 1 }} onPress={() => { const id = open.id; close(); navigation.navigate('NewsEditor', { id }); }} />
          </View>
        ) : null}
      >
        {open ? (
          <>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {open.pinned ? <Tag label="Fijado" tone="accent" /> : null}
              {open.category ? <Tag label={open.category} tone={catTone(open)} /> : null}
            </View>
            <T size={22} weight="semibold" accessibilityRole="header">{open.title}</T>
            <T size={15} color={colors.text2} style={{ lineHeight: 22 }} selectable>{open.content}</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar name={open.authorName} initials={open.authorAvatar} size={30} />
              <T size={13} color={colors.text3} style={{ flex: 1 }}>{open.authorName} · {fmtDate(newsDate(open))}</T>
            </View>
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}
