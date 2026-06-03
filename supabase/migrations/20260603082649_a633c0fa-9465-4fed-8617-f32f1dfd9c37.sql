-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule prior job if it exists (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('wc-fifa-scrape-5m');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Hit our public scrape hook every 5 minutes to refresh fixtures + live scores
SELECT cron.schedule(
  'wc-fifa-scrape-5m',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--8fd08619-6e6b-4be8-b491-1a0a8bf007a6.lovable.app/api/public/hooks/wc-scrape',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);