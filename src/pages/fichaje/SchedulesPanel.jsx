import { useState } from 'react';
import { CalendarClock, Plus, Pencil, Star } from 'lucide-react';
import { Avatar, Button, Input, Modal } from '../../components/ui';
import { DeskPanel, DeskTable, CellStack, RowAction, DeskEmpty, DeskSelect, TypeTile } from '../../components/Desk';
import { FeedGroup, FeedItem, ItemAction, TouchEmpty, TouchButton, LeafIcon } from '../../components/Touch';
import {
  WEEKDAYS, weeklyMinutes, formatMinutes, scheduleError, saveWorkSchedule, assignWorkSchedule,
} from '../../../shared/services/timeTracking.js';
import { toUserMessage } from '../../../shared/utils/errors.js';
import { supabase } from '../../utils/supabase';
import styles from './Fichaje.module.scss';

const blankDays = () => Object.fromEntries(WEEKDAYS.map((w) => [w.day, { on: w.day <= 5, start: '08:00', end: w.day === 5 ? '14:30' : '17:00', break: w.day === 5 ? 0 : 60 }]));
const toForm = (s) => ({
  id: s?.id || null,
  name: s?.name || '',
  tolerance: String(s?.toleranceMinutes ?? 10),
  isDefault: !!s?.isDefault,
  days: s
    ? Object.fromEntries(WEEKDAYS.map((w) => {
      const slot = s.days?.[w.day] || s.days?.[String(w.day)];
      return [w.day, slot ? { on: true, start: slot.start, end: slot.end, break: slot.break ?? 0 } : { on: false, start: '08:00', end: '17:00', break: 60 }];
    }))
    : blankDays(),
});

/**
 * Horarios (RR. HH.): the working hours of each weekday, the break and the tolerance a day can
 * differ by without counting as overtime or a shortfall; which one is the default and who has
 * another. Time worked is always compared with the person's schedule.
 */
