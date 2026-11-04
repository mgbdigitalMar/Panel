-- Esquema base solo para pruebas locales. Las tablas originales de Margube se crearon a mano en
-- producción y no están en supabase/migrations, así que la cadena de migraciones no arranca sin
-- esto. Se deduce de lo que usan las migraciones y shared/services: no sustituye a producción.
-- `:id_type` lo sustituye el runner para comprobar que el sistema no depende del tipo real de id.

create type public.work_mode as enum ('Office', 'remoto', 'externo');
create type public.reservation_status as enum ('pending', 'confirmed', 'cancelled');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text,
  name text,
  role text not null default 'employee',
  department text,
  position text,
  phone text,
  birthdate date,
  avatar_initials text,
  work_mode public.work_mode not null default 'Office',
  policy_accepted boolean default false,
  first_login boolean default false,
  password_hash text,
  updated_at timestamptz default now()
);

create table public.rooms (
  id bigint generated always as identity primary key,
  name text, capacity integer, floor integer, equipment text[], is_active boolean default true
);

create table public.vehicles (
  id bigint generated always as identity primary key,
  plate text, model text, year integer, type text, is_active boolean default true
);

create table public.reservations (
  id bigint generated always as identity primary key,
  employee_id uuid references public.profiles(id) on delete cascade,
  type text not null,
  room_id bigint references public.rooms(id),
  vehicle_id bigint references public.vehicles(id),
  date date not null,
  time_start time not null,
  time_end time not null,
  purpose text,
  status public.reservation_status not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.profiles(id) on delete cascade,
  type text not null,
  status text not null default 'pending',
  reason text,
  start_date date,
  end_date date,
  days integer generated always as (end_date - start_date) stored,
  item text,
  amount numeric,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

create table public.personal_days (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.profiles(id) on delete cascade,
  date date not null,
  reason text,
  file_url text,
  status text not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

create table public.hour_compensations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.profiles(id) on delete cascade,
  date date not null,
  reason text,
  hours numeric not null,
  type text not null,
  status text not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text,
  description text,
  file_url text,
  status text default 'pending',
  sender_id uuid references public.profiles(id) on delete set null,
  recipient_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.news (
  id uuid primary key default gen_random_uuid(),
  type text default 'news',
  title text,
  content text,
  author_id uuid references public.profiles(id) on delete set null,
  published_at date default current_date,
  pinned boolean default false,
  category text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table public.notifications (
  id :id_type,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  type text default 'info',
  entity_type text,
  entity_id text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
