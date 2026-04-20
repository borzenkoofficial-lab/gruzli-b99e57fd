-- 1. Add recovery_code to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS recovery_code text UNIQUE;

-- 2. Function to generate a unique 10-char recovery code
CREATE OR REPLACE FUNCTION public.generate_recovery_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text;
  done bool := false;
  i int;
BEGIN
  WHILE NOT done LOOP
    result := '';
    FOR i IN 1..10 LOOP
      result := result || substr(chars, (floor(random() * length(chars)) + 1)::int, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE recovery_code = result) THEN
      done := true;
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

-- 3. Trigger to auto-fill recovery_code on profile insert
CREATE OR REPLACE FUNCTION public.set_recovery_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.recovery_code IS NULL THEN
    NEW.recovery_code := public.generate_recovery_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_recovery_code ON public.profiles;
CREATE TRIGGER trg_profiles_recovery_code
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_recovery_code();

-- 4. Backfill recovery codes for existing profiles
UPDATE public.profiles
SET recovery_code = public.generate_recovery_code()
WHERE recovery_code IS NULL;

-- 5. RLS: users can read own recovery_code (already covered by SELECT policy on profiles which is `true`)
-- Recovery_code is part of profiles row; admins can see via admin_list_users update below.

-- 6. Admin: get a user's recovery code (admin only)
CREATE OR REPLACE FUNCTION public.admin_get_user_recovery_code(_target_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  SELECT recovery_code INTO v_code FROM public.profiles WHERE user_id = _target_user_id;
  RETURN v_code;
END;
$$;

-- 7. Update admin_list_users to include email and recovery_code
DROP FUNCTION IF EXISTS public.admin_list_users();
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(
  user_id uuid,
  full_name text,
  phone text,
  email text,
  recovery_code text,
  avatar_url text,
  rating numeric,
  completed_orders integer,
  balance integer,
  verified boolean,
  blocked boolean,
  role text,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.full_name,
    p.phone,
    u.email::text,
    p.recovery_code,
    p.avatar_url,
    p.rating,
    p.completed_orders,
    p.balance,
    p.verified,
    p.blocked,
    ur.role::text,
    p.created_at
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
  LEFT JOIN auth.users u ON u.id = p.user_id
  WHERE public.is_admin(auth.uid())
  ORDER BY p.created_at DESC
$$;