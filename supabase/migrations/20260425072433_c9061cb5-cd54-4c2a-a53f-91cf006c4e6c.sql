-- New table for user-owned Telegram channels where the bot posts jobs
CREATE TABLE public.telegram_user_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chat_id bigint NOT NULL,
  title text,
  username text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, chat_id)
);

CREATE INDEX idx_telegram_user_channels_active ON public.telegram_user_channels(is_active) WHERE is_active = true;

ALTER TABLE public.telegram_user_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own channels"
  ON public.telegram_user_channels FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own channels"
  ON public.telegram_user_channels FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own channels"
  ON public.telegram_user_channels FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages channels"
  ON public.telegram_user_channels FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER trg_telegram_user_channels_updated
  BEFORE UPDATE ON public.telegram_user_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Extend link codes with a purpose so we can reuse them for channels
ALTER TABLE public.telegram_link_codes
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'personal';