-- Push notifications: subscriptions + triggers that call the send-push edge function.
-- Run this in the Supabase SQL editor after schema.sql.

create extension if not exists "pg_net";

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create policy "users manage own push subscriptions" on push_subscriptions
  for all using (user_id = auth.uid());

-- Project-specific settings used by the trigger functions below.
-- Replace <YOUR-SERVICE-ROLE-KEY> with your real service role key after running this file:
alter database postgres set app.settings.edge_function_url to 'https://rtjgrddzyuxfjjbxxlan.supabase.co/functions/v1/send-push';
alter database postgres set app.settings.edge_function_secret to '<SET-A-RANDOM-SECRET-AND-MATCH-IT-IN-THE-EDGE-FUNCTION-ENV>';

create or replace function notify_news_post()
returns trigger as $$
begin
  perform net.http_post(
    url := current_setting('app.settings.edge_function_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', current_setting('app.settings.edge_function_secret')
    ),
    body := jsonb_build_object(
      'type', 'news_post',
      'title', new.title,
      'body', new.body
    )
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_news_post_created
  after insert on news_posts
  for each row execute procedure notify_news_post();

create or replace function notify_form_assignment()
returns trigger as $$
declare
  form_title text;
begin
  select title into form_title from form_templates where id = new.form_id;

  perform net.http_post(
    url := current_setting('app.settings.edge_function_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', current_setting('app.settings.edge_function_secret')
    ),
    body := jsonb_build_object(
      'type', 'form_assigned',
      'user_id', new.assigned_to,
      'title', form_title
    )
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_form_assignment_created
  after insert on form_assignments
  for each row execute procedure notify_form_assignment();
