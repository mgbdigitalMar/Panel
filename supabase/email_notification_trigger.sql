-- ================================================================
-- PASO ÚNICO: Ejecutar en Supabase Dashboard → SQL Editor
--
-- Crea un trigger que llama a la Edge Function
-- "send-email-notification" en cada INSERT en `notifications`.
--
-- REQUISITO: La Edge Function debe estar desplegada primero.
-- ================================================================

-- 1. Habilitar pg_net (viene incluida en todos los proyectos Supabase)
create extension if not exists pg_net with schema extensions;

-- 2. Función trigger (security definer = corre como superuser, ignora RLS)
create or replace function notify_user_by_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Llamada HTTP asíncrona a la Edge Function
  -- La autenticación con RLS la gestiona la propia Edge Function
  -- usando el SUPABASE_SERVICE_ROLE_KEY que Supabase inyecta automáticamente
  perform net.http_post(
    url     := 'https://exaggikhxozcfsifwxeq.supabase.co/functions/v1/send-email-notification',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'supabase_service_role_key'
        limit 1
      )
    ),
    body    := jsonb_build_object(
      'type',   TG_OP,
      'table',  TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', row_to_json(NEW)::jsonb
    )
  );

  return NEW;
end;
$$;

-- Alternativa si vault no está disponible (usa la clave directamente)
-- Reemplaza la función de arriba con esta si ves errores de vault:
--
-- create or replace function notify_user_by_email()
-- returns trigger language plpgsql security definer set search_path = public as $$
-- begin
--   perform net.http_post(
--     url     := 'https://exaggikhxozcfsifwxeq.supabase.co/functions/v1/send-email-notification',
--     headers := '{"Content-Type":"application/json"}'::jsonb,
--     body    := jsonb_build_object('type',TG_OP,'table',TG_TABLE_NAME,'schema',TG_TABLE_SCHEMA,'record',row_to_json(NEW)::jsonb)
--   );
--   return NEW;
-- end; $$;

-- 3. Crear el trigger
drop trigger if exists on_notification_insert on public.notifications;

create trigger on_notification_insert
  after insert on public.notifications
  for each row
  execute function notify_user_by_email();

-- 4. Verificar que se creó correctamente
select trigger_name, event_manipulation, event_object_table
from information_schema.triggers
where trigger_name = 'on_notification_insert';
