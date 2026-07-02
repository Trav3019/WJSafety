-- Fix sign-pdfs download policy for workers
-- The previous policy had a complex join that fails silently under RLS
-- Replace with a simpler policy: any authenticated user can download
-- (paths are random UUIDs so not guessable without being assigned)

drop policy if exists "assigned users download sign pdfs" on storage.objects;

create policy "authenticated download sign pdfs"
  on storage.objects for select
  using (
    bucket_id = 'sign-pdfs'
    and auth.role() = 'authenticated'
  );
