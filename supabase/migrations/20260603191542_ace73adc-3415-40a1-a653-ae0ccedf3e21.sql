
-- Event chats: one per event, members are RSVP'd users.

CREATE TABLE public.event_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.event_chats TO authenticated;
GRANT ALL ON public.event_chats TO service_role;
ALTER TABLE public.event_chats ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.event_chat_members (
  chat_id uuid NOT NULL REFERENCES public.event_chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, user_id)
);
GRANT SELECT, UPDATE ON public.event_chat_members TO authenticated;
GRANT ALL ON public.event_chat_members TO service_role;
ALTER TABLE public.event_chat_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.event_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.event_chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.event_chat_messages TO authenticated;
GRANT ALL ON public.event_chat_messages TO service_role;
ALTER TABLE public.event_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX event_chat_messages_chat_created_idx
  ON public.event_chat_messages (chat_id, created_at);

-- Membership helper (SECURITY DEFINER avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_event_chat_member(_chat uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_chat_members WHERE chat_id = _chat AND user_id = _user
  );
$$;

-- RLS: chats visible to members + super_admin
CREATE POLICY "event_chats select members or admin"
ON public.event_chats FOR SELECT TO authenticated
USING (
  public.is_event_chat_member(id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- Members: a user can see other members of chats they belong to; admins see all
CREATE POLICY "event_chat_members select if comember or admin"
ON public.event_chat_members FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_event_chat_member(chat_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "event_chat_members update own last_read"
ON public.event_chat_members FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Messages: members read & send; admins read all
CREATE POLICY "event_chat_messages select members or admin"
ON public.event_chat_messages FOR SELECT TO authenticated
USING (
  public.is_event_chat_member(chat_id, auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "event_chat_messages insert as self if member"
ON public.event_chat_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.is_event_chat_member(chat_id, auth.uid())
);

-- Bump last_message_at on insert
CREATE OR REPLACE FUNCTION public.bump_event_chat_last_message()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.event_chats SET last_message_at = NEW.created_at WHERE id = NEW.chat_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_bump_event_chat_last
AFTER INSERT ON public.event_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.bump_event_chat_last_message();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_chat_members;
