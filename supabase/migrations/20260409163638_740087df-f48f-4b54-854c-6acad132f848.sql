
-- Create security definer function to check participation without RLS recursion
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = _conversation_id
      AND user_id = _user_id
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_conversation_participant FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant TO authenticated;

-- Fix conversation_participants policies
DROP POLICY IF EXISTS "Participants can view own participation" ON public.conversation_participants;
CREATE POLICY "Participants can view conversation members"
ON public.conversation_participants
FOR SELECT TO authenticated
USING (public.is_conversation_participant(conversation_id, auth.uid()));

-- Fix conversations policies
DROP POLICY IF EXISTS "Participants can view conversations" ON public.conversations;
CREATE POLICY "Participants can view conversations"
ON public.conversations
FOR SELECT TO authenticated
USING (public.is_conversation_participant(id, auth.uid()));

-- Fix messages policies
DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;
CREATE POLICY "Participants can view messages"
ON public.messages
FOR SELECT TO authenticated
USING (public.is_conversation_participant(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
CREATE POLICY "Participants can send messages"
ON public.messages
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = sender_id AND public.is_conversation_participant(conversation_id, auth.uid()));

-- Fix voice_rooms policies
DROP POLICY IF EXISTS "Participants can view voice rooms" ON public.voice_rooms;
CREATE POLICY "Participants can view voice rooms"
ON public.voice_rooms
FOR SELECT TO authenticated
USING (public.is_conversation_participant(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "Participants can create voice rooms" ON public.voice_rooms;
CREATE POLICY "Participants can create voice rooms"
ON public.voice_rooms
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by AND public.is_conversation_participant(conversation_id, auth.uid()));
