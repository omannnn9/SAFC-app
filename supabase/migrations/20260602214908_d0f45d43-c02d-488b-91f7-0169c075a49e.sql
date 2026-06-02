
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  prefs jsonb NOT NULL DEFAULT '{"kickoff":true,"goal":true,"fulltime":true,"squad":true,"article":true}'::jsonb,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions owner all"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.notification_log (
  dedup_key text PRIMARY KEY,
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.notification_log TO service_role;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.match_state (
  fixture_id text PRIMARY KEY,
  status text NOT NULL,
  home_score integer,
  away_score integer,
  opponent text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.match_state TO service_role;
ALTER TABLE public.match_state ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.seen_articles (
  url text PRIMARY KEY,
  title text,
  seen_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.seen_articles TO service_role;
ALTER TABLE public.seen_articles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
