
-- Fix conversations SELECT policy (was comparing wrong columns)
DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;
CREATE POLICY "Participants can view conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversations.id AND cp.user_id = auth.uid()
  ));

-- Fix conversation_participants SELECT policy
DROP POLICY IF EXISTS "Participants can view own participation" ON public.conversation_participants;
CREATE POLICY "Participants can view own participation"
  ON public.conversation_participants FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.conversation_participants cp2
      WHERE cp2.conversation_id = conversation_participants.conversation_id
        AND cp2.user_id = auth.uid()
    )
  );

-- Fix conversation_participants INSERT policy
DROP POLICY IF EXISTS "Users can add themselves as participants" ON public.conversation_participants;
CREATE POLICY "Authenticated can add participants"
  ON public.conversation_participants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Add media_url to messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_url text DEFAULT '';

-- Create chat-media storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can upload chat media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-media');

CREATE POLICY "Anyone can view chat media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-media');

-- Voice rooms table
CREATE TABLE IF NOT EXISTS public.voice_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.voice_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view voice rooms"
  ON public.voice_rooms FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = voice_rooms.conversation_id AND cp.user_id = auth.uid()
  ));

CREATE POLICY "Participants can create voice rooms"
  ON public.voice_rooms FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = voice_rooms.conversation_id AND cp.user_id = auth.uid()
  ));

CREATE POLICY "Creator can update voice room"
  ON public.voice_rooms FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);

-- Enable realtime for voice_rooms
ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_rooms;
