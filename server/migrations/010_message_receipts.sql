CREATE TABLE IF NOT EXISTS message_receipts (
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, recipient_id),
  CONSTRAINT message_receipts_read_requires_delivery
    CHECK (read_at IS NULL OR delivered_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS message_receipts_recipient_unread_idx
  ON message_receipts (recipient_id, read_at, message_id);

-- Preserve historical messages without inventing delivery or read timestamps.
-- Receipts are created for all new messages by the application transaction.
