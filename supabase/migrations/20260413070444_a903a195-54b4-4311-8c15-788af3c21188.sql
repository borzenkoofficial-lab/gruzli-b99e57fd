
-- Add last_seen_at column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamp with time zone DEFAULT now();

-- Enable realtime for profiles so presence updates propagate
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
