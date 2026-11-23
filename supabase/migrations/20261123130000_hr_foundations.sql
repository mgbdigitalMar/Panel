-- ================================================================
-- BASE DE RR. HH.: DEPARTAMENTOS Y REGISTRO DE AUDITORÍA
-- (después de 20261123120000_private_documents.sql)
-- Ejecutar en Supabase Dashboard -> SQL Editor (o `supabase db push`),
-- primero en staging.
--
-- Los roles no cambian: 'admin' es RR. HH./administración y 'employee' el
-- resto. Todo lo nuevo se gobierna con public.is_admin() / is_employee().
--
--   1. departments: los departamentos dejan de ser una lista fija en el
--      código. profiles.department sigue siendo el nombre (texto) y pasa a
--      referenciar departments(name) con ON UPDATE CASCADE: renombrar un
--      departamento cambia a todas sus personas. Se cargan los de siempre y
--      los que ya tuviera alguna ficha. Un departamento con personas no se
--      puede borrar (se desactiva). «Comunicación - marketing» no se puede
--      renombrar: da permiso para editar noticias (can_edit_news).
--   2. hr_audit_logs: quién cambió qué y cuándo en fichas, DNI,
--      departamentos, documentos, solicitudes, asuntos propios y bolsa de
--      horas. Solo lo leen los admins; nadie lo puede modificar ni borrar
--      desde la API. El DNI se registra como cambiado, nunca su valor, y los
--      archivos incrustados (data:) no se copian.
--   3. purge_hr_audit_logs(días): RR. HH. aplica el plazo de conservación
--      (mínimo un año); la propia purga queda registrada.
--
-- Aditivo y compatible con la web y la app actuales: un departamento vacío
-- ('') se guarda como null, que la interfaz ya muestra como «Sin asignar».
-- ================================================================

begin;

create schema if not exists hr_private;
revoke all on schema hr_private from public, anon, authenticated;

-- 1. Departamentos -------------------------------------------------------------

