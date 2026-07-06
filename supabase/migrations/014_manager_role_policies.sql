-- Allow managers to view all incident reports
create policy "managers can view all" on incident_reports
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'manager')
  );

-- Allow managers to mark reports reviewed (update reviewed_at)
create policy "managers can update" on incident_reports
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'manager')
  );

-- Allow managers to view all time off requests
create policy "managers can view all" on time_off_requests
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'manager')
  );

-- Allow managers to approve/reject time off requests
create policy "managers can update" on time_off_requests
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'manager')
  );

-- Allow managers to delete time off requests
create policy "managers can delete" on time_off_requests
  for delete using (
    exists (select 1 from profiles where id = auth.uid() and role = 'manager')
  );

-- Allow managers to view all profiles (needed to show names)
create policy "managers can view profiles" on profiles
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'manager')
  );
