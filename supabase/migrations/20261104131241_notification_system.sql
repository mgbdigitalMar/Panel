-- ================================================================
-- SISTEMA CENTRALIZADO DE NOTIFICACIONES (docs/NOTIFICACIONES.md)
--
-- Flujo, todo en la transacción de la acción del usuario:
--   solicitud / reserva / noticia...  -> trigger de negocio -> notif_private.emit()
--   -> fila en public.notifications   -> trabajo en pgmq + Broadcast + aviso al worker
--
-- El aviso al worker usa pg_net, que no sale hasta el commit, igual que un
-- Database Webhook, pero leyendo el secreto de Vault en vez de dejarlo escrito
-- en la definición del trigger. pg_cron recupera lo que el aviso no consiga.
--
-- La web y la app ya no insertan en notifications: las reglas viven aquí.
-- Los tipos de notifications.id y entity_id no se fijan a propósito: todo el
-- sistema se referencia por notifications.event_id.
-- ================================================================

create extension if not exists pgmq;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create schema if not exists notif_private;
revoke all on schema notif_private from public, anon, authenticated, service_role;

-- 1. notifications ---------------------------------------------------------

alter table public.notifications
  add column if not exists event_id uuid not null default gen_random_uuid(),
  add column if not exists category text,
  add column if not exists actor_id uuid references public.profiles(id) on delete set null,
  add column if not exists dedupe_key text,
  add column if not exists dispatch_status text not null default 'queued',
  add column if not exists dispatched_at timestamptz;

-- Lo anterior a este sistema ya se envió (o no) con send-push
update public.notifications set dispatch_status = 'legacy' where dispatch_status = 'queued';

alter table public.notifications drop constraint if exists notifications_dispatch_status_check;
alter table public.notifications add constraint notifications_dispatch_status_check check (
  dispatch_status in ('queued', 'processing', 'processed', 'skipped_preference', 'no_devices', 'dead_letter', 'legacy')
);

create unique index if not exists notifications_event_id_key on public.notifications (event_id);
create unique index if not exists notifications_dedupe_key
  on public.notifications (user_id, dedupe_key) where dedupe_key is not null;
create index if not exists notifications_inbox_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read = false;
create index if not exists notifications_actor_idx on public.notifications (actor_id);

-- Mismas reglas de siempre; (select auth.uid()) se evalúa una vez por consulta, no por fila
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

-- Solo la base de datos crea avisos. Un cliente antiguo que siga insertando
-- recibe un error que ya solo registra como warning, y no se duplica nada.
drop policy if exists notifications_insert on public.notifications;
revoke insert, update on public.notifications from anon, authenticated;
grant update (read) on public.notifications to authenticated;

-- 2. Dispositivos ----------------------------------------------------------

alter table public.push_tokens
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_reason text,
  add column if not exists last_success_at timestamptz;

alter table public.web_push_subscriptions
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_reason text,
  add column if not exists last_success_at timestamptz;

