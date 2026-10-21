-- ================================================================
-- NOTIFICACIONES POR EMAIL
-- Ejecutar en Supabase Dashboard -> SQL Editor (o `supabase db push`).
--
-- Aditivo: reutiliza el trigger `on_notification_insert_push`. La Edge
-- Function `send-push` ahora también envía cada notificación por email
-- al correo del perfil (profiles.email), a empleados y administradores.
--
--   * profiles.email_notifications: el usuario puede desactivar los
--     emails desde Ajustes. Activado por defecto para todos.
--
-- Requisitos (secretos de la Edge Function):
--   supabase secrets set RESEND_API_KEY=re_xxx \
--     EMAIL_FROM="Margube Intranet <avisos@tu-dominio.com>" \
--     APP_URL=https://tu-intranet.com
-- El dominio de EMAIL_FROM debe estar verificado en Resend.
-- ================================================================

alter table public.profiles
  add column if not exists email_notifications boolean not null default true;

-- La API (PostgREST) ve las columnas nuevas sin esperar.
notify pgrst, 'reload schema';
