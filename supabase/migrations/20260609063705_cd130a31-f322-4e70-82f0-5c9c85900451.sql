
ALTER TABLE public.world_cup_matches
  ADD COLUMN IF NOT EXISTS football_data_match_id bigint UNIQUE,
  ADD COLUMN IF NOT EXISTS football_data_home_team_id bigint,
  ADD COLUMN IF NOT EXISTS football_data_away_team_id bigint,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_wc_matches_fd_match_id ON public.world_cup_matches(football_data_match_id);

ALTER TABLE public.world_cup_matches DROP CONSTRAINT IF EXISTS world_cup_matches_status_check;
ALTER TABLE public.world_cup_matches DROP CONSTRAINT IF EXISTS world_cup_matches_status_override_check;
ALTER TABLE public.world_cup_matches
  ADD CONSTRAINT world_cup_matches_status_check
  CHECK (status = ANY (ARRAY['upcoming','live','finished','postponed','cancelled']));
ALTER TABLE public.world_cup_matches
  ADD CONSTRAINT world_cup_matches_status_override_check
  CHECK (status_override IS NULL OR status_override = ANY (ARRAY['upcoming','live','finished','postponed','cancelled']));

CREATE TABLE IF NOT EXISTS public.football_data_team_map (
  team_id bigint PRIMARY KEY,
  country_name text NOT NULL,
  short_name text,
  tla text,
  flag text,
  crest_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.football_data_team_map TO anon, authenticated;
GRANT ALL ON public.football_data_team_map TO service_role;
ALTER TABLE public.football_data_team_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_map_public_read" ON public.football_data_team_map FOR SELECT USING (true);
CREATE POLICY "team_map_admin_write" ON public.football_data_team_map FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.sync_wc_match_to_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _ext text;
  _existing uuid;
  _title text;
  _stage_enum event_stage;
  _status text;
  _kickoff timestamptz;
  _raw_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.event_id IS NOT NULL THEN
      DELETE FROM public.events WHERE id = OLD.event_id;
    ELSE
      DELETE FROM public.events WHERE external_id = 'wc:' || OLD.match_number::text;
    END IF;
    RETURN OLD;
  END IF;

  _ext := 'wc:' || NEW.match_number::text;
  _title := NEW.home_team || ' vs ' || NEW.away_team;
  _kickoff := COALESCE(NEW.kickoff_datetime_utc, NEW.kickoff);
  _raw_status := COALESCE(NEW.status_override, NEW.status);
  _status := CASE
    WHEN _raw_status = 'live' THEN 'live'
    WHEN _raw_status = 'finished' THEN 'finished'
    WHEN _raw_status = 'postponed' THEN 'postponed'
    WHEN _raw_status = 'cancelled' THEN 'cancelled'
    ELSE 'scheduled'
  END;

  BEGIN
    _stage_enum := CASE NEW.stage
      WHEN 'group' THEN 'group'::event_stage
      WHEN 'r32' THEN 'r32'::event_stage
      WHEN 'r16' THEN 'r16'::event_stage
      WHEN 'qf' THEN 'qf'::event_stage
      WHEN 'sf' THEN 'sf'::event_stage
      WHEN 'third' THEN 'third'::event_stage
      WHEN 'final' THEN 'final'::event_stage
      ELSE 'other'::event_stage
    END;
  EXCEPTION WHEN others THEN
    _stage_enum := 'other'::event_stage;
  END;

  IF NEW.event_id IS NOT NULL THEN
    SELECT id INTO _existing FROM public.events WHERE id = NEW.event_id;
  END IF;
  IF _existing IS NULL THEN
    SELECT id INTO _existing FROM public.events WHERE external_id = _ext;
  END IF;

  IF _existing IS NULL THEN
    INSERT INTO public.events (
      title, event_type, stage, competition,
      home_team, away_team, home_team_flag, away_team_flag,
      kickoff, venue, city, country,
      status, home_score, away_score, external_id, is_featured
    ) VALUES (
      _title, 'wc_match'::event_type, _stage_enum, 'FIFA World Cup 2026',
      NEW.home_team, NEW.away_team, NEW.home_flag, NEW.away_flag,
      _kickoff, NEW.venue, NEW.city, NULL,
      _status, NEW.home_score, NEW.away_score, _ext, false
    )
    RETURNING id INTO _existing;
  ELSE
    UPDATE public.events SET
      title = _title,
      event_type = 'wc_match'::event_type,
      stage = _stage_enum,
      competition = 'FIFA World Cup 2026',
      home_team = NEW.home_team,
      away_team = NEW.away_team,
      home_team_flag = NEW.home_flag,
      away_team_flag = NEW.away_flag,
      kickoff = _kickoff,
      venue = NEW.venue,
      city = NEW.city,
      status = _status,
      home_score = NEW.home_score,
      away_score = NEW.away_score,
      external_id = _ext,
      updated_at = now()
    WHERE id = _existing;
  END IF;

  IF NEW.event_id IS DISTINCT FROM _existing THEN
    NEW.event_id := _existing;
  END IF;

  RETURN NEW;
END;
$function$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.world_cup_matches;
