
CREATE TABLE public.app_ratings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.app_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own rating"
ON public.app_ratings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own ratings"
ON public.app_ratings FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all ratings"
ON public.app_ratings FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE INDEX idx_app_ratings_user ON public.app_ratings(user_id);
CREATE INDEX idx_app_ratings_created ON public.app_ratings(created_at DESC);
