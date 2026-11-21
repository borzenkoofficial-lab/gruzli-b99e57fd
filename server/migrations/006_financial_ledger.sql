ALTER TABLE job_responses
  ADD COLUMN IF NOT EXISTS earnings_settled_at timestamptz;

CREATE TABLE IF NOT EXISTS financial_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  response_id uuid REFERENCES job_responses(id) ON DELETE RESTRICT,
  entry_type text NOT NULL CHECK (entry_type IN ('worker_earning', 'dispatcher_income', 'adjustment')),
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  currency char(3) NOT NULL DEFAULT 'RUB',
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_ledger_source_shape CHECK (
    (entry_type = 'worker_earning' AND response_id IS NOT NULL) OR
    (entry_type = 'dispatcher_income' AND response_id IS NULL) OR
    entry_type = 'adjustment'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS financial_ledger_response_entry_unique
  ON financial_ledger (response_id, entry_type)
  WHERE response_id IS NOT NULL AND entry_type = 'worker_earning';

CREATE UNIQUE INDEX IF NOT EXISTS financial_ledger_job_dispatcher_income_unique
  ON financial_ledger (job_id, entry_type)
  WHERE response_id IS NULL AND entry_type = 'dispatcher_income';

CREATE INDEX IF NOT EXISTS financial_ledger_user_created_idx
  ON financial_ledger (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS financial_ledger_job_idx
  ON financial_ledger (job_id, created_at DESC);

CREATE OR REPLACE FUNCTION prevent_financial_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'financial_ledger_is_immutable';
END;
$$;

DROP TRIGGER IF EXISTS financial_ledger_immutable ON financial_ledger;
CREATE TRIGGER financial_ledger_immutable
  BEFORE UPDATE OR DELETE ON financial_ledger
  FOR EACH ROW EXECUTE FUNCTION prevent_financial_ledger_mutation();
