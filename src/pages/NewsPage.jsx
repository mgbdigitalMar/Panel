import { useState, forwardRef } from 'react';
import { useAuth, useNews } from '../context';
import { Avatar, Badge, Modal, Input, Select, Textarea, Button, Card, ConfirmModal, Section } from '../components/ui';
import { Edit2, Trash2, Pin, Plus, Newspaper } from 'lucide-react';
import styles from './NewsPage.module.scss';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { fmtDate, toDate } from '../utils/format';
import { LEAF_PATH, VEIN_PATH } from '../components/ui/Loader/Loader';

const typeLabel = (t) => (t === 'event' ? 'Evento' : 'Noticia');

/** Pinned post: the brand panel, with the full text. */
// forwardRef: AnimatePresence (popLayout) measures each child through its ref
const FeaturedPost = forwardRef(function FeaturedPost({ item, canEdit, onEdit, onDelete }, ref) {
  return (
    <motion.article
      ref={ref}
      layout
      className={styles.featured}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
    >
      <svg className={styles.featuredLeaf} viewBox="0 0 48 48" aria-hidden="true">
        <motion.path d={LEAF_PATH} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.8, ease: [0.65, 0, 0.35, 1], delay: 0.2 }} />
        <motion.path d={VEIN_PATH} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: [0.65, 0, 0.35, 1], delay: 1.2 }} />
      </svg>
      <div className={styles.featuredBody}>
        <div className={styles.featuredTop}>
          <div className={styles.featuredTags}>
            <span className={styles.featuredTag}>{typeLabel(item.type)}</span>
            {item.category && <span className={styles.featuredTag}>{item.category}</span>}
            <span className={styles.featuredTag}><Pin size={11} aria-hidden="true" /> Fijado</span>
          </div>
          {canEdit && (
            <div className={styles.featuredActions}>
              <button type="button" className={styles.featuredAction} onClick={() => onEdit(item)} aria-label={`Editar «${item.title}»`}><Edit2 size={15} /></button>
              <button type="button" className={styles.featuredAction} onClick={() => onDelete(item.id)} aria-label={`Eliminar «${item.title}»`}><Trash2 size={15} /></button>
            </div>
          )}
        </div>
        <h3 className={styles.featuredTitle}>{item.title}</h3>
        <p className={styles.featuredText}>{item.content}</p>
        <div className={styles.featuredFoot}>
          <Avatar initials={item.authorAvatar} size={28} />
          <span className={styles.featuredAuthor}>{item.authorName}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={item.date}>{fmtDate(item.date)}</time>
        </div>
      </div>
    </motion.article>
  );
});

/** Regular post: date block on the left, text on the right. */
const PostCard = forwardRef(function PostCard({ item, canEdit, onEdit, onDelete }, ref) {
  const d = toDate(item.date);
  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
    >
      <Card className={styles.post}>
        <div className={clsx(styles.postDate, item.type === 'event' && styles.postDateEvent)} aria-hidden="true">
          <strong>{d ? d.getDate() : '—'}</strong>
          <span>{d ? d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '') : ''}</span>
        </div>
        <div className={styles.postBody}>
          <div className={styles.cardBadges}>
            <Badge status={item.type} />
            {item.category && <span className={styles.categoryTag}>{item.category}</span>}
          </div>
          <h3 className={styles.newsTitle}>{item.title}</h3>
          <p className={styles.newsContent}>{item.content}</p>
          <div className={styles.authorRow}>
            <Avatar initials={item.authorAvatar} size={26} />
            <span className={styles.authorMeta}>
              {item.authorName} · <time dateTime={item.date}>{fmtDate(item.date)}</time>
            </span>
          </div>
        </div>
        {canEdit && (
          <div className={styles.cardActions}>
            <Button variant="action" iconOnly icon={Edit2} onClick={() => onEdit(item)} title="Editar" />
            <Button variant="action-danger" iconOnly icon={Trash2} onClick={() => onDelete(item.id)} title="Eliminar" />
          </div>
        )}
      </Card>
    </motion.div>
  );
});

