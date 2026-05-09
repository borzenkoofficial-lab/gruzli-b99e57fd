
-- Documents table
CREATE TABLE public.job_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  dispatcher_id uuid NOT NULL,
  worker_id uuid,
  type text NOT NULL CHECK (type IN ('act','receipt','contract')),
  number text,
  title text NOT NULL DEFAULT '',
  amount integer NOT NULL DEFAULT 0,
  hours numeric,
  pdf_path text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_documents_dispatcher ON public.job_documents(dispatcher_id);
CREATE INDEX idx_job_documents_worker ON public.job_documents(worker_id);
CREATE INDEX idx_job_documents_job ON public.job_documents(job_id);
CREATE INDEX idx_job_documents_type ON public.job_documents(type);

ALTER TABLE public.job_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dispatchers manage own documents"
  ON public.job_documents FOR ALL TO authenticated
  USING (auth.uid() = dispatcher_id)
  WITH CHECK (auth.uid() = dispatcher_id);

CREATE POLICY "Workers view own documents"
  ON public.job_documents FOR SELECT TO authenticated
  USING (auth.uid() = worker_id);

CREATE POLICY "Admins view all documents"
  ON public.job_documents FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Profile fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS inn text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_self_employed boolean NOT NULL DEFAULT false;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (path: {document_id}/{filename})
CREATE POLICY "Dispatchers read own document files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.job_documents d
      WHERE d.id::text = (storage.foldername(name))[1]
        AND d.dispatcher_id = auth.uid()
    )
  );

CREATE POLICY "Workers read own document files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.job_documents d
      WHERE d.id::text = (storage.foldername(name))[1]
        AND d.worker_id = auth.uid()
    )
  );

CREATE POLICY "Admins read all document files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND public.is_admin(auth.uid()));
