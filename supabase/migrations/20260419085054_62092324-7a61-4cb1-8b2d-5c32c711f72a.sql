-- Telegram bot polling state (singleton)
CREATE TABLE IF NOT EXISTS public.telegram_bot_state (
  id int PRIMARY KEY CHECK (id = 1),
  update_offset bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.telegram_bot_state (id, update_offset)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.telegram_bot_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages bot state"
  ON public.telegram_bot_state
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Telegram subscribers (chat_ids that pressed /start)
CREATE TABLE IF NOT EXISTS public.telegram_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id bigint NOT NULL UNIQUE,
  username text,
  first_name text,
  last_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_subscribers_active
  ON public.telegram_subscribers (is_active) WHERE is_active = true;

ALTER TABLE public.telegram_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view subscribers"
  ON public.telegram_subscribers
  FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Service role manages subscribers"
  ON public.telegram_subscribers
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER trg_telegram_subscribers_updated_at
  BEFORE UPDATE ON public.telegram_subscribers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