export default function NewsPage() {
  const { user } = useAuth();
  const { news, createNews, updateNews, deleteNews } = useNews();
  const [tab, setTab]             = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem]   = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [form, setForm] = useState({ type: 'news', title: '', content: '', category: 'Empresa', pinned: false });

  const filtered = tab === 'all' ? news : news.filter(n => n.type === tab);
  const pinned   = filtered.filter(n => n.pinned);
  const regular  = filtered.filter(n => !n.pinned);

  const handleSave = async () => {
    if (!form.title || !form.content) return;
    const payload = {
      title: form.title,
      content: form.content,
      type: form.type,
      category: form.category,
      pinned: form.pinned,
    };
    if (editItem) {
      await updateNews(editItem.id, payload);
    } else {
      payload.author_id = user.id;
      payload.published_at = new Date().toISOString().split('T')[0];
      await createNews(payload);
    }
    setShowModal(false);
    setEditItem(null);
    setForm({ type: 'news', title: '', content: '', category: 'Empresa', pinned: false });
  };

  const handleEdit = item => {
    setEditItem(item);
    setForm({ type: item.type, title: item.title, content: item.content, category: item.category, pinned: item.pinned });
    setShowModal(true);
  };

  const handleDelete = async id => {
    await deleteNews(id);
    setItemToDelete(null);
  };

  const canEdit = user.role === 'admin' || user.dept === 'Comunicación - marketing';

  const tabBtn = (id, label) => {
    const count = id === 'all' ? news.length : news.filter(n => n.type === id).length;
    return (
    <button 
      key={id} 
      onClick={() => setTab(id)}
      className={clsx(styles.tabBtn, { [styles.tabBtnActive]: tab === id })}
    >
      {label}
      {count > 0 && (
        <span className={styles.tabCount}>{count}</span>
      )}
    </button>
    );
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.pageControls}>
        <div className={styles.tabsRow}>
          {tabBtn('all', 'Todo')}
          {tabBtn('news', 'Noticias')}
          {tabBtn('event', 'Eventos')}
        </div>
        {(user.role === 'admin' || user.dept === 'Comunicación - marketing') && (
          <div className={styles.controlsRight}>
            <Button icon={Plus} onClick={() => { setEditItem(null); setForm({ type: 'news', title: '', content: '', category: 'Empresa', pinned: false }); setShowModal(true); }}>
              Publicar
            </Button>
          </div>
        )}
      </div>

      {/* Pinned */}
      {pinned.length > 0 && (
        <Section title="Destacado">
          <div className={styles.newsList}>
            <AnimatePresence mode="popLayout">
              {pinned.map(n => <FeaturedPost key={n.id} item={n} canEdit={canEdit} onEdit={handleEdit} onDelete={setItemToDelete} />)}
            </AnimatePresence>
          </div>
        </Section>
      )}

      {/* Regular */}
      {regular.length > 0 && (
        <Section title={pinned.length > 0 ? 'Recientes' : 'Publicaciones'}>
          <div className={styles.newsList}>
            <AnimatePresence mode="popLayout">
              {regular.map(n => <PostCard key={n.id} item={n} canEdit={canEdit} onEdit={handleEdit} onDelete={setItemToDelete} />)}
            </AnimatePresence>
          </div>
        </Section>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <Card>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Newspaper size={26} />
            </div>
            <p className={styles.emptyTitle}>Sin publicaciones</p>
            <p className={styles.emptyDesc}>
              {tab === 'all'
                ? 'No hay noticias ni eventos publicados aún.'
                : `No hay ${tab === 'news' ? 'noticias' : 'eventos'} publicados aún.`}
            </p>
            {(user.role === 'admin' || user.dept === 'Comunicación - marketing') && (
              <Button icon={Plus} onClick={() => { setEditItem(null); setForm({ type: tab === 'event' ? 'event' : 'news', title: '', content: '', category: 'Empresa', pinned: false }); setShowModal(true); }}>
                Publicar ahora
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Publish / Edit modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setEditItem(null); }} title={editItem ? 'Editar publicación' : 'Nueva publicación'}>
        <div className={styles.typeButtons}>
          {[{ id: 'news', label: 'Noticia' }, { id: 'event', label: 'Evento' }].map(rt => (
            <button 
              key={rt.id} 
              onClick={() => setForm({ ...form, type: rt.id })}
              className={clsx(styles.typeBtn, { [styles.typeBtnActive]: form.type === rt.id })}
            >
              {rt.label}
            </button>
          ))}
        </div>

        <Input label="Título" value={form.title} onChange={v => setForm({ ...form, title: v })} placeholder="Título de la publicación..." required />
        <Textarea label="Contenido" value={form.content} onChange={v => setForm({ ...form, content: v })} placeholder="Escribe el contenido aquí..." rows={4} />
        <Select 
          label="Categoría" 
          value={form.category} 
          onChange={v => setForm({ ...form, category: v })}
          options={[{ value: 'Empresa', label: 'Empresa' }, { value: 'RRHH', label: 'RRHH' }, { value: 'Formación', label: 'Formación' }, { value: 'Otro', label: 'Otro' }]} 
        />

        <div className={styles.checkboxRow}>
          <input type="checkbox" id="pinned" checked={form.pinned} onChange={e => setForm({ ...form, pinned: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
          <label htmlFor="pinned" style={{ fontSize: 14, color: 'var(--text)', cursor: 'pointer' }}>Fijar esta publicación (aparece destacada)</label>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => { setShowModal(false); setEditItem(null); }}>Cancelar</Button>
          <Button onClick={handleSave}>{editItem ? 'Actualizar' : 'Publicar'}</Button>
        </div>
      </Modal>

      <ConfirmModal 
        isOpen={!!itemToDelete} 
        onClose={() => setItemToDelete(null)} 
        onConfirm={() => handleDelete(itemToDelete)} 
        title="Eliminar publicación"
        message="¿Estás seguro de que deseas eliminar esta noticia/evento? Esta acción no se puede deshacer."
      />
    </div>
  );
}
