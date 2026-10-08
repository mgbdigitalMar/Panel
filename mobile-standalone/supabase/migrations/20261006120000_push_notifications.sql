-- ================================================================
-- PUSH NOTIFICATIONS (APP iOS / Android)
-- Ejecutar en Supabase Dashboard -> SQL Editor (o `supabase db push`).
--
-- Aditivo y compatible con la web:
--   * Crea la tabla push_tokens (nueva, la web no la usa).
--   * Añade un trigger AFTER INSERT en notifications que llama a la
--     Edge Function `send-push`. No modifica filas ni columnas existentes.
--   * La web sigue insertando en notifications igual que hoy; el push
--     se genera en el backend, venga la notificación de la WEB o de la APP.
--
-- Requisitos previos:
--   1. Desplegar la Edge Function:  supabase functions deploy send-push --no-verify-jwt
--   2. Guardar la service role key en Vault con el nombre
--      'supabase_service_role_key' (Dashboard -> Project Settings -> Vault).
-- ================================================================

create extension if not exists pg_net with schema extensions;

-- 1. Tokens de dispositivo -------------------------------------------------
create table if not exists public.push_tokens (
  id          bigint generated always as identity primary key,
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  token       text        not null unique,
  platform    text        not null check (platform in ('ios', 'android')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists push_tokens_user_id_idx on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

-- Sin políticas: ningún cliente lee ni escribe la tabla directamente.
-- La app usa las funciones RPC de abajo y la Edge Function usa la service role.
revoke all on public.push_tokens from anon, authenticated;

-- NOTA DE SEGURIDAD: la intranet todavía no usa Supabase Auth (auth.uid() es
-- null para todos los clientes), así que estas funciones no pueden comprobar
-- que el llamante sea p_user_id. El riesgo es limitado porque el push es
-- siempre genérico y no revela contenido. Tras migrar a Supabase Auth,
-- sustituir p_user_id por auth.uid() dentro de las funciones.
create or replace function public.register_push_token(p_user_id uuid, p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token is null or p_token !~ '^Expo(nent)?PushToken\[.+\]$' then
    raise exception 'invalid push token';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'unknown user';
  end if;

  insert into public.push_tokens (user_id, token, platform)
  values (p_user_id, p_token, p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        updated_at = now();
end;
$$;

-- Se llama al cerrar sesión para que el dispositivo deje de recibir pushes.
create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_tokens where token = p_token;
$$;

grant execute on function public.register_push_token(uuid, text, text) to anon, authenticated;
grant execute on function public.unregister_push_token(text) to anon, authenticated;

-- 2. Trigger: cada notificación nueva genera un push ------------------------
create or replace function public.notify_user_by_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  service_key text;
begin
  select decrypted_secret into service_key
  from vault.decrypted_secrets
  where name = 'supabase_service_role_key'
  limit 1;

  if service_key is null then
    raise warning 'notify_user_by_push: falta el secreto supabase_service_role_key en Vault';
    return new;
  end if;

  -- Solo se envían identificadores: la Edge Function nunca reenvía título ni cuerpo.
  perform net.http_post(
    url     := 'https://exaggikhxozcfsifwxeq.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body    := jsonb_build_object('notification_id', new.id, 'user_id', new.user_id)
  );
  return new;
exception when others then
  -- Un fallo del push nunca debe impedir que la notificación se guarde.
  raise warning 'notify_user_by_push: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists on_notification_insert_push on public.notifications;
create trigger on_notification_insert_push
  after insert on public.notifications
  for each row execute function public.notify_user_by_push();
