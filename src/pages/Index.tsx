import { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import BottomNav from "@/components/BottomNav";
import DesktopSidebar from "@/components/DesktopSidebar";
import DesktopLayout from "@/components/DesktopLayout";
import FAB from "@/components/FAB";
import { useAuth } from "@/contexts/AuthContext";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
import { useIsMobile } from "@/hooks/use-mobile";

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
import PremiumScreen from "@/screens/PremiumScreen";
import DispatcherCabinetScreen from "@/screens/DispatcherCabinetScreen";
import PullToRefresh from "@/components/PullToRefresh";

import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const { role, user } = useAuth();
  const { unreadMessages, newJobsCount, resetMessages, resetJobs } = useUnreadCounts();
  const isMobile = useIsMobile();
  const SUPPORT_USER_ID = "de95eea5-d75b-4693-af15-020c58422126";
  const SUPPORT_NAME = "Gruzli Official";
  const [tab, setTab] = useState("feed");

  useEffect(() => {
    const handler = () => setTab("feed");
    window.addEventListener("navigate-to-feed", handler);
    return () => window.removeEventListener("navigate-to-feed", handler);
  }, []);

  // Handle deep link from push notification: /?openChat={conversationId}
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const chatId = params.get("openChat");
    if (chatId) {
      setTab("chats");
      setOpenChatId(chatId);
      setOpenChatTitle("");
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const [openChatId, setOpenChatId] = useState<string | null>(null);
  const [openChatTitle, setOpenChatTitle] = useState("");
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [viewResponsesJob, setViewResponsesJob] = useState<Tables<"jobs"> | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showChannel, setShowChannel] = useState(false);
  const [viewProfileUserId, setViewProfileUserId] = useState<string | null>(null);
  const [showPremium, setShowPremium] = useState(false);
  const [showCabinet, setShowCabinet] = useState(false);
  const isDispatcher = role === "dispatcher" || role === "admin";
  const feedRefreshRef = useRef<(() => Promise<void>) | null>(null);

  const handlePullRefresh = useCallback(async () => {
    if (feedRefreshRef.current) {
      await feedRefreshRef.current();
    }
  }, []);

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

    if (myConvsError) return false;

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

  const handleNavigate = (t: string) => {
    if (t === "chats") resetMessages();
    if (t === "feed" && !isDispatcher) resetJobs();
    setTab(t);
  };

  // --- Detail panel content for desktop ---
  const getDetailPanel = () => {
    if (openChatId) {
      return <RealChatScreen conversationId={openChatId} title={openChatTitle} onBack={() => setOpenChatId(null)} />;
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
    if (showSettings) {
      return <SettingsScreen onBack={() => setShowSettings(false)} />;
    }
    if (showNotifications) {
      return <NotificationsScreen onBack={() => setShowNotifications(false)} />;
    }
    if (showPremium) {
      return <PremiumScreen onBack={() => setShowPremium(false)} onOpenSupport={(msg) => { setShowPremium(false); handleChatWithUser(SUPPORT_USER_ID, SUPPORT_NAME, msg); }} />;
    }
    if (showChannel) {
      return <ChannelScreen onBack={() => setShowChannel(false)} />;
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
            if (opened) setViewResponsesJob(null);
          }}
        />
      );
    }
    if (showCabinet) {
      return (
        <DispatcherCabinetScreen
          onBack={() => setShowCabinet(false)}
          onChatWithWorker={async (workerId, workerName) => {
            const opened = await handleChatWithUser(workerId, workerName);
            if (opened) setShowCabinet(false);
          }}
          onViewProfile={(userId) => { setShowCabinet(false); setViewProfileUserId(userId); }}
        />
      );
    }
    return null;
  };

  // --- Mobile: full-screen overlays ---
  if (isMobile) {
    if (showNotifications) return <NotificationsScreen onBack={() => setShowNotifications(false)} />;
    if (showPremium) return <PremiumScreen onBack={() => setShowPremium(false)} onOpenSupport={(msg) => { setShowPremium(false); handleChatWithUser(SUPPORT_USER_ID, SUPPORT_NAME, msg); }} />;
    if (showChannel) return <ChannelScreen onBack={() => setShowChannel(false)} />;
    if (showSettings) return <SettingsScreen onBack={() => setShowSettings(false)} />;
    if (showCabinet) {
      return (
        <DispatcherCabinetScreen
          onBack={() => setShowCabinet(false)}
          onChatWithWorker={async (workerId, workerName) => {
            const opened = await handleChatWithUser(workerId, workerName);
            if (opened) setShowCabinet(false);
          }}
          onViewProfile={(userId) => { setShowCabinet(false); setViewProfileUserId(userId); }}
        />
      );
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
    if (openChatId) return <RealChatScreen conversationId={openChatId} title={openChatTitle} onBack={() => setOpenChatId(null)} />;
    if (showCreateJob) return <CreateJobScreen onBack={() => setShowCreateJob(false)} onCreated={() => { setShowCreateJob(false); setTab("feed"); }} />;
    if (viewResponsesJob) {
      return (
        <JobResponsesScreen
          job={viewResponsesJob}
          onBack={() => setViewResponsesJob(null)}
          onChatWithWorker={async (workerId, workerName) => {
            const opened = await handleChatWithUser(workerId, workerName);
            if (opened) setViewResponsesJob(null);
          }}
        />
      );
    }

    return (
      <div className="app-shell">
        {tab === "feed" ? (
          <PullToRefresh onRefresh={handlePullRefresh}>
            {isDispatcher ? (
              <DispatcherFeedScreen onCreateJob={() => setShowCreateJob(true)} onViewResponses={setViewResponsesJob} onRefreshRef={feedRefreshRef} />
            ) : (
              <FeedScreen onOpenChat={handleOpenChat} onOpenProfile={setViewProfileUserId} onRefreshRef={feedRefreshRef} />
            )}
          </PullToRefresh>
        ) : (
          <div className="app-scroll">
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                {tab === "orders" && <OrdersScreen />}
                {tab === "chats" && <RealChatsScreen onOpenChat={handleOpenChat} onOpenChannel={() => setShowChannel(true)} />}
                {tab === "kartoteka" && <KartotekaScreen />}
                {tab === "dispatchers" && !isDispatcher && <DispatchersScreen onChatWithDispatcher={(d) => handleChatWithUser(d.id, d.name)} />}
                {tab === "profile" && (
                  <ProfileScreen
                    onOpenSettings={() => setShowSettings(true)}
                    onOpenNotifications={() => setShowNotifications(true)}
                    onOpenSupport={(prefillMessage) => handleChatWithUser(SUPPORT_USER_ID, SUPPORT_NAME, prefillMessage)}
                    onOpenPremium={() => setShowPremium(true)}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
        {!isDispatcher && <FAB />}
        <BottomNav active={tab} onNavigate={handleNavigate} isDispatcher={isDispatcher} unreadMessages={unreadMessages} newJobsCount={newJobsCount} />
      </div>
    );
  }

  // --- Desktop layout ---
  const mainContent = (
    <>
      {tab === "feed" && (
        isDispatcher ? (
          <DispatcherFeedScreen onCreateJob={() => setShowCreateJob(true)} onViewResponses={setViewResponsesJob} onRefreshRef={feedRefreshRef} />
        ) : (
          <FeedScreen onOpenChat={handleOpenChat} onOpenProfile={setViewProfileUserId} onRefreshRef={feedRefreshRef} />
        )
      )}
      {tab === "orders" && <OrdersScreen />}
      {tab === "chats" && <RealChatsScreen onOpenChat={handleOpenChat} onOpenChannel={() => setShowChannel(true)} />}
      {tab === "kartoteka" && <KartotekaScreen />}
      {tab === "dispatchers" && !isDispatcher && <DispatchersScreen onChatWithDispatcher={(d) => handleChatWithUser(d.id, d.name)} />}
      {tab === "profile" && (
        <ProfileScreen
          onOpenSettings={() => setShowSettings(true)}
          onOpenNotifications={() => setShowNotifications(true)}
          onOpenSupport={(prefillMessage) => handleChatWithUser(SUPPORT_USER_ID, SUPPORT_NAME, prefillMessage)}
          onOpenPremium={() => setShowPremium(true)}
        />
      )}
    </>
  );

  const sidebar = (
    <DesktopSidebar
      active={tab}
      onNavigate={handleNavigate}
      isDispatcher={isDispatcher}
      unreadMessages={unreadMessages}
      newJobsCount={newJobsCount}
    />
  );

  return (
    <DesktopLayout
      sidebar={sidebar}
      main={mainContent}
      detail={getDetailPanel()}
    />
  );
};

export default Index;