create table if not exists public.departments (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique
             check (name = btrim(name) and char_length(name) between 1 and 120),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.departments enable row level security;
revoke all on public.departments from anon;
grant select, insert, update, delete on public.departments to authenticated;

drop policy if exists departments_select on public.departments;
drop policy if exists departments_write on public.departments;
create policy departments_select on public.departments for select to authenticated
  using (public.is_employee());
create policy departments_write on public.departments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- La lista que usaban la web y la app (shared/config/constants.js)
insert into public.departments (name) values
  ('Administración - RRHH'), ('Comercial - HEF'), ('Formación'), ('Verificación (CAE)'),
  ('Planificación'), ('Técnico'), ('Comunicación - marketing'), ('Marketing - diseño'), ('Sin asignar')
on conflict (name) do nothing;

-- Un departamento vacío o con espacios se guarda limpio (también desde versiones anteriores)
create or replace function public.normalize_profile_department()
returns trigger
language plpgsql
as $$
begin
  new.department := nullif(btrim(new.department), '');
  return new;
end;
$$;

drop trigger if exists profiles_normalize_department on public.profiles;
create trigger profiles_normalize_department
  before insert or update of department on public.profiles
  for each row execute function public.normalize_profile_department();

update public.profiles
set department = nullif(btrim(department), '')
where department is distinct from nullif(btrim(department), '');

-- Los que ya usa alguna ficha y no estaban en la lista (todos: si faltara uno,
-- la clave foránea no se podría crear y la migración se desharía entera)
insert into public.departments (name)
select distinct department from public.profiles
where department is not null
on conflict (name) do nothing;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_department_fkey') then
    alter table public.profiles
      add constraint profiles_department_fkey foreign key (department)
      references public.departments (name) on update cascade on delete restrict;
  end if;
end $$;

create index if not exists profiles_department_idx on public.profiles (department);

create or replace function public.guard_department_change()
returns trigger
language plpgsql
as $$
begin
  if old.name = 'Comunicación - marketing' and new.name is distinct from old.name then
    -- Sin errcode propio (P0001): la web y la app muestran el mensaje tal cual
    raise exception 'Este departamento da permiso para publicar noticias y no se puede renombrar.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists departments_guard_change on public.departments;
create trigger departments_guard_change
  before update on public.departments
  for each row execute function public.guard_department_change();

-- 2. Registro de auditoría -------------------------------------------------------

create table if not exists public.hr_audit_logs (
  id           bigint generated always as identity primary key,
  occurred_at  timestamptz not null default now(),
  -- Sin claves foráneas: el registro se conserva aunque se borre la persona.
  -- Los nombres se guardan tal y como eran en ese momento.
  actor_id     uuid,
  actor_name   text,
  subject_id   uuid,
  subject_name text,
  action       text not null check (action in ('insert', 'update', 'delete', 'purge')),
  entity_type  text not null,
  entity_id    text,
  changes      jsonb not null default '{}'::jsonb
);

create index if not exists hr_audit_logs_recent_idx  on public.hr_audit_logs (occurred_at desc, id desc);
create index if not exists hr_audit_logs_subject_idx on public.hr_audit_logs (subject_id, occurred_at desc);
create index if not exists hr_audit_logs_entity_idx  on public.hr_audit_logs (entity_type, occurred_at desc);
create index if not exists hr_audit_logs_actor_idx   on public.hr_audit_logs (actor_id, occurred_at desc);

alter table public.hr_audit_logs enable row level security;
revoke all on public.hr_audit_logs from anon, authenticated;
grant select on public.hr_audit_logs to authenticated;

drop policy if exists hr_audit_logs_select on public.hr_audit_logs;
create policy hr_audit_logs_select on public.hr_audit_logs for select to authenticated
  using (public.is_admin());

-- Valor apto para el registro: textos largos (archivos data:, firmas) se resumen
create or replace function hr_private.audit_value(p_value jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_value) = 'string' and char_length(p_value #>> '{}') > 500
      then to_jsonb('[omitido: ' || char_length(p_value #>> '{}') || ' caracteres]')
    else p_value
  end;
$$;

-- Argumentos del trigger: columna de la persona afectada ('' si no hay),
-- columnas que no se registran y columnas cuyo valor no se guarda
create or replace function hr_private.capture_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old       jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new       jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_row       jsonb := coalesce(v_new, v_old);
  v_subject_col text := nullif(tg_argv[0], '');
  v_ignore    text[] := array['updated_at'] || string_to_array(coalesce(nullif(tg_argv[1], ''), ''), ',');
  v_secret    text[] := string_to_array(coalesce(nullif(tg_argv[2], ''), ''), ',');
  v_changes   jsonb := '{}'::jsonb;
  v_actor     uuid := auth.uid();
  v_subject   uuid;
  v_key       text;
begin
  if tg_op = 'UPDATE' then
    for v_key in select jsonb_object_keys(v_new) loop
      continue when v_key = any (v_ignore);
      continue when (v_new -> v_key) is not distinct from (v_old -> v_key);
      v_changes := v_changes || jsonb_build_object(v_key, case when v_key = any (v_secret)
        then jsonb_build_object('changed', true)
        else jsonb_build_object('old', hr_private.audit_value(v_old -> v_key), 'new', hr_private.audit_value(v_new -> v_key))
      end);
    end loop;
    if v_changes = '{}'::jsonb then
      return null; -- solo cambiaron columnas que no se registran
    end if;
  else
    for v_key in select jsonb_object_keys(v_row) loop
      continue when v_key = any (v_ignore) or (v_row -> v_key) = 'null'::jsonb;
      v_changes := v_changes || jsonb_build_object(v_key, case when v_key = any (v_secret)
        then to_jsonb('[protegido]'::text)
        else hr_private.audit_value(v_row -> v_key)
      end);
    end loop;
  end if;

  if v_subject_col is not null then
    begin
      v_subject := (v_row ->> v_subject_col)::uuid;
    exception when others then
      v_subject := null;
    end;
  end if;

  insert into public.hr_audit_logs (actor_id, actor_name, subject_id, subject_name, action, entity_type, entity_id, changes)
  values (
    v_actor,
    case when v_actor is null then 'Sistema' else (select p.name from public.profiles p where p.id = v_actor) end,
    v_subject,
    coalesce(
      (select p.name from public.profiles p where p.id = v_subject),
      case when tg_table_name = 'profiles' then v_row ->> 'name' end
    ),
    lower(tg_op),
    tg_table_name,
    v_row ->> 'id',
    v_changes
  );
  return null;
end;
$$;

revoke all on function hr_private.capture_audit() from public, anon, authenticated;

do $$
declare
  t record;
begin
  for t in
    select * from (values
      -- tabla, persona afectada, no se registra, valor protegido
      ('profiles',           'id',           'work_mode,telework_applied_on', ''),
      ('profile_private',    'id',           '',                              'dni'),
      ('departments',        '',             '',                              ''),
      ('documents',          'recipient_id', '',                              ''),
      ('requests',           'employee_id',  'returned_at',                   ''),
      ('personal_days',      'employee_id',  '',                              ''),
      ('hour_compensations', 'employee_id',  '',                              '')
    ) as x(tbl, subject_col, ignored, secret)
  loop
    if to_regclass('public.' || t.tbl) is null then
      continue;
    end if;
    execute format('drop trigger if exists %I on public.%I', t.tbl || '_hr_audit', t.tbl);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function hr_private.capture_audit(%L, %L, %L)',
      t.tbl || '_hr_audit', t.tbl, t.subject_col, t.ignored, t.secret
    );
  end loop;
end $$;

-- 3. Conservación ------------------------------------------------------------------

create or replace function public.purge_hr_audit_logs(p_older_than_days integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
  v_actor uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede aplicar el plazo de conservación' using errcode = '42501';
  end if;
  if p_older_than_days is null or p_older_than_days < 365 then
    raise exception 'El registro se conserva al menos un año (365 días)';
  end if;

  delete from public.hr_audit_logs
  where occurred_at < now() - make_interval(days => p_older_than_days)
    and action <> 'purge';
  get diagnostics v_deleted = row_count;

  insert into public.hr_audit_logs (actor_id, actor_name, action, entity_type, changes)
  values (
    v_actor,
    (select p.name from public.profiles p where p.id = v_actor),
    'purge', 'hr_audit_logs',
    jsonb_build_object('older_than_days', p_older_than_days, 'deleted', v_deleted)
  );
  return v_deleted;
end;
$$;

revoke all on function public.purge_hr_audit_logs(integer) from public, anon;
grant execute on function public.purge_hr_audit_logs(integer) to authenticated;

commit;

notify pgrst, 'reload schema';
