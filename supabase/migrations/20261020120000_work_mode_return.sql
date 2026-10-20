-- ================================================================
-- MODO DE TRABAJO: vuelta anticipada a la oficina
-- Ejecutar en Supabase Dashboard -> SQL Editor (o `supabase db push`).
--
-- Aditivo y compatible con versiones anteriores de la web y la app:
--   * requests.returned_at: el empleado volvió a la oficina antes de que
--     terminara su solicitud aprobada de remoto / trabajo externo. Mientras
--     esté informada, la solicitud no vuelve a poner su perfil en remoto
--     (ver shared/services/workMode.js).
--   * Asegura que profiles, requests y notifications emiten eventos de
--     Realtime: el perfil se actualiza en vivo cuando el admin aprueba.
-- ================================================================

alter table public.requests
  add column if not exists returned_at timestamptz;

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'requests', 'notifications'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
