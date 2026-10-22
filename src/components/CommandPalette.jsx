import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Calendar, Inbox, Newspaper, Settings, SlidersHorizontal,
  User, UsersRound, Timer, Search, ChevronRight, LogOut,
  CalendarPlus, FilePlus2, SunMoon, Keyboard,
} from 'lucide-react';
import { useAuth, useTheme } from '../context';
import { useNavigate } from 'react-router-dom';
import { Avatar } from './ui';
import styles from './CommandPalette.module.scss';

/* Pages (mirrors Layout.jsx) — `keys` is the G-shortcut letter */
const PAGES = [
  { id: 'dashboard',    label: 'Dashboard',          icon: LayoutDashboard, desc: 'Vista general de la empresa',        keys: 'D' },
  { id: 'reservations', label: 'Reservas',           icon: Calendar,        desc: 'Salas y vehículos',                  keys: 'R' },
  { id: 'requests',     label: 'Solicitudes',        icon: Inbox,           desc: 'Asuntos propios, remoto, compras',   keys: 'S' },
  { id: 'horas',        label: 'Tiempo a compensar', icon: Timer,           desc: 'Bolsa de horas',                     keys: 'H' },
  { id: 'news',         label: 'Noticias y Eventos', icon: Newspaper,       desc: 'Noticias del equipo',                keys: 'N' },
  { id: 'employees',    label: 'Equipo',             icon: UsersRound,      desc: 'Directorio de empleados',            keys: 'E' },
  { id: 'profile',      label: 'Mi perfil',          icon: User,            desc: 'Datos, documentos y contraseña',     keys: 'P' },
  { id: 'settings',     label: 'Ajustes',            icon: SlidersHorizontal, desc: 'Apariencia y notificaciones',     keys: 'A' },
  { id: 'admin',        label: 'Administración',     icon: Settings,        desc: 'Panel de gestión',                   keys: 'M', adminOnly: true },
];

