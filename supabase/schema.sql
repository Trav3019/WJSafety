-- WJ Safety App schema
-- Run this in the Supabase SQL editor on a fresh project.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────
-- Profiles (one row per auth.users row). New signups default to pending
-- and have no access until an admin approves them and sets a role.
-- ─────────────────────────────────────────────────────────────────────────
create type user_role as enum ('admin', 'safety_officer', 'worker');
create type approval_status as enum ('pending', 'approved', 'rejected');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'worker',
  status approval_status not null default 'pending',
  created_at timestamptz not null default now()
);

create function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

create function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('admin', 'safety_officer') and status = 'approved'
  );
$$ language sql security definer stable;

create function is_approved()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and status = 'approved'
  );
$$ language sql security definer stable;

alter table profiles enable row level security;

create policy "users read own profile" on profiles
  for select using (auth.uid() = id or is_admin());

create policy "users update own profile" on profiles
  for update using (auth.uid() = id or is_admin());

create policy "admin manage profiles" on profiles
  for all using (is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- Document categories + documents (SDS, Acts & Regs, ERP, Equipment
-- Inventory, Incident Report Forms, Field Books)
-- ─────────────────────────────────────────────────────────────────────────
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0
);

insert into categories (name, sort_order) values
  ('Acts and Regulations', 1),
  ('Emergency Response Plan', 2),
  ('Equipment Inventory', 3),
  ('Incident Report Forms', 4),
  ('SDS', 5),
  ('Field Books', 6);

create table documents (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  title text not null,
  description text,
  storage_path text not null, -- path inside the "documents" storage bucket
  file_type text,
  file_size_bytes bigint,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table categories enable row level security;
alter table documents enable row level security;

create policy "approved users read categories" on categories
  for select using (is_approved());

create policy "admin manage categories" on categories
  for all using (is_admin());

create policy "approved users read documents" on documents
  for select using (is_approved());

create policy "admin manage documents" on documents
  for all using (is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- Forms: admin-built form templates, sent to specific workers, filled in
-- and digitally signed.
-- ─────────────────────────────────────────────────────────────────────────
create table form_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  fields jsonb not null default '[]', -- [{id,label,type,required,options}]
  requires_signature boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create type assignment_status as enum ('assigned', 'submitted');

create table form_assignments (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references form_templates(id) on delete cascade,
  assigned_to uuid not null references profiles(id) on delete cascade,
  assigned_by uuid references profiles(id),
  status assignment_status not null default 'assigned',
  due_date date,
  created_at timestamptz not null default now()
);

create table form_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references form_assignments(id) on delete cascade,
  form_id uuid not null references form_templates(id),
  submitted_by uuid not null references profiles(id),
  answers jsonb not null default '{}',
  signature_data_url text, -- base64 PNG of the signature pad
  signed_at timestamptz,
  submitted_at timestamptz not null default now()
);

alter table form_templates enable row level security;
alter table form_assignments enable row level security;
alter table form_submissions enable row level security;

create policy "approved users read open forms" on form_templates
  for select using (is_approved());

create policy "admin manage form templates" on form_templates
  for all using (is_admin());

create policy "users read own assignments" on form_assignments
  for select using (assigned_to = auth.uid() or is_admin());

create policy "users update own assignments" on form_assignments
  for update using (assigned_to = auth.uid() or is_admin());

create policy "admin create assignments" on form_assignments
  for insert with check (is_admin());

create policy "admin delete assignments" on form_assignments
  for delete using (is_admin());

create policy "users read own submissions" on form_submissions
  for select using (submitted_by = auth.uid() or is_admin());

create policy "users create own submissions" on form_submissions
  for insert with check (submitted_by = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- News / safety updates feed (posted by admin / safety officer)
-- ─────────────────────────────────────────────────────────────────────────
create table news_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  posted_by uuid references profiles(id),
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

alter table news_posts enable row level security;

create policy "approved users read news" on news_posts
  for select using (is_approved());

create policy "admin manage news" on news_posts
  for all using (is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- Storage bucket for documents (create via dashboard or here)
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
  on conflict (id) do nothing;

create policy "approved users read document files" on storage.objects
  for select using (bucket_id = 'documents' and is_approved());

create policy "admin manage document files" on storage.objects
  for all using (bucket_id = 'documents' and is_admin());
