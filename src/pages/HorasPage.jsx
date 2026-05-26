import { useState, useMemo } from 'react';
import { useAuth, useData } from '../context';
import { Card, Button, Input, Modal, Avatar } from '../components/ui';
import { Clock, Inbox, CheckCircle, XCircle, Download, Timer, PenTool, TrendingDown, TrendingUp, Minus, Search } from 'lucide-react';
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

function exportAllUsersCSV(stats) {
  const headers = ['Empleado', 'Departamento', 'En Bolsa (A favor)', 'Pendiente', 'Debo (Deuda)', 'Compensado (Ya)', 'Balance Neto'];
  const lines = [
    headers.join(';'),
    ...stats.map(s => [
      s.employee.name,
      s.employee.dept || 'Sin departamento',
      String(s.bolsa).replace('.', ','),
      String(s.pending).replace('.', ','),
      String(s.debe).replace('.', ','),
      String(s.ya).replace('.', ','),
      String(s.balance).replace('.', ',')
    ].join(';')),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `control-tiempo-usuarios-${new Date().toISOString().slice(0,10)}.csv`;
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
  const { user, employees = [] } = useAuth();
  const { hourCompensations = [], createHourCompensation } = useData();

  const [tab, setTab]   = useState('nueva');
  const [mode, setMode] = useState('ya');
  const [form, setForm] = useState({ date: '', reason: '', hours: '' });
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState('');

  // Filters for "Mi Bolsa"
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo,   setFilterTo]   = useState('');

  // Admin User History States
  const [selectedUser, setSelectedUser] = useState(null);
  const [userSearch, setUserSearch] = useState('');

  // User Stats Calculation for Admin
  const userStats = useMemo(() => {
    if (!employees || employees.length === 0) return [];
    return employees.map(emp => {
      const empAll = hourCompensations.filter(h => String(h.employeeId) === String(emp.id));
      
      const bolsa = empAll
        .filter(h => h.type === 'bolsa' && h.status === 'approved')
        .reduce((sum, h) => sum + h.hours, 0);

      const pending = empAll
        .filter(h => h.type === 'bolsa' && h.status === 'pending')
        .reduce((sum, h) => sum + h.hours, 0);

      const debe = empAll
        .filter(h => h.type === 'debe')
        .reduce((sum, h) => sum + h.hours, 0);

      const ya = empAll
        .filter(h => h.type === 'ya')
        .reduce((sum, h) => sum + h.hours, 0);

      const balance = bolsa + ya - debe;

      return {
        employee: emp,
        bolsa,
        pending,
        debe,
        ya,
        balance,
        totalRequests: empAll.length,
        history: empAll.sort((a, b) => b.date.localeCompare(a.date))
      };
    });
  }, [employees, hourCompensations]);

  const filteredUserStats = useMemo(() => {
    if (!userSearch) return userStats;
    const q = userSearch.toLowerCase();
    return userStats.filter(stat => 
      stat.employee.name.toLowerCase().includes(q) ||
      (stat.employee.dept && stat.employee.dept.toLowerCase().includes(q))
    );
  }, [userStats, userSearch]);

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
          <h1>Control de Tiempo</h1>
          <p>Registra compensaciones, bolsa de horas, horas que debes y consulta el historial</p>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.pageControls}>
        <div className={styles.tabsRow}>
          {tabBtn('nueva', '＋ Nueva solicitud')}
          {tabBtn('bolsa', '🗂 Mi Registro')}
          {user?.role === 'admin' && tabBtn('usuarios', '👥 Historial de Usuarios')}
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
            className={styles.tabContent}
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
                        [styles.modeBtnYa]: key === 'ya',
                        [styles.modeBtnYaActive]: key === 'ya' && mode === 'ya',
                        [styles.modeBtnBolsa]: key === 'bolsa',
                        [styles.modeBtnBolsaActive]: key === 'bolsa' && mode === 'bolsa',
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
                  variant={mode === 'debe' ? 'danger' : mode === 'ya' ? 'success' : 'primary'}
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
            className={styles.tabContent}
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
                  <Button variant="ghost" onClick={() => { setFilterFrom(''); setFilterTo(''); }}>
                    Limpiar
                  </Button>
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
                  <table className="table">
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
                          <td className={styles.dateCell} data-label="Fecha">
                            {new Date(h.date + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td data-label="Tipo">{typeBadge(h.type)}</td>
                          <td className={styles.reasonCell} data-label="Motivo">{h.reason}</td>
                          <td data-label="Horas">
                            <span className={clsx(styles.hoursChip, h.type === 'debe' ? styles.hoursChipDebe : '')}>
                              {h.type === 'debe' ? '-' : '+'}{h.hours}h
                            </span>
                          </td>
                          <td data-label="Estado">{statusBadge(h.status)}</td>
                          <td className={styles.reviewCell} data-label="Revisado">
                            {h.reviewerName
                              ? <><strong>{h.reviewerName}</strong><span>{h.reviewedAt ? new Date(h.reviewedAt).toLocaleDateString('es-ES') : ''}</span></>
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

        {/* ── HISTORIAL DE USUARIOS (ADMIN) ── */}
        {tab === 'usuarios' && user?.role === 'admin' && (
          <motion.div
            key="usuarios"
            className={styles.tabContent}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            {/* Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div className={styles.userSearchWrapper} style={{ margin: 0, flex: 1 }}>
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Buscar empleado o departamento..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                />
              </div>
              {filteredUserStats.length > 0 && (
                <Button icon={Download} variant="ghost" onClick={() => exportAllUsersCSV(filteredUserStats)}>
                  Descargar Excel Completo
                </Button>
              )}
            </div>

            {/* Table of user stats */}
            {filteredUserStats.length === 0 ? (
              <Card className={styles.emptyCard}>
                <Inbox size={44} strokeWidth={1} />
                <p>No se encontraron empleados</p>
              </Card>
            ) : (
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <div className={styles.tableWrapper}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Empleado</th>
                        <th>En Bolsa (A favor)</th>
                        <th>Pendiente</th>
                        <th>Debo (Deuda)</th>
                        <th>Compensado (Ya)</th>
                        <th>Balance Neto</th>
                        <th style={{ textAlign: 'right' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUserStats.map(stat => {
                        const empName = stat.employee.name;
                        const empAvatar = stat.employee.avatar || empName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                        const isNegative = stat.balance < 0;
                        return (
                          <tr key={stat.employee.id}>
                            <td data-label="Empleado">
                              <div className={styles.userCell}>
                                <Avatar initials={empAvatar} size={32} />
                                <div className={styles.userInfo}>
                                  <strong>{empName}</strong>
                                  <span>{stat.employee.dept || 'Sin departamento'}</span>
                                </div>
                              </div>
                            </td>
                            <td data-label="En Bolsa">
                              <span className={clsx(styles.hoursChip, styles.hoursChipBolsa)}>
                                {stat.bolsa.toFixed(1)}h
                              </span>
                            </td>
                            <td data-label="Pendiente">
                              <span style={{ color: 'var(--text-sec)', fontSize: 13 }}>
                                {stat.pending.toFixed(1)}h
                              </span>
                            </td>
                            <td data-label="Debo">
                              <span className={clsx(styles.hoursChip, styles.hoursChipDebe)}>
                                {stat.debe.toFixed(1)}h
                              </span>
                            </td>
                            <td data-label="Compensado">
                              <span className={clsx(styles.hoursChip, styles.hoursChipYa)} style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
                                {stat.ya.toFixed(1)}h
                              </span>
                            </td>
                            <td data-label="Balance Neto">
                              <span className={clsx(styles.hoursChip, isNegative ? styles.hoursChipDebe : '')}>
                                {stat.balance >= 0 ? '+' : ''}{stat.balance.toFixed(1)}h
                              </span>
                            </td>
                            <td data-label="Acciones" style={{ textAlign: 'right' }}>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedUser(stat)}
                              >
                                Ver Historial
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Modal */}
      {selectedUser && (
        <Modal
          open={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          title={`Historial de ${selectedUser.employee.name}`}
          className={styles.historyModal}
        >
          {/* Quick stats in modal */}
          <div className={styles.modalStatsGrid}>
            <div className={clsx(styles.modalStatCard, styles.statApproved)}>
              <strong>{selectedUser.bolsa.toFixed(1)}h</strong>
              <span>En Bolsa</span>
            </div>
            <div className={clsx(styles.modalStatCard, styles.statPending)}>
              <strong>{selectedUser.pending.toFixed(1)}h</strong>
              <span>Pendiente</span>
            </div>
            <div className={clsx(styles.modalStatCard, styles.statRejected)}>
              <strong>{selectedUser.debe.toFixed(1)}h</strong>
              <span>Debo</span>
            </div>
            <div className={clsx(styles.modalStatCard, styles.statApproved)} style={{ borderLeft: '2px solid var(--success)' }}>
              <strong>{selectedUser.ya.toFixed(1)}h</strong>
              <span>Compensado (Ya)</span>
            </div>
            <div className={clsx(styles.modalStatCard, selectedUser.balance >= 0 ? styles.statApproved : styles.statRejected)}>
              <strong>{selectedUser.balance >= 0 ? '+' : ''}{selectedUser.balance.toFixed(1)}h</strong>
              <span>Balance Neto</span>
            </div>
          </div>

          {/* Table history */}
          {selectedUser.history.length === 0 ? (
            <div className={styles.modalEmpty}>
              <Inbox size={36} strokeWidth={1} />
              <p>No hay registros para este usuario</p>
            </div>
          ) : (
            <>
              <div className={styles.modalActionsRow}>
                <Button
                  icon={Download}
                  variant="ghost"
                  onClick={() => exportToCSV(selectedUser.history, `horas-${selectedUser.employee.name.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0,10)}.csv`)}
                >
                  Descargar Excel
                </Button>
              </div>
              <div className={styles.modalTableWrapper}>
                <table className="table" style={{ minWidth: '100%' }}>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Motivo</th>
                      <th>Horas</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedUser.history.map(h => (
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div className={styles.modalFooter}>
            <Button onClick={() => setSelectedUser(null)}>Cerrar</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
