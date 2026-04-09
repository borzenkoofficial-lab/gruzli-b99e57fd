
-- Drop old policy and recreate to allow admin + dispatcher
DROP POLICY IF EXISTS "Dispatchers can create posts" ON public.channel_posts;
CREATE POLICY "Dispatchers and admins can create posts"
ON public.channel_posts FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = author_id AND (
    has_role(auth.uid(), 'dispatcher') OR public.is_admin(auth.uid())
  )
);
