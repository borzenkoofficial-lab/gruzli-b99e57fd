
-- Allow viewing profile of any user you share a conversation with
CREATE POLICY "Conversation participants view profile"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.conversation_participants cp_self
    JOIN public.conversation_participants cp_other
      ON cp_other.conversation_id = cp_self.conversation_id
    WHERE cp_self.user_id = auth.uid()
      AND cp_other.user_id = profiles.user_id
  )
);

-- Allow viewing counterparty profile from the moment of any job response (not only accepted)
CREATE POLICY "Job response counterparties view profile"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.job_responses jr
    JOIN public.jobs j ON j.id = jr.job_id
    WHERE (jr.worker_id = profiles.user_id AND j.dispatcher_id = auth.uid())
       OR (j.dispatcher_id = profiles.user_id AND jr.worker_id = auth.uid())
  )
);
