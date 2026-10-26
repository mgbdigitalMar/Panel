-- ================================================================
-- DNI PRIVADO (después de 20261026120000_security_hardening.sql)
-- Ejecutar en Supabase Dashboard -> SQL Editor (o `supabase db push`).
--
-- El DNI se guardaba en profiles.phone, que lee toda la plantilla (directorio).
-- Ahora vive en profile_private, que solo leen la propia persona y los admins.
--   1. Crea profile_private (id = profiles.id, dni) con RLS.
--   2. Copia los DNI de profiles.phone y vacía esa columna.
--   3. Un DNI escrito en profiles.phone (versiones anteriores de la app, o la
--      ficha de RRHH) pasa solo a profile_private. Un valor vacío no borra el
--      DNI guardado: una ficha antigua que ya no lo ve no lo puede perder.
--
-- Compatible con la web y la app anteriores: siguen funcionando, pero solo
-- verán el DNI cuando se publique la versión nueva.
-- ================================================================

create table if not exists public.profile_private (
  -- Diferida: la ficha y su DNI se pueden crear en la misma operación
  id         uuid primary key references public.profiles(id) on delete cascade deferrable initially deferred,
  dni        text,
  updated_at timestamptz not null default now()
);

alter table public.profile_private enable row level security;
revoke all on public.profile_private from anon;
grant select, insert, update, delete on public.profile_private to authenticated;

drop policy if exists profile_private_select on public.profile_private;
drop policy if exists profile_private_write on public.profile_private;
create policy profile_private_select on public.profile_private for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profile_private_write on public.profile_private for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 2. Datos actuales ----------------------------------------------------------

insert into public.profile_private (id, dni)
select id, trim(phone) from public.profiles
where coalesce(trim(phone), '') <> ''
on conflict (id) do update set dni = excluded.dni, updated_at = now();

update public.profiles set phone = null where phone is not null;

-- 3. Escrituras en profiles.phone ----------------------------------------------

create or replace function public.move_dni_to_private()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(trim(new.phone), '') <> '' then
    insert into public.profile_private (id, dni) values (new.id, trim(new.phone))
    on conflict (id) do update set dni = excluded.dni, updated_at = now();
  end if;
  new.phone := null;
  return new;
end;
$$;

drop trigger if exists profiles_move_dni on public.profiles;
create trigger profiles_move_dni
  before insert or update of phone on public.profiles
  for each row execute function public.move_dni_to_private();

notify pgrst, 'reload schema';
