ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false;

-- Existing last_seen_at values are historical activity, not proof of a live session.
UPDATE profiles SET is_online = false WHERE is_online IS DISTINCT FROM false;
