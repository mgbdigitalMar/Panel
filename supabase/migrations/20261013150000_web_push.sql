-- ================================================================
-- WEB PUSH (navegadores: Chrome, Edge, Firefox, Brave, Safari 16.4+)
-- Ejecutar en Supabase Dashboard -> SQL Editor (o `supabase db push`).
--
-- Aditivo: reutiliza el trigger `on_notification_insert_push` de la
-- migración 20261006120000_push_notifications.sql. La Edge Function
-- `send-push` ahora envía a la app (Expo) y también a los navegadores
-- registrados aquí.
-- ================================================================

create table if not exists public.web_push_subscriptions (
  id          bigint generated always as identity primary key,
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  endpoint    text        not null unique,
  p256dh      text        not null,
  auth        text        not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists web_push_subscriptions_user_id_idx on public.web_push_subscriptions(user_id);

alter table public.web_push_subscriptions enable row level security;

-- Sin políticas: los navegadores solo usan las RPC de abajo y la Edge
-- Function lee la tabla con la service role.
revoke all on public.web_push_subscriptions from anon, authenticated;

-- NOTA DE SEGURIDAD: igual que register_push_token, mientras la intranet no
-- use Supabase Auth no se puede comprobar que el llamante sea p_user_id.
-- El push solo lleva un id opaco; el contenido se lee después con la clave
-- pública, igual que hace la web. Tras migrar a Supabase Auth, usar auth.uid().
create or replace function public.register_web_push(
  p_user_id uuid, p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_endpoint is null or p_endpoint !~ '^https://' then
    raise exception 'invalid endpoint';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'unknown user';
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

-- Al cerrar sesión o desactivar las alertas en Ajustes.
create or replace function public.unregister_web_push(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.web_push_subscriptions where endpoint = p_endpoint;
$$;

grant execute on function public.register_web_push(uuid, text, text, text, text) to anon, authenticated;
grant execute on function public.unregister_web_push(text) to anon, authenticated;
