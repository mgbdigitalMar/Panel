-- ================================================================
-- REGISTRO DE JORNADA (FICHAJE)
-- (después de 20261123130000_hr_foundations.sql)
-- Ejecutar en Supabase Dashboard -> SQL Editor (o `supabase db push`),
-- primero en staging.
--
-- Registro diario de jornada (art. 34.9 del Estatuto de los Trabajadores):
-- hora de entrada y de salida de cada persona, conservado cuatro años y a
-- disposición de la persona, de RR. HH. y de la Inspección.
--
--   1. work_schedules: horarios (horas de cada día de la semana, pausa y
--      tolerancia). Se crea «Jornada general» con el horario que ya usaba la
--      intranet (L-J 08:00-17:00 con 1 h de pausa, V 08:00-14:30): RR. HH.
--      debe revisarlo. profiles.work_schedule_id asigna otro a una persona.
--   2. time_entries: cada fichaje (entrada, inicio y fin de descanso,
--      salida). La hora la pone el servidor (now()), nunca el dispositivo.
--      Nadie puede insertar, cambiar ni borrar filas desde la API: solo con
--      clock_event(), que comprueba el orden (no se puede fichar dos
--      entradas seguidas, ni una salida sin entrada).
--   3. time_corrections: un fichaje olvidado o erróneo se corrige con una
--      solicitud con motivo. Al aprobarla se añade un fichaje nuevo
--      (source = 'correction') y el erróneo queda anulado (voided_at), no
--      borrado: el registro original se conserva. RR. HH. puede corregir
--      directamente (queda aprobada a su nombre).
--   4. Avisos: RR. HH. recibe las solicitudes; la persona, la decisión.
--   5. Una ficha con fichajes no se puede eliminar (hay que conservarlos).
--   6. Historial de RR. HH.: horarios y correcciones.
-- ================================================================

begin;

-- 1. Horarios -----------------------------------------------------------------

