
-- 1. conversation_participants: restrict INSERT
DROP POLICY IF EXISTS "cp insert" ON public.conversation_participants;
CREATE POLICY "cp insert" ON public.conversation_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_conv_participant(conversation_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.created_by = auth.uid()
    )
  );

-- 2. notifications: only self-insert at policy level; cross-user via SECURITY DEFINER fn
DROP POLICY IF EXISTS "Notifications insert" ON public.notifications;
CREATE POLICY "Notifications insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id uuid,
  _type text,
  _title text,
  _body text DEFAULT NULL,
  _link text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _actor uuid := auth.uid();
BEGIN
  IF _actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _user_id IS NULL OR _user_id = _actor THEN
    RETURN NULL;
  END IF;
  IF length(coalesce(_title,'')) = 0 OR length(_title) > 200 THEN
    RAISE EXCEPTION 'Invalid title';
  END IF;
  IF length(coalesce(_type,'')) = 0 OR length(_type) > 80 THEN
    RAISE EXCEPTION 'Invalid type';
  END IF;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (_user_id, _type, _title, _body, _link)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_notification(uuid,text,text,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid,text,text,text,text) TO authenticated;

-- 3. post_saves & post_shares: restrict SELECT to owner
DROP POLICY IF EXISTS "post_saves read" ON public.post_saves;
CREATE POLICY "post_saves read own" ON public.post_saves
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "post_shares read" ON public.post_shares;
CREATE POLICY "post_shares read own" ON public.post_shares
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 4. news_articles: paywall premium content
CREATE OR REPLACE FUNCTION public.has_active_premium(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_premium FROM public.profiles WHERE id = _user_id),
    false
  );
$$;
REVOKE ALL ON FUNCTION public.has_active_premium(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_active_premium(uuid) TO authenticated;

DROP POLICY IF EXISTS "News public read" ON public.news_articles;
CREATE POLICY "News public read free" ON public.news_articles
  FOR SELECT TO anon, authenticated
  USING (
    is_premium = false
    OR (auth.uid() IS NOT NULL AND public.has_active_premium(auth.uid()))
  );

-- 5. profiles: hide phone from anonymous visitors via column-level grant
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (
  id, full_name, username, avatar_url, cover_url, bio,
  country, city, favourite_team, plan, is_premium,
  is_private, interests, created_at
) ON public.profiles TO anon;

-- 6. user_achievements: limit self-grants to safe whitelist
DROP POLICY IF EXISTS "ua self insert" ON public.user_achievements;
CREATE POLICY "ua self insert basic" ON public.user_achievements
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND achievement_id IN ('first_follow','first_event')
  );

CREATE OR REPLACE FUNCTION public.grant_supporter_achievement(_plan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_premium boolean;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _plan NOT IN ('bronze','silver','gold') THEN
    RAISE EXCEPTION 'Invalid plan';
  END IF;
  SELECT is_premium INTO _is_premium FROM public.profiles WHERE id = _uid;
  IF NOT COALESCE(_is_premium, false) AND _plan <> 'bronze' THEN
    RAISE EXCEPTION 'Not a premium member';
  END IF;
  INSERT INTO public.user_achievements (user_id, achievement_id)
  VALUES (_uid, _plan || '_supporter')
  ON CONFLICT DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.grant_supporter_achievement(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.grant_supporter_achievement(text) TO authenticated;
