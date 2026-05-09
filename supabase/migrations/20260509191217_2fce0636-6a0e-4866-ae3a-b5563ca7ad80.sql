
-- Add requires_contract flag to jobs
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS requires_contract boolean NOT NULL DEFAULT false;

-- job_contracts table
CREATE TABLE public.job_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  dispatcher_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Договор подряда',
  body text NOT NULL DEFAULT '',
  terms jsonb NOT NULL DEFAULT '{}'::jsonb,
  dispatcher_signature_url text,
  dispatcher_signed_at timestamptz,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_job_contracts_job ON public.job_contracts(job_id);
CREATE INDEX idx_job_contracts_dispatcher ON public.job_contracts(dispatcher_id);

ALTER TABLE public.job_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dispatchers manage own contracts"
  ON public.job_contracts FOR ALL
  TO authenticated
  USING (auth.uid() = dispatcher_id)
  WITH CHECK (auth.uid() = dispatcher_id);

CREATE POLICY "Accepted workers can view contract"
  ON public.job_contracts FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.job_responses jr
    WHERE jr.job_id = job_contracts.job_id
      AND jr.worker_id = auth.uid()
      AND jr.status = 'accepted'
  ));

CREATE POLICY "Admins view all contracts"
  ON public.job_contracts FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_job_contracts_updated
  BEFORE UPDATE ON public.job_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- contract_signatures
CREATE TABLE public.contract_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  signature_url text NOT NULL,
  signed_pdf_url text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  UNIQUE (contract_id, worker_id)
);
CREATE INDEX idx_contract_signatures_contract ON public.contract_signatures(contract_id);
CREATE INDEX idx_contract_signatures_worker ON public.contract_signatures(worker_id);

ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workers sign own"
  ON public.contract_signatures FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = worker_id);

CREATE POLICY "Workers view own signatures"
  ON public.contract_signatures FOR SELECT
  TO authenticated
  USING (auth.uid() = worker_id);

CREATE POLICY "Dispatchers view signatures of own contracts"
  ON public.contract_signatures FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.job_contracts c
    WHERE c.id = contract_signatures.contract_id
      AND c.dispatcher_id = auth.uid()
  ));

CREATE POLICY "Service role updates signatures"
  ON public.contract_signatures FOR UPDATE
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins view all signatures"
  ON public.contract_signatures FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: path is {contract_id}/{filename}
CREATE POLICY "Dispatchers upload to own contract folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'contracts'
    AND EXISTS (
      SELECT 1 FROM public.job_contracts c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND c.dispatcher_id = auth.uid()
    )
  );

CREATE POLICY "Workers upload signatures to accepted contract"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'contracts'
    AND EXISTS (
      SELECT 1 FROM public.job_contracts c
      JOIN public.job_responses jr ON jr.job_id = c.job_id
      WHERE c.id::text = (storage.foldername(name))[1]
        AND jr.worker_id = auth.uid()
        AND jr.status = 'accepted'
    )
  );

CREATE POLICY "Contract parties read files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'contracts'
    AND EXISTS (
      SELECT 1 FROM public.job_contracts c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND (
          c.dispatcher_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.job_responses jr
            WHERE jr.job_id = c.job_id
              AND jr.worker_id = auth.uid()
              AND jr.status = 'accepted'
          )
          OR public.is_admin(auth.uid())
        )
    )
  );

CREATE POLICY "Service role manages contract files"
  ON storage.objects FOR ALL
  TO public
  USING (bucket_id = 'contracts' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'contracts' AND auth.role() = 'service_role');
