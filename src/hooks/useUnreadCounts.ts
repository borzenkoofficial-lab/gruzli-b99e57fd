import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUnreadCounts() {
  const { user, role } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [newJobsCount, setNewJobsCount] = useState(0);

  const fetchUnreadMessages = useCallback(async () => {
    if (!user) return;

    // Get all conversations with their last_read_at
    const { data: myConvs } = await supabase
      .from("conversation_participants")
      .select("conversation_id, last_read_at")
      .eq("user_id", user.id);

    if (!myConvs || myConvs.length === 0) {
      setUnreadMessages(0);
      return;
    }

    let total = 0;
    // Count messages newer than last_read_at for each conversation
    for (const conv of myConvs) {
      const q = supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", conv.conversation_id)
        .neq("sender_id", user.id);

      if (conv.last_read_at) {
        q.gt("created_at", conv.last_read_at);
      }

      const { count } = await q;
      total += count || 0;
    }

    setUnreadMessages(total);
  }, [user]);

  const fetchNewJobs = useCallback(async () => {
    if (!user || role !== "worker") {
      setNewJobsCount(0);
      return;
    }
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .gte("created_at", since);
    setNewJobsCount(count || 0);
  }, [user, role]);

  useEffect(() => {
    if (!user) return;

    fetchUnreadMessages();
    fetchNewJobs();

    const channel = supabase
      .channel("unread-counts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as any;
          if (msg.sender_id !== user.id) {
            setUnreadMessages((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, role, fetchUnreadMessages, fetchNewJobs]);

  const resetMessages = () => setUnreadMessages(0);
  const resetJobs = () => setNewJobsCount(0);
  const refetchUnread = fetchUnreadMessages;

  return { unreadMessages, newJobsCount, resetMessages, resetJobs, refetchUnread };
}
