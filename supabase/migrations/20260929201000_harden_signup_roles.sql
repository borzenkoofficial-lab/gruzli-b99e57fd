-- Never trust arbitrary auth metadata for privileged roles.
-- Public signup may choose only the three product roles. Admin is assigned out of band.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role text := lower(coalesce(NEW.raw_user_meta_data->>'role', 'worker'));
  safe_role public.app_role;
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  IF requested_role IN ('client', 'worker', 'dispatcher') THEN
    safe_role := requested_role::public.app_role;
  ELSE
    safe_role := 'worker';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, safe_role);

  RETURN NEW;
END;
$$;
