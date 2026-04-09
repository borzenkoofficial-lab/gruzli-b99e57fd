import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUnreadCounts() {
  const { user, role } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [newJobsCount, setNewJobsCount] = useState(0);

  // Fetch initial counts
  useEffect(() => {
    if (!user) return;

    // Count unread messages (messages in user's conversations not sent by user, from last 24h)
    const fetchUnreadMessages = async () => {
      const { data: myConvs } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);

      if (!myConvs || myConvs.length === 0) {
        setUnreadMessages(0);
        return;
      }

      const convIds = myConvs.map((c) => c.conversation_id);
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("conversation_id", convIds)
        .neq("sender_id", user.id)
        .gte("created_at", since);

      setUnreadMessages(count || 0);
    };

    // Count active jobs (for workers — new jobs in last 24h)
    const fetchNewJobs = async () => {
      if (role !== "worker") {
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
    };

    fetchUnreadMessages();
    fetchNewJobs();

    // Realtime updates
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
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "jobs" },
        () => {
          if (role === "worker") {
            setNewJobsCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, role]);

  const resetMessages = () => setUnreadMessages(0);
  const resetJobs = () => setNewJobsCount(0);

  return { unreadMessages, newJobsCount, resetMessages, resetJobs };
}
