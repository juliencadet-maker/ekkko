SELECT cron.unschedule(3);

SELECT cron.schedule(
  'check-slack-replies-poll',
  '30 seconds',
  $$
  SELECT net.http_post(
    url := 'https://kqpbsznldzrklnnbqtwq.supabase.co/functions/v1/check-slack-replies',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxcGJzem5sZHpya2xubmJxdHdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzM4NDcsImV4cCI6MjA4NTk0OTg0N30.udzrVg4mtX45hlzC3rq6efz0I4Nk9EtDFmu7Ukfuj9E"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);