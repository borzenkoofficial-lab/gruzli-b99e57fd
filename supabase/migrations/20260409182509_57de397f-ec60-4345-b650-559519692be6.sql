
-- Reviews table for dispatchers
CREATE TABLE public.dispatcher_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id uuid NOT NULL,
  dispatcher_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reviewer_id, dispatcher_id)
);

ALTER TABLE public.dispatcher_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view reviews"
  ON public.dispatcher_reviews FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Workers can create reviews"
  ON public.dispatcher_reviews FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY "Authors can update own reviews"
  ON public.dispatcher_reviews FOR UPDATE
  TO authenticated USING (auth.uid() = reviewer_id);

CREATE POLICY "Authors can delete own reviews"
  ON public.dispatcher_reviews FOR DELETE
  TO authenticated USING (auth.uid() = reviewer_id);

-- Add verified field to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verified boolean DEFAULT false;
