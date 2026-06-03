
-- =========================================================================
-- 1. SUPER ADMIN AUTO-GRANT (email-based)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, country)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'country', 'South Africa')
  );

  -- Always give the base 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Auto-grant super admin (mapped to 'admin' enum value) by email
  IF lower(NEW.email) = 'oman.dilloo@icloud.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill: grant admin to existing user with that email if present
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u
WHERE lower(u.email) = 'oman.dilloo@icloud.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- =========================================================================
-- 2. AUDIT LOGS (immutable)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  actor_role text,
  action_type text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  before_value jsonb,
  after_value jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.audit_logs (target_type, target_id);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only super admins (mapped to 'admin') can read
CREATE POLICY "Audit logs super admin read"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- No INSERT/UPDATE/DELETE policies → blocked for all non-service_role.
-- Writes go through public.log_audit() (SECURITY DEFINER) only.

-- Sole writer
CREATE OR REPLACE FUNCTION public.log_audit(
  _action_type text,
  _target_type text,
  _target_id text DEFAULT NULL,
  _before jsonb DEFAULT NULL,
  _after jsonb DEFAULT NULL,
  _metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _role text;
  _id uuid;
BEGIN
  IF _uid IS NOT NULL THEN
    SELECT email INTO _email FROM auth.users WHERE id = _uid;
    IF public.has_role(_uid, 'admin') THEN
      _role := 'super_admin';
    ELSE
      _role := 'user';
    END IF;
  END IF;

  INSERT INTO public.audit_logs (
    actor_id, actor_email, actor_role,
    action_type, target_type, target_id,
    before_value, after_value, metadata
  )
  VALUES (
    _uid, _email, _role,
    _action_type, _target_type, _target_id,
    _before, _after, _metadata
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit(text, text, text, jsonb, jsonb, jsonb) TO authenticated;

-- =========================================================================
-- 3. EDITABLE PLANS TABLE
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  tagline text,
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'ZAR',
  perks jsonb NOT NULL DEFAULT '[]'::jsonb,
  visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans public read visible"
  ON public.plans FOR SELECT
  USING (visible OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Plans super admin update"
  ON public.plans FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Plans super admin insert"
  ON public.plans FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Audit trigger
CREATE OR REPLACE FUNCTION public.audit_plans_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.log_audit(
    TG_OP,
    'plan',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END,
    NULL
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER plans_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.audit_plans_change();

-- Seed plans
INSERT INTO public.plans (id, name, tagline, price_cents, perks, sort_order) VALUES
  ('bronze', 'Bronze Supporter', 'For students & new supporters', 1900,
    '["Create profile + upload photo","Follow other supporters","Create posts & upload photos","Like and comment on posts","Join public event communities","Join up to 5 events / month","Basic notifications","Bronze profile badge"]'::jsonb, 1),
  ('silver', 'Silver Supporter', 'Most popular — the supporter standard', 5900,
    '["Everything in Bronze","Unlimited event participation","Unlimited community access","Create supporter meetup groups","Create travel groups","Advanced supporter search","Priority placement in attendee lists","Enhanced profile customisation","Larger photo uploads","Silver profile badge"]'::jsonb, 2),
  ('gold', 'Gold Supporter', 'Premium VIP supporter experience', 12900,
    '["Everything in Silver","Gold profile badge & featured placement","Access Gold-only communities","Create unlimited private groups","Create premium event communities","Advanced networking tools","Profile visitor analytics","Exclusive Gold supporter feed","Priority support","Early access to new features"]'::jsonb, 3)
ON CONFLICT (id) DO NOTHING;

-- =========================================================================
-- 4. PROFILE PRIVACY
-- =========================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- =========================================================================
-- 5. FOLLOW REQUESTS
-- =========================================================================

ALTER TABLE public.follows
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'accepted';

-- Drop old policies and replace
DROP POLICY IF EXISTS "Follows self write" ON public.follows;
DROP POLICY IF EXISTS "Follows self delete" ON public.follows;
DROP POLICY IF EXISTS "Follows public read" ON public.follows;

-- Anyone can read accepted follows; pending visible to follower & target
CREATE POLICY "Follows read accepted or own"
  ON public.follows FOR SELECT
  USING (
    status = 'accepted'
    OR auth.uid() = follower_id
    OR auth.uid() = following_id
  );

CREATE POLICY "Follows self write"
  ON public.follows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Follows self delete"
  ON public.follows FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id OR auth.uid() = following_id);

-- Target can update (accept/decline)
CREATE POLICY "Follows target update"
  ON public.follows FOR UPDATE
  TO authenticated
  USING (auth.uid() = following_id)
  WITH CHECK (auth.uid() = following_id);

-- Auto-accept follows of public profiles on insert
CREATE OR REPLACE FUNCTION public.set_follow_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _private boolean;
BEGIN
  SELECT is_private INTO _private FROM public.profiles WHERE id = NEW.following_id;
  IF COALESCE(_private, false) = false THEN
    NEW.status := 'accepted';
  ELSE
    NEW.status := 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS follows_set_status ON public.follows;
CREATE TRIGGER follows_set_status
  BEFORE INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.set_follow_status();

-- =========================================================================
-- 6. POSTS VISIBILITY (private profiles)
-- =========================================================================

DROP POLICY IF EXISTS "Posts public read" ON public.posts;

CREATE POLICY "Posts visibility"
  ON public.posts FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = posts.user_id AND COALESCE(p.is_private, false) = false
    )
    OR EXISTS (
      SELECT 1 FROM public.follows f
      WHERE f.follower_id = auth.uid()
        AND f.following_id = posts.user_id
        AND f.status = 'accepted'
    )
  );
