
CREATE TABLE public.kartoteka (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL,
  target_user_id UUID,
  full_name TEXT NOT NULL DEFAULT '',
  birth_year INTEGER,
  description TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  social_links TEXT[] DEFAULT '{}',
  photo_url TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.kartoteka ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view kartoteka"
  ON public.kartoteka FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can create kartoteka entries"
  ON public.kartoteka FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update own kartoteka entries"
  ON public.kartoteka FOR UPDATE TO authenticated
  USING (auth.uid() = author_id);

CREATE POLICY "Users can delete own kartoteka entries"
  ON public.kartoteka FOR DELETE TO authenticated
  USING (auth.uid() = author_id);

CREATE TRIGGER update_kartoteka_updated_at
  BEFORE UPDATE ON public.kartoteka
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for kartoteka photos
INSERT INTO storage.buckets (id, name, public) VALUES ('kartoteka-photos', 'kartoteka-photos', true);

CREATE POLICY "Anyone can view kartoteka photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'kartoteka-photos');

CREATE POLICY "Authenticated users can upload kartoteka photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kartoteka-photos');

CREATE POLICY "Users can update own kartoteka photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'kartoteka-photos');

CREATE POLICY "Users can delete own kartoteka photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'kartoteka-photos');
