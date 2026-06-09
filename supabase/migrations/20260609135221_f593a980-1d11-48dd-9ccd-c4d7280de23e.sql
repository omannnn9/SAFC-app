
CREATE TABLE public.membership_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT ON public.membership_waitlist TO authenticated;
GRANT ALL ON public.membership_waitlist TO service_role;

ALTER TABLE public.membership_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own waitlist"
  ON public.membership_waitlist FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users read own waitlist"
  ON public.membership_waitlist FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
