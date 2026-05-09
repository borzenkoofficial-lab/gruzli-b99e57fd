
-- ============================================================
-- BLOCK A: Critical RLS hardening
-- ============================================================

-- 1) PROFILES: hide sensitive fields from cross-user reads
-- Public view (no phone/inn/birth_date/balance/total_earned/recovery_code)
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT
  user_id,
  full_name,
  avatar_url,
  rating,
  completed_orders,
  verified,
  blocked,
  is_premium,
  skills,
  last_seen_at,
  display_id,
  is_self_employed,
  created_at,
  updated_at,
  premium_until,
  availability
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated, anon;

-- Tighten base table SELECT
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

-- Counterparty in accepted job: dispatcher<->worker can see each other's profile (for contract/docs/phone)
CREATE POLICY "Accepted job counterparties view profile"
ON public.profiles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.job_responses jr
    JOIN public.jobs j ON j.id = jr.job_id
    WHERE jr.status = 'accepted'
      AND (
        (jr.worker_id = profiles.user_id AND j.dispatcher_id = auth.uid())
        OR (j.dispatcher_id = profiles.user_id AND jr.worker_id = auth.uid())
      )
  )
);

-- 2) USER_ROLES: hide admin role from non-admins
DROP POLICY IF EXISTS "Authenticated can read any role" ON public.user_roles;

CREATE POLICY "Read non-admin roles or own"
ON public.user_roles FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR role <> 'admin'::app_role
  OR public.is_admin(auth.uid())
);

-- Helper RPC for "support user id" lookups
CREATE OR REPLACE FUNCTION public.get_support_user_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.user_roles
  WHERE role = 'admin'::app_role
  ORDER BY id LIMIT 1
$$;

-- 3) STORAGE: chat-media upload must be conversation participant
DROP POLICY IF EXISTS "Authenticated can upload chat media" ON storage.objects;

CREATE POLICY "Participants can upload chat media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND auth.uid() IS NOT NULL
  AND (
    -- {conversation_id}/...
    (
      (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND public.is_conversation_participant(((storage.foldername(name))[1])::uuid, auth.uid())
    )
    OR
    -- voice/{conversation_id}/...
    (
      (storage.foldername(name))[1] = 'voice'
      AND (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND public.is_conversation_participant(((storage.foldername(name))[2])::uuid, auth.uid())
    )
  )
);

-- 4) STORAGE: kartoteka-photos upload — at least require authenticated user
DROP POLICY IF EXISTS "Authenticated users can upload kartoteka photos" ON storage.objects;

CREATE POLICY "Authenticated upload kartoteka photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'kartoteka-photos'
  AND auth.uid() IS NOT NULL
);
