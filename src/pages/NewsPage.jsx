import { useState } from 'react';
import { useAuth, useData } from '../context';
import { Avatar, Badge, Modal, Input, Select, Textarea, Button, Card, ConfirmModal } from '../components/ui';
import { Edit2, Trash2, Pin, Plus, Newspaper } from 'lucide-react';
import styles from './NewsPage.module.scss';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

export default function NewsPage() {
  const { user } = useAuth();
  const { news, createNews, updateNews, deleteNews } = useData();
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

  const NewsCard = ({ item }) => (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
    <Card className={clsx(styles.newsCard, { [styles.newsCardPinned]: item.pinned })}>
      <div className={styles.cardTop}>
        <div style={{ flex: 1 }}>
          <div className={styles.cardBadges}>
            <Badge status={item.type} />
            <span className={styles.categoryTag}>{item.category}</span>
            {item.pinned && (
              <span className={styles.pinnedTag}>
                <Pin size={12} fill="currentColor" /> Fijado
              </span>
            )}
          </div>
          <h3 className={styles.newsTitle}>{item.title}</h3>
          <p className={styles.newsContent}>{item.content}</p>
          <div className={styles.authorRow}>
            <Avatar initials={item.authorAvatar} size={26} />
            <span className={styles.authorMeta}>{item.authorName} · {item.date}</span>
          </div>
        </div>

        {user.role === 'admin' && (
          <div className={styles.cardActions}>
            <Button variant="action" iconOnly icon={Edit2} onClick={() => handleEdit(item)} title="Editar" />
            <Button variant="action-danger" iconOnly icon={Trash2} onClick={() => setItemToDelete(item.id)} title="Eliminar" />
          </div>
        )}
      </div>
    </Card>
    </motion.div>
  );

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
    <div>
      {/* Header */}
      <div className={styles.pageControls}>
        <div className={styles.tabs}>
          {tabBtn('all', 'Todo')}
          {tabBtn('news', 'Noticias')}
          {tabBtn('event', 'Eventos')}
        </div>
        {user.role === 'admin' && (
          <Button icon={Plus} onClick={() => { setEditItem(null); setForm({ type: 'news', title: '', content: '', category: 'Empresa', pinned: false }); setShowModal(true); }}>
            Publicar
          </Button>
        )}
      </div>

      {/* Pinned */}
      {pinned.length > 0 && (
        <>
          <p className={styles.sectionTitle}>Destacado</p>
          <AnimatePresence mode="popLayout">
            <div className={styles.newsList}>
              {pinned.map(n => <NewsCard key={n.id} item={n} />)}
            </div>
          </AnimatePresence>
        </>
      )}

      {/* Regular */}
      {regular.length > 0 && (
        <>
          {pinned.length > 0 && <p className={styles.sectionTitle}>Reciente</p>}
          <AnimatePresence mode="popLayout">
            <div className={styles.newsList}>
              {regular.map(n => <NewsCard key={n.id} item={n} />)}
            </div>
          </AnimatePresence>
        </>
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
            {user.role === 'admin' && (
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