create or replace function public.register_push_token(p_user_id uuid, p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
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
        disabled_at = null,
        disabled_reason = null,
        updated_at = now();
end;
$$;

create or replace function public.register_web_push(
  p_user_id uuid, p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
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
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        disabled_at = null,
        disabled_reason = null,
        updated_at = now();
end;
$$;

-- pushsubscriptionchange: el service worker no tiene sesión. Conocer el endpoint
-- anterior (una URL imposible de adivinar) es lo que autoriza el cambio.
create or replace function public.notif_rotate_web_push(
  p_old_endpoint text, p_new_endpoint text, p_p256dh text, p_auth text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if p_new_endpoint is null or p_new_endpoint !~ '^https://' then
    raise exception 'invalid endpoint';
  end if;
  select user_id into v_user from public.web_push_subscriptions where endpoint = p_old_endpoint;
  if v_user is null then
    return;
  end if;
  delete from public.web_push_subscriptions where endpoint = p_old_endpoint;
  insert into public.web_push_subscriptions (user_id, endpoint, p256dh, auth)
  values (v_user, p_new_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        disabled_at = null, disabled_reason = null, updated_at = now();
end;
$$;

-- 3. Preferencias ----------------------------------------------------------

-- Sin fila = activada. Desactivar una categoría quita el push, no la bandeja.
create table if not exists public.notification_preferences (
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  category     text        not null check (category in ('requests', 'reservations', 'hours', 'documents', 'news')),
  push_enabled boolean     not null default true,
  updated_at   timestamptz not null default now(),
  primary key (user_id, category)
);

alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from anon, authenticated;
grant select, insert, update, delete on public.notification_preferences to authenticated;

drop policy if exists notification_preferences_own on public.notification_preferences;
create policy notification_preferences_own on public.notification_preferences
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 4. Entregas y supervisión ------------------------------------------------

create table if not exists notif_private.deliveries (
  id                  uuid        primary key default gen_random_uuid(),
  event_id            uuid        not null references public.notifications(event_id) on delete cascade,
  user_id             uuid        not null,
  channel             text        not null check (channel in ('expo', 'web')),
  device_id           bigint      not null,
  -- provider_accepted: Expo o el servicio Web Push aceptó la petición
  -- provider_confirmed: el recibo de Expo dice que FCM aceptó el envío
  -- La entrega real solo consta en device_confirmed_at, si el dispositivo avisa
  status              text        not null default 'pending' check (status in (
                        'pending', 'sending', 'retry', 'provider_accepted', 'provider_confirmed',
                        'failed', 'invalid_device', 'skipped')),
  attempts            integer     not null default 0,
  next_attempt_at     timestamptz not null default now(),
  locked_until        timestamptz,
  exhausted           boolean     not null default false,
  expo_ticket_id      text,
  receipt_state       text        check (receipt_state in ('ok', 'error', 'expired')),
  receipt_checked_at  timestamptz,
  http_status         integer,
  last_error_code     text,
  last_error          text,
  accepted_at         timestamptz,
  confirmed_at        timestamptz,
  device_confirmed_at timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (event_id, channel, device_id)
);

create index if not exists deliveries_open_idx on notif_private.deliveries (next_attempt_at)
  where status in ('pending', 'sending', 'retry');
create index if not exists deliveries_receipts_idx on notif_private.deliveries (accepted_at)
  where channel = 'expo' and status = 'provider_accepted' and receipt_state is null;
create index if not exists deliveries_created_idx on notif_private.deliveries (created_at);

create table if not exists notif_private.ops_log (
  id         bigint      generated always as identity primary key,
  created_at timestamptz not null default now(),
  level      text        not null check (level in ('info', 'warn', 'error')),
  kind       text        not null,
  event_id   uuid,
  delivery_id uuid,
  detail     jsonb       not null default '{}'
);
create index if not exists ops_log_kind_idx on notif_private.ops_log (kind, created_at desc);

create table if not exists notif_private.heartbeats (
  name        text        primary key,
  last_run_at timestamptz not null default now(),
  detail      jsonb       not null default '{}'
);

create table if not exists notif_private.alerts (
  key           text        primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  notified_at   timestamptz,
  resolved_at   timestamptz,
  detail        jsonb       not null default '{}'
);

alter table notif_private.deliveries enable row level security;
alter table notif_private.ops_log enable row level security;
alter table notif_private.heartbeats enable row level security;
alter table notif_private.alerts enable row level security;

-- 5. Colas duraderas -------------------------------------------------------

do $$
begin
  if not exists (select 1 from pgmq.list_queues() where queue_name = 'notification_jobs') then
    perform pgmq.create('notification_jobs');
  end if;
  if not exists (select 1 from pgmq.list_queues() where queue_name = 'notification_jobs_dlq') then
    perform pgmq.create('notification_jobs_dlq');
  end if;
end $$;

-- Nadie entra a las colas desde un cliente público
revoke all on schema pgmq from public, anon, authenticated;
revoke all on all tables in schema pgmq from public, anon, authenticated;
alter table pgmq.q_notification_jobs enable row level security;
alter table pgmq.a_notification_jobs enable row level security;
alter table pgmq.q_notification_jobs_dlq enable row level security;
alter table pgmq.a_notification_jobs_dlq enable row level security;

-- 6. Piezas internas -------------------------------------------------------

create or replace function notif_private.log(
  p_level text, p_kind text, p_detail jsonb default '{}', p_event_id uuid default null, p_delivery_id uuid default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into notif_private.ops_log (level, kind, detail, event_id, delivery_id)
  values (p_level, p_kind, coalesce(p_detail, '{}'), p_event_id, p_delivery_id);
$$;

create or replace function notif_private.topic(p_user_id uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'user:' || p_user_id::text || ':notifications';
$$;

create or replace function notif_private.unread_count(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.notifications where user_id = p_user_id and read = false;
$$;

-- Tiempo real best-effort: si Broadcast falla, el cliente se pone al día al reconectar.
create or replace function notif_private.broadcast(p_user_id uuid, p_event text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    p_payload || jsonb_build_object('unread', notif_private.unread_count(p_user_id)),
    p_event,
    notif_private.topic(p_user_id),
    true
  );
exception when others then
  raise warning 'notif_private.broadcast: %', sqlerrm;
end;
$$;

-- El "webhook": pg_net guarda la petición en la transacción y la envía tras el commit.
create or replace function notif_private.wake_worker(p_source text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notifications_worker_url' limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notifications_worker_secret' limit 1;
  if v_url is null or v_secret is null then
    return; -- los trabajos esperan en la cola; la alerta worker_not_configured lo avisa
  end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('source', p_source),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notifications-secret', v_secret),
    timeout_milliseconds := 5000
  );
exception when others then
  raise warning 'notif_private.wake_worker: %', sqlerrm;
end;
$$;

-- La usa scripts/deploy-notifications.mjs. Los secretos no van en ninguna migración.
create or replace function notif_private.set_worker_config(p_url text, p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  v_id uuid;
begin
  for c in select * from (values ('notifications_worker_url', p_url), ('notifications_worker_secret', p_secret)) as x(name, value) loop
    select id into v_id from vault.secrets where name = c.name;
    if v_id is null then
      perform vault.create_secret(c.value, c.name);
    else
      perform vault.update_secret(v_id, c.value);
    end if;
  end loop;
end;
$$;

create or replace function notif_private.after_notifications_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_any boolean := false;
begin
  for r in select * from inserted loop
    v_any := true;
    -- Solo el identificador: el worker lee el resto de la fila
    perform pgmq.send('notification_jobs', jsonb_build_object('event_id', r.event_id));
    perform notif_private.broadcast(
      r.user_id,
      'notification_created',
      jsonb_build_object('notification', to_jsonb(r) - 'dedupe_key' - 'actor_id' - 'dispatch_status' - 'dispatched_at')
    );
  end loop;
  if v_any then
    perform notif_private.wake_worker('webhook');
  end if;
  return null;
end;
$$;

-- Con transition tables, marcar 50 como leídas produce un único evento
create or replace function notif_private.after_notifications_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select n.user_id, count(*) as changed, (array_agg(to_jsonb(n)->'id'))[1] as id, bool_or(n.read) as read
    from new_rows n
    join old_rows o on o.id = n.id
    where n.read is distinct from o.read
    group by n.user_id
  loop
    if r.changed = 1 then
      perform notif_private.broadcast(r.user_id, 'notification_updated', jsonb_build_object('id', r.id, 'read', r.read));
    else
      perform notif_private.broadcast(r.user_id, 'notifications_sync', '{}');
    end if;
  end loop;
  return null;
end;
$$;

create or replace function notif_private.after_notifications_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in select distinct user_id from old_rows loop
    perform notif_private.broadcast(r.user_id, 'notifications_sync', '{}');
  end loop;
  return null;
end;
$$;

-- send-push queda sustituido por notifications-worker
drop trigger if exists on_notification_insert_push on public.notifications;
drop function if exists public.notify_user_by_push();

drop trigger if exists notifications_after_insert on public.notifications;
create trigger notifications_after_insert
  after insert on public.notifications
  referencing new table as inserted
  for each statement execute function notif_private.after_notifications_insert();

drop trigger if exists notifications_after_update on public.notifications;
create trigger notifications_after_update
  after update on public.notifications
  referencing old table as old_rows new table as new_rows
  for each statement execute function notif_private.after_notifications_update();

drop trigger if exists notifications_after_delete on public.notifications;
create trigger notifications_after_delete
  after delete on public.notifications
  referencing old table as old_rows
  for each statement execute function notif_private.after_notifications_delete();

-- Canal privado por persona: Broadcast solo llega a quien pasa esta política.
-- Sin política de INSERT, ningún cliente puede emitir en estos canales.
drop policy if exists notifications_receive_own_broadcast on realtime.messages;
create policy notifications_receive_own_broadcast on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) = 'user:' || (select auth.uid())::text || ':notifications'
  );

-- 7. Motor: quién recibe qué ------------------------------------------------

create or replace function notif_private.admin_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(id), '{}') from public.profiles where role::text = 'admin';
$$;

-- Único punto de creación. Nunca rompe la acción del usuario: si falla, se deshace
-- solo el aviso (fila y trabajo juntos) y queda registrado en ops_log.
create or replace function notif_private.emit(
  p_recipients uuid[],
  p_category text,
  p_title text,
  p_body text,
  p_type text,
  p_entity_type text,
  p_entity_id text,
  p_dedupe text,
  p_actor uuid default auth.uid()
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- jsonb_populate_record convierte al tipo real de cada columna
  insert into public.notifications (user_id, title, body, type, entity_type, entity_id, read, category, actor_id, dedupe_key)
  select p.id, t.title, t.body, t.type, t.entity_type, t.entity_id, false, p_category, p_actor, p_dedupe
  from public.profiles p
  cross join lateral jsonb_populate_record(
    null::public.notifications,
    jsonb_build_object(
      'title', p_title, 'body', p_body, 'type', p_type,
      'entity_type', p_entity_type, 'entity_id', p_entity_id
    )
  ) t
  where p.id = any(p_recipients)
    and p.id is distinct from p_actor -- nadie recibe aviso de su propia acción
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
exception when others then
  perform notif_private.log('error', 'emit_failed', jsonb_build_object(
    'error', sqlerrm, 'code', sqlstate, 'category', p_category, 'dedupe_key', p_dedupe
  ));
end;
$$;

create or replace function notif_private.profile_name(p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select name from public.profiles where id = p_id), 'Un empleado');
$$;

-- Clave de una transición concreta. El trigger solo llega aquí si el estado cambió de
-- verdad, y now() es el de la transacción: repetir la misma actualización no crea otro aviso.
create or replace function notif_private.transition_key(p_entity text, p_id text, p_status text)
returns text
language sql
stable
set search_path = ''
as $$
  select p_entity || ':' || p_id || ':status:' || p_status || ':' || extract(epoch from now())::text;
$$;

create or replace function notif_private.on_request_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_label text;
begin
  if tg_op = 'INSERT' then
    v_label := case new.type::text when 'remoto' then 'Remoto' when 'external' then 'Trabajo Externo' else 'Compra' end;
    perform notif_private.emit(
      notif_private.admin_ids(), 'requests',
      '📋 Nueva solicitud: ' || v_label,
      notif_private.profile_name(new.employee_id) || ' ha enviado una solicitud de ' || lower(v_label) || ' que requiere revisión.',
      'info', 'request', new.id::text, 'request:' || new.id::text || ':created'
    );
  elsif new.status::text is distinct from old.status::text and new.status::text in ('approved', 'rejected') then
    v_label := case new.type::text when 'external' then 'trabajo externo' when 'remoto' then 'remoto' else 'compra' end;
    perform notif_private.emit(
      array[new.employee_id], 'requests',
      case new.status::text when 'approved' then '✅ Solicitud aprobada' else '❌ Solicitud rechazada' end,
      'Tu solicitud de ' || v_label || ' ha sido ' || case new.status::text when 'approved' then 'aprobada.' else 'rechazada.' end,
      case new.status::text when 'approved' then 'success' else 'error' end,
      'request', new.id::text, notif_private.transition_key('request', new.id::text, new.status::text)
    );
  end if;
  return null;
end;
$$;

create or replace function notif_private.on_personal_day_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform notif_private.emit(
      notif_private.admin_ids(), 'requests',
      '📝 Día de asuntos propios',
      notif_private.profile_name(new.employee_id) || ' ha solicitado un día de asuntos propios.',
      'info', 'personal_day', new.id::text, 'personal_day:' || new.id::text || ':created'
    );
  elsif new.status::text is distinct from old.status::text and new.status::text in ('approved', 'rejected') then
    perform notif_private.emit(
      array[new.employee_id], 'requests',
      case new.status::text when 'approved' then '✅ Asuntos propios aprobados' else '❌ Asuntos propios rechazados' end,
      case new.status::text when 'approved' then 'Tu solicitud de día de asuntos propios ha sido aprobada.' else 'Tu solicitud ha sido rechazada.' end,
      case new.status::text when 'approved' then 'success' else 'error' end,
      'personal_day', new.id::text, notif_private.transition_key('personal_day', new.id::text, new.status::text)
    );
  end if;
  return null;
end;
$$;

create or replace function notif_private.on_hour_compensation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- 'ya' y 'debe' se aprueban solas: solo la bolsa requiere revisión
    if new.type::text = 'bolsa' then
      perform notif_private.emit(
        notif_private.admin_ids(), 'hours',
        '⌛ Nueva bolsa de horas',
        notif_private.profile_name(new.employee_id) || ' solicita compensar ' || trim_scale(new.hours::numeric)::text || 'h en su bolsa.',
        'info', 'hour_compensation', new.id::text, 'hour_compensation:' || new.id::text || ':created'
      );
    end if;
  elsif new.status::text is distinct from old.status::text and new.status::text in ('approved', 'rejected') then
    perform notif_private.emit(
      array[new.employee_id], 'hours',
      case new.status::text when 'approved' then '✅ Horas aprobadas' else '❌ Horas rechazadas' end,
      case new.status::text when 'approved' then 'Tu solicitud de bolsa de horas ha sido aprobada.' else 'Tu solicitud ha sido rechazada.' end,
      case new.status::text when 'approved' then 'success' else 'error' end,
      'hour_compensation', new.id::text, notif_private.transition_key('hour_compensation', new.id::text, new.status::text)
    );
  end if;
  return null;
end;
$$;

create or replace function notif_private.reservation_summary(
  p_type text, p_room text, p_vehicle text, p_date date, p_start time, p_end time
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if p_type = 'vehicle' then
    select model into v_name from public.vehicles where id::text = p_vehicle;
  else
    select name into v_name from public.rooms where id::text = p_room;
  end if;
  return coalesce(v_name, case p_type when 'vehicle' then 'Vehículo' else 'Sala' end)
    || ' · ' || to_char(p_date, 'DD/MM/YYYY')
    || ' · ' || to_char(p_start, 'HH24:MI') || '–' || to_char(p_end, 'HH24:MI');
end;
$$;

create or replace function notif_private.on_reservation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_what text;
  v_actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    v_what := notif_private.reservation_summary(new.type::text, new.room_id::text, new.vehicle_id::text, new.date, new.time_start, new.time_end);
    perform notif_private.emit(
      notif_private.admin_ids(), 'reservations',
      '📅 Nueva reserva',
      notif_private.profile_name(new.employee_id) || ' ha reservado: ' || v_what || '.',
      'info', 'reservation', new.id::text, 'reservation:' || new.id::text || ':created'
    );
  elsif tg_op = 'UPDATE' then
    if new.status::text is distinct from old.status::text and new.status::text in ('confirmed', 'cancelled') then
      v_what := notif_private.reservation_summary(new.type::text, new.room_id::text, new.vehicle_id::text, new.date, new.time_start, new.time_end);
      perform notif_private.emit(
        array[new.employee_id], 'reservations',
        case new.status::text when 'confirmed' then '✅ Reserva confirmada' else '❌ Reserva cancelada' end,
        'Tu reserva (' || v_what || ') ha sido ' || case new.status::text when 'confirmed' then 'confirmada.' else 'cancelada por un administrador.' end,
        case new.status::text when 'confirmed' then 'success' else 'error' end,
        'reservation', new.id::text, notif_private.transition_key('reservation', new.id::text, new.status::text)
      );
    end if;
  elsif old.status::text <> 'cancelled' and old.date >= (now() at time zone 'Europe/Madrid')::date then
    -- En Margube cancelar una reserva es borrarla (o borrar la sala o el vehículo).
    -- Si se borra el perfil en cascada, emit no encuentra destinatario y no hace nada.
    v_what := notif_private.reservation_summary(old.type::text, old.room_id::text, old.vehicle_id::text, old.date, old.time_start, old.time_end);
    if v_actor is not distinct from old.employee_id then
      perform notif_private.emit(
        notif_private.admin_ids(), 'reservations',
        '📅 Reserva cancelada',
        notif_private.profile_name(old.employee_id) || ' ha cancelado su reserva: ' || v_what || '.',
        'info', 'reservation', null, 'reservation:' || old.id::text || ':deleted'
      );
    else
      perform notif_private.emit(
        array[old.employee_id], 'reservations',
        '❌ Reserva cancelada',
        'Tu reserva (' || v_what || ') ha sido cancelada por un administrador.',
        'error', 'reservation', null, 'reservation:' || old.id::text || ':deleted'
      );
    end if;
  end if;
  return null;
end;
$$;

create or replace function notif_private.on_document_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- __ONBOARDING_DOC__ es configuración, y un documento general no tiene destinatario
  if new.recipient_id is not null and new.title is distinct from '__ONBOARDING_DOC__' then
    perform notif_private.emit(
      array[new.recipient_id], 'documents',
      '📄 Nuevo documento: ' || coalesce(new.title, ''),
      coalesce(nullif(new.description, ''), 'Tienes un nuevo documento disponible en tu perfil.'),
      'info', 'document', new.id::text, 'document:' || new.id::text || ':created'
    );
  end if;
  return null;
end;
$$;

create or replace function notif_private.on_news_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipients uuid[];
begin
  -- Solo al publicarse: editar una noticia ya publicada no avisa a nadie
  if new.is_active is not distinct from false then
    return null;
  end if;
  if tg_op = 'UPDATE' and old.is_active is distinct from false then
    return null;
  end if;

  select coalesce(array_agg(id), '{}') into v_recipients
  from public.profiles
  where id is distinct from new.author_id;

  perform notif_private.emit(
    v_recipients, 'news',
    case when new.type::text = 'event' then '📅 Nuevo evento: ' else '📰 Nueva noticia: ' end || coalesce(new.title, ''),
    left(coalesce(new.content, ''), 140),
    'info', 'news', new.id::text, 'news:' || new.id::text || ':published'
  );
  return null;
end;
$$;

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('requests', 'notify_on_change', 'insert or update of status', 'on_request_change'),
      ('personal_days', 'notify_on_change', 'insert or update of status', 'on_personal_day_change'),
      ('hour_compensations', 'notify_on_change', 'insert or update of status', 'on_hour_compensation_change'),
      ('reservations', 'notify_on_change', 'insert or update of status or delete', 'on_reservation_change'),
      ('documents', 'notify_on_insert', 'insert', 'on_document_insert'),
      ('news', 'notify_on_change', 'insert or update of is_active', 'on_news_change')
    ) as x(tbl, trg, events, fn)
  loop
    execute format('drop trigger if exists %I on public.%I', t.tbl || '_' || t.trg, t.tbl);
    execute format(
      'create trigger %I after %s on public.%I for each row execute function notif_private.%I()',
      t.tbl || '_' || t.trg, t.events, t.tbl, t.fn
    );
  end loop;
end $$;

-- Vuelta a la oficina: profiles.work_mode también lo cambia la sincronización automática
-- del horario, que no debe avisar. Por eso la vuelta manual se anuncia de forma explícita;
-- el texto se escribe aquí y como mucho sale un aviso al día por modo.
create or replace function public.notify_office_return(p_previous text, p_request_id text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_mode text;
  v_name text;
  v_end date;
  v_until text := '';
begin
  if v_uid is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_previous not in ('remoto', 'externo') then
    raise exception 'invalid mode';
  end if;
  select work_mode::text, name into v_mode, v_name from public.profiles where id = v_uid;
  if v_mode is distinct from 'Office' then
    return;
  end if;

  if p_request_id is not null then
    select end_date into v_end from public.requests where id::text = p_request_id and employee_id = v_uid;
    if v_end is not null then
      v_until := ' Su periodo de trabajo ' || case p_previous when 'remoto' then 'remoto' else 'externo' end
        || ' terminaba el ' || to_char(v_end, 'DD/MM/YYYY') || '.';
    end if;
  end if;

  perform notif_private.emit(
    notif_private.admin_ids(), 'requests',
    '🏢 Vuelta a la oficina',
    coalesce(v_name, 'Un empleado') || ' ha vuelto a la oficina (antes: '
      || case p_previous when 'remoto' then 'Remoto' else 'Externo' end || ').' || v_until,
    'info',
    case when v_end is not null then 'request' end,
    case when v_end is not null then p_request_id end,
    'office_return:' || v_uid::text || ':' || p_previous || ':' || (now() at time zone 'Europe/Madrid')::date::text
  );
end;
$$;

-- 8. API del worker (solo service_role) -------------------------------------

create or replace function notif_private.web_path(p_entity_type text, p_is_admin boolean)
returns text
language sql
immutable
set search_path = ''
as $$
  -- Mismo mapa que notificationWebPath en shared/config/constants.js
  select case p_entity_type
    when 'request' then '/requests'
    when 'personal_day' then '/requests'
    when 'document' then '/profile'
    when 'hour_compensation' then case when p_is_admin then '/admin' else '/horas' end
    when 'reservation' then '/reservations'
    when 'news' then '/news'
    when 'system' then '/settings'
    else '/dashboard'
  end;
$$;

create or replace function notif_private.to_dead_letter(p_event_id uuid, p_reason text, p_requeues integer default 0)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pgmq.send('notification_jobs_dlq', jsonb_build_object(
    'event_id', p_event_id, 'reason', p_reason, 'requeues', p_requeues, 'failed_at', now()
  ));
  update public.notifications set dispatch_status = 'dead_letter', dispatched_at = now() where event_id = p_event_id;
  perform notif_private.log('error', 'dead_letter', jsonb_build_object('reason', p_reason), p_event_id);
end;
$$;

create or replace function public.notif_worker_claim(p_batch integer default 20, p_vt integer default 120)
returns table (msg_id bigint, event_id uuid, read_ct integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  v_event uuid;
begin
  for m in select * from pgmq.read('notification_jobs', p_vt, p_batch) loop
    v_event := nullif(m.message->>'event_id', '')::uuid;
    -- Un trabajo que vuelve una y otra vez sin terminar no bloquea a los demás
    if m.read_ct > 20 then
      update notif_private.deliveries d
        set status = 'failed', exhausted = true, last_error_code = 'max_reads', locked_until = null, updated_at = now()
        where d.event_id = v_event and d.status in ('pending', 'sending', 'retry');
      perform notif_private.to_dead_letter(v_event, 'max_reads');
      perform pgmq.archive('notification_jobs', m.msg_id);
      continue;
    end if;
    msg_id := m.msg_id;
    event_id := v_event;
    read_ct := m.read_ct;
    return next;
  end loop;
end;
$$;

-- Crea las entregas (idempotente) y reserva las que tocan ahora, con sus direcciones.
create or replace function public.notif_worker_prepare(p_event_id uuid, p_lock_seconds integer default 120)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  n record;
  v_row jsonb;
  v_category text;
  v_is_admin boolean;
  v_rows jsonb;
begin
  select * into n from public.notifications where event_id = p_event_id;
  if not found then
    return jsonb_build_object('state', 'gone');
  end if;
  v_row := to_jsonb(n);

  v_category := coalesce(n.category, case n.entity_type::text
    when 'request' then 'requests' when 'personal_day' then 'requests'
    when 'reservation' then 'reservations' when 'hour_compensation' then 'hours'
    when 'document' then 'documents' when 'news' then 'news' end);

  if exists (
    select 1 from public.notification_preferences p
    where p.user_id = n.user_id and p.category = v_category and p.push_enabled = false
  ) then
    update public.notifications set dispatch_status = 'skipped_preference', dispatched_at = now() where event_id = p_event_id;
    return jsonb_build_object('state', 'done');
  end if;

  insert into notif_private.deliveries (event_id, user_id, channel, device_id)
  select p_event_id, n.user_id, 'expo', t.id from public.push_tokens t
  where t.user_id = n.user_id and t.disabled_at is null
  union all
  select p_event_id, n.user_id, 'web', s.id from public.web_push_subscriptions s
  where s.user_id = n.user_id and s.disabled_at is null
  on conflict (event_id, channel, device_id) do nothing;

  if not exists (select 1 from notif_private.deliveries d where d.event_id = p_event_id) then
    update public.notifications set dispatch_status = 'no_devices', dispatched_at = now() where event_id = p_event_id;
    return jsonb_build_object('state', 'done');
  end if;

  update public.notifications set dispatch_status = 'processing'
    where event_id = p_event_id and dispatch_status = 'queued';

  -- El dispositivo se dio de baja o cambió de dueño después de crear la entrega
  update notif_private.deliveries d
    set status = 'skipped', last_error_code = 'device_removed', updated_at = now()
    where d.event_id = p_event_id and d.status in ('pending', 'retry')
      and not exists (
        select 1 from public.push_tokens t
        where d.channel = 'expo' and t.id = d.device_id and t.user_id = d.user_id and t.disabled_at is null
        union all
        select 1 from public.web_push_subscriptions s
        where d.channel = 'web' and s.id = d.device_id and s.user_id = d.user_id and s.disabled_at is null
      );

  with claimed as (
    update notif_private.deliveries d
      set status = 'sending', attempts = attempts + 1,
          locked_until = now() + make_interval(secs => p_lock_seconds), updated_at = now()
      where d.event_id = p_event_id and d.status in ('pending', 'retry') and d.next_attempt_at <= now()
      returning d.id, d.channel, d.device_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'channel', c.channel, 'token', t.token,
    'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth
  )), '[]') into v_rows
  from claimed c
  left join public.push_tokens t on c.channel = 'expo' and t.id = c.device_id
  left join public.web_push_subscriptions s on c.channel = 'web' and s.id = c.device_id;

  select p.role::text = 'admin' into v_is_admin from public.profiles p where p.id = n.user_id;

  return jsonb_build_object(
    'state', 'ready',
    'notification_id', v_row->'id',
    'entity_type', v_row->'entity_type',
    'url', notif_private.web_path(n.entity_type::text, coalesce(v_is_admin, false)),
    'unread', notif_private.unread_count(n.user_id),
    'deliveries', v_rows
  );
end;
$$;

-- outcome: accepted | retry | invalid | failed
create or replace function public.notif_worker_report(p_results jsonb, p_max_attempts integer default 12)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb;
  d notif_private.deliveries;
  v_outcome text;
  v_delay numeric;
begin
  for r in select * from jsonb_array_elements(coalesce(p_results, '[]')) loop
    -- Solo quien tiene la entrega reservada informa de su resultado
    select * into d from notif_private.deliveries
      where id = (r->>'id')::uuid and status = 'sending' for update;
    if not found then
      continue;
    end if;
    v_outcome := r->>'outcome';

    if v_outcome = 'accepted' then
      update notif_private.deliveries set
        status = 'provider_accepted', expo_ticket_id = r->>'ticket_id', http_status = (r->>'http_status')::integer,
        accepted_at = now(), locked_until = null, last_error_code = null, last_error = null, updated_at = now()
        where id = d.id;
      if d.channel = 'expo' then
        update public.push_tokens set last_success_at = now() where id = d.device_id;
      else
        update public.web_push_subscriptions set last_success_at = now() where id = d.device_id;
      end if;

    elsif v_outcome = 'retry' and d.attempts < p_max_attempts then
      -- 30 s, 1, 2, 4... hasta 1 h, con algo de azar para no reintentar todos a la vez
      v_delay := greatest(
        coalesce((r->>'retry_after')::numeric, 0),
        least(3600, 30 * power(2, d.attempts - 1)) * (0.9 + random() * 0.2)
      );
      update notif_private.deliveries set
        status = 'retry', next_attempt_at = now() + make_interval(secs => v_delay::double precision), locked_until = null,
        http_status = (r->>'http_status')::integer, last_error_code = r->>'code', last_error = left(r->>'message', 500), updated_at = now()
        where id = d.id;
      perform notif_private.log('warn', 'delivery_retry', jsonb_build_object(
        'channel', d.channel, 'attempts', d.attempts, 'code', r->>'code', 'http_status', r->>'http_status'
      ), d.event_id, d.id);

    elsif v_outcome = 'invalid' then
      update notif_private.deliveries set
        status = 'invalid_device', locked_until = null, http_status = (r->>'http_status')::integer,
        last_error_code = r->>'code', last_error = left(r->>'message', 500), updated_at = now()
        where id = d.id;
      if d.channel = 'expo' then
        update public.push_tokens set disabled_at = now(), disabled_reason = r->>'code' where id = d.device_id;
      else
        update public.web_push_subscriptions set disabled_at = now(), disabled_reason = r->>'code' where id = d.device_id;
      end if;
      perform notif_private.log('info', 'device_disabled', jsonb_build_object(
        'channel', d.channel, 'code', r->>'code', 'http_status', r->>'http_status'
      ), d.event_id, d.id);

    else
      update notif_private.deliveries set
        status = 'failed', exhausted = (v_outcome = 'retry'), locked_until = null, http_status = (r->>'http_status')::integer,
        last_error_code = r->>'code', last_error = left(r->>'message', 500), updated_at = now()
        where id = d.id;
      perform notif_private.log('error', 'delivery_failed', jsonb_build_object(
        'channel', d.channel, 'attempts', d.attempts, 'code', r->>'code', 'http_status', r->>'http_status',
        'exhausted', v_outcome = 'retry'
      ), d.event_id, d.id);
    end if;
  end loop;
end;
$$;

-- Nunca se quita el trabajo de la cola mientras quede una entrega abierta:
-- se esconde hasta su próximo reintento.
create or replace function public.notif_worker_finish(p_msg_id bigint, p_event_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next timestamptz;
  v_failed text;
begin
  select min(case when status = 'sending' then coalesce(locked_until, now()) else next_attempt_at end) into v_next
  from notif_private.deliveries
  where event_id = p_event_id and status in ('pending', 'sending', 'retry');

  if v_next is not null then
    perform pgmq.set_vt('notification_jobs', p_msg_id, greatest(5, ceil(extract(epoch from v_next - now())))::integer);
    return 'waiting';
  end if;

  select case
      when count(*) = 0 then null
      when bool_or(exhausted) then 'retries_exhausted'
      else 'permanent_error'
    end into v_failed
  from notif_private.deliveries
  where event_id = p_event_id and status = 'failed';

  if v_failed is not null then
    perform notif_private.to_dead_letter(p_event_id, v_failed);
  else
    update public.notifications
      set dispatch_status = 'processed', dispatched_at = now()
      where event_id = p_event_id and dispatch_status in ('queued', 'processing');
  end if;
  -- Archivado, no borrado: queda como traza hasta el mantenimiento
  perform pgmq.archive('notification_jobs', p_msg_id);
  return 'finished';
end;
$$;

create or replace function public.notif_worker_due_receipts(p_limit integer default 1000)
returns table (delivery_id uuid, ticket_id text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Expo borra los recibos a las 24 h
  update notif_private.deliveries d
    set receipt_state = 'expired', receipt_checked_at = now(), updated_at = now()
    where d.channel = 'expo' and d.status = 'provider_accepted' and d.receipt_state is null
      and d.accepted_at < now() - interval '23 hours';

  return query
    update notif_private.deliveries d
      set receipt_checked_at = now()
      where d.id in (
        select x.id from notif_private.deliveries x
        where x.channel = 'expo' and x.status = 'provider_accepted' and x.receipt_state is null
          and x.expo_ticket_id is not null
          and x.accepted_at < now() - interval '15 minutes' -- recomendación de Expo
          and (x.receipt_checked_at is null or x.receipt_checked_at < now() - interval '5 minutes')
        order by x.accepted_at
        limit p_limit
      )
      returning d.id, d.expo_ticket_id;
end;
$$;

-- results: [{ id, status: 'ok' } | { id, status: 'error', outcome, code, message }]
create or replace function public.notif_worker_report_receipts(p_results jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb;
  d notif_private.deliveries;
begin
  for r in select * from jsonb_array_elements(coalesce(p_results, '[]')) loop
    select * into d from notif_private.deliveries
      where id = (r->>'id')::uuid and status = 'provider_accepted' for update;
    if not found then
      continue;
    end if;

    if r->>'status' = 'ok' then
      update notif_private.deliveries
        set status = 'provider_confirmed', receipt_state = 'ok', confirmed_at = now(), updated_at = now()
        where id = d.id;
      continue;
    end if;

    update notif_private.deliveries set
      receipt_state = 'error', last_error_code = r->>'code', last_error = left(r->>'message', 500), updated_at = now()
      where id = d.id;

    if r->>'outcome' = 'invalid' then
      update notif_private.deliveries set status = 'invalid_device' where id = d.id;
      update public.push_tokens set disabled_at = now(), disabled_reason = r->>'code' where id = d.device_id;
      perform notif_private.log('info', 'device_disabled', jsonb_build_object('channel', 'expo', 'code', r->>'code', 'source', 'receipt'), d.event_id, d.id);
    elsif r->>'outcome' = 'retry' and d.attempts < 12 then
      update notif_private.deliveries
        set status = 'retry', receipt_state = null, expo_ticket_id = null, accepted_at = null,
            next_attempt_at = now() + interval '5 minutes'
        where id = d.id;
      perform pgmq.send('notification_jobs', jsonb_build_object('event_id', d.event_id));
      perform notif_private.log('warn', 'receipt_retry', jsonb_build_object('code', r->>'code'), d.event_id, d.id);
    else
      update notif_private.deliveries set status = 'failed', exhausted = (r->>'outcome' = 'retry') where id = d.id;
      perform notif_private.log('error', 'receipt_failed', jsonb_build_object('code', r->>'code'), d.event_id, d.id);
    end if;
  end loop;
end;
$$;

create or replace function public.notif_worker_log(p_level text, p_kind text, p_detail jsonb default '{}')
returns void
language sql
security definer
set search_path = ''
as $$
  select notif_private.log(p_level, p_kind, p_detail);
$$;

create or replace function public.notif_worker_heartbeat(p_detail jsonb default '{}')
returns void
language sql
security definer
set search_path = ''
as $$
  insert into notif_private.heartbeats (name, last_run_at, detail)
  values ('worker', now(), coalesce(p_detail, '{}'))
  on conflict (name) do update set last_run_at = now(), detail = excluded.detail;
$$;

-- El identificador aleatorio de la entrega autoriza la confirmación: solo pone una marca de tiempo.
create or replace function public.notif_ack_delivery(p_delivery_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update notif_private.deliveries
    set device_confirmed_at = coalesce(device_confirmed_at, now()), updated_at = now()
    where id = p_delivery_id;
$$;

-- 9. Recuperación y alertas -------------------------------------------------

create or replace function notif_private.work_is_due()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from pgmq.q_notification_jobs where vt <= now())
    or exists (
      select 1 from notif_private.deliveries x
      where x.channel = 'expo' and x.status = 'provider_accepted' and x.receipt_state is null
        and x.expo_ticket_id is not null
        and x.accepted_at < now() - interval '15 minutes'
        and (x.receipt_checked_at is null or x.receipt_checked_at < now() - interval '5 minutes')
    );
$$;

-- Tras una caída larga de un proveedor, un trabajo agotado recibe una segunda oportunidad.
create or replace function notif_private.requeue_dead_letters(p_force boolean default false)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  v_event uuid;
  v_count integer := 0;
begin
  for m in select * from pgmq.q_notification_jobs_dlq order by msg_id limit 100 loop
    v_event := (m.message->>'event_id')::uuid;
    if p_force or (
      m.message->>'reason' = 'retries_exhausted'
      and coalesce((m.message->>'requeues')::integer, 0) < 1
      and m.enqueued_at > now() - interval '24 hours'
    ) then
      update notif_private.deliveries
        set status = 'retry', exhausted = false, attempts = 6, next_attempt_at = now(), updated_at = now()
        where event_id = v_event and status = 'failed';
      update public.notifications set dispatch_status = 'processing', dispatched_at = null where event_id = v_event;
      perform pgmq.send('notification_jobs', jsonb_build_object(
        'event_id', v_event, 'requeues', coalesce((m.message->>'requeues')::integer, 0) + 1
      ));
      perform pgmq.archive('notification_jobs_dlq', m.msg_id);
      perform notif_private.log('info', 'dead_letter_requeued', jsonb_build_object('forced', p_force), v_event);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

create or replace function notif_private.raise_alert(p_key text, p_active boolean, p_message text, p_detail jsonb default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a notif_private.alerts;
begin
  if not p_active then
    update notif_private.alerts set resolved_at = now() where key = p_key and resolved_at is null;
    return;
  end if;

  insert into notif_private.alerts (key, detail) values (p_key, coalesce(p_detail, '{}'))
  on conflict (key) do update set
    last_seen_at = now(),
    detail = excluded.detail,
    first_seen_at = case when notif_private.alerts.resolved_at is null then notif_private.alerts.first_seen_at else now() end,
    notified_at = case when notif_private.alerts.resolved_at is null then notif_private.alerts.notified_at else null end,
    resolved_at = null
  returning * into a;

  -- Un aviso a RRHH al abrirse, y un recordatorio al día mientras siga abierta
  if a.notified_at is null or a.notified_at < now() - interval '24 hours' then
    update notif_private.alerts set notified_at = now() where key = p_key;
    perform notif_private.log('error', 'alert', jsonb_build_object('key', p_key, 'message', p_message) || coalesce(p_detail, '{}'));
    perform notif_private.emit(
      notif_private.admin_ids(), 'system',
      '⚠️ Problema en el sistema de avisos', p_message,
      'error', 'system', null,
      'alert:' || p_key || ':' || extract(epoch from now())::bigint::text,
      null
    );
  end if;
end;
$$;

create or replace function notif_private.evaluate_alerts()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_oldest timestamptz;
  v_dlq integer;
  v_worker timestamptz;
  v_failed integer;
  v_ok integer;
  v_config jsonb;
begin
  perform notif_private.raise_alert(
    'worker_not_configured',
    not exists (select 1 from vault.secrets where name = 'notifications_worker_url')
      or not exists (select 1 from vault.secrets where name = 'notifications_worker_secret'),
    'Faltan los secretos del procesador en Vault: los avisos se guardan pero no se envían.'
  );

  select min(enqueued_at) into v_oldest from pgmq.q_notification_jobs where vt <= now();
  perform notif_private.raise_alert(
    'queue_stalled', v_oldest is not null and v_oldest < now() - interval '10 minutes',
    'Hay avisos esperando en la cola desde hace más de 10 minutos.',
    jsonb_build_object('oldest', v_oldest)
  );

  select last_run_at into v_worker from notif_private.heartbeats where name = 'worker';
  perform notif_private.raise_alert(
    'worker_silent',
    notif_private.work_is_due() and (v_worker is null or v_worker < now() - interval '10 minutes'),
    'El procesador de avisos no se ejecuta desde hace más de 10 minutos y hay trabajo pendiente.',
    jsonb_build_object('last_worker_run', v_worker)
  );

  select count(*) into v_dlq from pgmq.q_notification_jobs_dlq;
  perform notif_private.raise_alert(
    'dead_letters', v_dlq > 0,
    'Hay avisos que no se han podido enviar tras agotar los reintentos.',
    jsonb_build_object('count', v_dlq)
  );

  select count(*) filter (where status = 'failed'), count(*) filter (where status in ('provider_accepted', 'provider_confirmed'))
    into v_failed, v_ok
    from notif_private.deliveries where updated_at > now() - interval '1 hour';
  perform notif_private.raise_alert(
    'high_failure_rate', v_failed >= 5 and v_failed > v_ok,
    'Más de la mitad de los envíos de la última hora han fallado.',
    jsonb_build_object('failed', v_failed, 'accepted', v_ok)
  );

  -- El aviso se pierde aunque la acción del usuario siga adelante: tiene que saberse
  perform notif_private.raise_alert(
    'emit_failed',
    exists (select 1 from notif_private.ops_log where kind = 'emit_failed' and created_at > now() - interval '1 hour'),
    'No se ha podido crear algún aviso. Revisa el registro del sistema de avisos.'
  );

  select detail into v_config from notif_private.ops_log
    where kind = 'provider_config' and created_at > now() - interval '1 hour'
    order by id desc limit 1;
  perform notif_private.raise_alert(
    'provider_config', v_config is not null,
    'Un proveedor de push rechaza las credenciales configuradas (VAPID, FCM o token de Expo).',
    coalesce(v_config, '{}')
  );
end;
$$;

create or replace function notif_private.recovery_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stuck integer;
  v_orphans integer := 0;
  r record;
  v_requeued integer := 0;
  v_due boolean;
begin
  -- Un worker murió con la entrega reservada (timeout, despliegue, reinicio)
  with s as (
    update notif_private.deliveries
      set status = 'retry', next_attempt_at = now() + interval '30 seconds', locked_until = null,
          last_error_code = 'worker_lost', updated_at = now()
      where status = 'sending' and locked_until < now()
      returning id
  )
  select count(*) into v_stuck from s;
  if v_stuck > 0 then
    perform notif_private.log('warn', 'stuck_deliveries_released', jsonb_build_object('count', v_stuck));
  end if;

  -- El trabajo se creó en la misma transacción, así que esto solo cubre una purga manual
  -- de la cola: la fila manda, y si le falta trabajo se le vuelve a crear.
  for r in
    select distinct n.event_id
    from public.notifications n
    left join notif_private.deliveries d on d.event_id = n.event_id
    where n.created_at > now() - interval '24 hours'
      and n.created_at < now() - interval '5 minutes'
      and (n.dispatch_status = 'queued' or d.status in ('pending', 'retry'))
      and not exists (select 1 from pgmq.q_notification_jobs q where q.message->>'event_id' = n.event_id::text)
    limit 100
  loop
    perform pgmq.send('notification_jobs', jsonb_build_object('event_id', r.event_id));
    v_orphans := v_orphans + 1;
  end loop;
  if v_orphans > 0 then
    perform notif_private.log('warn', 'orphan_jobs_recreated', jsonb_build_object('count', v_orphans));
  end if;

  if extract(minute from now())::integer = 0 then
    v_requeued := notif_private.requeue_dead_letters();
  end if;

  if extract(minute from now())::integer % 5 = 0 then
    perform notif_private.evaluate_alerts();
  end if;

  -- Sin nada pendiente no se llama a la Edge Function: no consume invocaciones
  v_due := notif_private.work_is_due();
  if v_due then
    perform notif_private.wake_worker('cron');
  end if;

  insert into notif_private.heartbeats (name, last_run_at, detail)
  values ('recovery', now(), jsonb_build_object(
    'stuck_released', v_stuck, 'orphans_recreated', v_orphans, 'dead_letters_requeued', v_requeued, 'woke_worker', v_due
  ))
  on conflict (name) do update set last_run_at = now(), detail = excluded.detail;
end;
$$;

create or replace function notif_private.maintenance()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
begin
  delete from notif_private.ops_log where created_at < now() - interval '30 days';
  delete from notif_private.deliveries
    where created_at < now() - interval '90 days' and status not in ('pending', 'sending', 'retry');
  delete from pgmq.a_notification_jobs where archived_at < now() - interval '30 days';
  delete from pgmq.a_notification_jobs_dlq where archived_at < now() - interval '90 days';
  delete from notif_private.alerts where resolved_at < now() - interval '30 days';

  -- La cola muerta no crece sin fin: lo más antiguo pasa al archivo y sigue consultable
  for m in select msg_id from pgmq.q_notification_jobs_dlq where enqueued_at < now() - interval '7 days' loop
    perform pgmq.archive('notification_jobs_dlq', m.msg_id);
  end loop;

  delete from cron.job_run_details where end_time < now() - interval '14 days';
end;
$$;

-- Lectura para administradores y para la supervisión
create or replace function public.notification_system_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not (public.is_admin() or (select auth.role()) = 'service_role') then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'queue', (select jsonb_build_object(
      'total', count(*),
      'ready', count(*) filter (where vt <= now()),
      'in_flight_or_waiting', count(*) filter (where vt > now()),
      'blocked', count(*) filter (where read_ct >= 3),
      'oldest_at', min(enqueued_at)
    ) from pgmq.q_notification_jobs),
    'dead_letters', (select count(*) from pgmq.q_notification_jobs_dlq),
    'notifications_24h', (select coalesce(jsonb_object_agg(dispatch_status, c), '{}') from (
      select dispatch_status, count(*) c from public.notifications
      where created_at > now() - interval '24 hours' group by 1) x),
    'deliveries_24h', (select coalesce(jsonb_object_agg(status, c), '{}') from (
      select status, count(*) c from notif_private.deliveries
      where created_at > now() - interval '24 hours' group by 1) x),
    'retries_24h', (select coalesce(sum(greatest(attempts - 1, 0)), 0) from notif_private.deliveries
      where created_at > now() - interval '24 hours'),
    'device_confirmed_24h', (select count(*) from notif_private.deliveries
      where device_confirmed_at > now() - interval '24 hours'),
    'expo_receipts_pending', (select count(*) from notif_private.deliveries
      where channel = 'expo' and status = 'provider_accepted' and receipt_state is null),
    'devices', jsonb_build_object(
      'expo_active', (select count(*) from public.push_tokens where disabled_at is null),
      'expo_disabled', (select count(*) from public.push_tokens where disabled_at is not null),
      'web_active', (select count(*) from public.web_push_subscriptions where disabled_at is null),
      'web_disabled', (select count(*) from public.web_push_subscriptions where disabled_at is not null)
    ),
    'last_worker_run', (select last_run_at from notif_private.heartbeats where name = 'worker'),
    'last_worker_detail', (select detail from notif_private.heartbeats where name = 'worker'),
    'last_recovery_run', (select last_run_at from notif_private.heartbeats where name = 'recovery'),
    'open_alerts', (select coalesce(jsonb_agg(jsonb_build_object('key', key, 'since', first_seen_at, 'detail', detail)), '[]')
      from notif_private.alerts where resolved_at is null),
    'recent_errors', (select coalesce(jsonb_agg(x), '[]') from (
      select created_at, kind, detail from notif_private.ops_log
      where level = 'error' order by id desc limit 10) x)
  ) into v_result;
  return v_result;
end;
$$;

-- 10. Permisos --------------------------------------------------------------

revoke all on all tables in schema notif_private from public, anon, authenticated, service_role;
revoke all on all routines in schema notif_private from public, anon, authenticated, service_role;

revoke all on function public.notif_worker_claim(integer, integer) from public, anon, authenticated;
revoke all on function public.notif_worker_prepare(uuid, integer) from public, anon, authenticated;
revoke all on function public.notif_worker_report(jsonb, integer) from public, anon, authenticated;
revoke all on function public.notif_worker_finish(bigint, uuid) from public, anon, authenticated;
revoke all on function public.notif_worker_due_receipts(integer) from public, anon, authenticated;
revoke all on function public.notif_worker_report_receipts(jsonb) from public, anon, authenticated;
revoke all on function public.notif_worker_log(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.notif_worker_heartbeat(jsonb) from public, anon, authenticated;
grant execute on function public.notif_worker_claim(integer, integer) to service_role;
grant execute on function public.notif_worker_prepare(uuid, integer) to service_role;
grant execute on function public.notif_worker_report(jsonb, integer) to service_role;
grant execute on function public.notif_worker_finish(bigint, uuid) to service_role;
grant execute on function public.notif_worker_due_receipts(integer) to service_role;
grant execute on function public.notif_worker_report_receipts(jsonb) to service_role;
grant execute on function public.notif_worker_log(text, text, jsonb) to service_role;
grant execute on function public.notif_worker_heartbeat(jsonb) to service_role;

revoke all on function public.register_push_token(uuid, text, text) from public, anon;
revoke all on function public.register_web_push(uuid, text, text, text, text) from public, anon;
grant execute on function public.register_push_token(uuid, text, text) to authenticated;
grant execute on function public.register_web_push(uuid, text, text, text, text) to authenticated;

revoke all on function public.notify_office_return(text, text) from public, anon;
grant execute on function public.notify_office_return(text, text) to authenticated;

revoke all on function public.notification_system_health() from public, anon;
grant execute on function public.notification_system_health() to authenticated, service_role;

-- Sin sesión a propósito: las llama el service worker y las autoriza el valor secreto que reciben
revoke all on function public.notif_ack_delivery(uuid) from public;
revoke all on function public.notif_rotate_web_push(text, text, text, text) from public;
grant execute on function public.notif_ack_delivery(uuid) to anon, authenticated;
grant execute on function public.notif_rotate_web_push(text, text, text, text) to anon, authenticated;

-- 11. Tareas programadas ----------------------------------------------------

-- Cada minuto es el mínimo de cron clásico; pg_cron admite segundos si hiciera falta.
select cron.schedule('notifications-recovery', '* * * * *', 'select notif_private.recovery_tick()');
select cron.schedule('notifications-maintenance', '17 3 * * *', 'select notif_private.maintenance()');

notify pgrst, 'reload schema';
