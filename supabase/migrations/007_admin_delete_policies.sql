-- Admin delete policies that were missing

-- form_submissions: admins can delete any submission
alter table form_submissions enable row level security;

drop policy if exists "admins delete form_submissions" on form_submissions;
create policy "admins delete form_submissions"
  on form_submissions for delete
  using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','safety_officer'))
  );

-- sign_assignments: ensure admins can delete (the existing "all" policy should cover it,
-- but recreate explicitly in case it was not applied)
drop policy if exists "admins delete sign_assignments" on sign_assignments;
create policy "admins delete sign_assignments"
  on sign_assignments for delete
  using (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','safety_officer'))
  );

-- signed-pdfs storage: admins can delete
drop policy if exists "admins delete signed pdfs" on storage.objects;
create policy "admins delete signed pdfs"
  on storage.objects for delete
  using (
    bucket_id = 'signed-pdfs'
    and exists (select 1 from profiles where id = auth.uid() and role in ('admin','safety_officer'))
  );

-- signatures storage: admins can delete
drop policy if exists "admins delete signatures" on storage.objects;
create policy "admins delete signatures"
  on storage.objects for delete
  using (
    bucket_id = 'signatures'
    and exists (select 1 from profiles where id = auth.uid() and role in ('admin','safety_officer'))
  );
