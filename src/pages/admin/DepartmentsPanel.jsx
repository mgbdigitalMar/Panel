import { useEffect, useMemo, useState } from 'react';
import { Layers, Plus, Pencil, Trash2, EyeOff, Eye, RotateCcw, AlertTriangle } from 'lucide-react';
import { Button, Input, Modal, ConfirmModal, Spinner } from '../../components/ui';
import {
  DeskPanel, DeskTable, CellStack, TypeTile, StatusPill, RowAction, RowActions, DeskEmpty,
} from '../../components/Desk';
import { FeedGroup, FeedItem, ItemAction, TouchEmpty, TouchButton, LeafIcon } from '../../components/Touch';
import {
  fetchDepartments, createDepartment, updateDepartment, deleteDepartment,
  validateDepartmentName, countByDepartment, NEWS_DEPARTMENT,
} from '../../../shared/services/departments.js';
import { toUserMessage } from '../../../shared/utils/errors.js';
import { supabase } from '../../utils/supabase';
import { plural } from '../../utils/format';
import styles from './AdminHr.module.scss';

/**
 * Departamentos (Administración): RR. HH. creates, renames, hides and deletes them. Renaming moves
 * everyone in it (the database cascades the name); a department with people can only be hidden,
 * so it stops being offered in the employee form. Computer table or touch list (`touch`).
 */
