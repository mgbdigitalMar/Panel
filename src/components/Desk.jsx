import { useId } from 'react';
import clsx from 'clsx';
import { Search, X, ChevronDown } from 'lucide-react';
import { LEAF_PATH, VEIN_PATH } from './ui/Loader/Loader';
import styles from './Desk.module.scss';

/**
 * The web on computers (1024 px and up): page compositions for a mouse and a keyboard, built
 * from the same glass, wallpaper and Margube navy as the rest of the web. Phones and tablets
 * use Touch.jsx; the Expo app has its own screens.
 */

/** Context line above a page title: the section's mark and today's date (or `eyebrow`). Every
 * page heading starts with it, so each section carries its own icon beside the date. */
export function DeskEyebrow({ icon: Icon, eyebrow }) {
  const line = eyebrow ?? new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <p className={styles.eyebrow}>
      {Icon && <span className={styles.mark} aria-hidden="true"><Icon size={15} /></span>}
      <span>{line}</span>
    </p>
  );
}

/** Page heading: the context line, a large title, what the page is for, and its main actions. */
export function DeskHeader({ icon, eyebrow, title, desc, actions }) {
  return (
    <header className={styles.header}>
      <div className={styles.headText}>
        <DeskEyebrow icon={icon} eyebrow={eyebrow} />
        <h1 className={styles.title}>{title}</h1>
        {desc && <p className={styles.desc}>{desc}</p>}
      </div>
      {actions && <div className={styles.headActions}>{actions}</div>}
    </header>
  );
}

/** Page body with a column on the left (navigation, filters, the highlight) and the work area. */
export function DeskLayout({ side, children, sideLabel }) {
  return (
    <div className={styles.layout}>
      <aside className={styles.side} aria-label={sideLabel}>{side}</aside>
      <div className={styles.main}>{children}</div>
    </div>
  );
}

/**
 * Vertical navigation or filter list. Each item: icon, label, optional hint and count.
 * `asFilter` makes the items toggle buttons (aria-pressed) instead of page sections (aria-current).
 */
