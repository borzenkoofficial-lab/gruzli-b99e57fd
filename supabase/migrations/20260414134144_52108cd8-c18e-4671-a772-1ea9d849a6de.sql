-- Allow senders to delete their own messages
CREATE POLICY "Users can delete own messages"
ON public.messages
FOR DELETE
TO authenticated
USING (auth.uid() = sender_id);

-- Allow admins to delete any message (moderation)
CREATE POLICY "Admins can delete any message"
ON public.messages
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));