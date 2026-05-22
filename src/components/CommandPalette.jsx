import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Calendar, Inbox, Newspaper, Settings,
  User, UsersRound, Timer, Search, Command, ChevronRight,
  LogOut,
} from 'lucide-react';
import { useApp, useAuth } from '../context';
import styles from './CommandPalette.module.scss';

/* ── Navigation items (mirrors Layout.jsx) ──────────────────── */
const ALL_ITEMS = [
  { id: 'dashboard',    label: 'Dashboard',          icon: LayoutDashboard, section: 'Navegación', desc: 'Vista general de la empresa' },
  { id: 'reservations', label: 'Reservas',            icon: Calendar,        section: 'Navegación', desc: 'Salas y vehículos' },
  { id: 'requests',     label: 'Solicitudes',         icon: Inbox,           section: 'Navegación', desc: 'Vacaciones, remoto, compras' },
  { id: 'horas',        label: 'Control de Tiempo',   icon: Timer,           section: 'Navegación', desc: 'Registro de horas compensadas y deudas' },
  { id: 'news',         label: 'Noticias y Eventos',  icon: Newspaper,       section: 'Navegación', desc: 'Noticias del equipo' },
  { id: 'employees',    label: 'Equipo',              icon: UsersRound,      section: 'Navegación', desc: 'Directorio de empleados' },
  { id: 'profile',      label: 'Mi Perfil',           icon: User,            section: 'Mi cuenta',  desc: 'Configuración personal' },
  { id: 'admin',        label: 'Administración',      icon: Settings,        section: 'Admin',      desc: 'Panel de gestión' },
];

/* ── CommandPalette ─────────────────────────────────────────── */
export default function CommandPalette({ open, onClose }) {
  const { navigate } = useApp();
  const { user, logout } = useAuth();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  /* Filter items by role + query */
  const items = ALL_ITEMS.filter(item => {
    if (item.id === 'admin' && user?.role !== 'admin') return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      item.desc.toLowerCase().includes(q) ||
      item.section.toLowerCase().includes(q)
    );
  });

  /* Reset on open */
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  /* Keyboard navigation */
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(s => Math.min(s + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(s => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[selected]) {
        navigate(items[selected].id);
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [items, selected, navigate, onClose]);

  /* Scroll selected item into view */
  useEffect(() => {
    const el = listRef.current?.children[selected];
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  /* Reset selected when query changes */
  useEffect(() => { setSelected(0); }, [query]);

  const handleSelect = (id) => {
    navigate(id);
    onClose();
  };

  /* Group items by section */
  const grouped = items.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {});

  let flatIndex = 0;
  const sections = Object.entries(grouped);

  return (
    <AnimatePresence>
      {open && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Paleta de comandos">
          {/* Backdrop */}
          <motion.div
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className={styles.panel}
            initial={{ opacity: 0, y: -24, scale: 0.96, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -12, scale: 0.97, filter: 'blur(4px)' }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Search input */}
            <div className={styles.searchRow}>
              <Search size={16} className={styles.searchIcon} aria-hidden="true" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar páginas, acciones..."
                className={styles.searchInput}
                aria-label="Buscar"
                autoComplete="off"
              />
              <span className="kbd" aria-label="Escape para cerrar">Esc</span>
            </div>

            {/* Results */}
            <div className={styles.results}>
              {items.length === 0 ? (
                <div className={styles.empty}>
                  <Search size={28} aria-hidden="true" />
                  <p>Sin resultados para <strong>"{query}"</strong></p>
                </div>
              ) : (
                <div ref={listRef}>
                  {sections.map(([section, sectionItems]) => (
                    <div key={section}>
                      <p className={styles.sectionLabel}>{section}</p>
                      {sectionItems.map(item => {
                        const Icon = item.icon;
                        const isSelected = flatIndex++ === selected;
                        return (
                          <button
                            key={item.id}
                            className={`${styles.item} ${isSelected ? styles.itemSelected : ''}`}
                            onClick={() => handleSelect(item.id)}
                            onMouseEnter={() => setSelected(flatIndex - 1)}
                          >
                            <span className={styles.itemIcon} aria-hidden="true">
                              <Icon size={16} />
                            </span>
                            <span className={styles.itemContent}>
                              <span className={styles.itemLabel}>{item.label}</span>
                              <span className={styles.itemDesc}>{item.desc}</span>
                            </span>
                            <ChevronRight size={13} className={styles.itemArrow} aria-hidden="true" />
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={styles.footer}>
              <div className={styles.footerHints}>
                <span><span className="kbd">↑↓</span> navegar</span>
                <span><span className="kbd">↵</span> abrir</span>
                <span><span className="kbd">Esc</span> cerrar</span>
              </div>
              <button className={styles.footerLogout} onClick={() => { logout(); onClose(); }}>
                <LogOut size={12} aria-hidden="true" />
                Cerrar sesión
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
