
-- Add blocked column if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false;

-- Helper: check admin by text comparison (avoids enum cast issues)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = 'admin'
  )
$$;

-- Admin: list all users
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(
  user_id uuid,
  full_name text,
  phone text,
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
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.full_name,
    p.phone,
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
  WHERE public.is_admin(auth.uid())
  ORDER BY p.created_at DESC
$$;

-- Admin: set verified
CREATE OR REPLACE FUNCTION public.admin_set_verified(_target_user_id uuid, _verified boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  UPDATE public.profiles SET verified = _verified WHERE user_id = _target_user_id;
END;
$$;

-- Admin: update balance
CREATE OR REPLACE FUNCTION public.admin_update_balance(_target_user_id uuid, _amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  UPDATE public.profiles SET balance = COALESCE(balance, 0) + _amount WHERE user_id = _target_user_id;
END;
$$;

-- Admin: set blocked
CREATE OR REPLACE FUNCTION public.admin_set_blocked(_target_user_id uuid, _blocked boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  UPDATE public.profiles SET blocked = _blocked WHERE user_id = _target_user_id;
END;
$$;

-- Admin RLS policies
CREATE POLICY "Admins can view all conversations"
ON public.conversations FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can view all messages"
ON public.messages FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can view all participants"
ON public.conversation_participants FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));