export default function DepartmentsPanel({ touch, employees, onEmployeesChanged, announce }) {
  const [departments, setDepartments] = useState(undefined); // undefined loading · null failed
  const [editing, setEditing] = useState(null); // { id?, name } while the form is open
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = async () => setDepartments(await fetchDepartments(supabase));
  useEffect(() => { load(); }, []);

  const counts = useMemo(() => countByDepartment(employees), [employees]);
  const readOnly = departments?.some((d) => d.fallback);
  const list = departments || [];

  const openNew = () => { setEditing({ name: '' }); setFormError(''); };
  const openEdit = (d) => { setEditing({ id: d.id, name: d.name, original: d.name }); setFormError(''); };
  const close = () => { if (!saving) setEditing(null); };

  const save = async () => {
    if (saving || !editing) return;
    const check = validateDepartmentName(editing.name, list, editing.id || null);
    if (check.error) { setFormError(check.error); return; }
    if (editing.id && check.name === editing.original) { setEditing(null); return; }
    setSaving(true);
    const res = editing.id
      ? await updateDepartment(supabase, editing.id, { name: check.name })
      : await createDepartment(supabase, check.name);
    setSaving(false);
    if (res.error) { setFormError(toUserMessage(res.error)); return; }
    announce?.('✅', editing.id
      ? `Departamento renombrado a «${check.name}»${counts[editing.original] ? `: ${plural(counts[editing.original], 'persona cambiada', 'personas cambiadas')}` : ''}.`
      : `Departamento «${check.name}» creado.`);
    setEditing(null);
    await load();
    if (editing.id && counts[editing.original]) onEmployeesChanged?.();
  };

  const toggleActive = async (d) => {
    const res = await updateDepartment(supabase, d.id, { isActive: !d.isActive });
    if (res.error) { announce?.('❌', toUserMessage(res.error), 7000); return; }
    announce?.(d.isActive ? '🙈' : '👁️', d.isActive
      ? `«${d.name}» ya no se ofrece al dar de alta o editar empleados.`
      : `«${d.name}» vuelve a estar disponible.`);
    load();
  };

  const askDelete = (d) => setConfirm({
    title: 'Eliminar departamento',
    message: `Se eliminará «${d.name}». No tiene personas asignadas. Esta acción no se puede deshacer.`,
    action: async () => {
      const res = await deleteDepartment(supabase, d.id);
      if (res.error) { announce?.('❌', toUserMessage(res.error), 7000); return; }
      announce?.('🗑️', `Departamento «${d.name}» eliminado.`);
      load();
    },
  });

  const statusOf = (d) => (d.isActive
    ? { tone: 'success', text: 'Activo' }
    : { tone: 'neutral', text: 'Oculto' });
  const peopleOf = (d) => counts[d.name] || 0;
  const canRename = (d) => !readOnly && d.name !== NEWS_DEPARTMENT;
  const canDelete = (d) => !readOnly && peopleOf(d) === 0 && d.name !== NEWS_DEPARTMENT && d.name !== 'Sin asignar';

  const intro = readOnly
    ? 'Falta aplicar la migración de departamentos en Supabase: se muestra la lista fija y no se puede editar.'
    : `${plural(list.filter((d) => d.isActive).length, 'departamento activo', 'departamentos activos')} · renombrar uno cambia a todas sus personas`;

  let body;
  if (departments === undefined) {
    body = <div className={styles.loading}><Spinner size={20} label="Cargando departamentos" /> Cargando departamentos…</div>;
  } else if (departments === null) {
    body = touch
      ? <TouchEmpty compact icon={AlertTriangle} title="No se han podido cargar los departamentos" text="Comprueba la conexión e inténtalo de nuevo." action={<TouchButton icon={RotateCcw} onClick={load}>Reintentar</TouchButton>} />
      : <DeskEmpty icon={AlertTriangle} title="No se han podido cargar los departamentos" text="Comprueba la conexión e inténtalo de nuevo." action={<Button variant="secondary" icon={RotateCcw} onClick={load}>Reintentar</Button>} />;
  } else if (list.length === 0) {
    body = touch
      ? <TouchEmpty compact icon={Layers} title="Aún no hay departamentos" text="Crea el primero para asignarlo a las personas." action={<TouchButton primary icon={Plus} onClick={openNew}>Nuevo departamento</TouchButton>} />
      : <DeskEmpty icon={Layers} title="Aún no hay departamentos" text="Crea el primero para asignarlo a las personas." action={<Button icon={Plus} onClick={openNew}>Nuevo departamento</Button>} />;
  } else if (touch) {
    body = (
      <FeedGroup>
        {list.map((d) => (
          <FeedItem key={d.id}
            lead={<LeafIcon icon={Layers} tone={d.isActive ? 'accent' : 'neutral'} />}
            title={d.name}
            meta={plural(peopleOf(d), 'persona', 'personas')}
            status={statusOf(d)}
            details={[
              { label: 'Personas', value: String(peopleOf(d)) },
              { label: 'Estado', value: d.isActive ? 'Se ofrece en las fichas' : 'Oculto en las fichas' },
              d.name === NEWS_DEPARTMENT && { label: 'Permisos', value: 'Sus personas pueden publicar noticias', wide: true },
            ]}
            actions={readOnly ? undefined : (
              <>
                {canRename(d) && <ItemAction icon={Pencil} tone="accent" onClick={() => openEdit(d)}>Renombrar</ItemAction>}
                <ItemAction icon={d.isActive ? EyeOff : Eye} onClick={() => toggleActive(d)}>{d.isActive ? 'Ocultar' : 'Mostrar'}</ItemAction>
                {canDelete(d) && <ItemAction icon={Trash2} tone="danger" onClick={() => askDelete(d)}>Eliminar</ItemAction>}
              </>
            )}
          />
        ))}
      </FeedGroup>
    );
  } else {
    body = (
      <DeskTable label="Departamentos" head={[
        { label: 'Departamento' }, { label: 'Personas' }, { label: 'Estado' }, { label: 'Acciones', end: true },
      ]}>
        {list.map((d) => (
          <tr key={d.id}>
            <td>
              <CellStack lead={<TypeTile icon={Layers} tone={d.isActive ? 'accent' : 'neutral'} />} title={d.name}
                sub={d.name === NEWS_DEPARTMENT ? 'Puede publicar noticias' : undefined} />
            </td>
            <td className={styles.nowrap}>{plural(peopleOf(d), 'persona', 'personas')}</td>
            <td><StatusPill tone={statusOf(d).tone}>{statusOf(d).text}</StatusPill></td>
            <td>
              {!readOnly && (
                <RowActions>
                  {canRename(d) && <RowAction iconOnly icon={Pencil} onClick={() => openEdit(d)} label={`Renombrar ${d.name}`} />}
                  <RowAction iconOnly icon={d.isActive ? EyeOff : Eye} onClick={() => toggleActive(d)} label={d.isActive ? `Ocultar ${d.name}` : `Mostrar ${d.name}`} />
                  {canDelete(d) && <RowAction iconOnly icon={Trash2} onClick={() => askDelete(d)} label={`Eliminar ${d.name}`} />}
                </RowActions>
              )}
            </td>
          </tr>
        ))}
      </DeskTable>
    );
  }

  return (
    <>
      {touch ? (
        <>
          <div className={styles.sectionBar}>
            <p>{intro}</p>
            {!readOnly && departments && <TouchButton primary icon={Plus} onClick={openNew}>Nuevo</TouchButton>}
          </div>
          {body}
        </>
      ) : (
        <DeskPanel flush title="Departamentos" sub={intro}
          tools={!readOnly && departments ? <Button icon={Plus} onClick={openNew}>Nuevo departamento</Button> : undefined}>
          {body}
        </DeskPanel>
      )}

      <Modal open={!!editing} onClose={close} title={editing?.id ? 'Renombrar departamento' : 'Nuevo departamento'}>
        {editing && (
          <form className={styles.form} onSubmit={(e) => { e.preventDefault(); save(); }}>
            <Input label="Nombre" value={editing.name} required autoFocus maxLength={120}
              onChange={(v) => { setEditing({ ...editing, name: v }); setFormError(''); }}
              error={formError || undefined}
              hint={editing.id && counts[editing.original]
                ? `Las ${plural(counts[editing.original], 'persona', 'personas')} de «${editing.original}» pasarán al nuevo nombre.`
                : undefined} />
            <div className={styles.formActions}>
              <Button variant="ghost" onClick={close} disabled={saving}>Cancelar</Button>
              <Button type="submit" loading={saving}>{editing.id ? 'Guardar' : 'Crear departamento'}</Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmModal isOpen={!!confirm} onClose={() => setConfirm(null)} onConfirm={confirm?.action}
        title={confirm?.title} message={confirm?.message} />
    </>
  );
}
