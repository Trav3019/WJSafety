-- Incident reports submitted by workers
create table incident_reports (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references auth.users(id) on delete set null,
  data jsonb not null default '{}',
  created_at timestamptz default now()
);

alter table incident_reports enable row level security;

create policy "workers can insert own" on incident_reports
  for insert with check (auth.uid() = submitted_by);

create policy "workers can view own" on incident_reports
  for select using (auth.uid() = submitted_by);

create policy "admins can view all" on incident_reports
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "admins can delete" on incident_reports
  for delete using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Notification log so users can see their notification history in-app
create table notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  body text,
  created_at timestamptz default now()
);

alter table notification_log enable row level security;

create policy "users can view own notifications" on notification_log
  for select using (auth.uid() = user_id);

-- Service role (used by edge function) bypasses RLS for inserts
