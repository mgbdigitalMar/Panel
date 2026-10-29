import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Download, Search, CheckCircle, Inbox, TrendingDown, X, CheckCheck, CalendarRange, Timer, UsersRound, Wallet,
} from 'lucide-react';
import { Button, Input } from '../components/ui';
import { DeskEyebrow } from '../components/Desk';
import { fmtHM } from '../utils/format';
import styles from './HorasDesk.module.scss';

/*
 * Tiempo a compensar on computers and tablets: an account statement.
 * The balance on the brand panel with its make-up and how it moved, the movements grouped by
 * month with the running balance, and the always-open "Registrar horas" form beside them.
 */

const TYPE = {
  ya:    { label: 'Inmediata', icon: CheckCircle,  tone: 'success' },
  bolsa: { label: 'Bolsa',     icon: Inbox,        tone: 'accent' },
  debe:  { label: 'Debo',      icon: TrendingDown, tone: 'danger' },
};
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const QUICK_HOURS = [0.5, 1, 2, 4, 8];

const parse = (iso) => new Date(`${iso}T00:00`);
const fmtShort = (iso) => parse(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');

/** What a record does to the balance: approved credit adds, owed hours subtract (same rule as the totals). */
const effect = (h) => (h.type === 'debe' ? -(Number(h.hours) || 0) : h.status === 'approved' ? Number(h.hours) || 0 : 0);

function stateText(h) {
  if (h.type === 'ya') return 'Compensada al instante';
  if (h.type === 'debe') return h.status === 'rejected' ? 'Rechazada' : 'Registrada como deuda';
  if (h.status === 'pending') return 'Pendiente de aprobar';
  return h.status === 'approved' ? 'Aprobada' : 'Rechazada';
}

/** Title, description and the page's actions: "Mi cuenta / Equipo" (admins) and the CSV export. */
export function HorasDeskHeader({ view, setView, isAdmin, teamPending = 0, onExport, canExport }) {
  return (
    <header className={styles.head}>
      <div className={styles.headText}>
        <DeskEyebrow icon={Timer} />
        <h1 className={styles.title}>Tiempo a compensar</h1>
        <p className={styles.desc}>Registra tus horas y consulta tu saldo con la empresa.</p>
      </div>
      <div className={styles.headActions}>
        {isAdmin && (
          <div className={styles.switch} role="tablist" aria-label="Vista">
            <button type="button" role="tab" aria-selected={view !== 'usuarios'} className={clsx(view !== 'usuarios' && styles.switchOn)} onClick={() => setView('bolsa')}>
              <Wallet size={15} aria-hidden="true" /> Mi cuenta
            </button>
            <button type="button" role="tab" aria-selected={view === 'usuarios'} className={clsx(view === 'usuarios' && styles.switchOn)} onClick={() => setView('usuarios')}>
              <UsersRound size={15} aria-hidden="true" /> Equipo
              {teamPending > 0 && <span className={styles.switchCount} aria-label={`${teamPending} con horas pendientes`}>{teamPending}</span>}
            </button>
          </div>
        )}
        {canExport && <Button variant="secondary" icon={Download} onClick={onExport}>Exportar CSV</Button>}
      </div>
    </header>
  );
}

/** Balance over the last 90 days (end of each day with movements), for the hero's chart. */
function useEvolution(records) {
  return useMemo(() => {
    const byDay = new Map();
    [...records].sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach((h) => {
      if (!h.date) return;
      byDay.set(h.date, (byDay.get(h.date) || 0) + effect(h));
    });
    let run = 0;
    const all = [...byDay.entries()].map(([date, delta]) => { run += delta; return { date, balance: Math.round(run * 100) / 100 }; });
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const sinceIso = since.toISOString().slice(0, 10);
    const before = all.filter((p) => p.date < sinceIso).pop();
    const recent = all.filter((p) => p.date >= sinceIso);
    return before ? [{ date: sinceIso, balance: before.balance }, ...recent] : recent;
  }, [records]);
}

function EvolutionTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className={styles.tip}>
      <span>{fmtShort(p.date)}</span>
      <strong>{fmtHM(p.balance, true)} h</strong>
    </div>
  );
}

