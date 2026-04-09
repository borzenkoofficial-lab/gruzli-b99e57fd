
-- Channel posts table
CREATE TABLE public.channel_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.channel_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view posts"
  ON public.channel_posts FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Dispatchers can create posts"
  ON public.channel_posts FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = author_id AND has_role(auth.uid(), 'dispatcher'::app_role)
  );

CREATE POLICY "Authors can update own posts"
  ON public.channel_posts FOR UPDATE
  TO authenticated USING (auth.uid() = author_id);

CREATE POLICY "Authors can delete own posts"
  ON public.channel_posts FOR DELETE
  TO authenticated USING (auth.uid() = author_id);

CREATE TRIGGER update_channel_posts_updated_at
  BEFORE UPDATE ON public.channel_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Channel post likes table
CREATE TABLE public.channel_post_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.channel_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE public.channel_post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view likes"
  ON public.channel_post_likes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users can like posts"
  ON public.channel_post_likes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike posts"
  ON public.channel_post_likes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Channel post comments table
CREATE TABLE public.channel_post_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.channel_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.channel_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view comments"
  ON public.channel_post_comments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users can create comments"
  ON public.channel_post_comments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON public.channel_post_comments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_post_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_post_comments;
