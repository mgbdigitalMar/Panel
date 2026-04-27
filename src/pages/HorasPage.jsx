import { useState, useMemo } from 'react';
import { useAuth, useData } from '../context';
import { Card, Button, Input } from '../components/ui';
import { Clock, Inbox, CheckCircle, XCircle, Download, Timer, PenTool, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import styles from './HorasPage.module.scss';

// ── Excel/CSV export ──────────────────────────────────────────
function exportToCSV(rows, filename) {
  const typeLabel = t => t === 'ya' ? 'Inmediata' : t === 'bolsa' ? 'Bolsa' : 'Debo';
  const headers = ['Fecha', 'Motivo', 'Horas', 'Tipo', 'Estado', 'Fecha solicitud'];
  const lines = [
    headers.join(';'),
    ...rows.map(r => [
      r.date,
      `"${(r.reason || '').replace(/"/g, '""')}"`,
      String(r.hours).replace('.', ','),
      typeLabel(r.type),
      r.status === 'approved' ? 'Aprobada' : r.status === 'rejected' ? 'Rechazada' : 'Pendiente',
      new Date(r.createdAt).toLocaleDateString('es-ES'),
    ].join(';')),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

const MODE_CONFIG = {
  ya: {
    label: 'Ya',
    desc: 'Registro inmediato — sin aprobación',
    icon: CheckCircle,
    banner: '⚡ Las horas se registrarán como compensadas inmediatamente.',
    btnLabel: 'Registrar compensación',
    btnIcon: CheckCircle,
    successMsg: '✅ Compensación registrada correctamente.',
    colorClass: 'infoYa',
  },
  bolsa: {
    label: 'Bolsa',
    desc: 'Acumular horas — requiere aprobación admin',
    icon: Inbox,
    banner: '📋 La solicitud será revisada por el administrador antes de añadirse a tu bolsa.',
    btnLabel: 'Enviar a bolsa',
    btnIcon: PenTool,
    successMsg: '📋 Solicitud enviada. Pendiente de aprobación.',
    colorClass: 'infoBolsa',
  },
  debe: {
    label: 'Debo',
    desc: 'Registrar horas que debo a la empresa',
    icon: TrendingDown,
    banner: '⚠️ Estas horas quedan registradas como deuda — el admin puede revisarlas.',
    btnLabel: 'Registrar horas que debo',
    btnIcon: TrendingDown,
    successMsg: '📌 Horas de deuda registradas correctamente.',
    colorClass: 'infoDebe',
  },
};

export default function HorasPage() {
  const { user } = useAuth();
  const { hourCompensations = [], createHourCompensation } = useData();

  const [tab, setTab]   = useState('nueva');
  const [mode, setMode] = useState('ya');
  const [form, setForm] = useState({ date: '', reason: '', hours: '' });
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState('');

  // Filters for "Mi Bolsa"
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo,   setFilterTo]   = useState('');

  const myAll = useMemo(
    () => hourCompensations.filter(h => String(h.employeeId) === String(user?.id)),
    [hourCompensations, user]
  );

  // Separate by type group
  const myCredit = useMemo(() =>
    myAll
      .filter(h => h.type === 'bolsa' || h.type === 'ya')
      .filter(h => (!filterFrom || h.date >= filterFrom) && (!filterTo || h.date <= filterTo)),
    [myAll, filterFrom, filterTo]
  );

  const myDebt = useMemo(() =>
    myAll
      .filter(h => h.type === 'debe')
      .filter(h => (!filterFrom || h.date >= filterFrom) && (!filterTo || h.date <= filterTo)),
    [myAll, filterFrom, filterTo]
  );

  // Stats
  const creditHours  = myCredit.filter(h => h.status === 'approved').reduce((s, h) => s + h.hours, 0);
  const pendingHours = myCredit.filter(h => h.status === 'pending').reduce((s, h) => s + h.hours, 0);
  const debtHours    = myDebt.reduce((s, h) => s + h.hours, 0);
  const balance      = creditHours - debtHours; // positive = in favour; negative = owes

  const allRows = [...myCredit, ...myDebt].sort((a, b) => b.date.localeCompare(a.date));

  const handleSubmit = async () => {
    if (!form.date || !form.reason || !form.hours) return;
    setLoading(true);
    const result = await createHourCompensation({
      employeeId: user.id,
      date: form.date,
      reason: form.reason,
      hours: parseFloat(form.hours),
      type: mode,
    });
    setLoading(false);
    if (result) {
      setSuccess(MODE_CONFIG[mode].successMsg);
      setForm({ date: '', reason: '', hours: '' });
      setTimeout(() => setSuccess(''), 5000);
    }
  };

  const statusBadge = (status) => {
    if (status === 'approved') return <span className={clsx(styles.statusBadge, styles.statusApproved)}><CheckCircle size={11} /> Aprobada</span>;
    if (status === 'rejected') return <span className={clsx(styles.statusBadge, styles.statusRejected)}><XCircle size={11} /> Rechazada</span>;
    return <span className={clsx(styles.statusBadge, styles.statusPending)}><Clock size={11} /> Pendiente</span>;
  };

  const typeBadge = (type) => {
    if (type === 'ya')    return <span className={clsx(styles.typeBadge, styles.typeYa)}>Inmediata</span>;
    if (type === 'bolsa') return <span className={clsx(styles.typeBadge, styles.typeBolsa)}>Bolsa</span>;
    return <span className={clsx(styles.typeBadge, styles.typeDebe)}>Debo</span>;
  };

  const tabBtn = (id, label) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      className={clsx(styles.tabBtn, { [styles.tabBtnActive]: tab === id })}
    >
      {label}
    </button>
  );

  const cfg = MODE_CONFIG[mode];

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerIcon}><Timer size={22} /></div>
        <div>
          <h1>Horas Extra</h1>
          <p>Registra compensaciones, bolsa de horas y horas que debes a la empresa</p>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.pageControls}>
        <div className={styles.tabsRow}>
          {tabBtn('nueva', '＋ Nueva solicitud')}
          {tabBtn('bolsa', '🗂 Mi Registro')}
        </div>
        {tab === 'bolsa' && allRows.length > 0 && (
          <Button
            icon={Download}
            variant="ghost"
            onClick={() => exportToCSV(allRows, `horas-${new Date().toISOString().slice(0,10)}.csv`)}
          >
            Descargar Excel
          </Button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* ── NUEVA SOLICITUD ── */}
        {tab === 'nueva' && (
          <motion.div
            key="nueva"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            <Card className={styles.formCard}>
              {/* Mode toggle — 3 options */}
              <div className={styles.modeToggle}>
                {Object.entries(MODE_CONFIG).map(([key, c]) => {
                  const Icon = c.icon;
                  return (
                    <button
                      key={key}
                      className={clsx(styles.modeBtn, {
                        [styles.modeBtnActive]: mode === key,
                        [styles.modeBtnDebe]: key === 'debe',
                        [styles.modeBtnDebeActive]: key === 'debe' && mode === 'debe',
                      })}
                      onClick={() => setMode(key)}
                    >
                      <Icon size={16} />
                      <div>
                        <strong>{c.label}</strong>
                        <span>{c.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Info banner */}
              <div className={clsx(styles.infoBanner, styles[cfg.colorClass])}>
                {cfg.banner}
              </div>

              {/* Form */}
              <div className={styles.formGrid}>
                <Input
                  label={mode === 'debe' ? 'Fecha en que se debieron' : 'Fecha de compensación'}
                  type="date"
                  value={form.date}
                  onChange={v => setForm({ ...form, date: v })}
                  required
                />
                <Input
                  label={mode === 'debe' ? 'Horas que debo' : 'Horas a compensar'}
                  type="number"
                  value={form.hours}
                  onChange={v => setForm({ ...form, hours: v })}
                  placeholder="Ej: 1.5"
                  required
                />
                <div className={styles.fullWidth}>
                  <Input
                    label={mode === 'debe' ? 'Motivo (llegada tarde, salida anticipada...)' : 'Motivo'}
                    value={form.reason}
                    onChange={v => setForm({ ...form, reason: v })}
                    placeholder={
                      mode === 'debe'
                        ? 'Ej: Llegué 1h tarde por cita médica...'
                        : 'Describe brevemente el motivo de la compensación...'
                    }
                    required
                  />
                </div>
              </div>

              <div className={styles.formFooter}>
                <Button
                  icon={cfg.btnIcon}
                  onClick={handleSubmit}
                  loading={loading}
                  disabled={!form.date || !form.reason || !form.hours || loading}
                  variant={mode === 'debe' ? 'danger' : 'primary'}
                >
                  {cfg.btnLabel}
                </Button>
                {success && <span className={styles.successMsg}>{success}</span>}
              </div>
            </Card>
          </motion.div>
        )}

        {/* ── MI REGISTRO ── */}
        {tab === 'bolsa' && (
          <motion.div
            key="bolsa"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            {/* Balance stats */}
            <div className={styles.statsRow}>
              <div className={clsx(styles.statCard, styles.statApproved)}>
                <TrendingUp size={20} />
                <div>
                  <span className={styles.statValue}>{creditHours.toFixed(1)}h</span>
                  <span className={styles.statLabel}>A favor (aprobadas)</span>
                </div>
              </div>
              <div className={clsx(styles.statCard, styles.statPending)}>
                <Clock size={20} />
                <div>
                  <span className={styles.statValue}>{pendingHours.toFixed(1)}h</span>
                  <span className={styles.statLabel}>Pendientes aprobación</span>
                </div>
              </div>
              <div className={clsx(styles.statCard, styles.statRejected)}>
                <TrendingDown size={20} />
                <div>
                  <span className={styles.statValue}>{debtHours.toFixed(1)}h</span>
                  <span className={styles.statLabel}>Debo a la empresa</span>
                </div>
              </div>
              {/* Net balance */}
              <div className={clsx(styles.statCard, balance >= 0 ? styles.statApproved : styles.statRejected, styles.statBalance)}>
                {balance > 0 ? <TrendingUp size={20} /> : balance < 0 ? <TrendingDown size={20} /> : <Minus size={20} />}
                <div>
                  <span className={styles.statValue}>{balance >= 0 ? '+' : ''}{balance.toFixed(1)}h</span>
                  <span className={styles.statLabel}>Balance neto</span>
                </div>
              </div>
            </div>

            {/* Filters */}
            <Card className={styles.filterCard}>
              <div className={styles.filterRow}>
                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>Desde</label>
                  <input type="date" className={styles.filterInput} value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
                </div>
                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>Hasta</label>
                  <input type="date" className={styles.filterInput} value={filterTo} onChange={e => setFilterTo(e.target.value)} />
                </div>
                {(filterFrom || filterTo) && (
                  <button className={styles.clearFilter} onClick={() => { setFilterFrom(''); setFilterTo(''); }}>
                    Limpiar
                  </button>
                )}
                <span className={styles.filterCount}>{allRows.length} registro{allRows.length !== 1 ? 's' : ''}</span>
              </div>
            </Card>

            {/* Table */}
            {allRows.length === 0 ? (
              <Card className={styles.emptyCard}>
                <Inbox size={44} strokeWidth={1} />
                <p>No hay registros aún</p>
                <span>Usa "Nueva solicitud" para añadir horas</span>
              </Card>
            ) : (
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        {['Fecha', 'Tipo', 'Motivo', 'Horas', 'Estado', 'Revisado'].map(h => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allRows.map(h => (
                        <tr key={h.id} className={h.type === 'debe' ? styles.rowDebe : ''}>
                          <td className={styles.dateCell}>
                            {new Date(h.date + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td>{typeBadge(h.type)}</td>
                          <td className={styles.reasonCell}>{h.reason}</td>
                          <td>
                            <span className={clsx(styles.hoursChip, h.type === 'debe' ? styles.hoursChipDebe : '')}>
                              {h.type === 'debe' ? '-' : '+'}{h.hours}h
                            </span>
                          </td>
                          <td>{statusBadge(h.status)}</td>
                          <td className={styles.reviewCell}>
                            {h.reviewerName
                              ? <><strong>{h.reviewerName}</strong><br /><span>{h.reviewedAt ? new Date(h.reviewedAt).toLocaleDateString('es-ES') : ''}</span></>
                              : <span style={{ color: 'var(--text-mut)' }}>—</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
