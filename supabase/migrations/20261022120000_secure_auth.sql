-- ================================================================
-- LOGIN SEGURO (Supabase Auth) + PERMISOS POR FILA (RLS)
-- Ejecutar en Supabase Dashboard -> SQL Editor, de una vez.
--
-- Hasta ahora el login comparaba la contraseña en el navegador y la clave
-- pública podía leer y borrar todas las tablas (incluido password_hash).
-- Esta migración:
--   1. Copia cada perfil a auth.users con el MISMO id, email y hash bcrypt:
--      todos siguen entrando con su email y contraseña de siempre.
--   2. Crea las funciones con las que RRHH da de alta cuentas y pone
--      contraseñas, y mantiene auth.users al día al cambiar o borrar perfiles.
--   3. Activa RLS en todas las tablas: sin sesión no se lee nada, cada
--      empleado ve y cambia lo suyo y los admins todo.
--   4. Rechaza en el servidor reservas y asuntos propios en el pasado, horas
--      "debidas" en el futuro y fechas de fin anteriores al inicio.
--   5. Borra profiles.password_hash (las contraseñas viven en auth.users).
--
-- IMPORTANTE: ejecutar a la vez que se publica la web nueva y una versión
-- nueva de la app. La web y la app anteriores dejan de funcionar con esto.
-- ================================================================

create extension if not exists pgcrypto with schema extensions;

-- 1. Cuentas -------------------------------------------------------------

-- Trigger antiguo de auth.users (handle_new_user) que creaba una fila en
-- profiles por cada cuenta nueva: chocaba con los perfiles que ya existen, con
-- las altas de RRHH (que crean el perfil ellas mismas) y daría ficha de
-- empleado a quien se registrara por su cuenta. Se deja sin efecto.
do $$
declare
  f record;
begin
  for f in
    select n.nspname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'handle_new_user' and p.pronargs = 0
      and p.prorettype = 'trigger'::regtype
  loop
    execute format($f$
      create or replace function %I.handle_new_user()
      returns trigger
      language plpgsql
      security definer
      set search_path = public
      as $body$
      begin
        -- Los perfiles los crea RRHH (admin_create_account + insert en profiles)
        return new;
      end;
      $body$;
    $f$, f.nspname);
  end loop;
end $$;

-- Crea la cuenta de acceso de un perfil. Uso interno (migración y RPCs).
create or replace function public.create_auth_account(p_id uuid, p_email text, p_hash text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated',
    lower(trim(p_email)), p_hash, now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', ''
  );
  insert into auth.identities (user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (
    p_id, p_id::text, 'email',
    jsonb_build_object('sub', p_id::text, 'email', lower(trim(p_email)), 'email_verified', true),
    now(), now(), now()
  );
end;
$$;
revoke all on function public.create_auth_account(uuid, text, text) from public, anon, authenticated;

-- Copia los perfiles existentes. Hash bcrypt -> se usa tal cual; contraseña en
-- texto plano (puesta a mano) -> se cifra; sin contraseña y en primer acceso ->
-- la temporal de RRHH (margube2026); sin contraseña -> RRHH debe poner una.
do $$
declare
  p record;
  v_email text;
  v_hash text;
  v_other uuid;
begin
  for p in
    select id, email, password_hash, first_login
    from public.profiles
    where coalesce(trim(email), '') <> ''
  loop
    v_email := lower(trim(p.email));
    v_hash := case
      when p.password_hash ~ '^\$2[aby]\$\d{2}\$' then p.password_hash
      when coalesce(p.password_hash, '') <> '' then extensions.crypt(p.password_hash, extensions.gen_salt('bf', 10))
      when p.first_login is true then extensions.crypt('margube2026', extensions.gen_salt('bf', 10))
      else null
    end;

    -- Ya tenía cuenta (de cuando existía handle_new_user): se le pone la
    -- contraseña con la que entra hoy, la de profiles
    if exists (select 1 from auth.users where id = p.id) then
      update auth.users
        set encrypted_password = v_hash,
            email_confirmed_at = coalesce(email_confirmed_at, now()),
            updated_at = now()
        where id = p.id;
      continue;
    end if;

    select id into v_other from auth.users where lower(email) = v_email;
    if v_other is not null then
      if exists (select 1 from public.profiles where id = v_other) then
        raise notice 'Email % repetido en profiles: el perfil % se queda sin acceso', v_email, p.id;
        continue;
      end if;
      delete from auth.users where id = v_other; -- cuenta antigua sin perfil
    end if;

    perform public.create_auth_account(p.id, v_email, v_hash);
  end loop;
end $$;

-- 2. Permisos y gestión de cuentas ---------------------------------------

-- Tener sesión no basta: hay que tener ficha en profiles (por si alguien se
-- registra por su cuenta con la clave pública)
create or replace function public.is_employee()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Mismo criterio que NewsPage: admins y Comunicación - marketing
create or replace function public.can_edit_news()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and (role = 'admin' or department = 'Comunicación - marketing')
  );
