
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.membership_plan AS ENUM ('bronze','silver','gold');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.event_type AS ENUM ('wc_match','match','tournament','fan_zone','meetup','festival','travel');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.event_stage AS ENUM ('group','r32','r16','qf','sf','third','final','friendly','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.attendance_status AS ENUM ('going','interested','maybe','not_going');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.group_type AS ENUM ('travel','meetup','community','private','gold');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ PROFILES additions ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan public.membership_plan NOT NULL DEFAULT 'bronze',
  ADD COLUMN IF NOT EXISTS username text UNIQUE,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS favourite_team text;

-- Make profiles publicly readable (social platform)
DROP POLICY IF EXISTS "Profiles viewable by owner" ON public.profiles;
CREATE POLICY "Profiles publicly viewable"
  ON public.profiles FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public.profiles TO anon;

-- ============ EVENTS ============
CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_type public.event_type NOT NULL DEFAULT 'match',
  stage public.event_stage DEFAULT 'other',
  competition text,
  home_team text,
  away_team text,
  home_team_flag text,
  away_team_flag text,
  kickoff timestamptz NOT NULL,
  venue text,
  city text,
  country text,
  cover_url text,
  external_id text UNIQUE,
  status text NOT NULL DEFAULT 'scheduled', -- scheduled|live|finished
  home_score int,
  away_score int,
  minute int,
  is_featured boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Events public read" ON public.events FOR SELECT USING (true);
CREATE POLICY "Events admin write" ON public.events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Events creator insert" ON public.events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE INDEX IF NOT EXISTS idx_events_kickoff ON public.events(kickoff);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_type ON public.events(event_type);

-- ============ EVENT ATTENDEES ============
CREATE TABLE IF NOT EXISTS public.event_attendees (
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status public.attendance_status NOT NULL DEFAULT 'going',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
GRANT SELECT ON public.event_attendees TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_attendees TO authenticated;
GRANT ALL ON public.event_attendees TO service_role;
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attendees public read" ON public.event_attendees FOR SELECT USING (true);
CREATE POLICY "Attendees self write" ON public.event_attendees FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_attendees_user ON public.event_attendees(user_id);

-- ============ POSTS ============
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  body text,
  image_url text,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  group_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Posts public read" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Posts owner write" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Posts owner update" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Posts owner delete" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_posts_event ON public.posts(event_id);
CREATE INDEX IF NOT EXISTS idx_posts_user ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON public.posts(created_at DESC);

-- ============ POST LIKES / COMMENTS ============
CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT ON public.post_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.post_likes TO authenticated;
GRANT ALL ON public.post_likes TO service_role;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Likes public read" ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "Likes self write" ON public.post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Likes self delete" ON public.post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.post_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_comments TO authenticated;
GRANT ALL ON public.post_comments TO service_role;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments public read" ON public.post_comments FOR SELECT USING (true);
CREATE POLICY "Comments self write" ON public.post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Comments self delete" ON public.post_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ FOLLOWS ============
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
GRANT SELECT ON public.follows TO anon;
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Follows public read" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Follows self write" ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Follows self delete" ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- ============ EVENT PHOTOS ============
CREATE TABLE IF NOT EXISTS public.event_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  image_url text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.event_photos TO anon;
GRANT SELECT, INSERT, DELETE ON public.event_photos TO authenticated;
GRANT ALL ON public.event_photos TO service_role;
ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Photos public read" ON public.event_photos FOR SELECT USING (true);
CREATE POLICY "Photos self write" ON public.event_photos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Photos self delete" ON public.event_photos FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ GROUPS ============
CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  type public.group_type NOT NULL DEFAULT 'meetup',
  name text NOT NULL,
  description text,
  city text,
  country text,
  cover_url text,
  is_private boolean NOT NULL DEFAULT false,
  min_plan public.membership_plan NOT NULL DEFAULT 'bronze',
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.groups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Groups public read" ON public.groups FOR SELECT USING (true);
CREATE POLICY "Groups owner write" ON public.groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Groups owner update" ON public.groups FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Groups owner delete" ON public.groups FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TABLE IF NOT EXISTS public.group_members (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
GRANT SELECT ON public.group_members TO anon;
GRANT SELECT, INSERT, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Group members public read" ON public.group_members FOR SELECT USING (true);
CREATE POLICY "Group members self join" ON public.group_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Group members self leave" ON public.group_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ PROFILE VISITS (Gold analytics) ============
CREATE TABLE IF NOT EXISTS public.profile_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  visitor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.profile_visits TO authenticated;
GRANT ALL ON public.profile_visits TO service_role;
ALTER TABLE public.profile_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visits owner read" ON public.profile_visits FOR SELECT TO authenticated USING (auth.uid() = profile_id);
CREATE POLICY "Visits anyone insert" ON public.profile_visits FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_visits_profile ON public.profile_visits(profile_id, created_at DESC);

-- ============ HELPER: monthly event join count for plan enforcement ============
CREATE OR REPLACE FUNCTION public.monthly_event_joins(_user uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int FROM public.event_attendees
  WHERE user_id = _user AND status IN ('going','interested')
    AND created_at >= date_trunc('month', now());
$$;

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;

-- ============ SEED PLAN-RELATED ACHIEVEMENTS ============
INSERT INTO public.achievements (id, name, description, icon, tier) VALUES
  ('bronze_supporter','Bronze Supporter','Joined as a Bronze member','medal','bronze'),
  ('silver_supporter','Silver Supporter','Upgraded to Silver','medal','silver'),
  ('gold_supporter','Gold Supporter','Upgraded to Gold','crown','gold'),
  ('first_event','First Event','RSVP''d to your first event','calendar','bronze'),
  ('first_follow','Network Builder','Followed your first supporter','users','bronze'),
  ('wc_traveler','World Cup Traveler','Going to a World Cup match','plane','gold')
ON CONFLICT (id) DO NOTHING;
