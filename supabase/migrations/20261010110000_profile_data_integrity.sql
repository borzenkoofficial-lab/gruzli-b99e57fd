-- Make profile data a reliable source of truth for the UI.
-- Personal fields are copied from sign-up metadata inside the auth trigger so they
-- are persisted even when email confirmation means the browser has no session yet.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role text := lower(coalesce(NEW.raw_user_meta_data->>'role', 'worker'));
  safe_role public.app_role;
  v_birth_date date;
BEGIN
  IF NULLIF(trim(NEW.raw_user_meta_data->>'birth_date'), '') IS NOT NULL THEN
    BEGIN
      v_birth_date := (NEW.raw_user_meta_data->>'birth_date')::date;
    EXCEPTION WHEN others THEN
      v_birth_date := NULL;
    END;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, phone, birth_date)
  VALUES (
    NEW.id,
    coalesce(nullif(trim(NEW.raw_user_meta_data->>'full_name'), ''), ''),
    coalesce(nullif(trim(NEW.raw_user_meta_data->>'phone'), ''), ''),
    v_birth_date
  );

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

-- Repair missing registration fields on existing accounts from their auth metadata.
-- This is intentionally one-way: populated profile fields are not overwritten.
CREATE OR REPLACE FUNCTION public._gruzli_try_parse_birth_date(p_value text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog, public
AS $profile_birthdate$
BEGIN
  RETURN NULLIF(trim(p_value), '')::date;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$profile_birthdate$;

UPDATE public.profiles AS p
SET
  full_name = COALESCE(NULLIF(trim(p.full_name), ''), NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''), ''),
  phone = COALESCE(NULLIF(trim(p.phone), ''), NULLIF(trim(u.raw_user_meta_data->>'phone'), ''), ''),
  birth_date = COALESCE(p.birth_date, public._gruzli_try_parse_birth_date(u.raw_user_meta_data->>'birth_date'))
FROM auth.users AS u
WHERE u.id = p.user_id
  AND (
    (NULLIF(trim(p.full_name), '') IS NULL AND NULLIF(trim(u.raw_user_meta_data->>'full_name'), '') IS NOT NULL)
    OR (NULLIF(trim(p.phone), '') IS NULL AND NULLIF(trim(u.raw_user_meta_data->>'phone'), '') IS NOT NULL)
    OR (p.birth_date IS NULL AND public._gruzli_try_parse_birth_date(u.raw_user_meta_data->>'birth_date') IS NOT NULL)
  );

INSERT INTO public.profiles (user_id, full_name, phone, birth_date)
SELECT
  u.id,
  COALESCE(NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''), ''),
  COALESCE(NULLIF(trim(u.raw_user_meta_data->>'phone'), ''), ''),
  public._gruzli_try_parse_birth_date(u.raw_user_meta_data->>'birth_date')
FROM auth.users AS u
LEFT JOIN public.profiles AS p ON p.user_id = u.id
WHERE p.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

DROP FUNCTION public._gruzli_try_parse_birth_date(text);

-- A profile's rating must reflect ratings earned through completed work.
-- A default 5.00 was misleading: it made new/unreviewed accounts look rated.
ALTER TABLE public.profiles
  ALTER COLUMN rating DROP DEFAULT;

UPDATE public.profiles AS p
SET rating = CASE
  WHEN EXISTS (
    SELECT 1 FROM public.user_roles AS ur
    WHERE ur.user_id = p.user_id AND ur.role = 'worker'
  ) THEN (
    SELECT round(avg(jr.dispatcher_review_rating)::numeric, 2)::numeric(3,2)
    FROM public.job_responses AS jr
    WHERE jr.worker_id = p.user_id
      AND jr.dispatcher_review_rating IS NOT NULL
  )
  WHEN EXISTS (
    SELECT 1 FROM public.user_roles AS ur
    WHERE ur.user_id = p.user_id AND ur.role = 'dispatcher'
  ) THEN (
    SELECT round(avg(dr.rating)::numeric, 2)::numeric(3,2)
    FROM public.dispatcher_reviews AS dr
    WHERE dr.dispatcher_id = p.user_id
  )
  ELSE NULL
END;

CREATE OR REPLACE FUNCTION public.sync_worker_profile_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_worker_id := OLD.worker_id;
  ELSE
    v_worker_id := NEW.worker_id;
  END IF;

  UPDATE public.profiles AS p
  SET rating = (
    SELECT round(avg(jr.dispatcher_review_rating)::numeric, 2)::numeric(3,2)
    FROM public.job_responses AS jr
    WHERE jr.worker_id = v_worker_id
      AND jr.dispatcher_review_rating IS NOT NULL
  )
  WHERE p.user_id = v_worker_id;

  IF TG_OP = 'UPDATE' AND OLD.worker_id IS DISTINCT FROM NEW.worker_id THEN
    UPDATE public.profiles AS p
    SET rating = (
      SELECT round(avg(jr.dispatcher_review_rating)::numeric, 2)::numeric(3,2)
      FROM public.job_responses AS jr
      WHERE jr.worker_id = OLD.worker_id
        AND jr.dispatcher_review_rating IS NOT NULL
    )
    WHERE p.user_id = OLD.worker_id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_worker_rating_after_review_update ON public.job_responses;
CREATE TRIGGER sync_worker_rating_after_review_update
AFTER UPDATE OF dispatcher_review_rating ON public.job_responses
FOR EACH ROW
WHEN (OLD.dispatcher_review_rating IS DISTINCT FROM NEW.dispatcher_review_rating)
EXECUTE FUNCTION public.sync_worker_profile_rating();

DROP TRIGGER IF EXISTS sync_worker_rating_after_review_delete ON public.job_responses;
CREATE TRIGGER sync_worker_rating_after_review_delete
AFTER DELETE ON public.job_responses
FOR EACH ROW
WHEN (OLD.dispatcher_review_rating IS NOT NULL)
EXECUTE FUNCTION public.sync_worker_profile_rating();

CREATE OR REPLACE FUNCTION public.sync_dispatcher_profile_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispatcher_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_dispatcher_id := OLD.dispatcher_id;
  ELSE
    v_dispatcher_id := NEW.dispatcher_id;
  END IF;

  UPDATE public.profiles AS p
  SET rating = (
    SELECT round(avg(dr.rating)::numeric, 2)::numeric(3,2)
    FROM public.dispatcher_reviews AS dr
    WHERE dr.dispatcher_id = v_dispatcher_id
  )
  WHERE p.user_id = v_dispatcher_id;

  IF TG_OP = 'UPDATE' AND OLD.dispatcher_id IS DISTINCT FROM NEW.dispatcher_id THEN
    UPDATE public.profiles AS p
    SET rating = (
      SELECT round(avg(dr.rating)::numeric, 2)::numeric(3,2)
      FROM public.dispatcher_reviews AS dr
      WHERE dr.dispatcher_id = OLD.dispatcher_id
    )
    WHERE p.user_id = OLD.dispatcher_id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_dispatcher_rating_after_review_change ON public.dispatcher_reviews;
CREATE TRIGGER sync_dispatcher_rating_after_review_change
AFTER INSERT OR UPDATE OR DELETE ON public.dispatcher_reviews
FOR EACH ROW
EXECUTE FUNCTION public.sync_dispatcher_profile_rating();
