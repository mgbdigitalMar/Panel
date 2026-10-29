-- ================================================================
-- SALAS Y VEHÍCULOS NO DISPONIBLES (después de 20261027130000_policy_signatures.sql)
-- Ejecutar en Supabase Dashboard -> SQL Editor (o `supabase db push`).
--
-- RRHH puede marcar una sala o un vehículo como no disponible
-- (rooms.is_active / vehicles.is_active = false, "Disponible para reservas"
-- en la app y en Administración de la web). La web y la app ya no los
-- ofrecen a los empleados; esta migración lo comprueba también en el
-- servidor, para que no se puedan reservar llamando a la API directamente.
--
-- Aditivo y compatible con la web y la app actuales:
--   * No cambia tablas ni datos. Las reservas ya hechas se conservan.
--   * Los administradores sí pueden reservar un recurso oculto.
--   * Si rooms / vehicles no tuvieran la columna is_active, no hace nada
--     (se lee con to_jsonb, sin nombrar la columna).
-- ================================================================

create or replace function public.check_reservation_resource_active()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active text;
begin
  if auth.uid() is null or public.is_admin() then return new; end if;

  if new.room_id is not null then
    select to_jsonb(r)->>'is_active' into v_active from public.rooms r where r.id = new.room_id;
  elsif new.vehicle_id is not null then
    select to_jsonb(v)->>'is_active' into v_active from public.vehicles v where v.id = new.vehicle_id;
  end if;

  if v_active = 'false' then
    raise exception 'Este recurso no está disponible para reservas. Elige otra sala u otro vehículo.';
  end if;
  return new;
end;
$$;

drop trigger if exists reservations_resource_active on public.reservations;
create trigger reservations_resource_active
  before insert or update of room_id, vehicle_id on public.reservations
  for each row execute function public.check_reservation_resource_active();

notify pgrst, 'reload schema';
