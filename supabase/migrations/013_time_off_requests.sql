create table if not exists time_off_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  start_date date not null,
  end_date date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

alter table time_off_requests enable row level security;

create policy "workers can insert own" on time_off_requests
  for insert with check (auth.uid() = user_id);

create policy "workers can view own" on time_off_requests
  for select using (auth.uid() = user_id);

create policy "admins and safety officers can view all" on time_off_requests
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'safety_officer'))
  );

create policy "admins and safety officers can update" on time_off_requests
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'safety_officer'))
  );

create policy "workers can delete own pending" on time_off_requests
  for delete using (auth.uid() = user_id and status = 'pending');
