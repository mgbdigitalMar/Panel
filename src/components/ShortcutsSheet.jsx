import { Modal } from './ui';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const MOD = isMac ? '⌘' : 'Ctrl';

const GROUPS = [
  {
    title: 'General',
    rows: [
      { keys: [MOD, 'K'], label: 'Abrir el buscador' },
      { keys: ['/'],      label: 'Abrir el buscador' },
      { keys: ['?'],      label: 'Ver esta lista de atajos' },
      { keys: ['Esc'],    label: 'Cerrar ventanas y paneles' },
    ],
  },
  {
    title: 'Ir a… (pulsa G y después la letra)',
    rows: [
      { keys: ['G', 'D'], label: 'Dashboard' },
      { keys: ['G', 'R'], label: 'Reservas' },
      { keys: ['G', 'S'], label: 'Solicitudes' },
      { keys: ['G', 'H'], label: 'Tiempo a compensar' },
      { keys: ['G', 'N'], label: 'Noticias y Eventos' },
      { keys: ['G', 'E'], label: 'Equipo' },
      { keys: ['G', 'P'], label: 'Mi perfil' },
      { keys: ['G', 'A'], label: 'Ajustes' },
      { keys: ['G', 'M'], label: 'Administración', adminOnly: true },
    ],
  },
];

export function ShortcutsSheet({ open, onClose, isAdmin }) {
  return (
    <Modal open={open} onClose={onClose} title="Atajos de teclado">
      <div style={{ display: 'grid', gap: 22 }}>
        {GROUPS.map(group => (
          <section key={group.title}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-sec)', marginBottom: 8, fontFamily: 'var(--font-body)', letterSpacing: 0 }}>
              {group.title}
            </h3>
            <dl style={{ display: 'grid', gap: 2 }}>
              {group.rows.filter(r => !r.adminOnly || isAdmin).map(row => (
                <div
                  key={row.label + row.keys.join()}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '7px 0', borderBottom: '1px solid rgba(var(--border-rgb), 0.35)' }}
                >
                  <dt style={{ fontSize: 13.5, color: 'var(--text)' }}>{row.label}</dt>
                  <dd style={{ display: 'inline-flex', gap: 4 }}>
                    {row.keys.map(k => <kbd key={k} className="kbd">{k}</kbd>)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  );
}
