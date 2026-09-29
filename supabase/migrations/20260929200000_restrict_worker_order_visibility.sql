-- Workers must not see unassigned customer requests.
-- Dispatcher discovery is the only route into an order before assignment.
DROP POLICY IF EXISTS "Participants can view relevant jobs" ON public.jobs;
CREATE POLICY "Participants can view relevant jobs"
  ON public.jobs FOR SELECT TO authenticated
  USING (
    (
      public.has_role(auth.uid(), 'worker')
      AND status = 'active'
      AND dispatcher_id IS NOT NULL
    )
    OR
    (
      public.has_role(auth.uid(), 'dispatcher')
      AND (
        dispatcher_id = auth.uid()
        OR (dispatcher_id IS NULL AND status = 'open')
      )
    )
    OR
    (
      public.has_role(auth.uid(), 'client')
      AND client_id = auth.uid()
    )
  );
