import { useState } from 'react';
import { useAuth } from '../context';
import { MOCK_NEWS } from '../data/mockData';
import { Avatar, Badge, Modal, Input, Select, Textarea, Button, Card } from '../components/ui';
import { Edit2, Trash2, Pin, Plus } from 'lucide-react';
import styles from './NewsPage.module.scss';
import clsx from 'clsx';

export default function NewsPage() {
  const { user } = useAuth();
  
  const [news, setNews]           = useState(MOCK_NEWS);
  const [tab, setTab]             = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem]   = useState(null);
  const [form, setForm] = useState({ type: 'news', title: '', content: '', category: 'Empresa', pinned: false });

  const filtered = tab === 'all' ? news : news.filter(n => n.type === tab);
  const pinned   = filtered.filter(n => n.pinned);
  const regular  = filtered.filter(n => !n.pinned);

  const handleSave = () => {
    if (!form.title || !form.content) return;
    if (editItem) {
      setNews(news.map(n => n.id === editItem.id ? { ...n, ...form } : n));
    } else {
      setNews([{
        id: Date.now(), ...form,
        author: user.name, authorAvatar: user.avatar,
        date: new Date().toISOString().split('T')[0],
      }, ...news]);
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

  const handleDelete = id => setNews(news.filter(n => n.id !== id));

  const NewsCard = ({ item }) => (
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
            <span className={styles.authorMeta}>{item.author} · {item.date}</span>
          </div>
        </div>

        {user.role === 'admin' && (
          <div className={styles.cardActions}>
            <button onClick={() => handleEdit(item)} className={styles.actionBtn}>
              <Edit2 size={16} />
            </button>
            <button onClick={() => handleDelete(item.id)} className={clsx(styles.actionBtn, styles.delete)}>
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>
    </Card>
  );

  const tabBtn = (id, label) => (
    <button 
      key={id} 
      onClick={() => setTab(id)}
      className={clsx(styles.tabBtn, { [styles.tabBtnActive]: tab === id })}
    >
      {label}
    </button>
  );

  return (
    <div>
      {/* Header */}
      <div className={styles.header}>
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
          <div className={styles.newsList}>
            {pinned.map(n => <NewsCard key={n.id} item={n} />)}
          </div>
        </>
      )}

      {/* Regular */}
      {regular.length > 0 && (
        <>
          {pinned.length > 0 && <p className={styles.sectionTitle}>Reciente</p>}
          <div className={styles.newsList}>
            {regular.map(n => <NewsCard key={n.id} item={n} />)}
          </div>
        </>
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
    </div>
  );
}
