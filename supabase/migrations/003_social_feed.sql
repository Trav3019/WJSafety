-- Migration 003: social feed
-- Run in Supabase SQL editor

-- Add image support and make title optional on news_posts
alter table news_posts
  add column if not exists image_path text,
  alter column title drop not null,
  alter column title set default null;

-- Allow any approved user to post and delete their own posts
create policy "approved users insert news" on news_posts
  for insert with check (is_approved() and auth.uid() = posted_by);

create policy "users delete own news" on news_posts
  for delete using (auth.uid() = posted_by);

-- Storage bucket for post images
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict do nothing;

create policy "approved users upload post images" on storage.objects
  for insert with check (
    bucket_id = 'post-images' and is_approved()
  );

create policy "anyone can view post images" on storage.objects
  for select using (bucket_id = 'post-images');

create policy "users delete own post images" on storage.objects
  for delete using (
    bucket_id = 'post-images' and auth.uid()::text = (storage.foldername(name))[1]
  );
