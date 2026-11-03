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
export function DeskEyebrow({ icon: Icon, eyebrow, kicker }) {
  const date = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const line = eyebrow ?? (kicker ? `${kicker} · ${date}` : date);
  return (
    <p className={styles.eyebrow}>
      {Icon && <span className={styles.mark} aria-hidden="true"><Icon size={15} /></span>}
      <span>{line}</span>
    </p>
  );
}

/** Page heading: the context line, a large title, what the page is for, and its main actions.
 * `kicker` names the page's context before the date («Portal del empleado · martes, 3…»). */
export function DeskHeader({ icon, eyebrow, kicker, title, desc, actions }) {
  return (
    <header className={styles.header}>
      <div className={styles.headText}>
        <DeskEyebrow icon={icon} eyebrow={eyebrow} kicker={kicker} />
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

/**
 * Horizontal tabs in a smoked pill track: the open one is a solid accent pill. Each tab may carry a
 * count and an `alert` dot (something waits there). Used as a filter (aria-pressed).
 */
export function DeskTabs({ items, value, onChange, label }) {
  return (
    <div className={styles.tabs} role="group" aria-label={label}>
      {items.map((it) => {
        const Icon = it.icon;
        const on = value === it.value;
        return (
          <button key={it.value} type="button" className={clsx(styles.tab, on && styles.tabOn)}
            onClick={() => onChange(it.value)} aria-pressed={on}>
            {Icon && <Icon size={15} aria-hidden="true" />}
            <span>{it.label}</span>
            {it.count != null && <em>{it.count}</em>}
            {it.alert && <i className={styles.tabAlert} aria-label="con pendientes" />}
          </button>
        );
      })}
    </div>
  );
}

/**
 * KPI card with a progress track: an uppercase context line, a title, the icon in a tinted chip at
 * the corner, the figure with its unit, a small badge and the track in the card's tone. Anything in
 * `children` goes under the track (a week strip, a button). `onClick` turns it into a filter.
 */
export function DeskGauge({ icon: Icon, tone = 'accent', eyebrow, title, value, unit, badge, progress, children, onClick, active, label }) {
  const Root = onClick ? 'button' : 'section';
  const pct = progress == null ? null : Math.max(0, Math.min(100, progress));
  return (
    <Root type={onClick ? 'button' : undefined} onClick={onClick} aria-pressed={onClick ? !!active : undefined}
      aria-label={label} className={clsx(styles.gauge, onClick && styles.gaugeBtn, active && styles.gaugeOn)} data-tone={tone}>
      <div className={styles.gaugeHead}>
        <div>
          {eyebrow && <p className={styles.gaugeEyebrow}>{eyebrow}</p>}
          {title && <p className={styles.gaugeTitle}>{title}</p>}
        </div>
        {Icon && <span className={styles.gaugeIcon} aria-hidden="true"><Icon size={20} /></span>}
      </div>
      <div className={styles.gaugeFigure}>
        <strong>{value}</strong>
        {unit && <span>{unit}</span>}
        {badge && <em className={styles.gaugeBadge}>{badge}</em>}
      </div>
      {pct != null && (
        <span className={styles.gaugeTrack} aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
      )}
      {children}
    </Root>
  );
}

/** Small filter pills with a label in front («Estado: Todas · Pendientes (2) · …»). */
export function DeskChips({ label, value, onChange, options }) {
  return (
    <div className={styles.chips} role="group" aria-label={label}>
      <span className={styles.chipsLabel} aria-hidden="true">{label}:</span>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value}
          className={clsx(styles.chip, value === o.value && styles.chipOn)} onClick={() => onChange(o.value)}>
          {o.label}{o.count != null && o.count > 0 && <em> ({o.count})</em>}
        </button>
      ))}
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

/**
 * Labelled row action. Tones: success, danger, accent, neutral. In a narrow table the word hides
 * and the icon stays (see .rowActionText), so the button keeps its name for screen readers and as
 * a tooltip.
 */
export function RowAction({ icon: Icon, children, tone = 'neutral', label, iconOnly, href, download, ...rest }) {
  const Tag = href ? 'a' : 'button';
  const word = typeof children === 'string' ? children : undefined;
  return (
    <Tag type={href ? undefined : 'button'} href={href} download={download}
      className={clsx(styles.rowAction, iconOnly && styles.rowActionIcon)} data-tone={tone}
      aria-label={iconOnly ? label : word} title={iconOnly ? label : word} {...rest}>
      {Icon && <Icon size={15} aria-hidden="true" />}
      {!iconOnly && <span className={styles.rowActionText}>{children}</span>}
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
/** Grid for a row of DeskGauge cards (`style={{ '--n': 3 }}`) and the search + chips bar of a panel. */
export const gaugeRow = styles.gauges;
export const filterBar = styles.filterBar;
/** A secondary column (head item `optional: true`, and this class on its cells) that a narrow table drops. */
export const optionalCol = styles.optional;

/** Dense table for a panel: sticky head, hover rows, horizontal scroll if it ever needs it. */
export function DeskTable({ head, children, label }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table} aria-label={label}>
        <thead>
          <tr>{head.map((h) => <th key={h.key || h.label} scope="col" className={clsx(h.end && styles.thEnd, h.optional && styles.optional)}>{h.label}</th>)}</tr>
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
