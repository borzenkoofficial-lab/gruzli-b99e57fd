-- Broadcasts table
CREATE TABLE public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  text text NOT NULL DEFAULT '',
  link_url text,
  link_label text,
  image_url text,
  target_personal boolean NOT NULL DEFAULT true,
  target_channels boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  total_targets integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view broadcasts"
  ON public.broadcasts FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert broadcasts"
  ON public.broadcasts FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) AND auth.uid() = created_by);

CREATE POLICY "Service role manages broadcasts"
  ON public.broadcasts FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_broadcasts_created_at ON public.broadcasts (created_at DESC);

-- Storage bucket for broadcast media
INSERT INTO storage.buckets (id, name, public)
VALUES ('broadcast-media', 'broadcast-media', true)
ON CONFLICT (id) DO NOTHING;

-- Public read for broadcast media
CREATE POLICY "Broadcast media public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'broadcast-media');

-- Admins can upload
CREATE POLICY "Admins upload broadcast media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'broadcast-media' AND public.is_admin(auth.uid()));

-- Admins can delete
CREATE POLICY "Admins delete broadcast media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'broadcast-media' AND public.is_admin(auth.uid()));