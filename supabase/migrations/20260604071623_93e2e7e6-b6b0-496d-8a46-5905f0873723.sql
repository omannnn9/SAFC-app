
-- Internal World Cup 2026 fixtures table (no external API dependency).
CREATE TABLE public.world_cup_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_flag TEXT NOT NULL DEFAULT '🏳️',
  away_flag TEXT NOT NULL DEFAULT '🏳️',
  kickoff TIMESTAMPTZ NOT NULL,
  venue TEXT,
  city TEXT,
  stage TEXT NOT NULL DEFAULT 'group',
  group_name TEXT,
  home_score INT,
  away_score INT,
  winner TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.world_cup_matches TO anon;
GRANT SELECT ON public.world_cup_matches TO authenticated;
GRANT ALL ON public.world_cup_matches TO service_role;

ALTER TABLE public.world_cup_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wc_matches_public_read" ON public.world_cup_matches FOR SELECT USING (true);
CREATE POLICY "wc_matches_admin_write" ON public.world_cup_matches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_wc_matches_updated_at BEFORE UPDATE ON public.world_cup_matches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_wc_matches_kickoff ON public.world_cup_matches (kickoff);

-- Seed FIFA World Cup 2026 fixtures. Dates use official kickoff schedule.
-- All times stored UTC.
INSERT INTO public.world_cup_matches (home_team, away_team, home_flag, away_flag, kickoff, venue, city, stage, group_name) VALUES
-- Opening matches Jun 11–15
('Mexico','TBD','🇲🇽','🏳️','2026-06-11 23:00+00','Estadio Azteca','Mexico City','group','A'),
('Canada','TBD','🇨🇦','🏳️','2026-06-12 23:00+00','BMO Field','Toronto','group','B'),
('USA','TBD','🇺🇸','🏳️','2026-06-12 20:00+00','SoFi Stadium','Los Angeles','group','D'),
('Spain','Morocco','🇪🇸','🇲🇦','2026-06-13 19:00+00','MetLife Stadium','New York/New Jersey','group','E'),
('Argentina','TBD','🇦🇷','🏳️','2026-06-13 23:00+00','Hard Rock Stadium','Miami','group','C'),
('Brazil','TBD','🇧🇷','🏳️','2026-06-14 22:00+00','AT&T Stadium','Dallas','group','F'),
('France','TBD','🇫🇷','🏳️','2026-06-14 19:00+00','Mercedes-Benz Stadium','Atlanta','group','G'),
('Germany','TBD','🇩🇪','🏳️','2026-06-15 19:00+00','Lincoln Financial Field','Philadelphia','group','H'),
('England','TBD','🏴󠁧󠁢󠁥󠁮󠁧󠁿','🏳️','2026-06-15 22:00+00','NRG Stadium','Houston','group','I'),
('Portugal','TBD','🇵🇹','🏳️','2026-06-15 23:30+00','Arrowhead Stadium','Kansas City','group','J'),
('Netherlands','TBD','🇳🇱','🏳️','2026-06-16 19:00+00','Gillette Stadium','Boston','group','K'),
('Italy','TBD','🇮🇹','🏳️','2026-06-16 22:00+00','Levi''s Stadium','San Francisco Bay Area','group','L'),
-- Marquee group matches
('Brazil','Germany','🇧🇷','🇩🇪','2026-06-18 22:00+00','MetLife Stadium','New York/New Jersey','group','F'),
('Argentina','Spain','🇦🇷','🇪🇸','2026-06-19 23:00+00','Estadio Azteca','Mexico City','group','C'),
('France','Netherlands','🇫🇷','🇳🇱','2026-06-20 19:00+00','SoFi Stadium','Los Angeles','group','G'),
('England','Italy','🏴󠁧󠁢󠁥󠁮󠁧󠁿','🇮🇹','2026-06-21 22:00+00','AT&T Stadium','Dallas','group','I'),
('Portugal','Belgium','🇵🇹','🇧🇪','2026-06-22 19:00+00','BC Place','Vancouver','group','J'),
('USA','Mexico','🇺🇸','🇲🇽','2026-06-24 22:00+00','SoFi Stadium','Los Angeles','group','D'),
('Brazil','Argentina','🇧🇷','🇦🇷','2026-06-26 22:00+00','MetLife Stadium','New York/New Jersey','group','F'),
-- Knockout placeholders
('Winner Group A','Runner-up Group B','🏳️','🏳️','2026-06-29 19:00+00','Lincoln Financial Field','Philadelphia','r32',NULL),
('Winner Group C','Runner-up Group D','🏳️','🏳️','2026-06-30 22:00+00','Mercedes-Benz Stadium','Atlanta','r32',NULL),
('Winner Group E','Runner-up Group F','🏳️','🏳️','2026-07-01 22:00+00','Hard Rock Stadium','Miami','r32',NULL),
('Winner Group G','Runner-up Group H','🏳️','🏳️','2026-07-02 22:00+00','NRG Stadium','Houston','r32',NULL),
('R16 Match 1','R16 Match 2','🏳️','🏳️','2026-07-04 19:00+00','AT&T Stadium','Dallas','r16',NULL),
('R16 Match 3','R16 Match 4','🏳️','🏳️','2026-07-05 22:00+00','SoFi Stadium','Los Angeles','r16',NULL),
('QF Winner 1','QF Winner 2','🏳️','🏳️','2026-07-09 22:00+00','MetLife Stadium','New York/New Jersey','qf',NULL),
('QF Winner 3','QF Winner 4','🏳️','🏳️','2026-07-11 19:00+00','Mercedes-Benz Stadium','Atlanta','qf',NULL),
('SF Winner 1','SF Winner 2','🏳️','🏳️','2026-07-14 22:00+00','AT&T Stadium','Dallas','sf',NULL),
('SF Winner 3','SF Winner 4','🏳️','🏳️','2026-07-15 22:00+00','Hard Rock Stadium','Miami','sf',NULL),
('SF Loser 1','SF Loser 2','🏳️','🏳️','2026-07-18 19:00+00','Hard Rock Stadium','Miami','third',NULL),
('Finalist 1','Finalist 2','🏳️','🏳️','2026-07-19 19:00+00','MetLife Stadium','New York/New Jersey','final',NULL);
