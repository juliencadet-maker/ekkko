-- Remove old cron job and create a simpler one using pg_net
SELECT cron.unschedule('check-slack-replies');

-- Use pg_net.http_post which is simpler and more reliable
SELECT cron.schedule(
  'check-slack-replies',
  '30 seconds',
  $$
  SELECT net.http_post(
    url := 'https://kqpbsznldzrklnnbqtwq.supabase.co/functions/v1/check-slack-replies',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);