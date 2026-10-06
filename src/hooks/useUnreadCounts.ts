import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUnreadCounts() {
  const { user, role } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [newJobsCount, setNewJobsCount] = useState(0);

  const fetchUnreadMessages = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase.rpc("get_unread_message_count");
    if (error) {
      console.error("Failed to load unread message count", error);
      return;
    }

    setUnreadMessages(Number(data || 0));
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
