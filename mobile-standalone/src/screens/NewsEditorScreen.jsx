// Publicar / editar noticia o evento (publish modal of the web NewsPage)
import { useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { toUserMessage } from '@shared/utils/errors.js';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { Screen } from '../components/common/Screen';
import { ModalHeader } from '../components/common/Header';
import { GlassInput } from '../components/common/GlassInput';
import { GlassButton } from '../components/common/GlassButton';
import { T } from '../components/common/Text';
import { ChipRail, Segmented, SwitchRow, Banner } from '../components/common/UI';
import { canPublish } from './NewsScreen';

const CATEGORIES = ['Empresa', 'RRHH', 'Formación', 'Otro'];

export default function NewsEditorScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const toast = useToast();
  const { user } = useAuth();
  const { news, saveNews } = useData();
  const existing = params?.id ? news.find((n) => n.id === params.id) : null;
  const [form, setForm] = useState({
    type: existing?.type || 'news',
    title: existing?.title || '',
    content: existing?.content || '',
    category: existing?.category || 'Empresa',
    pinned: !!existing?.pinned,
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  if (!canPublish(user)) {
    return (
      <Screen>
        <ModalHeader title="Publicar" />
        <Banner tone="danger">No tienes permisos para publicar.</Banner>
      </Screen>
    );
  }

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    const { error } = await saveNews(existing?.id, { ...form, title: form.title.trim(), content: form.content.trim() });
    setSaving(false);
    if (error) {
      toast.error(toUserMessage(error));
      return;
    }
    toast.success(existing ? 'Publicación actualizada' : 'Publicado');
    navigation.goBack();
  };

  return (
    <Screen glow={false} footer={<GlassButton title={existing ? 'Actualizar' : 'Publicar'} size="lg" loading={saving} disabled={!form.title.trim() || !form.content.trim()} onPress={save} />}>
      <ModalHeader title={existing ? 'Editar publicación' : 'Nueva publicación'} />
      <Segmented value={form.type} onChange={set('type')} options={[{ value: 'news', label: 'Noticia' }, { value: 'event', label: 'Evento' }]} />
      <GlassInput label="Título" value={form.title} onChangeText={set('title')} required placeholder="Título de la publicación…" />
      <GlassInput label="Contenido" value={form.content} onChangeText={set('content')} required multiline rows={6} placeholder="Escribe el contenido aquí…" />
      <T size={13} weight="medium">Categoría</T>
      <ChipRail value={form.category} onChange={set('category')} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
      <SwitchRow title="Fijar publicación" subtitle="Aparece destacada arriba del todo" value={form.pinned} onValueChange={set('pinned')} />
    </Screen>
  );
}
