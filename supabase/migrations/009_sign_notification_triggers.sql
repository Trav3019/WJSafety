-- DB triggers for sign request notifications (matches the pattern in 002_push_notifications.sql)
-- Run in Supabase SQL Editor

-- Notify worker when they are assigned a document to sign
create or replace function notify_sign_assignment()
returns trigger as $$
declare
  doc_title text;
begin
  select title into doc_title from sign_requests where id = new.request_id;

  perform net.http_post(
    url := current_setting('app.settings.edge_function_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', current_setting('app.settings.edge_function_secret')
    ),
    body := jsonb_build_object(
      'type', 'sign_assigned',
      'user_id', new.assigned_to,
      'title', doc_title
    )
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_sign_assignment_created
  after insert on sign_assignments
  for each row execute procedure notify_sign_assignment();

-- Notify all admins when a worker signs a document
create or replace function notify_doc_signed()
returns trigger as $$
declare
  doc_title text;
  worker_name text;
begin
  -- Only fire when status changes to 'signed'
  if new.status = 'signed' and old.status != 'signed' then
    select title into doc_title from sign_requests where id = new.request_id;
    select full_name into worker_name from profiles where id = new.assigned_to;

    perform net.http_post(
      url := current_setting('app.settings.edge_function_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', current_setting('app.settings.edge_function_secret')
      ),
      body := jsonb_build_object(
        'type', 'doc_signed',
        'worker_name', worker_name,
        'doc_title', doc_title
      )
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_sign_assignment_signed
  after update on sign_assignments
  for each row execute procedure notify_doc_signed();
