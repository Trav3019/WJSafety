-- Daily cron job: notify workers with unsigned documents every morning at 9 AM UTC
-- Requires pg_cron extension (enabled by default in Supabase)

select cron.schedule(
  'daily-pending-form-reminder',
  '0 9 * * *',
  $$
  select net.http_post(
    url := coalesce(
      current_setting('app.settings.edge_function_url', true),
      'https://rtjgrddzyuxfjjbxxlan.supabase.co/functions/v1/Send-Push'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce(current_setting('app.settings.edge_function_secret', true), '')
    ),
    body := '{"type": "daily_pending_reminder"}'::jsonb
  )
  $$
);
