-- PDF sign requests: admin uploads a PDF and sends it to workers to sign

create table if not exists sign_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  pdf_path text not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists sign_assignments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references sign_requests(id) on delete cascade,
  assigned_to uuid not null references profiles(id) on delete cascade,
  assigned_by uuid references profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'signed')),
  signature_path text,
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (request_id, assigned_to)
);

-- RLS
alter table sign_requests enable row level security;
alter table sign_assignments enable row level security;

-- Admins/safety officers can do everything on sign_requests
create policy "admins manage sign_requests"
  on sign_requests for all
  using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','safety_officer'))
  );

-- Workers can read sign_requests they are assigned to
create policy "workers read assigned sign_requests"
  on sign_requests for select
  using (
    exists (select 1 from sign_assignments where request_id = sign_requests.id and assigned_to = auth.uid())
  );

-- Admins/safety officers can do everything on sign_assignments
create policy "admins manage sign_assignments"
  on sign_assignments for all
  using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','safety_officer'))
  );

-- Workers can read and update their own assignments
create policy "workers read own sign_assignments"
  on sign_assignments for select
  using (assigned_to = auth.uid());

create policy "workers update own sign_assignments"
  on sign_assignments for update
  using (assigned_to = auth.uid());

-- Storage: sign-pdfs bucket (private, only accessible via signed URLs or service role)
insert into storage.buckets (id, name, public) values ('sign-pdfs', 'sign-pdfs', false)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public) values ('signatures', 'signatures', false)
  on conflict (id) do nothing;

-- Admins can upload PDFs
create policy "admins upload sign pdfs"
  on storage.objects for insert
  with check (
    bucket_id = 'sign-pdfs'
    and exists (select 1 from profiles where id = auth.uid() and role in ('admin','safety_officer'))
  );

-- Approved users can download PDFs they are assigned to
create policy "assigned users download sign pdfs"
  on storage.objects for select
  using (
    bucket_id = 'sign-pdfs'
    and exists (
      select 1 from sign_assignments sa
      join sign_requests sr on sr.id = sa.request_id
      where sa.assigned_to = auth.uid()
      and sr.pdf_path = storage.objects.name
    )
    or exists (select 1 from profiles where id = auth.uid() and role in ('admin','safety_officer'))
  );

-- Workers upload their own signatures
create policy "workers upload signatures"
  on storage.objects for insert
  with check (
    bucket_id = 'signatures'
    and exists (select 1 from profiles where id = auth.uid() and status = 'approved')
  );

-- Admins can view all signatures
create policy "admins view signatures"
  on storage.objects for select
  using (
    bucket_id = 'signatures'
    and exists (select 1 from profiles where id = auth.uid() and role in ('admin','safety_officer'))
  );

-- Workers can view their own signatures
create policy "workers view own signatures"
  on storage.objects for select
  using (
    bucket_id = 'signatures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
