CREATE OR REPLACE FUNCTION public.bump_conv_last_message()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_conv ON public.messages;
CREATE TRIGGER trg_bump_conv
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.bump_conv_last_message();

CREATE OR REPLACE FUNCTION public.bump_event_chat_last_message()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.event_chats
  SET last_message_at = NEW.created_at
  WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_event_chat_last ON public.event_chat_messages;
CREATE TRIGGER trg_bump_event_chat_last
AFTER INSERT ON public.event_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.bump_event_chat_last_message();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication p
    JOIN pg_publication_rel pr ON pr.prpubid = p.oid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'event_attendees'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_attendees;
  END IF;
END $$;