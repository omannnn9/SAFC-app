-- Sign in with Google: make the new-user trigger populate profile fields from
-- OAuth identity metadata (Google sends name/full_name + avatar_url/picture).
-- Preserves existing behaviour (base 'user' role + super-admin email grant) and
-- is idempotent/safe for users created via email OR OAuth.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_full_name text;
  v_avatar text;
BEGIN
  -- Google populates user_metadata with full_name/name + avatar_url/picture.
  v_full_name := COALESCE(
    NULLIF(meta->>'full_name', ''),
    NULLIF(meta->>'name', ''),
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    ''
  );
  v_avatar := COALESCE(NULLIF(meta->>'avatar_url', ''), NULLIF(meta->>'picture', ''));

  INSERT INTO public.profiles (id, full_name, phone, country, avatar_url)
  VALUES (
    NEW.id,
    v_full_name,
    meta->>'phone',
    COALESCE(NULLIF(meta->>'country', ''), 'South Africa'),
    v_avatar
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name  = CASE WHEN COALESCE(public.profiles.full_name, '') = ''
                      THEN EXCLUDED.full_name ELSE public.profiles.full_name END,
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url);

  -- Always give the base 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Auto-grant super admin (mapped to 'admin' enum value) by email
  IF lower(COALESCE(NEW.email, '')) = 'oman.dilloo@icloud.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
