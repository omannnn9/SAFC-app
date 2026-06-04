GRANT SELECT, INSERT, UPDATE, DELETE ON public.world_cup_matches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.world_cup_country_flags TO authenticated;
GRANT ALL ON public.world_cup_matches TO service_role;
GRANT ALL ON public.world_cup_country_flags TO service_role;