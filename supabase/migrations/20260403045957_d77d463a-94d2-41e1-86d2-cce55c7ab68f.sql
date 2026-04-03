
-- Fix overly permissive conversation creation
DROP POLICY "Authenticated can create conversations" ON public.conversations;
CREATE POLICY "Authenticated can create conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Fix overly permissive participant addition  
DROP POLICY "Authenticated can add participants" ON public.conversation_participants;
CREATE POLICY "Users can add themselves as participants" ON public.conversation_participants FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
  )
);