$$;

-- RRHH da de alta un empleado: crea la cuenta y devuelve el id que debe
-- llevar su fila de profiles.
create or replace function public.admin_create_account(p_email text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede crear cuentas' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'El email no es válido';
  end if;
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'La contraseña debe tener al menos 6 caracteres';
  end if;

  select id into v_id from auth.users where lower(email) = v_email;
  if v_id is not null then
    if exists (select 1 from public.profiles where id = v_id) then
      raise exception 'Ya existe un empleado con ese email';
    end if;
    -- Alta anterior a medias (la cuenta se creó pero el perfil no)
    update auth.users set encrypted_password = crypt(p_password, gen_salt('bf', 10)), updated_at = now()
    where id = v_id;
    return v_id;
  end if;

  v_id := gen_random_uuid();
  perform public.create_auth_account(v_id, v_email, crypt(p_password, gen_salt('bf', 10)));
  return v_id;
end;
$$;

-- RRHH pone una contraseña temporal: el empleado tendrá que cambiarla al entrar.
create or replace function public.admin_set_password(p_user_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede cambiar contraseñas' using errcode = '42501';
  end if;
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'La contraseña debe tener al menos 6 caracteres';
  end if;
  select email into v_email from public.profiles where id = p_user_id;
  if v_email is null then
    raise exception 'Empleado no encontrado';
  end if;

  if exists (select 1 from auth.users where id = p_user_id) then
    update auth.users set encrypted_password = crypt(p_password, gen_salt('bf', 10)), updated_at = now()
    where id = p_user_id;
  else
    perform public.create_auth_account(p_user_id, v_email, crypt(p_password, gen_salt('bf', 10)));
  end if;
  update public.profiles set first_login = true where id = p_user_id;
end;
$$;

revoke all on function public.admin_create_account(text, text) from public, anon;
revoke all on function public.admin_set_password(uuid, text) from public, anon;
grant execute on function public.admin_create_account(text, text) to authenticated;
grant execute on function public.admin_set_password(uuid, text) to authenticated;

-- El email del perfil es el de acceso; borrar un perfil borra su cuenta.
create or replace function public.sync_profile_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from auth.users where id = old.id;
    return old;
  end if;
  if new.email is distinct from old.email then
    update auth.users set email = lower(trim(new.email)), updated_at = now() where id = new.id;
    update auth.identities
      set identity_data = identity_data || jsonb_build_object('email', lower(trim(new.email))), updated_at = now()
      where user_id = new.id and provider = 'email';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_sync_account on public.profiles;
create trigger profiles_sync_account
  after update of email or delete on public.profiles
  for each row execute function public.sync_profile_account();

-- Un empleado puede editar su fila (modo de trabajo, normas, primer acceso…)
-- pero no hacerse admin ni cambiar su email.
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if new.id <> old.id
     or new.role is distinct from old.role
     or new.email is distinct from old.email
     or (new.first_login is distinct from old.first_login and new.first_login is not false) then
    raise exception 'No tienes permiso para cambiar estos datos' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_update on public.profiles;
create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- Solicitudes, reservas y horas: el empleado no puede aprobarse a sí mismo
-- ni pasar la fila a otra persona.
create or replace function public.guard_review_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if new.employee_id is distinct from old.employee_id
     or new.status is distinct from old.status
     or new.reviewed_by is distinct from old.reviewed_by then
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
    execute format('drop trigger if exists %I on public.%I', t || '_guard_review', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.guard_review_fields()',
      t || '_guard_review', t);
  end loop;
end $$;

-- 3. Fechas válidas (hora de España) --------------------------------------

create or replace function public.madrid_now()
returns timestamp
language sql
stable
as $$
  select now() at time zone 'Europe/Madrid';
$$;

create or replace function public.check_reservation_dates()
returns trigger
language plpgsql
as $$
begin
  if new.time_end <= new.time_start then
    raise exception 'La hora de fin debe ser posterior a la de inicio';
  end if;
  if (new.date + new.time_start) < public.madrid_now() then
    raise exception 'No se puede reservar en una fecha u hora pasada';
  end if;
  return new;
end;
$$;

drop trigger if exists reservations_check_dates on public.reservations;
create trigger reservations_check_dates
  before insert or update of date, time_start, time_end on public.reservations
  for each row execute function public.check_reservation_dates();

create or replace function public.check_personal_day_date()
returns trigger
language plpgsql
as $$
begin
  if new.date < public.madrid_now()::date then
    raise exception 'No se pueden pedir asuntos propios para un día pasado';
  end if;
  return new;
end;
$$;

drop trigger if exists personal_days_check_date on public.personal_days;
create trigger personal_days_check_date
  before insert or update of date on public.personal_days
  for each row execute function public.check_personal_day_date();

create or replace function public.check_hour_compensation()
returns trigger
language plpgsql
as $$
begin
  if new.hours is null or new.hours <= 0 then
    raise exception 'Las horas deben ser mayores que 0';
  end if;
  if new.type = 'debe' and new.date > public.madrid_now()::date then
    raise exception 'Las horas debidas no pueden ser de una fecha futura';
  end if;
  return new;
end;
$$;

drop trigger if exists hour_compensations_check on public.hour_compensations;
create trigger hour_compensations_check
  before insert or update of date, hours, type on public.hour_compensations
  for each row execute function public.check_hour_compensation();

create or replace function public.check_request_values()
returns trigger
language plpgsql
as $$
begin
  if new.start_date is not null and new.end_date is not null and new.end_date < new.start_date then
    raise exception 'La fecha de fin debe ser igual o posterior a la de inicio';
  end if;
  if new.amount is not null and new.amount <= 0 then
    raise exception 'El importe debe ser mayor que 0';
  end if;
  return new;
end;
$$;

drop trigger if exists requests_check_values on public.requests;
create trigger requests_check_values
  before insert or update of start_date, end_date, amount on public.requests
  for each row execute function public.check_request_values();

-- Remoto / externo cuentan los dos extremos: del 28 al 29 son 2 días.
-- requests.days es una columna generada (end_date - start_date): se vuelve a
-- crear con + 1, y Postgres recalcula también las solicitudes ya guardadas.
alter table public.requests drop column if exists days;
alter table public.requests
  add column days integer generated always as (end_date - start_date + 1) stored;

-- 4. RLS -------------------------------------------------------------------

-- Fuera las políticas anteriores (dejaban entrar a la clave pública)
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'requests', 'personal_days', 'hour_compensations', 'reservations',
                        'rooms', 'vehicles', 'news', 'documents', 'notifications')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'requests', 'personal_days', 'hour_compensations', 'reservations',
                           'rooms', 'vehicles', 'news', 'documents', 'notifications'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

grant usage, select on all sequences in schema public to authenticated;

-- La vista se consultaba con los permisos de su dueño y se saltaba RLS
-- (la web ya no la usa: lee reservations como la app)
do $$
begin
  if to_regclass('public.reservations_full') is not null then
    alter view public.reservations_full set (security_invoker = true);
    revoke all on public.reservations_full from anon;
  end if;
end $$;

-- profiles: el directorio es visible para la plantilla; altas y bajas, RRHH
create policy profiles_select on public.profiles for select to authenticated using (public.is_employee());
create policy profiles_insert on public.profiles for insert to authenticated with check (public.is_admin());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
create policy profiles_delete on public.profiles for delete to authenticated using (public.is_admin());

-- Solicitudes, asuntos propios y horas: las propias, o todas si eres admin
do $$
declare
  t text;
begin
  foreach t in array array['requests', 'personal_days', 'hour_compensations'] loop
    execute format('create policy %I on public.%I for select to authenticated using (employee_id = auth.uid() or public.is_admin())', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (employee_id = auth.uid() or public.is_admin())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (employee_id = auth.uid() or public.is_admin()) with check (employee_id = auth.uid() or public.is_admin())', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (employee_id = auth.uid() or public.is_admin())', t || '_delete', t);
  end loop;
end $$;

-- Reservas: el calendario es de todos; cada uno gestiona las suyas
create policy reservations_select on public.reservations for select to authenticated using (public.is_employee());
create policy reservations_insert on public.reservations for insert to authenticated
  with check (employee_id = auth.uid() or public.is_admin());
create policy reservations_update on public.reservations for update to authenticated
  using (employee_id = auth.uid() or public.is_admin()) with check (employee_id = auth.uid() or public.is_admin());
create policy reservations_delete on public.reservations for delete to authenticated
  using (employee_id = auth.uid() or public.is_admin());

-- Salas y vehículos: los ve todo el mundo, los gestiona RRHH
create policy rooms_select on public.rooms for select to authenticated using (public.is_employee());
create policy rooms_write on public.rooms for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy vehicles_select on public.vehicles for select to authenticated using (public.is_employee());
create policy vehicles_write on public.vehicles for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Noticias
create policy news_select on public.news for select to authenticated using (public.is_employee());
create policy news_write on public.news for all to authenticated using (public.can_edit_news()) with check (public.can_edit_news());

-- Documentos: los que envías, los que te envían y los generales de RRHH
create policy documents_select on public.documents for select to authenticated using (
  public.is_admin() or sender_id = auth.uid() or recipient_id = auth.uid()
  or (recipient_id is null and exists (select 1 from public.profiles s where s.id = sender_id and s.role = 'admin'))
);
create policy documents_insert on public.documents for insert to authenticated
  with check (sender_id = auth.uid() or public.is_admin());
create policy documents_update on public.documents for update to authenticated
  using (public.is_admin() or sender_id = auth.uid() or recipient_id = auth.uid());
create policy documents_delete on public.documents for delete to authenticated
  using (public.is_admin() or sender_id = auth.uid());

-- Avisos: cada uno los suyos. Se pueden crear para uno mismo, para los admins
-- (nueva solicitud) o, siendo admin, para cualquiera (aprobada / rechazada).
create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = auth.uid());
create policy notifications_insert on public.notifications for insert to authenticated with check (
  public.is_employee() and (user_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.profiles a where a.id = user_id and a.role = 'admin'))
);

