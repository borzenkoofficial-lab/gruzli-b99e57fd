-- Add is_official flag to jobs
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS is_official boolean NOT NULL DEFAULT false;

-- Replace insert policy: allow dispatcher OR admin
DROP POLICY IF EXISTS "Dispatchers can create jobs" ON public.jobs;

CREATE POLICY "Dispatchers and admins can create jobs"
ON public.jobs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = dispatcher_id
  AND (
    public.has_role(auth.uid(), 'dispatcher'::app_role)
    OR public.is_admin(auth.uid())
  )
);

-- Allow admins to update/delete any job (in addition to owner)
DROP POLICY IF EXISTS "Admins can update any job" ON public.jobs;
CREATE POLICY "Admins can update any job"
ON public.jobs
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete any job" ON public.jobs;
CREATE POLICY "Admins can delete any job"
ON public.jobs
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Trigger: auto-mark admin-created jobs as official
CREATE OR REPLACE FUNCTION public.mark_admin_job_official()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin(NEW.dispatcher_id) THEN
    NEW.is_official := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_admin_job_official ON public.jobs;
CREATE TRIGGER trg_mark_admin_job_official
BEFORE INSERT ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.mark_admin_job_official();