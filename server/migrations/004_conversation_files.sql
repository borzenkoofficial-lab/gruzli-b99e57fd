CREATE TABLE IF NOT EXISTS conversation_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  storage_key text NOT NULL UNIQUE,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conversation_files_conversation_idx ON conversation_files (conversation_id, created_at DESC);
