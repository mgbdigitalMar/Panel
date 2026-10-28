import { useMemo, useState } from 'react';
import { Download, Check, X, Trash2, FileText, Calendar, Home, Briefcase, ShoppingCart } from 'lucide-react';
import { Button } from '../components/ui';
import {
  PhoneHeader, RoundButton, Segmented, CountTabs, ChipRail, IconDisc, StatusPill, Row, PhoneCard,
  STATUS_TONE, STATUS_TEXT,
} from '../components/PhoneKit';
import { todayKey } from '../utils/format';
import { PERSONAL_DAYS_PER_YEAR } from '../../shared/config/constants.js';
import styles from './RequestsPhone.module.scss';

// Same icon and tone per type as the app (mobile/src/utils/domain.js, icons.js)
const TYPE_ROW = {
  asuntos_propios: { icon: Calendar,     tone: 'accent', label: 'Asuntos propios' },
  remoto:          { icon: Home,         tone: 'teal',   label: 'Remoto' },
  external:        { icon: Briefcase,    tone: 'purple', label: 'Trabajo externo' },
  purchase:        { icon: ShoppingCart, tone: 'amber',  label: 'Compra' },
};
const DAY_LETTERS = ['L', 'M', 'X', 'J', 'V'];
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/**
 * Solicitudes on phones (glass): the app's RequestsScreen — personal days and this week's
 * telework, status tabs, type chips and one row per request. The forms stay in RequestsPage.
 */
export default function RequestsPhone({ allItems, user, requestDetail, rowKey, onExport, onNewPersonalDay, onApprove, onReject, onDelete }) {
  const isAdmin = user?.role === 'admin';
  const [scope, setScope] = useState('mine');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');

  const mine = useMemo(() => allItems.filter((r) => r.employeeId === user?.id), [allItems, user?.id]);
  const scoped = isAdmin && scope === 'team' ? allItems : mine;
  const filtered = scoped.filter((r) => (status === 'all' || r.status === status) && (type === 'all' || r.type === type));
  const count = (s) => scoped.filter((r) => s === 'all' || r.status === s).length;

  const year = String(new Date().getFullYear());
  const daysUsed = mine.filter((r) => r.type === 'asuntos_propios' && r.status !== 'rejected' && String(r.startDate || '').startsWith(year)).length;
  const daysLeft = Math.max(0, PERSONAL_DAYS_PER_YEAR - daysUsed);

  const week = useMemo(() => {
    const now = new Date();
    const monday = addDays(now, -((now.getDay() + 6) % 7));
    return DAY_LETTERS.map((letter, i) => {
      const iso = todayKey(addDays(monday, i));
      const on = mine.some((r) => (r.type === 'remoto' || r.type === 'external') && r.status === 'approved'
        && iso >= r.startDate && iso <= (r.endDate || r.startDate));
      return { iso, letter, on };
    });
  }, [mine]);
  const remoteDays = week.filter((d) => d.on).length;

  return (
    <div className={styles.page}>
      <PhoneHeader title="Solicitudes">
        {filtered.length > 0 && <RoundButton icon={Download} label="Descargar CSV" onClick={() => onExport(filtered)} />}
      </PhoneHeader>

      <div className={styles.summary}>
        <button type="button" className={styles.sumCard} onClick={onNewPersonalDay} aria-label={`Asuntos propios: ${daysLeft} de ${PERSONAL_DAYS_PER_YEAR} días. Pedir un día`}>
          <span className={styles.sumLabel}>Asuntos propios</span>
          <span className={styles.sumValue}>{daysLeft}<span> / {PERSONAL_DAYS_PER_YEAR} días</span></span>
          <span className={styles.segments} aria-hidden="true">
            {Array.from({ length: PERSONAL_DAYS_PER_YEAR }, (_, i) => <span key={i} data-on={i < daysLeft || undefined} />)}
          </span>
        </button>
        <PhoneCard className={styles.sumCard}>
          <span className={styles.sumLabel}>Teletrabajo semana</span>
          <span className={styles.sumValue}>{remoteDays}<span> {remoteDays === 1 ? 'día' : 'días'}</span></span>
          <span className={styles.letters} aria-label={`Días en remoto esta semana: ${remoteDays}`}>
            {week.map((d) => <span key={d.iso} data-on={d.on || undefined}>{d.letter}</span>)}
          </span>
        </PhoneCard>
      </div>

      {/* Employees only receive their own requests, so "Equipo" is for admins */}
      {isAdmin && (
        <Segmented label="Ámbito" value={scope} onChange={setScope}
          options={[{ value: 'mine', label: 'Mías' }, { value: 'team', label: 'Equipo' }]} />
      )}

      <CountTabs label="Estado" value={status} onChange={setStatus} options={[
        { value: 'all', label: 'Todas', count: count('all') },
        { value: 'pending', label: 'Pendientes', count: count('pending') },
        { value: 'approved', label: 'Aprobadas', count: count('approved') },
        { value: 'rejected', label: 'Rechazadas', count: count('rejected') },
      ]} />

      <ChipRail label="Tipo" value={type} onChange={setType} options={[
        { value: 'all', label: 'Todos los tipos' },
        { value: 'asuntos_propios', label: 'Asuntos propios' },
        { value: 'purchase', label: 'Compras' },
        { value: 'remoto', label: 'Remoto' },
        { value: 'external', label: 'Externo' },
      ]} />

      {filtered.length === 0 ? (
        <PhoneCard className={styles.empty}>
          <IconDisc icon={FileText} tone="neutral" size={46} />
          <strong>No hay solicitudes</strong>
          <span>No se han encontrado solicitudes con estos filtros.</span>
        </PhoneCard>
      ) : (
        <div className={styles.list}>
          {filtered.map((r) => {
            const t = TYPE_ROW[r.type] || TYPE_ROW.purchase;
            const team = isAdmin && scope === 'team';
            return (
              <Row
                key={rowKey(r)}
                left={<IconDisc icon={t.icon} tone={t.tone} />}
                title={t.label}
                subtitle={team ? `${r.employeeName || '—'} · ${requestDetail(r)}` : requestDetail(r)}
                right={<StatusPill tone={STATUS_TONE[r.status]}>{STATUS_TEXT[r.status] || r.status}</StatusPill>}
                className={r.status === 'pending' ? styles.pending : undefined}
              >
                {(team || r.fileUrl) && (
                  <span className={styles.actions}>
                    {r.fileUrl && (
                      <a href={r.fileUrl} download="justificante" className={styles.file}>
                        <Download size={14} aria-hidden="true" /> Justificante
                      </a>
                    )}
                    <span className={styles.spacer} />
                    {team && r.status === 'pending' && (
                      <>
                        <Button variant="action-success" iconOnly icon={Check} onClick={() => onApprove(r)} title="Aprobar" />
                        <Button variant="action-danger" iconOnly icon={X} onClick={() => onReject(r)} title="Rechazar" />
                      </>
                    )}
                    {team && <Button variant="action-danger" iconOnly icon={Trash2} onClick={() => onDelete(r)} title="Eliminar" />}
                  </span>
                )}
              </Row>
            );
          })}
        </div>
      )}
    </div>
  );
}
