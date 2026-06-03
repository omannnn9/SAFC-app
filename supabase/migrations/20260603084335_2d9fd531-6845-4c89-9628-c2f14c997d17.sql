
-- 1. Profiles: anonymization fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 2. Comments: support edit timestamp
ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Trigger to bump updated_at on comments
DROP TRIGGER IF EXISTS post_comments_set_updated_at ON public.post_comments;
CREATE TRIGGER post_comments_set_updated_at
  BEFORE UPDATE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Allow owners to update their own comments (only existing policies are insert/delete/read)
DROP POLICY IF EXISTS "Comments self update" ON public.post_comments;
CREATE POLICY "Comments self update"
  ON public.post_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Cascade deletes for post children (do nothing if FK already exists)
DO $$ BEGIN
  ALTER TABLE public.post_likes
    ADD CONSTRAINT post_likes_post_id_fkey FOREIGN KEY (post_id)
    REFERENCES public.posts(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.post_saves
    ADD CONSTRAINT post_saves_post_id_fkey FOREIGN KEY (post_id)
    REFERENCES public.posts(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.post_shares
    ADD CONSTRAINT post_shares_post_id_fkey FOREIGN KEY (post_id)
    REFERENCES public.posts(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.post_comments
    ADD CONSTRAINT post_comments_post_id_fkey FOREIGN KEY (post_id)
    REFERENCES public.posts(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