/** The brand panel: balance, what it is made of and its evolution. */
function BalanceHero({ records, balance, creditHours, debtHours, pendingHours, filtered }) {
  const evolution = useEvolution(records);
  const total = creditHours + debtHours + pendingHours;
  const share = (v) => (total > 0 ? `${(v / total) * 100}%` : '0%');
  const verdict = Math.round(balance * 60) === 0 ? 'Estás al día con la empresa'
    : balance > 0 ? 'A tu favor' : 'Debes a la empresa';

  return (
    <section className={styles.hero} aria-label="Saldo de horas">
      <svg className={styles.heroLeaf} viewBox="0 0 48 48" aria-hidden="true">
        <path d="M9.5 39.5C9.5 22 14.5 10 25 9.2L39.5 8.8V24C39.5 34 33 39.5 24 39.5Z" />
        <path d="M10.5 38.5C12.5 31 16.5 26.8 22 24" />
      </svg>

      <div className={styles.heroMain}>
        <div className={styles.heroTop}>
          <span className={styles.heroLabel}>Saldo de horas</span>
          <span className={styles.heroChip}><CalendarRange size={13} aria-hidden="true" /> {filtered ? 'Periodo filtrado' : 'Todo el historial'}</span>
        </div>
        <p className={styles.heroValue}>
          <strong className={clsx(balance < 0 && styles.neg)}>{fmtHM(balance, true)}</strong>
          <span>h</span>
        </p>
        <p className={styles.heroVerdict}>{verdict}</p>

        <div className={styles.mix} role="img"
          aria-label={`Ganadas ${fmtHM(creditHours)} horas, debo ${fmtHM(debtHours)}, en revisión ${fmtHM(pendingHours)}`}>
          {total > 0 ? (
            <>
              <span data-tone="credit" style={{ width: share(creditHours) }} />
              <span data-tone="debt" style={{ width: share(debtHours) }} />
              <span data-tone="pending" style={{ width: share(pendingHours) }} />
            </>
          ) : <span data-tone="empty" style={{ width: '100%' }} />}
        </div>

        <dl className={styles.figures}>
          <div><dt><i data-tone="credit" />Ganadas</dt><dd>{fmtHM(creditHours, true)}</dd></div>
          <div><dt><i data-tone="debt" />Debo</dt><dd>{debtHours ? `−${fmtHM(debtHours)}` : '0:00'}</dd></div>
          <div><dt><i data-tone="pending" />En revisión</dt><dd>{fmtHM(pendingHours, true)}</dd></div>
        </dl>
      </div>

      <div className={styles.heroChart}>
        <span className={styles.heroLabel}>Evolución · 90 días</span>
        {evolution.length > 1 ? (
          <div className={styles.chart}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolution} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="horasEvo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#7AA2FF" stopOpacity={0.5} />
                    <stop offset="1" stopColor="#7AA2FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                <Tooltip content={<EvolutionTip />} cursor={{ stroke: 'rgba(255,255,255,0.3)', strokeDasharray: '3 3' }} />
                <Area type="monotone" dataKey="balance" stroke="#9DB4FF" strokeWidth={2.2} fill="url(#horasEvo)"
                  dot={false} activeDot={{ r: 4, fill: '#FFFFFF', stroke: '#2F5BEA', strokeWidth: 2 }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className={styles.chartEmpty}>La evolución aparecerá con tus primeros movimientos.</p>
        )}
      </div>
    </section>
  );
}

