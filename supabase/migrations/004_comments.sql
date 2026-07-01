-- Migration 004: comments on news posts
-- Run in Supabase SQL editor

create table post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references news_posts(id) on delete cascade,
  commented_by uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table post_comments enable row level security;

create policy "approved users read comments" on post_comments
  for select using (is_approved());

create policy "approved users insert comments" on post_comments
  for insert with check (is_approved() and auth.uid() = commented_by);

create policy "users delete own comments" on post_comments
  for delete using (auth.uid() = commented_by);

create policy "admin delete any comment" on post_comments
  for delete using (is_admin());
