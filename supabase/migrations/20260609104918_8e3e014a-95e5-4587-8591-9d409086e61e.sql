
-- Remove duplicates / legacy
DELETE FROM public.user_achievements WHERE achievement_id IN ('wc_traveler','vip_member');
DELETE FROM public.achievements WHERE id IN ('wc_traveler','vip_member');

-- Re-tag tiers and rename legacy supporter achievements
UPDATE public.achievements SET tier = 'free' WHERE id IN ('first_post','first_event','first_follow');

UPDATE public.achievements
  SET name = 'Basic Member', description = 'Joined SAFC Basic', tier = 'basic', icon = 'shield'
  WHERE id = 'bronze_supporter';

UPDATE public.achievements
  SET name = 'Premium Member', description = 'Upgraded to SAFC Premium', tier = 'premium', icon = 'star'
  WHERE id = 'silver_supporter';

UPDATE public.achievements
  SET name = 'Founding Member', description = 'Part of the Starting XI — limited to 111 supporters', tier = 'founder', icon = 'crown'
  WHERE id = 'gold_supporter';

UPDATE public.achievements SET tier = 'basic' WHERE id = 'top_contributor';
UPDATE public.achievements SET tier = 'premium' WHERE id IN ('super_supporter','world_cup_traveler');
