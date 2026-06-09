
-- 1) Prevent privilege escalation: subscriptions table is server-only writable.
DROP POLICY IF EXISTS "Subscriptions self update" ON public.subscriptions;
DROP POLICY IF EXISTS "Subscriptions self insert" ON public.subscriptions;

-- 2) Prevent direct notification spoofing: only the create_notification RPC
--    (SECURITY DEFINER) or service_role may insert notifications.
DROP POLICY IF EXISTS "Notifications insert" ON public.notifications;

-- 3) Restrict private groups & their member lists.
DROP POLICY IF EXISTS "Groups public read" ON public.groups;
CREATE POLICY "Groups read non-private or member"
  ON public.groups
  FOR SELECT
  TO anon, authenticated
  USING (
    COALESCE(is_private, false) = false
    OR auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = groups.id AND gm.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Group members public read" ON public.group_members;
CREATE POLICY "Group members read if group visible"
  ON public.group_members
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_members.group_id
        AND (
          COALESCE(g.is_private, false) = false
          OR auth.uid() = g.owner_id
          OR EXISTS (
            SELECT 1 FROM public.group_members gm2
            WHERE gm2.group_id = g.id AND gm2.user_id = auth.uid()
          )
          OR public.has_role(auth.uid(), 'admin'::app_role)
        )
    )
  );

-- 4) Profile visits: must be signed in (no anonymous visit logging).
DROP POLICY IF EXISTS "Visits anyone insert" ON public.profile_visits;
CREATE POLICY "Visits authenticated insert"
  ON public.profile_visits
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
