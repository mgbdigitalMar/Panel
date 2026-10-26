-- ================================================================
-- REFUERZO DE SEGURIDAD (después de 20261022120000_secure_auth.sql)
-- Ejecutar en Supabase Dashboard -> SQL Editor (o `supabase db push`).
--
-- Aditivo y compatible con la web y la app actuales (no cambia columnas ni
-- datos guardados; solo valida las escrituras nuevas):
--   1. Un empleado no puede crear filas ya aprobadas o revisadas: las
--      solicitudes, asuntos propios, reservas y bolsa de horas nacen
--      'pending'. Las horas 'ya' y 'debe' siguen aprobándose solas, como hoy.
--      Una cuenta de Auth sin ficha en profiles no puede crear nada.
--   2. En su propia ficha un empleado solo cambia lo que la web y la app
--      cambian (modo de trabajo, normas aceptadas, primer acceso, horario
--      aplicado). Antes podía cambiarse el departamento y así editar noticias.
--   3. El destinatario de un documento solo puede cambiar su estado.
--   4. Los enlaces de archivo deben ser https:// o data: (sin HTML/SVG): un
--      enlace javascript: en un justificante ejecutaba código al abrirlo.
--   5. Dos reservas no pueden solaparse en el mismo recurso, también cuando
--      se envían a la vez desde la web y la app.
--   6. En el bucket documents cada uno ve sus archivos, los de los documentos
--      y asuntos propios que puede ver, o todos si es admin.
--   7. Dar de baja un dispositivo solo afecta a los del propio usuario.
-- ================================================================

-- 1. Filas nuevas ------------------------------------------------------------

create or replace function public.guard_new_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb := to_jsonb(new);
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if not public.is_employee() then
    raise exception 'Tu cuenta no tiene ficha de empleado' using errcode = '42501';
  end if;
  if v->>'reviewed_by' is not null then
    raise exception 'Solo un administrador puede revisar esta solicitud' using errcode = '42501';
  end if;
  -- Las horas ya compensadas o debidas no pasan por revisión (HorasPage / NewHoursScreen)
  if tg_table_name = 'hour_compensations' and v->>'type' in ('ya', 'debe') then
    if v->>'status' not in ('pending', 'approved') then
      raise exception 'Estado no válido' using errcode = '42501';
    end if;
  elsif v->>'status' is distinct from 'pending' then
    raise exception 'Solo un administrador puede revisar esta solicitud' using errcode = '42501';
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['requests', 'personal_days', 'hour_compensations', 'reservations'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_guard_new', t);
    execute format(
      'create trigger %I before insert on public.%I for each row execute function public.guard_new_row()',
      t || '_guard_new', t);
  end loop;
end $$;

drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents for insert to authenticated
  with check (public.is_employee() and (sender_id = auth.uid() or public.is_admin()));

-- 2. Ficha propia ------------------------------------------------------------

create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Lo que escriben en la ficha propia la web y la app (setCurrentUser,
  -- ChangePassword, changeWorkMode y la sincronización del horario)
  v_own text[] := array['work_mode', 'policy_accepted', 'first_login', 'telework_applied_on', 'updated_at'];
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if (to_jsonb(new) - v_own) is distinct from (to_jsonb(old) - v_own)
     or (new.first_login is distinct from old.first_login and new.first_login is not false) then
    raise exception 'No tienes permiso para cambiar estos datos' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- 3. Documentos recibidos ----------------------------------------------------

create or replace function public.guard_document_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_own text[] := array['status', 'updated_at'];
begin
  if auth.uid() is null or public.is_admin() or old.sender_id = auth.uid() then return new; end if;
  if (to_jsonb(new) - v_own) is distinct from (to_jsonb(old) - v_own) then
    raise exception 'Solo puedes cambiar el estado de un documento recibido' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists documents_guard_update on public.documents;
create trigger documents_guard_update
  before update on public.documents
  for each row execute function public.guard_document_update();

-- 4. Enlaces de archivo --------------------------------------------------------

-- Storage devuelve https://; sin bucket la web guarda el archivo como data:
-- (mismo criterio que shared/utils/urls.js)
create or replace function public.check_file_url()
returns trigger
language plpgsql
as $$
begin
  if new.file_url is not null
     and new.file_url !~* '^(https://|data:(?!text/html|image/svg|application/xhtml|text/xml|application/xml))' then
    raise exception 'El enlace del archivo no es válido';
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['documents', 'personal_days'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_check_file_url', t);
    execute format(
      'create trigger %I before insert or update of file_url on public.%I for each row execute function public.check_file_url()',
      t || '_check_file_url', t);
  end loop;
end $$;

-- 5. Reservas solapadas --------------------------------------------------------

-- Mismo criterio que la comprobación de la web (createReservation): mismo
-- recurso y día, franjas que se cruzan y reserva no cancelada.
create or replace function public.check_reservation_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
begin
  if new.status::text = 'cancelled' or coalesce(new.room_id, new.vehicle_id) is null then
    return new;
  end if;
  -- Dos reservas del mismo recurso y día enviadas a la vez se comprueban de una en una
  perform pg_advisory_xact_lock(hashtextextended(
    concat_ws(':', 'reservation', new.type, coalesce(new.room_id, new.vehicle_id), new.date), 0));

  select r.time_start, r.time_end into c
  from public.reservations r
  where r.id is distinct from new.id
    and r.date = new.date
    and r.status::text <> 'cancelled'
    and (case when new.room_id is not null then r.room_id = new.room_id else r.vehicle_id = new.vehicle_id end)
    and r.time_start < new.time_end
    and r.time_end > new.time_start
  limit 1;

  if found then
    raise exception 'Ese recurso ya está reservado de % a % ese día. Elige otra franja u otro recurso.',
      left(c.time_start::text, 5), left(c.time_end::text, 5);
  end if;
  return new;
end;
$$;

drop trigger if exists reservations_no_overlap on public.reservations;
create trigger reservations_no_overlap
  before insert or update of date, time_start, time_end, room_id, vehicle_id on public.reservations
  for each row execute function public.check_reservation_overlap();

-- 6. Archivos del bucket documents ----------------------------------------------

-- Las subconsultas aplican el RLS de documents y personal_days, así que
-- "lo referencia una fila que puedo ver" es exactamente lo que el usuario ya ve.
drop policy if exists documents_files_select on storage.objects;
create policy documents_files_select on storage.objects for select to authenticated using (
  bucket_id = 'documents' and public.is_employee() and (
    owner_id = auth.uid()::text
    or public.is_admin()
    or exists (select 1 from public.documents d where position(objects.name in d.file_url) > 0)
    or exists (select 1 from public.personal_days p where position(objects.name in p.file_url) > 0)
  )
);

-- 7. Bajas de dispositivos -------------------------------------------------------

create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

create or replace function public.unregister_web_push(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.web_push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

revoke all on function public.unregister_web_push(text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.unregister_web_push(text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

notify pgrst, 'reload schema';