export default function SchedulesPanel({ touch, schedules, employees, onChanged, onEmployeesChanged, announce }) {
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(null);
  const editable = schedules.some((s) => s.id);
  const defaultId = schedules.find((s) => s.isDefault)?.id || null;
  const usage = (id) => employees.filter((e) => (e.workScheduleId || defaultId) === id).length;

  const setDay = (day, patch) => setForm((f) => ({ ...f, days: { ...f.days, [day]: { ...f.days[day], ...patch } } }));

  const save = async () => {
    if (saving) return;
    const name = form.name.trim();
    if (!name) { setError('Pon un nombre al horario.'); return; }
    if (schedules.some((s) => s.id !== form.id && s.name.localeCompare(name, 'es', { sensitivity: 'base' }) === 0)) { setError('Ya hay un horario con ese nombre.'); return; }
    const days = Object.fromEntries(Object.entries(form.days).filter(([, d]) => d.on).map(([k, d]) => [k, { start: d.start, end: d.end, break: Number(d.break) || 0 }]));
    if (!Object.keys(days).length) { setError('Marca al menos un día de trabajo.'); return; }
    const problem = scheduleError(days);
    if (problem) { setError(problem); return; }
    const tolerance = Number(form.tolerance);
    if (!Number.isInteger(tolerance) || tolerance < 0 || tolerance > 120) { setError('La tolerancia debe estar entre 0 y 120 minutos.'); return; }
    setSaving(true);
    const res = await saveWorkSchedule(supabase, { id: form.id, name, days, toleranceMinutes: tolerance, isDefault: form.isDefault });
    setSaving(false);
    if (res.error) { setError(toUserMessage(res.error)); return; }
    announce?.('✅', form.id ? 'Horario guardado.' : 'Horario creado.');
    setForm(null);
    onChanged?.();
  };

  const assign = async (emp, scheduleId) => {
    setAssigning(emp.id);
    const res = await assignWorkSchedule(supabase, emp.id, scheduleId === defaultId ? null : scheduleId);
    setAssigning(null);
    if (res.error) { announce?.('❌', toUserMessage(res.error), 7000); return; }
    announce?.('✅', `Horario de ${emp.name} actualizado.`);
    onEmployeesChanged?.();
  };

  const daysText = (s) => WEEKDAYS.filter((w) => s.days?.[w.day] || s.days?.[String(w.day)]).map((w) => w.short).join(' ');
  const options = schedules.filter((s) => s.id).map((s) => ({ value: s.id, label: s.isDefault ? `${s.name} (predeterminado)` : s.name }));
  const people = [...employees].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'));

  const list = !editable ? (
    touch
      ? <TouchEmpty compact icon={CalendarClock} title="Horarios no disponibles" text="Falta aplicar la migración del fichaje en Supabase. Mientras, se usa el horario de siempre." />
      : <DeskEmpty icon={CalendarClock} title="Horarios no disponibles" text="Falta aplicar la migración del fichaje en Supabase. Mientras, se usa el horario de siempre." />
  ) : touch ? (
    <FeedGroup title="Horarios">
      {schedules.map((s) => (
        <FeedItem key={s.id}
          lead={<LeafIcon icon={CalendarClock} tone={s.isDefault ? 'accent' : 'neutral'} />}
          title={s.name}
          meta={`${formatMinutes(weeklyMinutes(s))} a la semana · ${daysText(s)}`}
          status={s.isDefault ? { tone: 'accent', text: 'Predeterminado' } : undefined}
          details={[
            ...WEEKDAYS.map((w) => {
              const slot = s.days?.[w.day] || s.days?.[String(w.day)];
              return { label: w.label, value: slot ? `${slot.start}–${slot.end}${slot.break ? ` · pausa ${slot.break} min` : ''}` : 'Libre' };
            }),
            { label: 'Tolerancia', value: `${s.toleranceMinutes} min` },
            { label: 'Personas', value: String(usage(s.id)) },
          ]}
          actions={<ItemAction icon={Pencil} tone="accent" onClick={() => { setForm(toForm(s)); setError(''); }}>Editar</ItemAction>}
        />
      ))}
    </FeedGroup>
  ) : (
    <DeskTable label="Horarios" head={[{ label: 'Horario' }, { label: 'Días' }, { label: 'Horas semanales' }, { label: 'Tolerancia' }, { label: 'Personas' }, { label: 'Acciones', end: true }]}>
      {schedules.map((s) => (
        <tr key={s.id}>
          <td><CellStack lead={<TypeTile icon={CalendarClock} tone={s.isDefault ? 'accent' : 'neutral'} />} title={s.name} sub={s.isDefault ? 'Predeterminado' : undefined} /></td>
          <td>{daysText(s)}</td>
          <td className={styles.num}>{formatMinutes(weeklyMinutes(s))}</td>
          <td className={styles.num}>{s.toleranceMinutes} min</td>
          <td className={styles.num}>{usage(s.id)}</td>
          <td><RowAction icon={Pencil} onClick={() => { setForm(toForm(s)); setError(''); }}>Editar</RowAction></td>
        </tr>
      ))}
    </DeskTable>
  );

  const assignment = editable && (touch ? (
    <FeedGroup title="Horario de cada persona">
      {people.map((emp) => (
        <FeedItem key={emp.id}
          lead={<Avatar initials={emp.avatar} src={emp.avatarUrl} size={40} />}
          title={emp.name}
          meta={schedules.find((s) => s.id === (emp.workScheduleId || defaultId))?.name || '—'}
          actions={options.map((o) => (
            <ItemAction key={o.value} pressed={(emp.workScheduleId || defaultId) === o.value} disabled={assigning === emp.id}
              onClick={() => assign(emp, o.value)}>{o.label}</ItemAction>
          ))}
        />
      ))}
    </FeedGroup>
  ) : (
    <DeskPanel flush title="Horario de cada persona" sub="Sin horario propio se aplica el predeterminado">
      <DeskTable label="Horario de cada persona" head={[{ label: 'Persona' }, { label: 'Horario' }]}>
        {people.map((emp) => (
          <tr key={emp.id}>
            <td><CellStack lead={<Avatar initials={emp.avatar} src={emp.avatarUrl} size={30} />} title={emp.name} sub={emp.dept} /></td>
            <td><DeskSelect label={`Horario de ${emp.name}`} value={emp.workScheduleId || defaultId} onChange={(v) => assign(emp, v)} options={options} /></td>
          </tr>
        ))}
      </DeskTable>
    </DeskPanel>
  ));

  const newButton = editable && (touch
    ? <TouchButton primary icon={Plus} onClick={() => { setForm(toForm(null)); setError(''); }}>Nuevo horario</TouchButton>
    : <Button icon={Plus} onClick={() => { setForm(toForm(null)); setError(''); }}>Nuevo horario</Button>);

  return (
    <>
      {touch ? (
        <section className={styles.page} aria-label="Horarios">
          <div className={styles.sectionBar}><p>Las horas trabajadas se comparan con el horario de cada persona.</p>{newButton}</div>
          {list}
          {assignment}
        </section>
      ) : (
        <>
          <DeskPanel flush title="Horarios" sub="Las horas trabajadas se comparan con el horario de cada persona" tools={newButton}>{list}</DeskPanel>
          {assignment}
        </>
      )}

      <Modal open={!!form} onClose={saving ? undefined : () => setForm(null)} title={form?.id ? 'Editar horario' : 'Nuevo horario'}>
        {form && (
          <form className={styles.form} onSubmit={(e) => { e.preventDefault(); save(); }}>
            <Input label="Nombre" value={form.name} maxLength={80} required onChange={(v) => { setForm({ ...form, name: v }); setError(''); }} />
            <div className={styles.scheduleDays} role="group" aria-label="Días de trabajo">
              {WEEKDAYS.map((w) => {
                const d = form.days[w.day];
                return (
                  <div key={w.day} className={styles.scheduleDay}>
                    <label><input type="checkbox" checked={d.on} onChange={(e) => setDay(w.day, { on: e.target.checked })} />{w.label}</label>
                    <label className={styles.fieldLabel}>Entrada<input type="time" value={d.start} disabled={!d.on} onChange={(e) => setDay(w.day, { start: e.target.value })} /></label>
                    <label className={styles.fieldLabel}>Salida<input type="time" value={d.end} disabled={!d.on} onChange={(e) => setDay(w.day, { end: e.target.value })} /></label>
                    <label className={styles.fieldLabel}>Pausa (min)<input type="number" min={0} max={600} step={5} value={d.break} disabled={!d.on} onChange={(e) => setDay(w.day, { break: e.target.value })} /></label>
                  </div>
                );
              })}
            </div>
            <Input label="Tolerancia (minutos)" type="number" value={form.tolerance} onChange={(v) => setForm({ ...form, tolerance: v })}
              hint="Diferencia diaria que no cuenta como horas extra ni como falta." />
            <label className={styles.check}>
              <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
              <Star size={16} aria-hidden="true" /> Horario predeterminado (para quien no tenga otro)
            </label>
            {error && <p className={styles.formError} role="alert">{error}</p>}
            <div className={styles.formActions}>
              <Button variant="ghost" onClick={() => setForm(null)} disabled={saving}>Cancelar</Button>
              <Button type="submit" loading={saving}>{form.id ? 'Guardar' : 'Crear horario'}</Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
