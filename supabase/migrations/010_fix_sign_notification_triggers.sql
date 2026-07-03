-- Rewrite sign notification triggers to hardcode the edge function URL
-- and use current_setting with the safe=true flag so they never throw.
-- This fixes silent failures when app.settings.* are not configured.

create or replace function notify_sign_assignment()
returns trigger as $$
declare
  doc_title text;
  fn_url text;
  fn_secret text;
begin
  fn_url := coalesce(
    current_setting('app.settings.edge_function_url', true),
    'https://rtjgrddzyuxfjjbxxlan.supabase.co/functions/v1/send-push'
  );
  fn_secret := current_setting('app.settings.edge_function_secret', true);

  if fn_url is null or fn_url = '' then
    return new;
  end if;

  select title into doc_title from sign_requests where id = new.request_id;

  perform net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce(fn_secret, '')
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

drop trigger if exists on_sign_assignment_created on sign_assignments;
create trigger on_sign_assignment_created
  after insert on sign_assignments
  for each row execute procedure notify_sign_assignment();

create or replace function notify_doc_signed()
returns trigger as $$
declare
  doc_title text;
  worker_name text;
  fn_url text;
  fn_secret text;
begin
  if new.status = 'signed' and old.status != 'signed' then
    fn_url := coalesce(
      current_setting('app.settings.edge_function_url', true),
      'https://rtjgrddzyuxfjjbxxlan.supabase.co/functions/v1/send-push'
    );
    fn_secret := current_setting('app.settings.edge_function_secret', true);

    if fn_url is null or fn_url = '' then
      return new;
    end if;

    select title into doc_title from sign_requests where id = new.request_id;
    select full_name into worker_name from profiles where id = new.assigned_to;

    perform net.http_post(
      url := fn_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', coalesce(fn_secret, '')
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

drop trigger if exists on_sign_assignment_signed on sign_assignments;
create trigger on_sign_assignment_signed
  after update on sign_assignments
  for each row execute procedure notify_doc_signed();