/** The movements, grouped by month, with the running balance after each one. */
function Movements({ records, from, to, setFrom, setTo }) {
  const [type, setType] = useState('all');
  const [onlyPending, setOnlyPending] = useState(false);
  const [q, setQ] = useState('');

  // Running balance: every record in date order, before any filter
  const running = useMemo(() => {
    const map = new Map();
    let run = 0;
    [...records]
      .sort((a, b) => (a.date || '').localeCompare(b.date || '') || String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
      .forEach((h) => { run += effect(h); map.set(h.id, run); });
    return map;
  }, [records]);

  const counts = useMemo(() => ({
    all: records.length,
    ya: records.filter((h) => h.type === 'ya').length,
    bolsa: records.filter((h) => h.type === 'bolsa').length,
    debe: records.filter((h) => h.type === 'debe').length,
  }), [records]);

  const needle = q.trim().toLowerCase();
  const rows = records
    .filter((h) => (!from || h.date >= from) && (!to || h.date <= to))
    .filter((h) => type === 'all' || h.type === type)
    .filter((h) => !onlyPending || h.status === 'pending')
    .filter((h) => !needle || (h.reason || '').toLowerCase().includes(needle))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const months = [];
  rows.forEach((h) => {
    const key = (h.date || '').slice(0, 7);
    let m = months[months.length - 1];
    if (!m || m.key !== key) { m = { key, rows: [], net: 0 }; months.push(m); }
    m.rows.push(h);
    m.net += effect(h);
  });

  const filtering = type !== 'all' || onlyPending || needle || from || to;
  const clear = () => { setType('all'); setOnlyPending(false); setQ(''); setFrom(''); setTo(''); };

  return (
    <section className={styles.movements} aria-labelledby="horas-movs">
      <div className={styles.movHead}>
        <div>
          <h2 id="horas-movs" className={styles.cardTitle}>Movimientos</h2>
          <p className={styles.cardSub}>{rows.length} {rows.length === 1 ? 'registro' : 'registros'}{filtering ? ' con estos filtros' : ''}</p>
        </div>
        <label className={styles.search}>
          <Search size={15} aria-hidden="true" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por motivo" aria-label="Buscar por motivo" />
        </label>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.chips} role="group" aria-label="Tipo">
          {[['all', 'Todo'], ['ya', 'Inmediata'], ['bolsa', 'Bolsa'], ['debe', 'Debo']].map(([id, label]) => (
            <button key={id} type="button" aria-pressed={type === id} className={clsx(type === id && styles.chipOn)} onClick={() => setType(id)}>
              {label} <span>{counts[id]}</span>
            </button>
          ))}
          <button type="button" aria-pressed={onlyPending} className={clsx(styles.chipPending, onlyPending && styles.chipOn)} onClick={() => setOnlyPending((v) => !v)}>
            Solo pendientes
          </button>
        </div>
        <div className={styles.range}>
          <label>
            <span>Desde</span>
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            <span>Hasta</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </label>
          {filtering && (
            <button type="button" className={styles.clear} onClick={clear}><X size={14} aria-hidden="true" /> Limpiar</button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}><Inbox size={22} aria-hidden="true" /></span>
          <strong>{records.length ? 'Ningún movimiento con estos filtros' : 'Todavía no hay movimientos'}</strong>
          <span>{records.length ? 'Prueba con otros filtros o límpialos.' : 'Registra tus primeras horas con el formulario de la derecha.'}</span>
        </div>
      ) : (
        <div className={styles.ledger}>
          <div className={styles.ledgerHead} aria-hidden="true">
            <span>Fecha</span><span>Movimiento</span><span>Horas</span><span>Saldo</span>
          </div>
          {months.map((m) => {
            const [y, mo] = m.key.split('-').map(Number);
            return (
              <div key={m.key} className={styles.month} role="group" aria-label={`${MONTHS[mo - 1]} ${y}`}>
                <div className={styles.monthHead}>
                  <strong>{MONTHS[mo - 1]} {y}</strong>
                  <span className={clsx(m.net < 0 && styles.neg, m.net > 0 && styles.pos)}>{fmtHM(m.net, true)} h en el mes</span>
                </div>
                <ul>
                  {m.rows.map((h) => {
                    const t = TYPE[h.type] || TYPE.bolsa;
                    const d = parse(h.date);
                    const owed = h.type === 'debe';
                    const run = running.get(h.id) || 0;
                    return (
                      <li key={h.id} className={clsx(styles.mov, h.status === 'rejected' && styles.movRejected)}>
                        <span className={styles.movDate}>
                          <strong>{d.getDate()}</strong>
                          <span>{WEEKDAYS[d.getDay()]}</span>
                        </span>
                        <span className={styles.movMain}>
                          <span className={styles.movIcon} data-tone={t.tone}><t.icon size={16} aria-hidden="true" /></span>
                          <span className={styles.movText}>
                            <strong>{h.reason || t.label}</strong>
                            <span>
                              {t.label} · <em data-status={h.status}>{stateText(h)}</em>
                              {h.reviewerName && ` · por ${h.reviewerName}${h.reviewedAt ? ` el ${new Date(h.reviewedAt).toLocaleDateString('es-ES')}` : ''}`}
                            </span>
                          </span>
                        </span>
                        <span className={clsx(styles.movAmount, owed ? styles.neg : h.status === 'pending' ? styles.pend : styles.pos)}>
                          {owed ? '−' : '+'}{fmtHM(h.hours)}
                        </span>
                        <span className={styles.movRun} title="Saldo tras este movimiento">{fmtHM(run, true)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** "Registrar horas", always open beside the statement. */
function Composer({ composer, focus, onFocused }) {
  const { config, mode, setMode, form, setForm, today, hoursError, dateError, loading, submit, success, saveError } = composer;
  const cfg = config[mode];
  const ref = useRef(null);

  // ?nueva=1 (search, shortcuts, "Crear") brings the form into view, ready to type
  useEffect(() => {
    if (!focus) return;
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('hours-date')?.focus({ preventScroll: true });
    onFocused?.();
  }, [focus, onFocused]);

  const canSend = form.date && form.reason.trim() && form.hours && !hoursError && !dateError && !loading;

  return (
    <section ref={ref} className={styles.composer} aria-labelledby="horas-new">
      <h2 id="horas-new" className={styles.cardTitle}>Registrar horas</h2>
      <p className={styles.cardSub}>Elige qué quieres hacer con ellas.</p>

      <div className={styles.modes} role="radiogroup" aria-label="Tipo de registro">
        {Object.entries(config).map(([key, c]) => {
          const t = TYPE[key];
          return (
            <button key={key} type="button" role="radio" aria-checked={mode === key} data-tone={t.tone}
              className={clsx(styles.mode, mode === key && styles.modeOn)} onClick={() => setMode(key)}>
              <span className={styles.modeIcon}><c.icon size={17} aria-hidden="true" /></span>
              <span className={styles.modeText}>
                <strong>{t.label}</strong>
                <span>{c.desc}</span>
              </span>
              <span className={styles.modeRadio} aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <p className={styles.notice} data-tone={TYPE[mode].tone}>
        <cfg.bannerIcon size={15} aria-hidden="true" />
        <span>{cfg.banner}</span>
      </p>

      <div className={styles.fields}>
        <Input
          label={cfg.dateLabel}
          type="date"
          value={form.date}
          onChange={(v) => setForm({ ...form, date: v })}
          max={mode === 'debe' ? today : undefined}
          error={dateError}
          id="hours-date"
          required
        />
        <div>
          <Input
            label={mode === 'debe' ? 'Horas que debo' : 'Horas a compensar'}
            type="number"
            value={form.hours}
            onChange={(v) => setForm({ ...form, hours: v })}
            placeholder="Ej: 1.5"
            min="0.25"
            max="24"
            step="0.25"
            error={hoursError}
            id="hours-amount"
            required
          />
          <div className={styles.quick} role="group" aria-label="Horas rápidas">
            {QUICK_HOURS.map((h) => (
              <button key={h} type="button" aria-pressed={Number(form.hours) === h} className={clsx(Number(form.hours) === h && styles.quickOn)}
                onClick={() => setForm({ ...form, hours: String(h) })}>
                {fmtHM(h)}
              </button>
            ))}
          </div>
        </div>
        <Input
          label={mode === 'debe' ? 'Motivo (llegada tarde, salida anticipada...)' : 'Motivo'}
          value={form.reason}
          onChange={(v) => setForm({ ...form, reason: v })}
          placeholder={mode === 'debe' ? 'Ej: He entrado 30 min tarde por ir al banco' : 'Describe brevemente el motivo'}
          id="hours-reason"
          required
        />
      </div>

      <Button
        className={styles.submit}
        icon={cfg.btnIcon}
        onClick={submit}
        loading={loading}
        disabled={!canSend}
        variant={mode === 'debe' ? 'danger' : mode === 'ya' ? 'success' : 'primary'}
      >
        {cfg.btnLabel}
      </Button>

      <AnimatePresence mode="wait">
        {success && (
          <motion.p
            key="ok"
            className={styles.success}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            role="status"
          >
            <CheckCheck size={15} aria-hidden="true" /> {success}
          </motion.p>
        )}
      </AnimatePresence>
      {saveError && <p className={styles.error} role="alert">{saveError}</p>}
    </section>
  );
}

/** The statement: hero and movements in the main column, the form in the side column. */
export function HorasStatement({
  records, balance, creditHours, pendingHours, debtHours, from, to, setFrom, setTo,
  focusComposer, onComposerFocused, composer,
}) {
  return (
    <div className={styles.statement}>
      <div className={styles.mainCol}>
        <BalanceHero records={records} balance={balance} creditHours={creditHours} debtHours={debtHours}
          pendingHours={pendingHours} filtered={!!(from || to)} />
        <Movements records={records} from={from} to={to} setFrom={setFrom} setTo={setTo} />
      </div>
      <aside className={styles.sideCol}>
        <Composer composer={composer} focus={focusComposer} onFocused={onComposerFocused} />
      </aside>
    </div>
  );
}
