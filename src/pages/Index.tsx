import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import BottomNav from "@/components/BottomNav";
import FAB from "@/components/FAB";
import { useAuth } from "@/contexts/AuthContext";

// Worker screens
import FeedScreen from "@/screens/FeedScreen";
import OrdersScreen from "@/screens/OrdersScreen";
import ProfileScreen from "@/screens/ProfileScreen";

// Dispatcher screens
import DispatcherFeedScreen from "@/screens/DispatcherFeedScreen";
import CreateJobScreen from "@/screens/CreateJobScreen";
import JobResponsesScreen from "@/screens/JobResponsesScreen";

// Shared screens
import RealChatsScreen from "@/screens/RealChatsScreen";
import RealChatScreen from "@/screens/RealChatScreen";
import DispatchersScreen from "@/screens/DispatchersScreen";
import KartotekaScreen from "@/screens/KartotekaScreen";

import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const { role, user } = useAuth();
  const [tab, setTab] = useState("feed");
  const [openChatId, setOpenChatId] = useState<string | null>(null);
  const [openChatTitle, setOpenChatTitle] = useState("");
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [viewResponsesJob, setViewResponsesJob] = useState<Tables<"jobs"> | null>(null);

  const isDispatcher = role === "dispatcher";

  const handleOpenChat = (conversationId: string, title: string) => {
    setOpenChatId(conversationId);
    setOpenChatTitle(title);
  };

  const handleChatWithUser = async (otherUserId: string, otherName: string) => {
    if (!user) return false;
    // Check if conversation already exists between these two users
    const { data: myConvs, error: myConvsError } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (myConvsError) {
      return false;
    }

    if (myConvs) {
      for (const mc of myConvs) {
        const { data: otherParticipant } = await supabase
          .from("conversation_participants")
          .select("id")
          .eq("conversation_id", mc.conversation_id)
          .eq("user_id", otherUserId)
          .single();
        if (otherParticipant) {
          handleOpenChat(mc.conversation_id, otherName);
          return true;
        }
      }
    }

    const { data: conv, error: convError } = await supabase
      .from("conversations")
      .insert({ title: otherName })
      .select()
      .single();

    if (convError || !conv) {
      return false;
    }

    const { error: participantsError } = await supabase.from("conversation_participants").insert([
      { conversation_id: conv.id, user_id: user.id },
      { conversation_id: conv.id, user_id: otherUserId },
    ]);

    if (participantsError) {
      return false;
    }

    handleOpenChat(conv.id, otherName);
    return true;
  };

  // Full-screen overlays
  if (openChatId) {
    return <RealChatScreen conversationId={openChatId} title={openChatTitle} onBack={() => setOpenChatId(null)} />;
  }

  if (showCreateJob) {
    return <CreateJobScreen onBack={() => setShowCreateJob(false)} onCreated={() => { setShowCreateJob(false); setTab("feed"); }} />;
  }

  if (viewResponsesJob) {
    return (
      <JobResponsesScreen
        job={viewResponsesJob}
        onBack={() => setViewResponsesJob(null)}
        onChatWithWorker={async (workerId, workerName) => {
          const opened = await handleChatWithUser(workerId, workerName);
          if (opened) {
            setViewResponsesJob(null);
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {tab === "feed" && (
            isDispatcher ? (
              <DispatcherFeedScreen
                onCreateJob={() => setShowCreateJob(true)}
                onViewResponses={setViewResponsesJob}
              />
            ) : (
              <FeedScreen onOpenChat={handleOpenChat} />
            )
          )}
          {tab === "orders" && <OrdersScreen />}
          {tab === "chats" && <RealChatsScreen onOpenChat={handleOpenChat} />}
          {tab === "kartoteka" && <KartotekaScreen />}
          {tab === "dispatchers" && !isDispatcher && (
            <DispatchersScreen onChatWithDispatcher={(d) => handleChatWithUser(d.id, d.name)} />
          )}
          {tab === "profile" && <ProfileScreen />}
        </motion.div>
      </AnimatePresence>
      {!isDispatcher && <FAB />}
      <BottomNav active={tab} onNavigate={setTab} isDispatcher={isDispatcher} />
    </div>
  );
};

export default Index;
