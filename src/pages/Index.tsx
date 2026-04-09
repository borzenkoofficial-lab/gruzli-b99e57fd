import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import BottomNav from "@/components/BottomNav";
import FAB from "@/components/FAB";
import { useAuth } from "@/contexts/AuthContext";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";

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
import ChannelScreen from "@/screens/ChannelScreen";
import DispatchersScreen from "@/screens/DispatchersScreen";
import KartotekaScreen from "@/screens/KartotekaScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import UserProfileScreen from "@/screens/UserProfileScreen";
import NotificationsScreen from "@/screens/NotificationsScreen";

import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const { role, user } = useAuth();
  const { unreadMessages, newJobsCount, resetMessages, resetJobs } = useUnreadCounts();
  const SUPPORT_USER_ID = "de95eea5-d75b-4693-af15-020c58422126";
  const SUPPORT_NAME = "Gruzli Official";
  const [tab, setTab] = useState("feed");

  // Listen for navigate-to-feed events from NewJobAlert
  useEffect(() => {
    const handler = () => setTab("feed");
    window.addEventListener("navigate-to-feed", handler);
    return () => window.removeEventListener("navigate-to-feed", handler);
  }, []);
  const [openChatId, setOpenChatId] = useState<string | null>(null);
  const [openChatTitle, setOpenChatTitle] = useState("");
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [viewResponsesJob, setViewResponsesJob] = useState<Tables<"jobs"> | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showChannel, setShowChannel] = useState(false);
  const [viewProfileUserId, setViewProfileUserId] = useState<string | null>(null);
  const isDispatcher = role === "dispatcher" || role === "admin";

  const handleOpenChat = (conversationId: string, title: string) => {
    setOpenChatId(conversationId);
    setOpenChatTitle(title);
  };

  const handleChatWithUser = async (otherUserId: string, otherName: string, prefillMessage?: string) => {
    if (!user) return false;

    const { data: myConvs, error: myConvsError } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (myConvsError) {
      return false;
    }

    let conversationId: string | null = null;

    if (myConvs) {
      for (const mc of myConvs) {
        const { data: otherParticipant } = await supabase
          .from("conversation_participants")
          .select("id")
          .eq("conversation_id", mc.conversation_id)
          .eq("user_id", otherUserId)
          .single();

        if (otherParticipant) {
          conversationId = mc.conversation_id;
          break;
        }
      }
    }

    if (!conversationId) {
      conversationId = crypto.randomUUID();
      const { error: convError } = await supabase
        .from("conversations")
        .insert({ id: conversationId, title: otherName });

      if (convError) return false;

      const { error: participantsError } = await supabase.from("conversation_participants").insert([
        { conversation_id: conversationId, user_id: user.id },
        { conversation_id: conversationId, user_id: otherUserId },
      ]);

      if (participantsError) return false;
    }

    // Send prefill message if provided
    if (prefillMessage && conversationId) {
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        text: prefillMessage,
      });
    }

    handleOpenChat(conversationId, otherName);
    return true;
  };

  // Full-screen overlays
  if (showNotifications) {
    return <NotificationsScreen onBack={() => setShowNotifications(false)} />;
  }

  if (showChannel) {
    return <ChannelScreen onBack={() => setShowChannel(false)} />;
  }

  if (showSettings) {
    return <SettingsScreen onBack={() => setShowSettings(false)} />;
  }

  if (viewProfileUserId) {
    return (
      <UserProfileScreen
        userId={viewProfileUserId}
        onBack={() => setViewProfileUserId(null)}
        onChat={async (userId, name) => {
          const opened = await handleChatWithUser(userId, name);
          if (opened) setViewProfileUserId(null);
        }}
      />
    );
  }

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
    <div className="h-full bg-background max-w-lg mx-auto relative flex flex-col overflow-hidden">
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
              <FeedScreen onOpenChat={handleOpenChat} onOpenProfile={setViewProfileUserId} />
            )
          )}
          {tab === "orders" && <OrdersScreen />}
          {tab === "chats" && <RealChatsScreen onOpenChat={handleOpenChat} onOpenChannel={() => setShowChannel(true)} />}
          {tab === "kartoteka" && <KartotekaScreen />}
          {tab === "dispatchers" && !isDispatcher && (
            <DispatchersScreen onChatWithDispatcher={(d) => handleChatWithUser(d.id, d.name)} />
          )}
          {tab === "profile" && (
            <ProfileScreen
              onOpenSettings={() => setShowSettings(true)}
              onOpenNotifications={() => setShowNotifications(true)}
              onOpenSupport={(prefillMessage) => handleChatWithUser(SUPPORT_USER_ID, SUPPORT_NAME, prefillMessage)}
            />
          )}
        </motion.div>
      </AnimatePresence>
      {!isDispatcher && <FAB />}
      <BottomNav
        active={tab}
        onNavigate={(t) => {
          if (t === "chats") resetMessages();
          if (t === "feed" && !isDispatcher) resetJobs();
          setTab(t);
        }}
        isDispatcher={isDispatcher}
        unreadMessages={unreadMessages}
        newJobsCount={newJobsCount}
      />
    </div>
  );
};

export default Index;