const normalize = (s = '') => s.toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function CommandPalette({ open, onClose, onShowShortcuts }) {
  const navigate = useNavigate();
  const { user, employees = [], logout } = useAuth();
  const { theme, setMode } = useTheme();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const go = useCallback((path) => { navigate(path); onClose(); }, [navigate, onClose]);

  /* Every result is { key, section, label, desc, icon|avatar, keys?, run } */
  const results = useMemo(() => {
    const q = normalize(query.trim());
    const match = (...fields) => !q || fields.some(f => normalize(f).includes(q));

    const actions = [
      { key: 'a-res', label: 'Nueva reserva', desc: 'Reservar una sala o un vehículo', icon: CalendarPlus, run: () => go('/reservations?nueva=1') },
      { key: 'a-req', label: 'Nueva solicitud', desc: 'Asuntos propios, remoto, trabajo externo o compra', icon: FilePlus2, run: () => go('/requests?nueva=1') },
      {
        key: 'a-theme',
        label: theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro',
        desc: 'Apariencia de la intranet', icon: SunMoon,
        run: () => { setMode(theme === 'dark' ? 'light' : 'dark'); onClose(); },
      },
      { key: 'a-keys', label: 'Atajos de teclado', desc: 'Todas las teclas rápidas', icon: Keyboard, keys: '?', run: () => { onClose(); onShowShortcuts?.(); } },
    ].filter(a => match(a.label, a.desc)).map(a => ({ ...a, section: 'Acciones' }));

    const pages = PAGES
      .filter(p => !p.adminOnly || user?.role === 'admin')
      .filter(p => match(p.label, p.desc))
      .map(p => ({ key: `p-${p.id}`, section: 'Páginas', label: p.label, desc: p.desc, icon: p.icon, keys: `G ${p.keys}`, run: () => go('/' + p.id) }));

    // People only once something is typed — the directory is long
    const people = q.length < 2 ? [] : employees
      .filter(e => match(e.name, e.dept, e.position, e.email))
      .slice(0, 6)
      .map(e => ({
        key: `e-${e.id}`, section: 'Personas', label: e.name, desc: [e.position, e.dept].filter(Boolean).join(' · ') || 'Equipo Margube',
        avatar: e.avatar || (e.name || '?').split(' ').map(w => w[0]).slice(0, 2).join(''),
        run: () => go(`/employees?q=${encodeURIComponent(e.name)}`),
      }));

    return [...actions, ...pages, ...people];
  }, [query, theme, user?.role, employees, go, setMode, onClose, onShowShortcuts]);

  /* Reset on open */
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => { setSelected(0); }, [query]);

  /* Keep the highlighted row in view */
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${selected}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => (s + 1) % Math.max(results.length, 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => (s - 1 + results.length) % Math.max(results.length, 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); results[selected]?.run(); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  const sections = results.reduce((acc, r, i) => {
    (acc[r.section] ||= []).push({ ...r, index: i });
    return acc;
  }, {});

  return (
    <AnimatePresence>
      {open && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Buscar en la intranet">
          <motion.div
            className={styles.backdrop}
            data-scrim
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />

          <motion.div
            className={styles.panel}
            initial={{ opacity: 0, y: -16, scale: 0.97, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
            exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.12, ease: [0.4, 0, 1, 1] } }}
            transition={{ type: 'spring', stiffness: 520, damping: 38, mass: 0.8 }}
          >
            <div className={styles.searchRow}>
              <Search size={16} className={styles.searchIcon} aria-hidden="true" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Busca páginas, acciones o compañeros…"
                className={styles.searchInput}
                aria-label="Buscar"
                aria-controls="cmd-results"
                aria-activedescendant={results[selected] ? `cmd-${results[selected].key}` : undefined}
                autoComplete="off"
              />
              <span className="kbd" aria-hidden="true">Esc</span>
            </div>

            <div className={styles.results} id="cmd-results" role="listbox" ref={listRef}>
              {results.length === 0 ? (
                <div className={styles.empty}>
                  <Search size={28} aria-hidden="true" />
                  <p>Sin resultados para <strong>«{query}»</strong></p>
                  <span>Prueba con el nombre de una página o de una persona.</span>
                </div>
              ) : (
                Object.entries(sections).map(([section, items]) => (
                  <div key={section} role="group" aria-label={section}>
                    <p className={styles.sectionLabel}>{section}</p>
                    {items.map(item => {
                      const Icon = item.icon;
                      const isSelected = item.index === selected;
                      return (
                        <button
                          key={item.key}
                          id={`cmd-${item.key}`}
                          data-index={item.index}
                          role="option"
                          aria-selected={isSelected}
                          className={`${styles.item} ${isSelected ? styles.itemSelected : ''}`}
                          onClick={item.run}
                          onMouseMove={() => !isSelected && setSelected(item.index)}
                        >
                          {/* Highlight glides between rows */}
                          {isSelected && (
                            <motion.span
                              layoutId="cmd-highlight"
                              className={styles.itemHighlight}
                              transition={{ type: 'spring', stiffness: 700, damping: 46 }}
                            />
                          )}
                          {item.avatar ? (
                            <Avatar initials={item.avatar} size={34} />
                          ) : (
                            <span className={styles.itemIcon} aria-hidden="true"><Icon size={16} /></span>
                          )}
                          <span className={styles.itemContent}>
                            <span className={styles.itemLabel}>{item.label}</span>
                            <span className={styles.itemDesc}>{item.desc}</span>
                          </span>
                          {item.keys
                            ? <span className={styles.itemKeys} aria-hidden="true">{item.keys.split(' ').map(k => <span key={k} className="kbd">{k}</span>)}</span>
                            : <ChevronRight size={13} className={styles.itemArrow} aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className={styles.footer}>
              <div className={styles.footerHints}>
                <span><span className="kbd">↑↓</span> moverse</span>
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