export function DeskRail({ title, items, value, onChange, asFilter }) {
  return (
    <nav className={styles.rail} aria-label={title}>
      {title && <p className={styles.railTitle}>{title}</p>}
      <ul>
        {items.map((it) => {
          const Icon = it.icon;
          const on = value === it.value;
          return (
            <li key={it.value}>
              <button
                type="button"
                className={clsx(styles.railItem, on && styles.railOn)}
                onClick={() => onChange(it.value)}
                aria-current={!asFilter && on ? 'page' : undefined}
                aria-pressed={asFilter ? on : undefined}
              >
                {Icon && <span className={styles.railIcon} data-tone={it.tone} aria-hidden="true"><Icon size={16} /></span>}
                <span className={styles.railText}>
                  <span>{it.label}</span>
                  {it.hint && <small>{it.hint}</small>}
                </span>
                {it.count != null && (
                  <span className={clsx(styles.railCount, it.alert && styles.railAlert)}>
                    {it.count}
                    {it.alert && <span className={styles.srOnly}> pendientes</span>}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Key figures in one glass bar. An item with `onClick` filters the page (aria-pressed, `active`),
 * so a figure and its filter are the same control.
 */
export function DeskMetrics({ items, label }) {
  return (
    <div className={styles.metrics} role="group" aria-label={label} style={{ '--n': items.length }}>
      {items.map((it) => {
        const body = (
          <>
            <span className={styles.metricLabel}>
              <i data-tone={it.tone} aria-hidden="true" />
              {it.label}
            </span>
            <strong className={styles.metricValue}>{it.value}</strong>
            {it.hint && <span className={styles.metricHint}>{it.hint}</span>}
          </>
        );
        return it.onClick ? (
          <button key={it.label} type="button" className={clsx(styles.metric, styles.metricBtn, it.active && styles.metricOn)}
            onClick={it.onClick} aria-pressed={!!it.active}>
            {body}
          </button>
        ) : (
          <div key={it.label} className={styles.metric}>{body}</div>
        );
      })}
    </div>
  );
}

/** Glass panel with a heading row (title, line under it, tools on the right). */
export function DeskPanel({ title, sub, tools, children, className, flush, id }) {
  const headId = useId();
  return (
    <section className={clsx(styles.panel, flush && styles.panelFlush, className)} aria-labelledby={title ? (id || headId) : undefined}>
      {(title || tools) && (
        <div className={styles.panelHead}>
          <div>
            {title && <h2 id={id || headId} className={styles.panelTitle}>{title}</h2>}
            {sub && <p className={styles.panelSub}>{sub}</p>}
          </div>
          {tools && <div className={styles.panelTools}>{tools}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** The one highlight of a page on the Margube brand panel (navy and blue, white type). */
export function DeskSpotlight({ icon: Icon, label, children, actions, className }) {
  return (
    <section className={clsx(styles.spot, className)}>
      <svg className={styles.spotLeaf} viewBox="0 0 48 48" aria-hidden="true"><path d={LEAF_PATH} /><path d={VEIN_PATH} /></svg>
      {label && <p className={styles.spotLabel}>{Icon && <Icon size={14} aria-hidden="true" />}{label}</p>}
      {children}
      {actions && <div className={styles.spotActions}>{actions}</div>}
    </section>
  );
}

/** Button on the brand panel: `primary` is white with navy text. */
export function SpotAction({ icon: Icon, children, primary, ...rest }) {
  return (
    <button type="button" className={clsx(styles.spotBtn, primary && styles.spotBtnPrimary)} {...rest}>
      {Icon && <Icon size={16} aria-hidden="true" />}
      {children}
    </button>
  );
}

/** Search field of a panel toolbar, with a clear button. */
export function DeskSearch({ value, onChange, placeholder, label }) {
  return (
    <label className={styles.search}>
      <span className={styles.srOnly}>{label}</span>
      <Search size={16} aria-hidden="true" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Borrar búsqueda"><X size={14} aria-hidden="true" /></button>
      )}
    </label>
  );
}

/** One choice among a few (view, period, scope). */
export function DeskSegmented({ value, onChange, options, label }) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const Icon = o.icon;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value}
            className={clsx(value === o.value && styles.segOn)} onClick={() => onChange(o.value)} title={o.title}>
            {Icon && <Icon size={15} aria-hidden="true" />}
            {o.label && <span>{o.label}</span>}
            {o.count != null && <em>{o.count}</em>}
          </button>
        );
      })}
    </div>
  );
}

/** Compact select for a toolbar filter. */
export function DeskSelect({ value, onChange, options, label }) {
  return (
    <label className={styles.select}>
      <span className={styles.srOnly}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={14} aria-hidden="true" />
    </label>
  );
}

/** State of a record: a dot and a word (never colour alone). */
export function StatusPill({ tone, children }) {
  return <span className={styles.pill} data-tone={tone}><i aria-hidden="true" />{children}</span>;
}

/** Labelled row action. Tones: success, danger, accent, neutral. */
export function RowAction({ icon: Icon, children, tone = 'neutral', label, iconOnly, href, download, ...rest }) {
  const Tag = href ? 'a' : 'button';
  return (
    <Tag type={href ? undefined : 'button'} href={href} download={download}
      className={clsx(styles.rowAction, iconOnly && styles.rowActionIcon)} data-tone={tone}
      aria-label={iconOnly ? label : undefined} title={iconOnly ? label : undefined} {...rest}>
      {Icon && <Icon size={15} aria-hidden="true" />}
      {!iconOnly && children}
    </Tag>
  );
}

/** Empty or no-results state of a panel, with the way forward. */
export function DeskEmpty({ icon: Icon, title, text, action }) {
  return (
    <div className={styles.empty} role="status">
      <span className={styles.emptyMark} aria-hidden="true">
        <svg viewBox="0 0 48 48"><path d={LEAF_PATH} /></svg>
        {Icon && <Icon size={20} />}
      </span>
      <strong>{title}</strong>
      {text && <span>{text}</span>}
      {action}
    </div>
  );
}

/** "Mostrar más" under a long list: large volumes render in pages of `step`. */
export function ShowMore({ shown, total, onMore, noun = 'elementos' }) {
  if (shown >= total) return null;
  return (
    <div className={styles.more}>
      <span>Mostrando {shown} de {total} {noun}</span>
      <button type="button" onClick={onMore}>Mostrar más</button>
    </div>
  );
}

export const srOnly = styles.srOnly;

/** Dense table for a panel: sticky head, hover rows, horizontal scroll if it ever needs it. */
export function DeskTable({ head, children, label }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table} aria-label={label}>
        <thead>
          <tr>{head.map((h) => <th key={h.key || h.label} scope="col" className={h.end ? styles.thEnd : undefined}>{h.label}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** Two lines in a cell: the main value and a muted one under it. */
export function CellStack({ title, sub, lead, clamp }) {
  return (
    <div className={styles.cell}>
      {lead}
      <div className={styles.cellText}>
        <strong>{title}</strong>
        {sub && <span className={clamp ? styles.clamp : undefined} title={clamp && typeof sub === 'string' ? sub : undefined}>{sub}</span>}
      </div>
    </div>
  );
}

/** Icon on a tinted tile (the kind of a record). */
export function TypeTile({ icon: Icon, tone = 'accent', size = 36 }) {
  return (
    <span className={styles.tile} data-tone={tone} style={{ width: size, height: size }} aria-hidden="true">
      <Icon size={Math.round(size * 0.46)} />
    </span>
  );
}

/** Actions at the end of a row, right-aligned. */
export function RowActions({ children }) {
  return <div className={styles.rowActions}>{children}</div>;
}
