
CREATE TABLE public.fraud_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL,
  job_id UUID,
  dispatcher_id UUID,
  reason TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID
);

ALTER TABLE public.fraud_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own fraud reports"
ON public.fraud_reports FOR INSERT TO authenticated
WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own fraud reports"
ON public.fraud_reports FOR SELECT TO authenticated
USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can view all fraud reports"
ON public.fraud_reports FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update fraud reports"
ON public.fraud_reports FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete fraud reports"
ON public.fraud_reports FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

CREATE INDEX idx_fraud_reports_status_created ON public.fraud_reports(status, created_at DESC);
CREATE INDEX idx_fraud_reports_dispatcher ON public.fraud_reports(dispatcher_id);
