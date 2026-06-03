
-- Profile additions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS interests text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_seen timestamptz;

-- Post saves
CREATE TABLE IF NOT EXISTS public.post_saves (
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.post_saves TO authenticated;
GRANT SELECT ON public.post_saves TO anon;
GRANT ALL ON public.post_saves TO service_role;
ALTER TABLE public.post_saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_saves read" ON public.post_saves FOR SELECT USING (true);
CREATE POLICY "post_saves insert" ON public.post_saves FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "post_saves delete" ON public.post_saves FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Post shares (counts)
CREATE TABLE IF NOT EXISTS public.post_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  channel text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.post_shares TO authenticated;
GRANT SELECT ON public.post_shares TO anon;
GRANT ALL ON public.post_shares TO service_role;
ALTER TABLE public.post_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_shares read" ON public.post_shares FOR SELECT USING (true);
CREATE POLICY "post_shares insert" ON public.post_shares FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Conversations
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group boolean NOT NULL DEFAULT false,
  title text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_participants TO authenticated;
GRANT ALL ON public.conversation_participants TO service_role;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- helper: is current user a participant in a conversation
CREATE OR REPLACE FUNCTION public.is_conv_participant(_conv uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = _conv AND user_id = _user)
$$;

CREATE POLICY "conv read by participant" ON public.conversations FOR SELECT TO authenticated USING (public.is_conv_participant(id, auth.uid()));
CREATE POLICY "conv insert by creator" ON public.conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "conv update by participant" ON public.conversations FOR UPDATE TO authenticated USING (public.is_conv_participant(id, auth.uid()));

CREATE POLICY "cp read self conv" ON public.conversation_participants FOR SELECT TO authenticated
  USING (public.is_conv_participant(conversation_id, auth.uid()));
CREATE POLICY "cp insert" ON public.conversation_participants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cp update own" ON public.conversation_participants FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "cp delete own" ON public.conversation_participants FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON public.messages(conversation_id, created_at DESC);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg read by participant" ON public.messages FOR SELECT TO authenticated USING (public.is_conv_participant(conversation_id, auth.uid()));
CREATE POLICY "msg insert by participant" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid() AND public.is_conv_participant(conversation_id, auth.uid()));

-- Trigger to bump conversations.last_message_at
CREATE OR REPLACE FUNCTION public.bump_conv_last_message()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_bump_conv ON public.messages;
CREATE TRIGGER trg_bump_conv AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.bump_conv_last_message();

-- Achievements catalog
CREATE TABLE IF NOT EXISTS public.achievements (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL DEFAULT 'trophy',
  tier text NOT NULL DEFAULT 'bronze'
);
GRANT SELECT ON public.achievements TO anon, authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements public read" ON public.achievements FOR SELECT USING (true);

INSERT INTO public.achievements (id, name, description, icon, tier) VALUES
  ('first_post', 'First Post', 'Shared your first supporter moment', 'sparkles', 'bronze'),
  ('first_event', 'First Event Joined', 'RSVP''d to your first event', 'calendar-days', 'bronze'),
  ('first_follow', 'Networker', 'Followed your first supporter', 'user-plus', 'bronze'),
  ('top_contributor', 'Top Contributor', '10+ posts', 'flame', 'silver'),
  ('super_supporter', 'Super Supporter', 'Attended 5+ events', 'trophy', 'gold'),
  ('world_cup_traveler', 'World Cup Traveler', 'Joined a tournament event', 'plane', 'gold'),
  ('vip_member', 'VIP Member', 'Joined the VIP tier', 'crown', 'gold')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_achievements (
  user_id uuid NOT NULL,
  achievement_id text NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);
GRANT SELECT, INSERT ON public.user_achievements TO authenticated;
GRANT SELECT ON public.user_achievements TO anon;
GRANT ALL ON public.user_achievements TO service_role;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ua public read" ON public.user_achievements FOR SELECT USING (true);
CREATE POLICY "ua self insert" ON public.user_achievements FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Reports
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('post','comment','user','event')),
  target_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports self insert" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "reports admin read" ON public.reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "reports admin update" ON public.reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Notifications: allow inserts so app + triggers can write
DROP POLICY IF EXISTS "Notifications insert" ON public.notifications;
CREATE POLICY "Notifications insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
GRANT INSERT ON public.notifications TO authenticated;

-- Enable realtime for messages + conversations
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
