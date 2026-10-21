-- ================================================================
-- DÍAS DE TELETRABAJO FIJOS (horario semanal por empleado)
-- Ejecutar en Supabase Dashboard -> SQL Editor (o `supabase db push`).
-- Requiere 20261020120000_work_mode_return.sql (requests.returned_at).
--
-- Aditivo y compatible con versiones anteriores de la web y la app:
--   * profiles.telework_days: días de la semana (ISO, 1 = lunes … 5 =
--     viernes) en los que el empleado teletrabaja. Lo fija el admin.
--   * profiles.telework_applied_on: último día en que se aplicó el
--     horario. Se aplica una vez al día, así que un cambio manual del modo
--     ese mismo día se respeta.
--   * apply_telework_schedules(): al empezar el día (hora de Madrid) pone
--     work_mode = 'remoto' en días de teletrabajo y 'Office' en el resto.
--     Una solicitud aprobada de remoto / externo que cubra el día manda.
--     La misma regla está en shared/services/workMode.js
--     (teleworkScheduleUpdate), que la sesión del empleado usa de respaldo.
--   * pg_cron la ejecuta cada hora; solo actúa la primera vez de cada día.
-- ================================================================

alter table public.profiles
  add column if not exists telework_days smallint[] not null default '{}',
  add column if not exists telework_applied_on date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_telework_days_check') then
    alter table public.profiles
      add constraint profiles_telework_days_check check (telework_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]);
  end if;
end $$;

create or replace function public.apply_telework_schedules()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  today   date := (now() at time zone 'Europe/Madrid')::date;
  weekday smallint := extract(isodow from today)::smallint;
  changed integer;
begin
  with due as (
    select p.id,
           (select case r.type when 'remoto' then 'remoto' else 'externo' end
              from public.requests r
             where r.employee_id = p.id
               and r.status = 'approved'
               and r.type in ('remoto', 'external')
               and today between r.start_date and r.end_date
               and r.returned_at is null
             order by r.start_date desc
             limit 1) as request_mode
      from public.profiles p
     where cardinality(p.telework_days) > 0
       and p.telework_applied_on is distinct from today
  )
  update public.profiles p
     set work_mode = coalesce(
           due.request_mode,
           case when weekday = any(p.telework_days) then 'remoto' else 'Office' end
         )::work_mode,  -- profiles.work_mode es el enum work_mode
         telework_applied_on = today
    from due
   where p.id = due.id;

  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke all on function public.apply_telework_schedules() from public, anon, authenticated;

create extension if not exists pg_cron;

-- Cada hora en el minuto 5: la primera ejecución tras la medianoche de
-- Madrid (00:05) aplica el día; el resto no encuentran nada pendiente.
select cron.schedule(
  'apply-telework-schedules',
  '5 * * * *',
  $$select public.apply_telework_schedules()$$
);

-- Aplicar ya el día de hoy a quien tenga horario.
select public.apply_telework_schedules();

-- La API (PostgREST) ve las columnas nuevas sin esperar.
notify pgrst, 'reload schema';