-- {"1": {"start": "08:00", "end": "17:00", "break": 60}, ...}: día ISO (1 = lunes)
-- → hora de inicio y fin y minutos de pausa. Un día que no está es libre.
create or replace function public.valid_work_schedule_days(p_days jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  k text;
  v jsonb;
  s integer;
  e integer;
  b integer;
begin
  if jsonb_typeof(p_days) is distinct from 'object' then return false; end if;
  for k, v in select * from jsonb_each(p_days) loop
    if k !~ '^[1-7]$' or jsonb_typeof(v) is distinct from 'object' then return false; end if;
    if coalesce(v ->> 'start', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       or coalesce(v ->> 'end', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      return false;
    end if;
    s := split_part(v ->> 'start', ':', 1)::integer * 60 + split_part(v ->> 'start', ':', 2)::integer;
    e := split_part(v ->> 'end', ':', 1)::integer * 60 + split_part(v ->> 'end', ':', 2)::integer;
    b := coalesce((v ->> 'break')::integer, 0);
    if e <= s or b < 0 or b >= e - s then return false; end if;
  end loop;
  return true;
exception when others then
  return false;
end;
$$;

create table if not exists public.work_schedules (
  id                uuid primary key default gen_random_uuid(),
  name              text not null unique check (name = btrim(name) and char_length(name) between 1 and 80),
  days              jsonb not null check (public.valid_work_schedule_days(days)),
  tolerance_minutes integer not null default 10 check (tolerance_minutes between 0 and 120),
  is_default        boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists work_schedules_one_default on public.work_schedules ((true)) where is_default;

alter table public.work_schedules enable row level security;
revoke all on public.work_schedules from anon;
grant select, insert, update, delete on public.work_schedules to authenticated;

drop policy if exists work_schedules_select on public.work_schedules;
drop policy if exists work_schedules_write on public.work_schedules;
create policy work_schedules_select on public.work_schedules for select to authenticated
  using (public.is_employee());
create policy work_schedules_write on public.work_schedules for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

insert into public.work_schedules (name, days, tolerance_minutes, is_default)
select 'Jornada general', '{
  "1": {"start": "08:00", "end": "17:00", "break": 60},
  "2": {"start": "08:00", "end": "17:00", "break": 60},
  "3": {"start": "08:00", "end": "17:00", "break": 60},
  "4": {"start": "08:00", "end": "17:00", "break": 60},
  "5": {"start": "08:00", "end": "14:30", "break": 0}
}'::jsonb, 10, true
where not exists (select 1 from public.work_schedules);

alter table public.profiles
  add column if not exists work_schedule_id uuid references public.work_schedules (id) on delete set null;

create or replace function public.touch_work_schedule()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists work_schedules_touch on public.work_schedules;
create trigger work_schedules_touch
  before update on public.work_schedules
  for each row execute function public.touch_work_schedule();

-- 2. Fichajes y correcciones ------------------------------------------------------

create table if not exists public.time_entries (
  id                   uuid primary key default gen_random_uuid(),
  employee_id          uuid not null references public.profiles (id) on delete restrict,
  kind                 text not null check (kind in ('in', 'break_start', 'break_end', 'out')),
  occurred_at          timestamptz not null default now(),
  source               text not null default 'web' check (source in ('web', 'app', 'correction')),
  note                 text check (char_length(note) <= 300),
  correction_id        uuid,
  voided_at            timestamptz,
  voided_by_correction uuid,
  created_at           timestamptz not null default now()
);

create index if not exists time_entries_employee_idx on public.time_entries (employee_id, occurred_at desc);
create index if not exists time_entries_recent_idx on public.time_entries (occurred_at desc);

create table if not exists public.time_corrections (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references public.profiles (id) on delete restrict,
  target_entry_id uuid references public.time_entries (id) on delete restrict,
  -- 'void': el fichaje indicado sobra (p. ej. una entrada repetida)
  kind            text not null check (kind in ('in', 'break_start', 'break_end', 'out', 'void')),
  proposed_at     timestamptz,
  reason          text not null check (char_length(reason) between 5 and 500),
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  requested_by    uuid not null,
  reviewed_by     uuid,
  reviewed_at     timestamptz,
  review_note     text check (char_length(review_note) <= 500),
  created_at      timestamptz not null default now(),
  check ((kind = 'void') = (proposed_at is null)),
  check (kind <> 'void' or target_entry_id is not null)
);

create index if not exists time_corrections_employee_idx on public.time_corrections (employee_id, created_at desc);
create index if not exists time_corrections_pending_idx on public.time_corrections (created_at) where status = 'pending';
-- Una sola corrección pendiente por fichaje
create unique index if not exists time_corrections_one_pending
  on public.time_corrections (target_entry_id) where status = 'pending' and target_entry_id is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'time_entries_correction_fkey') then
    alter table public.time_entries
      add constraint time_entries_correction_fkey foreign key (correction_id) references public.time_corrections (id) on delete restrict,
      add constraint time_entries_voided_by_fkey foreign key (voided_by_correction) references public.time_corrections (id) on delete restrict;
  end if;
end $$;

-- Solo lectura desde la API: lo propio, o todo para RR. HH.
alter table public.time_entries enable row level security;
alter table public.time_corrections enable row level security;
revoke all on public.time_entries, public.time_corrections from anon, authenticated;
grant select on public.time_entries, public.time_corrections to authenticated;

drop policy if exists time_entries_select on public.time_entries;
drop policy if exists time_corrections_select on public.time_corrections;
create policy time_entries_select on public.time_entries for select to authenticated
  using (employee_id = auth.uid() or public.is_admin());
create policy time_corrections_select on public.time_corrections for select to authenticated
  using (employee_id = auth.uid() or public.is_admin());

-- 3. Avisos ------------------------------------------------------------------------

-- Si entity_type es un tipo enumerado, se añade el valor nuevo (se usa en otra transacción)
do $$
declare
  v_type regtype;
begin
  select a.atttypid::regtype into v_type
  from pg_attribute a
  where a.attrelid = 'public.notifications'::regclass and a.attname = 'entity_type' and not a.attisdropped;
  if v_type is not null and exists (select 1 from pg_type t where t.oid = v_type and t.typtype = 'e') then
    execute format('alter type %s add value if not exists %L', v_type, 'time_correction');
  end if;
end $$;

-- Mismo mapa que notificationWebPath en shared/config/constants.js
create or replace function notif_private.web_path(p_entity_type text, p_is_admin boolean)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_entity_type
    when 'request' then '/requests'
    when 'personal_day' then '/requests'
    when 'document' then '/profile'
    when 'hour_compensation' then case when p_is_admin then '/admin' else '/horas' end
    when 'time_correction' then '/fichaje'
    when 'reservation' then '/reservations'
    when 'news' then '/news'
    when 'system' then '/settings'
    else '/dashboard'
  end;
$$;

-- 4. Operaciones -------------------------------------------------------------------

create or replace function public.clock_event(p_kind text, p_source text default 'web', p_note text default null)
returns public.time_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_last  public.time_entries;
  v_row   public.time_entries;
  v_today date := (now() at time zone 'Europe/Madrid')::date;
  v_state text;
  v_note  text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_uid is null or not public.is_employee() then
    raise exception 'Inicia sesión para fichar' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('in', 'break_start', 'break_end', 'out') then
    raise exception 'Tipo de fichaje no válido';
  end if;
  if char_length(coalesce(v_note, '')) > 300 then
    raise exception 'La observación puede tener como máximo 300 caracteres';
  end if;

  -- Dos pulsaciones a la vez (web y app) se comprueban de una en una
  perform pg_advisory_xact_lock(hashtextextended('clock:' || v_uid::text, 0));

  select * into v_last
  from public.time_entries
  where employee_id = v_uid and voided_at is null
  order by occurred_at desc, created_at desc
  limit 1;

  -- Una jornada que quedó abierta otro día queda incompleta (se corrige con una
  -- solicitud): hoy se empieza de cero
  v_state := case
    when v_last.id is null or v_last.kind = 'out' then 'off'
    when (v_last.occurred_at at time zone 'Europe/Madrid')::date < v_today then 'off'
    when v_last.kind = 'break_start' then 'break'
    else 'working'
  end;

  if not ((v_state = 'off' and p_kind = 'in')
       or (v_state = 'working' and p_kind in ('break_start', 'out'))
       or (v_state = 'break' and p_kind in ('break_end', 'out'))) then
    raise exception '%', case
      when v_state = 'off' then 'Aún no has fichado la entrada.'
      when v_state = 'working' and p_kind = 'in' then 'Ya has fichado la entrada.'
      when v_state = 'working' then 'No estás en un descanso.'
      when p_kind = 'break_start' then 'Ya estás en un descanso.'
      else 'Estás en un descanso: termínalo o ficha la salida.'
    end;
  end if;

  insert into public.time_entries (employee_id, kind, source, note)
  values (v_uid, p_kind, case when p_source = 'app' then 'app' else 'web' end, v_note)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function hr_private.apply_time_correction(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.time_corrections;
begin
  select * into c from public.time_corrections where id = p_id;
  if c.kind <> 'void' then
    insert into public.time_entries (employee_id, kind, occurred_at, source, note, correction_id)
    values (c.employee_id, c.kind, c.proposed_at, 'correction', left(c.reason, 300), c.id);
  end if;
  if c.target_entry_id is not null then
    update public.time_entries
    set voided_at = now(), voided_by_correction = c.id
    where id = c.target_entry_id and voided_at is null;
  end if;
end;
$$;

revoke all on function hr_private.apply_time_correction(uuid) from public, anon, authenticated;

create or replace function public.request_time_correction(
  p_kind text,
  p_at timestamptz,
  p_reason text,
  p_target_entry uuid default null,
  p_employee_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_admin  boolean := public.is_admin();
  v_emp    uuid := coalesce(p_employee_id, auth.uid());
  v_reason text := btrim(coalesce(p_reason, ''));
  v_target public.time_entries;
  v_id     uuid;
  v_day    text;
begin
  if v_uid is null or not public.is_employee() then
    raise exception 'Inicia sesión para continuar' using errcode = '42501';
  end if;
  if v_emp <> v_uid and not v_admin then
    raise exception 'Solo RR. HH. puede corregir los fichajes de otra persona' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = v_emp) then
    raise exception 'Empleado no encontrado';
  end if;
  if p_kind is null or p_kind not in ('in', 'break_start', 'break_end', 'out', 'void') then
    raise exception 'Tipo de corrección no válido';
  end if;
  if char_length(v_reason) < 5 then
    raise exception 'Explica el motivo de la corrección (al menos 5 caracteres).';
  end if;
  if char_length(v_reason) > 500 then
    raise exception 'El motivo puede tener como máximo 500 caracteres.';
  end if;

  if p_target_entry is not null then
    select * into v_target from public.time_entries
    where id = p_target_entry and employee_id = v_emp and voided_at is null;
    if v_target.id is null then
      raise exception 'Ese fichaje no existe o ya se ha corregido.';
    end if;
    if exists (select 1 from public.time_corrections where target_entry_id = p_target_entry and status = 'pending') then
      raise exception 'Ya hay una corrección pendiente para ese fichaje.';
    end if;
  elsif p_kind = 'void' then
    raise exception 'Indica qué fichaje sobra.';
  end if;

  if p_kind <> 'void' then
    if p_at is null then
      raise exception 'Indica la fecha y la hora correctas.';
    end if;
    if p_at > now() + interval '1 minute' then
      raise exception 'La hora corregida no puede ser futura.';
    end if;
    if not v_admin and p_at < now() - interval '62 days' then
      raise exception 'Solo puedes corregir fichajes de los dos últimos meses. Para fechas anteriores, habla con RR. HH.';
    end if;
  end if;

  insert into public.time_corrections (employee_id, target_entry_id, kind, proposed_at, reason, requested_by, status, reviewed_by, reviewed_at)
  values (
    v_emp, p_target_entry, p_kind, case when p_kind = 'void' then null else p_at end, v_reason, v_uid,
    case when v_admin then 'approved' else 'pending' end,
    case when v_admin then v_uid end,
    case when v_admin then now() end
  )
  returning id into v_id;

  v_day := to_char((coalesce(p_at, v_target.occurred_at) at time zone 'Europe/Madrid'), 'DD/MM');
  if v_admin then
    perform hr_private.apply_time_correction(v_id);
    perform notif_private.emit(
      array[v_emp], 'hours', '🕒 Fichaje corregido',
      'RR. HH. ha corregido tu registro de jornada del ' || v_day || '.',
      'info', 'time_correction', v_id::text, 'time_correction:' || v_id::text || ':applied'
    );
  else
    perform notif_private.emit(
      notif_private.admin_ids(), 'hours', '🕒 Corrección de fichaje',
      notif_private.profile_name(v_emp) || ' pide corregir su registro de jornada del ' || v_day || '.',
      'info', 'time_correction', v_id::text, 'time_correction:' || v_id::text || ':created'
    );
  end if;
  return v_id;
end;
$$;

create or replace function public.review_time_correction(p_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.time_corrections;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Solo RR. HH. puede revisar correcciones de fichajes' using errcode = '42501';
  end if;
  if char_length(coalesce(v_note, '')) > 500 then
    raise exception 'La nota puede tener como máximo 500 caracteres.';
  end if;
  select * into c from public.time_corrections where id = p_id for update;
  if c.id is null then
    raise exception 'Corrección no encontrada.';
  end if;
  if c.status <> 'pending' then
    raise exception 'Esta corrección ya está revisada.';
  end if;

  update public.time_corrections
  set status = case when p_approve then 'approved' else 'rejected' end,
      reviewed_by = auth.uid(), reviewed_at = now(), review_note = v_note
  where id = p_id;

  if p_approve then
    perform hr_private.apply_time_correction(p_id);
  end if;

  perform notif_private.emit(
    array[c.employee_id], 'hours',
    case when p_approve then '✅ Corrección de fichaje aprobada' else '❌ Corrección de fichaje rechazada' end,
    case when p_approve then 'Tu registro de jornada ya está corregido.' else 'Consulta el motivo en Fichaje.' end,
    case when p_approve then 'success' else 'error' end,
    'time_correction', p_id::text, 'time_correction:' || p_id::text || ':' || case when p_approve then 'approved' else 'rejected' end
  );
end;
$$;

create or replace function public.cancel_time_correction(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.time_corrections
  set status = 'cancelled'
  where id = p_id and employee_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'Solo puedes cancelar tus correcciones pendientes.';
  end if;
end;
$$;

revoke all on function public.clock_event(text, text, text) from public, anon;
revoke all on function public.request_time_correction(text, timestamptz, text, uuid, uuid) from public, anon;
revoke all on function public.review_time_correction(uuid, boolean, text) from public, anon;
revoke all on function public.cancel_time_correction(uuid) from public, anon;
grant execute on function public.clock_event(text, text, text) to authenticated;
grant execute on function public.request_time_correction(text, timestamptz, text, uuid, uuid) to authenticated;
grant execute on function public.review_time_correction(uuid, boolean, text) to authenticated;
grant execute on function public.cancel_time_correction(uuid) to authenticated;

-- 5. Conservación --------------------------------------------------------------------

create or replace function public.guard_profile_delete_time_records()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.time_entries where employee_id = old.id)
     or exists (select 1 from public.time_corrections where employee_id = old.id) then
    raise exception 'No se puede eliminar a %: tiene registros de jornada, que la ley obliga a conservar cuatro años.', old.name;
  end if;
  return old;
end;
$$;

drop trigger if exists profiles_keep_time_records on public.profiles;
create trigger profiles_keep_time_records
  before delete on public.profiles
  for each row execute function public.guard_profile_delete_time_records();

-- 6. Historial de RR. HH. ------------------------------------------------------------

drop trigger if exists work_schedules_hr_audit on public.work_schedules;
create trigger work_schedules_hr_audit
  after insert or update or delete on public.work_schedules
  for each row execute function hr_private.capture_audit('', '', '');

drop trigger if exists time_corrections_hr_audit on public.time_corrections;
create trigger time_corrections_hr_audit
  after insert or update or delete on public.time_corrections
  for each row execute function hr_private.capture_audit('employee_id', '', '');

commit;

notify pgrst, 'reload schema';
