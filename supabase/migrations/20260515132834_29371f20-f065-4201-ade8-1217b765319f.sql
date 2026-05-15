
CREATE TABLE IF NOT EXISTS public.telegram_fsm_state (
  chat_id bigint PRIMARY KEY,
  user_id uuid,
  state text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour')
);

ALTER TABLE public.telegram_fsm_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages fsm state"
  ON public.telegram_fsm_state
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_telegram_fsm_expires ON public.telegram_fsm_state (expires_at);
