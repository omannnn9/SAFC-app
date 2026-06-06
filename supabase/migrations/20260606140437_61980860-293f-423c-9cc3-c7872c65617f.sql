GRANT SELECT ON public.world_cup_matches TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.world_cup_matches TO authenticated;
GRANT ALL ON public.world_cup_matches TO service_role;

GRANT SELECT ON public.world_cup_country_flags TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.world_cup_country_flags TO authenticated;
GRANT ALL ON public.world_cup_country_flags TO service_role;