-- Archivos del bucket documents: subir y borrar con sesión iniciada
do $$
declare
  r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') || coalesce(with_check, '')) like '%documents%'
  loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
end $$;

create policy documents_files_select on storage.objects for select to authenticated using (bucket_id = 'documents' and public.is_employee());
create policy documents_files_insert on storage.objects for insert to authenticated with check (bucket_id = 'documents' and public.is_employee());
create policy documents_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (owner_id = auth.uid()::text or public.is_admin()));

-- 5. Avisos push: solo puedes registrar tu propio dispositivo ---------------

create or replace function public.register_web_push(
  p_user_id uuid, p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_endpoint is null or p_endpoint !~ '^https://' then
    raise exception 'invalid endpoint';
  end if;

  insert into public.web_push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (p_user_id, p_endpoint, p_p256dh, p_auth, p_user_agent)
  on conflict (endpoint) do update
    set user_id    = excluded.user_id,
        p256dh     = excluded.p256dh,
        auth       = excluded.auth,
        user_agent = excluded.user_agent,
        updated_at = now();
end;
$$;

create or replace function public.register_push_token(p_user_id uuid, p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_token is null or p_token !~ '^Expo(nent)?PushToken\[.+\]$' then
    raise exception 'invalid push token';
  end if;

  insert into public.push_tokens (user_id, token, platform)
  values (p_user_id, p_token, p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        updated_at = now();
end;
$$;

revoke all on function public.register_web_push(uuid, text, text, text, text) from public, anon;
revoke all on function public.unregister_web_push(text) from public, anon;
revoke all on function public.register_push_token(uuid, text, text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_web_push(uuid, text, text, text, text) to authenticated;
grant execute on function public.unregister_web_push(text) to authenticated;
grant execute on function public.register_push_token(uuid, text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- 6. Las contraseñas ya solo están en auth.users ---------------------------

alter table public.profiles drop column if exists password_hash;
