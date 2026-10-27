-- ================================================================
-- FIRMA DE LAS NORMAS INTERNAS (después de 20261027120000_private_dni.sql)
-- Ejecutar en Supabase Dashboard -> SQL Editor (o `supabase db push`).
--
-- Hasta ahora aceptar las normas solo ponía profiles.policy_accepted = true.
-- Ahora cada persona las firma (nombre + firma dibujada) y queda registrado:
--   1. policy_signatures guarda cada firma: quién, nombre escrito, trazos de
--      la firma, documento firmado, dispositivo y fecha del servidor. No se
--      puede modificar ni borrar desde la web o la app (solo se borra con la
--      ficha del empleado).
--   2. sign_internal_policy() es la única forma de firmar: valida la firma,
--      la guarda y marca las normas como aceptadas.
--   3. Un empleado ya no puede poner policy_accepted = true por su cuenta
--      (solo firmando). RRHH sí puede marcarlas a mano (p. ej. firma en papel)
--      o pedir que se vuelva a firmar.
--   4. IMPORTANTE: quien no tiene firma digital vuelve a tener las normas
--      pendientes, también la plantilla actual: al entrar tendrá que firmar.
--
-- La web y la app anteriores no pueden firmar: publicar las versiones nuevas
-- a la vez que se ejecuta esta migración.
-- ================================================================

create table if not exists public.policy_signatures (
  id             bigint generated always as identity primary key,
  user_id        uuid        not null references public.profiles(id) on delete cascade,
  signer_name    text        not null,
  -- Trazos de la firma: [[[x, y], ...], ...] en un recuadro de 1000 x 400
  strokes        jsonb       not null,
  document_title text        not null,
  document_url   text,
  platform       text        check (platform in ('web', 'ios', 'android')),
  user_agent     text,
  signed_at      timestamptz not null default now()
);

create index if not exists policy_signatures_user_idx on public.policy_signatures (user_id, signed_at desc);

alter table public.policy_signatures enable row level security;
revoke all on public.policy_signatures from anon, authenticated;
-- Solo lectura desde los clientes: se firma con sign_internal_policy()
grant select on public.policy_signatures to authenticated;

drop policy if exists policy_signatures_select on public.policy_signatures;
create policy policy_signatures_select on public.policy_signatures for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- 1. Firmar ------------------------------------------------------------------

create or replace function public.sign_internal_policy(
  p_signer_name text,
  p_strokes jsonb,
  p_document_title text,
  p_document_url text default null,
  p_platform text default null,
  p_user_agent text default null
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name   text := trim(coalesce(p_signer_name, ''));
  v_stroke jsonb;
  v_point  jsonb;
  v_points integer := 0;
  v_min_x  numeric := 1000;
  v_max_x  numeric := 0;
  v_at     timestamptz;
begin
  if not public.is_employee() then
    raise exception 'Tu cuenta no tiene ficha de empleado' using errcode = '42501';
  end if;
  if length(v_name) < 3 or length(v_name) > 120 then
    raise exception 'Escribe tu nombre completo para firmar';
  end if;
  if jsonb_typeof(p_strokes) <> 'array' or jsonb_array_length(p_strokes) > 300
     or pg_column_size(p_strokes) > 300000 then
    raise exception 'La firma no es válida. Bórrala y vuelve a firmar.';
  end if;

  for v_stroke in select * from jsonb_array_elements(p_strokes) loop
    if jsonb_typeof(v_stroke) <> 'array' then
      raise exception 'La firma no es válida. Bórrala y vuelve a firmar.';
    end if;
    for v_point in select * from jsonb_array_elements(v_stroke) loop
      if jsonb_typeof(v_point) <> 'array' or jsonb_array_length(v_point) <> 2
         or jsonb_typeof(v_point->0) <> 'number' or jsonb_typeof(v_point->1) <> 'number'
         or (v_point->>0)::numeric not between 0 and 1000
         or (v_point->>1)::numeric not between 0 and 400 then
        raise exception 'La firma no es válida. Bórrala y vuelve a firmar.';
      end if;
      v_points := v_points + 1;
      v_min_x := least(v_min_x, (v_point->>0)::numeric);
      v_max_x := greatest(v_max_x, (v_point->>0)::numeric);
    end loop;
  end loop;

  -- Un punto o una raya mínima no es una firma (mismo criterio que shared/services/policy.js)
  if v_points < 10 or v_max_x - v_min_x < 60 then
    raise exception 'La firma es demasiado corta. Firma como lo harías en papel.';
  end if;

  insert into public.policy_signatures (user_id, signer_name, strokes, document_title, document_url, platform, user_agent)
  values (
    auth.uid(), v_name, p_strokes,
    left(coalesce(nullif(trim(p_document_title), ''), 'Procedimiento normas internas 2026'), 200),
    left(p_document_url, 2000),
    case when p_platform in ('web', 'ios', 'android') then p_platform end,
    left(p_user_agent, 400)
  )
  returning signed_at into v_at;

  -- guard_profile_update deja pasar este cambio solo durante la firma
  perform set_config('margube.policy_signing', 'on', true);
  update public.profiles set policy_accepted = true where id = auth.uid();
  perform set_config('margube.policy_signing', 'off', true);

  return v_at;
end;
$$;

revoke all on function public.sign_internal_policy(text, jsonb, text, text, text, text) from public, anon;
grant execute on function public.sign_internal_policy(text, jsonb, text, text, text, text) to authenticated;

-- 2. Ficha propia: policy_accepted ya no lo cambia el empleado ------------------

create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Lo que escriben en la ficha propia la web y la app (setCurrentUser,
  -- ChangePassword, changeWorkMode y la sincronización del horario)
  v_own text[] := array['work_mode', 'first_login', 'telework_applied_on', 'updated_at'];
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  -- Aceptar las normas: solo firmando (sign_internal_policy)
  if current_setting('margube.policy_signing', true) = 'on' then
    v_own := v_own || array['policy_accepted'];
  end if;
  if (to_jsonb(new) - v_own) is distinct from (to_jsonb(old) - v_own)
     or (new.first_login is distinct from old.first_login and new.first_login is not false) then
    raise exception 'No tienes permiso para cambiar estos datos' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- 3. La plantilla actual también firma -------------------------------------------

update public.profiles p
set policy_accepted = false
where p.policy_accepted is distinct from false
  and not exists (select 1 from public.policy_signatures s where s.user_id = p.id);

notify pgrst, 'reload schema';
