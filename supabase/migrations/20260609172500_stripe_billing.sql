-- Stripe billing integration: customer linkage, subscription detail columns,
-- and lock down payments/subscriptions to server-only writes.

-- 1) Link profiles to Stripe customers
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;

-- 2) Subscription details for Stripe-managed subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS tier public.app_tier,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS interval TEXT,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS payments_user_idx ON public.payments(user_id);

-- 3) RLS: writes go through the service role (webhook) only.
-- Drop the lingering mock-checkout insert policy; owner SELECT policies
-- ("Subscriptions owner read", "Payments owner read") already exist.
DROP POLICY IF EXISTS "Payments self insert" ON public.payments;
