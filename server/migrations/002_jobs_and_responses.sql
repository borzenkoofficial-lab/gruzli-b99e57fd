ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified boolean,
  ADD COLUMN IF NOT EXISTS availability boolean[] NOT NULL DEFAULT ARRAY[]::boolean[],
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS is_company boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_self_employed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_id text,
  ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS premium_plan text,
  ADD COLUMN IF NOT EXISTS premium_until timestamptz;

CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  dispatcher_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 180),
  description text,
  hourly_rate numeric(12,2) NOT NULL CHECK (hourly_rate > 0),
  start_time timestamptz,
  duration_hours numeric(8,2) CHECK (duration_hours IS NULL OR duration_hours > 0),
  address text,
  metro text,
  workers_needed integer NOT NULL DEFAULT 1 CHECK (workers_needed BETWEEN 1 AND 100),
  urgent boolean NOT NULL DEFAULT false,
  quick_minimum boolean NOT NULL DEFAULT false,
  requires_contract boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open',
  is_bot boolean NOT NULL DEFAULT false,
  is_official boolean NOT NULL DEFAULT false,
  dispatcher_income numeric(12,2),
  expense_per_worker numeric(12,2),
  recurring_rule text,
  replacement_for_job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  replacement_for_worker_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  template_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jobs_status_created_idx ON jobs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_client_created_idx ON jobs (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_dispatcher_created_idx ON jobs (dispatcher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_worker_feed_idx ON jobs (created_at DESC) WHERE status IN ('active','open') AND dispatcher_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS job_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  message text,
  status text NOT NULL DEFAULT 'pending',
  worker_status text DEFAULT 'ready',
  agreed_hourly_rate numeric(12,2),
  dispatcher_review_rating numeric(3,2),
  dispatcher_review_text text,
  earned numeric(12,2),
  hours_worked numeric(8,2),
  work_finished_at timestamptz,
  work_started_at timestamptz,
  worker_review_rating numeric(3,2),
  worker_review_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_responses_worker_job_unique UNIQUE (job_id, worker_id)
);
CREATE INDEX IF NOT EXISTS job_responses_job_created_idx ON job_responses (job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS job_responses_worker_created_idx ON job_responses (worker_id, created_at DESC);
CREATE INDEX IF NOT EXISTS job_responses_status_idx ON job_responses (job_id, status);
