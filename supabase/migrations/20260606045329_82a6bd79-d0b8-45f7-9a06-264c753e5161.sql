-- Backfill world_cup_matches from existing wc_match events so the public
-- /worldcup page (which reads world_cup_matches) shows everything that was
-- already imported into events.

INSERT INTO public.world_cup_matches (
  match_number, home_team, away_team, home_flag, away_flag,
  kickoff, kickoff_datetime_utc, venue, city, stage, group_name,
  home_score, away_score, status, event_id
)
SELECT
  ranked.rn AS match_number,
  ranked.home_team,
  ranked.away_team,
  COALESCE(NULLIF(ranked.home_team_flag, ''), '🏳️'),
  COALESCE(NULLIF(ranked.away_team_flag, ''), '🏳️'),
  ranked.kickoff,
  ranked.kickoff,
  ranked.venue,
  ranked.city,
  CASE ranked.stage::text
    WHEN 'group' THEN 'group'
    WHEN 'r32' THEN 'r32'
    WHEN 'r16' THEN 'r16'
    WHEN 'qf'  THEN 'qf'
    WHEN 'sf'  THEN 'sf'
    WHEN 'third' THEN 'third'
    WHEN 'final' THEN 'final'
    ELSE 'group'
  END,
  ranked.description,
  ranked.home_score,
  ranked.away_score,
  CASE ranked.status
    WHEN 'live' THEN 'live'
    WHEN 'finished' THEN 'finished'
    ELSE 'upcoming'
  END,
  ranked.id
FROM (
  SELECT e.*, ROW_NUMBER() OVER (ORDER BY e.kickoff ASC, e.id ASC) AS rn
  FROM public.events e
  WHERE e.event_type = 'wc_match'
    AND NOT EXISTS (
      SELECT 1 FROM public.world_cup_matches w WHERE w.event_id = e.id
    )
) ranked
WHERE ranked.rn <= 104
ON CONFLICT (match_number) DO NOTHING;