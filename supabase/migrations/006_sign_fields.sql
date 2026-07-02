-- Inline PDF field placement for sign requests

-- Fields that admin places on a PDF (signature, initials, date boxes)
create table if not exists sign_fields (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references sign_requests(id) on delete cascade,
  page int not null default 1,
  x float not null,       -- 0–1 relative to page width
  y float not null,       -- 0–1 relative to page height (top = 0)
  width float not null,
  height float not null,
  type text not null check (type in ('signature', 'initials', 'date')),
  label text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Values filled in by each worker for each field
create table if not exists sign_field_values (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references sign_assignments(id) on delete cascade,
  field_id uuid not null references sign_fields(id) on delete cascade,
  value text not null,
  created_at timestamptz not null default now(),
  unique (assignment_id, field_id)
);

-- Track the merged/signed PDF per assignment
alter table sign_assignments
  add column if not exists signed_pdf_path text;

-- RLS
alter table sign_fields enable row level security;
alter table sign_field_values enable row level security;

create policy "admins manage sign_fields"
  on sign_fields for all
  using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','safety_officer'))
  );

create policy "workers read sign_fields for their assignments"
  on sign_fields for select
  using (
    exists (
      select 1 from sign_assignments
      where request_id = sign_fields.request_id
      and assigned_to = auth.uid()
    )
  );

create policy "admins manage sign_field_values"
  on sign_field_values for all
  using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','safety_officer'))
  );

create policy "workers manage own sign_field_values"
  on sign_field_values for all
  using (
    exists (
      select 1 from sign_assignments
      where id = sign_field_values.assignment_id
      and assigned_to = auth.uid()
    )
  );

-- Bucket for completed signed PDFs
insert into storage.buckets (id, name, public) values ('signed-pdfs', 'signed-pdfs', false)
  on conflict (id) do nothing;

create policy "workers upload signed pdfs"
  on storage.objects for insert
  with check (
    bucket_id = 'signed-pdfs'
    and exists (select 1 from profiles where id = auth.uid() and status = 'approved')
  );

create policy "admins read signed pdfs"
  on storage.objects for select
  using (
    bucket_id = 'signed-pdfs'
    and exists (select 1 from profiles where id = auth.uid() and role in ('admin','safety_officer'))
  );

create policy "workers read own signed pdfs"
  on storage.objects for select
  using (
    bucket_id = 'signed-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
