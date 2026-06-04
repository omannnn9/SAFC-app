
ALTER TABLE public.world_cup_matches
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.sync_wc_match_to_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ext text;
  _existing uuid;
  _title text;
  _stage_enum event_stage;
  _status text;
  _kickoff timestamptz;
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
  _status := CASE
    WHEN COALESCE(NEW.status_override, NEW.status) = 'live' THEN 'live'
    WHEN COALESCE(NEW.status_override, NEW.status) = 'finished' THEN 'finished'
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

  -- Find existing event (prefer link, fall back to external_id)
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
$$;

DROP TRIGGER IF EXISTS trg_sync_wc_match_to_event ON public.world_cup_matches;
CREATE TRIGGER trg_sync_wc_match_to_event
  BEFORE INSERT OR UPDATE ON public.world_cup_matches
  FOR EACH ROW EXECUTE FUNCTION public.sync_wc_match_to_event();

DROP TRIGGER IF EXISTS trg_sync_wc_match_delete_event ON public.world_cup_matches;
CREATE TRIGGER trg_sync_wc_match_delete_event
  AFTER DELETE ON public.world_cup_matches
  FOR EACH ROW EXECUTE FUNCTION public.sync_wc_match_to_event();

-- Backfill: touch every match so trigger runs
UPDATE public.world_cup_matches SET updated_at = now();
