CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('job', 'message', 'response', 'system')),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 180),
  body text NOT NULL DEFAULT '' CHECK (length(body) <= 2000),
  entity_type text,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx
  ON notifications (recipient_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS notifications_recipient_unread_idx
  ON notifications (recipient_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_recipient_dedupe_unique
  ON notifications (recipient_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
