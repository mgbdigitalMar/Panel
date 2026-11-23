import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { Modal, Input, Select, Textarea, Button, Spinner } from '../../components/ui';
import {
  CORRECTION_KINDS, CLOCK_KINDS, fetchTimeEntries, madridDayKey, madridInstant, madridTime, requestTimeCorrection,
} from '../../../shared/services/timeTracking.js';
import { toUserMessage } from '../../../shared/utils/errors.js';
import { supabase } from '../../utils/supabase';
import styles from './Fichaje.module.scss';

const EMPTY = { kind: 'out', time: '', target: '', reason: '' };

/**
 * Asks for a correction of a day's clock events: one that was forgotten (add it with its time),
 * one at the wrong time (add the right one and pick the one it replaces) or one that should not be
 * there. RR. HH. can correct anyone's, applied at once; everyone else's waits for RR. HH.
 * Nothing is deleted: the original stays in the record, marked as corrected.
 */
export default function CorrectionModal({ open, onClose, dayKey, employeeId, employees, isAdmin, onDone }) {
  const today = madridDayKey();
  const [day, setDay] = useState(dayKey || today);
  const [person, setPerson] = useState(employeeId || '');
  const [form, setForm] = useState(EMPTY);
  const [dayEntries, setDayEntries] = useState(undefined); // undefined loading · null failed
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDay(dayKey || today);
    setPerson(employeeId || '');
    setForm(EMPTY);
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dayKey, employeeId]);

  const who = person || employeeId;
  useEffect(() => {
    if (!open || !day || (!who && isAdmin && employees)) { setDayEntries([]); return undefined; }
    let live = true;
    setDayEntries(undefined);
    fetchTimeEntries(supabase, { employeeId: who || undefined, from: day, to: day }).then((res) => {
      if (live) setDayEntries(res.error ? null : res.rows.filter((e) => !e.voided));
    });
    return () => { live = false; };
  }, [open, day, who, isAdmin, employees]);

  const set = (key) => (value) => { setForm((f) => ({ ...f, [key]: value })); setError(''); };
  const isVoid = form.kind === 'void';

  const submit = async () => {
    if (saving) return;
    if (isAdmin && employees && !who) return setError('Elige a la persona.');
    if (!day || day > today) return setError('Elige un día que ya haya pasado o el de hoy.');
    if (isVoid && !form.target) return setError('Marca el fichaje que sobra.');
    if (!isVoid && !/^\d{2}:\d{2}$/.test(form.time)) return setError('Indica la hora correcta.');
    if (form.reason.trim().length < 5) return setError('Explica el motivo (al menos 5 caracteres).');
    const at = isVoid ? null : madridInstant(day, form.time);
    if (at && new Date(at) > new Date()) return setError('La hora corregida no puede ser futura.');
    setSaving(true);
    const res = await requestTimeCorrection(supabase, {
      kind: form.kind, at, reason: form.reason.trim(), targetEntryId: form.target || null,
      employeeId: isAdmin && who ? who : undefined,
    });
    setSaving(false);
    if (res.error) { setError(toUserMessage(res.error)); return; }
    onDone?.(isAdmin ? 'Corrección aplicada.' : 'Corrección enviada a RR. HH.');
    onClose();
  };

  const entryLabel = (e) => `${madridTime(e.at)} · ${CLOCK_KINDS[e.kind]?.label || e.kind}${e.source === 'correction' ? ' (corregido)' : ''}`;

  return (
    <Modal open={open} onClose={saving ? undefined : onClose} title={isAdmin ? 'Corregir fichaje' : 'Solicitar corrección'}>
      <form className={styles.form} onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <p className={styles.hint}>
          {isAdmin
            ? 'La corrección se aplica al momento y queda registrada a tu nombre. El fichaje original se conserva, marcado como corregido.'
            : 'RR. HH. revisará la corrección. El fichaje original no se borra: queda marcado como corregido si se aprueba.'}
        </p>

        {isAdmin && employees && !employeeId && (
          <Select label="Persona" value={person} onChange={(v) => { setPerson(v); setError(''); }} required
            options={[...employees].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es')).map((e) => ({ value: e.id, label: e.name }))} />
        )}

        <div className={styles.formRow}>
          <Input label="Día" type="date" value={day} max={today} required onChange={(v) => { setDay(v); setForm((f) => ({ ...f, target: '' })); setError(''); }} />
          <Select label="Qué hay que corregir" value={form.kind} onChange={(v) => setForm((f) => ({ ...f, kind: v, target: '' }))}
            options={Object.entries(CORRECTION_KINDS).map(([value, label]) => ({ value, label }))} />
        </div>

        {!isVoid && <Input label="Hora correcta" type="time" value={form.time} onChange={set('time')} required />}

        {dayEntries === undefined ? (
          <p className={styles.hint}><Spinner size={14} /> Cargando los fichajes de ese día…</p>
        ) : dayEntries === null ? (
          <p className={styles.formError}>No se han podido cargar los fichajes de ese día.</p>
        ) : dayEntries.length > 0 ? (
          <fieldset className={styles.dayEntries}>
            <legend>{isVoid ? 'Fichaje que sobra' : '¿Sustituye a alguno? (si la hora estaba mal)'}</legend>
            {!isVoid && (
              <label>
                <input type="radio" name="target" checked={!form.target} onChange={() => set('target')('')} />
                No, faltaba este fichaje
              </label>
            )}
            {dayEntries.map((e) => (
              <label key={e.id}>
                <input type="radio" name="target" checked={form.target === e.id} onChange={() => set('target')(e.id)} />
                {entryLabel(e)}
              </label>
            ))}
          </fieldset>
        ) : (
          <p className={styles.hint}>{isVoid ? 'Ese día no hay fichajes que quitar.' : 'Ese día no hay ningún fichaje.'}</p>
        )}

        <Textarea label="Motivo" value={form.reason} onChange={set('reason')} required rows={3} maxLength={500}
          placeholder="Por ejemplo: olvidé fichar la salida al terminar la reunión con el cliente" />

        {error && <p className={styles.formError} role="alert">{error}</p>}

        <div className={styles.formActions}>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button type="submit" icon={Send} loading={saving}>{isAdmin ? 'Aplicar corrección' : 'Enviar a RR. HH.'}</Button>
        </div>
      </form>
    </Modal>
  );
}
