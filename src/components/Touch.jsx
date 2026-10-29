import { useId, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { ChevronDown, ArrowUpRight, SlidersHorizontal, Check, X } from 'lucide-react';
import { useMediaQuery, TOUCH_QUERY } from '../hooks/useMediaQuery';
import { LEAF_PATH, VEIN_PATH } from './ui/Loader/Loader';
import styles from './Touch.module.scss';

/**
 * The web on phones and tablets (below 1024 px): its own touch compositions, built from the web's
 * pieces (glass over the wallpaper, the navy brand panel, the pill tabs, the leaf) and not from the
 * Expo app's screens. Computers keep the desktop pages; pages switch with useTouch().
 */

export function useTouch() {
  return useMediaQuery(TOUCH_QUERY);
}

const EASE = [0.23, 1, 0.32, 1];

/** Icon on a leaf-shaped tile (the avatars' shape). Tones: accent, success, warning, danger, info, purple, neutral. */
export function LeafIcon({ icon: Icon, tone = 'accent', size = 40, solid }) {
  return (
    <span className={clsx(styles.leafIcon, solid && styles.leafIconSolid)} data-tone={tone} style={{ width: size, height: size }} aria-hidden="true">
      <Icon size={Math.round(size * 0.44)} />
    </span>
  );
}

/** Day number over the short month, for lists ordered by date. */
export function DateStamp({ iso, tone }) {
  const d = new Date(String(iso).length <= 10 ? `${iso}T00:00` : iso);
  if (Number.isNaN(d.getTime())) return <span className={styles.stamp} aria-hidden="true">—</span>;
  return (
    <span className={styles.stamp} data-tone={tone} aria-hidden="true">
      <strong>{d.getDate()}</strong>
      <span>{d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')}</span>
    </span>
  );
}

/** Start and end time stacked, as the lead of a booking. */
export function TimeLead({ start, end }) {
  return (
    <span className={styles.timeLead} aria-hidden="true">
      <strong>{start}</strong>
      <span>{end}</span>
    </span>
  );
}

/**
 * Heading of a touch screen, on the wallpaper (no panel): the section mark and a line of context,
 * a large title and the description. `aside` sits on the right on tablets and under it on phones.
 */
export function Masthead({ icon: Icon, eyebrow, title, desc, aside, className }) {
  return (
    <header className={clsx(styles.masthead, aside && styles.mastWithAside, className)}>
      <div className={styles.mastText}>
        {eyebrow && (
          <p className={styles.mastEyebrow}>
            {Icon && <span className={styles.mastMark} aria-hidden="true"><Icon size={15} /></span>}
            <span>{eyebrow}</span>
          </p>
        )}
        <h1 className={styles.mastTitle}>{title}</h1>
        {desc && <p className={styles.mastDesc}>{desc}</p>}
      </div>
      {aside && <div className={styles.mastAside}>{aside}</div>}
    </header>
  );
}

/**
 * Key figures in one glass strip divided by hairlines. An item with `onClick` is a button (a filter
 * or a shortcut); `active` marks the filter that is on.
 */
export function Ledger({ items, label, className }) {
  return (
    <div className={clsx(styles.ledgerWrap, className)}>
    <dl className={styles.ledger} aria-label={label} data-n={items.length}>
      {items.map((it) => {
        const body = (
          <>
            <dt>{it.label}</dt>
            <dd data-tone={it.tone}>{it.value}</dd>
            {it.hint && <span className={styles.ledgerHint}>{it.hint}</span>}
            {it.onClick && !it.active && !it.toggle && <ArrowUpRight size={14} className={styles.ledgerGo} aria-hidden="true" />}
            {it.active && <Check size={14} className={styles.ledgerGo} aria-hidden="true" />}
          </>
        );
        return it.onClick ? (
          <button key={it.label} type="button" className={clsx(styles.ledgerCell, it.active && styles.ledgerOn)}
            onClick={it.onClick} aria-pressed={it.toggle ? !!it.active : undefined} aria-label={it.actionLabel}>
            {body}
          </button>
        ) : (
          <div key={it.label} className={styles.ledgerCell}>{body}</div>
        );
      })}
    </dl>
    </div>
  );
}

/**
 * The one highlight of a screen on the navy brand panel: what matters most right now (the next
 * booking, the balance, the days left). `ticket` adds a perforated edge before `foot`.
 */
export function Spotlight({ icon: Icon, label, children, foot, actions, ticket, className, ...rest }) {
  return (
    <section className={clsx(styles.spot, ticket && styles.spotTicket, className)} {...rest}>
      <svg className={styles.spotLeaf} viewBox="0 0 48 48" aria-hidden="true"><path d={LEAF_PATH} /><path d={VEIN_PATH} /></svg>
      {label && <p className={styles.spotLabel}>{Icon && <Icon size={14} aria-hidden="true" />}{label}</p>}
      {children}
      {foot && <div className={styles.spotFoot}>{foot}</div>}
      {actions && <div className={styles.spotActions}>{actions}</div>}
    </section>
  );
}

/** Button on the spotlight: `primary` is white with navy text. */
export function SpotButton({ icon: Icon, children, onClick, primary, label, href, ...rest }) {
  const Tag = href ? 'a' : 'button';
  return (
    <Tag type={href ? undefined : 'button'} href={href} className={clsx(styles.spotBtn, primary && styles.spotBtnPrimary, !children && styles.spotBtnIcon)}
      onClick={onClick} aria-label={label} title={label} {...rest}>
      {Icon && <Icon size={17} aria-hidden="true" />}
      {children}
    </Tag>
  );
}

/** Large touch targets for what people come to do. The `primary` one carries the brand gradient. */
export function ActionTiles({ items, className }) {
  return (
    <div className={clsx(styles.tiles, className)} style={{ '--n': items.length }}>
      {items.map((it) => (
        <button key={it.label} type="button" className={clsx(styles.tile, it.primary && styles.tilePrimary)} onClick={it.onClick}
          aria-label={it.badge ? `${it.label}, ${it.badge} pendientes` : undefined}>
          <span className={styles.tileTop}>
            <LeafIcon icon={it.icon} tone={it.tone || 'accent'} size={36} solid={it.primary} />
            {it.badge > 0 ? <span className={styles.tileBadge} aria-hidden="true">{it.badge > 9 ? '9+' : it.badge}</span>
              : <ArrowUpRight size={16} className={styles.tileGo} aria-hidden="true" />}
          </span>
          <span className={styles.tileText}>
            <strong>{it.label}</strong>
            {it.hint && <span>{it.hint}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

/** The web's pill tabs (white track, the open one in solid accent), stretched across the screen. */
export function TabStrip({ value, onChange, options, label, className }) {
  return (
    <div className={clsx(styles.tabStrip, className)} role="tablist" aria-label={label}>
      {options.map((o) => {
        const Icon = o.icon;
        return (
          <button key={o.value} type="button" role="tab" aria-selected={value === o.value}
            className={clsx(styles.tabBtn, value === o.value && styles.tabOn)} onClick={() => onChange(o.value)}>
            {Icon && <Icon size={15} aria-hidden="true" />}
            {o.label}
            {o.count != null && <span className={styles.tabCount}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Search, filters and a few tools in one row. The "Filtros" button opens a panel under the row with
 * each group as a set of options; the filters that are on stay visible as tokens that clear them.
 * groups: [{ id, label, value, onChange, options: [{ value, label, count }], all }]
 */
export function Toolbar({ search, groups = [], tools, className }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const active = groups.filter((g) => g.value !== g.all);
  return (
    <div className={clsx(styles.toolbar, className)}>
      <div className={styles.toolRow}>
        {search && (
          <label className={styles.search}>
            <span className={styles.srOnly}>{search.label}</span>
            {search.icon && <search.icon size={17} aria-hidden="true" />}
            <input type="search" value={search.value} onChange={(e) => search.onChange(e.target.value)} placeholder={search.placeholder} />
          </label>
        )}
        {groups.length > 0 && (
          <button type="button" className={clsx(styles.toolBtn, (open || active.length > 0) && styles.toolBtnOn)}
            onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={panelId}>
            <SlidersHorizontal size={16} aria-hidden="true" />
            <span>Filtros</span>
            {active.length > 0 && <span className={styles.toolCount}>{active.length}</span>}
          </button>
        )}
        {!search && <span className={styles.toolSpacer} />}
        {tools}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={panelId} className={styles.filterPanel}
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE }}>
            <div className={styles.filterInner}>
              {groups.map((g) => (
                <fieldset key={g.id} className={styles.filterGroup}>
                  <legend>{g.label}</legend>
                  <div className={styles.filterOptions}>
                    {g.options.map((o) => (
                      <button key={o.value} type="button" aria-pressed={g.value === o.value}
                        className={clsx(styles.option, g.value === o.value && styles.optionOn)} onClick={() => g.onChange(o.value)}>
                        {g.value === o.value && <Check size={14} aria-hidden="true" />}
                        {o.label}
                        {o.count != null && <span>{o.count}</span>}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ))}
              <button type="button" className={styles.filterDone} onClick={() => setOpen(false)}>Listo</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!open && active.length > 0 && (
        <div className={styles.tokens}>
          {active.map((g) => (
            <button key={g.id} type="button" className={styles.token} onClick={() => g.onChange(g.all)}
              aria-label={`Quitar filtro ${g.label}: ${g.options.find((o) => o.value === g.value)?.label}`}>
              <span>{g.label}:</span> {g.options.find((o) => o.value === g.value)?.label}
              <X size={13} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Round glass tool button (CSV, calendar…). */
export function ToolButton({ icon: Icon, label, onClick }) {
  return (
    <button type="button" className={styles.toolRound} onClick={onClick} aria-label={label} title={label}>
      <Icon size={17} aria-hidden="true" />
    </button>
  );
}

/** A labelled run of items (a day, a month): the heading above, the items in one glass sheet. */
export function FeedGroup({ title, meta, children, className }) {
  return (
    <section className={clsx(styles.group, className)}>
      {(title || meta) && (
        <div className={styles.groupHead}>
          <h3>{title}</h3>
          {meta && <span>{meta}</span>}
        </div>
      )}
      <ul className={styles.feed}>{children}</ul>
    </section>
  );
}

/**
 * One item of a feed. The tone paints the rail on its left edge; `status` is a dot and a word.
 * With `details` or `actions` the item opens in place to show them (the actions carry their names).
 */
export function FeedItem({ lead, title, meta, status, trailing, tone, details, actions, defaultOpen = false, onClick }) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  const expandable = !!(details || actions);
  const head = (
    <>
      {lead}
      <span className={styles.itemText}>
        <strong>{title}</strong>
        {meta && <span>{meta}</span>}
      </span>
      <span className={styles.itemEnd}>
        {status && <span className={styles.itemStatus} data-tone={status.tone}>{status.text}</span>}
        {trailing}
        {expandable && <ChevronDown size={17} className={clsx(styles.itemChev, open && styles.itemChevOpen)} aria-hidden="true" />}
      </span>
    </>
  );
  return (
    <li className={clsx(styles.item, open && styles.itemOpen)} data-tone={tone}>
      {expandable ? (
        <button type="button" className={styles.itemHead} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={bodyId}>{head}</button>
      ) : onClick ? (
        <button type="button" className={styles.itemHead} onClick={onClick}>{head}</button>
      ) : (
        <div className={styles.itemHead}>{head}</div>
      )}
      <AnimatePresence initial={false}>
        {open && expandable && (
          <motion.div id={bodyId} className={styles.itemBody}
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}>
            <div className={styles.itemBodyInner}>
              {details && (
                <dl className={styles.details}>
                  {details.filter((x) => x && x.value != null && x.value !== '').map((x) => (
                    <div key={x.label} className={x.wide ? styles.detailWide : undefined}><dt>{x.label}</dt><dd>{x.value}</dd></div>
                  ))}
                </dl>
              )}
              {actions && <div className={styles.itemActions}>{actions}</div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

/** Labelled action inside an opened item. Tones: accent, success, danger, neutral (default).
 * `pressed` makes it one option of a choice (the work mode). */
export function ItemAction({ icon: Icon, children, onClick, tone = 'neutral', href, download, disabled, pressed, title }) {
  const Tag = href ? 'a' : 'button';
  return (
    <Tag type={href ? undefined : 'button'} href={href} download={download} className={clsx(styles.itemAction, pressed && styles.itemActionOn)}
      data-tone={tone} onClick={onClick} disabled={disabled} aria-pressed={pressed} title={title}>
      {Icon && <Icon size={16} aria-hidden="true" />}
      {children}
    </Tag>
  );
}

/** Section that folds: the secondary information of a screen, closed until it is wanted. */
export function Fold({ icon, tone, title, meta, defaultOpen = false, children, className }) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  return (
    <section className={clsx(styles.fold, open && styles.foldOpen, className)}>
      <button type="button" className={styles.foldHead} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={bodyId}>
        {icon && <LeafIcon icon={icon} tone={tone} size={36} />}
        <span className={styles.foldText}>
          <strong>{title}</strong>
          {meta && <span>{meta}</span>}
        </span>
        <ChevronDown size={18} className={clsx(styles.itemChev, open && styles.itemChevOpen)} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={bodyId} className={styles.foldBody}
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE }}>
            <div className={styles.foldInner}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/** Heading of a block of a touch screen, with an optional link on the right. */
export function BlockHead({ title, meta, action, onAction }) {
  return (
    <div className={styles.blockHead}>
      <div>
        <h2>{title}</h2>
        {meta && <p>{meta}</p>}
      </div>
      {action && (
        <button type="button" onClick={onAction}>{action} <ArrowUpRight size={14} aria-hidden="true" /></button>
      )}
    </div>
  );
}

/** Designed empty state: the leaf outline around the icon, a title, a line and the way forward. */
export function TouchEmpty({ icon: Icon, title, text, action, compact }) {
  return (
    <div className={clsx(styles.empty, compact && styles.emptyCompact)} role="status">
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

/** Button for an empty state or a block: `primary` is the brand gradient, otherwise glass. */
export function TouchButton({ icon: Icon, children, onClick, primary, className, ...rest }) {
  return (
    <button type="button" className={clsx(styles.btn, primary && styles.btnPrimary, className)} onClick={onClick} {...rest}>
      {Icon && <Icon size={16} aria-hidden="true" />}
      {children}
    </button>
  );
}

export const STATUS = {
  pending:   { tone: 'warning', text: 'Pendiente' },
  approved:  { tone: 'success', text: 'Aprobada' },
  confirmed: { tone: 'success', text: 'Confirmada' },
  rejected:  { tone: 'danger',  text: 'Rechazada' },
  cancelled: { tone: 'danger',  text: 'Cancelada' },
};
