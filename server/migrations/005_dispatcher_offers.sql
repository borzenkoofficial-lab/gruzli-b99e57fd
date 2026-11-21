CREATE TABLE IF NOT EXISTS dispatcher_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  dispatcher_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  proposed_hourly_rate numeric(12,2) NOT NULL CHECK (proposed_hourly_rate > 0),
  proposed_workers integer NOT NULL CHECK (proposed_workers BETWEEN 1 AND 100),
  message text CHECK (message IS NULL OR length(message) <= 1000),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dispatcher_offers_job_dispatcher_unique UNIQUE (job_id, dispatcher_id)
);

CREATE INDEX IF NOT EXISTS dispatcher_offers_job_status_idx
  ON dispatcher_offers (job_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS dispatcher_offers_dispatcher_status_idx
  ON dispatcher_offers (dispatcher_id, status, created_at DESC);
