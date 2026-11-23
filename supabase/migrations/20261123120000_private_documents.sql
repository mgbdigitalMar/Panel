-- ================================================================
-- DOCUMENTOS PRIVADOS (después de 20261104131241_notification_system.sql)
-- Ejecutar en Supabase Dashboard -> SQL Editor (o `supabase db push`),
-- primero en staging. Publicar a la vez la web y una versión nueva de la app.
--
-- El bucket `documents` (nóminas, contratos, justificantes, normas internas)
-- era público: cualquiera con el enlace de un archivo lo abría sin sesión, y
-- las políticas de storage.objects no se aplican a las URL públicas.
--   1. El bucket pasa a privado y limita cada archivo a 15 MB (el mismo
--      límite que la web y la app).
--   2. Los file_url guardados pasan de /object/public/ a /object/authenticated/:
--      la misma ruta, que ya solo funciona con sesión. La web y la app firman
--      cada archivo para quien lo puede ver (shared/services/storageFiles.js).
--   3. Un archivo solo se puede leer a través de una fila que lo referencia si
--      quien creó esa fila es también quien subió el archivo (o un admin).
--      Antes bastaba con crear un documento o un día de asuntos propios que
--      apuntara al archivo de otra persona para poder descargarlo.
--   4. Las subidas van a la carpeta docs/ (la única que usan la web y la app).
--
-- Aditivo: no borra archivos ni filas. Las versiones anteriores de la web y la
-- app dejan de poder abrir archivos (usaban la URL pública).
--
-- Vuelta atrás (solo en caso de emergencia: vuelve a exponer los archivos):
--   update storage.buckets set public = true where id = 'documents';
--   update public.documents set file_url = replace(file_url,
--     '/storage/v1/object/authenticated/documents/', '/storage/v1/object/public/documents/')
--     where file_url like '%/storage/v1/object/authenticated/documents/%';
--   (y lo mismo en public.personal_days)
-- ================================================================

begin;

-- 1. Bucket privado ------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 15728640)
on conflict (id) do update set public = false, file_size_limit = 15728640;

-- 2. Referencias guardadas -------------------------------------------------------
-- Sin sesión (SQL Editor / db push) los triggers de guarda dejan pasar la
-- actualización; cambiar file_url no genera avisos (solo status e inserciones).

update public.documents
set file_url = replace(file_url, '/storage/v1/object/public/documents/', '/storage/v1/object/authenticated/documents/')
where file_url like '%/storage/v1/object/public/documents/%';

update public.personal_days
set file_url = replace(file_url, '/storage/v1/object/public/documents/', '/storage/v1/object/authenticated/documents/')
where file_url like '%/storage/v1/object/public/documents/%';

-- 3. Lectura de archivos -----------------------------------------------------------
-- Las subconsultas aplican el RLS de documents y personal_days: "una fila que
-- puedo ver lo referencia" sigue siendo lo que el usuario ya ve. Además el
-- archivo tiene que ser de quien creó la fila. owner_id es null en archivos
-- subidos antes del login seguro (con la clave pública): esos se mantienen.

drop policy if exists documents_files_select on storage.objects;
create policy documents_files_select on storage.objects for select to authenticated using (
  bucket_id = 'documents' and public.is_employee() and (
    owner_id = auth.uid()::text
    or public.is_admin()
    or exists (
      select 1 from public.documents d
      where position(objects.name in d.file_url) > 0
        and (
          objects.owner_id is null
          or objects.owner_id = d.sender_id::text
          or exists (select 1 from public.profiles a where a.id = d.sender_id and a.role = 'admin')
        )
    )
    or exists (
      select 1 from public.personal_days p
      where position(objects.name in p.file_url) > 0
        and (objects.owner_id is null or objects.owner_id = p.employee_id::text)
    )
  )
);

-- 4. Subidas -------------------------------------------------------------------------

drop policy if exists documents_files_insert on storage.objects;
create policy documents_files_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and public.is_employee()
    and (storage.foldername(name))[1] = 'docs'
  );

commit;
