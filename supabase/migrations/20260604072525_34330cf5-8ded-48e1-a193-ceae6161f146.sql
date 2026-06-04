CREATE TABLE IF NOT EXISTS public.world_cup_country_flags (
  country_name TEXT PRIMARY KEY,
  flag TEXT NOT NULL,
  is_placeholder BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.world_cup_country_flags TO anon;
GRANT SELECT ON public.world_cup_country_flags TO authenticated;
GRANT ALL ON public.world_cup_country_flags TO service_role;

ALTER TABLE public.world_cup_country_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wc_country_flags_public_read" ON public.world_cup_country_flags;
CREATE POLICY "wc_country_flags_public_read" ON public.world_cup_country_flags
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "wc_country_flags_admin_write" ON public.world_cup_country_flags;
CREATE POLICY "wc_country_flags_admin_write" ON public.world_cup_country_flags
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.world_cup_matches
  ADD COLUMN IF NOT EXISTS match_number INTEGER,
  ADD COLUMN IF NOT EXISTS kickoff_datetime_utc TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'upcoming',
  ADD COLUMN IF NOT EXISTS status_override TEXT;

UPDATE public.world_cup_matches
SET kickoff_datetime_utc = COALESCE(kickoff_datetime_utc, kickoff),
    match_number = COALESCE(match_number, numbered.rn),
    status = COALESCE(status, 'upcoming')
FROM (
  SELECT id, row_number() OVER (ORDER BY kickoff, id)::int AS rn
  FROM public.world_cup_matches
) AS numbered
WHERE public.world_cup_matches.id = numbered.id;

ALTER TABLE public.world_cup_matches
  ALTER COLUMN kickoff_datetime_utc SET NOT NULL,
  ALTER COLUMN match_number SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'world_cup_matches_match_number_key'
  ) THEN
    ALTER TABLE public.world_cup_matches
      ADD CONSTRAINT world_cup_matches_match_number_key UNIQUE (match_number);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'world_cup_matches_match_number_range'
  ) THEN
    ALTER TABLE public.world_cup_matches
      ADD CONSTRAINT world_cup_matches_match_number_range CHECK (match_number BETWEEN 1 AND 104);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'world_cup_matches_status_check'
  ) THEN
    ALTER TABLE public.world_cup_matches
      ADD CONSTRAINT world_cup_matches_status_check CHECK (status IN ('upcoming', 'live', 'finished'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'world_cup_matches_status_override_check'
  ) THEN
    ALTER TABLE public.world_cup_matches
      ADD CONSTRAINT world_cup_matches_status_override_check CHECK (status_override IS NULL OR status_override IN ('upcoming', 'live', 'finished'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wc_matches_match_number ON public.world_cup_matches (match_number);
CREATE INDEX IF NOT EXISTS idx_wc_matches_kickoff_utc ON public.world_cup_matches (kickoff_datetime_utc);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_wc_country_flags_updated_at'
  ) THEN
    CREATE TRIGGER trg_wc_country_flags_updated_at
      BEFORE UPDATE ON public.world_cup_country_flags
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_wc_matches_updated_at'
  ) THEN
    CREATE TRIGGER trg_wc_matches_updated_at
      BEFORE UPDATE ON public.world_cup_matches
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;