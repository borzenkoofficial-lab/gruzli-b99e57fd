
-- Create app_settings table
CREATE TABLE public.app_settings (
  id text NOT NULL PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read settings"
ON public.app_settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can insert settings"
ON public.app_settings FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update settings"
ON public.app_settings FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete settings"
ON public.app_settings FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Seed default values
INSERT INTO public.app_settings (id, value) VALUES
  ('fake_subscribers', '{"count": 15247}'::jsonb),
  ('bot_jobs_enabled', '{"enabled": false}'::jsonb);

-- Add is_bot column to jobs
ALTER TABLE public.jobs ADD COLUMN is_bot boolean NOT NULL DEFAULT false;
