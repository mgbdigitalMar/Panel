import { Download, Plus, ChevronLeft, UsersRound, Inbox, CheckCircle, TrendingDown, Timer } from 'lucide-react';
import { PhoneHeader, RoundButton, PillButton, IconDisc, Row, PhoneCard, PhoneSectionTitle } from '../components/PhoneKit';
import styles from './HorasPhone.module.scss';

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const TYPE = {
  ya:    { label: 'Inmediata', icon: CheckCircle,  tone: 'success' },
  bolsa: { label: 'Bolsa',     icon: Inbox,        tone: 'accent' },
  debe:  { label: 'Debo',      icon: TrendingDown, tone: 'danger' },
};
const STATUS = { approved: 'Aprobada', rejected: 'Rechazada', pending: 'En revisión' };

/** 1.5 → "1:30"; with `sign`, "+1:30" / "−1:30" */
export function fmtHM(hours, sign) {
  const n = Number(hours) || 0;
  const total = Math.round(Math.abs(n) * 60);
  const text = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  if (!sign || total === 0) return text;
  return `${n < 0 ? '−' : '+'}${text}`;
}

function dayLabel(iso) {
  const d = new Date(`${iso}T00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')}`;
}

/** Phone header of the Horas screens: the summary, the form or the team view. */
export function HorasPhoneHeader({ tab, setTab, isAdmin, rows, onExport }) {
  if (tab === 'nueva' || tab === 'usuarios') {
    return (
      <PhoneHeader title={tab === 'nueva' ? 'Registrar horas' : 'Equipo'}>
        <PillButton icon={ChevronLeft} onClick={() => setTab('bolsa')}>Horas</PillButton>
      </PhoneHeader>
    );
  }
  return (
    <PhoneHeader title="Horas">
      {rows.length > 0 && <RoundButton icon={Download} label="Descargar CSV" onClick={onExport} />}
      {isAdmin && <RoundButton icon={UsersRound} label="Saldo del equipo" onClick={() => setTab('usuarios')} />}
      <PillButton primary icon={Plus} onClick={() => setTab('nueva')}>Registrar</PillButton>
    </PhoneHeader>
  );
}

/**
 * Horas on phones (glass): the app's HorasScreen — the approved balance on the navy panel with
 * what was earned, owed and is still in review, then every record.
 */
export function HorasPhoneSummary({ balance, creditHours, debtHours, pendingHours, rows, onRegister }) {
  const total = creditHours + debtHours + pendingHours;
  const share = (h) => (total > 0 ? h / total : 0);
  return (
    <div className={styles.page}>
      <section className={styles.balance} aria-label={`Saldo aprobado ${fmtHM(balance, true)} horas`}>
        <p className={styles.eyebrow}>Saldo aprobado</p>
        <div className={styles.value}>
          <strong className={balance < 0 ? styles.neg : undefined}>{fmtHM(balance, true)}</strong>
          <span>horas</span>
        </div>
        <div className={styles.bar} aria-hidden="true">
          {total > 0 ? (
            <>
              <span style={{ flex: share(creditHours) }} data-tone="success" />
              <span style={{ flex: share(debtHours) }} data-tone="danger" />
              <span style={{ flex: share(pendingHours) }} data-tone="amber" />
            </>
          ) : null}
        </div>
        <dl className={styles.legend}>
          <div><dt><i data-tone="success" />Ganadas</dt><dd>{fmtHM(creditHours, true)}</dd></div>
          <div><dt><i data-tone="danger" />Debo</dt><dd>{debtHours ? `−${fmtHM(debtHours)}` : '0:00'}</dd></div>
          <div><dt><i data-tone="amber" />En revisión</dt><dd>{fmtHM(pendingHours)}</dd></div>
        </dl>
      </section>

      <PhoneSectionTitle>Registros</PhoneSectionTitle>
      {rows.length === 0 ? (
        <PhoneCard className={styles.empty}>
          <IconDisc icon={Timer} tone="neutral" size={46} />
          <strong>Sin registros</strong>
          <span>Registra las horas que compensas, acumulas o debes.</span>
          <PillButton primary icon={Plus} onClick={onRegister}>Registrar horas</PillButton>
        </PhoneCard>
      ) : (
        <div className={styles.list}>
          {rows.map((h) => {
            const t = TYPE[h.type] || TYPE.bolsa;
            const owed = h.type === 'debe';
            return (
              <Row
                key={h.id}
                left={<IconDisc icon={t.icon} tone={t.tone} />}
                title={t.label}
                subtitle={`${dayLabel(h.date)} · ${STATUS[h.status] || 'En revisión'}${h.reason ? ` · ${h.reason}` : ''}`}
                right={<span className={owed ? styles.amountNeg : styles.amountPos}>{owed ? '−' : '+'}{fmtHM(h.hours)}</span>}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
