
-- New SAFC tier system (free / basic / premium / founder)
DO $$ BEGIN
  CREATE TYPE public.app_tier AS ENUM ('free','basic','premium','founder');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tier public.app_tier NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS member_no integer,
  ADD COLUMN IF NOT EXISTS is_founder boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS founder_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_member_no_uk ON public.profiles(member_no) WHERE member_no IS NOT NULL;

-- Sequential SAFC member numbers (1,2,3,…) — used to render SAFC-001 on the card.
CREATE SEQUENCE IF NOT EXISTS public.safc_member_no_seq START 1;

-- Backfill existing profiles by created_at order
DO $$
DECLARE r record; n int;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE member_no IS NULL ORDER BY created_at ASC LOOP
    n := nextval('public.safc_member_no_seq');
    UPDATE public.profiles SET member_no = n WHERE id = r.id;
  END LOOP;
END $$;

-- Assign member_no on insert
CREATE OR REPLACE FUNCTION public.assign_member_no()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.member_no IS NULL THEN
    NEW.member_no := nextval('public.safc_member_no_seq');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_assign_member_no ON public.profiles;
CREATE TRIGGER profiles_assign_member_no BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.assign_member_no();

-- Founding member cap = 111. Enforced by a BEFORE trigger (CHECK can't use COUNT).
CREATE OR REPLACE FUNCTION public.enforce_founder_cap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c int;
BEGIN
  IF NEW.is_founder = true AND (TG_OP = 'INSERT' OR OLD.is_founder = false) THEN
    SELECT count(*) INTO c FROM public.profiles WHERE is_founder = true;
    IF c >= 111 THEN
      RAISE EXCEPTION 'Founding Member cap reached (111 Starting XI members)';
    END IF;
    NEW.founder_at := COALESCE(NEW.founder_at, now());
    NEW.tier := 'founder';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_founder_cap ON public.profiles;
CREATE TRIGGER profiles_founder_cap BEFORE INSERT OR UPDATE OF is_founder ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_founder_cap();

-- Admin-editable tier config (pricing, perks, enabled flags)
CREATE TABLE IF NOT EXISTS public.tier_config (
  id public.app_tier PRIMARY KEY,
  name text NOT NULL,
  tagline text,
  price_cents integer NOT NULL DEFAULT 0,
  perks text[] NOT NULL DEFAULT '{}',
  visible boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tier_config TO anon, authenticated;
GRANT ALL ON public.tier_config TO service_role;
ALTER TABLE public.tier_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tier_config readable by all" ON public.tier_config;
CREATE POLICY "tier_config readable by all" ON public.tier_config FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "tier_config admin write" ON public.tier_config;
CREATE POLICY "tier_config admin write" ON public.tier_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP TRIGGER IF EXISTS tier_config_updated_at ON public.tier_config;
CREATE TRIGGER tier_config_updated_at BEFORE UPDATE ON public.tier_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.tier_config (id, name, tagline, price_cents, perks, sort_order) VALUES
  ('free','General Member','Join the movement — free for everyone',0,
   ARRAY['Community feed access','RSVP to events','Join public discussions','View match events','Polls & giveaways'],1),
  ('basic','SAFC Basic','For everyday supporters',4900,
   ARRAY['Priority event access','Exclusive content posts','Selected supporter chats','Chapter participation (city groups)','Basic digital member card'],2),
  ('premium','SAFC Premium','For die-hard supporters',9900,
   ARRAY['Everything in Basic','VIP event access','Premium-only group chats','Early access to events & merch drops','Priority RSVP','Animated premium digital card','Premium profile badge'],3),
  ('founder','Founding Member — Starting XI','Limited to 111 founding supporters',29900,
   ARRAY['Permanent Founding Member status','Unique SAFC member number','Voting rights on club decisions','Founders-only content & chats','Annual Founders recognition','Priority access to all events & travel','Elite animated card with founder stamp'],4)
ON CONFLICT (id) DO NOTHING;
